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

  // ── Chunked parsing (max_tokens fallback) ──────────────────────────────────

  it("retries in chunks when the first response hits max_tokens", async () => {
    const day1 = {
      tripName: "Italy Adventure",
      destination: "Rome, Italy",
      startDate: "2025-07-01",
      endDate: null,
      days: [{ dayNumber: 1, date: "2025-07-01", title: "Day 1", stops: [] }],
    };
    const day2 = {
      tripName: "Italy Adventure",
      destination: "Rome, Italy",
      startDate: null,
      endDate: "2025-07-14",
      days: [{ dayNumber: 2, date: "2025-07-02", title: "Day 2", stops: [] }],
    };

    // Build input text that will split into two chunks at the "Day 2" boundary
    const longText =
      "Day 1: Arrive in Rome\n".padEnd(12_001, "x") +
      "\nDay 2: Visit Vatican";

    mockMessagesCreate
      // First call: full text → truncated
      .mockResolvedValueOnce(makeClaudeResponse("truncated", "max_tokens"))
      // Chunk 1 call
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(day1)))
      // Chunk 2 call
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(day2)));

    const result = await parseItinerary(longText);

    expect(result.tripName).toBe("Italy Adventure");
    expect(result.startDate).toBe("2025-07-01");
    expect(result.endDate).toBe("2025-07-14");
    expect(result.days).toHaveLength(2);
    expect(result.days[0].dayNumber).toBe(1);
    expect(result.days[1].dayNumber).toBe(2);
  });

  it("throws ParseError if a chunk response also hits max_tokens", async () => {
    const longText =
      "Day 1: Arrive\n".padEnd(12_001, "x") + "\nDay 2: Depart";

    mockMessagesCreate
      .mockResolvedValueOnce(makeClaudeResponse("truncated", "max_tokens"))
      .mockResolvedValue(makeClaudeResponse("still truncated", "max_tokens"));

    await expect(parseItinerary(longText)).rejects.toThrow(ParseError);
  });

  it("throws ParseError when max_tokens and text cannot be split into multiple chunks", async () => {
    // Short text with no day markers → splits into a single chunk → can't retry
    mockMessagesCreate.mockResolvedValue(
      makeClaudeResponse("truncated", "max_tokens")
    );

    await expect(parseItinerary("no day markers here")).rejects.toThrow(ParseError);
  });
});
