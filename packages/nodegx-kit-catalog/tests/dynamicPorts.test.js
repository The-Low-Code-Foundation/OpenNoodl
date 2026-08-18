/**
 * CN-004 item 4 — the dynamic-port carve-out, on the mapping side.
 *
 * ## The defect this suite exists for
 *
 * CN-003's `toDynamicPorts` labelled *every* entry of a kit's `dynamicports`
 * `declared-port-groups` and handed the raw exported entries through as
 * `declaredPortGroups`. Both halves were wrong, and neither was visible in any
 * fixture: the demo kit and the cashflow kit declare no `dynamicports` at all,
 * so the whole mapping ran on the empty case for a task and a half.
 *
 * The exporter's vocabulary and the catalog's are not the same vocabulary:
 *
 * | `formatDynamicPorts` emits | Means | Catalog mechanism |
 * |---|---|---|
 * | `{ name, condition, ports: [portObject] }` | a fixed set switched on by a sibling parameter | `declared-port-groups`, stored as `{ condition, inputs: [name] }` |
 * | `{ template }`, `{ port }`, `{ channelPort }` | ports minted at runtime; names unknowable | `runtime-discovered` |
 *
 * and the shipped catalog stores a group as `{ condition, inputs }` — which is
 * what `conditionForInput` filters on and what `CatalogIndex.computePortNames`
 * folds in. Passing `{ ports: [...] }` through means **no consumer ever finds
 * the condition**.
 *
 * ## Why the consequences are opposite, and why both need a test
 *
 * - Mislabelling a **runtime** entry as declared makes `hasRuntimeDynamicPorts`
 *   false, so `checkParameterValues` reports a port the kit really creates as
 *   `unknown-parameter` — **a warning on a correct kit**. For the `channelPort`
 *   shape it is guaranteed, because the exporter deliberately keeps a channel
 *   port out of the static `ports` list, so nothing else could vouch for it.
 * - Mislabelling a **conditional** entry costs the opposite: the condition is
 *   never read, so `inactive-conditional-parameter` cannot fire on a kit node.
 *
 * One is a false accusation and one is a silent miss. A fix that only addressed
 * whichever was noticed first would leave the other, so both are asserted here
 * and again as consequences in `noodl-editor/tests-unit/cn-004`.
 *
 * ## The fixture is a recording, not a hand-write
 *
 * `dynports-kit-nodelibrary.json` is what `generateNodeLibrary` exported after
 * `tests/fixtures/kit-dynports`'s kit ran against a live register, via the
 * shipped extractor. A hand-written payload here could only have asserted my
 * reading of `formatDynamicPorts`, which is the thing in doubt.
 */
const { catalogNodesFromNodeLibrary } = require('../src/index');

const payload = require('./fixtures/dynports-kit-nodelibrary.json');

function nodeNamed(name) {
  const { nodes } = catalogNodesFromNodeLibrary(payload);
  return nodes.find((n) => n.typeName === name);
}

describe('the recorded payload really carries both shapes', () => {
  // 🔴 If this drifts, every expectation below is about a payload that no
  // longer exists and the suite would keep passing while measuring nothing.
  it('exports a conditional group as `ports`, not as `inputs`', () => {
    const panel = payload.nodetypes.find((n) => n.name === 'dynports.kit.Panel');
    expect(panel.dynamicports).toEqual([
      {
        name: 'conditionalports/basic',
        condition: 'mode = list',
        ports: [expect.objectContaining({ name: 'itemCount', plug: 'input' })]
      }
    ]);
    // The kit's source says `inputs: ['itemCount']`. The exporter rewrote it.
    expect(panel.dynamicports[0].inputs).toBeUndefined();
  });

  it('keeps a channel port out of the static port list entirely', () => {
    const feed = payload.nodetypes.find((n) => n.name === 'dynports.kit.Feed');
    expect(feed.dynamicports).toEqual([{ channelPort: { plug: 'input', name: 'channelName' }, name: 'channel' }]);
    expect(feed.ports.map((p) => p.name)).not.toContain('channelName');
  });
});

/**
 * ✅ **D12, 2026-08-18.** `channelPort` is recognised here and implemented
 * nowhere, so the ports it names appear in no surface and in no state. The
 * ruling is to say so rather than to revive the editor-side manager (one
 * occurrence in 177 library types, and it is this fixture's own node) or to go
 * on saying nothing (the status quo, and the worst of the three).
 */
describe('D12 — an unimplemented dynamic-port mechanism is recorded', () => {
  it('names channelPort as unsupported, from the real exported payload', () => {
    // Read off the recording rather than a hand-written overlay: this is the
    // shape `formatDynamicPorts` actually emits, which is the thing in doubt.
    expect(nodeNamed('dynports.kit.Feed').dynamicPorts.unsupportedMechanisms).toEqual(['channelPort']);
  });

  it('still calls it runtime-discovered, because under-claiming costs a false accusation', () => {
    // 🔴 The two facts are independent and both must hold. Dropping
    // `runtime-discovered` would make `hasRuntimeDynamicPorts` false and turn
    // every parameter on this node into `unknown-parameter` — a warning on a
    // kit whose only crime is a mechanism we do not implement.
    expect(nodeNamed('dynports.kit.Feed').dynamicPorts.mechanisms).toContain('runtime-discovered');
  });

  it('a supported runtime mechanism is NOT reported unsupported', () => {
    // The control. `template`/`port` entries also set `runtime-discovered`, so a
    // rule that keyed on the mechanism list rather than on the entry shape would
    // accuse them too — and they work.
    const supported = nodeNamed('dynports.kit.Panel');

    expect(supported.dynamicPorts.mechanisms).toEqual(['declared-port-groups']);
    expect(supported.dynamicPorts.unsupportedMechanisms).toBeUndefined();
  });

  it('is absent rather than empty, so "none" and "nobody looked" stay apart', () => {
    const withGroups = nodeNamed('dynports.kit.Panel').dynamicPorts;

    expect('unsupportedMechanisms' in withGroups).toBe(false);
  });
});

describe('a conditional group', () => {
  it('is declared-port-groups, and only that', () => {
    expect(nodeNamed('dynports.kit.Panel').dynamicPorts.mechanisms).toEqual(['declared-port-groups']);
  });

  it('is translated into the `{ condition, inputs }` shape the catalog stores', () => {
    // The whole fix in one assertion: `inputs`, not `ports`. `conditionForInput`
    // filters on `g.inputs?.includes(portName)` and would find nothing else.
    expect(nodeNamed('dynports.kit.Panel').dynamicPorts.declaredPortGroups).toEqual([
      { condition: 'mode = list', inputs: ['itemCount'] }
    ]);
  });
});

describe('a runtime-minted port', () => {
  it('is runtime-discovered, so the carve-out applies', () => {
    expect(nodeNamed('dynports.kit.Feed').dynamicPorts.mechanisms).toEqual(['runtime-discovered']);
  });

  it('contributes no declared groups, rather than an empty one', () => {
    // `declaredPortGroups: []` would read as "this node has conditional groups
    // and they are empty", which is a different and false claim.
    expect(nodeNamed('dynports.kit.Feed').dynamicPorts.declaredPortGroups).toBeUndefined();
  });
});

describe('shapes the recording cannot cover', () => {
  // The fixture kit exercises the two shapes a kit author writes today. These
  // synthesise the rest of `formatDynamicPorts`' pass-through vocabulary, which
  // no kit in this repo uses yet — a mapping that is only correct for the two
  // shapes we happen to have is one release away from the third.
  const synth = (dynamicports) => ({
    nodetypes: [{ name: 'k.X', module: 'K', category: 'Visual', dynamicports, ports: [] }]
  });
  const mechanismsOf = (dynamicports) =>
    catalogNodesFromNodeLibrary(synth(dynamicports)).nodes[0].dynamicPorts.mechanisms;

  it('reads a `template` entry as runtime', () => {
    expect(mechanismsOf([{ name: 'expand', template: { name: '{{prop}}', type: 'string' } }])).toEqual([
      'runtime-discovered'
    ]);
  });

  it('reads a `port` entry as runtime', () => {
    expect(mechanismsOf([{ name: 'selector', port: { name: 'value', type: 'string' } }])).toEqual([
      'runtime-discovered'
    ]);
  });

  it('unions both when a node declares one of each', () => {
    // ⚠️ A node mixing the two must not lose its conditions to the runtime
    // entry, nor its carve-out to the conditional one.
    const mixed = [
      { name: 'conditionalports/basic', condition: 'mode = list', ports: [{ name: 'itemCount', plug: 'input' }] },
      { name: 'expand', template: { name: '{{prop}}' } }
    ];
    expect(mechanismsOf(mixed)).toEqual(['declared-port-groups', 'runtime-discovered']);
    expect(catalogNodesFromNodeLibrary(synth(mixed)).nodes[0].dynamicPorts.declaredPortGroups).toEqual([
      { condition: 'mode = list', inputs: ['itemCount'] }
    ]);
  });

  it('takes an entry it cannot read as runtime, never as nothing', () => {
    // The conservative direction: an unrecognised shape costs a skipped check.
    // Reporting no mechanisms would read as "no dynamic ports", which the
    // presence of a `dynamicports` entry is precisely evidence against.
    expect(mechanismsOf([{ name: 'something-new-in-2027' }])).toEqual(['runtime-discovered']);
  });

  it('still answers null when a node declares no dynamic ports at all', () => {
    // The control for every assertion above: `null` and "runtime-discovered"
    // must stay distinguishable, or the conservative default silently swallows
    // the ordinary case and every static kit node stops being checked.
    expect(catalogNodesFromNodeLibrary(synth([])).nodes[0].dynamicPorts).toBeNull();
    expect(
      catalogNodesFromNodeLibrary({ nodetypes: [{ name: 'k.Y', module: 'K', ports: [] }] }).nodes[0].dynamicPorts
    ).toBeNull();
  });

  it('splits an input/output group member onto both plugs', () => {
    const both = [{ condition: 'on = true', ports: [{ name: 'value', plug: 'input/output' }] }];
    expect(catalogNodesFromNodeLibrary(synth(both)).nodes[0].dynamicPorts.declaredPortGroups).toEqual([
      { condition: 'on = true', inputs: ['value'], outputs: ['value'] }
    ]);
  });
});
