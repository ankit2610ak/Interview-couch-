"use client";

import { useEffect, useState } from "react";
import { checkIsOnline } from "@/lib/network";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    setIsOnline(checkIsOnline());

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2.5 text-xs sm:text-sm font-medium shadow-lg transition-all duration-300 ${
        !isOnline
          ? "bg-amber-500/90 text-amber-950 backdrop-blur border-b border-amber-600"
          : "bg-emerald-600/95 text-white backdrop-blur border-b border-emerald-500"
      }`}
    >
      <div className="flex items-center gap-2 max-w-xl text-center">
        {!isOnline ? (
          <>
            <svg
              className="h-4 w-4 shrink-0 animate-pulse text-amber-950"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3l18 18M10.5 10.5a5 5 0 017.07 0M7 7a10 10 0 0114.14 0M12 18h.01"
              />
            </svg>
            <span>
              <strong>No Internet Connection:</strong> You are currently offline. Actions will fail until connection is restored.
            </span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 shrink-0 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>
              <strong>Back Online!</strong> Internet connection has been restored.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
