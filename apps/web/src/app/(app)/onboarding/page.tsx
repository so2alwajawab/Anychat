"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UI } from "@anychat/shared";
import { ApiError, getJson, postJson, putJson } from "@/lib/api";

type Step = "welcome" | "connect" | "template" | "done";
type WizardStep = "welcome" | "connect" | "template";

interface OnboardingState {
  step: Step;
  completed: boolean;
  organizationName: string;
}

const STEP_ORDER: readonly WizardStep[] = ["welcome", "connect", "template"];
const STEP_LABELS: Record<WizardStep, string> = UI.onboarding.steps;

/** Full-page navigation to an API URL that answers with a 302 (OAuth handoff). */
function go(url: string) {
  window.location.assign(new URL(url, window.location.origin).href);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped by the error-screen retry button to re-run the initial load.
  const [attempt, setAttempt] = useState(0);

  // connect step
  const [assetCount, setAssetCount] = useState<number | null>(null);

  // template step
  const [tplName, setTplName] = useState("أول رد");
  const [tplBody, setTplBody] = useState("أهلاً {{commenter_name}} 👋 شكراً لتعليقك!");
  const [tplCreated, setTplCreated] = useState(false);

  // Initial load: an already-onboarded organization is sent straight to the
  // dashboard; everyone else resumes at their saved step.
  useEffect(() => {
    let cancelled = false;
    getJson<OnboardingState>("/api/v1/onboarding")
      .then((s) => {
        if (cancelled) return;
        if (s.completed) {
          router.replace("/dashboard");
          return;
        }
        setState(s);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError(UI.onboarding.error);
      });
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  // Refresh the connected-asset count whenever the connect step is shown
  // (returning from the OAuth handoff lands back here via the layout guard).
  useEffect(() => {
    if (state?.step !== "connect") return;
    getJson<{ items: unknown[] }>("/api/v1/meta/assets")
      .then((res) => setAssetCount(res.items.length))
      .catch(() => setAssetCount(null));
  }, [state?.step]);

  async function goTo(next: Step): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const updated = await putJson<{ step: Step; completed: boolean }>(
        "/api/v1/onboarding",
        { step: next },
      );
      setState((prev) =>
        prev ? { ...prev, step: updated.step, completed: updated.completed } : prev,
      );
      return true;
    } catch {
      setError(UI.onboarding.error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/v1/templates", { name: tplName.trim(), body: tplBody });
      setTplCreated(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // A template with this name already exists (e.g. created before
        // stepping back) — treat it as done so the wizard can continue.
        setTplCreated(true);
      } else {
        setError(err instanceof ApiError ? err.message : UI.onboarding.error);
      }
    } finally {
      setBusy(false);
    }
  }

  if (error && !state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm">
        <p role="alert" className="text-red-600">
          {error}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="text-brand hover:underline"
        >
          {UI.onboarding.error}
        </button>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        {UI.session.checking}
      </main>
    );
  }

  const stepIndex = state.step === "done" ? STEP_ORDER.length : STEP_ORDER.indexOf(state.step);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">{UI.onboarding.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{UI.onboarding.subtitle}</p>
        </div>

        {/* Progress stepper */}
        <ol className="mb-8 flex items-center justify-center gap-2">
          {STEP_ORDER.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i < stepIndex
                    ? "bg-brand text-white"
                    : i === stepIndex
                      ? "border-2 border-brand text-brand"
                      : "border border-border text-slate-400"
                }`}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                {i + 1}
              </span>
              <span
                className={`text-xs ${i === stepIndex ? "font-medium text-slate-800" : "text-slate-400"}`}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEP_ORDER.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
            </li>
          ))}
        </ol>

        {state.step === "welcome" ? (
          <section className="space-y-5 text-center">
            <p className="text-sm leading-7 text-slate-600">
              {UI.onboarding.welcome.body.replace("{name}", state.organizationName)}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void goTo("connect")}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {UI.onboarding.welcome.start}
            </button>
          </section>
        ) : null}

        {state.step === "connect" ? (
          <section className="space-y-4 text-center">
            <p className="text-sm leading-7 text-slate-600">{UI.onboarding.connect.body}</p>
            <p className="text-sm text-slate-500">
              {assetCount === null
                ? UI.onboarding.connect.notConnected
                : assetCount > 0
                  ? UI.onboarding.connect.connected.replace("{count}", String(assetCount))
                  : UI.onboarding.connect.notConnected}
            </p>
            <button
              type="button"
              onClick={() => go("/api/v1/meta/oauth/start")}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {UI.onboarding.connect.action}
            </button>
            <p className="text-xs text-slate-500">{UI.onboarding.connect.hint}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void goTo("welcome")}
                disabled={busy}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {UI.onboarding.back}
              </button>
              <button
                type="button"
                onClick={() => void goTo("template")}
                disabled={busy}
                className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {UI.onboarding.connect.continue}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void goTo("template")}
              disabled={busy}
              className="text-sm text-brand hover:underline disabled:opacity-60"
            >
              {UI.onboarding.connect.skip}
            </button>
          </section>
        ) : null}

        {state.step === "template" ? (
          <section className="space-y-4">
            <p className="text-center text-sm leading-7 text-slate-600">
              {UI.onboarding.template.body}
            </p>
            {tplCreated ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-sm text-emerald-800">
                {UI.onboarding.template.created}
              </p>
            ) : (
              <form onSubmit={createTemplate} className="space-y-3">
                <div>
                  <label htmlFor="tpl-name" className="mb-1.5 block text-sm font-medium">
                    {UI.onboarding.template.nameLabel}
                  </label>
                  <input
                    id="tpl-name"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    required
                    maxLength={100}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label htmlFor="tpl-body" className="mb-1.5 block text-sm font-medium">
                    {UI.onboarding.template.bodyLabel}
                  </label>
                  <textarea
                    id="tpl-body"
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                    required
                    maxLength={2000}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg border border-brand px-4 py-2.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
                >
                  {busy ? UI.onboarding.template.creating : UI.onboarding.template.create}
                </button>
              </form>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void goTo("connect")}
                disabled={busy}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {UI.onboarding.back}
              </button>
              <button
                type="button"
                onClick={() => void goTo("done")}
                disabled={busy}
                className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {UI.onboarding.template.continue}
              </button>
            </div>
            {!tplCreated ? (
              <button
                type="button"
                onClick={() => void goTo("done")}
                disabled={busy}
                className="w-full text-sm text-brand hover:underline disabled:opacity-60"
              >
                {UI.onboarding.template.skip}
              </button>
            ) : null}
          </section>
        ) : null}

        {state.step === "done" ? (
          <section className="space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
              ✓
            </div>
            <p className="text-sm leading-7 text-slate-600">{UI.onboarding.done.body}</p>
            <button
              type="button"
              onClick={() => router.replace("/dashboard")}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {UI.onboarding.done.finish}
            </button>
          </section>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
