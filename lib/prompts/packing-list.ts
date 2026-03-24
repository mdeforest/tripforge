/** A single packing list item returned by the AI. */
export interface PackingItem {
  category: string;
  label: string;
  /** One-sentence explanation of why this item is relevant to this specific trip. Null for custom user-added items. */
  reason: string | null;
}

export interface StopSummary {
  name: string;
  type: string;
  notes: string | null;
}

/**
 * Prompt to generate a smart packing list tailored to the trip.
 *
 * Returns a JSON object with an `items` array of { category, label } objects.
 * DeepSeek is called with json_object mode so no code fences are included.
 */
export function buildPackingListPrompt(
  tripName: string,
  destination: string,
  durationDays: number,
  startDate: string | null,
  tripNotes: string | null,
  stops: StopSummary[]
): string {
  const durationLabel = `${durationDays} day${durationDays !== 1 ? "s" : ""}`;

  const month = startDate
    ? new Date(startDate + "T12:00:00Z").toLocaleString("en-US", { month: "long" })
    : null;

  const activities = stops.filter((s) => s.type === "activity");
  const hotels = stops.filter((s) => s.type === "hotel");
  const transport = stops.filter((s) => s.type === "transport");
  const restaurants = stops.filter((s) => s.type === "restaurant");

  function formatStops(list: StopSummary[]): string {
    return list.map((s) => (s.notes ? `- ${s.name} (${s.notes})` : `- ${s.name}`)).join("\n");
  }

  const sections: string[] = [];

  if (month) sections.push(`Travel month: ${month}`);
  if (tripNotes) sections.push(`Trip notes: ${tripNotes}`);
  if (activities.length > 0) sections.push(`Activities:\n${formatStops(activities)}`);
  if (hotels.length > 0) sections.push(`Accommodation:\n${formatStops(hotels)}`);
  if (transport.length > 0) sections.push(`Transport legs:\n${formatStops(transport)}`);
  if (restaurants.length > 0)
    sections.push(`Dining (${restaurants.length} restaurant/dining stop(s))`);

  return `Generate a comprehensive packing list for the following trip.

Trip: ${tripName}
Destination: ${destination}
Duration: ${durationLabel}
${sections.join("\n")}

Return ONLY a valid JSON object in this exact format — no markdown, no code fences, no explanation:
{
  "items": [
    { "category": "Clothing", "label": "Rain jacket", "reason": "Rome in March averages 12°C with frequent rain." },
    { "category": "Toiletries", "label": "Sunscreen SPF 50", "reason": "Full-day outdoor sightseeing in direct sun." }
  ]
}

Rules:
- Include 25–40 items total across all categories
- Use ONLY these category names (exact spelling): Clothing, Footwear, Toiletries, Electronics, Documents, Health & Safety, Accessories, Other
- Tailor items specifically to the activities, climate for the travel month, and destination — avoid generic lists
- For each named activity, add at least one specific item directly related to it (e.g. "scuba diving" → "dive mask and snorkel"; "hiking" → "trekking poles"; "formal dinner" → "dress shoes")
- If transport legs include flights, add flight-comfort items (e.g. neck pillow, noise-cancelling headphones, compression socks)
- Always include essentials: passport/ID, travel adapter, phone charger, medications
- Labels must be plain item names only — NO "for X", "to X", or any reason/justification appended (good: "Rain jacket"; bad: "Rain jacket for afternoon showers")
- The reason must be a single specific sentence tied to this trip — mention the destination, season, or a named activity. Never write a generic reason like "useful to have" or "good for travel".
- Do NOT include apps, software, or anything a smartphone handles by default (no "translation app", "maps app", "phrasebook", "printed maps", "travel guidebook")
- Do NOT include a dedicated camera unless the trip explicitly involves photography as a named activity
- Keep each label concise (2–5 words)
- Do NOT duplicate items`;
}
