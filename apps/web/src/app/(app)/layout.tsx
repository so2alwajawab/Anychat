"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UI } from "@anychat/shared";
import { AppShell } from "@/components/app-shell";
import { getJson, getSession, type SessionUser } from "@/lib/api";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => {
        if (!alive) return;
        if (session) setUser(session.user);
        else router.replace("/login");
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  // First-run guard: an organization that has not finished onboarding is bounced
  // back to the wizard on every app route (the wizard itself lives at
  // /onboarding, which is exempt to avoid a redirect loop). Transient failures
  // do not bounce — the session gate above is the security boundary; this is UX.
  useEffect(() => {
    if (!user || pathname === "/onboarding") return;
    let alive = true;
    getJson<{ completed: boolean }>("/api/v1/onboarding")
      .then((s) => {
        if (alive && !s.completed) router.replace("/onboarding");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, pathname, router]);

  if (failed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm">
        <p className="text-red-600">{UI.session.expired}</p>
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="text-brand hover:underline"
        >
          {UI.login.title}
        </button>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        {UI.session.checking}
      </main>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
