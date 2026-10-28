"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UI } from "@anychat/shared";
import { getSession } from "@/lib/api";

/**
 * Phase 3 — platform-admin area. The API is the security boundary (session +
 * PlatformAdminGuard); this layout is UX only: it re-checks the session and
 * renders a friendly unauthorized screen for non-admin accounts.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => {
        if (!alive) return;
        if (!session) router.replace("/login");
        else if (session.user.platformAdmin) setState("ok");
        else setState("denied");
      })
      .catch(() => {
        if (alive) setState("denied");
      });
    return () => {
      alive = false;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        {UI.session.checking}
      </main>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-6 w-6 fill-none stroke-current"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <p className="text-sm text-slate-600">{UI.admin.unauthorized}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          {UI.admin.backToDashboard}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
