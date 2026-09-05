/**
 * SYL-003 — turning a word the author types into a picture their project owns.
 *
 * Richard asked for *"some kind of image avatar search API type thing where they can search for an
 * image by keyword and select one"*. This is that, with the search replaced by generation, which
 * keeps the idea and loses both of its problems:
 *
 * - **Offline.** Lesson 1 is the most beginner-facing thing we ship, and a remote image search puts
 *   a network call in minute five of a learner's first hour. A generator has no origin to reach.
 * - **Moderation.** An unfiltered keyword photo search inside a product sold to universities can
 *   return anything, on the first screen a learner ever sees. A generator cannot retrieve, so there
 *   is nothing to filter.
 *
 * It is also closer to what was actually asked for than a photo search would have been: the learner
 * types `Nibbles` and gets *their* creature, deterministically, rather than somebody's stock photo.
 *
 * ## Why this module imports nothing
 *
 * DiceBear is ESM-only, and the `tests-unit` runner is CommonJS — an `import` of `@dicebear/core`
 * here fails the suite *to run*, which is the loudest way this repo has of hiding a defect. So the
 * library is injected: {@link AvatarStyle} is the structural shape of a DiceBear style module and
 * {@link CreateAvatar} the shape of its one entry point, and `avatarstyles.ts` — reachable only
 * from webpack — is the single file that names the packages. Everything decided here (the seeds,
 * the names, the file names, the licence rule) is then gradeable in plain Node, which is where the
 * defects in it would be.
 *
 * @module noodl-editor/utils/avatargenerator
 */

/**
 * The artwork licences a shipped style may carry — see {@link SHIPPED_AVATAR_STYLES}.
 *
 * 🔴 Both are shippable, but only one is free. **CC BY 4.0 obliges us to credit the artist
 * wherever the work appears**, which for this product means inside the learner's project, because
 * what they export is what gets published. {@link avatarCreditFor} and
 * {@link upsertAvatarCredits} are how that obligation is met rather than merely noted.
 *
 * ⚠️ What is deliberately NOT here is the third category: `bottts` and `avataaars` offer only the
 * sentence *"free for personal and commercial use"* on a web page — no licence text, no version,
 * nothing that survives the page changing. Richard's ruling of 2026-09-05 added the CC BY styles
 * and left those two out.
 */
export const PERMITTED_DESIGN_LICENCES = ['CC0 1.0', 'CC BY 4.0'] as const;

/** The licences that oblige an attribution to travel with the picture. */
export const ATTRIBUTION_LICENCES = ['CC BY 4.0'] as const;

/** Whether a style's licence obliges a credit in the project that uses it. */
export function requiresAttribution(licence: string | undefined): boolean {
  return ATTRIBUTION_LICENCES.some((name) => (licence ?? '').startsWith(name));
}

/** The structural shape of a `@dicebear/<style>` module, so nothing here has to import one. */
export interface AvatarStyle {
  meta: {
    title: string;
    creator?: string;
    source?: string;
    license?: { name?: string; url?: string };
  };
  create: unknown;
  schema?: unknown;
}

/** The shape of `createAvatar` from `@dicebear/core`. */
export type CreateAvatar = (
  style: AvatarStyle,
  options: { seed: string; size?: number; [key: string]: unknown }
) => { toString(): string };

export interface AvatarStyleEntry {
  /** The `@dicebear` package name minus the scope — also the file-name suffix. */
  id: string;
  /** What the picker calls it. */
  name: string;
}

/**
 * The styles the picker offers, and the rule behind the list.
 *
 * 🔴 **Every one of these is CC0 1.0, and that is a shipping rule rather than a preference.**
 * `@dicebear/core` is MIT, but the *artwork* in each style package is licensed separately and most
 * of it is not: `adventurer`, `fun-emoji`, `croodles`, `big-smile`, `micah`, `personas` and
 * `toon-head` are **CC BY 4.0**, which obliges us to carry an attribution into every project a
 * learner exports; `bottts` and `avataaars` say only *"free for personal and commercial use"* on a
 * web page, which is not a licence text at all. None of those is a defensible thing to put in a
 * product sold to universities without somebody deciding to, so the list is the CC0 subset and
 * `avatarLicenceViolations` is the gate that keeps it that way.
 *
 * ⚠️ `bottts` is the obvious creature style and its absence is deliberate, not an oversight. It
 * needs a licensing decision, not a code change — see SYL-003.
 */
export const SHIPPED_AVATAR_STYLES: AvatarStyleEntry[] = [
  // CC0 1.0 — public domain, no credit owed.
  { id: 'thumbs', name: 'Creatures' },
  { id: 'open-peeps', name: 'Hand drawn' },
  { id: 'lorelei', name: 'Illustrated' },
  { id: 'notionists', name: 'Sketched' },
  { id: 'pixel-art', name: 'Pixel art' },
  { id: 'shapes', name: 'Shapes' },
  { id: 'rings', name: 'Rings' },
  { id: 'identicon', name: 'Identicon' },
  { id: 'glass', name: 'Glass' },
  // CC BY 4.0 — Richard's ruling, 2026-09-05. Each one credits a named artist, and picking one
  // writes that credit into the project (see `upsertAvatarCredits`).
  { id: 'adventurer', name: 'Adventurers' },
  { id: 'fun-emoji', name: 'Fun faces' },
  { id: 'croodles', name: 'Doodles' },
  { id: 'big-smile', name: 'Big smiles' },
  { id: 'micah', name: 'Portraits' },
  { id: 'personas', name: 'Personas' },
  { id: 'toon-head', name: 'Cartoon heads' }
];

/** How many alternatives one keyword offers per style, including the keyword itself. */
export const AVATAR_VARIATIONS = 4;

/**
 * The seed for variation `n` of a keyword.
 *
 * Variation 0 is the bare keyword, so the same word always gives the same first creature — which
 * is the property that makes this feel like *theirs* rather than a shuffle. The rest are suffixed
 * rather than randomised for the same reason: reopening the picker offers the same nine-by-four
 * grid, so an author who liked the third one and closed the popout can go back and find it.
 */
export function avatarSeed(keyword: string, variation: number): string {
  const base = keyword.trim();
  return variation <= 0 ? base : `${base} ${variation + 1}`;
}

/**
 * A file-name-safe form of what the author typed.
 *
 * Deliberately lossy: anything that is not a letter, a digit or a dash becomes a dash, so a
 * keyword in a script this repo has never seen collapses to `avatar` rather than to a name the
 * project's own asset walk or a web server would then disagree about.
 */
export function avatarSlug(keyword: string): string {
  const slug = keyword
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'avatar';
}

/**
 * What the chosen avatar is called on disk.
 *
 * Takes the **seed**, not the keyword, because the seed is the whole identity of a picture: the
 * style id and the variation are already in it, so `Nibbles 3` in the pixel style lands as
 * `nibbles-3-pixel-art.svg` and two different choices can never contend for one name. The style id
 * is in the name for the same reason — picking the same word in two styles should give two files,
 * not a collision resolved by a `-1` that says nothing about which is which.
 */
export function avatarFileName(seed: string, styleId: string): string {
  return `${avatarSlug(seed)}-${styleId}.svg`;
}

/**
 * Render one avatar to an SVG string.
 *
 * `size` is written onto the SVG as its `width`/`height` while the `viewBox` stays intact, so the
 * file scales in an `Image` node whatever box it is given — it is a hint for anything that opens
 * the file on its own, not a resolution. There is no rasterising step and no PNG: SYL-003 step 1
 * measured an `Image` node rendering exactly this output from `assets/`, with a deliberately
 * missing file beside it to prove the instrument could see a failure.
 */
export function renderAvatarSvg(
  createAvatar: CreateAvatar,
  style: AvatarStyle,
  seed: string,
  size = 128
): string {
  return createAvatar(style, { seed, size }).toString();
}

/**
 * The styles whose artwork licence is not {@link REQUIRED_DESIGN_LICENCE}, read from the style
 * modules themselves rather than from this file's own list.
 *
 * 🔴 The direction matters. Asserting that the nine ids above are the nine ids above proves
 * nothing; this asks each *installed package* what it is licensed under, so adding a tenth style
 * with a CC BY artist reddens the gate at the moment it is added rather than at the moment
 * somebody is asked to indemnify it.
 */
export function avatarLicenceViolations(
  styles: Array<{ id: string; style: AvatarStyle }>
): Array<{ id: string; licence: string; reason: string }> {
  const violations: Array<{ id: string; licence: string; reason: string }> = [];

  styles.forEach(({ id, style }) => {
    const licence = style?.meta?.license?.name ?? '(none declared)';

    if (!PERMITTED_DESIGN_LICENCES.some((permitted) => licence.startsWith(permitted))) {
      violations.push({ id, licence, reason: 'not a permitted artwork licence' });
      return;
    }

    // 🔴 A CC BY style with no named artist cannot be complied with. Shipping one would mean
    // writing a credits file with a blank in it, which is worse than not shipping the style: it
    // reads as an attribution and is not one.
    if (requiresAttribution(licence) && !style?.meta?.creator) {
      violations.push({ id, licence, reason: 'attribution required but no creator is declared' });
    }
  });

  return violations;
}

/**
 * The credit a chosen avatar owes, or `undefined` when it owes none.
 *
 * CC0 returns `undefined` — public domain asks for nothing, and writing a credit for it would put
 * a claim in the learner's project that the licence does not make.
 */
export function avatarCreditFor(
  fileName: string,
  styleName: string,
  meta: AvatarStyle['meta']
): AvatarCredit | undefined {
  const licence = meta?.license?.name ?? '';
  if (!requiresAttribution(licence)) return undefined;

  return {
    fileName,
    styleName,
    creator: meta.creator ?? '',
    licence,
    licenceUrl: meta.license?.url
  };
}

export interface AvatarCredit {
  /** Project-relative path of the picture the credit is for. */
  fileName: string;
  styleName: string;
  creator: string;
  licence: string;
  licenceUrl?: string;
}

/** Where the credits live, so they travel with the project into whatever it is exported as. */
export const AVATAR_CREDITS_FILE = 'IMAGE-CREDITS.md';

const CREDITS_HEADER = [
  '# Image credits',
  '',
  'Some of the pictures in this project were generated with DiceBear. The styles below are',
  'licensed **CC BY 4.0**, which asks that the artist is credited wherever the work appears —',
  'including in anything you publish or export from this project, so this file belongs with it.',
  '',
  '⚠️ This table is maintained by the editor. Add notes around it, but edit the rows and the next',
  'avatar you pick will rewrite them.',
  '',
  '| picture | style | artist | licence |',
  '| --- | --- | --- | --- |'
].join('\n');

/** One table row, and the shape `parseAvatarCredits` reads back. */
function creditRow(credit: AvatarCredit): string {
  const licence = credit.licenceUrl ? `${credit.licence} (${credit.licenceUrl})` : credit.licence;
  return `| ${credit.fileName} | ${credit.styleName} | ${credit.creator} | ${licence} |`;
}

/**
 * Read the credits back out of a file this wrote.
 *
 * Deliberately tolerant: it matches four-column rows and ignores everything else, so prose a
 * person added above or below the table survives being read — and the header row is skipped by
 * the `---` test rather than by counting lines, because a file somebody edited will not have the
 * line numbers this expects.
 */
export function parseAvatarCredits(existing: string): AvatarCredit[] {
  const credits: AvatarCredit[] = [];

  (existing || '').split('\n').forEach((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    // A row is `| a | b | c | d |`, so splitting gives two empty outer cells plus four.
    if (cells.length !== 6 || cells[0] !== '' || cells[5] !== '') return;
    const [, fileName, styleName, creator, licenceCell] = cells;
    if (!fileName || fileName === 'picture' || /^-+$/.test(fileName)) return;

    const urlMatch = /^(.*?)\s*\((https?:[^)]+)\)$/.exec(licenceCell);
    credits.push({
      fileName,
      styleName,
      creator,
      licence: urlMatch ? urlMatch[1] : licenceCell,
      licenceUrl: urlMatch ? urlMatch[2] : undefined
    });
  });

  return credits;
}

/**
 * The credits file with `credit` added or updated, sorted by file name.
 *
 * 🔴 Idempotent on the file name, because picking the same avatar twice is ordinary and a credits
 * file that grew a duplicate row every time would be the first thing an author deleted — taking
 * the attribution with it.
 */
export function upsertAvatarCredits(existing: string, credit: AvatarCredit): string {
  const credits = parseAvatarCredits(existing).filter((c) => c.fileName !== credit.fileName);
  credits.push(credit);
  credits.sort((a, b) => (a.fileName < b.fileName ? -1 : 1));

  return [CREDITS_HEADER, ...credits.map(creditRow), ''].join('\n');
}
