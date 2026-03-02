import { NavBar } from "@/components/NavBar";

/**
 * Authenticated app layout.
 *
 * All pages inside the (app) route group share this layout:
 * - NavBar at the top
 * - Main content area below
 *
 * Route-level auth protection is handled by middleware.ts, which
 * redirects unauthenticated users to /login before this layout renders.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <NavBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
