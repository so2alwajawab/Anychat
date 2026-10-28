"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { UI } from "@anychat/shared";
import { getJson } from "@/lib/api";

interface AdminOrgRow {
  id: string;
  name: string;
  status: string;
  onboardingStep: string;
  onboardingCompletedAt: string | null;
  createdAt: string;
  ownerUsername: string | null;
  counts: { assets: number; workflows: number; comments: number };
}

interface AdminOrgsResponse {
  items: AdminOrgRow[];
  total: number;
  page: number;
  limit: number;
}

export default function AdminOrgsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  // Bumped by the search form so re-submitting the same query refetches even
  // when page and q are unchanged (effect deps below use the combined key).
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<AdminOrgsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchKey = `${page}|${q.trim()}|${nonce}`;

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    getJson<AdminOrgsResponse>(`/api/v1/admin/orgs?${params}`)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "unknown");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchKey encodes page+q+nonce
  }, [fetchKey]);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    setError(null);
    setNonce((n) => n + 1);
  }

  function goPage(next: number) {
    setPage(next);
    setLoading(true);
    setError(null);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {UI.admin.orgs.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{UI.admin.orgs.subtitle}</p>
      </div>

      <form onSubmit={submitSearch} className="flex max-w-md gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={UI.admin.orgs.search}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          {UI.admin.orgs.searchBtn}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{UI.admin.orgs.error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">{UI.admin.orgs.name}</th>
              <th className="px-4 py-3 font-medium">{UI.admin.orgs.owners}</th>
              <th className="px-4 py-3 font-medium">{UI.admin.orgs.status}</th>
              <th className="px-4 py-3 font-medium">{UI.admin.orgs.onboarding}</th>
              <th className="px-4 py-3 font-medium">المحتوى</th>
              <th className="px-4 py-3 font-medium">{UI.admin.orgs.createdAt}</th>
              <th className="px-4 py-3 font-medium">{UI.admin.orgs.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  {UI.admin.orgs.loading}
                </td>
              </tr>
            ) : (data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {UI.admin.orgs.empty}
                </td>
              </tr>
            ) : (
              data?.items.map((org) => (
                <tr key={org.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{org.name}</td>
                  <td className="px-4 py-3 text-slate-600" dir="ltr">
                    {org.ownerUsername ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        org.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {org.status === "active"
                        ? UI.admin.orgs.statusActive
                        : UI.admin.orgs.statusOther}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {org.counts.assets} حساب · {org.counts.workflows} مسار ·{" "}
                    {org.counts.comments} تعليق
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(org.createdAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orgs/${org.id}`}
                      className="text-brand hover:underline"
                    >
                      {UI.admin.orgs.actions}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goPage(Math.max(1, page - 1))}
            className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
          >
            {UI.admin.orgs.prev}
          </button>
          <span className="text-slate-500">
            {UI.admin.orgs.pageInfo
              .replace("{page}", String(data.page))
              .replace("{pages}", String(pages))}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => goPage(page + 1)}
            className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
          >
            {UI.admin.orgs.next}
          </button>
        </div>
      )}
    </div>
  );
}
