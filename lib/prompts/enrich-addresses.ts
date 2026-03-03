/**
 * Prompt template used by enrichAddresses() to fill in missing or vague addresses.
 *
 * Use buildEnrichAddressesPrompt() to assemble the final prompt.
 * All stops are sent; Claude decides which ones need a real address and returns only those patches,
 * keyed by "dayIndex-stopIndex" (or "dayIndex-stopIndex-optIndex" for options).
 */

export interface StopToEnrich {
  /** Unique key: "di-si" for stops, "di-si-oi" for options within a stop */
  key: string;
  name: string;
  type: string;
  /** Current address value — may be null, a real address, or descriptive text */
  address: string | null;
  /** Stop notes for additional geographic context */
  notes: string | null;
}

const ENRICH_ADDRESSES_PROMPT = `You are a travel geography expert. Review the following travel stops and provide real, map-resolvable addresses for any that are missing one.

Trip destination: {destination}

All stops:
{stopsJson}

A stop needs a new address when its current address is:
- null or missing
- only a city, neighborhood, or region (e.g. "Rome", "Cannaregio", "Near the Pantheon")
- descriptive text, directions, or notes rather than a geographic address

For stops that already have a specific street address, skip them (do not include in the output).

For stops that need an address:
1. Return a real, map-resolvable address (e.g. "Piazza del Colosseo, 1, 00184 Roma RM, Italy")
2. For famous landmarks, use their well-known address
3. For hotels and restaurants, use their real street address if known
4. For airports and train stations, use the facility's address
5. For transport legs (flights, trains), use the departure location's address
6. If you genuinely don't know a specific address, return null — do not hallucinate
7. Always include city and country

Return ONLY valid JSON — an array of patches for stops that need updating (omit stops that already have a good address):
[
  {"key": "0-0", "address": "specific address or null"}
]

If no stops need updating, return an empty array: []`;

/**
 * Assembles the final prompt for an address enrichment call.
 *
 * @param destination  The trip's primary destination (used as geographic context).
 * @param stops        All stops in the itinerary — Claude determines which need enrichment.
 */
export function buildEnrichAddressesPrompt(
  destination: string,
  stops: StopToEnrich[],
): string {
  return ENRICH_ADDRESSES_PROMPT
    .replace("{destination}", destination)
    .replace("{stopsJson}", JSON.stringify(stops, null, 2));
}
