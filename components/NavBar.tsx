"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Map, LogOut, User } from "lucide-react";
import { useState } from "react";

/**
 * Top navigation bar — always visible on authenticated pages.
 *
 * Left:  TripForge logo (links to dashboard)
 * Right: User avatar + name with a dropdown menu (logout)
 */
export function NavBar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-sm shadow-nav">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-serif text-xl font-semibold text-ink"
        >
          <Map className="h-5 w-5 text-rust" strokeWidth={1.75} />
          TripForge
        </Link>

        {/* User menu */}
        {session?.user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-ink-mid hover:bg-parchment transition-colors"
              aria-label="User menu"
              aria-expanded={menuOpen}
            >
              {/* Avatar — initials fallback */}
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rust text-xs font-semibold text-cream">
                {session.user.name
                  ? session.user.name.charAt(0).toUpperCase()
                  : <User className="h-4 w-4" />}
              </span>
              <span className="hidden sm:block max-w-[140px] truncate">
                {session.user.name ?? session.user.email}
              </span>
            </button>

            {menuOpen && (
              <>
                {/* Click-away backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl bg-cream shadow-card-hover ring-1 ring-ink/5 overflow-hidden">
                  <div className="border-b border-parchment-dark px-4 py-2.5">
                    <p className="truncate text-xs font-medium text-ink">
                      {session.user.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {session.user.email}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-mid hover:bg-parchment transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
