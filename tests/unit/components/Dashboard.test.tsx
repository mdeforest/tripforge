import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// Mock next-auth server-side (not /react) for getServerSession
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock @/lib/auth — just needs to export authOptions (content doesn't matter in tests)
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";

const MOCK_SESSION = {
  user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
  expires: "2030-01-01",
};

const MOCK_TRIPS = [
  {
    id: "trip-1",
    name: "Tokyo Adventure",
    destination: "Tokyo, Japan",
    start_date: new Date("2025-09-01"),
    end_date: new Date("2025-09-14"),
    created_at: new Date("2025-06-01"),
  },
  {
    id: "trip-2",
    name: "Paris Getaway",
    destination: "Paris, France",
    start_date: null,
    end_date: null,
    created_at: new Date("2025-05-01"),
  },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION as never);
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it("shows empty state when user has no trips", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue([]);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const jsx = await DashboardPage();
    render(jsx as React.ReactElement);

    expect(screen.getByText(/no trips yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create your first trip/i })
    ).toBeInTheDocument();
  });

  it("shows 'New trip' CTA in the header even with no trips", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue([]);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const jsx = await DashboardPage();
    render(jsx as React.ReactElement);

    expect(screen.getByRole("link", { name: /new trip/i })).toBeInTheDocument();
  });

  // ── Trip list state ────────────────────────────────────────────────────────

  it("renders a card for each trip when trips exist", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue(MOCK_TRIPS as never);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const jsx = await DashboardPage();
    render(jsx as React.ReactElement);

    expect(screen.getByText("Tokyo Adventure")).toBeInTheDocument();
    expect(screen.getByText("Tokyo, Japan")).toBeInTheDocument();
    expect(screen.getByText("Paris Getaway")).toBeInTheDocument();
    expect(screen.getByText("Paris, France")).toBeInTheDocument();
  });

  it("shows trip count in the subheading when trips exist", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue(MOCK_TRIPS as never);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const jsx = await DashboardPage();
    render(jsx as React.ReactElement);

    expect(screen.getByText("2 trips")).toBeInTheDocument();
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  it("calls redirect to /login when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );

    // redirect() is mocked as vi.fn() so it won't throw;
    // accessing session.user.id afterwards will throw a TypeError — that's expected
    try {
      await DashboardPage();
    } catch {
      // Swallow the TypeError that follows the no-op redirect mock
    }

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/login");
  });
});
