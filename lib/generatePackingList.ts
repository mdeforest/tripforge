import OpenAI from "openai";
import { buildPackingListPrompt, type PackingItem, type StopSummary } from "@/lib/prompts/packing-list";
import type { ParsedItinerary } from "@/types/itinerary";

let _openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_openai)
    _openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  return _openai;
}

/**
 * Generates a packing list for a trip using DeepSeek.
 *
 * Runs in parallel with enrichAddresses during the parse step so the result
 * is ready before the user confirms. Returns an empty array on any failure —
 * callers should treat this as best-effort, not a hard requirement.
 */
export async function generatePackingList(
  parsedData: ParsedItinerary
): Promise<PackingItem[]> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("[generatePackingList] Skipped — DEEPSEEK_API_KEY not set");
    return [];
  }

  try {
    const durationDays = parsedData.days.length;
    const stops: StopSummary[] = [];

    for (const day of parsedData.days) {
      for (const stop of day.stops) {
        stops.push({ name: stop.name, type: stop.type, notes: stop.notes });
      }
    }

    console.log(
      `[generatePackingList] Starting — trip: "${parsedData.tripName}", ${durationDays} days, ${stops.length} stops`
    );

    const prompt = buildPackingListPrompt(
      parsedData.tripName,
      parsedData.destination,
      durationDays,
      parsedData.startDate,
      parsedData.notes,
      stops
    );

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 2048,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const json = JSON.parse(text) as { items?: unknown };

    if (!Array.isArray(json.items)) {
      console.warn("[generatePackingList] Response missing items array");
      return [];
    }

    const items: PackingItem[] = [];
    for (const raw of json.items) {
      if (
        typeof raw !== "object" || raw === null ||
        typeof (raw as Record<string, unknown>).category !== "string" ||
        typeof (raw as Record<string, unknown>).label !== "string"
      ) continue;
      const item = raw as Record<string, unknown>;
      if (!item.category || !item.label) continue;
      items.push({
        category: item.category as string,
        label: item.label as string,
        reason: typeof item.reason === "string" && item.reason.length > 0 ? item.reason : null,
      });
    }

    console.log(`[generatePackingList] Done — ${items.length} items generated`);
    return items;
  } catch (err) {
    console.error("[generatePackingList] Failed:", err);
    return [];
  }
}
