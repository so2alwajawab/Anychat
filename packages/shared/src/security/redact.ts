const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|csrf|cookie|authorization|api[-_]?key|private[-_]?key|recovery|code[-_]?hash|verify[-_]?code|otp[-_]?code|ciphertext|cipher)/i;

export const REDACT_LOG_FIELDS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactValue<T>(value: T, extraKeys: string[] = []): T {
  const extras = new Set(extraKeys.map((k) => k.toLowerCase()));
  const walk = (input: unknown, depth: number): unknown => {
    if (depth > 8 || input === null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map((item) => walk(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key) || extras.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = walk(val, depth + 1);
      }
    }
    return out;
  };
  return walk(value, 0) as T;
}
