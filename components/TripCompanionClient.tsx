"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  List,
  Map,
  MessageCircle,
  CheckSquare,
} from "lucide-react";
import { ItineraryTab } from "@/components/ItineraryTab";
import { MapTab } from "@/components/MapTab";
import { ChatTab } from "@/components/ChatTab";
import { ChecklistTab } from "@/components/ChecklistTab";
import type { MapViewport } from "@/components/MapTab";
import type { TripDetail, DayDetail, ChecklistItem } from "@/types/trip";

type Tab = "itinerary" | "map" | "chat" | "checklist";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "itinerary", label: "Itinerary", Icon: List },
  { id: "map",       label: "Map",       Icon: Map },
  { id: "chat",      label: "Chat",      Icon: MessageCircle },
  { id: "checklist", label: "Checklist", Icon: CheckSquare },
];

interface TripCompanionClientProps {
  trip: TripDetail;
  checklist: ChecklistItem[];
}

/**
 * Returns the day_number to show by default.
 * Selects today's day if today falls within the trip date range, else Day 1.
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
 * Full-page trip companion UI.
 * Manages the active tab and the selected day (shared across tabs so switching
 * tabs preserves the day you were viewing).
 */
export function TripCompanionClient({ trip, checklist }: TripCompanionClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("itinerary");
  const [selectedDay, setSelectedDay] = useState<number>(
    () => getDefaultDayNumber(trip.days, trip.start_date, trip.end_date)
  );
  const mapViewportRef = useRef<MapViewport | null>(null);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      {/* Sticky header */}
      <header className="sticky top-14 z-10 bg-cream border-b border-parchment-dark">
        <div className="flex items-start gap-3 px-4 py-3 max-w-2xl mx-auto w-full">
          <Link
            href="/dashboard"
            className="mt-0.5 shrink-0 text-muted hover:text-ink transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-semibold text-ink leading-tight truncate">
              {trip.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{trip.destination}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 pb-20 max-w-2xl mx-auto w-full">
        {activeTab === "itinerary" && (
          <ItineraryTab
            days={trip.days}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}
        {activeTab === "map" && (
          <MapTab
            days={trip.days}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            savedViewport={mapViewportRef.current}
            onViewportChange={(vp) => { mapViewportRef.current = vp; }}
          />
        )}
        {activeTab === "chat" && (
          <ChatTab
            tripId={trip.id}
            tripName={trip.name}
            destination={trip.destination}
          />
        )}
        {activeTab === "checklist" && (
          <ChecklistTab tripId={trip.id} initialItems={checklist} />
        )}
      </main>

      {/* Fixed bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 bg-parchment border-t border-parchment-dark"
        aria-label="Trip sections"
      >
        <div className="flex max-w-2xl mx-auto">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-pressed={isActive}
                aria-label={label}
                className={[
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                  isActive ? "text-rust" : "text-muted hover:text-ink-mid",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
