import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocode";

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

// ─── Zod schema for POST /api/trips ──────────────────────────────────────────

const stopOptionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["restaurant", "activity"]),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  order: z.number().int().nonnegative(),
});

const stopSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["hotel", "restaurant", "activity", "transport", "other"]),
  time: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  order: z.number().int().nonnegative(),
  options: z.array(stopOptionSchema).default([]),
});

const daySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string().nullable(),
  title: z.string().min(1),
  notes: z.string().nullable(),
  stops: z.array(stopSchema),
});

const createTripSchema = z.object({
  parsedData: z.object({
    tripName: z.string().min(1),
    destination: z.string().min(1),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    notes: z.string().nullable(),
    days: z.array(daySchema),
  }),
  rawText: z.string().min(1),
});

/**
 * POST /api/trips
 *
 * Creates a trip with nested days and stops from confirmed parsed data.
 *
 * Request:  { parsedData: ParsedItinerary, rawText: string }
 * Response: { trip: { id, name, destination } }
 *
 * Error codes:
 *   401 UNAUTHORIZED      — not authenticated
 *   400 VALIDATION_ERROR  — invalid request body
 *   500 INTERNAL_ERROR    — DB error
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const { parsedData, rawText } = parsed.data;

  // Geocode all stop + option addresses in parallel (failures silently return null).
  // Order: [stop1Addr, stop1Opt1Addr, stop1Opt2Addr, stop2Addr, stop2Opt1Addr, ...]
  const geocodeResults = await Promise.all(
    parsedData.days.flatMap((day) =>
      day.stops.flatMap((stop) => [
        geocodeAddress(stop.address),
        ...stop.options.map((opt) => geocodeAddress(opt.address)),
      ])
    )
  );

  // Consume geocode results in the same interleaved order above.
  let coordIdx = 0;

  try {
    const trip = await prisma.trip.create({
      data: {
        user_id: session.user.id,
        name: parsedData.tripName,
        destination: parsedData.destination,
        start_date: parsedData.startDate ? new Date(parsedData.startDate) : null,
        end_date: parsedData.endDate ? new Date(parsedData.endDate) : null,
        raw_input: rawText,
        parsed_data: parsedData,
        days: {
          create: parsedData.days.map((day) => ({
            day_number: day.dayNumber,
            date: day.date ? new Date(day.date) : null,
            title: day.title,
            notes: day.notes,
            stops: {
              create: day.stops.map((stop) => {
                const coords = geocodeResults[coordIdx++];
                const geocodedOptions = stop.options.map((opt) => {
                  const optCoords = geocodeResults[coordIdx++];
                  return { ...opt, lat: optCoords?.lat ?? null, lng: optCoords?.lng ?? null };
                });
                return {
                  name: stop.name,
                  type: stop.type,
                  time: stop.time,
                  address: stop.address,
                  lat: coords?.lat ?? null,
                  lng: coords?.lng ?? null,
                  notes: stop.notes,
                  order: stop.order,
                  options: geocodedOptions.length > 0 ? geocodedOptions : undefined,
                };
              }),
            },
          })),
        },
      },
      select: { id: true, name: true, destination: true },
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create trip.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
