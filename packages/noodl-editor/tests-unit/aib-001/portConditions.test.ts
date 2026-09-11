/**
 * The conditional-port rule, and the drift it is allowed to have.
 *
 * `validation/portConditions.ts` is a second evaluator of the `dynamicports`
 * condition language — the canonical one lives in
 * `models/nodelibrary/dynamicPortRules.ts` and cannot be imported here without
 * dragging the renderer into the MCP server and the CLI (see that module's
 * header). Two evaluators of one language is a standing risk, so both halves of
 * the contract are asserted against the **shipped catalog's own condition
 * strings**, not against hand-written ones:
 *
 *  1. where the canonical evaluator says a port is visible, this one must never
 *     claim the port is off — a false positive is the failure that costs a user
 *     a repair round for nothing;
 *  2. where a condition is of a form this module declines to judge, it abstains
 *     rather than guesses.
 */

import shippedCatalog from '../../../noodl-types/src/node-catalog.json';
import { evaluateDynamicPortsCondition } from '../../src/editor/src/models/nodelibrary/dynamicPortRules';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import {
  conditionForInput,
  conditionIsUnsatisfied,
  resolveAgainstDefaults
} from '../../src/editor/src/validation/portConditions';

const catalog = loadDefaultCatalog();

/** Every distinct condition string the shipped catalog actually carries. */
function catalogConditions(): string[] {
  const seen = new Set<string>();
  for (const node of shippedCatalog.nodes) {
    for (const group of node.dynamicPorts?.declaredPortGroups ?? []) {
      if (group.condition) seen.add(group.condition);
    }
  }
  return [...seen].sort();
}

/** The canonical evaluator wants a node-like with `getParameter`. */
function asNode(parameters: Record<string, unknown>) {
  return { parameters, getParameter: (name: string) => parameters[name] };
}

/** Parameter bags to probe a condition with: every value it names, plus absent. */
function probesFor(condition: string): Record<string, unknown>[] {
  const bags: Record<string, unknown>[] = [{}];
  const clause = /([\w.'-]+)\s*(?:=|!=)\s*'?([\w-]+)'?/g;
  for (const [, name, value] of condition.matchAll(clause)) {
    const key = name.replace(/'/g, '');
    bags.push({ [key]: value }, { [key]: 'something-else' });
  }
  return bags;
}

describe('the two evaluators of one condition language', () => {
  const conditions = catalogConditions();

  it('has a corpus of conditions to speak about at all', () => {
    expect(conditions.length).toBeGreaterThan(40);
    expect(conditions).toContain('sizeMode = explicit');
  });

  it('never calls a port off that the canonical evaluator would show', () => {
    const disagreements: string[] = [];
    for (const condition of conditions) {
      for (const bag of probesFor(condition)) {
        const visible = evaluateDynamicPortsCondition(condition, asNode(bag));
        if (visible && conditionIsUnsatisfied(condition, bag)) {
          disagreements.push(`${condition}  with  ${JSON.stringify(bag)}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('abstains on the forms it cannot answer, rather than guessing', () => {
    // Both appear in the shipped catalog.
    expect(conditionIsUnsatisfied('#js params.anything === 3', {})).toBe(false);
    expect(conditionIsUnsatisfied("'{{portname}}.startMode' = explicit", {})).toBe(false);
    expect(conditionIsUnsatisfied('someParam IS WEIRD', {})).toBe(false);
  });
});

/**
 * DEF-006 — the same contract, against a canonical evaluator that has its
 * defaults.
 *
 * 🔴 **The suite above could not have caught the divergence this describes, and
 * the reason is worth keeping.** Its `asNode` stand-in is
 * `getParameter: (name) => parameters[name]` — a bag lookup. The real
 * `NodeGraphNode.getParameter` ends `return port ? port.default : undefined`,
 * so it answers with the port's catalog default wherever nothing is authored.
 * Modelling it as a bag lookup deleted the one behaviour the two evaluators
 * differed on, and the gate then reported agreement for as long as it ran. A
 * gate cannot find what its own model deletes.
 *
 * What it hid was live: `iconIconSource` is declared
 * `useIcon = true AND iconSourceType = icon`, `iconSourceType` defaults to
 * `icon`, and `ui-slide-over`'s close button sets `useIcon: true` and leaves the
 * rest — so the validator reported two parameters as never read on a button
 * whose icon renders. A false positive is the failure this contract names as the
 * expensive one, and it was the failure present.
 *
 * So this arm is **type-aware**: it walks every declared port group of every
 * shipped node type, and gives both evaluators that type's defaults.
 */
describe('the two evaluators, with the defaults the runtime actually reads', () => {
  /** Every (type, condition) pair the catalog carries, with the type's defaults. */
  function typedConditions(): Array<{ type: string; condition: string; defaults: Record<string, unknown> }> {
    const out = [];
    for (const node of shippedCatalog.nodes) {
      const defaults: Record<string, unknown> = {};
      for (const port of node.inputs ?? []) {
        if ((port as { default?: unknown }).default !== undefined) defaults[port.name] = (port as { default?: unknown }).default;
      }
      for (const group of node.dynamicPorts?.declaredPortGroups ?? []) {
        if (group.condition) out.push({ type: node.typeName, condition: group.condition, defaults });
      }
    }
    return out;
  }

  /** The canonical evaluator's own fallback: authored, then the port default. */
  function asRuntimeNode(parameters: Record<string, unknown>, defaults: Record<string, unknown>) {
    return {
      parameters,
      getParameter: (name: string) => (parameters[name] !== undefined ? parameters[name] : defaults[name])
    };
  }

  const typed = typedConditions();

  it('has a corpus of typed conditions, and defaults inside it', () => {
    expect(typed.length).toBeGreaterThan(100);
    expect(typed.some((t) => Object.keys(t.defaults).length > 0)).toBe(true);
  });

  it('never calls a port off that the canonical evaluator would show', () => {
    const disagreements: string[] = [];
    for (const { type, condition, defaults } of typed) {
      for (const bag of probesFor(condition)) {
        const resolved = resolveAgainstDefaults(bag, defaults);
        const visible = evaluateDynamicPortsCondition(condition, asRuntimeNode(bag, defaults));
        if (visible && conditionIsUnsatisfied(condition, resolved)) {
          disagreements.push(`${type}: ${condition}  with  ${JSON.stringify(bag)}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('fails when the defaults are dropped — the regression this arm exists for', () => {
    // The negative control. Answering the same corpus from the authored bag
    // alone is what the validator did before DEF-006, and it must be visibly
    // different from what it does now: an assertion that passes either way is
    // measuring nothing. `iconIconSource` on a button is among the pairs this
    // finds.
    const withoutDefaults: string[] = [];
    for (const { type, condition, defaults } of typed) {
      for (const bag of probesFor(condition)) {
        const visible = evaluateDynamicPortsCondition(condition, asRuntimeNode(bag, defaults));
        if (visible && conditionIsUnsatisfied(condition, bag)) withoutDefaults.push(`${type}: ${condition}`);
      }
    }
    expect(withoutDefaults.length).toBeGreaterThan(0);
  });

  it('keeps NOT SET meaning "no value at all", defaults included', () => {
    // The merge could have broken this and the corpus would not have said so:
    // `Group.width` is declared `sizeMode = explicit OR … OR sizeMode NOT SET`
    // and `sizeMode` defaults to `explicit`, so the FIRST clause carries it
    // either way. A port whose gate has no default is where NOT SET does the
    // work, and it must still answer true there.
    const groupWidth = conditionForInput(catalog.declaredPortGroups('Group'), 'width');
    expect(groupWidth).toContain('NOT SET');
    expect(conditionIsUnsatisfied(groupWidth, resolveAgainstDefaults({}, catalog.inputDefaults('Group')))).toBe(false);

    // No default for the gate: NOT SET is the only satisfied clause, and it is.
    expect(conditionIsUnsatisfied('gate = on OR gate NOT SET', resolveAgainstDefaults({}, {}))).toBe(false);
    // And a gate that IS authored to something else still switches the port off.
    expect(conditionIsUnsatisfied('gate = on OR gate NOT SET', resolveAgainstDefaults({ gate: 'off' }, {}))).toBe(true);
  });

  it('still calls borderWidth off under an explicit borderStyle: none', () => {
    // The true positive DEF-006 (a) is about. Resolving defaults must not have
    // widened into "assume every gate is satisfied": this one is authored off.
    const condition = conditionForInput(catalog.declaredPortGroups('net.noodl.controls.button'), 'borderWidth');
    const resolved = resolveAgainstDefaults(
      { borderStyle: 'none', borderWidth: { value: 0, unit: 'px' } },
      catalog.inputDefaults('net.noodl.controls.button')
    );
    expect(conditionIsUnsatisfied(condition, resolved)).toBe(true);
  });

  it('calls a checkbox label off, because useLabel really does default to false', () => {
    // The other half of the corpus repair, and the reason it is a recipe fix
    // rather than a rule fix: `addLabelInputs` writes the ` OR useLabel NOT SET`
    // clause only when the default is `true`, which is `Button` and not
    // `Checkbox`. `logic-consent-gate` shipped four checkboxes carrying a label
    // and no `useLabel`, and rendered no words on any of them.
    const condition = conditionForInput(catalog.declaredPortGroups('net.noodl.controls.checkbox'), 'label');
    const defaults = catalog.inputDefaults('net.noodl.controls.checkbox');
    expect(conditionIsUnsatisfied(condition, resolveAgainstDefaults({ label: 'I agree' }, defaults))).toBe(true);
    expect(
      conditionIsUnsatisfied(condition, resolveAgainstDefaults({ useLabel: true, label: 'I agree' }, defaults))
    ).toBe(false);
  });

  it('calls a button icon source ON when only useIcon is set — the false positive itself', () => {
    // `iconSourceType` defaults to `icon`, so this button's icon renders. The
    // validator said it never would.
    const condition = conditionForInput(catalog.declaredPortGroups('net.noodl.controls.button'), 'iconIconSource');
    const defaults = catalog.inputDefaults('net.noodl.controls.button');
    const authored = { useIcon: true, iconIconSource: { class: 'lucide', code: 'icon-x' } };
    expect(conditionIsUnsatisfied(condition, authored)).toBe(true); // what it used to say
    expect(conditionIsUnsatisfied(condition, resolveAgainstDefaults(authored, defaults))).toBe(false); // the truth
  });
});

describe('the Image trap this rule exists for', () => {
  it('knows objectFit depends on sizeMode', () => {
    const groups = catalog.declaredPortGroups('Image');
    expect(conditionForInput(groups, 'objectFit')).toBe('sizeMode = explicit');
  });

  it('calls objectFit off when sizeMode is left to its contentSize default', () => {
    expect(conditionIsUnsatisfied('sizeMode = explicit', { objectFit: 'cover' })).toBe(true);
  });

  it('calls it on as soon as sizeMode says explicit', () => {
    expect(conditionIsUnsatisfied('sizeMode = explicit', { sizeMode: 'explicit' })).toBe(false);
  });

  it('leaves Text width alone, whose condition tolerates an unset sizeMode', () => {
    // `Text` defaults to `contentHeight`, so `addDimensions` grants its width
    // condition the ` OR sizeMode NOT SET` clause that `Image`'s never gets.
    const condition = conditionForInput(catalog.declaredPortGroups('Text'), 'width');
    expect(condition).toContain('NOT SET');
    expect(conditionIsUnsatisfied(condition, {})).toBe(false);
  });

  it('abstains on a port two groups both declare', () => {
    // The runtime shows such a port when *either* condition applies, so judging
    // it by one of them would be wrong. No type in the shipped catalog does this
    // today — asserted here so the rule stays safe if one ever starts.
    const groups = [
      { condition: 'a = 1', inputs: ['shared'] },
      { condition: 'b = 2', inputs: ['shared'] }
    ];
    expect(conditionForInput(groups, 'shared')).toBeUndefined();
  });

  it('says nothing about a port no group declares', () => {
    expect(conditionForInput(catalog.declaredPortGroups('Image'), 'src')).toBeUndefined();
  });
});
