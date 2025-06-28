import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Rate limiting storage (in production, use Redis or a proper cache)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Security constants
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 20; // Max 20 refresh attempts per IP per window
const MAX_REQUESTS_PER_SESSION = 10; // Max 10 refreshes per session per window

/**
 * Get client IP address for rate limiting
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (real) {
    return real.trim();
  }

  // Fallback for development
  return "127.0.0.1";
}

/**
 * Check rate limit for IP and session
 */
function checkRateLimit(
  ip: string,
  sessionId?: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Check IP-based rate limit
  const ipKey = `ip:${ip}`;
  const ipLimit = rateLimitMap.get(ipKey);

  if (ipLimit) {
    if (now > ipLimit.resetTime) {
      // Reset window
      rateLimitMap.set(ipKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else if (ipLimit.count >= MAX_REQUESTS_PER_WINDOW) {
      return {
        allowed: false,
        retryAfter: Math.ceil((ipLimit.resetTime - now) / 1000),
      };
    } else {
      ipLimit.count++;
    }
  } else {
    rateLimitMap.set(ipKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }

  // Check session-based rate limit if session exists
  if (sessionId) {
    const sessionKey = `session:${sessionId}`;
    const sessionLimit = rateLimitMap.get(sessionKey);

    if (sessionLimit) {
      if (now > sessionLimit.resetTime) {
        rateLimitMap.set(sessionKey, {
          count: 1,
          resetTime: now + RATE_LIMIT_WINDOW,
        });
      } else if (sessionLimit.count >= MAX_REQUESTS_PER_SESSION) {
        return {
          allowed: false,
          retryAfter: Math.ceil((sessionLimit.resetTime - now) / 1000),
        };
      } else {
        sessionLimit.count++;
      }
    } else {
      rateLimitMap.set(sessionKey, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW,
      });
    }
  }

  return { allowed: true };
}

/**
 * Enhanced silent token refresh endpoint
 * Handles JWT token refresh with rate limiting and security checks
 */
export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const requestTime = new Date().toISOString();

  try {
    // Get the current token from the request
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      console.warn(
        `[${requestTime}] Token refresh failed - No token found for IP: ${clientIP}`
      );
      return NextResponse.json(
        { error: "No valid token found" },
        { status: 401 }
      );
    }

    const sessionId = token.sessionId as string;

    // Check rate limits
    const rateLimitResult = checkRateLimit(clientIP, sessionId);
    if (!rateLimitResult.allowed) {
      console.warn(
        `[${requestTime}] Rate limit exceeded for IP: ${clientIP}, Session: ${sessionId}`
      );
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter?.toString() || "900",
          },
        }
      );
    }

    // Validate request method and headers
    const userAgent = req.headers.get("user-agent");
    const referer = req.headers.get("referer");

    // Basic security checks
    if (!userAgent || (!referer && process.env.NODE_ENV === "production")) {
      console.warn(
        `[${requestTime}] Suspicious refresh request - Missing headers from IP: ${clientIP}`
      );
      return NextResponse.json(
        { error: "Invalid request headers" },
        { status: 400 }
      );
    }

    // Check if token is still valid and not expired
    const now = Math.floor(Date.now() / 1000);
    const tokenExp = token.exp as number;
    const timeToExpiry = tokenExp - now;

    if (now > tokenExp) {
      console.info(
        `[${requestTime}] Token refresh failed - Token expired for session: ${sessionId}`
      );
      return NextResponse.json({ error: "Token has expired" }, { status: 401 });
    }

    // Check if refresh is actually needed (prevent unnecessary refreshes)
    if (timeToExpiry > 600) {
      // More than 10 minutes left
      console.info(
        `[${requestTime}] Early refresh attempt blocked - ${timeToExpiry}s remaining for session: ${sessionId}`
      );
      return NextResponse.json(
        {
          error: "Token refresh not needed yet",
          expiresAt: tokenExp,
          timeToExpiry,
        },
        { status: 400 }
      );
    }

    // Create a new token with extended expiry
    const refreshedToken = {
      ...token,
      iat: now,
      exp: now + 60 * 60, // Extend by 1 hour
      shouldRefresh: false, // Reset refresh flag
    };

    console.info(
      `[${requestTime}] Token successfully refreshed for session: ${sessionId}, IP: ${clientIP}`
    );

    // Return success with token metadata (don't expose actual token)
    return NextResponse.json({
      success: true,
      expiresAt: refreshedToken.exp,
      refreshedAt: refreshedToken.iat,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error(
      `[${requestTime}] Token refresh error for IP ${clientIP}:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}

/**
 * Enhanced GET endpoint to check token status
 * Includes rate limiting and security checks for token validation
 */
export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req);
  const requestTime = new Date().toISOString();

  try {
    // Apply lighter rate limiting for status checks
    const statusRateLimit = checkRateLimit(clientIP);
    if (!statusRateLimit.allowed) {
      console.warn(
        `[${requestTime}] Status check rate limit exceeded for IP: ${clientIP}`
      );
      return NextResponse.json(
        {
          valid: false,
          error: "Rate limit exceeded",
          retryAfter: statusRateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": statusRateLimit.retryAfter?.toString() || "900",
          },
        }
      );
    }

    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "No token found" },
        { status: 401 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenExp = token.exp as number;
    const timeToExpiry = tokenExp - now;
    const isValid = now < tokenExp;
    const sessionId = token.sessionId as string;

    // Log token status checks for monitoring
    console.info(
      `[${requestTime}] Token status checked - Valid: ${isValid}, Time to expiry: ${timeToExpiry}s, Session: ${sessionId}, IP: ${clientIP}`
    );

    return NextResponse.json({
      valid: isValid,
      expiresAt: tokenExp,
      timeToExpiry: Math.max(0, timeToExpiry),
      shouldRefresh: timeToExpiry < 300 && timeToExpiry > 0, // Less than 5 minutes but not expired
      sessionId: sessionId,
      checkedAt: now,
    });
  } catch (error) {
    console.error(
      `[${requestTime}] Token status check error for IP ${clientIP}:`,
      error
    );
    return NextResponse.json(
      { valid: false, error: "Failed to check token" },
      { status: 500 }
    );
  }
}

/**
 * Cleanup function to remove old rate limit entries
 * Should be called periodically in production
 */
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

// Auto-cleanup every hour in development
if (process.env.NODE_ENV === "development") {
  setInterval(cleanupRateLimitMap, 60 * 60 * 1000);
}
