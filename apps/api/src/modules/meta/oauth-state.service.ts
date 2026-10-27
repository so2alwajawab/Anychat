import { Injectable } from '@nestjs/common';
import { randomToken } from '@anychat/shared';
import { RedisService } from '../../common/redis/redis.module.js';
import { OAUTH_STATE_TTL_SECONDS } from './meta.constants.js';

export interface OauthStateRecord {
  ownerSessionId: string;
  ownerId: string;
  verifier: string;
}

@Injectable()
export class OauthStateService {
  constructor(private readonly redis: RedisService) {}

  private key(state: string): string {
    return `oauth:state:${state}`;
  }

  async create(ownerSessionId: string, ownerId: string): Promise<{ state: string; verifier: string }> {
    const state = randomToken(32);
    const verifier = randomToken(32);
    await this.redis.client.set(
      this.key(state),
      JSON.stringify({ ownerSessionId, ownerId, verifier } satisfies OauthStateRecord),
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );
    return { state, verifier };
  }

  /** One-time read+delete: the state record never survives a callback. */
  async consume(state: string): Promise<OauthStateRecord | null> {
    const results = await this.redis.client.multi().get(this.key(state)).del(this.key(state)).exec();
    const value = results?.[0]?.[1];
    if (typeof value !== 'string') return null;
    try {
      return JSON.parse(value) as OauthStateRecord;
    } catch {
      return null;
    }
  }
}
