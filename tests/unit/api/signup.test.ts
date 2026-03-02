import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/signup/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// bcryptjs is slow by default — mock it so tests run fast
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password_123"),
    compare: vi.fn(),
  },
}));

/** Helper: build a NextRequest-compatible Request object */
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    // Simulate what Prisma returns with `select: { id, name, email, created_at }`
    // password_hash is intentionally absent — Prisma strips it via select
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "cuid_abc123",
      name: "Test User",
      email: "test@example.com",
      created_at: new Date("2025-01-01"),
    } as Awaited<ReturnType<typeof prisma.user.create>>);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("creates a user and returns 201 with user data", async () => {
    const req = makeRequest({
      name: "Test User",
      email: "test@example.com",
      password: "securepassword",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user).toMatchObject({
      id: "cuid_abc123",
      name: "Test User",
      email: "test@example.com",
    });
    // password_hash must never be returned
    expect(body.user.password_hash).toBeUndefined();
  });

  it("hashes the password with bcrypt before saving", async () => {
    const req = makeRequest({
      name: "Test User",
      email: "test@example.com",
      password: "plaintext_pw",
    });

    await POST(req);

    expect(bcrypt.hash).toHaveBeenCalledWith("plaintext_pw", 12);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password_hash: "hashed_password_123" }),
      })
    );
  });

  // ── Validation errors ───────────────────────────────────────────────────

  it("returns 400 with VALIDATION_ERROR for an invalid email", async () => {
    const req = makeRequest({
      name: "Test",
      email: "not-an-email",
      password: "password123",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 with VALIDATION_ERROR for a short password", async () => {
    const req = makeRequest({
      name: "Test",
      email: "test@example.com",
      password: "short",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toMatch(/8 characters/i);
  });

  it("returns 400 when name is empty", async () => {
    const req = makeRequest({
      name: "",
      email: "test@example.com",
      password: "password123",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  // ── Conflict ────────────────────────────────────────────────────────────

  it("returns 409 with EMAIL_EXISTS when email is already taken", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "existing_user",
      name: "Existing",
      email: "test@example.com",
      password_hash: "hash",
      google_id: null,
      created_at: new Date(),
      emailVerified: null,
      image: null,
    } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    const req = makeRequest({
      name: "Test",
      email: "test@example.com",
      password: "password123",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("EMAIL_EXISTS");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  // ── DB error ────────────────────────────────────────────────────────────

  it("returns 500 with INTERNAL_ERROR when the DB throws", async () => {
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("DB down"));

    const req = makeRequest({
      name: "Test",
      email: "test@example.com",
      password: "password123",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
