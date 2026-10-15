import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFriendlyErrorMessage(
  err: unknown,
  defaultMsg: string = "Something went wrong. Please try again."
): string {
  if (typeof window !== "undefined" && navigator.onLine === false) {
    return "No internet connection, please retry";
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("no internet connection") ||
      msg.includes("load failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("econnrefused") ||
      msg.includes("offline") ||
      msg.includes("abort") ||
      msg.includes("connection refused")
    ) {
      return "No internet connection, please retry";
    }
    return err.message;
  }

  if (typeof err === "string" && err.trim().length > 0) {
    const msg = err.toLowerCase();
    if (
      msg.includes("no internet connection") ||
      msg.includes("load failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror")
    ) {
      return "No internet connection, please retry";
    }
    return err;
  }

  return defaultMsg;
}

