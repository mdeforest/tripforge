/**
 * TypeScript types for the structured itinerary JSON returned by Claude.
 * These mirror the exact schema in lib/prompts/parse-itinerary.ts.
 */

export type StopType = "hotel" | "restaurant" | "activity" | "transport" | "other";
export type OptionType = "restaurant" | "activity";

/** A concrete alternative within a stop that offers multiple choices (e.g. lunch options). */
export interface ParsedStopOption {
  name: string;
  type: OptionType;
  address: string | null;
  notes: string | null;
  order: number;
}

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
  /**
   * Alternative choices when this stop represents a decision point
   * (e.g. "Lunch Options" with options A/B/C). Empty array when none.
   */
  options: ParsedStopOption[];
}

export interface ParsedDay {
  dayNumber: number;
  /** ISO date string "YYYY-MM-DD", or null for undated itineraries */
  date: string | null;
  /** Day title (e.g. "Arrival in Rome") */
  title: string;
  /**
   * Day-wide context note (overall theme, pacing, major constraints).
   * Null when no meaningful day-wide note exists.
   */
  notes: string | null;
  stops: ParsedStop[];
}

export interface ParsedItinerary {
  tripName: string;
  /** Primary destination, with sub-destinations in parens when present */
  destination: string;
  /** ISO date string "YYYY-MM-DD", or null */
  startDate: string | null;
  /** ISO date string "YYYY-MM-DD", or null */
  endDate: string | null;
  /** Overall trip context, special logistics, or overarching notes. Null if none. */
  notes: string | null;
  days: ParsedDay[];
}
