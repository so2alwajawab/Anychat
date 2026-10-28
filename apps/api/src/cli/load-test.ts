import { createHmac, randomBytes } from 'node:crypto';
import { parseArgs, fail, createClient } from './lib.js';
import { openFromString } from '../common/crypto/secret-box.js';
import { APP_SECRET_AAD } from '../modules/meta/meta.constants.js';

function calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number; avg: number } {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = Math.round(sum / sorted.length);
  return { p50, p95, p99, avg };
}

/**
 * Gate G7: Synthetic Webhook Burst & Load Test
 * Sends a burst of signed webhook deliveries and records latency and throughput numbers.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const count = parseInt(args['count'] || '500', 10);
  const concurrency = parseInt(args['concurrency'] || '20', 10);
  const targetUrl = args['url'] || 'http://127.0.0.1:4000/api/v1/webhooks/meta';

  console.log('==========================================================');
  console.log('  AnyChat Webhook Burst & Load Test (Gate G7)             ');
  console.log('==========================================================');
  console.log(`Target URL:        ${targetUrl}`);
  console.log(`Total deliveries:  ${count}`);
  console.log(`Concurrency level: ${concurrency}`);

  // Resolve App Secret for HMAC signing
  let appSecret = process.env.META_APP_SECRET || '';
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!appSecret && key) {
    const prisma = createClient();
    try {
      const cfg = await prisma.metaAppConfig.findFirst();
      if (cfg?.appSecretCipher) {
        appSecret = openFromString(cfg.appSecretCipher, APP_SECRET_AAD, Buffer.from(key, 'base64'));
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  if (!appSecret) {
    appSecret = 'test_meta_app_secret_placeholder_for_load_test';
  }

  console.log('\n[1/3] Generating synthetic webhook payload burst...');
  const latencies: number[] = [];
  let succeeded = 0;
  let failed = 0;

  const startTime = Date.now();
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < count) {
      const idx = currentIndex++;
      const commentId = `load_comment_${Date.now()}_${idx}_${randomBytes(4).toString('hex')}`;
      const payload = JSON.stringify({
        object: 'page',
        entry: [
          {
            id: 'page-100',
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: commentId,
                  post_id: 'post-500',
                  message: `استفسار رقم ${idx}: ما هي التفاصيل والأسعار؟`,
                  from: { id: `user_${idx}`, name: `مستخدم تجريبي ${idx}` },
                  created_time: Math.floor(Date.now() / 1000),
                },
              },
            ],
          },
        ],
      });

      const signature = 'sha256=' + createHmac('sha256', appSecret).update(payload).digest('hex');

      const reqStart = Date.now();
      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-hub-signature-256': signature,
          },
          body: payload,
          signal: AbortSignal.timeout(5000),
        });

        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);

        if (res.ok) {
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);
        failed++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const durationMs = Date.now() - startTime;
  const { p50, p95, p99, avg } = calculatePercentiles(latencies);
  const rps = Math.round((count / (durationMs / 1000)) * 10) / 10;

  console.log('[2/3] Burst execution completed.');
  console.log('\n[3/3] Recorded Load Test Numbers:');
  console.log('----------------------------------------------------------');
  console.log(`Total Requests:    ${count}`);
  console.log(`Successful (200):  ${succeeded} (${Math.round((succeeded / count) * 100)}%)`);
  console.log(`Failed / Dropped:  ${failed}`);
  console.log(`Total Duration:    ${(durationMs / 1000).toFixed(2)} seconds`);
  console.log(`Throughput:        ${rps} req/sec`);
  console.log(`Average Latency:   ${avg} ms`);
  console.log(`p50 Latency:       ${p50} ms`);
  console.log(`p95 Latency:       ${p95} ms (Gate criteria: < 500 ms)`);
  console.log(`p99 Latency:       ${p99} ms`);
  console.log('----------------------------------------------------------');

  const p95Pass = p95 < 500;
  console.log(`\np95 Store & Ack Latency Target (<500ms): ${p95Pass ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log('Gate G7 Load Test: COMPLETED AND RECORDED');
}

main().catch((err) => fail(`Load test failed: ${(err as Error).message}`));
