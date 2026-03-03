import { describe, it, expect } from "vitest";
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

  it("is collapsed by default — address and notes are not visible", () => {
    render(<StopCard stop={makeStop()} />);
    expect(screen.queryByText("Piazza del Colosseo, Rome")).not.toBeInTheDocument();
    expect(screen.queryByText("Book tickets in advance")).not.toBeInTheDocument();
  });

  it("expands when clicked — shows address and notes", async () => {
    render(<StopCard stop={makeStop()} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Piazza del Colosseo, Rome")).toBeInTheDocument();
    expect(screen.getByText("Book tickets in advance")).toBeInTheDocument();
  });

  it("collapses again when clicked a second time", async () => {
    render(<StopCard stop={makeStop()} />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByText("Piazza del Colosseo, Rome")).not.toBeInTheDocument();
  });

  it('shows a "Get Directions" link with the correct Google Maps href when address exists', async () => {
    render(<StopCard stop={makeStop()} />);
    await userEvent.click(screen.getByRole("button"));
    const link = screen.getByRole("link", { name: /get directions/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      `https://maps.google.com/?q=${encodeURIComponent("Piazza del Colosseo, Rome")}`
    );
  });

  it('does not show "Get Directions" when address is null', async () => {
    render(<StopCard stop={makeStop({ address: null })} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("link", { name: /get directions/i })).not.toBeInTheDocument();
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

  it("shows option address as a directions link when present", async () => {
    const stop = makeStop({
      options: [makeOption({ address: "Piazza Navona area" })],
    });
    render(<StopCard stop={stop} />);
    await userEvent.click(screen.getByRole("button"));
    const link = screen.getByRole("link", { name: /piazza navona area/i });
    expect(link).toHaveAttribute(
      "href",
      `https://maps.google.com/?q=${encodeURIComponent("Piazza Navona area")}`
    );
  });

  it("does not show options section when stop has no options", async () => {
    render(<StopCard stop={makeStop()} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
  });
});
