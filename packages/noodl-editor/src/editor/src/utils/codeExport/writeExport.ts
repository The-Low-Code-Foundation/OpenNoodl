/**
 * EXP-012 — the half of the editor's code export that touches the disk.
 *
 * `@nodegx/export`'s `emitApp` is pure: it returns generated strings (`files`) and a list of
 * project assets to copy byte-for-byte (`copies`), and writes nothing. This module is the
 * caller that writes — kept import-free (Node's `fs`/`path` only, injected) so the plain-Node
 * runner in `tests-unit/` grades it against a real temp directory rather than a mock, and so
 * the renderer flow in `exportReactCode.ts` stays a thin sequence of user-facing steps.
 *
 * 🔴 **`copies` is a second channel and the shipped script runner once dropped it on the
 * floor** (P18 §19.6): an author's fonts silently absent from their repo, every gate green.
 * `writeExport` writes both and reports both counts, and the spec asserts the copy arrived
 * byte-identical.
 *
 * 🔴 **The target may not be inside the project.** The editor's loader reads every file under
 * the project directory with no skip list (P82: `readBundleDirectory`), and the MCP server's
 * scanner walks it too — an export dropped into the project would be read back as project
 * content on the next open. `checkTarget` refuses that before anything is written.
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
