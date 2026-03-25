import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const SESSION = { user: { id: "user-1" } };
const TRIP_OWNED = { id: "trip-1", user_id: "user-1", share_token: null };
const TRIP_WITH_TOKEN = { id: "trip-1", user_id: "user-1", share_token: "existing-token-abc" };

function makeRequest(method: string) {
  return new Request("http://localhost/api/trips/trip-1/share", { method });
}

describe("POST /api/trips/[id]/share", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    process.env.NEXTAUTH_URL = "https://app.example.com";
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { POST } = await import("@/app/api/trips/[id]/share/route");
    const res = await POST(makeRequest("POST"), { params: { id: "trip-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when trip not found", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);
    const { POST } = await import("@/app/api/trips/[id]/share/route");
    const res = await POST(makeRequest("POST"), { params: { id: "trip-1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when not the trip owner", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ ...TRIP_OWNED, user_id: "other" } as never);
    const { POST } = await import("@/app/api/trips/[id]/share/route");
    const res = await POST(makeRequest("POST"), { params: { id: "trip-1" } });
    expect(res.status).toBe(403);
  });

  it("generates a token and returns URL when share_token is null", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP_OWNED as never);
    vi.mocked(prisma.trip.update).mockResolvedValue({ ...TRIP_OWNED, share_token: "new-token" } as never);
    const { POST } = await import("@/app/api/trips/[id]/share/route");
    const res = await POST(makeRequest("POST"), { params: { id: "trip-1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("/share/");
    expect(prisma.trip.update).toHaveBeenCalled();
  });

  it("returns existing URL without calling update when token already set (idempotent)", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP_WITH_TOKEN as never);
    const { POST } = await import("@/app/api/trips/[id]/share/route");
    const res = await POST(makeRequest("POST"), { params: { id: "trip-1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("existing-token-abc");
    expect(prisma.trip.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/trips/[id]/share", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/trips/[id]/share/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "trip-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not the trip owner", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ ...TRIP_OWNED, user_id: "other" } as never);
    const { DELETE } = await import("@/app/api/trips/[id]/share/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "trip-1" } });
    expect(res.status).toBe(403);
  });

  it("nulls share_token and does not touch TripFollow records", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP_WITH_TOKEN as never);
    vi.mocked(prisma.trip.update).mockResolvedValue({ ...TRIP_WITH_TOKEN, share_token: null } as never);
    const { DELETE } = await import("@/app/api/trips/[id]/share/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "trip-1" } });
    expect(res.status).toBe(200);
    expect(prisma.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { share_token: null } })
    );
    expect(prisma.tripFollow.deleteMany).not.toHaveBeenCalled();
  });
});
