import { createClient, fail } from './lib.js';
import {
  decodeBase64Key,
  openFromStringWithKeys,
  openFromPartsWithKeys,
  sealToString,
  sealToParts,
} from '../common/crypto/secret-box.js';
import { APP_SECRET_AAD, VERIFY_TOKEN_AAD } from '../modules/meta/meta.constants.js';

/**
 * Re-encrypts all stored ciphertexts with the current primary APP_ENCRYPTION_KEY.
 * Used during key rotation when APP_ENCRYPTION_KEY has been updated and the previous
 * key is provided in APP_ENCRYPTION_KEY_OLD.
 *
 * Gate G6: Key rotation writes an audit log entry with redacted change summary.
 */
async function main(): Promise<void> {
  const primaryRaw = process.env['APP_ENCRYPTION_KEY'];
  if (!primaryRaw) {
    fail('APP_ENCRYPTION_KEY is not set');
  }

  const primaryKey = decodeBase64Key(primaryRaw);
  const oldRaw = process.env['APP_ENCRYPTION_KEY_OLD'];
  const oldKeys = oldRaw
    ? oldRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => decodeBase64Key(s))
    : [];

  const candidateKeys = [primaryKey, ...oldKeys];

  const prisma = createClient();
  try {
    let configUpdated = false;
    let credentialsUpdated = 0;

    // 1. Re-encrypt MetaAppConfig
    const config = await prisma.metaAppConfig.findFirst();
    if (config) {
      let newAppSecretCipher = config.appSecretCipher;
      let newVerifyTokenCipher = config.webhookVerifyTokenCipher;

      if (config.appSecretCipher) {
        const plainSecret = openFromStringWithKeys(config.appSecretCipher, APP_SECRET_AAD, candidateKeys);
        newAppSecretCipher = sealToString(plainSecret, APP_SECRET_AAD, primaryKey);
      }

      if (config.webhookVerifyTokenCipher) {
        const plainVerify = openFromStringWithKeys(config.webhookVerifyTokenCipher, VERIFY_TOKEN_AAD, candidateKeys);
        newVerifyTokenCipher = sealToString(plainVerify, VERIFY_TOKEN_AAD, primaryKey);
      }

      await prisma.metaAppConfig.update({
        where: { id: config.id },
        data: {
          appSecretCipher: newAppSecretCipher,
          webhookVerifyTokenCipher: newVerifyTokenCipher,
          rotatedAt: new Date(),
        },
      });
      configUpdated = true;
    }

    // 2. Re-encrypt all MetaCredential rows
    const credentials = await prisma.metaCredential.findMany();
    for (const cred of credentials) {
      const aad = `${cred.id}:${cred.assetId}`;
      const plainToken = openFromPartsWithKeys(
        {
          ciphertext: cred.ciphertext,
          nonce: cred.nonce,
          keyVersion: cred.keyVersion,
        },
        aad,
        candidateKeys,
      );

      const sealed = sealToParts(plainToken, aad, primaryKey);
      await prisma.metaCredential.update({
        where: { id: cred.id },
        data: {
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          keyVersion: sealed.keyVersion,
        },
      });
      credentialsUpdated++;
    }

    // 3. Write audit log row (Gate G6)
    await prisma.auditLog.create({
      data: {
        action: 'crypto.key.rotated',
        actorType: 'cli',
        entity: 'encryption_key',
        meta: {
          configRotated: configUpdated,
          credentialsReencrypted: credentialsUpdated,
          oldKeysProvidedCount: oldKeys.length,
        },
      },
    });

    console.log('=== Key Rotation Complete ===');
    console.log(`MetaAppConfig re-encrypted: ${configUpdated ? 'Yes' : 'No'}`);
    console.log(`Asset credentials re-encrypted: ${credentialsUpdated}`);
    console.log('Audit log record created: crypto.key.rotated');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => fail(`Key rotation failed: ${(err as Error).message}`));
