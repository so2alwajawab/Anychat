"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME, UI } from "@anychat/shared";
import { ApiError, postJson } from "@/lib/api";

interface LoginResponse {
  user: { id: string; username: string };
}

interface RecoveryResponse extends LoginResponse {
  recoveryCode: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : UI.login.genericError);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await postJson<LoginResponse>("/api/v1/auth/login", { username, password });
      router.replace("/dashboard");
    } catch (err) {
      fail(err);
      setLoading(false);
    }
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<RecoveryResponse>("/api/v1/auth/recovery", {
        code,
        newPassword,
      });
      setIssuedCode(res.recoveryCode);
    } catch (err) {
      fail(err);
    }
    setLoading(false);
  }

  function switchMode(next: "login" | "recover") {
    setMode(next);
    setError(null);
    setIssuedCode(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-white">
            {APP_NAME.charAt(0)}
          </div>
          <h1 className="text-xl font-semibold">
            {mode === "login" ? UI.login.title : UI.recovery.tab}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login" ? UI.login.subtitle : UI.recovery.subtitle}
          </p>
        </div>

        {issuedCode ? (
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {UI.recovery.successTitle}
            </div>
            <p className="text-sm text-slate-600">{UI.recovery.successHint}</p>
            <p
              dir="ltr"
              className="rounded-lg border border-border bg-slate-50 p-3 font-mono text-sm break-all"
            >
              {issuedCode}
            </p>
            <button
              type="button"
              onClick={() => router.replace("/dashboard")}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {UI.recovery.done}
            </button>
          </div>
        ) : mode === "login" ? (
          <form onSubmit={submitLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
                {UI.login.username}
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                maxLength={100}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                {UI.login.password}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                maxLength={1024}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? UI.login.submitting : UI.login.submit}
            </button>
          </form>
        ) : (
          <form onSubmit={submitRecovery} className="space-y-4">
            <div>
              <label htmlFor="recovery-code" className="mb-1.5 block text-sm font-medium">
                {UI.recovery.code}
              </label>
              <input
                id="recovery-code"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={UI.recovery.codePlaceholder}
                required
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-center font-mono text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">
                {UI.recovery.newPassword}
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={1024}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? UI.recovery.submitting : UI.recovery.submit}
            </button>
          </form>
        )}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {!issuedCode ? (
          <div className="mt-5 text-center text-sm">
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "recover" : "login")}
              className="text-brand hover:underline"
            >
              {mode === "login" ? UI.recovery.tab : UI.recovery.backToLogin}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
