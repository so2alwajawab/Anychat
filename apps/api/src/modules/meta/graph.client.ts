import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MetaConfigService } from './meta-config.service.js';

export class GraphApiError extends Error {
  constructor(
    readonly code: number,
    readonly subcode: number | null,
    message: string,
    readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = 'GraphApiError';
  }
}

export interface GraphPage {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
}

export interface GraphInstagramAccount {
  igUserId: string;
  username: string | null;
}

export interface GraphPost {
  id: string;
  message?: string;
  createdTime: string;
  permalink?: string;
}

export interface GraphComment {
  id: string;
  text: string;
  createdTime: string;
  authorId: string;
  authorUsername?: string;
  parentId?: string;
}

export interface GraphActionButton {
  type?: string;
  title: string;
  url?: string;
  payload?: string;
}

export abstract class GraphClient {
  abstract exchangeShortLived(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{ accessToken: string }>;

  abstract exchangeLongLived(shortLivedToken: string): Promise<{ accessToken: string }>;

  abstract listPages(userToken: string): Promise<GraphPage[]>;

  abstract getPageInstagram(
    pageId: string,
    pageToken: string,
  ): Promise<GraphInstagramAccount | null>;

  abstract subscribePage(
    pageId: string,
    pageToken: string,
    fields: string[],
  ): Promise<{ success: boolean }>;

  abstract checkAsset(externalId: string, accessToken: string): Promise<{ id: string; name?: string }>;

  abstract listPagePosts(
    pageId: string,
    pageToken: string,
    limit?: number,
  ): Promise<GraphPost[]>;

  abstract listPagePostComments(
    postId: string,
    pageToken: string,
    limit?: number,
  ): Promise<GraphComment[]>;

  abstract listInstagramMedia(
    igUserId: string,
    pageToken: string,
    limit?: number,
  ): Promise<GraphPost[]>;

  abstract listInstagramMediaComments(
    mediaId: string,
    pageToken: string,
    limit?: number,
  ): Promise<GraphComment[]>;

  abstract publishPageCommentReply(
    commentId: string,
    pageToken: string,
    message: string,
    attachmentUrl?: string,
  ): Promise<{ id: string }>;

  abstract publishInstagramCommentReply(
    commentId: string,
    pageToken: string,
    message: string,
  ): Promise<{ id: string }>;

  abstract sendPagePrivateReply(
    pageId: string,
    pageToken: string,
    commentId: string,
    message: string,
    attachmentUrl?: string,
    buttons?: GraphActionButton[],
  ): Promise<{ id: string }>;

  abstract sendInstagramPrivateReply(
    pageIdOrIgId: string,
    pageToken: string,
    commentId: string,
    message: string,
    attachmentUrl?: string,
    buttons?: GraphActionButton[],
  ): Promise<{ id: string }>;

  abstract checkCommentReplyExists(
    platform: 'facebook' | 'instagram',
    commentId: string,
    pageToken: string,
    replyId: string,
  ): Promise<boolean>;
}

type GraphParams = Record<string, string | undefined>;

function graphString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

@Injectable()
export class HttpGraphClient extends GraphClient {
  constructor(private readonly config: MetaConfigService) {
    super();
  }

  private async base(): Promise<string> {
    return `https://graph.facebook.com/${await this.config.graphVersion()}`;
  }

  private async proof(token: string, cfg: { appSecret: string; appsecretProofEnabled: boolean }): Promise<GraphParams> {
    if (!cfg.appsecretProofEnabled) return {};
    return {
      appsecret_proof: createHmac('sha256', cfg.appSecret).update(token).digest('hex'),
    };
  }

  private async get(path: string, params: GraphParams): Promise<Record<string, unknown>> {
    const url = new URL(`${await this.base()}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new GraphApiError(0, null, 'graph network error');
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const error = body?.error as
      | { code?: number; subcode?: number; message?: string; fbtrace_id?: string }
      | undefined;
    if (!res.ok || error) {
      throw new GraphApiError(
        error?.code ?? res.status,
        error?.subcode ?? null,
        error?.message ?? `graph http ${res.status}`,
        error?.fbtrace_id,
      );
    }
    return body ?? {};
  }

  private async post(path: string, params: GraphParams): Promise<Record<string, unknown>> {
    const url = new URL(`${await this.base()}${path}`);
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) form.set(key, value);
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GraphApiError(0, null, 'graph network error');
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const error = body?.error as
      | { code?: number; subcode?: number; message?: string; fbtrace_id?: string }
      | undefined;
    if (!res.ok || error) {
      throw new GraphApiError(
        error?.code ?? res.status,
        error?.subcode ?? null,
        error?.message ?? `graph http ${res.status}`,
        error?.fbtrace_id,
      );
    }
    return body ?? {};
  }

  async exchangeShortLived(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{ accessToken: string }> {
    const cfg = await this.config.requireConfig();
    const body = await this.get('/oauth/access_token', {
      client_id: cfg.appId,
      redirect_uri: input.redirectUri,
      client_secret: cfg.appSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
    });
    const token = body.access_token;
    if (typeof token !== 'string' || !token) {
      throw new GraphApiError(0, null, 'missing access_token in exchange response');
    }
    return { accessToken: token };
  }

  async exchangeLongLived(shortLivedToken: string): Promise<{ accessToken: string }> {
    const cfg = await this.config.requireConfig();
    const body = await this.get('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: shortLivedToken,
    });
    const token = body.access_token;
    if (typeof token !== 'string' || !token) {
      throw new GraphApiError(0, null, 'missing access_token in long-lived exchange');
    }
    return { accessToken: token };
  }

  async listPages(userToken: string): Promise<GraphPage[]> {
    const cfg = await this.config.requireConfig();
    const body = await this.get('/me/accounts', {
      fields: 'id,name,access_token,tasks',
      access_token: userToken,
      ...(await this.proof(userToken, cfg)),
    });
    const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
    return data.map((page) => ({
      id: graphString(page.id),
      name: graphString(page.name, graphString(page.id)),
      accessToken: graphString(page.access_token),
      tasks: Array.isArray(page.tasks) ? page.tasks.map((t) => graphString(t)) : [],
    }));
  }

  async getPageInstagram(pageId: string, pageToken: string): Promise<GraphInstagramAccount | null> {
    const cfg = await this.config.requireConfig();
    try {
      const body = await this.get(`/${pageId}`, {
        fields: 'instagram_business_account{id,username}',
        access_token: pageToken,
        ...(await this.proof(pageToken, cfg)),
      });
      const ig = body.instagram_business_account as { id?: string; username?: string } | undefined;
      if (!ig?.id) return null;
      return { igUserId: String(ig.id), username: ig.username ? String(ig.username) : null };
    } catch (err) {
      if (err instanceof GraphApiError && (err.code === 100 || err.code === 10 || err.code === 33)) {
        return null;
      }
      throw err;
    }
  }

  async subscribePage(pageId: string, pageToken: string, fields: string[]): Promise<{ success: boolean }> {
    const cfg = await this.config.requireConfig();
    await this.post(`/${pageId}/subscribed_apps`, {
      subscribed_fields: fields.join(','),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    return { success: true };
  }

  async checkAsset(externalId: string, accessToken: string): Promise<{ id: string; name?: string }> {
    const cfg = await this.config.requireConfig();
    const body = await this.get(`/${externalId}`, {
      fields: 'id,name',
      access_token: accessToken,
      ...(await this.proof(accessToken, cfg)),
    });
    return { id: graphString(body.id, externalId), name: body.name ? graphString(body.name) : undefined };
  }

  async listPagePosts(pageId: string, pageToken: string, limit = 25): Promise<GraphPost[]> {
    const cfg = await this.config.requireConfig();
    const body = await this.get(`/${pageId}/feed`, {
      fields: 'id,message,created_time,permalink_url',
      limit: String(limit),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
    return data.map((item) => ({
      id: graphString(item.id),
      message: item.message ? graphString(item.message) : undefined,
      createdTime: graphString(item.created_time, new Date().toISOString()),
      permalink: item.permalink_url ? graphString(item.permalink_url) : undefined,
    }));
  }

  async listPagePostComments(postId: string, pageToken: string, limit = 50): Promise<GraphComment[]> {
    const cfg = await this.config.requireConfig();
    const body = await this.get(`/${postId}/comments`, {
      fields: 'id,message,created_time,from,parent',
      limit: String(limit),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
    return data.map((item) => {
      const from = item.from as { id?: string; name?: string } | undefined;
      const parent = item.parent as { id?: string } | undefined;
      return {
        id: graphString(item.id),
        text: graphString(item.message),
        createdTime: graphString(item.created_time, new Date().toISOString()),
        authorId: from?.id ? graphString(from.id) : 'unknown',
        authorUsername: from?.name ? graphString(from.name) : undefined,
        parentId: parent?.id ? graphString(parent.id) : undefined,
      };
    });
  }

  async listInstagramMedia(igUserId: string, pageToken: string, limit = 25): Promise<GraphPost[]> {
    const cfg = await this.config.requireConfig();
    const body = await this.get(`/${igUserId}/media`, {
      fields: 'id,caption,timestamp,permalink',
      limit: String(limit),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
    return data.map((item) => ({
      id: graphString(item.id),
      message: item.caption ? graphString(item.caption) : undefined,
      createdTime: graphString(item.timestamp, new Date().toISOString()),
      permalink: item.permalink ? graphString(item.permalink) : undefined,
    }));
  }

  async listInstagramMediaComments(mediaId: string, pageToken: string, limit = 50): Promise<GraphComment[]> {
    const cfg = await this.config.requireConfig();
    const body = await this.get(`/${mediaId}/comments`, {
      fields: 'id,text,timestamp,from,username',
      limit: String(limit),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
    return data.map((item) => {
      const from = item.from as { id?: string; username?: string } | undefined;
      return {
        id: graphString(item.id),
        text: graphString(item.text),
        createdTime: graphString(item.timestamp, new Date().toISOString()),
        authorId: from?.id ? graphString(from.id) : 'unknown',
        authorUsername: item.username ? graphString(item.username) : from?.username ? graphString(from.username) : undefined,
      };
    });
  }

  async publishPageCommentReply(
    commentId: string,
    pageToken: string,
    message: string,
    attachmentUrl?: string,
  ): Promise<{ id: string }> {
    const cfg = await this.config.requireConfig();
    const body = await this.post(`/${commentId}/comments`, {
      message,
      ...(attachmentUrl ? { attachment_url: attachmentUrl } : {}),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    return { id: graphString(body.id) };
  }

  async publishInstagramCommentReply(
    commentId: string,
    pageToken: string,
    message: string,
  ): Promise<{ id: string }> {
    const cfg = await this.config.requireConfig();
    const body = await this.post(`/${commentId}/replies`, {
      message,
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    return { id: graphString(body.id) };
  }

  async sendPagePrivateReply(
    pageId: string,
    pageToken: string,
    commentId: string,
    message: string,
    attachmentUrl?: string,
    buttons?: GraphActionButton[],
  ): Promise<{ id: string }> {
    const cfg = await this.config.requireConfig();
    let messagePayload: Record<string, unknown>;

    if (buttons && buttons.length > 0) {
      // Messenger Button Template: max 3 buttons supported
      const formattedButtons = buttons.slice(0, 3).map((btn) => {
        if (btn.type === 'phone' || btn.type === 'phone_number') {
          return {
            type: 'phone_number',
            title: btn.title,
            payload: btn.payload || btn.url || '',
          };
        }
        return {
          type: 'web_url',
          title: btn.title,
          url: btn.url || '',
        };
      });

      messagePayload = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: message,
            buttons: formattedButtons,
          },
        },
      };
    } else if (attachmentUrl) {
      messagePayload = {
        text: message,
        attachment: {
          type: 'image',
          payload: { url: attachmentUrl, is_reusable: true },
        },
      };
    } else {
      messagePayload = { text: message };
    }

    const body = await this.post(`/${pageId}/messages`, {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify(messagePayload),
      messaging_type: 'RESPONSE',
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    return { id: graphString(body.message_id ?? body.id) };
  }

  async sendInstagramPrivateReply(
    pageIdOrIgId: string,
    pageToken: string,
    commentId: string,
    message: string,
    attachmentUrl?: string,
    buttons?: GraphActionButton[],
  ): Promise<{ id: string }> {
    const cfg = await this.config.requireConfig();
    let messagePayload: Record<string, unknown>;

    if (buttons && buttons.length > 0) {
      // Instagram Graph API Button Template support (up to 3 buttons)
      const formattedButtons = buttons.slice(0, 3).map((btn) => ({
        type: 'web_url',
        title: btn.title,
        url: btn.url || '',
      }));

      messagePayload = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: message,
            buttons: formattedButtons,
          },
        },
      };
    } else if (attachmentUrl) {
      messagePayload = {
        text: message,
        attachment: {
          type: 'image',
          payload: { url: attachmentUrl, is_reusable: true },
        },
      };
    } else {
      messagePayload = { text: message };
    }

    const body = await this.post(`/${pageIdOrIgId}/messages`, {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify(messagePayload),
      access_token: pageToken,
      ...(await this.proof(pageToken, cfg)),
    });
    return { id: graphString(body.message_id ?? body.id) };
  }

  async checkCommentReplyExists(
    platform: 'facebook' | 'instagram',
    commentId: string,
    pageToken: string,
    replyId: string,
  ): Promise<boolean> {
    const cfg = await this.config.requireConfig();
    try {
      const endpoint = platform === 'instagram' ? `/${commentId}/replies` : `/${commentId}/comments`;
      const body = await this.get(endpoint, {
        fields: 'id',
        limit: '50',
        access_token: pageToken,
        ...(await this.proof(pageToken, cfg)),
      });
      const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
      return data.some((item) => graphString(item.id) === replyId);
    } catch {
      return false;
    }
  }
}
