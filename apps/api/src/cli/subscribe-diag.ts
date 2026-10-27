import { createHmac } from 'node:crypto';
import { openFromString } from '../common/crypto/secret-box.js';
import { APP_SECRET_AAD } from '../modules/meta/meta.constants.js';
import { createClient, fail, parseArgs } from './lib.js';

const TOKEN_PATTERN = /EAA[A-Za-z0-9._-]+/g;

function redact(value: string): string {
  return value.replace(TOKEN_PATTERN, '[REDACTED]');
}

function print(label: string, value: unknown): void {
  console.log(`${label}: ${redact(JSON.stringify(value))}`);
}

async function graphFetch(
  version: string,
  path: string,
  params: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const url = new URL(`https://graph.facebook.com/${version}${path}`);
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prisma = createClient();
  try {
    const cfg = await prisma.metaAppConfig.findFirst();
    if (!cfg?.appSecretCipher) fail('META app config/secret missing (set it in /connections first).');

    const key = process.env['APP_ENCRYPTION_KEY'];
    if (!key) fail('APP_ENCRYPTION_KEY is not set in apps/api/.env');
    const appSecret = openFromString(cfg.appSecretCipher, APP_SECRET_AAD, Buffer.from(key, 'base64'));

    const asset = await prisma.metaConnectedAsset.findFirst({
      where: {
        platform: 'facebook',
        connectionStatus: 'connected',
        ...(args['asset'] ? { id: args['asset'] } : {}),
      },
    });
    if (!asset) fail('No connected facebook asset found (run OAuth connect first).');

    const credential = await prisma.metaCredential.findUnique({ where: { assetId: asset.id } });
    if (!credential) fail('Credential row missing for the asset.');

    const pageToken = openFromString(
      `${credential.keyVersion}:${credential.nonce}:${credential.ciphertext}`,
      `${credential.id}:${asset.id}`,
      Buffer.from(key, 'base64'),
    );

    const version = cfg.graphApiVersion || 'v26.0';
    const proof = cfg.appsecretProofEnabled
      ? createHmac('sha256', appSecret).update(pageToken).digest('hex')
      : undefined;

    console.log(`Asset: ${asset.displayName} (page ${asset.externalId})`);
    console.log(`Graph version: ${version}`);
    console.log('');

    const current = await graphFetch(version, `/${asset.externalId}/subscribed_apps`, {
      access_token: pageToken,
      ...(proof ? { appsecret_proof: proof } : {}),
    });
    print('GET /{page-id}/subscribed_apps status', current.status);
    print('current subscriptions', current.body);
    console.log('');

    const subscribe = await graphFetch(version, `/${asset.externalId}/subscribed_apps`, {
      subscribed_fields: 'feed',
      access_token: pageToken,
      ...(proof ? { appsecret_proof: proof } : {}),
    });
    print('POST /{page-id}/subscribed_apps status', subscribe.status);
    print('subscribe result', subscribe.body);
    console.log('');

    const error = subscribe.body?.['error'] as { code?: number; subcode?: number; message?: string; fbtrace_id?: string } | undefined;
    if (error) {
      console.log('DIAGNOSIS: subscription FAILED');
      console.log(`  code=${error.code ?? '-'} subcode=${error.subcode ?? '-'} fbtrace=${error.fbtrace_id ?? '-'}`);
      console.log(`  message=${redact(error.message ?? '')}`);
      process.exitCode = 1;
    } else {
      console.log('DIAGNOSIS: subscription OK — webhook page/feed is now active.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
