/**
 * A minimal typed view over packages/noodl-types/src/node-catalog.json — only the fields the
 * export pipeline reads. The catalog artifact is the authority; this file must never restate
 * catalog *content* (the Rise lesson from EXP-007: every value is read from the thing it
 * describes).
 */

export interface CatalogPortType {
  name?: string;
  codeeditor?: string;
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
