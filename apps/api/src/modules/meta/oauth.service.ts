import { createHash } from 'node:crypto';
import { HttpException, Injectable, Logger as NestLogger } from '@nestjs/common';
import { API_ROUTES, ERROR_CODES, apiError, timingSafeEqualString } from '@anychat/shared';
import { serverEnv } from '../../common/config/env.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AssetsService } from './assets.service.js';
import { GraphApiError, GraphClient } from './graph.client.js';
import { MetaConfigService } from './meta-config.service.js';
import { IG_WEBHOOK_FIELDS, OAUTH_SCOPES, PAGE_WEBHOOK_FIELDS } from './meta.constants.js';
import { OauthStateService } from './oauth-state.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Strip token-like values from Graph error messages before logging/audit. */
function redactTokens(message: string): string {
  return message.replace(/EAA[A-Za-z0-9._-]+/g, '[REDACTED]').slice(0, 300);
}

@Injectable()
export class OauthService {
  private readonly logger = new NestLogger(OauthService.name);

  constructor(
    private readonly states: OauthStateService,
    private readonly config: MetaConfigService,
    private readonly graph: GraphClient,
    private readonly assets: AssetsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
  ) {}

  private webBase(): string {
    return serverEnv.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }

  async start(ownerSessionId: string, ownerId: string): Promise<{ state: string; authorizeUrl: string }> {
    const cfg = await this.config.requireConfig();
    const { state, verifier } = await this.states.create(ownerSessionId, ownerId);
    const url = new URL(`https://www.facebook.com/${cfg.graphApiVersion}/dialog/oauth`);
    url.searchParams.set('client_id', cfg.appId);
    url.searchParams.set('redirect_uri', this.config.redirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', OAUTH_SCOPES.join(','));
    url.searchParams.set('code_challenge', pkceChallenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    await this.audit.record({
      action: AUDIT_ACTIONS.META_OAUTH_STARTED,
      actorId: ownerId,
      entity: 'meta_oauth',
      meta: { scopes: OAUTH_SCOPES },
    });
    return { state, authorizeUrl: url.toString() };
  }

  async handleCallback(input: {
    code?: string;
    state?: string;
    oauthCookie?: string;
  }): Promise<{ redirectUrl: string }> {
    const { state, code, oauthCookie } = input;
    if (!state || !oauthCookie || !timingSafeEqualString(state, oauthCookie)) {
      throw new HttpException(apiError(400, ERROR_CODES.OAUTH_STATE_INVALID), 400);
    }
    const record = await this.states.consume(state);
    if (!record) {
      throw new HttpException(apiError(400, ERROR_CODES.OAUTH_STATE_INVALID), 400);
    }

    const failRedirect = (codePart: string): { redirectUrl: string } => ({
      redirectUrl: `${this.webBase()}/connections?oauth=error&code=${encodeURIComponent(codePart)}`,
    });

    if (!code) {
      await this.audit.record({
        action: AUDIT_ACTIONS.META_OAUTH_FAILED,
        actorId: record.ownerId,
        entity: 'meta_oauth',
        outcome: 'failure',
        meta: { reason: 'missing_code' },
      });
      return failRedirect('missing_code');
    }

    let step = 'exchange_short';
    try {
      const shortLived = await this.graph.exchangeShortLived({
        code,
        redirectUri: this.config.redirectUri(),
        codeVerifier: record.verifier,
      });
      step = 'exchange_long';
      const longLived = await this.graph.exchangeLongLived(shortLived.accessToken);
      step = 'list_pages';
      const pages = await this.graph.listPages(longLived.accessToken);

      step = 'discover';
      const igByPage = new Map<string, Awaited<ReturnType<GraphClient['getPageInstagram']>>>();
      for (const page of pages) {
        igByPage.set(page.id, await this.graph.getPageInstagram(page.id, page.accessToken));
      }

      step = 'store_assets';
      const counts = await this.assets.upsertDiscovered(pages, igByPage);

      let subscriptionsOk = 0;
      let subscriptionsFailed = 0;
      for (const page of pages) {
        const asset = await this.assets.getByExternalId(page.id);
        if (!asset) continue;
        step = 'subscribe_page';
        try {
          const result = await this.subscriptions.subscribePage(
            asset.id,
            page.id,
            page.accessToken,
            [...PAGE_WEBHOOK_FIELDS],
            record.ownerId,
          );
          if (result.ok) subscriptionsOk += 1;
          else subscriptionsFailed += 1;
        } catch (subErr) {
          this.logger.warn(`subscribePage error: ${subErr instanceof Error ? subErr.message : String(subErr)}`);
          subscriptionsFailed += 1;
        }

        const ig = igByPage.get(page.id);
        if (ig?.igUserId) {
          const igAsset = await this.assets.getByExternalId(ig.igUserId);
          if (igAsset) {
            step = 'subscribe_instagram';
            try {
              await this.subscriptions.recordInstagramDashboard(
                igAsset.id,
                [...IG_WEBHOOK_FIELDS],
                record.ownerId,
              );
            } catch (igErr) {
              this.logger.warn(`recordInstagramDashboard error: ${igErr instanceof Error ? igErr.message : String(igErr)}`);
            }
          }
        }
      }

      step = 'audit';
      await this.audit.record({
        action: AUDIT_ACTIONS.META_OAUTH_COMPLETED,
        actorId: record.ownerId,
        entity: 'meta_oauth',
        meta: {
          pages: counts.facebook,
          instagramAccounts: counts.instagram,
          subscriptionsOk,
          subscriptionsFailed,
        },
      });
      return { redirectUrl: `${this.webBase()}/connections?oauth=success` };
    } catch (err) {
      const isGraph = err instanceof GraphApiError;
      const graphCode = isGraph ? err.code : null;
      const subcode = isGraph ? err.subcode : null;
      const fbtraceId = isGraph ? err.fbtraceId : undefined;
      const rawMessage = err instanceof Error ? err.message : 'unknown error';
      const message = redactTokens(rawMessage);
      const errorCode = isGraph ? `${step}:${err.code}` : `${step}_failed`;
      this.logger.warn(
        `oauth callback failed at step=${step} code=${graphCode ?? '-'} subcode=${subcode ?? '-'} fbtrace=${fbtraceId ?? '-'} message=${message}`,
      );
      await this.audit.record({
        action: AUDIT_ACTIONS.META_OAUTH_FAILED,
        actorId: record.ownerId,
        entity: 'meta_oauth',
        outcome: 'failure',
        meta: { step, errorCode: graphCode, subcode, fbtraceId, message },
      });
      return failRedirect(errorCode);
    }
  }

  /** Public URL the UI navigates to in order to (re)connect. */
  startUrl(): string {
    return API_ROUTES.metaOauthStart;
  }
}
