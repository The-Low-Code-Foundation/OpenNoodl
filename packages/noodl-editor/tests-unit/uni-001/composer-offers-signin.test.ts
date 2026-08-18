/**
 * UNI-001 E1 — the composer actually calls the sign-in, asserted the only way this checkout can.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THIS IS A SOURCE-ANALYSIS SPEC AND IT SAYS SO. There is **no DOM and no React** in this
 * checkout's jest runner, so the button cannot be clicked here. The established response is
 * source analysis with negative controls derived from the **real current source** —
 * `base-dialog/measuring-copy.test.ts` is the precedent and `uni-016`'s
 * `composer-sends-what-it-shows.test.ts` follows it.
 *
 * ⚠️ **WHAT THIS DOES NOT PROVE, so a green run is not counted as a drive:** that the button
 * renders, that clicking it runs anything, that the browser opens, or that a person can
 * complete the flow. Those need the editor running and a platform answering, which is E9.
 *
 * 🔴 WHY IT IS STILL WORTH ITS INK: this phase has recorded *build the caller* **ten times**,
 * and twice the missing caller **was the reason the task existed** — a handover called two
 * things "ready" and neither had one. `signIntoCommunity` is exactly that shape of module: a
 * complete, specced, typed flow whose only consumer is one line in one dialog. This file is
 * the assertion that the line exists.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const DIALOG = join(
  __dirname,
  '../../src/editor/src/views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx'
);

const source = readFileSync(DIALOG, 'utf8');

/**
 * Comments stripped, because a file that *mentions* `signIntoCommunity` in prose while never
 * calling it is precisely the state this spec exists to refuse — and this file's own
 * subject is a module documented at length.
 *
 * ⚠️ The stripper has a control below proving it does not strip code, which is the same
 * obligation UNI-015 AC4's `discourse` sweep took on for the same reason.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const code = stripComments(source);

describe('the stripper', () => {
  it('removes comments and leaves code alone', () => {
    const sample = 'const a = 1; /* signIntoCommunity in a block */\n// signIntoCommunity in a line\nconst b = 2;';
    const stripped = stripComments(sample);
    expect({
      keptCode: stripped.includes('const a = 1;') && stripped.includes('const b = 2;'),
      droppedComments: stripped.includes('signIntoCommunity')
    }).toEqual({ keptCode: true, droppedComments: false });
  });

  it('and the real source still contains code after stripping — non-vacuity', () => {
    // Without this, a stripper that returned '' would pass every absence assertion below and
    // fail nothing. The count is a floor, not a measurement.
    expect(code.length).toBeGreaterThan(2000);
  });
});

describe('the composer offers a sign-in', () => {
  it('imports the sign-in module and calls it', () => {
    expect({
      imports: code.includes("from '@noodl-models/community/communitysignin'"),
      calls: /signIntoCommunity\s*\(/.test(code)
    }).toEqual({ imports: true, calls: true });
  });

  it('renders the affordance only when the store has ANSWERED that there is no session', () => {
    // 🔴 `session === null`, not `!session`. `undefined` is "the read has not resolved", and
    // `!session` is true for it — so the loose test flashes "Sign in" at somebody who is
    // already signed in, on every dialog open. The dialog's own state comment makes this
    // distinction for the other branch; this is the assertion that keeps it made for both.
    expect(code.includes('session === null')).toBe(true);
  });

  it('passes a cancellation signal, so a dismissed dialog does not poll for fifteen minutes', () => {
    expect(/isCancelled\s*:/.test(code)).toBe(true);
  });

  it('shows the user code as well as opening the browser', () => {
    // ⚠️ A browser that opens on the wrong profile — or not at all — leaves a person holding
    // nothing. Both halves, or the flow has a silent dead end.
    expect({
      shown: code.includes('signIn.userCode'),
      addressShown: code.includes('signIn.verificationUri')
    }).toEqual({ shown: true, addressShown: true });
  });

  it('still keeps the signed-out browser hand-off — UNI-016 AC5', () => {
    // 🔴 The tempting cleanup, warned about in as many words by AC5: now that signing in
    // works, the hand-off looks redundant. It is not — it is what a person reaches for when
    // the post is refused, when the platform is unreachable, and when they do not want an
    // account at all.
    expect(/handOff\s*\(/.test(code)).toBe(true);
    expect(code.includes('openExternal')).toBe(true);
  });

  it('uses D2 exact string for the button — through the constant, not a literal', () => {
    // One string, one owner (the FUN-001 shape). The platform's `SIGN_IN_BUTTON_LABEL` holds the
    // same words; four surfaces disagreeing about one piece of copy is worse than blank.
    //
    // 🔴 **AMENDED by AC2's launcher card.** This used to assert the literal was HERE, which was
    // right while the composer was the only editor surface that offered a sign-in. It is now the
    // second of two, so the assertion moves up a level: the words live in
    // `noodl-core-ui/constants/communityCopy.ts` — the only module both surfaces can reach — and
    // this file must go through it rather than re-type them. `launcher-offers-signin.test.ts`
    // makes the same demand of the card and pins the constant's exact value.
    expect({
      imports: code.includes("from '@noodl-core-ui/constants/communityCopy'"),
      uses: code.includes('COMMUNITY_SIGN_IN_LABEL'),
      reTypes: code.includes('Sign in to NodeGX')
    }).toEqual({ imports: true, uses: true, reTypes: false });
  });
});

describe('the origin constant has ONE home', () => {
  const model = readFileSync(
    join(__dirname, '../../src/editor/src/models/community/communityorigin.ts'),
    'utf8'
  );

  it('is declared in the model and re-exported by the dialog, not declared twice', () => {
    expect(stripComments(model).includes("export const COMMUNITY_URL = 'https://community.nodegx.io'")).toBe(true);
    // 🔴 The dialog must RE-EXPORT rather than re-declare. A second literal is a second thing
    // to change on the day the host moves, and the one nobody changes is the one in the view.
    expect(/export const COMMUNITY_URL\s*=/.test(code)).toBe(false);
    expect(code.includes("export { COMMUNITY_URL } from '@noodl-models/community/communityorigin'")).toBe(true);
  });

  it('and it is .io — the phase said .dev for four days', () => {
    expect(model.includes('community.nodegx.io')).toBe(true);
    expect(stripComments(model).includes('community.nodegx.dev')).toBe(false);
  });
});
