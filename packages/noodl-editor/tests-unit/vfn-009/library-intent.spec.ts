/**
 * VFN-009 — every sentence the saved-blocks library says, and the boundary it may not cross.
 *
 * 🔴 The task's ruling: the warning **may** claim where a definition is used, that its shape
 * changed, and that its parameters changed — because each of those is a fact it can compute or a
 * refusal that is already written. It **may not** claim that a flow is broken: nothing in this
 * system knows what a program is *for*, and a warning that guesses at behavioural breakage will be
 * believed. Being believed wrongly is worse than being silent.
 *
 * `UNPROVABLE_CLAIM` is that boundary as a machine can check it, and the whole point of the last
 * `describe` is that **a detector which only ever sees compliant input proves nothing** — so it is
 * run over a hand-written sentence that does cross the line, and has to convict it.
 *
 * ⚠️ A note for whoever reads a failure here: this file deliberately contains the forbidden
 * vocabulary, in the control. A spec can contain the sentence it forbids; what matters is which
 * side of the assertion it is on.
 */

import {
  MY_BLOCKS_GLYPH,
  SHELF_LABEL,
  SHELF_NOTE,
  UNPROVABLE_CLAIM,
  describeDeleteRefusal,
  describeDetachOffer,
  describeDetachResult,
  describeParameterChange,
  describePropagation,
  describeRegeneration,
  describeShapeChange,
  describeUsage,
  describeUsageShort,
  siteLine,
  unprovableClaimIn,
  usageLines
} from '../../src/editor/src/views/BlocklyEditor/myblocks/libraryIntent';
import { definitionChangeFor, signatureOf } from '../../src/editor/src/views/BlocklyEditor/myblocks/definitionChange';
import type { DefinitionUsage } from '../../src/editor/src/views/BlocklyEditor/myblocks/usage';
import { arithmetic, getInput, number, sendSignal, workspace } from '../lgc-007/fixtures';

function site(nodeId: string, nodeName: string, componentPath?: string) {
  return { nodeId, nodeName, componentId: nodeId + '-c', componentName: (componentPath ?? '').split('/').pop() ?? '', componentPath };
}

function usage(overrides: Partial<DefinitionUsage> = {}): DefinitionUsage {
  const nodes = overrides.nodes ?? [];
  const definitions = overrides.definitions ?? [];
  return {
    definitionId: 'd1',
    nodes,
    definitions,
    componentCount: overrides.componentCount ?? new Set(nodes.map((n) => n.componentId)).size,
    total: overrides.total ?? nodes.length + definitions.length,
    ...overrides
  } as DefinitionUsage;
}

const FIVE_PLACES = usage({
  nodes: [
    site('n1', 'Order total', '/Pages/Checkout'),
    site('n2', 'Shipping', '/Pages/Checkout'),
    site('n3', 'Basket line', '/Pages/Cart'),
    site('n4', 'Receipt', '/Pages/Receipt')
  ],
  definitions: [{ id: 'd2', name: 'Tax' }],
  componentCount: 3,
  total: 5
});

/** Every sentence the module can produce, over a spread of inputs. Used by the boundary check. */
function everySentence(): string[] {
  const none = usage();
  const one = usage({ nodes: [site('n1', 'Order total', '/Pages/Checkout')], componentCount: 1, total: 1 });

  const valueBody = workspace(arithmetic('MULTIPLY', getInput('price'), number(0.9)));
  const statementBody = workspace(sendSignal('done'));
  const toStatement = definitionChangeFor(signatureOf(valueBody), statementBody);
  const toValue = definitionChangeFor(signatureOf(statementBody), valueBody);
  const paramsGone = definitionChangeFor(signatureOf(workspace(arithmetic('ADD'))), valueBody);
  const paramsAdded = definitionChangeFor(signatureOf(valueBody), workspace(arithmetic('ADD')));

  return [
    ...Object.values(SHELF_LABEL),
    ...Object.values(SHELF_NOTE),
    ...usageLines(FIVE_PLACES),
    siteLine(site('n1', 'Order total', '/Pages/Checkout')),
    siteLine({ nodeId: 'n9', nodeName: 'Unnamed', componentName: '' }),
    describeUsageShort(none),
    describeUsageShort(one),
    describeUsageShort(FIVE_PLACES),
    describeUsage('Discount', none),
    describeUsage('Discount', one),
    describeUsage('Discount', FIVE_PLACES),
    describePropagation('Discount', none),
    describePropagation('Discount', FIVE_PLACES),
    describeRegeneration(none),
    describeRegeneration(FIVE_PLACES),
    describeShapeChange('Discount', toStatement, none),
    describeShapeChange('Discount', toStatement, one),
    describeShapeChange('Discount', toStatement, FIVE_PLACES),
    describeShapeChange('Discount', toValue, FIVE_PLACES),
    describeParameterChange('Discount', paramsGone),
    describeParameterChange('Discount', paramsAdded),
    describeDeleteRefusal('Discount', one),
    describeDeleteRefusal('Discount', FIVE_PLACES),
    describeDetachOffer('Discount', FIVE_PLACES),
    describeDetachResult('Discount', 0),
    describeDetachResult('Discount', 1),
    describeDetachResult('Discount', 4)
  ].filter((sentence) => sentence !== '');
}

describe('VFN-009 — naming the places, rather than counting them', () => {
  it('leads with the count and then breaks it out', () => {
    const sentence = describeUsage('Discount', FIVE_PLACES);
    expect(sentence).toContain('"Discount" is used in 5 places');
    expect(sentence).toContain('4 Visual Function nodes across 3 components');
    expect(sentence).toContain('1 other saved block');
  });

  it('names every place, component first', () => {
    const lines = usageLines(FIVE_PLACES);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('/Pages/Checkout · Order total');
    expect(lines[3]).toBe('/Pages/Receipt · Receipt');
    // A saved block that calls it is a place too, and it wears the call block's glyph.
    expect(lines[4]).toBe(`${MY_BLOCKS_GLYPH} Tax (saved block)`);
  });

  it('says "not used yet" in words rather than as a digit', () => {
    // Zero is the answer a builder most wants to be sure of before pressing Delete.
    expect(describeUsageShort(usage())).toBe('Not used yet');
    expect(describeUsage('Discount', usage())).toContain('is not used anywhere in this project yet');
    expect(describePropagation('Discount', usage())).toContain('You can edit it freely');
  });

  it('gets its singulars right, because a warning that says "1 places" is not read carefully', () => {
    const one = usage({ nodes: [site('n1', 'Order total', '/Pages/Checkout')], componentCount: 1, total: 1 });
    expect(describeUsage('Discount', one)).toContain('used in 1 place —');
    expect(describeUsage('Discount', one)).toContain('1 Visual Function node');
    expect(describeUsage('Discount', one)).not.toContain('nodes');
    expect(describeUsageShort(one)).toBe('1 node');
  });

  it('does not say "across n components" when there is only one', () => {
    const two = usage({
      nodes: [site('n1', 'A', '/Pages/Checkout'), site('n2', 'B', '/Pages/Checkout')],
      componentCount: 1,
      total: 2
    });
    expect(describeUsage('Discount', two)).not.toContain('across');
    expect(describeUsageShort(two)).toBe('2 nodes');
  });

  it('says out loud that nothing here regenerates a node', () => {
    // 🔴 Criterion 3. Editing a definition changes what every call site *will* generate without
    // changing a byte of what any of them has already generated (LGC-007 §6). A section that
    // implied otherwise would send a builder away believing their app had already changed.
    expect(describeRegeneration(FIVE_PLACES)).toContain('the next time its own blocks are edited');
    expect(describeRegeneration(FIVE_PLACES)).toContain('nothing here rewrites their generated code');
    // …and says nothing at all when no node is involved, rather than a sentence about none.
    expect(describeRegeneration(usage())).toBe('');
  });
});

describe('VFN-009 — the shape change reports a refusal that is already written', () => {
  const valueBody = workspace(arithmetic('MULTIPLY', getInput('price'), number(0.9)));
  const statementBody = workspace(sendSignal('done'));

  it('names both shapes and the number of call sites that will stop generating', () => {
    const change = definitionChangeFor(signatureOf(valueBody), statementBody);
    expect(change.shapeChanged).toBe(true);
    expect(change.shapeBefore).toBe('value');
    expect(change.shapeAfter).toBe('statement');

    const sentence = describeShapeChange('Discount', change, FIVE_PLACES);
    expect(sentence).toContain('becoming a statement block');
    expect(sentence).toContain('was a value block');
    expect(sentence).toContain('5 call sites will stop generating');
  });

  it('🔴 NEGATIVE CONTROL — an edit that keeps the shape says nothing', () => {
    // Without this the assertion above passes against a function that returns the same warning for
    // every edit, which is the "cried wolf" failure the parameter comparison also guards.
    const change = definitionChangeFor(signatureOf(valueBody), workspace(arithmetic('ADD', getInput('price'), number(1))));
    expect(change.shapeChanged).toBe(false);
    expect(describeShapeChange('Discount', change, FIVE_PLACES)).toBe('');
  });

  it('🔴 matches parameters by NAME, so an unchanged signature reports no change', () => {
    // `inferSignature` mints a fresh `id` for every parameter on every call, so an id comparison
    // would report every parameter as both added and removed on every save — a warning nobody
    // would read twice. Measured here rather than trusted.
    const holes = workspace(arithmetic('ADD'));
    const change = definitionChangeFor(signatureOf(holes), holes);
    expect(change.added).toEqual([]);
    expect(change.removed).toEqual([]);
    expect(change.changed).toBe(false);
    expect(describeParameterChange('Discount', change)).toBe('');

    // …and the ids really do differ between the two calls, which is what makes that a real risk.
    expect(signatureOf(holes).params[0].id).not.toBe(signatureOf(holes).params[0].id);
  });

  it('names the sockets that appear and disappear', () => {
    const filled = workspace(arithmetic('MULTIPLY', getInput('price'), number(0.9)));
    const holes = workspace(arithmetic('ADD'));

    const gained = definitionChangeFor(signatureOf(filled), holes);
    expect(gained.added).toEqual(['a', 'b']);
    expect(describeParameterChange('Discount', gained)).toContain('2 new sockets (a, b)');
    expect(describeParameterChange('Discount', gained)).toContain('empty');

    const lost = definitionChangeFor(signatureOf(holes), filled);
    expect(lost.removed).toEqual(['a', 'b']);
    expect(describeParameterChange('Discount', lost)).toContain('nowhere to go');
  });

  it('a create — nothing before it — reports no change at all', () => {
    const change = definitionChangeFor(undefined, workspace(arithmetic('ADD')));
    expect(change.changed).toBe(false);
    expect(describeShapeChange('New', change, usage())).toBe('');
    expect(describeParameterChange('New', change)).toBe('');
  });
});

describe('VFN-009 — the delete refusal and the way through it', () => {
  it('refuses by naming the places, and offers the alternative that already exists', () => {
    expect(describeDeleteRefusal('Discount', FIVE_PLACES)).toContain('still used in 5 places');
    expect(describeDeleteRefusal('Discount', FIVE_PLACES)).toContain('pointing at nothing');
    expect(describeDetachOffer('Discount', FIVE_PLACES)).toContain('replaced by a copy of its blocks');
    expect(describeDetachOffer('Discount', FIVE_PLACES)).toContain('generate exactly what they generate now');
  });

  it('reports what the detach did rather than assuming it', () => {
    expect(describeDetachResult('Discount', 0)).toContain('Nothing was using it');
    expect(describeDetachResult('Discount', 1)).toContain('1 program');
    expect(describeDetachResult('Discount', 4)).toContain('4 programs');
  });
});

describe('🔴 VFN-009 — the boundary: what this warning may not claim', () => {
  it('no sentence in the module claims a program stops doing what it did', () => {
    const offenders = everySentence()
      .map((sentence) => ({ sentence, claim: unprovableClaimIn(sentence) }))
      .filter((entry) => entry.claim !== null);

    expect(offenders).toEqual([]);
  });

  it('🔴 NEGATIVE CONTROL — the same detector convicts a sentence that does claim it', () => {
    // A detector that only ever sees compliant input is indistinguishable from one that returns
    // `null` unconditionally. These are the sentences this feature is *tempted* to write, and each
    // one is caught by the instrument the assertion above relies on.
    const tempting = [
      '"Discount" is used in 5 places, and editing it will break 3 of your flows.',
      'Changing this block may stop working in the pages that use it.',
      'These programs will no longer work correctly after this edit.',
      'This change alters the behaviour of 4 nodes.',
      'Editing this is likely to introduce a bug at 3 call sites.'
    ];

    for (const sentence of tempting) {
      expect(unprovableClaimIn(sentence)).not.toBeNull();
    }

    // And it is not simply convicting everything: the three claims the ruling *permits* pass.
    expect(unprovableClaimIn('"Discount" is used in 5 places — 4 Visual Function nodes across 3 components.')).toBeNull();
    expect(unprovableClaimIn('3 call sites will stop generating until you replace the block at each of them.')).toBeNull();
    expect(unprovableClaimIn('2 new sockets (a, b) appear on every call block, empty.')).toBeNull();
  });

  it('the detector is a regular expression with no `g` flag, so it cannot skip every other call', () => {
    // ⚠️ A `g`-flagged regex carries `lastIndex` between `exec` calls, so the same instrument would
    // return `null` for every second offender — a boundary check that quietly halves itself.
    expect(UNPROVABLE_CLAIM.global).toBe(false);
    expect(unprovableClaimIn('this will break')).not.toBeNull();
    expect(unprovableClaimIn('this will break')).not.toBeNull();
  });

  it('both shelves are named, and each says what it means', () => {
    expect(SHELF_LABEL.project).toBe('This project');
    expect(SHELF_LABEL.user).toBe('My backpack');
    expect(SHELF_NOTE.project).toContain('travels with it');
    expect(SHELF_NOTE.user).toContain('follows you between projects');
  });
});
