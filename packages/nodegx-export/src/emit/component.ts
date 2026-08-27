/**
 * The visual-node generator (EXP-002 step 4): one component file + one CSS module per component,
 * from a ComponentPlan. The target shapes are hand-written in EXP-002-TARGET-OUTPUT.md §1–§2 and
 * the golden tests hold this emitter to them:
 *
 * - Component Inputs → a typed optional-props interface; wires from it become JSX interpolations
 *   (one input feeding two sinks is two interpolations, not a variable).
 * - One CSS-module class per visual node (style.ts owns the split); identical style sets merge
 *   and naming.ts owns every name.
 * - A For Each whose effective mapping is the static identity `map({...})` literal becomes
 *   `items.map()` with per-prop spreading and `key={item.id}`.
 * - A DbCollection2 consumed by a repeater becomes plain `useState` + `useEffect` over a typed
 *   api stub — no library, no magic.
 * - `RouterNavigate` resolves at generation time to `navigate('/url')` on the wired element.
 * - Unwired inputs stay native and uncontrolled; a control earns state only when a wire demands
 *   it. Exporting the app's behaviour includes exporting its gaps.
 */

import { CatalogIndex } from '../catalog';
import { BindingSource, ComponentPlan, ProjectPlan, QueryPlan } from '../analyze/plan';
import { ExportIR, NodeIR } from '../ir/types';
import { assignClassNames, ClassCandidate, partitionMergeGroup } from './naming';
import { computeNodeStyle, CONTENT_ATTR_ORDER, CONTENT_PARAMS, Decl, StyleRole } from './style';

const GENERATED_TS = '// @nodegx:generated (visual — provenance markers complete in EXP-007)\n';
const GENERATED_CSS = '/* @nodegx:generated (visual) */\n';
const PRINT_WIDTH = 100;

/** Runtime signal outputs that have a direct DOM event equivalent. Anything else is reported. */
const EVENT_ATTRS: Record<string, string> = {
  onClick: 'onClick',
  pointerDown: 'onPointerDown',
  pointerUp: 'onPointerUp',
  hoverStart: 'onMouseEnter',
  hoverEnd: 'onMouseLeave',
  onFocus: 'onFocus',
  onBlur: 'onBlur'
};

const TAGS: Record<string, string> = {
  group: 'div',
  page: 'div',
  text: 'p',
  image: 'img',
  button: 'button',
  input: 'input'
};

export interface EmittedComponent {
  /** { "src/pages/Landing.tsx": …, "src/pages/Landing.module.css": … } */
  files: Record<string, string>;
  notes: string[];
}

export function emitComponent(
  plan: ComponentPlan,
  project: ProjectPlan,
  ir: ExportIR,
  catalog: CatalogIndex
): EmittedComponent | null {
  if (!plan.file || !plan.rootId) return null;
  const component = ir.components.find((c) => c.path === plan.path)!;
  const nodeById = new Map(component.nodes.map((n) => [n.id, n]));
  const notes: string[] = [];

  // ---- styles + class names --------------------------------------------------------------
  const styledIds = preOrder(plan).filter((id) => isStyledRole(plan.roleOf[id]));
  const styleOf = new Map<string, Decl[]>();
  for (const id of styledIds) {
    const node = nodeById.get(id)!;
    const role = plan.roleOf[id] as StyleRole;
    const style = computeNodeStyle(node, role, catalog);
    for (const name of style.unhandled) {
      notes.push(`${plan.path}: parameter ${name} on ${id} has no style/content mapping — dropped, reported`);
    }
    let decls = style.decls;
    // The page collapse: the merged Group's style is the page div's style, plus any page-own
    // declarations the Group does not already set (none in practice — Page style params are rare).
    if (id === plan.rootId && plan.collapsedGroupId) {
      const group = nodeById.get(plan.collapsedGroupId)!;
      const groupStyle = computeNodeStyle(group, 'group', catalog);
      for (const name of groupStyle.unhandled) {
        notes.push(`${plan.path}: parameter ${name} on ${plan.collapsedGroupId} has no style/content mapping — dropped, reported`);
      }
      const groupProps = new Set(groupStyle.decls.map((d) => d.prop));
      decls = [...groupStyle.decls, ...decls.filter((d) => !groupProps.has(d.prop))];
    }
    styleOf.set(id, decls);
  }

  // Identical declaration sets merge into one class (TARGET-OUTPUT §2) — but only where the ids
  // share naming vocabulary (partitionMergeGroup); accidental byte-identity across unrelated
  // nodes keeps separate classes. Empty sets get no class.
  const byDeclsKey = new Map<string, string[]>();
  for (const id of styledIds) {
    const decls = styleOf.get(id)!;
    if (decls.length === 0) continue;
    const key = JSON.stringify(decls);
    byDeclsKey.set(key, [...(byDeclsKey.get(key) ?? []), id]);
  }
  const subgroupOf = new Map<string, string[]>();
  for (const ids of byDeclsKey.values()) {
    for (const subgroup of partitionMergeGroup(ids)) {
      for (const id of subgroup) subgroupOf.set(id, subgroup);
    }
  }
  // Candidates in first-encounter (pre-order) order, so class order and collision handling are
  // deterministic (D5).
  const groups: ClassCandidate[] = [];
  const classIndexOf = new Map<string, number>();
  for (const id of styledIds) {
    const subgroup = subgroupOf.get(id);
    if (!subgroup || classIndexOf.has(id)) continue;
    const index = groups.length;
    groups.push({ nodeIds: subgroup, label: nodeById.get(subgroup[0])!.authoredLabel, role: plan.roleOf[subgroup[0]] });
    for (const member of subgroup) classIndexOf.set(member, index);
  }
  const classNames = assignClassNames(groups);
  const classOf = (id: string): string | undefined => {
    const index = classIndexOf.get(id);
    return index === undefined ? undefined : classNames[index];
  };

  // ---- imports ---------------------------------------------------------------------------
  // Both src/pages and src/components sit one level below src/, where api/ lives.
  const relRoot = '..';
  const usesNavigate = Object.keys(plan.handlers).length > 0;
  const instanceSymbols = new Map<string, string>(); // module specifier → symbol
  const externalImports: string[] = [];
  if (plan.queries.length > 0) externalImports.push(`import { useEffect, useState } from 'react';`);
  if (usesNavigate) externalImports.push(`import { useNavigate } from 'react-router-dom';`);

  const internalImports = new Map<string, string>(); // specifier → line
  const stubModules = new Map<string, QueryPlan[]>();
  for (const query of plan.queries) {
    const list = stubModules.get(query.moduleBase) ?? [];
    list.push(query);
    stubModules.set(query.moduleBase, list);
  }
  for (const [moduleBase, queries] of stubModules) {
    const specifier = `${relRoot}/api/${moduleBase}`;
    const fetchNames = [...new Set(queries.map((q) => q.fetchName))].sort();
    const typeNames = [...new Set(queries.map((q) => q.typeName))].sort();
    internalImports.set(
      specifier,
      `import { ${[...fetchNames, ...typeNames.map((t) => `type ${t}`)].join(', ')} } from '${specifier}';`
    );
  }

  const requireInstance = (legacyPath: string | null, where: string): { symbol: string } | null => {
    if (!legacyPath) return null;
    const target = project.byLegacyPath.get(legacyPath);
    if (!target?.file) {
      notes.push(`${plan.path}: ${where} references ${legacyPath ?? '(unset)'}, which exports no component`);
      return null;
    }
    const specifier =
      plan.file!.dir === target.file.dir ? `./${target.file.fileBase}` : `../${target.file.dir}/${target.file.fileBase}`;
    internalImports.set(specifier, `import { ${target.file.symbol} } from '${specifier}';`);
    return { symbol: target.file.symbol };
  };

  // ---- JSX -------------------------------------------------------------------------------
  const bindingExpr = (source: BindingSource): string | null => {
    if (source.kind === 'prop') return source.name;
    return null;
  };

  const contentAttrs = (node: NodeIR): string[] => {
    const roles = CONTENT_PARAMS[node.type] ?? {};
    const attrs = new Map<string, string>();
    for (const param of node.parameters) {
      const role = roles[param.name];
      if (!role?.startsWith('attr:')) continue;
      const attr = role.slice('attr:'.length);
      if (param.value.kind === 'literal') attrs.set(attr, jsxAttr(attr, param.value.value));
    }
    for (const [toProperty, source] of Object.entries(plan.bindings[node.id] ?? {})) {
      const role = roles[toProperty];
      if (!role?.startsWith('attr:')) continue;
      const attr = role.slice('attr:'.length);
      const expr = bindingExpr(source);
      if (expr !== null) attrs.set(attr, `${attr}={${expr}}`);
      else notes.push(`${plan.path}: wire into ${node.id}.${toProperty} has no statically known source — dropped, reported`);
    }
    return CONTENT_ATTR_ORDER.filter((attr) => attrs.has(attr)).map((attr) => attrs.get(attr)!);
  };

  const handlerAttrs = (node: NodeIR): string[] => {
    const attrs: string[] = [];
    for (const [port, action] of Object.entries(plan.handlers[node.id] ?? {})) {
      const eventAttr = EVENT_ATTRS[port];
      if (!eventAttr) {
        notes.push(`${plan.path}: signal ${node.id}.${port} has no DOM event equivalent — dropped, reported`);
        continue;
      }
      attrs.push(`${eventAttr}={() => navigate('${action.navigateTo}')}`);
    }
    return attrs;
  };

  const childText = (node: NodeIR, paramName: string): string | null => {
    const bound = plan.bindings[node.id]?.[paramName];
    if (bound) {
      const expr = bindingExpr(bound);
      if (expr !== null) return `{${expr}}`;
      notes.push(`${plan.path}: wire into ${node.id}.${paramName} has no statically known source — dropped, reported`);
    }
    const literal = node.parameters.find((p) => p.name === paramName)?.value;
    if (literal?.kind === 'literal') return jsxText(String(literal.value));
    return null;
  };

  const render = (id: string, indent: number): string[] => {
    const node = nodeById.get(id)!;
    const role = plan.roleOf[id];

    if (role === 'repeater') return renderRepeater(node, indent);
    if (role === 'instance') {
      const target = requireInstance(node.type, `instance ${id}`);
      if (!target) return [`${pad(indent)}{/* TODO(export): component instance ${id} could not be resolved */}`];
      const attrs = instanceAttrs(node);
      return element(target.symbol, attrs, null, indent, false);
    }

    const tag = TAGS[role];
    const attrs: string[] = [];
    const className = classOf(id);
    if (className) attrs.push(`className={styles.${className}}`);
    if (role === 'image' || role === 'input') attrs.push(...contentAttrs(node));
    attrs.push(...handlerAttrs(node));

    if (role === 'text') {
      return element(tag, attrs, childText(node, 'text'), indent, false);
    }
    if (role === 'button') {
      return element(tag, attrs, childText(node, 'label'), indent, false);
    }
    if (role === 'image' || role === 'input') {
      return element(tag, attrs, null, indent, false);
    }

    // Containers: group / page.
    const childIds = plan.childrenOf[id] ?? [];
    const blocks = childIds.map((childId) => render(childId, indent + 2));
    if (role === 'page') {
      const headLines: string[] = [];
      if (plan.head?.title !== undefined) headLines.push(`${pad(indent + 2)}<title>${plan.head.title}</title>`);
      if (plan.head?.description !== undefined) {
        headLines.push(`${pad(indent + 2)}<meta name="description" content="${plan.head.description.replace(/"/g, '&quot;')}" />`);
      }
      // Page roots read best with breathing room: head block and top-level sections are
      // separated by blank lines (the target's own formatting).
      const spaced: string[] = [];
      if (headLines.length > 0) spaced.push(...headLines);
      for (const block of blocks) {
        if (spaced.length > 0) spaced.push('');
        spaced.push(...block);
      }
      return element(tag, attrs, spaced.length > 0 ? spaced : null, indent, true);
    }
    const children = blocks.flat();
    return element(tag, attrs, children.length > 0 ? children : null, indent, true);
  };

  const renderRepeater = (node: NodeIR, indent: number): string[] => {
    const repeater = plan.repeaters[node.id];
    const query = plan.queries.find((q) => q.nodeId === repeater?.itemsQueryId);
    const target = requireInstance(repeater?.templatePath ?? null, `For Each ${node.id}`);
    if (!repeater || !query || !target || repeater.mapping === null) {
      const reason = !repeater?.templatePath
        ? 'no template component'
        : repeater.mapping === null
          ? 'dynamic mapping script'
          : !query
            ? 'items are not fed by a query'
            : 'unresolvable template';
      notes.push(`${plan.path}: For Each ${node.id} deferred to EXP-003 (${reason})`);
      return [`${pad(indent)}{/* TODO(export): For Each ${node.id} deferred to EXP-003 (${reason}) */}`];
    }
    const item = query.itemName;
    const attrs = [
      `key={${item}.id}`,
      ...repeater.mapping.map(({ input, field }) => `${input}={${memberExpr(item, field)}}`)
    ];
    const lines = element(target.symbol, attrs, null, indent + 2, false);
    return [`${pad(indent)}{${query.stateName}.map((${item}) => (`, ...lines, `${pad(indent)}))}`];
  };

  const instanceAttrs = (node: NodeIR): string[] => {
    const attrs: string[] = [];
    for (const param of node.parameters) {
      if (param.value.kind === 'literal') attrs.push(jsxAttr(param.name, param.value.value));
    }
    for (const [toProperty, source] of Object.entries(plan.bindings[node.id] ?? {})) {
      const expr = bindingExpr(source);
      if (expr !== null) attrs.push(`${toProperty}={${expr}}`);
      else notes.push(`${plan.path}: wire into ${node.id}.${toProperty} has no statically known source — dropped, reported`);
    }
    return attrs;
  };

  const jsxLines = render(plan.rootId, 4);

  // ---- the module ------------------------------------------------------------------------
  const symbol = plan.file.symbol;
  const hasCss = classNames.length > 0;
  if (hasCss) {
    internalImports.set(`./${plan.file.fileBase}.module.css`, `import styles from './${plan.file.fileBase}.module.css';`);
  }

  const importLines: string[] = [];
  if (externalImports.length > 0) importLines.push(...externalImports.sort());
  const sortedInternal = [...internalImports.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, line]) => line);
  if (sortedInternal.length > 0) {
    if (importLines.length > 0) importLines.push('');
    importLines.push(...sortedInternal);
  }

  const body: string[] = [];
  if (plan.props.length > 0) {
    body.push(`export interface ${symbol}Props {`);
    for (const prop of plan.props) body.push(`  ${prop.name}?: ${prop.tsType};`);
    body.push('}', '');
  }
  if (plan.docComment) {
    body.push(`/** ${plan.docComment}${/[.!?]$/.test(plan.docComment) ? '' : '.'} */`);
  }
  const signature =
    plan.props.length > 0
      ? `export function ${symbol}({ ${plan.props.map((p) => p.name).join(', ')} }: ${symbol}Props) {`
      : `export function ${symbol}() {`;
  body.push(signature);
  if (usesNavigate) body.push('  const navigate = useNavigate();');
  for (const query of plan.queries) {
    body.push(`  const [${query.stateName}, ${query.setterName}] = useState<${query.typeName}[]>([]);`);
  }
  if (usesNavigate || plan.queries.length > 0) body.push('');
  for (const query of plan.queries) {
    body.push('  useEffect(() => {', `    ${query.fetchName}().then(${query.setterName});`, '  }, []);', '');
  }
  body.push('  return (', ...jsxLines, '  );', '}');

  const tsx = GENERATED_TS + importLines.join('\n') + '\n\n' + body.join('\n') + '\n';

  const files: Record<string, string> = {};
  const baseDir = `src/${plan.file.dir}`;
  files[`${baseDir}/${plan.file.fileBase}.tsx`] = tsx;
  if (hasCss) {
    const cssBlocks = groups.map((group, i) => {
      const decls = styleOf.get(group.nodeIds[0])!;
      return `.${classNames[i]} {\n${decls.map((d) => `  ${d.prop}: ${d.value};`).join('\n')}\n}`;
    });
    files[`${baseDir}/${plan.file.fileBase}.module.css`] = GENERATED_CSS + '\n' + cssBlocks.join('\n\n') + '\n';
  }

  return { files, notes };
}

/** Pre-order walk of the render tree, root first — CSS class order and naming order. */
function preOrder(plan: ComponentPlan): string[] {
  if (!plan.rootId) return [];
  const out: string[] = [];
  const visit = (id: string) => {
    out.push(id);
    for (const child of plan.childrenOf[id] ?? []) visit(child);
  };
  visit(plan.rootId);
  return out;
}

function isStyledRole(role: string | undefined): boolean {
  return role !== undefined && role !== 'instance' && role !== 'repeater';
}

/**
 * Renders one JSX element. Text-only elements inline when they fit the print width; containers
 * with element children always break; attribute lists that overflow put each attribute on its
 * own line (the emitted text is Prettier-shaped without Prettier — the AST pipeline is a later
 * refactor the golden tests protect).
 */
function element(
  tag: string,
  attrs: string[],
  children: string[] | string | null,
  indent: number,
  isContainer: boolean
): string[] {
  const open = `${pad(indent)}<${tag}${attrs.map((a) => ` ${a}`).join('')}`;

  if (children === null) {
    const inline = `${open} />`;
    if (inline.length <= PRINT_WIDTH) return [inline];
    return [...wrapAttrs(tag, attrs, indent), `${pad(indent)}/>`];
  }

  if (typeof children === 'string') {
    const inline = `${open}>${children}</${tag}>`;
    if (!isContainer && inline.length <= PRINT_WIDTH) return [inline];
    const openLines = `${open}>`.length <= PRINT_WIDTH ? [`${open}>`] : [...wrapAttrs(tag, attrs, indent), `${pad(indent)}>`];
    return [...openLines, ...wrapText(children, indent + 2), `${pad(indent)}</${tag}>`];
  }

  const openLines = `${open}>`.length <= PRINT_WIDTH ? [`${open}>`] : [...wrapAttrs(tag, attrs, indent), `${pad(indent)}>`];
  return [...openLines, ...children, `${pad(indent)}</${tag}>`];
}

function wrapAttrs(tag: string, attrs: string[], indent: number): string[] {
  return [`${pad(indent)}<${tag}`, ...attrs.map((a) => `${pad(indent + 2)}${a}`)];
}

/** Greedy word wrap for long static text children, at the print width. */
function wrapText(text: string, indent: number): string[] {
  // Interpolations and escaped text never wrap — only plain prose does.
  if (text.startsWith('{')) return [`${pad(indent)}${text}`];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = pad(indent);
  for (const word of words) {
    const candidate = current === pad(indent) ? `${current}${word}` : `${current} ${word}`;
    if (candidate.length > PRINT_WIDTH && current !== pad(indent)) {
      lines.push(current);
      current = `${pad(indent)}${word}`;
    } else {
      current = candidate;
    }
  }
  if (current.trim().length > 0) lines.push(current);
  return lines;
}

function jsxAttr(name: string, value: string | number | boolean): string {
  if (typeof value === 'string') {
    return value.includes('"') ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
  }
  if (typeof value === 'boolean') return value ? name : `${name}={false}`;
  return `${name}={${value}}`;
}

/** JSX text children: plain prose passes through; anything JSX-significant becomes a string literal. */
function jsxText(text: string): string {
  if (/[{}<>]/.test(text)) return `{${JSON.stringify(text)}}`;
  return text;
}

function memberExpr(object: string, field: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field) ? `${object}.${field}` : `${object}[${JSON.stringify(field)}]`;
}

function pad(indent: number): string {
  return ' '.repeat(indent);
}
