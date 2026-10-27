import { computeSlidingExpiry } from './session-expiry.js';

describe('computeSlidingExpiry', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('extends idle expiry by the idle window', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const absolute = new Date('2026-01-31T00:00:00Z');
    const next = computeSlidingExpiry(now, createdAt, absolute);
    expect(next.getTime()).toBe(now.getTime() + 7 * DAY);
  });

  it('never exceeds the absolute expiry', () => {
    const now = new Date('2026-01-29T00:00:00Z');
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const absolute = new Date('2026-01-31T00:00:00Z');
    const next = computeSlidingExpiry(now, createdAt, absolute);
    expect(next.getTime()).toBe(absolute.getTime());
  });

  it('ignores createdAt beyond the absolute horizon', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const absolute = new Date('2026-01-31T00:00:00Z');
    const next = computeSlidingExpiry(now, createdAt, absolute);
    expect(next.getTime()).toBe(absolute.getTime());
  });
});
