"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APP_NAME, UI } from "@anychat/shared";
import { ApiError, postJson } from "@/lib/api";

interface SignupResponse {
  user: { id: string; username: string };
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : UI.signup.genericError);

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await postJson<SignupResponse>("/api/v1/auth/signup", {
        email: email.trim(),
        username: username.trim(),
        password,
        ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      });
      // Fresh accounts start at the onboarding wizard, not the dashboard.
      router.replace("/onboarding");
    } catch (err) {
      fail(err);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local brand asset */}
          <img
            src="/brand/logo.png"
            alt={APP_NAME}
            width={512}
            height={414}
            className="mx-auto mb-3 h-16 w-auto"
          />
          <h1 className="text-xl font-semibold">{UI.signup.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{UI.signup.subtitle}</p>
        </div>

        <form onSubmit={submitSignup} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              {UI.signup.email}
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              maxLength={254}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="signup-username" className="mb-1.5 block text-sm font-medium">
              {UI.signup.username}
            </label>
            <input
              id="signup-username"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={4}
              maxLength={32}
              pattern="[a-zA-Z0-9](?:[a-zA-Z0-9._\-]{2,30})[a-zA-Z0-9]"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="organization-name" className="mb-1.5 block text-sm font-medium">
              {UI.signup.organizationName}
            </label>
            <input
              id="organization-name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              autoComplete="organization"
              maxLength={120}
              placeholder={UI.signup.organizationPlaceholder}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium">
              {UI.signup.password}
            </label>
            <input
              id="signup-password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={1024}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <p className="mt-1.5 text-xs text-slate-500">{UI.signup.passwordHint}</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? UI.signup.submitting : UI.signup.submit}
          </button>
        </form>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 text-center text-sm">
          <span className="text-slate-600">{UI.signup.haveAccount} </span>
          <Link href="/login" className="text-brand hover:underline">
            {UI.signup.loginLink}
          </Link>
        </div>
      </div>
    </main>
  );
}
