/**
 * TypeScript types for the structured itinerary JSON returned by Claude.
 * These mirror the exact schema in the Claude parsing prompt.
 */

export type StopType = "hotel" | "restaurant" | "activity" | "transport" | "other";

export interface ParsedStop {
  name: string;
  type: StopType;
  /** Display time string (e.g. "10:30 AM"), or null if not specified */
  time: string | null;
  /** Full address, or null if not specified */
  address: string | null;
  /** Additional notes from the itinerary, or null */
  notes: string | null;
  /** 1-indexed display order within the day */
  order: number;
}

export interface ParsedDay {
  dayNumber: number;
  /** ISO date string "YYYY-MM-DD", or null for undated itineraries */
  date: string | null;
  /** Day title (e.g. "Arrival in Rome") */
  title: string;
  stops: ParsedStop[];
}

export interface ParsedItinerary {
  tripName: string;
  /** Primary destination (e.g. "Tokyo, Japan") */
  destination: string;
  /** ISO date string "YYYY-MM-DD", or null */
  startDate: string | null;
  /** ISO date string "YYYY-MM-DD", or null */
  endDate: string | null;
  days: ParsedDay[];
}
