/**
 * FB-005 T5 — the decisions behind the "Share as template" dialog.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ## 🔴 WHAT THIS FILE CAN AND CANNOT SEE, STATED FIRST BECAUSE IT DECIDES THE VALUE OF EVERY
 * ASSERTION BELOW
 *
 * The dialog itself (`ShareTemplateModal.tsx`) **cannot be loaded by this runner**: it draws
 * `Modal`, `TextInput` and `Select`, each of which reaches `common/Icon`, and `Icon.tsx` uses
 * webpack's `require.context`, which ts-jest rejects at type-check time. `renderElements.ts` states
 * that trap and it is why the rules were moved OUT of the dialog into `shareTemplateForm.ts`
 * rather than the reverse.
 *
 * So this file grades **what may be sent and what a person is told**, and it grades nothing about
 * markup, layout, focus or whether the send button is wired to `onSend`. ⚠️ **Those are verified
 * by driving the running app**, and the scope file says why that is not optional here: *"a
 * five-field dialog written blind and never driven would be the appearance of a caller."*
 *
 * ## The shape rules are asserted against the MIGRATION'S TEXT, not against remembered numbers
 *
 * `shareTemplateForm.ts` copies four rules out of `0021_fb005_template_submissions.sql` so a person
 * is refused before an 8 MiB upload rather than after one. 🔴 **A copy of a rule is a rule that can
 * drift from it**, and a spec asserting `3` against a constant that also says `3` measures nothing.
 * §1 reads the constraint text out of the platform repository when it is on this machine and
 * compares — and **says so out loud when it is not**, because a check that silently degrades into
 * no check is worse than one that was never written.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { TEMPLATE_CATEGORY_LABELS } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard/steps/templateFilter';

import {
  MAX_TEMPLATE_BYTES,
  SHAREABLE_LICENCES,
  type ShareAsTemplateOutcome
} from '@noodl-models/template/shareAsTemplate';
import {
  SHAREABLE_CATEGORIES,
  SLUG_LENGTH,
  SLUG_SHAPE,
  SUMMARY_LENGTH,
  TITLE_LENGTH,
  describeShareOutcome,
  draftForProject,
  draftProblems,
  problemFor,
  whySendIsOff,
  withheldLines,
  type TemplateShareDraft
} from '@noodl-models/template/shareTemplateForm';

/** A draft that is legal in every respect, so a spec can break exactly one thing at a time. */
const GOOD: TemplateShareDraft = {
  slug: 'a-pricing-page',
  title: 'A pricing page',
  summary: 'Three plan cards, a monthly/yearly toggle and a call to action.',
  category: 'site',
  licence: 'MIT'
};

const bad = (field: keyof TemplateShareDraft, value: string): TemplateShareDraft => ({
  ...GOOD,
  [field]: value
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. The copied rules, against the migration that owns them
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `0021`, if this machine has the platform repository beside this one.
 *
 * ⚠️ The path is a sibling checkout and not a dependency — the two repositories are deployed
 * separately and neither builds the other. A missing file is reported rather than skipped.
 */
const MIGRATION = join(
  __dirname,
  '../../../../../nodegx-community/src/db/sql/0021_fb005_template_submissions.sql'
);

describe('FB-005 T5 — the shape rules are the platform’s, not remembered ones', () => {
  const available = existsSync(MIGRATION);
  const sql = available ? readFileSync(MIGRATION, 'utf8') : '';

  it('the platform migration is on this machine — if not, §1 measured NOTHING', () => {
    // 🔴 This assertion exists so the degradation is LOUD. Every test below it reads `sql`, and an
    // empty string makes a `toContain` fail rather than pass — but a reader skimming green output
    // would not know which of the two happened. This one names it.
    expect(available ? MIGRATION : 'the nodegx-community checkout is missing').toBe(MIGRATION);
  });

  it('the slug regex and its bounds are the constraint’s', () => {
    expect(sql).toContain("proposed_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
    expect(sql).toContain(`length(proposed_slug) between ${SLUG_LENGTH.min} and ${SLUG_LENGTH.max}`);
    // And the local regex really is that one, source-identical.
    expect(SLUG_SHAPE.source).toBe('^[a-z0-9]+(-[a-z0-9]+)*$');
  });

  it('the title and summary bounds are the constraints’', () => {
    expect(sql).toContain(`length(btrim(title)) between ${TITLE_LENGTH.min} and ${TITLE_LENGTH.max}`);
    expect(sql).toContain(`length(btrim(summary)) between ${SUMMARY_LENGTH.min} and ${SUMMARY_LENGTH.max}`);
  });

  it('the licence vocabulary this dialog offers is the one the constraint accepts, both ways', () => {
    // 🔴 The CARDINALITY assertion as well as the two directions — two `toContain` loops are
    // satisfied by two identical lists AND by two empty ones. T4's spec makes the same point about
    // the categories, and this is the same family of defect one table along.
    const inSql = sql.match(/attested_licence in \(([^)]*)\)/)?.[1] ?? '';
    const permitted = inSql.split(',').map((v) => v.trim().replace(/'/g, '')).filter(Boolean);

    expect(permitted.length).toBeGreaterThan(0);
    expect(SHAREABLE_LICENCES).toHaveLength(permitted.length);
    for (const licence of SHAREABLE_LICENCES) expect(permitted).toContain(licence.value);
    for (const value of permitted) expect(SHAREABLE_LICENCES.map((l) => l.value)).toContain(value);
  });

  it('copyleft is not on the list — the ruling that must stay true', () => {
    // ⚠️ Not a shape rule: a GPL template would put its terms on the app somebody builds from it,
    // which inverts the shelf's promise. Ruled 2026-08-26 and asserted so a later addition is
    // a deliberate act rather than a plausible-looking commit.
    const values = SHAREABLE_LICENCES.map((l) => l.value.toLowerCase()).join(' ');
    for (const forbidden of ['gpl', 'agpl', 'lgpl', 'mpl', 'epl', 'cc-by-sa']) {
      expect(values).not.toContain(forbidden);
    }
  });

  it('the categories are the picker’s vocabulary — not a fourth copy', () => {
    // The module maps `TEMPLATE_CATEGORY_LABELS`, so this is an identity check rather than a
    // second list. It is here so that a future edit that inlines a list reddens.
    expect(SHAREABLE_CATEGORIES.map((c) => c.value)).toEqual(Object.keys(TEMPLATE_CATEGORY_LABELS));
    expect(SHAREABLE_CATEGORIES.length).toBeGreaterThan(0);
    expect(sql).toContain("category in ('starter', 'data-app', 'dashboard', 'site', 'form', 'integration')");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The draft a dialog opens with
// ─────────────────────────────────────────────────────────────────────────────

describe('FB-005 T5 — the opening draft', () => {
  it('suggests a slug and a title from the project name', () => {
    const draft = draftForProject('A Pricing Page');
    expect(draft.slug).toBe('a-pricing-page');
    expect(draft.title).toBe('A Pricing Page');
  });

  it('leaves category and licence EMPTY — an assertion nobody made is not an assertion', () => {
    // 🔴 The one that matters. `0021`'s header argues a licence must be a required field of the
    // act rather than a checkbox a client can skip; a pre-selected radio button IS that checkbox.
    const draft = draftForProject('A Pricing Page');
    expect(draft.category).toBe('');
    expect(draft.licence).toBe('');
    expect(draftProblems(draft).map((p) => p.field)).toEqual(
      expect.arrayContaining(['category', 'licence'])
    );
  });

  it('a project name that cannot make a legal slug opens with a PROBLEM, not a silent invention', () => {
    // `suggestedSlug`'s stated contract: `"…"` reduces to the empty string. The honest outcome is
    // an empty field with a message — inventing `untitled-1` files somebody's template under a
    // name they never chose and did not see.
    const draft = draftForProject('…');
    expect(draft.slug).toBe('');
    expect(problemFor(draftProblems(draft), 'slug')).toBeTruthy();
  });

  it('does not throw on a nameless project', () => {
    expect(() => draftForProject(undefined as unknown as string)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. What blocks a send, and what it says
// ─────────────────────────────────────────────────────────────────────────────

describe('FB-005 T5 — draftProblems', () => {
  it('a complete, legal draft has nothing wrong with it', () => {
    // 🔴 THE CONTROL, and it is read first. Every assertion below is that a bad draft produces a
    // problem — all of which a function returning a problem for everything would satisfy.
    expect(draftProblems(GOOD)).toEqual([]);
  });

  it.each([
    ['slug', ''],
    ['slug', 'ab'],
    ['slug', 'A-Pricing-Page'],
    ['slug', 'a--pricing'],
    ['slug', '-pricing'],
    ['slug', 'pricing-'],
    ['slug', 'a'.repeat(SLUG_LENGTH.max + 1)],
    ['title', ''],
    ['title', 'a'],
    ['title', 'a'.repeat(TITLE_LENGTH.max + 1)],
    ['summary', ''],
    ['summary', 'too short'],
    ['summary', 'a'.repeat(SUMMARY_LENGTH.max + 1)],
    ['category', ''],
    ['category', 'pixel-game'],
    ['licence', ''],
    ['licence', 'Apache-2.0'],
    ['licence', 'GPL-3.0']
  ])('refuses %s = %p, and names that field', (field, value) => {
    const problems = draftProblems(bad(field as keyof TemplateShareDraft, value));
    expect(problems.map((p) => p.field)).toEqual([field]);
    expect(problemFor(problems, field as keyof TemplateShareDraft)).toBeTruthy();
  });

  it('accepts a slug and a summary exactly ON the bounds', () => {
    // ⚠️ `between` in SQL is inclusive, so an off-by-one here would refuse a submission the
    // platform would have taken — the failure direction a `toBeTruthy` on the bad cases cannot see.
    expect(draftProblems({ ...GOOD, slug: 'abc' })).toEqual([]);
    expect(draftProblems({ ...GOOD, slug: 'a'.repeat(SLUG_LENGTH.max) })).toEqual([]);
    expect(draftProblems({ ...GOOD, title: 'ab' })).toEqual([]);
    expect(draftProblems({ ...GOOD, summary: 'a'.repeat(SUMMARY_LENGTH.min) })).toEqual([]);
    expect(draftProblems({ ...GOOD, summary: 'a'.repeat(SUMMARY_LENGTH.max) })).toEqual([]);
  });

  it('measures title and summary TRIMMED, as `btrim` does', () => {
    expect(draftProblems({ ...GOOD, title: '   a   ' }).map((p) => p.field)).toEqual(['title']);
    expect(draftProblems({ ...GOOD, summary: `   ${'a'.repeat(SUMMARY_LENGTH.min - 1)}   ` }).map((p) => p.field)).toEqual([
      'summary'
    ]);
  });

  it('at most ONE problem per field', () => {
    // A slug that is both too short and the wrong shape is one mistake, and the second sentence is
    // the consequence of the first.
    const problems = draftProblems({ ...GOOD, slug: 'A' });
    expect(problems).toHaveLength(1);
  });

  it('reports every broken field at once, not just the first', () => {
    const problems = draftProblems({ slug: '', title: '', summary: '', category: '', licence: '' });
    expect(problems.map((p) => p.field).sort()).toEqual(['category', 'licence', 'slug', 'summary', 'title']);
  });

  it('no message names a regular expression or a column', () => {
    // ⚠️ "Invalid slug" and "proposed_slug ~ …" are both sentences about our schema. Everything a
    // person is shown here has to be actionable without seeing it.
    const problems = draftProblems({ slug: 'A B', title: '', summary: '', category: '', licence: '' });
    for (const { message } of problems) {
      expect(message).not.toMatch(/\^|\$|~|_|regex|invalid/i);
      expect(message.length).toBeGreaterThan(10);
    }
  });
});

describe('FB-005 T5 — why the send button is off', () => {
  it('a legal draft, signed in, not sending: the button is ON', () => {
    // 🔴 The control again. `whySendIsOff` returning a string for every input would pass all three
    // of the assertions below and make the dialog impossible to use.
    expect(whySendIsOff({ draft: GOOD, isSignedIn: true, isSending: false })).toBeNull();
  });

  it('signed out is answered FIRST, before the fields', () => {
    // A person would otherwise fill five fields, wait for a walk of their project, and only then
    // be told to sign in. `shareAsTemplate`'s `unauthenticated` arm stays for a lapsed session.
    const why = whySendIsOff({ draft: GOOD, isSignedIn: false, isSending: false });
    expect(why).toMatch(/sign in/i);

    // ⚠️ And it wins over a broken draft — the fields are pointless if the act cannot happen.
    const alsoBad = whySendIsOff({ draft: bad('licence', ''), isSignedIn: false, isSending: false });
    expect(alsoBad).toMatch(/sign in/i);
  });

  it('an incomplete draft says so, rather than leaving a dead button', () => {
    expect(whySendIsOff({ draft: bad('summary', ''), isSignedIn: true, isSending: false })).toBeTruthy();
  });

  it('sending is a reason too, so the button cannot be pressed twice', () => {
    expect(whySendIsOff({ draft: GOOD, isSignedIn: true, isSending: true })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. What came back, in the words the person reads
// ─────────────────────────────────────────────────────────────────────────────

/** Every arm of the union, named here so a new one added without a sentence reddens §4. */
const EVERY_OUTCOME: ShareAsTemplateOutcome[] = [
  { outcome: 'submitted', submissionId: 's1', excluded: [] },
  { outcome: 'no-manifest', looked: ['nodegx.project.json'] },
  // DEF-007 — a project with no home page. Registered here so the exhaustive-headline assertion
  // below reddens if it were ever given the same sentence as `no-manifest`, which is the mistake
  // available: both are "your folder is wrong" shaped and they mean opposite things.
  { outcome: 'no-home', manifest: 'nodegx.project.json' },
  // ❌ `binaries` was here. `0023` gave the transport a base64 map, so a project with a PNG in it
  // is shared rather than refused, and the arm was DELETED from the union rather than left
  // unreachable — see `ShareAsTemplateOutcome`. This list is what makes that deletion visible:
  // it is exhaustively typed, so an arm removed here and left in the union reddens §4.
  { outcome: 'too-big', bytes: MAX_TEMPLATE_BYTES + 1, limit: MAX_TEMPLATE_BYTES },
  { outcome: 'empty' },
  { outcome: 'unauthenticated' },
  { outcome: 'absent' },
  { outcome: 'refused', detail: 'template-slug: already taken' },
  { outcome: 'unreachable', detail: 'the community could not be reached' }
];

describe('FB-005 T5 — describeShareOutcome', () => {
  it('🔴 DEF-007 — "no home page" says what to DO, and does not read as "wrong folder"', () => {
    const sentence = describeShareOutcome({ outcome: 'no-home', manifest: 'nodegx.project.json' });
    expect(sentence.tone).toBe('problem');

    const words = `${sentence.headline} ${sentence.detail}`.toLowerCase();
    // 🔴 It names the ACT that fixes it. A refusal that only states the rule leaves somebody at a
    // dialog with nowhere to go, and "home page" is a term they may never have met.
    expect(words).toMatch(/make home/);
    // 🔴 And it must NOT tell them they picked the wrong folder — that is `no-manifest`'s
    // sentence, and this person picked exactly the right one.
    expect(words).not.toMatch(/not a nodegx project|wrong folder/);
  });

  it('every arm has its OWN headline — none falls through to another’s', () => {
    // 🔴 The assertion a `switch` with a `default` needs. Without it, an arm somebody forgets to
    // write lands on the `unreachable` sentence and tells a person the network is down when their
    // project was refused.
    const headlines = EVERY_OUTCOME.map((o) => describeShareOutcome(o).headline);
    expect(new Set(headlines).size).toBe(EVERY_OUTCOME.length);
    for (const headline of headlines) expect(headline.length).toBeGreaterThan(0);
  });

  it('SUCCESS NEVER SAYS PUBLISHED, LIVE OR ON THE SHELF', () => {
    // 🔴 The one wrong conclusion available on this screen, and `submitTemplate`'s header calls
    // the naming load-bearing. This is where it either holds or does not.
    const sentence = describeShareOutcome({ outcome: 'submitted', submissionId: 's1', excluded: [] });
    expect(sentence.tone).toBe('submitted');
    const words = `${sentence.headline} ${sentence.detail}`.toLowerCase();
    expect(words).not.toMatch(/published|is live|on the shelf(?! yet)|available now/);
    // And it says positively what has NOT happened, rather than merely avoiding the word.
    expect(words).toMatch(/not on the shelf yet|review/);
  });

  it('what stayed behind travels out with the success, with its reason', () => {
    // 🔴 `.mcp.json` is the sharp one — absolute paths out of the author's home directory. A share
    // that silently withheld a file is the same defect as one that silently sent one.
    const sentence = describeShareOutcome({
      outcome: 'submitted',
      submissionId: 's1',
      excluded: ['.mcp.json', '.git/config', 'node_modules/left-pad/index.js']
    });
    expect(sentence.withheld.map((w) => w.path)).toEqual([
      '.mcp.json',
      '.git/config',
      'node_modules/left-pad/index.js'
    ]);
    for (const entry of sentence.withheld) expect(entry.why.length).toBeGreaterThan(10);
    // The `.mcp.json` reason is the editor's own gitignore reason, not a generic one.
    expect(sentence.withheld[0].why).toMatch(/absolute paths/i);
  });

  it('a success with nothing withheld draws nothing — an empty list is a real answer', () => {
    expect(describeShareOutcome({ outcome: 'submitted', submissionId: 's1', excluded: [] }).withheld).toEqual([]);
  });

  it('the platform’s refusal is shown in ITS OWN WORDS', () => {
    // It knows which constraint was broken; a sentence invented here is a guess at a rule that
    // lives in another repository.
    const sentence = describeShareOutcome({ outcome: 'refused', detail: 'template-slug: already taken' });
    expect(sentence.detail).toBe('template-slug: already taken');
    expect(sentence.tone).toBe('refused');
  });

  it('too-big names both numbers in MiB, because the cap is 1024-based', () => {
    const sentence = describeShareOutcome({
      outcome: 'too-big',
      bytes: 12 * 1024 * 1024,
      limit: MAX_TEMPLATE_BYTES
    });
    expect(sentence.detail).toContain('12 MiB');
    expect(sentence.detail).toContain('8 MiB');
    // ⚠️ Not "MB". 8 * 1024 * 1024 is not 8 MB and a person checking their folder size would
    // measure a different number than the one refusing them.
    expect(sentence.detail).not.toMatch(/\d\s?MB\b/);
  });

  it('no-manifest names what was LOOKED for', () => {
    const looked = ['nodegx.project.json', 'components/_registry.json', 'project.json'];
    const sentence = describeShareOutcome({ outcome: 'no-manifest', looked });
    for (const name of looked) expect(sentence.detail).toContain(name);
  });

  it('absent is not narrated as a failure of ours, and does NOT blame the account', () => {
    // 🔴 **A DRIVE CHANGED THIS SPEC.** It used to assert only that the sentence avoided
    // "error"/"went wrong". Then a real share hit `community.nodegx.io` and came back `absent`
    // because the deployed platform predates FB-005 T3 — the route is not there at all — while
    // the sentence said *"Sharing is not available on this account"*. True-sounding, and it
    // blamed a person's account for a deployment gap.
    const sentence = describeShareOutcome({ outcome: 'absent' });
    const words = `${sentence.headline} ${sentence.detail}`.toLowerCase();
    expect(words).not.toMatch(/error|went wrong|failed/);
    // It must not assert a cause. `absent` has four of them and this side cannot tell them apart.
    expect(sentence.headline.toLowerCase()).not.toMatch(/your account|this account/);
    // ⚠️ Naming them as possibilities is fine — asserting one is not. The detail says "can be".
    expect(sentence.detail).toMatch(/can be because/i);
  });

  it('🔴 NO sentence anywhere still tells somebody that templates cannot carry images', () => {
    // 🔴 **THIS SPEC REPLACES THE ONE THAT GRADED THAT SENTENCE'S GRAMMAR.** *"Templates cannot
    // carry images yet"* was true, carefully worded, and is now false — and a false sentence in
    // a dialog is worse than a missing one, because a person reads it as current and goes and
    // deletes their logo. Asserted over EVERY arm rather than over the deleted one, because the
    // failure mode is somebody re-adding the wording to a neighbouring message.
    for (const outcome of EVERY_OUTCOME) {
      const sentence = describeShareOutcome(outcome);
      // ⚠️ No message argument: `expect(value, message)` is vitest's, and this runner is jest —
      // a two-argument `expect` here fails the suite TO RUN. The outcome is put in the string
      // instead, so a failure still names which arm broke.
      const words = `${outcome.outcome}: ${sentence.headline} ${sentence.detail}`.toLowerCase();
      expect(words).not.toMatch(/cannot carry image|is not text|are not text/);
    }
  });

  it('every tone is one of the three the modal can draw', () => {
    for (const outcome of EVERY_OUTCOME) {
      expect(['submitted', 'problem', 'refused']).toContain(describeShareOutcome(outcome).tone);
    }
  });
});

describe('FB-005 T5 — withheldLines', () => {
  it('an unknown path still gets a reason rather than an empty cell', () => {
    expect(withheldLines(['something/odd']).map((w) => w.why.length > 0)).toEqual([true]);
  });
});
