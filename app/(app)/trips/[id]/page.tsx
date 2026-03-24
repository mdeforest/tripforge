import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TripCompanionClient } from "@/components/TripCompanionClient";
import { geocodeAddress } from "@/lib/geocode";
import type { TripDetail, StopOption, ChecklistItem } from "@/types/trip";

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
      user_id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      days: {
        orderBy: { day_number: "asc" },
        select: {
          id: true,
          day_number: true,
          date: true,
          title: true,
          notes: true,
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
              options: true,
            },
          },
        },
      },
    },
  });

  if (!trip || trip.user_id !== session.user.id) notFound();

  // Run geocoding backfill and checklist fetch in parallel.
  const [, checklistRaw] = await Promise.all([
    // Backfill geocoding for stops and their options that have addresses but no coordinates.
    // Runs on first load for trips created before geocoding was added; writes back to DB
    // so subsequent loads are instant.
    Promise.all(
      trip.days.flatMap((day) =>
        day.stops.map(async (stop) => {
          // 1. Geocode the stop itself if needed.
          if (stop.address && stop.lat == null && stop.lng == null) {
            const coords = await geocodeAddress(stop.address);
            if (coords) {
              await prisma.stop.update({
                where: { id: stop.id },
                data: { lat: coords.lat, lng: coords.lng },
              });
              stop.lat = coords.lat;
              stop.lng = coords.lng;
            }
          }

          // 2. Geocode any options that need it.
          const raw = Array.isArray(stop.options)
            ? (stop.options as unknown as StopOption[])
            : [];
          const needsGeocode = raw.some(
            (opt) => opt.address && opt.lat == null && opt.lng == null
          );
          if (!needsGeocode) return;

          const enriched = await Promise.all(
            raw.map(async (opt) => {
              if (!opt.address || (opt.lat != null && opt.lng != null)) return opt;
              const coords = await geocodeAddress(opt.address);
              return { ...opt, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
            })
          );

          await prisma.stop.update({
            where: { id: stop.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { options: enriched as any },
          });

          // Mutate in-place so the serialization below picks up the new coords.
          (stop.options as unknown) = enriched;
        })
      )
    ),

    // Fetch checklist items ordered by category then by creation order.
    prisma.checklistItem.findMany({
      where: { trip_id: params.id },
      select: { id: true, category: true, label: true, reason: true, checked: true, is_custom: true },
      orderBy: [{ category: "asc" }],
    }),
  ]);

  const checklist: ChecklistItem[] = checklistRaw;

  // Serialize Date objects to ISO strings before passing to the client component
  const tripDetail: TripDetail = {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    start_date: trip.start_date?.toISOString().split("T")[0] ?? null,
    end_date: trip.end_date?.toISOString().split("T")[0] ?? null,
    days: trip.days.map((day) => ({
      id: day.id,
      day_number: day.day_number,
      date: day.date?.toISOString().split("T")[0] ?? null,
      title: day.title,
      notes: day.notes ?? null,
      stops: day.stops.map((stop) => ({
        id: stop.id,
        name: stop.name,
        type: stop.type,
        time: stop.time,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
        notes: stop.notes,
        order: stop.order,
        options: Array.isArray(stop.options) ? (stop.options as StopOption[]) : [],
      })),
    })),
  };

  return <TripCompanionClient trip={tripDetail} checklist={checklist} />;
}
