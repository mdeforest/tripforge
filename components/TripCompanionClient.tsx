"use client";

import { useState } from "react";
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
import type { TripDetail } from "@/types/trip";

type Tab = "itinerary" | "map" | "chat" | "checklist";

const TABS: { id: Tab; label: string; Icon: React.ElementType; comingSoon?: string }[] = [
  { id: "itinerary", label: "Itinerary", Icon: List },
  { id: "map",       label: "Map",       Icon: Map,           comingSoon: "Phase 5" },
  { id: "chat",      label: "Chat",      Icon: MessageCircle, comingSoon: "Phase 6" },
  { id: "checklist", label: "Checklist", Icon: CheckSquare,   comingSoon: "Phase 7" },
];

interface TripCompanionClientProps {
  trip: TripDetail;
}

/**
 * Full-page trip companion UI.
 * Manages the active tab, renders a sticky header, scrollable content area,
 * and a fixed bottom tab bar.
 */
export function TripCompanionClient({ trip }: TripCompanionClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("itinerary");

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* Sticky header */}
      <header className="sticky top-16 z-10 bg-cream border-b border-parchment-dark">
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
        {activeTab === "itinerary" ? (
          <ItineraryTab
            days={trip.days}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <activeTabDef.Icon className="h-10 w-10 text-parchment-deep mb-4" aria-hidden="true" />
            <p className="font-serif text-xl text-ink">{activeTabDef.label}</p>
            <p className="mt-2 text-sm text-muted">
              Coming in {activeTabDef.comingSoon}
            </p>
          </div>
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
