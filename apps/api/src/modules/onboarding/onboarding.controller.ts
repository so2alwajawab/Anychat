import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UpdateOnboardingDto } from './dto.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  get() {
    return this.onboarding.get();
  }

  @Put()
  update(@Body() dto: UpdateOnboardingDto, @Req() req: Request) {
    return this.onboarding.update(dto.step, req.session?.ownerId);
  }
}
