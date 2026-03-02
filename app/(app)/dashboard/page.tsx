import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Dashboard — placeholder for Phase 2.
 * Auth guard is redundant here (middleware handles it) but adds a
 * server-side safety net and makes the session available to the page.
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Welcome back, {session.user.name?.split(" ")[0]} 👋
      </h1>
      <p className="mt-2 text-muted">
        Your trips will appear here. Phase 2 coming soon.
      </p>
    </div>
  );
}

export const metadata = {
  title: "Dashboard",
};
