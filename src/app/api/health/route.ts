import { NextResponse } from "next/server";

/**
 * Health check endpoint for load balancer and container orchestration
 * Used by Traefik for zero-downtime deployments
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
