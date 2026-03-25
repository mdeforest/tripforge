import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const SESSION = { user: { id: "follower-1" } };
const TRIP = { id: "trip-1" };
const FOLLOW = { id: "f1", follower_id: "follower-1", trip_id: "trip-1", created_at: new Date() };

function makeRequest() {
  return new Request("http://localhost/api/trips/trip-1/follow", { method: "DELETE" });
}

describe("DELETE /api/trips/[id]/follow", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/trips/[id]/follow/route");
    const res = await DELETE(makeRequest(), { params: { id: "trip-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when trip does not exist", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/trips/[id]/follow/route");
    const res = await DELETE(makeRequest(), { params: { id: "trip-1" } });
    expect(res.status).toBe(404);
  });

  it("returns 204 and deletes follow when it exists", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP as never);
    vi.mocked(prisma.tripFollow.findUnique).mockResolvedValue(FOLLOW as never);
    vi.mocked(prisma.tripFollow.delete).mockResolvedValue(FOLLOW as never);
    const { DELETE } = await import("@/app/api/trips/[id]/follow/route");
    const res = await DELETE(makeRequest(), { params: { id: "trip-1" } });
    expect(res.status).toBe(204);
    expect(prisma.tripFollow.delete).toHaveBeenCalled();
  });

  it("returns 204 no-op when follow record does not exist", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP as never);
    vi.mocked(prisma.tripFollow.findUnique).mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/trips/[id]/follow/route");
    const res = await DELETE(makeRequest(), { params: { id: "trip-1" } });
    expect(res.status).toBe(204);
    expect(prisma.tripFollow.delete).not.toHaveBeenCalled();
  });
});
