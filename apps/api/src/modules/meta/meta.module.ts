import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service.js';
import { EncryptionKeyService } from './encryption-key.service.js';
import { GraphClient, HttpGraphClient } from './graph.client.js';
import { MetaConfigService } from './meta-config.service.js';
import { MetaController } from './meta.controller.js';
import { OauthService } from './oauth.service.js';
import { OauthStateService } from './oauth-state.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { WebhookService } from './webhook.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [MetaController, WebhooksController],
  providers: [
    EncryptionKeyService,
    MetaConfigService,
    OauthStateService,
    { provide: GraphClient, useClass: HttpGraphClient },
    AssetsService,
    SubscriptionsService,
    OauthService,
    WebhookService,
  ],
  exports: [MetaConfigService, GraphClient, WebhookService, AssetsService, SubscriptionsService],
})
export class MetaModule {}
