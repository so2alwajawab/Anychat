import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { requireOrgId } from '../../common/tenancy/org-context.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import type { OnboardingStep } from './dto.js';

export interface OnboardingState {
  step: string;
  completed: boolean;
  organizationName: string;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Current wizard state for the caller's organization. `Organization` is the
   * tenancy boundary itself (not auto-scoped by the extension), so every query
   * below addresses it explicitly through requireOrgId().
   */
  async get(): Promise<OnboardingState> {
    const organizationId = requireOrgId();
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, onboardingStep: true, onboardingCompletedAt: true },
    });
    if (!org) {
      throw new NotFoundException();
    }
    return {
      step: org.onboardingStep,
      completed: org.onboardingCompletedAt !== null,
      organizationName: org.name,
    };
  }

  /** Persists the wizard step; landing on `done` completes onboarding. */
  async update(
    step: OnboardingStep,
    actorId?: string,
  ): Promise<{ step: string; completed: boolean }> {
    const organizationId = requireOrgId();
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingCompletedAt: true },
    });
    if (!org) {
      throw new NotFoundException();
    }

    // Completion is sticky: moving back to an earlier step after finishing does
    // not un-complete the organization (only the wizard UI cares about step).
    const completedAt =
      step === 'done' ? (org.onboardingCompletedAt ?? new Date()) : org.onboardingCompletedAt;

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingStep: step, onboardingCompletedAt: completedAt },
      select: { onboardingStep: true, onboardingCompletedAt: true },
    });

    if (step === 'done' && !org.onboardingCompletedAt) {
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ONBOARDING_COMPLETED,
          actorId,
          organizationId,
          entity: 'organization',
          entityId: organizationId,
          meta: { step },
        },
      );
    }

    return {
      step: updated.onboardingStep,
      completed: updated.onboardingCompletedAt !== null,
    };
  }
}
