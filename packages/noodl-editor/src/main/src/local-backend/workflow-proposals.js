/**
 * WFA-007 — the editor's half of the workflow proposal queue.
 *
 * ## What a proposal is
 *
 * A candidate workflow definition that an agent staged instead of writing.
 * `noodl-mcp`'s `create_backend_workflow` / `update_backend_workflow` accept
 * `propose: true`, and in that mode they validate the definition against the
 * target backend and then write a file here rather than to the engine. The
 * editor lists these, renders one as a diff on the workflow canvas, and writes
 * it only if the user accepts.
 *
 * ## Why a directory rather than a channel
 *
 * The editor and `noodl-mcp` are separate processes with no link between them,
 * and they already share exactly one thing: `~/.noodl/backends/<id>/`. The
 * editor's `BackendManager` owns that layout and the MCP server's `backendsRoot()`
 * resolves the same path — that shared knowledge IS finding F24, the reason this
 * task exists. Putting the queue there costs no daemon, no port and no discovery
 * mechanism, and it works whether or not the backend is running.
 *
 * ## What this is NOT
 *
 * Backend state. The engine never reads this directory; `WorkflowRegistry` loads
 * only `<dataDir>/workflow-defs/`. A malformed proposal cannot stop a backend
 * booting, and deleting the whole directory loses nothing but unreviewed
 * suggestions. That asymmetry is deliberate: a queue of things nobody has looked
 * at must not be able to break a running service.
 *
 * The format is mirrored in `noodl-mcp/src/backend/workflowProposals.ts` and
 * pinned from both sides by specs, because these two files are the only
 * agreement the two processes have.
 *
 * @module local-backend/workflow-proposals
 */

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

/** The directory, under a backend's own dir, that holds pending proposals. */
const PROPOSALS_DIR = 'workflow-proposals';

/** Bumped only for a change a reader cannot ignore. Unknown versions are skipped. */
const PROPOSAL_VERSION = 1;

/**
 * The default backends root.
 *
 * Every function here takes an explicit `root` instead, and `BackendManager`
 * passes its OWN `backendsPath`. That is deliberate rather than fussy: if this
 * module computed the path independently, the two would silently disagree the
 * moment either learned about an override, and the symptom would be an empty
 * Proposals list with nothing wrong anywhere. One owner of the path, one answer.
 *
 * The default matches `BackendManager`'s and honours `NODEGX_BACKENDS_DIR`, so a
 * spec can point both this and the MCP writer at a temp directory — a test that
 * could not do that would prove nothing about the real pairing.
 */
function backendsRoot() {
  return process.env.NODEGX_BACKENDS_DIR || path.join(os.homedir(), '.noodl', 'backends');
}

/** The proposals directory for one backend. */
function proposalsDir(backendId, root) {
  return path.join(root || backendsRoot(), backendId, PROPOSALS_DIR);
}

/**
 * Every pending proposal for a backend, oldest first.
 *
 * A proposal that cannot be read, is not JSON, or carries a version this build
 * does not know is SKIPPED rather than thrown on — one bad file must not hide
 * the others, and an unreadable suggestion is not worth failing a panel over.
 * The `file` field is stamped on so a caller can discard exactly what it read.
 *
 * @param {string} backendId
 * @param {string} [root] - The backends root; defaults to the standard location.
 * @returns {Promise<object[]>}
 */
async function listProposals(backendId, root) {
  const dir = proposalsDir(backendId, root);
  let names;
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    return [];
  }

  const proposals = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf-8'));
      if (!parsed || parsed.version !== PROPOSAL_VERSION || !parsed.workflow) continue;
      proposals.push({ ...parsed, file });
    } catch (e) {
      // Skip — see above.
    }
  }
  proposals.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return proposals;
}

/**
 * One proposal by id, or null.
 *
 * Read from the directory rather than by composing a filename, so a proposal id
 * arriving from the renderer can never be a path — `wp_../../something` would
 * otherwise escape the directory. The ids MCP mints are base64url, but that is
 * MCP's promise, not this reader's, and a store that trusts its input is a store
 * that trusts every future writer.
 */
async function getProposal(backendId, proposalId, root) {
  const all = await listProposals(backendId, root);
  return all.find((p) => p.proposalId === proposalId) || null;
}

/**
 * Drop a proposal. Idempotent: discarding one that is already gone succeeds.
 *
 * This is how BOTH outcomes end — reject drops it, and accept drops it after the
 * definition is written. A proposal that survived its own acceptance would be
 * offered again as a diff against the state it just produced, i.e. as no change
 * at all.
 */
async function discardProposal(backendId, proposalId, root) {
  const proposal = await getProposal(backendId, proposalId, root);
  if (!proposal) return { discarded: false };
  try {
    await fs.unlink(proposal.file);
  } catch (e) {
    // Already gone; the caller's intent is satisfied either way.
  }
  return { discarded: true };
}

module.exports = {
  PROPOSALS_DIR,
  PROPOSAL_VERSION,
  backendsRoot,
  proposalsDir,
  listProposals,
  getProposal,
  discardProposal
};
