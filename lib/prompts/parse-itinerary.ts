/**
 * Prompt template used by parseItinerary() to extract structured trip data from raw text.
 *
 * Use buildParsePrompt() to assemble the final prompt — it fills {segmentNote} and {rawText}.
 * Edit rules below to tune extraction quality; no other code changes needed.
 */
const PARSE_ITINERARY_PROMPT = `{segmentNote}You are an expert travel itinerary parser. Extract structured data from the following itinerary document and return ONLY valid JSON in this exact format:

{
  "tripName": "string",
  "destination": "string (primary destination)",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "notes": "string or null (overall trip context, special logistics, or overarching notes; null if none)",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD or null",
      "title": "string",
      "notes": "string or null",
      "stops": [
        {
          "name": "string",
          "type": "hotel | restaurant | activity | transport | other",
          "time": "string or null",
          "address": "string or null",
          "notes": "string or null",
          "order": 1,
          "options": [
            {
              "name": "string",
              "type": "restaurant | activity",
              "address": "string or null",
              "notes": "string or null",
              "order": 1
            }
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Preserve detail & specificity - keep original names, addresses, notes
2. Don't merge distinct activities
3. ALWAYS include "options" on every stop — use empty array [] when no alternatives exist
4. ALWAYS include "notes" on every day — use null when no day-wide context exists
5. Types: hotel|restaurant|activity|transport|other (prefer specific over "other")
6. Keep original time format, null if none
7. address = a real geographic address (street, city, country) or null — NEVER put descriptions, notes, directions, reviews, or opinions into the address field; those belong in the "notes" field
8. Number days starting from 1 within this document
9. Day notes = day-wide context only (theme, pacing, constraints); null if none
10. Return ONLY valid JSON, no explanations, no markdown
11. PRESERVE THE ORIGINAL YEAR from the text when explicitly given
12. If a date has no year (e.g., "May 11"), infer it from other dates visible in this document
13. If you see a year transition in the text (e.g., from 2025 to 2026), respect it
14. Keep dates in YYYY-MM-DD format
15. Avoid null for dates — infer from context when possible; use null only when truly unknown

ITINERARY:
{rawText}`;

/**
 * Assembles the final prompt for a parse call.
 *
 * @param rawText   The extracted itinerary text to parse.
 * @param chunkInfo When chunking, pass the segment index (1-based) and total chunk count.
 *                  The model is told it's a fragment so it doesn't hallucinate trip-level fields.
 */
export function buildParsePrompt(
  rawText: string,
  chunkInfo?: { index: number; total: number },
): string {
  let segmentNote = "";
  if (chunkInfo) {
    if (chunkInfo.index === 1) {
      segmentNote =
        `SEGMENT 1 OF ${chunkInfo.total}: You are parsing the FIRST segment of a larger itinerary ` +
        `that has been split for processing. ` +
        `The document header (tripName, destination, startDate, endDate) is likely in this segment — ` +
        `extract those fields from the header text. ` +
        `If a field is genuinely absent, use empty string for string fields and null for dates. ` +
        `Number days starting from 1 within this segment.\n\n`;
    } else {
      segmentNote =
        `SEGMENT ${chunkInfo.index} OF ${chunkInfo.total}: You are parsing a middle/late segment of ` +
        `a larger itinerary. The trip header (tripName, destination, startDate) will NOT appear here — ` +
        `use empty string for those string fields. ` +
        `endDate may appear if this is the last segment; otherwise use null. ` +
        `Number days starting from 1 within this segment.\n\n`;
    }
  }

  return PARSE_ITINERARY_PROMPT
    .replace("{segmentNote}", segmentNote)
    .replace("{rawText}", rawText);
}
