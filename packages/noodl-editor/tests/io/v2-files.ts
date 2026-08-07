/**
 * Reading exported v2 files in the io specs.
 *
 * `ExportFile.content` is `unknown` because one export produces a heterogeneous
 * list — project, registry, routes, styles and three files per component. Every
 * call site knows which file it asked for, so the specs used to narrow with
 * `as any` at each assertion. These helpers hold the single narrowing instead,
 * and narrow to the schemas the exporter publishes and the importer demands: a
 * mismatch between the two engines becomes a compile error in the spec rather
 * than a round-trip that quietly drops a field.
 */

import type { ExportResult, LegacyProject } from '../../src/editor/src/io/ProjectExporter';

/** The file at `path`, or `undefined` when the export did not produce one. */
export function contentAt<T>(result: ExportResult, path: string): T | undefined {
  return result.files.find((f) => f.relativePath === path)?.content as T | undefined;
}

/**
 * The file at `path`, for specs that require it to exist. Failing here names
 * the paths that *were* exported, instead of surfacing two lines later as a
 * property read on `undefined`.
 */
export function fileAt<T>(result: ExportResult, path: string): T {
  const content = contentAt<T>(result, path);
  if (content === undefined) {
    throw new Error(`No exported file at "${path}". Exported: ${result.files.map((f) => f.relativePath).join(', ')}`);
  }
  return content;
}

/** Same, for the specs that assert on a path shape rather than an exact path. */
export function firstFileMatching<T>(result: ExportResult, matches: (path: string) => boolean, describe: string): T {
  const file = result.files.find((f) => matches(f.relativePath));
  if (!file) {
    throw new Error(`No exported file ${describe}. Exported: ${result.files.map((f) => f.relativePath).join(', ')}`);
  }
  return file.content as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Walk the legacy `metadata` bag, which is `Record<string, unknown>` by design —
 * it holds whatever the editor of the day put there. Returns `undefined` at the
 * first key that is missing or not an object, so a shape change surfaces as a
 * failed comparison rather than a TypeError.
 */
export function metadataAt(project: LegacyProject, path: string[]): unknown {
  let current: unknown = project.metadata;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}
