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

/** The agent's complete candidate for the component. */
export interface SubmitPayload {
  nodes: SubmittedNode[];
  connections?: ConnectionV2[];
  visualRoots?: string[];
  /** Agent-authored summary stored on the component. */
  description?: string;
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

export interface AuthoringMetrics {
  /** Model round-trips. */
  turns: number;
  /** Submission attempts. */
  submits: number;
  contextLog: ContextLogEntry[];
  totalContextChars: number;
  /** Total characters across the final transcript — the real "what was sent" bound. */
  transcriptChars: number;
  promptTokens: number;
  completionTokens: number;
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
