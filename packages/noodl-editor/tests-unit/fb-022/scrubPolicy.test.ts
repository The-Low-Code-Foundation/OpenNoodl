/**
 * FB-022 AC4 — rows opt in by port type, and the set that opts in is the right one.
 *
 * ## The corpus is the shipped catalog, not a fixture
 *
 * The claim AC4 makes is about *which ports* get a draggable field, so a fixture of invented
 * port objects cannot make it: it would pass on the day the catalog gains a numeric port
 * shape nobody here thought of, which is the only day it matters. The ports below are built
 * by the same mixins every visual node calls, out of `node-shared-port-definitions.ts` —
 * `portWireShape.test.ts` established that this is reachable from a plain-Node runner and
 * this file reuses the technique.
 *
 * ## 🔴 The precedence pin, which is the real content of this file
 *
 * "Is this a number port" and "does this port render a number field" are different questions,
 * and the second is decided by an ordered `if/else if` chain in `Ports.viewClassForPort`. The
 * margin and padding ports are `{ name: 'number', units: ['px','%'] }` — indistinguishable
 * from Width to a naive check — and they are claimed four branches earlier by
 * `isOfMarginPaddingType`, landing in a widget that already has its own drag.
 *
 * So the prefix of that chain is **parsed out of the real file** and compared against the
 * literal in `scrubPolicy.ts`. A predicate inserted above the numeric branches fails this
 * suite rather than quietly starting to steal number ports from the policy. That is the
 * difference between having read the list once and being told when it changes.
 *
 * ⚠️ What this cannot see: that a scrub binding reaches an `<input>`, that the drag feels
 * right, or that the value lands in the project. Those are the other three spec files and the
 * drive.
 */
import * as fs from 'fs';
import * as path from 'path';

import SharedPorts from '../../../noodl-viewer-react/src/node-shared-port-definitions';
import {
  PREDICATES_AHEAD_OF_NUMERIC,
  isClaimedByAnEarlierRow,
  portTypeName,
  scrubSpecForPortType,
  scrubStartValue
} from '../../src/editor/src/views/panels/propertyeditor/DataTypes/scrubPolicy';

// `addDimensions` reads `Noodl.deployed` to decide whether to attach tooltips; `true` skips
// them, which is the cheaper half and changes no port's type. Same setup as portWireShape.
(globalThis as { Noodl?: unknown }).Noodl = { deployed: true };

const PORTS_TS = path.join(__dirname, '../../src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts');

interface CatalogPort {
  name: string;
  type: unknown;
  default?: unknown;
}

/** Every port the shared visual mixins declare, whichever of the three bags it lands in. */
const CATALOG: CatalogPort[] = (() => {
  const def: TSFixme = { name: 'spec', inputs: {}, inputProps: {}, inputCss: {}, outputs: {}, outputProps: {} };
  const mixins = SharedPorts as TSFixme;
  // Every mixin that declares ports, not a subset — a corpus that skipped `addBorderInputs`
  // and `addShadowInputs` would be missing most of the unit-bearing numbers in the catalog
  // (Border Width, the four shadow offsets, Font Size), which are exactly the rows a scrub is
  // for.
  mixins.addDimensions(def, { defaultSizeMode: 'explicit' });
  mixins.addMarginInputs(def);
  mixins.addPaddingInputs(def);
  mixins.addTransformInputs(def);
  mixins.addAlignInputs(def);
  mixins.addBorderInputs(def);
  mixins.addShadowInputs(def);
  mixins.addIconInputs(def);
  mixins.addLabelInputs(def);
  mixins.addTextStyleInputs(def);
  mixins.addSharedVisualInputs(def);

  const all: CatalogPort[] = [];
  for (const bag of [def.inputs, def.inputProps, def.inputCss]) {
    for (const name of Object.keys(bag || {})) {
      const port = bag[name];
      // `getEditType` — a port that declares `editAsType` is edited as that type.
      const type = port?.type?.editAsType ? port.type.editAsType : port?.type;
      all.push({ name, type, default: port?.default });
    }
  }
  return all;
})();

/** The ordered predicate names in `Ports.getTypeView`'s dispatch chain, from the real file. */
function dispatchPredicateOrder(): string[] {
  const source = fs.readFileSync(PORTS_TS, 'utf8');
  const matches = source.match(/(?:if|else if)\s*\((isOf\w+)\(\)\)\s*return\s+\w+;/g) || [];
  return matches.map((m) => /\((isOf\w+)\(\)\)/.exec(m)[1]);
}

describe('FB-022 AC4 — the corpus is real', () => {
  // A corpus that silently came out empty would make every sweep below pass on nothing.
  it('builds a plausible set of real ports with the landmarks in it', () => {
    // Measured 2026-08-26 from the mixins above: 73 ports, of which 39 are `number`, 2 are
    // `dimension` and 8 of the numbers carry `marginPaddingComp`. The floor is deliberately
    // well under 73 — this arm is here to catch a corpus that came out empty or nearly so,
    // not to pin a number that a new shared port would legitimately move.
    expect(CATALOG.length).toBeGreaterThan(60);
    const names = CATALOG.map((p) => p.name);
    expect(names).toContain('width');
    expect(names).toContain('marginLeft');
    expect(names).toContain('transformOriginX');
    expect(names).toContain('opacity');
  });
});

describe('FB-022 AC4 — the dispatch prefix is pinned, not remembered', () => {
  it('parses a plausible chain out of Ports.ts', () => {
    const order = dispatchPredicateOrder();
    expect(order.length).toBeGreaterThan(25);
    expect(order).toContain('isOfNumberWithUnitsType');
    expect(order).toContain('isOfDimensionType');
    expect(order).toContain('isOfBasicType');
  });

  // 🔴 THE ARM THAT MATTERS. If somebody inserts a predicate above the numeric branches, this
  // goes red — and it goes red *here*, beside the comment explaining why the policy has an
  // exclusion at all, rather than silently in the editor six months later.
  it('matches the pinned list of predicates that run before the numeric rows', () => {
    const order = dispatchPredicateOrder();
    const prefix = order.slice(0, order.indexOf('isOfNumberWithUnitsType'));
    expect(prefix).toEqual([...PREDICATES_AHEAD_OF_NUMERIC]);
  });

  // The three numeric branches must still be in the chain at all, and `isOfBasicType` must
  // still come after `isOfDimensionType` — otherwise a dimension port would render as a plain
  // number field and the policy's step-from-unit would be describing a row that is not there.
  it('keeps the three numeric branches in the order the policy assumes', () => {
    const order = dispatchPredicateOrder();
    expect(order.indexOf('isOfNumberWithUnitsType')).toBeLessThan(order.indexOf('isOfDimensionType'));
    expect(order.indexOf('isOfDimensionType')).toBeLessThan(order.indexOf('isOfBasicType'));
  });
});

describe('FB-022 AC4 — which of the real ports scrub', () => {
  const scrubbable = CATALOG.filter((p) => scrubSpecForPortType(p.type) !== null);
  const rejected = CATALOG.filter((p) => scrubSpecForPortType(p.type) === null);

  it('takes every number and dimension port that no earlier row claims', () => {
    const missed = CATALOG.filter((p) => {
      const name = portTypeName(p.type);
      return (name === 'number' || name === 'dimension') && !isClaimedByAnEarlierRow(p.type) && scrubSpecForPortType(p.type) === null;
    });
    expect(missed.map((p) => p.name)).toEqual([]);
  });

  it('takes nothing that is not a number or a dimension', () => {
    const wrong = scrubbable.filter((p) => {
      const name = portTypeName(p.type);
      return name !== 'number' && name !== 'dimension';
    });
    expect(wrong.map((p) => p.name)).toEqual([]);
  });

  // 🔴 The exclusion, on the real ports rather than in the abstract. All eight are `number`
  // ports with units and every one of them renders inside the margin/padding widget, which
  // has had its own drag since POL-012.
  it('excludes the eight margin and padding ports, which drag by a different mechanism', () => {
    const marginPadding = CATALOG.filter((p) => isClaimedByAnEarlierRow(p.type));
    expect(marginPadding.length).toBe(8);
    for (const port of marginPadding) {
      expect(portTypeName(port.type)).toBe('number');
      expect(scrubSpecForPortType(port.type)).toBeNull();
    }
  });

  it('takes the ports the task and its neighbours are about', () => {
    const byName = (n: string) => CATALOG.find((p) => p.name === n);
    // Width — the dimension row FB-018 was filed about, and the one Jordan was looking at.
    expect(scrubSpecForPortType(byName('width').type)).not.toBeNull();
    // FB-016's crosshair fields — the pair this task turns into a feedback loop.
    expect(scrubSpecForPortType(byName('transformOriginX').type)).not.toBeNull();
    expect(scrubSpecForPortType(byName('opacity').type)).not.toBeNull();
  });

  // 🔴 The control. Every "no" above is only worth something beside a demonstrable "yes" from
  // the same call over the same corpus — and beside a rejected set that is not everything.
  it('is a real split, not an empty one in either direction', () => {
    // 🔴 Both sides, and the sum. A sweep that answered "no" to everything would pass every
    // exclusion arm above it, and a sweep that answered "yes" to everything would pass every
    // inclusion arm. Measured on 2026-08-26: 33 scrub, 40 do not, of 73. The 41st rejection is
    // DEF-019's `fontVariantNumeric` (an enum offers nothing to drag-scrub).
    expect(scrubbable.length).toBe(33);
    expect(rejected.length).toBe(41);
    expect(scrubbable.length + rejected.length).toBe(CATALOG.length);
  });

  // The number/dimension ports, counted independently of the policy that classifies them, so
  // "33 scrub" is anchored to something other than the function under test.
  it('accounts for every number and dimension port as either scrubbed or margin/padding', () => {
    const numeric = CATALOG.filter((p) => ['number', 'dimension'].includes(portTypeName(p.type)));
    expect(numeric.length).toBe(41);
    expect(numeric.filter((p) => isClaimedByAnEarlierRow(p.type)).length).toBe(8);
    expect(numeric.filter((p) => scrubSpecForPortType(p.type) !== null).length).toBe(33);
  });
});

describe('FB-022 — the step a real port gets', () => {
  const typeOf = (n: string) => CATALOG.find((p) => p.name === n)?.type;

  it('is one per pixel for a px field and for a percentage field', () => {
    expect(scrubSpecForPortType(typeOf('width'), 'px').step).toBe(1);
    expect(scrubSpecForPortType(typeOf('width'), '%').step).toBe(1);
  });

  it('is a tenth for an em field', () => {
    expect(scrubSpecForPortType(typeOf('width'), 'em').step).toBe(0.1);
  });

  it('is one for a plain number port with no unit at all', () => {
    expect(scrubSpecForPortType(typeOf('opacity')).step).toBe(1);
  });

  // Nothing in the catalog declares `step` today, and saying so is the point: the branch
  // exists because the type is where a step belongs, and this is the only thing exercising it.
  it('prefers a step the port type declares, if one ever does', () => {
    expect(CATALOG.filter((p) => (p.type as { step?: unknown })?.step !== undefined).length).toBe(0);
    expect(scrubSpecForPortType({ name: 'number', step: 0.25 }, 'px').step).toBe(0.25);
    expect(scrubSpecForPortType({ name: 'number', step: 0 }, 'px').step).toBe(1);
    expect(scrubSpecForPortType({ name: 'number', step: -5 }, 'px').step).toBe(1);
  });
});

describe('FB-022 — where a gesture on a blank field starts', () => {
  // ⚠️ Not zero. An unset port is showing its default, and starting at 0 would snap the
  // element to nothing before the pointer had moved a pixel.
  it('falls back to the port default when nothing is stored', () => {
    expect(scrubStartValue(undefined, { value: 100, unit: '%' })).toBe(100);
    expect(scrubStartValue(undefined, 1)).toBe(1);
  });

  it('prefers the stored value over the default', () => {
    expect(scrubStartValue({ value: 42, unit: 'px' }, { value: 100, unit: '%' })).toBe(42);
    expect(scrubStartValue(7, 1)).toBe(7);
  });

  it('reads a stored zero as zero rather than falling through to the default', () => {
    expect(scrubStartValue(0, 1)).toBe(0);
    expect(scrubStartValue({ value: 0, unit: 'px' }, { value: 100, unit: '%' })).toBe(0);
  });

  it('is zero only when there is nothing to read anywhere', () => {
    expect(scrubStartValue(undefined, undefined)).toBe(0);
    expect(scrubStartValue('auto', 'auto')).toBe(0);
  });
});

/**
 * 🔴 The defect the first drive found, pinned against the catalog that caused it.
 *
 * `scrubStartValue` accepted `number` only. `transformOriginX` declares `default: '50'` — a
 * **string** — so a scrub on an untouched transform-origin field began at 0, and a 30-pixel
 * drag wrote 30 into a field that had been showing 50 all along. The panel stringifies whatever
 * it is given, so the display was right throughout; only the gesture could tell.
 *
 * These arms take the defaults from the real mixins, so "a string default" cannot quietly stop
 * being a case this handles.
 */
describe('FB-022 — port defaults are not all numbers, and the drive proved it', () => {
  const numericPorts = CATALOG.filter((p) => scrubSpecForPortType(p.type) !== null);
  const defaultsByType = (kind: string) =>
    numericPorts.filter((p) => (p.default === undefined ? 'undefined' : typeof p.default) === kind);

  // Measured 2026-08-25 on the shipped catalog. If these move, the reason matters more than
  // the number — a new string default is a new chance for exactly this bug.
  it('splits the real defaults 14 number / 5 string / 14 absent', () => {
    expect(numericPorts.length).toBe(33);
    expect(defaultsByType('number').length).toBe(14);
    expect(defaultsByType('string').length).toBe(5);
    expect(defaultsByType('undefined').length).toBe(14);
  });

  it('names the string-defaulted ports, because two of them are numbers in disguise', () => {
    const names = defaultsByType('string')
      .map((p) => p.name)
      .sort();
    expect(names).toEqual(['fontWeight', 'letterSpacing', 'lineHeight', 'transformOriginX', 'transformOriginY']);
  });

  // 🔴 THE ARM THAT WOULD HAVE CAUGHT IT. Before the fix this read 0.
  it('starts a drag on transformOriginX at 50, not 0', () => {
    const port = CATALOG.find((p) => p.name === 'transformOriginX');
    expect(typeof port.default).toBe('string');
    expect(scrubStartValue(undefined, port.default)).toBe(50);
  });

  // ⚠️ And the other direction, which is why this is not a blanket coercion: three of the five
  // strings are `'Auto'`, and there is no number in `'Auto'` to start a drag from.
  it('starts a drag on an Auto-defaulted port at 0, because Auto is not a number', () => {
    for (const name of ['fontWeight', 'letterSpacing', 'lineHeight']) {
      const port = CATALOG.find((p) => p.name === name);
      expect(port.default).toBe('Auto');
      expect(scrubStartValue(undefined, port.default)).toBe(0);
    }
  });

  it('reads a numeric string stored on the parameter itself, one level down', () => {
    expect(scrubStartValue({ value: '50', unit: '%' })).toBe(50);
    expect(scrubStartValue({ value: 'Auto', unit: '%' })).toBe(0);
    expect(scrubStartValue('  50  ')).toBe(50);
    expect(scrubStartValue('')).toBe(0);
  });

  // Every real port must produce a finite start value — a NaN here is written to project.json.
  it('produces a finite start value for every scrubbable port in the catalog', () => {
    const bad = numericPorts.filter((p) => !Number.isFinite(scrubStartValue(undefined, p.default)));
    expect(bad.map((p) => p.name)).toEqual([]);
  });
});


/**
 * The same trap, one level wider than the corpus above.
 *
 * ⚠️ **`CATALOG` is the SHARED mixins only** — the ports every visual node gets. A node file may
 * declare its own, and at least one does: `visual/circle.ts` gives `size` (type `number`)
 * `default: '100'`, a string, and nothing in the corpus above would have found it. So this arm
 * greps the viewer source for the shape and asserts `scrubStartValue` reads every one of them,
 * rather than trusting that the two the drive happened to hit were the only ones.
 *
 * 🔴 The lesson is not "handle strings". It is that **a default declared as a string is a type
 * the declaration and its reader can disagree about silently** — it fails as a *plausible
 * value*, not as an error, which is why the field showed 50 while the gesture started at 0.
 */
describe('FB-022 — every string numeric default in the viewer source is readable', () => {
  const VIEWER_SRC = path.join(__dirname, '../../../noodl-viewer-react/src');

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
    });
  }

  const declarations = (() => {
    const found: { file: string; literal: string }[] = [];
    for (const file of walk(VIEWER_SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const m of source.matchAll(/default:\s*'(-?[0-9]+(?:\.[0-9]+)?)'/g)) {
        found.push({ file: path.relative(VIEWER_SRC, file), literal: m[1] });
      }
    }
    return found;
  })();

  // A grep that matched nothing would make the assertion below pass on an empty set.
  it('finds the string numeric defaults that exist, including the one outside the mixins', () => {
    expect(declarations.length).toBeGreaterThanOrEqual(3);
    expect(declarations.map((d) => d.file)).toContain('nodes/visual/circle.ts');
    expect(declarations.map((d) => d.file)).toContain('node-shared-port-definitions.ts');
  });

  it('reads every one of them as the number it looks like', () => {
    const unreadable = declarations.filter((d) => scrubStartValue(undefined, d.literal) !== Number(d.literal));
    expect(unreadable).toEqual([]);
  });
});
