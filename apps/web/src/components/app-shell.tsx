"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME, NAV_ITEMS, UI, type NavSlug } from "@anychat/shared";
import { postJson, type SessionUser } from "@/lib/api";

const ICONS: Record<NavSlug, ReactNode> = {
  dashboard: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  connections: (
    <>
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M9.2 9.2l5.6 5.6" />
    </>
  ),
  content: (
    <>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  workflows: (
    <>
      <path d="M5 5v5a4 4 0 0 0 4 4h7" />
      <path d="M13 11l3 3-3 3" />
      <path d="M19 5v4" />
    </>
  ),
  templates: (
    <>
      <path d="M4 8l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </>
  ),
  contacts: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  logs: <path d="M5 6h14M5 12h14M5 18h9" />,
  settings: (
    <>
      <path d="M4 7h9M18.5 7H20M4 17h4.5M14 17h6" />
      <circle cx="15.5" cy="7" r="2.5" />
      <circle cx="11" cy="17" r="2.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.1 1-1.1 1.9" />
      <path d="M12 16.6v.4" />
    </>
  ),
};

function NavIcon({ slug }: { slug: NavSlug }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 fill-none stroke-current"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[slug]}
    </svg>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await postJson("/api/v1/auth/logout", {});
    } catch {
      // Session may already be invalid; fall through to the login screen.
    }
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
            {APP_NAME.charAt(0)}
          </span>
          <span className="text-base font-semibold">{APP_NAME}</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.slug}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-active text-white"
                    : "text-sidebar-foreground hover:bg-white/10 hover:text-white"
                }`}
              >
                <NavIcon slug={item.slug} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="truncate text-sm" title={user.username}>
            {user.username}
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="mt-1 text-xs text-sidebar-muted hover:text-white disabled:opacity-60"
          >
            {UI.logout}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-6 text-sm text-slate-500">
          {APP_NAME}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
