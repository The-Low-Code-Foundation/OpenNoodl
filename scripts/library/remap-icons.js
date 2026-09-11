#!/usr/bin/env node
/**
 * Move the library off Material Icons and onto the icon set every project has.
 *
 * ## The defect
 *
 * Sixteen prefabs set `iconIconSource: { class: "material-icons", code: … }`.
 * Fourteen of them ship no icon set at all, and a project made by this editor
 * ships **Lucide** (POL-006 — `starterAssets.ts` seeds Inter + Lucide, and
 * `make-starter-iconset.js` is what generates it). So the class those prefabs
 * name is not present in the project they get installed into. An icon font that
 * is not there does not render as nothing: the ligature falls back to its own
 * literal name, so the Rating prefab draws the words
 * `starstar_borderstar_borderstar_borderstar_border` in gold, and App Shell's
 * sidebar reads `space_dashboard`, `home`, `folder`, `settings`.
 *
 * That is what `scripts/library/render-check.js` measured — the seeded starter
 * modules in that harness are the control: a Lucide glyph resolves there, so a
 * glyph still rendering as its own name is the entry naming a set the user does
 * not have, not the harness missing a font.
 *
 * The library was seeded (LIB-001, 2026-07-25) from the live Noodl content,
 * where Material Icons *was* the default set. POL-006 changed the default and
 * nothing re-measured the shelf, so the whole set has been drawing ligature
 * names since.
 *
 * ## The fix
 *
 * Rewrite the class and translate the code. The alternative — bundling a
 * 1865-glyph Material font into fourteen prefabs, as `image-cropper` and
 * `panning-and-zooming-control` already do — puts a second icon family in the
 * user's font picker for every prefab they install, which is the exact
 * complaint FH-006 was written about.
 *
 * Usage:
 *   node scripts/library/remap-icons.js --check    # report, write nothing
 *   node scripts/library/remap-icons.js            # rewrite + bump versions
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const LUCIDE_MANIFEST = path.join(
  REPO_ROOT,
  'packages/noodl-editor/src/assets/starter-project/noodl_modules/lucide-icons/manifest.json'
);
const LUCIDE_CSS = path.join(
  REPO_ROOT,
  'packages/noodl-editor/src/assets/starter-project/noodl_modules/lucide-icons/styles.css'
);

/**
 * Material code → Lucide class, for every code the library actually uses.
 *
 * Chosen from the **curated** list in the starter manifest wherever one fits,
 * so the glyph a prefab uses is also one the user can find in the icon picker
 * and reuse. Where the curated list has no equivalent the full stylesheet still
 * does — every one of Lucide's 1998 rules ships — and `verify()` below proves
 * each target resolves rather than trusting this table.
 *
 * ⚠️ `star_border` and `star` both land on `icon-star`. Lucide has no filled
 * star; the pair is a *fill* distinction in Material and becomes a **colour**
 * distinction here, which is why the Rating prefab needs the second edit in
 * `COLOUR_FIXUPS` and not just a class rename. A silent 1:1 rename would have
 * given it five identical stars and no way to see a rating.
 */
const MAP = {
  access_time: 'icon-clock',
  account_circle: 'icon-user-circle-2',
  arrow_drop_down: 'icon-chevron-down',
  arrow_drop_up: 'icon-chevron-up',
  arrow_forward: 'icon-arrow-right',
  calendar_today: 'icon-calendar',
  check: 'icon-check',
  check_circle: 'icon-check-circle-2',
  chevron_left: 'icon-chevron-left',
  chevron_right: 'icon-chevron-right',
  circle: 'icon-circle',
  close: 'icon-x',
  error: 'icon-alert-circle',
  error_outline: 'icon-alert-circle',
  expand_more: 'icon-chevron-down',
  home: 'icon-home',
  keyboard_arrow_down: 'icon-chevron-down',
  keyboard_arrow_up: 'icon-chevron-up',
  menu: 'icon-menu',
  more_horiz: 'icon-more-horizontal',
  search: 'icon-search',
  space_dashboard: 'icon-layout-grid',
  star: 'icon-star',
  star_border: 'icon-star',
  warning: 'icon-alert-triangle',
  zoom_in: 'icon-zoom-in',
  zoom_out: 'icon-zoom-out'
};

/**
 * The second shape, and the one that renders a *list* wrong rather than one glyph.
 *
 * Four prefabs do not store an icon source at all — they **build** one in a
 * Function node from a row of data:
 *
 * ```js
 * Outputs.IconSource = { "class": "material-icons", "code": Inputs.IconCode }
 * ```
 *
 * A JSON rewrite cannot see this: the object lives inside a `functionScript`
 * string, which is a JSON *value*. It is the same hiding place FH-006 found a
 * font family in, and the reason that check is enforced over the whole entry
 * rather than over `fontFamily` keys.
 *
 * Two things have to change together. The class, so the glyph resolves; and
 * `codeAsClass: true`, because Lucide puts one class per glyph on the element
 * while Material puts a ligature in its text — omit it and the name renders as
 * words, which is the defect this file exists to remove.
 *
 * App Shell additionally ships the row data (`home`, `folder`, `settings`), so
 * those literals move to `icon-*` too. List With Icons and Navigation Menu take
 * theirs from the user, so their READMEs are what has to say Lucide.
 *
 * ⚠️ The quotes here are **escaped** — the script is a JSON string value, so the
 * bytes on disk are `\"class\": \"material-icons\"`, and Stripe's copy mixes
 * `'class'` with `\"material-icons\"`. Matching a bare `"` and replacing with a
 * bare `"` would write invalid JSON that no loader could read, so both quote
 * tokens are captured and put back exactly as found. The plain-JSON form is not
 * matched at all — the object rewrite above owns that one.
 */
const SCRIPT_CLASS = /(\\"|')class\1\s*:\s*(\\"|')material-icons\2/g;

/**
 * Row data that names glyphs, per entry. App Shell ships its own nav items;
 * everything else takes them from the user, and its README is what has to
 * change instead.
 */
const SCRIPT_LITERALS = {
  'prefabs/app-shell': { home: 'icon-home', folder: 'icon-folder', settings: 'icon-settings' },
  'prefabs/stripe': { check: 'icon-check', close: 'icon-x' }
};

const check = process.argv.includes('--check');

/** Every target must have a rule in the stylesheet that actually ships. */
function verify() {
  const css = fs.readFileSync(LUCIDE_CSS, 'utf8');
  const curated = new Set(JSON.parse(fs.readFileSync(LUCIDE_MANIFEST, 'utf8')).icons);
  const problems = [];
  for (const [code, cls] of Object.entries(MAP)) {
    if (!css.includes(`.${cls}:`)) problems.push(`${code} → ${cls}: no rule in the shipped stylesheet`);
    else if (!curated.has(cls)) console.log(`  note: ${cls} renders but is not in the picker's curated list (${code})`);
  }
  if (problems.length) {
    console.error('Mapping targets that do not exist:\n  ' + problems.join('\n  '));
    process.exit(2);
  }
}

function walkJson(dir, fn) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJson(p, fn);
    else if (name.endsWith('.json')) fn(p);
  }
}

function bumpMinor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!m) return version;
  return `${m[1]}.${Number(m[2]) + 1}.0`;
}

function main() {
  verify();
  let touchedEntries = 0;
  let touchedIcons = 0;
  const unmapped = new Set();

  for (const type of ['prefabs', 'modules']) {
    const typeDir = path.join(LIBRARY_DIR, type);
    if (!fs.existsSync(typeDir)) continue;
    for (const slug of fs.readdirSync(typeDir).sort()) {
      const entryDir = path.join(typeDir, slug);
      const projectDir = path.join(entryDir, 'project');
      if (!fs.existsSync(projectDir) || !fs.statSync(entryDir).isDirectory()) continue;

      // An entry that ships its own Material set is already self-sufficient —
      // rewriting it would point at Lucide while its own font sits unused.
      const shipsMaterial = fs.existsSync(path.join(projectDir, 'noodl_modules', 'material-icons'));

      let entryCount = 0;
      let scriptCount = 0;
      walkJson(projectDir, (file) => {
        const before = fs.readFileSync(file, 'utf8');
        if (!before.includes('material-icons')) return;
        let count = 0;
        /**
         * The replacement is a whole `iconIconSource` object, not a class
         * rename, because the three fields are one decision. `class` is the
         * *set's* `iconClass` and `codeAsClass` is the set's flag — Material
         * puts the ligature in the element's text (`codeAsClass` absent),
         * Lucide puts one class per glyph on the element (`codeAsClass: true`).
         * Rewriting `class` alone would hand `IconGlyph` a Lucide class with
         * Material's rendering branch, which draws the glyph name as text: the
         * very defect being fixed, in a new disguise.
         *
         * Whitespace-insensitive and key-order-insensitive on the way in, since
         * these files were written by three different tools over two years.
         */
        const after = before.replace(
          /\{\s*"class"\s*:\s*"material-icons"\s*,\s*"code"\s*:\s*"([^"]+)"\s*\}|\{\s*"code"\s*:\s*"([^"]+)"\s*,\s*"class"\s*:\s*"material-icons"\s*\}/g,
          (whole, a, b) => {
            const code = a || b;
            const cls = MAP[code];
            if (!cls) {
              unmapped.add(`${type}/${slug}: ${code}`);
              return whole;
            }
            count++;
            return `{ "class": "lucide", "code": "${cls}", "codeAsClass": true }`;
          }
        );
        /**
         * Scripts, after the object rewrite. The script text is a JSON string,
         * so the escaping in it is `\"class\": \"material-icons\"` — which is
         * why this runs on the raw file text and not on parsed values, and why
         * the sibling `codeAsClass` is inserted next to the class rather than
         * by re-serialising an object that only exists at runtime.
         */
        let withScripts = after;
        for (const [code, cls] of Object.entries(SCRIPT_LITERALS[`${type}/${slug}`] || {})) {
          const before2 = withScripts;
          withScripts = withScripts.split(`\\"${code}\\"`).join(`\\"${cls}\\"`);
          if (withScripts !== before2) scriptCount++;
        }
        withScripts = withScripts.replace(SCRIPT_CLASS, (whole, q1, q2) => {
          scriptCount++;
          return `${q1}class${q1}: ${q2}lucide${q2}, ${q1}codeAsClass${q1}: true`;
        });

        if (count === 0 && withScripts === before) return;
        entryCount += count;
        if (!check) fs.writeFileSync(file, withScripts);
      });

      if (entryCount || scriptCount) {
        touchedEntries++;
        touchedIcons += entryCount;
        const libFile = path.join(entryDir, 'library.json');
        const lib = JSON.parse(fs.readFileSync(libFile, 'utf8'));
        const next = bumpMinor(lib.version);
        console.log(
          `${check ? 'would fix' : 'fixed'}  ${type}/${slug}  ${entryCount} icon(s)  ` +
            `${lib.version} → ${next}${shipsMaterial ? '  (also ships its own Material set)' : ''}`
        );
        if (!check) {
          lib.version = next;
          fs.writeFileSync(libFile, JSON.stringify(lib, null, 2) + '\n');
        }
      }
    }
  }

  console.log(`\n${touchedIcons} icon(s) across ${touchedEntries} entries.`);
  if (unmapped.size) {
    console.error(`\nNo mapping for:\n  ${[...unmapped].join('\n  ')}`);
    process.exit(1);
  }
}

main();
