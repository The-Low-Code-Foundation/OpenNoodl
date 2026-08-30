/**
 * DEF-025 (P78 D37) — the words beside a toggle control are a `Text` node, so
 * tapping them does nothing.
 *
 * The positive arm is the members-area account page reduced to its defect: a
 * row `Group` holding a `Checkbox` (no `useLabel`) and a `Text` carrying the
 * sentence. D37 measured that DOM — no `<label for>`, hit area 24×24 px — and
 * the template was worked around by moving the words onto the control's own
 * ports, which is exactly the repair this rule names.
 *
 * Every discriminating axis of the predicate has its own control arm, so a
 * mutant that drops one clause reddens the arm built for it and no other.
 *
 * @module noodl-editor/tests-unit/def-025/label-not-a-click-target
 */
import { labelNotAClickTarget } from '@noodl-models/../validation/rules/labelNotAClickTarget';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';
import { CatalogIndex } from '@noodl-models/../validation/CatalogIndex';
import { defaultCatalog } from '@noodl-models/../validation/catalog';
import type { NormComponent, NormNode } from '@noodl-models/../validation/model';
import type { RuleContext } from '@noodl-models/../validation/rules/types';

const CATALOG = new CatalogIndex(defaultCatalog());

interface NodeSpec {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: string[];
  parent?: string;
}

function node(spec: NodeSpec): NormNode {
  return {
    id: spec.id,
    type: spec.type,
    parameters: spec.parameters,
    parent: spec.parent,
    children: spec.children || [],
    instancePorts: []
  } as unknown as NormNode;
}

/** A row `Group` whose children are the given nodes, parents wired both ways. */
function row(children: NodeSpec[], connections: NormComponent['connections'] = []): NormComponent {
  const kids = children.map((c) => node({ ...c, parent: 'row' }));
  return {
    name: '/Pages/Account',
    nodes: [node({ id: 'row', type: 'Group', children: children.map((c) => c.id) }), ...kids],
    connections
  } as unknown as NormComponent;
}

function run(component: NormComponent) {
  const ctx = {
    project: { components: [component], componentRefs: new Set<string>() },
    catalog: CATALOG,
    options: {},
    components: [{ component, nodeById: new Map(component.nodes.map((n) => [n.id, n])) }],
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  } as unknown as RuleContext;
  return labelNotAClickTarget.run(ctx);
}

const CHECKBOX = 'net.noodl.controls.checkbox';
const RADIO = 'net.noodl.controls.radiobutton';

describe('DEF-025 — the D37 shape and its repair', () => {
  it('fires on a Checkbox with the sentence in a sibling Text (the account-page shape)', () => {
    const found = run(
      row([
        { id: 'cb', type: CHECKBOX },
        { id: 'words', type: 'Text', parameters: { text: 'Email me when something is published' } }
      ])
    );
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.LabelNotAClickTarget]);
    expect(found[0].location.nodeId).toBe('cb');
    expect(found[0].message).toContain('Email me when something is published');
    expect(found[0].message).toContain('useLabel');
  });

  it('accepts the workaround the template shipped: the words on the control itself', () => {
    // The repaired account page authors useLabel + label and has no Text at all…
    expect(run(row([{ id: 'cb', type: CHECKBOX, parameters: { useLabel: true, label: 'Email me' } }]))).toEqual([]);
    // …and a control that owns its label makes an adjacent Text something else.
    expect(
      run(
        row([
          { id: 'cb', type: CHECKBOX, parameters: { useLabel: true, label: 'Email me' } },
          { id: 'other', type: 'Text', parameters: { text: 'You can change this later' } }
        ])
      )
    ).toEqual([]);
  });

  it('fires whichever side the words are on', () => {
    const found = run(
      row([
        { id: 'words', type: 'Text', parameters: { text: 'Remember me' } },
        { id: 'cb', type: CHECKBOX }
      ])
    );
    expect(found).toHaveLength(1);
    expect(found[0].location.nodeId).toBe('cb');
  });

  it('fires on a Radio Button the same way', () => {
    const found = run(
      row([
        { id: 'rb', type: RADIO, parameters: { value: 'weekly' } },
        { id: 'words', type: 'Text', parameters: { text: 'Weekly digest' } }
      ])
    );
    expect(found).toHaveLength(1);
    expect(found[0].location.nodeType).toBe(RADIO);
  });
});

describe('DEF-025 — what the rule deliberately does not fire on', () => {
  it('a bare toggle with no sibling Text', () => {
    expect(run(row([{ id: 'cb', type: CHECKBOX }]))).toEqual([]);
  });

  it('a Text with no words — no authored text, nothing wired in', () => {
    expect(
      run(
        row([
          { id: 'cb', type: CHECKBOX },
          { id: 'empty', type: 'Text', parameters: { text: '   ' } }
        ])
      )
    ).toEqual([]);
  });

  it('…but a Text whose words arrive on a wire counts', () => {
    const found = run(
      row([{ id: 'cb', type: CHECKBOX }, { id: 'wired', type: 'Text' }], [
        { fromId: 'src', fromProperty: 'value', toId: 'wired', toProperty: 'text' }
      ])
    );
    expect(found).toHaveLength(1);
  });

  it('a Text away from the control is not its label — adjacency is the discriminator', () => {
    expect(
      run(
        row([
          { id: 'cb', type: CHECKBOX },
          { id: 'spacer', type: 'Group' },
          { id: 'far', type: 'Text', parameters: { text: 'Unrelated copy' } }
        ])
      )
    ).toEqual([]);
    // Two spacers, not one: the one-spacer arm alone can be passed by a rule
    // that scans every sibling, because the heading-dismissal probe happens to
    // land back on the control itself at that distance.
    expect(
      run(
        row([
          { id: 'cb', type: CHECKBOX },
          { id: 'spacerA', type: 'Group' },
          { id: 'spacerB', type: 'Group' },
          { id: 'far', type: 'Text', parameters: { text: 'Unrelated copy' } }
        ])
      )
    ).toEqual([]);
  });

  it('a Button beside a Text — its useLabel defaults ON, the words are already a target', () => {
    expect(
      run(
        row([
          { id: 'btn', type: 'net.noodl.controls.button', parameters: { label: 'Save' } },
          { id: 'note', type: 'Text', parameters: { text: 'Saves immediately' } }
        ])
      )
    ).toEqual([]);
  });

  it('a heading over a run of toggles is not the first box’s label', () => {
    // Group heading shape: Text, Checkbox, Checkbox — the words describe the
    // set. Neither box should claim them.
    expect(
      run(
        row([
          { id: 'heading', type: 'Text', parameters: { text: 'Interests' } },
          { id: 'cb1', type: CHECKBOX },
          { id: 'cb2', type: CHECKBOX }
        ])
      )
    ).toEqual([]);
  });

  it('…while each toggle in an alternating label list keeps its own', () => {
    const found = run(
      row([
        { id: 't1', type: 'Text', parameters: { text: 'Weekly digest' } },
        { id: 'cb1', type: CHECKBOX },
        { id: 't2', type: 'Text', parameters: { text: 'Product news' } },
        { id: 'cb2', type: CHECKBOX }
      ])
    );
    // cb1 sits between two Texts and fires once (one finding per control);
    // cb2 takes its own from t2.
    expect(found.map((d) => d.location.nodeId).sort()).toEqual(['cb1', 'cb2']);
  });

  it('reads the effective default from the catalog, not the authored bag alone', () => {
    // DEF-006's lesson, pinned for the day DEF-025's other half lands: if the
    // product ever flips the toggles' useLabel default to true (the 🧭 half of
    // this task), an unset port means the words ARE a target and this rule
    // must fall silent on its own — no second edit, no drift window.
    const flipped = JSON.parse(JSON.stringify(defaultCatalog()));
    const list = Array.isArray(flipped) ? flipped : flipped.nodes;
    const cb = list.find((n: { typeName?: string; name?: string }) => (n.typeName || n.name) === CHECKBOX);
    const port = cb.inputs.find((p: { name: string }) => p.name === 'useLabel');
    expect(port.default).toBe(false); // the premise this whole rule rests on, read from the artefact
    port.default = true;

    const component = row([
      { id: 'cb', type: CHECKBOX },
      { id: 'words', type: 'Text', parameters: { text: 'Remember me' } }
    ]);
    const ctx = {
      project: { components: [component], componentRefs: new Set<string>() },
      catalog: new CatalogIndex(flipped),
      options: {},
      components: [{ component, nodeById: new Map(component.nodes.map((n) => [n.id, n])) }],
      counters: { nodesChecked: 0, endpointsChecked: 0 }
    } as unknown as RuleContext;
    expect(labelNotAClickTarget.run(ctx)).toEqual([]);
  });

  it('an authored useLabel: false is the default state, not an exemption', () => {
    // Authoring the port to its default changes nothing about the rendered DOM,
    // so it cannot change the finding either.
    const found = run(
      row([
        { id: 'cb', type: CHECKBOX, parameters: { useLabel: false } },
        { id: 'words', type: 'Text', parameters: { text: 'Remember me' } }
      ])
    );
    expect(found).toHaveLength(1);
  });
});
