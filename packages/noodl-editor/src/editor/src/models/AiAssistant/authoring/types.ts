/**
 * AIX-002 — The Authoring Loop: shared types
 *
 * The loop turns a natural-language request into staged v2 component files:
 * context → author → validate → repair → present. Everything here is plain
 * data. The session never touches disk and never holds an editor model — the
 * outcome carries candidate files for a *later* stage (staging / accept /
 * reject) to apply, which is what makes "reject leaves no trace" structural
 * rather than promised.
 *
 * @module AiAssistant/authoring/types
 */

import type {
  ComponentV2File,
  ConnectionsV2File,
  ConnectionV2,
  NodePort,
  NodesV2File
} from '../../../schemas';
import type { Diagnostic } from '../../../validation';
import type { AiMessage } from '../client/types';

/** The three files that are one v2 component. Same shape the MCP server stages. */
export interface ComponentFiles {
  component: ComponentV2File;
  nodes: NodesV2File;
  connections: ConnectionsV2File;
}

/**
 * Whether the session creates a new component or proposes changes to an
 * existing one. Both share the whole-candidate contract — an update is a full
 * resubmission, reviewed as a diff against the live component.
 */
export type AuthoringMode = 'create' | 'update';

/** What the user asked to be built, and where it goes. */
export interface AuthoringRequest {
  /** The user's description, verbatim. */
  description: string;
  /** New component path, e.g. "Pages/Customers". Fixed by the user, not the agent. */
  componentPath: string;
  /** Component type; inferred from the path when omitted ("Pages/…" → page). */
  componentType?: 'page' | 'visual' | 'logic';
}

/** A node as the agent submits it — a NodeV2 whose id we generate when omitted. */
export interface SubmittedNode {
  id?: string;
  type: string;
  label?: string;
  x?: number;
  y?: number;
  /** Id of the parent node in the visual tree. Children order = submission order. */
  parent?: string;
  /** Static input values, keyed by exact port name. */
  parameters?: Record<string, unknown>;
  /** Instance ports (Component Inputs/Outputs nodes and other dynamic-port nodes). */
  ports?: NodePort[];
}

/**
 * AIX-008 — records the agent expects this component to display, keyed by the
 * collection name it queries. Never written anywhere: it exists so the sandbox
 * preview shows a book list full of books instead of a book list full of
 * "Title 1", and is discarded with the preview.
 */
export type AgentSampleData = Record<string, Array<Record<string, unknown>>>;

/** The agent's complete candidate for the component. */
export interface SubmitPayload {
  nodes: SubmittedNode[];
  connections?: ConnectionV2[];
  visualRoots?: string[];
  /** Agent-authored summary stored on the component. */
  description?: string;
  /** Sample records for the preview sandbox. Optional; inference covers the gaps. */
  sampleData?: AgentSampleData;
}

// ── Validation gate ───────────────────────────────────────────────────────────

export interface StructuralFailure {
  file: 'component.json' | 'nodes.json' | 'connections.json';
  errors: Array<{ path: string; message: string }>;
}

export interface CandidateValidation {
  ok: boolean;
  /** Present when the structural (schema) check failed — semantic never ran. */
  structural?: StructuralFailure[];
  /** All diagnostics for the candidate (sorted). */
  diagnostics: Diagnostic[];
  /** The error-severity subset — what rejects a submission. */
  errors: Diagnostic[];
  /**
   * Update mode only: error-severity diagnostics the BASE component already
   * had. Reported, never charged — they are not the agent's to fix, and asking
   * it to fix them produces a "repair" of the user's own work.
   */
  preExisting?: Diagnostic[];
  summary: { errors: number; warnings: number; infos: number };
}

// ── Context accounting ────────────────────────────────────────────────────────

/**
 * The hard limits on what the agent may be shown. The whole premise of this
 * task is that decomposition lets an agent work without ingesting everything —
 * so the budget is enforced and logged, not aspirational.
 */
export interface ContextBudget {
  /** Cumulative characters of context handed to the agent, across all sources. */
  maxChars: number;
  /** How many existing components may be read in full. */
  maxComponentReads: number;
}

/**
 * ERG-002 §2: "the registered libraries are not in the context the loop
 * reads" was finding #5 of what the feature was missing. This is that
 * context, shaped for a one-line-each handout — not the on-disk manifest
 * (`RegisteredLibrary` in `shared/utils/projectmodules.ts`), which carries
 * fields (vendored, dependencies, …) the agent has no use for.
 */
export interface RegisteredLibraryInfo {
  /** Display name, e.g. "PocketBase". */
  name: string;
  /** The window-attached global this library defines, e.g. "PocketBase". */
  global: string;
}

export interface ContextLogEntry {
  /** What was handed out, e.g. "project-overview", "types:Group,Text", "component:/App". */
  source: string;
  chars: number;
  /** Set when the budget refused the request instead of serving it. */
  refused?: boolean;
}

// ── Outcome ───────────────────────────────────────────────────────────────────

/** One submission attempt and what the gate said about it. */
export interface SubmitRound {
  attempt: number;
  ok: boolean;
  /** Human/agent-readable error lines fed back for repair (empty when ok). */
  errorLines: string[];
}

/** What one model round-trip cost, for per-turn analysis of a session. */
export interface TurnUsage {
  /** 1-based, across the whole session including refinements. */
  turn: number;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AuthoringMetrics {
  /** Model round-trips. */
  turns: number;
  /**
   * Usage per round-trip. Aggregates hide the thing worth checking: whether
   * turn 2 actually read the prefix turn 1 wrote. This is what makes that
   * assertable rather than inferred from a cost drop.
   */
  usageByTurn: TurnUsage[];
  /** Submission attempts. */
  submits: number;
  contextLog: ContextLogEntry[];
  totalContextChars: number;
  /** Total characters across the final transcript — the real "what was sent" bound. */
  transcriptChars: number;
  /**
   * Uncached input tokens. AIX-007: once prompt caching is on, this is the
   * remainder that was NOT served from cache — add the two cache fields for
   * what the requests actually carried.
   */
  promptTokens: number;
  completionTokens: number;
  /** Input tokens served from the provider's prompt cache, at ~0.1x input. */
  cacheReadTokens: number;
  /** Input tokens written to the prompt cache, at ~1.25x input. */
  cacheWriteTokens: number;
  /** Null when any request had unknown pricing — never silently zero. */
  costUsd: number | null;
}

export type AuthoringStatus =
  /** A candidate passed validation and is staged in `files`. */
  | 'authored'
  /** Turn/submission budget ran out before a valid candidate. */
  | 'exhausted'
  /** The user cancelled the round; a candidate staged earlier survives. */
  | 'cancelled'
  /** The provider or loop failed; see `error`. */
  | 'error';

export interface AuthoringOutcome {
  status: AuthoringStatus;
  /** Present when status is 'authored'. Staged in memory — nothing is written. */
  files?: ComponentFiles;
  /** The legacy name the component would have, e.g. "/Pages/Customers". */
  legacyName: string;
  rounds: SubmitRound[];
  metrics: AuthoringMetrics;
  /** The full conversation, for the harness to measure and humans to audit. */
  transcript: AiMessage[];
  error?: string;
}
