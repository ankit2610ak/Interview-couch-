"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  BookOpen,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { fetchWithRetry, checkIsOnline, isNetworkFailure } from "@/lib/network";
import { saveInterviewRecord } from "@/lib/history-storage";
import { HistoryDrawer } from "@/components/history-drawer";

interface ReportData {
  score: number;
  strengths: string;
  weaknesses: string;
  revision_areas: string;
  verdict: string;
  recommendation: string;
}

function ReportLoadingSkeleton({ retryStatus }: { retryStatus?: string | null }) {
  return (
    <div className="min-h-screen w-full bg-slate-950 py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center justify-center animate-fade-in">
      <div className="w-full max-w-[800px] rounded-2xl bg-white p-6 sm:p-10 shadow-2xl border border-slate-200 space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col items-center space-y-3">
          <Skeleton className="h-14 w-14 rounded-full bg-slate-200" />
          <Skeleton className="h-8 w-64 bg-slate-200" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28 rounded-full bg-slate-200" />
            <Skeleton className="h-6 w-20 rounded-full bg-slate-200" />
          </div>
          <p className="text-xs text-slate-500 font-medium pt-1">
            {retryStatus ? (
              <span className="text-amber-600 font-semibold animate-pulse">{retryStatus}</span>
            ) : (
              "Generating your report... AI is evaluating your responses"
            )}
          </p>
        </div>

        {/* Score Banner Skeleton */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col sm:flex-row items-center justify-around gap-6">
          <div className="flex flex-col items-center space-y-2">
            <Skeleton className="h-4 w-24 bg-slate-200" />
            <Skeleton className="h-10 w-32 bg-slate-200" />
          </div>
          <div className="hidden sm:block h-14 w-px bg-slate-200" />
          <div className="flex flex-col items-center space-y-2">
            <Skeleton className="h-4 w-28 bg-slate-200" />
            <Skeleton className="h-9 w-24 rounded-full bg-slate-200" />
          </div>
        </div>

        {/* 4 Cards Skeleton Grid (2 cols desktop, 1 col mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <Skeleton className="h-5 w-36 bg-slate-200" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-slate-100" />
                <Skeleton className="h-4 w-[90%] bg-slate-100" />
                <Skeleton className="h-4 w-[75%] bg-slate-100" />
              </div>
            </Card>
          ))}
        </div>

        {/* Action Button Skeleton */}
        <div className="flex justify-center pt-2">
          <Skeleton className="h-10 w-44 rounded-md bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const topic = searchParams.get("topic") || "Technical Interview";
  const difficulty = searchParams.get("difficulty") || "Medium";
  const rawConversationHistory = searchParams.get("conversationHistory");

  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRetryStatus(null);

    if (!checkIsOnline() || (typeof window !== "undefined" && !window.navigator.onLine)) {
      setError("No internet connection, please retry");
      setIsLoading(false);
      return;
    }

    try {
      let parsedHistory = [];
      if (rawConversationHistory) {
        try {
          parsedHistory = JSON.parse(decodeURIComponent(rawConversationHistory));
        } catch {
          try {
            parsedHistory = JSON.parse(rawConversationHistory);
          } catch {
            parsedHistory = [];
          }
        }
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetchWithRetry(`${apiUrl}/api/report/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          difficulty,
          conversation_history: parsedHistory,
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
          `Report generation failed with status ${response.status}`;
        throw new Error(detailMsg);
      }

      const data: ReportData = await response.json();
      setReport(data);

      // Automatically store in history for performance tracking
      try {
        const stableSessionId = `session_${encodeURIComponent(topic)}_${encodeURIComponent(
          difficulty
        )}_${parsedHistory.length}`;
        saveInterviewRecord({
          id: stableSessionId,
          topic,
          difficulty,
          score: data.score,
          recommendation: data.recommendation,
          verdict: data.verdict,
          strengths: data.strengths,
          weaknesses: data.weaknesses,
          revision_areas: data.revision_areas,
          conversationHistory: parsedHistory,
        });
      } catch (saveErr) {
        console.warn("Could not auto-save to history storage:", saveErr);
      }
    } catch (err: unknown) {
      console.error("Error generating report:", err);
      setIsLoading(false);
      setRetryStatus(null);

      const isNetErr =
        isNetworkFailure(err) ||
        (typeof window !== "undefined" && !window.navigator.onLine);

      setError(
        isNetErr
          ? "No internet connection, please retry"
          : getFriendlyErrorMessage(err, "No internet connection, please retry")
      );
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  }, [rawConversationHistory, topic, difficulty]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Loading State with Skeleton Component
  if (isLoading) {
    return <ReportLoadingSkeleton retryStatus={retryStatus} />;
  }

  // Error State with Retry Button
  if (error || !report) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 px-4 py-8 sm:py-12 text-slate-100 animate-fade-in">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-900/50 bg-slate-900/90 p-8 shadow-2xl text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-rose-500" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100">
              Report Generation Error
            </h2>
            <p className="text-sm text-slate-400">
              {error || "An unexpected error occurred while generating your report."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
            <Button
              onClick={fetchReport}
              className="h-10 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="h-10 w-full sm:w-auto border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
            >
              Start New Interview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Computed visual properties
  const isPass = report.recommendation.trim().toLowerCase() === "pass";
  const scoreNum = Number(report.score) || 0;

  // Score color: green >= 70, yellow 50..69, red < 50
  const scoreColor =
    scoreNum >= 70
      ? "text-emerald-600"
      : scoreNum >= 50
      ? "text-amber-500"
      : "text-rose-600";

  return (
    <div className="min-h-screen w-full bg-slate-950 py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center justify-center animate-fade-in relative">
      {/* Top Left History Drawer Trigger */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <HistoryDrawer />
      </div>

      {/* Centered light container (max-w-[800px]) against dark page */}
      <div className="w-full max-w-[800px] rounded-2xl bg-white p-6 sm:p-10 shadow-2xl text-slate-900 border border-slate-200 mt-12 sm:mt-0">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-14 w-14 sm:h-16 sm:w-16 text-emerald-500 mb-3" />
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Interview Complete
          </h1>

          {/* Topic and Difficulty Badges */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <Badge
              variant="secondary"
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-3 py-1 text-xs sm:text-sm"
            >
              {topic}
            </Badge>
            <Badge
              variant="outline"
              className="border-slate-300 text-slate-700 font-medium px-3 py-1 text-xs sm:text-sm"
            >
              {difficulty}
            </Badge>
          </div>
        </div>

        {/* Score & Recommendation Banner */}
        <div className="my-8 flex flex-col sm:flex-row items-center justify-around gap-6 rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          {/* Prominent Score Display */}
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Overall Score
            </span>
            <div className={`text-4xl sm:text-5xl font-black ${scoreColor}`}>
              {scoreNum}{" "}
              <span className="text-xl sm:text-2xl font-medium text-slate-400">
                / 100
              </span>
            </div>
          </div>

          {/* Vertical Divider for desktop */}
          <div className="hidden sm:block h-14 w-px bg-slate-200" />

          {/* Prominent Recommendation Badge */}
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Recommendation
            </span>
            <Badge
              className={`text-base sm:text-lg font-bold px-6 py-1.5 shadow-sm uppercase tracking-wide ${
                isPass
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {isPass ? "PASS" : "FAIL"}
            </Badge>
          </div>
        </div>

        {/* 4 Cards in Responsive 2-Column Grid (stacks on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
          {/* Card 1: Strengths (Green left border) */}
          <Card className="border border-slate-200 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {report.strengths}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Areas for Improvement (Yellow left border) */}
          <Card className="border border-slate-200 bg-white shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {report.weaknesses}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Topics to Revise (Blue left border) */}
          <Card className="border border-slate-200 bg-white shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                Topics to Revise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {report.revision_areas}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Interviewer's Verdict (Gray left border) */}
          <Card className="border border-slate-200 bg-white shadow-sm border-l-4 border-l-slate-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                Interviewer&apos;s Verdict
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {report.verdict}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <HistoryDrawer />
          <Button
            onClick={() => router.push("/")}
            className="w-full sm:w-auto px-8 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-md transition-colors"
          >
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportLoadingSkeleton />}>
      <ReportContent />
    </Suspense>
  );
}
