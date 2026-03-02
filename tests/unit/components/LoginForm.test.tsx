import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";
import { signIn } from "next-auth/react";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(signIn).mockReset();
    // Replace window.location with a plain writable object so we can assert href changes
    // without triggering jsdom navigation
    delete (window as unknown as { location: unknown }).location;
    (window as unknown as { location: { href: string } }).location = { href: "" };
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders email, password fields and sign in button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Use exact label text — /password/i also matches the "Show password" button aria-label
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("renders the Google OAuth button", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("has a link to the sign-up page", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/signup");
  });

  // ── Initial error from URL params ──────────────────────────────────────────

  it("displays human-readable error for CredentialsSignin code", () => {
    render(<LoginForm initialError="CredentialsSignin" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i);
  });

  it("displays default error message for unknown error codes", () => {
    render(<LoginForm initialError="SomeUnknownCode" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("renders no error alert when initialError is not provided", () => {
    render(<LoginForm />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // ── Credentials flow ───────────────────────────────────────────────────────

  it("calls signIn with credentials and redirects on success", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true, error: null } as never);

    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "jane@example.com",
        password: "password123",
        redirect: false,
      });
      expect(window.location.href).toBe("/dashboard");
    });
  });

  it("shows inline error alert when credentials are invalid", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, error: "CredentialsSignin" } as never);

    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
    expect(window.location.href).toBe("");
  });

  it("uses the provided callbackUrl on success", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true, error: null } as never);

    render(<LoginForm callbackUrl="/trips/new" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(window.location.href).toBe("/trips/new");
    });
  });

  // ── Google OAuth flow ──────────────────────────────────────────────────────

  it("calls signIn with google provider when Google button is clicked", async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);

    render(<LoginForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/dashboard" });
  });

  it("disables both buttons while Google OAuth is loading", async () => {
    // Never resolve so we can assert loading state
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}) as never);

    render(<LoginForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeDisabled();
  });

  // ── Password visibility toggle ─────────────────────────────────────────────

  it("toggles password field visibility", async () => {
    render(<LoginForm />);
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText("Password");

    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
