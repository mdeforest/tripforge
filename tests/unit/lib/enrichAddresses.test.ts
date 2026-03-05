import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock OpenAI (used via DeepSeek-compatible endpoint) before importing the module under test.
// Must use a class — enrichAddresses.ts calls `new OpenAI(...)`.
const mockChatCompletionsCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockChatCompletionsCreate } };
  },
}));

import { enrichAddresses } from "@/lib/enrichAddresses";
import type { ParsedItinerary } from "@/types/itinerary";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE_ITINERARY: ParsedItinerary = {
  tripName: "Italy Trip",
  destination: "Rome, Italy",
  startDate: "2026-05-01",
  endDate: "2026-05-10",
  notes: null,
  days: [
    {
      dayNumber: 1,
      date: "2026-05-01",
      title: "Arrival",
      notes: null,
      stops: [
        {
          name: "Colosseum",
          type: "activity",
          time: "10:00 AM",
          address: null,
          notes: "Book tickets in advance",
          order: 1,
          options: [],
        },
        {
          name: "Hotel Damaso",
          type: "hotel",
          time: "3:00 PM",
          address: "Via del Gesu, 73, 00186 Roma RM, Italy",
          notes: null,
          order: 2,
          options: [],
        },
      ],
    },
  ],
};

function makeDeepseekResponse(text: string) {
  return { choices: [{ message: { content: text }, finish_reason: "stop" }] };
}

// ── enrichAddresses ──────────────────────────────────────────────────────────

describe("enrichAddresses", () => {
  beforeEach(() => {
    mockChatCompletionsCreate.mockReset();
  });

  it("skips the Claude call when there are no stops", async () => {
    const itinerary: ParsedItinerary = { ...BASE_ITINERARY, days: [] };
    const result = await enrichAddresses(itinerary);
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
    expect(result).toBe(itinerary);
  });

  it("sends all stops to Claude regardless of their current address", async () => {
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse("[]"));

    await enrichAddresses(BASE_ITINERARY);

    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
    const prompt = mockChatCompletionsCreate.mock.calls[0][0].messages[0].content as string;
    // Both stops should appear in the prompt — the null-address one AND the hotel with a full address
    expect(prompt).toContain("Colosseum");
    expect(prompt).toContain("Hotel Damaso");
  });

  it("applies patches returned by Claude", async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(
        JSON.stringify([{ key: "0-0", address: "Piazza del Colosseo, 1, 00184 Roma RM, Italy" }])
      )
    );

    const result = await enrichAddresses(BASE_ITINERARY);

    expect(result.days[0].stops[0].address).toBe("Piazza del Colosseo, 1, 00184 Roma RM, Italy");
  });

  it("preserves addresses not included in Claude's patches", async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(JSON.stringify([{ key: "0-0", address: "Piazza del Colosseo, 1, 00184 Roma RM, Italy" }]))
    );

    const result = await enrichAddresses(BASE_ITINERARY);

    // Hotel address was not patched — should remain as-is
    expect(result.days[0].stops[1].address).toBe("Via del Gesu, 73, 00186 Roma RM, Italy");
  });

  it("returns original itinerary unchanged when Claude returns no patches", async () => {
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse("[]"));

    const result = await enrichAddresses(BASE_ITINERARY);

    expect(result).toBe(BASE_ITINERARY);
  });

  it("patches addresses on stop options", async () => {
    const itinerary: ParsedItinerary = {
      ...BASE_ITINERARY,
      days: [
        {
          ...BASE_ITINERARY.days[0],
          stops: [
            {
              ...BASE_ITINERARY.days[0].stops[0],
              address: "Piazza del Colosseo, 1, 00184 Roma RM, Italy",
              options: [
                { name: "Trattoria da Luigi", type: "restaurant", address: null, notes: null, order: 1 },
              ],
            },
          ],
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(
        JSON.stringify([{ key: "0-0-0", address: "Via Cavour, 315, 00184 Roma RM, Italy" }])
      )
    );

    const result = await enrichAddresses(itinerary);
    expect(result.days[0].stops[0].options[0].address).toBe("Via Cavour, 315, 00184 Roma RM, Italy");
  });

  it("keeps the original address when Claude patches it with null", async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(JSON.stringify([{ key: "0-0", address: null }]))
    );

    const result = await enrichAddresses(BASE_ITINERARY);
    // null patch + null original → null (no change)
    expect(result.days[0].stops[0].address).toBeNull();
  });

  it("strips markdown code fences from the Claude response", async () => {
    const json = JSON.stringify([{ key: "0-0", address: "Piazza del Colosseo, 1, 00184 Roma RM, Italy" }]);
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse(`\`\`\`json\n${json}\n\`\`\``));

    const result = await enrichAddresses(BASE_ITINERARY);
    expect(result.days[0].stops[0].address).toBe("Piazza del Colosseo, 1, 00184 Roma RM, Italy");
  });

  it("returns the original itinerary unchanged when Claude call fails", async () => {
    mockChatCompletionsCreate.mockRejectedValue(new Error("API error"));

    const result = await enrichAddresses(BASE_ITINERARY);

    expect(result).toBe(BASE_ITINERARY);
  });

  it("returns the original itinerary unchanged when Claude returns invalid JSON", async () => {
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse("not json at all"));

    const result = await enrichAddresses(BASE_ITINERARY);

    expect(result).toBe(BASE_ITINERARY);
  });

  it("returns the original itinerary unchanged when the response is truncated", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: '[{"key":"0-0","address":"Via Cavour, 315' }, finish_reason: "length" }],
    });

    const result = await enrichAddresses(BASE_ITINERARY);

    expect(result).toBe(BASE_ITINERARY);
  });

  it("truncates long notes to 200 chars before sending to Claude", async () => {
    const longNote = "A".repeat(300);
    const itinerary: ParsedItinerary = {
      ...BASE_ITINERARY,
      days: [
        {
          ...BASE_ITINERARY.days[0],
          stops: [{ ...BASE_ITINERARY.days[0].stops[0], notes: longNote }],
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse("[]"));
    await enrichAddresses(itinerary);

    const sentPrompt = mockChatCompletionsCreate.mock.calls[0][0].messages[0].content as string;
    expect(sentPrompt).toContain("A".repeat(200) + "…");
    expect(sentPrompt).not.toContain("A".repeat(201));
  });

  it("splits stops into chunks and merges patches from all chunks", async () => {
    // Build an itinerary with 45 stops — more than ENRICH_CHUNK_SIZE (40), so two chunks
    const manyStops = Array.from({ length: 45 }, (_, i) => ({
      name: `Stop ${i}`,
      type: "activity" as const,
      time: null,
      address: null,
      notes: null,
      order: i + 1,
      options: [],
    }));

    const itinerary: ParsedItinerary = {
      ...BASE_ITINERARY,
      days: [{ ...BASE_ITINERARY.days[0], stops: manyStops }],
    };

    // First chunk returns a patch for stop 0; second chunk returns a patch for stop 40
    mockChatCompletionsCreate
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify([{ key: "0-0", address: "Address A" }])))
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify([{ key: "0-40", address: "Address B" }])));

    const result = await enrichAddresses(itinerary);

    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
    expect(result.days[0].stops[0].address).toBe("Address A");
    expect(result.days[0].stops[40].address).toBe("Address B");
    // Stops not in any patch keep their original address (null)
    expect(result.days[0].stops[1].address).toBeNull();
  });

  it("returns original itinerary unchanged when any chunk fails", async () => {
    const manyStops = Array.from({ length: 45 }, (_, i) => ({
      name: `Stop ${i}`,
      type: "activity" as const,
      time: null,
      address: null,
      notes: null,
      order: i + 1,
      options: [],
    }));

    const itinerary: ParsedItinerary = {
      ...BASE_ITINERARY,
      days: [{ ...BASE_ITINERARY.days[0], stops: manyStops }],
    };

    mockChatCompletionsCreate
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify([{ key: "0-0", address: "Address A" }])))
      .mockRejectedValueOnce(new Error("API error on chunk 2"));

    const result = await enrichAddresses(itinerary);

    expect(result).toBe(itinerary);
  });
});
