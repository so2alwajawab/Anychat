import { parseServerEnv } from '@anychat/shared';

export const serverEnv = parseServerEnv(process.env);

export const SESSION_IDLE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_ABSOLUTE_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_SLIDING_WRITE_THRESHOLD_MS = 5 * 60 * 1000;

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const LOGIN_IP_MAX_PER_MINUTE = 30;
export const RECOVERY_IP_MAX_PER_5_MINUTES = 5;
