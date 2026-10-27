"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { UI } from "@anychat/shared";
import { ApiError, delJson, getJson, postJson, putJson } from "@/lib/api";

interface MetaConfig {
  appId: string | null;
  graphApiVersion: string;
  proofEnabled: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  encryptionKeyConfigured: boolean;
  redirectUri: string;
  webhookCallbackUrl: string;
}

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

interface Diagnostics {
  signatureFailures: { total: number; last24h: number };
  lastEventAt: string | null;
  subscriptions: Array<{
    id: string;
    assetName: string;
    assetPlatform: string;
    object: string;
    subscribedFields: string[];
    subscriptionStatus: string;
    lastEventAt: string | null;
  }>;
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

/** Full-page navigation to an API URL that answers with a 302 (OAuth handoff). */
function go(url: string) {
  window.location.assign(new URL(url, window.location.origin).href);
}

function ConnectionsInner() {
  const searchParams = useSearchParams();
  const oauthResult = searchParams.get("oauth");
  const oauthCode = searchParams.get("code");

  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [assets, setAssets] = useState<MetaAsset[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    if (oauthResult === "success") return C.connect.success;
    if (oauthResult === "error") return `${C.connect.failed} (${oauthCode ?? ""})`;
    return null;
  });
  const [saving, setSaving] = useState(false);

  const [appId, setAppId] = useState("");
  const [graphVersion, setGraphVersion] = useState("");
  const [proofEnabled, setProofEnabled] = useState(true);
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [cfg, assetList, diag] = await Promise.all([
        getJson<MetaConfig>("/api/v1/meta/config"),
        getJson<{ items: MetaAsset[] }>("/api/v1/meta/assets"),
        getJson<Diagnostics>("/api/v1/meta/webhooks/diagnostics"),
      ]);
      setConfig(cfg);
      setAppId(cfg.appId ?? "");
      setGraphVersion(cfg.graphApiVersion);
      setProofEnabled(cfg.proofEnabled);
      setAssets(assetList.items);
      setDiagnostics(diag);
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
      getJson<MetaConfig>("/api/v1/meta/config"),
      getJson<{ items: MetaAsset[] }>("/api/v1/meta/assets"),
      getJson<Diagnostics>("/api/v1/meta/webhooks/diagnostics"),
    ])
      .then(([cfg, assetList, diag]) => {
        if (cancelled) return;
        setConfig(cfg);
        setAppId(cfg.appId ?? "");
        setGraphVersion(cfg.graphApiVersion);
        setProofEnabled(cfg.proofEnabled);
        setAssets(assetList.items);
        setDiagnostics(diag);
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

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        appId: appId.trim(),
        graphApiVersion: graphVersion.trim(),
        appsecretProofEnabled: proofEnabled,
      };
      if (appSecret.trim()) body.appSecret = appSecret.trim();
      if (verifyToken.trim()) body.webhookVerifyToken = verifyToken.trim();
      const updated = await putJson<MetaConfig>("/api/v1/meta/config", body);
      setConfig(updated);
      setAppSecret("");
      setVerifyToken("");
      setNotice(C.config.saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : C.saveError);
    } finally {
      setSaving(false);
    }
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الاتصالات</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{C.subtitle}</p>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {needsReauth ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {C.banner.reauth}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{C.config.title}</h2>
          <button
            type="button"
            onClick={() => go("/api/v1/meta/oauth/start")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {C.connect.action}
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">{C.connect.hint}</p>

        {config && !config.encryptionKeyConfigured ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {C.config.encryptionMissing}
          </p>
        ) : null}

        <form onSubmit={saveConfig} className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="app-id" className="mb-1.5 block text-sm font-medium">
              {C.config.appId}
            </label>
            <input
              id="app-id"
              dir="ltr"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              required
              maxLength={32}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="graph-version" className="mb-1.5 block text-sm font-medium">
              {C.config.graphVersion}
            </label>
            <input
              id="graph-version"
              dir="ltr"
              value={graphVersion}
              onChange={(e) => setGraphVersion(e.target.value)}
              required
              maxLength={16}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="app-secret" className="mb-1.5 block text-sm font-medium">
              {C.config.appSecret}
            </label>
            <input
              id="app-secret"
              dir="ltr"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={C.config.appSecretPlaceholder}
              maxLength={512}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <p className="mt-1 text-xs text-slate-500">
              {config?.hasAppSecret ? C.config.appSecretSet : C.config.appSecretUnset}
            </p>
          </div>
          <div>
            <label htmlFor="verify-token" className="mb-1.5 block text-sm font-medium">
              {C.config.verifyToken}
            </label>
            <input
              id="verify-token"
              dir="ltr"
              type="password"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder={C.config.verifyTokenPlaceholder}
              maxLength={256}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <p className="mt-1 text-xs text-slate-500">
              {config?.hasVerifyToken ? C.config.verifyTokenSet : C.config.verifyTokenUnset}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={proofEnabled}
              onChange={(e) => setProofEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {C.config.proofEnabled}
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? C.config.saving : C.config.save}
            </button>
          </div>
        </form>

        {config ? (
          <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
            <div>
              <p className="font-medium">{C.config.redirectUri}</p>
              <p dir="ltr" className="mt-1 break-all rounded-lg border border-border bg-slate-50 px-3 py-2 font-mono">
                {config.redirectUri}
              </p>
            </div>
            <div>
              <p className="font-medium">{C.config.webhookUrl}</p>
              <p dir="ltr" className="mt-1 break-all rounded-lg border border-border bg-slate-50 px-3 py-2 font-mono">
                {config.webhookCallbackUrl}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">{C.assets.title}</h2>
        {assets.length === 0 ? (
          <p className="text-sm text-slate-500">{C.assets.empty}</p>
        ) : (
          <ul className="space-y-3">
            {assets.map((asset) => (
              <li key={asset.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{asset.displayName}</span>
                  <span className="rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {asset.platform === "instagram"
                      ? C.assets.platformInstagram
                      : C.assets.platformFacebook}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${statusClasses(asset.connectionStatus)}`}
                  >
                    {statusLabel(asset.connectionStatus)}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      asset.selected
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-border bg-slate-50 text-slate-500"
                    }`}
                  >
                    {asset.selected ? C.assets.selected : C.assets.notSelected}
                  </span>
                </div>
                <dl className="mt-3 grid gap-1 text-xs text-slate-500 md:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="font-medium">{C.assets.externalId}:</dt>
                    <dd dir="ltr" className="font-mono">
                      {asset.externalId}
                    </dd>
                  </div>
                  {asset.linkedPageId ? (
                    <div className="flex gap-2">
                      <dt className="font-medium">{C.assets.linkedPage}:</dt>
                      <dd dir="ltr" className="font-mono">
                        {asset.linkedPageId}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="font-medium">{C.assets.permissions}:</dt>
                    <dd dir="ltr" className="break-all font-mono">
                      {asset.permissionsGranted.join(", ")}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">{C.assets.lastHealth}:</dt>
                    <dd>
                      {asset.lastHealthCheckAt
                        ? new Date(asset.lastHealthCheckAt).toLocaleString("ar-EG")
                        : C.assets.never}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void setAssetSelected(asset, !asset.selected)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                  >
                    {asset.selected ? C.assets.unselect : C.assets.select}
                  </button>
                  <button
                    type="button"
                    onClick={() => void checkHealth(asset)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">{C.diagnostics.title}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {diagnostics && config?.hasVerifyToken && config?.hasAppSecret
            ? C.diagnostics.configured
            : C.diagnostics.notConfigured}
        </p>
        {diagnostics ? (
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs text-slate-500">{C.diagnostics.signatureFailures}</p>
              <p className="mt-1 text-lg font-semibold" dir="ltr">
                {diagnostics.signatureFailures.total}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs text-slate-500">{C.diagnostics.signatureFailures24h}</p>
              <p className="mt-1 text-lg font-semibold" dir="ltr">
                {diagnostics.signatureFailures.last24h}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs text-slate-500">{C.diagnostics.lastEvent}</p>
              <p className="mt-1 text-sm font-medium">
                {diagnostics.lastEventAt
                  ? new Date(diagnostics.lastEventAt).toLocaleString("ar-EG")
                  : C.diagnostics.never}
              </p>
            </div>
          </div>
        ) : null}
        {diagnostics && diagnostics.subscriptions.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {diagnostics.subscriptions.map((sub) => (
              <li key={sub.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{sub.assetName}</span>
                  <span className="text-xs text-slate-500">
                    {sub.object === "instagram"
                      ? C.assets.platformInstagram
                      : C.assets.platformFacebook}
                  </span>
                  <span className="rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs">
                    {sub.subscriptionStatus}
                  </span>
                </div>
                <p dir="ltr" className="mt-1 font-mono text-xs text-slate-500">
                  {sub.subscribedFields.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        ) : diagnostics ? (
          <p className="mt-4 text-sm text-slate-500">{C.diagnostics.noSubscriptions}</p>
        ) : null}
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
