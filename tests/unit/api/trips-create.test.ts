import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/trips/route";

const MOCK_SESSION = {
  user: { id: "user-1", name: "Jane", email: "jane@example.com" },
  expires: "2030-01-01",
};

const VALID_PARSED_DATA = {
  tripName: "Italy Adventure",
  destination: "Rome, Italy",
  startDate: "2025-07-01",
  endDate: "2025-07-14",
  notes: null,
  days: [
    {
      dayNumber: 1,
      date: "2025-07-01",
      title: "Arrival",
      notes: null,
      stops: [
        {
          name: "Colosseum",
          type: "activity",
          time: "10:00 AM",
          address: "Piazza del Colosseo",
          notes: null,
          order: 1,
        },
      ],
    },
  ],
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/trips", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.create).mockResolvedValue({
      id: "trip-abc123",
      name: "Italy Adventure",
      destination: "Rome, Italy",
    } as never);
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  it("returns 401 UNAUTHORIZED when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = makeRequest({ parsedData: VALID_PARSED_DATA, rawText: "raw" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(prisma.trip.create).not.toHaveBeenCalled();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("returns 400 VALIDATION_ERROR for missing parsedData", async () => {
    const req = makeRequest({ rawText: "some text" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for missing rawText", async () => {
    const req = makeRequest({ parsedData: VALID_PARSED_DATA });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for empty tripName", async () => {
    const req = makeRequest({
      parsedData: { ...VALID_PARSED_DATA, tripName: "" },
      rawText: "raw",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("creates trip with nested days and stops, returns 201 with trip id", async () => {
    const req = makeRequest({ parsedData: VALID_PARSED_DATA, rawText: "raw itinerary text" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.trip.id).toBe("trip-abc123");
    expect(body.trip.name).toBe("Italy Adventure");

    expect(prisma.trip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: "user-1",
          name: "Italy Adventure",
          destination: "Rome, Italy",
          raw_input: "raw itinerary text",
        }),
      })
    );
  });

  // ── DB error ───────────────────────────────────────────────────────────────

  it("returns 500 INTERNAL_ERROR when Prisma throws", async () => {
    vi.mocked(prisma.trip.create).mockRejectedValue(new Error("DB down"));
    const req = makeRequest({ parsedData: VALID_PARSED_DATA, rawText: "raw" });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
