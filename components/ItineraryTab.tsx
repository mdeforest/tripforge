"use client";

import { DaySelector } from "@/components/DaySelector";
import { StopCard } from "@/components/StopCard";
import type { DayDetail } from "@/types/trip";

interface ItineraryTabProps {
  days: DayDetail[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onEditStop?: (stopId: string) => void;
}

/**
 * Itinerary tab: day selector + stop list with a timeline connector.
 * Fully controlled — selected day state is owned by TripCompanionClient so it
 * persists when the user switches between tabs.
 */
export function ItineraryTab({ days, selectedDay, onSelectDay, onEditStop }: ItineraryTabProps) {
  const currentDay = days.find((d) => d.day_number === selectedDay);

  return (
    <div className="flex flex-col">
      {days.length > 0 && (
        <DaySelector
          days={days}
          selectedDay={selectedDay}
          onSelect={onSelectDay}
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
              <StopCard key={stop.id} stop={stop} onEdit={onEditStop ? () => onEditStop(stop.id) : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
