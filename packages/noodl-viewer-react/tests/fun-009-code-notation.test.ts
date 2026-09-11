/**
 * FUN-009 — the Script node's `code` port declares its notation.
 *
 * The other half of `noodl-runtime/test/nodes/fun-009-code-notation.test.ts`,
 * which carries the full account of the defect: `validationTypeForEditType`
 * guessed the JavaScript editor mode from `type.name`, `type.name` is `'string'`
 * for every code port, and so Function, Script and Expression all opened as
 * **FUNCTION**. The mode is now declared on the port as `type.codenotation`.
 *
 * Two files rather than one because `noodl-runtime` and `noodl-viewer-react`
 * compile under different TypeScript targets and importing a runtime node
 * definition from here fails to build (`RegExpStringIterator` needs
 * `downlevelIteration`). The fact is one fact; the packaging is not.
 *
 * This node is the reason the repair could not be "read the port name". Its port
 * is called `code` — no signal at all — while the Function node's is
 * `functionScript`, which contains the word "script". Any substring reading gets
 * these two exactly the wrong way round.
 */

import JavascriptModule from '../src/nodes/std-library/javascript';

interface CodePortType {
  name?: string;
  codeeditor?: string;
  codenotation?: string;
}

const codePort = (JavascriptModule.node as unknown as { inputs: Record<string, { type: CodePortType }> }).inputs.code;

describe("FUN-009 — Javascript2 ('Script') declares its notation", () => {
  it("declares codenotation 'script' on the code port", () => {
    expect(codePort.type.codeeditor).toBe('javascript');
    expect(codePort.type.codenotation).toBe('script');
  });

  it('is not derivable from the type name', () => {
    expect(codePort.type.name).toBe('string');
  });

  it('is not derivable from the port name — `code` says nothing', () => {
    const guessFromPortName = (portName: string): string => {
      const lowered = portName.toLowerCase();
      if (lowered.includes('expression')) return 'expression';
      if (lowered.includes('script')) return 'script';
      return 'function';
    };

    expect(guessFromPortName('code')).toBe('function');
    expect(guessFromPortName('code')).not.toBe(codePort.type.codenotation);
  });
});
