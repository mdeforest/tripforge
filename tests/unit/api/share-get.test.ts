import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const TRIP = {
  id: "trip-1",
  name: "Italy Trip",
  destination: "Rome, Italy",
  start_date: new Date("2026-05-01T12:00:00Z"),
  end_date: new Date("2026-05-07T12:00:00Z"),
  user: { name: "Matt" },
};

function makeRequest() {
  return new Request("http://localhost/api/share/abc123");
}

describe("GET /api/share/[token]", () => {
  it("returns 404 when token not found", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);
    const { GET } = await import("@/app/api/share/[token]/route");
    const res = await GET(makeRequest(), { params: { token: "bad-token" } });
    expect(res.status).toBe(404);
  });

  it("returns preview fields for a valid token", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(TRIP as never);
    const { GET } = await import("@/app/api/share/[token]/route");
    const res = await GET(makeRequest(), { params: { token: "abc123" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      name: "Italy Trip",
      destination: "Rome, Italy",
      ownerName: "Matt",
      tripId: "trip-1",
    });
    expect(body.start_date).toBe("2026-05-01");
    expect(body.end_date).toBe("2026-05-07");
  });

  it("falls back to 'a TripForge user' when owner name is empty", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({ ...TRIP, user: { name: "" } } as never);
    const { GET } = await import("@/app/api/share/[token]/route");
    const res = await GET(makeRequest(), { params: { token: "abc123" } });
    const body = await res.json();
    expect(body.ownerName).toBe("a TripForge user");
  });
});
