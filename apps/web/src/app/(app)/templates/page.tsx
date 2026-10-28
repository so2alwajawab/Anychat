"use client";

import { useCallback, useEffect, useState } from "react";
import { ALLOW_LISTED_VARIABLES } from "@anychat/shared";
import { ApiError, delJson, getJson, postJson, putJson } from "@/lib/api";

interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  allowedVariables: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<MessageTemplate[]>("/api/v1/templates")
      .then((data) => {
        setTemplates(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "فشل تحميل القوالب");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getJson<MessageTemplate[]>("/api/v1/templates")
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "فشل تحميل القوالب");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName("");
    setBody("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setBody(tpl.body);
    setModalError(null);
    setIsModalOpen(true);
  };

  const insertVariable = (varName: string) => {
    const chipText = `{{${varName}}}`;
    setBody((prev) => `${prev} ${chipText} `);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;

    setSubmitting(true);
    setModalError(null);

    try {
      if (editingTemplate) {
        await putJson(`/api/v1/templates/${editingTemplate.id}`, {
          name: name.trim(),
          body: body.trim(),
        });
      } else {
        await postJson("/api/v1/templates", {
          name: name.trim(),
          body: body.trim(),
        });
      }
      setIsModalOpen(false);
      loadTemplates();
    } catch (err: unknown) {
      setModalError(err instanceof ApiError ? err.message : "فشل حفظ القالب");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await delJson(`/api/v1/templates/${id}`);
      setDeletingId(null);
      loadTemplates();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "فشل حذف القالب");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">قوالب الرسائل</h1>
          <p className="mt-1 text-sm text-slate-500">
            إنشاء وإدارة نصوص الردود الموحدة والمتغيرات الديناميكية لاستخدامها في مسارات الأتمتة.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand/90 focus:outline-none"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إنشاء قالب جديد
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm">جاري تحميل القوالب...</p>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-brand">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground">لا توجد قوالب حتى الآن</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            أنشئ أول قالب لك لاستخدامه في الردود العامة أو الخاصة داخل مسارات الأتمتة.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
          >
            إنشاء قالب الآن
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{tpl.name}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-mono">
                    v{tpl.version}
                  </span>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100">
                  {tpl.body}
                </div>
                {Array.isArray(tpl.allowedVariables) && tpl.allowedVariables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tpl.allowedVariables.map((v) => (
                      <span
                        key={v}
                        className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-mono text-brand border border-red-100"
                        dir="ltr"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  {new Date(tpl.updatedAt).toLocaleDateString("ar-EG")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(tpl)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand hover:bg-red-50 transition"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(tpl.id)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {editingTemplate ? "تعديل القالب" : "إنشاء قالب جديد"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {modalError}
                </div>
              )}

              <div>
                <label htmlFor="tpl-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                  اسم القالب
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: رد الاستفسار عن الأسعار"
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm outline-none transition focus:border-brand"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="tpl-body" className="block text-sm font-medium text-slate-700">
                    نص القالب
                  </label>
                  <span className="text-xs text-slate-400">{body.length} / 2000</span>
                </div>
                <textarea
                  id="tpl-body"
                  required
                  rows={4}
                  maxLength={2000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب نص الرسالة هنا، ويمكنك استخدام المتغيرات بالأسفل..."
                  className="w-full rounded-xl border border-border bg-white p-3 text-sm outline-none transition focus:border-brand resize-none"
                />
              </div>

              {/* Dynamic Variables Inserter */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-500">
                  المتغيرات المتاحة (انقر للإدراج):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALLOW_LISTED_VARIABLES.map((varName) => (
                    <button
                      key={varName}
                      type="button"
                      onClick={() => insertVariable(varName)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono text-slate-700 hover:border-brand hover:bg-red-50 hover:text-brand transition"
                      dir="ltr"
                    >
                      {`+ {{${varName}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90 transition disabled:opacity-60"
                >
                  {submitting ? "جاري الحفظ..." : editingTemplate ? "حفظ التعديلات" : "إنشاء القالب"}
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
            <h3 className="text-base font-semibold text-foreground">تأكيد حذف القالب</h3>
            <p className="mt-2 text-sm text-slate-500">
              هل أنت متأكد من رغبتك في حذف هذا القالب؟ لا يمكن التراجع عن هذا الإجراء.
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
