import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/trips
 *
 * Returns the authenticated user's trips, ordered newest-first.
 * Only fields needed for the dashboard card are selected.
 *
 * Responses:
 *   200 { trips: Trip[] }
 *   401 { error, code: "UNAUTHORIZED" }
 *   500 { error, code: "INTERNAL_ERROR" }
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
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

    return NextResponse.json({ trips });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch trips.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
