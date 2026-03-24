"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Calendar, Layers, ArrowLeft, Loader2 } from "lucide-react";
import type { ParsedItinerary } from "@/types/itinerary";
import type { PackingItem } from "@/lib/prompts/packing-list";

interface ReviewTripProps {
  parsedData: ParsedItinerary;
  rawText: string;
  packingList: PackingItem[];
  onBack: () => void;
}

/** Formats a YYYY-MM-DD string to "Mon D, YYYY", or returns null. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Shows the parsed trip summary and lets the user confirm or go back.
 * On confirm, POSTs to /api/trips to persist the trip, then navigates to /dashboard.
 */
export function ReviewTrip({ parsedData, rawText, packingList, onBack }: ReviewTripProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalStops = parsedData.days.reduce((acc, day) => acc + day.stops.length, 0);
  const startFormatted = formatDate(parsedData.startDate);
  const endFormatted = formatDate(parsedData.endDate);

  let dateRange: string | null = null;
  if (startFormatted && endFormatted) dateRange = `${startFormatted} – ${endFormatted}`;
  else if (startFormatted) dateRange = `From ${startFormatted}`;
  else if (endFormatted) dateRange = `Until ${endFormatted}`;

  async function handleConfirm() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedData, rawText, packingList }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Trip summary card */}
      <div className="rounded-2xl bg-parchment p-6 space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-ink">{parsedData.tripName}</h2>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{parsedData.destination}</span>
          </div>
          {dateRange && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{dateRange}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted">
            <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {parsedData.days.length} day{parsedData.days.length !== 1 ? "s" : ""} &middot; {totalStops} stop{totalStops !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Per-day breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-ink-mid">Day breakdown</h3>
        <div className="space-y-2">
          {parsedData.days.map((day) => (
            <div
              key={day.dayNumber}
              className="rounded-xl border border-parchment-deep bg-cream px-4 py-3"
            >
              <p className="text-sm font-medium text-ink">
                Day {day.dayNumber}
                {day.title && day.title !== `Day ${day.dayNumber}` ? ` — ${day.title}` : ""}
              </p>
              {day.stops.length > 0 && (
                <p className="mt-0.5 text-xs text-muted line-clamp-1">
                  {day.stops
                    .slice(0, 3)
                    .map((s) => s.name)
                    .join(", ")}
                  {day.stops.length > 3 ? ` +${day.stops.length - 3} more` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-parchment-deep bg-cream px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-rust-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating trip…" : "Create trip"}
        </button>
      </div>
    </div>
  );
}
