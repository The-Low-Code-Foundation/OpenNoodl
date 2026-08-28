/**
 * Custom node kits in the exported app — EXP-010's emit half, Route B.
 *
 * ## What this emits, and the honest cost
 *
 * Route B ships the kit's own `index.js` verbatim and runs it behind a small shim implementing the
 * four things a kit node's code reaches for: `props`, `_internal`, `flagOutputDirty` and
 * `sendSignalOnOutput`. That is **correct by construction** — the exported app runs the same code
 * the editor and the deploy run, so a kit node cannot render differently in the three places — and
 * it is the only route that works for every existing kit on the day it lands.
 *
 * 🔴 **It also puts a slice of the Noodl node model into an export that has spent thirty sessions
 * keeping one out** (`EXP-002-TARGET-OUTPUT.md`'s headline: zero `@nodegx/core` imports). That
 * cost is real, it is confined to `src/kits/runtime.tsx`, and it is stated in the emitted file
 * itself rather than left for a reader to discover. Route A — a generated wrapper per node kind
 * with no shim at all — is the phase's exit criterion and needs a kit-format convention phase 69
 * owns (EXP-010 §6). This is the floor it will be diffed against.
 *
 * ## What a developer reads
 *
 * The call site is ordinary React: `<CashflowPill day={12} onDropped={…} />`. The generated
 * wrapper per node type is a dozen typed lines. Only `runtime.tsx` knows what a Noodl node is.
 *
 * ## The file layout, and why it splits
 *
 * - `src/kits/runtime.tsx` — the shim, the registry, and `window.React` / `window.Noodl`.
 * - `src/kits/modules/<dir>/<main>` — each kit's script, byte-identical, **bundled** so it is
 *   subject to the app's own build rather than served loose.
 * - `public/noodl_modules/<dir>/…` — everything else in every module folder, **verbatim**, because
 *   a stylesheet's `url()` references are invisible to the manifest and only survive a copy that
 *   changes nothing (AC5).
 *
 * A kit's script is the one file that goes to `src/` rather than `public/`: it has to be a module
 * the bundle imports so its evaluation order relative to the globals is guaranteed. Every other
 * file has exactly one home.
 */

import { ExportIR, KitNodeIR, KitPortIR, ModuleIR } from '../ir/types';
import { pascalCase } from './naming';

const GENERATED_TS = '// @nodegx:generated (kit bridge — provenance markers complete in EXP-007)\n';

/** A file to copy byte-for-byte, rather than generate. Both paths are relative to their root. */
export interface EmittedCopy {
  /** Project-relative source, e.g. `noodl_modules/inter/Inter-Bold.ttf`. */
  from: string;
  /** Output-relative destination, e.g. `public/noodl_modules/inter/Inter-Bold.ttf`. */
  to: string;
}

/** One custom node type as the emitted app sees it. */
export interface KitBinding {
  /** The graph's node type — `nodegx.cashflow.Pill`. */
  type: string;
  /** The React symbol the pages import — `Pill`, or `CashflowPill` when `Pill` collides. */
  symbol: string;
  /** `src/kits/CashflowKit` — the module pages import `symbol` from. */
  modulePath: string;
  def: KitNodeIR;
  /** Input port name → the wrapper's prop name. Identity unless the name is not an identifier. */
  propOf: Map<string, string>;
  /** Signal output port name → the wrapper's callback prop (`dropped` → `onDropped`). */
  signalPropOf: Map<string, string>;
  /** Value output port name → the wrapper's callback prop (`liveDay` → `onLiveDayChanged`). */
  valuePropOf: Map<string, string>;
}

export interface EmittedKits {
  files: Record<string, string>;
  copies: EmittedCopy[];
  /** Node type → how to render it. Empty when the project has no usable kit node. */
  bindings: Map<string, KitBinding>;
  notes: string[];
}

/**
 * The kit bridge for a project.
 *
 * ⚠️ **Every module contributes copies; only kits that loaded contribute code.** A kit that threw
 * still has its folder shipped and its failure named — deleting the folder because the export
 * could not read it would take an author's own work out of their repo on the strength of this
 * pipeline's opinion.
 */
export function emitKits(ir: ExportIR, usedTypes: Set<string>): EmittedKits {
  const files: Record<string, string> = {};
  const copies: EmittedCopy[] = [];
  const bindings = new Map<string, KitBinding>();
  const notes: string[] = [];

  const modules = ir.project.modules;
  if (modules.length === 0) return { files, copies, bindings, notes };

  // ---- the loadable kits ------------------------------------------------------------------
  const loadable = modules.filter(
    (m) => m.status === 'loaded' && m.main !== undefined && m.runtimes.includes('browser') && m.nodes.length > 0
  );

  const kitsWithUsedNodes = loadable
    .map((module) => ({ module, nodes: module.nodes.filter((n) => n.visual && usedTypes.has(n.type)) }))
    .filter((entry) => entry.nodes.length > 0);
  const bundledScripts = new Set(
    kitsWithUsedNodes.map(({ module }) => `noodl_modules/${module.dirName}/${module.main}`)
  );

  // ---- copies: every module file, verbatim -------------------------------------------------
  //
  // 🔴 **`bundledScripts`, not "every module's `main`".** A kit whose nodes this project does not
  // use gets no wrapper and no `src/kits/modules/` copy — so if its script were excluded from the
  // verbatim copy as well it would be the one file in `noodl_modules/` that reached neither
  // destination. That is the defect this task closed, reintroduced one directory over: a file the
  // author wrote, silently absent from their exported repo.
  for (const module of modules) {
    for (const asset of module.assets) {
      if (bundledScripts.has(asset)) continue;
      copies.push({ from: asset, to: `public/${asset}` });
    }
    if (!module.runtimes.includes('browser')) {
      notes.push(
        `module "${module.displayName}" declares runtimes [${module.runtimes.join(', ')}] and not "browser" — its files ship but nothing on the page loads them, the same as in the preview`
      );
    }
  }

  // Symbols are allocated over every *used* node in the project at once, so a name is stable
  // wherever it is imported from — the same one-space rule the component plans follow.
  const takenSymbols = new Set<string>();
  const takenFiles = new Set<string>();

  for (const { module, nodes } of kitsWithUsedNodes) {
    const fileBase = dedupe(pascalCase(module.dirName), takenFiles);
    const modulePath = `src/kits/${fileBase}`;
    const kitBindings: KitBinding[] = [];

    for (const def of nodes) {
      // The last dotted segment, PascalCased — `nodegx.cashflow.Pill` reads as `Pill`. A collision
      // takes the segment before it (`CashflowPill`), then a counter. Same shape as the component
      // file naming, and for the same reason: the short name is right almost always.
      const segments = def.type.split('.').filter((s) => s.length > 0);
      const short = pascalCase(segments[segments.length - 1] ?? def.type);
      const qualified = segments.length > 1 ? pascalCase(segments[segments.length - 2]) + short : short;
      const symbol = takenSymbols.has(short) ? dedupe(qualified, takenSymbols) : dedupe(short, takenSymbols);

      const binding: KitBinding = {
        type: def.type,
        symbol,
        modulePath,
        def,
        propOf: new Map(),
        signalPropOf: new Map(),
        valuePropOf: new Map()
      };

      const takenProps = new Set<string>(['children', 'className']);
      for (const input of def.inputs) {
        const prop = identifierFor(input.name);
        if (prop === null || takenProps.has(prop)) {
          notes.push(
            `kit node ${def.type}: input port "${input.name}" cannot be a React prop name — parameters and wires into it are dropped and reported`
          );
          continue;
        }
        takenProps.add(prop);
        binding.propOf.set(input.name, prop);
      }
      for (const output of def.outputs) {
        // `onClick` is already a handler name; `dropped` is not. Both end up as `on…`, and a port
        // already spelled that way is not spelled twice.
        const base = /^on[A-Z]/.test(output.name)
          ? output.name
          : `on${output.name.charAt(0).toUpperCase()}${output.name.slice(1)}`;
        const prop = identifierFor(output.kind === 'signal' ? base : `${base}Changed`);
        if (prop === null || takenProps.has(prop)) {
          notes.push(
            `kit node ${def.type}: output port "${output.name}" cannot be a React prop name — wires out of it are dropped and reported`
          );
          continue;
        }
        takenProps.add(prop);
        (output.kind === 'signal' ? binding.signalPropOf : binding.valuePropOf).set(output.name, prop);
      }

      kitBindings.push(binding);
      bindings.set(def.type, binding);
    }

    files[`${modulePath}.tsx`] = kitFile(module, kitBindings);
    copies.push({
      from: `noodl_modules/${module.dirName}/${module.main}`,
      to: `src/kits/modules/${module.dirName}/${module.main}`
    });
  }

  if (bindings.size > 0) files['src/kits/runtime.tsx'] = runtimeFile();

  return { files, copies, bindings, notes };
}

/**
 * One kit's wrapper module.
 *
 * 🔴 **The import order is load-bearing and is stated in the file it governs.** `./runtime`
 * installs `window.React` and `window.Noodl`, which the kit's script reads at *module scope* — a
 * kit's very first line is `var React = window.React`. ES modules evaluate their imports
 * depth-first in source order, so listing `./runtime` first is a guarantee rather than a hope; a
 * tidy-up that sorted these imports alphabetically would put `modules/` first and every kit would
 * throw on a `React` that is `undefined`.
 */
function kitFile(module: ModuleIR, bindings: KitBinding[]): string {
  const lines: string[] = [];
  lines.push(GENERATED_TS.trimEnd());
  lines.push(`// ${module.displayName} — ${bindings.length} node${bindings.length === 1 ? '' : 's'} from`);
  lines.push(`// noodl_modules/${module.dirName}/${module.main}, shipped verbatim.`);
  lines.push('//');
  lines.push('// ⚠️ Import order is load-bearing: `./runtime` installs `window.React` and');
  lines.push('// `window.Noodl` before the kit script below reads them at module scope. Do not sort');
  lines.push('// these two imports.');
  lines.push(`import { KitNode } from './runtime';`);
  lines.push(`import './modules/${module.dirName}/${module.main}';`);
  // Type-only, and only when a node takes children: `React.ReactNode` is the one React name these
  // files reference, and an unused value import would trip the app's own lint.
  if (bindings.some((b) => b.def.allowChildren)) lines.push(`import type * as React from 'react';`);
  lines.push('');

  for (const binding of bindings) {
    const { def, symbol } = binding;
    const propsType = `${symbol}Props`;

    lines.push(`export interface ${propsType} {`);
    for (const input of def.inputs) {
      const prop = binding.propOf.get(input.name);
      if (prop === undefined) continue;
      if (input.displayName !== undefined) lines.push(`  /** ${escapeComment(input.displayName)} */`);
      lines.push(`  ${prop}?: ${tsTypeOf(input)};`);
    }
    for (const [port, prop] of binding.signalPropOf) {
      lines.push(`  /** Signal output "${escapeComment(port)}". */`);
      lines.push(`  ${prop}?: () => void;`);
    }
    for (const [port, prop] of binding.valuePropOf) {
      const output = def.outputs.find((o) => o.name === port);
      lines.push(`  /** Value output "${escapeComment(port)}" — called whenever the node republishes it. */`);
      lines.push(`  ${prop}?: (value: ${output ? tsTypeOf(output) : 'unknown'}) => void;`);
    }
    if (def.allowChildren) lines.push('  children?: React.ReactNode;');
    lines.push('  className?: string;');
    lines.push('}');
    lines.push('');

    if (def.docs !== undefined) lines.push(`/** ${escapeComment(def.docs)} */`);
    lines.push(`export function ${symbol}(props: ${propsType}) {`);
    const destructured = [
      ...binding.signalPropOf.values(),
      ...binding.valuePropOf.values(),
      ...(def.allowChildren ? ['children'] : [])
    ];
    lines.push(
      destructured.length > 0
        ? `  const { ${destructured.join(', ')}, ...params } = props;`
        : '  const params = props;'
    );
    lines.push('  return (');
    lines.push('    <KitNode');
    lines.push(`      type=${JSON.stringify(def.type)}`);
    lines.push('      params={params}');
    // An empty map prints `{{}}` rather than `{{  }}` — the emitted app is read by people.
    lines.push(`      signals={${objectLiteral(binding.signalPropOf)}}`);
    lines.push(`      values={${objectLiteral(binding.valuePropOf)}}`);
    if (def.allowChildren) {
      lines.push('    >');
      lines.push('      {children}');
      lines.push('    </KitNode>');
    } else {
      lines.push('    />');
    }
    lines.push('  );');
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

/** `{ "dropped": onDropped }` — the port→prop map as an object literal, `{}` when there is none. */
function objectLiteral(map: Map<string, string>): string {
  if (map.size === 0) return '{}';
  return `{ ${[...map].map(([port, prop]) => `${JSON.stringify(port)}: ${prop}`).join(', ')} }`;
}

/**
 * A kit port's declared type as TypeScript.
 *
 * ⚠️ **`unknown` where the kit says nothing**, never `any`: a port with no declared type is one
 * the exported app's typecheck genuinely cannot help with, and `any` would quietly claim it can.
 * A units-typed port is `number | string` because the runtime turns `24` into `"24px"` before the
 * component sees it, and the graph may equally set `var(--space-4)`.
 */
function tsTypeOf(port: KitPortIR): string {
  if (port.defaultUnit !== undefined) return 'number | string';
  switch (port.type) {
    case 'string':
    case 'color':
    case 'enum':
    case 'textStyle':
    case 'font':
    case 'image':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'unknown[]';
    case 'object':
      return 'Record<string, unknown>';
    case 'signal':
      return 'void';
    default:
      return 'unknown';
  }
}

/** The shim. The only file in an exported app that knows what a Noodl node is. */
function runtimeFile(): string {
  return (
    GENERATED_TS +
    `/*
 * The custom-node bridge (EXP-010, Route B).
 *
 * A kit under \`src/kits/modules/\` is the file you wrote in NodeGX, byte for byte. It expects two
 * globals — \`window.React\` and \`window.Noodl\` — and it expects the object it is rendered
 * through to behave like a Noodl node: to own a \`props\` bag, an \`_internal\` scratchpad, and the
 * two publishing calls \`flagOutputDirty\` and \`sendSignalOnOutput\`. That contract is what this
 * file provides, and it is the ONLY place in this app where any of it appears.
 *
 * ⚠️ This is deliberately a small slice of the visual runtime's node model rather than a
 * translation of it. The upside is that a custom node behaves here exactly as it does in the
 * editor, because it IS the same code. The cost is this file. Everything else in \`src/kits/\` is
 * ordinary typed React, and a node kind you would rather have as hand-written React can be
 * replaced one wrapper at a time without touching anything else.
 *
 * Mirrors \`noodl-viewer-react/src/react-component-node.ts\` — the defaults loop, the outputProps
 * callbacks, \`getReactComponent\` then \`initialize\`, in that order. That order is not stylistic:
 * a kit's \`initialize\` installs callbacks onto \`this.props\` and expects the defaults to already
 * be there.
 */
import * as React from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A kit's node definition, as \`Noodl.defineModule\` received it. Shapes vary; nothing is assumed. */
type KitDefinition = any;

/** Every node definition the imported kit scripts registered, by node type name. */
const definitions = new Map<string, KitDefinition>();

declare global {
  interface Window {
    React?: unknown;
    Noodl?: any;
  }
}

/*
 * Installed at module scope, before any kit script runs — see the import-order note in each kit
 * wrapper. \`window.React\` is what makes a kit's \`React.createElement\` the same React as this
 * app's, which is what makes its hooks legal.
 */
if (typeof window !== 'undefined') {
  window.React = React;
  const existing = window.Noodl;
  window.Noodl = {
    deployed: true,
    ...(existing && typeof existing === 'object' ? existing : {}),
    defineModule(module: any) {
      for (const list of [module?.nodes, module?.reactNodes]) {
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          // Both wrapper shapes the runtime accepts: a bare definition, or \`{ node: {…} }\`.
          const def = entry && typeof entry === 'object' ? (entry.node ?? entry) : null;
          if (def && typeof def.name === 'string' && def.name && !definitions.has(def.name)) {
            // First registration wins, matching \`registerModule\`: two kits claiming one type name
            // must resolve the same way here as in the editor, or the app renders a different node.
            definitions.set(def.name, def);
          }
        }
      }
    }
  };
}

/** A design-token reference is already a complete CSS value and must never be fitted with a unit. */
function isTokenReference(value: unknown): boolean {
  return typeof value === 'string' && value.trim().startsWith('var(--');
}

interface KitNodeInstance {
  props: Record<string, any>;
  _internal: Record<string, any>;
  outputPropValues: Record<string, any>;
  reactComponent: any;
  flagOutputDirty(name: string): void;
  sendSignalOnOutput(name: string): void;
  forceUpdate(): void;
}

type Callbacks = {
  signals: Record<string, (() => void) | undefined>;
  values: Record<string, ((value: any) => void) | undefined>;
};

/**
 * Build the node object a kit's code runs against.
 *
 * The order below is \`react-component-node.ts\`'s \`initialize\`, step for step: input defaults,
 * then the outputProps callbacks, then \`getReactComponent\`, then the kit's own \`initialize\`.
 */
function createNode(def: KitDefinition, callbacks: React.RefObject<Callbacks>, rerender: () => void): KitNodeInstance {
  const node: KitNodeInstance = {
    props: {},
    _internal: {},
    outputPropValues: {},
    reactComponent: null,
    flagOutputDirty(name: string) {
      const output = def.outputs?.[name];
      const value =
        output && typeof output.get === 'function' ? output.get.call(node) : node.outputPropValues[name];
      callbacks.current?.values[name]?.(value);
    },
    sendSignalOnOutput(name: string) {
      callbacks.current?.signals[name]?.();
    },
    forceUpdate() {
      rerender();
    }
  };

  for (const [name, input] of Object.entries<any>(def.inputProps ?? {})) {
    if (!input || !Object.prototype.hasOwnProperty.call(input, 'default')) continue;
    const unit = input.type && typeof input.type === 'object' ? input.type.defaultUnit : undefined;
    node.props[name] =
      unit && input.default !== undefined && !isTokenReference(input.default)
        ? String(input.default) + unit
        : input.default;
  }

  for (const [name, output] of Object.entries<any>(def.outputProps ?? {})) {
    if (!output) continue;
    node.props[name] =
      output.type === 'signal'
        ? () => node.sendSignalOnOutput(name)
        : (...args: any[]) => {
            node.outputPropValues[name] = output.getValue ? output.getValue.call(node, ...args) : args[0];
            node.flagOutputDirty(name);
            output.onChange?.call(node, node.outputPropValues[name]);
          };
  }

  node.reactComponent = def.getReactComponent?.call(node) ?? null;
  def.initialize?.call(node);
  return node;
}

export interface KitNodeProps {
  /** The node type name the kit registered — \`nodegx.cashflow.Pill\`. */
  type: string;
  /** Graph parameters and wired values, by port name. */
  params?: Record<string, any>;
  /** Signal output port → the handler to run when the node fires it. */
  signals?: Record<string, (() => void) | undefined>;
  /** Value output port → the setter to write when the node republishes it. */
  values?: Record<string, ((value: any) => void) | undefined>;
  children?: React.ReactNode;
}

/**
 * Render one custom node.
 *
 * ⚠️ **A node whose kit did not register its type renders a marker, never nothing.** Silence is
 * the defect this whole file exists to end: before it, a kit node vanished from the output with
 * nothing in the file to say it had been there. The marker is \`hidden\`, so it changes no layout,
 * and it is in the DOM and in the console, so it is findable both ways.
 */
export function KitNode({ type, params, signals, values, children }: KitNodeProps) {
  const [, rerender] = React.useReducer((c: number) => c + 1, 0);

  // Held in a ref so a handler that changes identity every render does not rebuild the node —
  // rebuilding would reset \`_internal\` and lose everything the node has measured or dragged.
  const callbacks = React.useRef<Callbacks>({ signals: signals ?? {}, values: values ?? {} });
  callbacks.current = { signals: signals ?? {}, values: values ?? {} };

  const definition = definitions.get(type);
  const nodeRef = React.useRef<KitNodeInstance | null>(null);
  if (definition && nodeRef.current === null) {
    nodeRef.current = createNode(definition, callbacks, () => rerender());
  }
  const node = nodeRef.current;

  // \`inputs\`-declared ports (a kit's non-prop inputs) are delivered by running their \`set\`, which
  // is what the runtime does. Kept in an effect because a \`set\` typically calls
  // \`flagOutputDirty\`, and publishing during render would write a parent's state mid-render.
  const setterPorts = React.useMemo(
    () => Object.keys(definition?.inputs ?? {}).filter((name) => typeof definition.inputs[name]?.set === 'function'),
    [definition]
  );
  const setterValues = setterPorts.map((name) => params?.[name]);
  React.useEffect(() => {
    if (!node || !definition) return;
    for (const name of setterPorts) {
      const value = params?.[name];
      if (value !== undefined) definition.inputs[name].set.call(node, value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, definition, ...setterValues]);

  React.useEffect(() => {
    if (!definition) {
      // eslint-disable-next-line no-console
      console.warn(
        \`[nodegx] No kit registered the node type "\${type}". Its kit may have failed to load — check the browser console for an error from src/kits/modules/.\`
      );
    }
  }, [definition, type]);

  if (!definition || !node || !node.reactComponent) {
    return <span hidden data-nodegx-missing-kit-node={type} />;
  }

  const componentProps: Record<string, any> = { ...node.props, ...params };
  if (children !== undefined) componentProps.children = children;
  return React.createElement(node.reactComponent, componentProps);
}
`
  );
}

/** A port name usable as a JSX prop / TS identifier, or null when it is not one. */
function identifierFor(name: string): string | null {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : null;
}

function dedupe(base: string, taken: Set<string>): string {
  let name = base;
  let counter = 2;
  while (taken.has(name)) name = `${base}${counter++}`;
  taken.add(name);
  return name;
}

/** Authored text inside a `/** … *\/` comment — a kit's docs are project content. */
function escapeComment(text: string): string {
  return text.replace(/\*\//g, '*​/').replace(/\r?\n/g, ' ');
}
