/**
 * VIB-012 — decide which bundled stock photographs a deploy actually needs.
 *
 * VIB-011 put a 44-image CC0 library (~3.32 MB) into every project through `STARTER_ASSETS`.
 * `noodl_modules/` is in no default ignore rule, so **all 44 ship in every deployed app**, whether
 * the site references two of them or none — measured with `buildIgnoreMatcher` against three
 * known-excluded controls (`docs/`, `node_modules/`, `components/`) so the reading was of a filter
 * observed working rather than of an absent rule. Richard's call was to prune.
 *
 * ⚠️ **This is deploy payload, not page weight.** A browser fetches only what a page references, so
 * nobody was downloading 44 photographs. The cost is the artefact and the hosting.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **WHY THIS READS RAW TEXT AND NOT NODE PARAMETERS**
 *
 * **Image paths in this product are frequently DATA.** `ui-testimonial-row` — a shipped recipe, and
 * the one VIB-011 repointed at real faces — keeps its three `avatar-*.webp` paths inside a
 * `Static Data` node's JSON string, which a `For Each` feeds to `Image.src` over a connection. A
 * pruner that walked node parameters would find **no reference to any of the three** and delete
 * them. The deploy would succeed, the report would look clean, and a stranger's website would have
 * three broken images.
 *
 * A substring scan over raw project text cannot make that mistake: a path inside a JSON string is
 * still those characters in that file.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @module compilation/build/starterImagery
 */

/** The one prunable directory, project-root relative, `/` separated. */
export const STARTER_IMAGERY_DIR = 'noodl_modules/starter-imagery';

/**
 * Files in that directory that ship whatever happens.
 *
 * 🔴 `LICENCES.json` is not housekeeping. VIB-011's entire licence argument is that the provenance
 * record **travels with the pictures** into every app a user deploys; photographs arriving without
 * it is the situation the CC0 class was chosen to avoid. `manifest.json` is what identifies the
 * directory as a module at all.
 */
export const ALWAYS_KEPT: readonly string[] = ['manifest.json', 'LICENCES.json'];

/** Characters a filename may be made of, for the token that follows a reference. */
const FILENAME_TOKEN = /[A-Za-z0-9._-]+/y;

export interface StarterImageryPlan {
  /** Basenames safe to leave out of the deploy. Empty when the plan refuses. */
  drop: string[];
  /** Basenames the project was found to reference. */
  referenced: string[];
  /**
   * Set when the planner declined to prune anything, naming what it could not resolve.
   *
   * 🔴 Refusing is a first-class outcome, not an error path. A pruner that half-understands a
   * project and prunes anyway is strictly worse than one that ships 3.32 MB.
   */
  refusedReason?: string;
}

/**
 * Work out what may be left behind.
 *
 * @param present   Basenames currently in {@link STARTER_IMAGERY_DIR}.
 * @param sourceText Concatenated raw text of the project's readable source files.
 *   🔴 **Must NOT include anything from the imagery directory itself** — and the reason is not the
 *   obvious one. Measured, because the first version of this comment asserted the wrong mechanism:
 *
 *   - `LICENCES.json` lists every file as a bare basename (`"file": "avatar-1.webp"`) and contains
 *     the string `starter-imagery/` **nowhere**, so scanning it changes nothing at all.
 *   - `manifest.json` carries the module's own documentation — *"Reference any file as
 *     `noodl_modules/starter-imagery/<name>`"* — and `<name>` is not a filename. That single
 *     placeholder trips {@link StarterImageryPlan.refusedReason} and **disables the pruner
 *     permanently**, for every project, with a reason that reads entirely plausible.
 *
 *   So a module's own prose can switch off a tool that reads the project as text. The directory is
 *   skipped because **documentation is not a reference**.
 */
export function planStarterImageryPrune(present: readonly string[], sourceText: string): StarterImageryPlan {
  const prunable = present.filter((name) => !ALWAYS_KEPT.includes(name));
  if (prunable.length === 0) return { drop: [], referenced: [...present] };

  // No readable source at all is not "nothing is referenced" — it is "this planner has no evidence",
  // and the two have opposite correct actions. Same shape as an absence with no known-firing signal.
  if (!sourceText.trim()) {
    return { drop: [], referenced: [], refusedReason: 'no readable project source was scanned' };
  }

  const marker = `${STARTER_IMAGERY_DIR.substring(STARTER_IMAGERY_DIR.lastIndexOf('/') + 1)}/`;
  const known = new Set(present);
  const referenced = new Set<string>(ALWAYS_KEPT.filter((name) => present.includes(name)));

  let index = sourceText.indexOf(marker);
  while (index !== -1) {
    const after = index + marker.length;
    FILENAME_TOKEN.lastIndex = after;
    const match = FILENAME_TOKEN.exec(sourceText);
    const token = match && match.index === after ? match[0] : '';

    if (!token || !known.has(token)) {
      // 🔴 An occurrence this planner cannot resolve to a real file means the project refers to the
      // library in a way it does not understand — a concatenated path, a renamed file, a template
      // string. Prune NOTHING. Partial understanding is where the silent breakage lives.
      return {
        drop: [],
        referenced: [...present],
        refusedReason: token
          ? `"${marker}${token}" does not name a file in the library`
          : `"${marker}" is followed by something that is not a filename (a path built at runtime?)`
      };
    }

    referenced.add(token);
    index = sourceText.indexOf(marker, after);
  }

  return {
    drop: prunable.filter((name) => !referenced.has(name)).sort(),
    referenced: [...referenced].sort()
  };
}
