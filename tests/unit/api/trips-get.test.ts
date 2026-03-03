import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/trips/[id]/route";

const MOCK_SESSION = {
  user: { id: "user-1", name: "Jane", email: "jane@example.com" },
  expires: "2030-01-01",
};

const MOCK_TRIP = {
  id: "trip-1",
  user_id: "user-1",
  name: "Italy Adventure",
  destination: "Rome, Italy",
  start_date: new Date("2025-07-01T12:00:00.000Z"),
  end_date: new Date("2025-07-14T12:00:00.000Z"),
  created_at: new Date("2025-01-01T12:00:00.000Z"),
  days: [
    {
      id: "day-1",
      day_number: 1,
      date: new Date("2025-07-01T12:00:00.000Z"),
      title: "Arrival in Rome",
      stops: [
        {
          id: "stop-1",
          name: "Colosseum",
          type: "activity",
          time: "10:00 AM",
          address: "Piazza del Colosseo, Rome",
          notes: "Book tickets",
          order: 1,
        },
      ],
    },
  ],
};

function makeRequest(id: string): Request {
  return {} as unknown as Request;
}

describe("GET /api/trips/[id]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest("trip-1"), { params: { id: "trip-1" } });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with full trip, days, and stops for the owner", async () => {
    const res = await GET(makeRequest("trip-1"), { params: { id: "trip-1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trip.id).toBe("trip-1");
    expect(body.trip.name).toBe("Italy Adventure");
    expect(body.trip.days).toHaveLength(1);
    expect(body.trip.days[0].stops).toHaveLength(1);
    expect(body.trip.days[0].stops[0].name).toBe("Colosseum");
    // user_id must be stripped from the response
    expect(body.trip.user_id).toBeUndefined();
  });

  it("returns 404 when the trip does not exist", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("missing"), { params: { id: "missing" } });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 403 when the trip belongs to another user", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      ...MOCK_TRIP,
      user_id: "other-user",
    } as never);
    const res = await GET(makeRequest("trip-1"), { params: { id: "trip-1" } });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 500 on a database error", async () => {
    vi.mocked(prisma.trip.findUnique).mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest("trip-1"), { params: { id: "trip-1" } });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
