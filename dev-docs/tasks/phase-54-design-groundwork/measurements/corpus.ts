/**
 * DSG-004 — the calibration corpus, loaded once with **parameters** attached.
 *
 * The phase-55 measurement scripts (`scan-page-size.js`, `scan-repeaters.js`)
 * each carry their own copy of this walk. This is the same walk in TypeScript,
 * and it exists so a rule can be calibrated by running **the shipped check**
 * over the corpus rather than a JS re-implementation of it — the twin-dialect
 * mistake this repo has made three times (BCN-003, `diagnosticKey`, the
 * `authoredNodes` adapter).
 *
 * Both corpora, the same two roots the phase-55 scans use:
 *   - this repository (project-examples, library/prefabs, test fixtures)
 *   - `../NodeGX test projects` (the hand-built QA projects and every model replay)
 *
 * @module dev-docs/tasks/phase-54/measurements/corpus
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CorpusNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
  children?: string[];
  ports?: { name: string; plug?: string }[];
}

export interface CorpusComponent {
  name: string;
  nodes: CorpusNode[];
  connections: { fromId: string; fromProperty: string; toId: string; toProperty: string }[];
}

export interface CorpusProject {
  /** Short label: the directory the project file lives in. */
  name: string;
  file: string;
  components: CorpusComponent[];
}

const REPO = path.resolve(__dirname, '../../../..');
const EXTRA_ROOTS = [
  path.resolve(REPO, '../NodeGX test projects'),
  // The worktree sits under a scratchpad; the real corpus lives beside the
  // primary checkout. Both are tried, and a missing root is simply skipped.
  '/Users/richardosborne/vscode_projects/NodeGX test projects'
];

function walk(dir: string, out: string[], depth = 0): string[] {
  if (depth > 12) return out;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (e.name === 'project.json' || e.name === 'nodegx.project.json') out.push(p);
  }
  return out;
}

const readJSON = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Legacy graphs nest their children; flatten to id lists. */
function flattenLegacy(roots: any[]): CorpusNode[] {
  const out: CorpusNode[] = [];
  const visit = (n: any): void => {
    out.push({
      id: n.id,
      type: n.type,
      label: n.label,
      parameters: n.parameters ?? null,
      children: (n.children ?? []).map((c: any) => c.id),
      ports: n.ports ?? undefined
    });
    for (const c of n.children ?? []) visit(c);
  };
  for (const r of roots ?? []) visit(r);
  return out;
}

function componentsOf(file: string): CorpusComponent[] {
  if (path.basename(file) === 'nodegx.project.json') {
    const root = path.dirname(file);
    const project = readJSON(file);
    const dir = path.join(root, project?.structure?.componentsDir || 'components');
    let registry: any;
    try {
      registry = readJSON(path.join(dir, '_registry.json'));
    } catch {
      return [];
    }
    const out: CorpusComponent[] = [];
    for (const key of Object.keys(registry.components || {})) {
      const cdir = path.join(dir, registry.components[key].path);
      try {
        const meta = readJSON(path.join(cdir, 'component.json'));
        const nodes = readJSON(path.join(cdir, 'nodes.json')).nodes || [];
        let connections: any[] = [];
        try {
          connections = readJSON(path.join(cdir, 'connections.json')).connections || [];
        } catch {
          /* a component with no wires has no file */
        }
        out.push({
          name: meta.path || '/' + key,
          nodes: nodes.map((n: any) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            parameters: n.parameters ?? null,
            children: Array.isArray(n.children) ? n.children : [],
            ports: n.ports ?? undefined
          })),
          connections
        });
      } catch {
        /* a half-written component is not a measurement */
      }
    }
    return out;
  }

  const project = readJSON(file);
  if (!Array.isArray(project?.components)) return [];
  return project.components.map((c: any) => ({
    name: c.name,
    nodes: flattenLegacy(c.graph?.roots ?? []),
    connections: c.graph?.connections ?? []
  }));
}

/** Every project both corpora contain, deduped by file path. */
export function loadCorpus(): CorpusProject[] {
  const files: string[] = [];
  walk(REPO, files);
  for (const root of EXTRA_ROOTS) {
    if (fs.existsSync(root) && !files.some((f) => f.startsWith(root))) walk(root, files);
  }

  const projects: CorpusProject[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const real = fs.realpathSync(file);
    if (seen.has(real)) continue;
    seen.add(real);
    let components: CorpusComponent[] = [];
    try {
      components = componentsOf(file);
    } catch {
      continue;
    }
    if (components.length === 0) continue;
    projects.push({ name: path.basename(path.dirname(file)), file, components });
  }
  return projects;
}

/** Group a corpus by which half it came from, for reporting. */
export function isRepoProject(p: CorpusProject): boolean {
  return p.file.startsWith(REPO);
}
