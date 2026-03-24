import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ItineraryTab } from "@/components/ItineraryTab";
import type { DayDetail } from "@/types/trip";

function makeStop(id: string, name: string) {
  return { id, name, type: "activity" as const, time: null, address: null, lat: null, lng: null, notes: null, order: 1, options: [] };
}

const DAYS: DayDetail[] = [
  {
    id: "d1",
    day_number: 1,
    date: "2025-07-15",
    title: "Arrival",
    notes: null,
    stops: [makeStop("s1", "Hotel Check-in")],
  },
  {
    id: "d2",
    day_number: 2,
    date: "2025-07-16",
    title: "Vatican",
    notes: null,
    stops: [makeStop("s2", "Vatican Museums"), makeStop("s3", "St. Peter's")],
  },
  {
    id: "d3",
    day_number: 3,
    date: null,
    title: "Free Day",
    notes: null,
    stops: [],
  },
];

/** Stateful wrapper so day-pill clicks actually update the view. */
function Controlled({ days, initialDay = 1 }: { days: DayDetail[]; initialDay?: number }) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  return <ItineraryTab days={days} selectedDay={selectedDay} onSelectDay={setSelectedDay} />;
}

describe("ItineraryTab", () => {
  it("shows stops for the initial selectedDay", () => {
    render(<ItineraryTab days={DAYS} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.getByText("Hotel Check-in")).toBeInTheDocument();
    expect(screen.queryByText("Vatican Museums")).not.toBeInTheDocument();
  });

  it("shows stops for a different selectedDay when passed as a prop", () => {
    render(<ItineraryTab days={DAYS} selectedDay={2} onSelectDay={vi.fn()} />);
    expect(screen.getByText("Vatican Museums")).toBeInTheDocument();
    expect(screen.queryByText("Hotel Check-in")).not.toBeInTheDocument();
  });

  it("switches to another day's stops when a day pill is clicked", async () => {
    render(<Controlled days={DAYS} initialDay={1} />);
    await userEvent.click(screen.getByText(/Day 2/));
    expect(screen.queryByText("Hotel Check-in")).not.toBeInTheDocument();
    expect(screen.getByText("Vatican Museums")).toBeInTheDocument();
    expect(screen.getByText("St. Peter's")).toBeInTheDocument();
  });

  it('shows "No stops planned for this day." for an empty day', async () => {
    render(<Controlled days={DAYS} initialDay={1} />);
    await userEvent.click(screen.getByText("Day 3"));
    expect(screen.getByText("No stops planned for this day.")).toBeInTheDocument();
  });

  it("calls onSelectDay with the new day number when a pill is clicked", async () => {
    const onSelectDay = vi.fn();
    render(<ItineraryTab days={DAYS} selectedDay={1} onSelectDay={onSelectDay} />);
    await userEvent.click(screen.getByText(/Day 2/));
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });

  it("calls onEditStop with the stop id when the pencil button is clicked", async () => {
    const onEditStop = vi.fn();
    render(
      <ItineraryTab
        days={DAYS}
        selectedDay={1}
        onSelectDay={vi.fn()}
        onEditStop={onEditStop}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /edit location/i }));
    expect(onEditStop).toHaveBeenCalledWith("s1");
  });
});
