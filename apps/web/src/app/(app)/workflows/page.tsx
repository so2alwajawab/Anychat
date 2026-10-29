"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
  validateWorkflowDefinition,
  type MatchKind,
  type WorkflowDefinition,
  type WorkflowNodeType,
} from "@anychat/shared";
import { ApiError, delJson, getJson, postJson, putJson } from "@/lib/api";
import { workflowNodeTypes } from "@/components/workflow/custom-nodes";
import { type FlowTemplate } from "@/components/workflow/flow-templates";
import { autoLayoutNodes } from "@/components/workflow/auto-layout";
import { PhonePreview } from "@/components/workflow/phone-preview";
import { VariablePillList } from "@/components/common/variable-pill";
import { NegativeKeywordInput } from "@/components/common/negative-keyword-input";
import { ActionButtonsManager, type ActionButtonItem } from "@/components/common/action-button";
import { SelectPostModal } from "@/components/workflow/select-post-modal";
import { EditButtonModal } from "@/components/workflow/edit-button-modal";

const FlowTemplatesModal = dynamic(
  () => import("@/components/workflow/flow-templates-modal").then((m) => m.FlowTemplatesModal),
  { ssr: false }
);

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

interface ContentPostItem {
  id: string;
  assetId: string;
  assetName: string;
  platform: "facebook" | "instagram";
  externalId: string;
  messagePreview: string | null;
  permalink: string | null;
  isEligibleForReply: boolean;
  createdTime: string;
  commentsCount: number;
}

const KEYWORD_PRESETS = [
  {
    category: "استفسارات الأسعار",
    icon: "💰",
    words: ["سعر", "بكام", "تكلفة", "السعر", "price"],
  },
  {
    category: "الطلب والشراء",
    icon: "🛒",
    words: ["طلب", "شراء", "حجز", "اوردر", "order"],
  },
  {
    category: "الفروع والعنوان",
    icon: "📍",
    words: ["عنوان", "المكان", "الفروع", "لوكيشن", "location"],
  },
  {
    category: "الشحن والتوصيل",
    icon: "🚚",
    words: ["شحن", "توصيل", "مصاريف الشحن", "shipping"],
  },
];

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

  // Content Posts & Post Picker State
  const [contentPosts, setContentPosts] = useState<ContentPostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isPostPickerOpen, setIsPostPickerOpen] = useState(false);
  const [postSearch, setPostSearch] = useState("");
  const [postPlatformFilter, setPostPlatformFilter] = useState<"all" | "facebook" | "instagram">("all");

  // Advanced Workflow Features: Templates Modal, Sidebar Tabs, Negative Keywords & Action Buttons
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"inspector" | "phone">("inspector");

  // Post & Customer Metadata (Custom Image & Name)
  const [customCustomerName, setCustomCustomerName] = useState("أحمد محمود");
  const [postImageUrl, setPostImageUrl] = useState<string>("");
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const handlePostImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPostImageUrl(dataUrl);
      try {
        setIsSavingMetadata(true);
        await postJson("/api/post/metadata", {
          postId: activeWorkflow?.assetId || "default",
          customerName: customCustomerName,
          imageUrl: dataUrl,
        });
      } catch {
        // Fallback: preview still works
      } finally {
        setIsSavingMetadata(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomerName = async (name: string) => {
    setCustomCustomerName(name);
    try {
      await postJson("/api/post/metadata", {
        postId: activeWorkflow?.assetId || "default",
        customerName: name,
        imageUrl: postImageUrl,
      });
    } catch {
      // preview updated
    }
  };

  // Keyword input state in Condition Inspector
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [newKeywordKind, setNewKeywordKind] = useState<MatchKind>("text_contains");

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

  const loadContentPosts = useCallback(() => {
    setPostsLoading(true);
    getJson<{ items: ContentPostItem[] }>("/api/v1/content/posts?limit=50")
      .then((data) => setContentPosts(data.items || []))
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getJson<WorkflowListItem[]>("/api/v1/workflows")
      .then((data) => {
        if (!cancelled) setWorkflows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "فشل تحميل مسارات الأتمتة");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    getJson<TemplateOption[]>("/api/v1/templates")
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {});

    getJson<{ items: ContentPostItem[] }>("/api/v1/content/posts?limit=50")
      .then((data) => {
        if (!cancelled) setContentPosts(data.items || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const openBuilder = (id: string) => {
    loadTemplates();
    loadContentPosts();
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
      case "trigger.comment":
        initialData = {
          platform: "all",
          assetIds: [],
          postScope: { mode: "all", postExternalIds: [] },
          includeReplies: false,
        };
        break;
      case "condition.text":
        initialData = { op: "OR", rules: [{ kind: "text_contains", value: "سعر", caseSensitive: false }] };
        break;
      case "action.public_reply":
        initialData = { message: "أهلاً بك {{commenter_name}}، تم استلام تعليقك وسنقوم بمساعدتك فوراً!" };
        break;
      case "action.private_reply":
        initialData = { message: "مرحباً {{commenter_name}}! تواصلنا معك في الخاص بخصوص استفسارك عن المنشور." };
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

  const handleApplyTemplate = (tpl: FlowTemplate) => {
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    if (!workflowName || workflowName === "مخطط أتمتة جديد") {
      setWorkflowName(tpl.title);
    }
    if (tpl.description && !workflowDesc) {
      setWorkflowDesc(tpl.description);
    }
    setIsTemplateModalOpen(false);
    setSelectedNodeId(tpl.nodes[0]?.id ?? null);
    setStatusMessage({
      type: "success",
      text: `تم استيراد قالب "${tpl.title}" بنجاح وتجهيزه على اللوحة!`,
    });
  };

  const handleAutoLayout = () => {
    if (nodes.length === 0) return;
    setNodes((currentNodes) => autoLayoutNodes(currentNodes, edges));
    setStatusMessage({
      type: "success",
      text: "تم تنظيم وترتيب العقد تلقائياً بنجاح.",
    });
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
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-brand">
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
                        <span className="rounded-md bg-red-50 px-2 py-1 font-mono text-brand border border-red-100">
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
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-red-100 transition"
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
                aria-label="فتح نافذة قوالب الأتمتة الجاهزة"
                onClick={() => setIsTemplateModalOpen(true)}
                className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-2xs flex items-center gap-1.5 focus:ring-2 focus:ring-purple-400 focus:outline-hidden"
              >
                <span>⚡</span>
                <span>قوالب جاهزة</span>
              </button>

              <button
                type="button"
                aria-label="ترتيب وتنظيم العقد تلقائياً على اللوحة"
                onClick={handleAutoLayout}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1 focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                title="إعادة تنظيم وترتيب العقد تلقائياً"
              >
                <span>🪄</span>
                <span>ترتيب تلقائي</span>
              </button>

              <button
                type="button"
                aria-label="تبديل عرض محاكي الموبايل المباشر"
                onClick={() => setSidebarTab(sidebarTab === "phone" ? "inspector" : "phone")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs flex items-center gap-1 border focus:ring-2 focus:ring-brand focus:outline-hidden ${
                  sidebarTab === "phone"
                    ? "bg-brand text-white border-brand"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>📱</span>
                <span>محاكي الموبايل</span>
              </button>

              <button
                type="button"
                aria-label="اختبار ومحاكاة مسار الأتمتة"
                onClick={() => setIsSimOpen(true)}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-red-100 transition focus:ring-2 focus:ring-red-400 focus:outline-hidden"
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
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:h-[calc(100vh-250px)] lg:min-h-[600px]">
            {/* Canvas */}
            <div className="h-[55vh] min-h-[420px] lg:col-span-7 lg:h-auto xl:col-span-8 rounded-2xl border border-border bg-slate-50 relative overflow-hidden shadow-inner">
              {/* Palette floating buttons */}
              <div className="absolute top-2 right-2 max-w-[calc(100%-1rem)] overflow-x-auto z-10 flex flex-wrap gap-1 bg-white/95 p-1.5 rounded-xl border border-border shadow-sm backdrop-blur-xs">
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

            {/* Inspector Sidebar / Phone Preview */}
            <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Sidebar Tabs Switcher */}
                <div className="flex rounded-xl bg-slate-100 p-1 mb-4 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSidebarTab("inspector")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      sidebarTab === "inspector"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    ⚙️ خصائص العقدة
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("phone")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      sidebarTab === "phone"
                        ? "bg-brand text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    📱 محاكي الموبايل المباشر
                  </button>
                </div>

                {sidebarTab === "phone" ? (
                  /* --- PHONE PREVIEW TAB --- */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">محاكي الموبايل التفاعلي</h3>
                        <p className="text-[11px] text-slate-400">معاينة حية للمنشور والتعليقات ورسائل الخاص</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                        مباشر (Live)
                      </span>
                    </div>

                    <PhonePreview
                      platform={
                        ((nodes.find((n) => n.type === "trigger.comment")?.data.platform as "facebook" | "instagram" | "all") ||
                          "all")
                      }
                      pageName={activeWorkflow?.asset?.displayName || "صفحة المتجر"}
                      commenterName={customCustomerName || "أحمد محمود"}
                      commentText={simText}
                      publicReplyText={
                        (Array.isArray(nodes.find((n) => n.type === "action.public_reply")?.data.messages) &&
                          (nodes.find((n) => n.type === "action.public_reply")?.data.messages as string[])[0]) ||
                        (nodes.find((n) => n.type === "action.public_reply")?.data.message as string) ||
                        "أهلاً بك {{commenter_name}}، بعتنالك كل التفاصيل والأسعار في رسالة خاصة 📩"
                      }
                      publicReplyImage={nodes.find((n) => n.type === "action.public_reply")?.data.imageUrl as string}
                      autoLike={Boolean(nodes.find((n) => n.type === "action.public_reply")?.data.autoLike ?? true)}
                      privateReplyText={
                        (nodes.find((n) => n.type === "action.private_reply")?.data.message as string) ||
                        "أهلاً بك يا {{commenter_name}} في {{page_name}}!\n\nيسعدنا اهتمامك. السعر الحالي يبدأ من 250 جنيهاً مع شحن سريع 🚚."
                      }
                      privateReplyImage={nodes.find((n) => n.type === "action.private_reply")?.data.imageUrl as string}
                      buttons={
                        (Array.isArray(nodes.find((n) => n.type === "action.private_reply")?.data.buttons)
                          ? (nodes.find((n) => n.type === "action.private_reply")?.data.buttons as Array<{
                              id?: string;
                              label: string;
                              type?: "url" | "whatsapp" | "phone";
                              url: string;
                            }>)
                          : []) || []
                      }
                      postPreviewText={
                        contentPosts.find(
                          (p) =>
                            p.externalId ===
                            (
                              nodes.find((n) => n.type === "trigger.comment")?.data.postScope as {
                                postExternalIds?: string[];
                              }
                            )?.postExternalIds?.[0],
                        )?.messagePreview || "أحدث تشكيلة لعام 2026 متوفرة الآن بجميع الفروع والموقع! اطلب الآن عبر التعليقات."
                      }
                      postImage={postImageUrl}
                      onCommentChange={(t) => setSimText(t)}
                    />

                    {/* Simulation Parameters Customizer */}
                    <div className="rounded-2xl border border-border bg-slate-50/70 p-3 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">تخصيص بيانات المحاكاة والمنشور:</span>
                        {isSavingMetadata && (
                          <span className="text-[10px] text-brand animate-pulse">جاري الحفظ…</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1" htmlFor="sim-customer-name">
                          👤 اسم العميل (لتجربة الرد بالاسم):
                        </label>
                        <input
                          id="sim-customer-name"
                          type="text"
                          value={customCustomerName}
                          onChange={(e) => handleSaveCustomerName(e.target.value)}
                          placeholder="مثال: أحمد محمود"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1" htmlFor="sim-post-image">
                          🖼️ رفع صورة للمنشور بالمحاكي:
                        </label>
                        <input
                          id="sim-post-image"
                          type="file"
                          accept="image/*"
                          onChange={handlePostImageUpload}
                          className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ) : selectedNode ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">خصائص العقدة المحددة</h3>
                        <span className="text-xs font-mono text-slate-400">{selectedNode.id}</span>
                      </div>
                      <span className="text-xs rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                        {selectedNode.type}
                      </span>
                    </div>

                    {selectedNode.type === "trigger.comment" && (
                    <div className="space-y-4 text-xs">
                      {/* Platform */}
                      <div>
                        <label className="mb-1.5 block font-bold text-slate-700">المنصة المستهدفة</label>
                        <select
                          value={(selectedNode.data.platform as string) ?? "all"}
                          onChange={(e) => updateSelectedNodeData("platform", e.target.value)}
                          className="w-full rounded-xl border border-border bg-white p-2.5 text-xs outline-none focus:border-brand font-medium"
                        >
                          <option value="all">🌐 كل المنصات (فيسبوك وإنستغرام)</option>
                          <option value="facebook">📘 فيسبوك فقط</option>
                          <option value="instagram">📸 إنستغرام فقط</option>
                        </select>
                      </div>

                      {/* Trigger Match Strategy */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-slate-700">نمط تشغيل الردود (Trigger Matching)</label>
                          <span className="text-[10px] text-slate-400">تحديد شروط البدء</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateSelectedNodeData("matchType", "all_comments")}
                            className={`rounded-xl p-2.5 text-xs font-bold text-start transition border ${
                              (selectedNode.data.matchType as string) === "all_comments"
                                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <span className="block mb-0.5">✨ أي تعليق (All)</span>
                            <span className="block text-[10px] font-normal opacity-90">الرد على جميع التعليقات بلا شرط كلمات</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedNodeData("matchType", "keywords")}
                            className={`rounded-xl p-2.5 text-xs font-bold text-start transition border ${
                              ((selectedNode.data.matchType as string) ?? "keywords") === "keywords"
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <span className="block mb-0.5">🎯 كلمات مفتاحية</span>
                            <span className="block text-[10px] font-normal opacity-90">الرد فقط عند تطابق الكلمات المحددة</span>
                          </button>
                        </div>
                      </div>

                      {/* Post Scope Selection (3 Cards) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-slate-700">نطاق المنشورات المستهدفة</label>
                          <span className="text-[10px] text-slate-400">تحديد نطاق العمل</span>
                        </div>

                        <div className="space-y-2">
                          {/* Card 1: All Posts */}
                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                              ((selectedNode.data.postScope as { mode?: string })?.mode ?? "all") === "all"
                                ? "border-brand bg-red-50/60 ring-1 ring-brand/30"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name="postScopeMode"
                              checked={((selectedNode.data.postScope as { mode?: string })?.mode ?? "all") === "all"}
                              onChange={() =>
                                updateSelectedNodeData("postScope", {
                                  mode: "all",
                                  postExternalIds: [],
                                })
                              }
                              className="mt-0.5 text-brand"
                            />
                            <div>
                              <span className="font-bold text-slate-800 block text-xs">🌐 كل المنشورات (الكل)</span>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                الرد على أي تعليق جديد يرد على كافة المنشورات والريلز الحالية والمستقبلية.
                              </p>
                            </div>
                          </label>

                          {/* Card 2: Specific Posts */}
                          <div
                            className={`flex flex-col gap-2 p-3 rounded-xl border transition ${
                              (selectedNode.data.postScope as { mode?: string })?.mode === "posts"
                                ? "border-brand bg-red-50/60 ring-1 ring-brand/30"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="radio"
                                name="postScopeMode"
                                checked={(selectedNode.data.postScope as { mode?: string })?.mode === "posts"}
                                onChange={() => {
                                  const currentIds =
                                    ((selectedNode.data.postScope as { postExternalIds?: string[] })?.postExternalIds) ?? [];
                                  updateSelectedNodeData("postScope", {
                                    mode: "posts",
                                    postExternalIds: currentIds,
                                  });
                                  if (contentPosts.length === 0) loadContentPosts();
                                }}
                                className="mt-0.5 text-brand"
                              />
                              <div className="flex-1">
                                <span className="font-bold text-slate-800 block text-xs">📌 منشورات محددة من الصفحة</span>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  تفعيل الرد التلقائي حصراً على منشورات أو إعلانات معينة تختارها من الصفحة.
                                </p>
                              </div>
                            </label>

                            {(selectedNode.data.postScope as { mode?: string })?.mode === "posts" && (
                              <div className="mt-2 pt-2 border-t border-red-100/80 space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    loadContentPosts();
                                    setIsPostPickerOpen(true);
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand/90 transition"
                                >
                                  <span>➕ اختيار المنشورات من الصفحة</span>
                                  {(((selectedNode.data.postScope as { postExternalIds?: string[] })?.postExternalIds?.length ?? 0) > 0) && (
                                    <span className="rounded-full bg-white/20 px-2 py-0.2 text-[10px]">
                                      {((selectedNode.data.postScope as { postExternalIds?: string[] })?.postExternalIds?.length)} محدد
                                    </span>
                                  )}
                                </button>

                                {/* Selected posts list */}
                                {(((selectedNode.data.postScope as { postExternalIds?: string[] })?.postExternalIds?.length ?? 0) === 0) ? (
                                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                    ⚠️ لم يتم اختيار أي منشور بعد. اضغط على الزر أعلاه لاختيار منشور واحد على الأقل.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pe-1">
                                    {((selectedNode.data.postScope as { postExternalIds?: string[] })?.postExternalIds ?? []).map(
                                      (extId) => {
                                        const postItem = contentPosts.find((p) => p.externalId === extId);
                                        return (
                                          <div
                                            key={extId}
                                            className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-200 text-[11px] shadow-2xs"
                                          >
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                              <span>{postItem?.platform === "instagram" ? "📸" : "📘"}</span>
                                              <span className="truncate max-w-[170px] text-slate-700 font-medium">
                                                {postItem?.messagePreview || `منشور (${extId.slice(0, 10)}...)`}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              title="إلغاء تحديد هذا المنشور"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const currentIds =
                                                  ((selectedNode.data.postScope as { postExternalIds?: string[] })
                                                    ?.postExternalIds) ?? [];
                                                updateSelectedNodeData("postScope", {
                                                  mode: "posts",
                                                  postExternalIds: currentIds.filter((id) => id !== extId),
                                                });
                                              }}
                                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card 3: Reels Only */}
                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                              (selectedNode.data.postScope as { mode?: string })?.mode === "reels"
                                ? "border-brand bg-red-50/60 ring-1 ring-brand/30"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name="postScopeMode"
                              checked={(selectedNode.data.postScope as { mode?: string })?.mode === "reels"}
                              onChange={() =>
                                updateSelectedNodeData("postScope", {
                                  mode: "reels",
                                  postExternalIds: [],
                                })
                              }
                              className="mt-0.5 text-brand"
                            />
                            <div>
                              <span className="font-bold text-slate-800 block text-xs">🎬 مقاطع الريلز فقط (Reels)</span>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                تشغيل الردود التلقائية على مقاطع الفيديو القصيرة والريلز فقط.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Negative Keywords Component */}
                      <NegativeKeywordInput
                        keywords={(selectedNode.data.excludeKeywords as string[]) || []}
                        onChange={(newKeywords) => updateSelectedNodeData("excludeKeywords", newKeywords)}
                      />

                      {/* Post Customization & Metadata: Customer Name & Image Upload */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <span>🖼️</span>
                            <span>تخصيص بيانات المنشور المستهدف:</span>
                          </label>
                          {isSavingMetadata && (
                            <span className="text-[10px] text-brand animate-pulse">جاري الحفظ…</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          يمكنك رفع صورة للمنشور وتحديد اسم العميل الافتراضي لدمجهما مع رسائل الأتمتة والمحاكاة.
                        </p>
                        <div className="space-y-2 pt-1">
                          <div>
                            <span className="block text-[11px] font-bold text-slate-600 mb-1">اسم العميل:</span>
                            <input
                              type="text"
                              value={customCustomerName}
                              onChange={(e) => handleSaveCustomerName(e.target.value)}
                              placeholder="اسم العميل (مثال: أحمد محمود)"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                            />
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold text-slate-600 mb-1">صورة المنشور أو الإعلان:</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePostImageUpload}
                              className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sub-replies toggle (Track first-level comments only) */}
                      <div className="pt-2 border-t border-border">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!selectedNode.data.includeReplies}
                            onChange={(e) => updateSelectedNodeData("includeReplies", !e.target.checked)}
                            className="rounded border-slate-300 text-brand focus:ring-brand h-4 w-4"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">الرد على التعليقات الرئيسية فقط (Track first-level comments only)</span>
                            <span className="text-[11px] text-slate-500">تجاهل الردود الفرعية على تعليقات العملاء الآخرين</span>
                          </div>
                        </label>
                      </div>

                      {/* Auto-Like Comment Option (Like comments) */}
                      <div className="pt-2 border-t border-border">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedNode.data.autoLike ?? true)}
                            onChange={(e) => updateSelectedNodeData("autoLike", e.target.checked)}
                            className="rounded border-slate-300 text-brand focus:ring-brand h-4 w-4"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">الإعجاب بالتعليقات تلقائياً (Like comments) 👍</span>
                            <span className="text-[11px] text-slate-500">وضع إعجاب فوري من الصفحة على تعليق العميل لزيادة التفاعل</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === "condition.text" && (
                    <div className="space-y-4 text-xs">
                      {/* Logic Operator Pills */}
                      <div>
                        <label className="mb-1.5 block font-bold text-slate-700">طريقة فحص الشروط</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateSelectedNodeData("op", "OR")}
                            className={`rounded-xl py-2 px-3 text-xs font-bold transition border ${
                              ((selectedNode.data.op as string) ?? "OR") === "OR"
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            تحقق أي كلمة (أو - OR)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedNodeData("op", "AND")}
                            className={`rounded-xl py-2 px-3 text-xs font-bold transition border ${
                              selectedNode.data.op === "AND"
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            تحقق كل الكلمات (معاً - AND)
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {((selectedNode.data.op as string) ?? "OR") === "OR"
                            ? "ينتقل المسار للفرع الأخضر (نعم) إذا احتوى التعليق على أي من الكلمات أدناه."
                            : "ينتقل المسار للفرع الأخضر (نعم) فقط إذا احتوى التعليق على جميع الكلمات معاً."}
                        </p>
                      </div>

                      {/* Keywords Tags List */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-slate-700">الكلمات المفتاحية النشطة</label>
                          <span className="text-[10px] font-bold text-purple-700">
                            {((selectedNode.data.rules as Array<{ value: string }>)?.length ?? 0)} كلمة
                          </span>
                        </div>

                        <div className="min-h-16 rounded-xl border border-slate-200 bg-slate-50/70 p-2 flex flex-wrap gap-1.5 items-start">
                          {(((selectedNode.data.rules as Array<{ value: string }>)?.length ?? 0) === 0) ? (
                            <p className="text-[11px] text-slate-400 italic p-1">لا توجد كلمات مفتاحية. أضف كلمات بالأسفل.</p>
                          ) : (
                            ((selectedNode.data.rules as Array<{ kind: string; value: string }>) ?? []).map((rule, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-lg bg-white border border-purple-200 px-2 py-1 text-xs font-bold text-purple-900 shadow-2xs"
                              >
                                <span>{rule.value}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {rule.kind === "text_exact" ? "تطابق تام" : rule.kind === "text_excludes" ? "استبعاد" : "تحتوي"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentRules = (selectedNode.data.rules as Array<{ kind: string; value: string }>) || [];
                                    const updated = currentRules.filter((_, i) => i !== idx);
                                    updateSelectedNodeData("rules", updated);
                                  }}
                                  className="ms-1 text-slate-400 hover:text-red-600 font-bold"
                                >
                                  ✕
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Add Keyword Input Bar */}
                      <div className="space-y-2 rounded-xl bg-purple-50/50 p-3 border border-purple-100">
                        <span className="block font-bold text-slate-700 text-xs">إضافة كلمة مفتاحية جديدة:</span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newKeywordInput}
                            onChange={(e) => setNewKeywordInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newKeywordInput.trim()) {
                                e.preventDefault();
                                const currentRules =
                                  (selectedNode.data.rules as Array<{ kind: MatchKind; value: string; caseSensitive: boolean }>) || [];
                                const val = newKeywordInput.trim();
                                if (!currentRules.some((r) => r.value.toLowerCase() === val.toLowerCase())) {
                                  updateSelectedNodeData("rules", [
                                    ...currentRules,
                                    { kind: newKeywordKind, value: val, caseSensitive: false },
                                  ]);
                                }
                                setNewKeywordInput("");
                              }
                            }}
                            placeholder="اكتب الكلمة واضغط Enter..."
                            className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-xs outline-none focus:border-brand"
                          />
                          <select
                            value={newKeywordKind}
                            onChange={(e) => setNewKeywordKind(e.target.value as MatchKind)}
                            className="rounded-xl border border-border bg-white px-2 py-2 text-xs outline-none focus:border-brand"
                          >
                            <option value="text_contains">تحتوي على</option>
                            <option value="text_exact">تطابق تام</option>
                            <option value="text_excludes">لا تحتوي على</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newKeywordInput.trim()) return;
                              const currentRules =
                                (selectedNode.data.rules as Array<{ kind: MatchKind; value: string; caseSensitive: boolean }>) || [];
                              const val = newKeywordInput.trim();
                              if (!currentRules.some((r) => r.value.toLowerCase() === val.toLowerCase())) {
                                updateSelectedNodeData("rules", [
                                  ...currentRules,
                                  { kind: newKeywordKind, value: val, caseSensitive: false },
                                ]);
                              }
                              setNewKeywordInput("");
                            }}
                            className="rounded-xl bg-purple-600 px-3 py-2 font-bold text-white hover:bg-purple-700 transition"
                          >
                            + إضافة
                          </button>
                        </div>
                      </div>

                      {/* 1-Click Keyword Presets */}
                      <div>
                        <span className="mb-1.5 block font-bold text-slate-700 text-xs">نماذج كلمات جاهزة بضغطة زر:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {KEYWORD_PRESETS.map((preset) => (
                            <button
                              key={preset.category}
                              type="button"
                              onClick={() => {
                                const currentRules =
                                  (selectedNode.data.rules as Array<{ kind: MatchKind; value: string; caseSensitive: boolean }>) || [];
                                const newRules = [...currentRules];
                                for (const word of preset.words) {
                                  if (!newRules.some((r) => r.value.toLowerCase() === word.toLowerCase())) {
                                    newRules.push({ kind: "text_contains", value: word, caseSensitive: false });
                                  }
                                }
                                updateSelectedNodeData("rules", newRules);
                              }}
                              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 text-start text-[11px] font-semibold text-slate-700 hover:border-purple-300 hover:bg-purple-50 transition"
                            >
                              <span>{preset.icon}</span>
                              <span>{preset.category}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PUBLIC REPLY INSPECTOR */}
                  {selectedNode.type === "action.public_reply" && (
                    <div className="space-y-4 text-xs">
                      {/* Multi-Reply Variations Banner */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span>🎲</span>
                            <span>تنويع الردود العشوائي (حماية ضد حظر ميتا)</span>
                          </span>
                          <span className="rounded-full bg-emerald-200/70 text-emerald-900 px-2 py-0.2 text-[10px] font-bold">
                            ميزة متقدمة
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          أضف عدة صيغ مختلفة للرد العام، وسيختار النظام عشوائياً صيغة لكل عميل لتجنب حظر التكرار في فيسبوك وإنستغرام.
                        </p>
                      </div>

                      {/* Multi-messages editor */}
                      <div className="space-y-3">
                        {(() => {
                          const currentMessages: string[] =
                            Array.isArray(selectedNode.data.messages) && selectedNode.data.messages.length > 0
                              ? (selectedNode.data.messages as string[])
                              : selectedNode.data.message
                              ? [selectedNode.data.message as string]
                              : ["أهلاً بك {{commenter_name}}، تم الرد على استفسارك بنجاح!"];

                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-slate-700">
                                  صيغ الردود العامة ({currentMessages.length})
                                </label>
                                {currentMessages.length < 5 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newVariation = `يا هلا بك يا {{commenter_name}}، تواصلنا معك في الخاص فوراً ✨`;
                                      const updated = [...currentMessages, newVariation];
                                      updateSelectedNodeData("messages", updated);
                                      updateSelectedNodeData("message", updated[0]);
                                    }}
                                    className="text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center gap-1"
                                  >
                                    <span>➕ إضافة صيغة رد بديلة</span>
                                  </button>
                                )}
                              </div>

                              {currentMessages.map((msg, idx) => (
                                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                                      صيغة الرد رقم #{idx + 1}
                                    </span>
                                    {currentMessages.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = currentMessages.filter((_, i) => i !== idx);
                                          updateSelectedNodeData("messages", updated);
                                          updateSelectedNodeData("message", updated[0] || "");
                                        }}
                                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                                        title="حذف هذه الصيغة"
                                      >
                                        ✕ حذف
                                      </button>
                                    )}
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={msg}
                                    onChange={(e) => {
                                      const updated = [...currentMessages];
                                      updated[idx] = e.target.value;
                                      updateSelectedNodeData("messages", updated);
                                      if (idx === 0) updateSelectedNodeData("message", e.target.value);
                                    }}
                                    placeholder="اكتب نص الرد..."
                                    className="w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-brand resize-none leading-relaxed"
                                  />
                                  <div className="pt-1">
                                    <VariablePillList
                                      title=""
                                      subtitle=""
                                      variant="compact"
                                      onSelect={(key) => {
                                        const updated = [...currentMessages];
                                        updated[idx] = `${updated[idx]} {{${key}}} `;
                                        updateSelectedNodeData("messages", updated);
                                        if (idx === 0) updateSelectedNodeData("message", updated[idx]);
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>

                      {/* Auto-Like Comment Toggle */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedNode.data.autoLike ?? true)}
                            onChange={(e) => updateSelectedNodeData("autoLike", e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">👍 إعجاب تلقائي بتعليق العميل (Auto-Like)</span>
                            <span className="text-[11px] text-slate-500">وضع إعجاب على تعليق العميل لزيادة التفاعل العضوي للمنشور</span>
                          </div>
                        </label>
                      </div>

                      {/* Image Attachment (Direct File Upload & URL fallback) */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <span>🖼️</span>
                            <span>إرفاق صورة مع الرد العام (اختياري)</span>
                          </label>
                          {(selectedNode.data.imageUrl as string) && (
                            <button
                              type="button"
                              onClick={() => updateSelectedNodeData("imageUrl", undefined)}
                              className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              ✕ إزالة الصورة
                            </button>
                          )}
                        </div>

                        {/* Direct File Upload Button */}
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-brand cursor-pointer transition">
                            <span>📁 رفع صورة من جهازك</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  updateSelectedNodeData("imageUrl", reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        </div>

                        {(selectedNode.data.imageUrl as string) && (
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedNode.data.imageUrl as string}
                              alt="معاينة الصورة المرفقة"
                              className="h-28 w-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PRIVATE REPLY INSPECTOR */}
                  {selectedNode.type === "action.private_reply" && (
                    <div className="space-y-4 text-xs">
                      {/* Message Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-slate-700">نص الرسالة الخاصة (Direct / Messenger)</label>
                          <span className="text-[11px] font-mono text-slate-400">
                            {((selectedNode.data.message as string) ?? "").length} حرف
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={(selectedNode.data.message as string) ?? ""}
                          onChange={(e) => updateSelectedNodeData("message", e.target.value)}
                          placeholder="اكتب رسالة الترحيب أو تفاصيل العرض هنا..."
                          className="w-full rounded-xl border border-border bg-white p-3 text-xs outline-none focus:border-brand resize-none leading-relaxed"
                        />
                      </div>

                      {/* Arabic Variable Pills */}
                      <VariablePillList
                        onSelect={(key) => {
                          const current = (selectedNode.data.message as string) ?? "";
                          updateSelectedNodeData("message", `${current} {{${key}}} `);
                        }}
                      />

                      {/* Image Attachment (Direct File Upload) */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <span>🖼️</span>
                            <span>إرفاق صورة أو بروشور بالرسالة (اختياري)</span>
                          </label>
                          {(selectedNode.data.imageUrl as string) && (
                            <button
                              type="button"
                              onClick={() => updateSelectedNodeData("imageUrl", undefined)}
                              className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              ✕ إزالة الصورة
                            </button>
                          )}
                        </div>

                        {/* Direct File Upload Button */}
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-brand cursor-pointer transition">
                            <span>📁 رفع صورة من جهازك</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  updateSelectedNodeData("imageUrl", reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        </div>

                        {(selectedNode.data.imageUrl as string) && (
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedNode.data.imageUrl as string}
                              alt="معاينة الصورة"
                              className="h-28 w-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* Content Blocks: Delay & Typing indicator simulation */}
                      <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <span>⏱️</span>
                            <span>محاكاة الكتابة والتأخير (Typing delay)</span>
                          </label>
                          <span className="text-[11px] font-bold text-purple-700 font-mono">
                            {Number(selectedNode.data.delaySeconds ?? 0)} ثواني
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="15"
                          step="1"
                          value={Number(selectedNode.data.delaySeconds ?? 0)}
                          onChange={(e) => updateSelectedNodeData("delaySeconds", Number(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>0 ثواني (فوري)</span>
                          <span>3 ثواني (طبيعي)</span>
                          <span>15 ثانية</span>
                        </div>
                      </div>

                      {/* Interactive Action Buttons Manager */}
                      <ActionButtonsManager
                        buttons={
                          (Array.isArray(selectedNode.data.buttons)
                            ? (selectedNode.data.buttons as ActionButtonItem[])
                            : []) || []
                        }
                        onChange={(newButtons) => updateSelectedNodeData("buttons", newButtons)}
                      />
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
        </div>
      )}

      {/* Post Picker Modal */}
      {isPostPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">اختيار المنشورات المستهدفة للأتمتة</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  حدد المنشورات التي ترغب في تشغيل هذا المسار للرد على تعليقاتها فقط.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPostPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
                placeholder="ابحث في نص أو وصف المنشور..."
                className="flex-1 rounded-xl border border-border bg-white px-3.5 py-2 text-xs outline-none focus:border-brand"
              />
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPostPlatformFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    postPlatformFilter === "all" ? "bg-white text-brand shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setPostPlatformFilter("facebook")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    postPlatformFilter === "facebook" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📘 فيسبوك
                </button>
                <button
                  type="button"
                  onClick={() => setPostPlatformFilter("instagram")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    postPlatformFilter === "instagram" ? "bg-white text-purple-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📸 إنستغرام
                </button>
              </div>
            </div>

            {/* Posts List */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pe-1 min-h-[250px]">
              {postsLoading ? (
                <div className="flex h-48 items-center justify-center text-slate-400 text-xs">
                  جاري تحميل منشورات صفحتك...
                </div>
              ) : contentPosts.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400 text-xs p-6">
                  <span className="text-2xl mb-2">📭</span>
                  <p className="font-semibold text-slate-600">لا توجد منشورات متزامنة حالياً</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    تأكد من مزامنة منشورات صفحتك من صفحة المحتوى، أو اختر خيار &ldquo;كل المنشورات&rdquo;.
                  </p>
                </div>
              ) : (
                (() => {
                  const filteredPosts = contentPosts.filter((p) => {
                    if (postPlatformFilter !== "all" && p.platform !== postPlatformFilter) return false;
                    if (postSearch.trim()) {
                      const q = postSearch.trim().toLowerCase();
                      const text = (p.messagePreview || "").toLowerCase();
                      const ext = (p.externalId || "").toLowerCase();
                      if (!text.includes(q) && !ext.includes(q)) return false;
                    }
                    return true;
                  });

                  if (filteredPosts.length === 0) {
                    return (
                      <div className="text-center p-8 text-xs text-slate-400">
                        لا توجد منشورات تطابق شروط البحث الحالية.
                      </div>
                    );
                  }

                  const currentSelectedIds =
                    ((selectedNode?.data.postScope as { postExternalIds?: string[] })?.postExternalIds) ?? [];

                  return filteredPosts.map((post) => {
                    const isSelected = currentSelectedIds.includes(post.externalId);
                    return (
                      <div
                        key={post.id}
                        onClick={() => {
                          const newIds = isSelected
                            ? currentSelectedIds.filter((id) => id !== post.externalId)
                            : [...currentSelectedIds, post.externalId];
                          updateSelectedNodeData("postScope", {
                            mode: "posts",
                            postExternalIds: newIds,
                          });
                        }}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? "border-brand bg-red-50/70 ring-1 ring-brand/30"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-xs text-slate-700">
                              {post.platform === "facebook" ? "📘 فيسبوك" : "📸 إنستغرام"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(post.createdTime).toLocaleDateString("ar-EG")}
                            </span>
                            {post.commentsCount > 0 && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] text-slate-600 font-semibold">
                                💬 {post.commentsCount} تعليق
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-800 line-clamp-2 leading-relaxed">
                            {post.messagePreview || "(منشور بدون نص أو وسائط فقط)"}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">ID: {post.externalId}</span>
                            {post.permalink && (
                              <a
                                href={post.permalink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-brand hover:underline"
                              >
                                🔗 عرض المنشور
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs font-semibold text-slate-600">
                تم تحديد:{" "}
                <strong className="text-brand">
                  {((selectedNode?.data.postScope as { postExternalIds?: string[] })?.postExternalIds?.length ?? 0)}
                </strong>{" "}
                منشور
              </span>
              <button
                type="button"
                onClick={() => setIsPostPickerOpen(false)}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand/90 transition shadow-xs"
              >
                تأكيد المنشورات المحددة
              </button>
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

      {/* Flow Templates Modal */}
      <FlowTemplatesModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* Select Post Modal */}
      <SelectPostModal
        isOpen={isPostPickerOpen}
        onClose={() => setIsPostPickerOpen(false)}
        selectedExternalId={
          ((selectedNode?.data?.postScope as { postExternalIds?: string[] })?.postExternalIds?.[0]) || ""
        }
        onSelectPost={(post) => {
          if (selectedNode) {
            updateSelectedNodeData("postScope", {
              mode: "posts",
              postExternalIds: [post.externalId],
            });
          }
        }}
      />

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
