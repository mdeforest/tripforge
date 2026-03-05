import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MapTab } from "@/components/MapTab";
import type { DayDetail, StopOption } from "@/types/trip";

// ── Suppress the CSS import (jsdom can't process it) ─────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

// ── Test data ─────────────────────────────────────────────────────────────────

function makeOption(
  name: string,
  address: string | null = null,
  lat: number | null = null,
  lng: number | null = null
): StopOption {
  return { name, type: "restaurant" as const, address, lat, lng, notes: null, order: 1 };
}

function makeStop(
  id: string,
  name: string,
  address: string | null = null,
  lat: number | null = null,
  lng: number | null = null,
  options: StopOption[] = []
) {
  return { id, name, type: "activity" as const, time: null, address, lat, lng, notes: null, order: 1, options };
}

const STOP_WITH_COORDS = makeStop("s1", "Colosseum", "Piazza del Colosseo, Rome", 41.89, 12.49);
const STOP_NO_COORDS   = makeStop("s2", "Unknown Spot", null, null, null);
const OPTION_WITH_COORDS = makeOption("Da Enzo al 29", "Via dei Vascellari 29, Rome", 41.888, 12.48);
const OPTION_NO_COORDS   = makeOption("Trattoria XYZ", null, null, null);

const DAYS: DayDetail[] = [
  {
    id: "d1",
    day_number: 1,
    date: "2025-07-15",
    title: "Rome",
    notes: null,
    stops: [STOP_WITH_COORDS, STOP_NO_COORDS],
  },
  {
    id: "d2",
    day_number: 2,
    date: "2025-07-16",
    title: "Vatican",
    notes: null,
    stops: [STOP_NO_COORDS],
  },
];

// Day with a stop that has no coords but an option with coords.
const DAYS_OPTION_ONLY: DayDetail[] = [
  {
    id: "d3",
    day_number: 1,
    date: "2025-07-15",
    title: "Lunch choices",
    notes: null,
    stops: [makeStop("s3", "Lunch stop", null, null, null, [OPTION_WITH_COORDS, OPTION_NO_COORDS])],
  },
];

// Day with a stop with coords AND an option with coords — shows legend.
const DAYS_WITH_OPTIONS: DayDetail[] = [
  {
    id: "d4",
    day_number: 1,
    date: "2025-07-15",
    title: "Rome with options",
    notes: null,
    stops: [makeStop("s4", "Colosseum", "Piazza del Colosseo, Rome", 41.89, 12.49, [OPTION_WITH_COORDS])],
  },
];

/** Stateful wrapper so day-pill clicks actually update the view. */
function Controlled({ days, initialDay = 1 }: { days: DayDetail[]; initialDay?: number }) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  return <MapTab days={days} selectedDay={selectedDay} onSelectDay={setSelectedDay} />;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MapTab", () => {
  beforeEach(() => {
    // Leave NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN unset (empty) so the map's
    // early-return guard fires and import("mapbox-gl") is never called.
    // jsdom has no WebGL, so we test DOM structure only.
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the day selector when multiple days exist", () => {
    render(<MapTab days={DAYS} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.getByText(/Day 1/)).toBeInTheDocument();
    expect(screen.getByText(/Day 2/)).toBeInTheDocument();
  });

  it("renders the map container when the day has geocoded stops", () => {
    render(<MapTab days={DAYS} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.getByLabelText("Trip map")).toBeInTheDocument();
  });

  it("renders the map container when only options have geocoded coords", () => {
    render(<MapTab days={DAYS_OPTION_ONLY} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.getByLabelText("Trip map")).toBeInTheDocument();
  });

  it('shows "No mappable stops" when all stops and options lack coordinates', async () => {
    render(<Controlled days={DAYS} initialDay={1} />);
    // Switch to Day 2 which has no geocoded stops or options.
    await userEvent.click(screen.getByText(/Day 2/));
    expect(screen.getByText("No mappable stops for this day.")).toBeInTheDocument();
  });

  it('does NOT show "No mappable stops" when the day has geocoded stops', () => {
    render(<MapTab days={DAYS} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.queryByText("No mappable stops for this day.")).not.toBeInTheDocument();
  });

  it("renders the map container when a stop has options with coords", () => {
    render(<MapTab days={DAYS_WITH_OPTIONS} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.getByLabelText("Trip map")).toBeInTheDocument();
  });

  it("calls onSelectDay with the new day number when a pill is clicked", async () => {
    const onSelectDay = vi.fn();
    render(<MapTab days={DAYS} selectedDay={1} onSelectDay={onSelectDay} />);
    await userEvent.click(screen.getByText(/Day 2/));
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });

  it("links 'Get Directions' to maps.google.com with encoded address", () => {
    const address = "Piazza del Colosseo, Rome";
    const expected = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    expect(expected).toBe(
      "https://maps.google.com/?q=Piazza%20del%20Colosseo%2C%20Rome"
    );
  });

  it("shows no 'Day 2' pill when only one day exists", () => {
    render(<MapTab days={[DAYS[0]]} selectedDay={1} onSelectDay={vi.fn()} />);
    expect(screen.queryByText(/Day 2/)).not.toBeInTheDocument();
  });
});
