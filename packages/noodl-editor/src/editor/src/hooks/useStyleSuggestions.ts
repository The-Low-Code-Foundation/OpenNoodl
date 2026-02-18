/**
 * STYLE-005: useStyleSuggestions
 *
 * Runs the StyleAnalyzer on mount (and on demand) and manages the
 * dismissed-suggestion state via localStorage persistence.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { StyleAnalyzer, StyleSuggestion } from '../services/StyleAnalyzer';

const DISMISSED_KEY = 'noodl:style-suggestions:dismissed';
const SESSION_DISMISSED_KEY = 'noodl:style-suggestions:session-dismissed';

function loadPersisted(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function savePersisted(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export interface UseStyleSuggestionsReturn {
  /** Next suggestion to show (filtered through dismissed state). null = nothing to show. */
  activeSuggestion: StyleSuggestion | null;
  /** Re-run the analyzer (call after project changes). */
  refresh: () => void;
  /** Dismiss for this session only (re-appears on next reload). */
  dismissSession: (id: string) => void;
  /** Persist dismiss forever. */
  dismissPermanent: (id: string) => void;
  /** Total pending count (after filtering dismissed). */
  pendingCount: number;
}

/**
 * Runs the StyleAnalyzer and exposes the highest-priority suggestion.
 *
 * @example
 * const { activeSuggestion, dismissSession, dismissPermanent, refresh } = useStyleSuggestions();
 */
export function useStyleSuggestions(): UseStyleSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<StyleSuggestion[]>([]);
  const [permanentDismissed, setPermanentDismissed] = useState<Set<string>>(() => loadPersisted(DISMISSED_KEY));
  // Session dismissed lives in a ref-backed state so it survives re-renders but not reloads
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(() => loadPersisted(SESSION_DISMISSED_KEY));

  const refresh = useCallback(() => {
    const result = StyleAnalyzer.analyzeProject();
    setSuggestions(StyleAnalyzer.toSuggestions(result));
  }, []);

  // Run once on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Filter out dismissed
  const visible = useMemo(
    () => suggestions.filter((s) => !permanentDismissed.has(s.id) && !sessionDismissed.has(s.id)),
    [suggestions, permanentDismissed, sessionDismissed]
  );

  const dismissSession = useCallback((id: string) => {
    setSessionDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      savePersisted(SESSION_DISMISSED_KEY, next);
      return next;
    });
  }, []);

  const dismissPermanent = useCallback((id: string) => {
    setPermanentDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      savePersisted(DISMISSED_KEY, next);
      return next;
    });
  }, []);

  return {
    activeSuggestion: visible[0] ?? null,
    pendingCount: visible.length,
    refresh,
    dismissSession,
    dismissPermanent
  };
}
