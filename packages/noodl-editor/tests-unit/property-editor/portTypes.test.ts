/**
 * FH-020 slice 4 — "what can this port connect to".
 *
 * ## Why this suite exists
 *
 * The annotation is a claim the editor makes to an author who is *not* dragging
 * a wire, so nothing else will contradict it on the spot. There are two ways it
 * can lie, and one of them is the reason the module exists at all:
 *
 * 1. **The cast table allows `signal -> boolean` and `signal -> number`.** It
 *    genuinely does (`nodelibraryexport.ts:224-226`). The connection popup then
 *    refuses those wires with a second rule of its own
 *    (`ConnectionBar.tsx:144-152`). A tab that read only the table would tell an
 *    author that `Done` can drive a Number input — the exact class of wrong
 *    answer this tab was built to stop.
 * 2. **Casting is directional.** `string -> number` is allowed and
 *    `number -> string` is a different question with a different answer, so an
 *    input and an output of the same type do not get the same line.
 *
 * The table below is the real one, copied from `nodelibraryexport.ts:207-275`,
 * so the assertions are about the rules and not about a toy.
 */

import {
  canCastPortType,
  connectablePortTypes,
  portTypeUniverse,
  TypecastRule
} from '../../src/editor/src/views/panels/propertyeditor/portTypes';

/** Verbatim from `nodelibraryexport.ts` — the table the editor actually ships. */
const TYPECASTS: TypecastRule[] = [
  { from: 'string', to: ['number', 'boolean', 'image', 'color', 'enum', 'textStyle', 'dimension', 'array', 'object'] },
  { from: 'boolean', to: ['number', 'string', 'signal'] },
  { from: 'number', to: ['boolean', 'string', 'dimension'] },
  { from: 'date', to: ['string'] },
  { from: 'signal', to: ['boolean', 'number'] },
  { from: 'image', to: [] },
  { from: 'cloudfile', to: ['string', 'image'] },
  { from: 'color', to: ['string'] },
  { from: 'enum', to: [] },
  { from: 'object', to: ['string'] },
  { from: 'domelement', to: [] },
  { from: 'reference', to: [] },
  { from: 'font', to: [] },
  { from: 'textStyle', to: ['string'] },
  { from: 'collection', to: ['array'] },
  { from: 'array', to: ['collection', 'string'] }
];

describe('canCastPortType', () => {
  it('matches the wildcard in both directions', () => {
    expect(canCastPortType(TYPECASTS, '*', 'number')).toBe(true);
    expect(canCastPortType(TYPECASTS, 'number', '*')).toBe(true);
  });

  it('allows a type to itself even when the table never names it', () => {
    expect(canCastPortType(TYPECASTS, 'somemoduletype', 'somemoduletype')).toBe(true);
    expect(canCastPortType(TYPECASTS, 'somemoduletype', 'string')).toBe(false);
  });

  it('is directional', () => {
    expect(canCastPortType(TYPECASTS, 'object', 'string')).toBe(true);
    expect(canCastPortType(TYPECASTS, 'string', 'object')).toBe(true);
    expect(canCastPortType(TYPECASTS, 'date', 'string')).toBe(true);
    expect(canCastPortType(TYPECASTS, 'string', 'date')).toBe(false);
  });
});

describe('portTypeUniverse', () => {
  it('collects both columns and never the wildcard', () => {
    const universe = portTypeUniverse(TYPECASTS);

    // `signal` is only reachable as a target of `boolean`; it is also a `from`.
    expect(universe).toContain('signal');
    // `dimension` is only ever a target — it has no row of its own.
    expect(universe).toContain('dimension');
    expect(universe).not.toContain('*');
  });
});

describe('connectablePortTypes', () => {
  it('says nothing bounded for a wildcard port', () => {
    expect(connectablePortTypes(TYPECASTS, '*', 'input')).toBeUndefined();
    expect(connectablePortTypes(TYPECASTS, '*', 'output')).toBeUndefined();
  });

  it('refuses to send a signal anywhere but a signal, whatever the cast table says', () => {
    // The table allows both of these. The connection popup does not.
    expect(canCastPortType(TYPECASTS, 'signal', 'boolean')).toBe(true);
    expect(canCastPortType(TYPECASTS, 'signal', 'number')).toBe(true);

    expect(connectablePortTypes(TYPECASTS, 'signal', 'output')).toEqual(['signal']);
  });

  it('never offers a signal as something that could drive a value input', () => {
    expect(connectablePortTypes(TYPECASTS, 'number', 'input')).not.toContain('signal');
    expect(connectablePortTypes(TYPECASTS, 'boolean', 'input')).not.toContain('signal');
  });

  it('knows a boolean output can pulse a signal input', () => {
    // Not symmetry with the rule above: the block is on signal *sources* only.
    expect(connectablePortTypes(TYPECASTS, 'signal', 'input')).toEqual(['signal', 'boolean']);
    expect(connectablePortTypes(TYPECASTS, 'boolean', 'output')).toContain('signal');
  });

  it('answers the input and the output question differently for one type', () => {
    expect(connectablePortTypes(TYPECASTS, 'number', 'input')).toEqual(['number', 'boolean', 'string']);
    expect(connectablePortTypes(TYPECASTS, 'number', 'output')).toEqual(['number', 'boolean', 'dimension', 'string']);
  });

  it('puts the port own type first and the rest alphabetically', () => {
    expect(connectablePortTypes(TYPECASTS, 'string', 'output')).toEqual([
      'string',
      'array',
      'boolean',
      'color',
      'dimension',
      'enum',
      'image',
      'number',
      'object',
      'textStyle'
    ]);
  });

  it('leaves a type the table never mentions connectable to itself', () => {
    expect(connectablePortTypes(TYPECASTS, 'somemoduletype', 'input')).toEqual(['somemoduletype']);
  });

  it('says nothing at all when there is no type', () => {
    expect(connectablePortTypes(TYPECASTS, undefined, 'input')).toBeUndefined();
  });
});
