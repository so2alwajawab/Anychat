"use client";

import React, { useState, useEffect } from "react";
import { getJson } from "@/lib/api";

export interface PostItem {
  id: string;
  externalId: string;
  messagePreview?: string;
  createdTime: string;
  permalink?: string;
  platform?: string;
  asset?: {
    id: string;
    displayName: string;
    platform: string;
  };
}

interface SelectPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPost: (post: { id: string; externalId: string; title: string }) => void;
  selectedExternalId?: string;
}

export function SelectPostModal({
  isOpen,
  onClose,
  onSelectPost,
  selectedExternalId,
}: SelectPostModalProps) {
  const [tab, setTab] = useState<"published" | "custom">("published");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customId, setCustomId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getJson<{ items: PostItem[] }>("/api/v1/content/posts?limit=30")
      .then((res) => {
        setPosts(res.items || []);
      })
      .catch(() => {
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredPosts = posts.filter((p) =>
    search ? (p.messagePreview || "").toLowerCase().includes(search.toLowerCase()) || p.externalId.includes(search) : true
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-border bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-slate-50/80 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">
              تحديد منشور لتشغيل الأتمتة (Select a post)
            </h2>
            <p className="text-xs text-slate-500">
              اختر المنشور المطلوب تشغيل الردود التلقائية عليه أو أدخل المعرف يدوياً
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-slate-50 px-6 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab("published")}
            className={`py-3 border-b-2 transition cursor-pointer ${
              tab === "published"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            المنشورات الحالية (Published Posts)
          </button>
          <button
            type="button"
            onClick={() => setTab("custom")}
            className={`py-3 border-b-2 transition cursor-pointer ${
              tab === "custom"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            معرّف أو رابط مخصص (Custom URL or ID)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "published" ? (
            <div className="space-y-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في نص المنشور أو المعرف..."
                className="w-full rounded-xl border border-border bg-slate-50 px-3.5 py-2 text-xs outline-none focus:border-brand focus:bg-white"
              />

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  جارٍ تحميل المنشورات من حساباتك...
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <span className="text-3xl block">📭</span>
                  <p className="text-xs font-semibold text-slate-600">لا توجد منشورات متزامنة بعد</p>
                  <p className="text-[11px] text-slate-400">
                    يمكنك مزامنة المنشورات من صفحة المحتوى أو استخدام تبويب &ldquo;معرّف مخصص&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredPosts.map((post) => {
                    const isSelected = selectedExternalId === post.externalId;
                    return (
                      <div
                        key={post.id}
                        onClick={() => {
                          onSelectPost({
                            id: post.id,
                            externalId: post.externalId,
                            title: post.messagePreview?.slice(0, 50) || `منشور #${post.externalId}`,
                          });
                          onClose();
                        }}
                        className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? "border-brand bg-brand/5 ring-1 ring-brand"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
                            {post.asset?.platform === "instagram" ? "📸" : "📘"}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-2">
                              {post.messagePreview || `منشور برقم ${post.externalId}`}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>{post.asset?.displayName || "الصفحة"}</span>
                              <span>•</span>
                              <span>{new Date(post.createdTime).toLocaleDateString("ar-EG")}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition shrink-0 ${
                            isSelected
                              ? "bg-brand text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {isSelected ? "محدد ✓" : "اختيار"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-800 leading-relaxed">
                💡 يمكنك نسخ معرّف المنشور (Post ID) أو رابطه المباشر من فيسبوك أو إنستغرام لربطه بالأتمتة مباشرة.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  معرّف المنشور (Post ID أو Link)
                </label>
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value.trim())}
                  placeholder="مثال: 1234567890123456"
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand"
                  dir="ltr"
                />
              </div>

              <button
                type="button"
                disabled={!customId}
                onClick={() => {
                  onSelectPost({
                    id: customId,
                    externalId: customId,
                    title: `منشور مخصص (${customId})`,
                  });
                  onClose();
                }}
                className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white hover:bg-brand/90 transition disabled:opacity-50 cursor-pointer"
              >
                تأكيد اختيار المنشور
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
