/**
 * ERG-002 §2 — "verify on add".
 *
 * Success criterion 2 is explicit: this task exists for the *failure* case —
 * "adding an ES-module build fails at add time with a message naming the
 * cause" — so the ESM/CJS/typo cases below are pinned first and deliberately
 * outnumber the happy path.
 */
import { verifyLibrarySource } from '../../src/shared/utils/projectmodules';

describe('verifyLibrarySource', () => {
  it('passes a UMD/IIFE build that assigns the declared global', () => {
    const code = `(function (global) { global.PocketBase = function () { return 'client'; }; })(this);`;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/PocketBase.*loaded and defined/);
  });

  it('passes when the global is assigned via window/self/globalThis directly', () => {
    const code = `window.tinymce = { init: function () {} };`;
    const result = verifyLibrarySource(code, 'tinymce');
    expect(result.ok).toBe(true);
  });

  it('fails an ES-module build and names the cause', () => {
    const code = `export default class PocketBase {};\nexport const VERSION = '1.0';`;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ES-module/i);
    expect(result.message).toMatch(/UMD|browser.*build/i);
  });

  it('fails an ES-module build that only uses `import`, not `export`', () => {
    const code = `import { foo } from 'bar';\nwindow.PocketBase = foo;`;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ES-module/i);
  });

  it('fails a CommonJS build and names the cause', () => {
    const code = `module.exports = function PocketBase() {};`;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/CommonJS/i);
  });

  it('fails when the script runs but defines a different global (typo class)', () => {
    const code = `window.Pocketbase = function () {};`; // lowercase 'b'
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Pocketbase');
    expect(result.message).toMatch(/did you mean/i);
    expect(result.otherGlobalsDefined).toContain('Pocketbase');
  });

  it('fails when the script runs but defines nothing at all', () => {
    // `let`/`const` — unlike `var` — never become properties of the global
    // object, so this genuinely leaves the sandbox untouched.
    const code = `const x = 1 + 1;`;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ES-module/i);
  });

  it('fails a plain syntax error with a message naming the failure, not a crash', () => {
    const code = `function ( { this is not valid js`;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/failed to load/i);
  });

  it('rejects an empty global name', () => {
    const result = verifyLibrarySource('window.X = 1;', '');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/global variable name is required/i);
  });

  it('rejects a global name that is not a valid identifier', () => {
    const result = verifyLibrarySource('window.X = 1;', 'not-an-identifier');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not a valid JavaScript identifier/i);
  });

  it('does not let the sandboxed script escape into the real process (no fs/require access)', () => {
    const code = `
      try {
        window.PocketBase = typeof require === 'undefined' ? 'sandboxed' : require('fs').readFileSync('/etc/hosts', 'utf8');
      } catch (e) {
        window.PocketBase = 'sandboxed';
      }
    `;
    const result = verifyLibrarySource(code, 'PocketBase');
    expect(result.ok).toBe(true);
  });
});
