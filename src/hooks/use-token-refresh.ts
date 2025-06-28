"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef } from "react";

interface TokenStatus {
  valid: boolean;
  expiresAt: number;
  timeToExpiry: number;
  shouldRefresh: boolean;
  sessionId: string;
}

interface UseTokenRefreshOptions {
  refreshThreshold?: number; // Minutes before expiry to trigger refresh
  onRefreshSuccess?: () => void;
  onRefreshError?: (error: string) => void;
  enableAutoRefresh?: boolean;
}

/**
 * Custom hook for automatic JWT token refresh
 * Monitors token expiry and triggers silent refresh when needed
 */
export function useTokenRefresh(options: UseTokenRefreshOptions = {}) {
  const {
    refreshThreshold = 5, // Default: 5 minutes before expiry
    onRefreshSuccess,
    onRefreshError,
    enableAutoRefresh = true,
  } = options;

  const { data: session, status } = useSession();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  /**
   * Check current token status
   */
  const checkTokenStatus =
    useCallback(async (): Promise<TokenStatus | null> => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          return null;
        }

        const status: TokenStatus = await response.json();
        return status;
      } catch (error) {
        console.error("Failed to check token status:", error);
        return null;
      }
    }, []);

  /**
   * Perform silent token refresh
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      return false; // Already refreshing
    }

    isRefreshingRef.current = true;

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        onRefreshError?.(error);
        return false;
      }

      const result = await response.json();

      if (result.success) {
        onRefreshSuccess?.();
        return true;
      }

      onRefreshError?.("Refresh failed");
      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      onRefreshError?.(errorMessage);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [onRefreshSuccess, onRefreshError]);

  /**
   * Schedule next refresh check
   */
  const scheduleRefreshCheck = useCallback(
    (timeToExpiry: number) => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      // Calculate when to check for refresh (threshold in seconds)
      const thresholdSeconds = refreshThreshold * 60;
      const checkTime = Math.max(
        (timeToExpiry - thresholdSeconds) * 1000,
        5000 // Minimum 5 seconds
      );

      refreshTimeoutRef.current = setTimeout(async () => {
        const status = await checkTokenStatus();

        if (status?.shouldRefresh) {
          await refreshToken();
        }

        // Schedule next check
        if (status?.valid) {
          scheduleRefreshCheck(status.timeToExpiry);
        }
      }, checkTime);
    },
    [refreshThreshold, checkTokenStatus, refreshToken]
  );

  /**
   * Initialize token refresh monitoring
   */
  useEffect(() => {
    if (status === "authenticated" && enableAutoRefresh) {
      checkTokenStatus().then((tokenStatus) => {
        if (tokenStatus?.valid) {
          scheduleRefreshCheck(tokenStatus.timeToExpiry);
        }
      });
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [status, enableAutoRefresh, scheduleRefreshCheck, checkTokenStatus]);

  /**
   * Manual refresh trigger
   */
  const manualRefresh = useCallback(async () => {
    return await refreshToken();
  }, [refreshToken]);

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    session,
    refreshToken: manualRefresh,
    checkTokenStatus,
  };
}
