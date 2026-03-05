import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatTab } from "@/components/ChatTab";

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  tripId: "trip-1",
  tripName: "Italy Adventure",
  destination: "Rome, Italy",
};

/** Creates a mock streaming fetch response from an array of text chunks. */
function makeStreamResponse(...chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChatTab", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: online
    vi.stubEnv("NODE_ENV", "test");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the welcome message with trip name and destination", () => {
    render(<ChatTab {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Italy Adventure/)).toBeInTheDocument();
    expect(screen.getByText(/Rome, Italy/)).toBeInTheDocument();
  });

  it("renders suggested questions", () => {
    render(<ChatTab {...DEFAULT_PROPS} />);
    expect(screen.getByText("What should I pack for this trip?")).toBeInTheDocument();
  });

  it("renders the message input", () => {
    render(<ChatTab {...DEFAULT_PROPS} />);
    expect(screen.getByRole("textbox", { name: "Chat message" })).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<ChatTab {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("send button is enabled when input has text", async () => {
    render(<ChatTab {...DEFAULT_PROPS} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Chat message" }), "Hello");
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  it("sends a message and shows the streamed response", async () => {
    mockFetch.mockResolvedValue(makeStreamResponse("Hello ", "from Gemini!"));

    render(<ChatTab {...DEFAULT_PROPS} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Chat message" }), "Hi there");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    // User message appears
    expect(await screen.findByText("Hi there")).toBeInTheDocument();

    // Streamed model response appears
    await waitFor(() => {
      expect(screen.getByText("Hello from Gemini!")).toBeInTheDocument();
    });
  });

  it("clears the input after sending", async () => {
    mockFetch.mockResolvedValue(makeStreamResponse("OK"));

    render(<ChatTab {...DEFAULT_PROPS} />);
    const input = screen.getByRole("textbox", { name: "Chat message" });
    await userEvent.type(input, "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("sends a message via Enter key", async () => {
    mockFetch.mockResolvedValue(makeStreamResponse("Response"));

    render(<ChatTab {...DEFAULT_PROPS} />);
    const input = screen.getByRole("textbox", { name: "Chat message" });
    await userEvent.type(input, "Hello{Enter}");

    expect(await screen.findByText("Hello")).toBeInTheDocument();
  });

  it("shows an error message when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ChatTab {...DEFAULT_PROPS} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Chat message" }), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("sends a suggested question when clicked", async () => {
    mockFetch.mockResolvedValue(makeStreamResponse("Here are some tips…"));

    render(<ChatTab {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByText("What should I pack for this trip?"));

    expect(await screen.findByText("What should I pack for this trip?")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("shows the offline banner when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<ChatTab {...DEFAULT_PROPS} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it("disables input and send button when offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<ChatTab {...DEFAULT_PROPS} />);
    expect(screen.getByRole("textbox", { name: "Chat message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
