import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_SESSION = { user: { id: "user-1" }, expires: "2030-01-01" };
const MOCK_TRIP = { id: "trip-1", user_id: "user-1" };

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/checklist", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DELETE /api/trips/[id]/checklist", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.trip.findUnique).mockReset();
    vi.mocked(prisma.checklistItem.findUnique).mockReset();
    vi.mocked(prisma.checklistItem.delete).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({ itemId: "item-1" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when trip does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({ itemId: "item-1" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 403 when trip belongs to another user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "other-user" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({ itemId: "item-1" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 for missing itemId", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({}), { params: { id: "trip-1" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when item does not belong to the trip", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);
    vi.mocked(prisma.checklistItem.findUnique).mockResolvedValue({
      id: "item-1",
      trip_id: "trip-999",
    } as never);

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({ itemId: "item-1" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 200 with success on valid delete", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);
    vi.mocked(prisma.checklistItem.findUnique).mockResolvedValue({
      id: "item-1",
      trip_id: "trip-1",
    } as never);
    vi.mocked(prisma.checklistItem.delete).mockResolvedValue({} as never);

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({ itemId: "item-1" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(prisma.checklistItem.delete).toHaveBeenCalledWith({
      where: { id: "item-1" },
    });
  });

  it("returns 500 when Prisma throws on delete", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);
    vi.mocked(prisma.checklistItem.findUnique).mockResolvedValue({
      id: "item-1",
      trip_id: "trip-1",
    } as never);
    vi.mocked(prisma.checklistItem.delete).mockRejectedValue(new Error("DB error"));

    const { DELETE } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await DELETE(makeRequest({ itemId: "item-1" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
