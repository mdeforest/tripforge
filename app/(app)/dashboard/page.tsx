import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TripCard } from "@/components/TripCard";
import Link from "next/link";
import { Plus, Compass } from "lucide-react";

export const metadata = {
  title: "Dashboard — TripForge",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const trips = await prisma.trip.findMany({
    where: { user_id: session.user.id },
    select: {
      id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">My Trips</h1>
          <p className="mt-1 text-sm text-muted">
            {trips.length === 0
              ? "Upload your first itinerary to get started."
              : `${trips.length} trip${trips.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/trips/new"
          className="flex items-center gap-2 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-rust-dark"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New trip
        </Link>
      </div>

      {/* Empty state */}
      {trips.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-parchment">
            <Compass className="h-8 w-8 text-rust" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink">No trips yet</h2>
            <p className="mt-1 text-sm text-muted">
              Upload an itinerary and TripForge will turn it into your travel companion.
            </p>
          </div>
          <Link
            href="/trips/new"
            className="mt-2 flex items-center gap-2 rounded-xl bg-rust px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-rust-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create your first trip
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} {...trip} />
          ))}
        </div>
      )}
    </div>
  );
}
