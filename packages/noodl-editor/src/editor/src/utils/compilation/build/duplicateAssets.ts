/**
 * EXP-017 AC4 — one file, shipped twice, under two names.
 *
 * ## The measurement
 *
 * A deploy of the CMP-002 landing page published `fonts/Inter/Inter-Medium.ttf` **and**
 * `noodl_modules/inter/Inter-Medium.ttf`: 314,712 bytes each, byte for byte the same face, from two
 * producers that have never heard of each other. The module is installed into every project by
 * `STARTER_ASSETS`; the `fonts/` copy arrives with an imported prefab, which carries its own.
 * Nobody chose to publish it twice and nothing in the run said it had.
 *
 * ## 🔴 Identity is BYTES, and it has to be
 *
 * Two files with the same name are not the same file, and "these are both called `Inter-Medium`"
 * is a guess dressed as a fact — a project may hold a subset, a hinted variant, or a different
 * typeface somebody renamed. Deduplicating on a name would make a deploy silently substitute one
 * font for another, which is the exact class of failure {@link ./starterImagery} was written to
 * avoid on photographs. So a pair here is a pair only when every byte matches, which is provable
 * and is proved, per deploy, on the files that are actually about to ship.
 *
 * ## 🔴 ONE of the pair must be something the PRODUCT installed
 *
 * Measured, by breaking a shipped spec. The first version of this rule deduplicated *any* two
 * identical files, and DEP-008's fixture holds `assets/logo.png` and `pre.gitlab-assets/logo.png`
 * with the same three bytes in each — two copies of a user's own picture, in two folders they
 * chose. It dropped one, and `criterion 4 — deploys pre.gitlab-assets/` went red.
 *
 * It was right to. `nodegx deploy`'s contract is *everything beside `nodegx.project.json` ships
 * unless a named rule excludes it*, and a person who keeps two copies of their logo has two URLs
 * they may be using — in a hosted page, in an email, in something this deploy cannot read at all.
 * The defect EXP-017 measured is narrower than "the same bytes twice": it is **the product
 * installing a file that something else already brought**. So a pair is only a pair here when at
 * least one side is under `noodl_modules/`, and the module copy is the one that survives.
 *
 * ## 🔴 And a duplicate is only dropped when NOTHING refers to it
 *
 * The surviving copy lives at a **different URL**, so a reference to the dropped one is a 404. A
 * deploy has no safe way to rewrite that reference: the paths are spread across exported node
 * parameters, `Static Data` JSON, script strings and the project's own stylesheets, and a rewrite
 * that reaches four of those five leaves a stranger's website with a missing typeface and a clean
 * report. The rule this file implements is therefore the narrow, provable one:
 *
 *   > A duplicate is excluded when the project's own source text never mentions it.
 *
 * That is the common case in practice — a `fonts/` folder left behind by a prefab whose component
 * was deleted — and it is the only case where dropping it is knowably free. When a duplicate IS
 * referenced, the copy step says so in a warning naming both paths, and ships both. **A reported
 * 307 KB is a smaller failure than a silently broken page.**
 *
 * @module compilation/build/duplicateAssets
 */

/** Characters a filename may be made of, for the token that follows a directory reference. */
const FILENAME_TOKEN = /[A-Za-z0-9._-]+/y;

/** One pair the caller has proved identical. */
export interface DuplicatePair {
  /** The copy that stays. Project-root relative, `/` separated. */
  keep: string;
  /** The copy that would be dropped. */
  drop: string;
  /** Bytes each of them occupies, for the report. */
  bytes: number;
}

export interface DuplicateAssetPlan {
  /** Paths safe to leave out, with the survivor that makes them safe. */
  drop: { path: string; keep: string; bytes: number }[];
  /** Duplicates that are referenced, so both copies ship. One warning each. */
  kept: { path: string; keep: string; bytes: number; reason: string }[];
}

/** The prefix that makes a file something the product put there rather than something a person did. */
export const MODULE_PREFIX = 'noodl_modules/';

/**
 * Which copy survives — and `null` when this pair is none of the deploy's business.
 *
 * 🔴 **The `noodl_modules/` one, and not for tidiness.** A module is a thing the product installs,
 * restores (`RESTORED_ON_INSTALL`) and whose manifest puts its stylesheet in front of the app in
 * both the preview and a deploy. A loose `fonts/` folder is none of that: it is whatever an import
 * left behind. Dropping the module copy would leave a stylesheet pointing at nothing.
 *
 * 🔴 **`null` when neither is a module file** — two copies of a user's own asset in two folders
 * they chose. See this file's header for the spec that measured why.
 *
 * With both under `noodl_modules/` — two modules shipping one file — the shorter path wins, then
 * the alphabetically earlier. Any total order will do; what matters is that two runs agree.
 */
export function survivorOf(a: string, b: string): { keep: string; drop: string } | null {
  const moduleA = a.startsWith(MODULE_PREFIX);
  const moduleB = b.startsWith(MODULE_PREFIX);
  if (!moduleA && !moduleB) return null;
  if (moduleA !== moduleB) return moduleA ? { keep: a, drop: b } : { keep: b, drop: a };
  if (a.length !== b.length) return a.length < b.length ? { keep: a, drop: b } : { keep: b, drop: a };
  return a < b ? { keep: a, drop: b } : { keep: b, drop: a };
}

/**
 * Decide which proved-identical duplicates may be left out.
 *
 * @param pairs      duplicates the caller has compared byte for byte.
 * @param sourceText concatenated raw text of the project's readable source files.
 *
 * ⚠️ **Raw text, and node parameters would not do.** Image and font paths in this product are
 * frequently *data* — `ui-testimonial-row` keeps three avatar paths inside a `Static Data` node's
 * JSON string — so a scan that walked the graph would find no reference to a file the app loads on
 * every page. Reading the project as characters cannot make that mistake, and it is the same
 * reading `planStarterImageryPrune` takes, for the same reason.
 */
export function planDuplicateAssetPrune(
  pairs: readonly DuplicatePair[],
  sourceText: string
): DuplicateAssetPlan {
  const plan: DuplicateAssetPlan = { drop: [], kept: [] };
  if (pairs.length === 0) return plan;

  // No readable source at all is not "nothing is referenced" — it is "this planner has no
  // evidence", and the two have opposite correct actions.
  if (!sourceText.trim()) {
    for (const pair of pairs) {
      plan.kept.push({
        path: pair.drop,
        keep: pair.keep,
        bytes: pair.bytes,
        reason: 'no readable project source was scanned, so nothing could be shown to be unused'
      });
    }
    return plan;
  }

  for (const pair of pairs) {
    const reason = whyItMustShip(pair.drop, sourceText);
    if (reason) plan.kept.push({ path: pair.drop, keep: pair.keep, bytes: pair.bytes, reason });
    else plan.drop.push({ path: pair.drop, keep: pair.keep, bytes: pair.bytes });
  }
  return plan;
}

/**
 * A sentence when the file must ship, `null` when nothing in the project mentions it.
 *
 * Two readings, and the second is the one that catches what the first cannot:
 *
 *   1. The path appears. Somebody refers to this file; it ships.
 *   2. The path's **directory** appears, followed by something that is not a filename in it — a
 *      path built at run time, a template string, a concatenation. The project refers to that
 *      folder in a way this planner does not understand, so nothing in it is safe to drop.
 */
function whyItMustShip(target: string, sourceText: string): string | null {
  const slash = target.lastIndexOf('/');
  const directory = slash === -1 ? '' : target.substring(0, slash + 1);
  const name = target.substring(slash + 1);

  if (sourceText.includes(target)) return `the project refers to ${target}`;
  if (!directory) return null;

  // 🔴 The marker is the LAST path segment of the directory plus its slash, not the whole path —
  // a reference may be written relative (`../fonts/Inter/Inter-Bold.ttf`, `Inter/Inter-Bold.ttf`)
  // and an absolute-prefix scan would miss every one of them.
  const segment = directory.replace(/\/$/, '');
  const marker = `${segment.substring(segment.lastIndexOf('/') + 1)}/`;

  let index = sourceText.indexOf(marker);
  while (index !== -1) {
    const after = index + marker.length;
    FILENAME_TOKEN.lastIndex = after;
    const match = FILENAME_TOKEN.exec(sourceText);
    const token = match && match.index === after ? match[0] : '';
    if (token === name) return `the project refers to ${marker}${name}`;
    if (!token) {
      return `"${marker}" is followed by something that is not a filename (a path built at run time?)`;
    }
    index = sourceText.indexOf(marker, after);
  }
  return null;
}
