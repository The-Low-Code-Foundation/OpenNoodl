/**
 * UNI-010 — writing the derived starter to disk.
 *
 * The subtraction itself is pure and lives in the editor
 * (`models/lessonstarter.ts`), for the reason everything else in this arc does:
 * one engine, two callers, and no second opinion about what a lesson's starter
 * is. This module is the filesystem half.
 *
 * 🔴 IT COPIES THE SOLUTION AND OVERWRITES WHAT CHANGED — IT DOES NOT REBUILD
 * ---------------------------------------------------------------------------
 * The derivation models exactly three things: a component's `nodes.json`, its
 * `connections.json`, and the project's `metadata`. A project directory holds a
 * great deal more — styles, routes, settings, assets, `_registry.json`, whatever
 * a future version adds — and **none of it is subtracted**, because none of it is
 * what a lesson step asks a learner to build.
 *
 * So the starter is the solution copied, with the three modelled files rewritten.
 * Rebuilding a project directory from `LessonProjectSource` instead would silently
 * drop everything that shape does not carry, and the failure would be invisible:
 * the starter opens, the lesson runs, and the learner's theme is gone. ⚠️ This is
 * the same reasoning `render-from-disk.js` got wrong for two phases by
 * paraphrasing a contract it could have called.
 *
 * ⚠️ TWO EXCEPTIONS TO "COPIED VERBATIM", BOTH BECAUSE THE COPY WOULD LIE
 * ----------------------------------------------------------------------
 * - A component the derivation dropped (every node subtracted, nothing left
 *   referring to it — P79 L1) has its directory removed after the copy, or the
 *   learner opens a starter carrying an empty component they are told to create.
 * - `components/_registry.json` is not one of the three modelled files, but it
 *   makes claims about them (`nodeCount`, `connectionCount`, the totals) and a
 *   verbatim copy carries the SOLUTION's counts into the starter (P79 D4 — every
 *   shipped starter said so until this was written). It is read, its dropped
 *   entries removed, its counts re-derived from the files actually written, and
 *   every other key left exactly as the solution had it.
 *
 * @module noodl-mcp/lessons/starterWriter
 */

import fs from 'node:fs';
import path from 'node:path';

import { deriveLessonStarter, MANIFEST_FILE, readLessonProject, SOLUTION_DIR } from '../editor-deps';
import type { LessonManifest, LessonProjectSource, StarterRetraction } from '../editor-deps';
import { ToolError } from '../errors';
import { nodeBundleFs } from './bundleWriter';

export interface WriteStarterOptions {
  solutionDir: string;
  starterDir: string;
}

export interface WrittenStarter {
  written: boolean;
  starterDir: string;
  retractions: StarterRetraction[];
  stillSatisfied: Array<{ step: number; where: string }>;
  /** Files the copy removed because a starter is a project, not a bundle. */
  droppedFromCopy: string[];
  /** Registry paths of components the starter does not carry — see `DeriveStarterResult.removedComponents`. */
  removedComponents: string[];
  refusal?: string;
}

/**
 * Refuse to write into a directory holding anything else.
 *
 * The same guard `writeLessonBundle` applies, and for a sharper reason: this one
 * copies a whole project tree in, so pointed at a home directory or a repo it
 * would scatter a project through it. An empty or missing directory is the only
 * safe case — and unlike a bundle there is no "already a starter" marker to
 * recognise an iteration by, so a re-run must be pointed somewhere new or the
 * previous attempt deleted deliberately.
 */
function assertWritableStarterDir(starterDir: string, solutionDir: string): void {
  if (!starterDir) throw new ToolError('invalid-argument', 'starter_dir is required.');

  const resolvedStarter = path.resolve(starterDir);
  const resolvedSolution = path.resolve(solutionDir);
  if (resolvedStarter === resolvedSolution) {
    throw new ToolError(
      'invalid-argument',
      'starter_dir and solution_dir are the same directory. The starter is derived FROM the solution, so ' +
        'writing it over the top would destroy the answer the lesson is graded against.'
    );
  }
  // 🔴 Nesting either way is the same hazard by a longer route: a starter written
  // inside the solution ends up copied into the next bundle, and a solution
  // inside the starter is copied into the starter.
  if (resolvedStarter.startsWith(resolvedSolution + path.sep)) {
    throw new ToolError('invalid-argument', 'starter_dir is inside solution_dir. Point it somewhere separate.');
  }
  if (resolvedSolution.startsWith(resolvedStarter + path.sep)) {
    throw new ToolError('invalid-argument', 'solution_dir is inside starter_dir. Point them at separate directories.');
  }

  if (!fs.existsSync(starterDir)) return;
  if (!fs.statSync(starterDir).isDirectory()) {
    throw new ToolError('invalid-argument', `"${starterDir}" is a file, not a directory.`);
  }
  if (fs.readdirSync(starterDir).length > 0) {
    throw new ToolError(
      'invalid-argument',
      `"${starterDir}" is not empty. Deriving a starter copies a whole project into it, so it would be mixed ` +
        'with whatever is already there. Point at a new or empty directory.'
    );
  }
}

/**
 * Derive the starter and write it, or refuse and write nothing.
 *
 * Score-then-write, exactly as `writeLessonBundle` does: a half-written starter
 * beside a refusal is the worst available outcome, because the caller is a model
 * that will hand the path to `create_lesson` regardless.
 */
export function writeDerivedStarter(manifest: LessonManifest, options: WriteStarterOptions): WrittenStarter {
  assertWritableStarterDir(options.starterDir, options.solutionDir);

  const solution = readLessonProject(options.solutionDir, nodeBundleFs);
  if (!solution) {
    throw new ToolError(
      'invalid-argument',
      `"${options.solutionDir}" is not a NodeGX project — there is no components/_registry.json in it. The ` +
        "solution is the lesson's own answer, and the starter is derived from it by subtraction."
    );
  }

  const derived = deriveLessonStarter(solution, manifest);
  if (!derived.ok || !derived.starter) {
    return {
      written: false,
      starterDir: options.starterDir,
      retractions: derived.retractions,
      stillSatisfied: derived.stillSatisfied,
      droppedFromCopy: [],
      removedComponents: [],
      ...(derived.refusal ? { refusal: derived.refusal } : {})
    };
  }

  fs.mkdirSync(options.starterDir, { recursive: true });
  fs.cpSync(options.solutionDir, options.starterDir, { recursive: true, dereference: false });

  // ⚠️ A starter is a project, not a bundle. If the solution directory happened
  // to be one — a model pointing at a bundle root it built earlier — the copy
  // would carry a manifest and a nested solution into the starter, and
  // `create_lesson` would then merge a bundle into a bundle. Reported rather
  // than silently deleted: a caller that did not expect this needs to know.
  const droppedFromCopy: string[] = [];
  for (const stale of [MANIFEST_FILE, SOLUTION_DIR]) {
    const target = path.join(options.starterDir, stale);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      droppedFromCopy.push(stale);
    }
  }

  for (const files of derived.starter.components) {
    const compDir = path.join(options.starterDir, 'components', files.registryPath);
    writeJson(path.join(compDir, 'nodes.json'), files.nodes);
    writeJson(path.join(compDir, 'connections.json'), files.connections);
  }

  // P79 L1 — the copy brought the dropped component's directory across; take it
  // out, or the starter carries an empty component under the name the learner
  // is about to be told to create.
  for (const registryPath of derived.removedComponents) {
    fs.rmSync(path.join(options.starterDir, 'components', registryPath), { recursive: true, force: true });
  }

  rewriteRegistry(options.starterDir, derived.starter, derived.removedComponents);
  writeProjectMetadata(options.starterDir, derived.starter.metadata);

  return {
    written: true,
    starterDir: options.starterDir,
    retractions: derived.retractions,
    stillSatisfied: derived.stillSatisfied,
    droppedFromCopy,
    removedComponents: derived.removedComponents
  };
}

interface RegistryEntry {
  path?: string;
  nodeCount?: number;
  connectionCount?: number;
  [key: string]: unknown;
}

interface RegistryFile {
  components?: Record<string, RegistryEntry>;
  stats?: { totalComponents?: number; totalNodes?: number; totalConnections?: number; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * P79 D4 — make `_registry.json` describe the starter, not the solution.
 *
 * 🔴 Read-modify-write, like `writeProjectMetadata` below and for the same
 * reason: the file carries `$schema`, `version`, `lastUpdated`, per-component
 * `type`/`created`/`modified`, and whatever a later schema adds. Only the counts
 * are re-derived — from the files this writer just put on disk, which is the one
 * source that cannot disagree with them — and only the dropped components'
 * entries are removed. Everything else is left as the solution had it.
 *
 * Matches entries the way `readLessonProject` does: an entry's `path`, falling
 * back to its key.
 */
function rewriteRegistry(starterDir: string, starter: LessonProjectSource, removedComponents: string[]): void {
  const file = path.join(starterDir, 'components', '_registry.json');
  if (!fs.existsSync(file)) return;

  let registry: RegistryFile;
  try {
    registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  if (!registry || typeof registry !== 'object' || !registry.components) return;

  const removed = new Set(removedComponents);
  const written = new Map(starter.components.map((c) => [c.registryPath, c]));
  let totalNodes = 0;
  let totalConnections = 0;

  for (const [key, entry] of Object.entries(registry.components)) {
    const registryPath = entry?.path ?? key;
    if (removed.has(registryPath)) {
      delete registry.components[key];
      continue;
    }
    const files = written.get(registryPath);
    if (!files) continue;
    const nodeCount = (files.nodes?.nodes ?? []).length;
    const connectionCount = (files.connections?.connections ?? []).length;
    registry.components[key] = { ...entry, nodeCount, connectionCount };
    totalNodes += nodeCount;
    totalConnections += connectionCount;
  }

  if (registry.stats && typeof registry.stats === 'object') {
    registry.stats = {
      ...registry.stats,
      totalComponents: Object.keys(registry.components).length,
      totalNodes,
      totalConnections
    };
  }

  fs.writeFileSync(file, JSON.stringify(registry, null, 2), 'utf8');
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

/**
 * Put the derived `metadata` back into `nodegx.project.json`, leaving every other
 * key in that file exactly as the solution had it.
 *
 * 🔴 Read-modify-write rather than write-from-the-model. `LessonProjectSource`
 * carries `rootNodeId` and `metadata` and nothing else from this file, so writing
 * it from that shape would delete the project name, its version, its settings and
 * anything a later schema adds.
 */
function writeProjectMetadata(starterDir: string, metadata: Record<string, unknown> | undefined): void {
  const file = path.join(starterDir, 'nodegx.project.json');
  if (!fs.existsSync(file)) return;

  let project: Record<string, unknown>;
  try {
    project = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Unreadable in, unreadable out — this module is not the one to repair it,
    // and rewriting it from the model would replace a broken file with a
    // differently broken one.
    return;
  }

  if (metadata === undefined) return;
  project.metadata = metadata;
  fs.writeFileSync(file, JSON.stringify(project, null, 2), 'utf8');
}
