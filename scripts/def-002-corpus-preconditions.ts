#!/usr/bin/env ts-node
/**
 * DEF-002 AC6 — the corpus calibration pass for the precondition layer.
 *
 * ## The question
 *
 * `validate_component` / `validate_project` run `validateOnDisk`, which runs the
 * `SemanticValidator` and stops. The **thirteen precondition checks** composed by
 * `authoredPreconditionDiagnostics` are invisible to them; only `validateCandidate`
 * — the write gate — composes them. An agent calling `validate_project` to check
 * its work therefore gets a strictly weaker answer than the door that let the work
 * in, and no amount of new `rules/` will change it.
 *
 * The fix is one line. The *reason it was not taken* is that several of those
 * checks were calibrated against graphs an agent had just written (their headers
 * say so at length), while `validate_project` also runs over hand-authored and
 * imported projects. So the decision needs the number this script produces:
 * **per check, how many findings would appear on the corpus that the CLI gate does
 * not already report.**
 *
 * ## What it measures, and why that is the honest denominator
 *
 * The naive number — "how many diagnostics do the preconditions emit" — overstates
 * the cost badly, because `rules/parameterValue` (D13) already runs
 * `checkParameterValues` inside the semantic validator. Those findings are already
 * in `validate_project`'s output today. This script therefore reports the
 * **difference**: precondition diagnostics keyed by `diagnosticKey` that are not
 * already in the baseline report for the same project.
 *
 * `backend` is deliberately not supplied, matching `preconditionDiagnostics` in
 * `noodl-mcp/src/validate.ts`: a caller with no view of `cloudservices` reads an
 * omitted backend as "do not check" rather than "there is no backend".
 *
 * ## Usage
 *
 *   ts-node -P ./scripts/tsconfig.json ./scripts/def-002-corpus-preconditions.ts <dir-of-projects...>
 *   npm run calibrate:preconditions -- "<dir>"
 *
 * Each target may be a project itself or a directory whose children are projects;
 * both shapes (v2 decomposed, legacy monolithic `project.json`) are read.
 *
 * `--json` emits the full table. `--examples=N` prints N sample messages per code.
 *
 * @module scripts/def-002-corpus-preconditions
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  SemanticValidator,
  authoredNodes,
  authoredPreconditionDiagnostics,
  componentInterfaces,
  connectedInputs,
  declaredUrlPaths,
  dedupeDiagnostics,
  derivedPortIndices,
  diagnosticKey,
  AUTHORED_BLOCKING_WARNINGS
} from '../packages/noodl-editor/src/editor/src/validation';
import type { Diagnostic } from '../packages/noodl-editor/src/editor/src/validation';
import type { StoredNodeLike, ComponentNodesView } from '../packages/noodl-editor/src/editor/src/validation';
import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { loadProject } from '../packages/noodl-editor/src/editor/src/validation/loadV2Project';
import { extractProjectOverlay } from '../packages/noodl-mcp/src/kitExtract/extract';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeOverlay } = require('@nodegx/kit-catalog');

interface StoredConnection {
  fromId?: string;
  fromProperty?: string;
  toId: string;
  toProperty: string;
}

interface ReadComponent {
  name: string;
  nodes: StoredNodeLike[];
  connections: StoredConnection[];
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isV2Directory(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'components', '_registry.json')) ||
    fs.existsSync(path.join(dir, 'nodegx.project.json'))
  );
}

function isProject(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return isV2Directory(dir) || fs.existsSync(path.join(dir, 'project.json'));
}

/**
 * A legacy component's nested `roots` flattened to the stored-node shape the
 * checks read, with `children` as **ids** — the v2 spelling, and the one
 * `checkRepeaterTemplate` expects. `dynamicports` is folded in beside `ports`
 * because `normalize.ts` does the same and a component instance serialises its
 * live ports there.
 */
function flattenLegacyRoots(roots: any[]): StoredNodeLike[] {
  const out: StoredNodeLike[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    const children: any[] = Array.isArray(node.children) ? node.children : [];
    const ports = [...(Array.isArray(node.ports) ? node.ports : []), ...(Array.isArray(node.dynamicports) ? node.dynamicports : [])];
    out.push({
      id: String(node.id),
      type: typeof node.type === 'string' ? node.type : String(node.type ?? ''),
      ...(typeof node.label === 'string' ? { label: node.label } : {}),
      parameters: (node.parameters ?? null) as Record<string, unknown> | null,
      ...(ports.length ? { ports } : {}),
      ...(children.length ? { children: children.map((c: any) => String(c?.id)) } : {})
    });
    for (const child of children) visit(child);
  };
  for (const root of roots) visit(root);
  return out;
}

/** Every component in `target` as raw stored nodes + connections. */
function readComponents(target: string): ReadComponent[] {
  if (isV2Directory(target)) {
    const registry = readJson(path.join(target, 'components', '_registry.json')) as {
      components: Record<string, { path: string }>;
    };
    const componentsDir = path.join(target, 'components');
    const out: ReadComponent[] = [];
    for (const [key, entry] of Object.entries(registry.components)) {
      const dir = path.join(componentsDir, entry.path);
      try {
        const component = fs.existsSync(path.join(dir, 'component.json')) ? readJson(path.join(dir, 'component.json')) : {};
        const nodes = fs.existsSync(path.join(dir, 'nodes.json')) ? readJson(path.join(dir, 'nodes.json')) : { nodes: [] };
        const connections = fs.existsSync(path.join(dir, 'connections.json'))
          ? readJson(path.join(dir, 'connections.json'))
          : { connections: [] };
        out.push({
          name: component.path ?? key,
          nodes: Array.isArray(nodes.nodes) ? nodes.nodes : [],
          connections: Array.isArray(connections.connections) ? connections.connections : []
        });
      } catch {
        // A corrupt neighbour is one fewer name that resolves, not a fatal —
        // the convention `authoredProjectViews` already follows.
        out.push({ name: key, nodes: [], connections: [] });
      }
    }
    return out;
  }
  const project = readJson(path.join(target, 'project.json'));
  const components: any[] = Array.isArray(project.components) ? project.components : [];
  return components.map((c) => ({
    name: String(c.name ?? ''),
    nodes: flattenLegacyRoots(Array.isArray(c.graph?.roots) ? c.graph.roots : []),
    connections: Array.isArray(c.graph?.connections) ? c.graph.connections : []
  }));
}

function catalogFor(target: string): CatalogIndex {
  try {
    const overlay = extractProjectOverlay(target);
    if (!overlay.unavailable && overlay.nodes.length > 0) {
      return new CatalogIndex(mergeOverlay(defaultCatalog(), overlay.nodes));
    }
  } catch {
    /* fall through to built-ins — a broken kit must not stop the measurement */
  }
  return new CatalogIndex(defaultCatalog());
}

interface Row {
  code: string;
  severity: string;
  total: number;
  projects: Set<string>;
  blockingForAuthored: boolean;
  examples: string[];
}

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const exampleArg = argv.find((a) => a.startsWith('--examples='));
  const exampleLimit = exampleArg ? Number(exampleArg.split('=')[1]) : 2;
  const targets = argv.filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('usage: def-002-corpus-preconditions.ts <dir...> [--json] [--examples=N]');
    process.exit(2);
  }

  const projects: string[] = [];
  for (const t of targets) {
    const resolved = path.resolve(t);
    if (isProject(resolved)) {
      projects.push(resolved);
      continue;
    }
    for (const entry of fs.readdirSync(resolved)) {
      const child = path.join(resolved, entry);
      if (isProject(child)) projects.push(child);
    }
  }
  // 🔴 An empty corpus exits 2, never 0 — a calibration reporting "no new
  // findings" over nothing read is indistinguishable from one that read the
  // corpus and found it clean, and only one of those is evidence.
  if (projects.length === 0) {
    console.error(`No projects found under: ${targets.join(', ')}`);
    process.exit(2);
  }

  const rows = new Map<string, Row>();
  const perProject: Array<{ project: string; components: number; baseline: number; added: number }> = [];
  let readFailures = 0;

  for (const project of projects) {
    const label = path.basename(project);
    let components: ReadComponent[];
    let baselineKeys: Set<string>;
    let catalog: CatalogIndex;
    try {
      components = readComponents(project);
      catalog = catalogFor(project);
      const validator = new SemanticValidator(catalog);
      const baseline = validator.validate(loadProject(project), { strict: false });
      baselineKeys = new Set(baseline.diagnostics.map(diagnosticKey));
    } catch (err) {
      readFailures++;
      console.error(`SKIP ${label}: ${(err as Error).message}`);
      continue;
    }

    const views: ComponentNodesView[] = components.map((c) => ({ name: c.name, nodes: c.nodes as ComponentNodesView['nodes'] }));
    const interfaces = componentInterfaces(views);
    const derived = derivedPortIndices(views);
    const urlPaths = declaredUrlPaths(views);
    const names = views.map((v) => v.name);

    const added: Diagnostic[] = [];
    for (const component of components) {
      let diagnostics: Diagnostic[];
      try {
        diagnostics = authoredPreconditionDiagnostics({
          component: component.name,
          nodes: authoredNodes(component.nodes),
          components: names,
          urlPaths,
          interfaces,
          derived,
          connections: connectedInputs(component.connections),
          wires: component.connections as never,
          catalog
        });
      } catch (err) {
        console.error(`SKIP ${label} :: ${component.name}: ${(err as Error).message}`);
        continue;
      }
      for (const d of dedupeDiagnostics(diagnostics)) {
        if (baselineKeys.has(diagnosticKey(d))) continue;
        added.push(d);
      }
    }

    perProject.push({ project: label, components: components.length, baseline: baselineKeys.size, added: added.length });

    for (const d of added) {
      let row = rows.get(d.code);
      if (!row) {
        row = {
          code: d.code,
          severity: d.severity,
          total: 0,
          projects: new Set(),
          blockingForAuthored: d.severity === 'error' || AUTHORED_BLOCKING_WARNINGS.has(d.code),
          examples: []
        };
        rows.set(d.code, row);
      }
      row.total++;
      row.projects.add(label);
      if (row.examples.length < exampleLimit) row.examples.push(`${label} :: ${d.message}`);
    }
  }

  const ordered = [...rows.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  if (json) {
    console.log(
      JSON.stringify(
        {
          projectsRead: projects.length,
          readFailures,
          rows: ordered.map((r) => ({ ...r, projects: [...r.projects] })),
          perProject
        },
        null,
        2
      )
    );
    return;
  }

  const totalAdded = ordered.reduce((n, r) => n + r.total, 0);
  console.log(`Projects read: ${projects.length}  (skipped ${readFailures})`);
  console.log(`New diagnostics the preconditions would add to validate_project: ${totalAdded}\n`);
  console.log(`${'CODE'.padEnd(34)} ${'SEV'.padEnd(8)} ${'N'.padStart(5)} ${'PROJ'.padStart(5)}  authored-blocking`);
  console.log('-'.repeat(80));
  for (const r of ordered) {
    console.log(
      `${r.code.padEnd(34)} ${r.severity.padEnd(8)} ${String(r.total).padStart(5)} ${String(r.projects.size).padStart(5)}  ${r.blockingForAuthored ? 'yes' : 'no'}`
    );
  }
  if (exampleLimit > 0) {
    console.log('\nExamples:');
    for (const r of ordered) {
      console.log(`\n  ${r.code} (${r.severity}, ${r.total} in ${r.projects.size} projects)`);
      for (const e of r.examples) console.log(`    - ${e}`);
    }
  }
  const worst = [...perProject].sort((a, b) => b.added - a.added).slice(0, 12);
  console.log('\nWorst projects:');
  for (const p of worst) console.log(`  ${String(p.added).padStart(5)}  ${p.project} (${p.components} components)`);
}

main();
