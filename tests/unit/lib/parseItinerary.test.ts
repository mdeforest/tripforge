import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParseError } from "@/lib/parseItinerary";

// Mock OpenAI (used via DeepSeek-compatible endpoint) before importing the module under test.
// Must use a class — parseItinerary.ts calls `new OpenAI(...)`.
const mockChatCompletionsCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockChatCompletionsCreate } };
  },
}));

// Import after mocks are in place
import { parseItinerary } from "@/lib/parseItinerary";

const VALID_RESPONSE = {
  tripName: "Italy Adventure",
  destination: "Rome, Italy",
  startDate: "2025-07-01",
  endDate: "2025-07-14",
  days: [
    {
      dayNumber: 1,
      date: "2025-07-01",
      title: "Arrival in Rome",
      stops: [
        {
          name: "Colosseum",
          type: "activity",
          time: "10:00 AM",
          address: "Piazza del Colosseo, Rome",
          notes: "Book tickets in advance",
          order: 1,
        },
      ],
    },
  ],
};

function makeDeepseekResponse(text: string, finish_reason = "stop") {
  return {
    choices: [{ message: { content: text }, finish_reason }],
  };
}

describe("parseItinerary", () => {
  beforeEach(() => {
    mockChatCompletionsCreate.mockReset();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("returns a ParsedItinerary for a valid Claude response", async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(JSON.stringify(VALID_RESPONSE))
    );

    const result = await parseItinerary("Day 1: Visit Colosseum");

    expect(result.tripName).toBe("Italy Adventure");
    expect(result.destination).toBe("Rome, Italy");
    expect(result.days).toHaveLength(1);
    expect(result.days[0].stops).toHaveLength(1);
    expect(result.days[0].stops[0].name).toBe("Colosseum");
  });

  it("strips markdown code fences that Claude occasionally wraps around JSON", async () => {
    const withFences = `\`\`\`json\n${JSON.stringify(VALID_RESPONSE)}\n\`\`\``;
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse(withFences));

    const result = await parseItinerary("raw text");
    expect(result.tripName).toBe("Italy Adventure");
  });

  it("coerces unknown stop type to 'other' instead of throwing", async () => {
    const modified = {
      ...VALID_RESPONSE,
      days: [
        {
          ...VALID_RESPONSE.days[0],
          stops: [{ ...VALID_RESPONSE.days[0].stops[0], type: "museum" }],
        },
      ],
    };
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(JSON.stringify(modified))
    );

    const result = await parseItinerary("raw text");
    expect(result.days[0].stops[0].type).toBe("other");
  });

  // ── Parse errors ───────────────────────────────────────────────────────────

  it("throws ParseError when Claude returns invalid JSON", async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse("This is not JSON at all")
    );

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  it("throws ParseError when response is missing required tripName field", async () => {
    const missing = { ...VALID_RESPONSE, tripName: undefined };
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(JSON.stringify(missing))
    );

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  it("throws ParseError when response has no days array", async () => {
    const noDays = { ...VALID_RESPONSE, days: [] };
    mockChatCompletionsCreate.mockResolvedValue(
      makeDeepseekResponse(JSON.stringify(noDays))
    );

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  it("throws ParseError when response is not an object", async () => {
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse(`"just a string"`));

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  // ── Chunking (fallback + pre-emptive) ──────────────────────────────────────

  it("pre-emptively chunks large inputs without an initial single call", async () => {
    const chunk1 = {
      tripName: "Italy Adventure",
      destination: "Rome, Italy",
      startDate: "2025-07-01",
      endDate: null,
      days: [{ dayNumber: 1, date: "2025-07-01", title: "Day 1", stops: [] }],
    };
    const chunk2 = {
      tripName: "",
      destination: "",
      startDate: null,
      endDate: "2025-07-14",
      days: [{ dayNumber: 2, date: "2025-07-02", title: "Day 2", stops: [] }],
    };

    // Input large enough that computeMaxTokens returns 8192 (>= ~31,568 chars)
    const largeText =
      "Day 1: Arrive in Rome\n".padEnd(31_600, "x") +
      "\nDay 2: Visit Vatican";

    mockChatCompletionsCreate
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify(chunk1))) // chunk 1 (no initial call)
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify(chunk2))); // chunk 2

    const result = await parseItinerary(largeText);

    // Exactly 2 calls (chunks only, no wasted initial call)
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
    expect(result.tripName).toBe("Italy Adventure");
    expect(result.days).toHaveLength(2);
  });

  it("falls back to chunked parsing when single call is truncated", async () => {
    const chunk1 = {
      tripName: "Italy Adventure",
      destination: "Rome, Italy",
      startDate: "2025-07-01",
      endDate: null,
      days: [{ dayNumber: 1, date: "2025-07-01", title: "Day 1", stops: [] }],
    };
    const chunk2 = {
      tripName: "",
      destination: "",
      startDate: null,
      endDate: "2025-07-14",
      days: [{ dayNumber: 2, date: "2025-07-02", title: "Day 2", stops: [] }],
    };

    // Build input that splits into two chunks at the "Day 2" boundary
    const longText =
      "Day 1: Arrive in Rome\n".padEnd(12_001, "x") +
      "\nDay 2: Visit Vatican";

    mockChatCompletionsCreate
      .mockResolvedValueOnce(makeDeepseekResponse("truncated", "length")) // initial call truncated
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify(chunk1)))     // chunk 1 succeeds
      .mockResolvedValueOnce(makeDeepseekResponse(JSON.stringify(chunk2)));    // chunk 2 succeeds

    const result = await parseItinerary(longText);

    expect(result.tripName).toBe("Italy Adventure");
    expect(result.startDate).toBe("2025-07-01");
    expect(result.endDate).toBe("2025-07-14");
    expect(result.days).toHaveLength(2);
    expect(result.days[0].dayNumber).toBe(1);
    expect(result.days[1].dayNumber).toBe(2);
  });

  it("throws ParseError when both the initial call and a chunk are truncated", async () => {
    const longText =
      "Day 1: Arrive\n".padEnd(12_001, "x") + "\nDay 2: Depart";

    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse("truncated", "length"));

    await expect(parseItinerary(longText)).rejects.toThrow(ParseError);
  });

  it("throws ParseError when a short input's single fallback chunk is also truncated", async () => {
    // Short text → 1 chunk after splitting → that chunk also truncated
    mockChatCompletionsCreate.mockResolvedValue(makeDeepseekResponse("truncated", "length"));

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });
});
