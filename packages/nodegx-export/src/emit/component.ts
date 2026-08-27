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
import { BindingSource, ComponentPlan, HandlerAction, ProjectPlan, QueryPlan, ValueExpr } from '../analyze/plan';
import { ExportIR, NodeIR } from '../ir/types';
import { assignClassNames, ClassCandidate, partitionMergeGroup, pascalCase } from './naming';
import { tsLiteral } from './state';
import { computeNodeStyle, computeRoleCss, CONTENT_ATTR_ORDER, CONTENT_PARAMS, Decl, iconSourceOf, RoleCss, StyleRole } from './style';

const GENERATED_TS = '// @nodegx:generated (visual — provenance markers complete in EXP-007)\n';
const GENERATED_CSS = '/* @nodegx:generated (visual) */\n';
const PRINT_WIDTH = 100;

/** A bare reference (`name`, `visitorName.get()`) that negates without parentheses. */
const SIMPLE_REF = /^[A-Za-z_$][A-Za-z0-9_$.]*(\(\))?$/;

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
  input: 'input',
  columns: 'div',
  radiogroup: 'div',
  checkbox: 'input',
  radio: 'input',
  range: 'input',
  select: 'select',
  video: 'video',
  circle: 'svg'
};

/**
 * The control roles' `Changed` signal output is the DOM change event — same trigger machinery
 * as onClick, scoped per role so a value-carrying output on some other node never matches.
 */
const ROLE_EVENT_ATTRS: Partial<Record<string, Record<string, string>>> = {
  checkbox: { onChange: 'onChange' },
  radio: { onChange: 'onChange' },
  select: { onChange: 'onChange' },
  range: { onChange: 'onChange' }
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
  const roleCssOf = new Map<string, RoleCss>();
  for (const id of styledIds) {
    const node = nodeById.get(id)!;
    const role = plan.roleOf[id] as StyleRole;
    const style = computeNodeStyle(node, role, catalog);
    for (const name of style.unhandled) {
      notes.push(`${plan.path}: parameter ${name} on ${id} has no style/content mapping — dropped, reported`);
    }
    for (const note of style.notes) notes.push(`${plan.path}: node ${id}: ${note}`);
    const roleCss = computeRoleCss(node, role, catalog);
    for (const note of roleCss.notes) notes.push(`${plan.path}: ${note}`);
    roleCssOf.set(id, roleCss);
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
  // nodes keeps separate classes. Empty sets get no class. Role CSS (marks, wrappers, container
  // queries) is part of a class's identity, so nodes merge only when that matches too.
  const byDeclsKey = new Map<string, string[]>();
  for (const id of styledIds) {
    const decls = styleOf.get(id)!;
    const roleCss = roleCssOf.get(id)!;
    if (decls.length === 0 && roleCss.blocks.length === 0 && !roleCss.wrapper && roleCss.containerQueries.length === 0) {
      continue;
    }
    const key = JSON.stringify([decls, roleCss.blocks, roleCss.wrapper ?? null, roleCss.containerQueries]);
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

  // Companion classes (a control's label wrapper, a columns node's query container) name after
  // the class they accompany, deduplicated against every assigned name.
  const usedClassNames = new Set(classNames);
  const wrapperNames = new Map<number, string>();
  groups.forEach((group, i) => {
    const wrapper = roleCssOf.get(group.nodeIds[0])?.wrapper;
    if (!wrapper) return;
    const base = `${classNames[i]}${wrapper.role === 'label' ? 'Label' : 'Container'}`;
    let name = base;
    let counter = 2;
    while (usedClassNames.has(name)) name = `${base}${counter++}`;
    usedClassNames.add(name);
    wrapperNames.set(i, name);
  });
  const wrapperClassOf = (id: string): string | undefined => {
    const index = classIndexOf.get(id);
    return index === undefined ? undefined : wrapperNames.get(index);
  };

  // ---- app state usage (step 5) ----------------------------------------------------------
  // Which variables and channels this component touches, and how: a render binding earns a
  // useValue hook; a handler read is a `.get()` snapshot; a receiver earns useSignal. Collected
  // up front because the import list and the reserved-identifier set depend on it.
  const variableByName = new Map(project.variables.map((v) => [v.name, v]));
  const channelByName = new Map(project.channels.map((c) => [c.name, c]));
  const storeByName = new Map(project.stores.map((s) => [s.name, s]));
  const collectionByName = new Map(project.collections.map((c) => [c.name, c]));
  const usedVariableNames = new Set<string>();
  const usedChannelNames = new Set<string>();
  const usedStoreNames = new Set<string>();
  const usedCollectionNames = new Set<string>();
  const collectExprUse = (expr: ValueExpr) => {
    if (expr.kind === 'store-get') usedVariableNames.add(expr.variableName);
    if (expr.kind === 'store-key-get') usedStoreNames.add(expr.storeName);
    if (expr.kind === 'format') {
      for (const part of expr.parts) if (typeof part !== 'string') collectExprUse(part);
    }
    if (expr.kind === 'logical') expr.operands.forEach(collectExprUse);
    if (expr.kind === 'not' || expr.kind === 'truthy') collectExprUse(expr.operand);
  };
  const collectActionUse = (action: HandlerAction) => {
    if (action.kind === 'emit') {
      usedChannelNames.add(action.channelName);
      action.payload.forEach((p) => collectExprUse(p.expr));
    }
    if (action.kind === 'store-set') {
      usedVariableNames.add(action.variableName);
      collectExprUse(action.expr);
    }
    if (action.kind === 'globalstore-set') {
      usedStoreNames.add(action.storeName);
      collectExprUse(action.expr);
    }
    if (action.kind === 'collection-add') {
      usedCollectionNames.add(action.collectionName);
      action.entries.forEach((e) => collectExprUse(e.expr));
    }
    if (action.kind === 'branch') {
      collectExprUse(action.cond);
      action.whenTrue.forEach(collectActionUse);
      action.whenFalse.forEach(collectActionUse);
    }
  };
  const allActions: HandlerAction[] = [
    ...Object.values(plan.handlers).flatMap((byPort) => Object.values(byPort).flat()),
    ...Object.values(plan.changeHandlers).flat(),
    ...plan.receivers.flatMap((r) => r.actions)
  ];
  allActions.forEach(collectActionUse);
  for (const receiver of plan.receivers) usedChannelNames.add(receiver.channelName);

  // Render bindings needing hooks, in pre-order encounter order. A computed binding earns the
  // hooks of every source its expression tree reads, in part order.
  const hookVariables: string[] = [];
  const hookStoreKeys: Array<{ storeName: string; key: string }> = [];
  const hookCollections: string[] = [];
  const hookExprSources = (expr: ValueExpr) => {
    if (expr.kind === 'store-get' && !hookVariables.includes(expr.variableName)) {
      hookVariables.push(expr.variableName);
      usedVariableNames.add(expr.variableName);
    }
    if (
      expr.kind === 'store-key-get' &&
      !hookStoreKeys.some((h) => h.storeName === expr.storeName && h.key === expr.key)
    ) {
      hookStoreKeys.push({ storeName: expr.storeName, key: expr.key });
      usedStoreNames.add(expr.storeName);
    }
    if (expr.kind === 'format') {
      for (const part of expr.parts) if (typeof part !== 'string') hookExprSources(part);
    }
    if (expr.kind === 'logical') expr.operands.forEach(hookExprSources);
    if (expr.kind === 'not' || expr.kind === 'truthy') hookExprSources(expr.operand);
  };
  for (const id of preOrder(plan)) {
    for (const source of Object.values(plan.bindings[id] ?? {})) {
      if (source.kind === 'store' && !hookVariables.includes(source.variableName)) {
        hookVariables.push(source.variableName);
        usedVariableNames.add(source.variableName);
      }
      if (
        source.kind === 'store-key' &&
        !hookStoreKeys.some((h) => h.storeName === source.storeName && h.key === source.key)
      ) {
        hookStoreKeys.push({ storeName: source.storeName, key: source.key });
        usedStoreNames.add(source.storeName);
      }
      if (source.kind === 'computed') hookExprSources(source.expr);
    }
    if (plan.roleOf[id] === 'repeater') {
      const collectionName = plan.repeaters[id]?.itemsCollectionName;
      if (collectionName != null && collectionByName.has(collectionName) && !hookCollections.includes(collectionName)) {
        hookCollections.push(collectionName);
        usedCollectionNames.add(collectionName);
      }
    }
  }

  const usesNavigate = allActions.some((a) => a.kind === 'navigate');

  // The hook's local name is the variable's last camelCase word (`visitorName` → `name`),
  // deduplicated against everything else in scope, falling back to `<export>Value`.
  const reserved = new Set<string>(['event', 'navigate', 'payload', 'styles', plan.file.symbol]);
  plan.props.forEach((p) => reserved.add(p.name));
  plan.queries.forEach((q) => {
    [q.stateName, q.setterName, q.itemName, q.fetchName, q.typeName].forEach((n) => reserved.add(n));
  });
  for (const name of usedVariableNames) reserved.add(variableByName.get(name)!.exportName);
  for (const name of usedChannelNames) reserved.add(channelByName.get(name)!.exportName);
  for (const name of usedStoreNames) reserved.add(storeByName.get(name)!.exportName);
  for (const name of usedCollectionNames) reserved.add(collectionByName.get(name)!.exportName);
  const hookLocals = new Map<string, string>();
  for (const variableName of hookVariables) {
    const exportName = variableByName.get(variableName)!.exportName;
    const words = exportName.split(/(?=[A-Z])/).filter((w) => w.length > 0);
    let candidate = words[words.length - 1].charAt(0).toLowerCase() + words[words.length - 1].slice(1);
    if (reserved.has(candidate)) candidate = `${exportName}Value`;
    let counter = 2;
    while (reserved.has(candidate)) candidate = `${exportName}Value${counter++}`;
    reserved.add(candidate);
    hookLocals.set(variableName, candidate);
  }
  // A store-key hook's local is the key itself — it is what the author named the thing —
  // falling back to `<exportName><PascalKey>` when the key is not usable or already taken.
  const storeKeyLocals = new Map<string, string>();
  const storeKeyId = (storeName: string, key: string) => `${storeName}\u0000${key}`;
  for (const { storeName, key } of hookStoreKeys) {
    const exportName = storeByName.get(storeName)!.exportName;
    let candidate = /^[a-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `${exportName}${pascalCase(key)}`;
    if (reserved.has(candidate)) candidate = `${exportName}${pascalCase(key)}`;
    let counter = 2;
    while (reserved.has(candidate)) candidate = `${exportName}${pascalCase(key)}${counter++}`;
    reserved.add(candidate);
    storeKeyLocals.set(storeKeyId(storeName, key), candidate);
  }
  // A collection hook's local is `<exportName>Items`; the map callback's locals are `item` and
  // `index`, all deduplicated against everything else in scope.
  const collectionLocals = new Map<string, string>();
  for (const collectionName of hookCollections) {
    const exportName = collectionByName.get(collectionName)!.exportName;
    let candidate = `${exportName}Items`;
    let counter = 2;
    while (reserved.has(candidate)) candidate = `${exportName}Items${counter++}`;
    reserved.add(candidate);
    collectionLocals.set(collectionName, candidate);
  }
  const dedupeLocal = (base: string): string => {
    let candidate = base;
    let counter = 2;
    while (reserved.has(candidate)) candidate = `${base}${counter++}`;
    reserved.add(candidate);
    return candidate;
  };
  const itemLocal = hookCollections.length > 0 ? dedupeLocal('item') : 'item';
  const indexLocal = hookCollections.length > 0 ? dedupeLocal('index') : 'index';

  // Rendered Radio Button Groups holding radios get an instance-scoped name via useId() — a
  // radio `name` is document-global, and two instances of one component must not join each
  // other's group (VISUALS-TARGET §3).
  const hasRadioDescendant = (id: string): boolean =>
    (plan.childrenOf[id] ?? []).some((child) => plan.roleOf[child] === 'radio' || hasRadioDescendant(child));
  const radioNameLocals = new Map<string, string>();
  for (const id of preOrder(plan)) {
    if (plan.roleOf[id] === 'radiogroup' && hasRadioDescendant(id)) {
      radioNameLocals.set(id, dedupeLocal(`${classOf(id) ?? 'radioGroup'}Id`));
    }
  }

  // ---- expression + handler statement rendering ------------------------------------------
  // One expression vocabulary, two modes (LOGIC-TARGET §1): in render an expression reads the
  // component's hook locals; in a handler it reads `.get()` snapshots.
  const templateText = (text: string): string =>
    text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  /**
   * Whether an expression can statically be undefined. A format placeholder substitutes the
   * runtime's `''` for an unset input; `String(undefined)` would print the word, so such parts
   * interpolate with `?? ''`.
   */
  const maybeUndefined = (expr: ValueExpr): boolean => {
    switch (expr.kind) {
      case 'prop':
        return true; // every emitted component prop is optional
      case 'store-get':
        return true; // variables boot undefined until their first write (state.ts)
      case 'store-key-get':
        return !(storeByName.get(expr.storeName)?.keys.find((k) => k.key === expr.key)?.required ?? false);
      case 'payload':
        return true; // payload keys are optional-typed
      case 'input-text':
      case 'literal':
      case 'format':
      case 'logical':
      case 'not':
      case 'truthy':
        return false;
    }
  };
  const exprCode = (expr: ValueExpr, mode: 'handler' | 'render'): string => {
    switch (expr.kind) {
      case 'prop':
        return expr.name;
      case 'input-text':
        return 'event.target.value';
      case 'store-get':
        return mode === 'render'
          ? (hookLocals.get(expr.variableName) ?? expr.variableName)
          : `${variableByName.get(expr.variableName)!.exportName}.get()`;
      case 'store-key-get':
        return mode === 'render'
          ? (storeKeyLocals.get(storeKeyId(expr.storeName, expr.key)) ?? expr.key)
          : memberExpr(`${storeByName.get(expr.storeName)!.exportName}.get()`, expr.key);
      case 'payload':
        return `payload.${expr.key}`;
      case 'literal':
        return tsLiteral(expr.value);
      case 'format':
        return (
          '`' +
          expr.parts
            .map((p) =>
              typeof p === 'string'
                ? templateText(p)
                : '${' + exprCode(p, mode) + (maybeUndefined(p) ? " ?? ''" : '') + '}'
            )
            .join('') +
          '`'
        );
      // The boolean kinds print their truthiness forms — analysis only lets them reach
      // truthiness positions (LOGIC-TARGET §5 headnote), so `a && b` never leaks an operand
      // value where the runtime's strict boolean would show.
      case 'logical':
        return expr.operands
          .map((o) => (o.kind === 'logical' ? `(${exprCode(o, mode)})` : exprCode(o, mode)))
          .join(expr.op === 'and' ? ' && ' : ' || ');
      case 'not': {
        const operand = exprCode(expr.operand, mode);
        return SIMPLE_REF.test(operand) ? `!${operand}` : `!(${operand})`;
      }
      case 'truthy':
        return exprCode(expr.operand, mode);
    }
  };
  const actionCode = (action: HandlerAction): string => {
    switch (action.kind) {
      case 'navigate':
        return `navigate('${action.to}')`;
      case 'store-set':
        return `${variableByName.get(action.variableName)!.exportName}.set(${exprCode(action.expr, 'handler')})`;
      case 'globalstore-set': {
        const store = storeByName.get(action.storeName)!;
        const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(action.key) ? action.key : JSON.stringify(action.key);
        return `${store.exportName}.set({ ${key}: ${exprCode(action.expr, 'handler')} })`;
      }
      case 'collection-add': {
        const collection = collectionByName.get(action.collectionName)!;
        const entries = action.entries
          .map(
            (e) =>
              `${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(e.key) ? e.key : JSON.stringify(e.key)}: ${exprCode(e.expr, 'handler')}`
          )
          .join(', ');
        return `${collection.exportName}.add({${entries.length > 0 ? ` ${entries} ` : ''}})`;
      }
      case 'emit': {
        const channel = channelByName.get(action.channelName)!;
        if (channel.payloadTypeName === null) return `${channel.exportName}.emit()`;
        const entries = action.payload.map((p) => `${p.key}: ${exprCode(p.expr, 'handler')}`).join(', ');
        return `${channel.exportName}.emit({${entries.length > 0 ? ` ${entries} ` : ''}})`;
      }
      case 'branch': {
        const armCode = (actions: HandlerAction[]): string =>
          actions.length === 1 ? actionCode(actions[0]) : `{ ${actions.map(actionCode).join('; ')}; }`;
        const cond = exprCode(action.cond, 'handler');
        if (action.whenTrue.length === 0) {
          const negated = SIMPLE_REF.test(cond) ? `!${cond}` : `!(${cond})`;
          return `if (${negated}) ${armCode(action.whenFalse)}`;
        }
        const test = `if (${cond}) ${armCode(action.whenTrue)}`;
        return action.whenFalse.length > 0 ? `${test}; else ${armCode(action.whenFalse)}` : test;
      }
    }
  };
  /**
   * A branch statement cannot be an arrow's expression body, and Prettier never leaves a
   * non-empty block on one line — so a handler containing one takes the multi-line block form,
   * indented at the attribute's own column.
   */
  const handlerArrow = (actions: HandlerAction[], param: string, indent: number): string => {
    const statements = actions.map(actionCode);
    if (actions.some((a) => a.kind === 'branch')) {
      const body = statements.map((s) => `${pad(indent + 2)}${s};`).join('\n');
      return `${param} => {\n${body}\n${pad(indent)}}`;
    }
    return statements.length === 1 ? `${param} => ${statements[0]}` : `${param} => { ${statements.join('; ')}; }`;
  };

  // ---- imports ---------------------------------------------------------------------------
  // Both src/pages and src/components sit one level below src/, where api/ lives.
  const relRoot = '..';
  const externalImports: string[] = [];
  const coreHooks: string[] = [];
  if (hookLocals.size > 0) coreHooks.push('useValue');
  if (storeKeyLocals.size > 0) coreHooks.push('useStore');
  if (collectionLocals.size > 0) coreHooks.push('useCollection');
  if (plan.receivers.length > 0) coreHooks.push('useSignal');
  if (coreHooks.length > 0) {
    externalImports.push(`import { ${coreHooks.sort().join(', ')} } from '@nodegx/core/react';`);
  }
  const reactImports: string[] = [];
  if (plan.queries.length > 0) reactImports.push('useEffect', 'useState');
  if (radioNameLocals.size > 0) reactImports.push('useId');
  if (reactImports.length > 0) externalImports.push(`import { ${reactImports.sort().join(', ')} } from 'react';`);
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
  if (usedVariableNames.size > 0) {
    const specifier = `${relRoot}/stores/variables`;
    const names = [...usedVariableNames].map((n) => variableByName.get(n)!.exportName).sort();
    internalImports.set(specifier, `import { ${names.join(', ')} } from '${specifier}';`);
  }
  for (const name of [...usedStoreNames].sort()) {
    const store = storeByName.get(name)!;
    const specifier = `${relRoot}/stores/${store.exportName}`;
    internalImports.set(specifier, `import { ${store.exportName} } from '${specifier}';`);
  }
  for (const name of [...usedCollectionNames].sort()) {
    const collection = collectionByName.get(name)!;
    const specifier = `${relRoot}/collections/${collection.exportName}`;
    internalImports.set(specifier, `import { ${collection.exportName} } from '${specifier}';`);
  }
  if (usedChannelNames.size > 0) {
    const specifier = `${relRoot}/events`;
    const names = [...usedChannelNames].map((n) => channelByName.get(n)!.exportName).sort();
    internalImports.set(specifier, `import { ${names.join(', ')} } from '${specifier}';`);
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
    if (source.kind === 'store') return hookLocals.get(source.variableName) ?? null;
    if (source.kind === 'store-key') return storeKeyLocals.get(storeKeyId(source.storeName, source.key)) ?? null;
    if (source.kind === 'computed') return exprCode(source.expr, 'render');
    return null;
  };

  const contentAttrs = (node: NodeIR): string[] => {
    const roles = CONTENT_PARAMS[node.type] ?? {};
    const attrs = new Map<string, string>();
    for (const param of node.parameters) {
      const role = roles[param.name];
      // The inverting role (LOGIC-TARGET §7): `enabled: false` is the bare `disabled`
      // attribute; `enabled: true` restates the default and emits nothing.
      if (role === 'attr-not:disabled') {
        if (param.value.kind === 'literal' && !param.value.value) attrs.set('disabled', 'disabled');
        continue;
      }
      if (!role?.startsWith('attr:')) continue;
      const attr = role.slice('attr:'.length);
      if (param.value.kind === 'literal') attrs.set(attr, jsxAttr(attr, param.value.value));
    }
    for (const [toProperty, source] of Object.entries(plan.bindings[node.id] ?? {})) {
      const role = roles[toProperty];
      if (role === 'attr-not:disabled') {
        const code = negatedBindingExpr(source);
        if (code === 'omit') continue; // folded to always-enabled
        if (code !== null) attrs.set('disabled', code === 'disabled' ? code : `disabled={${code}}`);
        else notes.push(`${plan.path}: wire into ${node.id}.${toProperty} has no statically known source — dropped, reported`);
        continue;
      }
      if (!role?.startsWith('attr:')) continue;
      const attr = role.slice('attr:'.length);
      const expr = bindingExpr(source);
      if (expr !== null) attrs.set(attr, `${attr}={${expr}}`);
      else notes.push(`${plan.path}: wire into ${node.id}.${toProperty} has no statically known source — dropped, reported`);
    }
    return CONTENT_ATTR_ORDER.filter((attr) => attrs.has(attr)).map((attr) => attrs.get(attr)!);
  };

  /**
   * `disabled` is the negation of the bound `enabled` (§7), simplified per shape: `!name` over
   * a plain read, `!(a && b)` over a logical, `!!x` over a negation (the double negation is the
   * honest form), and a folded literal is static — `disabled` bare, or omitted entirely.
   */
  const negatedBindingExpr = (source: BindingSource): string | null | 'omit' | 'disabled' => {
    if (source.kind === 'computed') {
      const expr = source.expr;
      if (expr.kind === 'literal') return Boolean(expr.value) ? 'omit' : 'disabled';
      if (expr.kind === 'not') {
        const operand = exprCode(expr.operand, 'render');
        return SIMPLE_REF.test(operand) ? `!!${operand}` : `!!(${operand})`;
      }
      if (expr.kind === 'logical') return `!(${exprCode(expr, 'render')})`;
    }
    const base = bindingExpr(source);
    if (base === null) return null;
    return SIMPLE_REF.test(base) ? `!${base}` : `!(${base})`;
  };

  const handlerAttrs = (node: NodeIR, attrIndent: number): string[] => {
    const attrs: string[] = [];
    const roleEvents = ROLE_EVENT_ATTRS[plan.roleOf[node.id]] ?? {};
    for (const [port, actions] of Object.entries(plan.handlers[node.id] ?? {})) {
      const eventAttr = roleEvents[port] ?? EVENT_ATTRS[port];
      if (!eventAttr) {
        notes.push(`${plan.path}: signal ${node.id}.${port} has no DOM event equivalent — dropped, reported`);
        continue;
      }
      attrs.push(`${eventAttr}={${handlerArrow(actions, '()', attrIndent)}}`);
    }
    return attrs;
  };

  /** The wired-onTextChanged rule: writes on change, and nothing else — the input stays native. */
  const changeAttrs = (node: NodeIR, attrIndent: number): string[] => {
    const actions = plan.changeHandlers[node.id];
    if (!actions || actions.length === 0) return [];
    return [`onChange={${handlerArrow(actions, '(event)', attrIndent)}}`];
  };

  const childText = (node: NodeIR, paramName: string): string | null => {
    const bound = plan.bindings[node.id]?.[paramName];
    if (bound) {
      // An all-static format folded to a literal reads as the plain text it is.
      if (bound.kind === 'computed' && bound.expr.kind === 'literal') return jsxText(String(bound.expr.value));
      const expr = bindingExpr(bound);
      if (expr !== null) return `{${expr}}`;
      notes.push(`${plan.path}: wire into ${node.id}.${paramName} has no statically known source — dropped, reported`);
    }
    const literal = node.parameters.find((p) => p.name === paramName)?.value;
    if (literal?.kind === 'literal') return jsxText(String(literal.value));
    return null;
  };

  /** Effective (authored-or-catalog-default) literal, for ports the runtime always applies. */
  const effectiveLiteral = (node: NodeIR, name: string): string | number | boolean | undefined => {
    const authored = node.parameters.find((p) => p.name === name)?.value;
    if (authored?.kind === 'literal') return authored.value;
    const def = node.catalogRef ? catalog.inputDefault(node.catalogRef, name) : undefined;
    return typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean' ? def : undefined;
  };

  const fontIconSetsNoted = new Set<string>();

  type RadioCtx = { name: string; selected?: string };

  const render = (id: string, indent: number, radioCtx?: RadioCtx): string[] => {
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
    const isControl = role === 'checkbox' || role === 'radio' || role === 'range' || role === 'select';
    if (role === 'image' || role === 'input' || role === 'button' || role === 'video' || isControl) {
      attrs.push(...contentAttrs(node));
    }
    if (role === 'input') attrs.push(...changeAttrs(node, indent + 2));
    attrs.push(...handlerAttrs(node, indent + 2));

    if (role === 'text') {
      return element(tag, attrs, childText(node, 'text'), indent, false);
    }
    if (role === 'button') {
      return element(tag, attrs, childText(node, 'label'), indent, false);
    }
    if (role === 'image' || role === 'input' || role === 'video') {
      return element(tag, attrs, null, indent, false);
    }
    if (role === 'icon') return renderIcon(node, attrs, className, indent);
    if (role === 'circle') return renderCircle(node, attrs, indent);
    if (role === 'checkbox' || role === 'radio') {
      const typeAttr = role === 'checkbox' ? 'type="checkbox"' : 'type="radio"';
      const inputAttrs = [...attrs];
      // className leads, then the input's type, then the group wiring, then content attrs.
      inputAttrs.splice(className ? 1 : 0, 0, typeAttr);
      if (role === 'radio' && radioCtx) {
        inputAttrs.splice((className ? 1 : 0) + 1, 0, `name={${radioCtx.name}}`);
        const value = node.parameters.find((p) => p.name === 'value')?.value;
        if (value?.kind === 'literal' && radioCtx.selected !== undefined && String(value.value) === radioCtx.selected) {
          inputAttrs.push('defaultChecked');
        }
      }
      const input = element('input', inputAttrs, null, indent, false);
      if (effectiveLiteral(node, 'useLabel') !== true) return input;
      const wrapperClass = wrapperClassOf(id);
      const labelAttrs = wrapperClass ? [`className={styles.${wrapperClass}}`] : [];
      const inner = element('input', inputAttrs, null, indent + 2, false);
      const text = childText(node, 'label') ?? jsxText(String(effectiveLiteral(node, 'label') ?? 'Label'));
      return element('label', labelAttrs, [...inner, ...wrapText(text, indent + 2)], indent, true);
    }
    if (role === 'range') {
      const rangeAttrs = [...attrs];
      rangeAttrs.splice(className ? 1 : 0, 0, 'type="range"');
      return element('input', rangeAttrs, null, indent, false);
    }
    if (role === 'select') return renderSelect(node, attrs, indent);
    if (role === 'columns') {
      const childIds = plan.childrenOf[id] ?? [];
      const wrapperClass = wrapperClassOf(id);
      const inner = indent + (wrapperClass ? 2 : 0);
      const blocks = childIds.map((childId) => render(childId, inner + 2, radioCtx)).flat();
      const grid = element(tag, attrs, blocks.length > 0 ? blocks : null, inner, true);
      if (!wrapperClass) return grid;
      return element('div', [`className={styles.${wrapperClass}}`], grid, indent, true);
    }
    if (role === 'radiogroup') {
      const nameLocal = radioNameLocals.get(id);
      const selected = node.parameters.find((p) => p.name === 'value')?.value;
      const ctx: RadioCtx | undefined = nameLocal
        ? { name: nameLocal, ...(selected?.kind === 'literal' ? { selected: String(selected.value) } : {}) }
        : radioCtx;
      const childIds = plan.childrenOf[id] ?? [];
      const blocks = childIds.map((childId) => render(childId, indent + 2, ctx)).flat();
      return element(tag, attrs, blocks.length > 0 ? blocks : null, indent, true);
    }

    // Containers: group / page.
    const childIds = plan.childrenOf[id] ?? [];
    const blocks = childIds.map((childId) => render(childId, indent + 2, radioCtx));
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
    const collection =
      repeater?.itemsCollectionName != null ? collectionByName.get(repeater.itemsCollectionName) : undefined;
    const target = requireInstance(repeater?.templatePath ?? null, `For Each ${node.id}`);
    const templatePlan = repeater?.templatePath ? project.byLegacyPath.get(repeater.templatePath) : undefined;
    if (!repeater || (!query && !collection) || !target || repeater.mapping === null) {
      const reason = !repeater?.templatePath
        ? 'no template component'
        : repeater.mapping === null
          ? 'dynamic mapping script'
          : !query && !collection
            ? 'items are not fed by a query or a named array'
            : 'unresolvable template';
      notes.push(`${plan.path}: For Each ${node.id} deferred to EXP-003 (${reason})`);
      return [`${pad(indent)}{/* TODO(export): For Each ${node.id} deferred to EXP-003 (${reason}) */}`];
    }
    // 'template-inputs' is the no-script case: the runtime identity-maps item properties onto
    // same-named component inputs by itself (foreach.tsx), so the template's props are the map.
    const mapping =
      repeater.mapping === 'template-inputs'
        ? (templatePlan?.props ?? []).map((p) => ({ input: p.name, field: p.name }))
        : repeater.mapping;
    // Restrict to fields the item type actually carries — the runtime feeds undefined outside
    // them (which the empty-value contract never delivers), and the emitted type has no key.
    const allowedFields = collection
      ? new Set(collection.keys.map((k) => k.key))
      : new Set(['id', ...(ir.project.collections.find((c) => c.name === query!.collectionName)?.columns ?? []).map((c) => c.name)]);
    const kept = mapping.filter((entry) => allowedFields.has(entry.field));
    for (const dropped of mapping.filter((entry) => !allowedFields.has(entry.field))) {
      notes.push(
        `${plan.path}: For Each ${node.id} maps "${dropped.input}" from field "${dropped.field}", which no statically-known item carries — dropped, reported`
      );
    }
    if (collection) {
      const attrs = [
        `key={${indexLocal}}`,
        ...kept.map(({ input, field }) => `${input}={${memberExpr(itemLocal, field)}}`)
      ];
      const lines = element(target.symbol, attrs, null, indent + 2, false);
      const local = collectionLocals.get(collection.name)!;
      return [`${pad(indent)}{${local}.map((${itemLocal}, ${indexLocal}) => (`, ...lines, `${pad(indent)}))}`];
    }
    const item = query!.itemName;
    const attrs = [`key={${item}.id}`, ...kept.map(({ input, field }) => `${input}={${memberExpr(item, field)}}`)];
    const lines = element(target.symbol, attrs, null, indent + 2, false);
    return [`${pad(indent)}{${query!.stateName}.map((${item}) => (`, ...lines, `${pad(indent)}))}`];
  };

  const renderIcon = (node: NodeIR, attrs: string[], className: string | undefined, indent: number): string[] => {
    const source = iconSourceOf(node, catalog);
    if (source.kind === 'image') {
      return element('img', [...attrs, jsxAttr('src', source.src), 'alt=""'], null, indent, false);
    }
    if (source.kind === 'sprite') {
      const use = [`${pad(indent + 2)}<use href="${source.url}#${source.symbolId}" />`];
      return element('svg', attrs, use, indent, true);
    }
    if (source.kind === 'font') {
      if (source.classes.length > 0 && !fontIconSetsNoted.has(source.classes[0])) {
        fontIconSetsNoted.add(source.classes[0]);
        notes.push(
          `${plan.path}: font icon set "${source.classes[0]}" needs its stylesheet shipped with the app — the export does not bundle icon set modules`
        );
      }
      const setClasses = source.classes.join(' ');
      const spanAttrs =
        className && setClasses.length > 0
          ? ['className={`${styles.' + className + '} ' + setClasses + '`}', ...attrs.slice(1)]
          : setClasses.length > 0 && !className
            ? [`className="${setClasses}"`, ...attrs]
            : attrs;
      return element('span', spanAttrs, source.text !== undefined ? jsxText(source.text) : null, indent, false);
    }
    // No source: the runtime draws an empty box that still takes its size in layout.
    return element('span', attrs, null, indent, false);
  };

  const renderSelect = (node: NodeIR, attrs: string[], indent: number): string[] => {
    const items = node.parameters.find((p) => p.name === 'items')?.value;
    const placeholder = node.parameters.find((p) => p.name === 'placeholder')?.value;
    const selectAttrs = [...attrs];
    const children: string[] = [];
    if (placeholder?.kind === 'literal' && String(placeholder.value).length > 0) {
      // The native spelling of the runtime's placeholder overlay: a hidden disabled option,
      // selected by default unless the author picked a value.
      if (!selectAttrs.some((a) => a.startsWith('defaultValue'))) selectAttrs.push('defaultValue=""');
      children.push(
        ...element('option', ['value=""', 'disabled', 'hidden'], jsxText(String(placeholder.value)), indent + 2, false)
      );
    }
    if (items?.kind === 'json' && Array.isArray(items.value)) {
      for (const item of items.value as Array<{ Label?: unknown; Value?: unknown; Disabled?: unknown }>) {
        if (typeof item !== 'object' || item === null) continue;
        const value = item.Value !== undefined ? String(item.Value) : '';
        const label = item.Label !== undefined ? String(item.Label) : value;
        const optionAttrs = [jsxAttr('value', value)];
        if (item.Disabled === true || item.Disabled === 'true') optionAttrs.push('disabled');
        children.push(...element('option', optionAttrs, jsxText(label), indent + 2, false));
      }
    }
    return element('select', selectAttrs, children.length > 0 ? children : null, indent, true);
  };

  // Circle: every shape port is static, so the arc paths the runtime computes per render are
  // computed once here — same math, same inside-stroke radius trick (Circle.tsx).
  const renderCircle = (node: NodeIR, attrs: string[], indent: number): string[] => {
    const eff = (name: string) => effectiveLiteral(node, name);
    const size = Number(eff('size') ?? 100) || 0;
    const startAngle = Number(eff('startAngle') ?? 0);
    const endAngle = Number(eff('endAngle') ?? 360);
    const r = size / 2;
    const children: string[] = [];
    if (eff('fillEnabled') !== false) {
      const d = filledArcPath(r, r, r, startAngle, endAngle);
      children.push(
        ...element('path', [`d="${d}"`, jsxAttr('fill', String(eff('fillColor') ?? 'red'))], null, indent + 2, false)
      );
    }
    if (eff('strokeEnabled') === true) {
      const strokeWidth = Number(eff('strokeWidth') ?? 10);
      const d = arcPath(r, r, r - strokeWidth / 2, startAngle, endAngle);
      children.push(
        ...element(
          'path',
          [
            `d="${d}"`,
            jsxAttr('stroke', String(eff('strokeColor') ?? 'black')),
            jsxAttr('strokeWidth', strokeWidth),
            'fill="transparent"',
            jsxAttr('strokeLinecap', String(eff('strokeLineCap') ?? 'butt'))
          ],
          null,
          indent + 2,
          false
        )
      );
    }
    const svgAttrs = [...attrs, jsxAttr('width', size), jsxAttr('height', size), 'xmlns="http://www.w3.org/2000/svg"'];
    return element('svg', svgAttrs, children.length > 0 ? children : null, indent, true);
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
  for (const variableName of hookVariables) {
    body.push(`  const ${hookLocals.get(variableName)} = useValue(${variableByName.get(variableName)!.exportName});`);
  }
  for (const { storeName, key } of hookStoreKeys) {
    const store = storeByName.get(storeName)!;
    const selector = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `s.${key}` : `s[${JSON.stringify(key)}]`;
    body.push(`  const ${storeKeyLocals.get(storeKeyId(storeName, key))} = useStore(${store.exportName}, (s) => ${selector});`);
  }
  for (const collectionName of hookCollections) {
    const collection = collectionByName.get(collectionName)!;
    body.push(`  const ${collectionLocals.get(collectionName)} = useCollection(${collection.exportName});`);
  }
  for (const local of radioNameLocals.values()) {
    body.push(`  const ${local} = useId();`);
  }
  for (const query of plan.queries) {
    body.push(`  const [${query.stateName}, ${query.setterName}] = useState<${query.typeName}[]>([]);`);
  }
  if (
    usesNavigate ||
    hookVariables.length > 0 ||
    hookStoreKeys.length > 0 ||
    hookCollections.length > 0 ||
    radioNameLocals.size > 0 ||
    plan.queries.length > 0
  ) {
    body.push('');
  }
  for (const query of plan.queries) {
    body.push('  useEffect(() => {', `    ${query.fetchName}().then(${query.setterName});`, '  }, []);', '');
  }
  const actionExprsOf = (a: HandlerAction): ValueExpr[] => {
    switch (a.kind) {
      case 'emit':
        return a.payload.map((p) => p.expr);
      case 'store-set':
      case 'globalstore-set':
        return [a.expr];
      case 'collection-add':
        return a.entries.map((e) => e.expr);
      case 'branch':
        return [a.cond, ...a.whenTrue.flatMap(actionExprsOf), ...a.whenFalse.flatMap(actionExprsOf)];
      case 'navigate':
        return [];
    }
  };
  const containsPayload = (e: ValueExpr): boolean =>
    e.kind === 'payload' ||
    (e.kind === 'format' && e.parts.some((p) => typeof p !== 'string' && containsPayload(p))) ||
    (e.kind === 'logical' && e.operands.some(containsPayload)) ||
    ((e.kind === 'not' || e.kind === 'truthy') && containsPayload(e.operand));
  for (const receiver of plan.receivers) {
    const channel = channelByName.get(receiver.channelName)!;
    const usesPayload = receiver.actions.some((a) => actionExprsOf(a).some(containsPayload));
    body.push(`  useSignal(${channel.exportName}, ${usesPayload ? '(payload)' : '()'} => {`);
    for (const action of receiver.actions) body.push(`    ${actionCode(action)};`);
    body.push('  });', '');
  }
  body.push('  return (', ...jsxLines, '  );', '}');

  const tsx = GENERATED_TS + importLines.join('\n') + '\n\n' + body.join('\n') + '\n';

  const files: Record<string, string> = {};
  const baseDir = `src/${plan.file.dir}`;
  files[`${baseDir}/${plan.file.fileBase}.tsx`] = tsx;
  if (hasCss) {
    const printDecls = (decls: Decl[], indent: string) => decls.map((d) => `${indent}${d.prop}: ${d.value};`).join('\n');
    const cssBlocks = groups.flatMap((group, i) => {
      const decls = styleOf.get(group.nodeIds[0])!;
      const roleCss = roleCssOf.get(group.nodeIds[0])!;
      const blocks: string[] = [];
      if (decls.length > 0) blocks.push(`.${classNames[i]} {\n${printDecls(decls, '  ')}\n}`);
      for (const block of roleCss.blocks) {
        blocks.push(`.${classNames[i]}${block.suffix} {\n${printDecls(block.decls, '  ')}\n}`);
      }
      const wrapperName = wrapperNames.get(i);
      if (roleCss.wrapper && wrapperName !== undefined) {
        blocks.push(`.${wrapperName} {\n${printDecls(roleCss.wrapper.decls, '  ')}\n}`);
      }
      for (const query of roleCss.containerQueries) {
        blocks.push(
          `@container (max-width: ${query.maxWidth}) {\n  .${classNames[i]} {\n${printDecls(query.decls, '    ')}\n  }\n}`
        );
      }
      return blocks;
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
  // A multi-line attribute (a block-form handler) carries its own absolute indentation, which
  // only lines up in the one-attribute-per-line form.
  const mustWrap = attrs.some((a) => a.includes('\n'));

  if (children === null) {
    const inline = `${open} />`;
    if (!mustWrap && inline.length <= PRINT_WIDTH) return [inline];
    return [...wrapAttrs(tag, attrs, indent), `${pad(indent)}/>`];
  }

  if (typeof children === 'string') {
    const inline = `${open}>${children}</${tag}>`;
    if (!mustWrap && !isContainer && inline.length <= PRINT_WIDTH) return [inline];
    const openLines =
      !mustWrap && `${open}>`.length <= PRINT_WIDTH ? [`${open}>`] : [...wrapAttrs(tag, attrs, indent), `${pad(indent)}>`];
    return [...openLines, ...wrapText(children, indent + 2), `${pad(indent)}</${tag}>`];
  }

  const openLines =
    !mustWrap && `${open}>`.length <= PRINT_WIDTH ? [`${open}>`] : [...wrapAttrs(tag, attrs, indent), `${pad(indent)}>`];
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

// ---- Circle's arc math (Circle.tsx, verbatim semantics) -----------------------------------
// A full circle nudges the end angle by the runtime's own epsilon so the arc does not collapse;
// coordinates print with at most 4 decimals so that nudge survives, deterministically.

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function svgNumber(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function arcEndpoints(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  if (endAngle % 360 === startAngle % 360) endAngle -= 0.0001;
  return {
    start: polarToCartesian(x, y, radius, endAngle),
    end: polarToCartesian(x, y, radius, startAngle),
    sweep: endAngle - startAngle <= 180 ? '0' : '1'
  };
}

function arcPath(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const { start, end, sweep } = arcEndpoints(x, y, radius, startAngle, endAngle);
  return [
    'M', svgNumber(start.x), svgNumber(start.y),
    'A', svgNumber(radius), svgNumber(radius), '0', sweep, '0', svgNumber(end.x), svgNumber(end.y)
  ].join(' ');
}

function filledArcPath(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const { start, sweep } = arcEndpoints(x, y, radius, startAngle, endAngle);
  return [
    arcPath(x, y, radius, startAngle, endAngle),
    'L', svgNumber(x), svgNumber(y),
    'L', svgNumber(start.x), svgNumber(start.y)
  ].join(' ');
}
