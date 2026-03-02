"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root-level error boundary.
 * Displayed when an uncaught error propagates up to the root segment.
 * The `reset` function re-renders the segment, giving the user a way
 * to recover without a full page reload.
 */
export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl bg-parchment p-8 shadow-card text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-rust" strokeWidth={1.5} />
        <h2 className="mt-4 font-serif text-xl font-semibold text-ink">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="mt-6 w-full rounded-xl bg-rust px-4 py-2.5 text-sm font-medium text-cream hover:bg-rust-dark transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
