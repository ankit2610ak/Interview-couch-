/**
 * Network utilities for internet connectivity validation and resilient retry mechanisms.
 */

export class NetworkError extends Error {
  isOffline: boolean;
  constructor(message: string, isOffline = false) {
    super(message);
    this.name = "NetworkError";
    this.isOffline = isOffline;
  }
}

/**
 * Returns true if the browser currently reports an active internet connection.
 */
export function checkIsOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine !== false;
}

/**
 * Determines whether a given error represents a network connection drop,
 * DNS failure, offline state, or server reachability issue.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (!checkIsOnline()) return true;
  if (error instanceof NetworkError) return true;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("load failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("econnrefused") ||
      msg.includes("offline") ||
      msg.includes("timeout") ||
      msg.includes("aborted")
    );
  }

  return false;
}

export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  initialDelayMs?: number;
  onRetry?: (attempt: number, maxRetries: number) => void;
}

/**
 * Robust fetch wrapper that:
 * 1. Pre-checks for active internet connection.
 * 2. Retries on transient network disconnects or dropped connections.
 * 3. Provides clean, human-readable error messages for offline states.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 2,
    initialDelayMs = 1000,
    onRetry,
    ...fetchOptions
  } = options;

  // 1. Initial offline check
  if (!checkIsOnline()) {
    throw new NetworkError("No internet connection, please retry", true);
  }

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (err: unknown) {
      attempt += 1;

      // Check if user is offline or connection was lost
      if (!checkIsOnline() || (typeof window !== "undefined" && !window.navigator.onLine)) {
        throw new NetworkError("No internet connection, please retry", true);
      }

      const isTransient = isNetworkFailure(err);

      if (isTransient && attempt <= maxRetries) {
        if (onRetry) {
          onRetry(attempt, maxRetries);
        }
        // Wait with exponential backoff before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }

      // If exhausted retries or network failure, throw understandable error
      if (isTransient) {
        throw new NetworkError("No internet connection, please retry", true);
      }

      throw err;
    }
  }
}
