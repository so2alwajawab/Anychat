export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
}

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie("anychat_csrf");
  if (existing) return existing;
  const res = await fetch("/api/v1/auth/csrf", { credentials: "same-origin" });
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

async function requestJson<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (method !== "GET") {
      headers["x-csrf-token"] = await ensureCsrfToken();
    }
    if (body !== undefined) headers["content-type"] = "application/json";
    res = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "تعذّر الوصول إلى الخادم. تحقّق من الاتصال.");
  }
  const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.code ?? "UNKNOWN",
      data?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى.",
    );
  }
  return data as T;
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, "GET");
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, "PUT", body);
}

export async function delJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, "DELETE");
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, "POST", body);
}

export interface SessionUser {
  id: string;
  username: string;
  /** Platform-admin flag (Phase 3): unlocks the cross-tenant /admin area. */
  platformAdmin: boolean;
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const res = await fetch("/api/v1/auth/session", { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, "SESSION_CHECK_FAILED", "تعذّر التحقق من الجلسة.");
  return (await res.json()) as { user: SessionUser };
}
