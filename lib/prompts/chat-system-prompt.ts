import type { TripDetail, DayDetail, StopDetail, StopOption } from "@/types/trip";

/**
 * System prompt template for the trip companion chat assistant.
 *
 * Serializes the full trip itinerary into a structured text block so the
 * model has complete context about every day, stop, and option. The prompt
 * instructs the model to act as a knowledgeable travel assistant, use
 * Google Search for real-time information, and format responses in Markdown.
 */
export function buildChatSystemPrompt(trip: TripDetail): string {
  const dateRange =
    trip.start_date && trip.end_date
      ? `${trip.start_date} – ${trip.end_date}`
      : trip.start_date ?? "dates not specified";

  const itinerary = trip.days.map((day) => formatDay(day)).join("\n\n");

  return `You are a knowledgeable and friendly travel assistant for the trip "${trip.name}" to ${trip.destination} (${dateRange}).

You have full access to the traveler's itinerary below. Use it to answer questions about the trip, suggest improvements, provide local tips, and look up real-time information like opening hours, reservations, transport options, and current conditions using Google Search.

**Formatting rules:**
- Always respond using Markdown formatting.
- Use **bold** for place names, key facts, and important details.
- Use bullet lists (- item) for multi-item responses, recommendations, or options.
- Use numbered lists (1. item) for step-by-step instructions or ranked suggestions.
- Use ### headings to separate distinct sections when the response covers multiple topics.
- Keep responses concise — prefer short paragraphs or lists over dense prose.
- When citing Google Search results, briefly note what you found and the source.
- Whenever you mention a specific place, venue, or point of interest, make its name a Google Maps link using this exact Markdown pattern: [Place Name](https://www.google.com/maps/search/?api=1&query=URL-encoded-place-name). For example: [Colosseum](https://www.google.com/maps/search/?api=1&query=Colosseum+Rome). If you also know the address, include it as plain text after the link. If you don't know the place well enough to link it accurately, leave it as plain text.

--- ITINERARY ---

Trip: ${trip.name}
Destination: ${trip.destination}
Dates: ${dateRange}

${itinerary}

--- END ITINERARY ---`;
}

function formatDay(day: DayDetail): string {
  const dateStr = day.date ? ` (${day.date})` : "";
  const header = `Day ${day.day_number}${dateStr}: ${day.title}`;
  const dayNotes = day.notes ? `  Notes: ${day.notes}` : "";

  if (day.stops.length === 0) {
    return `${header}\n  (No stops scheduled)`;
  }

  const stops = day.stops.map((s) => formatStop(s)).join("\n");
  return [header, dayNotes, stops].filter(Boolean).join("\n");
}

function formatStop(stop: StopDetail): string {
  const time = stop.time ? ` at ${stop.time}` : "";
  const address = stop.address ? ` — ${stop.address}` : "";
  const notes = stop.notes ? `\n    Notes: ${stop.notes}` : "";
  const type = stop.type !== "other" ? ` [${stop.type}]` : "";

  let line = `  • ${stop.name}${type}${time}${address}${notes}`;

  if (stop.options.length > 0) {
    const opts = stop.options.map((o) => formatOption(o)).join("\n");
    line += `\n    Options:\n${opts}`;
  }

  return line;
}

function formatOption(opt: StopOption): string {
  const address = opt.address ? ` — ${opt.address}` : "";
  const notes = opt.notes ? ` (${opt.notes})` : "";
  return `      - ${opt.name} [${opt.type}]${address}${notes}`;
}
