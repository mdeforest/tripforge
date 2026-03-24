import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const SESSION = { user: { id: "user-1" }, expires: "2030-01-01" };

const STOP_WITH_TRIP = {
  id: "stop-1",
  day: { trip: { id: "trip-1", user_id: "user-1" } },
};

const UPDATED_STOP = {
  id: "stop-1",
  address: "Piazza del Colosseo 1, 00184 Roma RM, Italy",
  lat: 41.8902,
  lng: 12.4922,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/stops/stop-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "trip-1", stopId: "stop-1" } };
const VALID_BODY = { address: "Piazza del Colosseo 1, Rome", lat: 41.8902, lng: 12.4922 };

describe("PATCH /api/trips/[id]/stops/[stopId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.stop.findUnique).mockReset();
    vi.mocked(prisma.stop.update).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when stop does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("returns 403 when trip belongs to another user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "other" } } as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue({
      id: "stop-1",
      day: { trip: { id: "trip-1", user_id: "user-1" } },
    } as never);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("returns 400 when address is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest({ lat: 41.89, lng: 12.49 }), PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when lat is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest({ address: "Rome", lng: 12.49 }), PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 with updated stop on success", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    vi.mocked(prisma.stop.update).mockResolvedValue(UPDATED_STOP as never);

    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stop.id).toBe("stop-1");
    expect(body.stop.address).toBe("Piazza del Colosseo 1, 00184 Roma RM, Italy");
    expect(prisma.stop.update).toHaveBeenCalledWith({
      where: { id: "stop-1" },
      data: { address: VALID_BODY.address, lat: VALID_BODY.lat, lng: VALID_BODY.lng },
      select: { id: true, address: true, lat: true, lng: true },
    });
  });

  it("returns 500 when Prisma throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    vi.mocked(prisma.stop.update).mockRejectedValue(new Error("DB error"));

    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("INTERNAL_ERROR");
  });
});
