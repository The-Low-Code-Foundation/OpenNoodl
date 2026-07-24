/**
 * Project → renderable preview build.
 *
 * One pass over the project on disk produces everything the browser needs:
 * the export JSON `renderDeployed` consumes, the lazily-fetched component
 * bundles, and the processed `index.html`. Nothing here re-implements export —
 * it composes the same engines the editor's deploy path uses:
 *
 *   v2 dir ──ProjectImporter──┐
 *                             ├── legacy project JSON ──┬── SUB-006 validation
 *   legacy project.json ──────┘                         │
 *                                                       └── ProjectModel
 *                                                             └── Exporter
 *                                                             └── HtmlProcessor
 *
 * The validation gate runs on the legacy object *before* a ProjectModel is
 * built, so a mid-edit invalid snapshot never reaches the exporter — the
 * caller keeps showing the last good build and overlays the diagnostics.
 *
 * @module noodl-preview/loader
 */

import * as fs from 'fs';
import * as path from 'path';

import { ProjectImporter, type ImportInput } from '../../noodl-editor/src/editor/src/io/ProjectImporter';
import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File
} from '../../noodl-editor/src/editor/src/schemas';
import { ProjectModel } from '@noodl-models/projectmodel';
import * as Exporter from '@noodl-utils/exporter';
import { HtmlProcessor } from '@noodl-utils/compilation/build/processors/html-processor';

import { validateLegacyProject, type PreviewReport } from './validate';

/** Everything the preview server serves for one snapshot of the project. */
export interface PreviewBuild {
  /** Display name, for the CLI banner and the browser tab fallback. */
  projectName: string;
  /**
   * The `window.projectData` object `renderDeployed` consumes.
   *
   * Stays `TSFixme` deliberately (PLAT-004): the editor's `Exporter.exportToJSON`
   * builds this object untyped and returns `TSFixme` itself, so a type here would
   * be an assertion about someone else's return value rather than a real type.
   * It becomes knowable when the exporter is typed.
   */
  exportJson: TSFixme;
  /** Lazily-fetched component bundles, keyed by the id in `componentIndex`. */
  bundles: Record<string, string>;
  /** Processed index.html (modules injected, title/head code/baseUrl resolved). */
  html: string;
  /** Non-fatal notes — dropped components, a guessed root node, etc. */
  warnings: string[];
}

export type PreviewLoad =
  /** Valid project, ready to render. */
  | { status: 'ok'; build: PreviewBuild; report: PreviewReport }
  /** Parsed fine but failed semantic validation — render the overlay instead. */
  | { status: 'invalid'; report: PreviewReport }
  /** Could not be read at all (torn write, bad JSON, no root node). */
  | { status: 'error'; message: string };

export type ProjectFormat = 'v2' | 'legacy';

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

/**
 * Classifies the target and returns the project directory.
 * Accepts a v2 directory, a directory containing a legacy `project.json`, or
 * the `project.json` file itself — the same inputs the validator's
 * `loadProject` takes, so a folder that validates can always be previewed.
 */
export function resolveTarget(target: string): { dir: string; format: ProjectFormat } {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw new Error(`No such file or directory: ${abs}`);

  const dir = fs.statSync(abs).isDirectory() ? abs : path.dirname(abs);

  if (fs.existsSync(path.join(dir, 'components', '_registry.json')) || fs.existsSync(path.join(dir, 'nodegx.project.json'))) {
    return { dir, format: 'v2' };
  }
  if (fs.existsSync(path.join(dir, 'project.json'))) {
    return { dir, format: 'legacy' };
  }
  throw new Error(
    `${dir} is not a Noodl project — expected components/_registry.json (v2) or project.json (legacy).`
  );
}

/** Reads a v2 directory into the legacy project object, via the io engine. */
function readV2(dir: string): { project: LegacyProject; warnings: string[] } {
  const registry = readJson<RegistryV2File>(path.join(dir, 'components', '_registry.json'));
  const componentsDir = path.join(dir, 'components');

  const components: ImportInput['components'] = {};
  for (const [key, entry] of Object.entries(registry.components ?? {})) {
    const compDir = path.join(componentsDir, entry.path);
    const maybe = <T>(name: string, fallback: T): T =>
      fs.existsSync(path.join(compDir, name)) ? readJson<T>(path.join(compDir, name)) : fallback;
    components[key] = {
      component: maybe('component.json', {} as ComponentV2File),
      nodes: maybe('nodes.json', { nodes: [] } as NodesV2File),
      connections: maybe('connections.json', { connections: [] } as ConnectionsV2File)
    };
  }

  const optional = <T>(name: string): T | undefined =>
    fs.existsSync(path.join(dir, name)) ? readJson<T>(path.join(dir, name)) : undefined;

  const result = new ProjectImporter().import({
    project: readJson<ProjectV2File>(path.join(dir, 'nodegx.project.json')),
    registry,
    routes: optional<RoutesV2File>('nodegx.routes.json'),
    styles: optional<StylesV2File>('nodegx.styles.json'),
    components
  });

  return { project: result.project, warnings: result.warnings };
}

/**
 * Picks a root node when the project file does not name one.
 *
 * `ProjectModel.fromJSON` resolves `rootNodeId` and `rootComponent`; projects
 * written by the editor always carry one. Projects authored from outside (an
 * agent writing v2 files, the MCP server) frequently do not, and the exporter
 * returns `undefined` without a root — a blank page with no explanation. So we
 * guess, using the editor's own predicate (`allowAsExportRoot`, via
 * `setRootComponent`), and tell the user we guessed.
 */
function resolveRootNode(project: ProjectModel): string | null {
  const components = project.getComponents();
  const byName = (name: string) => components.find((c) => c.name === name);

  const candidates = [byName('/%rootcomponent'), byName('/App'), byName('/#App'), ...components].filter(
    Boolean
  ) as ReturnType<typeof byName>[];

  for (const component of candidates) {
    project.setRootComponent(component);
    if (project.getRootNode()) {
      return `No root node declared — previewing "${component.name}". ` +
        `Set "rootNodeId" in the project file to pin it.`;
    }
  }
  return null;
}

/**
 * Loads, validates and builds one snapshot of the project.
 *
 * Never throws for project-content reasons: a torn or invalid project comes
 * back as `error`/`invalid` so the watcher loop can show it and keep going.
 */
export async function loadPreview(dir: string, format: ProjectFormat): Promise<PreviewLoad> {
  let legacy: LegacyProject;
  const warnings: string[] = [];

  try {
    if (format === 'v2') {
      const read = readV2(dir);
      legacy = read.project;
      warnings.push(...read.warnings);
    } else {
      legacy = readJson<LegacyProject>(path.join(dir, 'project.json'));
    }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }

  // ── SUB-006 gate: never hand an invalid graph to the exporter ──────────────
  const report = validateLegacyProject(legacy);
  if (report.summary.errors > 0) {
    return { status: 'invalid', report };
  }

  try {
    const project = ProjectModel.fromJSON(legacy);
    // The HtmlProcessor reads noodl_modules from here, and asset URLs resolve
    // against it — the deploy path sets the same field.
    project._retainedProjectDirectory = dir;

    if (!project.getRootNode()) {
      const note = resolveRootNode(project);
      if (!note) {
        return {
          status: 'error',
          message:
            'No renderable root node found. The project has no "rootNodeId" and no component ' +
            'with a node that can be an export root (a Group, Page Router, …).'
        };
      }
      warnings.push(note);
    }

    // `environment: null` blanks the cloud-services metadata: a local preview
    // must never inherit a deployed backend by accident.
    const exportJson = Exporter.exportToJSON(project, {
      useBundles: true,
      useBundleHashes: true,
      environment: null,
      ignoreComponentFilter: (c) => !c.name.startsWith('/#__cloud__/')
    });
    if (!exportJson) {
      return { status: 'error', message: 'Export produced nothing — the root component may have been deleted.' };
    }

    // Bundles the runtime will fetch from /noodl_bundles/<id>.json, exactly as
    // deployToFolder writes them — held in memory instead of on disk.
    const bundles: Record<string, string> = {};
    for (const bundleId of Object.keys(exportJson.componentIndex ?? {})) {
      bundles[bundleId] = JSON.stringify(Exporter.exportComponentBundle(project, bundleId, exportJson.componentIndex));
    }

    const template = fs.readFileSync(deployAssetPath('index.html'), 'utf8');
    const html = await new HtmlProcessor(project).process(template, {
      baseUrl: '/',
      indexJsPath: 'index.js'
    });

    return {
      status: 'ok',
      report,
      build: {
        projectName: legacy.name ?? path.basename(dir),
        exportJson,
        bundles,
        html,
        warnings
      }
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Deploy assets ────────────────────────────────────────────────────────────

/**
 * The deployed runtime template + bundle, shared with the real deploy path.
 * This directory is a build artifact (gitignored) produced by
 * `npm run build:editor:_viewer`, so its absence is a first-class error.
 */
export const DEPLOY_DIR = path.resolve(__dirname, '../../noodl-editor/src/external/deploy');

export function deployAssetPath(file: string): string {
  return path.join(DEPLOY_DIR, file);
}

/** Files the deploy index.html references, served verbatim. */
export const DEPLOY_ASSETS = [
  'noodl.deploy.js',
  'react.production.min.js',
  'react-dom.production.min.js',
  'load_terminator.js',
  'noodl-app.png'
];

export function assertDeployAssets(): void {
  const missing = ['index.html', ...DEPLOY_ASSETS].filter((f) => !fs.existsSync(deployAssetPath(f)));
  if (missing.length) {
    throw new Error(
      `The deployed viewer runtime is missing from ${DEPLOY_DIR} (${missing.join(', ')}).\n` +
        'It is a build artifact, not committed. Build it with:\n' +
        '  npm run build:editor:_viewer'
    );
  }
}
