import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * EXP-011 §16 — the component stack pair (`PageStackNavigate`, `PageStackNavigateBack`),
 * and the grep that wrote a false sentence into two ledger rows and two session prompts.
 *
 * The sentence was: *"a component stack also feeds `Page Inputs` at runtime (`_setPageParams`
 * has two callers)"*. It is wrong twice over, and this file pins both halves.
 *
 * 🔴 **The failure this file is built against is the one that actually happened**: a text search
 * for `_setPageParams` hits `navigation-stack.tsx`, because that file carries a *comment* naming
 * the Router's call as an analogy for its own cross-node reach. Text says yes; the AST says no.
 * So the text match is asserted here as a KNOWN-FIRING CONTROL — if it ever stops matching, this
 * file is measuring nothing and says so — and the load-bearing assertion is made over call
 * expressions, where a comment cannot be counted.
 *
 * 🔴 Both readings are pinned against the runtime files, so the claim FAILS the day it stops
 * being true rather than becoming folklore in a fifth ledger row (§15.1's rule, applied to the
 * sentence §15.6 itself relayed).
 */

const NAV_DIR = path.join(__dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'navigation');
const RUNTIME_ROUTER = path.join(NAV_DIR, 'router.tsx');
const RUNTIME_STACK = path.join(NAV_DIR, 'navigation-stack.tsx');
const RUNTIME_PUSH = path.join(NAV_DIR, 'navigate.ts');

const read = (p: string) => fs.readFileSync(p, 'utf8');

const parse = (p: string) =>
  ts.createSourceFile(
    p,
    read(p),
    ts.ScriptTarget.ESNext,
    true,
    p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

/** Every `x.<method>(...)` call in a source text, by method name. Comments are not in the AST. */
const countMethodCallsIn = (source: string, fileName: string, method: string): number => {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  let n = 0;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.text === method) n++;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return n;
};

const countMethodCalls = (file: string, method: string): number =>
  countMethodCallsIn(read(file), file, method);

/** Occurrences of a bare string, comments included — i.e. what a grep sees. */
const countText = (file: string, needle: string): number => read(file).split(needle).length - 1;

/**
 * 🔴 The instrument, proved before it is trusted.
 *
 * The whole finding rests on one discrimination: a COMMENT mentioning `_setPageParams` must not
 * be counted, and a CALL must be. A helper that returned 0 for everything would make every
 * assertion below pass while measuring nothing — the shape this phase keeps hitting. So the two
 * arms differ in exactly one character (the `//`) and must disagree.
 */
describe('EXP-011 §16 — the counter can tell a comment from a call', () => {
  const CALL = 'const f = () => { node._setPageParams(params); };';
  const COMMENTED = 'const f = () => { // node._setPageParams(params);\n };';

  it('counts a real call', () => {
    expect(countMethodCallsIn(CALL, 'probe.ts', '_setPageParams')).toBe(1);
  });

  it('does not count a commented one — and a text search cannot tell them apart', () => {
    expect(countMethodCallsIn(COMMENTED, 'probe.ts', '_setPageParams')).toBe(0);
    // The control: to a grep these two arms are identical. That is the entire bug.
    expect(CALL.includes('_setPageParams')).toBe(true);
    expect(COMMENTED.includes('_setPageParams')).toBe(true);
  });
});

describe('EXP-011 §16 — a Component Stack does not feed Page Inputs', () => {
  it('CONTROL: a text search for _setPageParams DOES hit navigation-stack.tsx', () => {
    // The known-firing signal. This is the reading that produced the false sentence; if it ever
    // stops firing, the AST assertion below is no longer excluding anything and this file is a
    // pair of vacuous greens.
    expect(countText(RUNTIME_STACK, '_setPageParams')).toBeGreaterThan(0);
  });

  it('but navigation-stack.tsx never CALLS _setPageParams — the text hit is a comment', () => {
    expect(countMethodCalls(RUNTIME_STACK, '_setPageParams')).toBe(0);

    // And it is a comment specifically, not a call the AST walk missed: every occurrence of the
    // string in that file sits on a line whose first non-space characters are `//`.
    const lines = read(RUNTIME_STACK).split('\n');
    const hits = lines.filter((l) => l.includes('_setPageParams'));
    expect(hits.length).toBeGreaterThan(0);
    for (const line of hits) expect(line.trimStart().startsWith('//')).toBe(true);
  });

  it('both _setPageParams callers are the Router, in one file that defines one node', () => {
    expect(countMethodCalls(RUNTIME_ROUTER, '_setPageParams')).toBe(2);

    // The claim "two callers" was true; "one of them is a stack" was the error. Both calls are
    // inside `RouterNode`, which is the only node definition router.tsx exports.
    const src = read(RUNTIME_ROUTER);
    expect(src).toContain('const RouterNode = {');
    expect(src).toContain('export default createNodeFromReactComponent(RouterNode);');
    // A second node definition in this file would break the inference above: exactly one node
    // is constructed here, so there is no other `this` for either call to have belonged to.
    expect(countText(RUNTIME_ROUTER, 'createNodeFromReactComponent(')).toBe(1);
  });

  it('what the stack DOES feed is the pushed component’s own Component Inputs', () => {
    // Three paths create the content node and set its inputs directly: the initial render,
    // `replaceAsync` and `navigateAsync`. None of them consults PageInputs.
    const sf = parse(RUNTIME_STACK);
    let contentSetInput = 0;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'setInputValue' &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'content'
      ) {
        contentSetInput++;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(contentSetInput).toBe(3);
  });

  it('and the pusher’s pm- ports are derived from the target component’s inputPorts', () => {
    const src = read(RUNTIME_PUSH);
    expect(src).toContain('for (const inputName in component.inputPorts) {');
    expect(src).toContain("name: 'pm-' + inputName,");
  });
});

describe('EXP-011 §16 — why the pair is re-tiered rather than translated', () => {
  it('the back channel carries values and signals BACKWARDS, which a url cannot express', () => {
    const src = read(RUNTIME_PUSH);
    // The pusher grows an output port per back-result and per back-action of the target.
    expect(src).toContain("name: 'backResult-' + p,");
    expect(src).toContain("name: 'backAction-' + a,");
    // And it receives them through a callback handed to the stack, not through a location read.
    expect(src).toContain('backCallback: (action, results) => {');
  });

  it('the stack syncs the url only when useRoutes is set, so the same graph is sometimes a route', () => {
    const src = read(RUNTIME_STACK);
    expect(src).toContain('if (this._internal.useRoutes && typeof window !== \'undefined\' && window.history !== undefined) {');
  });

  /**
   * EXP-011 §61 (session 86). This row used to pin all three as `deferred` — "if `Page Stack` is ever
   * translated, this test fails, which is exactly when the pair should be reconsidered". That moment came:
   * the container translated in §61 and the pair landed WITH it, as §16.3 said they must. The pin is now the
   * positive claim, and the three findings above stay as they were — the runtime facts they measure are the
   * ones §61 transcribed (the back channel as a callback, the url only with useRoutes, the pushed component's
   * own Component Inputs set by the stack).
   */
  it('the container these two drive translated in §61, and the pair landed with it — not before', () => {
    const ledger = JSON.parse(read(path.join(__dirname, '..', 'coverage-ledger.json')));
    const rows: Record<string, unknown>[] = [];
    const walk = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        if ('typeName' in (o as object)) rows.push(o as Record<string, unknown>);
        Object.values(o as object).forEach(walk);
      }
    };
    walk(ledger);
    const byName = (n: string) => rows.find((r) => r.typeName === n);

    for (const n of ['Page Stack', 'PageStackNavigate', 'PageStackNavigateBack']) {
      expect(byName(n)?.status).toBe('translated');
      expect(String(byName(n)?.note)).toContain('EXP-011 §61');
      expect(byName(n)?.exemption).toBeUndefined();
    }
    // The three moved together: a pusher with no stack has nothing to push onto, and the ledger says so once
    // per row — the pair's notes name the container's mechanism, the container's names the pair's.
    expect(String(byName('PageStackNavigate')?.note)).toContain('replaceAsync installs none');
    expect(String(byName('PageStackNavigateBack')?.note)).toContain('getNodesWithType, non-recursive');
    expect(String(byName('Page Stack')?.note)).toContain('no transition');
  });

  it('the Pop reaches its stack through a prop because the runtime reaches the Pop non-recursively', () => {
    // §61.0's design decision, pinned against the file it was read from: the stack installs the back
    // callback on `content.nodeScope.getNodesWithType(...)` — the pushed component's OWN scope. A Pop one
    // component below never receives it, so a reserved prop the stack row passes is the exact reach; a
    // context would reach further than the runtime does.
    const src = read(RUNTIME_STACK);
    expect(src).toContain("content.nodeScope.getNodesWithType('PageStackNavigateBack')");
    expect(src).not.toContain("getNodesWithTypeRecursive('PageStackNavigateBack')");
    // And only the push path installs it: replace and reset build the content without one. Counted over CALL
    // expressions — the text count reads 2, because the type the call is made through DECLARES the method too,
    // which is this file's own lesson about greps, met again while writing this row.
    expect(countMethodCalls(RUNTIME_STACK, '_setBackCallback')).toBe(1);
    expect(countText(RUNTIME_STACK, '_setBackCallback(')).toBe(2);
  });
});
