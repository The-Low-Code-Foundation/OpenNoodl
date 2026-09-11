/**
 * CN-010 / AC2 — the static/dynamic split, said out loud.
 *
 * ## What was silent, and how much of it there was
 *
 * `checkParameterValues` skips the unknown-parameter check for a node whose
 * ports are *runtime-determined*, and SUB-006's reasoning for that is sound: the
 * ports are real and the catalog cannot see them. What it did with the skip was
 * `continue` — nothing said, nothing counted, the result reported as a pass.
 *
 * Measured across the 29 projects in `NodeGX test projects` before this landed:
 *
 * | | |
 * |---|---|
 * | set parameters, all projects | 15,794 |
 * | reaching the silent skip | **947 (6.0%)** |
 * | nodes carrying them | **321** |
 * | components carrying at least one | 127 of 344 |
 * | per component | median 0, p90 **2**, max **17** |
 *
 * The last row is why this is emitted unconditionally rather than behind a flag.
 * The whole-project figure looks like noise; the authoring path validates **one
 * component**, and there the notice is a couple of lines. 🔴 The alternative —
 * gating it behind `emitDynamicPortInfo`, as the connection-side sibling does —
 * would have produced a diagnostic **no production caller can turn on**:
 * `checkParameterValues` has exactly one, `authoredPreconditionDiagnostics`,
 * which passes `{ component }` and nothing else, and the flag is read only by
 * `scripts/validate-project.ts` for the *other* pipeline.
 *
 * ## Not a new diagnostic
 *
 * `DiagnosticCode.DynamicPortSkipped` already existed and `nonexistentPort`
 * already emitted it for *connection* endpoints. So a connection to a
 * runtime-created port was reported as skipped while a **parameter** on the same
 * port of the same node was not — one of two sibling call sites had the notice.
 * This adds the second, and deliberately does not invent a second vocabulary.
 *
 * ⚠️ **The wording could not be borrowed from `unknownTypeSkip`**, which is the
 * near neighbour: that one says *"type X is not in the node catalog"*, and here
 * the type **is** in the catalog — for a kit node, because CN-003 put it there.
 * Reusing the sentence would tell a kit author their node is unrecognised at the
 * one moment it is not.
 */

import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { loadDefaultCatalog, setCatalogOverlay } from '../../src/editor/src/validation/catalog';
import { overlayFromNodeLibrary } from '../../src/editor/src/validation/kitOverlay';
import { checkParameterValues, type ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

/**
 * Two kit nodes covering the two halves of the split.
 *
 * `Feed` declares a **channel port** — genuinely runtime-named, and the exporter
 * deliberately keeps it out of the static `ports` list, so nothing but the
 * mechanism can vouch for it. `Panel` declares a **conditional group**, whose
 * every member is enumerable; it must keep being checked exactly as before.
 */
const DYN_PAYLOAD = {
  nodetypes: [
    {
      name: 'dynports.kit.Feed',
      displayNodeName: 'Dyn Feed',
      module: 'Dynports Kit',
      category: 'Visual',
      dynamicports: [{ channelPort: { plug: 'input', name: 'channelName' }, name: 'channel' }],
      ports: [
        { name: 'heading', type: { name: 'string' }, plug: 'input' },
        {
          name: 'density',
          type: { name: 'enum', enums: [{ label: 'Tight', value: 'tight' }, { label: 'Loose', value: 'loose' }] },
          plug: 'input'
        }
      ]
    },
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
    }
  ]
};

function withKits() {
  setCatalogOverlay(overlayFromNodeLibrary(DYN_PAYLOAD as never).nodes);
}

function check(nodes: ParameterizedNode[]) {
  return checkParameterValues(nodes, loadDefaultCatalog(), { component: '/Pages/Home' });
}

const skips = (nodes: ParameterizedNode[]) =>
  check(nodes).filter((d) => d.code === DiagnosticCode.DynamicPortSkipped);

afterEach(() => setCatalogOverlay([]));

describe('AC2 — a skipped parameter is reported as skipped', () => {
  it('names the parameter that could not be checked, on a built-in', () => {
    // `NavigationShowPopup` takes the target component's inputs as ports, which
    // is the single biggest source of the 947: 315 of them.
    const found = skips([
      { id: 'p', type: 'NavigationShowPopup', parameters: { target: '/Pages/Dialog', customerId: 'abc' } }
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('"customerId"');
    expect(found[0].location.nodeId).toBe('p');
  });

  it('and on a kit node, identically — P1 allows no capability difference', () => {
    withKits();

    const kit = skips([{ id: 'f', type: 'dynports.kit.Feed', parameters: { heading: 'Live', channelName: 'ticks' } }]);
    const builtin = skips([
      { id: 'p', type: 'NavigationShowPopup', parameters: { target: '/Pages/Dialog', channelName: 'ticks' } }
    ]);

    expect(kit).toHaveLength(1);
    expect([kit[0].code, kit[0].severity]).toEqual([builtin[0].code, builtin[0].severity]);
    expect(kit[0].message).toContain('"channelName"');
  });

  /**
   * One node, one notice — CN-002's rule. Four unverified parameters on a node
   * are one fact about that node, and the names are what makes it actionable, so
   * they travel in the message rather than in four locations.
   */
  it('emits one notice per node and names every parameter in it', () => {
    const found = skips([
      {
        id: 'p',
        type: 'NavigationShowPopup',
        parameters: { target: '/Pages/Dialog', customerId: 'abc', orderId: 7, mode: 'edit' }
      }
    ]);

    expect(found).toHaveLength(1);
    for (const name of ['customerId', 'orderId', 'mode']) {
      expect(found[0].message).toContain(`"${name}"`);
    }
  });

  it('says nothing at all when nothing was skipped', () => {
    withKits();

    expect(skips([{ id: 'f', type: 'dynports.kit.Feed', parameters: { heading: 'Live' } }])).toEqual([]);
    expect(skips([{ id: 'c', type: 'Condition', parameters: {} }])).toEqual([]);
  });

  /**
   * ⚠️ The wording trap, asserted rather than trusted.
   *
   * `unknownTypeSkip` is the neighbouring notice and its sentence is *"type X is
   * not in the node catalog"*. Here the type resolves — for `dynports.kit.Feed`
   * only because CN-003's overlay put it there — so that sentence would be false
   * and would read as "your kit is unrecognised".
   */
  it('does not claim the type is unknown, because it is not', () => {
    withKits();

    const catalog = loadDefaultCatalog();
    const m = skips([{ id: 'f', type: 'dynports.kit.Feed', parameters: { channelName: 'ticks' } }])[0].message;

    expect(m).not.toMatch(/not in the node catalog/i);
    // ⚠️ Asserted against `dynamicPortNote` rather than a keyword. A first draft
    // looked for `/runtime/i` and failed: the kit-side wording is "…not observed
    // by driving the node" and never uses the word. Matching the word I expected
    // rather than the string the code publishes would have graded my assumption.
    expect(m).toContain(catalog.dynamicPortNote('dynports.kit.Feed'));
    expect(m).toContain('unverified by that check rather than verified as correct');
  });
});

describe('AC2 — the other half of the split is untouched', () => {
  /**
   * 🔴 The control that discriminates, and the one that would catch this change
   * going too far.
   *
   * A `declared-port-groups` node is **not** runtime-dynamic: every member of its
   * groups is enumerable from the catalog, so a parameter naming no port on it is
   * a real `unknown-parameter` **warning**. CN-004 restored exactly this
   * distinction — the broad `isDynamicNode` test had been exempting all 88 types
   * that declare any dynamic ports, which is how 18 `fontWeight` parameters
   * validated clean while every word rendered at weight 400.
   *
   * If this task's notice were emitted on the broad test instead of the narrow
   * one, that warning would silently become an info and this fails.
   */
  it('an enumerable-group node still draws a warning, not a notice', () => {
    const found = check([{ id: 'g', type: 'Group', parameters: { padding: '16px' } }]);

    expect(found.map((d) => [d.code, d.severity])).toEqual([[DiagnosticCode.UnknownParameter, 'warning']]);
  });

  it('the same is true of a kit node whose dynamism is a conditional group', () => {
    withKits();

    const found = check([{ id: 'n', type: 'dynports.kit.Panel', parameters: { mode: 'list', nosuchport: 1 } }]);

    expect(found.map((d) => [d.code, d.severity])).toEqual([[DiagnosticCode.UnknownParameter, 'warning']]);
  });

  /**
   * The static half of a runtime-dynamic node is as static as anyone's — SUB-006's
   * rule, and the reason the notice is scoped to parameters that match no port
   * rather than to the whole node.
   */
  it('a wrong value on a statically declared port of a dynamic node is still reported', () => {
    withKits();

    const found = check([
      { id: 'f', type: 'dynports.kit.Feed', parameters: { density: 'nope', channelName: 'ticks' } }
    ]);

    expect(found.map((d) => d.code).sort()).toEqual(
      [DiagnosticCode.DynamicPortSkipped, DiagnosticCode.InvalidParameterValue].sort()
    );
    // The two statements are about different ports, and both survive.
    expect(found.find((d) => d.code === DiagnosticCode.InvalidParameterValue)!.location.port).toBe('density');
  });

  /**
   * A caller that asked for value problems only gets value problems.
   *
   * `reportUnknownParameters: false` is documented as "for callers that only want
   * value problems", and a notice about a port-name check is not one. No
   * production caller sets it — `authoredPreconditionDiagnostics` passes
   * `{ component }` — so this pins an intent rather than a behaviour in use.
   */
  it('honours reportUnknownParameters: false', () => {
    withKits();

    const found = checkParameterValues(
      [{ id: 'f', type: 'dynports.kit.Feed', parameters: { channelName: 'ticks' } }],
      loadDefaultCatalog(),
      { component: '/Pages/Home', reportUnknownParameters: false }
    );

    expect(found).toEqual([]);
  });
});
