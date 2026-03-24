import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadForm } from "@/components/UploadForm";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const PARSED_RESPONSE = {
  parsedData: {
    tripName: "Italy Trip",
    destination: "Rome",
    startDate: null,
    endDate: null,
    days: [{ dayNumber: 1, date: null, title: "Day 1", stops: [] }],
  },
  rawText: "Day 1: Arrive in Rome",
  packingList: [{ category: "Clothing", label: "Rain jacket" }],
};

describe("UploadForm", () => {
  const mockOnParsed = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockOnParsed.mockReset();
  });

  // ── Tab rendering ──────────────────────────────────────────────────────────

  it("renders 3 tabs with 'Paste text' active by default", () => {
    render(<UploadForm onParsed={mockOnParsed} />);
    expect(screen.getByRole("tab", { name: /paste text/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /upload file/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /google docs/i })).toHaveAttribute("aria-selected", "false");
    // Textarea is shown
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows the file upload area when 'Upload file' tab is clicked", async () => {
    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /upload file/i }));
    expect(screen.getByRole("tab", { name: /upload file/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /click to upload/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the URL input when 'Google Docs' tab is clicked", async () => {
    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /google docs/i }));
    expect(screen.getByLabelText(/google docs url/i)).toBeInTheDocument();
  });

  // ── Text mode ─────────────────────────────────────────────────────────────

  it("updates textarea as user types", async () => {
    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Day 1: Visit Rome");
    expect(screen.getByRole("textbox")).toHaveValue("Day 1: Visit Rome");
  });

  it("submits text and calls onParsed on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => PARSED_RESPONSE,
    });

    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Day 1: Visit Rome");
    await user.click(screen.getByRole("button", { name: /parse itinerary/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trips/parse",
        expect.objectContaining({ method: "POST" })
      );
      expect(mockOnParsed).toHaveBeenCalledWith(PARSED_RESPONSE);
    });
  });

  it("shows loading panel while request is in flight", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves

    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Day 1: Visit Rome");
    await user.click(screen.getByRole("button", { name: /parse itinerary/i }));

    // Loading panel replaces the form inputs
    expect(await screen.findByRole("status", { name: /parsing itinerary/i })).toBeInTheDocument();
    // Tabs are disabled while loading
    expect(screen.getByRole("tab", { name: /paste text/i })).toBeDisabled();
    // Submit button is gone (replaced by the loading panel)
    expect(screen.queryByRole("button", { name: /parse itinerary/i })).not.toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it("shows error banner when API returns an error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Couldn't parse the itinerary.", code: "PARSE_FAILED" }),
    });

    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "some text");
    await user.click(screen.getByRole("button", { name: /parse itinerary/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't parse/i);
    expect(mockOnParsed).not.toHaveBeenCalled();
  });

  // ── File mode ─────────────────────────────────────────────────────────────

  it("shows selected filename after file is chosen", async () => {
    render(<UploadForm onParsed={mockOnParsed} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /upload file/i }));

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["content"], "my-itinerary.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    expect(screen.getByText("my-itinerary.pdf")).toBeInTheDocument();
  });
});
