/**
 * AIX-009 — AI-proposed doc changes, staged for review.
 *
 * An assistant that rewrites ARCHITECTURE.md after every component lands
 * produces changelog sludge nobody reads and, within a fortnight, nobody
 * trusts. So an AI doc write is never applied: it is *proposed*, held here as
 * plain data, and shown in the Docs panel as a diff the user accepts or
 * rejects — the same discipline as a component candidate.
 *
 * The two guarantees this store exists to make:
 *
 *  - **Reject leaves the file byte-identical.** That is not implemented; it is
 *    the absence of a write. Nothing in the propose path touches disk.
 *  - **Accept is one undo step.** The write and its inverse go onto the editor's
 *    undo queue as a single `UndoActionGroup`, so ⌘Z puts the previous bytes
 *    back (or deletes the file again, when the proposal created it).
 *
 * @module ProjectDocs/DocProposals
 */

import Model from '../../../../shared/model';
import { UndoActionGroup, UndoQueue } from '../undo-queue-model';
import { assertInsideDocs } from './docsText';
import { DocsConflictError, type ProjectDocsModel } from './ProjectDocsModel';

export const DOC_PROPOSALS_CHANGED = 'docProposalsChanged';

export interface DocProposal {
  id: string;
  /** Project-relative path, e.g. `docs/ARCHITECTURE.md`. */
  path: string;
  /** The file as it stood when the proposal was made; `null` for a new file. */
  baseline: string | null;
  /** The whole proposed file. Whole-file replacement, like every other candidate. */
  proposed: string;
  /** Who asked for it, for the review header ("Explain", "Build", an MCP client…). */
  source: string;
  createdAt: number;
}

let counter = 0;

/**
 * Pending doc proposals for the open project. A singleton because the panel and
 * whatever produced the proposal never share a component tree.
 */
export class DocProposalStore extends Model {
  static instance = new DocProposalStore();

  private pending: DocProposal[] = [];

  list(): readonly DocProposal[] {
    return this.pending;
  }

  get(id: string): DocProposal | undefined {
    return this.pending.find((p) => p.id === id);
  }

  /** Stage a proposal. Touches nothing on disk. */
  propose(input: { path: string; baseline: string | null; proposed: string; source: string }): DocProposal {
    const proposal: DocProposal = {
      id: `doc-${++counter}-${Date.now().toString(36)}`,
      path: assertInsideDocs(input.path),
      baseline: input.baseline,
      proposed: input.proposed,
      source: input.source,
      createdAt: Date.now()
    };
    // One pending proposal per file: a second proposal for the same doc replaces
    // the first rather than queueing a stack of diffs against stale baselines.
    this.pending = [...this.pending.filter((p) => p.path !== proposal.path), proposal];
    this.notifyListeners(DOC_PROPOSALS_CHANGED, { proposals: this.pending });
    return proposal;
  }

  /** Drop a proposal. This is the whole of "reject" — no file is touched. */
  reject(id: string): void {
    const before = this.pending.length;
    this.pending = this.pending.filter((p) => p.id !== id);
    if (this.pending.length !== before) {
      this.notifyListeners(DOC_PROPOSALS_CHANGED, { proposals: this.pending });
    }
  }

  clear(): void {
    if (this.pending.length === 0) return;
    this.pending = [];
    this.notifyListeners(DOC_PROPOSALS_CHANGED, { proposals: this.pending });
  }

  /**
   * Apply a proposal, undoably, and drop it. Refuses — leaving the proposal
   * pending and the file untouched — when the doc changed on disk since the
   * proposal was made.
   */
  async accept(id: string, docs: ProjectDocsModel): Promise<void> {
    const proposal = this.get(id);
    if (!proposal) throw new DocsConflictError('', `Proposal ${id} is no longer pending.`);

    const { path, baseline, proposed } = proposal;
    // The first write is checked against the baseline; if it throws, nothing has
    // happened and the proposal survives for the user to re-review.
    await docs.write(path, proposed, { baseline });

    // Undo/redo re-write whole files. `baseline: undefined` skips the drift
    // check on the way back — the user asked for this exact restoration, and
    // failing an undo silently is worse than overwriting a concurrent edit that
    // the undo was going to overwrite anyway.
    //
    // The action is recorded via `group.push`, NOT via the constructor's
    // do/undo pair. `UndoActionGroup`'s constructor appends straight to its
    // action array and leaves its internal pointer at 0, so a group built that
    // way and handed to `UndoQueue.push` has nothing to undo — its undo loop
    // runs from -1 and does nothing. `pushAndDo` masks that by advancing the
    // pointer through `do()`, which is why every existing caller works and this
    // one would not: the write has already happened, so there is nothing to do.
    // `group.push` advances the pointer without executing, which is exactly the
    // "already applied — just record the inverse" case. (Found by running it:
    // the first version of this compiled, ran, and silently failed to undo.)
    const group = new UndoActionGroup({ label: `AI doc change to ${path}` });
    group.push({
      do: () => {
        void docs.write(path, proposed, {});
      },
      undo: () => {
        void (baseline === null ? docs.remove(path) : docs.write(path, baseline, {}));
      }
    });
    UndoQueue.instance.push(group);

    this.reject(id);
  }
}

/**
 * Stage an AI-proposed doc change against the file as it stands right now.
 *
 * This is the entry point AIX-010 (docs retrofit) and AIX-011 (project-scope
 * authoring) call. It reads the baseline itself rather than trusting a caller's
 * copy, so a proposal is always a diff against the real current file — a
 * proposal shown against a stale baseline is a diff the user cannot trust.
 */
export async function proposeDocChange(
  docs: ProjectDocsModel,
  input: { path: string; proposed: string; source: string }
): Promise<DocProposal> {
  const baseline = (await docs.read(input.path)) ?? null;
  return DocProposalStore.instance.propose({ ...input, baseline });
}
