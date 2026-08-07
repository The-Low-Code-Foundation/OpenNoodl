#!/usr/bin/env node
/**
 * ALPHA-007 §2 — print a probe URL for the prefill contract.
 *
 * The spec says to hand-construct one URL against the live template and open it
 * in a browser *before* writing any dialog code. That check cannot be
 * automated: `github.com/.../issues/new` redirects to the sign-in page for
 * anyone without a session cookie, and a token in an `Authorization` header is
 * not a session — both an authenticated `curl` and an anonymous one come back
 * as the login page, so nothing about the rendered form can be observed from
 * here. See ALPHA-007-NOTES.md, "could not verify".
 *
 * So this prints the URL and says exactly what to look at. Ten seconds, in a
 * browser already signed in to GitHub.
 *
 *     node scripts/alpha-007/prefill-probe.js
 *
 * The durable half of the same check is
 * `packages/noodl-editor/tests-unit/alpha-007/issue-form-contract.test.ts`,
 * which asserts the editor's field ids and dropdown option strings against the
 * real `bug_report.yml`. That catches a rename on either side; only a human can
 * confirm GitHub honours the parameters at all.
 */

const path = require('path');
const { execFileSync } = require('child_process');

const EDITOR = path.join(__dirname, '..', '..', 'packages', 'noodl-editor');

const SNIPPET = `
const { composeReport } = require('./src/editor/src/utils/report/compose');
const report = composeReport({
  reportId: 'r-probe',
  capturedAt: new Date().toISOString(),
  user: {
    whatHappened: 'PREFILL PROBE — do not submit. Checking every field lands in the right place.',
    surface: 'Preview (the live app inside the editor)',
    severity: 'blocker',
    freshProject: 'Yes — a new project does it too',
    steps: '1. open this URL\\n2. read every field\\n3. close the tab'
  },
  app: { version: '0.1.0', buildNumber: '12', packaged: true },
  os: { platform: 'darwin', arch: 'arm64', release: '25.5.0' },
  editor: { route: 'editor', document: 'component' },
  project: null,
  errors: [{ at: Date.now(), level: 'error', text: 'PREFILL PROBE error line' }]
});
console.log(report.url);
`;

const url = execFileSync(
  'npx',
  ['ts-node', '-P', 'tsconfig.tests-main.json', '-e', SNIPPET],
  { cwd: EDITOR, encoding: 'utf8' }
).trim();

console.log('');
console.log('Open this in a browser already signed in to GitHub:');
console.log('');
console.log(url);
console.log('');
console.log(`(${url.length} bytes — the budget is 6144)`);
console.log('');
console.log('Confirm, then close the tab WITHOUT submitting:');
console.log('  1. "What happened" contains the PREFILL PROBE sentence.');
console.log('  2. "Where" is set to "Preview (the live app inside the editor)" —');
console.log('     a dropdown that prefills at all is the load-bearing question.');
console.log('  3. "How bad is it" is set to "Blocks me — I cannot work around it".');
console.log('     Note the em dash: if this one is blank while the others are not,');
console.log('     GitHub is not matching non-ASCII option text and the option');
console.log('     strings need rewording on BOTH sides.');
console.log('  4. "NodeGX version" reads "0.1.0 (build 12)".');
console.log('  5. "Operating system" is "macOS (Apple Silicon)".');
console.log('  6. "Does it happen in a brand-new project?" is the "Yes —" option.');
console.log('  7. "Any error text" holds the probe line inside a fence.');
console.log('  8. "Diagnostics" holds valid JSON inside a ```json fence.');
console.log('');
console.log('If any dropdown is empty while its text matches the YAML exactly,');
console.log('the design changes: dropdowns would have to move into the body.');
console.log('');
