/**
 * FIX-021 slice B — the profile format, graded where the rule lives.
 *
 * `profileText` imports one function and nothing else, which is what makes it
 * reachable from this plain-Node runner: the path, the poll and the seeding are
 * all in `./install`, behind `@noodl/platform`, and none of them decides what a
 * model is told.
 *
 * The claim worth grading is not "the file is read". It is the **empty-file
 * rule** — a seeded profile the user has not written in must cost zero prompt
 * bytes — because that is the entire answer to the objection that a global
 * always-doc taxes every turn of every project forever. If it is wrong, the
 * feature is a permanent charge for a file most people never open, and nothing
 * on screen would say so.
 */

import {
  PROFILE_CAP,
  PROFILE_TEMPLATE,
  profileSections,
  renderProfileForPrompt
} from '../../src/editor/src/models/UserProfile/profileText';

describe('FIX-021 slice B — the profile format', () => {
  describe('the empty-file rule', () => {
    it('renders nothing for a file nobody has touched', () => {
      // The criterion, as a byte fact rather than an intention: seeding is free.
      expect(renderProfileForPrompt(PROFILE_TEMPLATE)).toBeUndefined();
      expect(profileSections(PROFILE_TEMPLATE)).toEqual([]);
    });

    it('renders nothing for an empty, blank or heading-only file', () => {
      expect(renderProfileForPrompt('')).toBeUndefined();
      expect(renderProfileForPrompt('   \n\n\t\n')).toBeUndefined();
      expect(renderProfileForPrompt('# NodeGX preferences\n\n## How I like things built\n\n')).toBeUndefined();
    });

    it('renders nothing for a file that is only comments', () => {
      expect(renderProfileForPrompt('<!-- just thinking out loud -->')).toBeUndefined();
    });

    // The other direction, and it is the half that stops the rule being
    // "renders nothing, always" — an assertion that only checked emptiness
    // would pass just as happily against a function that returned undefined.
    it('renders what the user actually wrote', () => {
      const rendered = renderProfileForPrompt(`${PROFILE_TEMPLATE}\nPrefer built-in nodes.`);
      expect(rendered).toContain('Prefer built-in nodes.');
    });
  });

  describe('what survives into the prompt', () => {
    it('drops the guidance comments but keeps the answer beside them', () => {
      const source = ['## How I like things built', '<!-- e.g. "use tokens" -->', 'Prefer built-in nodes.'].join('\n');
      const rendered = renderProfileForPrompt(source)!;
      expect(rendered).toContain('Prefer built-in nodes.');
      expect(rendered).not.toContain('e.g.');
      expect(rendered).toContain('## How I like things built');
    });

    it('drops an unanswered heading and keeps an answered one', () => {
      const source = [
        '# NodeGX preferences',
        '',
        '## How I like to be talked to',
        '',
        '## How I like things built',
        '',
        'Prefer built-in nodes.'
      ].join('\n');
      const sections = profileSections(source);
      expect(sections).toEqual([{ heading: 'How I like things built', body: 'Prefer built-in nodes.' }]);
    });

    it('keeps prose written above the first heading, unheaded', () => {
      // Somebody who ignores the form and just writes a paragraph must not have
      // it silently discarded — that is the one failure this format cannot have.
      expect(profileSections('I speak casually but I do not swear.')).toEqual([
        { heading: '', body: 'I speak casually but I do not swear.' }
      ]);
    });

    it("treats only the FIRST level-1 heading as the file's title", () => {
      // Prose directly under the title is unheaded — the title is chrome. Prose
      // under a LATER `#` keeps its label: that is the user choosing to write
      // that way, and guessing it was chrome would delete a section's name.
      //
      // Both halves need prose under them to separate at all. A version of this
      // row with empty sections passed against a mutant that removed the branch
      // outright, because empty sections are dropped either way.
      const sections = profileSections('# NodeGX preferences\n\nI speak casually.\n\n# My own heading\n\nSomething.');
      expect(sections).toEqual([
        { heading: '', body: 'I speak casually.' },
        { heading: 'My own heading', body: 'Something.' }
      ]);
    });

    it('handles CRLF the same as LF', () => {
      const sections = profileSections('## Tone\r\n\r\nKeep it short.\r\n');
      expect(sections).toEqual([{ heading: 'Tone', body: 'Keep it short.' }]);
    });
  });

  describe('the cap', () => {
    it('never sends more than the cap, however long the file is', () => {
      const long = `## Tone\n\n${'x'.repeat(PROFILE_CAP * 3)}`;
      expect(renderProfileForPrompt(long)!.length).toBeLessThanOrEqual(PROFILE_CAP);
    });

    it('leaves a file under the cap whole, normalised', () => {
      // The blank line under the heading is chrome the renderer drops: sections
      // are rebuilt from heading + trimmed body, so what goes out is compact and
      // identical whether the user left one blank line there or four.
      expect(renderProfileForPrompt('## Tone\n\nKeep it short.')).toBe('## Tone\nKeep it short.');
      expect(renderProfileForPrompt('## Tone\n\n\n\nKeep it short.')).toBe('## Tone\nKeep it short.');
    });
  });

  /**
   * The rows above are the cases that occurred to me. This walks the space, and
   * it is what catches the empty-file rule being broken *somewhere I did not
   * write a named row for* — a comment style, a heading depth or a whitespace
   * shape I did not think of.
   */
  describe('the matrix — nothing without prose, something with it', () => {
    const chrome = [
      '',
      '# NodeGX preferences',
      '## How I like things built',
      '###### deep',
      '<!-- a comment -->',
      '<!--\nmultiple\nlines\n-->',
      '   ',
      '\t\n',
      PROFILE_TEMPLATE
    ];
    const prose = ['Prefer built-in nodes.', 'I speak casually.', '- a bullet', '1. a number'];

    it('renders undefined for every combination of chrome alone', () => {
      for (const a of chrome) {
        for (const b of chrome) {
          expect(renderProfileForPrompt(`${a}\n${b}`)).toBeUndefined();
        }
      }
    });

    it('renders the prose for every combination of chrome plus one written line', () => {
      for (const a of chrome) {
        for (const b of chrome) {
          for (const written of prose) {
            const rendered = renderProfileForPrompt(`${a}\n${b}\n${written}`);
            expect(rendered).toBeDefined();
            expect(rendered).toContain(written);
          }
        }
      }
    });
  });
});
