"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UI } from "@anychat/shared";
import { AppShell } from "@/components/app-shell";
import { getSession, type SessionUser } from "@/lib/api";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
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
