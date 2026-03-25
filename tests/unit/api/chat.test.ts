import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @google/generative-ai ────────────────────────────────────────────────
const mockGenerateContentStream = vi.fn();
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContentStream: mockGenerateContentStream };
    }
  },
}));

// ── Mock NextAuth + Prisma (handled by tests/setup.ts for prisma) ─────────────
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRIP_DB = {
  id: "trip-1",
  user_id: "user-1",
  name: "Italy Trip",
  destination: "Rome, Italy",
  start_date: new Date("2026-05-01T12:00:00Z"),
  end_date: new Date("2026-05-07T12:00:00Z"),
  days: [
    {
      id: "d1",
      day_number: 1,
      date: new Date("2026-05-01T12:00:00Z"),
      title: "Arrival",
      notes: null,
      stops: [],
    },
  ],
};

/** Builds a fake async generator that yields text chunks. */
function makeStream(...chunks: string[]) {
  return {
    stream: (async function* () {
      for (const chunk of chunks) {
        yield { text: () => chunk };
      }
    })(),
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/trips/[id]/chat", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGenerateContentStream.mockReset();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.trip.findUnique).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid request body", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const res = await POST(makeRequest({ messages: [] }), { params: { id: "trip-1" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("returns 404 when trip does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 403 when trip belongs to another user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "other-user" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP_DB as never);

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns a streaming text response on success", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP_DB as never);
    mockGenerateContentStream.mockResolvedValue(makeStream("Hello ", "world!"));

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toBe("Hello world!");
  });

  it("returns 500 when Gemini throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(TRIP_DB as never);
    mockGenerateContentStream.mockRejectedValue(new Error("API error"));

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }), {
      params: { id: "trip-1" },
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/trips/[id]/chat — follower access", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGenerateContentStream.mockReset();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.trip.findUnique).mockReset();
  });

  it("returns streaming response for a follower", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "follower-1" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ ...TRIP_DB, user_id: "owner-1" } as never);
    vi.mocked(prisma.tripFollow.findUnique).mockResolvedValue({
      id: "f1", follower_id: "follower-1", trip_id: "trip-1", created_at: new Date(),
    } as never);
    mockGenerateContentStream.mockResolvedValue(makeStream("Hello!"));

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const req = new Request("http://localhost/api/trips/trip-1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }),
    });
    const res = await POST(req, { params: { id: "trip-1" } });
    expect(res.status).not.toBe(403);
  });

  it("returns 403 for authenticated non-owner non-follower", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "stranger-1" } } as never);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ ...TRIP_DB, user_id: "owner-1" } as never);
    vi.mocked(prisma.tripFollow.findUnique).mockResolvedValue(null);

    const { POST } = await import("@/app/api/trips/[id]/chat/route");
    const req = new Request("http://localhost/api/trips/trip-1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }),
    });
    const res = await POST(req, { params: { id: "trip-1" } });
    expect(res.status).toBe(403);
  });
});
