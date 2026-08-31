/**
 * VIB-011 — **what an authoring model is told about pictures.**
 *
 * ## The defect this answers
 *
 * VIB-003 put six abstract SVGs in every project and taught them, so a page could stop being empty.
 * It worked, and the VIB-004 marketing page is what it looks like when that is all there is: seven
 * compositions, six band grounds, four viewports — and **every picture on the page the same dark
 * generated abstract, with the three testimonial avatars the identical portrait glyph.** The
 * imagery *tell* did not fire; there was imagery. Nothing on the page communicated anything about
 * the product. Richard had already named the fix (register V30): a real stock library, bundled.
 *
 * That library now ships. This module is the half of his instruction that is not about templates —
 * *"even for when the MCP is making custom apps for people it can piocher in the image library"* —
 * and it is the same defect the icon block fixed one asset class along: **a model cannot use what
 * it cannot enumerate.** 44 photographs on disk that `get_style_vocabulary` never mentions are 44
 * photographs an authoring model will not use.
 *
 * ## Why it reads the project rather than hard-coding the list
 *
 * Same reason as {@link module:noodl-mcp/iconSets}: what is installed is a fact about a directory,
 * not about the product. A user who deletes half the library, or drops their own photographs in
 * beside it, should be described accurately — and a door that answered from a constant would be
 * right for a fresh project and confidently wrong for any other.
 *
 * 🔴 **`LICENCES.json` is the source, and it is deliberately the SAME file that carries provenance.**
 * A separate catalogue would be a second copy to keep in step with the licence record, and the copy
 * would be right on the day it was written. The build script emits `subject`, `role`, `says` and the
 * licence fields as one row per image for exactly this reason.
 *
 * ## What is deliberately NOT on the wire
 *
 * ⚠️ `says` (the one-line description) and every provenance field. `get_style_vocabulary` had **238
 * tokens of headroom on `prompt` and 677 on `full`** when this was written (V24's trend note), and
 * 44 descriptions would have spent all of it. The filenames are the description — `work-welder`,
 * `food-bread`, `ground-city-dusk` — which is why they are named that way. The full record stays on
 * disk beside the pictures, where a person auditing a licence will look for it.
 *
 * @module noodl-mcp/imagery
 */

import * as fs from 'fs';
import * as path from 'path';

/** The module directory the starter library installs into. */
const MODULE_DIR = path.join('noodl_modules', 'starter-imagery');

/** One subject group, as the door reports it. */
export interface ImagerySubject {
  /** `hero`, `work`, `people`, `food`, `animals`, `texture`, `avatar`. */
  subject: string;
  /** The shape these were cut for — `ground` (16:9), `surface`, `tile` (4:3) or `avatar` (square). */
  role: string;
  /** File names within the module, without a path. */
  files: string[];
}

/** What a project has to draw with. */
export interface ImageryReport {
  /** Project-relative directory; the prefix of every `src`. */
  moduleDir: string;
  /** Grouped by subject, in the order the library defines them. */
  subjects: ImagerySubject[];
  /** Total photographs found. */
  total: number;
  /** Anything wrong, never silent. */
  warnings: string[];
}

const EMPTY: ImageryReport = { moduleDir: MODULE_DIR, subjects: [], total: 0, warnings: [] };

/**
 * The stock imagery installed in a project.
 *
 * ⚠️ **Empty is a real answer.** A project without the module has no photographs, and saying so is
 * what stops a model writing a plausible `src` that resolves to nothing — the exact failure the icon
 * hint used to produce with `{"class":"material-icons"}`.
 */
export function readImagery(projectDir: string | undefined): ImageryReport {
  if (!projectDir) return EMPTY;

  const dir = path.join(projectDir, MODULE_DIR);
  const record = path.join(dir, 'LICENCES.json');

  let rows: Array<{ file?: string; subject?: string; role?: string }>;
  try {
    rows = JSON.parse(fs.readFileSync(record, 'utf8')).images ?? [];
  } catch {
    // 🔴 A directory of photographs with no record is REPORTED, not quietly enumerated. The library's
    // whole claim is that every file's licence was read; describing files whose provenance is
    // missing would put pictures into a user's deployed app on this module's say-so.
    let strays = 0;
    try {
      strays = fs.readdirSync(dir).filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f)).length;
    } catch {
      return EMPTY;
    }
    return strays
      ? {
          ...EMPTY,
          warnings: [
            `${strays} image file(s) sit in ${MODULE_DIR} with no LICENCES.json beside them. They are not ` +
              'reported here: without the record there is nothing to say about their licence, and this ' +
              'library is redistributed inside every app you deploy.'
          ]
        }
      : EMPTY;
  }

  const warnings: string[] = [];
  const bySubject = new Map<string, ImagerySubject>();
  let total = 0;

  for (const row of rows) {
    if (!row.file || !row.subject) continue;
    // A row whose file is gone is a real thing to say — a model told to use it would emit a dead src.
    if (!fs.existsSync(path.join(dir, row.file))) {
      warnings.push(`${row.file} is listed in LICENCES.json but is not on disk.`);
      continue;
    }
    const existing = bySubject.get(row.subject);
    if (existing) existing.files.push(row.file);
    else bySubject.set(row.subject, { subject: row.subject, role: row.role ?? 'tile', files: [row.file] });
    total++;
  }

  return { moduleDir: MODULE_DIR, subjects: [...bySubject.values()], total, warnings };
}

/**
 * The imagery block of the compact prompt rendering.
 *
 * Written as an instruction rather than an inventory, because phase 81's diagnosis (README §1e) is
 * that every per-turn surface in this server says *don't deviate* and none of them asks for
 * anything. A list of filenames under a neutral heading is another thing not to deviate from.
 */
export function renderImagery(report: ImageryReport): string {
  if (report.total === 0) {
    const lines = [
      'STOCK IMAGERY — none installed in this project. Do not invent an image src: a path that ' +
        'resolves to nothing renders an empty box, which is worse than a designed colour ground.'
    ];
    for (const w of report.warnings) lines.push(`  ⚠️ ${w}`);
    return lines.join('\n');
  }

  const lines: string[] = [
    `STOCK IMAGERY — ${report.total} CC0 photographs ship with this project, offline. Use them: a ` +
      'landing page with no photograph is not finished. Image `src` / Group `backgroundImage` = ' +
      `"${report.moduleDir}/<name>.webp" (e.g. work-welder.webp).`,
    '  Already cropped: ground/texture are 16:9 band grounds, the rest 4:3 tiles, avatars 256px ' +
      'squares framed on the face. Pick by SUBJECT.'
  ];

  for (const s of report.subjects) {
    lines.push(`  ${s.subject} (${s.role}): ${s.files.map((f) => f.replace(/\.\w+$/, '')).join(' ')}`);
  }
  for (const w of report.warnings) lines.push(`  ⚠️ ${w}`);

  return lines.join('\n');
}
