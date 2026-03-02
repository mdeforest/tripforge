import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TripCard } from "@/components/TripCard";

// Use midday UTC dates so the formatted output is stable across all timezones.
// new Date("2025-07-01") = midnight UTC = Jun 30 in UTC-1 through UTC-12.
const BASE_TRIP = {
  id: "trip-123",
  name: "Summer in Italy",
  destination: "Rome, Italy",
  start_date: new Date("2025-07-15T12:00:00.000Z"),
  end_date: new Date("2025-08-15T12:00:00.000Z"),
};

describe("TripCard", () => {
  // ── Content rendering ──────────────────────────────────────────────────────

  it("renders the trip name and destination", () => {
    render(<TripCard {...BASE_TRIP} />);
    expect(screen.getByText("Summer in Italy")).toBeInTheDocument();
    expect(screen.getByText("Rome, Italy")).toBeInTheDocument();
  });

  it("renders a date range when both dates are provided", () => {
    render(<TripCard {...BASE_TRIP} />);
    // The formatted string is "Jul 15, 2025 – Aug 15, 2025"
    expect(screen.getByText(/Jul 15, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/Aug 15, 2025/)).toBeInTheDocument();
  });

  // ── Missing date handling ──────────────────────────────────────────────────

  it("shows 'Until' prefix when only end_date is provided", () => {
    render(<TripCard {...BASE_TRIP} start_date={null} />);
    expect(screen.getByText(/^Until /)).toBeInTheDocument();
  });

  it("shows 'From' prefix when only start_date is provided", () => {
    render(<TripCard {...BASE_TRIP} end_date={null} />);
    expect(screen.getByText(/^From /)).toBeInTheDocument();
  });

  it("renders no date section when both dates are null", () => {
    render(<TripCard {...BASE_TRIP} start_date={null} end_date={null} />);
    expect(screen.queryByText(/From/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Until/i)).not.toBeInTheDocument();
    // Destination is still shown
    expect(screen.getByText("Rome, Italy")).toBeInTheDocument();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("links to the correct trip companion URL", () => {
    render(<TripCard {...BASE_TRIP} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trips/trip-123");
  });

  it("wraps the entire card in the link", () => {
    render(<TripCard {...BASE_TRIP} />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Summer in Italy");
    expect(link).toHaveTextContent("Rome, Italy");
  });
});
