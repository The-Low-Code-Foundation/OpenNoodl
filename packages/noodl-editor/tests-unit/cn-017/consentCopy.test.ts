/**
 * CN-017 AC4 + AC5 — what the consent dialog says.
 *
 * 🔴 **Two instruments, because one of them is blind on its own.**
 *
 * 1. The copy module is imported and read as data. That grades the sentences.
 * 2. The `.tsx` is read **off disk as source** and swept for over-claiming words.
 *    A `.tsx` is invisible to this runner, so a claim added straight into the
 *    markup would pass instrument 1 while sitting on the screen.
 *
 * ⚠️ **Instrument 2 carries its own negative control.** A source-analysis spec
 * whose path stops resolving reads as a clean pass — this repo has a recorded case
 * of exactly that sitting red-free for a day behind "the suite was re-run". So the
 * file is asserted non-empty and asserted to contain a marker that is genuinely in
 * it, *before* anything is asserted absent.
 */

import * as fs from 'fs';
import * as path from 'path';

import { KIT_CONSENT_COPY } from '../../src/editor/src/views/ImportFlow/kitConsentCopy';

/** Words that would turn "here is what this declares" into an assurance. */
const OVER_CLAIMS = ['safe', 'trusted', 'trustworthy', 'secure', 'sandboxed', 'guaranteed', 'harmless'];

describe('CN-017 AC4 — the statement is one sentence, and it says what a kit can do', () => {
  it('is a single sentence', () => {
    const sentences = KIT_CONSENT_COPY.statement.split('.').filter((s) => s.trim().length > 0);
    expect(sentences).toHaveLength(1);
  });

  /*
   * ⚠️ Neither minimising nor catastrophising: the words graded here are the
   * concrete reach ("your data", "your network"), not an adjective about risk.
   */
  it('names the access rather than characterising the danger', () => {
    const text = KIT_CONSENT_COPY.statement.toLowerCase();
    expect(text).toContain('run inside your app');
    expect(text).toContain('your data');
    expect(text).toContain('your network');
    expect(text).not.toContain('danger');
    expect(text).not.toContain('malicious');
    expect(text).not.toContain('warning');
  });

  it('describes the button by what pressing it does', () => {
    expect(KIT_CONSENT_COPY.accept(2)).toBe('Run this code in my app (2)');
  });
});

describe('CN-017 AC5 — nothing in the consent copy claims a verified kit is safe', () => {
  const strings: Array<[string, string]> = [
    ['statement', KIT_CONSENT_COPY.statement],
    ['limits', KIT_CONSENT_COPY.limits],
    ['accept', KIT_CONSENT_COPY.accept(1)],
    ['acceptNothing', KIT_CONSENT_COPY.acceptNothing],
    ['refusedHeading', KIT_CONSENT_COPY.refusedHeading]
  ];

  it.each(strings)('%s over-claims nothing', (_name, text) => {
    // The known-firing half of the absence check.
    expect(text.length).toBeGreaterThan(0);

    const lower = text.toLowerCase();
    for (const word of OVER_CLAIMS) {
      // ⚠️ `limits` deliberately contains "trustworthy" inside a NEGATION, which
      // is the one place the word belongs. Every other string must not carry it.
      if (word === 'trustworthy' && lower.includes('nothing about whether its author is trustworthy')) continue;
      expect(lower).not.toContain(word);
    }
  });

  it('states the limit of the check in the same breath as showing its result', () => {
    const lower = KIT_CONSENT_COPY.limits.toLowerCase();
    expect(lower).toContain('what it defines');
    expect(lower).toContain('nothing about whether its author is trustworthy');
  });
});

describe('CN-017 AC5 — the dialog markup itself over-claims nothing', () => {
  const dialogPath = path.join(
    __dirname,
    '../../src/editor/src/views/ImportFlow/openKitConsent.tsx'
  );

  /*
   * 🔴 The negative control, first and on its own. If this fails, the sweep below
   * is reading nothing and its green means nothing.
   */
  it('can read the dialog source, and the source is the dialog', () => {
    expect(fs.existsSync(dialogPath)).toBe(true);
    const source = fs.readFileSync(dialogPath, 'utf8');
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toContain('kit-consent-dialog');
    expect(source).toContain('requireDownloadConsent');
  });

  it('contains no over-claiming word in any rendered string', () => {
    const source = fs.readFileSync(dialogPath, 'utf8');

    // Comments are where this file argues about safety at length, which is the
    // right place for it — only what can reach a screen is swept.
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const rendered = withoutBlockComments
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    expect(rendered.length).toBeGreaterThan(500);
    for (const word of OVER_CLAIMS) {
      expect(rendered.toLowerCase()).not.toContain(word);
    }
  });
});
