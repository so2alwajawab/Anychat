import { IsIn } from 'class-validator';

/**
 * First-run wizard steps, in order. A customer may skip forward (or move back)
 * freely; reaching `done` marks the organization as onboarded.
 */
export const ONBOARDING_STEPS = ['welcome', 'connect', 'template', 'done'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export class UpdateOnboardingDto {
  @IsIn(ONBOARDING_STEPS, {
    message: `step must be one of: ${ONBOARDING_STEPS.join(', ')}`,
  })
  step!: OnboardingStep;
}
