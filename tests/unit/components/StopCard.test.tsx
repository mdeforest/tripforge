import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StopCard } from "@/components/StopCard";
import type { StopDetail, StopOption } from "@/types/trip";

function makeStop(overrides: Partial<StopDetail> = {}): StopDetail {
  return {
    id: "stop-1",
    name: "Colosseum",
    type: "activity",
    time: "10:00 AM",
    address: "Piazza del Colosseo, Rome",
    lat: null,
    lng: null,
    notes: "Book tickets in advance",
    order: 1,
    options: [],
    ...overrides,
  };
}

function makeOption(overrides: Partial<StopOption> = {}): StopOption {
  return {
    name: "Roscioli Salumeria",
    type: "restaurant",
    address: null,
    lat: null,
    lng: null,
    notes: "Legendary deli counter.",
    order: 1,
    ...overrides,
  };
}

describe("StopCard", () => {
  it("renders the stop name and time", () => {
    render(<StopCard stop={makeStop()} />);
    expect(screen.getByText("Colosseum")).toBeInTheDocument();
    expect(screen.getByText("10:00 AM")).toBeInTheDocument();
  });

  it("renders the stop icon wrapper", () => {
    render(<StopCard stop={makeStop({ type: "restaurant" })} />);
    expect(screen.getByTestId("stop-icon")).toBeInTheDocument();
  });

  it("is collapsed by default — notes are not visible", () => {
    render(<StopCard stop={makeStop()} />);
    expect(screen.queryByText("Book tickets in advance")).not.toBeInTheDocument();
  });

  it("expands when clicked — shows notes", async () => {
    render(<StopCard stop={makeStop()} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Book tickets in advance")).toBeInTheDocument();
  });

  it("collapses again when clicked a second time", async () => {
    render(<StopCard stop={makeStop()} />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByText("Book tickets in advance")).not.toBeInTheDocument();
  });


  // ── Options ──────────────────────────────────────────────────────────────

  it("does not show options badge when stop has no options", () => {
    render(<StopCard stop={makeStop()} />);
    expect(screen.queryByTestId("options-badge")).not.toBeInTheDocument();
  });

  it("shows options badge with count when stop has options", () => {
    const stop = makeStop({
      options: [makeOption({ order: 1 }), makeOption({ name: "Forno", order: 2 })],
    });
    render(<StopCard stop={stop} />);
    expect(screen.getByTestId("options-badge")).toHaveTextContent("2 options");
  });

  it("shows chevron for stops with options even when address/notes are null", () => {
    const stop = makeStop({ address: null, notes: null, options: [makeOption()] });
    render(<StopCard stop={stop} />);
    // chevron means the button triggers expand; badge is present
    expect(screen.getByTestId("options-badge")).toBeInTheDocument();
  });

  it("expands to show options section with option names", async () => {
    const stop = makeStop({
      options: [
        makeOption({ name: "Roscioli Salumeria", order: 1 }),
        makeOption({ name: "Forno Campo de' Fiori", order: 2, notes: null }),
      ],
    });
    render(<StopCard stop={stop} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.getByText("Roscioli Salumeria")).toBeInTheDocument();
    expect(screen.getByText("Forno Campo de' Fiori")).toBeInTheDocument();
  });

  it("shows option notes when present", async () => {
    const stop = makeStop({
      options: [makeOption({ notes: "Legendary deli counter." })],
    });
    render(<StopCard stop={stop} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Legendary deli counter.")).toBeInTheDocument();
  });


  it("does not show options section when stop has no options", async () => {
    render(<StopCard stop={makeStop()} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
  });

  // ── Edit button ──────────────────────────────────────────────────────────

  it("does not render pencil button when onEdit is not provided", () => {
    render(<StopCard stop={makeStop()} />);
    expect(screen.queryByRole("button", { name: /edit location/i })).not.toBeInTheDocument();
  });

  it("renders pencil button when onEdit is provided", () => {
    render(<StopCard stop={makeStop()} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /edit location/i })).toBeInTheDocument();
  });

  it("renders pencil button even when address is null", () => {
    render(<StopCard stop={makeStop({ address: null })} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /edit location/i })).toBeInTheDocument();
  });

  it("calls onEdit when pencil button is clicked", async () => {
    const onEdit = vi.fn();
    render(<StopCard stop={makeStop()} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole("button", { name: /edit location/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
