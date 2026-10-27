"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ALLOW_LISTED_VARIABLES,
  validateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowNodeType,
} from "@anychat/shared";
import { ApiError, delJson, getJson, postJson, putJson } from "@/lib/api";
import { workflowNodeTypes } from "@/components/workflow/custom-nodes";

interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "paused";
  currentVersion: number;
  lockVersion: number;
  assetId: string | null;
  asset: { id: string; displayName: string; platform: string } | null;
  createdAt: string;
  updatedAt: string;
  hasDraft: boolean;
  hasPublished: boolean;
  activeVersionNumber: number | null;
}

interface WorkflowDetail {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "paused";
  currentVersion: number;
  lockVersion: number;
  assetId: string | null;
  asset: { id: string; displayName: string; platform: string } | null;
  draftDefinition: WorkflowDefinition | null;
  publishedDefinition: WorkflowDefinition | null;
}

interface TemplateOption {
  id: string;
  name: string;
}

export default function WorkflowsPage() {
  const [view, setView] = useState<"list" | "builder">("list");
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active workflow in builder
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDetail | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDesc, setWorkflowDesc] = useState("");
  const [lockVersion, setLockVersion] = useState(1);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // React Flow state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Available templates for use_template action
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  // Simulator state
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [simText, setSimText] = useState("كم سعر هذا المنتج؟");
  const [simLoading, setSimLoading] = useState(false);
  const [simTrace, setSimTrace] = useState<Array<{ nodeId: string; nodeType: string; status: string; message: string }> | null>(null);

  // New Workflow Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete modal
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWorkflows = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<WorkflowListItem[]>("/api/v1/workflows")
      .then((data) => setWorkflows(data))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "فشل تحميل مسارات الأتمتة"))
      .finally(() => setLoading(false));
  }, []);

  const loadTemplates = useCallback(() => {
    getJson<TemplateOption[]>("/api/v1/templates")
      .then((data) => setTemplates(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getJson<WorkflowListItem[]>("/api/v1/workflows")
      .then((data) => setWorkflows(data))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "فشل تحميل مسارات الأتمتة"))
      .finally(() => setLoading(false));

    getJson<TemplateOption[]>("/api/v1/templates")
      .then((data) => setTemplates(data))
      .catch(() => {});
  }, []);

  const openBuilder = (id: string) => {
    loadTemplates();
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    setSelectedNodeId(null);
    getJson<WorkflowDetail>(`/api/v1/workflows/${id}`)
      .then((data) => {
        setActiveWorkflow(data);
        setWorkflowName(data.name);
        setWorkflowDesc(data.description ?? "");
        setLockVersion(data.lockVersion);

        const def = data.draftDefinition ?? data.publishedDefinition;
        if (def && Array.isArray(def.nodes)) {
          setNodes(
            def.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            })),
          );
          setEdges(
            Array.isArray(def.edges)
              ? def.edges.map((e) => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  sourceHandle: e.sourceHandle ?? undefined,
                  targetHandle: e.targetHandle ?? undefined,
                }))
              : [],
          );
        } else {
          setNodes([]);
          setEdges([]);
        }
        setView("builder");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "فشل تحميل تفاصيل المسار");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await postJson<{ id: string }>("/api/v1/workflows", {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setIsNewModalOpen(false);
      setNewName("");
      setNewDesc("");
      openBuilder(created.id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "فشل إنشاء المسار الجديد");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await delJson(`/api/v1/workflows/${id}`);
      setDeletingId(null);
      loadWorkflows();
      if (activeWorkflow?.id === id) {
        setView("list");
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "فشل حذف المسار");
    } finally {
      setDeleting(false);
    }
  };

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [],
  );

  const currentDefinition: WorkflowDefinition = useMemo(
    () => ({
      schemaVersion: 1,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as WorkflowNodeType,
        position: n.position,
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
      settings: {
        stopOnError: true,
        privateReplyWindowMinutes: 10080,
        dedupeTtlHours: 168,
      },
    }),
    [nodes, edges],
  );

  const validation = useMemo(() => {
    if (view !== "builder" || nodes.length === 0) return { valid: true, errors: [] };
    return validateWorkflowDefinition(currentDefinition, {
      availableTemplateIds: templates.map((t) => t.id),
    });
  }, [view, currentDefinition, templates, nodes.length]);

  const handleSaveDraft = async () => {
    if (!activeWorkflow) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await putJson<{ lockVersion: number }>(`/api/v1/workflows/${activeWorkflow.id}`, {
        name: workflowName.trim(),
        description: workflowDesc.trim() || null,
        definition: currentDefinition,
        lockVersion,
      });
      setLockVersion(res.lockVersion);
      setStatusMessage({ type: "success", text: "تم حفظ المسودة بنجاح." });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "فشل حفظ المسودة",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!activeWorkflow) return;
    setPublishing(true);
    setStatusMessage(null);
    try {
      const pubRes = await postJson<{ workflow: { currentVersion: number; status: string; lockVersion: number } }>(
        `/api/v1/workflows/${activeWorkflow.id}/publish`,
        {
          name: workflowName.trim(),
          description: workflowDesc.trim() || undefined,
          definition: currentDefinition,
        },
      );
      setLockVersion(pubRes.workflow.lockVersion);
      setActiveWorkflow((prev) =>
        prev
          ? {
              ...prev,
              name: workflowName.trim(),
              status: "published",
              currentVersion: pubRes.workflow.currentVersion,
              lockVersion: pubRes.workflow.lockVersion,
            }
          : null,
      );
      setStatusMessage({
        type: "success",
        text: `تم نشر المسار بنجاح كإصدار نشط رقم (v${pubRes.workflow.currentVersion})!`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "فشل نشر المسار",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleTogglePause = async () => {
    if (!activeWorkflow) return;
    const isPaused = activeWorkflow.status === "paused";
    const endpoint = isPaused
      ? `/api/v1/workflows/${activeWorkflow.id}/resume`
      : `/api/v1/workflows/${activeWorkflow.id}/pause`;
    try {
      const updated = await postJson<{ status: "draft" | "published" | "paused"; lockVersion: number }>(endpoint, {});
      setLockVersion(updated.lockVersion);
      setActiveWorkflow((prev) => (prev ? { ...prev, status: updated.status } : null));
      setStatusMessage({
        type: "success",
        text: isPaused ? "تم تفعيل المسار واستئناف استقبال الأحداث." : "تم إيقاف المسار مؤقتاً.",
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "فشل تغيير حالة المسار",
      });
    }
  };

  const handleRunSimulation = async () => {
    if (!activeWorkflow || !simText.trim()) return;
    setSimLoading(true);
    setSimTrace(null);
    try {
      const res = await postJson<{
        success: boolean;
        trace: Array<{ nodeId: string; nodeType: string; status: string; message: string }>;
      }>(`/api/v1/workflows/${activeWorkflow.id}/test-run`, {
        commentText: simText.trim(),
      });
      setSimTrace(res.trace);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "فشل إجراء المحاكاة",
      });
    } finally {
      setSimLoading(false);
    }
  };

  const addNode = (type: WorkflowNodeType) => {
    const id = `node-${Date.now().toString(36)}`;
    const newY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.y)) + 120 : 100;
    let initialData: Record<string, unknown> = {};

    switch (type) {
      case "condition.text":
        initialData = { op: "OR", rules: [{ kind: "text_contains", value: "استفسار", caseSensitive: false }] };
        break;
      case "action.public_reply":
        initialData = { message: "أهلاً بك، تم استلام تعليقك وسنقوم بالرد قريباً." };
        break;
      case "action.private_reply":
        initialData = { message: "مرحباً بك! تواصلنا معك بخصوص تعليقك على المنشور." };
        break;
      case "action.use_template":
        initialData = { templateId: templates[0]?.id ?? "", templateName: templates[0]?.name ?? "قالب" };
        break;
      case "action.stop":
        initialData = { reason: "إيقاف المسار" };
        break;
      default:
        initialData = {};
    }

    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: newY },
      data: initialData,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const updateSelectedNodeData = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [key]: value,
            },
          };
        }
        return node;
      }),
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  return (
    <div className="space-y-6">
      {view === "list" ? (
        /* --- LIST VIEW --- */
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">مسارات الأتمتة</h1>
              <p className="mt-1 text-sm text-slate-500">
                بناء وتعديل مسارات الردود التلقائية على التعليقات والرسائل الخاصة بقواعد مطابقة ذكية.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand/90 focus:outline-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              إنشاء مسار جديد
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="text-sm">جاري تحميل مسارات الأتمتة...</p>
              </div>
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-brand">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">لا توجد مسارات أتمتة حتى الآن</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                ابدأ بإنشاء أول مسار رد تلقائي على التعليقات لمنصات فيسبوك وإنستغرام عبر المحرر المرئي.
              </p>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
              >
                إنشاء مسار الآن
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{wf.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          wf.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : wf.status === "paused"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {wf.status === "published" ? "منشور" : wf.status === "paused" ? "متوقف مؤقتاً" : "مسودة"}
                      </span>
                    </div>
                    {wf.description && (
                      <p className="mt-2 text-xs text-slate-500 line-clamp-2">{wf.description}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-50 px-2 py-1 border border-slate-100">
                        الأصل: {wf.asset ? wf.asset.displayName : "كل الصفحات"}
                      </span>
                      {wf.activeVersionNumber !== null && (
                        <span className="rounded-md bg-blue-50 px-2 py-1 font-mono text-brand border border-blue-100">
                          الإصدار v{wf.activeVersionNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">
                      {new Date(wf.updatedAt).toLocaleDateString("ar-EG")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openBuilder(wf.id)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-blue-100 transition"
                      >
                        تعديل المخطط المرئي
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(wf.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* --- VISUAL BUILDER VIEW --- */
        <div className="space-y-4">
          {/* Builder Top Bar */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  loadWorkflows();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-slate-600 hover:bg-slate-50 transition"
                title="العودة للقائمة"
              >
                ←
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    className="font-bold text-foreground text-base border-b border-transparent hover:border-slate-300 focus:border-brand outline-none bg-transparent"
                  />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      activeWorkflow?.status === "published"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : activeWorkflow?.status === "paused"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {activeWorkflow?.status === "published"
                      ? `منشور (v${activeWorkflow.currentVersion})`
                      : activeWorkflow?.status === "paused"
                      ? "متوقف مؤقتاً"
                      : "مسودة"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">انقر على أي عقدة لتعديل إعداداتها، واسحب النقاط لتوصيل المسارات.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSimOpen(true)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-blue-100 transition"
              >
                اختبار ومحاكاة
              </button>
              {activeWorkflow?.status === "published" || activeWorkflow?.status === "paused" ? (
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    activeWorkflow.status === "paused"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                  }`}
                >
                  {activeWorkflow.status === "paused" ? "استئناف المسار" : "إيقاف مؤقت"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDraft}
                className="rounded-xl border border-border bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
              >
                {saving ? "جاري الحفظ..." : "حفظ مسودة"}
              </button>
              <button
                type="button"
                disabled={publishing || !validation.valid}
                onClick={handlePublish}
                className="rounded-xl bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand/90 transition disabled:opacity-50"
              >
                {publishing ? "جاري النشر..." : "نشر المسار الآن"}
              </button>
            </div>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`rounded-xl border p-3 text-sm flex items-center justify-between ${
                statusMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-xs opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Validation Banner */}
          {!validation.valid && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span className="font-bold block mb-1">تنبيهات التحقق قبل النشر:</span>
              <ul className="list-disc list-inside space-y-0.5">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Visual Workspace: Canvas + Inspector Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[600px] h-[calc(100vh-250px)]">
            {/* Canvas */}
            <div className="lg:col-span-3 rounded-2xl border border-border bg-slate-50 relative overflow-hidden shadow-inner">
              {/* Palette floating buttons */}
              <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-1.5 bg-white/90 p-1.5 rounded-xl border border-border shadow-sm backdrop-blur-xs">
                <span className="text-[11px] font-semibold text-slate-500 self-center px-1">إضافة عقدة:</span>
                <button
                  type="button"
                  onClick={() => addNode("condition.text")}
                  className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition border border-purple-200"
                >
                  + شرط نصي
                </button>
                <button
                  type="button"
                  onClick={() => addNode("action.public_reply")}
                  className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition border border-emerald-200"
                >
                  + رد عام
                </button>
                <button
                  type="button"
                  onClick={() => addNode("action.private_reply")}
                  className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition border border-sky-200"
                >
                  + رد خاص
                </button>
                <button
                  type="button"
                  onClick={() => addNode("action.use_template")}
                  className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition border border-indigo-200"
                >
                  + استخدام قالب
                </button>
                <button
                  type="button"
                  onClick={() => addNode("action.stop")}
                  className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition border border-red-200"
                >
                  + إيقاف
                </button>
              </div>

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={workflowNodeTypes}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                fitView
              >
                <Background color="#cbd5e1" gap={16} />
                <Controls />
              </ReactFlow>
            </div>

            {/* Inspector Sidebar */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between overflow-y-auto">
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-sm text-foreground">خصائص العقدة المحددة</h3>
                    <span className="text-xs font-mono text-slate-400">{selectedNode.id}</span>
                  </div>

                  {selectedNode.type === "trigger.comment" && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">المنصة المستهدفة</label>
                        <select
                          value={(selectedNode.data.platform as string) ?? "all"}
                          onChange={(e) => updateSelectedNodeData("platform", e.target.value)}
                          className="w-full rounded-xl border border-border bg-white p-2 text-xs outline-none focus:border-brand"
                        >
                          <option value="all">كل المنصات (فيسبوك وإنستغرام)</option>
                          <option value="facebook">فيسبوك فقط</option>
                          <option value="instagram">إنستغرام فقط</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === "condition.text" && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">نوع المطابقة الشرطية</label>
                        <select
                          value={(selectedNode.data.op as string) ?? "OR"}
                          onChange={(e) => updateSelectedNodeData("op", e.target.value)}
                          className="w-full rounded-xl border border-border bg-white p-2 text-xs outline-none focus:border-brand"
                        >
                          <option value="OR">تحقق أي كلمة (أو - OR)</option>
                          <option value="AND">تحقق كل الكلمات (معاً - AND)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">الكلمة المفتاحية للبحث</label>
                        <input
                          type="text"
                          value={
                            ((selectedNode.data.rules as Array<{ value: string }>)?.[0]?.value as string) ?? ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            updateSelectedNodeData("rules", [
                              { kind: "text_contains", value: val, caseSensitive: false },
                            ]);
                          }}
                          placeholder="مثال: سعر، تفاصيل، أريد الشراء"
                          className="w-full rounded-xl border border-border bg-white p-2 text-xs outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedNode.type === "action.public_reply" || selectedNode.type === "action.private_reply") && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          {selectedNode.type === "action.public_reply" ? "نص الرد العام" : "نص الرسالة الخاصة"}
                        </label>
                        <textarea
                          rows={4}
                          value={(selectedNode.data.message as string) ?? ""}
                          onChange={(e) => updateSelectedNodeData("message", e.target.value)}
                          placeholder="اكتب نص الرد هنا..."
                          className="w-full rounded-xl border border-border bg-white p-2.5 text-xs outline-none focus:border-brand resize-none"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-[11px] font-medium text-slate-500">إدراج متغير:</span>
                        <div className="flex flex-wrap gap-1">
                          {ALLOW_LISTED_VARIABLES.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                const current = (selectedNode.data.message as string) ?? "";
                                updateSelectedNodeData("message", `${current} {{${v}}} `);
                              }}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 hover:bg-blue-50 hover:text-brand"
                              dir="ltr"
                            >
                              {`{{${v}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === "action.use_template" && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">اختر القالب</label>
                        {templates.length === 0 ? (
                          <p className="text-xs text-amber-600">لا توجد قوالب محفوظة. أنشئ قالباً من صفحة القوالب أولاً.</p>
                        ) : (
                          <select
                            value={(selectedNode.data.templateId as string) ?? ""}
                            onChange={(e) => {
                              const tid = e.target.value;
                              const tname = templates.find((t) => t.id === tid)?.name ?? "قالب";
                              updateSelectedNodeData("templateId", tid);
                              updateSelectedNodeData("templateName", tname);
                            }}
                            className="w-full rounded-xl border border-border bg-white p-2 text-xs outline-none focus:border-brand"
                          >
                            <option value="">-- اختر قالباً --</option>
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === "action.stop" && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">سبب الإيقاف</label>
                        <input
                          type="text"
                          value={(selectedNode.data.reason as string) ?? "تم الإيقاف"}
                          onChange={(e) => updateSelectedNodeData("reason", e.target.value)}
                          className="w-full rounded-xl border border-border bg-white p-2 text-xs outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <button
                      type="button"
                      disabled={selectedNode.type === "trigger.comment"}
                      onClick={deleteSelectedNode}
                      className="w-full rounded-xl border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-40"
                    >
                      حذف هذه العقدة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center p-4 text-slate-400">
                  <svg className="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p className="text-xs">اضغط على أي عقدة في اللوحة لعرض وتعديل خصائصها هنا.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {isSimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="text-lg font-semibold text-foreground">اختبار ومحاكاة المسار التجريبي</h2>
              <button
                type="button"
                onClick={() => setIsSimOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                يقوم هذا الاختبار بمحاكاة وصول تعليق افتراضي وتتبع حركة المسار وفحص الشروط دون إرسال أي طلبات إلى فيسبوك أو إنستغرام.
              </p>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">نص التعليق التجريبي</label>
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="مثال: كم السعر؟ أو هل التوصيل متوفر؟"
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm outline-none transition focus:border-brand"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={simLoading || !simText.trim()}
                  onClick={handleRunSimulation}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/90 transition disabled:opacity-60"
                >
                  {simLoading ? "جاري المحاكاة..." : "تشغيل المحاكاة"}
                </button>
              </div>

              {simTrace && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <span className="block text-xs font-bold text-slate-700 mb-2">تسلسل التنفيذ بالمحاكاة:</span>
                  {simTrace.map((step, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg p-2.5 text-xs flex items-start gap-2 border ${
                        step.status === "passed" || step.status === "executed"
                          ? "bg-white border-emerald-200 text-slate-800"
                          : "bg-white border-red-200 text-red-800"
                      }`}
                    >
                      <span className="font-bold text-[10px] uppercase rounded px-1.5 py-0.5 bg-slate-100 text-slate-600">
                        {step.nodeType}
                      </span>
                      <span className="flex-1">{step.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Workflow Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="text-lg font-semibold text-foreground">إنشاء مسار أتمتة جديد</h2>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNew} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">اسم المسار</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: الرد التلقائي على استفسارات الأسعار"
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm outline-none transition focus:border-brand"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">الوصف (اختياري)</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="اكتب وصفاً موجزاً للهدف من هذا المسار..."
                  className="w-full rounded-xl border border-border bg-white p-3 text-sm outline-none transition focus:border-brand resize-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90 transition disabled:opacity-60"
                >
                  {creating ? "جاري الإنشاء..." : "إنشاء وبدء التصميم"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">تأكيد حذف المسار</h3>
            <p className="mt-2 text-sm text-slate-500">
              هل أنت متأكد من رغبتك في حذف مسار الأتمتة هذا؟ سيتم حذف جميع مسوداته وإصداراته السابقة.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deletingId)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-60"
              >
                {deleting ? "جاري الحذف..." : "نعم، حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
