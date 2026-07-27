/**
 * AIX-008 — Sandbox preview: shared types
 *
 * A sandbox dataset is plain data assembled by the editor and shipped inside
 * the preview export's metadata. The runtime never invents a dataset from
 * nothing: it serves this one, and falls back to name-derived synthesis only
 * for a class the editor did not predict.
 *
 * @module noodl-runtime/sandbox/types
 */

/** One synthesized record. `objectId`/`id` are both filled so Parse- and Directus-shaped readers agree. */
export interface SandboxRecord {
  objectId: string;
  id: string;
  [field: string]: unknown;
}

/** What a class looks like, as the editor read it off the graph. */
export interface SandboxClass {
  /** Field names the graph actually reads. Used to synthesize any missing records. */
  fields: string[];
  /** Records to serve. Agent-authored where available, synthesized otherwise. */
  records: SandboxRecord[];
}

export interface SandboxDataset {
  /** Keyed by collection/class name exactly as the graph names it. */
  classes: Record<string, SandboxClass>;
  /** The user the sandbox is signed in as. Never a real account. */
  user: SandboxRecord;
  /** Shown in the preview toolbar, e.g. "5 sample Books". Purely informational. */
  summary?: string;
}

export const SANDBOX_METADATA_KEY = 'sandbox';

/** Marks every record the sandbox made up, so nothing mistakes one for real data. */
export const SANDBOX_RECORD_FLAG = '__sandbox';
