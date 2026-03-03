"use client";

import { useState } from "react";
import { DaySelector } from "@/components/DaySelector";
import { StopCard } from "@/components/StopCard";
import type { DayDetail } from "@/types/trip";

interface ItineraryTabProps {
  days: DayDetail[];
  startDate: string | null;
  endDate: string | null;
}

/**
 * Returns the day_number that should be shown by default.
 *
 * If today falls within the trip date range and a day with a matching date
 * exists, that day is used. Otherwise falls back to day_number 1.
 */
function getDefaultDayNumber(
  days: DayDetail[],
  startDate: string | null,
  endDate: string | null
): number {
  if (startDate && endDate) {
    const todayISO = new Date().toISOString().split("T")[0];
    if (todayISO >= startDate && todayISO <= endDate) {
      const match = days.find((d) => d.date?.startsWith(todayISO));
      if (match) return match.day_number;
    }
  }
  return days[0]?.day_number ?? 1;
}

/**
 * Itinerary tab: day selector + stop list with a timeline connector.
 * Manages the selected-day state and delegates rendering to sub-components.
 */
export function ItineraryTab({ days, startDate, endDate }: ItineraryTabProps) {
  const [selectedDay, setSelectedDay] = useState<number>(
    () => getDefaultDayNumber(days, startDate, endDate)
  );

  const currentDay = days.find((d) => d.day_number === selectedDay);

  return (
    <div className="flex flex-col">
      {days.length > 0 && (
        <DaySelector
          days={days}
          selectedDay={selectedDay}
          onSelect={setSelectedDay}
        />
      )}

      <div className="px-4 pt-4 pb-2">
        {!currentDay || currentDay.stops.length === 0 ? (
          <p className="text-center text-sm text-muted py-8">
            No stops planned for this day.
          </p>
        ) : (
          <div className="relative border-l-2 border-parchment-deep ml-5 pl-4 space-y-3">
            {currentDay.stops.map((stop) => (
              <StopCard key={stop.id} stop={stop} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
