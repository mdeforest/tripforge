"use client";

import { useState } from "react";
import { Bed, Utensils, Star, Car, MapPin, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { StopDetail, StopOption } from "@/types/trip";

const STOP_ICONS = {
  hotel: Bed,
  restaurant: Utensils,
  activity: Star,
  transport: Car,
  other: MapPin,
} as const;

const OPTION_ICONS = {
  restaurant: Utensils,
  activity: Star,
} as const;

interface StopCardProps {
  stop: StopDetail;
}

function OptionItem({ option }: { option: StopOption }) {
  const Icon = OPTION_ICONS[option.type];
  return (
    <div className="flex gap-2.5 rounded-lg bg-parchment px-3 py-2.5">
      <span className="mt-0.5 text-xs font-semibold text-muted w-4 shrink-0 text-right">
        {option.order}.
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-sm font-medium text-ink leading-tight">{option.name}</span>
        </div>
        {option.notes && (
          <p className="mt-0.5 text-xs text-muted italic">{option.notes}</p>
        )}
        {option.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(option.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-0.5 text-xs text-rust hover:text-rust-dark font-medium"
          >
            {option.address}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Expandable stop card with a stop-type icon.
 * Collapsed: icon + name + time + options badge (when options exist).
 * Expanded: address, notes, Get Directions link, and options list.
 */
export function StopCard({ stop }: StopCardProps) {
  const [expanded, setExpanded] = useState(false);

  const Icon = STOP_ICONS[stop.type] ?? MapPin;
  const hasOptions = (stop.options ?? []).length > 0;
  const hasDetails = stop.address || stop.notes || hasOptions;

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${stop.name}${stop.time ? `, ${stop.time}` : ""}`}
      >
        <span
          data-testid="stop-icon"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-parchment text-rust"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="flex-1 min-w-0">
          <span className="block font-medium text-ink leading-tight truncate">{stop.name}</span>
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {stop.time && (
            <span className="text-xs text-muted">{stop.time}</span>
          )}
          {hasOptions && (
            <span
              data-testid="options-badge"
              className="rounded bg-parchment px-1.5 py-0.5 text-xs font-medium text-rust-dark"
            >
              {stop.options.length} options
            </span>
          )}
          {hasDetails && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" />
              : <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
          )}
        </span>
      </button>

      {expanded && hasDetails && (
        <div className="px-4 pb-4 pt-1 border-t border-parchment space-y-2">
          {stop.address && (
            <p className="text-sm text-ink-mid">{stop.address}</p>
          )}
          {stop.notes && (
            <p className="text-sm text-muted italic">{stop.notes}</p>
          )}
          {stop.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-rust hover:text-rust-dark font-medium"
            >
              Get Directions
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}

          {hasOptions && (
            <div className="pt-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Options
              </p>
              <div className="space-y-1.5">
                {(stop.options ?? []).map((opt) => (
                  <OptionItem key={opt.order} option={opt} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
