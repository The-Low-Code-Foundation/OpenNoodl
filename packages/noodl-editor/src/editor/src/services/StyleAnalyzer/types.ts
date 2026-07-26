/**
 * STYLE-005: StyleAnalyzer — TypeScript Interfaces
 *
 * Types for the smart style suggestion engine. Keeps the analyzer
 * decoupled from the UI so it's independently testable.
 */

// ─── Analyzable Node ─────────────────────────────────────────────────────────

/**
 * The minimal node shape the analyzer scans. The live project supplies it from
 * NodeGraphNode (`{ id, typename, parameters }`); the authoring loop supplies it
 * from a v2 candidate (`type` → `typename`). AIX-006.
 */
export interface AnalyzableNode {
  id: string;
  typename: string;
  parameters?: Record<string, unknown> | null;
}

// ─── Element Reference ───────────────────────────────────────────────────────

/** Identifies a specific property on a specific node. */
export interface ElementReference {
  /** Node ID */
  nodeId: string;
  /** Human-readable node label (typename + optional label param) */
  nodeLabel: string;
  /** The parameter / property name (e.g. 'backgroundColor') */
  property: string;
  /** The raw value currently stored on the node */
  value: string;
}

// ─── Repeated Values ─────────────────────────────────────────────────────────

/** A raw value that appears on 3+ elements — candidate for tokenisation. */
export interface RepeatedValue {
  /** The literal value (e.g. '#3b82f6', '16px') */
  value: string;
  /**
   * Number of DISTINCT elements (nodes) using this value — what the threshold
   * is measured against and what the banner reports.
   *
   * PLAT-005: this used to be `elements.length`, i.e. the number of
   * property/value *occurrences*. One node with `paddingTop/Right/Bottom/Left:
   * 16px` therefore counted as 4 and produced the message "16px is used in 4
   * elements", which was false and let a single node trip a threshold that was
   * meant to require three. Occurrences are still available as `occurrences`.
   */
  count: number;
  /**
   * Total property/value occurrences — always >= `count`.
   *
   * Optional so that the hand-built `RepeatedValue` literals in the existing
   * specs (and in the AI authoring-lint specs, which a parallel session owns)
   * keep compiling. `analyzeNodes` always populates it.
   */
  occurrences?: number;
  /** All element/property pairs that have this value */
  elements: ElementReference[];
  /**
   * If this value already matches an existing token's resolved value,
   * the CSS custom property name (e.g. '--primary').
   */
  matchingToken?: string;
  /**
   * Suggested CSS variable name for the new token (e.g. '--brand-blue').
   * Auto-generated from the value.
   */
  suggestedTokenName: string;
}

// ─── Variant Candidates ───────────────────────────────────────────────────────

/** A node with many custom (non-token) overrides — candidate for a variant. */
export interface VariantCandidate {
  nodeId: string;
  nodeLabel: string;
  /** The Noodl typename, e.g. 'net.noodl.controls.button' */
  nodeType: string;
  /** Number of non-token custom overrides */
  overrideCount: number;
  /** The actual overrides as property → value pairs */
  overrides: Record<string, string>;
  /** Suggested variant name based on override values */
  suggestedVariantName: string;
}

// ─── Analysis Result ──────────────────────────────────────────────────────────

export interface StyleAnalysisResult {
  /** Raw hex/rgb colors appearing on 3+ elements */
  repeatedColors: RepeatedValue[];
  /** Raw spacing values (px/rem) appearing on 3+ elements */
  repeatedSpacing: RepeatedValue[];
  /** Nodes with 3+ custom non-token overrides */
  variantCandidates: VariantCandidate[];
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export type SuggestionType = 'repeated-color' | 'repeated-spacing' | 'variant-candidate';

export interface StyleSuggestion {
  /** Stable ID for this suggestion (used for dismiss persistence) */
  id: string;
  type: SuggestionType;
  /** Short headline shown in the banner */
  message: string;
  /** Label for the primary action button */
  acceptLabel: string;

  // Payload — varies by type
  repeatedValue?: RepeatedValue;
  variantCandidate?: VariantCandidate;
}

// ─── Analysis Options ────────────────────────────────────────────────────────

/** Minimal token model interface — avoids a hard dep on StyleTokensModel from the editor pkg. */
export interface TokenModelLike {
  getTokens(): Array<{ name: string }>;
  resolveToken(name: string): string | undefined;
}

/** Options passed to `StyleAnalyzer.analyzeProject()`. */
export interface StyleAnalysisOptions {
  /** Optional token model for matching raw values against existing tokens. */
  tokenModel?: TokenModelLike;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const SUGGESTION_THRESHOLDS = {
  /** Minimum occurrences before suggesting a token */
  repeatedValueMinCount: 3,
  /** Minimum non-token overrides before suggesting a variant */
  variantCandidateMinOverrides: 3
} as const;
