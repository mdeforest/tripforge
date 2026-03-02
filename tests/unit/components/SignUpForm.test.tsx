import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpForm } from "@/components/SignUpForm";
import { signIn } from "next-auth/react";

// Mock global fetch for API calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("SignUpForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(signIn).mockReset();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders all form fields and submit button", () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Use exact label text — /password/i also matches the "Show password" button aria-label
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("has a link to the login page", () => {
    render(<SignUpForm />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows name error when name is empty on submit", async () => {
    render(<SignUpForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows email error for invalid email format", async () => {
    render(<SignUpForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), "Jane");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows password error for password shorter than 8 characters", async () => {
    render(<SignUpForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), "Jane");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/8 characters/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("POSTs to /api/auth/signup then calls signIn on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "1", name: "Jane", email: "jane@example.com" } }),
    });
    vi.mocked(signIn).mockResolvedValue(undefined as never);

    render(<SignUpForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), "Jane");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/signup",
        expect.objectContaining({ method: "POST" })
      );
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "jane@example.com",
        password: "password123",
        callbackUrl: "/dashboard",
      });
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  it("shows field-level email error for EMAIL_EXISTS response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Email exists", code: "EMAIL_EXISTS" }),
    });

    render(<SignUpForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), "Jane");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows server error banner for generic API failure", async () => {
    // Omit the error field to exercise the fallback message
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ code: "INTERNAL_ERROR" }),
    });

    render(<SignUpForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), "Jane");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  // ── Password visibility toggle ─────────────────────────────────────────────

  it("toggles password field visibility", async () => {
    render(<SignUpForm />);
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText("Password");

    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
