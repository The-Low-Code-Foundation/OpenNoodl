/**
 * UNI-001 AC2 — the LAUNCHER's sign-in, asserted the only way this checkout can.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THIS IS A SOURCE-ANALYSIS SPEC AND IT SAYS SO. There is **no DOM and no React** in this
 * checkout's jest runner, so the card cannot be rendered and the button cannot be clicked here.
 * The established response is source analysis with negative controls derived from the **real
 * current source** — `base-dialog/measuring-copy.test.ts` is the precedent, and this file's
 * sibling `composer-offers-signin.test.ts` follows it for the composer's half.
 *
 * ⚠️ **WHAT A GREEN RUN HERE DOES NOT PROVE, so it is not counted as a drive:** that the card
 * renders, that the browser opens, or that a person can complete a sign-in. Those need the
 * editor running and a platform answering — the second is E10 (there is no OAuth App, so
 * `/api/auth/github/start` answers 503) and the whole loop is E9's smoke drive.
 *
 * 🔴 WHY IT IS STILL WORTH ITS INK: *build the caller* is recorded **twelve times** in this
 * phase, and twice the missing caller **was the reason the task existed**. `signIntoCommunity`
 * is exactly that shape of module — a complete, specced, typed flow — and until this session it
 * had one consumer. This file is the assertion that the second one exists and is wired all the
 * way from the hook to the rendered card.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const EDITOR = join(__dirname, '../../src/editor/src');
const CORE_UI = join(__dirname, '../../../noodl-core-ui/src');

const CARD_DIR = join(CORE_UI, 'preview/launcher/Launcher/components/CommunityAccountCard');

const card = readFileSync(join(CARD_DIR, 'CommunityAccountCard.tsx'), 'utf8');
const cardStyles = readFileSync(join(CARD_DIR, 'CommunityAccountCard.module.scss'), 'utf8');
const hook = readFileSync(join(EDITOR, 'pages/ProjectsPage/useCommunityAccount.ts'), 'utf8');
const projectsPage = readFileSync(join(EDITOR, 'pages/ProjectsPage/ProjectsPage.tsx'), 'utf8');
const launcher = readFileSync(join(CORE_UI, 'preview/launcher/Launcher/Launcher.tsx'), 'utf8');
const launcherContext = readFileSync(join(CORE_UI, 'preview/launcher/Launcher/LauncherContext.tsx'), 'utf8');
const projectsView = readFileSync(join(CORE_UI, 'preview/launcher/Launcher/views/Projects.tsx'), 'utf8');
const copy = readFileSync(join(CORE_UI, 'constants/communityCopy.ts'), 'utf8');

/**
 * Comments stripped, because a file that *mentions* `signIntoCommunity` in prose while never
 * calling it is precisely the state these specs exist to refuse — and every file here is
 * documented at length.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const cardCode = stripComments(card);
const hookCode = stripComments(hook);
const pageCode = stripComments(projectsPage);
const launcherCode = stripComments(launcher);
const contextCode = stripComments(launcherContext);
const viewCode = stripComments(projectsView);

describe('the stripper', () => {
  it('removes comments and leaves code alone', () => {
    const sample = 'const a = 1; /* signIntoCommunity in a block */\n// signIntoCommunity in a line\nconst b = 2;';
    const stripped = stripComments(sample);
    expect({
      keptCode: stripped.includes('const a = 1;') && stripped.includes('const b = 2;'),
      droppedComments: stripped.includes('signIntoCommunity')
    }).toEqual({ keptCode: true, droppedComments: false });
  });

  it('and every real source still contains code after stripping — non-vacuity', () => {
    // Without this, a stripper that returned '' would pass every absence assertion below and
    // fail nothing. These are floors, not measurements.
    expect({
      card: cardCode.length > 1500,
      hook: hookCode.length > 800,
      page: pageCode.length > 10000,
      launcher: launcherCode.length > 2000,
      context: contextCode.length > 800,
      view: viewCode.length > 2000
    }).toEqual({ card: true, hook: true, page: true, launcher: true, context: true, view: true });
  });
});

describe('the chain from the launcher to the device flow is unbroken', () => {
  it('the hook calls the sign-in AND the sign-out', () => {
    expect({
      imports: hookCode.includes("from '../../models/community/communitysignin'"),
      signsIn: /signIntoCommunity\s*\(/.test(hookCode),
      signsOut: /signOutOfCommunity\s*\(/.test(hookCode)
    }).toEqual({ imports: true, signsIn: true, signsOut: true });
  });

  it('the hook opens the SYSTEM browser — UNI-001 scope, no embedded webview credential entry', () => {
    expect(hookCode.includes('platform.openExternal')).toBe(true);
  });

  it('the hook passes a cancellation signal, so a closed launcher does not poll for fifteen minutes', () => {
    // 🔴 And it must read a REF: the poll loop closes over its arguments once and runs for up to
    // fifteen minutes, so a state value captured there is frozen at its first-render value and
    // the loop never sees the cancellation. Same bug, same fix, as the composer's `abandoned`.
    expect({
      passes: /isCancelled\s*:/.test(hookCode),
      fromARef: /abandoned\.current/.test(hookCode)
    }).toEqual({ passes: true, fromARef: true });
  });

  it('the hook renders from the PERSISTED credential, not from what the flow returned', () => {
    // The store is what the rest of the editor reads, so it is what this state must agree with.
    // The composer does the same thing for the same reason.
    expect(/readCommunitySession\s*\(/.test(hookCode)).toBe(true);
  });

  it('ProjectsPage uses the hook and hands the result to the Launcher', () => {
    expect({
      imports: pageCode.includes('useCommunityAccount'),
      calls: /useCommunityAccount\s*\(\s*\)/.test(pageCode),
      passes: /community=\{/.test(pageCode)
    }).toEqual({ imports: true, calls: true, passes: true });
  });

  it('the Launcher forwards it into the context, and the Projects view renders the card', () => {
    expect({
      prop: /community\??:/.test(launcherCode),
      inContext: /community\??:/.test(contextCode),
      rendered: viewCode.includes('<CommunityAccountCard')
    }).toEqual({ prop: true, inContext: true, rendered: true });
  });

  it('NEGATIVE CONTROL — the card losing its render site is caught', () => {
    const mutated = viewCode.replace(/<CommunityAccountCard/g, '<Nothing');
    expect(mutated).not.toBe(viewCode);
    expect(mutated.includes('<CommunityAccountCard')).toBe(false);
  });
});

describe('the card', () => {
  it('draws NOTHING until the store has answered', () => {
    // 🔴 The frame this protects is the first one. `null` and `undefined` are both falsy, so a
    // `!session` test flashes "Sign in to NodeGX" at somebody who is already signed in, on every
    // launch. Both halves: the phase must exist and it must return null.
    expect({
      hasPhase: cardCode.includes("phase: 'unknown'"),
      returnsNothing: /state\.phase === 'unknown'\)\s*return null/.test(cardCode)
    }).toEqual({ hasPhase: true, returnsNothing: true });
  });

  it('shows the user code AND the address', () => {
    // ⚠️ A browser that opens on a different profile — or not at all — leaves a person holding
    // nothing. Both halves, or the flow has a silent dead end.
    expect({
      code: cardCode.includes('state.userCode'),
      address: cardCode.includes('state.verificationUri')
    }).toEqual({ code: true, address: true });
  });

  it('offers a sign-out when signed in', () => {
    expect({
      branch: cardCode.includes("state.phase === 'signed-in'"),
      button: cardCode.includes('COMMUNITY_SIGN_OUT_LABEL'),
      wired: /onClick=\{onSignOut\}/.test(cardCode)
    }).toEqual({ branch: true, button: true, wired: true });
  });

  it('says the login gates nothing, on the surface that most implies the opposite', () => {
    // 🔴 The phase's first principle. A card asking for an account is the likeliest place in the
    // editor for a new user to conclude the download is gated. The sentence is rendered, not
    // merely defined — a constant nobody places says nothing to anybody.
    expect({
      defined: copy.includes('COMMUNITY_GATES_NOTHING'),
      rendered: cardCode.includes('{COMMUNITY_GATES_NOTHING}')
    }).toEqual({ defined: true, rendered: true });
  });
});

describe("D2's string has ONE owner, across all three surfaces", () => {
  const literal = 'Sign in to NodeGX';

  it('the constant module holds the exact words', () => {
    expect(stripComments(copy).includes(`export const COMMUNITY_SIGN_IN_LABEL = '${literal}'`)).toBe(true);
  });

  it('the card uses the constant and does not re-type the words', () => {
    // 🔴 FUN-001's shape, which D2 names in as many words: four surfaces disagreeing about one
    // piece of copy is worse than blank. The second literal is the one nobody changes.
    expect({
      imports: cardCode.includes("from '@noodl-core-ui/constants/communityCopy'"),
      uses: cardCode.includes('COMMUNITY_SIGN_IN_LABEL'),
      reTypes: cardCode.includes(literal)
    }).toEqual({ imports: true, uses: true, reTypes: false });
  });

  it('and so does the composer, which used to own the literal', () => {
    const dialog = stripComments(
      readFileSync(join(EDITOR, 'views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx'), 'utf8')
    );
    expect({
      imports: dialog.includes("from '@noodl-core-ui/constants/communityCopy'"),
      uses: dialog.includes('COMMUNITY_SIGN_IN_LABEL'),
      reTypes: dialog.includes(literal)
    }).toEqual({ imports: true, uses: true, reTypes: false });
  });

  it('NEGATIVE CONTROL — the checker can see a re-typed literal', () => {
    const mutated = `${cardCode}\nconst rogue = '${literal}';`;
    expect(mutated.includes(literal)).toBe(true);
  });
});

describe('every CSS-module class the card references is defined in its stylesheet', () => {
  /**
   * ⚠️ **An undefined CSS-module class resolves to `undefined` and renders no class at all.**
   * The element keeps working, looks unstyled, and *nothing anywhere reports an error* — not
   * webpack, not `tsc`, not a lint. Both card stylesheets in this launcher carry that warning in
   * prose; this is the assertion that makes it a check.
   */
  function referenced(source: string): string[] {
    return Array.from(source.matchAll(/css\['([^']+)'\]/g)).map((match) => match[1]);
  }

  function defined(styles: string): Set<string> {
    return new Set(Array.from(styles.matchAll(/^\s*&?\.([A-Za-z][\w-]*)/gm)).map((match) => match[1]));
  }

  // Deduped: a class used twice would otherwise report itself twice in a failure list, and the
  // negative control below would have to know how many times.
  const used = Array.from(new Set(referenced(cardCode)));
  const declared = defined(cardStyles);

  it('and there are classes to check — non-vacuity', () => {
    // A regex that matched nothing would make the assertion below pass on an empty stylesheet.
    expect(used.length).toBeGreaterThan(8);
    expect(declared.size).toBeGreaterThan(8);
  });

  it('leaves none of them undefined', () => {
    expect(used.filter((name) => !declared.has(name))).toEqual([]);
  });

  it('NEGATIVE CONTROL — a class deleted from the stylesheet is caught', () => {
    const withoutTitle = defined(cardStyles.replace(/^\.Title \{/m, '.NotTitle {'));
    expect(used.filter((name) => !withoutTitle.has(name))).toEqual(['Title']);
  });
});
