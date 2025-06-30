"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef } from "react";

// Persistent rate limiting state that survives page reloads
const getRateLimitState = () => {
  if (typeof window === "undefined")
    return {
      lastCheck: 0,
      resetTime: 0,
      backoffMultiplier: 1,
      isChecking: false,
    };

  try {
    const stored = localStorage.getItem("auth-rate-limit-state");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        lastCheck: parsed.lastCheck || 0,
        resetTime: parsed.resetTime || 0,
        backoffMultiplier: parsed.backoffMultiplier || 1,
        isChecking: false, // Never persist checking state
      };
    }
  } catch (e) {
    console.warn("Failed to read rate limit state:", e);
  }

  return {
    lastCheck: 0,
    resetTime: 0,
    backoffMultiplier: 1,
    isChecking: false,
  };
};

const setRateLimitState = (state: {
  lastCheck: number;
  resetTime: number;
  backoffMultiplier: number;
}) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("auth-rate-limit-state", JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to store rate limit state:", e);
  }
};

// Initialize from persistent storage
let rateLimitState = getRateLimitState();

// Utility to clear rate limit state (for debugging)
const clearRateLimitState = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth-rate-limit-state");
    rateLimitState = {
      lastCheck: 0,
      resetTime: 0,
      backoffMultiplier: 1,
      isChecking: false,
    };
  }
};

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

  // Check if we're currently rate limited
  const isRateLimited = Date.now() < rateLimitState.resetTime;

  /**
   * Check current token status
   */
  const checkTokenStatus =
    useCallback(async (): Promise<TokenStatus | null> => {
      try {
        const now = Date.now();

        // Refresh rate limit state from storage
        rateLimitState = getRateLimitState();

        // Global rate limiting: don't check more than once every 5 minutes across all instances
        if (
          rateLimitState.isChecking ||
          now - rateLimitState.lastCheck < 300000
        ) {
          return null;
        }

        // If we hit rate limit, wait until reset time
        if (now < rateLimitState.resetTime) {
          return null;
        }

        rateLimitState.isChecking = true;
        rateLimitState.lastCheck = now;

        const response = await fetch("/api/auth/refresh", {
          method: "GET",
          credentials: "include",
        });

        if (response.status === 429) {
          // Exponential backoff: increase backoff time with each rate limit
          rateLimitState.backoffMultiplier = Math.min(
            rateLimitState.backoffMultiplier * 2,
            8
          ); // Max 8x multiplier
          const backoffTime = 10 * 60 * 1000 * rateLimitState.backoffMultiplier; // 10 minutes * multiplier
          rateLimitState.resetTime = now + backoffTime;

          // Persist the new state
          setRateLimitState({
            lastCheck: rateLimitState.lastCheck,
            resetTime: rateLimitState.resetTime,
            backoffMultiplier: rateLimitState.backoffMultiplier,
          });

          console.warn(
            `Rate limited. Backing off for ${backoffTime / 60000} minutes`
          );
          return null;
        }

        // Reset backoff on successful request
        rateLimitState.backoffMultiplier = 1;
        setRateLimitState({
          lastCheck: rateLimitState.lastCheck,
          resetTime: 0, // Clear reset time on success
          backoffMultiplier: 1,
        });

        if (!response.ok) {
          return null;
        }

        const status: TokenStatus = await response.json();
        return status;
      } catch (error) {
        console.error("Failed to check token status:", error);
        return null;
      } finally {
        rateLimitState.isChecking = false;
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
        300000 // Minimum 5 minutes - tokens don't need frequent checking
      );

      refreshTimeoutRef.current = setTimeout(async () => {
        // Refresh rate limit state
        rateLimitState = getRateLimitState();

        // Skip if we're still in rate limit period
        if (Date.now() < rateLimitState.resetTime) {
          // Reschedule for after rate limit reset
          const waitTime = rateLimitState.resetTime - Date.now() + 1000;
          setTimeout(() => scheduleRefreshCheck(timeToExpiry), waitTime);
          return;
        }

        const status = await checkTokenStatus();

        if (status?.shouldRefresh) {
          await refreshToken();
        }

        // Schedule next check with minimum 5 minute interval
        if (status?.valid) {
          const nextCheckTime = Math.max(status.timeToExpiry, 300); // Minimum 5 minutes
          scheduleRefreshCheck(nextCheckTime);
        }
      }, checkTime);
    },
    [refreshThreshold, checkTokenStatus, refreshToken]
  );

  /**
   * Initialize token refresh monitoring
   */
  useEffect(() => {
    if (status === "authenticated" && enableAutoRefresh && !isRateLimited) {
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
  }, [
    status,
    enableAutoRefresh,
    isRateLimited,
    scheduleRefreshCheck,
    checkTokenStatus,
  ]);

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
    refreshToken: isRateLimited ? async () => false : manualRefresh,
    checkTokenStatus: isRateLimited ? async () => null : checkTokenStatus,
  };
}

// Export for debugging purposes
if (typeof window !== "undefined") {
  (
    window as typeof window & { clearAuthRateLimit: typeof clearRateLimitState }
  ).clearAuthRateLimit = clearRateLimitState;
}
