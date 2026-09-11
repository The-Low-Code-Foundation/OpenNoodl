/**
 * A launch sweep must not kill a package suite somebody else is running.
 *
 * **The defect.** `NEVER_SWEEP` covered `test:ci`, `test:main`, the Electron runner and the MCP
 * servers — and nothing else. Measured 2026-08-29, every *package* gate was sweepable: the mcp,
 * backend, viewer-react and editor-unit suites all run as `.bin/jest` or `npm exec jest`, so any
 * peer launching the editor would have killed them.
 *
 * 🔴 **It fails silently and misleadingly.** A swept suite reports `EXIT=137`, prints **no summary
 * line**, leaves files unrun, and its tail is all ticks — so it reads as a passing-but-truncated
 * run, or gets attributed to whatever the reader last changed.
 *
 * ⚠️ **Why this test exists at all**: a dry run (`dev:stop -- --list`) on a quiet checkout cannot
 * demonstrate that a suite would be spared, because there is no suite to spare. The same reason
 * `sweepableGroups` is exported. This asks the predicate directly.
 *
 * ⚠️ It lives in `tests-unit/` because it is plain Node with no renderer — and, fittingly, that
 * puts it in `test:main`, the one gate that is itself safe to run beside a live stack.
 */

/* eslint-env jest */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isProtectedCommand } = require('../../../../scripts/devtools/dev-processes.js');

/**
 * Real command lines, as `ps` reports them.
 *
 * 🔴 Not invented: these are the forms the phase's own gates actually ran under. A test written
 * against `'jest'` would pass on a pattern that never matches anything a person types.
 */
const PROTECTED: Array<[string, string]> = [
  ['test:ci', 'npm run test:ci'],
  ['test:main', 'npm run test:main'],
  ['the electron suite host', 'Electron /r/packages/noodl-editor/tests/test.js --ci'],
  ['an MCP server', 'node /Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs'],
  ['mcp package suite', 'node /r/node_modules/.bin/jest --config packages/noodl-mcp/jest.config.js'],
  ['backend package suite', 'node /r/node_modules/.bin/jest tests/sb0'],
  ['editor unit specs', 'node /r/node_modules/.bin/jest tests-unit/sb-007'],
  ['a suite started via npm/npx', 'npm exec jest']
];

/**
 * 🔴 The half that stops this rule eating the tool.
 *
 * `dev:stop` exists to kill the dev stack. A pattern broad enough to spare a suite must not also
 * spare the editor, or the command silently stops working and the next person debugs a launcher
 * that will not die.
 */
const SWEEPABLE: Array<[string, string]> = [
  ['the editor itself', 'Electron /r/packages/noodl-editor --dev'],
  ['the webpack dev server', 'node /r/node_modules/.bin/webpack serve --config webpack.dev.js'],
  ['a render harness', 'node /r/scripts/devtools/render-from-disk.js /tmp/proj --port 5300'],
  ['a stray viewer', 'node /r/packages/noodl-viewer-react/dev-server.js']
];

describe('a launch sweep spares a suite somebody else is running', () => {
  it.each(PROTECTED)('spares %s', (_label, command) => {
    expect(isProtectedCommand(command)).toBe(true);
  });

  it.each(SWEEPABLE)('still sweeps %s', (_label, command) => {
    expect(isProtectedCommand(command)).toBe(false);
  });

  it('control: the predicate discriminates rather than answering one way', () => {
    // Both arms are non-empty and disagree — a rule that returned a constant would pass one
    // of the two blocks above and this makes that impossible to miss.
    expect(PROTECTED.length).toBeGreaterThan(0);
    expect(SWEEPABLE.length).toBeGreaterThan(0);
    expect(PROTECTED.every(([, c]) => isProtectedCommand(c))).toBe(true);
    expect(SWEEPABLE.some(([, c]) => isProtectedCommand(c))).toBe(false);
  });
});
