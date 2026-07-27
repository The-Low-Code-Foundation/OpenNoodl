/**
 * AIX-010 — Project review & docs retrofit: shared types.
 *
 * A retrofit reads a project that already exists and drafts the `docs/` set
 * AIX-009 defined. Everything here is plain data, for the same reason every
 * other model in this phase is: the assembler must run in the headless bundle
 * (and in `noodl-mcp`, which esbuild-bundles editor sources), so nothing on the
 * pure path may touch `ProjectModel`, the filesystem or Electron.
 *
 * The one type worth reading carefully is `ProjectReviewCoverage`. Criterion 4
 * is not "log something"; it is that a human looking at the drafts can see the
 * draft was written **without reading 40 of their 55 components**, and the model
 * writing the draft is told the same thing so it hedges instead of inventing.
 * The coverage record is the single object that carries that to both audiences.
 *
 * @module AiAssistant/review/types
 */

import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import type { StyleVocabulary } from '../../StyleTokensModel/StyleVocabulary';
import type { ContextLogEntry } from '../authoring/types';

/** The three files a retrofit drafts. Same vocabulary as `KnownDocKind`. */
export type ReviewDocKind = 'brief' | 'architecture' | 'conventions';

/** The order they are drafted in — cheapest and most grounded first. */
export const REVIEW_DOC_ORDER: readonly ReviewDocKind[] = ['brief', 'architecture', 'conventions'];

// ── Page map ──────────────────────────────────────────────────────────────────

/** A route as *declared* in `nodegx.routes.json` / `metadata.routes`. */
export interface DeclaredRoute {
  path: string;
  component: string;
  title?: string;
}

/** Where a page-map fact came from. Recorded because it changes how much to trust it. */
export type PageSource = 'routes-file' | 'router-node' | 'page-node' | 'name-convention';

export interface PageMapEntry {
  /** Component name, as the graph spells it (e.g. `/#__page__/Chat`). */
  component: string;
  title?: string;
  urlPath?: string;
  /** True when a Router names this as its start page. */
  isStart?: boolean;
  /** Name of the router that mounts it, when one does. */
  router?: string;
  sources: PageSource[];
}

export interface RouterEntry {
  /** The router's `name` parameter — how `RouterNavigate` addresses it. */
  name: string;
  /** Component the Router node lives in. */
  host: string;
  startPage?: string;
  pages: string[];
}

export interface NavigationEntry {
  /** Component containing the navigate node. */
  from: string;
  router?: string;
  target: string;
}

export interface PageMap {
  routers: RouterEntry[];
  pages: PageMapEntry[];
  navigations: NavigationEntry[];
  /** Every source that contributed. Empty = this project declares no routing at all. */
  sources: PageSource[];
}

// ── Backend ───────────────────────────────────────────────────────────────────

export interface SchemaField {
  name: string;
  type: string;
  /** Pointer/Relation target. */
  targetClass?: string;
}

export interface SchemaCollection {
  name: string;
  fields: SchemaField[];
}

export interface BackendSummary {
  /** Parse-wire cloud services: the nodegx backend, or an external Parse. */
  cloud?: { type: 'nodegx' | 'external' | 'unknown'; endpoint?: string; appId?: string };
  /** BYOB backends (Supabase / Directus / PocketBase / custom). */
  services: Array<{ id: string; name: string; type: string; url?: string }>;
  collections: SchemaCollection[];
  /**
   * False when no schema could be read at all — which is NOT the same as "the
   * project has no collections", and the prompt is told the difference so it
   * writes a `> TODO:` rather than "this app has no data model".
   */
  schemaAvailable: boolean;
  /** Why the schema is unavailable, when it is. */
  schemaNote?: string;
}

// ── Sources ───────────────────────────────────────────────────────────────────

/**
 * Everything the assembler needs that is NOT in the graph. Collected on the
 * Electron side (`collectSources.ts`) or from `ProjectStore` (MCP), and handed
 * in as plain data so the assembler stays pure and specable.
 */
export interface ProjectReviewSources {
  projectName?: string;
  /** `metadata.description`, when the project has one. */
  description?: string;
  /** Declared routes, when the project actually has any. Usually it does not. */
  declaredRoutes?: DeclaredRoute[];
  backend?: BackendSummary;
  styleVocabulary?: StyleVocabulary;
  /** Existing docs — a re-run drafts *against* them rather than over them. */
  docs?: ProjectDocsContent;
  /** Legacy name of the root component, when the editor knows it. */
  rootComponent?: string;
}

// ── Selection ─────────────────────────────────────────────────────────────────

export type ComponentKind = 'root' | 'page' | 'shared' | 'other';

export interface RankedComponent {
  name: string;
  kind: ComponentKind;
  nodeCount: number;
  /** How many nodes elsewhere in the project instantiate this component. */
  inboundRefs: number;
  /** 0-based position after ranking; 0 is read first. */
  rank: number;
  /** Human-readable justification, shown in the review UI and in the prompt. */
  reason: string;
}

// ── Coverage ──────────────────────────────────────────────────────────────────

export interface CoverageRead {
  name: string;
  reason: string;
  chars: number;
}

export interface CoverageSkipped {
  name: string;
  reason: string;
}

export interface CoverageSource {
  name: string;
  status: 'included' | 'absent' | 'inferred' | 'refused';
  detail?: string;
}

/**
 * What the review actually saw. Rendered for the model (so it hedges) and for
 * the user (so they know what the draft is worth) from the same object.
 */
export interface ProjectReviewCoverage {
  componentsTotal: number;
  nodesTotal: number;
  read: CoverageRead[];
  notRead: CoverageSkipped[];
  sources: CoverageSource[];
  charsUsed: number;
  charsBudget: number;
  /** The builder's own charge log, verbatim. */
  log: ContextLogEntry[];
}

// ── Assembled context ─────────────────────────────────────────────────────────

export interface ProjectReviewBlock {
  heading: string;
  body: string;
}

export interface ProjectReviewContext {
  /** Reference material, cheapest first. Rendered in order. */
  blocks: ProjectReviewBlock[];
  pageMap: PageMap;
  ranking: RankedComponent[];
  coverage: ProjectReviewCoverage;
}

// ── Drafts ────────────────────────────────────────────────────────────────────

export type ReviewDraftStatus = 'authored' | 'declined' | 'exhausted' | 'cancelled' | 'error' | 'pending';

export interface ProjectReviewDraft {
  kind: ReviewDocKind;
  /** Project-relative path, e.g. `docs/BRIEF.md`. */
  path: string;
  status: ReviewDraftStatus;
  /** The whole proposed file. Present only when status is 'authored'. */
  content?: string;
  /** The file as it stood when the draft was made; `null` when it does not exist. */
  baseline: string | null;
  /** One sentence for the review header. */
  summary?: string;
  /** Prose from a decline, or the error message. */
  note?: string;
  /** How many `> TODO:` lines the draft carries — criterion 3, counted. */
  todoCount: number;
  /** Advisory graph-restatement findings that survived the rewrite pass. */
  lintFindings: string[];
  costUsd: number | null;
  turns: number;
}
