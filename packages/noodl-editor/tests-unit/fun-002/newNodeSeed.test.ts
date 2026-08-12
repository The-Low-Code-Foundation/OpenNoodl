/**
 * FUN-002 — the decision to seed a brand-new node.
 *
 * The wiring (two creation call sites, one `setParameter` with undo) is graded
 * by driving the editor. What is graded here is the part whose failures are
 * **silent**: seeding a node that already has a body destroys code, and seeding
 * a type that should not be seeded is a body a beginner has to delete.
 */

import { planNewNodeSeed, seedableNodeTypes } from '@noodl-models/nodeSeed/newNodeSeed';

// Deliberately a stub, not the real body. This module is string-agnostic — it
// decides *whether* and *where*, never *what* — and copying FUN-001's seed here
// would be the second copy its acceptance forbids.
const SEED = '<the seed body>';

describe('planNewNodeSeed', () => {
  it('seeds a fresh Function node into functionScript', () => {
    expect(planNewNodeSeed('JavaScriptFunction', { parameters: {} }, SEED)).toEqual({
      parameter: 'functionScript',
      value: SEED
    });
  });

  it('seeds a node whose parameters bag is absent entirely', () => {
    expect(planNewNodeSeed('JavaScriptFunction', {}, SEED)).not.toBeNull();
  });

  it('leaves every other node type alone', () => {
    for (const type of ['Group', 'Text', 'Expression', 'Javascript2', 'net.noodl.controls.button']) {
      expect(planNewNodeSeed(type, { parameters: {} }, SEED)).toBeNull();
    }
  });

  it('never overwrites a body the node already has', () => {
    // The silent-destruction guard. A creation path that arrives with a
    // preset — a drag with options, a template — must keep it.
    const withBody = { parameters: { functionScript: 'Outputs.Mine = 1;' } };
    expect(planNewNodeSeed('JavaScriptFunction', withBody, SEED)).toBeNull();
  });

  it('treats an empty string as unset, because that is what an emptied editor writes', () => {
    expect(planNewNodeSeed('JavaScriptFunction', { parameters: { functionScript: '' } }, SEED)).not.toBeNull();
  });

  it('does nothing when there is no seed text to write', () => {
    expect(planNewNodeSeed('JavaScriptFunction', { parameters: {} }, '')).toBeNull();
  });

  it('seeds exactly one node type — the Script node is a deliberate follow-on', () => {
    expect(seedableNodeTypes()).toEqual(['JavaScriptFunction']);
  });
});
