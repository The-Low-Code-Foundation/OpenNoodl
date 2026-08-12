/**
 * FUN-009 — a JavaScript code port declares which scoping rule its text obeys.
 *
 * ## What went wrong, and why the spec has to sit beside the declarations
 *
 * `validationTypeForEditType` (editor, `CodeEditor/CodeEditorType.ts`) decides
 * whether a code popout validates as `function`, `script` or `expression`. It
 * used to guess from `type.name` — three lines below its own comment saying the
 * *port* name was the only signal available — and `type.name` is `'string'` for
 * every JavaScript code port in the product. Both name branches were therefore
 * unreachable, and all three code nodes opened as **FUNCTION**. Measured live in
 * the running editor 2026-08-12.
 *
 * That was not cosmetic. `no-undef` is switched off in `'expression'` mode on
 * purpose, because in an Expression node a bare identifier *becomes an input
 * port* (`expression.ts`, `parsePorts` and the `expression` setter). With the
 * mode never selecting, the rule ran: the editor underlined `total * 2` as an
 * undefined variable and then minted the port `total` out of the same text.
 *
 * The editor now reads `type.codenotation` off the port. Its own suite pins the
 * *mapping* (`noodl-editor/tests/utils/codeeditor-mode.test.ts`); nothing there
 * can import a node definition, so it cannot tell whether any port actually
 * declares the field. A mapping with no declarations behind it passes while
 * every editor still opens in Function mode — the exact shape of the defect
 * being fixed. This file is the other half, for the two nodes that live here.
 *
 * The third code port is `Javascript2`'s `code`, which is defined in
 * `noodl-viewer-react` and pinned by that package's
 * `tests/fun-009-code-notation.test.ts`. Two files rather than one because the
 * two packages compile under different TypeScript targets and importing across
 * them fails to build, not because the fact is two facts.
 *
 * ⚠️ These are not the only `codeeditor: 'javascript'` ports. `mapScript` (Map
 * Collection), `storageJSONFilter` (Database Collection) and the REST node's
 * `requestScript` / `responseScript` declare no notation and fall back to
 * `function`, which is exactly what they resolved to before — and at least two
 * of them are not Function bodies at all. Filed as F35, deliberately not
 * changed here: it is a decision about four real ports, not a side effect of
 * giving three others a voice.
 */

import ExpressionNodeModule = require('../../src/nodes/std-library/expression');
import SimpleJavascriptNodeModule = require('../../src/nodes/std-library/simplejavascript');

interface CodePortType {
  name?: string;
  codeeditor?: string;
  codenotation?: string;
}

function portType(module: unknown, portName: string): CodePortType {
  const node = (module as { node: { inputs: Record<string, { type: CodePortType }> } }).node;
  return node.inputs[portName].type;
}

/** The port whose code the popout holds, per node, and the rule that text obeys. */
const CODE_PORTS = [
  { node: 'Expression', module: ExpressionNodeModule, port: 'expression', notation: 'expression' },
  { node: 'JavaScriptFunction', module: SimpleJavascriptNodeModule, port: 'functionScript', notation: 'function' }
] as const;

describe('FUN-009 — the runtime code ports declare their notation', () => {
  for (const { node, module, port, notation } of CODE_PORTS) {
    it(`${node}.${port} declares codenotation '${notation}'`, () => {
      const type = portType(module, port);

      expect(type.codeeditor).toBe('javascript');
      expect(type.codenotation).toBe(notation);
    });
  }

  it('gives the two nodes opposite rules, which is the whole point', () => {
    const declared = CODE_PORTS.map(({ module, port }) => portType(module, port).codenotation);

    expect(new Set(declared).size).toBe(2);
  });

  it('cannot be derived from the type name — which is what made the old guess dead code', () => {
    // The measurement that closed F17: every code port's type is `'string'`, so a
    // reader of `type.name` answers `function` for all of them.
    for (const { module, port } of CODE_PORTS) {
      expect(portType(module, port).name).toBe('string');
    }
  });

  it('cannot be derived from the port name either — the guess would invert Function', () => {
    // ⚠️ The obvious repair, and the reason it was not taken. `functionScript`
    // contains "script", so a substring reading of the port name calls the
    // Function node's port a Script. (It gets `Javascript2`'s `code` wrong too;
    // that half is asserted in the viewer-react file.) Read this as the argument
    // it is: the mode is declared because nothing about the port implies it.
    const guessFromPortName = (portName: string): string => {
      const lowered = portName.toLowerCase();
      if (lowered.includes('expression')) return 'expression';
      if (lowered.includes('script')) return 'script';
      return 'function';
    };

    const wrong = CODE_PORTS.filter(({ port, notation }) => guessFromPortName(port) !== notation).map(
      ({ port }) => port
    );

    expect(wrong).toEqual(['functionScript']);
  });
});
