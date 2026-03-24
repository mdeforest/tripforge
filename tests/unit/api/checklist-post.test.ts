import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_SESSION = { user: { id: "user-1" }, expires: "2030-01-01" };
const MOCK_TRIP = { id: "trip-1", user_id: "user-1" };

const CREATED_ITEM = {
  id: "item-new",
  trip_id: "trip-1",
  category: "Other",
  label: "Travel pillow",
  checked: false,
  is_custom: true,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/checklist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/trips/[id]/checklist", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.trip.findUnique).mockReset();
    vi.mocked(prisma.checklistItem.create).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ label: "Travel pillow", category: "Other" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when trip does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ label: "Travel pillow", category: "Other" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 403 when trip belongs to another user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "other-user" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ label: "Travel pillow", category: "Other" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when label is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ category: "Other" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when category is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ label: "Travel pillow" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 201 with the created item on success", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);
    vi.mocked(prisma.checklistItem.create).mockResolvedValue(CREATED_ITEM as never);

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ label: "Travel pillow", category: "Other" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.label).toBe("Travel pillow");
    expect(body.item.is_custom).toBe(true);

    expect(prisma.checklistItem.create).toHaveBeenCalledWith({
      data: {
        trip_id: "trip-1",
        category: "Other",
        label: "Travel pillow",
        is_custom: true,
      },
    });
  });

  it("returns 500 when Prisma throws on create", async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(MOCK_TRIP as never);
    vi.mocked(prisma.checklistItem.create).mockRejectedValue(new Error("DB error"));

    const { POST } = await import("@/app/api/trips/[id]/checklist/route");
    const res = await POST(makeRequest({ label: "Travel pillow", category: "Other" }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
