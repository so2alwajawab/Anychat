import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { Logger } from 'nestjs-pino';

function codeForStatus(status: number): string {
  if (status === 400) return ERROR_CODES.VALIDATION_ERROR;
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.CSRF_INVALID;
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status === 429) return ERROR_CODES.RATE_LIMITED;
  if (status >= 500) return ERROR_CODES.INTERNAL_ERROR;
  return ERROR_CODES.VALIDATION_ERROR;
}

/** Arabic-safe error contract: every response body is { statusCode, code, message }. */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'statusCode' in payload) {
        const existing = payload as { code?: unknown };
        if (typeof existing.code === 'string') {
          // Already in the documented contract (apiError body) — pass through.
          res.status(status).json(payload);
          return;
        }
        // class-validator / plain Nest payloads carry no `code`, which would
        // break the { statusCode, code, message } contract (and the web client
        // keys off `code` for Arabic messages). Normalize them, keeping the
        // field-level messages under details.messages.
        const raw = (payload as { message?: unknown }).message;
        const messages = Array.isArray(raw)
          ? raw.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
          : typeof raw === 'string'
            ? [raw]
            : [];
        res
          .status(status)
          .json(apiError(status, codeForStatus(status), messages.length ? { messages } : undefined));
        return;
      }
      const details =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? { messages: (payload as { message: unknown }).message }
          : undefined;
      res.status(status).json(apiError(status, codeForStatus(status), details));
      return;
    }

    const err = exception as Error;
    this.logger.error(
      { err: { message: err?.message, stack: err?.stack } },
      'unhandled exception',
    );
    res.status(500).json(apiError(500, ERROR_CODES.INTERNAL_ERROR));
  }
}
