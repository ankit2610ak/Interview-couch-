"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { fetchWithRetry, checkIsOnline, isNetworkFailure } from "@/lib/network";
import { HistoryDrawer } from "@/components/history-drawer";

interface Message {
  role: string;
  content: string;
}

function InterviewChat() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL search parameters
  const topic = searchParams.get("topic") || "General Technical";
  const difficulty = searchParams.get("difficulty") || "Medium";
  const rawFirstMessage = searchParams.get("firstMessage");
  const rawConversationHistory = searchParams.get("conversationHistory");

  // Safely decode firstMessage and parse conversationHistory
  const decodedFirstMessage = rawFirstMessage
    ? (() => {
        try {
          return decodeURIComponent(rawFirstMessage);
        } catch {
          return rawFirstMessage;
        }
      })()
    : "Welcome to your interview. Let's get started!";

  const initialHistory: Message[] = rawConversationHistory
    ? (() => {
        try {
          return JSON.parse(decodeURIComponent(rawConversationHistory));
        } catch {
          try {
            return JSON.parse(rawConversationHistory);
          } catch {
            return [{ role: "assistant", content: decodedFirstMessage }];
          }
        }
      })()
    : [{ role: "assistant", content: decodedFirstMessage }];

  // Component states
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: decodedFirstMessage },
  ]);
  const [conversationHistory, setConversationHistory] =
    useState<Message[]>(initialHistory);
  const [currentInput, setCurrentInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [lastFailedAnswer, setLastFailedAnswer] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever new messages arrive or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = useCallback(
    async (textOverride?: string, e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const answerText = (textOverride ?? currentInput).trim();
      if (!answerText || isLoading) return;

      setErrorMessage(null);
      setRetryStatus(null);
      setLastFailedAnswer(null);

      if (!checkIsOnline() || (typeof window !== "undefined" && !window.navigator.onLine)) {
        setIsLoading(false);
        setRetryStatus(null);
        setErrorMessage("No internet connection, please retry");
        return;
      }

      // 1. Add user message to UI messages list if not retrying an already displayed message
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "user" && lastMsg.content === answerText) {
          return prev;
        }
        return [...prev, { role: "user", content: answerText }];
      });

      // 2. Set loading and clear input
      setIsLoading(true);
      setCurrentInput("");

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetchWithRetry(`${apiUrl}/api/interview/answer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic,
            difficulty,
            user_answer: answerText,
            conversation_history: conversationHistory,
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
            `Failed to send answer (status ${response.status})`;
          throw new Error(detailMsg);
        }

        const data = await response.json();

        // 3. Add AI message to UI
        const updatedAiMsg: Message = {
          role: "assistant",
          content: data.ai_message,
        };
        setMessages((prev) => [...prev, updatedAiMsg]);

        // 4. Update conversation history
        const newHistory: Message[] = data.conversation_history || [];
        setConversationHistory(newHistory);

        // 5. If interview is complete, navigate to /report
        if (data.is_complete) {
          const encodedTopic = encodeURIComponent(topic);
          const encodedDifficulty = encodeURIComponent(difficulty);
          const encodedHistory = encodeURIComponent(JSON.stringify(newHistory));

          router.push(
            `/report?topic=${encodedTopic}&difficulty=${encodedDifficulty}&conversationHistory=${encodedHistory}`
          );
          return;
        }
      } catch (err: unknown) {
        console.error("Error answering interview question:", err);
        // Preserve answer so user can retry or edit
        setLastFailedAnswer(answerText);
        setCurrentInput(answerText);
        setIsLoading(false);
        setRetryStatus(null);

        const isNetErr =
          isNetworkFailure(err) ||
          (typeof window !== "undefined" && !window.navigator.onLine);

        setErrorMessage(
          isNetErr
            ? "No internet connection, please retry"
            : getFriendlyErrorMessage(err, "No internet connection, please retry")
        );
      } finally {
        setIsLoading(false);
        setRetryStatus(null);
      }
    },
    [currentInput, isLoading, topic, difficulty, conversationHistory, router]
  );

  // Handle Enter to submit and Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Part 1: Top Header Bar */}
      <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 sm:px-8 backdrop-blur">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium py-1 px-3 shadow-sm max-w-[200px] truncate"
          >
            {topic}
          </Badge>
          <Badge
            className={`text-xs sm:text-sm font-semibold py-1 px-3 shadow-sm ${
              difficulty === "Easy"
                ? "border-emerald-800 bg-emerald-950/80 text-emerald-300"
                : difficulty === "Hard"
                ? "border-rose-800 bg-rose-950/80 text-rose-300"
                : "border-amber-800 bg-amber-950/80 text-amber-300"
            }`}
          >
            {difficulty}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-medium tracking-wide hidden xs:inline">
              Interview in progress
            </span>
          </div>
          <HistoryDrawer />
        </div>
      </header>

      {/* Part 2: Scrollable Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 animate-fade-in">
        <div className="mx-auto flex w-full max-w-4xl flex-col space-y-6">
          {messages.map((msg, index) => {
            const isAi = msg.role === "assistant";
            return (
              <div
                key={index}
                className={`flex flex-col ${
                  isAi ? "items-start" : "items-end"
                }`}
              >
                {/* Speaker Label */}
                <span
                  className={`mb-1.5 text-xs font-semibold tracking-wider ${
                    isAi
                      ? "ml-1 text-slate-400"
                      : "mr-1 text-blue-400"
                  }`}
                >
                  {isAi ? "Interviewer" : "You"}
                </span>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-4 text-sm sm:text-base leading-relaxed shadow-lg whitespace-pre-wrap ${
                    isAi
                      ? "max-w-[90%] sm:max-w-[80%] rounded-tl-sm border border-slate-800 bg-slate-900 text-slate-100"
                      : "max-w-[90%] sm:max-w-[80%] rounded-tr-sm bg-blue-600 text-white"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* AI Thinking Animation */}
          {isLoading && (
            <div className="flex flex-col items-start animate-fade-in">
              <span className="mb-1.5 ml-1 text-xs font-semibold tracking-wider text-slate-400">
                Interviewer
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900 px-4 py-3 shadow-md">
                <span className="text-xs text-slate-400">Thinking</span>
                <div className="flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></span>
                </div>
              </div>
            </div>
          )}

          {/* Inline Error Notice */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-900/60 bg-red-950/60 p-3.5 text-xs sm:text-sm text-red-300 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 shrink-0 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <span>{errorMessage}</span>
              </div>
              {lastFailedAnswer && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubmit(lastFailedAnswer)}
                  disabled={isLoading}
                  className="shrink-0 border-red-800 bg-red-900/40 text-red-200 hover:bg-red-900/70 hover:text-white text-xs h-7 px-2.5"
                >
                  Retry Sending
                </Button>
              )}
            </div>
          )}

          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Part 3: Bottom Input Area */}
      <footer className="shrink-0 border-t border-slate-800 bg-slate-900/95 px-4 py-3 sm:py-4 sm:px-8 backdrop-blur">
        <form
          onSubmit={(e) => handleSubmit(undefined, e)}
          className="mx-auto flex w-full max-w-4xl flex-col sm:flex-row items-stretch sm:items-end gap-2.5 sm:gap-3"
        >
          <div className="flex-1 flex flex-col gap-1">
            <Textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Type your answer here..."
              className="min-h-[72px] sm:min-h-[80px] max-h-[180px] resize-y border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-400 text-sm sm:text-base leading-normal"
            />
            <span className="text-[11px] text-slate-500 hidden sm:inline px-1">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Enter</kbd> to submit, <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Shift+Enter</kbd> for new line
            </span>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !currentInput.trim()}
            className="h-11 sm:h-[80px] px-6 bg-blue-600 text-white hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center gap-2"
          >
            {retryStatus ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                <span className="text-xs sm:text-sm">{retryStatus}</span>
              </>
            ) : isLoading ? (
              "AI is thinking..."
            ) : (
              "Submit Answer"
            )}
          </Button>
        </form>
      </footer>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            <span>Loading interview session...</span>
          </div>
        </div>
      }
    >
      <InterviewChat />
    </Suspense>
  );
}
