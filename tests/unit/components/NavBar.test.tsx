import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSession, signOut } from "next-auth/react";
import { NavBar } from "@/components/NavBar";

// next/link needs a router context — mock it to render a plain anchor
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockSession = {
  data: {
    user: { id: "user_1", name: "Jane Doe", email: "jane@example.com" },
    expires: "2099-01-01",
  },
  status: "authenticated" as const,
};

describe("NavBar", () => {
  it("renders the TripForge logo", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated", update: vi.fn() });
    render(<NavBar />);
    expect(screen.getByText("TripForge")).toBeInTheDocument();
  });

  it("links the logo to /dashboard", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated", update: vi.fn() });
    render(<NavBar />);
    const logo = screen.getByText("TripForge").closest("a");
    expect(logo).toHaveAttribute("href", "/dashboard");
  });

  it("hides the user menu when not authenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated", update: vi.fn() });
    render(<NavBar />);
    expect(screen.queryByRole("button", { name: /user menu/i })).not.toBeInTheDocument();
  });

  it("shows user initial when authenticated", () => {
    vi.mocked(useSession).mockReturnValue(mockSession as ReturnType<typeof useSession>);
    render(<NavBar />);
    // "Jane Doe" → initial is "J"
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("shows the user's name in the avatar button", () => {
    vi.mocked(useSession).mockReturnValue(mockSession as ReturnType<typeof useSession>);
    render(<NavBar />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("opens the dropdown when the avatar button is clicked", () => {
    vi.mocked(useSession).mockReturnValue(mockSession as ReturnType<typeof useSession>);
    render(<NavBar />);

    const avatarButton = screen.getByRole("button", { name: /user menu/i });
    fireEvent.click(avatarButton);

    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("calls signOut when Sign out is clicked", () => {
    vi.mocked(useSession).mockReturnValue(mockSession as ReturnType<typeof useSession>);
    render(<NavBar />);

    fireEvent.click(screen.getByRole("button", { name: /user menu/i }));
    fireEvent.click(screen.getByText("Sign out"));

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("closes the dropdown when the backdrop is clicked", () => {
    vi.mocked(useSession).mockReturnValue(mockSession as ReturnType<typeof useSession>);
    render(<NavBar />);

    fireEvent.click(screen.getByRole("button", { name: /user menu/i }));
    expect(screen.getByText("Sign out")).toBeInTheDocument();

    // The backdrop is the fixed div rendered behind the dropdown
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });
});
