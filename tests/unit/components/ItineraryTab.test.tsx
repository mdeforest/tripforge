import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItineraryTab } from "@/components/ItineraryTab";
import type { DayDetail } from "@/types/trip";

function makeStop(id: string, name: string) {
  return { id, name, type: "activity" as const, time: null, address: null, notes: null, order: 1, options: [] };
}

const DAYS: DayDetail[] = [
  {
    id: "d1",
    day_number: 1,
    date: "2025-07-15",
    title: "Arrival",
    stops: [makeStop("s1", "Hotel Check-in")],
  },
  {
    id: "d2",
    day_number: 2,
    date: "2025-07-16",
    title: "Vatican",
    stops: [makeStop("s2", "Vatican Museums"), makeStop("s3", "St. Peter's")],
  },
  {
    id: "d3",
    day_number: 3,
    date: null,
    title: "Free Day",
    stops: [],
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("ItineraryTab", () => {
  it("defaults to Day 1 when no start/end dates are provided", () => {
    render(<ItineraryTab days={DAYS} startDate={null} endDate={null} />);
    expect(screen.getByText("Hotel Check-in")).toBeInTheDocument();
    expect(screen.queryByText("Vatican Museums")).not.toBeInTheDocument();
  });

  it("shows stops for the selected day", () => {
    render(<ItineraryTab days={DAYS} startDate={null} endDate={null} />);
    expect(screen.getByText("Hotel Check-in")).toBeInTheDocument();
  });

  it("switches to another day's stops when a day pill is clicked", async () => {
    render(<ItineraryTab days={DAYS} startDate={null} endDate={null} />);
    await userEvent.click(screen.getByText(/Day 2/));
    expect(screen.queryByText("Hotel Check-in")).not.toBeInTheDocument();
    expect(screen.getByText("Vatican Museums")).toBeInTheDocument();
    expect(screen.getByText("St. Peter's")).toBeInTheDocument();
  });

  it('shows "No stops planned for this day." for an empty day', async () => {
    render(<ItineraryTab days={DAYS} startDate={null} endDate={null} />);
    await userEvent.click(screen.getByText("Day 3"));
    expect(screen.getByText("No stops planned for this day.")).toBeInTheDocument();
  });

  it("defaults to the matching day when today falls within the trip dates", () => {
    // Freeze time to 2025-07-16 — should default to Day 2
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-16T12:00:00.000Z"));

    render(
      <ItineraryTab days={DAYS} startDate="2025-07-15" endDate="2025-07-17" />
    );

    expect(screen.queryByText("Hotel Check-in")).not.toBeInTheDocument();
    expect(screen.getByText("Vatican Museums")).toBeInTheDocument();
  });
});
