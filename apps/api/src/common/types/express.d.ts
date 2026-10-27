import 'express';

export interface AuthenticatedSession {
  id: string;
  ownerId: string;
  username: string;
  csrfTokenHash: string | null;
  createdAt: Date;
  absoluteExpiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      session?: AuthenticatedSession;
      csrfToken?: string;
      rawBody?: Buffer;
    }
  }
}
