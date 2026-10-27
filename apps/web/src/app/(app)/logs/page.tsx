"use client";

import { Suspense, useEffect, useState } from "react";
import { UI } from "@anychat/shared";
import { ApiError, getJson } from "@/lib/api";

interface WebhookDeliveryItem {
  id: string;
  deliveryHash: string;
  objectType: string;
  signatureStatus: string;
  processStatus: string;
  receivedAt: string;
  payload: unknown;
}

interface AuditLogItem {
  id: string;
  createdAt: string;
  action: string;
  actorType: string;
  outcome: string;
  ip: string | null;
  entity: string | null;
  meta: unknown;
}

const L = UI.logs;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function LogsContent() {
  const [tab, setTab] = useState<"webhooks" | "audit">("webhooks");
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<{ items: WebhookDeliveryItem[] }>("/api/v1/meta/webhooks/deliveries?limit=50").catch(() => ({ items: [] })),
      getJson<{ items: AuditLogItem[] }>("/api/v1/audit?limit=50").catch(() => ({ items: [] })),
    ])
      .then(([deliveriesRes, auditRes]) => {
        if (cancelled) return;
        setDeliveries(deliveriesRes.items ?? []);
        setAuditLogs(auditRes.items ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : L.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusBadge = (status: string) => {
    const labels = L.webhooks.statusLabels;
    switch (status) {
      case "processed":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">{labels.processed}</span>;
      case "received":
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">{labels.received}</span>;
      case "processing":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">{labels.processing}</span>;
      case "skipped":
        return <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-border">{labels.skipped}</span>;
      default:
        return <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-200">{labels.failed}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{L.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{L.subtitle}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-4">
        <button
          type="button"
          onClick={() => setTab("webhooks")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "webhooks"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {L.tabs.webhooks} ({deliveries.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("audit")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "audit"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {L.tabs.audit} ({auditLogs.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-slate-500">
          {L.loading}
        </div>
      ) : tab === "webhooks" ? (
        deliveries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-slate-400">
            {L.webhooks.empty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border text-right text-xs">
              <thead className="bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="px-4 py-3">{L.webhooks.deliveryHash}</th>
                  <th className="px-4 py-3">{L.webhooks.objectType}</th>
                  <th className="px-4 py-3">{L.webhooks.signature}</th>
                  <th className="px-4 py-3">{L.webhooks.status}</th>
                  <th className="px-4 py-3">{L.webhooks.receivedAt}</th>
                  <th className="px-4 py-3">{L.webhooks.payload}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600" dir="ltr">
                      {d.deliveryHash.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {d.objectType}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-700 font-medium">
                        {d.signatureStatus === "valid" ? L.webhooks.signatureValid : L.webhooks.signatureInvalid}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(d.processStatus)}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(d.receivedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                        className="text-brand hover:underline font-medium"
                      >
                        {expandedId === d.id ? "إغلاق" : "عرض"}
                      </button>
                      {expandedId === d.id && (
                        <div className="mt-2 max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[10px] text-emerald-400 font-mono" dir="ltr">
                          <pre>{JSON.stringify(d.payload, null, 2)}</pre>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : auditLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-slate-400">
          {L.audit.empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-right text-xs">
            <thead className="bg-slate-50 font-medium text-slate-600">
              <tr>
                <th className="px-4 py-3">{L.audit.action}</th>
                <th className="px-4 py-3">{L.audit.actor}</th>
                <th className="px-4 py-3">{L.audit.outcome}</th>
                <th className="px-4 py-3">{L.audit.ip}</th>
                <th className="px-4 py-3">{L.audit.time}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-slate-700">
              {auditLogs.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900" dir="ltr">
                    {a.action}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.actorType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        a.outcome === "success"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {a.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px]" dir="ltr">
                    {a.ip || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(a.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">{L.loading}</div>}>
      <LogsContent />
    </Suspense>
  );
}
