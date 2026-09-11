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

import {
  buildComponentV2Files,
  buildEffectiveTokens,
  legacyNameToPath,
  readStoredTokens,
  recordKitProvenance
} from '../editor-deps';
import type { LegacyComponent, StylesV2File } from '../editor-deps';
import { ToolError } from '../errors';
import type { ComponentFiles } from '../graph';
import { refreshProjectOverlay } from '../kitOverlay';
import {
  entryTokens,
  planEntry,
  SLUG_PATTERN,
  writeEntry,
  type EntryPlan,
  type HardcodedColour
} from '../libraryExport';
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
  /**
   * CMP-007 — the design tokens the entry's graph reads, so an agent can see
   * what a part expects of a theme BEFORE installing it. Derived from the
   * shipped graph on every call; `library.json` records nothing about tokens,
   * deliberately — see the note on `entryTokens`.
   */
  tokens: string[];
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
  /**
   * CMP-007 — tokens the installed graph reads that THIS project does not
   * define. They resolve against nothing: `var(--x)` with no `--x` on `:root` is
   * an unset property, not an error, so the part installs, reports success and
   * draws the wrong colour. Absent when every token resolves.
   */
  tokensUnresolved?: string[];
  next: string;
}

export interface ExportToLibraryResponse {
  slug: string;
  type: 'prefab';
  version: string;
  /** Where it landed, relative to the library root — e.g. `prefabs/pricing-table`. */
  entryDir: string;
  /** Legacy names of every component the entry carries: the one asked for, plus its closure. */
  componentsExported: string[];
  stylesCarried: { colors: string[]; textStyles: string[]; variants: string[] };
  assetsCopied: string[];
  modulesCopied: string[];
  /** Design tokens the part reads. Carried by NAME — they resolve against the installing project. */
  tokensUsed: string[];
  files: string[];
  /** Literal colours: they survive the trip and then ignore the host theme — absent when none. */
  hardcodedColors?: HardcodedColour[];
  /** Node types the entry needs and cannot ship — absent when none. */
  unresolvedTypes?: string[];
  /** Component references that do not resolve in the source project — absent when none. */
  missingComponents?: string[];
  next: string;
}

/**
 * CMP-004 AC2. A ranked answer is a short one: past a dozen the tail is noise an agent pays for in
 * context and never reads, and the note says the full count so nothing is hidden silently.
 */
const QUERY_RESULT_CAP = 12;

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
        'slug, label, one-line description, tags, version, and size — how many components install and how ' +
        'many nodes they contain, so you can tell a one-node utility from a whole screen. Pass query to ' +
        'search by what a part DOES — ' +
        '"date formatter", "file upload", "sanitise email" — over labels, descriptions, tags and the ' +
        'component names entries ship; ask it before building a part from scratch. Cheap by design; call ' +
        'get_library_entry for detail and install_prefab to install one into this project.',
      inputSchema: {
        type: z.enum(['prefab', 'module']).optional().describe('Only entries of this type'),
        tag: z.string().optional().describe('Only entries carrying this tag (exact, case-insensitive)'),
        query: z
          .string()
          .optional()
          .describe('Free text over label, description, tags and component names — "date formatter"')
      }
    },
    guarded((args: { type?: LibraryEntryType; tag?: string; query?: string }) => {
      const root = requireLibraryRoot();
      const { rows, problems, considered } = listShelf(root, { type: args.type, tag: args.tag, query: args.query });
      /**
       * CMP-004 AC2. A query answers in one of three ways, and the third is the one that matters:
       * an HONEST NOTHING. "No entry on the shelf does that" is a useful answer — it is the
       * sentence that tells an agent to build the part and then put it back with
       * `export_to_library`, which is step 4 of THE ORDER. Silence, or a full unranked index,
       * reads as "the shelf has no opinion" and sends the same agent to build from scratch
       * without ever knowing it asked.
       */
      const searched = typeof args.query === 'string' && args.query.trim().length > 0;
      const shown = searched ? rows.slice(0, QUERY_RESULT_CAP) : rows;
      const note = !searched
        ? `${rows.length} entries. size is what installing costs you — {components, nodes} — so a 1/4 row is ` +
          'a part you wire in and a 25/155 row is most of a screen. get_library_entry({slug}) for the full ' +
          'description, components, modules and README; install_prefab({slug}) to install one into this project.'
        : rows.length === 0
          ? `Nothing on the shelf matches "${args.query}". That is an answer: build the part, then ` +
            'export_to_library({component}) puts it here for the next project. Call list_library with no ' +
            'query to see everything.'
          : `${rows.length} of ${considered} entries match ` +
            `"${args.query}", best first${rows.length > shown.length ? `, showing ${shown.length}` : ''}. Each row ` +
            'says which terms hit and where. get_library_entry({slug}) for the full description and components.';
      const payload: ListLibraryResponse = {
        entries: shown,
        ...(problems.length > 0 ? { problems } : {}),
        note
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
      const graphTokens = entryTokens(entry.entryDir);

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
        tokens: graphTokens,
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

      // ── CMP-007 — the tokens this project cannot resolve ─────────────────────
      //
      // Tokens travel by NAME on purpose (CMP-004 AC4), and that is what makes an
      // installed part adopt project B's look instead of dragging project A's
      // palette along. The gap that mechanism leaves is a token project B has
      // never DEFINED: it resolves against nothing, silently, and the part draws
      // an unset colour while the install reports success.
      //
      // 🔴 Read from the installed GRAPH, not from `library.json` — all 45
      // entries on the shipped shelf predate that field, so the metadata path
      // would report "no tokens" for exactly the entries most likely to be
      // installed. The list is a REPORT, never a refusal: a part whose tokens do
      // not all resolve still renders, and still installs.
      const effectiveTokens = buildEffectiveTokens(readStoredTokens(store.designTokenMetaSource()));
      const tokensUnresolved = entryTokens(entry.entryDir).filter((name) => !effectiveTokens.has(name));

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
        ...(tokensUnresolved.length > 0 ? { tokensUnresolved } : {}),
        next: nextGuidance(entry, componentsInstalled, modulesInstalled, tokensUnresolved)
      };
      return jsonResult(payload);
    })
  );

  // ── CMP-004 AC4 — the way back out ───────────────────────────────────────────
  //
  // A fourth tool in this group costs nothing resident, by exactly the
  // measurement LBR-008 recorded above: the only resident trace of a deferred
  // group is `find_tools`' `(N tools)`, and "6 tools" and "7 tools" are the same
  // string length. The name carries the word "library", which is the door
  // `find_tools`' name-matching query opens.
  server.registerTool(
    'export_to_library',
    {
      title: 'Export a component to the library',
      description:
        'Take a component out of this project and write it to the NodeGX library as an installable entry, ' +
        'so the next project can install_prefab it. Carries everything it needs to render elsewhere: the ' +
        'components it places, the named styles and variants it uses, its assets, and any code module its ' +
        'nodes come from. Design tokens travel by name, so the part adopts the theme of whatever project ' +
        'installs it. Never overwrites an existing entry.',
      inputSchema: {
        component: z.string().describe('The component to export — path form ("Sections/Hero") or legacy ("/Sections/Hero")'),
        slug: z.string().describe('Directory name on the shelf, e.g. "pricing-table". Letters, digits, . _ -'),
        label: z.string().describe('Display name on the library card, e.g. "Pricing Table"'),
        description: z
          .string()
          .describe('What the part is and does, in a sentence or two — this is what someone browsing the shelf reads'),
        tags: z.array(z.string()).optional().describe('Tags for list_library filtering, e.g. ["UI", "Layout"]'),
        version: z.string().optional().describe('Semver content version; defaults to 1.0.0'),
        readme: z.string().optional().describe('Post-install configuration notes, appended to the generated README')
      }
    },
    guarded((args: {
      component: string;
      slug: string;
      label: string;
      description: string;
      tags?: string[];
      version?: string;
      readme?: string;
    }) => {
      const store = binding.require();
      const root = requireLibraryRoot();

      if (!SLUG_PATTERN.test(args.slug)) {
        throw new ToolError(
          'invalid-argument',
          `"${args.slug}" is not a usable slug. It must start with a letter or digit and contain only letters, digits, ` +
            'dots, underscores and hyphens — it becomes a directory name and a URL segment.'
        );
      }
      const version = args.version ?? '1.0.0';
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw new ToolError('invalid-argument', `version must be semver (e.g. "1.0.0"); got "${version}".`);
      }

      const meta = {
        slug: args.slug,
        label: args.label,
        description: args.description,
        tags: args.tags ?? [],
        version,
        ...(args.readme ? { readme: args.readme } : {})
      };

      const plan = planEntry(store, args.component);
      const written = writeEntry(root, plan, meta, store.projectDir);

      const payload: ExportToLibraryResponse = {
        slug: args.slug,
        type: 'prefab',
        version,
        entryDir: path.relative(root, written.entryDir).split(path.sep).join('/'),
        componentsExported: plan.components.map((c) => c.legacyName),
        stylesCarried: {
          colors: Object.keys(plan.colors).sort(),
          textStyles: Object.keys(plan.textStyles).sort(),
          variants: plan.variants.map((v) => `${v.name} (${v.typename})`).sort()
        },
        assetsCopied: plan.assets,
        modulesCopied: plan.kitModules,
        tokensUsed: plan.tokens,
        files: written.files,
        ...(plan.hardcodedColors.length > 0 ? { hardcodedColors: plan.hardcodedColors } : {}),
        ...(plan.unresolvedTypes.length > 0 ? { unresolvedTypes: plan.unresolvedTypes } : {}),
        ...(plan.missingComponents.length > 0 ? { missingComponents: plan.missingComponents } : {}),
        next: exportGuidance(args.slug, plan)
      };
      return jsonResult(payload);
    })
  );
}

/**
 * What the author does next, and — where the export could not carry something —
 * what is wrong with the entry that was nevertheless written. An entry with a
 * hole is more useful than a refusal, provided it says so out loud: the hole is
 * in the response, in the README, and visible to `get_library_entry`.
 */
function exportGuidance(slug: string, plan: EntryPlan): string {
  const parts: string[] = [];
  if (plan.unresolvedTypes.length > 0 || plan.missingComponents.length > 0) {
    parts.push(
      '🔴 This entry is incomplete and will not render where it is installed: ' +
        [
          ...plan.unresolvedTypes.map((t) => `node type "${t}" is not in the catalog`),
          ...plan.missingComponents.map((c) => `component "${c}" is not in this project`)
        ].join('; ') +
        '.'
    );
  }
  if (plan.hardcodedColors.length > 0) {
    parts.push(
      `${plan.hardcodedColors.length} colour value${plan.hardcodedColors.length === 1 ? '' : 's'} ` +
        'are literals rather than var(--token), so they will ignore the theme of any project that installs this. ' +
        'Tokenise them in the source component and export again under a new slug if that matters.'
    );
  }
  parts.push(`install_prefab({slug: "${slug}"}) installs it into another project; list_library now lists it.`);
  parts.push('Run "npm run library:check" before committing the entry to the NodeGX repo.');
  return parts.join(' ');
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

function nextGuidance(
  entry: ResolvedEntry,
  componentsInstalled: string[],
  modulesInstalled: string[],
  tokensUnresolved: string[]
): string {
  const parts: string[] = [];
  if (componentsInstalled.length > 0) {
    parts.push(
      `Place an installed component by using its legacyName as a node type (e.g. "${componentsInstalled[0]}").`
    );
  }
  if (modulesInstalled.length > 0) {
    parts.push('The module\'s node types are in the catalog now — list_node_types finds them.');
  }
  // CMP-007. Named before the README line and before validate_project, because
  // this is the one thing in the response that will not surface as a visible
  // failure anywhere else — the part renders, it just renders wrong.
  if (tokensUnresolved.length > 0) {
    parts.push(
      `This part reads ${tokensUnresolved.length} design ${tokensUnresolved.length === 1 ? 'token' : 'tokens'} ` +
        `this project does not define (${tokensUnresolved.join(', ')}), so ${tokensUnresolved.length === 1 ? 'it resolves' : 'they resolve'} ` +
        'to nothing and the part will draw the wrong colour without reporting anything. Define ' +
        'them with set_project_tokens, or repoint those parameters at tokens this project has ' +
        '(get_style_vocabulary lists them).'
    );
  }
  const readme = fs.existsSync(path.join(entry.entryDir, 'README.md'));
  if (readme) {
    parts.push(`This entry has post-install configuration — read it with get_library_entry({slug: "${entry.slug}"}).`);
  }
  parts.push('Run validate_project to check the result against this project.');
  return parts.join(' ');
}
