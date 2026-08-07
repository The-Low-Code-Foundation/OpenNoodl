/**
 * POL-010 — the walk, and what it refuses to claim, over a **real** topology.
 *
 * ⚠️ **The fixture is not hand-written, and that is the whole point of this file.**
 * `fixtures/chat-topology.json` was captured verbatim from a running viewer by
 * `scripts/pol39-live/pol010-walk.js` — the same run that verified the fix live — with the chat
 * project's Chat page mounted. A hand-authored topology has ids that match by construction,
 * which is precisely the property production does not have: two sessions in a row theorised
 * about this feature from an assumption about what a node id *looks like*, and both were wrong.
 * These ids are whatever the runtime actually emitted, including the two synthetic ones the
 * component instantiation introduces and a node whose `name` is a path.
 *
 * What the neighbouring `walkEngine.test.ts` pins is the algorithm. What this pins is that the
 * algorithm still works on the ids and shapes a real project produces, and — the actual defect —
 * that a walk which *cannot* answer says so instead of rendering one row as a result.
 */

import realTopology from './fixtures/chat-topology.json';
import {
  Topology,
  backwardWalk,
  buildIndex,
  describeFoundation,
  forEachRow,
  foundationOf,
  labelFor
} from '../../src/editor/src/utils/provenance/walkEngine';

const CHAT: Topology = realTopology as Topology;

const index = () => buildIndex(CHAT, []);

function labels(topology: Topology, target: { node: string; port: string }) {
  const walkIndex = buildIndex(topology, []);
  const walk = backwardWalk(walkIndex, target);
  const out: string[] = [];
  forEachRow(walk.root, (row) => out.push(labelFor(walkIndex, row.ref)));
  return out;
}

describe('POL-010 — a multi-hop walk over a real captured topology', () => {
  it('is built from ids the runtime emitted, not ids the test chose', () => {
    // Readable ids and guids in the same dictionary, which is the thing the diagnosis got wrong
    // twice: `filterCollection` is not a broken id, it is the id. The guids are the App
    // component's own nodes and the component instance the Router mounted.
    expect(CHAT.nodes['filterCollection']).toBeDefined();
    expect(CHAT.nodes['filterCollection'].name).toBe('Filter Messages By Conversation');
    expect(Object.keys(CHAT.nodes).some((id) => /^[0-9a-f]{8}-/.test(id))).toBe(true);
  });

  it('crosses two nodes and four rows from a real signal chain', () => {
    // Send Button → Now Timestamp → Create Message, on the runtime's own edge list. Four rows
    // from one declared edge: the root port, the output that feeds it, that node's fed input,
    // and the output feeding *that*.
    expect(labels(CHAT, { node: 'createMessage', port: 'store' })).toEqual([
      'Create Message.store',
      'Now Timestamp.done',
      'Now Timestamp.run',
      'Send Button.onClick'
    ]);
  });

  it('answers the question that was reported, once the page is mounted', () => {
    // `Filter Messages By Conversation.items` — Richard's exact question. With the Chat page in
    // the runtime the walk reaches `Query Messages`, which is the node he said was missing.
    expect(labels(CHAT, { node: 'filterCollection', port: 'items' })).toEqual([
      'Filter Messages By Conversation.items',
      'Query Messages.items'
    ]);
  });
});

describe('POL-010 — a walk that cannot answer says which of four situations it is in', () => {
  it('walkable: the node is there and something is wired to the port', () => {
    const foundation = foundationOf(index(), { node: 'filterCollection', port: 'items' });
    expect(foundation.kind).toBe('walkable');
    // ⚠️ `undefined` is load-bearing: it is what tells the panel to render its ordinary summary
    // rather than an excuse. A non-empty string here would put a "cannot walk" line above a
    // perfectly good walk.
    expect(describeFoundation(index(), foundation)).toBeUndefined();
  });

  it('port-unwired: the node is there and nothing feeds the port', () => {
    // `titleText.text` is set as a parameter on the mounted page. A real and useful answer, and
    // the only non-walkable state where showing the root row is honest.
    const foundation = foundationOf(index(), { node: 'titleText', port: 'text' });
    expect(foundation).toEqual({ kind: 'port-unwired', node: 'titleText', port: 'text' });
    expect(describeFoundation(index(), foundation)).toBe(
      'Conversation Title.text has no incoming connection — nothing feeds it.'
    );
  });

  it('node-absent: the runtime never instantiated the node, and the sentence says so', () => {
    // The defect, stated. `signupSubmit` lives on `/Pages/Signup`, which this preview did not
    // mount — so it is in the project and not in the topology, and the walk has nothing to
    // follow. Before POL-010 this rendered as one row under "1 row · declared wires".
    const foundation = foundationOf(index(), { node: 'signupSubmit', port: 'label' });
    expect(foundation).toEqual({ kind: 'node-absent', node: 'signupSubmit' });

    const sentence = describeFoundation(index(), foundation, { nodeLabel: 'Sign Up Button' }) as string;
    expect(sentence).toContain('Sign Up Button is not running in the preview');
    // ⚠️ It must report what the runtime HAS, and must not claim anything about what the
    // project contains — the engine cannot see the project, and "this node does not exist" and
    // "the runtime has not built it" are opposite claims. Only the second is known here.
    expect(sentence).toContain('The preview has instantiated App, /Pages/Chat');
    expect(sentence).not.toMatch(/does not exist|no such node|deleted/i);
  });

  it('node-absent falls back to the id when the editor supplies no label', () => {
    // The MCP path (OBS-004) has no project to ask. Naming the node by its id is worse than a
    // label and far better than the pre-POL-010 behaviour, which was to print the id twice — as
    // `Node` and as `Node id` — and explain neither.
    const sentence = describeFoundation(index(), { kind: 'node-absent', node: 'signupSubmit' }) as string;
    expect(sentence).toContain('signupSubmit is not running in the preview');
  });

  it('no-graph: nothing has reported a topology', () => {
    const empty = buildIndex({ nodes: {}, edges: [] }, []);
    const foundation = foundationOf(empty, { node: 'filterCollection', port: 'items' });
    expect(foundation).toEqual({ kind: 'no-graph', previewRunning: true });
    expect(describeFoundation(empty, foundation)).toBe(
      'The preview has not reported its graph yet — there is nothing to walk.'
    );
  });

  it('no-graph: the preview that reported this graph has gone away', () => {
    // ⚠️ The topology here is FULL, and the answer is still "no graph". A held topology outlives
    // its viewer — the panel keeps the last dictionary — so without this a walk over a preview
    // that closed ten minutes ago renders identically to a live one: same rows, same values, all
    // frozen. That is slice 2b's lie one scope smaller, and only the caller knows.
    const foundation = foundationOf(index(), { node: 'filterCollection', port: 'items' }, false);
    expect(foundation).toEqual({ kind: 'no-graph', previewRunning: false });
    expect(describeFoundation(index(), foundation)).toBe(
      'No preview is running, so there is no live graph to walk. Start the preview and ask again.'
    );
  });

  it('the four situations produce four different sentences', () => {
    // Criterion 3, as a unit test. Measured live before the fix: four states, TWO sentences,
    // and the two differed only by a row count.
    const walkIndex = index();
    const sentences = [
      describeFoundation(walkIndex, foundationOf(walkIndex, { node: 'filterCollection', port: 'items' }, false)),
      describeFoundation(walkIndex, foundationOf(walkIndex, { node: 'signupSubmit', port: 'label' })),
      describeFoundation(walkIndex, foundationOf(walkIndex, { node: 'titleText', port: 'text' })),
      describeFoundation(walkIndex, foundationOf(walkIndex, { node: 'filterCollection', port: 'items' }))
    ];
    expect(sentences[3]).toBeUndefined();
    expect(new Set(sentences).size).toBe(4);
  });

  it('carries the foundation on the walk, so a caller cannot render rows without it', () => {
    const walkIndex = index();
    expect(backwardWalk(walkIndex, { node: 'filterCollection', port: 'items' }).foundation.kind).toBe('walkable');
    expect(backwardWalk(walkIndex, { node: 'signupSubmit', port: 'label' }).foundation.kind).toBe('node-absent');
    expect(
      backwardWalk(walkIndex, { node: 'filterCollection', port: 'items' }, { previewRunning: false }).foundation.kind
    ).toBe('no-graph');
  });
});
