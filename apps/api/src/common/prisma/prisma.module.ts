import { Global, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { serverEnv } from '../config/env.js';
import { tenancyExtension } from '../tenancy/tenancy.extension.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: serverEnv.DATABASE_URL }) });
    // Returning the extended client from the constructor keeps every custom
    // method (onModuleDestroy) and model delegate while auto-scoping tenant
    // queries to the active organization (see tenancy.extension.ts). Verified
    // empirically: subclass lifecycle hooks survive the $extends swap. The cast
    // works around Prisma's typing, which omits subclass members from the
    // $extends return type even though they are present at runtime.
    return this.$extends(tenancyExtension) as unknown as this;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
