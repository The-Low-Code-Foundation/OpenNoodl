/**
 * CMP-008 — the callers. A correct function nothing calls is the failure this
 * phase has found repeatedly, and both of the modules CMP-008 adds live one
 * import away from code this runner cannot load: `apply.ts` reaches
 * `ProjectModel`, the undo queue and the filesystem, and `modulelibrarymodel.ts`
 * reaches the toast layer and Electron. Neither can be executed here.
 *
 * 🔴 **So these assertions are made against the PARSED SOURCE, not its text.**
 * A `toContain` over a source file passes on code that is commented out, dead
 * behind a `false`, or sitting inside a string — which is exactly the way a
 * gate ends up with a hole shaped like the defect. Every check below walks
 * TypeScript's own AST and counts real call expressions, real import
 * specifiers and real array spreads. Commenting the wiring out turns these red;
 * that is the control arm they exist to pass.
 *
 * What they cannot see: whether the call is reached at runtime, and whether the
 * values threaded into it are the right ones. That is the Electron suite's job
 * (`tests/import-engine/tokenGap-apply.test.ts`).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SRC = path.join(__dirname, '../../src/editor/src');

function parse(relative: string): ts.SourceFile {
  const file = path.join(SRC, relative);
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/** Names called as `foo(...)` or `a.foo(...)`, with their call counts. */
function calledNames(source: ts.SourceFile): Map<string, number> {
  const counts = new Map<string, number>();
  walk(source, (node) => {
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
      ? `${callee.expression.getText()}.${callee.name.text}`
      : undefined;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return counts;
}

/** Value bindings imported from a module whose specifier matches. */
function importedFrom(source: ts.SourceFile, matches: (specifier: string) => boolean): string[] {
  const names: string[] = [];
  walk(source, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    if (!ts.isStringLiteral(node.moduleSpecifier) || !matches(node.moduleSpecifier.text)) return;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        // An `import type {}` or a `{ type X }` element erases at runtime and
        // cannot be a caller of anything.
        if (node.importClause?.isTypeOnly || element.isTypeOnly) continue;
        names.push(element.name.text);
      }
    }
  });
  return names;
}

describe('CMP-008 — apply() is the caller', () => {
  const apply = parse('utils/import-engine/apply.ts');
  const calls = calledNames(apply);

  it('imports the decision as a VALUE, not as a type', () => {
    const names = importedFrom(apply, (s) => s.endsWith('/tokenGap') || s === './tokenGap');
    expect(names).toContain('tokenWarningsFor');
  });

  it('imports the target’s effective token vocabulary', () => {
    // 🔴 The EFFECTIVE set — the 192 shipped defaults merged with the project's
    // own overrides. Passing only the overrides would report every default as
    // missing on every import, which is a warning on everything and therefore
    // a warning on nothing.
    const names = importedFrom(apply, (s) => s.endsWith('StyleTokensModel/ProjectTokenCss'));
    expect(names).toContain('buildEffectiveTokens');
    expect(names).toContain('readStoredTokens');
  });

  it('actually calls them', () => {
    expect(calls.get('tokenWarningsFor')).toBe(1);
    expect(calls.get('buildEffectiveTokens')).toBe(1);
    expect(calls.get('readStoredTokens')).toBe(1);
  });

  it('🔴 calls it on the UNCONDITIONAL path', () => {
    /*
     * The arm that made this spec exist. An earlier shape guarded the call with
     * `if (plan.origin.kind !== 'export-staging')`, and the whole feature could
     * then be switched off by editing that to `if (false && …)` — the import,
     * the call expression and the spread into `warnings` all survive, so every
     * other check in this file still passed while nothing ran. A static gate
     * cannot see reachability, so the fix was to remove the thing it had to
     * guess about: the export exemption moved inside `tokenWarningsFor`, where
     * it is graded by being RUN, and this asserts the call site has no
     * condition left to subvert.
     */
    let guarded: string | undefined;
    const conditional = (n: ts.Node) =>
      ts.isIfStatement(n) ||
      ts.isConditionalExpression(n) ||
      (ts.isBinaryExpression(n) &&
        (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken));

    walk(apply, (node) => {
      if (!ts.isCallExpression(node)) return;
      if (node.expression.getText() !== 'tokenWarningsFor') return;
      for (let parent = node.parent; parent && !ts.isFunctionLike(parent); parent = parent.parent) {
        if (conditional(parent)) guarded = parent.getText().split('\n')[0];
      }
    });
    expect(guarded).toBeUndefined();
  });

  it('reads the loaded MODEL rather than a project.json off disk', () => {
    // The v2 trap. `entryTokens` scans `project.json`, which reads empty on a
    // v2 project; `apply()` holds a model loaded through the format-aware
    // `projectFromDirectory`, so it must serialise that instead.
    expect(calls.has('importProject.toJSON')).toBe(true);
  });

  it('🔴 spreads the result into the warnings the caller returns', () => {
    // Computing the warning and not shipping it is the same defect one step
    // later. This asserts a real spread element in a real array literal.
    let spreadIntoWarnings = false;
    walk(apply, (node) => {
      if (!ts.isVariableDeclaration(node)) return;
      if (!ts.isIdentifier(node.name) || node.name.text !== 'warnings') return;
      const init = node.initializer;
      if (!init || !ts.isArrayLiteralExpression(init)) return;
      for (const element of init.elements) {
        if (ts.isSpreadElement(element) && element.expression.getText() === 'tokenWarnings') {
          spreadIntoWarnings = true;
        }
      }
    });
    expect(spreadIntoWarnings).toBe(true);
  });

  it('leaves the export exemption where it can be executed', () => {
    // It must NOT be here any more — see the unconditional-path spec above.
    // `tokenGap.test.ts` grades the exemption itself, by calling it.
    let namesExportStaging = false;
    walk(apply, (node) => {
      if (ts.isStringLiteral(node) && node.text === 'export-staging') namesExportStaging = true;
    });
    expect(namesExportStaging).toBe(false);
  });
});

describe('CMP-008 — the one-click installer is the caller', () => {
  const model = parse('models/modulelibrarymodel.ts');
  const calls = calledNames(model);

  it('imports the toast decision as a value', () => {
    expect(importedFrom(model, (s) => s.endsWith('installWarningToast'))).toContain('installWarningToast');
  });

  it('calls it, and shows the result', () => {
    expect(calls.get('installWarningToast')).toBe(1);
    expect(calls.get('ToastLayer.showWarning')).toBe(1);
  });

  it('🔴 does it on the branch that opens NO flow', () => {
    // The whole point of AC3. `_install` forks on `dryRun.hasCollisions`; the
    // colliding branch opens the import flow and gets a result stage, the
    // other returns. The call must be inside the early-return branch — a
    // warning hosted in the flow would be present in the code and absent on
    // the most common install, which is the state this task found.
    let insideNoCollisionBranch = false;
    walk(model, (node) => {
      if (!ts.isIfStatement(node)) return;
      if (!node.expression.getText().includes('dryRun.hasCollisions')) return;
      // `if (!dryRun.hasCollisions) { ... }` — the one-click branch.
      if (!ts.isPrefixUnaryExpression(node.expression)) return;
      if (calledNames(node.thenStatement as unknown as ts.SourceFile).has('installWarningToast')) {
        insideNoCollisionBranch = true;
      }
    });
    expect(insideNoCollisionBranch).toBe(true);
  });
});
