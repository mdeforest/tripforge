"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import type { StopDetail } from "@/types/trip";

interface MapboxFeature {
  properties: { full_address?: string; name: string };
  geometry: { coordinates: [number, number] };
}

interface EditLocationModalProps {
  stop: StopDetail;
  tripId: string;
  onSave: (stopId: string, address: string, lat: number, lng: number) => void;
  onClose: () => void;
}

export function EditLocationModal({ stop, tripId, onSave, onClose }: EditLocationModalProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [query, setQuery] = useState(stop.address ?? "");
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [selected, setSelected] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced geocode fetch
  useEffect(() => {
    if (!token || !query.trim() || selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${token}&limit=5&proximity=ip`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        // silent — suggestions just won't appear
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, selected]);

  // Escape key closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSelect(feature: MapboxFeature) {
    const address = feature.properties.full_address ?? feature.properties.name;
    const [lng, lat] = feature.geometry.coordinates;
    setSelected({ address, lat, lng });
    setQuery(address);
    setSuggestions([]);
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setSelected(null); // clear selection — re-requires picking from dropdown
    setError(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      if (!res.ok) throw new Error("save failed");
      onSave(stop.id, selected.address, selected.lat, selected.lng);
    } catch {
      setError("Failed to save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-cream shadow-xl border border-parchment-dark p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Edit location</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted mb-3">{stop.name}</p>

        {!token ? (
          <p className="text-sm text-muted italic">Location search unavailable.</p>
        ) : (
          <div className="relative">
            <label htmlFor="location-search" className="sr-only">Search address</label>
            <input
              id="location-search"
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search for a location…"
              className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-rust/40"
            />

            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-parchment-dark bg-white shadow-md z-10">
                {suggestions.map((f, i) => {
                  const label = f.properties.full_address ?? f.properties.name;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handleSelect(f)}
                        className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-parchment transition-colors"
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
