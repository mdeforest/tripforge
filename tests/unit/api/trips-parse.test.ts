import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExtractionError } from "@/lib/extractText";
import { ParseError } from "@/lib/parseItinerary";

// Mock auth
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Mock the lib utilities so we test the route in isolation
vi.mock("@/lib/extractText", () => ({
  extractRawText: vi.fn(),
  ExtractionError: class ExtractionError extends Error {
    name = "ExtractionError";
  },
}));
vi.mock("@/lib/parseItinerary", () => ({
  parseItinerary: vi.fn(),
  ParseError: class ParseError extends Error {
    name = "ParseError";
  },
}));

import { getServerSession } from "next-auth";
import { extractRawText } from "@/lib/extractText";
import { parseItinerary } from "@/lib/parseItinerary";
import { POST } from "@/app/api/trips/parse/route";

const MOCK_SESSION = {
  user: { id: "user-1", name: "Jane", email: "jane@example.com" },
  expires: "2030-01-01",
};

const PARSED_DATA = {
  tripName: "Italy Trip",
  destination: "Rome",
  startDate: null,
  endDate: null,
  days: [{ dayNumber: 1, date: null, title: "Day 1", stops: [] }],
};

/**
 * Helper to make a mock Request with multipart form data.
 *
 * We mock `formData()` directly instead of using a real Request body because
 * jsdom's Request implementation hangs when the body contains a File object
 * (it can't serialize/deserialize multipart binary data in a test environment).
 */
function makeFormRequest(fields: Record<string, string | File>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return { formData: async () => formData } as unknown as Request;
}

describe("POST /api/trips/parse", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(extractRawText).mockResolvedValue("Day 1: Visit Colosseum");
    vi.mocked(parseItinerary).mockResolvedValue(PARSED_DATA as never);
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = makeFormRequest({ text: "some itinerary" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  // ── Input validation ───────────────────────────────────────────────────────

  it("returns 400 NO_INPUT when no input field is provided", async () => {
    const req = makeFormRequest({});
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("NO_INPUT");
    expect(extractRawText).not.toHaveBeenCalled();
  });

  // ── Happy paths ────────────────────────────────────────────────────────────

  it("returns 200 with parsedData for text input", async () => {
    const req = makeFormRequest({ text: "Day 1: Arrive in Rome" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.parsedData.tripName).toBe("Italy Trip");
    expect(body.rawText).toBe("Day 1: Visit Colosseum");
    expect(extractRawText).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Day 1: Arrive in Rome" })
    );
  });

  it("returns 200 with parsedData for file input", async () => {
    const file = new File(["content"], "itinerary.pdf", { type: "application/pdf" });
    const req = makeFormRequest({ file });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(extractRawText).toHaveBeenCalledWith(
      expect.objectContaining({ file: expect.any(File) })
    );
  });

  it("returns 200 with parsedData for Google Docs URL", async () => {
    const req = makeFormRequest({ googleDocsUrl: "https://docs.google.com/document/d/abc/edit" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(extractRawText).toHaveBeenCalledWith(
      expect.objectContaining({ googleDocsUrl: "https://docs.google.com/document/d/abc/edit" })
    );
  });

  // ── Extraction errors ──────────────────────────────────────────────────────

  it("returns 422 EXTRACTION_FAILED when extractRawText throws ExtractionError", async () => {
    vi.mocked(extractRawText).mockRejectedValue(
      new ExtractionError("This PDF is a scanned image.")
    );
    const req = makeFormRequest({ text: "some text" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.code).toBe("EXTRACTION_FAILED");
  });

  // ── Parse errors ───────────────────────────────────────────────────────────

  it("returns 422 PARSE_FAILED when Claude returns invalid JSON", async () => {
    vi.mocked(parseItinerary).mockRejectedValue(new ParseError("Invalid JSON"));
    const req = makeFormRequest({ text: "some text" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.code).toBe("PARSE_FAILED");
  });

  it("returns 504 AI_TIMEOUT for network/timeout errors from Claude", async () => {
    vi.mocked(parseItinerary).mockRejectedValue(new Error("network timeout"));
    const req = makeFormRequest({ text: "some text" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(504);
    expect(body.code).toBe("AI_TIMEOUT");
  });
});
