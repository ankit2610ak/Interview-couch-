/**
 * Local storage utility for managing interview history and performance records.
 */

export interface InterviewHistoryItem {
  id: string;
  createdAt: string; // ISO 8601 string
  topic: string;
  difficulty: string;
  score: number;
  recommendation: string; // "Pass" | "Fail"
  verdict: string;
  strengths: string;
  weaknesses: string;
  revision_areas: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

const STORAGE_KEY = "ai_interview_coach_history_v1";
const HISTORY_UPDATE_EVENT = "interview_history_updated";

/**
 * Retrieve all stored interview history items, sorted from newest to oldest.
 */
export function getInterviewHistory(): InterviewHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: InterviewHistoryItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error("Failed to load interview history from localStorage:", err);
    return [];
  }
}

/**
 * Retrieve a specific interview by its unique id.
 */
export function getInterviewById(id: string): InterviewHistoryItem | null {
  const history = getInterviewHistory();
  return history.find((item) => item.id === id) || null;
}

/**
 * Save a new interview result to the local history.
 */
export function saveInterviewRecord(
  data: Omit<InterviewHistoryItem, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): InterviewHistoryItem {
  if (typeof window === "undefined") {
    return {
      id: data.id || `session_${Date.now()}`,
      createdAt: data.createdAt || new Date().toISOString(),
      ...data,
    };
  }

  try {
    const history = getInterviewHistory();

    // Check if an entry with this ID already exists to prevent duplicate saves on re-render
    if (data.id) {
      const existing = history.find((item) => item.id === data.id);
      if (existing) {
        return existing;
      }
    }

    const newItem: InterviewHistoryItem = {
      id: data.id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: data.createdAt || new Date().toISOString(),
      topic: data.topic,
      difficulty: data.difficulty,
      score: data.score,
      recommendation: data.recommendation,
      verdict: data.verdict,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      revision_areas: data.revision_areas,
      conversationHistory: data.conversationHistory,
    };

    const updated = [newItem, ...history];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Dispatch update event so any open drawers/listeners react immediately
    window.dispatchEvent(new CustomEvent(HISTORY_UPDATE_EVENT, { detail: newItem }));

    return newItem;
  } catch (err) {
    console.error("Failed to save interview record to localStorage:", err);
    return {
      id: data.id || `session_${Date.now()}`,
      createdAt: data.createdAt || new Date().toISOString(),
      ...data,
    };
  }
}

/**
 * Delete a specific interview record from history by ID.
 */
export function deleteInterviewRecord(id: string): void {
  if (typeof window === "undefined") return;

  try {
    const history = getInterviewHistory();
    const filtered = history.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent(HISTORY_UPDATE_EVENT));
  } catch (err) {
    console.error(`Failed to delete interview record ${id}:`, err);
  }
}

/**
 * Clear all interview history records.
 */
export function clearAllInterviewHistory(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(HISTORY_UPDATE_EVENT));
  } catch (err) {
    console.error("Failed to clear interview history:", err);
  }
}

/**
 * Subscribe to interview history changes.
 */
export function subscribeToHistoryUpdates(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback();
  window.addEventListener(HISTORY_UPDATE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(HISTORY_UPDATE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
