"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/** Maps NextAuth error codes to human-readable messages */
const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  EMAIL_PASSWORD_REQUIRED: "Please enter your email and password.",
  OAuthAccountNotLinked:
    "This email is already linked to a password account. Sign in with email instead.",
  default: "Something went wrong. Please try again.",
};

interface LoginFormProps {
  /** NextAuth error param passed via URL query string (?error=...) */
  initialError?: string;
  callbackUrl?: string;
}

/**
 * Login form — supports email/password credentials and Google OAuth.
 *
 * Uses `signIn("credentials", { redirect: false })` so we can handle errors
 * inline without a full page redirect.
 * Google uses `signIn("google")` which triggers the OAuth redirect flow.
 */
export function LoginForm({ initialError, callbackUrl = "/dashboard" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<"credentials" | "google" | null>(null);
  const [error, setError] = useState<string | null>(
    initialError ? (AUTH_ERRORS[initialError] ?? AUTH_ERRORS.default) : null
  );

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("credentials");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(AUTH_ERRORS[result.error] ?? AUTH_ERRORS.default);
      setLoading(null);
      return;
    }

    // Success — navigate to callbackUrl
    window.location.href = callbackUrl;
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    await signIn("google", { callbackUrl });
    // NextAuth handles the redirect — loading stays true during OAuth flow
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-parchment-deep bg-cream px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          /* Google "G" logo — Lucide doesn't include it, inline SVG used */
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-parchment-dark" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-parchment-dark" />
      </div>

      {/* Credentials form */}
      <form onSubmit={handleCredentials} noValidate className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-parchment-deep bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
            placeholder="jane@example.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-parchment-deep bg-cream px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-muted focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
              placeholder="Your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink-mid"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-rust-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "credentials" && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading === "credentials" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-rust hover:text-rust-dark">
          Create one
        </Link>
      </p>
    </div>
  );
}
