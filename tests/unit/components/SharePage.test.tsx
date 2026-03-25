import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const SESSION_FOLLOWER = { user: { id: "follower-1", name: "Jane" } };
const SESSION_OWNER = { user: { id: "owner-1", name: "Matt" } };

const TRIP_DB = {
  id: "trip-1",
  user_id: "owner-1",
  name: "Italy Trip",
  destination: "Rome, Italy",
  start_date: new Date("2026-05-01T12:00:00Z"),
  end_date: new Date("2026-05-07T12:00:00Z"),
  user: { name: "Matt" },
};

describe("SharePage", () => {
  it("redirects unauthenticated users to /login with callbackUrl", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { default: SharePage } = await import("@/app/share/[token]/page");
    await SharePage({ params: { token: "abc" } });
    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=/share/abc");
  });

  it("shows error message when token not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_FOLLOWER as never);
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);
    const { default: SharePage } = await import("@/app/share/[token]/page");
    const jsx = await SharePage({ params: { token: "bad" } });
    render(jsx as React.ReactElement);
    expect(screen.getByText(/no longer active/i)).toBeInTheDocument();
  });

  it("renders trip preview with owner attribution for a stranger", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_FOLLOWER as never);
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(TRIP_DB as never);
    vi.mocked(prisma.tripFollow.findUnique).mockResolvedValue(null);
    const { default: SharePage } = await import("@/app/share/[token]/page");
    const jsx = await SharePage({ params: { token: "abc123" } });
    render(jsx as React.ReactElement);
    expect(screen.getByText("Italy Trip")).toBeInTheDocument();
    expect(screen.getByText(/Rome, Italy/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared by Matt/i)).toBeInTheDocument();
  });
});
