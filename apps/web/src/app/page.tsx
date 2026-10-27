"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UI } from "@anychat/shared";
import { getSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => {
        if (!alive) return;
        router.replace(session ? "/dashboard" : "/login");
      })
      .catch(() => {
        if (alive) router.replace("/login");
      });
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {UI.session.checking}
    </main>
  );
}
