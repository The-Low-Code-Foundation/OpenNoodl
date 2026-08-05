#!/usr/bin/env ts-node
/**
 * LIB-001 — npm run library:check
 *
 * Gate for every entry under library/{prefabs,modules}/<slug>/:
 *   1. library.json exists and validates against scripts/library/schema.json
 *   2. project/ loads as a Noodl project (v2 or legacy) via the same loader
 *      the SUB-006 CLI uses
 *   3. the SUB-006 semantic validator reports zero *errors* (see note below)
 *   4. FH-006 — fonts: no dangling font-file reference, and no retired family
 *
 * Content here was seeded as-is from the live docs-site library (LIB-001
 * step 3) — repair and restyling is LIB-002/003's job, not this gate's. So
 * this only fails CI on errors (broken references — an unknown node type, a
 * nonexistent port), not on warnings (style/quality issues LIB-002/003 own).
 * A future entry authored directly in this repo is expected to be
 * warning-clean too; nothing here stops tightening that later.
 *
 * Usage:
 *   npm run library:check
 *   ts-node -P ./scripts/tsconfig.json ./scripts/library/check.ts [--json]
 *
 * Exit codes: 0 = clean, 1 = a schema or validator error was found, 2 = usage/IO error.
 */
import * as fs from 'fs';
import * as path from 'path';

import Ajv from 'ajv';

import { SemanticValidator, formatReport } from '../../packages/noodl-editor/src/editor/src/validation';
import { loadProject } from '../../packages/noodl-editor/src/editor/src/validation/loadV2Project';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

const TYPES = ['prefabs', 'modules'] as const;
const json = process.argv.includes('--json');

// ---------------------------------------------------------------------------
// FH-006 — the font check.
//
// Two failure modes, both of which shipped for real before this existed:
//
//   (a) A dangling reference. A style/parameter says
//       `"fontFamily": "fonts/Roboto/Roboto-Medium.ttf"` but the entry's
//       project/ does not contain that file. Importing the entry then renders
//       the prefab in the browser's fallback serif and nothing anywhere says
//       why — the editor has no missing-asset diagnostic for fonts.
//
//   (b) A retired family. The design system ships **Inter** (POL-006: a new
//       project gets Inter + Lucide and nothing else). Every entry seeded from
//       the live docs library in LIB-001 came with Roboto instead. Importing
//       one copies its TTFs into the user's project, and the font picker —
//       which lists every ttf/otf/woff/woff2 file it finds under the project
//       directory, grouped by folder (`fontItems.ts` loadFontItems) — then
//       shows a `fonts/Roboto` group the user never asked for. That is
//       FH-006's reported symptom, verbatim.
//
// Both rules are enforced over the *whole* entry, not just its text styles:
// a `fontFamily` can sit on any node parameter, and a code module can name a
// family in a CSS string it injects (simple-tooltips did).
// ---------------------------------------------------------------------------

const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];

/**
 * Families the design system has retired. A shipped font file whose path
 * matches, or any reference naming one, fails the check.
 *
 * Matched as a whole word against the reference string and against the
 * shipped file's project-relative path, so `fonts/Roboto/Roboto-Medium.ttf`,
 * `Roboto`, and `font-family: Roboto, sans-serif` all trip it while a
 * hypothetical `RobotoFlexReplacement` would not.
 */
const RETIRED_FONT_FAMILIES = ['Roboto'];

/**
 * Files whose raw text is scanned for font-family declarations.
 *
 * `.json` is in here as well as being parsed structurally, and that is not
 * redundant. A Javascript node's `code` parameter is a *string value inside
 * project.json*, and four prefabs inject
 * `.datepicker { … font-family: Roboto, sans-serif; … }` from one. A scan
 * that only walks JSON for `fontFamily` keys reports those entries clean
 * while Roboto is still right there in the file — which is exactly what this
 * check did on its first pass.
 *
 * `.map` is here because a sourcemap carries the pre-minified original, so a
 * bundle fixed without its map leaves a stale copy of the retired family
 * behind for the next grep to trip over.
 */
const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.map'];

/**
 * How a code module names a font family. Both forms are live in this tree:
 * `simple-tooltips` assigns `style.fontFamily = 'Roboto, Oxygen, …'` inside a
 * minified bundle, which a CSS-only scan walks straight past.
 *
 *   1. CSS:  `font-family: Roboto, sans-serif`
 *   2. JS:   `fontFamily = 'Roboto, …'` / `fontFamily: "Roboto"`
 *
 * Each alternative quote style gets its own capture group rather than one
 * group plus a backreference: a family list legitimately contains the *other*
 * quote (`'Roboto, …, "Open Sans", sans-serif'`), which a shared
 * "any character but a quote" class would truncate — silently turning a hit
 * into a miss. The scan takes whichever group matched.
 */
const FONT_FAMILY_IN_CODE: RegExp[] = [
  /font-family\s*:\s*([^;'"`\n}\\]+)/g,
  /\bfontFamily\s*[:=]\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g
];

function isRetiredFamily(reference: string): string | undefined {
  return RETIRED_FONT_FAMILIES.find((family) => new RegExp(`\\b${family}\\b`, 'i').test(reference));
}

/** Every file under `dir`, as paths relative to `dir`, POSIX-separated. */
function walkFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...walkFiles(full, base));
    else if (d.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/** Recursively collect every `fontFamily` string value in a parsed JSON tree. */
function collectFontFamilyValues(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectFontFamilyValues(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'fontFamily' && typeof value === 'string' && value.trim()) out.push(value.trim());
      else collectFontFamilyValues(value, out);
    }
  }
}

/**
 * A reference is a *file* reference when it names a font file — either by
 * extension or by being a path. Anything else is a CSS/system family name
 * (`Arial`, `Helvetica`), which the picker offers from its own COMMON_FONTS
 * list and which no project ships. Those are checked for retirement only.
 *
 * Deliberately not importing COMMON_FONTS from `fontItems.ts`: that module
 * pulls in ProjectModel and the editor's FileSystem through webpack aliases
 * ts-node does not resolve, and a copy of the list here would be a twin that
 * silently drifts. Not knowing the exact system-font list costs nothing —
 * this check has no opinion on system families beyond retirement.
 */
function isFontFileReference(reference: string): boolean {
  const lower = reference.toLowerCase();
  return FONT_EXTENSIONS.some((ext) => lower.endsWith(ext)) || reference.includes('/');
}

function checkFonts(projectDir: string): string[] {
  const problems: string[] = [];
  if (!fs.existsSync(projectDir)) return problems;

  const allFiles = walkFiles(projectDir);
  const shippedFonts = allFiles.filter((f) => FONT_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)));
  const shippedSet = new Set(shippedFonts);

  // (b) shipped files.
  for (const fontFile of shippedFonts) {
    const retired = isRetiredFamily(fontFile);
    if (retired) problems.push(`fonts: ships retired family "${retired}" — ${fontFile}`);
  }

  // References from JSON: text styles, node parameters, anywhere.
  const referenced = new Map<string, Set<string>>(); // reference -> files naming it
  for (const rel of allFiles.filter((f) => f.toLowerCase().endsWith('.json'))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(projectDir, rel), 'utf8'));
    } catch {
      continue; // a malformed JSON is the project loader's failure to report, not this one's
    }
    const values: string[] = [];
    collectFontFamilyValues(parsed, values);
    for (const v of values) {
      if (!referenced.has(v)) referenced.set(v, new Set());
      referenced.get(v)!.add(rel);
    }
  }

  // References from injected CSS in code modules.
  for (const rel of allFiles.filter((f) => CODE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)))) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(projectDir, rel), 'utf8');
    } catch {
      continue;
    }
    for (const pattern of FONT_FAMILY_IN_CODE) {
      for (const m of text.matchAll(pattern)) {
        // Whichever alternative matched — the patterns above each use a
        // separate group, so exactly one is defined.
        const captured = m.slice(1).find((g) => g !== undefined);
        const value = (captured || '').trim();
        if (!value) continue;
        if (!referenced.has(value)) referenced.set(value, new Set());
        referenced.get(value)!.add(rel);
      }
    }
  }

  for (const [reference, files] of [...referenced].sort(([a], [b]) => a.localeCompare(b))) {
    const where = [...files].sort().join(', ');
    const retired = isRetiredFamily(reference);
    if (retired) {
      problems.push(`fonts: references retired family "${retired}" as ${JSON.stringify(reference)} (in ${where})`);
      continue; // the retirement is the finding; a dangling retired path adds nothing
    }
    if (isFontFileReference(reference) && !shippedSet.has(reference)) {
      problems.push(`fonts: references ${JSON.stringify(reference)} (in ${where}) but the entry ships no such file`);
    }
  }

  return problems;
}

interface EntryResult {
  type: string;
  slug: string;
  ok: boolean;
  problems: string[];
  warnings: number;
}

function listEntries(type: string): string[] {
  const dir = path.join(LIBRARY_DIR, type);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function checkEntry(type: string, slug: string, ajv: InstanceType<typeof Ajv>, validator: SemanticValidator): EntryResult {
  const problems: string[] = [];
  const entryDir = path.join(LIBRARY_DIR, type, slug);
  const metaPath = path.join(entryDir, 'library.json');

  if (!fs.existsSync(metaPath)) {
    return { type, slug, ok: false, problems: ['missing library.json'], warnings: 0 };
  }

  let meta: any;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (err) {
    return { type, slug, ok: false, problems: [`unreadable library.json: ${(err as Error).message}`], warnings: 0 };
  }

  const validateSchema = ajv.compile(SCHEMA);
  if (!validateSchema(meta)) {
    for (const e of validateSchema.errors || []) {
      // Ajv's shipped .d.ts lags its runtime shape in this repo's toolchain
      // (see the identical TS2339 worked around in schemas/validator.ts).
      const err = e as unknown as { instancePath?: string; message?: string };
      problems.push(`schema: ${err.instancePath || '(root)'} ${err.message}`);
    }
  }

  if (meta.icon && !fs.existsSync(path.join(entryDir, meta.icon))) {
    problems.push(`schema: icon "${meta.icon}" does not exist in ${type}/${slug}/`);
  }

  const projectDir = path.join(entryDir, 'project');
  let warnings = 0;
  if (!fs.existsSync(projectDir)) {
    problems.push('project/ directory is missing');
  } else {
    problems.push(...checkFonts(projectDir));
    try {
      const project = loadProject(projectDir);
      const report = validator.validate(project, {});
      warnings = report.summary.warnings;
      if (report.summary.errors > 0) {
        problems.push(`validator: ${report.summary.errors} error(s)\n${formatReport(report)}`);
      }
    } catch (err) {
      problems.push(`project failed to load: ${(err as Error).message}`);
    }
  }

  return { type, slug, ok: problems.length === 0, problems, warnings };
}

function main(): void {
  const ajv = new Ajv({ allErrors: true });
  const validator = new SemanticValidator();

  const results: EntryResult[] = [];
  for (const type of TYPES) {
    for (const slug of listEntries(type)) {
      results.push(checkEntry(type, slug, ajv, validator));
    }
  }

  if (results.length === 0) {
    console.error(`No library entries found under ${path.relative(REPO_ROOT, LIBRARY_DIR)}/{prefabs,modules}/`);
    process.exit(2);
  }

  const failed = results.filter((r) => !r.ok);
  const totalWarnings = results.reduce((n, r) => n + r.warnings, 0);

  if (json) {
    console.log(JSON.stringify({ results }, null, 2));
  } else {
    for (const r of results) {
      const status = r.ok ? 'OK  ' : 'FAIL';
      console.log(`${status} ${r.type}/${r.slug}${r.warnings ? ` (${r.warnings} warning(s))` : ''}`);
      for (const p of r.problems) console.log(`       ${p}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} entries clean ` +
        `(${totalWarnings} total warning(s) across all entries — LIB-002/003 territory, not gated here).`
    );
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
