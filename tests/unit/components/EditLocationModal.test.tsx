import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { EditLocationModal } from "@/components/EditLocationModal";
import type { StopDetail } from "@/types/trip";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeStop(overrides: Partial<StopDetail> = {}): StopDetail {
  return {
    id: "stop-1",
    name: "Hotel Bristol",
    type: "hotel",
    time: null,
    address: "Hotel Bristol, Prague",
    lat: 50.0755,
    lng: 14.4378,
    notes: null,
    order: 1,
    options: [],
    ...overrides,
  };
}

const MAPBOX_SUGGESTIONS = {
  features: [
    {
      properties: {
        full_address: "Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic",
        name: "Hotel Bristol",
      },
      geometry: { coordinates: [14.4296, 50.0839] },
    },
    {
      properties: {
        full_address: "Hotel Bristol Vienna, Austria",
        name: "Hotel Bristol Vienna",
      },
      geometry: { coordinates: [16.3738, 48.2082] },
    },
  ],
};

/** Type into an input using fireEvent (safe under fake timers). */
function typeInto(el: HTMLElement, value: string) {
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value } });
}

/**
 * Advance fake timers (fires the debounce) then switch back to real timers
 * so that waitFor's internal polling and Promise microtasks can resolve.
 */
async function flushDebounce() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  vi.useRealTimers();
}

describe("EditLocationModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MAPBOX_SUGGESTIONS,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    mockFetch.mockReset();
  });

  it("renders with pre-filled address", () => {
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Search address")).toHaveValue("Hotel Bristol, Prague");
  });

  it("renders with empty input when stop.address is null", () => {
    render(<EditLocationModal stop={makeStop({ address: null })} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Search address")).toHaveValue("");
  });

  it("shows unavailable message when token is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "");
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/location search unavailable/i)).toBeInTheDocument();
  });

  it("Save button is disabled initially", () => {
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("fetches suggestions after 300ms debounce", async () => {
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Search address");
    typeInto(input, "Colosseum");
    expect(mockFetch).not.toHaveBeenCalled();
    await flushDebounce();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("Colosseum"));
  });

  it("shows suggestions after fetch completes", async () => {
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    typeInto(screen.getByLabelText("Search address"), "Bristol");
    await flushDebounce();
    await waitFor(() =>
      expect(screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")).toBeInTheDocument()
    );
  });

  it("enables Save after selecting a suggestion", async () => {
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    typeInto(screen.getByLabelText("Search address"), "Bristol");
    await flushDebounce();
    await waitFor(() => screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic"));
    fireEvent.click(screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic"));
    expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
  });

  it("disables Save again when input is edited after selection", async () => {
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    typeInto(screen.getByLabelText("Search address"), "Bristol");
    await flushDebounce();
    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    fireEvent.click(screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic"));
    typeInto(screen.getByLabelText("Search address"), "Bristol extra");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("calls onSave with correct args on successful save", async () => {
    const onSave = vi.fn();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MAPBOX_SUGGESTIONS })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stop: {} }) });
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={onSave} onClose={vi.fn()} />);
    typeInto(screen.getByLabelText("Search address"), "Bristol");
    await flushDebounce();
    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    fireEvent.click(screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      "stop-1",
      "Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic",
      50.0839,
      14.4296
    ));
  });

  it("shows error message when PATCH fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MAPBOX_SUGGESTIONS })
      .mockResolvedValueOnce({ ok: false });
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={vi.fn()} />);
    typeInto(screen.getByLabelText("Search address"), "Bristol");
    await flushDebounce();
    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    fireEvent.click(screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });
    await waitFor(() => expect(screen.getByText(/failed to save/i)).toBeInTheDocument());
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(<EditLocationModal stop={makeStop()} tripId="trip-1" onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
