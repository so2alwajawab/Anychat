import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { randomToken } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { sha256Hex } from '../../common/crypto/hash.js';
import { clientIp, ipPrefixOf, uaHashOf } from '../../common/http-utils.js';
import { SESSION_ABSOLUTE_SECONDS, SESSION_IDLE_SECONDS } from '../../common/config/env.js';

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, csrfToken: string, req: Request): Promise<CreatedSession> {
    const token = randomToken(32);
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_IDLE_SECONDS * 1000);
    const absoluteExpiresAt = new Date(now + SESSION_ABSOLUTE_SECONDS * 1000);

    await this.prisma.ownerSession.create({
      data: {
        ownerId,
        tokenHash: sha256Hex(token),
        csrfTokenHash: sha256Hex(csrfToken),
        expiresAt,
        absoluteExpiresAt,
        ipPrefix: ipPrefixOf(clientIp(req)),
        userAgentHash: uaHashOf(req),
      },
    });

    return { token, csrfToken, expiresAt, absoluteExpiresAt };
  }

  async revokeByToken(token: string): Promise<number> {
    const result = await this.prisma.ownerSession.updateMany({
      where: { tokenHash: sha256Hex(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllForOwner(ownerId: string): Promise<number> {
    const result = await this.prisma.ownerSession.updateMany({
      where: { ownerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
