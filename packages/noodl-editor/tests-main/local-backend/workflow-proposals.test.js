/**
 * WFA-007 — the proposal queue, from the reader's side.
 *
 * Two processes with no link between them agree on one directory and one JSON
 * shape: `noodl-mcp` writes, the editor reads. Nothing type-checks that
 * agreement — they are different packages with different builds — so the thing
 * worth asserting is that **a file written the way MCP writes it is read back
 * whole**, and that the reader survives everything a directory of files written
 * by another process can throw at it.
 *
 * The fixtures below are written by hand in exactly the shape
 * `noodl-mcp/src/backend/workflowProposals.ts#writeProposal` produces. That
 * duplication is the point: if either side changes the format unilaterally, one
 * of the two suites goes red.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../../src/main/src/local-backend/workflow-proposals');

/** A proposal exactly as `writeProposal` lays it out. */
function proposalFile(overrides = {}) {
  return {
    version: 1,
    proposalId: 'wp_aaaaaaaaaaaa',
    backendId: 'backend_test',
    mode: 'update',
    workflowId: 'wf_orders',
    createdAt: '2026-08-02T10:00:00.000Z',
    origin: 'noodl-mcp',
    note: 'Route the charge failure to a handler.',
    workflow: {
      id: 'wf_orders',
      name: 'Order pipeline',
      entry: 'receive',
      steps: [
        { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
        { id: 'charge', kind: 'retry', ref: 'chargeCard', onError: ['logfail'] },
        { id: 'logfail', kind: 'call-function', ref: 'logFailure' }
      ]
    },
    ...overrides
  };
}

describe('WFA-007 workflow proposal queue (editor side)', () => {
  let root;
  const backendId = 'backend_test';

  function write(name, contents) {
    const dir = path.join(root, backendId, store.PROPOSALS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2));
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wfa007-proposals-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('is empty, not an error, for a backend that has never been proposed to', async () => {
    // The Proposals section is drawn for every running backend, so "no
    // directory" has to be an answer rather than a throw.
    expect(await store.listProposals(backendId, root)).toEqual([]);
    expect(await store.listProposals('backend_that_does_not_exist', root)).toEqual([]);
  });

  it('reads a proposal back whole, with the candidate intact', async () => {
    write('wp_aaaaaaaaaaaa.json', proposalFile());

    const all = await store.listProposals(backendId, root);
    expect(all).toHaveLength(1);
    expect(all[0].proposalId).toBe('wp_aaaaaaaaaaaa');
    expect(all[0].mode).toBe('update');
    expect(all[0].workflowId).toBe('wf_orders');
    expect(all[0].note).toBe('Route the charge failure to a handler.');
    // The definition is what the review diffs and what accept writes — it must
    // survive verbatim, including the editor-owned `ui` the diff treats as
    // layout-only.
    expect(all[0].workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge', 'logfail']);
    expect(all[0].workflow.steps[0].ui).toEqual({ x: 80, y: 80 });
    expect(all[0].workflow.steps[1].onError).toEqual(['logfail']);
    // Stamped with where it came from, so a caller can discard exactly this one.
    expect(all[0].file).toContain('wp_aaaaaaaaaaaa.json');
  });

  it('orders oldest first, because a review queue is a queue', async () => {
    write('wp_b.json', proposalFile({ proposalId: 'wp_b', createdAt: '2026-08-02T12:00:00.000Z' }));
    write('wp_a.json', proposalFile({ proposalId: 'wp_a', createdAt: '2026-08-02T09:00:00.000Z' }));
    write('wp_c.json', proposalFile({ proposalId: 'wp_c', createdAt: '2026-08-02T15:00:00.000Z' }));

    const ids = (await store.listProposals(backendId, root)).map((p) => p.proposalId);
    expect(ids).toEqual(['wp_a', 'wp_b', 'wp_c']);
  });

  it('skips what it cannot read instead of hiding what it can', async () => {
    // Everything another process can leave in a directory: a half-written file,
    // a temp file mid-rename, a format from a future build, and something that
    // is JSON but is not a proposal.
    write('wp_good.json', proposalFile({ proposalId: 'wp_good' }));
    write('wp_broken.json', '{ "version": 1, "workflow": ');
    write('wp_future.json', proposalFile({ proposalId: 'wp_future', version: 99 }));
    write('wp_notaproposal.json', { version: 1, proposalId: 'wp_x' }); // no `workflow`
    write('wp_partial.json.tmp-1234', proposalFile({ proposalId: 'wp_partial' }));

    const ids = (await store.listProposals(backendId, root)).map((p) => p.proposalId);
    expect(ids).toEqual(['wp_good']);
  });

  it('finds one by id, and answers null rather than throwing for one that is gone', async () => {
    write('wp_aaaaaaaaaaaa.json', proposalFile());
    expect((await store.getProposal(backendId, 'wp_aaaaaaaaaaaa', root)).workflowId).toBe('wf_orders');
    expect(await store.getProposal(backendId, 'wp_nope', root)).toBeNull();
  });

  it('cannot be talked out of its own directory by a crafted id', async () => {
    // The id crosses a process boundary twice before it gets here (MCP writes
    // it, the renderer sends it back), so the reader must not compose a path
    // from it. A store that trusts its input trusts every future writer.
    const outside = path.join(root, 'not-a-proposal.json');
    fs.writeFileSync(outside, JSON.stringify(proposalFile({ proposalId: 'escaped' })));

    expect(await store.getProposal(backendId, '../../not-a-proposal', root)).toBeNull();
    expect(await store.discardProposal(backendId, '../../not-a-proposal', root)).toEqual({ discarded: false });
    expect(fs.existsSync(outside)).toBe(true);
  });

  it('discards a proposal, and discarding twice still succeeds', async () => {
    write('wp_aaaaaaaaaaaa.json', proposalFile());

    expect(await store.discardProposal(backendId, 'wp_aaaaaaaaaaaa', root)).toEqual({ discarded: true });
    expect(await store.listProposals(backendId, root)).toEqual([]);
    // Idempotent: accept discards after writing, reject discards directly, and
    // neither should care whether something else got there first.
    expect(await store.discardProposal(backendId, 'wp_aaaaaaaaaaaa', root)).toEqual({ discarded: false });
  });

  it('keeps each backend’s queue to itself', async () => {
    write('wp_mine.json', proposalFile({ proposalId: 'wp_mine' }));
    const otherDir = path.join(root, 'backend_other', store.PROPOSALS_DIR);
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(
      path.join(otherDir, 'wp_theirs.json'),
      JSON.stringify(proposalFile({ proposalId: 'wp_theirs', backendId: 'backend_other' }))
    );

    // A definition validated against one backend is not valid against another,
    // which is the whole reason the step-kind registry is served per backend.
    expect((await store.listProposals(backendId, root)).map((p) => p.proposalId)).toEqual(['wp_mine']);
    expect((await store.listProposals('backend_other', root)).map((p) => p.proposalId)).toEqual(['wp_theirs']);
  });
});
