import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * DELETE /api/trips/[id]/follow
 *
 * Removes the TripFollow record for the current user (unsave).
 * No-op if no follow record exists. 404 if the trip itself doesn't exist.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  const follow = await prisma.tripFollow.findUnique({
    where: { follower_id_trip_id: { follower_id: session.user.id, trip_id: params.id } },
    select: { id: true },
  });

  if (follow) {
    await prisma.tripFollow.delete({
      where: { follower_id_trip_id: { follower_id: session.user.id, trip_id: params.id } },
    });
  }

  return new Response(null, { status: 204 });
}
