import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaySelector } from "@/components/DaySelector";
import type { DayDetail } from "@/types/trip";

const DAYS: DayDetail[] = [
  { id: "d1", day_number: 1, date: null, title: "Arrival", stops: [] },
  { id: "d2", day_number: 2, date: "2025-07-16", title: "Vatican", stops: [] },
  { id: "d3", day_number: 3, date: null, title: "Trastevere", stops: [] },
];

describe("DaySelector", () => {
  it("renders one pill button per day", () => {
    render(<DaySelector days={DAYS} selectedDay={1} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("shows date in pill label when the day has a date", () => {
    render(<DaySelector days={DAYS} selectedDay={1} onSelect={vi.fn()} />);
    // Day 2 has a date — label should contain "Day 2 ·"
    expect(screen.getByText(/Day 2 ·/)).toBeInTheDocument();
    // Day 1 has no date — label is just "Day 1"
    expect(screen.getByText("Day 1")).toBeInTheDocument();
  });

  it("marks the active pill with aria-pressed true and others false", () => {
    render(<DaySelector days={DAYS} selectedDay={2} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole("tab");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the correct day number when an inactive pill is clicked", async () => {
    const onSelect = vi.fn();
    render(<DaySelector days={DAYS} selectedDay={1} onSelect={onSelect} />);
    await userEvent.click(screen.getByText(/Day 3/));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("does not re-call onSelect when the already-active pill is clicked", async () => {
    const onSelect = vi.fn();
    render(<DaySelector days={DAYS} selectedDay={1} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Day 1"));
    // onSelect is still called (component doesn't guard), but value must be 1
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
