/**
 * LIB-004: Import Engine v2 — pure inventory core.
 *
 * `buildInventory` turns raw project data (a `project.json` object or a live
 * `ProjectModel.toJSON()`) plus a resource list and a port-type lookup into a
 * {@link SourceInventory}: back-compatible per-item dependency lists AND a real,
 * provenance-carrying dependency graph.
 *
 * It is deliberately Electron-free — no `ProjectModel.instance`, no filesystem —
 * so it is unit-testable with hand-built projects and tiny catalogs. The disk
 * and model I/O lives in `analyze.ts`.
 *
 * @module noodl-editor/utils/import-engine/inventory
 */

import type {
  DependencyEdge,
  EdgeConfidence,
  InventoryComponent,
  InventoryStyleDependencies,
  InventoryVariant,
  ProjectComponentData,
  ProjectData,
  RawNode,
  RawVariant,
  SourceInventory
} from './types';

/**
 * Resolve the value-type name of a node's input port. Injected so the core stays
 * pure; the editor passes a `CatalogIndex`-backed implementation, tests pass a
 * literal map. Returns undefined when the port is not statically known.
 */
export type PortTypeLookup = (nodeType: string, portName: string) => string | undefined;

/** Port value-types whose parameter value is a path into the project's resources. */
const FILE_PORT_TYPES = new Set(['image', 'font', 'source']);
const COLOR_PORT_TYPE = 'color';
const TEXTSTYLE_PORT_TYPE = 'textStyle';
const COMPONENT_PORT_TYPE = 'component';

/** Strip the leading namespace slash the way TypeModel.localName does. */
function localName(type: string): string {
  return type.startsWith('/') ? type.slice(1) : type;
}

/** Depth-first walk over a component's node tree (roots + nested children). */
function forEachNode(roots: RawNode[] | undefined, visit: (n: RawNode) => void): void {
  const stack: RawNode[] = [...(roots ?? [])];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) continue;
    visit(n);
    if (Array.isArray(n.children)) stack.push(...n.children);
  }
}

/** All parameter bundles on a node: base parameters + every state bundle. */
function parameterBundles(source: {
  parameters?: Record<string, unknown>;
  stateParameters?: Record<string, Record<string, unknown>>;
  stateParamaters?: Record<string, Record<string, unknown>>;
}): Record<string, unknown>[] {
  const bundles: Record<string, unknown>[] = [];
  if (source.parameters) bundles.push(source.parameters);
  // Both the correct key and the legacy `stateParamaters` typo appear on disk.
  for (const stateBag of [source.stateParameters, source.stateParamaters]) {
    if (stateBag) for (const state in stateBag) bundles.push(stateBag[state]);
  }
  return bundles;
}

interface StyleNames {
  colors: Set<string>;
  text: Set<string>;
}

/**
 * Accumulates edges and the derived back-compat lists for a single inventory
 * item (component or variant), deduplicating by target.
 */
class DepCollector {
  readonly edges: DependencyEdge[] = [];
  private readonly components = new Set<string>();
  private readonly files = new Set<string>();
  private readonly colors = new Set<string>();
  private readonly texts = new Set<string>();
  private readonly variants = new Map<string, { typename: string; name: string }>();

  constructor(
    private readonly from: DependencyEdge['from'],
    private readonly resources: Set<string>,
    private readonly styles: StyleNames,
    private readonly portType: PortTypeLookup
  ) {}

  private edge(
    kind: DependencyEdge['to']['kind'],
    name: string,
    confidence: EdgeConfidence,
    via: string,
    typename?: string
  ): void {
    this.edges.push({ from: this.from, to: { kind, name, typename }, confidence, via });
  }

  /** A node whose TYPE is a local component reference (`/Foo`). */
  addComponentType(nodeType: string): void {
    if (!nodeType.startsWith('/')) return;
    if (!this.components.has(nodeType)) {
      this.components.add(nodeType);
      this.edge('component', nodeType, 'semantic', `node type ${nodeType}`);
    }
  }

  /** A node carrying an instance variant. */
  addVariant(nodeType: string, variantName: string): void {
    const typename = localName(nodeType);
    const key = `${typename}/${variantName}`;
    if (!this.variants.has(key)) {
      this.variants.set(key, { typename, name: variantName });
      this.edge('variant', variantName, 'semantic', `variant on ${nodeType}`, typename);
    }
  }

  /** Inspect one parameter for file/style/component references. */
  addParameter(nodeType: string | undefined, key: string, value: unknown): void {
    if (typeof value !== 'string' || value.length === 0) return;
    const pType = nodeType ? this.portType(nodeType, key) : undefined;

    // Semantic: the port's declared type tells us what the value means.
    if (pType && FILE_PORT_TYPES.has(pType)) {
      this.addFile(value, 'semantic', `${nodeType}.${key} (port type: ${pType})`);
    } else if (pType === COLOR_PORT_TYPE && this.styles.colors.has(value)) {
      this.addColor(value, 'semantic', `${nodeType}.${key} (port type: color)`);
    } else if (pType === TEXTSTYLE_PORT_TYPE && this.styles.text.has(value)) {
      this.addText(value, 'semantic', `${nodeType}.${key} (port type: textStyle)`);
    } else if (pType === COMPONENT_PORT_TYPE) {
      if (!this.components.has(value)) {
        this.components.add(value);
        this.edge('component', value, 'semantic', `${nodeType}.${key} (port type: component)`);
      }
    }

    // Inferred fallback: the value merely equals a known resource/style name.
    // Retained because catalog port names lag stored parameter keys for evolved
    // nodes, so this still catches real edges the semantic pass above misses.
    if (this.resources.has(value)) this.addFile(value, 'inferred', `${nodeType ?? '?'}.${key} == resource`);
    if (this.styles.colors.has(value)) this.addColor(value, 'inferred', `${nodeType ?? '?'}.${key} == color style`);
    if (this.styles.text.has(value)) this.addText(value, 'inferred', `${nodeType ?? '?'}.${key} == text style`);
  }

  private addFile(name: string, confidence: EdgeConfidence, via: string): void {
    // A semantic edge supersedes an inferred one for the same file.
    const already = this.files.has(name);
    if (!already) this.files.add(name);
    if (!already || confidence === 'semantic') this.edge('file', name, confidence, via);
  }

  private addColor(name: string, confidence: EdgeConfidence, via: string): void {
    const already = this.colors.has(name);
    if (!already) this.colors.add(name);
    if (!already || confidence === 'semantic') this.edge('colorStyle', name, confidence, via);
  }

  private addText(name: string, confidence: EdgeConfidence, via: string): void {
    const already = this.texts.has(name);
    if (!already) this.texts.add(name);
    if (!already || confidence === 'semantic') this.edge('textStyle', name, confidence, via);
  }

  componentDeps(): string[] {
    return [...this.components].filter((c) => c.startsWith('/'));
  }
  fileDeps(): string[] {
    return [...this.files];
  }
  colorDeps(): string[] {
    return [...this.colors];
  }
  textDeps(): string[] {
    return [...this.texts];
  }
  variantDeps(): { typename: string; name: string }[] {
    return [...this.variants.values()];
  }
  styleDeps(): InventoryStyleDependencies {
    return { colors: this.colorDeps(), text: this.textDeps() };
  }
}

function styleNamesOf(project: ProjectData): StyleNames {
  const s = project.metadata?.styles;
  return {
    colors: new Set(Object.keys(s?.colors ?? {})),
    text: new Set(Object.keys(s?.text ?? {}))
  };
}

function collectComponent(
  component: ProjectComponentData,
  resources: Set<string>,
  styles: StyleNames,
  portType: PortTypeLookup
): { item: InventoryComponent; edges: DependencyEdge[] } {
  const collector = new DepCollector({ kind: 'component', name: component.name }, resources, styles, portType);

  forEachNode(component.graph?.roots, (n) => {
    if (typeof n.type === 'string') {
      collector.addComponentType(n.type);
      if (n.variantName) collector.addVariant(n.type, n.variantName);
    }
    for (const bundle of parameterBundles(n)) {
      for (const key in bundle) collector.addParameter(n.type, key, bundle[key]);
    }
  });

  return {
    item: {
      name: component.name,
      id: component.id,
      dependencies: collector.componentDeps(),
      fileDependencies: collector.fileDeps(),
      variantDependencies: collector.variantDeps(),
      styleDependencies: collector.styleDeps()
    },
    edges: collector.edges
  };
}

function collectVariant(
  variant: RawVariant,
  resources: Set<string>,
  styles: StyleNames,
  portType: PortTypeLookup
): { item: InventoryVariant; edges: DependencyEdge[] } {
  const typename = variant.typename ?? '';
  const collector = new DepCollector(
    { kind: 'variant', name: variant.name ?? '', typename },
    resources,
    styles,
    portType
  );

  // A variant's parameters are keyed by the node type it applies to.
  for (const bundle of parameterBundles(variant)) {
    for (const key in bundle) collector.addParameter(typename, key, bundle[key]);
  }

  return {
    item: {
      name: variant.name ?? '',
      typename,
      fileDependencies: collector.fileDeps(),
      styleDependencies: collector.styleDeps()
    },
    edges: collector.edges
  };
}

export interface BuildInventoryInput {
  sourceDir: string;
  project: ProjectData;
  /** Local resource paths (relative to the project dir), from the FS listing. */
  resources: string[];
  modules: string[];
  /** Injected catalog port-type lookup. Defaults to "unknown" (heuristic-only). */
  portType?: PortTypeLookup;
}

const NO_PORT_TYPE: PortTypeLookup = () => undefined;

/**
 * Build a {@link SourceInventory} from already-loaded project data. Pure.
 */
export function buildInventory(input: BuildInventoryInput): SourceInventory {
  const portType = input.portType ?? NO_PORT_TYPE;
  const resourceSet = new Set(input.resources);
  const styles = styleNamesOf(input.project);

  const edges: DependencyEdge[] = [];
  const components: InventoryComponent[] = [];
  for (const component of input.project.components ?? []) {
    const { item, edges: e } = collectComponent(component, resourceSet, styles, portType);
    components.push(item);
    edges.push(...e);
  }

  const variants: InventoryVariant[] = [];
  for (const v of input.project.variants ?? []) {
    // The legacy walk only surfaces named variants.
    if (v.name === undefined) continue;
    const { item, edges: e } = collectVariant(v, resourceSet, styles, portType);
    variants.push(item);
    edges.push(...e);
  }

  const styleMeta = input.project.metadata?.styles;
  const inventoryStyles = {
    colors: Object.keys(styleMeta?.colors ?? {}).map((name) => ({ name })),
    text: Object.keys(styleMeta?.text ?? {}).map((name) => {
      // Text styles can reference a font file directly in their definition.
      const def = (styleMeta?.text as Record<string, unknown>)[name];
      const files: string[] = [];
      if (def && typeof def === 'object') {
        for (const k in def as Record<string, unknown>) {
          const val = (def as Record<string, unknown>)[k];
          if (typeof val === 'string' && resourceSet.has(val)) files.push(val);
        }
      }
      // A text style's font is an edge like any other: recorded so the closure
      // can pull it in and so a UI can say WHY the font is coming along.
      // Confidence is `inferred` because the evidence is the same string match
      // the legacy heuristic used — a style property whose value happens to name
      // a file in the project.
      for (const file of files) {
        edges.push({
          from: { kind: 'style', name },
          to: { kind: 'file', name: file },
          confidence: 'inferred',
          via: `text style "${name}" == resource`
        });
      }
      return files.length > 0 ? { name, fileDependencies: files } : { name };
    })
  };

  return {
    sourceDir: input.sourceDir,
    components,
    resources: input.resources.map((name) => ({ name })),
    modules: input.modules.map((name) => ({ name })),
    styles: inventoryStyles,
    variants,
    edges
  };
}

/**
 * Adapt a `CatalogIndex` into a {@link PortTypeLookup}. Kept here (not importing
 * CatalogIndex into the pure core's signature) so `buildInventory` stays free of
 * the catalog type in its contract.
 */
export function catalogPortType(catalog: {
  getPort: (typeName: string, plug: 'input' | 'output', portName: string) => unknown;
}): PortTypeLookup {
  return (nodeType, portName) => {
    const port = catalog.getPort(nodeType, 'input', portName) as
      | { type?: unknown }
      | undefined;
    if (!port) return undefined;
    const t = port.type;
    if (typeof t === 'string') return t;
    if (t && typeof t === 'object' && 'name' in (t as Record<string, unknown>)) {
      return String((t as { name: unknown }).name);
    }
    return undefined;
  };
}
