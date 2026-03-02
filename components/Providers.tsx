"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client-side providers wrapper.
 * Wraps the app with NextAuth's SessionProvider so that `useSession()`
 * works in any client component without prop-drilling the session.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
