import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Route protection middleware.
 *
 * Uses NextAuth's `withAuth` helper which reads the JWT from the
 * session cookie without a DB round-trip (edge-compatible).
 *
 * Protected routes: /dashboard, /trips (and all sub-paths)
 * Public routes:    /login, /signup, /api/auth/*, / (root redirect)
 *
 * Unauthenticated requests to protected routes are redirected to /login.
 */
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trips/:path*",
  ],
};
