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
import { conditionForInput, conditionIsUnsatisfied } from '../../src/editor/src/validation/portConditions';

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
