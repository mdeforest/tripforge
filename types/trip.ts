import type { StopType, OptionType } from "@/types/itinerary";

/** An alternative option within a stop (e.g. one of several lunch choices). */
export interface StopOption {
  name: string;
  type: OptionType;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  order: number;
}

/** A single stop as stored in the DB, with Date fields serialized to ISO strings. */
export interface StopDetail {
  id: string;
  name: string;
  type: StopType;
  time: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  order: number;
  options: StopOption[];
}

/** A single day with its stops, with the date serialized to an ISO string. */
export interface DayDetail {
  id: string;
  day_number: number;
  date: string | null; // ISO "YYYY-MM-DD" or null
  title: string;
  notes: string | null;
  stops: StopDetail[];
}

/**
 * Full trip with nested days and stops.
 * All Date fields are serialized to ISO strings so this type is safe to pass
 * from a server component to a client component.
 */
export interface TripDetail {
  id: string;
  name: string;
  destination: string;
  start_date: string | null; // ISO "YYYY-MM-DD" or null
  end_date: string | null;
  days: DayDetail[];
}

/** A single packing checklist item, as stored in the DB. */
export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  reason: string | null;
  checked: boolean;
  is_custom: boolean;
}
