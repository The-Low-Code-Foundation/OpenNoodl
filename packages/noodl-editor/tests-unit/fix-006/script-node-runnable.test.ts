/**
 * FIX-006 §3 — the Script node that runs once at load and can never be re-entered.
 *
 * The reported defect: the AI wrote Function-shaped code into a `Javascript2`
 * node. The user's note — *"it also didn't add any input or output signals,
 * which means the Script can't be run"* — understates the mechanism. There is no
 * `run` signal to add. The body is wrapped in `new Function` and invoked once
 * (`javascriptnodeparser.js:19-38`); only a *declared surface* gives the runtime
 * anything to call afterwards. Meanwhile the `Inputs.`/`Outputs.` mentions still
 * mint ports, so the graph looks correctly wired and is not.
 *
 * Three things are graded here, in the order they earn each other:
 *
 *  1. **Agreement with the runtime.** {@link SCRIPT_NODE_API_MEMBERS} is a
 *     hand-kept copy of the members `javascriptnodeparser.js` reads back off the
 *     injected `Node` object — the same copy-not-import constraint that governs
 *     the regexes in this module's sibling check, and the same drift risk. So the
 *     real parser is loaded and *run*, and every member on the list is required to
 *     produce an observable effect in it. A control asserts an invented member
 *     produces none, because a list graded only by "does it work" would pass while
 *     containing anything at all.
 *
 *  2. **The predicate**, over the shapes the task file's proposal got wrong. The
 *     proposal was `define(`/`script(`; measured against the repo's 88 Script
 *     nodes it fires on 13, every one a working library prefab or module, because
 *     the third-generation `Node.*` API is what the library actually uses.
 *
 *  3. **The check**, with the negative controls that keep the warning honest —
 *     including the two skips (`useExternalFile`, an empty body) that are silence
 *     by decision rather than by accident.
 *
 * ⚠️ Point 1 is the reason points 2 and 3 are allowed to be regex-shaped.
 */

import { authoredPreconditionDiagnostics } from '../../src/editor/src/validation/authoredCandidate';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import {
  checkScriptNodeRunnable,
  scriptDeclaresRunnableSurface,
  SCRIPT_NODE_API_MEMBERS,
  SCRIPT_NODE_TYPE,
  type ScriptCarryingNode
} from '../../src/editor/src/validation/functionPorts';

const COMPONENT = '/Pages/Home';

/** The reported node: Function-shaped code, `var`, and a regex where `slice` would do. */
const REPORTED_DEFECT = 'var input = Inputs.Text;\nvar out = input.replace(/^./, "");\nOutputs.Result = Number(out) * 0.9;';

function scriptNode(parameters: Record<string, unknown>, extra: Partial<ScriptCarryingNode> = {}): ScriptCarryingNode {
  return { id: 'script-1', type: SCRIPT_NODE_TYPE, parameters, ...extra };
}

function check(node: ScriptCarryingNode) {
  return checkScriptNodeRunnable([node], { component: COMPONENT });
}

describe('FIX-006 §3 — the API member list agrees with the runtime parser', () => {
  // The one place the real parser is loaded: a test-time dependency, not a
  // product one. `functionPorts.ts` runs in the editor, the MCP server and a
  // CLI, none of which may pull the runtime in.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JavascriptNodeParser = require('../../../noodl-runtime/src/javascriptnodeparser');

  /**
   * What the runtime actually did with a body, reduced to "did it end up with
   * anything to call". Read off the parser's own state and the injected `Node`,
   * so this is the runtime's answer rather than a second copy of the predicate.
   */
  function runtimeSurface(code: string): { ports: number; hooks: string[]; signals: string[]; setters: string[] } {
    const parser = new JavascriptNodeParser(code, {});
    const node = parser.apis.Node;
    const fns = (bag: Record<string, unknown> | undefined) =>
      Object.keys(bag ?? {}).filter((key) => typeof bag?.[key] === 'function');
    return {
      ports: Object.keys(parser.inputs ?? {}).length + Object.keys(parser.outputs ?? {}).length,
      hooks: ['OnInit', 'OnDestroy', 'OnInputsChanged'].filter((key) => typeof node[key] === 'function'),
      signals: fns(node.Signals),
      setters: fns(node.Setters)
    };
  }

  const touchesRuntime = (code: string) => {
    const s = runtimeSurface(code);
    return s.ports > 0 || s.hooks.length > 0 || s.signals.length > 0 || s.setters.length > 0;
  };

  /** One minimal body per member, using only that member. */
  const BODY_FOR: Record<(typeof SCRIPT_NODE_API_MEMBERS)[number], string> = {
    Inputs: 'Node.Inputs = { a: "string" };',
    Outputs: 'Node.Outputs = { b: "number" };',
    Signals: 'Node.Signals.Go = function () {};',
    Setters: 'Node.Setters.q = function (v) {};',
    OnInputsChanged: 'Node.OnInputsChanged = function () {};',
    OnInit: 'Node.OnInit = function () {};',
    OnDestroy: 'Node.OnDestroy = function () {};',
    // Assigned *by* the parser rather than by the body (`:171`), so a body that
    // calls it has been handed it — it is on the list because using it proves a
    // declared surface, not because assigning it creates one.
    setOutputs: 'Node.Outputs = { b: "number" };\nNode.OnInit = function () { Node.setOutputs({ b: 1 }); };'
  };

  it('every member on the list is one the runtime reads back', () => {
    for (const member of SCRIPT_NODE_API_MEMBERS) {
      expect([member, touchesRuntime(BODY_FOR[member])]).toEqual([member, true]);
    }
  });

  it('the predicate agrees with the runtime on each of them', () => {
    for (const member of SCRIPT_NODE_API_MEMBERS) {
      expect([member, scriptDeclaresRunnableSurface(BODY_FOR[member])]).toEqual([member, true]);
    }
  });

  it('an invented member moves neither the runtime nor the predicate', () => {
    // The control that makes the two assertions above mean something: a list
    // graded only by "the bodies work" would pass with `NotAThing` on it.
    expect(touchesRuntime('Node.NotAThing = function () {};')).toBe(false);
    expect(scriptDeclaresRunnableSurface('Node.NotAThing = function () {};')).toBe(false);
  });

  it('the reported defect leaves the runtime with nothing to call', () => {
    expect(touchesRuntime(REPORTED_DEFECT)).toBe(false);
    // ...while still minting ports, which is the whole trap.
    const ports: { name: string }[] = [];
    JavascriptNodeParser.parseAndAddPortsFromScript(REPORTED_DEFECT, ports, {});
    expect(ports.length).toBeGreaterThan(0);
  });
});

describe('FIX-006 §3 — the predicate', () => {
  it('accepts all three generations of declaration API', () => {
    // 1st gen, 2nd gen, and the 3rd the shipped library actually uses.
    expect(scriptDeclaresRunnableSurface('define({ inputs: {}, outputs: {}, run() {} });')).toBe(true);
    expect(scriptDeclaresRunnableSurface('script({ inputs: {}, outputs: {}, setup() {} });')).toBe(true);
    expect(scriptDeclaresRunnableSurface('Node.Inputs = { Url: "string" };')).toBe(true);
  });

  it('accepts the `Script` alias the parser injects in its code prefix', () => {
    // `getCodePrefix()` is `const Script = Node`, so both spellings are live.
    expect(scriptDeclaresRunnableSurface('Script.Signals.Go = function () {};')).toBe(true);
  });

  it('is case-sensitive: `script(` is the 2nd-gen call, `Script.` the alias', () => {
    expect(scriptDeclaresRunnableSurface('Script.Inputs = {};')).toBe(true);
    expect(scriptDeclaresRunnableSurface('script({});')).toBe(true);
  });

  it('rejects bodies that declare nothing', () => {
    expect(scriptDeclaresRunnableSurface(REPORTED_DEFECT)).toBe(false);
    expect(scriptDeclaresRunnableSurface('const x = 1 + 2;')).toBe(false);
    expect(scriptDeclaresRunnableSurface('console.log("hello");')).toBe(false);
    expect(scriptDeclaresRunnableSurface('(function () { var a = 1; })();')).toBe(false);
  });

  it('treats an absent or blank body as undeclared', () => {
    expect(scriptDeclaresRunnableSurface(undefined)).toBe(false);
    expect(scriptDeclaresRunnableSurface('')).toBe(false);
    expect(scriptDeclaresRunnableSurface('   \n\t ')).toBe(false);
  });
});

describe('FIX-006 §3 — the check', () => {
  it('warns on the reported node', () => {
    const found = check(scriptNode({ code: REPORTED_DEFECT }));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.UnrunnableScriptNode);
    expect(found[0].severity).toBe('warning');
    expect(found[0].location).toMatchObject({ component: COMPONENT, nodeId: 'script-1', nodeType: SCRIPT_NODE_TYPE });
  });

  it('names the Function node in its suggestion, which is the actual repair', () => {
    // The report is a node-choice defect before it is a code defect.
    expect(check(scriptNode({ code: REPORTED_DEFECT }))[0].suggestion).toContain('JavaScriptFunction');
  });

  it('uses the node label when it has one', () => {
    const found = check(scriptNode({ code: REPORTED_DEFECT }, { label: 'Discount' }));
    expect(found[0].message).toContain('"Discount"');
  });

  it('stays silent on a correctly-declared Script node (negative control)', () => {
    expect(check(scriptNode({ code: 'define({ inputs: { a: "number" }, outputs: {}, run() {} });' }))).toEqual([]);
    expect(check(scriptNode({ code: 'Node.Signals.Go = function () {};' }))).toEqual([]);
  });

  it('skips a node whose body lives in an external file', () => {
    // `code` says nothing about a body this check cannot read.
    expect(check(scriptNode({ code: REPORTED_DEFECT, useExternalFile: 'yes' }))).toEqual([]);
  });

  it('skips an empty node — unfinished is not wrong', () => {
    expect(check(scriptNode({}))).toEqual([]);
    expect(check(scriptNode({ code: '' }))).toEqual([]);
  });

  it('ignores every other node type, including the Function node', () => {
    const nodes: ScriptCarryingNode[] = [
      { id: 'f', type: 'JavaScriptFunction', parameters: { functionScript: 'const x = 1;' } },
      { id: 'g', type: 'Group', parameters: {} }
    ];
    expect(checkScriptNodeRunnable(nodes, { component: COMPONENT })).toEqual([]);
  });
});

/**
 * The wiring, not the rule.
 *
 * A check that is correct and unreached is not a gate, and this layer has been
 * bitten by exactly that before — `checkParameterValues` was written, exported
 * and called from one place, so the MCP write gate shipped fifteen error-severity
 * diagnostics it believed it was checking. `authoredPreconditionDiagnostics` is
 * the composition both clients call, so reaching it here is what makes the rule
 * true of the editor and of the MCP server rather than of this file.
 */
describe('FIX-006 §3 — reached through the shared precondition set', () => {
  const catalog = loadDefaultCatalog();

  const run = (code: string) =>
    authoredPreconditionDiagnostics({
      component: COMPONENT,
      nodes: [{ id: 'script-1', type: SCRIPT_NODE_TYPE, parameters: { code } }] as never,
      components: [COMPONENT],
      catalog
    });

  it('surfaces the warning from the composition both clients call', () => {
    expect(run(REPORTED_DEFECT).map((d) => d.code)).toContain(DiagnosticCode.UnrunnableScriptNode);
  });

  it('and stays out of it for a declared Script node', () => {
    expect(run('Node.Signals.Go = function () {};').map((d) => d.code)).not.toContain(
      DiagnosticCode.UnrunnableScriptNode
    );
  });
});
