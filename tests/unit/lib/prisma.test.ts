import { describe, it, expect } from "vitest";

/**
 * Tests for the Prisma client singleton pattern.
 *
 * We test the behaviour of the module (singleton guarantee) without
 * connecting to a real DB — the mock in tests/setup.ts handles that.
 */
describe("Prisma singleton", () => {
  it("exports a prisma object", async () => {
    const { prisma } = await import("@/lib/prisma");
    expect(prisma).toBeDefined();
  });

  it("returns the same instance on repeated imports", async () => {
    const { prisma: a } = await import("@/lib/prisma");
    const { prisma: b } = await import("@/lib/prisma");
    expect(a).toBe(b);
  });

  it("exposes the expected model accessors", async () => {
    const { prisma } = await import("@/lib/prisma");
    // Verify the shape matches our schema — caught early if a model is renamed
    expect(prisma.user).toBeDefined();
    expect(prisma.trip).toBeDefined();
    expect(prisma.day).toBeDefined();
    expect(prisma.stop).toBeDefined();
    expect(prisma.checklistItem).toBeDefined();
  });
});
