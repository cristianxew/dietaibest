import { vi } from "vitest";

/**
 * Creates a mock session for testing authenticated requests
 */
export function createMockSession() {
  const mockSession = {
    user: {
      email: "test@example.com",
      name: "Test User",
      id: "test-user-id",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  // Mock next-auth getServerSession
  vi.doMock("next-auth", () => ({
    getServerSession: vi.fn().mockResolvedValue(mockSession),
  }));

  return mockSession;
}

/**
 * Clears all mocks and resets session
 */
export function clearMockSession() {
  vi.clearAllMocks();
  vi.resetAllMocks();
}
