"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@anychat/shared";
import { ApiError, getJson, putJson } from "@/lib/api";

interface MetaPublicConfig {
  appId: string | null;
  graphApiVersion: string;
  proofEnabled: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  encryptionKeyConfigured: boolean;
  redirectUri: string;
  webhookCallbackUrl: string;
}

export default function AdminMetaConfigPage() {
  const [config, setConfig] = useState<MetaPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form fields
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [graphApiVersion, setGraphApiVersion] = useState("v22.0");
  const [appsecretProofEnabled, setAppsecretProofEnabled] = useState(true);

  // Copied indicators
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    let alive = true;
    getJson<MetaPublicConfig>("/api/v1/admin/meta-config")
      .then((data) => {
        if (!alive) return;
        setConfig(data);
        setAppId(data.appId ?? "");
        setGraphApiVersion(data.graphApiVersion ?? "v22.0");
        setAppsecretProofEnabled(data.proofEnabled ?? true);
      })
      .catch((err: unknown) => {
        if (alive) {
          setStatusMessage({
            type: "error",
            text: err instanceof ApiError ? err.message : UI.admin.meta.error,
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

  const handleCopy = (text: string, type: "redirect" | "webhook") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (type === "redirect") {
        setCopiedRedirect(true);
        setTimeout(() => setCopiedRedirect(false), 2000);
      } else {
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId.trim()) return;
    setSaving(true);
    setStatusMessage(null);

    const payload: {
      appId: string;
      appSecret?: string;
      webhookVerifyToken?: string;
      graphApiVersion: string;
      appsecretProofEnabled: boolean;
    } = {
      appId: appId.trim(),
      graphApiVersion: graphApiVersion.trim() || "v22.0",
      appsecretProofEnabled,
    };

    if (appSecret.trim()) {
      payload.appSecret = appSecret.trim();
    }
    if (webhookVerifyToken.trim()) {
      payload.webhookVerifyToken = webhookVerifyToken.trim();
    }

    try {
      await putJson("/api/v1/admin/meta-config", payload);
      setStatusMessage({ type: "success", text: UI.admin.meta.success });
      setAppSecret("");
      setWebhookVerifyToken("");
      // Refresh config
      const refreshed = await getJson<MetaPublicConfig>("/api/v1/admin/meta-config");
      setConfig(refreshed);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : UI.admin.meta.error,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        جارٍ تحميل إعدادات تطبيق ميتا…
      </div>
    );
  }

  const isConfigured = Boolean(config?.appId && config?.hasAppSecret);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin" className="text-xs text-slate-500 hover:text-brand">
            ← العودة للوحة الإدارة
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {UI.admin.meta.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {UI.admin.meta.subtitle}
          </p>
        </div>
        <div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isConfigured
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
            {isConfigured ? UI.admin.meta.statusConfigured : UI.admin.meta.statusMissing}
          </span>
        </div>
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

      {/* Developer URLs to Copy */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground">
          بيانات الربط في لوحة مطوري فيسبوك (Meta for Developers)
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {UI.admin.meta.metaDevHint}
        </p>

        <div className="space-y-3 pt-1">
          {/* OAuth Redirect */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {UI.admin.meta.redirectUri}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={config?.redirectUri ?? ""}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-700 outline-none select-all"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => handleCopy(config?.redirectUri ?? "", "redirect")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {copiedRedirect ? UI.admin.meta.copied : UI.admin.meta.copy}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              انسخ هذا الرابط وضعه في: Facebook Login ➔ Settings ➔ Valid OAuth Redirect URIs
            </p>
          </div>

          {/* Webhook Callback */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {UI.admin.meta.webhookUrl}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={config?.webhookCallbackUrl ?? ""}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-700 outline-none select-all"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => handleCopy(config?.webhookCallbackUrl ?? "", "webhook")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {copiedWebhook ? UI.admin.meta.copied : UI.admin.meta.copy}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              انسخ هذا الرابط وضعه في: Webhooks ➔ Page / Instagram ➔ Callback URL
            </p>
          </div>
        </div>
      </section>

      {/* Meta App Credentials Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-foreground">بيانات اعتماد التطبيق (App Credentials)</h2>

        <div className="space-y-4 text-xs">
          {/* App ID */}
          <div>
            <label className="mb-1.5 block font-bold text-slate-700">
              {UI.admin.meta.appId} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder={UI.admin.meta.appIdPlaceholder}
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
              dir="ltr"
            />
          </div>

          {/* App Secret */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                {UI.admin.meta.appSecret}
              </label>
              {config?.hasAppSecret && (
                <span className="text-[11px] text-emerald-600 font-semibold">
                  مسجل ومشفر حالياً ✓
                </span>
              )}
            </div>
            <input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={
                config?.hasAppSecret
                  ? "•••••••••••••••• (أدخل سراً جديداً فقط إذا أردت تحديثه)"
                  : UI.admin.meta.appSecretPlaceholder
              }
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
              dir="ltr"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              يتم تشفير المفتاح السري فوراً باستخدام خوارزمية AES-256-GCM قبل حفظه في قاعدة البيانات.
            </p>
          </div>

          {/* Webhook Verify Token */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                {UI.admin.meta.verifyToken}
              </label>
              {config?.hasVerifyToken && (
                <span className="text-[11px] text-emerald-600 font-semibold">
                  مسجل حالياً ✓
                </span>
              )}
            </div>
            <input
              type="text"
              value={webhookVerifyToken}
              onChange={(e) => setWebhookVerifyToken(e.target.value)}
              placeholder={
                config?.hasVerifyToken
                  ? "رمز التحقق مسجل (أدخل قيمة جديدة للتعديل)"
                  : UI.admin.meta.verifyTokenPlaceholder
              }
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
              dir="ltr"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              الرمز الذي تدخله في حقل Verify Token عند ضبط الـ Webhooks في مطوري فيسبوك.
            </p>
          </div>

          {/* Graph API Version & Proof */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <label className="mb-1.5 block font-bold text-slate-700">
                {UI.admin.meta.graphVersion}
              </label>
              <input
                type="text"
                value={graphApiVersion}
                onChange={(e) => setGraphApiVersion(e.target.value)}
                placeholder="v22.0"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer pt-4">
                <input
                  type="checkbox"
                  checked={appsecretProofEnabled}
                  onChange={(e) => setAppsecretProofEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-brand focus:ring-brand h-4 w-4"
                />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    {UI.admin.meta.proofEnabled}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {UI.admin.meta.proofEnabledDesc}
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={saving || !appId.trim()}
            className="rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-white hover:bg-brand/90 transition shadow-sm disabled:opacity-50"
          >
            {saving ? UI.admin.meta.saving : UI.admin.meta.save}
          </button>
        </div>
      </form>
    </div>
  );
}
