"use client";

import type { DayDetail } from "@/types/trip";

interface DaySelectorProps {
  days: DayDetail[];
  selectedDay: number;
  onSelect: (dayNumber: number) => void;
}

/** Formats an ISO date string as a short label like "Jun 2" */
function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Horizontal scrolling row of day pill buttons.
 * Active pill uses rust background; inactive pills are outlined cream.
 */
export function DaySelector({ days, selectedDay, onSelect }: DaySelectorProps) {
  return (
    <div
      className="overflow-x-auto flex gap-2 px-4 py-3 shrink-0 bg-cream border-b border-parchment-dark"
      role="tablist"
      aria-label="Trip days"
    >
      {days.map((day) => {
        const isActive = day.day_number === selectedDay;
        const label = day.date
          ? `Day ${day.day_number} · ${formatShortDate(day.date)}`
          : `Day ${day.day_number}`;

        return (
          <button
            key={day.id}
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            onClick={() => onSelect(day.day_number)}
            className={[
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-rust text-white"
                : "bg-cream border border-parchment-deep text-ink-mid hover:border-rust hover:text-rust",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
