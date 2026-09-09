/**
 * HLS-009 — the four states this editor can be in when an agent asks it to open a project.
 *
 * ⚠️ **Why this is here and not in the jasmine suite.** Three of the four dispositions are states
 * the editor is *already in* when the request lands, and two of those (a different project open
 * with an edit still inside the one-second save debounce; a request naming a directory that has
 * since moved) are the ones a person will not reproduce reliably by hand. Graded here they are
 * assertions; graded by launching the app they would in practice be graded by reading the code.
 *
 * The module under test imports nothing, which is what makes that possible — see its header.
 */

import { comparablePath, decideOpenDisposition } from '../src/editor/src/models/externalProjectOpen/decide';

const PROJECT = '/Users/someone/projects/shop';
const OTHER = '/Users/someone/projects/blog';

/** A request naming a real project directory. The tests vary one fact at a time from here. */
function facts(overrides: Partial<Parameters<typeof decideOpenDisposition>[0]> = {}) {
  return {
    requested: PROJECT,
    open: undefined,
    exists: true,
    isProject: true,
    caseInsensitive: false,
    ...overrides
  };
}

describe('HLS-009 — what the editor does with an openProject request', () => {
  it('opens it when nothing is open', () => {
    expect(decideOpenDisposition(facts())).toEqual({ action: 'open' });
  });

  /**
   * 🔴 AC2, and the reason it is stated as a *disposition* rather than as "does not crash".
   *
   * An agent asks twice for ordinary reasons — a retry, two tools that both want the project
   * visible, the person asking again. The second ask must not reload the project, because a
   * reload disposes the live `ProjectModel` and takes any edit still inside the save debounce
   * with it. `already-open` is the branch that does nothing, and this is what pins it there.
   */
  it('treats the project it already has open as already open, not as a second open', () => {
    expect(decideOpenDisposition(facts({ open: PROJECT }))).toEqual({ action: 'already-open' });
  });

  /**
   * The same project asked for a second time, spelled the way a tool argument gets spelled: with
   * a trailing slash, or — on macOS and Windows — with different case. Both are string-unequal
   * and filesystem-equal, and treating either as a different project is a reload of the project
   * the person is working in.
   */
  it('recognises it through a trailing separator', () => {
    expect(decideOpenDisposition(facts({ requested: PROJECT + '/', open: PROJECT }))).toEqual({
      action: 'already-open'
    });
  });

  it('recognises it through case, but only where the filesystem does', () => {
    const shouted = { requested: PROJECT.toUpperCase(), open: PROJECT };
    expect(decideOpenDisposition(facts({ ...shouted, caseInsensitive: true }))).toEqual({ action: 'already-open' });
    // 🔴 The negative half, which is the one that makes the positive mean something: on a
    // case-sensitive filesystem those genuinely are two directories, and folding them would open
    // the wrong project — or refuse to open a real one because a similarly-named project was up.
    expect(decideOpenDisposition(facts({ ...shouted, caseInsensitive: false }))).toEqual({
      action: 'switch',
      leaving: PROJECT
    });
  });

  it('switches away from a different project, and names the one it is leaving', () => {
    expect(decideOpenDisposition(facts({ open: OTHER }))).toEqual({ action: 'switch', leaving: OTHER });
  });

  describe('refusals — each names a condition the caller can correct without asking a person', () => {
    it('refuses a missing directory', () => {
      expect(decideOpenDisposition(facts({ requested: undefined })).action).toBe('refuse');
      expect(decideOpenDisposition(facts({ requested: '   ' })).action).toBe('refuse');
      // Untrusted input off a socket: any JSON value can arrive in that field.
      expect(decideOpenDisposition(facts({ requested: 42 })).action).toBe('refuse');
    });

    /**
     * ⚠️ Checked before existence on purpose. A relative path resolves against the *editor's*
     * working directory — `/` on a packaged macOS app — so it would usually fail the existence
     * check too, and the caller would be told there is no such directory about a path it never
     * named. A true sentence about the wrong thing is the harder bug to find.
     */
    it('refuses a relative path, and says why rather than reporting it as missing', () => {
      const refusal = decideOpenDisposition(facts({ requested: 'projects/shop', exists: false }));
      expect(refusal.action).toBe('refuse');
      expect(refusal.action === 'refuse' && refusal.reason).toContain('relative path');
    });

    it('accepts the two other spellings of absolute', () => {
      expect(decideOpenDisposition(facts({ requested: 'C:\\projects\\shop' })).action).toBe('open');
      expect(decideOpenDisposition(facts({ requested: '\\\\server\\share\\shop' })).action).toBe('open');
    });

    it('refuses a directory that is not there', () => {
      const refusal = decideOpenDisposition(facts({ exists: false }));
      expect(refusal.action === 'refuse' && refusal.reason).toContain('no directory');
    });

    it('refuses a directory that is not a project, and says which files it looked for', () => {
      const refusal = decideOpenDisposition(facts({ isProject: false }));
      expect(refusal.action === 'refuse' && refusal.reason).toContain('nodegx.project.json');
    });

    /**
     * 🔴 A refusal must beat `already-open`, not be shadowed by it. Otherwise an agent that asks
     * for a project whose directory has been deleted *while it was open* is told "already open" —
     * true of the editor's memory, false of the disk, and it would keep the caller from noticing
     * that the folder it is writing to is gone.
     */
    it('refuses a vanished directory even when it is the open one', () => {
      expect(decideOpenDisposition(facts({ open: PROJECT, exists: false })).action).toBe('refuse');
    });
  });
});

describe('comparablePath', () => {
  it('trims repeated separators of either kind but never empties the path', () => {
    expect(comparablePath('/a/b//', false)).toBe('/a/b');
    expect(comparablePath('C:\\a\\b\\', false)).toBe('C:\\a\\b');
    expect(comparablePath('/', false)).toBe('/');
  });

  /**
   * ⚠️ The value is for comparison only. Nothing may open the folded string: `caseInsensitive`
   * says how to *compare*, not how to *spell*, and a lower-cased path is wrong on every
   * case-sensitive filesystem. This asserts the folding is confined to the returned value by
   * showing the input spelling is what survives when folding is off.
   */
  it('folds case only when told to', () => {
    expect(comparablePath('/A/B', true)).toBe('/a/b');
    expect(comparablePath('/A/B', false)).toBe('/A/B');
  });
});
