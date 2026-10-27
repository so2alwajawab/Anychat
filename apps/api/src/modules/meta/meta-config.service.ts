import { HttpException, Injectable } from '@nestjs/common';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { serverEnv } from '../../common/config/env.js';
import { sealToString } from '../../common/crypto/secret-box.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { EncryptionKeyService } from './encryption-key.service.js';
import { APP_SECRET_AAD, VERIFY_TOKEN_AAD } from './meta.constants.js';
import type { MetaConfigDto } from './dto.js';

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

@Injectable()
export class MetaConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionKeyService,
  ) {}

  private baseUrl(): string {
    return serverEnv.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }

  redirectUri(): string {
    return `${this.baseUrl()}/api/v1/meta/oauth/callback`;
  }

  webhookCallbackUrl(): string {
    return `${this.baseUrl()}/api/v1/webhooks/meta`;
  }

  async ensureSeeded(): Promise<void> {
    const existing = await this.prisma.metaAppConfig.findFirst();
    if (existing) return;
    const appId = emptyToUndefined(serverEnv.META_APP_ID);
    const appSecret = emptyToUndefined(serverEnv.META_APP_SECRET);
    const verifyToken = emptyToUndefined(serverEnv.META_WEBHOOK_VERIFY_TOKEN);
    if (!appId || !appSecret || !this.encryption.isConfigured) return;
    const key = this.encryption.key;
    await this.prisma.metaAppConfig.create({
      data: {
        appId,
        appSecretCipher: sealToString(appSecret, APP_SECRET_AAD, key),
        webhookVerifyTokenCipher: verifyToken
          ? sealToString(verifyToken, VERIFY_TOKEN_AAD, key)
          : '',
        graphApiVersion: serverEnv.META_GRAPH_VERSION,
      },
    });
  }

  async getRow() {
    await this.ensureSeeded();
    return this.prisma.metaAppConfig.findFirst();
  }

  async getPublicConfig() {
    const row = await this.getRow();
    return {
      appId: row?.appId ?? null,
      graphApiVersion: row?.graphApiVersion ?? serverEnv.META_GRAPH_VERSION,
      proofEnabled: row?.appsecretProofEnabled ?? true,
      hasAppSecret: Boolean(row?.appSecretCipher),
      hasVerifyToken: Boolean(row?.webhookVerifyTokenCipher),
      encryptionKeyConfigured: this.encryption.isConfigured,
      redirectUri: this.redirectUri(),
      webhookCallbackUrl: this.webhookCallbackUrl(),
    };
  }

  async graphVersion(): Promise<string> {
    const row = await this.getRow();
    return row?.graphApiVersion ?? serverEnv.META_GRAPH_VERSION;
  }

  requireEncryptionKey(): Buffer {
    if (!this.encryption.isConfigured) {
      throw new HttpException(apiError(500, ERROR_CODES.ENCRYPTION_KEY_MISSING), 500);
    }
    return this.encryption.key;
  }

  async requireConfig(): Promise<{
    appId: string;
    appSecret: string;
    verifyToken: string | null;
    graphApiVersion: string;
    appsecretProofEnabled: boolean;
  }> {
    const row = await this.getRow();
    if (!row || !row.appSecretCipher) {
      throw new HttpException(apiError(503, ERROR_CODES.META_NOT_CONFIGURED), 503);
    }
    this.requireEncryptionKey();
    return {
      appId: row.appId,
      appSecret: this.encryption.openString(row.appSecretCipher, APP_SECRET_AAD),
      verifyToken: row.webhookVerifyTokenCipher
        ? this.encryption.openString(row.webhookVerifyTokenCipher, VERIFY_TOKEN_AAD)
        : null,
      graphApiVersion: row.graphApiVersion,
      appsecretProofEnabled: row.appsecretProofEnabled,
    };
  }

  async update(dto: MetaConfigDto) {
    await this.ensureSeeded();
    const existing = await this.prisma.metaAppConfig.findFirst();
    const touchesSecret = dto.appSecret !== undefined || dto.webhookVerifyToken !== undefined;
    if (touchesSecret) this.requireEncryptionKey();
    const key = this.encryption.isConfigured ? this.encryption.key : null;

    const appId = dto.appId ?? existing?.appId ?? emptyToUndefined(serverEnv.META_APP_ID);
    if (!appId) {
      throw new HttpException(apiError(400, ERROR_CODES.VALIDATION_ERROR), 400);
    }

    let appSecretCipher = existing?.appSecretCipher ?? '';
    if (dto.appSecret !== undefined && key) {
      appSecretCipher = sealToString(dto.appSecret, APP_SECRET_AAD, key);
    } else if (!appSecretCipher && key) {
      const envSecret = emptyToUndefined(serverEnv.META_APP_SECRET);
      if (envSecret) appSecretCipher = sealToString(envSecret, APP_SECRET_AAD, key);
    }

    let webhookVerifyTokenCipher = existing?.webhookVerifyTokenCipher ?? '';
    if (dto.webhookVerifyToken !== undefined && key) {
      webhookVerifyTokenCipher = sealToString(dto.webhookVerifyToken, VERIFY_TOKEN_AAD, key);
    } else if (!webhookVerifyTokenCipher && key) {
      const envToken = emptyToUndefined(serverEnv.META_WEBHOOK_VERIFY_TOKEN);
      if (envToken) webhookVerifyTokenCipher = sealToString(envToken, VERIFY_TOKEN_AAD, key);
    }

    const data = {
      appId,
      appSecretCipher,
      webhookVerifyTokenCipher,
      graphApiVersion: dto.graphApiVersion ?? existing?.graphApiVersion ?? serverEnv.META_GRAPH_VERSION,
      appsecretProofEnabled: dto.appsecretProofEnabled ?? existing?.appsecretProofEnabled ?? true,
      rotatedAt: touchesSecret ? new Date() : (existing?.rotatedAt ?? null),
    };

    if (existing) {
      return this.prisma.metaAppConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.metaAppConfig.create({ data });
  }
}
