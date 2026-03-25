import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/share/[token]/follow
 *
 * Creates a TripFollow record for the logged-in user (upsert — idempotent).
 * Returns { tripId } so the client can redirect to /trips/[tripId].
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const trip = await prisma.trip.findFirst({
    where: { share_token: params.token },
    select: { id: true, user_id: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "Share link not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.tripFollow.upsert({
    where: { follower_id_trip_id: { follower_id: session.user.id, trip_id: trip.id } },
    create: { follower_id: session.user.id, trip_id: trip.id },
    update: {},
  });

  return NextResponse.json({ tripId: trip.id });
}
