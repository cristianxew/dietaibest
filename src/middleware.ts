import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Middleware to protect routes with JWT validation
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Allow access to auth pages when not authenticated
    if (
      !token &&
      (pathname.startsWith("/sign-in") ||
        pathname.startsWith("/sign-up") ||
        pathname.startsWith("/auth"))
    ) {
      return NextResponse.next();
    }

    // Redirect to sign-in if accessing protected routes without token
    if (!token && pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // Check token expiry and redirect to refresh if needed
    if (token?.exp && typeof token.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = token.exp;

      // If token has expired, redirect to sign-in
      if (now > tokenExp) {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }

      // If token is about to expire (within 5 minutes), allow but flag for refresh
      if (now > tokenExp - 300) {
        const response = NextResponse.next();
        response.headers.set("x-token-refresh-needed", "true");
        return response;
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Allow public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/sign-")
        ) {
          return true;
        }

        // Require authentication for protected routes
        if (
          pathname.startsWith("/dashboard") ||
          (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth"))
        ) {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
