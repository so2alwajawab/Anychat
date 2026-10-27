import argon2 from 'argon2';
import { validatePassword } from '@anychat/shared';
import { ARGON_OPTIONS, createClient, fail, parseArgs } from './lib.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const username = args['username']?.trim();
  const password = args['password'];

  if (!username || !password) {
    fail('Usage: pnpm admin:reset-password -- --username=<name> --password=<new-password>');
  }

  const policy = validatePassword(password, username);
  if (!policy.ok) {
    fail(`Password rejected (${policy.reason}). Minimum length is 12 characters.`);
  }

  const prisma = createClient();
  try {
    const account = await prisma.ownerAccount.findUnique({ where: { username } });
    if (!account) fail(`No owner account named "${username}".`);

    const passwordHash = await argon2.hash(password, ARGON_OPTIONS);
    await prisma.$transaction([
      prisma.ownerAccount.update({
        where: { id: account.id },
        data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.ownerSession.updateMany({
        where: { ownerId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.passwordRecovery.updateMany({
        where: { ownerId: account.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          action: 'owner.password_reset',
          actorType: 'cli',
          entity: 'owner_account',
          entityId: account.id,
          meta: { sessionsRevoked: true, recoveryInvalidated: true },
        },
      }),
    ]);

    console.log(`Password updated for "${username}". All sessions were revoked and recovery codes invalidated.`);
    console.log('Generate a fresh recovery code with: pnpm admin:new-recovery');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
