/**
 * UNI-011 AC2 — the graph excerpt's disclosure boundary.
 *
 * > an optional **redacted graph excerpt** (types and wiring; every string, parameter and record
 * > replaced)
 *
 * ## The instrument, and why it is not a search for secrets
 *
 * ALPHA-007's hostile fixture searches its output for a list of known secrets, and that is the
 * right instrument *there*: it grades a regex redactor, whose job is precisely to remove
 * credential shapes from free text, so the list of shapes is the specification.
 *
 * It is the wrong instrument here. This module publishes **structure**, and the thing that leaks
 * out of structure is not a secret shape — it is an ordinary string in an ordinary place, like a
 * component named after a client. A search for known secrets can only ever catch the ones on the
 * list, and the list is written by the same person who wrote the code.
 *
 * So the primary instrument is a **closed-vocabulary sweep**: collect every string the excerpt
 * publishes and assert each one came from a set the editor owns — the library's own type names,
 * the library's own port names, the three sentinels, and the generated refs. Anything that
 * reached the output from the project fails, *including a leak nobody wrote a fixture for*.
 *
 * 🔴 **Both halves are here, and they are different claims.** The sweep is checked against a
 * known-broken probe (an excerpt hand-built with a client's name in it, which it must reject) so
 * that a passing sweep means something; and the same fixture is used to assert what **survived**,
 * because an excerpt with no nodes in it passes every absence test ever written.
 */

import {
  EXCERPT_SCHEMA,
  GraphExcerpt,
  LibraryPorts,
  PORT_HIDDEN,
  TYPE_COMPONENT,
  TYPE_UNKNOWN,
  buildGraphExcerpt,
  excerptStrings,
  formatGraphExcerpt
} from '../../src/editor/src/models/community/nodeexcerpt';
import { bucketTypeName } from '../../src/editor/src/utils/report/diagnostics';

// ───────────────────────────────────────────────────────────────────────────────
// The fixture: a neighbourhood in which every place a user's words can hide, does
// ───────────────────────────────────────────────────────────────────────────────

/** Strings that came from the project. Not one of them may appear in the output. */
const PROJECT_STRINGS = {
  componentType: '/Acme Legal Client Portal/Invoice Row',
  privateModule: 'com.acmelegal.internal.BillingWidget',
  /** A `Component Inputs` port — user-authored, and reachable only through wiring. */
  componentPort: 'clientMatterRef',
  /** A dynamic port on an Object node — user-authored, on a type the library *does* know. */
  dynamicPort: 'acmeRetainerBalance',
  focusNodeId: 'node-8f21-acme-legal',
  neighbourNodeId: 'node-33c0-billing'
};

/**
 * The library, as the editor would supply it: type name → the ports **the library** declares.
 *
 * 🔴 Note what is *not* in here: `clientMatterRef` and `acmeRetainerBalance`. A dynamic port and
 * a component input are per-instance and user-authored; they never reach this table, which is
 * the whole reason the table can be an allow-list.
 */
const LIBRARY: LibraryPorts = new Map<string, ReadonlySet<string>>([
  ['REST', new Set(['fetch', 'success', 'failure', 'resource'])],
  ['Object', new Set(['store', 'stored', 'id'])],
  ['Text', new Set(['text', 'visible'])]
]);

const FOCUS = PROJECT_STRINGS.focusNodeId;

function fixtureNodes() {
  return [
    { id: FOCUS, typename: 'REST' },
    { id: 'obj-1', typename: 'Object' },
    { id: 'cmp-1', typename: PROJECT_STRINGS.componentType },
    { id: PROJECT_STRINGS.neighbourNodeId, typename: PROJECT_STRINGS.privateModule },
    { id: 'far-1', typename: 'Text' }
  ];
}

function fixtureConnections() {
  return [
    // A library port on both ends — the case that must survive, or the excerpt says nothing.
    { fromId: 'obj-1', fromProperty: 'stored', toId: FOCUS, toProperty: 'fetch' },
    // A dynamic port on a type the library knows. The TYPE survives; the PORT must not.
    { fromId: 'obj-1', fromProperty: PROJECT_STRINGS.dynamicPort, toId: FOCUS, toProperty: 'resource' },
    // A component instance's own input, which is whatever its Component Inputs node declares.
    { fromId: FOCUS, fromProperty: 'success', toId: 'cmp-1', toProperty: PROJECT_STRINGS.componentPort },
    // A node from the user's private module: unresolved type, so nothing about it is publishable.
    { fromId: FOCUS, fromProperty: 'failure', toId: PROJECT_STRINGS.neighbourNodeId, toProperty: 'trigger' },
    // Two nodes away from the focus. Out of the neighbourhood entirely.
    { fromId: 'cmp-1', fromProperty: 'out', toId: 'far-1', toProperty: 'text' }
  ];
}

function build(options = {}) {
  return buildGraphExcerpt(FOCUS, fixtureNodes(), fixtureConnections(), { library: LIBRARY, ...options });
}

// ───────────────────────────────────────────────────────────────────────────────
// The sweep
// ───────────────────────────────────────────────────────────────────────────────

/** Every string the editor is entitled to publish, given this library. */
function allowedVocabulary(excerpt: GraphExcerpt): Set<string> {
  const allowed = new Set<string>([PORT_HIDDEN, TYPE_COMPONENT, TYPE_UNKNOWN]);
  for (const [typeName, ports] of LIBRARY) {
    allowed.add(typeName);
    for (const port of ports) allowed.add(port);
  }
  // The generated refs. Derived from the output's own length rather than hardcoded, so growing
  // the fixture cannot quietly widen the vocabulary.
  for (let index = 1; index <= excerpt.nodes.length; index++) allowed.add(`n${index}`);
  return allowed;
}

/** Strings in the excerpt that the editor does not own. Empty is the passing answer. */
function foreignStrings(excerpt: GraphExcerpt): string[] {
  const allowed = allowedVocabulary(excerpt);
  return excerptStrings(excerpt).filter((value) => !allowed.has(value));
}

describe('UNI-011 AC2 — the graph excerpt publishes only what the editor owns', () => {
  it('emits no string that came from the project', () => {
    const excerpt = build();
    expect(excerpt).not.toBeNull();
    expect(foreignStrings(excerpt as GraphExcerpt)).toEqual([]);
  });

  /**
   * 🔴 The known-broken probe. Without this, `foreignStrings` returning `[]` is equally consistent
   * with a sweep that cannot see anything — and a gate that never fires is indistinguishable from
   * a gate that always passes. This is the same excerpt shape with one client's name in it.
   */
  it('the sweep FIRES on an excerpt that leaked a name', () => {
    const leaked: GraphExcerpt = {
      schema: EXCERPT_SCHEMA,
      nodes: [
        { ref: 'n1', type: 'REST', focus: true },
        { ref: 'n2', type: PROJECT_STRINGS.componentType }
      ],
      connections: [{ from: 'n1', fromPort: 'success', to: 'n2', toPort: PROJECT_STRINGS.componentPort }],
      omitted: { nodes: 0, connections: 0 }
    };

    expect(foreignStrings(leaked).sort()).toEqual([PROJECT_STRINGS.componentPort, PROJECT_STRINGS.componentType].sort());
  });

  /**
   * The other half of the pair. An excerpt of nothing satisfies every assertion above, so the
   * fixture has to be shown to have produced a real answer.
   */
  it('and still says something: the resolved types and their real ports survive', () => {
    const excerpt = build() as GraphExcerpt;

    expect(excerpt.nodes.map((node) => node.type)).toEqual(['REST', 'Object', TYPE_COMPONENT, TYPE_UNKNOWN]);
    expect(excerpt.nodes.filter((node) => node.focus)).toHaveLength(1);
    expect(excerpt.nodes[0].focus).toBe(true);

    const ports = excerpt.connections.flatMap((connection) => [connection.fromPort, connection.toPort]);
    expect(ports).toContain('stored');
    expect(ports).toContain('fetch');
    expect(ports).toContain('success');
    expect(ports).toContain('failure');
  });

  it('hides a dynamic port on a type it does publish — the type survives, the port does not', () => {
    const excerpt = build() as GraphExcerpt;
    const wire = excerpt.connections.find((connection) => connection.toPort === 'resource');

    expect(wire).toBeDefined();
    // The node is `Object`, which is in the library and named as such…
    expect(excerpt.nodes.find((node) => node.ref === wire?.from)?.type).toBe('Object');
    // …and the port it was wired from is the user's, so it is not.
    expect(wire?.fromPort).toBe(PORT_HIDDEN);
  });

  it('publishes no port at all for a node whose type did not survive', () => {
    const excerpt = build() as GraphExcerpt;
    const hiddenRefs = excerpt.nodes
      .filter((node) => node.type === TYPE_COMPONENT || node.type === TYPE_UNKNOWN)
      .map((node) => node.ref);

    expect(hiddenRefs).toHaveLength(2);
    for (const connection of excerpt.connections) {
      if (hiddenRefs.includes(connection.from)) expect(connection.fromPort).toBe(PORT_HIDDEN);
      if (hiddenRefs.includes(connection.to)) expect(connection.toPort).toBe(PORT_HIDDEN);
    }
  });

  it('never emits a node id, even for the node the question is about', () => {
    const rendered = formatGraphExcerpt(build() as GraphExcerpt);
    expect(rendered).not.toContain(PROJECT_STRINGS.focusNodeId);
    expect(rendered).not.toContain(PROJECT_STRINGS.neighbourNodeId);
    expect(rendered).toContain('<- this node');
  });
});

describe('UNI-011 AC2 — the excerpt with no library', () => {
  /**
   * 🔴 `null` is "the library has not loaded", not "allow everything". The editor cannot tell its
   * own type name from the user's without it, and the safe reading of *cannot tell* is to publish
   * neither.
   */
  /**
   * 🔴 The control for the line above it, and the reason that line is not a tidy-up.
   *
   * The shared helper has two readings of "I have no library". ALPHA-007 passes `null` and gets
   * the type name **published verbatim** — its header names that branch and accepts it, which is
   * a defensible call for a GitHub issue the reporter deliberately filed. This module passes an
   * empty set and gets `<unknown>`. Asserting both is what stops the empty set being read as a
   * long way of writing `null` and simplified back.
   */
  it('the same helper called the other way publishes the name — which is why the empty set is deliberate', () => {
    expect(bucketTypeName(PROJECT_STRINGS.privateModule, null)).toBe(PROJECT_STRINGS.privateModule);
    expect(bucketTypeName(PROJECT_STRINGS.privateModule, new Set())).toBe(TYPE_UNKNOWN);
  });

  it('buckets every type to a sentinel and hides every port', () => {
    const excerpt = build({ library: null }) as GraphExcerpt;

    // ⚠️ Not "every type is `<unknown>`": a component path is bucketed on its leading slash,
    // *before* the library is consulted, so it stays `<component>` with or without one. The
    // claim that matters is that no type name survived — which is these two sentinels and
    // nothing else.
    expect(excerpt.nodes.map((node) => node.type)).toEqual([
      TYPE_UNKNOWN,
      TYPE_UNKNOWN,
      TYPE_COMPONENT,
      TYPE_UNKNOWN
    ]);
    expect(excerpt.connections.every((c) => c.fromPort === PORT_HIDDEN && c.toPort === PORT_HIDDEN)).toBe(true);
    // …and still produced the shape, which is the part that is worth having.
    expect(excerpt.nodes).toHaveLength(4);
    expect(excerpt.connections).toHaveLength(4);
  });
});

describe('UNI-011 AC2 — the excerpt is a neighbourhood, and says what it left out', () => {
  it('takes the focus node and everything one wire away, and no further', () => {
    const excerpt = build() as GraphExcerpt;
    // `far-1` is two wires out: reachable from `cmp-1`, not from the focus.
    expect(excerpt.nodes).toHaveLength(4);
    expect(excerpt.omitted.nodes).toBe(0);
    // The `cmp-1 -> far-1` wire touched the neighbourhood at one end, so it is counted.
    expect(excerpt.omitted.connections).toBe(1);
  });

  it('reports what the cap removed rather than truncating silently', () => {
    const excerpt = build({ maxNodes: 2 }) as GraphExcerpt;

    expect(excerpt.nodes).toHaveLength(2);
    expect(excerpt.omitted.nodes).toBe(2);
    expect(formatGraphExcerpt(excerpt)).toContain('more nodes');
  });

  it('is deterministic — the same graph twice is the same excerpt', () => {
    expect(JSON.stringify(build())).toEqual(JSON.stringify(build()));
  });

  it('returns null when the focus node is not in the graph', () => {
    expect(buildGraphExcerpt('nobody', fixtureNodes(), fixtureConnections(), { library: LIBRARY })).toBeNull();
  });
});
