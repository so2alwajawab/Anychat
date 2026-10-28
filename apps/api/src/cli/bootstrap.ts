import argon2 from 'argon2';
import { validatePassword } from '@anychat/shared';
import {
  ARGON_OPTIONS,
  announceRecoveryCode,
  createClient,
  fail,
  generateRecoveryCode,
  parseArgs,
} from './lib.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const username = args['username']?.trim();
  const password = args['password'];

  if (!username || !password) {
    fail('Usage: pnpm admin:bootstrap -- --username=<name> --password=<password>');
  }

  const policy = validatePassword(password, username);
  if (!policy.ok) {
    fail(`Password rejected (${policy.reason}). Minimum length is 12 characters.`);
  }

  const prisma = createClient();
  try {
    const existing = await prisma.ownerAccount.count();
    if (existing > 0) {
      fail('Owner account already exists. Use pnpm admin:reset-password instead.');
    }

    const passwordHash = await argon2.hash(password, ARGON_OPTIONS);
    const { code, codeHash } = generateRecoveryCode();

    // Every account must belong to an organization or the auth guard rejects it
    // (403). Bootstrap gives the CLI-created owner a personal workspace.
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.ownerAccount.create({
        data: { username, passwordHash },
      });
      const organization = await tx.organization.create({
        data: { name: `${username}'s Workspace` },
      });
      await tx.membership.create({
        data: { userId: created.id, organizationId: organization.id, role: 'owner' },
      });
      return created;
    });
    await prisma.$transaction([
      prisma.passwordRecovery.create({
        data: { ownerId: account.id, codeHash },
      }),
      prisma.auditLog.create({
        data: {
          action: 'owner.bootstrapped',
          actorType: 'cli',
          entity: 'owner_account',
          entityId: account.id,
          outcome: 'success',
        },
      }),
    ]);

    console.log(`Owner "${username}" created with argon2id password hash.`);
    announceRecoveryCode(code);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
