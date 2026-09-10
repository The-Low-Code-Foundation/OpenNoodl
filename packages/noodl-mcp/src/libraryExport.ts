/**
 * CMP-004 AC4 — **the shelf's return path.**
 *
 * `install_prefab` brings an entry in. Until this module there was nothing that
 * took a component back out, so the community library could only grow by
 * somebody hand-authoring a `library.json` inside the NodeGX checkout. A shelf
 * that is read before authoring and never written to after it makes phase 85
 * repeat instead of compound: every cycle improves the doctrine, and every
 * agent still builds every part from scratch.
 *
 * ## What "shelf-shaped" means, measured rather than assumed
 *
 * An entry on disk is exactly what `libraryShelf.ts` indexes and
 * `install_prefab` reads back:
 *
 * ```
 * library/prefabs/<slug>/library.json        ← scripts/library/schema.json
 * library/prefabs/<slug>/README.md           ← get_library_entry serves it verbatim
 * library/prefabs/<slug>/project/project.json ← LEGACY monolithic, version 4
 * library/prefabs/<slug>/project/<assets>     ← copied in by install
 * library/prefabs/<slug>/project/noodl_modules/<kit>/…
 * ```
 *
 * 🔴 **The project file is the LEGACY form, not the v2 layout the bound project
 * uses.** `install_prefab` refuses an entry without `project/project.json` in so
 * many words, and every one of the 43 shipped prefabs is legacy. So the export
 * is a real conversion — `reconstructLegacyComponent`, the editor's own
 * v2→legacy reader, which is the exact inverse of the `buildComponentV2Files`
 * the install path runs on the way back in. Both directions therefore have one
 * source of truth, and neither is a hand-rolled shape that drifts.
 *
 * ## Why the closure, and not just the one component
 *
 * AC4's measurement is a ROUND TRIP: export from project A, install into
 * project B, **and it renders**. A component that places another component
 * renders as a missing type on its own, so an entry that ships only the leaf
 * satisfies "a file was written" and fails the criterion. The walk follows
 * component references transitively (`isComponentRef`/`refToPath`, the
 * validator's own predicates) and carries every one it reaches.
 *
 * The same argument extends to the other three things a graph reaches for
 * outside itself, and each is carried for the same reason:
 *
 * - **named colours, text styles and variants** — the legacy style world;
 *   carried only when a node actually names one, so an entry does not drag a
 *   whole project's palette onto somebody else's shelf;
 * - **assets** — an image parameter naming a file inside the project;
 * - **code modules** — a node type `getNodeTypeSummary` reports as
 *   `providedBy: 'project-kit'` is a type project B does not have, so the kit
 *   directory travels with the entry.
 *
 * ## What is deliberately NOT carried, and is reported instead
 *
 * 🔴 **`var(--token)` values are left alone on purpose.** The modern authored
 * corpus is tokens end to end (measured on the landing-pages template:
 * ~180 colour parameters, **every one** a `var(--…)`), and a token resolves
 * against the HOST project's theme. Rewriting them into literals — or shipping
 * project A's overrides — would make a part that looks wrong in every project
 * but the one it came from. Leaving them is what makes an installed part adopt
 * project B's look, which is the Tailwind sentence this task is built on. The
 * tokens a part depends on are reported and written into its README, because a
 * part that needs a token project B has never heard of is a thing the author
 * should know before publishing, not a thing the installer discovers.
 *
 * ⚠️ **A raw hex colour is the opposite case and gets a warning**: it survives
 * the trip and then ignores the host theme forever. Reported per node and
 * parameter, never rewritten — this module does not edit the author's graph.
 *
 * ## Concurrency posture
 *
 * The library tree is shared and edited by many hands at once. This module
 * **only ever creates a directory that does not exist** and refuses when one
 * does; nothing here reads-modifies-writes a file somebody else may be holding.
 * That is also why the slug is the caller's, not derived: a derived slug
 * silently collides.
 *
 * @module noodl-mcp/libraryExport
 */

import * as fs from 'fs';
import * as path from 'path';

import { getNodeTypeSummary } from './catalog';
import { isComponentRef, reconstructLegacyComponent, refToPath } from './editor-deps';
import type { LegacyComponent } from './editor-deps';
import { ToolError } from './errors';
import type { ProjectStore } from './project/ProjectStore';

/** A variant as the legacy project.json carries it. */
export interface LegacyVariantEntry {
  name: string;
  typename: string;
  [key: string]: unknown;
}

/** One component of the closure, in both forms. */
export interface ExportedComponent {
  key: string;
  legacyName: string;
  legacy: LegacyComponent;
}

/** A colour written as a literal — it will not follow the host project's theme. */
export interface HardcodedColour {
  component: string;
  node: string;
  parameter: string;
  value: string;
}

/**
 * Everything the entry needs, worked out before a single byte is written. Kept
 * separate from the writing so a caller can grade the plan without a
 * filesystem, and so a refusal happens before a half-written entry exists.
 */
export interface EntryPlan {
  components: ExportedComponent[];
  colors: Record<string, string>;
  textStyles: Record<string, Record<string, unknown>>;
  variants: LegacyVariantEntry[];
  /** Project-relative POSIX paths of files a parameter names. */
  assets: string[];
  /** `noodl_modules` directories the graph's node types come from. */
  kitModules: string[];
  /** Design tokens the graph reads — carried by NAME only, on purpose. */
  tokens: string[];
  /** Node types nothing in this project or the catalog can provide. */
  unresolvedTypes: string[];
  /** Component references that do not resolve in this project. */
  missingComponents: string[];
  hardcodedColors: HardcodedColour[];
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const TOKEN = /var\(\s*--([A-Za-z0-9_-]+)/g;

/** `library.json`'s slug rule, from `scripts/library/schema.json`'s dependency pattern. */
export const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Walk the component and everything it places, transitively.
 *
 * A missing ROOT is an error — the caller asked for something that is not
 * there. A missing DEPENDENCY is recorded and the walk continues: the graph is
 * already broken in project A, and refusing the whole export tells the author
 * less than an entry plus the name of the wire that dangles.
 */
export function collectClosure(store: ProjectStore, root: string): { components: ExportedComponent[]; missing: string[] } {
  const resolvedRoot = store.resolve(root);
  if (!resolvedRoot) {
    throw new ToolError(
      'not-found',
      `No component "${root}" in this project. list_components shows what is here (path form "Pages/Home" or legacy "/Pages/Home").`
    );
  }

  const components: ExportedComponent[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [resolvedRoot.key];

  while (queue.length > 0) {
    const next = queue.shift() as string;
    const resolved = store.resolve(next);
    if (!resolved) {
      if (!missing.includes(next)) missing.push(next);
      continue;
    }
    if (seen.has(resolved.key)) continue;
    seen.add(resolved.key);

    const stored = store.readComponent(resolved.key);
    const legacy = reconstructLegacyComponent(
      stored.key,
      stored.files.component,
      stored.files.nodes,
      stored.files.connections
    );
    components.push({ key: stored.key, legacyName: stored.legacyName, legacy });

    for (const node of stored.files.nodes.nodes ?? []) {
      if (typeof node.type === 'string' && isComponentRef(node.type)) queue.push(refToPath(node.type));
    }
  }

  return { components, missing };
}

/** Every string value a node carries, with the parameter that held it. */
function* nodeStrings(node: {
  parameters?: Record<string, unknown>;
  stateParameters?: Record<string, Record<string, unknown>>;
}): Generator<{ parameter: string; value: string }> {
  for (const [parameter, value] of Object.entries(node.parameters ?? {})) {
    if (typeof value === 'string') yield { parameter, value };
  }
  for (const [state, params] of Object.entries(node.stateParameters ?? {})) {
    for (const [parameter, value] of Object.entries(params ?? {})) {
      if (typeof value === 'string') yield { parameter: `${parameter} (${state})`, value };
    }
  }
}

/** Walk the reconstructed legacy tree — roots plus children, depth first. */
function* walkLegacy(roots: Array<Record<string, unknown>> | undefined): Generator<Record<string, unknown>> {
  for (const node of roots ?? []) {
    yield node;
    yield* walkLegacy(node.children as Array<Record<string, unknown>> | undefined);
  }
}

/**
 * Is this project-relative string a file that actually exists inside the
 * project? Anything absolute, or anything that climbs out with `..`, is not an
 * asset — it is a value that happens to look like a path, and copying it would
 * put a file from outside the project on a public shelf.
 */
function assetPath(projectDir: string, value: string): string | undefined {
  if (value.length === 0 || value.length > 512) return undefined;
  if (path.isAbsolute(value) || value.includes('://') || value.startsWith('..')) return undefined;
  if (!/\.[A-Za-z0-9]{1,8}$/.test(value)) return undefined;
  const abs = path.resolve(projectDir, value);
  const rel = path.relative(projectDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
  try {
    if (!fs.statSync(abs).isFile()) return undefined;
  } catch {
    return undefined;
  }
  return rel.split(path.sep).join('/');
}

/**
 * Work out everything the entry must carry. Pure apart from `fs.statSync` on
 * candidate asset paths and the catalog lookup, both of which are reads.
 */
export function planEntry(store: ProjectStore, root: string): EntryPlan {
  const { components, missing } = collectClosure(store, root);
  const exported = new Set(components.map((c) => c.key));

  const styles = store.readStyles() ?? {};
  const projectColors = styles.colors ?? {};
  const projectTextStyles = styles.textStyles ?? {};
  const projectVariants = styles.variants ?? [];

  const colors: Record<string, string> = {};
  const textStyles: Record<string, Record<string, unknown>> = {};
  const variants: LegacyVariantEntry[] = [];
  const assets = new Set<string>();
  const kitModules = new Set<string>();
  const tokens = new Set<string>();
  const unresolvedTypes = new Set<string>();
  const hardcodedColors: HardcodedColour[] = [];

  for (const component of components) {
    for (const node of walkLegacy(component.legacy.graph?.roots as Array<Record<string, unknown>>)) {
      const type = typeof node.type === 'string' ? node.type : '';
      const label = typeof node.label === 'string' && node.label.length > 0 ? node.label : type;

      // ── the type: a project component, a shipped node, a kit node, or nothing ──
      if (isComponentRef(type)) {
        if (!exported.has(refToPath(type)) && !missing.includes(refToPath(type))) missing.push(refToPath(type));
      } else if (type.length > 0) {
        const summary = getNodeTypeSummary(type);
        if ('error' in summary) unresolvedTypes.add(type);
        else if (summary.providedBy === 'project-kit' && summary.kitModule) kitModules.add(summary.kitModule);
      }

      // ── a variant is a style reference held on the node, not in a parameter ──
      if (typeof node.variant === 'string' && node.variant.length > 0) {
        const match = projectVariants.find((v) => v.name === node.variant && v.typename === type);
        if (match && !variants.some((v) => v.name === match.name && v.typename === match.typename)) {
          variants.push(match as LegacyVariantEntry);
        }
      }

      for (const { parameter, value } of nodeStrings(node)) {
        for (const m of value.matchAll(TOKEN)) tokens.add(`--${m[1]}`);

        if (Object.prototype.hasOwnProperty.call(projectColors, value)) colors[value] = projectColors[value];
        if (Object.prototype.hasOwnProperty.call(projectTextStyles, value)) textStyles[value] = projectTextStyles[value];
        if (HEX.test(value)) {
          hardcodedColors.push({ component: component.legacyName, node: label, parameter, value });
        }
        const asset = assetPath(store.projectDir, value);
        if (asset) assets.add(asset);
      }
    }
  }

  return {
    components,
    colors,
    textStyles,
    variants,
    assets: [...assets].sort(),
    kitModules: [...kitModules].sort(),
    tokens: [...tokens].sort(),
    unresolvedTypes: [...unresolvedTypes].sort(),
    missingComponents: missing.sort(),
    hardcodedColors
  };
}

export interface EntryMetadata {
  slug: string;
  label: string;
  description: string;
  tags: string[];
  version: string;
  readme?: string;
}

/**
 * The legacy monolithic project an entry ships, in the shape the 43 entries on
 * the shelf already use (`version: 4`, `settings`, `metadata.styles`,
 * `variants`) — matched against the real tree rather than against the fixture,
 * whose `version` is the string `"4"`.
 */
export function buildEntryProject(plan: EntryPlan, meta: EntryMetadata): Record<string, unknown> {
  return {
    name: meta.label,
    components: plan.components.map((c) => c.legacy),
    settings: {},
    version: 4,
    metadata: {
      styles: {
        ...(Object.keys(plan.colors).length > 0 ? { colors: plan.colors } : {}),
        ...(Object.keys(plan.textStyles).length > 0 ? { text: plan.textStyles } : {})
      }
    },
    variants: plan.variants
  };
}

/**
 * The README `get_library_entry` hands back and a human reads on the card. It
 * states the two things an installer cannot see from the graph: what the part
 * expects of the host project's theme, and anything the export could not carry.
 */
export function buildEntryReadme(plan: EntryPlan, meta: EntryMetadata): string {
  const lines: string[] = [`# ${meta.label}`, '', meta.description, ''];

  lines.push('## What installs', '');
  for (const c of plan.components) lines.push(`- \`${c.legacyName}\``);
  lines.push('', `Place it by using \`${plan.components[0].legacyName}\` as a node type.`, '');

  if (plan.tokens.length > 0) {
    lines.push(
      '## Theme',
      '',
      'This part reads its colours from design tokens, so it adopts the look of whatever project it is',
      'installed into. The tokens it reads:',
      '',
      ...plan.tokens.map((t) => `- \`${t}\``),
      ''
    );
  }

  if (plan.kitModules.length > 0) {
    lines.push('## Code modules', '', 'Installed with this entry:', '', ...plan.kitModules.map((m) => `- \`${m}\``), '');
  }

  if (plan.hardcodedColors.length > 0) {
    lines.push(
      '## Known limitation',
      '',
      `${plan.hardcodedColors.length} colour ${plan.hardcodedColors.length === 1 ? 'value is' : 'values are'} written as a literal rather than a token, so ${plan.hardcodedColors.length === 1 ? 'it' : 'they'} will not follow`,
      'the host project\'s theme:',
      '',
      ...plan.hardcodedColors.map((h) => `- \`${h.component}\` → ${h.node} → \`${h.parameter}\`: \`${h.value}\``),
      ''
    );
  }

  if (plan.unresolvedTypes.length > 0 || plan.missingComponents.length > 0) {
    lines.push(
      '## Incomplete',
      '',
      'The export could not carry everything this part uses. It will not render until these exist in the',
      'target project:',
      '',
      ...plan.unresolvedTypes.map((t) => `- node type \`${t}\``),
      ...plan.missingComponents.map((c) => `- component \`${c}\``),
      ''
    );
  }

  if (meta.readme) lines.push('## Notes from the author', '', meta.readme.trim(), '');

  return `${lines.join('\n').trimEnd()}\n`;
}

export interface WrittenEntry {
  entryDir: string;
  files: string[];
}

/**
 * Write the entry. Creates the directory or refuses — never merges into one
 * that exists, because the library tree has many editors and a half-overwritten
 * entry is worse than a refusal naming the slug.
 *
 * On any failure after the directory is created, the directory is removed:
 * `listShelf` reads every directory holding a `library.json`, so a partial
 * entry would show up on everybody's shelf as a real one.
 */
export function writeEntry(
  libraryRoot: string,
  plan: EntryPlan,
  meta: EntryMetadata,
  projectDir: string
): WrittenEntry {
  const entryDir = path.join(libraryRoot, 'prefabs', meta.slug);
  if (fs.existsSync(entryDir)) {
    throw new ToolError(
      'conflict',
      `library/prefabs/${meta.slug} already exists. Entries are never overwritten — pick another slug, or bump the existing entry by hand.`
    );
  }

  const files: string[] = [];
  fs.mkdirSync(path.join(entryDir, 'project'), { recursive: true });
  try {
    const libraryJson = {
      label: meta.label,
      description: meta.description,
      type: 'prefab' as const,
      tags: meta.tags,
      version: meta.version
    };
    writeJson(path.join(entryDir, 'library.json'), libraryJson);
    files.push('library.json');

    writeJson(path.join(entryDir, 'project', 'project.json'), buildEntryProject(plan, meta));
    files.push('project/project.json');

    fs.writeFileSync(path.join(entryDir, 'README.md'), buildEntryReadme(plan, meta), 'utf8');
    files.push('README.md');

    for (const asset of plan.assets) {
      const target = path.join(entryDir, 'project', asset);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(projectDir, asset), target);
      files.push(`project/${asset}`);
    }

    for (const module of plan.kitModules) {
      const source = path.join(projectDir, 'noodl_modules', module);
      if (!fs.existsSync(source)) continue;
      fs.cpSync(source, path.join(entryDir, 'project', 'noodl_modules', module), { recursive: true });
      files.push(`project/noodl_modules/${module}/`);
    }
  } catch (err) {
    fs.rmSync(entryDir, { recursive: true, force: true });
    throw err;
  }

  return { entryDir, files };
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
