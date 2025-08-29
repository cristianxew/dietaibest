/**
 * Cache Management API Endpoint
 *
 * GET /api/nutrition/cache - Get cache statistics
 * DELETE /api/nutrition/cache - Clear all cache
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getCacheStats, clearAllCache } from "@/services/nutritionCache";

interface CacheStatsResponse {
  success: boolean;
  data?: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    memorySize: number;
    memoryMaxSize: number;
    memoryUsage: number;
    databaseCacheSize: number;
    evictions: number;
    warmupTime: number;
    topKeys: Array<{ key: string; hits: number; lastAccessed: number }>;
  };
  error?: string;
}

interface CacheClearResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// GET: Get cache statistics
export async function GET(): Promise<NextResponse<CacheStatsResponse>> {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get cache statistics
    const stats = await getCacheStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting cache statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get cache statistics",
      },
      { status: 500 }
    );
  }
}

// DELETE: Clear all cache
export async function DELETE(): Promise<NextResponse<CacheClearResponse>> {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Clear all cache
    await clearAllCache();

    return NextResponse.json({
      success: true,
      message: "Cache cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear cache",
      },
      { status: 500 }
    );
  }
}
