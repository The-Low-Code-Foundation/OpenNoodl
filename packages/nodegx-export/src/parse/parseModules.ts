/**
 * `noodl_modules/` → `ModuleIR[]` — EXP-010's parse half.
 *
 * Until this file existed, `parseProject` contained **zero references to `noodl_modules`**: the
 * directory was never opened. Every node from a custom kit therefore resolved to `catalogRef:
 * null`, fell through `renderRole`'s default arm, and left the emitted JSX with a hole in it. The
 * export was silently dropping the one part of a project the author had written themselves.
 *
 * 🔴 **The scan is `@nodegx/module-inject`'s, not this file's.** LIB-003 merged two
 * `noodl_modules` readers because they had drifted, and CN-001 moved the merged core into a
 * no-build package precisely so a fourth caller could reuse it instead of writing a third. What
 * this file adds on top is the export's own questions — which modules carry nodes, what those
 * nodes' ports are, and which files have to travel with the app.
 *
 * ⚠️ **Parsing now runs project code.** `runKitSource` executes each kit's `index.js` in a `vm`
 * context, because a custom node's ports are declared nowhere else (see `kitSource.ts`). That is a
 * real change to what `parseProject` does and it is stated here rather than buried: exporting a
 * project runs that project's kits on the machine doing the export.
 *
 * ⚠️ **Never throws on content**, the same contract as the rest of parse. A kit that is missing,
 * unreadable, an ES-module build or a thrower comes back as a `ModuleIR` with a `status` and a
 * `message` saying so, and the rest of the app exports around it (AC4).
 */

import * as fs from 'fs';
import * as path from 'path';

import { ModuleIR, ModuleStatus } from '../ir/types';
import { runKitSource } from './kitSource';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scanModuleManifestsSync } = require('@nodegx/module-inject') as {
  scanModuleManifestsSync: (dir: string) => Array<{
    name: string;
    dirPath: string;
    manifest: Record<string, unknown> | null;
    warnings: string[];
  }>;
};

/**
 * Every module in a project, in directory order.
 *
 * The `kind` split is `projectmodules.ts`'s, measured there across the 29 real projects on this
 * machine and adopted rather than re-derived: there is no `kind: 'node-kit'` marker, so a kit is
 * *subtractively* a module with a `main` that is not an iconset and not an ERG-002 library.
 */
export function parseModules(projectDir: string): ModuleIR[] {
  const scanned = scanModuleManifestsSync(projectDir);
  const modules: ModuleIR[] = [];

  for (const entry of scanned) {
    const manifest = entry.manifest;
    const displayName = typeof manifest?.name === 'string' && manifest.name ? manifest.name : entry.name;
    const main = typeof manifest?.main === 'string' && manifest.main ? manifest.main : undefined;
    const runtimes = Array.isArray(manifest?.runtimes) ? manifest.runtimes.map(String) : ['browser'];

    const module: ModuleIR = {
      dirName: entry.name,
      displayName,
      kind: kindOf(manifest, main),
      status: 'no-nodes-declared',
      ...(main !== undefined ? { main } : {}),
      nodes: [],
      stylesheets: stylesheetsOf(manifest, entry.name),
      ...(typeof manifest?.iconClass === 'string' && manifest.iconClass ? { iconClass: manifest.iconClass } : {}),
      assets: filesUnder(projectDir, `noodl_modules/${entry.name}`),
      runtimes
    };

    if (manifest === null) {
      module.status = 'no-manifest';
      module.message = `"${entry.name}" has no readable manifest.json, so nothing knows what it is. The export copies its files but registers no nodes from it.`;
      modules.push(module);
      continue;
    }

    if (module.kind !== 'kit') {
      // An iconset, a font, an ERG-002 library. These carry no node definitions by construction —
      // "no nodes" is the correct and complete answer, not a failure to find any.
      modules.push(module);
      continue;
    }

    if (main === undefined) {
      module.status = 'no-main';
      module.message = `"${displayName}" declares no "main", so it loads its code from a URL at runtime — the export has no file to read and registers no nodes from it.`;
      modules.push(module);
      continue;
    }

    let code: string;
    try {
      code = fs.readFileSync(path.join(projectDir, 'noodl_modules', entry.name, main), 'utf8');
    } catch (error) {
      module.status = 'unreadable';
      module.message = `"${displayName}" names "${main}" as its main, which could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`;
      modules.push(module);
      continue;
    }

    const run = runKitSource(code);
    module.status = run.outcome === 'defines-nodes' ? 'loaded' : run.outcome;
    module.message = run.message;
    module.nodes = run.nodes;
    modules.push(module);
  }

  return modules;
}

/**
 * Which of the four manifest shapes this is.
 *
 * ⚠️ **Deliberately inclusive at the kit boundary**, carrying `manifestLooksLikeKit`'s reasoning:
 * a module with a `main` that declares no nodes is reported as a kit that registered nothing,
 * rather than reclassified into silence. A folder the author put in `noodl_modules/` and cannot
 * find anywhere in the output is the exact complaint this task exists to answer.
 */
function kindOf(manifest: Record<string, unknown> | null, main: string | undefined): ModuleIR['kind'] {
  if (manifest === null) return 'asset';
  if (manifest.type === 'iconset') return 'iconset';
  if (manifest.kind === 'external-library') return 'external-library';
  if (main !== undefined) return 'kit';
  return 'asset';
}

/**
 * `browser.stylesheets`, project-relative.
 *
 * The manifests on this machine write these already project-relative
 * (`"noodl_modules/lucide-icons/styles.css"`), which is what the injector's `pathPrefix` expects.
 * A module-relative entry is normalised to the same form so the emit side has one shape to copy
 * and link; an absolute URL is left alone and reported, because the export cannot bundle it.
 */
function stylesheetsOf(manifest: Record<string, unknown> | null, dirName: string): string[] {
  const browser = manifest?.browser;
  if (!browser || typeof browser !== 'object') return [];
  const list = (browser as Record<string, unknown>).stylesheets;
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((s) => (s.startsWith('noodl_modules/') || /^https?:\/\//.test(s) ? s : `noodl_modules/${dirName}/${s}`));
}

/**
 * Every file under a module directory, project-relative, sorted by path.
 *
 * 🔴 **The whole directory, not the files the manifest names.** `iconsets.ts` already documents
 * that `noodl_modules/` ships verbatim in a deploy, and the reason is visible in the shipped
 * modules: `lucide-icons/styles.css` has 1998 `@font-face`-adjacent rules pointing at
 * `lucide.woff2`, which the manifest never mentions. Copying only what is declared ships a
 * stylesheet whose glyphs are all missing — a defect that renders as blank squares rather than as
 * an error.
 */
function filesUnder(projectDir: string, relDir: string): string[] {
  const found: string[] = [];
  const walk = (rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(projectDir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else found.push(child);
    }
  };
  walk(relDir);
  return found;
}
