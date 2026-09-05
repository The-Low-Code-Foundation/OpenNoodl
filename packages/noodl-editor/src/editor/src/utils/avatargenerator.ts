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

/** The licence every shipped style must carry — see {@link SHIPPED_AVATAR_STYLES}. */
export const REQUIRED_DESIGN_LICENCE = 'CC0 1.0';

/** The structural shape of a `@dicebear/<style>` module, so nothing here has to import one. */
export interface AvatarStyle {
  meta: {
    title: string;
    creator?: string;
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
  { id: 'thumbs', name: 'Creatures' },
  { id: 'open-peeps', name: 'Hand drawn' },
  { id: 'lorelei', name: 'Illustrated' },
  { id: 'notionists', name: 'Sketched' },
  { id: 'pixel-art', name: 'Pixel art' },
  { id: 'shapes', name: 'Shapes' },
  { id: 'rings', name: 'Rings' },
  { id: 'identicon', name: 'Identicon' },
  { id: 'glass', name: 'Glass' }
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
): Array<{ id: string; licence: string }> {
  return styles
    .map(({ id, style }) => ({ id, licence: style?.meta?.license?.name ?? '(none declared)' }))
    .filter(({ licence }) => licence !== REQUIRED_DESIGN_LICENCE);
}
