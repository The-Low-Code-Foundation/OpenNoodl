/**
 * CN-004 — turn the checks back on: the consequences.
 *
 * ## 🔴 What this task turned out to be
 *
 * CN-004 is written as though the checks must be switched on. They were already
 * on when this session started: every skip site gates on `catalog.hasType()`,
 * and CN-003's overlay makes that true for a kit type, so `checkParameterValues`
 * took kit nodes on the normal path the moment the overlay landed. **Nothing had
 * ever asserted it**, which is a different problem and the one this file solves.
 *
 * ⚠️ That is exactly the shape the task's own trap warns about, so it is worth
 * being explicit about what would *not* have discriminated. All three of these
 * were already true before this file existed, and all three are also true of an
 * implementation that resolves the type and then checks nothing:
 *
 *  - `unknown-type-check-skipped` goes to zero for a kit project;
 *  - `unknown-node-type` stops warning;
 *  - "validation knows the type".
 *
 * The consequence that discriminates is the one written down before anything was
 * run: **a wrong parameter on a kit node is reported, with the same code and
 * severity a built-in node draws for the same mistake.** Every test here is
 * paired with its built-in control for that reason — a kit-only assertion cannot
 * tell "checked like everyone else" from "checked by some kit-specific path that
 * happens to fire".
 *
 * ## And the defect that was real
 *
 * Item 4 — the dynamic-port carve-out — was **not** kept, in both directions.
 * See `@nodegx/kit-catalog`'s `dynamicPorts.test.js` for the mapping and the
 * recorded payload that proves the shapes; what is graded here is what a user
 * would have seen: a warning on a correct kit, and a missing warning on a wrong
 * one.
 */

import { loadDefaultCatalog, setCatalogOverlay } from '../../src/editor/src/validation/catalog';
import { overlayFromNodeLibrary } from '../../src/editor/src/validation/kitOverlay';
import { checkParameterValues, type ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

/**
 * A kit node type in the shape `generateNodeLibrary` exports, carrying the port
 * types whose wire formats `parameterValues` actually enforces.
 *
 * Hand-written, and allowably so: this file grades *consequences of a mapped
 * overlay*, not the mapping. The mapping is graded in `@nodegx/kit-catalog`
 * against a payload a live register really emitted, which is where a
 * hand-written payload would have been the lie.
 */
const KIT_PAYLOAD = {
  nodetypes: [
    {
      name: 'demo.kit.Badge',
      displayNodeName: 'Demo Badge',
      module: 'Demo Kit',
      category: 'Visual',
      ports: [
        { name: 'label', type: { name: 'string' }, plug: 'input' },
        { name: 'progress', type: { name: 'number' }, plug: 'input' },
        { name: 'showProgress', type: { name: 'boolean' }, plug: 'input' },
        { name: 'background', type: { name: 'color' }, plug: 'input' },
        {
          name: 'align',
          type: { name: 'enum', enums: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }] },
          plug: 'input'
        },
        { name: 'width', type: { name: 'number', units: ['px', '%'], defaultUnit: 'px' }, plug: 'input' },
        { name: 'clicked', type: { name: 'signal' }, plug: 'output' }
      ]
    }
  ]
};

/** The two dynamic shapes, as `formatDynamicPorts` emits them. */
const DYN_PAYLOAD = {
  nodetypes: [
    {
      name: 'dynports.kit.Panel',
      displayNodeName: 'Dyn Panel',
      module: 'Dynports Kit',
      category: 'Visual',
      dynamicports: [
        {
          name: 'conditionalports/basic',
          condition: 'mode = list',
          ports: [{ name: 'itemCount', type: 'number', plug: 'input' }]
        }
      ],
      ports: [
        { name: 'mode', type: { name: 'string' }, plug: 'input' },
        { name: 'itemCount', type: { name: 'number' }, plug: 'input' }
      ]
    },
    {
      name: 'dynports.kit.Feed',
      displayNodeName: 'Dyn Feed',
      module: 'Dynports Kit',
      category: 'Visual',
      // The exporter keeps a channel port out of `ports`, so this node's real
      // `channelName` input exists nowhere the catalog can see it.
      dynamicports: [{ channelPort: { plug: 'input', name: 'channelName' }, name: 'channel' }],
      ports: [{ name: 'heading', type: { name: 'string' }, plug: 'input' }]
    }
  ]
};

function withOverlay(payload: unknown) {
  setCatalogOverlay(overlayFromNodeLibrary(payload as never).nodes);
}

function check(nodes: ParameterizedNode[]) {
  return checkParameterValues(nodes, loadDefaultCatalog(), { component: '/Pages/Home' });
}

/** Diagnostics as `[code, severity, port]`, which is the whole of what parity means here. */
function shape(nodes: ParameterizedNode[]) {
  return check(nodes).map((d) => [d.code, d.severity, d.location.port]);
}

afterEach(() => setCatalogOverlay([]));

describe('acceptance criterion 1 — a wrong parameter on a kit node draws the diagnostic a built-in draws', () => {
  it('reports a malformed value as an error, exactly as it does for a shipped type', () => {
    withOverlay(KIT_PAYLOAD);

    // The kit arm and the built-in arm make the *same* mistake — a non-numeric
    // value on a `number` port — so a difference in the output is a difference
    // in how the two provenances are treated, and nothing else.
    expect(shape([{ id: 'k', type: 'demo.kit.Badge', parameters: { progress: 'lots' } }])).toEqual([
      ['invalid-parameter-value', 'error', 'progress']
    ]);
    expect(shape([{ id: 'b', type: 'Text', parameters: { opacity: 'lots' } }])).toEqual([
      ['invalid-parameter-value', 'error', 'opacity']
    ]);
  });

  it('carries the same message and repair, not merely the same code', () => {
    withOverlay(KIT_PAYLOAD);
    const [found] = check([{ id: 'k', type: 'demo.kit.Badge', parameters: { showProgress: 'false' } }]);

    // The `"false"` trap: a string that is truthy, so the node reads the
    // opposite of what the author wrote. A kit author gets the same sentence and
    // the same suggestion a built-in author gets — P1 is that there is no
    // capability difference, and a worse diagnostic is a capability difference.
    expect(found.code).toBe('invalid-parameter-value');
    expect(found.severity).toBe('error');
    expect(found.message).toContain('the string "false" is truthy');
    expect(found.suggestion).toBe('false');
  });

  it('checks enums, units and colours on a kit port too', () => {
    withOverlay(KIT_PAYLOAD);
    expect(
      shape([
        {
          id: 'k',
          type: 'demo.kit.Badge',
          parameters: { align: 'centre', width: '12px', background: '#ff0000' }
        }
      ])
    ).toEqual([
      // In `Object.entries(parameters)` order, which is what the rule walks.
      ['invalid-parameter-value', 'error', 'align'], // not one of the declared options
      ['invalid-parameter-value', 'error', 'width'], // a units port takes the object form
      ['raw-color-literal', 'warning', 'background'] // D8 — a colour should be a token
    ]);
  });

  it('reports a parameter naming no port on a kit node', () => {
    withOverlay(KIT_PAYLOAD);
    expect(shape([{ id: 'k', type: 'demo.kit.Badge', parameters: { progres: 4 } }])).toEqual([
      ['unknown-parameter', 'warning', 'progres']
    ]);
  });

  // 🔴 The known-good arm. Two ways an instrument lies: a check that only ever
  // fires is not a check, and every assertion above would pass against a rule
  // that reported unconditionally.
  it('says nothing at all about a correct kit node', () => {
    withOverlay(KIT_PAYLOAD);
    expect(
      shape([
        {
          id: 'k',
          type: 'demo.kit.Badge',
          parameters: {
            label: 'Budget',
            progress: 42,
            showProgress: true,
            align: 'left',
            width: { value: 120, unit: 'px' },
            background: 'var(--color-primary)'
          }
        }
      ])
    ).toEqual([]);
  });

  // The control for the whole file: without the overlay none of this happens,
  // and the reason it does not is the state CN-002 named.
  it('and none of it happens without the overlay — the skip says so instead', () => {
    expect(shape([{ id: 'k', type: 'demo.kit.Badge', parameters: { progress: 'lots' } }])).toEqual([
      ['unknown-type-check-skipped', 'info', undefined]
    ]);
  });
});

describe('acceptance criterion 4 — no check announces that it was skipped', () => {
  it('emits no skip diagnostic for a kit node the overlay resolves', () => {
    withOverlay(KIT_PAYLOAD);
    const codes = check([
      { id: 'a', type: 'demo.kit.Badge', parameters: { progress: 'lots' } },
      { id: 'b', type: 'demo.kit.Badge', parameters: { label: 'fine' } }
    ]).map((d) => d.code);
    expect(codes).not.toContain('unknown-type-check-skipped');
  });

  it('still says so for a type no kit declares — the skip is not suppressed, it is earned', () => {
    withOverlay(KIT_PAYLOAD);
    // 🔴 The half that catches a "fix" that simply deleted the diagnostic.
    expect(shape([{ id: 'x', type: 'some.other.Thing', parameters: { anything: 1 } }])).toEqual([
      ['unknown-type-check-skipped', 'info', undefined]
    ]);
  });
});

describe('item 4 — the dynamic-port carve-out, in both directions', () => {
  it('does not accuse a kit node of a parameter its channel port really creates', () => {
    withOverlay(DYN_PAYLOAD);
    // 🔴 Before the mapping fix this was `[['unknown-parameter','warning','channelName']]`
    // — a warning on a correct kit, and unavoidable, because the exporter keeps
    // a channel port out of the static list on purpose. The population it cried
    // wolf at is kit authors.
    //
    // ✅ CN-010 / AC2 updated the expectation and **not** the guarantee. The
    // thing this test protects is that the kit is not accused; that is asserted
    // directly on the next line and is stronger than the empty array was. The
    // `info` is CN-010's: the check did not run, and a report that said nothing
    // at all could not be told apart from one that checked and approved.
    const found = shape([
      { id: 'f', type: 'dynports.kit.Feed', parameters: { heading: 'Live', channelName: 'ticks' } }
    ]);

    expect(found.map((row) => row[0])).not.toContain('unknown-parameter');
    expect(found).toEqual([['dynamic-port-skipped', 'info', undefined]]);
  });

  it('still checks the static ports of a runtime-dynamic kit node', () => {
    withOverlay(DYN_PAYLOAD);
    // ⚠️ The carve-out is not a licence to stop checking. SUB-006's reasoning
    // for `PageInputs.pathParams` applies verbatim: a dynamic node's static
    // ports are as static as anyone's.
    expect(shape([{ id: 'f', type: 'dynports.kit.Feed', parameters: { heading: 42 } }])).toEqual([
      ['invalid-parameter-value', 'warning', 'heading']
    ]);
  });

  it('reads a kit node’s port condition, so an inert parameter is reported', () => {
    withOverlay(DYN_PAYLOAD);
    // The opposite failure: before the fix the condition lived under `ports`
    // where `conditionForInput` does not look, so this was silent. `itemCount`
    // is set while `mode` is `grid`, so the runtime never reads it.
    expect(shape([{ id: 'p', type: 'dynports.kit.Panel', parameters: { mode: 'grid', itemCount: 4 } }])).toEqual([
      ['inactive-conditional-parameter', 'warning', 'itemCount']
    ]);
  });

  it('and says nothing when the same parameter is live', () => {
    withOverlay(DYN_PAYLOAD);
    expect(shape([{ id: 'p', type: 'dynports.kit.Panel', parameters: { mode: 'list', itemCount: 4 } }])).toEqual([]);
  });

  it('matches how a built-in with the same shape behaves', () => {
    // `Text`'s `width` is governed by `sizeMode` through the identical
    // mechanism. The kit node above must not be treated more leniently or more
    // harshly than this.
    expect(
      shape([{ id: 't', type: 'Text', parameters: { sizeMode: 'contentSize', width: { value: 100, unit: 'px' } } }])
    ).toEqual([['inert-dimension', 'warning', 'width']]);
  });
});

describe('a kit may not quietly redefine a built-in', () => {
  it('checks a shadowed type against the built-in’s ports, not the kit’s', () => {
    // CN-003 excludes a colliding type from the merge and reports it; this is
    // the consequence at the checking layer, which is where getting it wrong
    // would change what `Text` means for every project that installs the kit.
    setCatalogOverlay(
      overlayFromNodeLibrary({
        nodetypes: [
          {
            name: 'Text',
            module: 'Rogue Kit',
            category: 'Visual',
            ports: [{ name: 'onlyOnTheKitVersion', type: { name: 'string' }, plug: 'input' }]
          }
        ]
      } as never).nodes
    );

    expect(shape([{ id: 't', type: 'Text', parameters: { onlyOnTheKitVersion: 'x' } }])).toEqual([
      ['unknown-parameter', 'warning', 'onlyOnTheKitVersion']
    ]);
    // …and the built-in's own ports still resolve.
    expect(shape([{ id: 't', type: 'Text', parameters: { opacity: 0.5 } }])).toEqual([]);
  });
});
