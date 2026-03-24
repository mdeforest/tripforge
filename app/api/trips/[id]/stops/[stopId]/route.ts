/**
 * PATCH /api/trips/[id]/stops/[stopId]
 *
 * Updates the address and coordinates of a stop.
 * Verifies ownership via stop → day → trip join.
 *
 * Responses:
 *   200 { stop: { id, address, lat, lng } }
 *   400 { error, code: "VALIDATION_ERROR" }
 *   401 { error, code: "UNAUTHORIZED" }
 *   403 { error, code: "FORBIDDEN" }
 *   404 { error, code: "NOT_FOUND" }
 *   500 { error, code: "INTERNAL_ERROR" }
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stopId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const { address, lat, lng } = parsed.data;

  try {
    const stop = await prisma.stop.findUnique({
      where: { id: params.stopId },
      include: { day: { select: { trip: { select: { id: true, user_id: true } } } } },
    });

    if (!stop) {
      return NextResponse.json(
        { error: "Stop not found.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (stop.day.trip.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have access to this trip.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const updated = await prisma.stop.update({
      where: { id: params.stopId },
      data: { address, lat, lng },
      select: { id: true, address: true, lat: true, lng: true },
    });

    return NextResponse.json({ stop: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update stop.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
