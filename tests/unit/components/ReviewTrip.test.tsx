import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewTrip } from "@/components/ReviewTrip";
import { useRouter } from "next/navigation";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const PARSED_DATA = {
  tripName: "Italy Adventure",
  destination: "Rome, Italy",
  startDate: "2025-07-15",
  endDate: "2025-08-15",
  days: [
    {
      dayNumber: 1,
      date: "2025-07-15",
      title: "Arrival in Rome",
      stops: [
        { name: "Colosseum", type: "activity" as const, time: null, address: null, notes: null, order: 1 },
        { name: "Trevi Fountain", type: "activity" as const, time: null, address: null, notes: null, order: 2 },
      ],
    },
    {
      dayNumber: 2,
      date: "2025-07-16",
      title: "Vatican Day",
      stops: [
        { name: "Vatican Museums", type: "activity" as const, time: "9:00 AM", address: null, notes: null, order: 1 },
      ],
    },
  ],
};

describe("ReviewTrip", () => {
  const mockOnBack = vi.fn();
  const mockPush = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockOnBack.mockReset();
    mockPush.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders trip name and destination", () => {
    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    expect(screen.getByText("Italy Adventure")).toBeInTheDocument();
    expect(screen.getByText("Rome, Italy")).toBeInTheDocument();
  });

  it("renders the date range when both dates are provided", () => {
    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    expect(screen.getByText(/Jul 15, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/Aug 15, 2025/)).toBeInTheDocument();
  });

  it("renders day and stop counts", () => {
    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    expect(screen.getByText(/2 days/i)).toBeInTheDocument();
    expect(screen.getByText(/3 stops/i)).toBeInTheDocument();
  });

  it("renders per-day breakdown with stop names", () => {
    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    expect(screen.getByText(/Arrival in Rome/i)).toBeInTheDocument();
    expect(screen.getByText(/Colosseum/)).toBeInTheDocument();
    expect(screen.getByText(/Vatican Day/i)).toBeInTheDocument();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("calls onBack when Back button is clicked", async () => {
    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(mockOnBack).toHaveBeenCalledOnce();
  });

  // ── Confirm flow ───────────────────────────────────────────────────────────

  it("POSTs to /api/trips and navigates to /dashboard on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { id: "trip-1", name: "Italy Adventure", destination: "Rome" } }),
    });

    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create trip/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trips",
        expect.objectContaining({ method: "POST" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error alert when API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to create trip.", code: "INTERNAL_ERROR" }),
    });

    render(<ReviewTrip parsedData={PARSED_DATA} rawText="raw" onBack={mockOnBack} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create trip/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to create trip/i);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
