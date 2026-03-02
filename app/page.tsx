import { redirect } from "next/navigation";

/**
 * Root page — always redirects to /dashboard.
 * Middleware handles the auth check: unauthenticated users are
 * redirected to /login before /dashboard even renders.
 */
export default function RootPage() {
  redirect("/dashboard");
}
