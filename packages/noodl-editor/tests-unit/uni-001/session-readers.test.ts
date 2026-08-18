/**
 * UNI-001 AC4 — "the login gates nothing", made checkable.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THIS FILE REPLACES A GREP THAT COULD NOT PASS. AC4 as written asks that
 *
 *      "grep the editor for reads of the session outside the launcher/account module comes
 *       back empty — the 'gates nothing' principle is structurally visible"
 *
 * and the literal grep has returned ONE file since UNI-016 shipped, before UNI-001 had an
 * issuer at all: the composer (`AskAboutNodeDialog.tsx`), which is neither the launcher nor the
 * account module. Two sessions recorded the criterion as "needs a verdict rather than a run"
 * rather than reporting a pass it did not have.
 *
 * 🔴 **THE VERDICT, and the reason the wording moved rather than the code.** The criterion's
 * second clause is the real requirement and the first clause was a proxy for it. A *location*
 * test says nothing about gating: a read inside the launcher could withhold a feature, and a
 * read in the composer — the one that exists — withholds nothing. It picks a **transport**
 * (post directly, or hand off to the browser) and adds an **offer** (a sign-in button). The
 * browser hand-off, which needs no account, is the CTA when signed out.
 *
 * So AC4 is asserted here as what it means:
 *
 *   1. the set of modules that read the session is a **recorded** set, so a new reader is a
 *      failing test and somebody has to write down why it is allowed; and
 *   2. in the one reader outside the launcher/account surfaces, **no capability sits inside a
 *      session branch** — proven against the real source, with the signed-in post button as the
 *      known-firing control that the checker can see a gate when there is one.
 *
 * ⚠️ **WHAT A GREEN RUN HERE DOES NOT PROVE.** That the editor is usable signed out — that is
 * AC1's job and it is the whole `test:main`/`test:ci` baseline, not this file. This file proves
 * the *structure* AC4 asks to be visible, which is why it is worth its ink and why it is not a
 * substitute for the baseline.
 *
 * 🔴 Source analysis, because this checkout's jest runner has no DOM and no React —
 * `base-dialog/measuring-copy.test.ts` is the precedent and the sibling `*-offers-signin.test.ts`
 * files follow it. Controls are derived from the REAL CURRENT SOURCE rather than fixtures, for
 * the reason phase 67 recorded twice: an instrument aimed at a name that has since been renamed
 * reports a clean sweep of nothing.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const PACKAGES = join(__dirname, '../../..');
const EDITOR_SRC = join(PACKAGES, 'noodl-editor/src/editor/src');

/** Comments stripped: a file that NAMES the session in prose is not a file that reads it. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', 'out']);
const CODE = /\.(ts|tsx|js|jsx)$/;

/**
 * 🔴 The population is DERIVED FROM DISK, never listed. A hard-coded list of directories cannot
 * see a directory that did not exist when it was written, which is exactly the reader this gate
 * is here to catch.
 */
function sourceFiles(): string[] {
  const found: string[] = [];
  for (const pkg of readdirSync(PACKAGES)) {
    if (SKIP.has(pkg)) continue;
    const src = join(PACKAGES, pkg, 'src');
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    walk(src, found);
  }
  return found;
}

function walk(dir: string, into: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, into);
    else if (CODE.test(entry.name)) into.push(full);
  }
}

/** Every way the store can be reached. The KEY is here too: a raw `JSONStorage` read of it. */
const SESSION_TOKENS = [
  'communitysession',
  'readCommunitySession',
  'writeCommunitySession',
  'clearCommunitySession',
  'COMMUNITY_SESSION_KEY'
];

function readsTheSession(code: string): boolean {
  return SESSION_TOKENS.some((token) => code.includes(token));
}

const FILES = sourceFiles();
const READERS = FILES.filter((file) => readsTheSession(stripComments(readFileSync(file, 'utf8')))).map((file) =>
  relative(PACKAGES, file).split(sep).join('/')
);

/**
 * 🔴 THE RECORDED SET, and the third column is the point of the file. Adding a row is cheap and
 * deliberate; what must not happen is a reader arriving with nobody having answered the
 * question. **The question a new row has to answer is "what does this read WITHHOLD?" — and the
 * only acceptable answer is "nothing".**
 */
const ALLOWED: Record<string, string> = {
  'noodl-editor/src/editor/src/models/community/communitysession.ts':
    'the store itself — the only module that touches the key',
  'noodl-editor/src/editor/src/models/community/communitysignin.ts':
    'the account module: the device flow writes it, sign-out clears it',
  'noodl-editor/src/editor/src/pages/ProjectsPage/useCommunityAccount.ts':
    'the launcher card adapter — draws the offer or the chip, gates no project and no feature',
  'noodl-editor/src/editor/src/views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx':
    'the composer: CHOOSES A TRANSPORT (direct post vs the browser hand-off, which needs no account) and adds a sign-in offer. Withholds nothing — asserted structurally below'
};

describe('the instrument itself — controls before any absence is claimed', () => {
  it('swept a real population, not an empty one', () => {
    // 🔴 A misconfigured root returns zero files, and then EVERY absence assertion below passes
    // for the worst possible reason. Measured 2026-08-18: 2548 source files.
    expect(FILES.length).toBeGreaterThan(2000);
  });

  it('finds the module it is looking for — a known-firing signal', () => {
    expect(READERS).toContain('noodl-editor/src/editor/src/models/community/communitysession.ts');
  });

  it('does NOT match everything — a token that is absent reads absent', () => {
    const absent = FILES.filter((file) => readFileSync(file, 'utf8').includes('readCommunityPassphrase'));
    expect(absent).toEqual([]);
  });

  it('the stripper removes comments and leaves code alone', () => {
    const sample = "const a = 1; /* readCommunitySession in a block */\n// readCommunitySession in a line\nconst b = 2;";
    expect({
      stripped: readsTheSession(stripComments(sample)),
      unstripped: readsTheSession(sample)
    }).toEqual({ stripped: false, unstripped: true });
  });
});

describe('AC4 — the session has a recorded set of readers', () => {
  it('and nothing reads it that is not on the list', () => {
    const unexpected = READERS.filter((file) => !(file in ALLOWED));
    // 🔴 If this is red, do NOT add the row to make it green. Answer the question first: does
    // the new reader change what the editor can DO without an account? If it does, the reader
    // is the bug — principle 1 of this phase, and it is non-negotiable.
    expect(unexpected).toEqual([]);
  });

  it('and every recorded reader still exists — the list cannot rot into a list of ghosts', () => {
    const ghosts = Object.keys(ALLOWED).filter((file) => !READERS.includes(file));
    expect(ghosts).toEqual([]);
  });
});

/**
 * The structural half. Given JSX, find the regions guarded by a `session` conditional, by
 * balanced-brace scanning from each `{session…` expression container.
 *
 * ⚠️ `${session.handle …}` inside a template literal is a substitution, not a guard; the `$`
 * is excluded so a label does not read as a gate.
 */
function sessionGuardedRegions(code: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  const opener = /\{\s*session\b/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(code)) !== null) {
    const start = match.index;
    if (start > 0 && code[start - 1] === '$') continue;
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) {
          regions.push([start, i]);
          break;
        }
      }
    }
  }
  return regions;
}

function isGated(code: string, needle: string): boolean {
  const at = code.indexOf(needle);
  if (at === -1) throw new Error(`the anchor ${needle} is not in the source any more — this spec is blind, fix it`);
  return sessionGuardedRegions(code).some(([from, to]) => at > from && at < to);
}

const composer = stripComments(
  readFileSync(join(EDITOR_SRC, 'views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx'), 'utf8')
);

describe('the region finder', () => {
  it('sees a guard when there is one and not when there is not', () => {
    const sample = 'a(); {session && (<B onClick={() => gated()} />)} c(); free();';
    expect({
      gated: isGated(sample, 'gated()'),
      free: isGated(sample, 'free()')
    }).toEqual({ gated: true, free: false });
  });
});

describe('AC4 — the composer withholds nothing, proven against the real source', () => {
  /**
   * 🔴 THE CONTROL PAIR, and both arms are REAL CODE rather than a fixture. The post button is
   * legitimately inside `{session && (…)}` — it is the surface that needs a token. If the
   * checker cannot see THAT gate, it cannot be trusted to report the hand-off ungated.
   */
  it('sees the signed-in post button as gated — the known-broken arm', () => {
    expect(isGated(composer, 'postToBench(session.token)')).toBe(true);
  });

  it('and the browser hand-off — the arm that needs no account — is NOT inside any session branch', () => {
    // The capability itself: ask your question and get it to the community. A person with no
    // account can do it, and moving this button inside either session branch is the regression
    // this assertion exists to catch.
    expect(isGated(composer, 'void handOff()')).toBe(false);
  });

  it('and neither is the Cancel button, so the dialog is never a trap', () => {
    expect(isGated(composer, 'onClick={onClose}')).toBe(false);
  });
});
