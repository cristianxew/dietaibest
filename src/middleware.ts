import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import createIntlMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/request";

// Route configuration
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/auth/callback",
  "/auth/error",
];

const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/meal-plans",
  "/recipes",
  "/shopping-lists",
];

const PROTECTED_API_ROUTES = [
  "/api/user",
  "/api/meals",
  "/api/recipes",
  "/api/shopping-lists",
  "/api/profiles",
  "/api/progress",
];

const PUBLIC_API_ROUTES = ["/api/auth", "/api/health"];

// Create the intl middleware
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // Only add locale prefix when not default
});

/**
 * Enhanced authentication middleware with i18n support and comprehensive route protection
 */
export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const method = req.method;
    const userAgent = req.headers.get("user-agent") || "";
    const requestTime = new Date().toISOString();

    // Enhanced logging for monitoring
    console.info(
      `[${requestTime}] ${method} ${pathname} - Token: ${
        !!token ? "Valid" : "None"
      } - UA: ${userAgent.slice(0, 50)}`
    );

    // Security headers for all responses
    const securityHeaders = {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-XSS-Protection": "1; mode=block",
    };

    /**
     * Handle authentication redirects with proper return URLs and locale preservation
     */
    const createAuthRedirect = (returnTo?: string) => {
      // Extract locale from current pathname
      const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
      const currentLocale = localeMatch?.[1];
      const localePrefix =
        currentLocale && currentLocale !== defaultLocale
          ? `/${currentLocale}`
          : "";

      const signInUrl = new URL(`${localePrefix}/sign-in`, req.url);
      if (returnTo && returnTo !== "/" && !returnTo.startsWith("/sign-")) {
        signInUrl.searchParams.set("redirect", returnTo);
      }
      console.info(
        `[${requestTime}] Redirecting to sign-in with return URL: ${returnTo} (locale: ${
          currentLocale || defaultLocale
        })`
      );
      return NextResponse.redirect(signInUrl);
    };

    /**
     * Create API error response
     */
    const createApiError = (status: number, message: string) => {
      console.warn(
        `[${requestTime}] API Error ${status}: ${message} for ${pathname}`
      );
      return new NextResponse(
        JSON.stringify({ error: message, timestamp: requestTime }),
        {
          status,
          headers: {
            "Content-Type": "application/json",
            ...securityHeaders,
          },
        }
      );
    };

    /**
     * Get base pathname without locale prefix
     */
    const getBasePathname = (path: string) => {
      const localeMatch = path.match(/^\/([a-z]{2})(\/.*)?$/);
      if (
        localeMatch &&
        locales.includes(localeMatch[1] as (typeof locales)[number])
      ) {
        return localeMatch[2] || "/";
      }
      return path;
    };

    // Handle API routes (no i18n for API routes)
    if (pathname.startsWith("/api/")) {
      // Allow public API routes
      if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
        const response = NextResponse.next();
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      // Protect private API routes
      if (PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route))) {
        if (!token) {
          return createApiError(401, "Authentication required");
        }

        // Check token expiry for API routes
        if (token?.exp && typeof token.exp === "number") {
          const now = Math.floor(Date.now() / 1000);
          if (now > token.exp) {
            return createApiError(401, "Token has expired");
          }
        }

        // Validate session ID for API calls
        if (!token?.sessionId) {
          return createApiError(401, "Invalid session");
        }

        const response = NextResponse.next();
        response.headers.set("x-user-id", token.sub || "");
        response.headers.set("x-session-id", token.sessionId as string);
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      // Default API protection - require auth for unknown API routes
      if (!token) {
        return createApiError(401, "Authentication required");
      }
    }

    // Get the base pathname for route checking
    const basePath = getBasePathname(pathname);

    // Allow access to public routes (with or without locale)
    if (PUBLIC_ROUTES.includes(basePath)) {
      // Apply i18n middleware for public routes
      const intlResponse = intlMiddleware(req);
      if (intlResponse) {
        Object.entries(securityHeaders).forEach(([key, value]) => {
          intlResponse.headers.set(key, value);
        });
        return intlResponse;
      }

      const response = NextResponse.next();
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Allow access to auth pages when not authenticated (with i18n)
    if (!token && basePath.startsWith("/auth")) {
      const intlResponse = intlMiddleware(req);
      if (intlResponse) {
        Object.entries(securityHeaders).forEach(([key, value]) => {
          intlResponse.headers.set(key, value);
        });
        return intlResponse;
      }

      const response = NextResponse.next();
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Redirect unauthenticated users from protected routes
    if (
      !token &&
      PROTECTED_ROUTES.some((route) => basePath.startsWith(route))
    ) {
      return createAuthRedirect(pathname);
    }

    // Token validation for authenticated requests
    if (token?.exp && typeof token.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = token.exp;
      const timeToExpiry = tokenExp - now;

      // If token has expired, redirect to sign-in
      if (now > tokenExp) {
        console.warn(
          `[${requestTime}] Expired token access attempt for session: ${token.sessionId}`
        );
        return createAuthRedirect(pathname);
      }

      // If token is about to expire (within 5 minutes), flag for refresh
      if (timeToExpiry < 300) {
        console.info(
          `[${requestTime}] Token refresh needed in ${timeToExpiry}s for session: ${token.sessionId}`
        );

        // Apply i18n middleware for authenticated routes
        const intlResponse = intlMiddleware(req);
        const response = intlResponse || NextResponse.next();

        response.headers.set("x-token-refresh-needed", "true");
        response.headers.set("x-token-expires-in", timeToExpiry.toString());
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
    }

    // Apply i18n middleware for all other routes
    const intlResponse = intlMiddleware(req);
    const response = intlResponse || NextResponse.next();

    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add user context headers for authenticated requests
    if (token) {
      response.headers.set("x-user-authenticated", "true");
      response.headers.set("x-user-id", token.sub || "");
      if (token.sessionId) {
        response.headers.set("x-session-id", token.sessionId as string);
      }
    }

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const basePath = getBasePathname(pathname);

        // Always allow public routes and auth routes
        if (
          PUBLIC_ROUTES.includes(basePath) ||
          basePath.startsWith("/auth/") ||
          PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))
        ) {
          return true;
        }

        // Always require authentication for protected routes and APIs
        if (
          PROTECTED_ROUTES.some((route) => basePath.startsWith(route)) ||
          PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route))
        ) {
          return !!token;
        }

        // Default to requiring authentication for unknown routes
        return !!token;
      },
    },
  }
);

// Helper function used in authorized callback
function getBasePathname(path: string) {
  const supportedLocales = ["en", "pl", "es"] as const; // Duplicated for use in authorized callback
  const localeMatch = path.match(/^\/([a-z]{2})(\/.*)?$/);
  if (
    localeMatch &&
    supportedLocales.includes(
      localeMatch[1] as (typeof supportedLocales)[number]
    )
  ) {
    return localeMatch[2] || "/";
  }
  return path;
}

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
