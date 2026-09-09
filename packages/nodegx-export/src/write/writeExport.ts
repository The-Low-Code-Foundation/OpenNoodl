/**
 * The half of the code export that touches the disk — every file written, every asset copied,
 * and the one refusal that has to happen before any of it.
 *
 * `emitApp` is pure: it returns generated strings (`files`) and a list of project assets to copy
 * byte-for-byte (`copies`), and writes nothing. This module is the caller that writes. It takes
 * `fs` as an argument rather than importing it, which is what lets the same code run under the
 * editor's renderer, under a plain-Node CLI, and against a real temp directory in a spec.
 *
 * ## Why it lives in the package (HLS-002)
 *
 * It was written for EXP-012 inside `noodl-editor`, as the disk half of the editor's menu item.
 * HLS-002 gives the export a second front door — `nodegx export` — and the whole point of that
 * task is that the two doors produce the *same* export. Two copies of the write loop is the
 * cheapest way to make that untrue, and the copy that would drift is the one nobody clicks:
 * `scripts/emit-app.ts` had its own write loop and dropped `copies` on the floor for a whole
 * phase (P18 §19.6) while every gate stayed green. So there is one write loop now, here, and
 * both doors call it.
 *
 * 🔴 **`copies` is a second channel.** `files` are strings and `copies` are bytes — a kit's
 * script, an icon set's `.woff2`, Inter's four `.ttf`. They are separate precisely *because* a
 * font is not a string: reading one into UTF-8 to put it in `files` corrupts it silently, and the
 * failure renders as blank glyphs rather than as an error. Both counts are reported so a caller
 * can say what it did.
 *
 * 🔴 **The target may not be inside the project.** The editor's loader reads every file under the
 * project directory with no skip list (P82: `readBundleDirectory`), and the MCP server's scanner
 * walks it too — an export dropped into the project would be read back as project content on the
 * next open. `checkTarget` refuses that before anything is written.
 */

import type * as fsType from 'fs';
import * as path from 'path';

/** The shape `emitApp` returns; structural, so this module does not import the package. */
export interface ExportOutput {
  /** Output-relative path → generated content. */
  files: Record<string, string>;
  /** Project-relative source → output-relative destination, copied byte-for-byte. */
  copies: ReadonlyArray<{ from: string; to: string }>;
}

export type FsLike = Pick<
  typeof fsType,
  'existsSync' | 'readdirSync' | 'mkdirSync' | 'writeFileSync' | 'copyFileSync' | 'statSync'
>;

export type TargetVerdict =
  | { ok: true; /** Entries already in the folder; > 0 means the caller should confirm. */ existing: number }
  | { ok: false; reason: string };

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Whether `outDir` is a folder the export may write into. Refuses the project directory and
 * anything under it; otherwise reports how many entries the folder already holds so the caller
 * can ask before overwriting.
 */
export function checkTarget(projectDir: string, outDir: string, fs: FsLike): TargetVerdict {
  const project = path.resolve(projectDir);
  const target = path.resolve(outDir);

  if (isInside(project, target)) {
    return {
      ok: false,
      reason:
        'That folder is inside the project. The editor reads every file under a project when it opens it, so the exported app would be loaded back as project content. Choose a folder outside the project.'
    };
  }

  if (!fs.existsSync(target)) return { ok: true, existing: 0 };
  if (!fs.statSync(target).isDirectory()) {
    return { ok: false, reason: 'That path is a file, not a folder.' };
  }
  return { ok: true, existing: fs.readdirSync(target).length };
}

export interface WriteResult {
  files: number;
  copies: number;
}

/**
 * Writes an emitted app into `outDir`: every generated file, then every asset copy. Existing
 * files with the same names are overwritten; nothing else in the folder is touched.
 *
 * Throws on the first failed write — the caller reports it as a part-way failure rather than a
 * success with a smaller number, because a folder that is half an app builds nothing.
 */
export function writeExport(projectDir: string, outDir: string, output: ExportOutput, fs: FsLike): WriteResult {
  let files = 0;
  for (const [relativePath, content] of Object.entries(output.files)) {
    const target = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    files++;
  }

  let copies = 0;
  for (const copy of output.copies) {
    const source = path.join(projectDir, copy.from);
    const target = path.join(outDir, copy.to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    copies++;
  }

  return { files, copies };
}
