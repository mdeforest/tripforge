import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewTripClient } from "@/components/NewTripClient";

export const metadata = {
  title: "New Trip — TripForge",
};

export default async function NewTripPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-ink">New Trip</h1>
        <p className="mt-1 text-sm text-muted">
          Upload your itinerary and TripForge will turn it into your travel companion.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-parchment p-8 shadow-card">
        <NewTripClient />
      </div>
    </div>
  );
}
