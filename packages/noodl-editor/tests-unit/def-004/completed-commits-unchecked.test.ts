/**
 * DEF-004 §4c / AC4 — in a cloud function, a `completed` edge that commits a
 * result nothing checked.
 *
 * ## 🔴 The pair IS the test, and AC4 as written fails it
 *
 * AC4: *"A graph wiring `completed` into a record write is refused **by name**;
 * the two legitimate uses are **accepted** in the same run. That pair is the
 * whole test — a rule that refuses both has banned the port."*
 *
 * It then names the target — a record write **or a `noodl.cloud.response.send`**
 * — as the defect. Measured over the shipped template, that predicate refuses
 * `submitContactForm`, whose `mail.completed → res.send` is one of the two uses
 * the same criterion requires it to accept. `AC4 as written` below is that
 * predicate, kept as a permanent arm: it fires on the graph it must not, so the
 * discrimination this rule makes is load-bearing rather than decorative.
 *
 * ## The corpus is the shipped template, and the defect arm is one wire away
 *
 * SBR-015 repaired both defects in `site-builder.content.json` by changing
 * `completed` to `done`. So the committed artefact **is** the accepted arm, and
 * the refused arm is the same graph with that one wire flipped back — the
 * `publishPage` that really shipped, reconstructed by the minimal mutation
 * rather than typed out. Nothing here is a hand-built fixture standing in for a
 * real graph.
 *
 * @module noodl-editor/tests-unit/def-004/completed-commits-unchecked
 */
import * as fs from 'fs';
import * as path from 'path';

import { completedCommitsUnchecked, COMMIT_PORTS } from '@noodl-models/../validation/rules/completedCommitsUnchecked';
import { failureReachesNothing } from '@noodl-models/../validation/rules/failureReachesNothing';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';
import {
  AUTHORED_BLOCKING_WARNINGS,
  isBlockingForAuthoredOutput
} from '@noodl-models/../validation/authoredCandidate';
import { CatalogIndex } from '@noodl-models/../validation/CatalogIndex';
import { defaultCatalog } from '@noodl-models/../validation/catalog';
import type { NormComponent, NormNode } from '@noodl-models/../validation/model';
import type { RuleContext } from '@noodl-models/../validation/rules/types';

const CATALOG = new CatalogIndex(defaultCatalog());

const TEMPLATE = path.resolve(
  __dirname,
  '../../src/editor/src/models/template/templates/site-builder.content.json'
);

interface StoredNode {
  id: string;
  type: string;
  label?: string;
  children?: StoredNode[];
}
interface StoredWire {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

function flatten(roots: StoredNode[], out: NormNode[] = []): NormNode[] {
  for (const n of roots) {
    out.push({ id: n.id, type: n.type, label: n.label, children: [], instancePorts: [] } as unknown as NormNode);
    flatten(n.children ?? [], out);
  }
  return out;
}

/** One component of the shipped template, as the validator sees it. */
function shipped(name: string): NormComponent {
  const project = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  const c = project.components.find((x: { name: string }) => x.name === name);
  if (!c) throw new Error(`no component ${name} in the shipped template`);
  return {
    name: c.name,
    nodes: flatten(c.graph.roots),
    connections: c.graph.connections
  } as unknown as NormComponent;
}

function run(component: NormComponent, rule = completedCommitsUnchecked) {
  const ctx = {
    project: { components: [component], componentRefs: new Set<string>() },
    catalog: CATALOG,
    options: {},
    components: [{ component, nodeById: new Map(component.nodes.map((n) => [n.id, n])) }],
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  } as unknown as RuleContext;
  return rule.run(ctx);
}

/** Flip one wire's source port, the way SBR-015 flipped it the other way. */
function withPort(component: NormComponent, fromId: string, was: string, now: string): NormComponent {
  const clone = JSON.parse(JSON.stringify(component)) as NormComponent;
  const wires = clone.connections as unknown as StoredWire[];
  const hit = wires.filter((w) => w.fromId === fromId && w.fromProperty === was);
  if (hit.length !== 1) throw new Error(`expected exactly one ${fromId}.${was} wire, found ${hit.length}`);
  hit[0].fromProperty = now;
  return clone;
}

// ── AC4's pair, on the real graphs ───────────────────────────────────────────

describe('DEF-004 AC4 — the pair, one wire apart', () => {
  it('🔴 refuses publishPage as it shipped before SBR-015', () => {
    const before = withPort(shipped('/#__cloud__/publishPage'), 'tasks', 'done', 'completed');
    const found = run(before);

    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.CompletedCommitsUnchecked]);
    expect(found[0].location.nodeId).toBe('tasks');
    expect(found[0].location.port).toBe('completed');
    // 🔴 **The write's id is DERIVED, and it used to be typed.** This assertion
    // read `toId: 'page-7'` and went red when SBR-010 added two components to
    // the template — not because anything about this rule or this graph moved,
    // but because the door reallocates ids to be unique across the PROJECT
    // (SB-004 F9), so a `page` node three components away renumbered this one to
    // `page-8`. A spec that pins a reallocated id is a spec that reddens on
    // somebody else's unrelated screen, and this file already knows the node by
    // the name it asserts in the message two lines below.
    const write = before.nodes.find((n) => n.label === 'Write the page: mirror + access rules');
    expect(write).toBeDefined();
    expect(found[0].location.connection).toEqual({
      fromId: 'tasks',
      fromProperty: 'completed',
      toId: write!.id,
      toProperty: 'store'
    });
    // Refused BY NAME, which is what AC4 asks for — and the name is the
    // author's label, not the node type, on both ends of the wire.
    expect(found[0].message).toContain('"Set access on every section"');
    expect(found[0].message).toContain('"Write the page: mirror + access rules"');
    expect(found[0].message).toContain('a record is written saying the work was done');
  });

  it('accepts publishPage as it ships now', () => {
    expect(run(shipped('/#__cloud__/publishPage'))).toEqual([]);
  });

  it('🔴 accepts submitContactForm — the bounced mail that must still answer the visitor', () => {
    // `mail.completed → res-3.send` IS a `completed` into a response's `send`,
    // the exact shape AC4 names as the defect. It is accepted because
    // `save-3.failure` and `stored.failure` both reach that same `send`, so the
    // author enumerated the bad outcomes and this is the carry-on-regardless leg.
    expect(run(shipped('/#__cloud__/submitContactForm'))).toEqual([]);
  });

  it('accepts ContactRecipient — the unprovisioned secret that must still reach the picker', () => {
    // `secret.completed → pick.run`. Not a commit at all: nothing is claimed.
    expect(run(shipped('/#__cloud__/site/ContactRecipient'))).toEqual([]);
  });

  it('control: the accepted graphs really do carry `completed` wires to grade', () => {
    // Without this, all three green arms above would also pass on a rule that
    // could not see `completed` at all — and on a template that had none.
    const completedWires = (name: string) =>
      (shipped(name).connections as unknown as StoredWire[]).filter((w) => w.fromProperty === 'completed');

    expect(completedWires('/#__cloud__/submitContactForm')).toHaveLength(1);
    expect(completedWires('/#__cloud__/site/ContactRecipient')).toHaveLength(1);
    // …and the whole shipped template carries exactly these two.
    const project = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
    const all = project.components.flatMap((c: { name: string; graph: { connections: StoredWire[] } }) =>
      c.graph.connections.filter((w) => w.fromProperty === 'completed').map(() => c.name)
    );
    expect(all.sort()).toEqual(['/#__cloud__/site/ContactRecipient', '/#__cloud__/submitContactForm']);
  });
});

// ── 🔴 AC4 as written, kept as the arm that justifies the predicate ──────────

describe('DEF-004 AC4 — the criterion contradicts itself, and this is the measurement', () => {
  /**
   * AC4's own words as a predicate: `completed` reaching a record write or a
   * `noodl.cloud.response.send`, refused by target.
   */
  function ac4AsWritten(component: NormComponent): string[] {
    const type = new Map(component.nodes.map((n) => [n.id, n.type]));
    return (component.connections as unknown as StoredWire[])
      .filter(
        (w) =>
          w.fromProperty === 'completed' &&
          COMMIT_PORTS.some((c) => c.type === type.get(w.toId) && c.port === w.toProperty)
      )
      .map((w) => `${w.fromId}.completed -> ${type.get(w.toId)}.${w.toProperty}`);
  }

  it('🔴 AC4 as written refuses submitContactForm, which AC4 also requires it to accept', () => {
    expect(ac4AsWritten(shipped('/#__cloud__/submitContactForm'))).toEqual([
      'mail.completed -> noodl.cloud.response.send'
    ]);
    // The rule that shipped does not.
    expect(run(shipped('/#__cloud__/submitContactForm'))).toEqual([]);
  });

  it('control: AC4-as-written and the real rule AGREE on the defect — the difference is not that one is inert', () => {
    const before = withPort(shipped('/#__cloud__/publishPage'), 'tasks', 'done', 'completed');
    expect(ac4AsWritten(before)).toEqual(['tasks.completed -> SetDbModelProperties.store']);
    expect(run(before)).toHaveLength(1);
  });
});

// ── Not a duplicate of DEF-002's rule ────────────────────────────────────────

describe('DEF-004 §4c — the other pipeline does not already report this', () => {
  /**
   * *A check in a second pipeline is a duplicate first*, so this was measured
   * before the rule was written, on two graphs rather than one — because
   * `expect([])` from a rule that never speaks proves nothing.
   */
  it('🔴 on the one-wire graph, DEF-002 is silent and this rule is not', () => {
    const before = withPort(shipped('/#__cloud__/publishPage'), 'tasks', 'done', 'completed');

    // SBR-015's failure wires are all still here, so DEF-002's rule is satisfied
    // — every Failure reaches a Response. The lie it cannot see is upstream of
    // that: the caller is answered, correctly, that a page was published.
    expect(run(before, failureReachesNothing)).toEqual([]);
    expect(run(before).map((d) => d.location.nodeId)).toEqual(['tasks']);
  });

  it('🔴 control: DEF-002 CAN fire on this component, and still never on `tasks`', () => {
    // The known-firing arm the absence above needs. Strip the failure wires too
    // and this is the `publishPage` that really shipped: DEF-002's rule speaks,
    // and what it names is `prep` — never the node carrying the `completed`.
    // `prep.out-pageId → res.pm-pageId` answers the caller without passing
    // through `tasks`, so `answeredWithout` excuses it.
    const reallyShipped = withPort(shipped('/#__cloud__/publishPage'), 'tasks', 'done', 'completed');
    reallyShipped.connections = (reallyShipped.connections as unknown as StoredWire[]).filter(
      (w) => w.fromProperty !== 'failure' && w.fromProperty !== 'unchanged'
    ) as unknown as NormComponent['connections'];

    const def002 = run(reallyShipped, failureReachesNothing);
    expect(def002.length).toBeGreaterThan(0);
    expect(def002.map((d) => d.location.nodeId)).toContain('prep');
    expect(def002.map((d) => d.location.nodeId)).not.toContain('tasks');

    // And this rule still names exactly the wire SBR-015 changed.
    expect(run(reallyShipped).map((d) => d.location.nodeId)).toEqual(['tasks']);
  });
});

// ── The blocking arm has no positive instance in any template, so: a probe ───

describe('DEF-004 §4c — a deliberately-malformed probe, since no template holds one', () => {
  function node(id: string, type: string, label?: string): NormNode {
    return { id, type, label, children: [], instancePorts: [] } as unknown as NormNode;
  }
  function wire(fromId: string, fromProperty: string, toId: string, toProperty: string): StoredWire {
    return { fromId, fromProperty, toId, toProperty };
  }

  /**
   * The smallest graph with the defect: a request, a mail that can fail, a
   * record write fired by its `completed`, and an answer. `routeTheFailure`
   * turns on the one wire that makes it honest.
   */
  function probe(routeTheFailure: boolean): NormComponent {
    return {
      name: '/#__cloud__/probe',
      nodes: [
        node('req', 'noodl.cloud.request', 'probe'),
        node('mail', 'noodl.cloud.sendemail', 'Notify the owner'),
        node('mark', 'SetDbModelProperties', 'Mark notified'),
        node('res', 'noodl.cloud.response', 'Answer')
      ],
      connections: [
        wire('req', 'receive', 'mail', 'send'),
        wire('mail', 'completed', 'mark', 'store'),
        wire('mark', 'done', 'res', 'send'),
        ...(routeTheFailure ? [wire('mail', 'failure', 'mark', 'store')] : [])
      ]
    } as unknown as NormComponent;
  }

  it('🔴 fires on a `sendemail`, which SBR-015 template gate structurally cannot see', () => {
    // That gate requires `type === 'RunTasks'` — a hand-list wearing a
    // predicate. The defect does not care which node completed.
    const found = run(probe(false));
    expect(found.map((d) => d.location.nodeId)).toEqual(['mail']);
    expect(found[0].severity).toBe('warning');
  });

  it('routing the Failure to the same commit is what clears it', () => {
    expect(run(probe(true))).toEqual([]);
  });

  it('control: a Failure routed SOMEWHERE ELSE does not clear it', () => {
    // The generous reachability must still be *targeted*. A failure that answers
    // the caller does not make the record write honest.
    const elsewhere = probe(false);
    (elsewhere.connections as unknown as StoredWire[]).push(wire('mail', 'failure', 'res', 'send'));
    expect(run(elsewhere).map((d) => d.location.nodeId)).toEqual(['mail']);
  });

  it('🔴 `unchanged` clears it too — a no-op is an outcome the author handled', () => {
    // Added because the mutant that dropped `unchanged` from the negative set
    // killed nothing: it was in the rule and exercised by no arm. `RunTasks`
    // fires `unchanged` on an empty list, and the shipped `publishPage` routes
    // it (`tasks.unchanged → deny.send`), so this is a real shape, not a
    // hypothetical one.
    const noop = probe(false);
    (noop.connections as unknown as StoredWire[]).push(wire('mail', 'unchanged', 'mark', 'store'));
    expect(run(noop)).toEqual([]);
  });

  it('control: a port that is NOT an outcome does not clear it', () => {
    // Without this the arm above would also pass on a rule that treated any
    // second wire into the commit as a failure route.
    const other = probe(false);
    (other.connections as unknown as StoredWire[]).push(wire('mail', 'done', 'mark', 'store'));
    expect(run(other).map((d) => d.location.nodeId)).toEqual(['mail']);
  });

  it('a Failure reaching the commit through a chain also clears it', () => {
    const chained = probe(false);
    (chained.connections as unknown as StoredWire[]).push(
      wire('mail', 'failure', 'res', 'send'),
      wire('res', 'done', 'mark', 'store')
    );
    expect(run(chained)).toEqual([]);
  });

  it('outside a cloud function the rule is silent, deliberately', () => {
    const browser = probe(false);
    browser.nodes = browser.nodes.filter((n) => n.type !== 'noodl.cloud.request');
    expect(run(browser)).toEqual([]);
  });
});

// ── The commit surface is real, and narrow on purpose ────────────────────────

describe('DEF-004 §4c — what counts as a commit', () => {
  it('control: every commit port in the set exists on its type in the catalog', () => {
    // A typo here would silently disable the rule rather than fail. *The
    // population is part of the checker.*
    for (const { type, port } of COMMIT_PORTS) {
      expect(CATALOG.getPort(type, 'input', port)).toBeTruthy();
    }
    expect(COMMIT_PORTS.length).toBe(4);
  });

  it("⚠️ `sendemail`'s `send` is NOT a commit, though it is spelled the same", () => {
    const c = {
      name: '/#__cloud__/mailer',
      nodes: [
        { id: 'req', type: 'noodl.cloud.request', children: [], instancePorts: [] },
        { id: 'a', type: 'noodl.cloud.secret', children: [], instancePorts: [] },
        { id: 'mail', type: 'noodl.cloud.sendemail', children: [], instancePorts: [] }
      ],
      connections: [{ fromId: 'a', fromProperty: 'completed', toId: 'mail', toProperty: 'send' }]
    } as unknown as NormComponent;
    // Sending a mail asserts nothing about the work upstream; its own failure is
    // reported on its own ports.
    expect(run(c)).toEqual([]);
  });
});

// ── The blocking promotion, and the corpus that justified it ─────────────────

describe('DEF-004 §4c — blocking for a graph an agent just wrote', () => {
  it('is in AUTHORED_BLOCKING_WARNINGS', () => {
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.CompletedCommitsUnchecked)).toBe(true);
  });

  it('🔴 so a finding rejects an authored submission, while staying a warning', () => {
    const before = withPort(shipped('/#__cloud__/publishPage'), 'tasks', 'done', 'completed');
    const [found] = run(before);
    // Both halves matter: `warning` keeps it advisory for a project somebody
    // imported, and the set is what makes it blocking for a fresh write.
    expect(found.severity).toBe('warning');
    expect(isBlockingForAuthoredOutput(found)).toBe(true);
  });

  it('control: the accepted graph produces nothing to block on', () => {
    expect(run(shipped('/#__cloud__/submitContactForm')).filter(isBlockingForAuthoredOutput)).toEqual([]);
  });
});
