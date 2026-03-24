import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChecklistTab } from "@/components/ChecklistTab";
import type { ChecklistItem } from "@/types/trip";

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ITEMS: ChecklistItem[] = [
  { id: "i1", category: "Clothing", label: "Rain jacket", checked: false, is_custom: false },
  { id: "i2", category: "Clothing", label: "Warm socks", checked: true, is_custom: false },
  { id: "i3", category: "Electronics", label: "Phone charger", checked: false, is_custom: false },
];

const DEFAULT_PROPS = { tripId: "trip-1", initialItems: ITEMS };

function okResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChecklistTab", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it("renders the packing list heading", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    expect(screen.getByText("Packing List")).toBeInTheDocument();
  });

  it("groups items by category", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    // Use getAllByText because "Clothing" also appears as a <option> in the add-item select
    expect(screen.getAllByText("Clothing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Electronics").length).toBeGreaterThan(0);
    expect(screen.getByText("Rain jacket")).toBeInTheDocument();
    expect(screen.getByText("Warm socks")).toBeInTheDocument();
    expect(screen.getByText("Phone charger")).toBeInTheDocument();
  });

  it("shows the progress indicator", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    // 1 of 3 items checked
    expect(screen.getByText("1 / 3 packed")).toBeInTheDocument();
  });

  it("shows a progress bar", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("pre-checks items that are already checked", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    const checkbox = screen.getByLabelText("Warm socks");
    expect(checkbox).toBeChecked();
  });

  it("renders unchecked items without strikethrough class", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    const label = screen.getByText("Rain jacket");
    expect(label.className).not.toContain("line-through");
  });

  it("renders checked items with strikethrough", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    const label = screen.getByText("Warm socks");
    expect(label.className).toContain("line-through");
  });

  it("shows empty state when no items", () => {
    render(<ChecklistTab tripId="trip-1" initialItems={[]} />);
    expect(screen.getByText(/No items yet\. Add your first item above\./)).toBeInTheDocument();
  });

  it("renders a delete button for each item", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText("Delete Rain jacket")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Phone charger")).toBeInTheDocument();
  });

  it("renders the add item form", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText("New item name")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Add item")).toBeInTheDocument();
  });

  it("add button is disabled when label is empty", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText("Add item")).toBeDisabled();
  });

  // ── Check / uncheck (optimistic) ────────────────────────────────────────────

  it("toggles a checkbox optimistically and fires PATCH", async () => {
    mockFetch.mockResolvedValue(okResponse({ item: { ...ITEMS[0], checked: true } }));

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    const checkbox = screen.getByLabelText("Rain jacket");
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trips/trip-1/checklist",
        expect.objectContaining({ method: "PATCH" })
      )
    );
  });

  it("reverts the checkbox on PATCH failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    const checkbox = screen.getByLabelText("Rain jacket");

    await userEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
  });

  it("updates the progress counter after checking an item", async () => {
    mockFetch.mockResolvedValue(okResponse({ item: { ...ITEMS[0], checked: true } }));

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByLabelText("Rain jacket"));

    await waitFor(() =>
      expect(screen.getByText("2 / 3 packed")).toBeInTheDocument()
    );
  });

  // ── Add custom item ──────────────────────────────────────────────────────────

  it("adds a custom item and appends it to the list", async () => {
    const newItem: ChecklistItem = {
      id: "i-new",
      category: "Other",
      label: "Travel pillow",
      checked: false,
      is_custom: true,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ item: newItem }),
    } as unknown as Response);

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    await userEvent.type(screen.getByLabelText("New item name"), "Travel pillow");
    await userEvent.click(screen.getByLabelText("Add item"));

    await waitFor(() =>
      expect(screen.getByText("Travel pillow")).toBeInTheDocument()
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/trips/trip-1/checklist",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("clears the input after adding an item", async () => {
    const newItem: ChecklistItem = {
      id: "i-new",
      category: "Other",
      label: "Neck pillow",
      checked: false,
      is_custom: true,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ item: newItem }),
    } as unknown as Response);

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    const input = screen.getByLabelText("New item name");
    await userEvent.type(input, "Neck pillow");
    await userEvent.click(screen.getByLabelText("Add item"));

    await waitFor(() => expect(input).toHaveValue(""));
  });

  // ── Delete item ──────────────────────────────────────────────────────────────

  it("removes an item from the list optimistically on delete", async () => {
    mockFetch.mockResolvedValue(okResponse({ success: true }));

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    expect(screen.getByText("Rain jacket")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Delete Rain jacket"));

    await waitFor(() =>
      expect(screen.queryByText("Rain jacket")).not.toBeInTheDocument()
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/trips/trip-1/checklist",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("updates the progress after deleting a checked item", async () => {
    mockFetch.mockResolvedValue(okResponse({ success: true }));

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    // "Warm socks" is checked — deleting it should drop the numerator
    await userEvent.click(screen.getByLabelText("Delete Warm socks"));

    await waitFor(() =>
      // 0 of 2 remaining
      expect(screen.getByText("0 / 2 packed")).toBeInTheDocument()
    );
  });

  // ── Reset ────────────────────────────────────────────────────────────────────

  it("shows the Reset button only when at least one item is checked", () => {
    render(<ChecklistTab {...DEFAULT_PROPS} />);
    // ITEMS has one checked item ("Warm socks"), so Reset should be visible
    expect(screen.getByLabelText("Uncheck all items")).toBeInTheDocument();
  });

  it("does not show the Reset button when nothing is checked", () => {
    const allUnchecked = ITEMS.map((i) => ({ ...i, checked: false }));
    render(<ChecklistTab tripId="trip-1" initialItems={allUnchecked} />);
    expect(screen.queryByLabelText("Uncheck all items")).not.toBeInTheDocument();
  });

  it("unchecks all items optimistically on Reset and fires PATCH for each", async () => {
    mockFetch.mockResolvedValue(okResponse({ item: {} }));

    render(<ChecklistTab {...DEFAULT_PROPS} />);
    // "Warm socks" starts checked
    expect(screen.getByLabelText("Warm socks")).toBeChecked();

    await userEvent.click(screen.getByLabelText("Uncheck all items"));

    expect(screen.getByLabelText("Warm socks")).not.toBeChecked();
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trips/trip-1/checklist",
        expect.objectContaining({ method: "PATCH" })
      )
    );
  });
});
