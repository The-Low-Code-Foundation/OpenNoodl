/**
 * FIX-007 — the wire to a Function node's display label.
 *
 * Two things are graded here, and the first is the reason the second is allowed
 * to exist:
 *
 *  1. **Agreement with the runtime.** `functionPorts.ts` copies five regexes out
 *     of `@noodl/runtime`'s `javascriptnodeparser.js` rather than importing it
 *     (that layer runs in the editor, the MCP server and a CLI, and must not
 *     pull the runtime in). A copy that drifts turns this gate from a help into
 *     a liar, so both implementations are run over one corpus and diffed. This
 *     is the only place the real parser is loaded; it is a test-time dependency,
 *     not a product one.
 *
 *  2. **The check itself**, with its negative controls. The mistake is invisible
 *     to everything else we own — a bare `toProperty: "amount"` is four
 *     well-formed strings to zod, a runtime-discovered port to the semantic
 *     validator, and a red canvas warning to the user an hour later.
 */

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import {
  checkFunctionNodePorts,
  mineFunctionScriptPorts,
  FUNCTION_INPUT_PREFIX,
  FUNCTION_OUTPUT_PREFIX
} from '../../src/editor/src/validation/functionPorts';

const catalog = loadDefaultCatalog();

/** Scripts chosen to exercise every regex family, plus the shapes that trip them. */
const CORPUS: string[] = [
  'const a = Inputs.amount;\nOutputs.formatted = a;\nOutputs.done();',
  "Outputs.total = Inputs['unit price'] * Inputs.qty;",
  'Outputs["Ready"]();\nOutputs.Failure();',
  'Outputs["payload"] = { ok: true };',
  '// Inputs.commented is mined too — the parser does not strip comments\nOutputs.x = 1;',
  'const snake_case = Inputs.first_name + Inputs.last_name;\nOutputs.full_name = snake_case;',
  'await fetch(Inputs.url).then((r) => r.json()).then((j) => { Outputs.body = j; Outputs.Success(); });',
  'Outputs.done();', // a signal whose display name is also a declared port
  '', // no script
  'const nothing = 1;' // no ports at all
];

describe('FIX-007 — the mined port set agrees with the runtime parser', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JavascriptNodeParser = require('../../../noodl-runtime/src/javascriptnodeparser');

  /** What the runtime actually registers, reduced to the two name sets. */
  function runtimePorts(script: string): { inputs: Set<string>; outputs: Set<string> } {
    const ports: { name: string; displayName: string; plug: string }[] = [];
    JavascriptNodeParser.parseAndAddPortsFromScript(script, ports, {
      inputPrefix: FUNCTION_INPUT_PREFIX,
      outputPrefix: FUNCTION_OUTPUT_PREFIX
    });
    const inputs = new Set<string>();
    const outputs = new Set<string>();
    for (const port of ports) {
      // `plug` is 'input' | 'inputs' | 'output' in the parser's own families.
      (port.plug.startsWith('input') ? inputs : outputs).add(port.displayName);
    }
    return { inputs, outputs };
  }

  it.each(CORPUS)('mines the same names as the runtime: %j', (script) => {
    const theirs = runtimePorts(script);
    const ours = mineFunctionScriptPorts(script);
    expect([...ours.inputs].sort()).toEqual([...theirs.inputs].sort());
    expect([...ours.outputs].sort()).toEqual([...theirs.outputs].sort());
  });

  it('names the ports with the prefix, and displays them without it', () => {
    const ports: { name: string; displayName: string }[] = [];
    JavascriptNodeParser.parseAndAddPortsFromScript('const a = Inputs.amount;\nOutputs.formatted = a;', ports, {
      inputPrefix: FUNCTION_INPUT_PREFIX,
      outputPrefix: FUNCTION_OUTPUT_PREFIX
    });
    // The whole defect in one assertion: the two differ, and the panel shows the
    // one a connection must not use.
    expect(ports.map((p) => p.name).sort()).toEqual(['in-amount', 'out-formatted']);
    expect(ports.map((p) => p.displayName).sort()).toEqual(['amount', 'formatted']);
  });
});

const FUNCTION_NODE = {
  id: 'fn',
  type: 'JavaScriptFunction',
  label: 'Format as EUR',
  parameters: {
    functionScript: "const amount = Number(Inputs.amount) || 0;\nOutputs.formatted = String(amount);\nOutputs.done();"
  }
};

function check(wires: { fromId: string; fromProperty: string; toId: string; toProperty: string }[]) {
  return checkFunctionNodePorts([FUNCTION_NODE, { id: 'txt', type: 'Text' }], {
    component: '/Price Preview',
    wires,
    catalog
  });
}

describe('FIX-007 — a connection that names the display label', () => {
  it('rejects an input wired to the bare script name, and names the port it should be', () => {
    const [d, ...rest] = check([{ fromId: 'txt', fromProperty: 'text', toId: 'fn', toProperty: 'amount' }]);
    expect(rest).toHaveLength(0);
    expect(d.code).toBe(DiagnosticCode.UnprefixedFunctionPort);
    expect(d.severity).toBe('error');
    expect(d.message).toContain('"in-amount"');
    expect(d.suggestion).toContain('toProperty: "in-amount"');
    expect(d.location.connection?.toProperty).toBe('amount');
  });

  it('rejects an output wired to the bare script name', () => {
    const [d] = check([{ fromId: 'fn', fromProperty: 'formatted', toId: 'txt', toProperty: 'text' }]);
    expect(d.code).toBe(DiagnosticCode.UnprefixedFunctionPort);
    expect(d.suggestion).toContain('fromProperty: "out-formatted"');
  });

  // ── The negative controls ──────────────────────────────────────────────────

  it('says nothing about the correctly prefixed wire', () => {
    expect(
      check([
        { fromId: 'txt', fromProperty: 'text', toId: 'fn', toProperty: 'in-amount' },
        { fromId: 'fn', fromProperty: 'out-formatted', toId: 'txt', toProperty: 'text' }
      ])
    ).toEqual([]);
  });

  it('says nothing about the node\'s own declared ports, including one the script also names', () => {
    // `Outputs.done()` mines `done`, and `done` is *also* a declared signal
    // output. Wiring it is legitimate — this exclusion is what keeps the check
    // off working graphs, and it is why the prefix exists at all.
    expect(
      check([
        { fromId: 'txt', fromProperty: 'onClick', toId: 'fn', toProperty: 'run' },
        { fromId: 'fn', fromProperty: 'done', toId: 'txt', toProperty: 'text' },
        { fromId: 'fn', fromProperty: 'failure', toId: 'txt', toProperty: 'text' }
      ])
    ).toEqual([]);
  });

  it('says nothing about a name the script does not mention — it does not guess', () => {
    // The port rule's territory: could be legitimately runtime-created, could be
    // a typo. This check has no evidence either way, so it stays silent.
    expect(check([{ fromId: 'txt', fromProperty: 'text', toId: 'fn', toProperty: 'nowhere' }])).toEqual([]);
  });

  it('says nothing when there are no wires, and nothing about other node types', () => {
    expect(checkFunctionNodePorts([FUNCTION_NODE], { component: '/c', catalog })).toEqual([]);
    expect(
      checkFunctionNodePorts([{ id: 'js', type: 'Javascript2', parameters: { code: 'x' } }], {
        component: '/c',
        catalog,
        wires: [{ fromId: 'js', fromProperty: 'total', toId: 'txt', toProperty: 'text' }]
      })
    ).toEqual([]);
  });
});
