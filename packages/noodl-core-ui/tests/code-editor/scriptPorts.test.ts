/**
 * FH-019 — the ports a script declares by using them.
 *
 * The contract these pin is not "reasonable completions" but **agreement with
 * the runtime**: `JavascriptNodeParser.parseAndAddPortsFromScript`
 * (`noodl-runtime/src/javascriptnodeparser.js:293-387`) is what turns these
 * same strings into real ports, so a name this offers must be one that becomes
 * a port and a name it declines must be one that does not. The asymmetries
 * below (a `_` is legal in an input but not in a signal name; a bracket-form
 * output takes double quotes only) look like bugs and are the upstream
 * behaviour — copied rather than corrected, because being right where the
 * runtime is wrong would mean offering a port that never appears.
 */
import { minePorts } from '@noodl-core-ui/components/code-editor/utils/scriptPorts';

describe('minePorts', () => {
  it('finds nothing in an empty script', () => {
    expect(minePorts('')).toEqual({ inputs: [], outputs: [], signals: new Set() });
  });

  it('finds each input once, in first-appearance order', () => {
    const ports = minePorts('if (Inputs.b) { return Inputs.a + Inputs.b; }');
    expect(ports.inputs).toEqual(['b', 'a']);
  });

  it('reads both notations', () => {
    const ports = minePorts('Inputs.plain;\nInputs["with space"];\nInputs[\'quoted\'];');
    expect(ports.inputs).toEqual(['plain', 'with space', 'quoted']);
  });

  it('separates outputs from inputs', () => {
    const ports = minePorts('Outputs.total = Inputs.price * Inputs.quantity;');
    expect(ports.inputs).toEqual(['price', 'quantity']);
    expect(ports.outputs).toEqual(['total']);
  });

  it('marks a called output as a signal', () => {
    const ports = minePorts('Outputs.Done();\nOutputs.result = 1;');
    expect(ports.outputs).toEqual(['Done', 'result']);
    expect(ports.signals.has('Done')).toBe(true);
    expect(ports.signals.has('result')).toBe(false);
  });

  it('marks the bracket form of a signal too', () => {
    const ports = minePorts('Outputs["Did thing"]();');
    expect(ports.signals.has('Did thing')).toBe(true);
  });

  it('allows an underscore in an input name, as the runtime does', () => {
    expect(minePorts('Inputs.first_name;').inputs).toEqual(['first_name']);
  });

  it('stops a signal name at an underscore, as the runtime does', () => {
    // `/Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/` — no `_` in the class, so
    // `Outputs.do_it()` is not matched as a signal at all. It is still an
    // output, via the regular pattern.
    const ports = minePorts('Outputs.do_it();');
    expect(ports.signals.size).toBe(0);
    expect(ports.outputs).toEqual(['do_it']);
  });

  it('does not read a single-quoted bracket output, as the runtime does not', () => {
    // The upstream output pattern is `/Outputs\s*\[\s*"([^"]*)"\s*\]/` — double
    // quotes only, unlike the input twin.
    expect(minePorts('Outputs[\'total\'] = 1;').outputs).toEqual([]);
    expect(minePorts('Outputs["total"] = 1;').outputs).toEqual(['total']);
  });

  it('reads names out of comments and strings, because the runtime does', () => {
    // Being cleverer here would offer a different set of names than the node
    // actually grows ports for.
    expect(minePorts('// Inputs.legacy is gone').inputs).toEqual(['legacy']);
  });

  it('gives the same answer twice — no shared regex `lastIndex`', () => {
    const script = 'Inputs.a; Outputs.b = 1;';
    expect(minePorts(script)).toEqual(minePorts(script));
  });
});
