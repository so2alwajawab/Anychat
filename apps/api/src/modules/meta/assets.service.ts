import { randomUUID } from 'node:crypto';
import { HttpException, Injectable } from '@nestjs/common';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { sealToParts } from '../../common/crypto/secret-box.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import type { Request } from 'express';
import { EncryptionKeyService } from './encryption-key.service.js';
import { GraphApiError, GraphClient, type GraphInstagramAccount, type GraphPage } from './graph.client.js';
import { OAUTH_SCOPES } from './meta.constants.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionKeyService,
    private readonly graph: GraphClient,
    private readonly audit: AuditService,
  ) {}

  private notFound(): never {
    throw new HttpException(apiError(404, ERROR_CODES.NOT_FOUND), 404);
  }

  private requireKey(): Buffer {
    if (!this.encryption.isConfigured) {
      throw new HttpException(apiError(500, ERROR_CODES.ENCRYPTION_KEY_MISSING), 500);
    }
    return this.encryption.key;
  }

  private credentialAad(credentialId: string, assetId: string): string {
    return `${credentialId}:${assetId}`;
  }

  private async storeCredential(assetId: string, token: string): Promise<void> {
    const key = this.requireKey();
    const existing = await this.prisma.metaCredential.findUnique({ where: { assetId } });
    if (existing) {
      const sealed = sealToParts(token, this.credentialAad(existing.id, assetId), key);
      await this.prisma.metaCredential.update({
        where: { id: existing.id },
        data: {
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          keyVersion: sealed.keyVersion,
          grantedScopes: OAUTH_SCOPES,
          status: 'active',
          lastValidatedAt: new Date(),
        },
      });
      return;
    }
    const id = randomUUID();
    const sealed = sealToParts(token, this.credentialAad(id, assetId), key);
    await this.prisma.metaCredential.create({
      data: {
        id,
        assetId,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        keyVersion: sealed.keyVersion,
        grantedScopes: OAUTH_SCOPES,
        status: 'active',
        lastValidatedAt: new Date(),
      },
    });
  }

  async decryptToken(assetId: string): Promise<string> {
    const credential = await this.prisma.metaCredential.findUnique({ where: { assetId } });
    if (!credential) this.notFound();
    this.requireKey();
    return this.encryption.openParts(
      {
        ciphertext: credential.ciphertext,
        nonce: credential.nonce,
        keyVersion: credential.keyVersion,
      },
      this.credentialAad(credential.id, assetId),
    );
  }

  private toDto(asset: {
    id: string;
    platform: string;
    externalId: string;
    displayName: string;
    linkedPageId: string | null;
    permissionsGrant: unknown;
    connectionStatus: string;
    selected: boolean;
    connectedAt: Date;
    lastHealthCheckAt: Date | null;
    credential: {
      status: string;
      expiresAt: Date | null;
      lastValidatedAt: Date | null;
      grantedScopes: unknown;
    } | null;
  }) {
    return {
      id: asset.id,
      platform: asset.platform,
      externalId: asset.externalId,
      displayName: asset.displayName,
      linkedPageId: asset.linkedPageId,
      permissionsGranted: asset.permissionsGrant,
      connectionStatus: asset.connectionStatus,
      selected: asset.selected,
      connectedAt: asset.connectedAt,
      lastHealthCheckAt: asset.lastHealthCheckAt,
      credential: asset.credential
        ? {
            status: asset.credential.status,
            expiresAt: asset.credential.expiresAt,
            lastValidatedAt: asset.credential.lastValidatedAt,
            grantedScopes: asset.credential.grantedScopes,
          }
        : null,
    };
  }

  async upsertDiscovered(
    organizationId: string,
    pages: GraphPage[],
    igByPage: Map<string, GraphInstagramAccount | null>,
  ): Promise<{ facebook: number; instagram: number }> {
    let facebook = 0;
    let instagram = 0;
    for (const page of pages) {
      if (!page.id || !page.accessToken) continue;
      const asset = await this.prisma.metaConnectedAsset.upsert({
        where: { externalId: page.id },
        update: {
          displayName: page.name,
          permissionsGrant: page.tasks,
          connectionStatus: 'connected',
        },
        create: {
          organizationId,
          platform: 'facebook',
          externalId: page.id,
          displayName: page.name,
          permissionsGrant: page.tasks,
          connectionStatus: 'connected',
        },
      });
      await this.storeCredential(asset.id, page.accessToken);
      facebook += 1;

      const ig = igByPage.get(page.id);
      if (!ig?.igUserId) continue;
      const igAsset = await this.prisma.metaConnectedAsset.upsert({
        where: { externalId: ig.igUserId },
        update: {
          displayName: ig.username ? `@${ig.username}` : ig.igUserId,
          linkedPageId: page.id,
          connectionStatus: 'connected',
        },
        create: {
          organizationId,
          platform: 'instagram',
          externalId: ig.igUserId,
          displayName: ig.username ? `@${ig.username}` : ig.igUserId,
          linkedPageId: page.id,
          connectionStatus: 'connected',
        },
      });
      await this.storeCredential(igAsset.id, page.accessToken);
      instagram += 1;
    }
    return { facebook, instagram };
  }

  async getByExternalId(externalId: string) {
    return this.prisma.metaConnectedAsset.findUnique({
      where: { externalId },
      include: { credential: true },
    });
  }

  async list() {
    const items = await this.prisma.metaConnectedAsset.findMany({
      include: { credential: true },
      orderBy: { connectedAt: 'asc' },
    });
    return { items: items.map((asset) => this.toDto(asset)) };
  }

  private async loadOr404(id: string) {
    if (!UUID_PATTERN.test(id)) this.notFound();
    const asset = await this.prisma.metaConnectedAsset.findUnique({
      where: { id },
      include: { credential: true },
    });
    if (!asset) this.notFound();
    return asset;
  }

  async select(id: string, selected: boolean, req: Request) {
    const asset = await this.loadOr404(id);
    const updated = await this.prisma.metaConnectedAsset.update({
      where: { id: asset.id },
      data: { selected },
      include: { credential: true },
    });
    await this.audit.record(
      {
        action: selected ? AUDIT_ACTIONS.META_ASSET_SELECTED : AUDIT_ACTIONS.META_ASSET_UNSELECTED,
        actorId: req.session?.ownerId,
        entity: 'meta_asset',
        entityId: asset.id,
        meta: { externalId: asset.externalId, platform: asset.platform },
      },
      req,
    );
    return this.toDto(updated);
  }

  async remove(id: string, req: Request) {
    const asset = await this.loadOr404(id);
    await this.prisma.$transaction([
      this.prisma.webhookSubscription.deleteMany({ where: { assetId: asset.id } }),
      this.prisma.metaCredential.deleteMany({ where: { assetId: asset.id } }),
      this.prisma.metaConnectedAsset.delete({ where: { id: asset.id } }),
    ]);
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.META_ASSET_DELETED,
        actorId: req.session?.ownerId,
        entity: 'meta_asset',
        entityId: asset.id,
        meta: { externalId: asset.externalId, platform: asset.platform },
      },
      req,
    );
    return { deleted: true };
  }

  async markReauthRequired(assetId: string): Promise<void> {
    await this.prisma.metaConnectedAsset.updateMany({
      where: { id: assetId },
      data: { connectionStatus: 'reauth_required' },
    });
    await this.prisma.metaCredential.updateMany({
      where: { assetId },
      data: { status: 'reauth_required' },
    });
  }

  async health(id: string, req: Request): Promise<{ ok: boolean; code?: number; checkedAt: Date }> {
    const asset = await this.loadOr404(id);
    if (!asset.credential) this.notFound();
    const token = await this.decryptToken(asset.id);
    const now = new Date();
    try {
      await this.graph.checkAsset(asset.externalId, token);
      await this.prisma.metaConnectedAsset.update({
        where: { id: asset.id },
        data: { lastHealthCheckAt: now, connectionStatus: 'connected' },
      });
      await this.prisma.metaCredential.updateMany({
        where: { assetId: asset.id },
        data: { status: 'active', lastValidatedAt: now },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.META_ASSET_HEALTH,
          actorId: req.session?.ownerId,
          entity: 'meta_asset',
          entityId: asset.id,
          meta: { ok: true },
        },
        req,
      );
      return { ok: true, checkedAt: now };
    } catch (err) {
      const code = err instanceof GraphApiError ? err.code : 0;
      if (code === 190) {
        await this.markReauthRequired(asset.id);
      }
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.META_ASSET_HEALTH,
          actorId: req.session?.ownerId,
          entity: 'meta_asset',
          entityId: asset.id,
          outcome: 'failure',
          meta: { ok: false, code },
        },
        req,
      );
      return { ok: false, code, checkedAt: now };
    }
  }
}
