import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParseError } from "@/lib/parseItinerary";

// Mock the Anthropic SDK before importing the module under test.
// Must use a class (not an arrow function) because parseItinerary.ts calls `new Anthropic(...)`.
const mockMessagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
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

function makeClaudeResponse(text: string, stop_reason = "end_turn") {
  return {
    content: [{ type: "text", text }],
    stop_reason,
  };
}

describe("parseItinerary", () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("returns a ParsedItinerary for a valid Claude response", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(VALID_RESPONSE))
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
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(withFences));

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
    mockMessagesCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(modified))
    );

    const result = await parseItinerary("raw text");
    expect(result.days[0].stops[0].type).toBe("other");
  });

  // ── Parse errors ───────────────────────────────────────────────────────────

  it("throws ParseError when Claude returns invalid JSON", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeClaudeResponse("This is not JSON at all")
    );

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  it("throws ParseError when response is missing required tripName field", async () => {
    const missing = { ...VALID_RESPONSE, tripName: undefined };
    mockMessagesCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(missing))
    );

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  it("throws ParseError when response has no days array", async () => {
    const noDays = { ...VALID_RESPONSE, days: [] };
    mockMessagesCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(noDays))
    );

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });

  it("throws ParseError when response is not an object", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(`"just a string"`));

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

    mockMessagesCreate
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(chunk1))) // chunk 1 (no initial call)
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(chunk2))); // chunk 2

    const result = await parseItinerary(largeText);

    // Exactly 2 calls (chunks only, no wasted initial call)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
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

    mockMessagesCreate
      .mockResolvedValueOnce(makeClaudeResponse("truncated", "max_tokens")) // initial call truncated
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(chunk1)))     // chunk 1 succeeds
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(chunk2)));    // chunk 2 succeeds

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

    mockMessagesCreate.mockResolvedValue(makeClaudeResponse("truncated", "max_tokens"));

    await expect(parseItinerary(longText)).rejects.toThrow(ParseError);
  });

  it("throws ParseError when a short input's single fallback chunk is also truncated", async () => {
    // Short text → 1 chunk after splitting → that chunk also truncated
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse("truncated", "max_tokens"));

    await expect(parseItinerary("raw text")).rejects.toThrow(ParseError);
  });
});
