/**
 * FIX-021 slice B — the global user profile: format, cap and rendering.
 *
 * Everything NodeGX knows about *the person* rather than *the project*, in one
 * markdown file at `<userData>/PREFERENCES.md`. Richard's own framing settled
 * the shape: *"even stuff like 'the user speaks casually but avoids swear
 * words' or 'User isn't comfortable with pure javascript and we should prefer
 * inbuilt nodes'"* — prose a model interprets, not settings a product acts on.
 *
 * ## Why this module imports nothing but a truncator
 *
 * Same rule as `ProjectDocs/docsText`: the authoring loop runs in the headless
 * measurement bundle, where there is no Electron, no `filesystem` and no
 * `platform`. The path, the poll and the seeding all live in `./install`; what
 * is here is the part that decides *what the model is told*, and it is the part
 * worth grading.
 *
 * `truncateDoc` is imported rather than reimplemented. `docsText` says it in so
 * many words — *"writing a second truncator is how the two drift"* — and a
 * preferences file cut mid-sentence is exactly the failure it already avoids.
 *
 * ## The empty-file rule, which is the whole answer to the per-turn cost
 *
 * A global always-doc is a cost on every turn of every project, forever. The
 * brainstorm's Q5 asks what stops that being a tax, and the answer built here is
 * mechanical rather than a policy: **the file is seeded with prompts, and the
 * prompts cost nothing.**
 *
 * - Guidance is written in HTML comments, which are stripped before anything is
 *   sent. They render as nothing in a markdown preview, and they are
 *   unambiguously *not* the user's answer — no heuristic has to guess.
 * - A heading with nothing written under it is dropped. Delete three of the four
 *   headings or answer one of them; either way you pay for the words you wrote.
 * - A file that says nothing at all renders `undefined`, and the caller omits
 *   the block entirely — the absent-means-omitted convention every optional
 *   block in the authoring prompt keeps, so a user who never opens this file
 *   sends byte-identical turns to before it existed.
 *
 * @module UserProfile/profileText
 */

import { truncateDoc } from '../ProjectDocs/docsText';

/** The file's name under `<userData>`. */
export const PROFILE_FILE = 'PREFERENCES.md';

/**
 * The most of this file that ever reaches a turn.
 *
 * Deliberately far below `DEFAULT_DOC_CAP` (6,000): a project doc is about a
 * body of work and earns its bytes, while this rides along on every turn of
 * every project on the machine. 2,000 characters is roughly a page — enough for
 * standing preferences, not enough to become a diary.
 */
export const PROFILE_CAP = 2_000;

/** One heading of the profile that the user has actually written under. */
export interface ProfileSection {
  /** The heading text, or `''` for prose written above the first heading. */
  heading: string;
  /** What the user wrote, comments stripped and trimmed. Never empty. */
  body: string;
}

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * The seed. Prompts only — every word of guidance is inside a comment, so a
 * freshly seeded file is worth exactly zero prompt bytes until someone types.
 *
 * The four headings are the four things a builder would otherwise have to
 * repeat in every project: tone, build preferences, background, and what they
 * are actually making.
 */
export const PROFILE_TEMPLATE = `# NodeGX preferences

<!--
This file is yours. NodeGX reads it before it builds anything for you, in every
project on this machine, so what you write here you never have to say twice.

It is plain markdown and nothing else ever rewrites it. Edit it here or in any
editor you like; NodeGX picks up changes within a couple of seconds.

The headings below are prompts, not a form. Delete one you have nothing to say
under, add one that suits you better, or ignore them and write a paragraph.

Nothing you have not written costs you anything: only headings with something
under them are sent, these comments are never sent, and while the file says
nothing NodeGX sends nothing at all.
-->

## How I like to be talked to

<!-- e.g. "Plain English, no jargon." / "Keep it short." / "Tell me why." -->

## How I like things built

<!-- e.g. "Prefer built-in nodes; only reach for a Function node when there is
no other way." / "Always use design tokens, never raw colours." -->

## What I know, and what I don't

<!-- e.g. "Comfortable with React, new to visual programming." -->

## What I am building, and where it runs

<!-- e.g. "Internal tools for a small team, deployed to our own server." -->
`;

/**
 * The sections of a profile that carry something, in file order.
 *
 * The file's own title — a level-1 heading, and only the *first* heading in the
 * file — is treated as chrome and dropped. A later `#` is the user choosing to
 * write that way and keeps its text; guessing that they meant chrome would
 * silently delete a section of what they wrote, which is the one failure a
 * format like this cannot have.
 */
export function profileSections(source: string): ProfileSection[] {
  const text = source.replace(/\r\n/g, '\n').replace(HTML_COMMENT, '');
  const sections: ProfileSection[] = [];

  let heading = '';
  let body: string[] = [];
  let seenHeading = false;

  const flush = () => {
    const written = body.join('\n').trim();
    if (written) sections.push({ heading, body: written });
    body = [];
  };

  for (const line of text.split('\n')) {
    const match = HEADING.exec(line);
    if (!match) {
      body.push(line);
      continue;
    }
    flush();
    const isFileTitle = match[1].length === 1 && !seenHeading;
    seenHeading = true;
    heading = isFileTitle ? '' : match[2].trim();
  }
  flush();

  return sections;
}

/**
 * The profile as the model should see it, or `undefined` when the user has
 * written nothing — which is the caller's signal to omit the block entirely.
 *
 * Returns the body only. The block wrapper and the precedence sentence belong
 * to the prompt, beside the blocks they rank against, exactly as the PROJECT
 * CONVENTIONS block keeps its own sentence in `prompts/authoring.ts`.
 */
export function renderProfileForPrompt(source: string, cap = PROFILE_CAP): string | undefined {
  const sections = profileSections(source);
  if (sections.length === 0) return undefined;

  const rendered = sections
    .map((section) => (section.heading ? `## ${section.heading}\n${section.body}` : section.body))
    .join('\n\n');

  return truncateDoc(rendered, cap).text.trim() || undefined;
}
