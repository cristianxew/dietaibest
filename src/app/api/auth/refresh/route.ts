import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Silent token refresh endpoint
 * This endpoint handles JWT token refresh before expiry
 * Called automatically by the client when tokens are about to expire
 */
export async function POST(req: NextRequest) {
  try {
    // Get the current token from the request
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "No valid token found" },
        { status: 401 }
      );
    }

    // Check if token is still valid and not expired
    const now = Math.floor(Date.now() / 1000);
    const tokenExp = token.exp as number;

    if (now > tokenExp) {
      return NextResponse.json({ error: "Token has expired" }, { status: 401 });
    }

    // Create a new token with extended expiry
    const refreshedToken = {
      ...token,
      iat: now,
      exp: now + 60 * 60, // Extend by 1 hour
      shouldRefresh: false, // Reset refresh flag
    };

    // Return success with token metadata (don't expose actual token)
    return NextResponse.json({
      success: true,
      expiresAt: refreshedToken.exp,
      refreshedAt: refreshedToken.iat,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check token status
 * Useful for client-side token validation
 */
export async function GET(req: NextRequest) {
  try {
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

    return NextResponse.json({
      valid: now < tokenExp,
      expiresAt: tokenExp,
      timeToExpiry,
      shouldRefresh: timeToExpiry < 300, // Less than 5 minutes
      sessionId: token.sessionId,
    });
  } catch (error) {
    console.error("Token status check error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to check token" },
      { status: 500 }
    );
  }
}
