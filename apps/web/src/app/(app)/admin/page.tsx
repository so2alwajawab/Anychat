"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@anychat/shared";
import { getJson } from "@/lib/api";

interface AdminOverview {
  counts: {
    organizations: number;
    onboardedOrganizations: number;
    owners: number;
    assets: number;
    comments30d: number;
    runs30d: number;
    publishedWorkflows: number;
    runSuccessRate30d: number | null;
  };
  commentTrend: Array<{ day: string; count: number }>;
  latestOrgs: Array<{
    id: string;
    name: string;
    status: string;
    onboardingStep: string;
    createdAt: string;
    ownerUsername: string | null;
  }>;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getJson<AdminOverview>("/api/v1/admin/overview")
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "unknown");
        }
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{UI.admin.overview.error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReloadKey((k) => k + 1);
          }}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {UI.admin.retry}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        {UI.admin.overview.loading}
      </p>
    );
  }

  const maxTrend = Math.max(1, ...data.commentTrend.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {UI.admin.overview.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {UI.admin.overview.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label={UI.admin.overview.orgs}
          value={data.counts.organizations}
        />
        <KpiCard
          label={UI.admin.overview.orgsOnboarded}
          value={data.counts.onboardedOrganizations}
        />
        <KpiCard
          label={UI.admin.overview.owners}
          value={data.counts.owners}
        />
        <KpiCard label={UI.admin.overview.assets} value={data.counts.assets} />
        <KpiCard
          label={UI.admin.overview.comments30}
          value={data.counts.comments30d}
        />
        <KpiCard
          label={UI.admin.overview.runs30}
          value={data.counts.runs30d}
        />
        <KpiCard
          label={UI.admin.overview.runSuccess}
          value={
            data.counts.runSuccessRate30d === null
              ? "—"
              : `${data.counts.runSuccessRate30d}%`
          }
        />
        <KpiCard
          label={UI.admin.overview.publishedWorkflows}
          value={data.counts.publishedWorkflows}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {UI.admin.overview.commentsTrend}
        </h2>
        <div
          className="flex h-32 items-end gap-1"
          role="img"
          aria-label={UI.admin.overview.commentsTrend}
        >
          {data.commentTrend.map((d) => (
            <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand/80"
                style={{ height: `${Math.round((d.count / maxTrend) * 100)}%` }}
                title={`${d.day}: ${d.count}`}
              />
              <span className="w-full truncate text-center text-[9px] text-slate-400">
                {d.day.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {UI.admin.overview.latestOrgs}
          </h2>
          <Link href="/admin/orgs" className="text-sm text-brand hover:underline">
            {UI.admin.orgs.title}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">{UI.admin.orgs.name}</th>
                <th className="px-5 py-3 font-medium">{UI.admin.orgs.owners}</th>
                <th className="px-5 py-3 font-medium">{UI.admin.orgs.onboarding}</th>
                <th className="px-5 py-3 font-medium">{UI.admin.orgs.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {data.latestOrgs.map((org) => (
                <tr key={org.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/orgs/${org.id}`}
                      className="font-medium text-foreground hover:text-brand"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600" dir="ltr">
                    {org.ownerUsername ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        org.onboardingStep === "done"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {org.onboardingStep === "done"
                        ? UI.admin.orgs.onboardingDone
                        : UI.admin.orgs.onboardingPending}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(org.createdAt).toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
