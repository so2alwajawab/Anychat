import {
  announceRecoveryCode,
  createClient,
  fail,
  generateRecoveryCode,
  parseArgs,
} from './lib.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const username = args['username']?.trim();

  const prisma = createClient();
  try {
    let account;
    if (username) {
      account = await prisma.ownerAccount.findUnique({ where: { username } });
      if (!account) fail(`No owner account named "${username}".`);
    } else {
      const accounts = await prisma.ownerAccount.findMany();
      if (accounts.length === 0) fail('No owner account. Run pnpm admin:bootstrap first.');
      if (accounts.length > 1) fail('Multiple owners found; pass --username=<name>.');
      account = accounts[0]!;
    }

    const { code, codeHash } = generateRecoveryCode();
    await prisma.$transaction([
      prisma.passwordRecovery.updateMany({
        where: { ownerId: account.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordRecovery.create({ data: { ownerId: account.id, codeHash } }),
      prisma.auditLog.create({
        data: {
          action: 'auth.recovery.code_rotated',
          actorType: 'cli',
          entity: 'owner_account',
          entityId: account.id,
        },
      }),
    ]);

    announceRecoveryCode(code);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
