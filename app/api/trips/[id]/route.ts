import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/trips/[id]
 *
 * Returns the full trip with nested days and stops.
 * Used by client-side code in future phases (geocoding refresh, chat context, etc.).
 *
 * Responses:
 *   200 { trip }
 *   401 { error, code: "UNAUTHORIZED" }
 *   403 { error, code: "FORBIDDEN" }
 *   404 { error, code: "NOT_FOUND" }
 *   500 { error, code: "INTERNAL_ERROR" }
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        user_id: true,
        name: true,
        destination: true,
        start_date: true,
        end_date: true,
        created_at: true,
        days: {
          orderBy: { day_number: "asc" },
          select: {
            id: true,
            day_number: true,
            date: true,
            title: true,
            stops: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                name: true,
                type: true,
                time: true,
                address: true,
                lat: true,
                lng: true,
                notes: true,
                order: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const isOwner = trip.user_id === session.user.id;
    if (!isOwner) {
      const follow = await prisma.tripFollow.findUnique({
        where: {
          follower_id_trip_id: {
            follower_id: session.user.id,
            trip_id: trip.id,
          },
        },
        select: { id: true },
      });
      if (!follow) {
        return NextResponse.json(
          { error: "You do not have access to this trip.", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    // Strip user_id from the response
    const { user_id: _uid, ...tripData } = trip;

    return NextResponse.json({ trip: tripData });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch trip.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
