/**
 * FB-021 — the sentence a switched-off property row explains itself with.
 *
 * ## What this suite is defending, and what it deliberately cannot
 *
 * The task was filed on a premise that turned out to be **inverted**. It said `sizeMode` "gates
 * whether the dimension ports exist at all". Session 20's drive measured the opposite: an
 * unnamed `dynamicports` group defaults to `conditionalports/basic`, and `basic` — in
 * `portConnectivity.ts`'s own words — *"only suppresses the property row; the port still exists
 * and a wire to it stays valid."* The wire survives a reload, delivers its value, and
 * `layout.ts` assigns neither axis. So the sentence these tests grade must never say the port
 * does not exist: it says when the port *applies*, and the row says separately that a live wire
 * is being discarded.
 *
 * The suite has three kinds of assertion, and they are different on purpose:
 *
 * 1. **Unit** — the grammar, one clause shape at a time, including the two refusals.
 * 2. **Corpus** — every `conditionalports/*` group in the shipped catalog, so the cardinalities
 *    below are facts about what ships rather than about a fixture. `portGateReason.ts`'s header
 *    quotes these numbers; this is what keeps them true.
 * 3. **Decision** — `partitionGatedPorts`, which is the whole of what changed in
 *    `ModelProxy.getPorts`. It lives in the import-free module precisely so it can be graded
 *    here: `modelProxy.ts` imports `NodeLibrary`, so a suite in this plain-Node runner cannot
 *    reach it, and a source-text assertion would keep passing after the call went dead.
 *
 * 🔴 **What no assertion here can show**: that the row is *drawn*. Three of the last four
 * sessions found defects that a green suite could not see, and the two in FB-022 were both of
 * this kind. The drive is the evidence for AC1 and AC3; this file is the evidence for what the
 * sentence says.
 */

import * as fs from 'fs';
import * as path from 'path';

import { evaluateDynamicPortsCondition } from '../../src/editor/src/models/nodelibrary/dynamicPortRules';
import {
  GATED_PORT_REASON_KEY,
  parseCondition,
  partitionGatedPorts,
  reasonsForGatedPorts,
  type GatePortLike
} from '../../src/editor/src/models/nodelibrary/portGateReason';

/** The shipped catalog — the same artefact `npm run catalog:check` keeps in step with source. */
const CATALOG = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../noodl-types/src/node-catalog.json'), 'utf8')
) as {
  nodes: {
    typeName: string;
    inputs?: { name: string; displayName?: string; type?: unknown }[];
    dynamicPorts?: { declaredPortGroups?: { name?: string; condition?: string; inputs?: string[] }[] };
  }[];
};

/**
 * The catalog records a group's ports as a flat `inputs: string[]`; the live node library hands
 * `ModelProxy` the richer `ports: [{name, plug, …}]` that `nodelibraryexport.ts` writes. This
 * turns one into the other so the corpus arm grades the *real* declarations through the *real*
 * entry point rather than through a second code path written for the test.
 */
function dynamicportsOf(node: (typeof CATALOG.nodes)[number]) {
  const groups = (node.dynamicPorts && node.dynamicPorts.declaredPortGroups) || [];
  return groups.map((group) => ({
    // An unnamed group is `conditionalports/basic` — `nodelibraryexport.ts:150`'s default, and
    // the reason 328 of the 349 gated ports are in the "live but hidden" state at all.
    name: group.name || 'conditionalports/basic',
    condition: group.condition,
    ports: (group.inputs || []).map((name) => ({ name }))
  }));
}

function portsOf(node: (typeof CATALOG.nodes)[number]): GatePortLike[] {
  return (node.inputs || []).map((input) => ({
    name: input.name,
    displayName: input.displayName,
    type: input.type
  }));
}

/** Every conditional group's input ports, which is the population this feature acts on. */
function gatedPortNames(node: (typeof CATALOG.nodes)[number]): string[] {
  const names: string[] = [];
  for (const group of dynamicportsOf(node)) {
    if (!group.name.startsWith('conditionalports/')) continue;
    for (const port of group.ports) names.push(port.name);
  }
  return names;
}

describe('FB-021 — parseCondition recognises exactly the grammar the evaluator runs', () => {
  it('reads a single equality clause', () => {
    expect(parseCondition('sizeMode = explicit')).toEqual({
      clauses: [{ param: 'sizeMode', op: '=', value: 'explicit' }],
      connective: 'or'
    });
  });

  it('reads an OR chain', () => {
    const parsed = parseCondition('sizeMode = explicit OR sizeMode = contentHeight');
    expect(parsed.connective).toBe('or');
    expect(parsed.clauses).toHaveLength(2);
  });

  it('reads an AND chain', () => {
    const parsed = parseCondition("useLabel = true AND labelPosition = 'top'");
    expect(parsed.connective).toBe('and');
    expect(parsed.clauses[1]).toEqual({ param: 'labelPosition', op: '=', value: 'top' });
  });

  it('reads NOT SET, which has no right-hand side', () => {
    expect(parseCondition('sizeMode NOT SET').clauses).toEqual([{ param: 'sizeMode', op: 'NOT SET' }]);
  });

  it('reads !=', () => {
    expect(parseCondition('mode != off').clauses).toEqual([{ param: 'mode', op: '!=', value: 'off' }]);
  });

  // The two refusals. Each is a case where a sentence would be *wrong* rather than merely absent,
  // which is the distinction `portDecoration.ts` drew for BCN-010 and this module inherits.
  it('refuses a #js condition rather than guessing at the expression', () => {
    expect(parseCondition('#js (params.useIcon===true || params.useIcon===undefined)')).toBeUndefined();
  });

  /*
   * 🔴 Found by mutation, and the reason the case above is not enough on its own.
   *
   * Deleting the `#js` guard entirely kills **no** row: every `#js` condition that ships
   * tokenises with the expression's first word in the operator slot (`(params.useIcon===true`),
   * which the clause check rejects anyway. The guard is explicit rather than load-bearing for
   * today's corpus — and the input below is the one that tells the two apart, so it cannot
   * quietly stop being either.
   */
  it('🔴 refuses a #js body that the clause parser would otherwise accept', () => {
    expect(parseCondition('#js = 1')).toBeUndefined();
  });

  it('refuses a condition mixing AND and OR, whose evaluator nests right-associatively', () => {
    // `A OR B AND C` evaluates as `A OR (B AND C)`. No flat sentence states that, so the module
    // declines instead of writing one that reads as `(A OR B) AND C`.
    expect(parseCondition('a = 1 OR b = 2 AND c = 3')).toBeUndefined();
  });

  it('refuses an operator it has never seen', () => {
    expect(parseCondition('sizeMode ~= explicit')).toBeUndefined();
  });
});

describe('FB-021 — the sentence names the control the author can see', () => {
  const sizeMode: GatePortLike = {
    name: 'sizeMode',
    displayName: 'Size Mode',
    type: {
      name: 'enum',
      enums: [
        { value: 'explicit', label: 'Explicit' },
        { value: 'contentSize', label: 'Content size' },
        { value: 'contentHeight', label: 'Content height' }
      ]
    }
  };
  const width: GatePortLike = { name: 'width', displayName: 'Width', type: 'dimension' };

  function reason(condition: string, ports: GatePortLike[] = [sizeMode, width], hidden = ['width']) {
    const dynamicports = [{ name: 'conditionalports/basic', condition, ports: [{ name: 'width' }] }];
    return reasonsForGatedPorts(dynamicports, hidden, ports).get('width');
  }

  it('uses the enum LABEL, not the stored value — the value is on screen nowhere', () => {
    // The condition stores `contentSize`; the dropdown shows `Content size`. Naming the stored
    // value would send an author looking for a word that does not appear in the UI.
    expect(reason('sizeMode = contentSize').sentence).toBe('Width applies when Size Mode is Content size.');
  });

  it('folds repeated clauses on one parameter into a value list', () => {
    // Spelled clause by clause this reads "Size Mode is Explicit or Size Mode is Content height",
    // and `width`'s real condition has five of them.
    expect(reason('sizeMode = explicit OR sizeMode = contentHeight').sentence).toBe(
      'Width applies when Size Mode is Explicit or Content height.'
    );
  });

  it('renders a boolean gate as a state rather than as a literal', () => {
    const useLabel: GatePortLike = { name: 'useLabel', displayName: 'Use Label', type: 'boolean' };
    expect(reason('useLabel = true', [useLabel, width]).sentence).toBe('Width applies when Use Label is on.');
  });

  /*
   * 🔴 Found by driving, not by a spec. `width` on a Group is gated by
   * `sizeMode = explicit OR sizeMode = contentHeight OR sizeMode NOT SET`, and the panel read
   * *"Width applies when Size Mode is Explicit or Content Height or Size Mode is not set."*
   * Every word of that is true and it names the control twice in one line.
   */
  it('does not repeat the gate label when consecutive clauses share it', () => {
    expect(reason('sizeMode = explicit OR sizeMode = contentHeight OR sizeMode NOT SET').sentence).toBe(
      'Width applies when Size Mode is Explicit or Content height, or is not set.'
    );
  });

  it('still names each control when the clauses are about DIFFERENT ones', () => {
    // The control for the case above: dropping a subject that has not actually repeated would
    // produce a sentence that silently attributes one port's state to another.
    const layout: GatePortLike = { name: 'layout', displayName: 'Layout' };
    const scroll: GatePortLike = { name: 'scrollEnabled', displayName: 'Enable Scroll' };
    expect(reason('layout != none AND scrollEnabled = true', [layout, scroll, width]).sentence).toBe(
      'Width applies when Layout is not none and Enable Scroll is on.'
    );
  });

  it('renders NOT SET without inventing a value', () => {
    expect(reason('sizeMode NOT SET').sentence).toBe('Width applies when Size Mode is not set.');
  });

  it('names the gating port so AC3 has something to travel to', () => {
    const r = reason('sizeMode = explicit');
    expect(r.gatePortName).toBe('sizeMode');
    expect(r.gateLabel).toBe('Size Mode');
  });

  it('falls back to the port name when a port declares no displayName', () => {
    const bare: GatePortLike = { name: 'sizeMode' };
    expect(reason('sizeMode = explicit', [bare, { name: 'width' }]).sentence).toBe(
      'width applies when sizeMode is explicit.'
    );
  });

  /*
   * The `range` case, which is the reason `reasonsForGatedPorts` is allowed to drop a clause at
   * all. Nine of its groups read `trackBorderLeftStyle = solid OR … OR borderStyle = solid`, and
   * `range` has no `borderStyle` port — `getParameter` returns `undefined`, so those disjuncts
   * are always false and dropping them leaves the condition's truth value untouched.
   */
  it('drops a disjunct about a parameter the node does not have', () => {
    const style: GatePortLike = { name: 'trackBorderLeftStyle', displayName: 'Track Border Left Style' };
    const r = reason('trackBorderLeftStyle = solid OR borderStyle = solid', [style, width]);
    expect(r.sentence).toBe('Width applies when Track Border Left Style is solid.');
    expect(r.sentence).not.toContain('borderStyle');
  });

  it('🔴 refuses when the undeclared clause is NOT SET, which would always be TRUE', () => {
    // The mirror of the case above, and the reason it is a guard rather than a filter: an
    // unresolvable parameter is always unset, so dropping this clause would turn a condition
    // that is satisfied into one the author is told to go and satisfy.
    //
    // 🔴 `trackBorderLeftStyle` is declared here ON PURPOSE, and the first version of this test
    // did not declare it. With neither parameter on the node the clause list empties and the
    // module refuses for a completely different reason — so the test passed while the guard it
    // names was dead. Mutation found it: flipping `refuse` killed nothing. One surviving usable
    // clause is what makes the guard the only thing left that can refuse.
    const style: GatePortLike = { name: 'trackBorderLeftStyle', displayName: 'Track Border Left Style' };
    expect(reason('borderStyle NOT SET OR trackBorderLeftStyle = solid', [style, width])).toBeUndefined();
    // The control: the same shape with `=` instead of `NOT SET` IS explained, so the refusal
    // above is about the operator and not about the undeclared parameter as such.
    expect(reason('borderStyle = solid OR trackBorderLeftStyle = solid', [style, width])).toBeDefined();
  });

  it('refuses when dropping a clause from an AND chain would change the meaning', () => {
    const style: GatePortLike = { name: 'trackBorderLeftStyle', displayName: 'Track Border Left Style' };
    expect(reason('trackBorderLeftStyle = solid AND borderStyle = solid', [style, width])).toBeUndefined();
  });

  it('refuses a port that two conditional groups both claim', () => {
    // Never happens in the catalog today — all 349 gated ports belong to exactly one group. A
    // second claimant means the module is looking at a shape it has not been taught, and
    // sounding certain about the first one found would be the wrong answer.
    const dynamicports = [
      { name: 'conditionalports/basic', condition: 'sizeMode = explicit', ports: [{ name: 'width' }] },
      { name: 'conditionalports/basic', condition: 'sizeMode NOT SET', ports: [{ name: 'width' }] }
    ];
    expect(reasonsForGatedPorts(dynamicports, ['width'], [sizeMode, width]).get('width')).toBeUndefined();
  });

  it('explains only the ports the filter actually switched off', () => {
    const dynamicports = [
      {
        name: 'conditionalports/basic',
        condition: 'sizeMode = explicit',
        ports: [{ name: 'width' }, { name: 'height' }]
      }
    ];
    const reasons = reasonsForGatedPorts(dynamicports, ['width'], [sizeMode, width, { name: 'height' }]);
    expect([...reasons.keys()]).toEqual(['width']);
  });
});

describe('FB-021 — over the shipped catalog, not a fixture', () => {
  /*
   * 🔴 These numbers are quoted in `portGateReason.ts`'s header and in the task file. They are
   * asserted rather than described so that a catalog change moves a test rather than silently
   * making the prose wrong — and so the 9 deliberately-unexplained ports cannot quietly become
   * 10. Re-derived 2026-08-25 with `npm run catalog:check` reporting the committed catalog up to
   * date, so this is a measurement of what ships.
   */
  const all: { type: string; port: string; explained: boolean }[] = [];
  /** `type.port` for every port gated by a `#js` condition — the refusal this module intends. */
  const jsGated = new Set<string>();

  beforeAll(() => {
    for (const node of CATALOG.nodes) {
      const hidden = gatedPortNames(node);
      if (!hidden.length) continue;

      for (const group of dynamicportsOf(node)) {
        if (!group.name.startsWith('conditionalports/')) continue;
        if (!group.condition || !group.condition.startsWith('#js')) continue;
        for (const port of group.ports) jsGated.add(`${node.typeName}.${port.name}`);
      }

      const reasons = reasonsForGatedPorts(dynamicportsOf(node), hidden, portsOf(node));
      for (const port of hidden) all.push({ type: node.typeName, port, explained: reasons.has(port) });
    }
  });

  it('finds all 349 conditionally-gated input ports', () => {
    expect(all).toHaveLength(349);
  });

  it('explains 338 of them', () => {
    expect(all.filter((row) => row.explained)).toHaveLength(338);
  });

  /*
   * 🔴 The population above is **counterfactual** and the difference matters. It asks "if this
   * port were switched off, could the row explain itself?" of every port in every conditional
   * group. At runtime only the ports whose condition currently *fails* are hidden, which is a
   * subset — so 349 is the number of gate-ABLE ports, not the number ever gated at once.
   *
   * Under that counterfactual 11 ports are refused, and they refuse for two different reasons.
   * Counting them together would hide the second one, which is the more interesting.
   */
  it('leaves 11 unexplained under the counterfactual, of two distinct kinds', () => {
    expect(all.filter((row) => !row.explained)).toHaveLength(11);
  });

  it('9 are the #js icon conditions — the deliberate remainder', () => {
    const refused = all.filter((row) => !row.explained && jsGated.has(`${row.type}.${row.port}`));
    expect(refused).toHaveLength(9);
    // Named, not just counted: a different 9 would satisfy a bare count and mean something else
    // entirely has stopped being explainable.
    expect([...new Set(refused.map((row) => row.type))].sort()).toEqual([
      'net.noodl.controls.checkbox',
      'net.noodl.controls.radiobutton',
      'net.noodl.visual.icon'
    ]);
    expect([...new Set(refused.map((row) => row.port))].sort()).toEqual([
      'iconColor',
      'iconIconSource',
      'iconImageSource'
    ]);
  });

  /*
   * 🔴 The other 2 were found BY this suite disagreeing with the measurement that preceded it,
   * and they are not a gap at all.
   *
   * `icon.ts` calls `addIconInputs(IconNode, { hideEnableIconInput: true })`, so the Icon node
   * never registers a `useIcon` port — while the group gating `iconSourceType` and `iconSize`
   * still reads `useIcon = true OR useIcon NOT SET`. `getParameter('useIcon')` is therefore
   * `undefined`, the `NOT SET` disjunct is **always true**, and the real filter never hides
   * these two ports at all. `reasonsForGatedPorts` refuses them because dropping an always-true
   * `NOT SET` clause about an undeclared parameter would change the condition's meaning — and
   * that refusal costs exactly nothing, because the case cannot arise.
   *
   * Graded with the REAL evaluator rather than by reasoning about it, so the claim "these can
   * never be hidden" is a measurement.
   *
   * ⚠️ The bound: this evaluates the default state, where no parameter is set. A project file
   * carrying a stale `useIcon` parameter for a port that no longer exists is not covered here.
   */
  it('the other 2 are ports the real filter can never hide anyway', () => {
    const refused = all.filter((row) => !row.explained && !jsGated.has(`${row.type}.${row.port}`));
    expect(refused.map((row) => `${row.type}.${row.port}`).sort()).toEqual([
      'net.noodl.visual.icon.iconSize',
      'net.noodl.visual.icon.iconSourceType'
    ]);

    const icon = CATALOG.nodes.find((node) => node.typeName === 'net.noodl.visual.icon');
    const unset = { getParameter: () => undefined, parameters: {} };

    for (const row of refused) {
      const group = dynamicportsOf(icon).find((g) => g.ports.some((port) => port.name === row.port));
      // The condition PASSES, so `applyPortConditionsFilterForNode` never adds the port to its
      // hidden list, so nothing ever asks this module to explain it.
      expect(evaluateDynamicPortsCondition(group.condition, unset)).toBe(true);
    }
  });

  it('every sentence names a control and ends in a full stop', () => {
    for (const node of CATALOG.nodes) {
      const hidden = gatedPortNames(node);
      if (!hidden.length) continue;

      const ports = portsOf(node);
      const declared = new Set(ports.map((port) => port.name));

      for (const [portName, reason] of reasonsForGatedPorts(dynamicportsOf(node), hidden, ports)) {
        expect(reason.sentence.endsWith('.')).toBe(true);
        expect(reason.sentence).toContain(' applies when ');
        // AC3's target has to be a port that is really on the node, or the click goes nowhere.
        expect(declared.has(reason.gatePortName)).toBe(true);
        expect(reason.portName).toBe(portName);
        // 🔴 The premise the task was filed on, inverted. A `basic`-gated port DOES exist.
        expect(reason.sentence.toLowerCase()).not.toContain('does not exist');
      }
    }
  });

  it("the motivating case reads the way Jordan's question deserves", () => {
    const group = CATALOG.nodes.find((node) => node.typeName === 'Group');
    const reasons = reasonsForGatedPorts(dynamicportsOf(group), gatedPortNames(group), portsOf(group));

    const width = reasons.get('width');
    expect(width).toBeDefined();
    expect(width.gatePortName).toBe('sizeMode');
    expect(width.sentence).toContain('Width applies when Size Mode is');
  });
});

describe('FB-021 — partitionGatedPorts is the whole of what changed in ModelProxy.getPorts', () => {
  const reasons = new Map([
    ['width', { portName: 'width', gatePortName: 'sizeMode', gateLabel: 'Size Mode', sentence: 'Width applies.' }]
  ]);
  const ports: GatePortLike[] = [{ name: 'sizeMode' }, { name: 'width' }, { name: 'iconColor' }];

  it('keeps an explained port and marks it, where it used to splice it out', () => {
    const kept = partitionGatedPorts(ports, ['width'], reasons);
    expect(kept.map((port) => port.name)).toEqual(['sizeMode', 'width', 'iconColor']);
    expect(kept[1][GATED_PORT_REASON_KEY]).toBe(reasons.get('width'));
  });

  it('still splices out a port it cannot explain — no dead control without a reason', () => {
    const kept = partitionGatedPorts(ports, ['width', 'iconColor'], reasons);
    expect(kept.map((port) => port.name)).toEqual(['sizeMode', 'width']);
  });

  it('🔴 never mutates the port objects, which are NodeGraphNode._ports by reference', () => {
    const kept = partitionGatedPorts(ports, ['width'], reasons);
    // The gated one is a copy…
    expect(kept[1]).not.toBe(ports[1]);
    expect(ports[1][GATED_PORT_REASON_KEY]).toBeUndefined();
    // …and every other row is the very same object, so nothing downstream sees a new identity.
    expect(kept[0]).toBe(ports[0]);
  });

  it('leaves an ungated list completely alone', () => {
    expect(partitionGatedPorts(ports, [], reasons).map((port) => port.name)).toEqual([
      'sizeMode',
      'width',
      'iconColor'
    ]);
  });

  it('🔴 makes the mark appear and disappear, which is what re-renders the panel', () => {
    // `ModelProxy.setParameter` fires `instancePortsChanged` on
    // `!isEqual(_oldPorts, this.getPorts())`. Before FB-021 the list changed LENGTH when a
    // condition flipped; now it does not, and this equality is the only thing left that moves.
    // If it stopped moving, flipping Size Mode would leave the rows exactly as they were — AC1.
    const off = JSON.stringify(partitionGatedPorts(ports, ['width'], reasons));
    const on = JSON.stringify(partitionGatedPorts(ports, [], reasons));
    expect(off).not.toEqual(on);
  });
});
