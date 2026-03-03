import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TripCompanionClient } from "@/components/TripCompanionClient";
import type { TripDetail, StopOption } from "@/types/trip";

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
        notes: stop.notes,
        order: stop.order,
        options: Array.isArray(stop.options) ? (stop.options as StopOption[]) : [],
      })),
    })),
  };

  return <TripCompanionClient trip={tripDetail} />;
}
