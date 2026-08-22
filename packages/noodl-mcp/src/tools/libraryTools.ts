/**
 * LBR-008 — the shelf's tool surface: `list_library`, `get_library_entry`,
 * `install_prefab`.
 *
 * ## Where these sit in the budget, measured
 *
 * ⚠️ AWP-006's gate was measured at **8,255 tokens against the 8,280 bar — 25
 * free** immediately before this task (2026-08-22, `toolDisclosure.test.ts`'s
 * own fixture and normalisation). A resident tool costs hundreds; a new
 * deferred group costs ~26, which is more than everything that is left. The
 * one shape that fits is the one CN-006 measured for `create_node_kit`:
 * **appended to an existing deferred group**, where the only resident trace is
 * `find_tools`' `(N tools)` — and "3 tools" → "6 tools" is the same string
 * length, so the cost is zero. These three go in `explore`, whose purpose line
 * already says "library" (the word a browsing model would match), and whose
 * subject — things you pull into a project from outside it — is honestly
 * theirs.
 *
 * 🔴 **The price of zero, stated as CN-006 stated it:** `explore`'s `purpose`
 * says "example library", not "prefab library", and widening it costs resident
 * tokens out of the 25 that CN-009 also wants. Nothing is unreachable —
 * `find_tools`' `query` matches tool names, so "library" and "prefab" both
 * reveal these from anywhere — and the suite asserts that door rather than
 * assuming it. Widening the purpose is recorded as a follow-up for whoever
 * next renegotiates the budget.
 *
 * ## What `install_prefab` is, and which install path it reuses
 *
 * The editor installs through `views/ImportFlow` (`loadSource` →
 * `planSelection` → `applyToProject`), whose I/O shells are renderer-bound:
 * `analyze.ts`/`apply.ts` import `ProjectModel` and the Electron `FileSystem`,
 * so the engine's apply path is **not importable here**. What this implements
 * instead is unzip-into-project semantics matching the editor's *default
 * outcome* (LIB-005: with nothing colliding, install everything; where
 * something collides, "keep yours"): components, styles, variants, assets and
 * code modules are installed when absent and **skipped, and reported, when the
 * target already has them** — never overwritten. The legacy→v2 conversion is
 * the editor's own `buildComponentV2Files`, imported through `editor-deps`, so
 * the per-component layout has one source of truth.
 *
 * A shipped code module additionally gets CN-017 provenance (`origin:
 * 'imported'` — local checkout content, same arm as copying from another
 * project on this machine) and a CN-003 overlay refresh, so the kit's node
 * types are known to this server the turn after they arrive.
 *
 * @module noodl-mcp/tools/libraryTools
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { buildComponentV2Files, legacyNameToPath, recordKitProvenance } from '../editor-deps';
import type { LegacyComponent, StylesV2File } from '../editor-deps';
import { ToolError } from '../errors';
import type { ComponentFiles } from '../graph';
import { refreshProjectOverlay } from '../kitOverlay';
import {
  entryModuleDirs,
  listShelf,
  resolveEntry,
  resolveLibraryRoot,
  type LibraryEntryType,
  type ResolvedEntry,
  type ShelfProblem,
  type ShelfRow
} from '../libraryShelf';
import type { ProjectBinding } from '../project/ProjectBinding';
import type { ProjectStore } from '../project/ProjectStore';
import { guarded, jsonResult } from './util';

export interface ListLibraryResponse {
  entries: ShelfRow[];
  /** Entry directories that exist but could not be read — absent when empty. */
  problems?: ShelfProblem[];
  note: string;
}

export interface GetLibraryEntryResponse {
  slug: string;
  type: LibraryEntryType;
  label: string;
  description: string;
  tags: string[];
  version: string;
  docsPath?: string;
  minEditorVersion?: string;
  runtimeVersion?: string;
  /** Component legacyNames the entry's project ships. */
  components: string[];
  /** Code module directories the entry ships under noodl_modules/. */
  modules: string[];
  /** The entry's README — post-install configuration, when it has one (FH-023). */
  readme?: string;
  note: string;
}

export interface InstallPrefabResponse {
  slug: string;
  type: LibraryEntryType;
  version: string;
  componentsInstalled: string[];
  /** Already present in the project — kept yours, exactly as the editor's default. */
  componentsSkipped: string[];
  stylesMerged: { colors: string[]; textStyles: string[]; variants: string[] };
  stylesSkipped: { colors: string[]; textStyles: string[]; variants: string[] };
  filesCopied: string[];
  filesSkipped: string[];
  modulesInstalled: string[];
  modulesSkipped: string[];
  /** A shipped kit that failed to load in the overlay refresh — absent when none. */
  kitLoadFailures?: Array<{ module: string; message: string }>;
  next: string;
}

function requireLibraryRoot(): string {
  const resolved = resolveLibraryRoot();
  if (!resolved.ok) throw new ToolError('io-error', resolved.reason);
  return resolved.root;
}

export function registerLibraryTools(
  server: McpServer,
  binding: ProjectBinding,
  options: { allowWrites: boolean }
): void {
  server.registerTool(
    'list_library',
    {
      title: 'List the NodeGX library',
      description:
        'The index of installable library entries — prefabs (graphs of components: forms, tables, pickers, ' +
        'auth pages) and modules (code that adds node types: charts, icons, maps, QR). One row per entry: ' +
        'slug, label, one-line description, tags, version. Cheap by design; call get_library_entry for ' +
        'detail and install_prefab to install one into this project.',
      inputSchema: {
        type: z.enum(['prefab', 'module']).optional().describe('Only entries of this type'),
        tag: z.string().optional().describe('Only entries carrying this tag (exact, case-insensitive)')
      }
    },
    guarded((args: { type?: LibraryEntryType; tag?: string }) => {
      const root = requireLibraryRoot();
      const { rows, problems } = listShelf(root, { type: args.type, tag: args.tag });
      const payload: ListLibraryResponse = {
        entries: rows,
        ...(problems.length > 0 ? { problems } : {}),
        note:
          `${rows.length} entries. get_library_entry({slug}) for the full description, components, modules ` +
          'and README; install_prefab({slug}) to install one into this project.'
      };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'get_library_entry',
    {
      title: 'Get a library entry',
      description:
        'Everything about one library entry: full description, tags, version, the components and code ' +
        'modules it ships, and its README (post-install configuration) when it has one.',
      inputSchema: {
        slug: z.string().describe('The entry slug, from list_library'),
        type: z.enum(['prefab', 'module']).optional().describe('Disambiguates a slug that exists as both')
      }
    },
    guarded((args: { slug: string; type?: LibraryEntryType }) => {
      const root = requireLibraryRoot();
      const resolved = resolveEntry(root, args.slug, args.type);
      if (!resolved.ok) throw new ToolError('not-found', resolved.reason);
      const { entry } = resolved;

      const readmePath = path.join(entry.entryDir, 'README.md');
      const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : undefined;

      const payload: GetLibraryEntryResponse = {
        slug: entry.slug,
        type: entry.type,
        label: entry.meta.label,
        description: entry.meta.description ?? '',
        tags: entry.meta.tags ?? [],
        version: entry.meta.version ?? '0.0.0',
        ...(entry.meta.docsPath ? { docsPath: entry.meta.docsPath } : {}),
        ...(entry.meta.minEditorVersion ? { minEditorVersion: entry.meta.minEditorVersion } : {}),
        ...(entry.meta.runtimeVersion ? { runtimeVersion: entry.meta.runtimeVersion } : {}),
        components: sourceComponentNames(entry),
        modules: entryModuleDirs(entry),
        ...(readme ? { readme } : {}),
        note: options.allowWrites
          ? `install_prefab({slug: "${entry.slug}"}) installs this into the bound project.`
          : 'This server is read-only; installing needs a server started with --allow-writes.'
      };
      return jsonResult(payload);
    })
  );

  if (!options.allowWrites) return;

  server.registerTool(
    'install_prefab',
    {
      title: 'Install a library entry',
      description:
        'Install a library prefab or module into this project: its components (converted to the v2 layout), ' +
        'styles and variants, asset files, and any code modules it ships. Never overwrites — anything the ' +
        'project already has is kept and reported as skipped, matching the editor\'s default install. A ' +
        'shipped code module gets provenance recorded and its node types arrive in the catalog immediately.',
      inputSchema: {
        slug: z.string().describe('The entry slug, from list_library'),
        type: z.enum(['prefab', 'module']).optional().describe('Disambiguates a slug that exists as both')
      }
    },
    guarded(async (args: { slug: string; type?: LibraryEntryType }) => {
      const store = binding.require();
      const root = requireLibraryRoot();
      const resolved = resolveEntry(root, args.slug, args.type);
      if (!resolved.ok) throw new ToolError('not-found', resolved.reason);
      const { entry } = resolved;

      const sourceDir = path.join(entry.entryDir, 'project');
      const legacyPath = path.join(sourceDir, 'project.json');
      if (!fs.existsSync(legacyPath)) {
        // Every entry in the tree today is a legacy monolithic project. A v2
        // source directory is allowed by the library README and unimplemented
        // here — refusing loudly beats installing half of one.
        throw new ToolError(
          'io-error',
          `Entry "${entry.slug}" has no project/project.json. Only legacy monolithic library sources are ` +
            'installable through this tool today; this looks like a v2 directory entry.'
        );
      }
      const source = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as {
        components?: LegacyComponent[];
        metadata?: { styles?: { colors?: Record<string, string>; text?: Record<string, Record<string, unknown>> } };
        variants?: Array<{ name: string; typename: string; [key: string]: unknown }>;
      };

      const now = new Date().toISOString();

      // ── Components: convert with the editor's own serialiser, keep yours on collision ──
      const componentsInstalled: string[] = [];
      const componentsSkipped: string[] = [];
      for (const component of source.components ?? []) {
        if (typeof component?.name !== 'string' || component.name.length === 0) continue;
        const key = legacyNameToPath(component.name);
        if (store.resolve(key)) {
          componentsSkipped.push(component.name);
          continue;
        }
        // Many seeded entries have id-less components; v2 files carry the id
        // into componentId, so an absent one is minted rather than propagated.
        const withId: LegacyComponent = component.id ? component : { ...component, id: crypto.randomUUID() };
        const files = buildComponentV2Files(withId, now) as ComponentFiles;
        store.writeComponent(key, files, { expectNew: true });
        componentsInstalled.push(component.name);
      }

      // ── Styles and variants: merge into nodegx.styles.json, keep yours ──
      const styles = mergeStyles(store, source, now);

      // ── Asset files (fonts, images): copy what is absent, keep yours ──
      const assets = copyAssets(sourceDir, store.projectDir);

      // ── Code modules: copy, record provenance, refresh the overlay ──
      const modulesInstalled: string[] = [];
      const modulesSkipped: string[] = [];
      const sourceModulesDir = path.join(sourceDir, 'noodl_modules');
      for (const dirName of entryModuleDirs(entry)) {
        const target = path.join(store.projectDir, 'noodl_modules', dirName);
        if (fs.existsSync(target)) {
          modulesSkipped.push(dirName);
          continue;
        }
        fs.cpSync(path.join(sourceModulesDir, dirName), target, { recursive: true });
        modulesInstalled.push(dirName);
      }

      let kitLoadFailures: Array<{ module: string; message: string }> | undefined;
      if (modulesInstalled.length > 0) {
        // CN-017 — the same record the editor's import path writes for a kit
        // copied in from this machine. Best-effort, like create_node_kit: the
        // files are already installed and correct.
        const recorded = await recordKitProvenance(
          store.projectDir,
          modulesInstalled.map((module) => ({
            module,
            origin: 'imported' as const,
            fromProject: entry.entryDir,
            importedAt: now
          }))
        );
        if (!recorded.ok) {
          console.error(`[install_prefab] could not record provenance for "${entry.slug}": ${recorded.message}`);
        }

        // CN-003/CN-006 — the kit set of the bound project just changed; without
        // this the agent's next get_node_type answers "Unknown node type" for
        // nodes it was just told arrived.
        const overlay = refreshProjectOverlay(store.projectDir);
        const failures = (overlay.failures || []).filter((f) => modulesInstalled.some((m) => f.dirPath.endsWith(m)));
        if (failures.length > 0) {
          kitLoadFailures = failures.map((f) => ({
            module: modulesInstalled.find((m) => f.dirPath.endsWith(m)) ?? f.dirPath,
            message: f.message
          }));
        }
        if (overlay.unavailable) {
          kitLoadFailures = [
            ...(kitLoadFailures ?? []),
            { module: modulesInstalled.join(', '), message: `Extraction unavailable: ${overlay.unavailable.reason}` }
          ];
        }
      }

      const payload: InstallPrefabResponse = {
        slug: entry.slug,
        type: entry.type,
        version: entry.meta.version ?? '0.0.0',
        componentsInstalled,
        componentsSkipped,
        stylesMerged: styles.merged,
        stylesSkipped: styles.skipped,
        filesCopied: assets.copied,
        filesSkipped: assets.skipped,
        modulesInstalled,
        modulesSkipped,
        ...(kitLoadFailures ? { kitLoadFailures } : {}),
        next: nextGuidance(entry, componentsInstalled, modulesInstalled)
      };
      return jsonResult(payload);
    })
  );
}

/** Component legacyNames of an entry's source project, for `get_library_entry`. */
function sourceComponentNames(entry: ResolvedEntry): string[] {
  const legacyPath = path.join(entry.entryDir, 'project', 'project.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as { components?: Array<{ name?: string }> };
    return (parsed.components ?? []).map((c) => c.name).filter((n): n is string => typeof n === 'string');
  } catch {
    return [];
  }
}

function mergeStyles(
  store: ProjectStore,
  source: {
    metadata?: { styles?: { colors?: Record<string, string>; text?: Record<string, Record<string, unknown>> } };
    variants?: Array<{ name: string; typename: string; [key: string]: unknown }>;
  },
  now: string
): {
  merged: { colors: string[]; textStyles: string[]; variants: string[] };
  skipped: { colors: string[]; textStyles: string[]; variants: string[] };
} {
  const merged = { colors: [] as string[], textStyles: [] as string[], variants: [] as string[] };
  const skipped = { colors: [] as string[], textStyles: [] as string[], variants: [] as string[] };

  const sourceColors = source.metadata?.styles?.colors ?? {};
  const sourceText = source.metadata?.styles?.text ?? {};
  const sourceVariants = Array.isArray(source.variants) ? source.variants : [];
  if (
    Object.keys(sourceColors).length === 0 &&
    Object.keys(sourceText).length === 0 &&
    sourceVariants.length === 0
  ) {
    return { merged, skipped };
  }

  const stylesPath = path.join(store.projectDir, 'nodegx.styles.json');
  const target: StylesV2File = store.readStyles() ?? { $schema: 'https://opennoodl.dev/schemas/styles-v2.json' };
  target.colors = target.colors ?? {};
  target.textStyles = target.textStyles ?? {};
  target.variants = target.variants ?? [];

  for (const [name, value] of Object.entries(sourceColors)) {
    if (Object.prototype.hasOwnProperty.call(target.colors, name)) skipped.colors.push(name);
    else {
      target.colors[name] = value;
      merged.colors.push(name);
    }
  }
  for (const [name, style] of Object.entries(sourceText)) {
    if (Object.prototype.hasOwnProperty.call(target.textStyles, name)) skipped.textStyles.push(name);
    else {
      target.textStyles[name] = style;
      merged.textStyles.push(name);
    }
  }
  for (const variant of sourceVariants) {
    if (typeof variant?.name !== 'string' || typeof variant?.typename !== 'string') continue;
    const exists = target.variants.some((v) => v.name === variant.name && v.typename === variant.typename);
    const label = `${variant.name} (${variant.typename})`;
    if (exists) skipped.variants.push(label);
    else {
      target.variants.push(variant);
      merged.variants.push(label);
    }
  }

  if (merged.colors.length + merged.textStyles.length + merged.variants.length > 0) {
    target.metadata = { ...(target.metadata ?? {}), modified: now };
    writeJsonAtomic(stylesPath, target);
  }
  return { merged, skipped };
}

/**
 * Copy the entry's asset files (fonts, images — everything that is neither the
 * legacy project.json nor a code module) into the project, keeping existing
 * files. Paths are project-relative POSIX in the report.
 */
function copyAssets(sourceDir: string, projectDir: string): { copied: string[]; skipped: string[] } {
  const copied: string[] = [];
  const skipped: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(sourceDir, rel);
    for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel.length > 0 ? `${rel}/${d.name}` : d.name;
      if (rel.length === 0 && (d.name === 'project.json' || d.name === 'noodl_modules')) continue;
      if (d.isDirectory()) {
        walk(childRel);
        continue;
      }
      const target = path.join(projectDir, childRel);
      if (fs.existsSync(target)) {
        skipped.push(childRel);
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(sourceDir, childRel), target);
      copied.push(childRel);
    }
  };
  walk('');
  return { copied, skipped };
}

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function nextGuidance(entry: ResolvedEntry, componentsInstalled: string[], modulesInstalled: string[]): string {
  const parts: string[] = [];
  if (componentsInstalled.length > 0) {
    parts.push(
      `Place an installed component by using its legacyName as a node type (e.g. "${componentsInstalled[0]}").`
    );
  }
  if (modulesInstalled.length > 0) {
    parts.push('The module\'s node types are in the catalog now — list_node_types finds them.');
  }
  const readme = fs.existsSync(path.join(entry.entryDir, 'README.md'));
  if (readme) {
    parts.push(`This entry has post-install configuration — read it with get_library_entry({slug: "${entry.slug}"}).`);
  }
  parts.push('Run validate_project to check the result against this project.');
  return parts.join(' ');
}
