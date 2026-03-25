import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MapPin, Calendar, AlertCircle } from "lucide-react";
import { ShareSaveButton } from "@/components/ShareSaveButton";

interface SharePageProps {
  params: { token: string };
}

export default async function SharePage({ params }: SharePageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=/share/${params.token}`);
  }

  const trip = await prisma.trip.findFirst({
    where: { share_token: params.token },
    select: {
      id: true,
      user_id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      user: { select: { name: true } },
    },
  });

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-muted" />
          <h1 className="font-serif text-2xl font-semibold text-ink">Link no longer active</h1>
          <p className="text-sm text-muted">This invite link has expired or been removed.</p>
          <Link href="/dashboard" className="mt-2 text-sm font-medium text-rust hover:underline">
            Go to your dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = session.user.id === trip.user_id;
  const follow = !isOwner
    ? await prisma.tripFollow.findUnique({
        where: { follower_id_trip_id: { follower_id: session.user.id, trip_id: trip.id } },
        select: { id: true },
      })
    : null;

  const initialState: "owner" | "follower" | "stranger" = isOwner
    ? "owner"
    : follow
    ? "follower"
    : "stranger";

  const ownerName = trip.user.name || "a TripForge user";

  let dateRange: string | null = null;
  if (trip.start_date && trip.end_date) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    dateRange = `${fmt(trip.start_date)} – ${fmt(trip.end_date)}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-parchment p-8 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Shared by {ownerName}
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">{trip.name}</h1>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{trip.destination}</span>
          </div>
          {dateRange && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{dateRange}</span>
            </div>
          )}
        </div>
        <div className="mt-6">
          <ShareSaveButton
            token={params.token}
            tripId={trip.id}
            initialState={initialState}
          />
        </div>
      </div>
    </div>
  );
}
