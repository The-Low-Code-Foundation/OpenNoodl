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
 * 🔴 FIX-025 — WEBPACK BUNDLES ARE NOT SOURCE, AND THEY LIVE INSIDE `src/`.
 *
 * `packages/noodl-editor/src/editor/index.bundle.js` and its viewer-frame sibling are
 * **generated, gitignored** artifacts (`.gitignore:171`) that happen to be written into the
 * source tree rather than into `dist/`, which is the only reason `SKIP` above does not already
 * exclude them. They contain a compiled copy of everything this gate scans, so on any checkout
 * where somebody has run a dev build they appear as two "unrecorded readers" of the session and
 * this file goes red — for a build, not for a code change.
 *
 * ⚠️ **This weakens nothing.** Every line inside a bundle is a copy of a `.ts` file the walk
 * already visited, so a real new reader is still caught at its source. Excluding a *generated*
 * duplicate is not the same as excluding a directory that might contain an original — which is
 * why this is a filename pattern for build output and not another entry in `SKIP`.
 *
 * ⚠️ Measured on this checkout: the two bundles were last written at 14:40 on 2026-08-20 by a
 * dev build, and `git check-ignore -v` names the rule that ignores them. Provenance matters
 * here — an ignored artifact is invisible to `git status`, so a red gate caused by one reads as
 * a red gate caused by whatever you were editing at the time.
 */
const GENERATED = /\.bundle\.js$/;

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
    else if (CODE.test(entry.name) && !GENERATED.test(entry.name)) into.push(full);
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
    'UNI-006 bridge: read ONLY inside liveSubmitAssignment, to hand an ASSIGNED lesson to the org that set it. Withholds nothing — grading, installing, resetting, progress and feedback are untouched, and an entry can only carry an assignment if an account obtained it, so there is nothing for an account-less editor to be refused. Asserted structurally below',
  'noodl-editor/src/editor/src/hooks/useTutorialInstall.ts':
    'TUT-004 tutorials: the token is a BEARER HEADER on two reads the platform serves to strangers — `/api/v1/community/tutorials` and its `/bundle`, both of which the web page serves to anyone. Withholds nothing, and the account makes the editor do LESS rather than more: the token exists so D15 can refuse an org-minor whose school switched the community off, which is a school policy and not a paywall. Installing, scoring and the Learning folder never see a session at all — the whole decision layer is `tutorialsview.ts`, which takes a read and a set of slugs. ⚠️ **Resetting** used to be in that list and no longer is: FIX-027 §20 gave `resetLessonFromPlatform` its first caller, in the launcher, which builds a client the same way and for the same reason. The *decision* still sees no session — it moved to `models/lessonreset.ts`, asserted below. Asserted structurally below',
  'noodl-editor/src/editor/src/utils/community/communityRailGate.ts':
    'NAT-012 AC7 rail gate: the token is a BEARER HEADER on `/api/v1/me`, read to decide whether D15 REFUSES this viewer the community surface. 🔴 Withholds nothing, and it is the clearest case in this table of an account making the editor do LESS rather than more — the read exists only so an org-minor whose school switched the community off is not handed a door onto a blank panel. A session-less editor is NEVER refused: `/api/v1/me` answers 401 → `unauthenticated` with no token, and `refusesCommunitySurface` requires `ok` + `surface === \'absent\'`, so signing out can only ever ADD the panel back. Asserted behaviourally in `nat-012/community-rail-gate.test.ts`, which pairs the refused and permitted viewers in one test so a gate that removed the panel for everybody would fail (measured: 4 reds)',
  'noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx':
    'FIX-027 §20 re-pulling a lesson: the token is a BEARER HEADER on the same public `/bundle` read `useTutorialInstall` already installs from, built in `repullFromPlatform` when a learner presses *Start again* on a lesson that came from Community. 🔴 **The question this column demands, answered before the row was added: does it withhold anything from someone with no account? No.** The read is unconditional and there is no branch on its result — a session-less editor gets `token: null` and the re-pull goes out exactly the same, because `/bundle` is what the web page serves to a stranger. As everywhere else in this table the account can only make the editor do LESS: the header is there so D15 can answer 404 to an org-minor whose school switched the community off. ⚠️ The reset happens HERE rather than in the lesson only because the project must be closed before its directory is replaced (`launcherHandoff.ts`) — a lifecycle constraint, not an account one. The DECISION of which reset to run sees no session at all: it is `models/lessonreset.ts`, asserted below. Asserted structurally below',
  'noodl-editor/src/editor/src/hooks/useLearnerPath.ts':
    'UNI-007 AC1 intake and path: the token is a BEARER HEADER on the path read, and the INTAKE read — the questions themselves — is not session-gated at all, because `GET /api/v1/me/intake` takes no token by design. Withholds nothing: a path is a fact that does not exist for a person with no account, in the same way `standing` does not, and no capability the editor had before this surface moved behind a session. Asserted structurally below'
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

  /**
   * 🔴 **This row lost two of its three subjects on 2026-08-22 and had to be REPOINTED, not
   * shortened.** NAT-012's narrowing moved *Guides and tutorials* and *Call replays* out of the
   * panel and into the launcher's tabs (D6: the launcher is the community's home, the panel is
   * the door). Both anchors vanished, and `isGated` **threw** rather than passing on a needle it
   * could not find — which is the only reason this was noticed at the moment it happened.
   *
   * ⚠️ Deleting the two entries would have been the wrong repair, and precisely the trap this
   * file is built against: the *claim* is "reading works signed out", and shrinking a claim's
   * population to whatever still happens to be on one surface is how a check goes quiet without
   * going red. The two sections still exist — the row follows them to {@link communityPage}
   * below rather than forgetting they were ever covered.
   */
  it('and the content sections still in the panel are NOT inside any viewer branch', () => {
    expect({
      discussions: isGated(communityPanel, 'title="Discussions"', VIEWER_OPENER),
      // TUT-004's installable lessons — the section D6 kept, because installing one writes into
      // your project. It was always ungated; it is named here now that it is a survivor.
      tutorials: isGated(communityPanel, '<Tutorials pane={tutorials} />', VIEWER_OPENER)
    }).toEqual({ discussions: false, tutorials: false });
  });

  it('and neither are the two ways out of the panel', () => {
    // The capability a person with no account has on the web, kept in the editor. 🔴 Two controls
    // since NAT-012 AC3: the door to the launcher's community home (which closes the project and
    // says so) and the labelled browser link. Neither may be withheld from a signed-out reader —
    // a guest who cannot reach the home is the dead end AC5 forbids.
    expect({
      home: isGated(communityPanel, "leaveForLauncher('community')", VIEWER_OPENER),
      browser: isGated(communityPanel, 'label="Open community.nodegx.io in your browser"', VIEWER_OPENER)
    }).toEqual({ home: false, browser: false });
  });
});

/**
 * 🔴 **Where the two sections went, so the claim's population did not shrink** — see the note on
 * the repointed row above.
 *
 * ⚠️ The launcher page is a **different file in a different package** and its viewer conditional
 * is written the same way, so `VIEWER_OPENER` transfers. What does *not* transfer is the control:
 * this page has no signed-out-only sentence to gate, so the known-firing arm for these anchors is
 * the one in the panel, above. That is stated rather than papered over — a `false` here is only
 * as trustworthy as a checker proven able to return `true` somewhere, and it has been.
 */
const communityPage = stripComments(
  readFileSync(
    join(
      EDITOR_SRC,
      '../../../../noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx'
    ),
    'utf8'
  )
);

describe('AC4 — and the sections NAT-012 moved to the launcher withhold nothing either', () => {
  /**
   * 🔴 **The control, and it is not optional here — it is the row that stops the three below
   * being vacuous.** The panel's own control (*"Sign in from the launcher"* inside
   * `{view.viewer === false && …}`) proves the checker on THAT file. This is a different file in
   * a different package, and it happens to contain **no viewer conditional at all**: its only
   * `view.viewer` mentions are a ternary building a label and a `${view.viewer.handle}`
   * substitution, which `sessionGuardedRegions` skips by design.
   *
   * So on this file `isGated` returns `false` for *every* input, including inputs that ought to
   * read `true` — and three `false`s would have proved nothing whatsoever. This row supplies the
   * missing arm by **mutation**: wrap a real anchor from this real source in a real viewer branch
   * and require the checker to catch it. If this goes red the three rows below are meaningless,
   * whatever they report.
   */
  it('the checker can SEE a gate on this file — the mutation arm', () => {
    // ⚠️ The anchor was `title="Bench"` until FB-002. The Bench stopped being a `CommunitySection`
    // when it grew a filter — its pills belong inside the card and above the rows, which that
    // component cannot express — so the heading is now plain markup and the mount is the stable
    // anchor. 🔴 The spec did not silently pass when the old one vanished: `isGated` threw, which
    // is the whole reason this file can be trusted after a rename.
    const gated = communityPage.replace('<CommunityBenchView', '{view.viewer && (<CommunityBenchView');
    expect(isGated(gated, '<CommunityBenchView', VIEWER_OPENER)).toBe(true);
  });

  it('and on the real source, nothing on the page is viewer-gated at all', () => {
    // The stronger statement the mutation arm licenses: not "these three anchors are outside the
    // branches" but "there are no branches". ⚠️ Stated as a count so a viewer gate added later
    // fails HERE, where the reasoning is, rather than silently only for the anchors named below.
    expect(sessionGuardedRegions(communityPage, VIEWER_OPENER)).toEqual([]);
  });

  it('and the sections that moved here are among what it draws', () => {
    expect({
      tutorials: isGated(communityPage, 'title="Tutorials"', VIEWER_OPENER),
      replays: isGated(communityPage, 'title="Replays"', VIEWER_OPENER),
      // The bench came with them as a tab rather than a heading — FB-006. Named so this row
      // reads as the whole of what the launcher draws, not a leftover pair. ⚠️ FB-002 changed
      // the anchor; see the mutation arm above for why.
      bench: isGated(communityPage, '<CommunityBenchView', VIEWER_OPENER)
    }).toEqual({ tutorials: false, replays: false, bench: false });
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

  /**
   * 🔴 THE HAND-OFF MOVED, AND THE CLAIM ABOUT IT CHANGED SHAPE — 2026-08-20, NAT-007 AC4.
   *
   * This used to be `isGated(hook, "actionLabel: 'Answer on the web'")` — *"the capability a
   * person with no account has on the web, kept in the editor"* — and it went red because the
   * literal moved into `threadwrites.ts`. ✅ The `isGated` tripwire is what said so, in as many
   * words: *"this spec is blind, fix it."* Without it this would have gone on asserting `false`
   * about a string that was not there.
   *
   * ⚠️ **And the old claim would now be WRONG rather than merely blind.** D5 settled, so the
   * editor composes for a signed-in reader and hands off for a signed-out one — the hand-off IS
   * chosen on the session, and that is the opposite of withholding: it is the arm a person
   * without an account gets. So the structural question *"is this behind a session gate"* stopped
   * being the right one, and what replaces it is the property the gate existed to protect: the
   * module that decides which arm to draw is handed a BOOLEAN and never a credential.
   *
   * The behavioural half — *signed out really does get a way to answer* — is
   * `nat-007/threadwrites.test.ts`, which calls `composeReplyBox` rather than reading it.
   */
  const writes = stripComments(readFileSync(join(EDITOR_SRC, 'models/community/threadwrites.ts'), 'utf8'));

  it('control: the hand-off is still SOMEWHERE — otherwise every claim below is about nothing', () => {
    expect(writes).toContain("actionLabel: 'Answer on the web'");
  });

  it('the module that chooses composer-or-hand-off never sees a session or a token', () => {
    expect(readsTheSession(writes)).toBe(false);
    expect(writes).not.toContain('session?.token');
    expect(READERS).not.toContain('noodl-editor/src/editor/src/models/community/threadwrites.ts');
  });

  it('and the hook hands it a BOOLEAN, which is the whole of what it may know', () => {
    // 🔴 `Boolean(session)` rather than the session: a credential that never arrives cannot be
    // read, and no amount of later editing in that module can start gating on one.
    expect(hook).toContain('signedIn: Boolean(session)');
  });
});

/**
 * UNI-007 AC1 — the intake and the path, added 2026-08-20. The fifth reader outside the
 * launcher and the account module.
 *
 * 🔴 **The question ALLOWED's third column demands, answered before the row was added: does
 * this reader change what the editor can DO without an account? No, and it is worth separating
 * the two halves of why, because only one of them is the interesting one.**
 *
 * The cheap half: this is a NEW surface, so there is no capability it could have taken away.
 * That answer is true and it is not enough on its own — it would license any new surface to be
 * account-only, and *"the login gates nothing"* would decay into *"the login gates nothing that
 * existed on 2026-08-14."*
 *
 * The half that matters: **the part of this surface that CAN work without an account DOES.**
 * `GET /api/v1/me/intake` serves the three questions to anybody, signed in or not — its route
 * says so in its own lede, and the reason is that requiring a session to see a form makes
 * signing in a prerequisite for finding out what it is for. So the signed-out editor draws the
 * real questions, not a locked panel describing them. The path itself needs an account for the
 * same reason `standing` does on the community panel: it is a fact that does not exist for a
 * person who has not answered, not a feature being withheld from them.
 *
 * ⚠️ **`session === undefined` IS NOT A GATE AND MUST NOT BE READ AS ONE.** It means the local
 * store has not answered yet — `useCommunityAccount` makes the same distinction in prose, and
 * conflating it with `null` is the bug that flashes "Sign in" at somebody who is signed in. The
 * opener below therefore matches `session === null` only, and the delay is a delay: the store
 * answers `null` immediately for a signed-out editor and the questions load.
 */
const learnerPath = stripComments(readFileSync(join(EDITOR_SRC, 'hooks/useLearnerPath.ts'), 'utf8'));

/** This hook guards with a statement, not JSX — `if (session === null) {`, never `{session &&`. */
const NULL_SESSION_OPENER = /if \(session === null\) \{/g;

describe('AC4 — the learner path withholds nothing, proven against the real source', () => {
  it('control: the region finder can see THIS hook’s gate — the known-firing arm', () => {
    // 🔴 Without this the "not gated" assertion below is a claim about an instrument that
    // cannot see a gate at all, which is the reading that fits every hypothesis. The path read
    // legitimately IS behind the session: there is no path for a learner the platform has
    // never met.
    expect(isGated(learnerPath, "setPath({ outcome: 'unauthenticated' })", NULL_SESSION_OPENER)).toBe(true);
  });

  it('and the QUESTIONS read is not inside any session branch — the arm needing no account', () => {
    // The capability itself: see what the intake would ask you. A person with no account can,
    // and moving this call inside the session branch is the regression this exists to catch.
    expect(isGated(learnerPath, 'client.intake()', NULL_SESSION_OPENER)).toBe(false);
  });

  it('the token is a bearer header and nothing else', () => {
    expect(learnerPath).toContain('token: session?.token ?? null');
  });

  it('and the module that decides what is DRAWN never sees a session at all', () => {
    // Same property as `threadwrites.ts` above and `peopleview.ts` before it: the view model is
    // handed reads, not credentials, so no later edit in it can start gating on one.
    const view = stripComments(readFileSync(join(EDITOR_SRC, 'models/community/learnerpathview.ts'), 'utf8'));
    expect(readsTheSession(view)).toBe(false);
    expect(view).not.toContain('session');
    expect(READERS).not.toContain('noodl-editor/src/editor/src/models/community/learnerpathview.ts');
  });
});


/**
 * TUT-004 — the tutorials section, added 2026-08-20.
 *
 * 🔴 **The question ALLOWED's third column demands, answered before the row was added:** does
 * installing a community tutorial withhold anything from someone with no account? **No**, and
 * the direction is the interesting part — this is the first reader where the token can only ever
 * make the editor do *less*. `/api/v1/community/tutorials` and `/api/v1/community/tutorials/:slug
 * /bundle` are both public: the web page serves the same tutorials and the same download link to
 * a stranger, and `tutorialbundles.ts` carries no viewer. The bearer header is there so **D15**
 * can answer 404 to an org-minor whose school has switched the community off — a school policy
 * applied to a signed-IN pupil, which is the opposite of a feature behind an account.
 *
 * ⚠️ **And the decision layer never sees a session.** `composeTutorials` takes a read and a set
 * of installed slugs; `installTutorialFromPlatform` takes a fetcher and a filesystem. Neither
 * imports `communitysession`, so there is no branch in either where an account could change what
 * a person may install. That is asserted below rather than asserted here.
 */
describe('AC4 — installing a tutorial is not behind an account', () => {
  const decisionLayer = [
    'models/community/tutorialsview.ts',
    'models/lessonplatforminstall.ts',
    'models/learningfolder.ts',
    // FIX-027 §20 — the module that CHOOSES between the two resets. It takes the register and a
    // re-pull function, so there is no branch in it where an account could decide whether a
    // learner may start a lesson again.
    'models/lessonreset.ts',
    'views/panels/CommunityPanel/Tutorials.tsx'
  ];

  it.each(decisionLayer)('%s never reads the session', (file) => {
    const source = stripComments(readFileSync(join(EDITOR_SRC, file), 'utf8'));
    expect(source).not.toContain('readCommunitySession');
    expect(source).not.toContain('communitysession');
  });

  it('🔴 and the checker CAN see a session read — the known-firing arm', () => {
    // ✅ Without this, the four assertions above pass identically against a misspelt needle or a
    // path that no longer exists. `useTutorialInstall` genuinely does read it.
    const hook = stripComments(readFileSync(join(EDITOR_SRC, 'hooks/useTutorialInstall.ts'), 'utf8'));
    expect(hook).toContain('readCommunitySession');
  });

  /*
   * FIX-027 §20 — the re-pull, added 2026-08-25. Same shape of claim as the install above.
   *
   * 🔴 The interesting arm is the SECOND one: a learner with no account must still be able to
   * start a Community lesson again. If the re-pull were ever moved inside a `{session && …}`
   * guard, the button would silently do nothing for exactly the people least able to work out
   * why — and every other spec in this repo would stay green.
   */
  it('🔴 the re-pull is not inside any session branch — a signed-out learner can still start again', () => {
    const page = stripComments(readFileSync(join(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx'), 'utf8'));
    expect(isGated(page, 'resetLessonFromPlatform(lessonId')).toBe(false);
    expect(isGated(page, 'performLessonReset(lessonId)')).toBe(false);
  });

  it('and the token is read once, to build a client, and nowhere else', () => {
    // Counted, not eyeballed — a second use is a second place a decision could hide.
    const page = stripComments(readFileSync(join(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx'), 'utf8'));
    expect(page.split('session?.token').length - 1).toBe(1);
  });

  it('🔴 control: the checker CAN see a gate on this page — otherwise the row above proves nothing', () => {
    // The known-firing arm for the two assertions above, on the same file, through the same
    // helper. Without it "not gated" is indistinguishable from "the needle was never found".
    const mutated = 'const x = 1;\n{session && (\n  resetLessonFromPlatform(lessonId, {})\n)}';
    expect(isGated(mutated, 'resetLessonFromPlatform(lessonId')).toBe(true);
  });

  it('the install action in the panel is not inside any session branch', () => {
    const panel = stripComments(readFileSync(join(EDITOR_SRC, 'views/panels/CommunityPanel/Tutorials.tsx'), 'utf8'));
    expect(isGated(panel, 'pane.onInstall(row.slug)')).toBe(false);
  });
});
