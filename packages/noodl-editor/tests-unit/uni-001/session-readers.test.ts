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
    'the composer: CHOOSES A TRANSPORT (direct post vs the browser hand-off, which needs no account) and adds a sign-in offer. Withholds nothing — asserted structurally below',
  'noodl-editor/src/editor/src/hooks/useCommunityMirror.ts':
    'UNI-011/D21 community panel: the token is a BEARER HEADER on reads that already work without one, plus the handle in the header line. Reading is UNI-011 AC4 and is ungated — asserted structurally below',
  'noodl-editor/src/editor/src/hooks/useCommunityThread.ts':
    'NAT-007 thread view: the token is a BEARER HEADER on a read the platform serves to strangers — `GET /api/v1/bench/threads/:id` says so in its own module note. Withholds nothing: the module that decides what is drawn never sees a session at all — asserted structurally below',
  'noodl-editor/src/editor/src/hooks/useCommunityPeople.ts':
    'NAT-008 people: the token is a BEARER HEADER on two reads the platform serves to strangers — `/people` says so in its own lede, *"readable without an account, like everything else here"*. Withholds nothing: the directory, the profile, the search and the filters are all computed by `peopleview.ts`, which never sees a session — asserted structurally below',
  'noodl-editor/src/editor/src/models/lessoncheck.ts':
    'UNI-006 bridge: read ONLY inside liveSubmitAssignment, to hand an ASSIGNED lesson to the org that set it. Withholds nothing — grading, installing, resetting, progress and feedback are untouched, and an entry can only carry an assignment if an account obtained it, so there is nothing for an account-less editor to be refused. Asserted structurally below'
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
function sessionGuardedRegions(code: string, opener: RegExp = /\{\s*session\b/g): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  opener.lastIndex = 0;
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

function isGated(code: string, needle: string, opener?: RegExp): boolean {
  const at = code.indexOf(needle);
  if (at === -1) throw new Error(`the anchor ${needle} is not in the source any more — this spec is blind, fix it`);
  return sessionGuardedRegions(code, opener).some(([from, to]) => at > from && at < to);
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

/**
 * UNI-011 / D21 — the second reader outside the launcher, added 2026-08-19.
 *
 * 🔴 **The question ALLOWED's third column demands, answered before the row was added:** does the
 * community panel withhold anything without an account? **No.** Discussions, guides and replays
 * are read from `/api/v1` routes that answer a request with no bearer header — UNI-011 AC4,
 * *"reading works signed out, because it does on the web"* — and the token only adds `standing`,
 * which is not a withheld feature but a fact that does not exist for a person with no account.
 *
 * ⚠️ **The gate this panel DOES have is not a session gate**, and conflating the two would be
 * the flattening this phase keeps paying for. `{ surface: 'hidden' }` comes from D15 — the
 * platform saying the community does not exist for this viewer — and it is about *who the
 * viewer is*, not about *whether they are signed in*. `mirrorview.test.ts` owns that one, with
 * its own control pair.
 */
const communityPanel = stripComments(readFileSync(join(EDITOR_SRC, 'views/panels/CommunityPanel/CommunityPanel.tsx'), 'utf8'));

/** The panel's conditionals are on `view.viewer`, not on a bare `session`. */
const VIEWER_OPENER = /\{\s*view\.viewer\b/g;

describe('AC4 — the community panel withholds nothing, proven against the real source', () => {
  it('sees the signed-out sign-in POINTER as gated — the known-broken arm', () => {
    // 🔴 The control. This sentence is legitimately inside `{view.viewer === false && (…)}`:
    // it is the one thing that should only appear to somebody without an account. If the
    // checker cannot see THIS gate it cannot be trusted to report the sections ungated.
    expect(isGated(communityPanel, 'Sign in from the launcher', VIEWER_OPENER)).toBe(true);
  });

  it('and the three content sections are NOT inside any viewer branch', () => {
    expect({
      discussions: isGated(communityPanel, 'title="Discussions"', VIEWER_OPENER),
      guides: isGated(communityPanel, 'title="Guides and tutorials"', VIEWER_OPENER),
      replays: isGated(communityPanel, 'title="Call replays"', VIEWER_OPENER)
    }).toEqual({ discussions: false, guides: false, replays: false });
  });

  it('and neither is the link out to the web community', () => {
    // The capability a person with no account has on the web, kept in the editor.
    expect(isGated(communityPanel, 'label="Open community.nodegx.io"', VIEWER_OPENER)).toBe(false);
  });
});

/**
 * UNI-006's bridge — the reader added on 2026-08-19, and the two things that make it a
 * "withholds nothing" row rather than a row somebody wrote to go green.
 *
 * 🔴 The question this file demands is *what does this read WITHHOLD?* For `lessoncheck.ts`
 * the answer is nothing, and it rests on two structural facts rather than on a promise:
 * grading happens **before** the session is consulted, and the session is consulted **only**
 * inside the live submit port. A learner with no account presses "check my work", is graded by
 * both engines, and has the result written to their card exactly as they were before this
 * existed.
 */
describe('AC4 — the lesson bridge withholds nothing, proven against the real source', () => {
  const lessoncheck = stripComments(readFileSync(join(EDITOR_SRC, 'models/lessoncheck.ts'), 'utf8'));

  it('records the grade BEFORE anything touches the network — the order is the guarantee', () => {
    const graded = lessoncheck.indexOf('deps.register.recordGrade(');
    const submitted = lessoncheck.indexOf('submitIfAssigned(');
    // A missing anchor means this spec is blind, so it fails rather than passing vacuously.
    expect(graded).toBeGreaterThan(-1);
    expect(submitted).toBeGreaterThan(-1);
    // 🔴 Swap these two lines and an offline learner loses a grade they had earned, silently.
    expect(graded).toBeLessThan(submitted);
  });

  it('reads the session ONLY inside the live submit port, never on the grading path', () => {
    const port = lessoncheck.indexOf('async function liveSubmitAssignment');
    const reads = [...lessoncheck.matchAll(/readCommunitySession/g)].map((m) => m.index ?? -1);
    expect(port).toBeGreaterThan(-1);
    // Non-vacuity: if the token stopped appearing at all, "every occurrence is inside the
    // port" would be true of an empty set and this spec would guard nothing.
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((at) => at > port)).toBe(true);
  });

  it('and a lesson with no assignment returns before the port is reached', () => {
    // The capability an account-less editor keeps: grade a lesson you installed yourself.
    // `submitIfAssigned` leaves on `!entry.assignment` before any transport exists.
    const body = lessoncheck.slice(lessoncheck.indexOf('async function submitIfAssigned'));
    const guard = body.indexOf("if (!entry.assignment) return { result: 'notAttempted' };");
    const call = body.indexOf('deps.submitAssignment(');
    expect(guard).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(call);
  });
});

/**
 * NAT-007's thread view — the reader added on 2026-08-19.
 *
 * 🔴 **The question ALLOWED's third column demands, answered before the row was added: what does
 * this read WITHHOLD? Nothing.** A thread is readable by a stranger with no session at its own
 * URL — the platform's `GET /api/v1/bench/threads/:threadId` states it as its own AC1 — so the
 * token here is the same bearer header `useCommunityMirror` sends on reads that already work
 * without one.
 *
 * ⚠️ **And that is an argument about the platform, which is the far side of a wire.** So it is
 * not the argument this file rests on. The structural fact is nearer and checkable: the module
 * that decides *every state this screen can be in* — `threadview.ts`, six branches, D15 included
 * — **never receives a session or a token at all**. A view model that cannot see a credential
 * cannot withhold on the strength of one, whatever the API does.
 *
 * 🔴 The one action on the screen is the answer-on-the-web hand-off, and it is built
 * unconditionally beside the state rather than inside any session branch — the same property the
 * composer's hand-off has above, for the same reason.
 */
describe('AC4 — the people surfaces withhold nothing, proven against the real source', () => {
  const hook = stripComments(readFileSync(join(EDITOR_SRC, 'hooks/useCommunityPeople.ts'), 'utf8'));
  const model = stripComments(readFileSync(join(EDITOR_SRC, 'models/community/peopleview.ts'), 'utf8'));

  it('control: the hook really does read the session — the known-firing arm', () => {
    // Without this, every absence below passes for a hook that reads nothing.
    expect(readsTheSession(hook)).toBe(true);
    expect(hook).toContain('readCommunitySession');
  });

  it('the module that decides what is drawn never sees a session or a token', () => {
    // 🔴 The load-bearing claim, and on this surface it covers more than a state machine: WHO
    // APPEARS IN THE DIRECTORY and WHAT THE SEARCH RETURNS are decided in `peopleview.ts` too.
    // A filter that could see a credential would be an editor deciding for itself which people
    // exist, which is the D15 failure the mirror rule names.
    expect(readsTheSession(model)).toBe(false);
    expect(model).not.toContain('token');
    expect(READERS).not.toContain('noodl-editor/src/editor/src/models/community/peopleview.ts');
  });

  it('and the hook hands the composer the reads, never the session', () => {
    const call = hook.slice(hook.indexOf('composeDirectory({'), hook.indexOf('const profile:'));
    expect(call).toContain('composeDirectory({');
    expect(call).not.toContain('session');
    expect(call).not.toContain('token');
  });

  it('the token is used once per client, and nowhere else', () => {
    // ⚠️ Counted rather than eyeballed. Two clients are built here — one for the directory and
    // one for a profile — so the expected count is two, and a third would be a third place a
    // decision could hide.
    expect(hook.split('session?.token').length - 1).toBe(2);
  });

  it('the directory is fetched with no branch on being signed in', () => {
    // 🔴 A signed-out reader gets the same directory a signed-in one gets, because that is what
    // the web page does. The read is unconditional; only the header differs.
    expect(isGated(hook, 'readDirectory(client)')).toBe(false);
    expect(isGated(hook, 'client.person(handle)')).toBe(false);
  });
});

describe('AC4 — the thread view withholds nothing, proven against the real source', () => {
  const hook = stripComments(readFileSync(join(EDITOR_SRC, 'hooks/useCommunityThread.ts'), 'utf8'));
  const model = stripComments(readFileSync(join(EDITOR_SRC, 'models/community/threadview.ts'), 'utf8'));

  it('control: the hook really does read the session — the known-firing arm', () => {
    // Without this, every absence below passes for a hook that reads nothing.
    expect(readsTheSession(hook)).toBe(true);
    expect(hook).toContain('readCommunitySession');
  });

  it('the module that decides what is drawn never sees a session or a token', () => {
    // 🔴 The load-bearing claim. `composeThreadView` returns one of six states, and none of them
    // can be chosen on the strength of a credential it was never handed.
    expect(readsTheSession(model)).toBe(false);
    expect(model).not.toContain('token');
    expect(READERS).not.toContain('noodl-editor/src/editor/src/models/community/threadview.ts');
  });

  it('and the hook hands it the reads, never the session', () => {
    const call = hook.slice(hook.indexOf('composeThreadView({'), hook.indexOf('return {\n    openThread'));
    expect(call).toContain('composeThreadView({');
    expect(call).not.toContain('session');
    expect(call).not.toContain('token');
  });

  it('the token is used once, to build a client, and nowhere else', () => {
    // ⚠️ Counted rather than eyeballed: a second use is a second place a decision could hide.
    expect(hook.split('session?.token').length - 1).toBe(1);
    expect(hook).toContain('token: session?.token ?? null');
  });

  it('the answer-on-the-web hand-off is not inside any session branch', () => {
    // The capability a person with no account has on the web, kept in the editor.
    expect(isGated(hook, "actionLabel: 'Answer on the web'")).toBe(false);
  });
});
