"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UI } from "@anychat/shared";
import { ApiError, delJson, getJson, postJson } from "@/lib/api";

interface MetaAsset {
  id: string;
  platform: string;
  externalId: string;
  displayName: string;
  linkedPageId: string | null;
  permissionsGranted: string[];
  connectionStatus: string;
  selected: boolean;
  connectedAt: string;
  lastHealthCheckAt: string | null;
  credential: { status: string; lastValidatedAt: string | null } | null;
}

interface MetaPublicConfig {
  appId: string | null;
  hasAppSecret: boolean;
}

const C = UI.connections;

function statusLabel(status: string): string {
  if (status === "connected") return C.assets.status.connected;
  if (status === "reauth_required") return C.assets.status.reauth_required;
  return C.assets.status.unknown;
}

function statusClasses(status: string): string {
  if (status === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "reauth_required") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-slate-50 text-slate-600";
}

function go(url: string) {
  window.location.assign(new URL(url, window.location.origin).href);
}

function ConnectionsInner() {
  const searchParams = useSearchParams();
  const oauthResult = searchParams.get("oauth");
  const oauthCode = searchParams.get("code");

  const [assets, setAssets] = useState<MetaAsset[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    if (oauthResult === "success") return C.connect.success;
    if (oauthResult === "error") return `${C.connect.failed} (${oauthCode ?? ""})`;
    return null;
  });

  const loadAll = useCallback(async () => {
    try {
      const [cfg, assetList] = await Promise.all([
        getJson<MetaPublicConfig>("/api/v1/meta/config").catch(() => null),
        getJson<{ items: MetaAsset[] }>("/api/v1/meta/assets"),
      ]);
      if (cfg) {
        setIsConfigured(Boolean(cfg.appId && cfg.hasAppSecret));
      }
      setAssets(assetList.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : C.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<MetaPublicConfig>("/api/v1/meta/config").catch(() => null),
      getJson<{ items: MetaAsset[] }>("/api/v1/meta/assets"),
    ])
      .then(([cfg, assetList]) => {
        if (cancelled) return;
        if (cfg) {
          setIsConfigured(Boolean(cfg.appId && cfg.hasAppSecret));
        }
        setAssets(assetList.items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : C.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setAssetSelected(asset: MetaAsset, selected: boolean) {
    try {
      await postJson<MetaAsset>(`/api/v1/meta/assets/${asset.id}/select`, { selected });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : C.error);
    }
  }

  async function checkHealth(asset: MetaAsset) {
    try {
      const result = await getJson<{ ok: boolean; code?: number }>(
        `/api/v1/meta/assets/${asset.id}/health`,
      );
      setNotice(
        result.ok
          ? `${asset.displayName}: ${C.assets.checkHealth} ✓`
          : `${asset.displayName}: ${C.assets.status.reauth_required} (${result.code ?? ""})`,
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : C.error);
    }
  }

  async function reconnect(asset: MetaAsset) {
    try {
      const result = await postJson<{ redirectUrl: string }>(
        `/api/v1/meta/assets/${asset.id}/reconnect`,
        {},
      );
      go(result.redirectUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : C.error);
    }
  }

  async function removeAsset(asset: MetaAsset) {
    if (!window.confirm(C.assets.removeConfirm)) return;
    try {
      await delJson(`/api/v1/meta/assets/${asset.id}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : C.error);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{C.loading}</p>;
  }

  const needsReauth = assets.some((a) => a.connectionStatus === "reauth_required");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">اتصالات فيسبوك وإنستغرام</h1>
        <p className="mt-1 text-sm text-slate-500">
          اربط صفحاتك وحساباتك بسهولة بضغطة زر لبدء تشغيل الردود التلقائية على التعليقات والرسائل الخاصة.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {needsReauth && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {C.banner.reauth}
        </div>
      )}

      {/* Connection Action Cards - Facebook & Instagram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Facebook Connect Card */}
        <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">ربط صفحات فيسبوك</h2>
                  <span className="text-xs text-blue-600 font-semibold">صفحات فيسبوك الرسمية</span>
                </div>
              </div>
              <span className="rounded-full bg-blue-100/70 text-blue-700 text-xs px-2.5 py-0.5 font-medium">
                {assets.filter((a) => a.platform === "facebook").length} صفحة مربوطة
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              ربط صفحات فيسبوك لإدارة التعليقات والمنشورات والردود التلقائية ورسائل ماسنجر للعملاء فورياً.
            </p>
          </div>

          <div className="pt-5 mt-auto">
            <button
              type="button"
              disabled={!isConfigured}
              onClick={() => go("/api/v1/meta/oauth/start")}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-5 py-3 text-sm font-bold text-white hover:bg-[#166fe5] shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>ربط صفحة فيسبوك</span>
            </button>
          </div>
        </section>

        {/* Instagram Connect Card */}
        <section className="rounded-2xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/40 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">ربط حساب إنستغرام</h2>
                  <span className="text-xs text-rose-600 font-semibold">حسابات إنستغرام الاحترافية</span>
                </div>
              </div>
              <span className="rounded-full bg-pink-100/70 text-rose-700 text-xs px-2.5 py-0.5 font-medium">
                {assets.filter((a) => a.platform === "instagram").length} حساب مربوط
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              ربط حسابات إنستغرام الاحترافية المربوطة بصفحاتك للرد التلقائي على منشورات الـ Reels والمنشورات والخاص.
            </p>
          </div>

          <div className="pt-5 mt-auto">
            <button
              type="button"
              disabled={!isConfigured}
              onClick={() => go("/api/v1/meta/oauth/start")}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-5 py-3 text-sm font-bold text-white hover:opacity-95 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span>ربط حساب إنستغرام</span>
            </button>
          </div>
        </section>
      </div>

      {!isConfigured && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          خدمة الربط غير مفعلة حالياً من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني.
        </p>
      )}

      {/* Connected Assets List */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">{C.assets.title}</h2>
            <div className="flex gap-1.5 text-xs">
              <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200">
                {assets.filter((a) => a.platform === "facebook").length} فيسبوك
              </span>
              <span className="rounded-full bg-pink-50 text-rose-700 px-2 py-0.5 border border-pink-200">
                {assets.filter((a) => a.platform === "instagram").length} إنستغرام
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{assets.length} أصل مربوط</span>
        </div>

        {assets.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2">
            <span className="text-3xl block">📭</span>
            <p className="text-sm font-semibold text-slate-600">{C.assets.empty}</p>
            <p className="text-xs text-slate-400">
              اضغط على زر &ldquo;ربط صفحة فيسبوك&rdquo; أو &ldquo;ربط حساب إنستغرام&rdquo; لاختيار صفحاتك وحساباتك وبدء تشغيل الردود.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {assets.map((asset) => (
              <li key={asset.id} className="rounded-xl border border-border bg-white p-4 transition shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{asset.platform === "instagram" ? "📸" : "📘"}</span>
                    <span className="font-bold text-sm text-foreground">{asset.displayName}</span>
                    <span className="rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      {asset.platform === "instagram" ? C.assets.platformInstagram : C.assets.platformFacebook}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses(asset.connectionStatus)}`}>
                      {statusLabel(asset.connectionStatus)}
                    </span>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      asset.selected
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-border bg-slate-50 text-slate-500"
                    }`}
                  >
                    {asset.selected ? "نشطة للأتمتة ✓" : "غير مفعلة"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2 text-xs">
                  <span className="text-slate-400">
                    تم الربط: {new Date(asset.connectedAt).toLocaleDateString("ar-EG")}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void setAssetSelected(asset, !asset.selected)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
                        asset.selected
                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "border-brand bg-brand text-white hover:bg-brand/90"
                      }`}
                    >
                      {asset.selected ? C.assets.unselect : C.assets.select}
                    </button>
                    <button
                      type="button"
                      onClick={() => void checkHealth(asset)}
                      className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {C.assets.checkHealth}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reconnect(asset)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:opacity-90"
                    >
                      {C.assets.reconnect}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeAsset(asset)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:opacity-90"
                    >
                      {C.assets.remove}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">{UI.connections.loading}</p>}>
      <ConnectionsInner />
    </Suspense>
  );
}
