export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Sliding idle expiry (7d) that can never cross the absolute cap (30d). */
export function computeSlidingExpiry(now: Date, _createdAt: Date, absoluteExpiresAt: Date): Date {
  const candidate = new Date(now.getTime() + SESSION_IDLE_MS);
  return candidate > absoluteExpiresAt ? absoluteExpiresAt : candidate;
}
