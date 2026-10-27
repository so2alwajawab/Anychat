import { describe, expect, it, vi } from 'vitest';
import { RetentionService } from './retention.service.js';
import type { PrismaService } from '../../common/prisma/prisma.module.js';

describe('RetentionService', () => {
  it('calls updateMany to redact comments >180d and deleteMany for deliveries >30d', async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 12 });
    const deleteManyMock = vi.fn().mockResolvedValue({ count: 45 });

    const fakePrisma = {
      commentEvent: { updateMany: updateManyMock },
      webhookDelivery: { deleteMany: deleteManyMock },
    } as unknown as PrismaService;

    const service = new RetentionService(fakePrisma);
    const report = await service.purgeOldData();

    expect(report.redactedComments).toBe(12);
    expect(report.deletedDeliveries).toBe(45);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(deleteManyMock).toHaveBeenCalledTimes(1);

    const updateCall = updateManyMock.mock.calls[0]?.[0];
    expect(updateCall?.data).toEqual({
      text: '',
      authorUsername: null,
      authorScopedId: 'REDACTED',
    });
  });
});
