import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const SESSION = { user: { id: "follower-1" } };
const TRIP = { id: "trip-1", user_id: "owner-1" };

function makeRequest() {
  return new Request("http://localhost/api/share/abc123/follow", { method: "POST" });
}

describe("POST /api/share/[token]/follow", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { POST } = await import("@/app/api/share/[token]/follow/route");
    const res = await POST(makeRequest(), { params: { token: "abc123" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when token not found", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);
    const { POST } = await import("@/app/api/share/[token]/follow/route");
    const res = await POST(makeRequest(), { params: { token: "bad-token" } });
    expect(res.status).toBe(404);
  });

  it("upserts TripFollow and returns { tripId }", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(TRIP as never);
    vi.mocked(prisma.tripFollow.upsert).mockResolvedValue({
      id: "f1", follower_id: "follower-1", trip_id: "trip-1", created_at: new Date(),
    } as never);
    const { POST } = await import("@/app/api/share/[token]/follow/route");
    const res = await POST(makeRequest(), { params: { token: "abc123" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tripId).toBe("trip-1");
    expect(prisma.tripFollow.upsert).toHaveBeenCalledOnce();
  });

  it("returns 200 on repeat call (idempotent via upsert)", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(TRIP as never);
    vi.mocked(prisma.tripFollow.upsert).mockResolvedValue({
      id: "f1", follower_id: "follower-1", trip_id: "trip-1", created_at: new Date(),
    } as never);
    const { POST } = await import("@/app/api/share/[token]/follow/route");
    const res1 = await POST(makeRequest(), { params: { token: "abc123" } });
    const res2 = await POST(makeRequest(), { params: { token: "abc123" } });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
