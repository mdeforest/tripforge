import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ParsedItinerary } from "@/types/itinerary";
import { buildParsePrompt } from "@/lib/prompts/parse-itinerary";

/** Error thrown when the AI response cannot be parsed as a valid ParsedItinerary */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const VALID_STOP_TYPES = new Set(["hotel", "restaurant", "activity", "transport", "other"]);
const VALID_OPTION_TYPES = new Set(["restaurant", "activity"]);

/** Which AI provider to use. Set AI_PROVIDER=deepseek to switch; defaults to claude. */
const AI_PROVIDER = (process.env.AI_PROVIDER ?? "claude").toLowerCase();

// Max input chars per chunk — keeps output well within any provider's 8K output token limit.
// At ~5 output chars/token, a 12K-char chunk produces ~2,400–2,800 output tokens (30–35% of cap).
const CHUNK_CHARS = 12_000;

/**
 * Estimates the max_tokens needed for the AI response based on input length.
 *
 * Calibrated from Italy PDF: ~5 output chars/token for compact JSON. input_chars/4 + 300
 * gives ~25% headroom at typical scale, hitting the 8192 cap for inputs ≥ ~31k chars.
 * Floor of 1024 covers minimum JSON structure for any valid itinerary.
 */
function computeMaxTokens(inputChars: number): number {
  return Math.max(1024, Math.min(8192, Math.ceil(inputChars / 4) + 300));
}

/**
 * Strips optional markdown code fences that Claude occasionally wraps around JSON.
 * Handles: ```json ... ``` and ``` ... ```
 */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/**
 * Validates that the parsed object has the required top-level fields and structure.
 *
 * When isChunk=true, missing tripName/destination are coerced rather than rejected —
 * later chunks won't repeat the trip header, and mergeItineraries() picks the best
 * values across all chunks.
 */
function validateItinerary(obj: unknown, isChunk = false): ParsedItinerary {
  if (typeof obj !== "object" || obj === null) {
    throw new ParseError("AI response is not a JSON object.");
  }

  const raw = obj as Record<string, unknown>;

  if (typeof raw.tripName !== "string" || !raw.tripName) {
    if (!isChunk) throw new ParseError("Missing or invalid 'tripName' in parsed itinerary.");
    raw.tripName = "";
  }
  if (typeof raw.destination !== "string" || !raw.destination) {
    if (!isChunk) throw new ParseError("Missing or invalid 'destination' in parsed itinerary.");
    raw.destination = "";
  }
  if (typeof raw.notes !== "string" || !raw.notes) raw.notes = null;
  if (!Array.isArray(raw.days) || raw.days.length === 0) {
    throw new ParseError("Parsed itinerary has no 'days' array.");
  }

  for (const day of raw.days) {
    if (typeof day !== "object" || day === null) throw new ParseError("A day entry is not an object.");
    const d = day as Record<string, unknown>;
    if (typeof d.dayNumber !== "number") throw new ParseError("Day missing 'dayNumber'.");
    if (typeof d.title !== "string") throw new ParseError("Day missing 'title'.");
    if (!Array.isArray(d.stops)) throw new ParseError("Day missing 'stops' array.");

    for (const stop of d.stops) {
      if (typeof stop !== "object" || stop === null) throw new ParseError("A stop entry is not an object.");
      const s = stop as Record<string, unknown>;
      if (typeof s.name !== "string" || !s.name) throw new ParseError("Stop missing 'name'.");
      if (!VALID_STOP_TYPES.has(s.type as string)) s.type = "other";
      if (typeof s.order !== "number") s.order = 0;
      if (!Array.isArray(s.options)) s.options = [];
      for (const opt of s.options as Record<string, unknown>[]) {
        if (typeof opt !== "object" || opt === null) continue;
        if (!VALID_OPTION_TYPES.has(opt.type as string)) opt.type = "activity";
        if (typeof opt.order !== "number") opt.order = 0;
      }
    }

    if (d.notes === undefined) d.notes = null;
  }

  return raw as unknown as ParsedItinerary;
}

/**
 * Splits raw text into chunks at day-boundary markers.
 * Falls back to splitting by character count if no markers are found.
 */
function splitIntoChunks(text: string): string[] {
  const dayBoundary =
    /(?=\n(?:Day\s+\d+|DAY\s+\d+|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b,))/i;

  const parts = text.split(dayBoundary).filter((p) => p.trim().length > 0);

  if (parts.length <= 1) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_CHARS) {
      chunks.push(text.slice(i, i + CHUNK_CHARS));
    }
    return chunks;
  }

  // Group day-boundary parts into chunks that fit within CHUNK_CHARS
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
 * Scalar fields (tripName, destination, dates) come from the first/last chunk that has them.
 * Days are concatenated in document order and re-numbered sequentially from 1.
 *
 * Re-numbering is necessary because itinerary documents often use per-section numbering
 * (e.g. "Day 1" in Rome, "Day 1" in Venice). Preserving chunk order and re-numbering
 * gives the correct global sequence.
 */
function mergeItineraries(results: ParsedItinerary[]): ParsedItinerary {
  const days = results
    .flatMap((r) => r.days)
    .map((day, i) => ({ ...day, dayNumber: i + 1 }));

  return {
    tripName: results.find((r) => r.tripName)?.tripName ?? "Unknown Trip",
    destination: results.find((r) => r.destination)?.destination ?? "Unknown",
    startDate: results.find((r) => r.startDate)?.startDate ?? null,
    endDate: [...results].reverse().find((r) => r.endDate)?.endDate ?? null,
    notes: results.find((r) => r.notes)?.notes ?? null,
    days,
  };
}

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function getDeepseekClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
  }
  return _openai;
}

type ChunkInfo = { index: number; total: number };

async function callClaude(
  rawText: string,
  maxTokens = computeMaxTokens(rawText.length),
  chunkInfo?: ChunkInfo,
): Promise<{ text: string; truncated: boolean }> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: buildParsePrompt(rawText, chunkInfo) }],
  });
  const firstContent = message.content[0];
  if (firstContent.type !== "text") throw new ParseError("Unexpected response type from Claude.");
  return { text: firstContent.text, truncated: message.stop_reason === "max_tokens" };
}

/**
 * Calls DeepSeek with json_object mode (guaranteed valid JSON, no fences) and temperature=0
 * for deterministic structured extraction.
 */
async function callDeepseek(
  rawText: string,
  maxTokens = computeMaxTokens(rawText.length),
  chunkInfo?: ChunkInfo,
): Promise<{ text: string; truncated: boolean }> {
  const client = getDeepseekClient();
  console.log(`[deepseek] Sending request (${rawText.length} chars, max_tokens=${maxTokens})`);
  const completion = await client.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: maxTokens,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildParsePrompt(rawText, chunkInfo) }],
  });
  const choice = completion.choices[0];
  const truncated = choice.finish_reason === "length";
  console.log(`[deepseek] finish_reason=${choice.finish_reason}, length=${choice.message.content?.length ?? 0}`);
  return { text: choice.message.content ?? "", truncated };
}

async function callAI(
  rawText: string,
  maxTokens?: number,
  chunkInfo?: ChunkInfo,
): Promise<{ text: string; truncated: boolean }> {
  return AI_PROVIDER === "deepseek"
    ? callDeepseek(rawText, maxTokens, chunkInfo)
    : callClaude(rawText, maxTokens, chunkInfo);
}

/** Strips fences, JSON.parses, and validates a single AI response. */
function parseAndValidate(text: string, isChunk: boolean): ParsedItinerary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(text));
  } catch {
    console.error("[parseItinerary] JSON parse failed:\n", text.slice(0, 500));
    throw new ParseError(`AI returned invalid JSON: ${text.slice(0, 200)}`);
  }
  return validateItinerary(parsed, isChunk);
}

/**
 * Extracts structured itinerary data from raw text.
 *
 * For small inputs: tries a single API call; falls back to chunking if truncated.
 * For large inputs (computeMaxTokens hits the 8192 cap): skips the wasted first call
 * and goes straight to chunked parsing — splits at day boundaries into CHUNK_CHARS-sized
 * pieces, processes them in parallel, then merges the results.
 *
 * @throws ParseError if the AI response is not valid/complete JSON
 * @throws Error if the API call itself fails (caller should handle timeouts)
 */
export async function parseItinerary(rawText: string): Promise<ParsedItinerary> {
  console.log(`[parseItinerary] provider=${AI_PROVIDER}, input=${rawText.length} chars`);

  // When computeMaxTokens hits the cap, the output is likely to overflow — skip straight to chunks.
  const likelyOverflows = computeMaxTokens(rawText.length) === 8192;

  if (!likelyOverflows) {
    const { text, truncated } = await callAI(rawText);
    if (!truncated) return parseAndValidate(text, false);
    // Unexpected truncation for a "small" input — fall through to chunking
    console.log(`[parseItinerary] Unexpected truncation, falling back to chunks`);
  }

  const chunks = splitIntoChunks(rawText);
  console.log(`[parseItinerary] ${likelyOverflows ? "Large input" : "Truncated"}, chunking into ${chunks.length} piece(s)`);

  const results = await Promise.all(
    chunks.map(async (chunk, i) => {
      // Chunks use the full 8192 cap — dense content can produce a high output/input ratio,
      // so we don't try to be clever here. Providers bill actual tokens, not max_tokens.
      const { text, truncated } = await callAI(chunk, 8192, { index: i + 1, total: chunks.length });
      console.log(`[parseItinerary] Chunk ${i + 1}/${chunks.length}: truncated=${truncated}`);
      if (truncated) {
        throw new ParseError("An itinerary chunk was too long to parse. Try uploading a shorter itinerary.");
      }
      return parseAndValidate(text, chunks.length > 1);
    })
  );

  return results.length === 1 ? results[0] : mergeItineraries(results);
}
