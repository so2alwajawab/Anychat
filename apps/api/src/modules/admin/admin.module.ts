import { Module } from '@nestjs/common';
import { AdminBootstrap } from './admin.bootstrap.js';
import { AdminController } from './controller.js';
import { AdminService } from './admin.service.js';

/**
 * Phase 3 — platform-admin dashboard API. Routes live under /api/v1/admin and
 * are globally guarded (AdminAuthGuard session + PlatformAdminGuard role) and
 * globally unscoped (no tenant ALS binding).
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminBootstrap],
})
export class AdminModule {}
