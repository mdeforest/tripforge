import OpenAI from "openai";
import type { ParsedItinerary } from "@/types/itinerary";
import { buildEnrichAddressesPrompt, type StopToEnrich } from "@/lib/prompts/enrich-addresses";

// Max stops per enrichment chunk. Keeps response well within the 4096-token output cap
// (40 stops × ~100 chars/patch ÷ 4 chars/token ≈ 1,000 tokens — plenty of headroom).
const ENRICH_CHUNK_SIZE = 40;

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

let _openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_openai)
    _openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
  return _openai;
}

/**
 * Calls DeepSeek with one chunk of stops and returns the address patches it decides to apply.
 * Throws if the response is truncated or unparseable — callers handle the error.
 */
async function enrichChunk(
  client: OpenAI,
  destination: string,
  chunk: StopToEnrich[],
): Promise<{ key: string; address: string | null }[]> {
  const completion = await client.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 4096,
    temperature: 0,
    messages: [{ role: "user", content: buildEnrichAddressesPrompt(destination, chunk) }],
  });

  const choice = completion.choices[0];
  if (choice.finish_reason === "length") throw new Error("Enrichment chunk response was truncated.");

  return JSON.parse(stripCodeFences(choice.message.content ?? "[]"));
}

/**
 * Post-processes a parsed itinerary by filling in missing or vague addresses.
 *
 * All stops are sent to Claude (in parallel chunks of up to ENRICH_CHUNK_SIZE) so that
 * it can determine which ones need a real geographic address — no code-level heuristics.
 * Claude returns only the patches it wants to apply; chunks are merged into a single
 * address map and applied to a cloned itinerary.
 *
 * Always returns a valid ParsedItinerary — if enrichment fails for any reason, the
 * original itinerary is returned unchanged.
 */
export async function enrichAddresses(itinerary: ParsedItinerary): Promise<ParsedItinerary> {
  const allStops: StopToEnrich[] = [];

  for (let di = 0; di < itinerary.days.length; di++) {
    const day = itinerary.days[di];
    for (let si = 0; si < day.stops.length; si++) {
      const stop = day.stops[si];
      allStops.push({ key: `${di}-${si}`, name: stop.name, type: stop.type, address: stop.address, notes: stop.notes });
      for (let oi = 0; oi < stop.options.length; oi++) {
        const opt = stop.options[oi];
        allStops.push({ key: `${di}-${si}-${oi}`, name: opt.name, type: opt.type, address: opt.address, notes: opt.notes });
      }
    }
  }

  if (allStops.length === 0) return itinerary;

  // Truncate notes to keep prompt size manageable — the name and type are the main signals
  const stopsForPrompt = allStops.map((s) => ({
    ...s,
    notes: s.notes && s.notes.length > 200 ? s.notes.slice(0, 200) + "…" : s.notes,
  }));

  // Split into fixed-size chunks
  const chunks: StopToEnrich[][] = [];
  for (let i = 0; i < stopsForPrompt.length; i += ENRICH_CHUNK_SIZE) {
    chunks.push(stopsForPrompt.slice(i, i + ENRICH_CHUNK_SIZE));
  }

  console.log(`[enrichAddresses] Checking ${allStops.length} stop(s) in ${chunks.length} chunk(s) for "${itinerary.destination}"`);

  let addressMap: Map<string, string | null>;
  try {
    const client = getClient();
    const results = await Promise.all(
      chunks.map((chunk) => enrichChunk(client, itinerary.destination, chunk)),
    );
    addressMap = new Map(results.flat().map((p) => [p.key, p.address]));
  } catch (err) {
    console.error("[enrichAddresses] Failed, returning original itinerary:", err);
    return itinerary;
  }

  if (addressMap.size === 0) return itinerary;

  return {
    ...itinerary,
    days: itinerary.days.map((day, di) => ({
      ...day,
      stops: day.stops.map((stop, si) => ({
        ...stop,
        address: addressMap.get(`${di}-${si}`) ?? stop.address,
        options: stop.options.map((opt, oi) => ({
          ...opt,
          address: addressMap.get(`${di}-${si}-${oi}`) ?? opt.address,
        })),
      })),
    })),
  };
}
