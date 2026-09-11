import * as fs from 'fs';
import * as path from 'path';

import SharedPorts from '../../../noodl-viewer-react/src/node-shared-port-definitions';
import {
  declaredUnit,
  isUnitsPortType,
  landingUnit,
  portWireShape,
  type WireShapePort
} from '../../src/editor/src/models/nodelibrary/portWireShape';

/**
 * FB-019 scope (3) — *"what do I feed this port?"*, graded.
 *
 * ## Why this suite is built on the real declarations
 *
 * The complaint FB-019 was filed on is an asymmetry between two specific ports:
 *
 * > *"the node width or something, you have to input a JSON with a number and the px/vw value
 * > in the body."*
 *
 * Two sessions of driving established that both ports work — and that they land the same wire
 * in **different units**, `300px` into padding and `300%` into Width, because `defaultUnit`
 * differs per port and nothing said so. A suite written against invented port objects would
 * still pass on the day somebody changes `width`'s `defaultUnit`, which is the one edit that
 * makes every sentence this module produces wrong. So the ports come from
 * `node-shared-port-definitions.ts` itself, built by the same mixins every visual node calls.
 *
 * ⚠️ `Noodl` has to exist as a global before that module is imported: `addDimensions` reads
 * `Noodl.deployed` to decide whether to attach tooltips. `deployed: true` skips them, which is
 * the cheaper half and changes no port's type.
 *
 * ## The arms, and what each would catch
 *
 * 1. **The reported pair.** `width` and `paddingLeft`, from the real mixins, must produce
 *    sentences that name *different* units. This is the defect, stated.
 * 2. **`defaultUnit`, not `units[0]`.** They disagree on six declarations, and the runtime reads
 *    `defaultUnit` (`nodedefinition.ts:171`). `transformOriginX` is one of the six, so this arm
 *    also **asserts the disagreement is still there** — a "tidy-up" that reordered the units
 *    would otherwise leave the arm passing vacuously about nothing.
 * 3. **The no-`default` case says less, on purpose.** `marginLeft` declares `defaultUnit: 'px'`
 *    and no `default`, so `initializeDefaultValues` seeds nothing and the editor cannot know
 *    what a bare number lands in. The arm is that the sentence does **not** name a unit.
 * 4. **Ordinary ports get nothing.** A line on all 1,600 ports is how a surface stops being read.
 * 5. **Drift.** The icon sentence and the viewer's `iconSourceProblem` warning are the
 *    before-and-after of one union; they name the same shape and reason, and a source read pins
 *    it. Two half-matching explanations of one type is what `portCopy.ts` exists to prevent.
 * 6. **Both surfaces call it, and the popup can still answer.** The last block is structural for
 *    the reason `portConnectivity.test.ts` records: "the two lists agree" is a property of the
 *    source, and it is the property that has rotted twice.
 */

(globalThis as { Noodl?: unknown }).Noodl = { deployed: true };

const EDITOR_SRC = path.join(__dirname, '../../src/editor/src');
const VIEWER_SRC = path.join(__dirname, '../../../noodl-viewer-react/src');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/** A definition shell the mixins mutate, exactly as a visual node file hands them one. */
function definition(): TSFixme {
  return { name: 'spec', inputs: {}, inputProps: {}, inputCss: {}, outputs: {}, outputProps: {} };
}

/** Every real port the mixins under test declare, keyed by name, whichever path it lands on. */
const REAL_PORTS: Record<string, WireShapePort> = (() => {
  const def = definition();
  const mixins = SharedPorts as TSFixme;
  mixins.addDimensions(def, { defaultSizeMode: 'explicit' });
  mixins.addMarginInputs(def);
  mixins.addPaddingInputs(def);
  mixins.addTransformInputs(def);
  mixins.addIconInputs(def);
  mixins.addSharedVisualInputs(def);

  const all: Record<string, WireShapePort> = {};
  for (const bag of [def.inputs, def.inputProps, def.inputCss]) {
    for (const name of Object.keys(bag || {})) all[name] = { name, ...bag[name] };
  }
  return all;
})();

function port(name: string): WireShapePort {
  const found = REAL_PORTS[name];
  if (!found) throw new Error(`no real port named ${name} — the mixins were renamed, fix the arm`);
  return found;
}

describe('FB-019 scope (3) — the shape a port takes', () => {
  describe('the reported asymmetry: one number, two units, one node', () => {
    it('names % for Width and px for Padding Left, from the real declarations', () => {
      const width = portWireShape(port('width'));
      const padding = portWireShape(port('paddingLeft'));

      expect(width).toBeDefined();
      expect(padding).toBeDefined();
      expect(width.shape).toBe('{value, unit}');
      expect(padding.shape).toBe('{value, unit}');

      /*
       * The sentence Richard could not predict, now written down at both ports.
       * ⚠️ Matched on the landing clause and not on `300px` alone: the string-form warning
       * further along the same sentence also contains "300px", so a bare `toContain` here
       * passes on a port that never names a landing unit at all.
       */
      expect(width.body).toContain('lands here as 300%');
      expect(padding.body).toContain('lands here as 300px');
      expect(width.body).not.toContain('lands here as 300px');
      expect(padding.body).not.toContain('lands here as 300%');
    });

    it('is grounded in the declarations themselves, not in this file', () => {
      // If either of these changes, the arm above is asserting the wrong units and should be
      // read again rather than quietly re-baselined.
      expect((port('width').type as TSFixme).defaultUnit).toBe('%');
      expect((port('paddingLeft').type as TSFixme).defaultUnit).toBe('px');
      expect(port('width').default).toBe(100);
      expect(port('paddingLeft').default).toBeDefined();
    });

    it('lists the units the port actually declares', () => {
      expect(portWireShape(port('width')).body).toContain('Units: %, px, vw, vh.');
    });

    it('warns about the string form, which both setters drop', () => {
      expect(portWireShape(port('width')).body).toContain('"300px"');
      expect(portWireShape(port('width')).body).toContain('dropped silently');
    });
  });

  describe('the landing unit', () => {
    it("is the author's own unit when one is stored, whatever the port declares", () => {
      expect(landingUnit(port('width'))).toBe('%');
      expect(landingUnit(port('width'), { value: 16, unit: 'px' })).toBe('px');
      expect(portWireShape(port('width'), { value: 16, unit: 'px' }).body).toContain('lands here as 300px');
    });

    it('ignores a stored value that carries no unit', () => {
      // A legacy project can hold a bare `150` in a width parameter. The merge still reaches
      // for the seeded default, so the answer is the declared one.
      expect(landingUnit(port('width'), 150)).toBe('%');
      expect(landingUnit(port('width'), { value: 150 })).toBe('%');
    });

    it('is defaultUnit and NOT the first unit listed — they disagree on real ports', () => {
      const originX = port('transformOriginX');
      const units = (originX.type as TSFixme).units;

      // The non-vacuity half: this arm only means something while the two really differ.
      expect(units[0]).toBe('px');
      expect((originX.type as TSFixme).defaultUnit).toBe('%');

      expect(landingUnit(originX)).toBe('%');
      expect(portWireShape(originX).body).toContain('lands here as 300%');
    });

    it('says nothing about the unit when the port declares no default to seed one', () => {
      const margin = port('marginLeft');
      expect((margin.type as TSFixme).defaultUnit).toBe('px');
      expect(margin.default).toBeUndefined();

      expect(landingUnit(margin)).toBeUndefined();

      const shape = portWireShape(margin);
      expect(shape.shape).toBe('{value, unit}');
      expect(shape.body).toContain('the unit comes from this port');
      // The claim it must not make.
      expect(shape.body).not.toContain('lands here as');
    });
  });

  describe('the icon union', () => {
    it('names the object shape and why a bare name cannot be turned into one', () => {
      const icon = portWireShape(port('iconIconSource'));
      expect(icon).toBeDefined();
      expect(icon.shape).toBe('{class, code}');
      expect(icon.body).toContain('{"class":"material-icons","code":"search"}');
      expect(icon.body).toContain('the class comes from the installed icon set');
      expect(icon.body).toContain('icon picker');
    });

    it('says the same thing as the warning an author gets after wiring the wrong value', () => {
      // FB-019 AC3's `iconSourceProblem` is the after; this module is the before. Drift between
      // them is two explanations of one union, which is worse than one.
      const warning = read(path.join(VIEWER_SRC, 'components/visual/Icon/iconSourceProblem.ts'));
      const before = portWireShape(port('iconIconSource'));

      expect(warning).toContain('{"class":"material-icons","code":"search"}');
      expect(before.body).toContain('{"class":"material-icons","code":"search"}');
      expect(warning).toContain('comes from the installed icon set');
      expect(before.body).toContain('comes from the installed icon set');
    });
  });

  describe('the settings whose own names argue for the wrong answer', () => {
    it('says a stringlist is one string, not a list', () => {
      const shape = portWireShape({ name: 'p', type: { name: 'stringlist', allowEditOnly: true } });
      expect(shape.shape).toBe('a comma-separated string');
      expect(shape.body).toContain('"id,slug"');
      expect(shape.body).toContain('not a list of separate values');
    });

    it('says a proplist is rows', () => {
      expect(portWireShape({ name: 'p', type: { name: 'proplist' } }).shape).toBe('{label, value} rows');
    });
  });

  describe('ordinary ports say nothing', () => {
    it.each([
      ['a bare string type', 'string'],
      ['a signal', 'signal'],
      ['the wildcard', '*'],
      ['a colour', 'color'],
      ['a component path', 'component']
    ])('%s', (_label, typeName) => {
      expect(portWireShape({ name: 'p', type: typeName })).toBeUndefined();
    });

    it('a number with no units is just a number', () => {
      expect(isUnitsPortType('number')).toBe(false);
      expect(portWireShape({ name: 'p', type: { name: 'number' } })).toBeUndefined();
      expect(portWireShape(port('opacity'))).toBeUndefined();
    });

    it('an enum keeps its own list and gains no shape line', () => {
      expect(portWireShape(port('mixBlendMode'))).toBeUndefined();
    });

    it('is safe on a port that has no type at all', () => {
      expect(portWireShape(undefined)).toBeUndefined();
      expect(portWireShape({ name: 'p' })).toBeUndefined();
      expect(landingUnit(undefined)).toBeUndefined();
    });
  });

  describe("the popup's port-name annotation, which had the hole", () => {
    /*
     * `getAnnotatedPortName` already suffixed a units port with its unit — but its guard read
     * `nameForPortType(port.type) === 'number'`, and `dimension` is declared by exactly two
     * ports: Width and Height. So the popup labelled `Min Width (%)` and `Pad Left (px)` and
     * said nothing on the two ports the complaint names. It is graded here rather than in a
     * `nodelibrary` suite because the shared predicate is what closes it, and because a guard
     * narrowed back to `'number'` must go red rather than quiet.
     */
    it('treats dimension as a units type, which is what the annotation was missing', () => {
      expect(isUnitsPortType(port('width').type)).toBe(true);
      expect(isUnitsPortType(port('minWidth').type)).toBe(true);
      expect((port('width').type as TSFixme).name).toBe('dimension');

      // The non-vacuity half: the old guard really would have refused this one and admitted
      // the other, so the two rows are the arms of a control pair rather than two of a kind.
      expect((port('minWidth').type as TSFixme).name).toBe('number');
    });

    it('is the shared predicate, in BOTH places nodelibrary had a copy of the rule', () => {
      /*
       * There were three copies. `getAnnotatedPortName` is the one the popup reads;
       * `formatParameterValue` is the version-control conflict list's, and it had the same
       * `dimension` hole plus a `units[0]` fallback where the runtime reads `defaultUnit`. The
       * absence assertion is what found the second one — it was written for the first and went
       * red on a line nobody had looked at.
       */
      const lib = read(path.join(EDITOR_SRC, 'models/nodelibrary/nodelibrary.ts'));
      expect(lib.match(/isUnitsPortType\(port\.type\)/g)).toHaveLength(2);
      expect(lib).not.toMatch(/nameForPortType\(port\.type\) === 'number' && port\.type\.units/);
      expect(lib).not.toMatch(/port\.type\.units\[0\]/);
    });

    it('declaredUnit is defaultUnit first, and falls back only when there is none', () => {
      // The six declarations where the two disagree are why the order matters.
      expect(declaredUnit(port('transformOriginX').type)).toBe('%');
      expect((port('transformOriginX').type as TSFixme).units[0]).toBe('px');

      // …and the fallback still answers for a port that declares units but no defaultUnit,
      // which the conflict list has to render as something.
      expect(declaredUnit({ name: 'number', units: ['vh', 'px'] })).toBe('vh');
      expect(declaredUnit({ name: 'number' })).toBeUndefined();
      expect(declaredUnit('string')).toBeUndefined();
    });

    it('says nothing rather than "(undefined)" for a dimension with no defaultUnit', () => {
      const lib = read(path.join(EDITOR_SRC, 'models/nodelibrary/nodelibrary.ts'));
      expect(lib).toMatch(/if \(unit\) \{/);
    });
  });

  describe('both surfaces ask the same module, and both can get an answer', () => {
    it('the Ports tab and the connection popup each call portWireShape', () => {
      const tab = read(path.join(EDITOR_SRC, 'views/panels/propertyeditor/components/PortsTab/PortsTab.tsx'));
      const popup = read(path.join(EDITOR_SRC, 'views/ConnectionPopup/components/PortItem.tsx'));

      expect(tab).toContain('portWireShape(');
      expect(popup).toContain('portWireShape(');
    });

    it('both pass the stored parameter, without which an author-set unit is invisible', () => {
      const tab = read(path.join(EDITOR_SRC, 'views/panels/propertyeditor/components/PortsTab/PortsTab.tsx'));
      const popup = read(path.join(EDITOR_SRC, 'views/ConnectionPopup/components/PortItem.tsx'));

      expect(tab).toMatch(/portWireShape\(\s*port,\s*model\.parameters/);
      expect(popup).toMatch(/parameters\[props\.port\.name\]/);
    });

    it("the popup's port list carries `default` through its whitelist", () => {
      /*
       * `ConnectionBar._getPorts` copies a fixed set of fields onto each row. `default` is one
       * of the two inputs to the landing unit, so dropping it would leave every units port in
       * the popup saying the vaguer sentence while the Ports tab said the exact one — the two
       * surfaces disagreeing about one port, quietly, which is this pair's recorded failure.
       */
      const bar = read(path.join(EDITOR_SRC, 'views/ConnectionPopup/components/ConnectionBar.tsx'));
      expect(bar).toMatch(/default:\s*p\.default/);
    });
  });
});
