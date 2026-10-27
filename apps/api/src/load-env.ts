import { config as loadDotEnv } from 'dotenv';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Loads apps/api/.env when present (local development). In production the
// environment is injected by the orchestrator and this file does not exist,
// so dotenv is a no-op there. Must be the FIRST import of any entrypoint.
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
loadDotEnv({ path: join(apiRoot, '.env') });
