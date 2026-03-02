import Anthropic from "@anthropic-ai/sdk";
import type { ParsedItinerary } from "@/types/itinerary";

/** Error thrown when Claude's response cannot be parsed as a valid ParsedItinerary */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const VALID_STOP_TYPES = new Set(["hotel", "restaurant", "activity", "transport", "other"]);

// claude-sonnet-4-6 supports up to 8192 output tokens
const MAX_OUTPUT_TOKENS = 8192;
// Split input into chunks of this many chars to keep output well within the limit
const CHUNK_CHARS = 12_000;

/** Exact prompt template from the build plan. {rawText} is replaced at call time. */
const PARSE_PROMPT = `You are an expert travel itinerary parser. Extract structured data from the following itinerary document and return ONLY valid JSON in this exact format:

{
  "tripName": "string",
  "destination": "string (primary destination)",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD or null",
      "title": "string",
      "stops": [
        {
          "name": "string",
          "type": "hotel | restaurant | activity | transport | other",
          "time": "string or null",
          "address": "string or null",
          "notes": "string or null",
          "order": 1
        }
      ]
    }
  ]
}

Return only the JSON object. No explanations. No markdown.

ITINERARY:
{rawText}`;

/**
 * Strips optional markdown code fences that Claude occasionally wraps around JSON.
 * Handles: ```json ... ``` and ``` ... ```
 */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/**
 * Validates that the parsed object has the required top-level fields and structure.
 * Throws ParseError if the shape is wrong.
 */
function validateItinerary(obj: unknown): ParsedItinerary {
  if (typeof obj !== "object" || obj === null) {
    throw new ParseError("Claude response is not a JSON object.");
  }

  const raw = obj as Record<string, unknown>;

  if (typeof raw.tripName !== "string" || !raw.tripName) {
    throw new ParseError("Missing or invalid 'tripName' in parsed itinerary.");
  }
  if (typeof raw.destination !== "string" || !raw.destination) {
    throw new ParseError("Missing or invalid 'destination' in parsed itinerary.");
  }
  if (!Array.isArray(raw.days) || raw.days.length === 0) {
    throw new ParseError("Parsed itinerary has no 'days' array.");
  }

  // Validate each day has required fields
  for (const day of raw.days) {
    if (typeof day !== "object" || day === null) {
      throw new ParseError("A day entry is not an object.");
    }
    const d = day as Record<string, unknown>;
    if (typeof d.dayNumber !== "number") throw new ParseError("Day missing 'dayNumber'.");
    if (typeof d.title !== "string") throw new ParseError("Day missing 'title'.");
    if (!Array.isArray(d.stops)) throw new ParseError("Day missing 'stops' array.");

    // Validate each stop
    for (const stop of d.stops) {
      if (typeof stop !== "object" || stop === null) {
        throw new ParseError("A stop entry is not an object.");
      }
      const s = stop as Record<string, unknown>;
      if (typeof s.name !== "string" || !s.name) throw new ParseError("Stop missing 'name'.");
      if (!VALID_STOP_TYPES.has(s.type as string)) {
        // Coerce unknown types to "other" instead of failing hard
        s.type = "other";
      }
      if (typeof s.order !== "number") s.order = 0;
    }
  }

  return raw as unknown as ParsedItinerary;
}

/**
 * Splits raw text into chunks at day-boundary markers.
 * Falls back to splitting by character count if no markers are found.
 */
function splitIntoChunks(text: string): string[] {
  // Match the start of day-header lines: "Day 1", "DAY 1", "Day One", or weekday names
  const dayBoundary =
    /(?=\n(?:Day\s+\d+|DAY\s+\d+|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b,))/i;

  const parts = text.split(dayBoundary).filter((p) => p.trim().length > 0);

  // No day markers found — split by raw character count
  if (parts.length <= 1) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_CHARS) {
      chunks.push(text.slice(i, i + CHUNK_CHARS));
    }
    return chunks;
  }

  // Group the day-boundary parts into chunks that fit within CHUNK_CHARS
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current.length + part.length > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Merges multiple partial ParsedItinerary objects from chunked parsing.
 * Scalar fields (tripName, destination, dates) come from the first/last chunk
 * that has them; days are concatenated and sorted by dayNumber.
 */
function mergeItineraries(results: ParsedItinerary[]): ParsedItinerary {
  return {
    tripName: results.find((r) => r.tripName)?.tripName ?? "Unknown Trip",
    destination: results.find((r) => r.destination)?.destination ?? "Unknown",
    startDate: results.find((r) => r.startDate)?.startDate ?? null,
    endDate: [...results].reverse().find((r) => r.endDate)?.endDate ?? null,
    days: results
      .flatMap((r) => r.days)
      .sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

let _client: Anthropic | null = null;

/** Returns a shared Anthropic client (lazy singleton) */
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Makes a single Claude API call and returns the raw text plus stop reason.
 * Does not parse or validate JSON — that's the caller's job.
 */
async function callClaude(rawText: string): Promise<{ text: string; stopReason: string }> {
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "user",
        content: PARSE_PROMPT.replace("{rawText}", rawText),
      },
    ],
  });

  const firstContent = message.content[0];
  if (firstContent.type !== "text") {
    throw new ParseError("Unexpected response type from Claude.");
  }

  return { text: firstContent.text, stopReason: message.stop_reason ?? "end_turn" };
}

/**
 * Calls Claude to extract structured itinerary data from raw text.
 *
 * For long itineraries that exceed the output token limit, automatically
 * splits the text into day-boundary chunks, parses each in parallel,
 * and merges the results.
 *
 * @throws ParseError if Claude's response is not valid/complete JSON
 * @throws Error if the API call itself fails (caller should handle timeouts)
 */
export async function parseItinerary(rawText: string): Promise<ParsedItinerary> {
  const { text, stopReason } = await callClaude(rawText);

  // Happy path: response completed normally
  if (stopReason !== "max_tokens") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(text));
    } catch {
      throw new ParseError(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
    }
    return validateItinerary(parsed);
  }

  // Output was truncated — split into chunks and re-parse in parallel
  const chunks = splitIntoChunks(rawText);
  if (chunks.length <= 1) {
    throw new ParseError(
      "This itinerary is too long to parse even in a single chunk. Try splitting it into smaller sections."
    );
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const { text: chunkText, stopReason: chunkStop } = await callClaude(chunk);
      if (chunkStop === "max_tokens") {
        throw new ParseError(
          "An itinerary chunk was still too long to parse. Try uploading a shorter itinerary."
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripCodeFences(chunkText));
      } catch {
        throw new ParseError(`Claude returned invalid JSON for a chunk: ${chunkText.slice(0, 200)}`);
      }
      return validateItinerary(parsed);
    })
  );

  return mergeItineraries(chunkResults);
}
