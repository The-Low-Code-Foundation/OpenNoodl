/**
 * WFA-007 — the workflow proposal queue.
 *
 * ## Why this exists
 *
 * `noodl-mcp` can author a workflow on a running backend today, and nothing
 * renders it anywhere (F24). That is the shape of the thing phase 27 exists to
 * prevent: logic in your product that you did not write and cannot see.
 *
 * The editor has no agent that can author a workflow — its authoring loop knows
 * about components and has never heard of a backend — so the reviewable path
 * cannot be "the editor asks an AI". It has to be "the AI writes somewhere the
 * editor looks". This is that somewhere.
 *
 * ## The location is not new
 *
 * `~/.noodl/backends/<id>/` is the layout BOTH sides already know: the editor's
 * `BackendManager` owns it, and this package's `backendsRoot()` resolves the
 * same path — that shared knowledge IS finding F24. A `workflow-proposals/`
 * directory beside `config.json` needs no new discovery mechanism, no daemon
 * and no port.
 *
 * ## What a proposal is, and is not
 *
 * It is a candidate `WorkflowInput` plus the context a reviewer needs: which
 * backend it targets, whether it creates or updates, and what the agent said it
 * was for. It is **not** backend state — the engine never reads this directory,
 * a proposal cannot stop a backend booting, and deleting the whole directory
 * loses nothing but unreviewed suggestions.
 *
 * A proposal is only written after the target backend has said it would accept
 * the definition (`POST /admin/workflow-defs/validate`). A candidate that could
 * not be saved must never become a choice the user is asked to make.
 *
 * @module noodl-mcp/backend/workflowProposals
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { backendsRoot } from './client';

/** The directory, under a backend's own dir, that holds pending proposals. */
export const PROPOSALS_DIR = 'workflow-proposals';

/**
 * The on-disk format. Bumped only for a change a reader cannot ignore; the
 * editor refuses a version it does not know rather than guessing.
 */
export const PROPOSAL_VERSION = 1;

export interface WorkflowProposalFile {
  version: number;
  /** Unique per proposal; also the file name. */
  proposalId: string;
  backendId: string;
  /** 'create' when the target backend has no workflow with this id. */
  mode: 'create' | 'update';
  /** The workflow this is a proposal FOR. Always present, even on create. */
  workflowId: string;
  /** ISO-8601, when it was staged. */
  createdAt: string;
  /** What staged it — a free-text label, shown to the reviewer as provenance. */
  origin: string;
  /** One or two sentences from the agent: what this changes and why. */
  note?: string;
  /** The candidate, in exactly the shape `PUT /admin/workflow-defs/:id` takes. */
  workflow: Record<string, unknown>;
}

/** The proposals directory for one backend. */
export function proposalsDir(backendId: string): string {
  return path.join(backendsRoot(), backendId, PROPOSALS_DIR);
}

/**
 * Stage a proposal. Returns the path it was written to.
 *
 * Written through a temp file and renamed, so a reader that lists the directory
 * mid-write never sees a half-written proposal — the same discipline
 * `WorkflowRegistry.persist` uses for the real thing.
 */
export function writeProposal(proposal: Omit<WorkflowProposalFile, 'version' | 'proposalId' | 'createdAt'>): {
  proposalId: string;
  file: string;
} {
  const proposalId = `wp_${crypto.randomBytes(9).toString('base64url')}`;
  const record: WorkflowProposalFile = {
    version: PROPOSAL_VERSION,
    proposalId,
    createdAt: new Date().toISOString(),
    ...proposal
  };

  const dir = proposalsDir(proposal.backendId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${proposalId}.json`);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return { proposalId, file };
}

/**
 * Every pending proposal for a backend, oldest first.
 *
 * Unreadable or unknown-version files are SKIPPED rather than thrown on: one
 * corrupt proposal must not hide the others, and there is nothing here worth
 * failing a listing over.
 */
export function listProposals(backendId: string): WorkflowProposalFile[] {
  const dir = proposalsDir(backendId);
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const proposals: WorkflowProposalFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as WorkflowProposalFile;
      if (parsed && parsed.version === PROPOSAL_VERSION && parsed.workflow) proposals.push(parsed);
    } catch {
      /* skip — one bad file must not hide the rest */
    }
  }
  proposals.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return proposals;
}
