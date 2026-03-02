import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";

interface TripCardProps {
  id: string;
  name: string;
  destination: string;
  start_date: Date | string | null;
  end_date: Date | string | null;
}

/** Formats a date to "Mon D, YYYY". Returns null for null input. */
function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Trip card shown in the dashboard grid. Links to the trip companion page. */
export function TripCard({ id, name, destination, start_date, end_date }: TripCardProps) {
  const startFormatted = formatDate(start_date);
  const endFormatted = formatDate(end_date);

  let dateRange: string | null = null;
  if (startFormatted && endFormatted) {
    dateRange = `${startFormatted} – ${endFormatted}`;
  } else if (startFormatted) {
    dateRange = `From ${startFormatted}`;
  } else if (endFormatted) {
    dateRange = `Until ${endFormatted}`;
  }

  return (
    <Link
      href={`/trips/${id}`}
      className="block rounded-2xl bg-parchment p-6 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <h3 className="font-serif text-xl font-semibold text-ink line-clamp-1">{name}</h3>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="line-clamp-1">{destination}</span>
        </div>
        {dateRange && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{dateRange}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
