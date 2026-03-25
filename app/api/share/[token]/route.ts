import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/share/[token]
 *
 * Public — no auth required. Returns trip preview metadata by share token.
 * Used by external consumers. The invite page server component queries Prisma directly.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const trip = await prisma.trip.findFirst({
    where: { share_token: params.token },
    select: {
      id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      user: { select: { name: true } },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Share link not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    tripId: trip.id,
    name: trip.name,
    destination: trip.destination,
    start_date: trip.start_date?.toISOString().slice(0, 10) ?? null,
    end_date: trip.end_date?.toISOString().slice(0, 10) ?? null,
    ownerName: trip.user.name || "a TripForge user",
  });
}
