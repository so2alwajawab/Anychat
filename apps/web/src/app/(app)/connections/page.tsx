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

      {/* Main Facebook Connect Action Card */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-[#1877F2]">📘</span>
              <span>ربط الحسابات والصفحات عبر فيسبوك</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              عند الضغط على الزر، سيتم توجيهك إلى فيسبوك لتسجيل الدخول واختيار الصفحات وحسابات إنستغرام التي ترغب في ربطها بالمنصة مع منح صلاحيات قراءة التعليقات والرد عليها.
            </p>
          </div>

          <div>
            <button
              type="button"
              disabled={!isConfigured}
              onClick={() => go("/api/v1/meta/oauth/start")}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-[#1877F2] px-6 py-3 text-sm font-bold text-white hover:bg-[#166fe5] shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>ربط صفحة فيسبوك أو إنستغرام</span>
            </button>
          </div>
        </div>

        {!isConfigured && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            خدمة الربط مع فيسبوك غير مفعلة حالياً من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني.
          </p>
        )}
      </section>

      {/* Connected Assets List */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground">{C.assets.title}</h2>
          <span className="text-xs text-slate-400 font-semibold">{assets.length} صفحة مربوطة</span>
        </div>

        {assets.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2">
            <span className="text-3xl block">📭</span>
            <p className="text-sm font-semibold text-slate-600">{C.assets.empty}</p>
            <p className="text-xs text-slate-400">
              اضغط على زر &ldquo;ربط صفحة فيسبوك أو إنستغرام&rdquo; أعلاه لاختيار صفحاتك وبدء تشغيل الردود.
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
