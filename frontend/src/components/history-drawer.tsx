"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  History,
  Trash2,
  ChevronRight,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  Search,
  ArrowLeft,
  Calendar,
  Layers,
} from "lucide-react";
import {
  getInterviewHistory,
  deleteInterviewRecord,
  clearAllInterviewHistory,
  subscribeToHistoryUpdates,
  type InterviewHistoryItem,
} from "@/lib/history-storage";

export function HistoryDrawer() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All");
  const [selectedRecord, setSelectedRecord] =
    useState<InterviewHistoryItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Load history on mount and subscribe to external changes
  useEffect(() => {
    setHistory(getInterviewHistory());
    const unsubscribe = subscribeToHistoryUpdates(() => {
      setHistory(getInterviewHistory());
    });
    return () => unsubscribe();
  }, []);

  // Filtered records
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.verdict.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDifficulty =
        difficultyFilter === "All" ||
        item.difficulty.toLowerCase() === difficultyFilter.toLowerCase();
      return matchesSearch && matchesDifficulty;
    });
  }, [history, searchQuery, difficultyFilter]);

  // Performance analytics
  const analytics = useMemo(() => {
    if (history.length === 0) return null;
    const avgScore = Math.round(
      history.reduce((acc, curr) => acc + (curr.score || 0), 0) / history.length
    );
    const passCount = history.filter(
      (h) => h.recommendation?.toLowerCase() === "pass"
    ).length;
    const passRate = Math.round((passCount / history.length) * 100);

    return {
      total: history.length,
      avgScore,
      passRate,
    };
  }, [history]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteInterviewRecord(id);
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  const handleClearAll = () => {
    clearAllInterviewHistory();
    setSelectedRecord(null);
    setConfirmClear(false);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Recent";
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 border-slate-700 bg-slate-900/90 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-xs sm:text-sm font-medium shadow-sm"
        >
          <History className="h-4 w-4 text-blue-400" />
          <span>Past Interviews</span>
          {history.length > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
              {history.length}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-full sm:max-w-md bg-slate-950 border-r border-slate-800 text-slate-100 p-0 flex flex-col h-full shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-5 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <History className="h-5 w-5" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-lg font-bold text-slate-100">
                  {selectedRecord ? "Interview Details" : "Past Performance"}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  {selectedRecord
                    ? `${selectedRecord.topic} • ${selectedRecord.difficulty}`
                    : `${history.length} completed ${
                        history.length === 1 ? "session" : "sessions"
                      }`}
                </SheetDescription>
              </div>
            </div>

            {selectedRecord && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="h-8 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Content Body: Either Record Detail View OR List View */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {selectedRecord ? (
            /* ================= DETAIL VIEW ================= */
            <div className="space-y-5 animate-fade-in text-left">
              {/* Score Hero */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Final Score
                  </p>
                  <p
                    className={`text-3xl font-black ${
                      selectedRecord.score >= 70
                        ? "text-emerald-400"
                        : selectedRecord.score >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {selectedRecord.score}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      / 100
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    variant="outline"
                    className={`font-semibold px-3 py-1 text-xs border ${
                      selectedRecord.recommendation?.toLowerCase() === "pass"
                        ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-300"
                        : "border-rose-500/50 bg-rose-950/60 text-rose-300"
                    }`}
                  >
                    {selectedRecord.recommendation?.toLowerCase() === "pass" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 mr-1 inline" />
                    )}
                    {selectedRecord.recommendation}
                  </Badge>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedRecord.createdAt)}
                  </span>
                </div>
              </div>

              {/* Topics & Difficulty */}
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-800 text-slate-200 border-slate-700">
                  {selectedRecord.topic}
                </Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">
                  {selectedRecord.difficulty}
                </Badge>
              </div>

              {/* Evaluator Verdict */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Evaluator Verdict
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {selectedRecord.verdict}
                </p>
              </div>

              {/* Strengths */}
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Key Strengths
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {selectedRecord.strengths}
                </p>
              </div>

              {/* Areas for Improvement */}
              <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  Areas for Improvement
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {selectedRecord.weaknesses}
                </p>
              </div>

              {/* Suggested Topics to Revise */}
              {selectedRecord.revision_areas && (
                <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Recommended Revision Topics
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRecord.revision_areas
                      .split(",")
                      .map((area, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-blue-900/40 border border-blue-800/50 px-2 py-0.5 text-xs text-blue-200 font-medium"
                        >
                          {area.trim()}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Transcript Preview */}
              {selectedRecord.conversationHistory &&
                selectedRecord.conversationHistory.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Interview Transcript (
                      {selectedRecord.conversationHistory.length} messages)
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedRecord.conversationHistory.map((msg, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg text-xs leading-relaxed ${
                            msg.role === "assistant"
                              ? "bg-slate-900 border border-slate-800 text-slate-200"
                              : "bg-blue-950/50 border border-blue-900/40 text-blue-100 ml-3"
                          }`}
                        >
                          <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-slate-400">
                            {msg.role === "assistant" ? "Interviewer" : "Candidate"}
                          </span>
                          {msg.content}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            /* ================= LIST VIEW ================= */
            <>
              {/* Analytics Summary Card */}
              {analytics && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">
                      Sessions
                    </p>
                    <p className="text-lg font-bold text-slate-100">
                      {analytics.total}
                    </p>
                  </div>
                  <div className="space-y-0.5 border-x border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-medium flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-400" />
                      Avg Score
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        analytics.avgScore >= 70
                          ? "text-emerald-400"
                          : analytics.avgScore >= 50
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {analytics.avgScore}%
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 uppercase font-medium flex items-center justify-center gap-1">
                      <Award className="h-3 w-3 text-emerald-400" />
                      Pass Rate
                    </p>
                    <p className="text-lg font-bold text-slate-100">
                      {analytics.passRate}%
                    </p>
                  </div>
                </div>
              )}

              {/* Search & Difficulty Filter */}
              {history.length > 0 && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <Input
                      type="text"
                      placeholder="Search topic or verdict..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-9 text-xs bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-400"
                    />
                  </div>

                  {/* Difficulty Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {["All", "Easy", "Medium", "Hard"].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setDifficultyFilter(lvl)}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                          difficultyFilter.toLowerCase() === lvl.toLowerCase()
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* History List or Empty State */}
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-500">
                    <History className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-300">
                      {history.length === 0
                        ? "No Interview History Yet"
                        : "No Matching Records"}
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                      {history.length === 0
                        ? "Start and complete a practice interview to track your scores, strengths, and improvement areas here."
                        : "Try adjusting your search query or difficulty filter."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredHistory.map((record) => {
                    const isPassing =
                      record.recommendation?.toLowerCase() === "pass";
                    return (
                      <div
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className="group relative rounded-xl border border-slate-800/90 bg-slate-900/60 p-3.5 hover:bg-slate-900 hover:border-slate-700 transition-all cursor-pointer space-y-2 shadow-sm"
                      >
                        {/* Top Row: Date & Score Badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(record.createdAt)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                record.score >= 70
                                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                                  : record.score >= 50
                                  ? "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                                  : "bg-rose-950/80 text-rose-400 border border-rose-800/50"
                              }`}
                            >
                              {record.score} / 100
                            </span>

                            <button
                              onClick={(e) => handleDelete(record.id, e)}
                              title="Delete record"
                              className="text-slate-600 hover:text-rose-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle Row: Topic & Difficulty */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-slate-200">
                              {record.topic}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 border-slate-700 text-slate-400"
                            >
                              {record.difficulty}
                            </Badge>
                          </div>

                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              isPassing ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {record.recommendation}
                          </span>
                        </div>

                        {/* Bottom Row: Verdict Snippet & Arrow */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <p className="text-xs text-slate-400 line-clamp-1 italic">
                            &quot;{record.verdict}&quot;
                          </p>
                          <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer: Clear History */}
        {!selectedRecord && history.length > 0 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/80 shrink-0">
            {confirmClear ? (
              <div className="flex items-center gap-2 justify-between animate-fade-in">
                <span className="text-xs text-rose-300 font-medium">
                  Clear all {history.length} records?
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClearAll}
                    className="h-7 text-xs px-2.5 bg-rose-600 hover:bg-rose-700 font-semibold"
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmClear(false)}
                    className="h-7 text-xs px-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(true)}
                className="w-full h-8 text-xs text-slate-500 hover:text-rose-400 hover:bg-slate-900 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All History
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
