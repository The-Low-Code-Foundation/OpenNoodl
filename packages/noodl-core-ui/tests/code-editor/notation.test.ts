/**
 * FUN-001 — the notation module, round-tripped against the miner.
 *
 * The point of every case here is the same: **a name this module renders must
 * be mined back as the same port, of the same kind.** `minePorts` is a verbatim
 * client-side copy of the runtime's six patterns
 * (`javascriptnodeparser.js:294-387`), so a round trip through it is a
 * statement about what port the node will actually grow.
 *
 * DOM-free, because this package's runner is `testEnvironment: 'node'` and
 * `jest-environment-jsdom` is not in the tree (CED-001).
 */

import { minePorts } from '@noodl-core-ui/components/code-editor/utils/scriptPorts';
import {
  NOTATION_RULES,
  SEED_FUNCTION_BODY,
  canExpressPort,
  expressionPortNote,
  readExpression,
  stripPortPrefix,
  writeExpression
} from '@noodl-core-ui/components/code-editor/utils/notation';

describe('stripPortPrefix', () => {
  it('strips the internal in-/out- prefixes and leaves everything else alone', () => {
    expect(stripPortPrefix('in-Value')).toBe('Value');
    expect(stripPortPrefix('out-Result')).toBe('Result');
    expect(stripPortPrefix('Value')).toBe('Value');
  });

  it('strips only the leading prefix — a name that merely contains it survives', () => {
    expect(stripPortPrefix('in-in-Value')).toBe('in-Value');
    expect(stripPortPrefix('inputValue')).toBe('inputValue');
    expect(stripPortPrefix('out-of-stock')).toBe('of-stock');
  });
});

describe('readExpression', () => {
  it('uses dot notation for a name the dot pattern mines', () => {
    expect(readExpression('Value')).toBe('Inputs.Value');
    expect(readExpression('my_value_2')).toBe('Inputs.my_value_2');
  });

  it('uses bracket notation for a name that is not an identifier', () => {
    expect(readExpression('My Value')).toBe('Inputs["My Value"]');
    expect(readExpression('total-price')).toBe('Inputs["total-price"]');
  });

  it('does NOT strip a prefix — the name it is given is the name in the code', () => {
    // FUN-003 measured that the prefix is applied when the port list is
    // ASSEMBLED, so a declared-port fact's name is already the display name.
    // A row an author labels `in-Value` is a port displayed `in-Value`, and
    // writing `Inputs.Value` for it addresses a port that does not exist.
    expect(readExpression('in-Value')).toBe('Inputs["in-Value"]');
    expect(minePorts(readExpression('in-Value')).inputs).toEqual(['in-Value']);
  });

  it('round-trips through the miner as the same single port', () => {
    for (const name of ['Value', 'my_value_2', 'My Value', 'total-price']) {
      const mined = minePorts(readExpression(name));
      expect(mined.inputs).toEqual([name]);
    }
  });
});

describe('writeExpression', () => {
  it('writes a value as an assignment and a signal as a call', () => {
    expect(writeExpression('Result', 'value')).toBe('Outputs.Result = ');
    expect(writeExpression('Done', 'signal')).toBe('Outputs.Done()');
  });

  it('brackets a value name that is not an identifier', () => {
    expect(writeExpression('My Result', 'value')).toBe('Outputs["My Result"] = ');
  });

  it('brackets an underscored SIGNAL name, because the dot pattern would type it as a value', () => {
    // /Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/ — no underscore in the class.
    expect(writeExpression('Done_1', 'signal')).toBe('Outputs["Done_1"]()');
    // ...while the same name as a value is happily written with a dot.
    expect(writeExpression('Done_1', 'value')).toBe('Outputs.Done_1 = ');
  });

  it('round-trips a value as a value port and a signal as a signal port', () => {
    for (const name of ['Result', 'My Result', 'total-price']) {
      const mined = minePorts(writeExpression(name, 'value') + '1;');
      expect(mined.outputs).toEqual([name]);
      expect(mined.signals.has(name)).toBe(false);
    }

    for (const name of ['Done', 'Done_1', 'All Done']) {
      const mined = minePorts(writeExpression(name, 'signal'));
      expect(mined.outputs).toEqual([name]);
      expect(mined.signals.has(name)).toBe(true);
    }
  });

  it("regression: the dot form of an underscored signal is what we are avoiding", () => {
    // The proof that the bracket special-case above is not decoration. Written
    // by hand, exactly as a naive `Outputs.${name}()` concatenation would.
    const naive = minePorts('Outputs.Done_1()');
    expect(naive.outputs).toEqual(['Done_1']);
    expect(naive.signals.has('Done_1')).toBe(false);
  });
});

describe('canExpressPort', () => {
  it('rejects a name with no form that mines back to itself', () => {
    // The output bracket pattern is /Outputs\s*\[\s*"([^"]*)"\s*\]/ — double
    // quotes only, no escape. There is nowhere to put a `"`.
    expect(canExpressPort('say "hi"')).toBe(false);
    expect(canExpressPort('')).toBe(false);
  });

  it('accepts everything the two builders have a form for', () => {
    expect(canExpressPort('Value')).toBe(true);
    expect(canExpressPort('My Value')).toBe(true);
    // A display name that merely looks prefixed is an ordinary name.
    expect(canExpressPort('in-My Value')).toBe(true);
  });
});

describe('SEED_FUNCTION_BODY', () => {
  it('mines exactly two ports — one input, one output', () => {
    const mined = minePorts(SEED_FUNCTION_BODY);

    expect(mined.inputs).toEqual(['Value']);
    expect(mined.outputs).toEqual(['Result']);
    expect(mined.signals.size).toBe(0);
  });

  it('has a comment that teaches without minting a port', () => {
    // ⚠️ The regression this exists for. FUN-002 specced a comment reading
    // "Read an input with Inputs.Name, write an output with Outputs.Name",
    // and comments ARE mined — that seed arrives with four ports, two of
    // which come from the sentence explaining it.
    const asSpecced = [
      '// Read an input with Inputs.Name, write an output with Outputs.Name.',
      '// Renaming them here renames the ports on the node.',
      'Outputs.Result = Inputs.Value;'
    ].join('\n');

    expect(minePorts(asSpecced).inputs).toEqual(['Name', 'Value']);
    expect(minePorts(asSpecced).outputs).toEqual(['Name', 'Result']);

    // What ships says the same thing and mints nothing.
    expect(SEED_FUNCTION_BODY).toContain('//');
    expect(minePorts(SEED_FUNCTION_BODY).inputs).toHaveLength(1);
  });

  it('is a body that runs — it parses as an async function of Inputs and Outputs', () => {
    // The shape the runtime compiles: simplejavascript.ts:447.
    expect(() => new Function('Inputs', 'Outputs', 'Noodl', 'Component', SEED_FUNCTION_BODY)).not.toThrow();
  });
});

describe('NOTATION_RULES', () => {
  it('never writes the legacy alias', () => {
    for (const rule of Object.values(NOTATION_RULES)) {
      expect(rule).not.toContain('Noodl.Inputs');
      expect(rule).not.toContain('Noodl.Outputs');
    }
    expect(SEED_FUNCTION_BODY).not.toContain('Noodl.');
  });

  it("keeps expression mode's opposite rule free of Inputs./Outputs.", () => {
    // A bare identifier in an expression BECOMES a port (expression.ts:399),
    // so a hint leaking `Inputs.foo` there would create a port named `Inputs`.
    expect(NOTATION_RULES.expression).not.toContain('Inputs.');
    expect(NOTATION_RULES.expression).not.toContain('Outputs.');
  });

  it('states the function rule in the notation the runtime actually mines', () => {
    expect(minePorts(NOTATION_RULES.function).inputs).toEqual(['Name']);
    expect(minePorts(NOTATION_RULES.function).outputs).toEqual(['Name']);
  });
});

describe('expressionPortNote (FUN-009 §1)', () => {
  it('states the rule even when the expression is empty', () => {
    const note = expressionPortNote([]);

    expect(note.rule).toContain('becomes an input port');
    // Nothing to lose yet, so no warning about losing it.
    expect(note.current).toBeUndefined();
    expect(note.onDelete).toBeUndefined();
  });

  it('names the ports the current expression has grown', () => {
    const note = expressionPortNote(['price', 'quantity']);

    expect(note.current).toBe('price, quantity → 2 input ports.');
  });

  it('counts one port in the singular', () => {
    expect(expressionPortNote(['total']).current).toBe('total → 1 input port.');
  });

  it('warns about deletion exactly when there is a port to lose', () => {
    // ⚠️ The half that matters: removing a name removes the port AND its wires
    // (`expression.ts`, `inputsToRemove`). Shown only in the state where the
    // next keystroke could do it.
    expect(expressionPortNote(['price']).onDelete).toContain('wired');
    expect(expressionPortNote([]).onDelete).toBeUndefined();
  });

  it('never puts Inputs. or Outputs. in front of an Expression author', () => {
    // The destructive case, and the reason the copy does not draw the contrast
    // with Function mode in words: `Inputs.foo` typed here mints a port called
    // `Inputs`. Assert over every string the note can produce, in both states.
    for (const names of [[], ['price', 'quantity']]) {
      const note = expressionPortNote(names);
      const all = [note.rule, note.current ?? '', note.onDelete ?? ''].join(' ');

      expect(all).not.toContain('Inputs.');
      expect(all).not.toContain('Outputs.');
      expect(minePorts(all).inputs).toEqual([]);
      expect(minePorts(all).outputs).toEqual([]);
    }
  });
});
