/**
 * UNI-010 — reading a lesson bundle off disk into the things the harness grades.
 *
 * A bundle is a project directory with a `lesson.json` in it (UNI-007 slice 3).
 * UNI-010 adds one thing to that shape, and it is the price of the free-authoring
 * bargain:
 *
 * > **a bundle whose conditions were written by a model must also carry the graph
 * > that satisfies them.**
 *
 * Without a solution there is no F2 replay, no F3 decoy and no F4 render — three
 * of the four machine-detectable classes go dark, and the gate that was traded
 * for §3.1's structural guarantee is not actually there. So the solution lives at
 * {@link SOLUTION_DIR} inside the bundle, as an ordinary project directory, and
 * the starter is the bundle root the learner opens.
 *
 * ⚠️ **A curated bundle need not carry one**, and the reader does not insist:
 * a platform-authored lesson whose conditions a human wrote is a different risk
 * profile, and refusing it here would be this module deciding a policy question
 * that belongs to the caller. {@link LessonBundleScorecard.installable} is where
 * that decision is expressed.
 *
 * The filesystem arrives as a port, for the reason the rest of this arc does:
 * UNI-010 runs inside an MCP sidecar, and `tests-unit/` runs in plain Node.
 *
 * @module noodl-editor/models/lessonbundleread
 */

import type { LessonManifest } from './lessonformat';
import type { LessonProjectComponentFiles, LessonProjectSource } from './lessonprojectcontext';
import type { ComponentV2File, ConnectionsV2File, NodesV2File } from '../schemas';

/** The directory inside a bundle holding the lesson's own answer. */
export const SOLUTION_DIR = 'solution';

/** The manifest file a bundle is identified by. */
export const MANIFEST_FILE = 'lesson.json';

export interface LessonBundleFs {
  exists(path: string): boolean;
  /** Parsed JSON, or `undefined` when missing or unreadable. Never throws. */
  readJsonFile(path: string): unknown;
  join(...parts: string[]): string;
}

export interface ReadLessonBundleResult {
  manifest?: LessonManifest;
  /** The project the learner opens. */
  starter?: LessonProjectSource;
  /** The lesson's own answer, when the bundle carries one. */
  solution?: LessonProjectSource;
  /** Why a part is missing. Empty when everything asked for was found. */
  problems: string[];
}

interface RegistryFile {
  components?: Record<string, { path?: string }>;
}

/**
 * Read one v2 project directory into the shape the context builder takes.
 *
 * Returns `undefined` when the directory is not a v2 project — deliberately not
 * an exception, because "the author forgot the solution folder" is an ordinary
 * outcome of a machine writing a bundle, not an exceptional one.
 */
export function readLessonProject(dir: string, fs: LessonBundleFs): LessonProjectSource | undefined {
  const registry = fs.readJsonFile(fs.join(dir, 'components', '_registry.json')) as RegistryFile | undefined;
  if (!registry || typeof registry !== 'object' || !registry.components) return undefined;

  const componentsDir = fs.join(dir, 'components');
  const components: LessonProjectComponentFiles[] = [];

  for (const [key, entry] of Object.entries(registry.components)) {
    const registryPath = entry?.path ?? key;
    const compDir = fs.join(componentsDir, registryPath);

    const component = fs.readJsonFile(fs.join(compDir, 'component.json')) as ComponentV2File | undefined;
    const nodes = fs.readJsonFile(fs.join(compDir, 'nodes.json')) as NodesV2File | undefined;
    const connections = fs.readJsonFile(fs.join(compDir, 'connections.json')) as ConnectionsV2File | undefined;

    components.push({
      registryPath,
      component: component ?? ({ id: registryPath, name: registryPath, type: 'visual' } as ComponentV2File),
      nodes: nodes ?? ({ componentId: registryPath, nodes: [] } as NodesV2File),
      connections: connections ?? ({ componentId: registryPath, connections: [] } as ConnectionsV2File)
    });
  }

  const project = fs.readJsonFile(fs.join(dir, 'nodegx.project.json')) as
    | { rootNodeId?: string; metadata?: Record<string, unknown> }
    | undefined;

  return {
    components,
    ...(project?.rootNodeId ? { rootNodeId: project.rootNodeId } : {}),
    ...(project?.metadata ? { metadata: project.metadata } : {})
  };
}

/** Read a bundle: its manifest, the starter project, and the solution if present. */
export function readLessonBundle(bundleDir: string, fs: LessonBundleFs): ReadLessonBundleResult {
  const problems: string[] = [];

  if (!bundleDir || !fs.exists(bundleDir)) {
    return { problems: [`There is no lesson bundle at ${bundleDir || '(no path given)'}.`] };
  }

  const manifest = fs.readJsonFile(fs.join(bundleDir, MANIFEST_FILE)) as LessonManifest | undefined;
  if (!manifest || typeof manifest !== 'object') {
    problems.push(`The bundle has no readable ${MANIFEST_FILE}. A bundle is project files plus a manifest.`);
  }

  const starter = readLessonProject(bundleDir, fs);
  if (!starter) {
    problems.push(
      'The bundle root is not a project — components/_registry.json is missing, so there is nothing for a ' +
        'learner to open.'
    );
  }

  const solutionDir = fs.join(bundleDir, SOLUTION_DIR);
  const solution = fs.exists(solutionDir) ? readLessonProject(solutionDir, fs) : undefined;
  if (!solution) {
    problems.push(
      `The bundle carries no solution at "${SOLUTION_DIR}/". Without it the conditions cannot be replayed, ` +
        'so three of the four checkable failure classes go unchecked — a generated lesson needs one.'
    );
  }

  return {
    ...(manifest && typeof manifest === 'object' ? { manifest } : {}),
    ...(starter ? { starter } : {}),
    ...(solution ? { solution } : {}),
    problems
  };
}

/** The real filesystem, built lazily so a plain-Node import never reaches Electron. */
export function defaultBundleFs(): LessonBundleFs {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  /* eslint-enable @typescript-eslint/no-var-requires */

  return {
    exists: (p) => nodeFs.existsSync(p),
    readJsonFile: (p) => {
      try {
        return JSON.parse(nodeFs.readFileSync(p, 'utf8'));
      } catch {
        return undefined;
      }
    },
    join: (...parts) => nodePath.join(...parts)
  };
}
