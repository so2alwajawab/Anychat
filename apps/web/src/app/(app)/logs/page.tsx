"use client";

import { Suspense, useEffect, useState } from "react";
import { UI } from "@anychat/shared";
import { ApiError, getJson, postJson } from "@/lib/api";

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

interface OutboundActionSummary {
  id: string;
  actionType: string;
  status: string;
  remoteMessageId: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
}

interface ExecutionRunItem {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "stopped" | "skipped";
  skipReason: string | null;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  comment: {
    id: string;
    platform: string;
    externalCommentId: string;
    authorUsername: string | null;
    text: string;
    sourceCreatedAt: string;
  };
  outboundActions: OutboundActionSummary[];
  stepsCount: number;
  startedAt: string;
  finishedAt: string | null;
}

interface NodeExecutionDetail {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string;
  inputSummary: unknown;
  outputSummary: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface ExecutionRunDetail extends ExecutionRunItem {
  steps: NodeExecutionDetail[];
  contextSnapshot: unknown;
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
  const [tab, setTab] = useState<"runs" | "webhooks" | "audit">("runs");
  const [runs, setRuns] = useState<ExecutionRunItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<ExecutionRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<{ items: ExecutionRunItem[] }>("/api/v1/runs?limit=50").catch(() => ({ items: [] })),
      getJson<{ items: WebhookDeliveryItem[] }>("/api/v1/meta/webhooks/deliveries?limit=50").catch(() => ({ items: [] })),
      getJson<{ items: AuditLogItem[] }>("/api/v1/audit?limit=50").catch(() => ({ items: [] })),
    ])
      .then(([runsRes, deliveriesRes, auditRes]) => {
        if (cancelled) return;
        setRuns(runsRes.items ?? []);
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

  const openRunDetail = (id: string) => {
    setSelectedRunId(id);
    setDetailLoading(true);
    getJson<ExecutionRunDetail>(`/api/v1/runs/${id}`)
      .then((data) => setRunDetail(data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "فشل تحميل تفاصيل العملية"))
      .finally(() => setDetailLoading(false));
  };

  const handleRetryRun = async (id: string) => {
    setRetrying(true);
    try {
      await postJson(`/api/v1/runs/${id}/retry`, {});
      openRunDetail(id);
      const res = await getJson<{ items: ExecutionRunItem[] }>("/api/v1/runs?limit=50");
      setRuns(res.items ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشلت إعادة محاولة العملية");
    } finally {
      setRetrying(false);
    }
  };

  const runStatusBadge = (status: string, skipReason?: string | null) => {
    const labels = L.runs.statusLabels;
    switch (status) {
      case "succeeded":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">{labels.succeeded}</span>;
      case "running":
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200 animate-pulse">{labels.running}</span>;
      case "pending":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">{labels.pending}</span>;
      case "skipped":
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-300" title={skipReason || undefined}>
            {labels.skipped} {skipReason ? `(${skipReason})` : ""}
          </span>
        );
      case "stopped":
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">{labels.stopped}</span>;
      default:
        return <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">{labels.failed}</span>;
    }
  };

  const webhookStatusBadge = (status: string) => {
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
          onClick={() => setTab("runs")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "runs"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {L.tabs.runs} ({runs.length})
        </button>
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
      ) : tab === "runs" ? (
        runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-slate-400">
            {L.runs.empty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border text-right text-xs">
              <thead className="bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="px-4 py-3">{L.runs.workflow}</th>
                  <th className="px-4 py-3">{L.runs.comment}</th>
                  <th className="px-4 py-3">{L.runs.status}</th>
                  <th className="px-4 py-3">{L.runs.outbound}</th>
                  <th className="px-4 py-3">{L.runs.date}</th>
                  <th className="px-4 py-3">{L.runs.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{r.workflowName}</div>
                      <span className="text-[10px] text-slate-400">الإصدار v{r.workflowVersion}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          r.comment.platform === "instagram" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {r.comment.platform === "instagram" ? "إنستغرام" : "فيسبوك"}
                        </span>
                        <span className="text-slate-500 font-medium">{r.comment.authorUsername || "متابع"}</span>
                      </div>
                      <p className="truncate text-slate-600 text-xs" title={r.comment.text}>
                        &ldquo;{r.comment.text}&rdquo;
                      </p>
                    </td>
                    <td className="px-4 py-3">{runStatusBadge(r.status, r.skipReason)}</td>
                    <td className="px-4 py-3">
                      {r.outboundActions.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        r.outboundActions.map((act) => (
                          <div key={act.id} className="flex items-center gap-1 text-[11px]">
                            <span className={act.status === "sent" ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                              {act.status === "sent" ? "تم الرد ✓" : act.status === "failed" ? "فشل الرد" : act.status}
                            </span>
                            {act.remoteMessageId && (
                              <span className="text-slate-400 font-mono text-[10px]" dir="ltr">
                                ({act.remoteMessageId.slice(0, 8)}…)
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(r.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openRunDetail(r.id)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200 transition"
                      >
                        عرض الخطوات ({r.stepsCount})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
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
                    <td className="px-4 py-3">{webhookStatusBadge(d.processStatus)}</td>
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

      {/* Node-Level Timeline Modal (Gate G5 Requirement) */}
      {selectedRunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col border border-border">
            <div className="flex items-center justify-between border-b border-border p-5 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تفاصيل مسار التنفيذ (Timeline)
                </h3>
                <span className="text-xs text-slate-500 font-mono" dir="ltr">
                  Run ID: {selectedRunId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRunId(null);
                  setRunDetail(null);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading || !runDetail ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  جارٍ تحميل تسلسل العقد…
                </div>
              ) : (
                <>
                  {/* Summary Card */}
                  <div className="rounded-xl bg-slate-50 p-4 border border-border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">المخطط:</span>
                      <span className="font-bold text-slate-900">{runDetail.workflowName} (v{runDetail.workflowVersion})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">حالة التنفيذ:</span>
                      {runStatusBadge(runDetail.status, runDetail.skipReason)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">التعليق الأصلي:</span>
                      <span className="text-slate-800 italic">&ldquo;{runDetail.comment.text}&rdquo;</span>
                    </div>
                    {runDetail.status === "failed" && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleRetryRun(runDetail.id)}
                          disabled={retrying}
                          className="w-full rounded-lg bg-brand py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {retrying ? "جارٍ إعادة المحاولة…" : "إعادة محاولة تنفيذ العملية"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Outbound Actions Section */}
                  {runDetail.outboundActions && runDetail.outboundActions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        الردود الصادرة (Outbound Actions)
                      </h4>
                      {runDetail.outboundActions.map((act) => (
                        <div key={act.id} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                          <div className="flex items-center justify-between font-semibold mb-1">
                            <span>نوع الرد: {act.actionType === "public_reply" ? "رد عام على التعليق" : act.actionType}</span>
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 text-[10px]">
                              {act.status}
                            </span>
                          </div>
                          {act.remoteMessageId && (
                            <div className="text-[11px] text-slate-600 font-mono mt-1" dir="ltr">
                              Remote Message ID: {act.remoteMessageId}
                            </div>
                          )}
                          {act.lastErrorCode && (
                            <div className="text-[11px] text-rose-700 mt-1">
                              رمز الخطأ: {act.lastErrorCode}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Node-Level Timeline Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      تسلسل تنفيذ العقد (Node Execution Timeline)
                    </h4>
                    {runDetail.steps.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">لا توجد خطوات مسجلة بعد</p>
                    ) : (
                      <div className="space-y-3 border-s-2 border-slate-200 ps-4 me-2">
                        {runDetail.steps.map((step, idx) => (
                          <div key={step.id} className="relative rounded-xl border border-border bg-white p-3 shadow-xs">
                            <span className={`absolute -start-[23px] top-3.5 h-3 w-3 rounded-full border-2 border-white ${
                              step.status === "executed" || step.status === "passed"
                                ? "bg-emerald-500"
                                : step.status === "failed"
                                ? "bg-rose-500"
                                : "bg-amber-400"
                            }`} />
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-slate-800">
                                خطوة {idx + 1}: {step.nodeType}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                step.status === "passed" || step.status === "executed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : step.status === "failed"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}>
                                {step.status}
                              </span>
                            </div>
                            {step.errorMessage && (
                              <p className="mt-1 text-xs text-rose-600 font-medium">
                                {step.errorMessage}
                              </p>
                            )}
                            {step.outputSummary != null && (
                              <div className="mt-2 rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-700 overflow-x-auto" dir="ltr">
                                <pre>{JSON.stringify(step.outputSummary, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
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
