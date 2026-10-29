"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@anychat/shared";
import { ApiError, getJson, putJson } from "@/lib/api";

interface TrackingSettingsData {
  enabled: boolean;
  facebookPixelId?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  customHeadScripts?: string;
  customBodyScripts?: string;
  updatedAt?: string;
}

export default function AdminTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [enabled, setEnabled] = useState(false);
  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");
  const [googleTagManagerId, setGoogleTagManagerId] = useState("");
  const [tiktokPixelId, setTiktokPixelId] = useState("");
  const [snapchatPixelId, setSnapchatPixelId] = useState("");
  const [customHeadScripts, setCustomHeadScripts] = useState("");
  const [customBodyScripts, setCustomBodyScripts] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getJson<TrackingSettingsData>("/api/v1/admin/tracking")
      .then((data) => {
        if (!alive) return;
        setEnabled(Boolean(data.enabled));
        setFacebookPixelId(data.facebookPixelId || "");
        setGoogleAnalyticsId(data.googleAnalyticsId || "");
        setGoogleTagManagerId(data.googleTagManagerId || "");
        setTiktokPixelId(data.tiktokPixelId || "");
        setSnapchatPixelId(data.snapchatPixelId || "");
        setCustomHeadScripts(data.customHeadScripts || "");
        setCustomBodyScripts(data.customBodyScripts || "");
        if (data.updatedAt) setLastUpdated(data.updatedAt);
      })
      .catch((err: unknown) => {
        if (alive) {
          setStatusMessage({
            type: "error",
            text: err instanceof ApiError ? err.message : UI.admin.tracking.error,
          });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    const payload = {
      enabled,
      facebookPixelId: facebookPixelId.trim(),
      googleAnalyticsId: googleAnalyticsId.trim(),
      googleTagManagerId: googleTagManagerId.trim(),
      tiktokPixelId: tiktokPixelId.trim(),
      snapchatPixelId: snapchatPixelId.trim(),
      customHeadScripts: customHeadScripts.trim(),
      customBodyScripts: customBodyScripts.trim(),
    };

    try {
      await putJson("/api/v1/admin/tracking", payload);
      setStatusMessage({ type: "success", text: UI.admin.tracking.success });
      setLastUpdated(new Date().toISOString());
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : UI.admin.tracking.error,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        جارٍ تحميل إعدادات التتبع والإحصائيات…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin" className="text-xs text-slate-500 hover:text-brand">
            ← العودة للوحة الإدارة
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {UI.admin.tracking.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {UI.admin.tracking.subtitle}
          </p>
        </div>
        {lastUpdated && (
          <span className="text-xs text-slate-400">
            آخر تحديث: {new Date(lastUpdated).toLocaleDateString("ar-EG")}
          </span>
        )}
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`rounded-xl border p-4 text-sm flex items-center justify-between ${
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Master Activation Toggle */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-sm text-foreground block">
                {UI.admin.tracking.enableTracking}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {UI.admin.tracking.enableTrackingDesc}
              </p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand"
            />
          </label>
        </section>

        {/* Ad Platforms Pixels */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground">بيكسلات منصات الإعلانات الرئيسية</h2>
          <p className="text-xs text-slate-500">
            أدخل معرّفات البيكسل لحساباتك الإعلانية وسيتم إطلاق أحداث التتبع والزيارات تلقائياً.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            {/* Meta Pixel */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700 flex items-center gap-1.5">
                <span>📘</span>
                <span>{UI.admin.tracking.facebookPixel}</span>
              </label>
              <input
                type="text"
                value={facebookPixelId}
                onChange={(e) => setFacebookPixelId(e.target.value)}
                placeholder={UI.admin.tracking.facebookPlaceholder}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>

            {/* Google Analytics */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700 flex items-center gap-1.5">
                <span>📊</span>
                <span>{UI.admin.tracking.googleAnalytics}</span>
              </label>
              <input
                type="text"
                value={googleAnalyticsId}
                onChange={(e) => setGoogleAnalyticsId(e.target.value)}
                placeholder={UI.admin.tracking.googleAnalyticsPlaceholder}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>

            {/* Google Tag Manager */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700 flex items-center gap-1.5">
                <span>🏷️</span>
                <span>{UI.admin.tracking.googleTagManager}</span>
              </label>
              <input
                type="text"
                value={googleTagManagerId}
                onChange={(e) => setGoogleTagManagerId(e.target.value)}
                placeholder={UI.admin.tracking.googleTagManagerPlaceholder}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>

            {/* TikTok Pixel */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700 flex items-center gap-1.5">
                <span>🎵</span>
                <span>{UI.admin.tracking.tiktokPixel}</span>
              </label>
              <input
                type="text"
                value={tiktokPixelId}
                onChange={(e) => setTiktokPixelId(e.target.value)}
                placeholder={UI.admin.tracking.tiktokPlaceholder}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>

            {/* Snapchat Pixel */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block font-bold text-slate-700 flex items-center gap-1.5">
                <span>👻</span>
                <span>{UI.admin.tracking.snapchatPixel}</span>
              </label>
              <input
                type="text"
                value={snapchatPixelId}
                onChange={(e) => setSnapchatPixelId(e.target.value)}
                placeholder={UI.admin.tracking.snapchatPlaceholder}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>
          </div>
        </section>

        {/* Custom Head & Body Scripts */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground">أكواد تتبع وسكريبتات مخصصة (Custom Scripts)</h2>
          <p className="text-xs text-slate-500">
            لحقن علامات أو سكريبتات إضافية مثل Hotjar، Clarity، أو أكواد تحويل مخصصة.
          </p>

          <div className="space-y-4 text-xs pt-1">
            {/* Custom Head */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700">
                {UI.admin.tracking.customHead}
              </label>
              <textarea
                rows={4}
                value={customHeadScripts}
                onChange={(e) => setCustomHeadScripts(e.target.value)}
                placeholder={UI.admin.tracking.customHeadPlaceholder}
                className="w-full rounded-xl border border-border bg-white p-3 text-xs font-mono outline-none focus:border-brand resize-none"
                dir="ltr"
              />
            </div>

            {/* Custom Body */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700">
                {UI.admin.tracking.customBody}
              </label>
              <textarea
                rows={4}
                value={customBodyScripts}
                onChange={(e) => setCustomBodyScripts(e.target.value)}
                placeholder={UI.admin.tracking.customBodyPlaceholder}
                className="w-full rounded-xl border border-border bg-white p-3 text-xs font-mono outline-none focus:border-brand resize-none"
                dir="ltr"
              />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-white hover:bg-brand/90 transition shadow-sm disabled:opacity-50"
          >
            {saving ? UI.admin.tracking.saving : UI.admin.tracking.save}
          </button>
        </div>
      </form>
    </div>
  );
}
