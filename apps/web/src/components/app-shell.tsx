"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ADMIN_NAV_ITEMS,
  APP_NAME,
  NAV_ITEMS,
  UI,
  type AdminNavSlug,
  type NavSlug,
} from "@anychat/shared";
import { postJson, type SessionUser } from "@/lib/api";

/* eslint-disable @next/next/no-img-element -- static local brand assets, no runtime optimization needed */

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

const ADMIN_ICONS: Record<AdminNavSlug, ReactNode> = {
  admin: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" />
    </>
  ),
  "admin-orgs": (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  "admin-meta": (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M10 9l2 2 4-4" />
    </>
  ),
  "admin-tracking": (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </>
  ),
};

function AdminNavIcon({ slug }: { slug: AdminNavSlug }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 fill-none stroke-current"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ADMIN_ICONS[slug]}
    </svg>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <img
        src="/brand/logo.png"
        alt=""
        width={512}
        height={414}
        className="h-8 w-auto shrink-0"
      />
      <span className="text-base font-semibold text-white">{APP_NAME}</span>
    </div>
  );
}

function SidebarNav({
  user,
  pathname,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  user: SessionUser;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute && user.platformAdmin) {
    return (
      <>
        <div className="px-4 py-2">
          <div className="rounded-xl bg-brand/15 border border-brand/30 px-3 py-2 text-xs font-bold text-white flex items-center justify-between">
            <span>لوحة إدارة المنصة</span>
            <span className="text-[10px] bg-brand text-white rounded px-1.5 py-0.5">إدارة</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.slug}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-active text-white"
                    : "text-sidebar-foreground hover:bg-white/10 hover:text-white"
                }`}
              >
                <AdminNavIcon slug={item.slug} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10 space-y-2">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-sidebar-foreground hover:bg-white/10 hover:text-white transition"
          >
            <span>مساحة عمل العميل</span>
            <span>←</span>
          </Link>
          <div className="truncate text-xs text-sidebar-muted px-1" title={user.username}>
            {user.username}
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="text-xs text-sidebar-muted hover:text-white disabled:opacity-60 px-1"
          >
            {UI.logout}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.slug}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
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

        {user.platformAdmin && (
          <div className="pt-4">
            <Link
              href="/admin"
              onClick={onNavigate}
              className="flex items-center justify-between rounded-xl bg-brand/20 border border-brand/40 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-brand/30 transition shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span>🛡️</span>
                <span>لوحة تحكم المنصة</span>
              </div>
              <span>←</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="truncate text-sm" title={user.username}>
          {user.username}
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-1 text-xs text-sidebar-muted hover:text-white disabled:opacity-60"
        >
          {UI.logout}
        </button>
      </div>
    </>
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
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <BrandHeader />
        <SidebarNav
          user={user}
          pathname={pathname}
          onLogout={logout}
          loggingOut={loggingOut}
        />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 right-0 flex w-64 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <BrandHeader />
            <SidebarNav
              user={user}
              pathname={pathname}
              onNavigate={() => setMenuOpen(false)}
              onLogout={logout}
              loggingOut={loggingOut}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 text-sm text-slate-500 sm:px-6">
          <button
            type="button"
            aria-label="فتح القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="-m-1.5 rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5 fill-none stroke-current"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img
            src="/brand/logo.png"
            alt=""
            width={512}
            height={414}
            className="h-7 w-auto shrink-0 lg:hidden"
          />
          <span className="font-medium text-slate-700 lg:hidden">
            {APP_NAME}
          </span>
          <span className="hidden lg:inline">{APP_NAME}</span>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
