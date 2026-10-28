"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@anychat/shared";
import { getJson } from "@/lib/api";

interface AdminOrgDetail {
  id: string;
  name: string;
  status: string;
  onboardingStep: string;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owners: Array<{
    role: string;
    createdAt: string;
    user: { id: string; username: string; email: string | null; createdAt: string };
  }>;
  assets: Array<{
    id: string;
    platform: string;
    displayName: string;
    connectionStatus: string;
    selected: boolean;
    connectedAt: string;
  }>;
  workflows: Array<{ id: string; name: string; status: string; updatedAt: string }>;
  templates: Array<{ id: string; name: string; version: number }>;
  _count: { posts: number; comments: number; runs: number };
  runsSucceeded: number;
  recentAudit: Array<{
    id: string;
    action: string;
    outcome: string;
    actorId: string | null;
    createdAt: string;
  }>;
}

function Section({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      <div className="p-5">
        {count === 0 ? (
          <p className="text-sm text-slate-400">{empty}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<AdminOrgDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getJson<AdminOrgDetail>(`/api/v1/admin/orgs/${id}`)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "unknown");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{UI.admin.detail.error}</p>
        <Link href="/admin/orgs" className="text-sm text-brand hover:underline">
          {UI.admin.detail.back}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        {UI.admin.detail.loading}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/orgs"
            className="text-xs text-slate-500 hover:text-brand"
          >
            ← {UI.admin.detail.back}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {data.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(data.createdAt).toLocaleDateString("ar-EG")} ·{" "}
            <span dir="ltr">{data.id}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              data.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {data.status === "active"
              ? UI.admin.orgs.statusActive
              : UI.admin.orgs.statusOther}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              data.onboardingStep === "done"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {data.onboardingStep === "done"
              ? UI.admin.orgs.onboardingDone
              : UI.admin.orgs.onboardingPending}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: UI.admin.detail.comments, value: data._count.comments },
          { label: UI.admin.detail.posts, value: data._count.posts },
          {
            label: UI.admin.detail.runs,
            value: `${data.runsSucceeded}/${data._count.runs}`,
          },
          {
            label: UI.admin.detail.assets,
            value: data.assets.length,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="text-xs text-slate-500">{kpi.label}</div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={UI.admin.detail.members}
          empty={UI.admin.detail.noMembers}
          count={data.owners.length}
        >
          <ul className="space-y-3">
            {data.owners.map((m) => (
              <li
                key={m.user.id}
                className="flex items-center justify-between text-sm"
              >
                <span dir="ltr" className="font-medium text-foreground">
                  {m.user.username}
                </span>
                <span className="text-xs text-slate-500">
                  {m.role} · {new Date(m.createdAt).toLocaleDateString("ar-EG")}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={UI.admin.detail.assets}
          empty={UI.admin.detail.noAssets}
          count={data.assets.length}
        >
          <ul className="space-y-3">
            {data.assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-foreground">{a.displayName}</span>
                <span className="text-xs text-slate-500">
                  {a.platform} · {a.connectionStatus}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={UI.admin.detail.workflows}
          empty={UI.admin.detail.noWorkflows}
          count={data.workflows.length}
        >
          <ul className="space-y-3">
            {data.workflows.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-foreground">{w.name}</span>
                <span className="text-xs text-slate-500">{w.status}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={UI.admin.detail.templates}
          empty={UI.admin.detail.noTemplates}
          count={data.templates.length}
        >
          <ul className="space-y-3">
            {data.templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-foreground">{t.name}</span>
                <span className="text-xs text-slate-500">v{t.version}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section
        title={UI.admin.detail.recentAudit}
        empty={UI.admin.detail.noAudit}
        count={data.recentAudit.length}
      >
        <ul className="space-y-2">
          {data.recentAudit.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <span dir="ltr" className="font-mono text-xs text-foreground">
                {a.action}
              </span>
              <span
                className={`text-xs ${
                  a.outcome === "success" ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {a.outcome} · {new Date(a.createdAt).toLocaleString("ar-EG")}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
