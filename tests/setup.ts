import "@testing-library/jest-dom";
import { vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Global mocks applied before every test file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock Next.js navigation hooks that aren't available in jsdom.
 * Individual tests can override these with vi.mocked(redirect).mockImplementation(...)
 */
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

/**
 * Mock NextAuth's client-side hooks.
 * Tests that need a specific session can call:
 *   vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" })
 */
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
  signOut: vi.fn(),
  signIn: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * Mock the Prisma client so tests never hit a real database.
 * Individual test files should import { prisma } from "@/lib/prisma" and
 * use vi.mocked(prisma.user.findUnique).mockResolvedValue(...) to set up data.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    trip: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    day: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    stop: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    checklistItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Reset all mocks between tests so state doesn't leak
afterEach(() => {
  vi.clearAllMocks();
});
