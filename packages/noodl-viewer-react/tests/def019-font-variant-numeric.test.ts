/**
 * DEF-019 (P78 D30) — the type ramp can reach `font-variant-numeric`.
 *
 * The shared text-style group was exactly nine ports, and a parameter naming a port that does
 * not exist is dropped — so no app built here could align a column of numbers: the bundled
 * Inter's default figures are proportional (`1` advances 1308/2048 em, `8` 1736) and its `tnum`
 * feature was unreachable from any node, template, agent or the style panel.
 *
 * These tests drive the real Text definition's generated setter (the design-token-lengths
 * pattern), plus the two lists that decide where the port appears in the editor: the
 * `textStyle` picker's nested child ports, and the `useLabel` dynamic-port set on controls
 * whose label carries its own ramp. The rendered consequence — equal digit widths in the real
 * shipped font — is driven in `noodl-mcp/tests/def019-numerals-drive.test.ts`.
 */

/* eslint-env jest */

(globalThis as Record<string, any>).Noodl = { deployed: false };

import CheckboxModule from '../src/nodes/controls/checkbox';
import TextNodeModule from '../src/nodes/visual/text';

const textInputs = () => (TextNodeModule.node as any).inputs as Record<string, any>;

/** A stand-in node recording what the definition's setter writes. */
function makeInstance() {
  const applied: Record<string, unknown> = {};
  const instance: Record<string, any> = {
    props: {},
    setStyle(style: Record<string, unknown>) {
      Object.assign(applied, style);
    },
    removeStyle(names: string[]) {
      names.forEach((n) => delete applied[n]);
    },
    forceUpdate() {
      /* not under test */
    }
  };
  return { instance, applied };
}

describe('DEF-019 — fontVariantNumeric is a port', () => {
  test('Text declares it, enum Normal/Tabular, nested under the textStyle picker', () => {
    const port = textInputs().fontVariantNumeric;
    expect(port).toBeDefined();
    expect(port.type.name).toBe('enum');
    expect(port.type.enums.map((e: { value: string }) => e.value)).toEqual(['normal', 'tabular-nums']);
    expect(port.type.parentPort).toBe('textStyle');
    expect(port.targetStyleProperty).toBe('fontVariantNumeric');
  });

  test('the generated setter writes the style property, and undefined removes it', () => {
    const { instance, applied } = makeInstance();

    textInputs().fontVariantNumeric.set.call(instance, 'tabular-nums');
    expect(applied.fontVariantNumeric).toBe('tabular-nums');

    textInputs().fontVariantNumeric.set.call(instance, undefined);
    expect(applied.fontVariantNumeric).toBeUndefined();
  });

  test('the textStyle type lists it as a child port', () => {
    expect(textInputs().textStyle.type.childPorts).toContain('fontVariantNumeric');
  });

  test('a labelled control puts it behind the useLabel condition with the rest of the ramp', () => {
    const dynamicports = (CheckboxModule.node as any).dynamicports as Array<{ condition?: string; inputs?: string[] }>;
    const labelPorts = dynamicports.filter((d) => d.condition && d.condition.includes('useLabel = true')).flatMap((d) => d.inputs || []);
    // The checkbox's label ramp is styleTag-prefixed; a bare name here would be a port
    // on the box, not the words beside it.
    expect(labelPorts).toContain('labelfontVariantNumeric');
    expect(labelPorts).toContain('labelfontSize');
  });
});
