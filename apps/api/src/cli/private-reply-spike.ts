import { createHmac } from 'node:crypto';
import { openFromString } from '../common/crypto/secret-box.js';
import { APP_SECRET_AAD } from '../modules/meta/meta.constants.js';
import { createClient, fail, parseArgs } from './lib.js';

/**
 * G2.4 private-reply feasibility spike (Phase 0 §Gate G2.4).
 *
 * DRY-RUN by default: prints the exact endpoint/permissions/body that would
 * be called. Pass --send ONLY after explicit owner approval, on the owner's
 * own test post/comment. Nothing is persisted; tokens are never printed.
 *
 * Usage:
 *   node apps/api/dist/cli/private-reply-spike.js \
 *     --variant=fb --asset=<asset-uuid> --comment=<comment-id> \
 *     --recipient=<psid> --message="test reply" [--send]
 *   node apps/api/dist/cli/private-reply-spike.js \
 *     --variant=ig --asset=<asset-uuid> --ig-user-id=<ig-user-id> \
 *     --comment=<comment-id> --recipient=<ig-scoped-user-id> \
 *     --message="test reply" [--send]
 */

const TOKEN_PATTERN = /EAA[A-Za-z0-9._-]+/g;

function redact(value: string): string {
  return value.replace(TOKEN_PATTERN, '[REDACTED]');
}

const REQUIREMENTS: Record<string, string[]> = {
  fb: ['pages_messaging', 'pages_read_engagement', 'pages_show_list'],
  ig: ['instagram_basic', 'instagram_manage_comments', 'pages_read_engagement', 'pages_show_list'],
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const variant = args['variant'];
  const assetId = args['asset'];
  const comment = args['comment'];
  const recipient = args['recipient'];
  const message = args['message'];
  const send = args['send'] !== undefined;

  if (variant !== 'fb' && variant !== 'ig') {
    fail('Usage: --variant=fb|ig --asset=<uuid> --comment=<id> --recipient=<id> --message=<text> [--send]');
  }
  if (!assetId || !comment || !recipient || !message) {
    fail('Missing required: --asset --comment --recipient --message (see header of private-reply-spike.ts).');
  }
  if (variant === 'ig' && !args['ig-user-id']) {
    fail('variant=ig requires --ig-user-id (the linked Instagram professional account id).');
  }

  const prisma = createClient();
  try {
    const cfg = await prisma.metaAppConfig.findFirst();
    if (!cfg?.appSecretCipher) fail('META app config/secret missing (set it in /connections first).');
    const key = process.env['APP_ENCRYPTION_KEY'];
    if (!key) fail('APP_ENCRYPTION_KEY is not set in apps/api/.env');

    const asset = await prisma.metaConnectedAsset.findFirst({ where: { id: assetId } });
    if (!asset) fail('Asset not found.');
    const credential = await prisma.metaCredential.findUnique({ where: { assetId: asset.id } });
    if (!credential) fail('Credential row missing for the asset.');

    const token = openFromString(
      `${credential.keyVersion}:${credential.nonce}:${credential.ciphertext}`,
      `${credential.id}:${asset.id}`,
      Buffer.from(key, 'base64'),
    );

    const version = cfg.graphApiVersion || 'v26.0';
    const endpoint =
      variant === 'fb'
        ? `https://graph.facebook.com/${version}/${asset.externalId}/messages`
        : `https://graph.facebook.com/${version}/${args['ig-user-id']}/messages`;
    const body = { recipient: { id: recipient }, message: { text: message } };

    console.log('=== G2.4 private-reply spike ===');
    console.log(`Variant:        ${variant === 'fb' ? 'FB pages_messaging (/page-id/messages)' : 'IG private reply (/ig-user-id/messages)'}`);
    console.log(`Endpoint:       POST ${endpoint}`);
    console.log(`Comment under test: ${comment}`);
    console.log(`Required permissions: ${REQUIREMENTS[variant].join(', ')}`);
    console.log(`Body:           ${redact(JSON.stringify(body))}`);
    console.log(`Mode:           ${send ? 'SEND (owner-approved)' : 'DRY-RUN (no request sent)'}`);
    console.log('');

    if (cfg.appsecretProofEnabled) {
      console.log('appsecret_proof: will be attached (HMAC of token with app secret).');
    }
    const granted = credential.grantedScopes as string[];
    const missing = REQUIREMENTS[variant].filter((scope) => !granted.includes(scope));
    if (missing.length > 0) {
      console.log(`WARNING: credential is missing scopes: ${missing.join(', ')}`);
      console.log('         (Instagram scopes are deferred — see report D15/Q3.)');
    }
    console.log('');

    if (!send) {
      console.log('DRY-RUN complete. Re-run with --send ONLY after explicit owner approval');
      console.log('and only against the owner\'s own test post/comment.');
      return;
    }

    const appSecret = openFromString(cfg.appSecretCipher, APP_SECRET_AAD, Buffer.from(key, 'base64'));
    const params = new URLSearchParams();
    params.set('recipient', JSON.stringify(body.recipient));
    params.set('message', JSON.stringify(body.message));
    if (cfg.appsecretProofEnabled) {
      params.set('appsecret_proof', createHmac('sha256', appSecret).update(token).digest('hex'));
    }
    params.set('access_token', token);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    const requestId = res.headers.get('x-fb-request-id') ?? res.headers.get('facebook-api-version') ?? '-';
    console.log(`HTTP status:    ${res.status}`);
    console.log(`x-fb-request-id: ${requestId}`);
    console.log(`Response:       ${redact(text).slice(0, 600)}`);
    process.exitCode = res.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
