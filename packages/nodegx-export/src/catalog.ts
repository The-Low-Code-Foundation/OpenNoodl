/**
 * A minimal typed view over packages/noodl-types/src/node-catalog.json — only the fields the
 * export pipeline reads. The catalog artifact is the authority; this file must never restate
 * catalog *content* (the Rise lesson from EXP-007: every value is read from the thing it
 * describes).
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CatalogPortType {
  name?: string;
  codeeditor?: string;
  /** EXP-015. Present on `name: 'enum'` ports — the editor's own dropdown, read by `enumValues`. */
  enums?: Array<{ label?: string; value: unknown }>;
}

export interface CatalogPort {
  name: string;
  plug?: 'input' | 'output';
  isSignal?: boolean;
  type?: string | CatalogPortType;
  default?: unknown;
}

export interface CatalogNode {
  typeName: string;
  displayName?: string;
  category?: string;
  isVisual?: boolean;
  /** null for fully-static port sets; otherwise describes how the real set is determined. */
  dynamicPorts?: { mechanisms?: string[] } | null;
  inputs?: CatalogPort[];
  outputs?: CatalogPort[];
}

export interface Catalog {
  catalogFormatVersion: string;
  nodes: CatalogNode[];
}

/**
 * Nodes whose output port set only execution reveals (outputs are discovered through a proxy at
 * runtime). These parse to portKnowledge 'unknown' and are EXP-003's territory. Expression is
 * deliberately not here: its dynamic ports are *inputs*, statically derivable from the
 * expression's free variables, and its outputs are static.
 */
export const EXECUTION_REVEALED_TYPES: ReadonlySet<string> = new Set([
  'JavaScriptFunction',
  'Javascript2'
]);

export class CatalogIndex {
  readonly catalogFormatVersion: string;
  private readonly byTypeName = new Map<string, CatalogNode>();

  constructor(catalog: Catalog) {
    this.catalogFormatVersion = catalog.catalogFormatVersion;
    for (const node of catalog.nodes) {
      this.byTypeName.set(node.typeName, node);
    }
  }

  get(typeName: string): CatalogNode | undefined {
    return this.byTypeName.get(typeName);
  }

  isVisual(typeName: string): boolean {
    return this.byTypeName.get(typeName)?.isVisual === true;
  }

  /**
   * The catalog-declared default of an input port, or undefined when the catalog does not know
   * one. The interpreter falls back to these same defaults, so style extraction reads them here
   * rather than restating catalog content in code (the Rise lesson).
   */
  inputDefault(typeName: string, portName: string): unknown {
    return this.byTypeName.get(typeName)?.inputs?.find((p) => p.name === portName)?.default;
  }

  /**
   * EXP-015. The values an enum-typed input port offers, in catalog order, or `undefined` where the
   * catalog does not describe the port as an enum.
   *
   * 🔴 **This exists so that nothing hand-writes a second copy of an enum.** The `as` (Tag) port
   * offers a different element list on `Text` than on `Group`, both lists are the editor's own
   * dropdown, and a hand-written mirror of either drifts the moment somebody adds `<figure>` — the
   * `a-second-copy-of-a-palette-drifts-silently` shape. The catalog artifact is the authority.
   */
  enumValues(typeName: string, portName: string): string[] | undefined {
    const port = this.byTypeName.get(typeName)?.inputs?.find((p) => p.name === portName);
    const type = port?.type;
    if (typeof type !== 'object' || type === null || type.name !== 'enum') return undefined;
    const enums = type.enums;
    if (!Array.isArray(enums)) return undefined;
    return enums.map((entry) => String(entry.value));
  }

  /**
   * The kind of a catalog-declared port, by name. Returns undefined when the catalog does not
   * know the port (dynamic ports, unknown types) — callers decide what that means; this function
   * never guesses.
   */
  portKind(typeName: string, portName: string, plug: 'input' | 'output'): 'value' | 'signal' | undefined {
    const node = this.byTypeName.get(typeName);
    if (!node) return undefined;
    const ports = plug === 'input' ? node.inputs : node.outputs;
    const port = ports?.find((p) => p.name === portName);
    if (!port) return undefined;
    return isSignalPort(port) ? 'signal' : 'value';
  }
}

export function isSignalPort(port: { isSignal?: boolean; type?: string | CatalogPortType }): boolean {
  if (port.isSignal) return true;
  const type = port.type;
  if (typeof type === 'string') return type === 'signal';
  return type?.name === 'signal';
}

export function portTypeName(type: string | CatalogPortType | undefined): string | undefined {
  if (type === undefined) return undefined;
  if (typeof type === 'string') return type;
  return type.name;
}

export function isCodeEditorType(type: string | CatalogPortType | undefined): boolean {
  return typeof type === 'object' && type !== null && typeof type.codeeditor === 'string';
}

/**
 * A codeeditor port whose language is **JavaScript**.
 *
 * 🔴 `isCodeEditorType` is not this question, and the gap between them is most of the catalog.
 * Of the 36 node types carrying a codeeditor input, 29 carry `styleCss` (`codeeditor: 'text'`),
 * one is CSS Definition's `style` (`'css'`), and Static Data's `json`/`csv` are data. Exactly
 * seven ports are JavaScript — Function's `functionScript`, Expression's `expression`,
 * Map Collection's `mapScript`, For Each's `templateScript`, Script's `code` and REST's two.
 * The catalog names the language, so this set is *derived* rather than listed here (EXP-007's
 * rule: never restate catalog content).
 *
 * This is the predicate `NodeIR.sourceText` needs: its contract promises author-written **code**,
 * and selecting on `isCodeEditorType` fills it with a Text node's CSS instead.
 */
export function isJavaScriptCodeEditorType(type: string | CatalogPortType | undefined): boolean {
  return typeof type === 'object' && type !== null && type.codeeditor === 'javascript';
}

/**
 * The one place the node catalog is read from disk — HLS-001 AC4.
 *
 * Before this, every caller computed its own path to `packages/noodl-types/src/node-catalog.json`:
 * two production call sites and twenty-five test files, each with its own `path.join(__dirname,
 * '..', '..', ...)`. That is fine while everything lives in one checkout and impossible the moment
 * the package is installed from a registry, because the catalog is in a different package that a
 * consumer does not have.
 *
 * So the catalog now **travels with the package**: `build.mjs` copies it into `dist/` at build
 * time. It is still authored in exactly one place (`@noodl/types`) and never edited here — a copy
 * that is regenerated by the build cannot drift, which a copy that is maintained by hand would.
 *
 * ⚠️ Two locations are tried, and this is the honest reason: running from `src/` in this repo there
 * is no `dist/`, and running from an installed package there is no `@noodl/types`. Both are real
 * and neither is a fallback for a mistake. If both miss, the error names both, because a catalog
 * that silently resolved to nothing would make every node in the project look unknown rather than
 * make the export fail.
 */
export function catalogPath(): string {
  const packaged = path.join(__dirname, 'node-catalog.json');
  const inRepo = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
  for (const candidate of [packaged, inRepo]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `The node catalog could not be found. Looked for the packaged copy at ${packaged} and the ` +
      `in-repo source at ${inRepo}. If this is a built package, \`npm run build\` did not copy it.`
  );
}

/** The catalog, parsed. Every caller in this package and its consumers goes through here. */
export function loadCatalog(): Catalog {
  return JSON.parse(fs.readFileSync(catalogPath(), 'utf8')) as Catalog;
}
