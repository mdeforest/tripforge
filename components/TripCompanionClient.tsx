"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  List,
  Map,
  MessageCircle,
  CheckSquare,
  Share2,
  BookmarkMinus,
} from "lucide-react";
import { ItineraryTab } from "@/components/ItineraryTab";
import { MapTab } from "@/components/MapTab";
import { ChatTab } from "@/components/ChatTab";
import { ChecklistTab } from "@/components/ChecklistTab";
import { EditLocationModal } from "@/components/EditLocationModal";
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
  readOnly?: boolean;
  ownerName?: string;
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
export function TripCompanionClient({
  trip,
  checklist,
  readOnly = false,
  ownerName,
}: TripCompanionClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("itinerary");
  const [selectedDay, setSelectedDay] = useState<number>(
    () => getDefaultDayNumber(trip.days, trip.start_date, trip.end_date)
  );
  const mapViewportRef = useRef<MapViewport | null>(null);
  const [tripState, setTripState] = useState<TripDetail>(() => trip);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const editingStop = editingStopId
    ? (tripState.days.flatMap((d) => d.stops).find((s) => s.id === editingStopId) ?? null)
    : null;

  const router = useRouter();
  const [shareCopied, setShareCopied] = useState(false);
  const [unsaving, setUnsaving] = useState(false);

  function handleLocationSave(stopId: string, address: string, lat: number, lng: number) {
    setTripState((prev) => ({
      ...prev,
      days: prev.days.map((day) => ({
        ...day,
        stops: day.stops.map((stop) =>
          stop.id === stopId ? { ...stop, address, lat, lng } : stop
        ),
      })),
    }));
    setMapKey((k) => k + 1);
    setEditingStopId(null);
  }

  async function handleShare() {
    const res = await fetch(`/api/trips/${tripState.id}/share`, { method: "POST" });
    if (!res.ok) return;
    const { url } = await res.json();
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function handleUnsave() {
    setUnsaving(true);
    const res = await fetch(`/api/trips/${tripState.id}/follow`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      router.push("/dashboard");
    } else {
      setUnsaving(false);
    }
  }

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
              {tripState.name}
            </h1>
            {readOnly ? (
              <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted">
                <span className="truncate">Saved trip · Shared by {ownerName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{tripState.destination}</span>
              </div>
            )}
          </div>
          {readOnly ? (
            <button
              onClick={handleUnsave}
              disabled={unsaving}
              className="mt-0.5 ml-auto shrink-0 text-muted hover:text-rust transition-colors disabled:opacity-60"
              aria-label="Unsave trip"
            >
              <BookmarkMinus className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleShare}
              className="mt-0.5 ml-auto shrink-0 text-muted hover:text-ink transition-colors"
              aria-label={shareCopied ? "Link copied!" : "Share trip"}
              title={shareCopied ? "Link copied!" : "Share trip"}
            >
              <Share2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 pb-20 max-w-2xl mx-auto w-full">
        {activeTab === "itinerary" && (
          <ItineraryTab
            days={tripState.days}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onEditStop={readOnly ? undefined : (id) => setEditingStopId(id)}
          />
        )}
        {activeTab === "map" && (
          <MapTab
            key={mapKey}
            days={tripState.days}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            savedViewport={mapViewportRef.current}
            onViewportChange={(vp) => { mapViewportRef.current = vp; }}
            onEditStop={readOnly ? undefined : (id) => setEditingStopId(id)}
          />
        )}
        {activeTab === "chat" && (
          <ChatTab
            tripId={tripState.id}
            tripName={tripState.name}
            destination={tripState.destination}
          />
        )}
        {activeTab === "checklist" && (() => {
          // readOnly prop will be wired in Task 10; cast until then
          const ChecklistTabAny = ChecklistTab as React.ComponentType<{ tripId: string; initialItems: ChecklistItem[]; readOnly?: boolean }>;
          return <ChecklistTabAny tripId={tripState.id} initialItems={checklist} readOnly={readOnly} />;
        })()}
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

      {!readOnly && editingStop && (
        <EditLocationModal
          stop={editingStop}
          tripId={tripState.id}
          onSave={handleLocationSave}
          onClose={() => setEditingStopId(null)}
        />
      )}
    </div>
  );
}
