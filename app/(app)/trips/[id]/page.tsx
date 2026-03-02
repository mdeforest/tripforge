import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";

interface TripPageProps {
  params: { id: string };
}

export default async function TripPage({ params }: TripPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      user_id: true,
    },
  });

  if (!trip || trip.user_id !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink-mid"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="font-serif text-3xl font-semibold text-ink">{trip.name}</h1>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{trip.destination}</span>
        </div>
        {trip.start_date && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {new Date(trip.start_date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {trip.end_date && (
                <>
                  {" – "}
                  {new Date(trip.end_date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="mt-12 rounded-2xl bg-parchment p-8 text-center">
        <p className="font-serif text-xl text-ink">Trip companion coming in Phase 4</p>
        <p className="mt-2 text-sm text-muted">
          Itinerary browser, map, AI chat, and packing checklist are on the way.
        </p>
      </div>
    </div>
  );
}
