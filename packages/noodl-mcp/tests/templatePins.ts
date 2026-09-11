/**
 * Pinning a prepared template directory so two runs of its generator agree byte
 * for byte — the half of `toTemplateContent` a v2 directory cannot do by
 * dropping fields.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why this is a module of its own
 *
 * `tpl001Template.ts` wrote these four functions for the members' area and kept
 * them private, which was right while there was one prepared template. TPL-003
 * is the second, and a copy of the pinning would agree with the original until
 * the first edit reached one of them — found once already, on `tpl001` itself:
 * *"the id is written in THREE files, not one … found by regenerating twice and
 * diffing"*. A second template must not have to find that again.
 *
 * ⚠️ **`tpl001Template.ts` still carries its own copy**, deliberately, for this
 * session: adopting this module there changes a file whose drift gate takes
 * ten minutes to run, and phase 82 is publishing that artefact. The two are
 * line-for-line the same logic; the day the members' area next regenerates for
 * another reason is the day it should import from here and delete its copy.
 *
 * ## What is pinned, and what is left exactly as the door wrote it
 *
 * - `component.json`'s `id`, `created`, `modified` — the id is a UUIDv5-shaped
 *   digest of the component's own path under a per-template namespace, so it is
 *   deterministic, unique within the project, and stable across regenerations.
 * - `nodes.json` and `connections.json`'s `componentId` — the same id, because
 *   it is written in three files.
 * - `_registry.json`'s `lastUpdated` and every row's `created`/`modified`.
 *
 * Everything else is the door's output. A normaliser that reached further would
 * start being a second author.
 *
 * @module noodl-mcp/tests/templatePins
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** A stable UUID-shaped id for a component, derived from its path and the template's namespace alone. */
export function stableComponentId(namespace: string, componentPath: string): string {
  const h = createHash('sha1').update(`${namespace}:${componentPath}`).digest('hex');
  // UUIDv5 layout: version nibble 5, variant nibble 8.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function pinComponentDirectory(dir: string, namespace: string, epoch: string): void {
  const componentFile = path.join(dir, 'component.json');
  const doc = JSON.parse(fs.readFileSync(componentFile, 'utf-8')) as Record<string, unknown>;
  const id = stableComponentId(namespace, String(doc.path));

  doc.id = id;
  doc.created = epoch;
  doc.modified = epoch;
  fs.writeFileSync(componentFile, `${JSON.stringify(doc, null, 2)}\n`);

  for (const name of ['nodes.json', 'connections.json']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const sidecar = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    if ('componentId' in sidecar) sidecar.componentId = id;
    fs.writeFileSync(file, `${JSON.stringify(sidecar, null, 2)}\n`);
  }
}

/** Pin every component directory under `projectDir/components`. */
export function pinComponentFiles(projectDir: string, namespace: string, epoch: string): void {
  const stack = [path.join(projectDir, 'components')];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
    }
    if (fs.existsSync(path.join(current, 'component.json'))) pinComponentDirectory(current, namespace, epoch);
  }
}

/** The registry keeps its OWN `created`/`modified` per component, beside the top-level `lastUpdated`. */
export function pinRegistry(projectDir: string, epoch: string): void {
  const file = path.join(projectDir, 'components', '_registry.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    lastUpdated?: string;
    components?: Record<string, Record<string, unknown>>;
  };
  doc.lastUpdated = epoch;
  for (const row of Object.values(doc.components ?? {})) {
    if ('created' in row) row.created = epoch;
    if ('modified' in row) row.modified = epoch;
  }
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
}

export function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/**
 * Record which node is the app's HOME, or the editor previews *"ERROR — No HOME
 * component selected"*. `rootNodeId`, not the legacy `rootComponent`, which a
 * v2 project file does not validate with. Derived from the file that was
 * written, never typed — the door de-duplicates ids project-wide.
 */
export function pinRootNode(output: string, appComponent: string): void {
  const appNodes = path.join(output, 'components', appComponent, 'nodes.json');
  const nodes = (JSON.parse(fs.readFileSync(appNodes, 'utf-8')) as { nodes?: Array<{ id: string; parent?: string }> })
    .nodes;
  const root = (nodes ?? []).find((n) => !n.parent);
  if (!root) throw new Error(`refusing to write: ${appComponent} has no root node to be the app's home`);

  const projectFile = path.join(output, 'nodegx.project.json');
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8')) as Record<string, unknown>;
  project.rootNodeId = root.id;
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
}

/** One string a person has to replace, read out of the shipped graph. */
export interface EditMarker {
  component: string;
  label: string;
  /** What it says today — a Text's `text`, a String's `value`, a button's `label`, or an instance's parameters. */
  text: string;
}

/** Instance parameters that are styling rather than words, left out of the note. */
const STYLE_KEYS = new Set(['color', 'sizeMode', 'objectFit']);

/**
 * Every node whose label starts with the marker prefix, read out of a written
 * artefact rather than typed. A hand-written list is the failure mode
 * `USED_COMPOSITIONS` once had: it claimed to be enforced, nothing read it, and
 * two of its thirteen entries named things that did not exist.
 */
export function collectEditMarkers(output: string, prefix: string): EditMarker[] {
  const componentsDir = path.join(output, 'components');
  const marked: EditMarker[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== 'nodes.json') continue;
      const component = path.relative(componentsDir, path.dirname(full)).split(path.sep).join('/');
      const parsed = JSON.parse(fs.readFileSync(full, 'utf-8')) as {
        nodes?: Array<{ type?: string; label?: string; parameters?: Record<string, unknown> }>;
      };
      for (const node of parsed.nodes ?? []) {
        if (typeof node.label !== 'string' || !node.label.startsWith(prefix)) continue;
        const params = node.parameters ?? {};
        // A component instance's words are its parameters, all of them; a
        // node's own words are one parameter, and which one depends on the type.
        const isInstance = String(node.type ?? '').startsWith('/');
        const direct = isInstance ? undefined : (params.text ?? params.value ?? params.label ?? params.src);
        const text =
          typeof direct === 'string'
            ? direct
            : Object.entries(params)
                .filter(([k, v]) => typeof v === 'string' && !STYLE_KEYS.has(k))
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(' · ');
        marked.push({ component, label: node.label, text });
      }
    }
  };
  walk(componentsDir);
  marked.sort((a, b) => (a.component + a.label).localeCompare(b.component + b.label));
  return marked;
}
