"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { fetchWithRetry, checkIsOnline, isNetworkFailure } from "@/lib/network";
import { HistoryDrawer } from "@/components/history-drawer";

export default function Home() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setRetryStatus(null);

    const trimmedTopic = topic.trim();
    if (!trimmedTopic || !difficulty) {
      setError("Please provide an interview topic and select a difficulty level.");
      return;
    }

    // Instant offline validation check - do NOT enter loading state if internet is not available
    if (!checkIsOnline() || (typeof window !== "undefined" && !window.navigator.onLine)) {
      setIsLoading(false);
      setRetryStatus(null);
      setError("No internet connection, please retry");
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetchWithRetry(`${apiUrl}/api/interview/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: trimmedTopic,
          difficulty,
        }),
        maxRetries: 1,
        initialDelayMs: 1000,
        onRetry: (attempt, total) => {
          setRetryStatus(`Connecting (${attempt}/${total})...`);
        },
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const detailMsg =
          errorJson?.message ||
          errorJson?.detail ||
          `API responded with status ${response.status}`;
        throw new Error(detailMsg);
      }

      const data = await response.json();

      const encodedTopic = encodeURIComponent(trimmedTopic);
      const encodedDifficulty = encodeURIComponent(difficulty);
      const encodedFirstMessage = encodeURIComponent(data.first_message || "");
      const encodedConversationHistory = encodeURIComponent(
        JSON.stringify(data.conversation_history || [])
      );

      router.push(
        `/interview?topic=${encodedTopic}&difficulty=${encodedDifficulty}&firstMessage=${encodedFirstMessage}&conversationHistory=${encodedConversationHistory}`
      );
    } catch (err: unknown) {
      console.error("Error starting interview session:", err);
      setIsLoading(false);
      setRetryStatus(null);

      const isNetErr =
        isNetworkFailure(err) ||
        (typeof window !== "undefined" && !window.navigator.onLine);

      const message = isNetErr
        ? "No internet connection, please retry"
        : getFriendlyErrorMessage(err, "No internet connection, please retry");

      setError(message);
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 px-4 py-8 sm:py-12 text-slate-100 relative">
      {/* Top Left Past Interviews Drawer Trigger */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <HistoryDrawer />
      </div>

      <div className="w-full max-w-lg flex flex-col items-center animate-fade-in pt-12 sm:pt-0">
        {/* Header Section */}
        <div className="text-center mb-8 space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            AI Interview Coach
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-md mx-auto leading-relaxed">
            Practice technical interviews with an AI-powered interviewer.
            Get real feedback. Improve fast.
          </p>
        </div>

        {/* Main Form Card */}
        <Card className="w-full border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl text-slate-100">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-slate-100">
              Start Your Interview
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Customize your session topic and target difficulty level.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Inline Error Message */}
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-red-900/60 bg-red-950/50 p-3.5 text-sm text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <svg
                      className="h-5 w-5 shrink-0 text-red-400 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    <span className="leading-snug">{error}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmit()}
                    disabled={isLoading}
                    className="self-end sm:self-center shrink-0 border-red-800 bg-red-900/40 text-red-200 hover:bg-red-900/70 hover:text-white text-xs h-8 px-3"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Topic Input Field */}
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-slate-200 font-medium">
                  Interview Topic
                </Label>
                <Input
                  id="topic"
                  type="text"
                  placeholder="e.g. Binary Trees, Sorting Algorithms, Dynamic Programming"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isLoading}
                  className="h-11 border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-400"
                />
              </div>

              {/* Difficulty Level Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="difficulty" className="text-slate-200 font-medium">
                  Difficulty Level
                </Label>
                <Select
                  value={difficulty}
                  onValueChange={setDifficulty}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    id="difficulty"
                    className="h-11 w-full border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-400"
                  >
                    <SelectValue placeholder="Select difficulty level" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                    <SelectItem
                      value="Easy"
                      className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                    >
                      Easy
                    </SelectItem>
                    <SelectItem
                      value="Medium"
                      className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                    >
                      Medium
                    </SelectItem>
                    <SelectItem
                      value="Hard"
                      className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                    >
                      Hard
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full bg-slate-100 text-slate-900 hover:bg-slate-200 font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center gap-2"
              >
                {retryStatus ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-slate-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      ></path>
                    </svg>
                    <span>{retryStatus}</span>
                  </>
                ) : isLoading ? (
                  "Starting Interview..."
                ) : (
                  "Start Interview"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Subtext */}
        <p className="mt-6 text-xs text-slate-500 text-center tracking-wide">
          Powered by AI. Built for learners.
        </p>
      </div>
    </main>
  );
}
