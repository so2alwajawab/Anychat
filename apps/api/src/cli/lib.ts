import { config as loadDotEnv } from 'dotenv';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
loadDotEnv({ path: join(apiRoot, '.env') });

export const ARGON_OPTIONS: NonNullable<Parameters<typeof argon2.hash>[1]> = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

export function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (checked apps/api/.env and environment)');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function formatRecoveryCode(randomHex: string): string {
  return randomHex
    .slice(0, 32)
    .toUpperCase()
    .match(/.{4}/g)!
    .join('-');
}

export function generateRecoveryCode(): { code: string; codeHash: string } {
  const code = formatRecoveryCode(randomBytes(16).toString('hex'));
  return { code, codeHash: sha256Hex(normalizeRecoveryCode(code)) };
}

export interface CliArgs {
  [key: string]: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (const entry of argv) {
    const match = entry.match(/^--([^=]+)=(.*)$/);
    if (match?.[1] && match[2] !== undefined) {
      args[match[1]] = match[2];
    } else if (entry.startsWith('--')) {
      args[entry.slice(2)] = '';
    }
  }
  return args;
}

export function fail(message: string): never {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  process.exit(1);
}

export function announceRecoveryCode(code: string): void {
  console.log('');
  console.log('='.repeat(64));
  console.log('  رمز الاسترجاع (يُعرض مرة واحدة فقط — احفظه في مكان آمن):');
  console.log('');
  console.log(`      ${code}`);
  console.log('');
  console.log('  لا تشاركه مع أي شخص. يمكن استخدامه في صفحة تسجيل الدخول');
  console.log('  عبر "استرجاع الحساب"، أو تجديده لاحقاً: pnpm admin:new-recovery');
  console.log('='.repeat(64));
  console.log('');
}
