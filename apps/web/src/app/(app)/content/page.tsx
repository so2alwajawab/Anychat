"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { UI } from "@anychat/shared";
import { ApiError, getJson, postJson } from "@/lib/api";

interface PostItem {
  id: string;
  assetId: string;
  assetName: string;
  platform: string;
  externalId: string;
  messagePreview: string | null;
  permalink: string | null;
  isEligibleForReply: boolean;
  createdTime: string;
  syncedAt: string;
  commentsCount: number;
}

interface CommentItem {
  id: string;
  assetId: string;
  assetName: string;
  platform: string;
  postId: string | null;
  postPreview: string | null;
  postPermalink: string | null;
  externalCommentId: string;
  parentCommentId: string | null;
  authorScopedId: string;
  authorUsername: string | null;
  text: string;
  sourceCreatedAt: string;
  receivedAt: string;
  direction: string;
}

interface AssetOption {
  id: string;
  displayName: string;
  platform: string;
}

const T = UI.content;

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

function ContentContent() {
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    // GET /meta/assets responds with `{ items: [...] }` (see assets.service.list()).
    const assetsData = await getJson<{ items: AssetOption[] }>("/api/v1/meta/assets").catch(() => ({ items: [] as AssetOption[] }));

    const queryParams = new URLSearchParams();
    if (selectedAsset) queryParams.set("assetId", selectedAsset);
    if (selectedPlatform) queryParams.set("platform", selectedPlatform);
    if (search.trim()) queryParams.set("search", search.trim());

    const [postsRes, commentsRes] = await Promise.all([
      getJson<{ items: PostItem[] }>(`/api/v1/content/posts?${queryParams.toString()}`).catch(() => ({ items: [] })),
      getJson<{ items: CommentItem[] }>(`/api/v1/content/comments?${queryParams.toString()}`).catch(() => ({ items: [] })),
    ]);

    return {
      assets: assetsData.items ?? [],
      posts: postsRes.items ?? [],
      comments: commentsRes.items ?? [],
    };
  }, [selectedAsset, selectedPlatform, search]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((data) => {
        if (cancelled) return;
        setAssets(data.assets);
        setPosts(data.posts);
        setComments(data.comments);
        setFeedback(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : T.error;
        setFeedback({ text: msg, error: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      await postJson("/api/v1/content/sync", {
        assetId: selectedAsset || undefined,
      });
      setFeedback({ text: T.syncSuccess, error: false });
      const updated = await fetchData();
      setAssets(updated.assets);
      setPosts(updated.posts);
      setComments(updated.comments);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : T.syncFailed;
      setFeedback({ text: msg, error: true });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{T.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{T.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? T.syncing : T.sync}
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            feedback.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Controls: Tabs & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("posts")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "posts"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {T.tabs.posts} ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("comments")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "comments"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {T.tabs.comments} ({comments.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-brand focus:outline-none"
          >
            <option value="">{T.filters.allAssets}</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} ({a.platform === "facebook" ? UI.connections.assets.platformFacebook : UI.connections.assets.platformInstagram})
              </option>
            ))}
          </select>

          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-brand focus:outline-none"
          >
            <option value="">{T.filters.allPlatforms}</option>
            <option value="facebook">{UI.connections.assets.platformFacebook}</option>
            <option value="instagram">{UI.connections.assets.platformInstagram}</option>
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T.filters.search}
            className="w-48 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-slate-500">
          {T.loading}
        </div>
      ) : tab === "posts" ? (
        posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-slate-400">
            {T.posts.empty}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.platform === "facebook"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}
                    >
                      {p.platform === "facebook" ? UI.connections.assets.platformFacebook : UI.connections.assets.platformInstagram}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatDate(p.createdTime)}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{p.assetName}</p>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                    {p.messagePreview || "—"}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    💬 {p.commentsCount} {T.posts.commentsCount}
                  </span>
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline font-medium"
                    >
                      {T.posts.viewPost} ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-slate-400">
          {T.comments.empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-right text-xs">
            <thead className="bg-slate-50 font-medium text-slate-600">
              <tr>
                <th className="px-4 py-3">{T.comments.commenter}</th>
                <th className="px-4 py-3">{T.comments.comment}</th>
                <th className="px-4 py-3">{T.comments.platform}</th>
                <th className="px-4 py-3">{T.comments.post}</th>
                <th className="px-4 py-3">{T.comments.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-slate-700">
              {comments.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {c.authorUsername || c.authorScopedId}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-slate-900">{c.text || "—"}</p>
                    {c.parentCommentId && (
                      <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {T.comments.parentComment}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.platform === "facebook"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}
                    >
                      {c.platform === "facebook" ? UI.connections.assets.platformFacebook : UI.connections.assets.platformInstagram}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-500">
                    {c.postPreview || c.postId || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(c.sourceCreatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">{T.loading}</div>}>
      <ContentContent />
    </Suspense>
  );
}
