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
import {
  BindingSource,
  ComponentPlan,
  HandlerAction,
  JsFunctionPlan,
  RefusedScriptPlan,
  MutationPlan,
  ProjectPlan,
  QueryPlan,
  ValueExpr
} from '../analyze/plan';
import { ExportIR, NodeIR } from '../ir/types';
import { KitBinding, tsTypeOf as kitPortTsType } from './kits';
import { assignClassNames, ClassCandidate, partitionMergeGroup, pascalCase, propIdentifier, propIdentifiers } from './naming';
import { tsLiteral } from './state';
import { computeNodeStyle, computeRoleCss, CONTENT_ATTR_ORDER, CONTENT_PARAMS, Decl, iconSourceOf, RoleCss, StyleRole } from './style';

const GENERATED_TS = '// @nodegx:generated (visual — provenance markers complete in EXP-007)\n';
const GENERATED_CSS = '/* @nodegx:generated (visual) */\n';
const PRINT_WIDTH = 100;

/** A bare reference (`name`, `visitorName.get()`) that negates without parentheses. */
const SIMPLE_REF = /^[A-Za-z_$][A-Za-z0-9_$.]*(\(\))?$/;
/**
 * The `useSession()` render local (USER-FAMILY-TARGET §4c). One per component whatever the graph
 * reads off it, and reserved so no hook local can take the name out from under it.
 */
const SESSION_LOCAL = 'session';

/** EXP-011 Tier 2.5 — `useParams()`, this page's matched path segments. */
const PAGE_PARAMS_LOCAL = 'pageParams';

/** EXP-011 Tier 2.5 — the `URLSearchParams` half of `useSearchParams()`. */
const PAGE_QUERY_LOCAL = 'pageQuery';

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
  /**
   * `src/lib/date.ts` helpers this component imports (EXP-011 Tier 1.3), or an empty set.
   *
   * 🔴 Reported from **here** rather than derived from the plan, and the difference is the
   * dead-module trap one construct over: `resolveExpr` runs speculatively, so a plan-side flag
   * would be set by a date read a later pass then dropped, and the app would ship a `lib/date.ts`
   * no line imports. This set is filled by the same walkers that write the import line, so the
   * module exists exactly when something names it.
   */
  dateHelpers: Set<string>;
}

export function emitComponent(
  plan: ComponentPlan,
  project: ProjectPlan,
  ir: ExportIR,
  catalog: CatalogIndex,
  /**
   * EXP-010. Node type → the generated wrapper the pages render it through. Empty when the project
   * has no kit nodes; a type that is *missing* from a non-empty map is a node whose kit failed to
   * load, and it emits a named marker rather than nothing.
   */
  kitBindings: Map<string, KitBinding> = new Map()
): EmittedComponent | null {
  if (!plan.file || !plan.rootId) return null;
  const component = ir.components.find((c) => c.path === plan.path)!;
  const nodeById = new Map(component.nodes.map((n) => [n.id, n]));
  const notes: string[] = [];

  // ---- styles + class names --------------------------------------------------------------
  const styledIds = preOrder(plan).filter((id) => isStyledRole(plan.roleOf[id]));
  const styleOf = new Map<string, Decl[]>();
  const roleCssOf = new Map<string, RoleCss>();
  /**
   * Authored parameters with no style or content mapping, held until the marker channel exists.
   *
   * This runs above `defer`'s declaration, and `defer` is a `const` — calling it from here is a
   * temporal dead zone throw, not a forward reference. Collected as data and seeded once the
   * helpers are in scope.
   */
  const unmappedParams: Array<{ id: string; name: string }> = [];
  for (const id of styledIds) {
    const node = nodeById.get(id)!;
    const role = plan.roleOf[id] as StyleRole;
    const style = computeNodeStyle(node, role, catalog);
    for (const name of style.unhandled) {
      if (name === 'visible' || name === 'mounted') continue; // §4b: handled by the render wrap / class toggle
      notes.push(`${plan.path}: parameter ${name} on ${id} has no style/content mapping — dropped, reported`);
      unmappedParams.push({ id, name });
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
        if (name === 'visible' || name === 'mounted') continue;
        notes.push(`${plan.path}: parameter ${name} on ${plan.collapsedGroupId} has no style/content mapping — dropped, reported`);
        // The collapsed Group's parameter is the *page div's* loss — `id` is the element that renders.
        unmappedParams.push({ id, name });
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
  // The popup overlay class (POPUPS-TARGET §5) — the runtime's wrapper group, spelled in CSS.
  let popupLayerClass: string | undefined;
  if (plan.popups.length > 0) {
    let name = 'popupLayer';
    let counter = 2;
    while (usedClassNames.has(name)) name = `popupLayer${counter++}`;
    usedClassNames.add(name);
    popupLayerClass = name;
  }
  // The visible sink's shared rule (CONTROLLED-STATE §4b): hidden but keeping layout space —
  // the runtime's `visibility: hidden` mutation, spelled as one class per module.
  const visibleLiteralFalse = (id: string): boolean => {
    const v = nodeById.get(id)?.parameters.find((p) => p.name === 'visible')?.value;
    return v?.kind === 'literal' && v.value === false;
  };
  let hiddenKeepSpaceClass: string | undefined;
  if (
    preOrder(plan).some(
      (id) => isStyledRole(plan.roleOf[id]) && (plan.bindings[id]?.['visible'] !== undefined || visibleLiteralFalse(id))
    )
  ) {
    let name = 'hiddenKeepSpace';
    let counter = 2;
    while (usedClassNames.has(name)) name = `hiddenKeepSpace${counter++}`;
    usedClassNames.add(name);
    hiddenKeepSpaceClass = name;
  }

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
  /** Which `src/lib/date.ts` helpers this component calls — the import list (EXP-011 Tier 1.3). */
  const usedDateHelpers = new Set<string>();
  // Re-host wrappers (EXP-003 §4): only definitions that surviving expressions/actions
  // reference print — the plan registers every resolved definition, referenced or not.
  const jsFunByNode = plan.jsFunctions;
  const referencedJsIds = new Set<string>();
  // State rows print only when something references them (CONTROLLED-STATE §3.1) — the
  // jsFunctions precedent: a definition nothing kept costs nothing.
  const referencedStateNames = new Set<string>();
  const stateVarByName = new Map(plan.stateVars.map((v) => [v.name, v]));
  const stateSetterOf = (name: string): string => stateVarByName.get(name)?.setterName ?? `set${name}`;
  const controlVarByNode = new Map(
    plan.stateVars.filter((v) => v.origin === 'control').map((v) => [v.originNodeId, v])
  );
  const jsArgExprs = (nodeId: string): ValueExpr[] =>
    (jsFunByNode[nodeId]?.inputs ?? []).flatMap((i) => (i.expr !== undefined ? [i.expr] : []));
  // Earned by a surviving read, exactly as a variable earns its `useValue` — a `User` node whose
  // every read was gated leaves no hook behind (USER-FAMILY-TARGET §4c).
  let usesSession = false;
  /**
   * Earned by a surviving `page-param` read, exactly as `usesSession` is earned — a `Page
   * Inputs` node whose every read was gated leaves no hook behind (EXP-011 Tier 2.5).
   *
   * One flag for both hooks, because the read genuinely uses both: the query overrides the path
   * segment, so neither half of the expression is optional.
   */
  let usesPageParams = false;
  const collectExprUse = (expr: ValueExpr) => {
    if (expr.kind === 'session-get') usesSession = true;
    // EXP-011 Tier 2.5 — the handler half; the render half is in `hookExprSources`, per the
    // two-walker warning there.
    if (expr.kind === 'page-param') usesPageParams = true;
    if (expr.kind === 'store-get') usedVariableNames.add(expr.variableName);
    if (expr.kind === 'store-key-get') usedStoreNames.add(expr.storeName);
    if (expr.kind === 'state-get') referencedStateNames.add(expr.name);
    // EXP-011 Tier 1.1. In a handler this prints as `notes.peek()`, so it earns the *import*
    // and not a hook — the render half of the same rule is in `hookExprSources` above, which is
    // the walker this one's comment warns must be kept in step.
    if (expr.kind === 'collection-get') usedCollectionNames.add(expr.collectionName);
    if (expr.kind === 'list-map' || expr.kind === 'list-filter') collectExprUse(expr.source);
    /**
     * EXP-011 Tier 1.3. A date call earns the helper's import, and its arguments earn whatever
     * they read — a variable, a state row, another date call. Missing the recursion here would
     * emit `dateAdd(startedAt, …)` with no `import` line and no `useValue` above it.
     */
    if (expr.kind === 'date-call') {
      usedDateHelpers.add(expr.fn);
      expr.args.forEach(collectExprUse);
    }
    // A read through the row earns that row; the chain-local form names a local the enclosing
    // action declares and earns nothing (the `http-out` rule).
    if (expr.kind === 'now-out' && expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
    if (expr.kind === 'format') {
      for (const part of expr.parts) if (typeof part !== 'string') collectExprUse(part);
    }
    if (expr.kind === 'logical') expr.operands.forEach(collectExprUse);
    if (expr.kind === 'not' || expr.kind === 'truthy') collectExprUse(expr.operand);
    // EXP-011 Tier 1.2. A read through the state row earns that row; the chain-local form names
    // a local the enclosing action declares and earns nothing.
    if (expr.kind === 'http-out' && expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
    // EXP-011 §24, the same clause for `External Link` and `Navigate To Path`'s Error. 🔴 This
    // one is opt-in and does not error when it is missing — the row would be written by the
    // failure arm, read by the sink, and then dropped by the `referencedStateNames` filter as
    // unreferenced, which emits a component that does not compile.
    if (expr.kind === 'outcome-error' && expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
    if (expr.kind === 'jsfun-out') {
      if (expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
      referencedJsIds.add(expr.nodeId);
      jsArgExprs(expr.nodeId).forEach(collectExprUse);
      // A Visual Function's wrapper binds a `Noodl.Variables` facade over the app's variables
      // store, so referencing the definition is what earns those imports (§3.4).
      for (const name of jsFunByNode[expr.nodeId]?.variables ?? []) {
        if (variableByName.has(name)) usedVariableNames.add(name);
      }
    }
  };
  const collectActionUse = (action: HandlerAction) => {
    if (action.kind === 'state-set') {
      referencedStateNames.add(action.name);
      if (action.expr !== undefined) collectExprUse(action.expr);
    }
    if (action.kind === 'jsfun-run' && action.materialize !== undefined) {
      referencedStateNames.add(action.materialize);
    }
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
    if (action.kind === 'collection-clear') {
      usedCollectionNames.add(action.collectionName);
      action.then.forEach(collectActionUse);
      action.unchangedThen.forEach(collectActionUse);
    }
    if (action.kind === 'branch') {
      collectExprUse(action.cond);
      action.whenTrue.forEach(collectActionUse);
      action.whenFalse.forEach(collectActionUse);
    }
    if (action.kind === 'popup-show' || action.kind === 'popup-close') {
      action.then.forEach(collectActionUse);
    }
    /**
     * The asynchronous actions' arguments and chains (EXP-011 Tier 1.2).
     *
     * 🔴 **The chains were not walked here at all**, and a state read inside one was therefore
     * never counted as a reference: the row was filtered out of `referencedStateVars` and the
     * emitted handler read an identifier the component never declared. The failure chain is what
     * made it visible — it was the first chain to carry a read that nothing else in the
     * component also read — but the omission is older than this slice and covers the record
     * verbs' `done` chain in the same words, so both are walked here.
     */
    if (action.kind === 'api-call') {
      for (const arg of action.args) {
        if (arg.kind === 'expr') collectExprUse(arg.expr);
        else arg.props.forEach((p) => collectExprUse(p.expr));
      }
      action.then.forEach(collectActionUse);
    }
    if (action.kind === 'http-call') {
      action.args.forEach((a) => collectExprUse(a.expr));
      action.then.forEach(collectActionUse);
      action.failThen.forEach(collectActionUse);
    }
    // EXP-011 Tier 1.3. The Read reads nothing itself; its chain does, and the row it writes is
    // a reference whether or not anything reads it — the record verbs' rule for a written row.
    if (action.kind === 'date-now-read') {
      if (action.materialize !== undefined) referencedStateNames.add(action.materialize);
      action.then.forEach(collectActionUse);
    }
    // EXP-011 Tier 2.5. The link is an expression and both outcome chains are chains; this node
    // writes no row of its own, so there is nothing else here to reference.
    if (action.kind === 'external-link') {
      collectExprUse(action.link);
      action.then.forEach(collectActionUse);
      action.failThen.forEach(collectActionUse);
    }
    /**
     * 🔴 **`Navigate To Path` was absent from this function entirely, and the emitted app named
     * an identifier it never declared** (EXP-011 §17.3). Neither its url expressions nor its
     * chains were walked, so a Variable read *only* by a path parameter was never counted as a
     * reference: the row was filtered out of `referencedStateVars` while the handler went on
     * calling `probeVar.get()`.
     *
     * Measured with a control pair varying one thing — whether anything **else** in the
     * component also reads the variable. Subject: no import, no `useValue`, and
     * `navigate(`/note/${'$'}{probeVar.get() ?? ''}`)` in the handler. Control, identical plus a
     * Text bound to the same variable: `import { probeVar }` and the hook both present. The
     * defect is the omission here and not something about variables.
     *
     * ⚠️ This is the same sentence the block above it has carried since Tier 1.2 — "the chains
     * were not walked here at all" — arriving on a *third* action. `parse` cannot catch it and
     * neither can `tsc` on this package: only building the emitted app can, and every fixture
     * that reached it happened to render the value somewhere too.
     */
    if (action.kind === 'navigate-path') {
      action.pathParams.forEach((p) => collectExprUse(p.expr));
      action.query.forEach((q) => collectExprUse(q.expr));
      /**
       * 🔴 **EXP-011 §18 — the same omission this block's own comment is about, one field
       * later.** §17.3 measured what a missed expression costs here: a Variable read *only* by
       * a path parameter was never counted as a reference, so the row was filtered out of
       * `referencedStateVars` while the handler went on calling `.get()` on an identifier it
       * never declared. A Variable read only by a wired `Open In New Tab` is the same defect
       * with a different port, and neither `parse` nor `tsc` on this package can see it —
       * an undeclared identifier is valid syntax.
       */
      if (action.newTabExpr !== undefined) collectExprUse(action.newTabExpr);
      action.then.forEach(collectActionUse);
      action.failThen.forEach(collectActionUse);
      action.completedThen.forEach(collectActionUse);
    }
    if (action.kind === 'jsfun-run') {
      referencedJsIds.add(action.nodeId);
      jsArgExprs(action.nodeId).forEach(collectExprUse);
      action.then.forEach(collectActionUse);
      // Same as the expression side: the wrapper's Noodl.Variables facade earns the imports.
      for (const name of jsFunByNode[action.nodeId]?.variables ?? []) {
        if (variableByName.has(name)) usedVariableNames.add(name);
      }
    }
  };
  const allActions: HandlerAction[] = [
    ...Object.values(plan.handlers).flatMap((byPort) => Object.values(byPort).flat()),
    ...Object.values(plan.changeHandlers).flat(),
    ...plan.receivers.flatMap((r) => r.actions),
    // A reactive Condition's branch earns imports, `navigate` and state references exactly as a
    // handler's does — it just runs from an effect instead of an event (LOGIC-TARGET §10).
    ...plan.branchEffects.map((e) => e.action)
  ];
  allActions.forEach(collectActionUse);
  /** Nested actions (branch arms, popup done-chains) flattened — the `usesNavigate` sweep. */
  const deepActions = (actions: HandlerAction[]): HandlerAction[] =>
    actions.flatMap((a) =>
      a.kind === 'branch'
        ? [a, ...deepActions(a.whenTrue), ...deepActions(a.whenFalse)]
        : a.kind === 'http-call' || a.kind === 'external-link'
          ? [a, ...deepActions(a.then), ...deepActions(a.failThen)]
          : // EXP-011 §15. `Navigate To Path` carries two chains and neither is `failThen`;
            // without this line `usesNavigate` below cannot see a second navigation nested in
            // the first one's Done, and the `useNavigate()` hook it needs goes undeclared.
            a.kind === 'navigate-path'
            ? [a, ...deepActions(a.then), ...deepActions(a.failThen), ...deepActions(a.completedThen)]
          : a.kind === 'popup-show' ||
              a.kind === 'popup-close' ||
              a.kind === 'jsfun-run' ||
              a.kind === 'api-call' ||
              a.kind === 'date-now-read'
            ? [a, ...deepActions(a.then)]
            : [a]
    );
  for (const receiver of plan.receivers) usedChannelNames.add(receiver.channelName);

  // Render bindings needing hooks, in pre-order encounter order. A computed binding earns the
  // hooks of every source its expression tree reads, in part order.
  const hookVariables: string[] = [];
  const hookStoreKeys: Array<{ storeName: string; key: string }> = [];
  const hookCollections: string[] = [];
  /** Reactive JS nodes read from render bindings, first-encounter order — each earns one
   * render local (`const formatShoutOut = formatShout({ name });`) plus its args' hooks. */
  const renderJsIds: string[] = [];
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
    /**
     * EXP-011 Tier 1.1 — a named array read in render is the `useCollection` hook, which is
     * what turns the module-scope `Collection` object into the array `.map` can be called on.
     * Without this the emitted code reads `notes.map(…)` off the Collection itself.
     */
    if (expr.kind === 'collection-get' && collectionByName.has(expr.collectionName) && !hookCollections.includes(expr.collectionName)) {
      hookCollections.push(expr.collectionName);
      usedCollectionNames.add(expr.collectionName);
    }
    if (expr.kind === 'list-map' || expr.kind === 'list-filter') hookExprSources(expr.source);
    if (expr.kind === 'format') {
      for (const part of expr.parts) if (typeof part !== 'string') hookExprSources(part);
    }
    if (expr.kind === 'logical') expr.operands.forEach(hookExprSources);
    if (expr.kind === 'not' || expr.kind === 'truthy') hookExprSources(expr.operand);
    if (expr.kind === 'state-get') referencedStateNames.add(expr.name);
    // ⚠️ The second walker. `collectExprUse` covers handler actions and this one covers render
    // bindings, and each enumerates the kinds it cares about separately — so a new ValueExpr
    // kind that earns a hook must be added to BOTH. Setting it only in `collectExprUse` emitted
    // `session.authenticated` in four bindings with no `const session` above them, and only
    // building the emitted app caught it (USER-FAMILY-TARGET §9).
    if (expr.kind === 'session-get') usesSession = true;
    // EXP-011 Tier 2.5, the same clause twice — the render half of the page-parameter hooks.
    if (expr.kind === 'page-param') usesPageParams = true;
    // The second walker, per the warning above: a render binding on an HTTP output reads the
    // state row the request writes, and the row has to survive the `referencedStateNames` filter.
    if (expr.kind === 'http-out' && expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
    // EXP-011 §24. A render read of an Error output is *always* the row form — the failure arm's
    // `const` exists only inside that arm — so this clause earns every row render can see.
    if (expr.kind === 'outcome-error' && expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
    // EXP-011 Tier 1.3, the same clause twice more. A date call's arguments earn their hooks
    // through this walker, and a render read of `Now` earns the row it goes through — a render
    // read is *always* the row form, since the local exists only inside the Read chain.
    if (expr.kind === 'date-call') {
      usedDateHelpers.add(expr.fn);
      expr.args.forEach(hookExprSources);
    }
    if (expr.kind === 'now-out' && expr.viaState !== undefined) referencedStateNames.add(expr.viaState);
    if (expr.kind === 'jsfun-out') {
      if (expr.viaState !== undefined) {
        // A materialized read (§4f) goes through the state var, not a render local.
        referencedStateNames.add(expr.viaState);
        referencedJsIds.add(expr.nodeId);
        return;
      }
      referencedJsIds.add(expr.nodeId);
      if (!renderJsIds.includes(expr.nodeId)) renderJsIds.push(expr.nodeId);
      jsArgExprs(expr.nodeId).forEach(hookExprSources);
    }
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
      const itemsExpr = plan.repeaters[id]?.itemsExpr;
      if (itemsExpr !== undefined) hookExprSources(itemsExpr);
    }
  }
  // The state effects' sources earn their hooks exactly as bindings do (CONTROLLED-STATE §3).
  for (const sync of plan.syncEffects) hookExprSources(sync.source);
  for (const push of plan.pushEffects) hookExprSources(push.expr);
  // The second walker again (LOGIC-TARGET §10). A reactive Condition's arms print in handler mode, so they
  // earn nothing here — but its *condition* is also the effect's dependency list, and
  // `effectDeps` spells a dependency as the render local. Without this the dep names a `const`
  // no line declares.
  for (const effect of plan.branchEffects) {
    if (effect.action.kind === 'branch') hookExprSources(effect.action.cond);
  }
  // A rendered stateful control references its own row (value/checked + onChange), a sync
  // effect its target, a lifted callback its setter — whether or not any expression reads it.
  for (const stateVar of plan.stateVars) {
    if (stateVar.origin === 'control' && plan.roleOf[stateVar.originNodeId] !== undefined) {
      referencedStateNames.add(stateVar.name);
    }
  }
  for (const sync of plan.syncEffects) referencedStateNames.add(sync.stateName);
  // An awaited call's Error row is *written* by its catch even when nothing reads it, and a row
  // reached only by its writer is still a row: without this the emitted setter call names a
  // binding the filter had already dropped (RECORD-VERBS-TARGET §4a). Log Out is the case where
  // nothing reads it in the whole corpus (USER-FAMILY-TARGET §4b).
  for (const action of deepActions(allActions)) {
    if (action.kind === 'api-call') referencedStateNames.add(action.errorState);
    // EXP-011 Tier 1.2: both rows are written by the call itself. The Error row is the record
    // verbs' case exactly; the answer row is written only where something reads it, so it is
    // already earned — naming it here keeps the writer and the row inseparable either way.
    if (action.kind === 'http-call') {
      referencedStateNames.add(action.errorState);
      if (action.materialize !== undefined) referencedStateNames.add(action.materialize);
    }
    // EXP-011 §14. Unlike the two above, this row exists only because something reads it — so it
    // is already earned — but naming it here keeps the writer and the row inseparable, which is
    // what stops a future filter dropping the binding the setter call names.
    if (action.kind === 'external-link' && action.errorState !== undefined) {
      referencedStateNames.add(action.errorState);
    }
    // EXP-011 §17 — the same row one node over, on the same rule.
    if (action.kind === 'navigate-path' && action.errorState !== undefined) {
      referencedStateNames.add(action.errorState);
    }
  }
  for (const lifted of Object.values(plan.instanceLifted)) {
    for (const entry of lifted) {
      const stateVar = plan.stateVars.find((v) => v.setterName === entry.setterName);
      if (stateVar) referencedStateNames.add(stateVar.name);
    }
  }
  const referencedStateVars = plan.stateVars.filter((v) => referencedStateNames.has(v.name));

  // EXP-011 §15. Both kinds call `navigate(...)`, so both earn the hook. A `some` over one
  // kind is the shape that silently emits a call to an undeclared identifier.
  const usesNavigate = deepActions(allActions).some((a) => a.kind === 'navigate' || a.kind === 'navigate-path');

  // The hook's local name is the variable's last camelCase word (`visitorName` → `name`),
  // deduplicated against everything else in scope, falling back to `<export>Value`.
  const reserved = new Set<string>([
    'event',
    'navigate',
    'payload',
    // Reserved unconditionally, as `navigate` is: a name that is a hook local in some components
    // and a variable's local in others would make the same graph emit two different identifiers
    // depending on what else the page happens to contain.
    PAGE_PARAMS_LOCAL,
    PAGE_QUERY_LOCAL,
    'styles',
    'joinClasses',
    SESSION_LOCAL,
    plan.file.symbol
  ]);
  // Port names are user text (`Align X`, `Margin Bottom`): a prop prints as the identifier the
  // naming rule assigns it, on every surface — interface, destructuring, reader, and the JSX
  // attribute a caller writes. `propName` is the child's side of that; `targetPropName` below is
  // the caller's, resolved off the target's own plan so the two agree by construction.
  const propIdentByName = propIdentifiers(plan);
  const propName = (portName: string) => propIdentByName.get(portName) ?? propIdentifier(portName);
  const targetIdents = new Map<string, Map<string, string>>();
  /**
   * The attribute name a caller writes for one of `targetLegacy`'s input ports, or `null` when the
   * target declares no such port — §13b, the parent end of the missing interface. A component that
   * never declares the port receives nothing through it at runtime, so the faithful emission is the
   * attribute's *absence* plus a named note, not an attribute that lands on `IntrinsicAttributes`.
   * Minting the prop on the target instead would make the exported app disagree with the running
   * one, which is the one thing this phase does not do.
   *
   * The target's plan is always there: every site that mints an attribute has already resolved the
   * instance through `requireInstance`, which drops the element whole when the target exports no
   * component. An empty map therefore means "declares no inputs", never "was not looked up".
   */
  const targetPropName = (targetLegacy: string, portName: string): string | null => {
    let idents = targetIdents.get(targetLegacy);
    if (idents === undefined) {
      const targetPlan = project.byLegacyPath.get(targetLegacy);
      idents = targetPlan ? propIdentifiers(targetPlan) : new Map<string, string>();
      targetIdents.set(targetLegacy, idents);
    }
    return idents.get(portName) ?? null;
  };
  /**
   * The TypeScript type `targetLegacy` declares for one of its input ports — the sink an
   * untyped value has to survive (§10). `undefined` when the target declares no such port,
   * which the caller's own `targetPropName` reports separately.
   */
  const targetPropTsType = (targetLegacy: string, portName: string): string | undefined =>
    project.byLegacyPath.get(targetLegacy)?.props.find((p) => p.name === portName)?.tsType;

  /** The note a refused attribute files, spelled once so all three call sites agree. */
  const undeclaredAttrNote = (targetLegacy: string, portName: string, where: string): string =>
    `${plan.path}: ${where} sets "${portName}" on ${targetLegacy}, which does not declare it as a component input — dropped, reported`;

  /**
   * EXP-004's in-code markers — the half §19.5 measured and did not build.
   *
   * ## The defect this closes
   *
   * A refusal that could not emit an element already leaves a `TODO(export)` where the element
   * would have been (`droppedChildMarkers`, EXP-010 AC3). A refusal that drops **a wire from an
   * element which still renders** left nothing at all: the element sits in the file with the right
   * tag, the right class and one attribute missing — correct-looking, and inert. On `puppy-test-3`
   * the emitted code carried **no** marker at all while the report listed nine refusals, so a
   * reader who ran the report's own `grep -rn "TODO(export)" src` found nothing and could read
   * that as an all-clear.
   *
   * ## 🔴 Filled beside `notes`, never parsed back out of it
   *
   * This is §19.2's rule one construct over. Every site below already holds the node, the port and
   * its reason as *values*; the note is one rendering of them and the marker is another. Deriving
   * the marker by reading the note back would mis-place it the first time anyone reworded a
   * refusal — and rewording refusals is the ordinary business of this package. `notes` is
   * untouched here, and the suites that assert on its wording still hold.
   *
   * ## What does not get one
   *
   * Only losses on a node that **still renders**. A statically-invisible node and an authored
   * `Mounted false` are authored state rather than gaps (and the second already emits its own
   * comment); a kit's `allowChildren: false` is the exported app agreeing with the running one.
   * Marking those would tell an author to fix something that is not broken.
   */
  interface NodeDeferral {
    /** What in the graph did not survive: `the wire into "text"`, `the "Click" signal`. */
    subject: string;
    /** The exporter's own reason, in the words it files for the report. */
    reason: string;
    /** The graph node that fed the wire, when the binding still names one. */
    origin: string | null;
  }
  const deferralsByNode = new Map<string, NodeDeferral[]>();

  /**
   * 🔴 A port name, a node id and a component path are **author content**, and a marker is a
   * block comment. A comment-closing sequence inside one ends the comment early and the
   * remainder becomes code —
   * a file that fails to parse, or worse, one that parses as something else. Nothing upstream
   * constrains these strings, so the sequence is neutralised here rather than trusted.
   */
  const commentSafe = (text: string): string => text.split('*/').join('* /');

  /**
   * The graph end of a dropped wire. Only `unresolved` carries one: every other `BindingSource`
   * *did* resolve, and was dropped for what it resolved to rather than for where it came from —
   * so naming an origin there would answer a question the reader did not ask.
   */
  const originOf = (source: BindingSource | undefined): string | null => {
    if (source === undefined || source.kind !== 'unresolved') return null;
    const from = nodeById.get(source.fromId);
    return `${from ? `${from.type} ` : ''}node ${source.fromId}, port "${source.fromProperty}"`;
  };

  /** Record a loss on a node that still renders, beside the note the caller files itself. */
  const defer = (nodeId: string, subject: string, reason: string, source?: BindingSource): void => {
    const entry: NodeDeferral = { subject, reason, origin: originOf(source) };
    const list = deferralsByNode.get(nodeId);
    if (list) list.push(entry);
    else deferralsByNode.set(nodeId, [entry]);
  };

  /**
   * The marker's prose, without the comment syntax that carries it — written once because it is
   * emitted in two syntaxes, and two copies of a sentence drift.
   *
   * Marks the node as flushed: whatever is left at the end of the component did not reach a
   * marker through the tree, and `leftoverMarkerText` is what stops that being a silent loss.
   */
  const flushed = new Set<string>();
  const markerText = (nodeId: string): string[] => {
    const deferrals = deferralsByNode.get(nodeId);
    if (deferrals === undefined) return [];
    flushed.add(nodeId);
    // "asked of it" rather than "wired to it": an authored parameter with no mapping is one of
    // these and is not a wire, and a header that named only wires would misdescribe it.
    const out = [`TODO(export): node ${commentSafe(nodeId)} renders, and part of what the graph`, 'asked of it did not survive:'];
    for (const d of deferrals) {
      out.push(`  - ${commentSafe(d.subject)} ${commentSafe(d.reason)}.`);
      if (d.origin !== null) out.push(`    In the graph it is fed by ${commentSafe(d.origin)}.`);
    }
    return out;
  };

  /**
   * The plan's own refusals, attached to the element a reader can actually find.
   *
   * 🔴 **Which end of a dropped wire renders is the whole question**, and both ends can be the
   * answer. A wire *into* a rendered node leaves that node showing a stale value — the sink is
   * where the reader looks. A wire *out of* a rendered node — `deleteBtn:onClick` into a Record
   * verb that refused — leaves a button that looks live and does nothing when clicked, which is
   * the most visible failure of the two and has no marker at the sink, because the sink is a
   * logic node that emits nothing.
   *
   * So: the sink when it renders, else the source when it renders. A wire between two logic nodes
   * has no element to mark at all — that population is why the report stays the complete list and
   * says so.
   */
  for (const wire of plan.droppedWires) {
    const rendered = plan.roleOf[wire.toId] !== undefined ? wire.toId : plan.roleOf[wire.fromId] !== undefined ? wire.fromId : null;
    if (rendered === null) continue;
    const label = wire.label !== undefined ? ` (labelled "${wire.label}")` : '';
    const subject =
      rendered === wire.toId
        ? `the wire into "${wire.toProperty}"${label}, from ${nodeById.get(wire.fromId)?.type ?? 'node'} ${wire.fromId}.${wire.fromProperty},`
        : `the wire out of "${wire.fromProperty}"${label}, into ${nodeById.get(wire.toId)?.type ?? 'node'} ${wire.toId}.${wire.toProperty},`;
    defer(rendered, subject, `was dropped: ${wire.reason}`);
  }

  for (const { id, name } of unmappedParams) {
    defer(id, `the authored "${name}" parameter`, 'has no style or content mapping in this slice');
  }

  /** The marker as a JSX children-position comment, immediately above the element it is about. */
  const markerLines = (nodeId: string, indent: number): string[] => {
    const text = markerText(nodeId);
    if (text.length === 0) return [];
    return [
      `${pad(indent)}{/* ${text[0]}`,
      ...text.slice(1).map((line) => `${pad(indent)}    ${line}`),
      `${pad(indent)}    See the export report. */}`
    ];
  };
  plan.props.forEach((p) => reserved.add(propName(p.name)));
  plan.outputProps.forEach((o) => reserved.add(o.prop));
  plan.liftedOutputProps.forEach((l) => reserved.add(l.prop));
  if (plan.closesPopup) reserved.add('onClose');
  // Wrapper names are module scope — locals must yield to them, so they reserve first.
  for (const id of referencedJsIds) {
    const def = jsFunByNode[id];
    if (def) reserved.add(def.fnName);
  }
  // State rows were allocated in the plan's identifier space — locals yield to them here.
  for (const stateVar of referencedStateVars) {
    reserved.add(stateVar.name);
    reserved.add(stateVar.setterName);
  }
  // The popup slot's state pair (POPUPS-TARGET §2) — allocated before the hook locals so a
  // variable named "openPopup" yields, not the slot.
  const allocLocal = (base: string): string => {
    let name = base;
    let counter = 2;
    while (reserved.has(name)) name = `${base}${counter++}`;
    reserved.add(name);
    return name;
  };
  const popupState = plan.popups.length > 0 ? allocLocal('openPopup') : null;
  const popupSetter = plan.popups.length > 0 ? allocLocal('setOpenPopup') : null;
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
  const hasIndexKeyedRows =
    hookCollections.length > 0 || Object.values(plan.repeaters).some((r) => r.itemsExpr !== undefined);
  const itemLocal = hasIndexKeyedRows ? dedupeLocal('item') : 'item';
  const indexLocal = hasIndexKeyedRows ? dedupeLocal('index') : 'index';

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

  // One render local per reactive JS node read from render bindings (EXP-003 §4 A1) —
  // the derived-row rule one tier up: the node compiles away into a function call.
  const jsLocals = new Map<string, string>();
  for (const id of renderJsIds) {
    const def = jsFunByNode[id];
    if (def) jsLocals.set(id, dedupeLocal(`${def.fnName}Out`));
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
      // EXP-011 Tier 2.5: `useParams()` answers undefined for a segment this route has not
      // matched, and `URLSearchParams.get` answers null for a key the url does not carry.
      case 'page-param':
        return true;
      case 'store-key-get':
        return !(storeByName.get(expr.storeName)?.keys.find((k) => k.key === expr.key)?.required ?? false);
      // `authenticated` is a real boolean (`model !== undefined`); the rest are absent while
      // nobody is signed in, which is the state the stub always reports (USER-FAMILY §4c).
      case 'session-get':
        return expr.field !== 'authenticated';
      case 'payload':
        return true; // payload keys are optional-typed
      case 'undefined':
        return true; // a Component Object property's boot value (COMPONENT-OBJECT-TARGET §3)
      case 'jsfun-out':
        // An unwritten output reads undefined, like the runtime getter; a materialized read is
        // undefined until the first invocation (CONTROLLED-STATE §4f).
        return expr.viaState !== undefined || expr.fold === undefined;
      // Always — before the first request, after a path that matched nothing, and for an Error
      // nothing has written. Must agree with plan.ts maybeUndefinedExpr (EXP-011 Tier 1.2).
      case 'http-out':
        return true;
      // Always — an unreadable date answers unset on all five, and Date To String is unset before
      // its first format. Must agree with plan.ts maybeUndefinedExpr (EXP-011 Tier 1.3).
      case 'date-call':
        return true;
      // Never: the row is seeded at mount by a lazy initializer and every write is a fresh Date,
      // which is what lets `now.getTime()` print without a guard.
      case 'now-out':
        return false;
      // The row is undefined until the first failure; the chain-local is assigned on the line
      // above the read and never is. Must agree with plan.ts maybeUndefinedExpr (EXP-011 §24).
      case 'outcome-error':
        return expr.viaState !== undefined;
      case 'state-get':
        return expr.maybeUndefined === true;
      // A list is always an array — the module-scope `collection([])` exists from module load,
      // and both transforms return a fresh array. Must agree with plan.ts maybeUndefinedExpr.
      case 'collection-get':
      case 'list-map':
      case 'list-filter':
      case 'input-text':
      case 'control-event':
      case 'literal':
      case 'format':
      case 'logical':
      case 'not':
      case 'truthy':
        return false;
    }
  };
  /**
   * The row parameter of an emitted list transform (EXP-011 Tier 1.1).
   *
   * A fixed name is safe because it is only ever bound inside the arrow it names — these
   * transforms do not nest another expression vocabulary inside the callback, so it cannot
   * shadow anything an inner expression reads.
   */
  const LIST_ROW = 'row';
  /**
   * `applyFilter`'s operators, verbatim (`filtercollectionnode.ts`).
   *
   * ⚠️ **Loose on purpose.** The runtime compares with `==`/`!=`, not `===`, and its own comment
   * says why: *"which is what lets a numeric filter value match a CSV column of strings"*.
   * Tightening these to `===` here would silently drop rows the interpreter keeps — the export
   * disagreeing with the app the author tested. `$regex` is not in this table; it defers, see
   * the gate in plan.ts.
   */
  const FILTER_OPERATORS: Record<'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte', string> = {
    eq: '==',
    neq: '!=',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<='
  };
  /**
   * A list transform's source, parenthesised when chaining a method onto it would otherwise
   * bind wrong. A bare identifier (`notesItems`) and a call (`notes.peek()`) both take `.map`
   * directly; anything else is wrapped.
   */
  /**
   * The fields a list expression's rows are statically known to carry, or null when unknown.
   *
   * Null is not "no fields" — it is "this slice cannot say", which is §4e's own state and keeps
   * every mapped input. Only the sources EXP-011 Tier 1.1 introduced can answer, because only
   * they emit a row type the exported app's `tsc` will check.
   */
  const listExprFields = (expr: ValueExpr): Set<string> | null => {
    if (expr.kind === 'collection-get') {
      const plan = collectionByName.get(expr.collectionName);
      return plan === undefined ? null : new Set(plan.keys.map((k) => k.key));
    }
    // A map REPLACES the row: whatever the source carried, the emitted object literal has
    // exactly these keys and nothing else.
    if (expr.kind === 'list-map') return new Set(expr.entries.map((e) => e.key));
    // A filter selects rows without changing their shape.
    if (expr.kind === 'list-filter') return listExprFields(expr.source);
    return null;
  };
  /**
   * How a transform reads one field off its source row.
   *
   * 🔴 A field the source's row type does not carry is read through an `any` cast, and reported.
   * Without it the exported app **fails to build**: `Array Map`'s script names source properties
   * by string, so `map({ badge: 'nope' })` over a `BooksItem[]` emits `row.nope` and `tsc`
   * answers *"Property 'nope' does not exist on type 'BooksItem'"*. Found by sabotaging the
   * driven project, not by reasoning — the same hole had already been closed on the repeater's
   * side and was still open on this one.
   *
   * The cast is exact rather than a papering-over. `model.get('nope')` is `undefined` in the
   * runtime, and `undefined` is what every one of `applyFilter`'s six operators compares
   * against — including `$neq`, the one that answers *true* for an absent property. Reading
   * `undefined` reproduces all six without folding any of them, which is a rule that cannot be
   * got subtly wrong. Where the row shape is unknown the reader is the plain member access, and
   * every field is fine because the row is already `any`.
   */
  const rowFieldReader = (source: ValueExpr, what: string): ((field: string) => string) => {
    const known = listExprFields(source);
    return (field: string) => {
      const plain = memberExpr(LIST_ROW, field);
      if (known === null || known.has(field)) return plain;
      notes.push(
        `${plan.path}: ${what} reads "${field}", which the array it reads does not carry — the runtime answers undefined there, and the emitted read says so`
      );
      return memberExpr(`(${LIST_ROW} as any)`, field);
    };
  };
  const listSourceCode = (source: ValueExpr, mode: 'handler' | 'render'): string => {
    const code = exprCode(source, mode);
    return SIMPLE_REF.test(code) || /^[A-Za-z_$][\w$.]*\(\)$/.test(code) || code.endsWith(')') ? code : `(${code})`;
  };
  /** The wrapper call's argument record; shorthand where the arg code is the field name. */
  const jsArgsObject = (def: JsFunctionPlan, mode: 'handler' | 'render'): string => {
    const entries = def.inputs
      .filter((i) => i.expr !== undefined)
      .map((i) => {
        const code = exprCode(i.expr!, mode);
        const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(i.name) ? i.name : JSON.stringify(i.name);
        return key === code ? code : `${key}: ${code}`;
      });
    return entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
  };
  /**
   * The locals an HTTP Request's outcome chains bind (EXP-011 Tier 1.2), read off the plan so
   * the expression side and the action side cannot disagree about a name.
   */
  const httpNamesOf = (nodeId: string) => {
    const call = plan.httpCalls.find((c) => c.nodeId === nodeId);
    // Unreachable: a `http-out` in the local form is minted inside the chain of a call that
    // attached, and `plan.httpCalls` is filtered to exactly those. Total rather than `!`, so a
    // future path that breaks the invariant emits something a reader can find.
    return call ?? { answerLocal: 'answer', messageLocal: 'message', fnName: 'fetch', typeName: 'Answer' };
  };
  /**
   * The chain-local one `Now` binds its instant to (EXP-011 Tier 1.3), read off the plan so the
   * expression side and the action side cannot disagree about a name — `httpNamesOf`'s rule.
   */
  const nowLocalOf = (nodeId: string): string => {
    const action = deepActions(allActions).find((a) => a.kind === 'date-now-read' && a.nodeId === nodeId);
    // Unreachable: a local-form `now-out` is minted only inside the chain of a Read that
    // attached. Total rather than `!`, so a future path that breaks the invariant emits
    // something a reader can find rather than crashing here.
    return action !== undefined && action.kind === 'date-now-read' ? action.local : 'clockRead';
  };
  const exprCode = (expr: ValueExpr, mode: 'handler' | 'render'): string => {
    switch (expr.kind) {
      case 'prop':
        return propName(expr.name);
      case 'input-text':
        return 'event.target.value';
      /**
       * A url parameter (EXP-011 Tier 2.5) — the query first, the path segment behind it.
       *
       * 🔴 **The order is the runtime's merge, not a preference.** The Router builds one flat
       * map as `Object.assign({}, match.params, urlQuery)` (`router.tsx:456`), so a query
       * parameter of the same name wins over the matched path segment — `/product/42?id=99`
       * reads `99`. Writing it the other way round would be the more obvious code and would
       * disagree with the running app on exactly the urls a user can type by hand.
       *
       * `??` and not `||`: an empty query value (`?q=`) is `''` in both halves of the runtime's
       * `Object.assign`, so it must win here too rather than falling through to the path.
       */
      case 'page-param': {
        const key = JSON.stringify(expr.name);
        const segment = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expr.name)
          ? `${PAGE_PARAMS_LOCAL}.${expr.name}`
          : `${PAGE_PARAMS_LOCAL}[${key}]`;
        return `${PAGE_QUERY_LOCAL}.get(${key}) ?? ${segment}`;
      }
      // A state read is the render closure's value in both modes (CONTROLLED-STATE §3.2);
      // chain-order correctness inside handlers is the plan-side snapshot rule's job.
      case 'state-get':
        return expr.name;
      /**
       * An HTTP Request's output (EXP-011 Tier 1.2), in whichever of its two forms the planner
       * chose — `viaState` is the state row, its absence is the chain's own local. Both are
       * optional-chained: the row is undefined until the first request, and a mapping reads
       * wherever its path points, which may be nothing.
       */
      case 'http-out': {
        const names = httpNamesOf(expr.nodeId);
        if (expr.output === 'error') return expr.viaState ?? names.messageLocal;
        const base = expr.viaState !== undefined ? `${expr.viaState}?.` : `${names.answerLocal}.`;
        // A mapping output is `out-<name>` on the port and a key of `fields` in the answer; the
        // three standard outputs are the answer's own properties.
        if (!expr.output.startsWith('out-')) return `${base}${expr.output}`;
        const field = expr.output.slice('out-'.length);
        return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field)
          ? `${base}fields.${field}`
          : `${base}fields[${JSON.stringify(field)}]`;
      }
      /**
       * A `Now` output (EXP-011 Tier 1.3) — the row anywhere, the chain's own local inside the
       * Read chain. The two derived outputs are member reads off whichever one it is, and they
       * need no optional chaining: the row is seeded at mount and the local is a fresh `Date`.
       */
      /**
       * EXP-011 §24. The row where the read is outside the failure arm, the arm's own `const`
       * inside it — and the name of that `const` rides on the expression, so there is no second
       * table here that could disagree with the one that minted it.
       */
      case 'outcome-error':
        return expr.viaState ?? expr.local;
      case 'now-out': {
        const base = expr.viaState ?? nowLocalOf(expr.nodeId);
        if (expr.output === 'timestamp') return `${base}.getTime()`;
        if (expr.output === 'iso') return `${base}.toISOString()`;
        return base;
      }
      /**
       * One of the five pure date nodes (EXP-011 Tier 1.3) — the node *is* the call, and the
       * arguments print in the same mode, so a nested `Now → Date Add → Date To String` comes
       * out as one nested expression in either context.
       */
      case 'date-call':
        return `${expr.fn}(${expr.args.map((a) => exprCode(a, mode)).join(', ')})`;
      // One `const session = useSession()` per component, read the same way in both modes — the
      // hook is a render local and a handler closes over it (USER-FAMILY §4c).
      case 'session-get':
        return expr.field === 'authenticated' ? `${SESSION_LOCAL}.authenticated` : `${SESSION_LOCAL}.user?.${expr.field}`;
      case 'control-event':
        return expr.form === 'checked'
          ? 'event.target.checked'
          : expr.form === 'number'
            ? 'Number(event.target.value)'
            : 'event.target.value';
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
      // The boot-value read: the render sinks fold it away before printing (childText,
      // contentAttrs, the disabled inversion); this spelling is the cold handler-context path.
      case 'undefined':
        return 'undefined';
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
      /**
       * A named array (EXP-011 Tier 1.1). In render it is the `useCollection` local, so the
       * component re-renders when the array changes; in a handler it is `.peek()`, which reads
       * without creating a dependency edge — `.get()` there would register the handler's read
       * as a reactive dependency of whatever happened to be tracking.
       */
      case 'collection-get':
        return mode === 'render'
          ? (collectionLocals.get(expr.collectionName) ?? collectionByName.get(expr.collectionName)!.exportName)
          : `${collectionByName.get(expr.collectionName)!.exportName}.peek()`;
      /** `Array Map` — one object literal per row, keys in the script's own order. */
      case 'list-map': {
        const source = listSourceCode(expr.source, mode);
        const read = rowFieldReader(expr.source, 'Array Map');
        const entries = expr.entries
          .map((e) => `${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(e.key) ? e.key : JSON.stringify(e.key)}: ${read(e.field)}`)
          .join(', ');
        return `${source}.map((${LIST_ROW}) => ({${entries.length > 0 ? ` ${entries} ` : ''}}))`;
      }
      /**
       * `Array Filter` — filter, sort, skip, limit, in `scheduleFilter`'s order. `.slice()`
       * precedes `.sort()` because `Array.prototype.sort` mutates in place and the source here
       * may be the `useCollection` local, which React must not see mutated.
       */
      case 'list-filter': {
        let code = listSourceCode(expr.source, mode);
        const readTest = rowFieldReader(expr.source, 'Array Filter');
        for (const test of expr.tests) {
          code = `${code}.filter((${LIST_ROW}) => ${readTest(test.field)} ${FILTER_OPERATORS[test.op]} ${tsLiteral(test.value)})`;
        }
        if (expr.sort.length > 0) {
          const comparisons = expr.sort.map((s) => {
            const a = memberExpr('a', s.field);
            const b = memberExpr('b', s.field);
            const [lo, hi] = s.direction === 'descending' ? [b, a] : [a, b];
            return `${lo} > ${hi} ? 1 : ${lo} < ${hi} ? -1 : 0`;
          });
          const body = comparisons.length === 1 ? comparisons[0] : comparisons.map((c) => `(${c})`).join(' || ');
          /**
           * 🔴 The row parameters are annotated `any`, and it is not laziness — it is the only
           * honest spelling. Every emitted collection key is **optional**, so a sorted field is
           * `string | undefined`, and `a.title > b.title` on that is a `strictNullChecks` error:
           * the exported app failed `tsc -b` on exactly this line. The runtime's `sorter`
           * compares with bare `>`/`<` and simply lets `undefined` through
           * (`filtercollectionnode.ts`), so a null-safe comparator would have to *invent* an
           * ordering for absent values that the interpreter does not have. `any` says what is
           * true: this comparison is JavaScript's, over a field whose type this slice does not
           * claim. Found by building the emitted app — parsing it was not enough.
           */
          code = `${code}.slice().sort((a: any, b: any) => ${body})`;
        }
        if (expr.skip !== undefined || expr.limit !== undefined) {
          const start = expr.skip ?? 0;
          code = expr.limit === undefined ? `${code}.slice(${start})` : `${code}.slice(${start}, ${start + expr.limit})`;
        }
        return code;
      }
      // Render reads the node's local; a handler inlines the call over `.get()` snapshots —
      // pure by the gate, so recomputation is unobservable (EXP-003 §4). The folds are
      // Expression's typed getters, verbatim semantics (expression.ts).
      case 'jsfun-out': {
        const def = jsFunByNode[expr.nodeId]!;
        // A materialized read (§4f) goes through the state var in render — the last run's
        // value, undefined before the first invocation, exactly the runtime getter's answer.
        if (expr.viaState !== undefined && mode === 'render') {
          // Function and Visual Function both materialize an Outputs record keyed by port name;
          // Expression materializes its single value raw.
          const base =
            def.kind !== 'expression'
              ? /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expr.output)
                ? `${expr.viaState}?.${expr.output}`
                : `${expr.viaState}?.[${JSON.stringify(expr.output)}]`
              : expr.viaState;
          if (expr.fold === 'string') return `String(${base} ?? '')`;
          if (expr.fold === 'number') return `(typeof ${base} === 'number' ? ${base} : Number(${base}) || 0)`;
          if (expr.fold === 'boolean') return `!!${base}`;
          return base;
        }
        const local = mode === 'render' ? jsLocals.get(expr.nodeId) : undefined;
        const callee = local ?? `${def.fnName}(${jsArgsObject(def, mode)})`;
        const base = def.kind === 'function' ? memberExpr(callee, expr.output) : callee;
        if (expr.fold === 'string') return `String(${base} ?? '')`;
        if (expr.fold === 'number') return `(typeof ${base} === 'number' ? ${base} : Number(${base}) || 0)`;
        if (expr.fold === 'boolean') return `!!${base}`;
        return base;
      }
    }
  };
  /**
   * A useEffect dependency list for a state effect (CONTROLLED-STATE §3.4/§3.5): the leaf
   * reactive references the expression reads, as the render-mode locals they print as.
   */
  const effectDeps = (expr: ValueExpr): string[] => {
    const deps: string[] = [];
    const add = (code: string) => {
      if (!deps.includes(code)) deps.push(code);
    };
    const walk = (e: ValueExpr) => {
      switch (e.kind) {
        case 'prop':
          add(propName(e.name));
          break;
        case 'state-get':
          add(e.name);
          break;
        // The session is a hook's return value, so its fields are ordinary reactive reads — an
        // effect that tests one must re-run when it changes. `useSession` is a stub today, which
        // makes the dep constant; it is the shape a real session hook needs.
        case 'session-get':
          add(exprCode(e, 'render'));
          break;
        case 'store-get':
          add(hookLocals.get(e.variableName) ?? e.variableName);
          break;
        case 'store-key-get':
          add(storeKeyLocals.get(storeKeyId(e.storeName, e.key)) ?? e.key);
          break;
        case 'format':
          for (const p of e.parts) if (typeof p !== 'string') walk(p);
          break;
        case 'logical':
          e.operands.forEach(walk);
          break;
        case 'not':
        case 'truthy':
          walk(e.operand);
          break;
        // An effect can only ever see the state form: the chain-local one is minted inside the
        // action that declares the local, and an effect is not that action (EXP-011 Tier 1.2).
        case 'http-out':
        // EXP-011 §24, the same clause and the same reason one construct over.
        case 'outcome-error':
          if (e.viaState !== undefined) add(e.viaState);
          break;
        // EXP-011 Tier 1.3, same clause: an effect reading `Now` reads the row, so the row is
        // the dependency. A pure date call depends on whatever its arguments depend on — it
        // holds nothing of its own, so it adds no dep of its own either.
        case 'now-out':
          if (e.viaState !== undefined) add(e.viaState);
          break;
        case 'date-call':
          e.args.forEach(walk);
          break;
        case 'jsfun-out': {
          if (e.viaState !== undefined) {
            add(e.viaState);
            break;
          }
          const local = jsLocals.get(e.nodeId);
          if (local !== undefined) {
            add(jsFunByNode[e.nodeId]?.kind === 'function' ? memberExpr(local, e.output) : local);
          } else {
            jsArgExprs(e.nodeId).forEach(walk);
          }
          break;
        }
        default:
          break;
      }
    };
    walk(expr);
    return deps;
  };

  /**
   * popup-show's `done`-chain becomes following statements in the same handler (POPUPS-TARGET
   * §3) — expanded wherever an action list prints as statements, arms included.
   */
  const expandActions = (actions: HandlerAction[]): HandlerAction[] =>
    actions.flatMap((a) =>
      a.kind === 'popup-show' && a.then.length > 0
        ? [{ ...a, then: [] }, ...expandActions(a.then)]
        : // A jsfun-run is only its done-chain (EXP-003 §4 A2h): output reads inline the call
          // at their sinks, so the run itself needs no statement — unless it materializes its
          // output record (CONTROLLED-STATE §4f), which is one setter statement before the chain.
          a.kind === 'jsfun-run'
          ? a.materialize !== undefined
            ? [{ ...a, then: [] }, ...expandActions(a.then)]
            : expandActions(a.then)
          : [a]
    );
  /** The `prop-*` record a record verb sends — the runtime's `_internal.inputValues`, by value. */
  const recordDataObject = (props: Array<{ key: string; expr: ValueExpr }>): string => {
    const entries = props.map((p) => {
      const code = exprCode(p.expr, 'handler');
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p.key) ? p.key : JSON.stringify(p.key);
      return key === code ? code : `${key}: ${code}`;
    });
    return entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
  };
  /**
   * `if (t) <then> else <else>`, joined so the result parses.
   *
   * 🔴 The naive join is `${ifPart}; else ${elseArm}`, and it is wrong exactly when the then-arm
   * is a **block**: `if (c) { a; b; }; else d` puts an empty statement between the block and the
   * `else`, which is a SyntaxError, and an emitted app that does not parse is not an export. It
   * is right for a single-statement then-arm (`if (c) a; else b`), which is why the shape
   * survived — the semicolon there is the statement's own terminator.
   *
   * Both callers go through here rather than each carrying the rule: EXP-011 Tier 1.1's
   * `collection-clear` hit it the moment a Done chain made the arm a block, and `branch` has the
   * same latent shape for a two-action true arm beside a false arm (no fixture in this repo
   * reaches it today — this is a fix by inspection, not a repro).
   */
  const ifElse = (test: string, thenArm: string, elseArm: string | null): string => {
    const head = `if (${test}) ${thenArm}`;
    if (elseArm === null) return head;
    return `${head}${thenArm.startsWith('{') ? '' : ';'} else ${elseArm}`;
  };
  /**
   * Whether anything in a `Now` Read chain reads the bound instant (EXP-011 Tier 1.3) — the test
   * that decides whether the `const` is emitted at all.
   *
   * ⚠️ **A hoisted `function`, and deliberately not a `const` arrow reusing `actionExprsOf`.**
   * `actionCode` runs from `render`, which is hundreds of lines above where `actionExprsOf` is
   * declared — reading that `const` here is a `ReferenceError` at emit time, not a compile error,
   * because a `const` arrow read before its declaration *executes* is in its temporal dead zone.
   * That is the §7.2 trap this package has already been bitten by twice; a `function` declaration
   * is hoisted whole and cannot reproduce it.
   */
  function chainReadsNowLocal(actions: HandlerAction[], nodeId: string): boolean {
    const reads = (e: ValueExpr): boolean => {
      if (e.kind === 'now-out') return e.nodeId === nodeId && e.viaState === undefined;
      if (e.kind === 'date-call') return e.args.some(reads);
      if (e.kind === 'format') return e.parts.some((p) => typeof p !== 'string' && reads(p));
      if (e.kind === 'logical') return e.operands.some(reads);
      if (e.kind === 'not' || e.kind === 'truthy') return reads(e.operand);
      if (e.kind === 'list-map' || e.kind === 'list-filter') return reads(e.source);
      return false;
    };
    const inAction = (a: HandlerAction): boolean => {
      switch (a.kind) {
        case 'store-set':
        case 'globalstore-set':
          return reads(a.expr);
        case 'state-set':
          return a.expr !== undefined && reads(a.expr);
        case 'emit':
          return a.payload.some((p) => reads(p.expr));
        case 'collection-add':
          return a.entries.some((e) => reads(e.expr));
        case 'collection-clear':
          return a.then.some(inAction) || a.unchangedThen.some(inAction);
        case 'branch':
          return reads(a.cond) || a.whenTrue.some(inAction) || a.whenFalse.some(inAction);
        case 'api-call':
          return (
            a.args.some((arg) => (arg.kind === 'expr' ? reads(arg.expr) : arg.props.some((p) => reads(p.expr)))) ||
            a.then.some(inAction)
          );
        case 'http-call':
          return a.args.some((arg) => reads(arg.expr)) || a.then.some(inAction) || a.failThen.some(inAction);
        // EXP-011 Tier 2.5. ⚠️ The `default: false` below would answer "reads nothing" for a
        // link built out of the very value being asked about.
        case 'external-link':
          return (
            reads(a.link) ||
            a.then.some(inAction) ||
            a.failThen.some(inAction)
          );
        // EXP-011 §15, and the same hazard the note above names: `default: false` would answer
        // "reads nothing" for a url built out of the very value being asked about.
        case 'navigate-path':
          return (
            a.pathParams.some((p) => reads(p.expr)) ||
            a.query.some((p) => reads(p.expr)) ||
            /**
             * ⚠️ **EXP-011 §18 — added on consistency, and measured to be unreachable today.**
             * This sweep answers "does anything in a `Now`'s Read chain read the bound instant",
             * which decides whether `const … = new Date()` is emitted at all — so the firing case
             * is a Navigate To Path *inside* a Now's Done chain whose wired `Open In New Tab`
             * reads that same Now. Built, and this exporter refuses it: **"its trigger chain is
             * cyclic"**, dropping both wires.
             *
             * 🔴 **The control is what makes that a finding rather than an excuse.** The
             * identical shape with a `Set Variable` in place of this node — same Now, same Done
             * chain, same value wire back from the Now — translates and emits `const clockRead =
             * new Date();`. So the refusal is about *this node*, not about the graph, and the
             * cycle detector and `resolveExpr` disagree here in a way no other action reproduces.
             * That is unowned; this line is the defensive half of it.
             */
            (a.newTabExpr !== undefined && reads(a.newTabExpr)) ||
            a.then.some(inAction) ||
            a.failThen.some(inAction) ||
            a.completedThen.some(inAction)
          );
        case 'popup-show':
        case 'popup-close':
        case 'jsfun-run':
        case 'date-now-read':
          return a.then.some(inAction);
        default:
          return false;
      }
    };
    return actions.some(inAction);
  }
  /**
   * Whether an `External Link` prints statements rather than one expression (EXP-011 Tier 2.5).
   * A guarded link binds a `const`; an outcome chain branches. Neither is legal in an arrow's
   * expression body, and a literal-url button with no chains is neither.
   */
  const externalLinkIsStatement = (a: Extract<HandlerAction, { kind: 'external-link' }>): boolean =>
    a.guardLink ||
    a.then.length > 0 ||
    a.failThen.length > 0 ||
    // EXP-011 §14. A read `Error` puts a setter call in the failure arm, which needs the arm —
    // and for a `_self` link with no guard there is no failure to have, so no arm and no braces.
    (a.errorState !== undefined && a.newTab);

  /**
   * Whether a `Navigate To Path` prints statements rather than one expression (EXP-011 §15).
   * An omittable query binds a `const` and pushes into it; a chain prints beside the call. The
   * commonest shape — a button that goes to a fixed path — is neither, and stays
   * `onClick={() => navigate('/pricing')}`.
   */
  const navigatePathIsStatement = (a: Extract<HandlerAction, { kind: 'navigate-path' }>): boolean =>
    a.query.some((q) => q.omittable) ||
    a.then.length > 0 ||
    a.completedThen.length > 0 ||
    // EXP-011 §17. The new-tab arm binds a `const` and branches whenever anything reads the
    // outcome — a Failure chain, or an Error row whose write needs the arm to sit in.
    a.failThen.length > 0 ||
    (a.newTab && a.errorState !== undefined) ||
    // EXP-011 §18. A wired port is an `if/else` before any of that, so it is always statements —
    // and it is the one case where the answer does not depend on a single thing being read.
    a.newTabExpr !== undefined;

  const actionCode = (action: HandlerAction, indent = 0): string => {
    switch (action.kind) {
      /**
       * The url the runtime's `getRelativeURL` would build, built here instead.
       *
       * `encodeURIComponent` on every value is the runtime's own call, and it is on the query
       * side too — `router.tsx:630` encodes each leftover value before joining. A
       * `URLSearchParams` here would be the more idiomatic React and the wrong semantics: it
       * percent-encodes to a different table (a space becomes `+`), which the runtime's reader
       * then decodes back to a space, so the two would agree on the value and disagree on the
       * url the address bar shows.
       */
      /**
       * `Navigate To Path` (EXP-011 §15) — `navigate-to-path.ts`'s own url builder, line for
       * line, and **not** the `navigate` case below with different inputs.
       *
       * 🔴 **No `encodeURIComponent`, and that is the faithful answer rather than a missing
       * one.** The Router encodes both halves (`router.tsx:620, 630`) and this node encodes
       * neither — `formattedPath.replace('{id}', String(v))` and `q + '=' + v`. Encoding here
       * would make the exported app disagree with the app it came from on every value carrying
       * a url-special character, in the direction §11.3 calls being *better* than the app: the
       * export would route where the interpreter does not. `tests/navigate-to-path.test.ts`
       * pins the runtime file's side of this so the two cannot drift apart silently.
       *
       * `?? ''` on a maybe-undefined path value is likewise the runtime's own
       * `v !== undefined ? String(v) : ''`, not this exporter's invention.
       */
      case 'navigate-path': {
        const at = pad(indent);
        /** Escaped for the quoting this url will actually use, decided before substitution. */
        const isTemplate =
          action.pathParams.some((p) => p.expr.kind !== 'literal') ||
          action.query.some((q) => q.expr.kind !== 'literal');
        const lit = (value: unknown): string =>
          isTemplate
            ? String(value).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
            : String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const pathValue = (expr: ValueExpr): string => {
          const code = exprCode(expr, 'handler');
          // The runtime's own `v !== undefined ? String(v) : ''`, and not this exporter's choice.
          return maybeUndefined(expr) ? `${code} ?? ''` : code;
        };
        const filled = action.pathParams.reduce(
          (path, param) =>
            path.replace(
              `{${param.name}}`,
              param.expr.kind === 'literal' ? lit(param.expr.value) : `\${${pathValue(param.expr)}}`
            ),
          isTemplate ? lit(action.to) : action.to.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        );

        const omittable = action.query.filter((q) => q.omittable);

        /**
         * The url, built once and then handed to whichever call this node is. `pre` is the
         * omittable form's collector, which has to run before the url expression reads it.
         */
        const pre: string[] = [];
        let urlCode: string;
        if (omittable.length === 0) {
          /**
           * With every value present the query is a static suffix, exactly as the runtime's
           * `query.length >= 1 ? '?' + query.join('&') : ''` resolves for it.
           */
          const suffix =
            action.query.length === 0
              ? ''
              : '?' +
                action.query
                  .map(
                    (q) =>
                      `${lit(q.name)}=${q.expr.kind === 'literal' ? lit(q.expr.value) : `\${${exprCode(q.expr, 'handler')}}`}`
                  )
                  .join('&');
          const url = `${filled}${suffix}`;
          urlCode = isTemplate ? `\`${url}\`` : `'${url}'`;
        } else {
          /**
           * ⚠️ **An unset query parameter is omitted from the url, never sent as `name=`** — the
           * runtime's `if (internal.query[q] !== undefined)`. A `URLSearchParams` here would send
           * the key with an empty value *and* percent-encode to a different table, so it would be
           * wrong twice.
           *
           * 🔴 **The pairs go through one `for` rather than one `if` each, so every expression is
           * read exactly once.** Two reads of `formatShout({ name })` — the guard and the push —
           * would invoke it twice, which is the mistake `External Link`'s link local exists to
           * avoid one node over. Values that cannot be undefined ride the same loop and pass its
           * test unconditionally, which is also the shape of the runtime's own loop.
           */
          const local = action.queryLocal;
          // The key sits in expression position, never inside the url string, so it is quoted
          // independently of `isTemplate`.
          const pairs = action.query
            .map((q) => `['${String(q.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${exprCode(q.expr, 'handler')}]`)
            .join(', ');
          pre.push(
            `const ${local}: string[] = [];`,
            `for (const [key, value] of [${pairs}] as Array<[string, unknown]>) {`,
            `  if (value !== undefined) ${local}.push(\`\${key}=\${value}\`);`,
            '}'
          );
          urlCode = `\`${filled}\${${local}.length > 0 ? \`?\${${local}.join('&')}\` : ''}\``;
        }

        const inner = pad(indent + 2);
        const chainBody = (list: HandlerAction[]): string[] =>
          expandActions(list).map((a) => `${inner}${actionCode(a, indent + 2)};`);
        const doneChain = expandActions(action.then);
        const completedChain = expandActions(action.completedThen);
        const tail = completedChain.map((a) => `${actionCode(a, indent)};`);

        /**
         * The same-tab arm: `history.pushState` in the runtime, `navigate` here, and it cannot
         * fail — so `Completed` follows `Done` as one flat sequence and there is no arm at all.
         *
         * ⚠️ `action.newTab` reads "the new-tab arm is reachable", which a **wired** port makes
         * true whatever it delivers (§18) — so this early return is the pure in-tab node, and the
         * wired case falls through to the branch below that carries both.
         */
        const inTabCall = `navigate(${urlCode})`;
        if (!action.newTab) {
          if (pre.length === 0 && doneChain.length === 0 && completedChain.length === 0) return inTabCall;
          return [...pre, `${inTabCall};`, ...doneChain.map((a) => `${actionCode(a, indent)};`), ...tail].join(`\n${at}`);
        }

        /**
         * 🔴 **The new-tab arm, and the return value is the test** (EXP-011 §17).
         *
         * `window.open(url, '_blank')` with **no features string**, which is
         * `navigate-to-path.ts:205` exactly. `External Link` reads `navigator.userActivation`
         * instead and only because it passes `noopener` — which makes `window.open` return null
         * on success as much as on failure (DEF-016). Emitting that read here would have been
         * the fifth rule in this family copied from a neighbour it does not belong to, and it
         * would have been strictly *worse* information: measured in Chrome 151, this bare call
         * returns a Window under a gesture and null without one, while the activation getter
         * reads `false` after **every** successful open because the call consumes it (§14.1).
         *
         * ⚠️ The url is a plain string in both arms. `window.open` resolves a relative url
         * against the document, which is what the runtime hands it, so the two arms address the
         * same place by construction.
         */
        const openCall = `window.open(${urlCode}, '_blank')`;
        /**
         * Only **one** message can ever be written here, where `External Link` needs a ternary:
         * the Path gate admits a literal non-empty path, so the missing-path write is
         * unreachable and the blocked tab is the only failure left. `_internal.lastError`'s
         * short string — not the longer sentence `reportOutcomes` sends to the outcome channel.
         */
        const BLOCKED = `'The browser blocked opening a new tab'`;
        /**
         * EXP-011 §24 — the arm's `const`, on `External Link`'s rule one node over and simpler
         * for the reason above: there is only ever one message, so the binding exists to give the
         * chain something the closure can actually see, not to avoid repeating a ternary.
         */
        const readsMessage = action.errorLocal !== undefined && action.failThen.length > 0;
        const errorWrite: string[] = [
          ...(readsMessage ? [`${inner}const ${action.errorLocal} = ${BLOCKED};`] : []),
          ...(action.errorState === undefined
            ? []
            : [`${inner}${stateSetterOf(action.errorState)}(${readsMessage ? action.errorLocal : BLOCKED});`])
        ];
        const failBody = [...errorWrite, ...chainBody(action.failThen)];
        /** Whether anything looks at whether the tab opened — a chain on either arm, or the row. */
        const readsOutcome = doneChain.length > 0 || failBody.length > 0;

        /**
         * 🔴 **`Completed` prints after the branch, never inside an arm.** It fires after every
         * outcome (`node.ts:958-995`), so a copy in the `Done` arm alone would run only on
         * success — §15.4 earned this port on "the gates leave exactly one outcome reachable",
         * and this arm is exactly the change that retires that argument.
         *
         * Built once and shared with the wired form below, because the outcomes beneath the two
         * are the same outcomes: what a wire changes is *which call ran*, never what `Done` and
         * `Failure` mean once it has.
         */
        const outcomeBranch = (): string[] =>
          doneChain.length > 0 && failBody.length > 0
            ? [
                `if (${action.openedLocal}) {`,
                ...chainBody(action.then),
                `${at}} else {`,
                ...failBody,
                `${at}}`
              ]
            : doneChain.length > 0
              ? [`if (${action.openedLocal}) {`, ...chainBody(action.then), `${at}}`]
              : [`if (!${action.openedLocal}) {`, ...failBody, `${at}}`];

        /**
         * 🔴 **The wired arm (EXP-011 §18) — both of the node's two actions in one handler**,
         * which is the whole of what §17.4 deferred. The emitted shape is the runtime's own,
         * `if (this._internal.openInNewTab) { open } else { pushState }` (`navigate-to-path.ts:204`),
         * with the outcomes hoisted out from under it.
         *
         * 🔴 **The success flag is a `let` initialised to `true`, and that initialiser is a claim
         * about the in-tab arm rather than a placeholder**: `pushState` cannot fail, and the Path
         * gate above has already excluded the node's *other* failure by admitting only a literal
         * non-empty path. So in tab there is exactly one outcome and it is `Done` — which is
         * §15.4's argument, still true of *that arm*, now standing beside an arm it is false of.
         *
         * ⚠️ **The outcome branch is hoisted out of the arms rather than copied into each**, and
         * that is not tidiness. `Done` runs after either call succeeds, so a copy per arm is the
         * same chain twice — two `useSignal` sends where the graph has one, and a `Completed`
         * join that would then have to be duplicated a third time. One flag, one branch.
         *
         * ⚠️ **`!== null` rather than the bare Window the unwired form binds**: this local is
         * assigned from two arms with two different types, so it is a boolean in both or it is
         * `Window | null | boolean` in the emitted `let`.
         */
        if (action.newTabExpr !== undefined) {
          const arms = [
            `if (${exprCode(action.newTabExpr, 'handler')}) {`,
            readsOutcome ? `${inner}${action.openedLocal} = ${openCall} !== null;` : `${inner}${openCall};`,
            `${at}} else {`,
            `${inner}${inTabCall};`,
            `${at}}`
          ];
          return [
            ...pre,
            ...(readsOutcome ? [`let ${action.openedLocal} = true;`] : []),
            arms.join('\n'),
            ...(readsOutcome ? [outcomeBranch().join('\n')] : []),
            ...tail
          ].join(`\n${at}`);
        }

        /**
         * Nothing reads the outcome — no chain on either arm and no row to write — so the result
         * is not bound at all and the call stands alone, which is what the graph asked for.
         * `Completed` still runs: it fires after every outcome, and with nothing to branch on
         * there is only one place to put it.
         */
        if (!readsOutcome) {
          if (pre.length === 0 && completedChain.length === 0) return openCall;
          return [...pre, `${openCall};`, ...tail].join(`\n${at}`);
        }

        return [...pre, `const ${action.openedLocal} = ${openCall};`, outcomeBranch().join('\n'), ...tail].join(`\n${at}`);
      }
      case 'navigate': {
        /**
         * 🔴 `encodeURIComponent` is typed `string | number | boolean` — **not** `undefined` —
         * and a page parameter fed by a Variable read is `string | undefined`, because a
         * variable boots undefined. `encodeURIComponent(typedId.get())` is a TS2345, and the
         * only thing that found it was `npm run build` on the emitted app.
         *
         * ⚠️ `?? ''` rather than `String(x)`, and the runtime does neither. Handed an undefined
         * value the Router skips the substitution (leaving the literal `{id}` in the path) and
         * then appends `?id=undefined` beside it, because the leftover loop finds the key the
         * skipped branch never deleted — three readings of one function, no two agreeing. There
         * is no faithful url to emit, so this picks the one that is visibly *nothing*: an empty
         * segment matches no route and the app stays put, where `/note/undefined` would render a
         * detail page for a note called "undefined", which looks like data.
         */
        const urlValue = (expr: ValueExpr): string => {
          const code = exprCode(expr, 'handler');
          return maybeUndefined(expr) ? `encodeURIComponent(${code} ?? '')` : `encodeURIComponent(${code})`;
        };
        const filled = action.pathParams.reduce(
          (path, param) => path.replace(`{${param.name}}`, `\${${urlValue(param.expr)}}`),
          action.to
        );
        const query = action.query
          .map((param) => `${encodeURIComponent(param.name)}=\${${urlValue(param.expr)}}`)
          .join('&');
        const url = query === '' ? filled : `${filled}?${query}`;
        // A url with nothing substituted into it is the string it always was — a plain literal
        // reads better than a template with no holes, and the two are the same value.
        return action.pathParams.length === 0 && action.query.length === 0
          ? `navigate('${url}')`
          : `navigate(\`${url}\`)`;
      }
      // The optional call is the runtime's hasOutput/unwired case: a parent that passes
      // nothing gets nothing (COMPONENT-OUTPUTS-TARGET §3).
      case 'output-signal':
        return `${action.prop}?.()`;
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
      /**
       * `Clear Array` (EXP-011 Tier 1.1). With neither outcome consumed this is the bare
       * `.clear()`; with either one it becomes the runtime's own fork, tested on the length
       * *before* the call — `wasEmpty` in `collectionnode-clear.ts`.
       *
       * The empty arm deliberately omits the `.clear()`: `Collection.clear()` opens with
       * `if (this.items.length === 0) return`, so calling it there would notify nobody and
       * change nothing. Leaving it out is the same program, one statement shorter.
       */
      case 'collection-clear': {
        const collection = collectionByName.get(action.collectionName)!;
        const call = `${collection.exportName}.clear()`;
        const hasDone = action.then.length > 0;
        const hasUnchanged = action.unchangedThen.length > 0;
        if (!hasDone && !hasUnchanged) return call;
        const armCode = (armActions: HandlerAction[], lead?: string): string => {
          const list = [...(lead === undefined ? [] : [lead]), ...expandActions(armActions).map(actionCode)];
          return list.length === 1 ? list[0] : `{ ${list.join('; ')}; }`;
        };
        const test = `${collection.exportName}.peek().length > 0`;
        if (!hasUnchanged) return ifElse(test, armCode(action.then, call), null);
        if (!hasDone) return ifElse(test, call, armCode(action.unchangedThen));
        return ifElse(test, armCode(action.then, call), armCode(action.unchangedThen));
      }
      case 'emit': {
        const channel = channelByName.get(action.channelName)!;
        if (channel.payloadTypeName === null) return `${channel.exportName}.emit()`;
        const entries = action.payload.map((p) => `${p.key}: ${exprCode(p.expr, 'handler')}`).join(', ');
        return `${channel.exportName}.emit({${entries.length > 0 ? ` ${entries} ` : ''}})`;
      }
      // The slot set (POPUPS-TARGET §3); its done-chain emits as following statements via
      // expandActions, so the action itself is just the set.
      case 'popup-show':
        return `${popupSetter}(${tsLiteral(action.slotKey)})`;
      // The reserved-prop close (POPUPS-TARGET §4): the gate is the runtime's popup-in-scope
      // check — outside a popup slot the prop is absent and nothing fires, done-chain included.
      case 'popup-close': {
        const arg = action.action === undefined ? '' : tsLiteral(action.action);
        if (action.then.length === 0) return `onClose?.(${arg})`;
        const then = expandActions(action.then).map(actionCode);
        return `if (onClose) { onClose(${arg}); ${then.join('; ')}; }`;
      }
      // A materialized run prints its setter statement (§4f); the plain form is unreachable in
      // practice — every print site expands first — and kept total so the switch stays exhaustive.
      case 'jsfun-run': {
        if (action.materialize !== undefined) {
          const def = jsFunByNode[action.nodeId]!;
          return `${stateSetterOf(action.materialize)}(${def.fnName}(${jsArgsObject(def, 'handler')}))`;
        }
        return expandActions(action.then).map(actionCode).join('; ');
      }
      // The functional updates are §3.3's closure-staleness-immune forms.
      case 'state-set': {
        const setter = stateSetterOf(action.name);
        if (action.op === 'toggle') return `${setter}((v) => !v)`;
        if (action.op === 'inc') return `${setter}((v) => v + 1)`;
        if (action.op === 'dec') return `${setter}((v) => v - 1)`;
        return `${setter}(${exprCode(action.expr!, 'handler')})`;
      }
      // The first asynchronous action (RECORD-VERBS-TARGET §4a). The `done` chain follows the
      // await inside the try — which is where `reportOutcomes(…, 'done')` sits in the runtime,
      // after the store answers — and the catch is `setError`: it writes the Error output and
      // never clears it, exactly as `_internal.error` behaves.
      case 'api-call': {
        const args = action.args.map((arg) =>
          arg.kind === 'expr' ? exprCode(arg.expr, 'handler') : recordDataObject(arg.props)
        );
        const inner = pad(indent + 2);
        const body = [
          // The runtime's "Missing Record Id" (RECORD-VERBS-TARGET §1), thrown rather than
          // branched so it lands in the catch below — which is already the graph's own error
          // path — skips the call and the done chain, and narrows the id for the call itself.
          // `!id` is exactly the runtime's set — `setModelID` clears the binding on `undefined`,
          // `null` **and** `''` alike — and unlike `=== undefined` it does not become a
          // no-overlap comparison (TS2367) when the id is a plain `string`, which it is whenever
          // the graph wires a form field rather than a component prop.
          ...(action.guardId
            ? [
                `${inner}if (${SIMPLE_REF.test(args[0]) ? `!${args[0]}` : `!(${args[0]})`}) throw new Error('Missing Record Id');`
              ]
            : []),
          `${inner}await ${action.fnName}(${args.join(', ')});`,
          ...expandActions(action.then).map((a) => `${inner}${actionCode(a, indent + 2)};`)
        ];
        return [
          'try {',
          ...body,
          `${pad(indent)}} catch (error) {`,
          `${inner}${stateSetterOf(action.errorState)}(error instanceof Error ? error.message : String(error));`,
          `${pad(indent)}}`
        ].join('\n');
      }
      /**
       * The second asynchronous action (EXP-011 Tier 1.2), and the first with three outcomes.
       *
       * The module throws only where **no answer arrived** — no URL, a network error, a timeout
       * — so the catch is the arm where `Response` and `Status Code` keep what they held, which
       * is the interpreter's own behaviour and is reproduced here by not writing the row. A
       * non-2xx *did* answer: `processResponse` runs before `doFetch` reports `failure`, so the
       * row is written and then the failure arm runs.
       *
       * Both failure arms bind `message` first, which is what makes the duplicated failure chain
       * two copies of one thing rather than two things.
       */
      case 'http-call': {
        const names = httpNamesOf(action.nodeId);
        const inner = pad(indent + 2);
        const deeper = pad(indent + 4);
        const argList = action.args.map((a) => {
          const code = exprCode(a.expr, 'handler');
          return code === a.param ? code : `${a.param}: ${code}`;
        });
        const failArm = (at: string): string[] => [
          `${at}${stateSetterOf(action.errorState)}(${names.messageLocal});`,
          ...expandActions(action.failThen).map((a) => `${at}${actionCode(a, indent + 4)};`)
        ];
        return [
          'try {',
          `${inner}const ${names.answerLocal} = await ${action.fnName}(${argList.length > 0 ? `{ ${argList.join(', ')} }` : ''});`,
          ...(action.materialize !== undefined
            ? [`${inner}${stateSetterOf(action.materialize)}(${names.answerLocal});`]
            : []),
          // The failure arm is never empty — it writes the Error row, which the runtime writes
          // whether or not anything reads it — so a request with no done chain inverts the test
          // rather than printing an empty block.
          ...(action.then.length > 0
            ? [
                `${inner}if (${names.answerLocal}.ok) {`,
                ...expandActions(action.then).map((a) => `${deeper}${actionCode(a, indent + 4)};`),
                `${inner}} else {`
              ]
            : [`${inner}if (!${names.answerLocal}.ok) {`]),
          `${deeper}const ${names.messageLocal} = ${names.answerLocal}.error;`,
          ...failArm(deeper),
          `${inner}}`,
          `${pad(indent)}} catch (error) {`,
          `${inner}const ${names.messageLocal} = error instanceof Error ? error.message : String(error);`,
          ...failArm(inner),
          `${pad(indent)}}`
        ].join('\n');
      }
      /**
       * `External Link` (EXP-011 Tier 2.5) — `window.open`, with the interpreter's own two
       * guards and no more.
       *
       * The emitted form is the runtime's control flow flattened into one condition, which it is
       * entitled to be because the two failures are indistinguishable once `Error` is out of the
       * slice: "no link" and "the browser blocked the tab" both run the Failure chain and nothing
       * else. So `opened` never needs a name.
       *
       * ```
       * const talkHref = speakerUrl;
       * if (talkHref !== undefined && talkHref !== null && talkHref !== '' &&
       *     (window.open(talkHref, '_blank', 'noopener,noreferrer'),
       *      navigator.userActivation?.isActive !== false)) { …then }
       * else { …failThen }
       * ```
       *
       * 🔴 **`&&` is the short circuit the runtime has.** With no link the interpreter reports
       * failure and returns *before* `window.open`, and `window.open('')` opens a blank tab — so
       * a guard that ran the call anyway would open a window the app never opens. That is why
       * the guard survives even when nothing is wired to Failure.
       *
       * 🔴 **DEF-016 — the call is no longer the test.** It was, and that was a defect on both
       * sides: `noopener` makes `window.open` return null on success as much as on failure, so
       * `if (window.open(…))` ran the Failure chain on every tab it opened. The runtime now reads
       * `navigator.userActivation` and this emits the same read. See `activationTest` below for
       * why the comma, and why not `||`.
       *
       * ⚠️ **With Open In New Tab off there is no blocked case.** `_self` replaces the page
       * rather than opening a tab, so the runtime makes no blocked claim for it at all. The call
       * is a statement of its own there and success is the guard alone — no activation read.
       */
      case 'external-link': {
        const at = pad(indent);
        const inner = pad(indent + 2);
        const ref = action.guardLink ? action.local : exprCode(action.link, 'handler');
        const target = action.newTab ? '_blank' : '_self';
        const params = action.newTab ? 'noopener,noreferrer' : '';
        const openCall = `window.open(${ref}, '${target}', '${params}')`;
        const guard = action.guardLink
          ? `${action.local} !== undefined && ${action.local} !== null && ${action.local} !== ''`
          : undefined;

        /**
         * DEF-016. The success test for a new tab is **not** the return value.
         *
         * `noopener` — which the features string above always carries for `_blank` — makes
         * `window.open` return null by specification, on success as much as on failure. The
         * runtime therefore reads `navigator.userActivation` instead, before the call, and this
         * emits the same test: `!== false` so that a host without the API (Safari before 16.4)
         * reports done rather than claiming a block it cannot see, which is the runtime's
         * degradation exactly.
         *
         * 🔴 **The comma is doing real work and is not a tidiness choice.** The open must still
         * happen — and must still happen only *after* the link guard, because `window.open('')`
         * opens a blank tab — while the value the `if` reads has to come from the activation
         * instead. `(call, test)` is what keeps one `else` for a failure chain that would
         * otherwise be duplicated into two arms.
         *
         * ⚠️ Not `openCall || activationTest`. That reads truthy on a browser that ignored
         * `noopener` and returned a Window while activation was false — where the runtime
         * reports failure. EXP-011 §11.3: the export must not work *better* than the app.
         */
        /**
         * 🔴 **The activation is read into a local BEFORE the call, because the call consumes
         * it.** This read used to sit inside the comma, after `window.open` — and measured in
         * Chrome 151 that is `false` on every tab the app successfully opens: one control arm
         * varying only whether the call sits between two reads of the getter gave `true, true`
         * without it and `true, false` with it, while the tab count rose. Read there, the
         * emitted app ran its Failure chain on success — DEF-016's exact symptom, on the export
         * side, introduced by DEF-016's own fix.
         *
         * Hoisting it above the empty-link guard as well as above the call is safe and is what
         * keeps one failure arm: the getter has no side effects (the control arm's two reads
         * both answered `true`), and nothing between the two points can change it. The runtime
         * reads it after its own guard, so the only difference is a read taken where the
         * interpreter would not have bothered — unobservable.
         *
         * `=== false` rather than a truthiness test is the runtime's own three-way degradation:
         * no `navigator`, no `userActivation`, or an `isActive` that is not a boolean all mean
         * *no claim*, and the node reports done. `blocked` is only ever true off a value that
         * was actually read.
         */
        const blockedRead = `const ${action.blockedLocal} = navigator.userActivation?.isActive === false;`;
        const openAndTest = `(${openCall}, !${action.blockedLocal})`;

        /**
         * The condition under which the `done` chain runs. For a new tab the call is *part of*
         * it — `&&` is the runtime's own short circuit, and `window.open('')` opens a blank tab,
         * so the guard has to come first. For `_self` the call cannot report a failure, so it
         * becomes a statement inside the arm instead.
         */
        const body = (actions: HandlerAction[]): string[] =>
          expandActions(actions).map((a) => `${inner}${actionCode(a, indent + 2)};`);
        const block = (head: string, ...rest: string[]): string => [head, ...rest, `${at}}`].join('\n');

        /**
         * EXP-011 §14 — the `Error` write, and the only place in this action where the node's
         * two failures are told apart.
         *
         * Everywhere else they are one arm, because "no link" and "the browser blocked the tab"
         * both run the Failure chain and nothing else. `Error` is the one port that
         * distinguishes them, so the arm re-tests the link to pick the message:
         *
         * - **both failures live** (a guarded link opening a new tab) — the ternary. Its test is
         *   the guard's three comparisons rather than a truthiness check, because that is the
         *   set the runtime refuses on and a truthy test would give the wrong message for any
         *   falsy non-empty value an `unknown` link can carry.
         * - **only one is live** — the literal string, because the other cannot fire: `_self`
         *   makes no blocked claim at all, and a literal link is provably non-empty.
         * - **neither** (a literal link, `_self`) — nothing, and the row stays `undefined`
         *   forever, which is exactly what the runtime's unwritten getter returns.
         *
         * Both strings are `_internal.lastError` verbatim. ⚠️ They are **not** the messages
         * `reportOutcome` sends — the blocked one there is a longer sentence about user actions,
         * and it goes to the outcome channel, never to this port.
         */
        const NO_LINK = `'No link to open'`;
        const BLOCKED = `'The browser blocked opening a new tab'`;
        const hasFailure = action.guardLink || action.newTab;
        const message =
          action.guardLink && action.newTab
            ? `${action.local} === undefined || ${action.local} === null || ${action.local} === '' ? ${NO_LINK} : ${BLOCKED}`
            : action.guardLink
              ? NO_LINK
              : BLOCKED;
        /**
         * EXP-011 §24 — the arm's own `const`, emitted where the chain beneath it reads `Error`.
         *
         * 🔴 **The message is bound once and everything reads that binding**, which is the whole
         * point rather than a tidiness choice: the guarded-new-tab form is a ternary that
         * re-tests the link, and printing it again at every sink would be the same decision
         * written in several places, free to drift apart. It also has to be a `const` in the arm
         * rather than a state read — `setLinkError(...)` does not change `linkError` inside the
         * closure that just called it, so the chain would show the previous failure's message.
         *
         * The `failThen` test is what keeps it out of a configuration that cannot fail: with a
         * literal link and `_self` the arm is dropped, and a `const` nothing reads would be an
         * unused variable in a file that has to compile.
         */
        const readsMessage = action.errorLocal !== undefined && action.failThen.length > 0;
        const errorWrite: string[] = !hasFailure
          ? []
          : [
              ...(readsMessage ? [`${inner}const ${action.errorLocal} = ${message};`] : []),
              ...(action.errorState === undefined
                ? []
                : [`${inner}${stateSetterOf(action.errorState)}(${readsMessage ? action.errorLocal : message});`])
            ];
        /**
         * The failure arm is the write and then the chain — so a node whose `Error` is read has
         * an arm even with nothing wired to `Failure`, which is the runtime's own behaviour:
         * `_internal.lastError` is written whether or not anything is listening. `http-call`'s
         * arm is never empty for the same reason.
         */
        const failBody = [...errorWrite, ...body(action.failThen)];

        // With no chain on either outcome and no row to write, nothing reads the test, so the
        // activation is not read at all — the call alone is what the graph asked for.
        const noChains = action.then.length === 0 && failBody.length === 0;
        const successTest = noChains ? openCall : openAndTest;
        const opened = action.newTab ? [guard, successTest].filter(Boolean).join(' && ') : (guard ?? '');

        // Each entry's FIRST line carries no base indent — the join below adds it, and the
        // caller pads the first. Continuation lines carry the absolute column (http-call's rule).
        const statements: string[] = [];
        if (action.guardLink) statements.push(`const ${action.local} = ${exprCode(action.link, 'handler')};`);
        // Read only where the emitted `if` actually tests it — a `_self` link makes no blocked
        // claim, and a call nothing branches on needs no test.
        if (action.newTab && !noChains) statements.push(blockedRead);

        const selfCall = action.newTab ? [] : [`${inner}${openCall};`];
        if (opened === '') {
          // `_self` with a literal link: nothing can fail and nothing needs testing.
          statements.push(`${openCall};`, ...body(action.then).map((l) => l.slice(inner.length)));
        } else if (action.then.length === 0 && failBody.length === 0) {
          statements.push(action.newTab ? `${opened};` : `if (${opened}) ${openCall};`);
        } else if (failBody.length === 0) {
          statements.push(block(`if (${opened}) {`, ...selfCall, ...body(action.then)));
        } else if (action.then.length === 0 && action.newTab) {
          statements.push(block(`if (!(${opened})) {`, ...failBody));
        } else {
          statements.push(
            [
              `if (${opened}) {`,
              ...selfCall,
              ...body(action.then),
              `${at}} else {`,
              ...failBody,
              `${at}}`
            ].join('\n')
          );
        }
        // A single expression keeps the semicolon the handler adds; anything else prints its own.
        return statements.length === 1 && !externalLinkIsStatement(action)
          ? statements[0].replace(/;$/, '')
          : statements.join(`\n${at}`);
      }
      /**
       * `Now`'s Read (EXP-011 Tier 1.3) — read the clock once, then run the chain.
       *
       * 🔴 **The instant is bound to a local, and the binding is the correctness.** Two bare
       * `new Date()` calls in one chain are two different instants that can straddle a
       * millisecond, so `Timestamp` and `ISO String` read in the same chain could disagree about
       * which second it is — where the interpreter reads the clock once and publishes three views
       * of it. The local is also what a chain read *must* say: `setNow(...)` does not change the
       * row inside the closure that called it.
       *
       * The `const` is emitted only where something reads it. A Read whose outputs nobody
       * consumes is a no-op in the interpreter too — `_read` flags three outputs dirty and
       * nothing is listening — so emitting the chain alone is exact rather than a shortcut.
       */
      case 'date-now-read': {
        const at = pad(indent);
        const readsLocal = chainReadsNowLocal(action.then, action.nodeId);
        const statements: string[] = [];
        if (action.materialize !== undefined || readsLocal) {
          statements.push(`const ${action.local} = new Date()`);
        }
        if (action.materialize !== undefined) {
          statements.push(`${stateSetterOf(action.materialize)}(${action.local})`);
        }
        statements.push(...expandActions(action.then).map((a) => actionCode(a, indent)));
        // An empty Read is `new Date()` discarded — what the node does when nothing consumes it.
        return statements.length > 0 ? statements.join(`;\n${at}`) : 'new Date()';
      }
      case 'branch': {
        const armCode = (armActions: HandlerAction[]): string => {
          const list = expandActions(armActions);
          return list.length === 1 ? actionCode(list[0]) : `{ ${list.map(actionCode).join('; ')}; }`;
        };
        const cond = exprCode(action.cond, 'handler');
        if (action.whenTrue.length === 0) {
          const negated = SIMPLE_REF.test(cond) ? `!${cond}` : `!(${cond})`;
          return ifElse(negated, armCode(action.whenFalse), null);
        }
        return ifElse(cond, armCode(action.whenTrue), action.whenFalse.length > 0 ? armCode(action.whenFalse) : null);
      }
    }
  };
  /**
   * A branch statement cannot be an arrow's expression body, and Prettier never leaves a
   * non-empty block on one line — so a handler containing one takes the multi-line block form,
   * indented at the attribute's own column. A gated popup close (`if (onClose) { … }`) is the
   * same statement shape.
   */
  const handlerArrow = (actions: HandlerAction[], param: string, indent: number): string => {
    const expanded = expandActions(actions);
    const statements = expanded.map(actionCode);
    // A record verb's call is awaited, so the handler it lands in is `async` — and its try/catch
    // is a statement, which takes the same block form a branch does (RECORD-VERBS-TARGET §4a).
    const isAsync = expanded.some((a) => a.kind === 'api-call' || a.kind === 'http-call');
    const head = isAsync ? `async ${param}` : param;
    // A Clear Array that owes either outcome chain prints as an `if`, which is a statement for
    // exactly the reason a branch is — an arrow with `=> if (…)` as its expression body does not
    // parse. Without this the one-action case at the foot of this function emits a syntax error.
    const isStatement = (a: HandlerAction) =>
      a.kind === 'branch' ||
      (a.kind === 'popup-close' && a.then.length > 0) ||
      (a.kind === 'collection-clear' && (a.then.length > 0 || a.unchangedThen.length > 0)) ||
      /**
       * 🔴 `Now`'s Read declares a `const`, and a `const` is a statement (EXP-011 Tier 1.3).
       * `() => const clockRead = new Date(); setClock(clockRead)` does not parse — the fourth
       * instance of this file's oldest hazard, after the `}; else`, the gated popup close and the
       * Clear Array `if`.
       *
       * ⚠️ It survived a suite that parses every emitted file, because every fixture that reached
       * it wired the Read to a button **that already had another action** — two actions take the
       * `{ a; b; }` form at the foot of this function and parse fine. Only a Read that is the
       * *whole* handler reaches the expression body, and that is the shape a real project has.
       * Found by building the exported app, not by the tests.
       */
      a.kind === 'date-now-read' ||
      /**
       * EXP-011 Tier 2.5, and the fifth instance of the same hazard. An `External Link` is a
       * statement whenever it binds its link to a `const` or branches on the outcome; a bare
       * `window.open(…)` with no guard and no chains is an expression and keeps its semicolon.
       * Asking precisely is what keeps the commonest shape — a button that opens a literal url —
       * emitting as `onClick={() => window.open(…)}` rather than a block.
       */
      (a.kind === 'external-link' && externalLinkIsStatement(a)) ||
      /**
       * EXP-011 §15, and the sixth instance of this file's oldest hazard. A `const` for the
       * query collector, or a chain printed beside the call, is a statement; a bare
       * `navigate('/pricing')` is an expression and keeps its semicolon.
       */
      (a.kind === 'navigate-path' && navigatePathIsStatement(a));
    if (isAsync || expanded.some(isStatement)) {
      // A try/catch is a statement, not an expression: it prints at the handler's own column and
      // takes no terminator. Every other action keeps the semicolon the existing goldens pin.
      const body = expanded
        .map((a) =>
          a.kind === 'api-call' ||
          a.kind === 'http-call' ||
          (a.kind === 'external-link' && externalLinkIsStatement(a)) ||
          (a.kind === 'navigate-path' && navigatePathIsStatement(a))
            ? `${pad(indent + 2)}${actionCode(a, indent + 2)}`
            : // A `Now` Read prints several statements and needs the column too, or its second
              // and third lines start at column 0 (EXP-011 Tier 1.3). Valid either way — this is
              // about the emitted code being read by a person, which is EXP-002's whole standard.
              `${pad(indent + 2)}${actionCode(a, a.kind === 'date-now-read' ? indent + 2 : 0)};`
        )
        .join('\n');
      return `${head} => {\n${body}\n${pad(indent)}}`;
    }
    return statements.length === 1 ? `${head} => ${statements[0]}` : `${head} => { ${statements.join('; ')}; }`;
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
  if (plan.popups.length > 0 && !reactImports.includes('useState')) reactImports.push('useState');
  if (referencedStateVars.length > 0 && !reactImports.includes('useState')) reactImports.push('useState');
  if (
    (plan.syncEffects.length > 0 || plan.pushEffects.length > 0 || plan.branchEffects.length > 0) &&
    !reactImports.includes('useEffect')
  ) {
    reactImports.push('useEffect');
  }
  if (radioNameLocals.size > 0) reactImports.push('useId');
  if (reactImports.length > 0) externalImports.push(`import { ${reactImports.sort().join(', ')} } from 'react';`);
  if (plan.popups.length > 0) externalImports.push(`import { createPortal } from 'react-dom';`);
  // One import line for whichever router hooks survived, in a stable order — three separate
  // `import … from 'react-router-dom'` lines would be legal and would churn the diff.
  const routerHooks = [
    ...(usesNavigate ? ['useNavigate'] : []),
    ...(usesPageParams ? ['useParams', 'useSearchParams'] : [])
  ];
  if (routerHooks.length > 0) externalImports.push(`import { ${routerHooks.join(', ')} } from 'react-router-dom';`);

  const internalImports = new Map<string, string>(); // specifier → line
  // One import per api module, carrying the reads and the writes together — the record verbs
  // land in the same module as the query on the same class (RECORD-VERBS-TARGET §4d). Only the
  // fetch needs its item type imported; a mutation's argument type is inferred from the call.
  const stubModules = new Map<string, { queries: QueryPlan[]; mutations: MutationPlan[] }>();
  const stubModule = (moduleBase: string) => {
    let entry = stubModules.get(moduleBase);
    if (entry === undefined) stubModules.set(moduleBase, (entry = { queries: [], mutations: [] }));
    return entry;
  };
  for (const query of plan.queries) stubModule(query.moduleBase).queries.push(query);
  for (const mutation of plan.mutations) stubModule(mutation.moduleBase).mutations.push(mutation);
  for (const [moduleBase, { queries, mutations }] of stubModules) {
    const specifier = `${relRoot}/api/${moduleBase}`;
    const fetchNames = [...new Set(queries.map((q) => q.fetchName))].sort();
    const fnNames = [...new Set(mutations.map((m) => m.fnName))].sort();
    const typeNames = [...new Set(queries.map((q) => q.typeName))].sort();
    internalImports.set(
      specifier,
      `import { ${[...fetchNames, ...fnNames, ...typeNames.map((t) => `type ${t}`)].join(', ')} } from '${specifier}';`
    );
  }
  // The session module is not keyed on anything — a project has one session — so every
  // user-family node in this component imports from the same specifier (USER-FAMILY-TARGET §4d).
  if (plan.sessionCalls.length > 0) {
    const specifier = `${relRoot}/api/session`;
    const fnNames = [...new Set(plan.sessionCalls.map((c) => c.fnName))].sort();
    internalImports.set(specifier, `import { ${fnNames.join(', ')} } from '${specifier}';`);
  }
  // EXP-011 Tier 1.2. One module for every HTTP Request in the project — there is nothing to key
  // it on, the way the session module has nothing. The result type is imported only where a state
  // row is typed by it, which is what keeps a fire-and-forget request's import to one name.
  if (plan.httpCalls.length > 0) {
    const specifier = `${relRoot}/api/http`;
    const fnNames = [...new Set(plan.httpCalls.map((c) => c.fnName))].sort();
    const typeNames = [
      ...new Set(
        plan.httpCalls
          .filter((c) => referencedStateVars.some((v) => v.originNodeId === c.nodeId && v.origin === 'http'))
          .map((c) => c.typeName)
      )
    ].sort();
    internalImports.set(
      specifier,
      `import { ${[...fnNames, ...typeNames.map((t) => `type ${t}`)].join(', ')} } from '${specifier}';`
    );
  }
  /**
   * EXP-011 Tier 1.3. One module for the whole project, like the session's and HTTP's — but
   * unlike those two it is the *same text* everywhere, so only the helpers this component
   * actually calls are named in the import.
   */
  if (usedDateHelpers.size > 0) {
    const specifier = `${relRoot}/lib/date`;
    internalImports.set(specifier, `import { ${[...usedDateHelpers].sort().join(', ')} } from '${specifier}';`);
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
  /**
   * What the JSX position a binding lands in can actually hold (EXP-011 §10).
   *
   * Only an *untyped* source reads this — everything else already emits code with a type the
   * position accepts. `truthy` is the position whose caller spells its own `!`/`!!`, so the
   * value arrives raw and the caller coerces; `boolean` is the position that must receive a
   * boolean expression, so the coercion is here.
   */
  type Sink = 'text' | 'string' | 'boolean' | 'truthy' | 'number' | 'opaque';

  /** The DOM attribute's own type, for the `attr:` roles CONTENT_PARAMS mints. */
  const ATTR_SINK: Record<string, Sink> = {
    src: 'string',
    srcSet: 'string',
    alt: 'string',
    poster: 'string',
    type: 'string',
    value: 'string',
    placeholder: 'string',
    defaultValue: 'string',
    defaultChecked: 'boolean',
    min: 'number',
    max: 'number',
    step: 'number',
    maxLength: 'number',
    controls: 'boolean',
    autoPlay: 'boolean',
    muted: 'boolean',
    loop: 'boolean'
  };

  /** The sink a declared TypeScript prop type stands for — anything else is `opaque`. */
  const sinkOfTsType = (tsType: string | undefined): Sink => {
    const bare = (tsType ?? '').replace(/\s*\|\s*undefined/g, '').trim();
    if (bare === 'string') return 'string';
    if (bare === 'boolean') return 'boolean';
    if (bare === 'number') return 'number';
    // `any` and `unknown` take the value as it is; so does a union this vocabulary cannot fold.
    return bare === 'any' || bare === 'unknown' ? 'text' : 'opaque';
  };

  /** The variable name when this source is a Variable with no statically-typed writer. */
  const untypedVariableOf = (source: BindingSource): string | null =>
    source.kind === 'store' && source.untyped === true ? source.variableName : null;

  /**
   * The `store.key` when this source is a Global Store key this analysis could not type as
   * `string`/`number` (EXP-011 §10.5) — the Variable rule above, one construct over. Same
   * `unknown` at the sink, so the same table answers it.
   */
  const untypedStoreKeyOf = (source: BindingSource): string | null =>
    source.kind === 'store-key' && source.untyped === true ? `${source.storeName}.${source.key}` : null;

  /** The parameter name when this source is a bare `Page Inputs` read (EXP-011 Tier 2.5). */
  const pageParamOf = (source: BindingSource): string | null =>
    source.kind === 'computed' && source.expr.kind === 'page-param' ? source.expr.name : null;

  const rawBindingExpr = (source: BindingSource): string | null => {
    if (source.kind === 'prop') return propName(source.name);
    if (source.kind === 'store') return hookLocals.get(source.variableName) ?? null;
    if (source.kind === 'store-key') return storeKeyLocals.get(storeKeyId(source.storeName, source.key)) ?? null;
    if (source.kind === 'computed') return exprCode(source.expr, 'render');
    return null;
  };

  /**
   * The code a binding puts in one JSX position — coerced there when the source is untyped.
   *
   * 🔴 **The sink argument is required so a new position cannot forget the question.** An
   * untyped Variable is a `value<unknown>`, and the four sessions that each added a node type
   * to `typeOfSource` were each paying for the absence of this: the type belongs where the
   * value lands, not in a table of writers that has to know every readable node in the
   * product. A position that cannot state what it holds refuses the value and says so, which
   * is the one thing the old drop did right.
   */
  const bindingExpr = (source: BindingSource, sink: Sink): string | null => {
    const base = rawBindingExpr(source);
    if (base === null) return base;
    /**
     * A url parameter is `string | undefined`, which is a **narrower** question than §10's, and
     * gets a narrower table (EXP-011 Tier 2.5).
     *
     * 🔴 **Four of the six sinks need nothing, and adding `String(x ?? '')` to them would be
     * noise dressed as rigour.** §10 wraps an untyped Variable because it is `unknown` — it
     * could be an object, and a sink has to be told what to do with one. Here the value is
     * already a string or already absent, and every emitted sink is optional: a component prop
     * prints as `Name?: string`, a DOM string attribute takes `undefined` by omitting itself,
     * and React renders `undefined` in a child position as nothing — which is precisely what the
     * runtime's Text node does with it ("an empty value renders nothing rather than the words
     * null or undefined", text.ts).
     *
     * The two that do need an answer get the same one §10 gives them, for the same reasons.
     */
    if (pageParamOf(source) !== null) {
      switch (sink) {
        case 'text':
        case 'string':
        case 'truthy':
          return base;
        // `defaultChecked`, `muted`, `controls` and their kin are boolean attributes, and the
        // runtime coerces `!!value` at the port — so the cast is the runtime's, not an invention.
        case 'boolean':
          return `!!(${base})`;
        // `maxLength={pageQuery.get("n") ?? pageParams.n}` is not TypeScript, and `Number()`
        // around it would be this exporter inventing what a non-numeric url segment means.
        case 'number':
        case 'opaque':
          return null;
      }
    }
    // §10.5. A `boolean`/`unknown` store key is the same `unknown` at the sink as an untyped
    // Variable, and it lands in the same JSX positions — so it takes the same table rather than
    // a second one that could drift from it.
    if (untypedVariableOf(source) === null && untypedStoreKeyOf(source) === null) return base;
    switch (sink) {
      // The runtime's Text node puts whatever the variable holds through `String()` on its way
      // to the DOM, and a string attribute reaches the DOM the same way (§8.2's coercion).
      case 'text':
      case 'string':
        return `String(${base} ?? '')`;
      // `enabled` and its kin coerce `!!value` in the runtime; `truthy` callers spell that.
      case 'boolean':
        return SIMPLE_REF.test(base) ? `!!${base}` : `!!(${base})`;
      case 'truthy':
        return base;
      // A number sink would need a cast the runtime does not perform — `maxLength` receives
      // whatever the port was given, and asserting `Number()` here would invent a rounding
      // rule. `opaque` is a declared prop type this vocabulary cannot fold into any of these.
      case 'number':
      case 'opaque':
        return null;
    }
  };

  /** Why a binding produced no code, so a refused untyped source does not read as a missing one. */
  const noSourceReason = (source: BindingSource, sink: Sink): string => {
    if (sink === 'number' || sink === 'opaque') {
      const variable = untypedVariableOf(source);
      if (variable !== null) {
        return `reads variable "${variable}", which has no statically-typed writer, into a sink this slice cannot coerce it to`;
      }
      // EXP-011 Tier 2.5. Distinguishable from the line above and from "no statically known
      // source" — three refusals with three different fixes, which §10.4 is the rule about.
      const param = pageParamOf(source);
      if (param !== null) {
        return `reads page parameter "${param}", which the url delivers as text or not at all, into a sink this slice will not invent a cast for`;
      }
      // EXP-011 §10.5, the fourth of these — and distinguishable from the variable line above
      // because the fix is different: a store key is typed by what *writes* it, so the reader
      // is told which store and key to look at, not which variable.
      const storeKey = untypedStoreKeyOf(source);
      if (storeKey !== null) {
        return `reads store key "${storeKey}", which has no statically-typed writer, into a sink this slice cannot coerce it to`;
      }
    }
    return 'has no statically known source';
  };

  /** The state param a stateful control replaces with its controlled attribute (§4c). */
  const CONTROL_STATE_PARAM: Record<string, string> = {
    checkbox: 'checked',
    range: 'value',
    select: 'value',
    input: 'startValue'
  };

  const contentAttrs = (node: NodeIR): string[] => {
    const roles = CONTENT_PARAMS[node.type] ?? {};
    // A stateful control's state param prints as the controlled attribute, never the
    // uncontrolled default (§4c) — the boot value lives in useState.
    const stateParam = controlVarByNode.has(node.id)
      ? CONTROL_STATE_PARAM[plan.roleOf[node.id] ?? '']
      : undefined;
    const attrs = new Map<string, string>();
    for (const param of node.parameters) {
      if (param.name === stateParam) continue;
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
      if (toProperty === stateParam) continue;
      const role = roles[toProperty];
      if (role === 'attr-not:disabled') {
        const code = negatedBindingExpr(source);
        if (code === 'omit') continue; // folded to always-enabled
        if (code !== null) attrs.set('disabled', code === 'disabled' ? code : `disabled={${code}}`);
        else {
          notes.push(`${plan.path}: wire into ${node.id}.${toProperty} has no statically known source — dropped, reported`);
          defer(node.id, `the wire into "${toProperty}"`, 'has no statically known source', source);
        }
        continue;
      }
      if (!role?.startsWith('attr:')) continue;
      const attr = role.slice('attr:'.length);
      // A boot-value read renders as the attribute's absence — undefined delivered and nothing
      // delivered are the same rendered control (COMPONENT-OBJECT-TARGET §3; noted at plan).
      if (source.kind === 'computed' && source.expr.kind === 'undefined') continue;
      const sink = ATTR_SINK[attr] ?? 'opaque';
      const expr = bindingExpr(source, sink);
      if (expr !== null) attrs.set(attr, `${attr}={${expr}}`);
      else {
        notes.push(
          `${plan.path}: wire into ${node.id}.${toProperty} ${noSourceReason(source, sink)} — dropped, reported`
        );
        defer(node.id, `the wire into "${toProperty}"`, noSourceReason(source, sink), source);
      }
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
      // enabled ← boot value: `!!undefined` is the runtime's own coercion — statically disabled.
      if (expr.kind === 'undefined') return 'disabled';
      if (expr.kind === 'not') {
        const operand = exprCode(expr.operand, 'render');
        return SIMPLE_REF.test(operand) ? `!!${operand}` : `!!(${operand})`;
      }
      if (expr.kind === 'logical') return `!(${exprCode(expr, 'render')})`;
    }
    const base = bindingExpr(source, 'truthy');
    if (base === null) return null;
    return SIMPLE_REF.test(base) ? `!${base}` : `!(${base})`;
  };

  const handlerAttrs = (node: NodeIR, attrIndent: number): string[] => {
    const attrs: string[] = [];
    const roleEvents = ROLE_EVENT_ATTRS[plan.roleOf[node.id]] ?? {};
    for (const [port, actions] of Object.entries(plan.handlers[node.id] ?? {})) {
      // A stateful control's Changed chain merges into its controlled onChange (§4c).
      if (port === 'onChange' && controlVarByNode.has(node.id)) continue;
      const eventAttr = roleEvents[port] ?? EVENT_ATTRS[port];
      if (!eventAttr) {
        notes.push(`${plan.path}: signal ${node.id}.${port} has no DOM event equivalent — dropped, reported`);
        defer(node.id, `the "${port}" signal`, 'has no DOM event equivalent');
        continue;
      }
      attrs.push(`${eventAttr}={${handlerArrow(actions, '()', attrIndent)}}`);
    }
    return attrs;
  };

  /**
   * The wired-onTextChanged rule: writes on change, and nothing else — the input stays native.
   * A *stateful* control (CONTROLLED-STATE §4c) instead gets the controlled onChange: the
   * user-path state write leads, then the wired Changed chain in statement order.
   */
  const changeAttrs = (node: NodeIR, attrIndent: number): string[] => {
    const stateVar = controlVarByNode.get(node.id);
    const own = plan.changeHandlers[node.id] ?? [];
    if (stateVar === undefined) {
      if (own.length === 0) return [];
      return [`onChange={${handlerArrow(own, '(event)', attrIndent)}}`];
    }
    const role = plan.roleOf[node.id];
    const eventExpr: ValueExpr =
      role === 'input'
        ? { kind: 'input-text', inputId: node.id }
        : {
            kind: 'control-event',
            controlId: node.id,
            form: role === 'checkbox' ? 'checked' : role === 'range' ? 'number' : 'string'
          };
    const chain = [...own, ...((plan.handlers[node.id] ?? {})['onChange'] ?? [])];
    const actions: HandlerAction[] = [{ kind: 'state-set', name: stateVar.name, expr: eventExpr }, ...chain];
    return [`onChange={${handlerArrow(actions, '(event)', attrIndent)}}`];
  };

  /** Truthiness spelling for a mounted condition: boolean-typed sources print bare; anything
   *  else coerces `!!` so a number 0 can never leak into the JSX (the `0 &&` render trap). */
  const boolTypedSource = (source: BindingSource): boolean => {
    if (source.kind === 'prop') return plan.props.find((p) => p.name === source.name)?.tsType === 'boolean';
    if (source.kind !== 'computed') return false;
    const e = source.expr;
    if (e.kind === 'not') return true;
    if (e.kind === 'literal') return typeof e.value === 'boolean';
    if (e.kind === 'state-get') return (stateVarByName.get(e.name)?.tsType.replace(' | undefined', '') ?? '') === 'boolean';
    if (e.kind === 'prop') return plan.props.find((p) => p.name === e.name)?.tsType === 'boolean';
    if (e.kind === 'jsfun-out') return e.fold === 'boolean';
    return false;
  };
  const truthinessCode = (source: BindingSource): string | null => {
    const base = bindingExpr(source, 'truthy');
    if (base === null) return null;
    if (boolTypedSource(source)) return base;
    return SIMPLE_REF.test(base) ? `!!${base}` : `!!(${base})`;
  };
  const negatedVisibleCode = (source: BindingSource): string | null => {
    const base = bindingExpr(source, 'truthy');
    if (base === null) return null;
    return SIMPLE_REF.test(base) ? `!${base}` : `!(${base})`;
  };
  let usesJoinClasses = false;
  /** The className attribute with the visible sink applied (§4b): a live toggle of the
   *  hidden-keep-space class, or the static fold of a literal/boot-value source. */
  const classAttrOf = (id: string, className: string | undefined): string | null => {
    const bound = plan.bindings[id]?.['visible'];
    let mode: 'normal' | 'hidden' | 'live' = 'normal';
    if (bound !== undefined) {
      if (bound.kind === 'computed' && bound.expr.kind === 'undefined') mode = 'hidden';
      else if (bound.kind === 'computed' && bound.expr.kind === 'literal') mode = bound.expr.value ? 'normal' : 'hidden';
      else mode = 'live';
    } else if (visibleLiteralFalse(id)) {
      mode = 'hidden';
    }
    if (mode === 'normal') return className ? `className={styles.${className}}` : null;
    const hidden = `styles.${hiddenKeepSpaceClass}`;
    if (mode === 'hidden') {
      notes.push(
        `${plan.path}: node ${id} is statically invisible — hidden but keeping its layout space (authored state, not dead code)`
      );
      if (!className) return `className={${hidden}}`;
      usesJoinClasses = true;
      return `className={joinClasses(styles.${className}, ${hidden})}`;
    }
    const negated = negatedVisibleCode(bound!);
    if (negated === null) {
      notes.push(`${plan.path}: wire into ${id}.visible has no statically known source — dropped, reported`);
      defer(id, 'the wire into "visible"', 'has no statically known source', bound);
      return className ? `className={styles.${className}}` : null;
    }
    usesJoinClasses = true;
    return className
      ? `className={joinClasses(styles.${className}, ${negated} && ${hidden})}`
      : `className={joinClasses(${negated} && ${hidden})}`;
  };

  const childText = (node: NodeIR, paramName: string): string | null => {
    const bound = plan.bindings[node.id]?.[paramName];
    if (bound) {
      // An all-static format folded to a literal reads as the plain text it is.
      if (bound.kind === 'computed' && bound.expr.kind === 'literal') return jsxText(String(bound.expr.value));
      // A boot-value read renders empty, as the runtime renders an undefined text.
      if (bound.kind === 'computed' && bound.expr.kind === 'undefined') return null;
      // An unwritten wrapper output reads undefined; the runtime renders that as nothing
      // (EXP-003 §4's `{formatListOut.text ?? ''}` shape). Lifted/materialized state reads
      // are undefined until their first delivery and fold the same way (CONTROLLED-STATE §4d/§4f),
      // and so does a session read while nobody is signed in (USER-FAMILY §4c) — React renders
      // `undefined` as nothing either way, but the fold is what makes the emitted text say so.
      // 🔴 EXP-011 §24 adds `outcome-error` here, and this whitelist is the reason it has to be
      // added by hand: it is keyed by expr kind and has no exhaustiveness, so the Error read that
      // used to arrive as a `state-get` and fold correctly went on compiling and silently stopped
      // folding when its kind changed. It belongs with the string-typed reads above rather than
      // with the `String(...)` coercion below — both messages are string literals this emitter
      // writes itself, so the only question is presence.
      if (
        bound.kind === 'computed' &&
        (bound.expr.kind === 'jsfun-out' ||
          bound.expr.kind === 'state-get' ||
          bound.expr.kind === 'session-get' ||
          bound.expr.kind === 'outcome-error') &&
        maybeUndefined(bound.expr)
      ) {
        const code = bindingExpr(bound, 'text');
        if (code !== null) return `{${code} ?? ''}`;
      }
      /**
       * An HTTP output in a text sink (EXP-011 Tier 1.2) is coerced, not merely defaulted.
       *
       * The others above are string-typed and only ever need the `?? ''`. This one is whatever
       * the server sent — a number, an object, nothing at all — and the runtime's Text node puts
       * it through the same `String()` on its way to the DOM. Without the coercion React is
       * handed an object and throws where the interpreted app prints `[object Object]`.
       */
      if (bound.kind === 'computed' && bound.expr.kind === 'http-out') {
        const code = bindingExpr(bound, 'text');
        if (code !== null) return `{String(${code} ?? '')}`;
      }
      const expr = bindingExpr(bound, 'text');
      if (expr !== null) return `{${expr}}`;
      notes.push(`${plan.path}: wire into ${node.id}.${paramName} ${noSourceReason(bound, 'text')} — dropped, reported`);
      defer(node.id, `the wire into "${paramName}"`, noSourceReason(bound, 'text'), bound);
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

  /**
   * The mounted sink (§4b) wraps the element in a conditional render — false removes the
   * element from the tree entirely, the runtime's own rule — so the wrapper decides before
   * the element prints. A statically-false source removes it with a comment: authored
   * invisibility is authored state, not dead code.
   */
  const render = (id: string, indent: number, radioCtx?: RadioCtx): string[] => {
    const node = nodeById.get(id)!;
    const mountedBound = plan.bindings[id]?.['mounted'];
    if (mountedBound !== undefined) {
      const staticallyFalse =
        mountedBound.kind === 'computed' &&
        (mountedBound.expr.kind === 'undefined' ||
          (mountedBound.expr.kind === 'literal' && !mountedBound.expr.value));
      if (staticallyFalse) {
        notes.push(
          `${plan.path}: node ${id} mounts from a statically-false source — removed from the tree (authored state, kept as a comment)`
        );
        return [`${pad(indent)}{/* node ${id}: mounted from a statically-false source — removed from the tree */}`];
      }
      const staticallyTrue = mountedBound.kind === 'computed' && mountedBound.expr.kind === 'literal';
      if (!staticallyTrue) {
        const cond = truthinessCode(mountedBound);
        if (cond !== null) {
          const inner = renderCore(id, indent + 2, radioCtx);
          return [`${pad(indent)}{${cond} && (`, ...inner, `${pad(indent)})}`];
        }
        notes.push(`${plan.path}: wire into ${id}.mounted has no statically known source — dropped, reported`);
        defer(id, 'the wire into "mounted"', 'has no statically known source', mountedBound);
      }
    } else {
      const mountedLit = node.parameters.find((p) => p.name === 'mounted')?.value;
      if (mountedLit?.kind === 'literal' && mountedLit.value === false) {
        notes.push(
          `${plan.path}: node ${id} is authored Mounted false — removed from the tree (authored state, kept as a comment)`
        );
        return [`${pad(indent)}{/* node ${id}: authored Mounted false — removed from the tree */}`];
      }
    }
    return renderCore(id, indent, radioCtx);
  };

  /**
   * EXP-010 AC3. The comment left where a child the export could not identify used to be.
   *
   * 🔴 **In the emitted file, not only in the report.** The original defect was not that a custom
   * node failed to translate — it is that the JSX simply closed over the gap, so a reader of the
   * exported repo had nothing to search for and no reason to suspect anything was missing. A note
   * in a report nobody has opened yet does not fix that; a line in the file does.
   */
  const droppedChildMarkers = (parentId: string, indent: number): string[][] =>
    (plan.droppedChildren[parentId] ?? []).map((dropped) => [
      `${pad(indent)}{/* TODO(export): ${dropped.type} — node ${dropped.nodeId} sits here in the`,
      `${pad(indent)}    graph and did not render. ${dropped.reason}.`,
      `${pad(indent)}    See the export report. */}`
    ]);

  /**
   * A container's rendered children — each preceded by its marker when the graph wired something
   * to it that did not survive — followed by a marker for each child that did not render at all.
   *
   * 🔴 **Rendered first, marked second, and the order is load-bearing.** A child's deferrals are
   * pushed *during* its own render, so the marker cannot be written until that has run.
   *
   * 🔴 **The marker is placed here rather than inside `renderCore`, because only here is the
   * element a sibling.** `renderCore` also returns the body of `{cond && ( … )}` and the whole of
   * `return ( … )`, and both of those positions hold exactly one JSX expression — a comment
   * prepended there is a second one, which does not parse.
   */
  const renderChildBlocks = (parentId: string, childIds: string[], indent: number, radioCtx?: RadioCtx): string[][] => [
    ...childIds.map((childId) => {
      const lines = render(childId, indent, radioCtx);
      return [...markerLines(childId, indent), ...lines];
    }),
    ...droppedChildMarkers(parentId, indent)
  ];

  const renderCore = (id: string, indent: number, radioCtx?: RadioCtx): string[] => {
    const node = nodeById.get(id)!;
    const role = plan.roleOf[id];

    if (role === 'repeater') return renderRepeater(node, indent);
    if (role === 'custom') return renderCustom(node, indent);
    if (role === 'instance') {
      const target = requireInstance(node.type, `instance ${id}`);
      if (!target) return [`${pad(indent)}{/* TODO(export): component instance ${id} could not be resolved */}`];
      const attrs = [...instanceAttrs(node), ...instanceHandlerAttrs(node, indent + 2)];
      return element(target.symbol, attrs, null, indent, false);
    }

    const tag = TAGS[role];
    const attrs: string[] = [];
    const className = classOf(id);
    const classAttr = classAttrOf(id, className);
    if (classAttr !== null) attrs.push(classAttr);
    const isControl = role === 'checkbox' || role === 'radio' || role === 'range' || role === 'select';
    if (role === 'image' || role === 'input' || role === 'button' || role === 'video' || isControl) {
      attrs.push(...contentAttrs(node));
    }
    // The controlled control's value/checked (§4c) — local state, synced by the graph path.
    const controlVar = controlVarByNode.get(id);
    if (controlVar !== undefined) {
      attrs.push(`${role === 'checkbox' ? 'checked' : 'value'}={${controlVar.name}}`);
    }
    if (role === 'input' || isControl) attrs.push(...changeAttrs(node, indent + 2));
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
      const blocks = renderChildBlocks(id, childIds, inner + 2, radioCtx).flat();
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
      const blocks = renderChildBlocks(id, childIds, indent + 2, ctx).flat();
      return element(tag, attrs, blocks.length > 0 ? blocks : null, indent, true);
    }

    // Containers: group / page.
    const childIds = plan.childrenOf[id] ?? [];
    const blocks = renderChildBlocks(id, childIds, indent + 2, radioCtx);
    // Popup slots render after the root's own children (POPUPS-TARGET §5).
    if (id === plan.rootId && plan.popups.length > 0) blocks.push(...popupJsx(indent + 2));
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
    const itemsExpr = repeater?.itemsExpr;
    const staticData = repeater?.itemsStaticId
      ? plan.staticData.find((s) => s.nodeId === repeater.itemsStaticId)
      : undefined;
    const noFeed = !query && !collection && itemsExpr === undefined && staticData === undefined;
    const target = requireInstance(repeater?.templatePath ?? null, `For Each ${node.id}`);
    const templatePlan = repeater?.templatePath ? project.byLegacyPath.get(repeater.templatePath) : undefined;
    // The row's attribute names are the template's props, so they take the template's mapping.
    const templateIdents = templatePlan ? propIdentifiers(templatePlan) : new Map<string, string>();
    const templateLegacy = repeater?.templatePath ?? '(unresolved template)';
    /**
     * One row's attributes. Same ruling as `targetPropName` (§13b): a mapped input the template
     * does not declare as a component input receives nothing at runtime, so it is dropped and
     * named rather than written onto `IntrinsicAttributes`. The rows below run only past the
     * `!target` guard, so an absent template plan never reaches here.
     */
    const rowAttrs = (entries: ReadonlyArray<{ input: string; field: string }>, itemRef: string): string[] => {
      const out: string[] = [];
      for (const { input, field } of entries) {
        const attr = templateIdents.get(input) ?? null;
        if (attr === null) {
          notes.push(undeclaredAttrNote(templateLegacy, input, `For Each ${node.id}`));
          defer(node.id, `the repeated "${input}" input`, `is not declared as a component input on ${templateLegacy}`);
          continue;
        }
        out.push(`${attr}={${memberExpr(itemRef, field)}}`);
      }
      return out;
    };
    if (!repeater || noFeed || !target || repeater.mapping === null) {
      const reason = !repeater?.templatePath
        ? 'no template component'
        : repeater.mapping === null
          ? 'dynamic mapping script'
          : noFeed
            ? 'items are not fed by a query, a named array, or a statically-known list'
            : 'unresolvable template';
      notes.push(`${plan.path}: For Each ${node.id} deferred to EXP-003 (${reason})`);
      return [`${pad(indent)}{/* TODO(export): For Each ${node.id} deferred to EXP-003 (${reason}) */}`];
    }
    /**
     * The template's row props (EXP-011 Tier 1.1) — an `Object` in "From repeater" mode inside
     * the template became these, and the parent is where the row reaches them:
     * `mood={item.mood}`, which is `memberExpr(itemLocal, field)`, the identity-mapping path
     * this function already emits (EXP-002-MODEL2-TARGET-OUTPUT §4, parent side).
     *
     * They are appended to the mapping rather than folded into it, and excluded from the
     * `template-inputs` derivation below, because their **field** is the property the `Object`
     * read and their **prop** may have been deduplicated away from it. Deriving one from the
     * other is the collision bug §4's own note warns about.
     */
    const rowProps = templatePlan?.rowProps ?? [];
    const rowPropNames = new Set(rowProps.map((r) => r.prop));
    // 'template-inputs' is the no-script case: the runtime identity-maps item properties onto
    // same-named component inputs by itself (foreach.tsx), so the template's props are the map.
    const declaredMapping =
      repeater.mapping === 'template-inputs'
        ? (templatePlan?.props ?? []).filter((p) => !rowPropNames.has(p.name)).map((p) => ({ input: p.name, field: p.name }))
        : repeater.mapping.filter((entry) => !rowPropNames.has(entry.input));
    const mapping = [...declaredMapping, ...rowProps.map((r) => ({ input: r.prop, field: r.field }))];
    // STATIC-DATA §3: the rows are known, so this takes the typed treatment — the item type's
    // own fields are the allowed set, and a mapped input the rows do not carry is dropped and
    // reported, exactly as the collection/query paths do.
    if (staticData !== undefined) {
      const carried = new Set(staticData.fields.map((f) => f.name));
      const keptStatic = mapping.filter((entry) => carried.has(entry.field));
      for (const dropped of mapping.filter((entry) => !carried.has(entry.field))) {
        notes.push(
          `${plan.path}: For Each ${node.id} maps "${dropped.input}" from field "${dropped.field}", which no authored row carries — dropped, reported`
        );
      }
      // §3.2: `id` keys only when every row has a unique one, mirroring the runtime's own
      // record identity; otherwise index, which is the same information the runtime has.
      const keyAttr = staticData.keyField ? `key={${itemLocal}.${staticData.keyField}}` : `key={${indexLocal}}`;
      const attrs = [keyAttr, ...rowAttrs(keptStatic, itemLocal)];
      const lines = element(target.symbol, attrs, null, indent + 2, false);
      const params = staticData.keyField ? itemLocal : `${itemLocal}, ${indexLocal}`;
      return [`${pad(indent)}{${staticData.constName}.map((${params}) => (`, ...lines, `${pad(indent)}))}`];
    }
    /**
     * §4e: a plain-list feed has no statically-known item shape — fields read as `any` off the
     * untyped list (the §10 ruling), so every mapped input is kept.
     *
     * 🔴 **Unless the list is one this slice built.** EXP-011 Tier 1.1's `collection-get` and
     * `list-map` produce a list whose row type is *concrete* in the emitted code — a
     * `NotesItem[]`, or an object literal with the mapped keys — so a mapped input the row does
     * not carry stops being an `any` read that compiles and becomes a **type error in the
     * exported app**. Where the shape is knowable it is enforced here exactly as the Static Data
     * and named-array paths below enforce theirs, dropped field reported. `listExprFields`
     * answers null for every other source, which keeps §4e's rule intact for them.
     */
    if (itemsExpr !== undefined) {
      const known = listExprFields(itemsExpr);
      const keptExpr = known === null ? mapping : mapping.filter((entry) => known.has(entry.field));
      if (known !== null) {
        for (const dropped of mapping.filter((entry) => !known.has(entry.field))) {
          notes.push(
            `${plan.path}: For Each ${node.id} maps "${dropped.input}" from field "${dropped.field}", which the array it reads does not carry — dropped, reported`
          );
        }
      }
      const attrs = [`key={${indexLocal}}`, ...rowAttrs(keptExpr, itemLocal)];
      const lines = element(target.symbol, attrs, null, indent + 2, false);
      const srcCode = exprCode(itemsExpr, 'render');
      // `?? []` is foreach.tsx's own "empty arrival clears the list".
      const source = SIMPLE_REF.test(srcCode) ? `(${srcCode} ?? [])` : `((${srcCode}) ?? [])`;
      return [`${pad(indent)}{${source}.map((${itemLocal}, ${indexLocal}) => (`, ...lines, `${pad(indent)}))}`];
    }
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
      const attrs = [`key={${indexLocal}}`, ...rowAttrs(kept, itemLocal)];
      const lines = element(target.symbol, attrs, null, indent + 2, false);
      const local = collectionLocals.get(collection.name)!;
      return [`${pad(indent)}{${local}.map((${itemLocal}, ${indexLocal}) => (`, ...lines, `${pad(indent)}))}`];
    }
    const item = query!.itemName;
    const attrs = [`key={${item}.id}`, ...rowAttrs(kept, item)];
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
      // EXP-010 changed the answer here, so the note changed with it. The export now copies every
      // `noodl_modules` folder verbatim and links each declared stylesheet, so a set that is *in
      // the project* ships and its glyphs render. A set that is not — an icon picked from a module
      // since removed — still needs saying, and now the note is about the set that is missing
      // rather than about a capability the export lacks.
      if (source.classes.length > 0 && !fontIconSetsNoted.has(source.classes[0])) {
        fontIconSetsNoted.add(source.classes[0]);
        const iconClass = source.classes[0];
        const shipped = ir.project.modules.some(
          (m) => m.iconClass === iconClass && m.stylesheets.length > 0 && m.runtimes.includes('browser')
        );
        if (!shipped) {
          notes.push(
            `${plan.path}: font icon set "${iconClass}" is not a noodl_modules icon set in this project with a stylesheet — the export has nothing to ship for it, and these icons render as blank in the exported app`
          );
        }
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
      // selected by default unless the author picked a value — or unless the select is
      // controlled (§4c), where the state's '' boot selects it instead.
      if (!selectAttrs.some((a) => a.startsWith('defaultValue') || a.startsWith('value='))) {
        selectAttrs.push('defaultValue=""');
      }
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

  /**
   * Signal wires from an instance's outputs attach as callback props — the prop names come off
   * the target's own plan, so parent and child agree by construction (COMPONENT-OUTPUTS §5).
   */
  const instanceHandlerAttrs = (node: NodeIR, attrIndent: number): string[] => {
    const handlers = plan.handlers[node.id];
    if (!handlers) return [];
    const targetPlan = project.byLegacyPath.get(node.type);
    const propByPort = new Map((targetPlan?.outputProps ?? []).map((o) => [o.port, o.prop]));
    const attrs: string[] = [];
    for (const [port, actions] of Object.entries(handlers)) {
      const prop = propByPort.get(port);
      if (prop === undefined) {
        notes.push(`${plan.path}: instance ${node.id} signal "${port}" has no callback prop on ${node.type} — dropped, reported`);
        defer(node.id, `the "${port}" signal`, `has no callback prop on ${node.type}`);
        continue;
      }
      attrs.push(`${prop}={${handlerArrow(actions, '()', attrIndent)}}`);
    }
    return attrs;
  };

  /**
   * A custom node from a `noodl_modules` kit (EXP-010) — rendered through the generated wrapper in
   * `src/kits/`, which is ordinary typed React at this call site.
   *
   * 🔴 **A node whose kit did not load emits a comment naming it, never nothing.** That is AC3 and
   * it is the whole point of the task: the original defect was not that custom nodes failed to
   * export, it was that they failed *silently* — the JSX simply had a gap where the author's own
   * node had been, with no marker in the file and nothing in the output to search for.
   */
  const renderCustom = (node: NodeIR, indent: number): string[] => {
    const binding = kitBindings.get(node.type);
    const custom = plan.customNodes[node.id];
    if (!binding) {
      const kit = custom ? ` from ${custom.moduleDir}` : '';
      notes.push(
        `${plan.path}: node ${node.id} (${node.type}) is a custom node whose kit registered no usable definition — a marker is emitted in its place`
      );
      return [
        `${pad(indent)}{/* TODO(export): custom node ${node.id} (${node.type})${kit} — its kit did`,
        `${pad(indent)}    not load, so no component was generated. See the export report. */}`
      ];
    }

    const specifier = `../kits/${binding.modulePath.split('/').pop()}`;
    const existing = internalImports.get(specifier);
    const symbols = new Set(existing ? existing.replace(/^import \{ | \} from .*$/g, '').split(', ') : []);
    symbols.add(binding.symbol);
    internalImports.set(specifier, `import { ${[...symbols].sort().join(', ')} } from '${specifier}';`);

    const attrs: string[] = [];
    for (const param of node.parameters) {
      if (param.value.kind !== 'literal') {
        notes.push(
          `${plan.path}: parameter ${param.name} on ${node.id} (${node.type}) is not a literal — a kit port takes the authored value only, so it is dropped and reported`
        );
        continue;
      }
      const prop = binding.propOf.get(param.name);
      if (prop === undefined) {
        // The `rename-kit` case, from the input side: a parameter left in the file for a port the
        // kit no longer declares. The running app delivers nothing there either — the difference
        // is that the export says so.
        notes.push(
          `${plan.path}: parameter ${param.name} on ${node.id} names no input port on ${node.type} — the kit declares no such port, so the running app ignores it too`
        );
        continue;
      }
      // A wired port takes the wire, never both: the running app overwrites the authored value
      // the moment the wire delivers, and JSX cannot spell the same prop twice (TS17001).
      if (plan.bindings[node.id]?.[param.name] !== undefined) continue;
      attrs.push(jsxAttr(prop, param.value.value));
    }

    for (const [toProperty, source] of Object.entries(plan.bindings[node.id] ?? {})) {
      const prop = binding.propOf.get(toProperty);
      if (prop === undefined) {
        notes.push(
          `${plan.path}: wire into ${node.id}.${toProperty} names no input port on ${node.type} — dropped, reported`
        );
        defer(node.id, `the wire into "${toProperty}"`, `names no input port on ${node.type}`, source);
        continue;
      }
      const port = binding.def.inputs.find((i) => i.name === toProperty);
      const sink = sinkOfTsType(port ? kitPortTsType(port) : undefined);
      const expr = bindingExpr(source, sink);
      if (expr === null) {
        notes.push(`${plan.path}: wire into ${node.id}.${toProperty} ${noSourceReason(source, sink)} — dropped, reported`);
        defer(node.id, `the wire into "${toProperty}"`, noSourceReason(source, sink), source);
        continue;
      }
      attrs.push(`${prop}={${expr}}`);
    }

    // Signal outputs: the wrapper's callback prop runs the handler the graph wired to the port.
    for (const [port, actions] of Object.entries(plan.handlers[node.id] ?? {})) {
      const prop = binding.signalPropOf.get(port);
      if (prop === undefined) {
        notes.push(`${plan.path}: custom node ${node.id} signal "${port}" has no callback prop on ${node.type} — dropped, reported`);
        defer(node.id, `the "${port}" signal`, `has no callback prop on ${node.type}`);
        continue;
      }
      attrs.push(`${prop}={${handlerArrow(actions, '()', indent + 2)}}`);
    }

    // Value outputs the graph reads: the wrapper calls the setter, the sink binds to the row.
    for (const lifted of plan.customLifted[node.id] ?? []) {
      const prop = binding.valuePropOf.get(lifted.port);
      if (prop === undefined) {
        notes.push(`${plan.path}: custom node ${node.id} value output "${lifted.port}" has no callback prop on ${node.type} — dropped, reported`);
        defer(node.id, `the "${lifted.port}" value output`, `has no callback prop on ${node.type}`);
        continue;
      }
      attrs.push(`${prop}={${lifted.setterName}}`);
    }

    const childIds = binding.def.allowChildren ? (plan.childrenOf[node.id] ?? []) : [];
    if (!binding.def.allowChildren && (plan.childrenOf[node.id] ?? []).length > 0) {
      notes.push(
        `${plan.path}: node ${node.id} (${node.type}) has rendered children but the kit declares allowChildren: false — they are not passed, matching the running app`
      );
    }
    const blocks = renderChildBlocks(node.id, childIds, indent + 2).flat();
    return element(binding.symbol, attrs, blocks.length > 0 ? blocks : null, indent, blocks.length > 0);
  };

  const instanceAttrs = (node: NodeIR): string[] => {
    const attrs: string[] = [];
    for (const param of node.parameters) {
      if (param.name === 'visible' || param.name === 'mounted') continue; // §4b: not target props
      if (param.value.kind !== 'literal') continue;
      const attr = targetPropName(node.type, param.name);
      if (attr === null) {
        notes.push(undeclaredAttrNote(node.type, param.name, `instance ${node.id}`));
        defer(node.id, `the "${param.name}" parameter`, `is not declared as a component input on ${node.type}`);
        continue;
      }
      // A wired port takes the wire, never both (see the kit side above): the authored value
      // is what the instance starts with and the wire replaces it, and two `Name=` attributes
      // on one element is not TypeScript.
      if (plan.bindings[node.id]?.[param.name] !== undefined) continue;
      attrs.push(jsxAttr(attr, param.value.value));
    }
    for (const [toProperty, source] of Object.entries(plan.bindings[node.id] ?? {})) {
      // mounted rides the render wrapper; visible has no class to toggle on an instance.
      if (toProperty === 'mounted') continue;
      if (toProperty === 'visible') {
        notes.push(
          `${plan.path}: wire into instance ${node.id}.visible dropped — an instance has no element class to toggle in this slice`
        );
        defer(node.id, 'the wire into "visible"', 'has no element class to toggle on a component instance in this slice', source);
        continue;
      }
      const sink = sinkOfTsType(targetPropTsType(node.type, toProperty));
      const expr = bindingExpr(source, sink);
      if (expr === null) {
        notes.push(`${plan.path}: wire into ${node.id}.${toProperty} ${noSourceReason(source, sink)} — dropped, reported`);
        defer(node.id, `the wire into "${toProperty}"`, noSourceReason(source, sink), source);
        continue;
      }
      const attr = targetPropName(node.type, toProperty);
      if (attr === null) {
        notes.push(undeclaredAttrNote(node.type, toProperty, `the wire into ${node.id}.${toProperty}`));
        defer(node.id, `the wire into "${toProperty}"`, `is not declared as a component input on ${node.type}`, source);
        continue;
      }
      attrs.push(`${attr}={${expr}}`);
    }
    // The lifted callbacks (§4d parent side): `onXChanged={setX}` writes the parent state var.
    for (const lifted of plan.instanceLifted[node.id] ?? []) {
      attrs.push(`${lifted.prop}={${lifted.setterName}}`);
    }
    return attrs;
  };

  /**
   * One conditional portal per popup slot (POPUPS-TARGET §5): the runtime mounts popups as
   * siblings after the app root, painting above by DOM order — `createPortal(…, document.body)`
   * keeps that true from anywhere in the tree.
   */
  const popupJsx = (indent: number): string[][] =>
    plan.popups.map((slot) => {
      const target = requireInstance(slot.targetLegacy, `popup ${slot.slotKey}`);
      if (!target) return [`${pad(indent)}{/* TODO(export): popup ${slot.slotKey} could not be resolved */}`];
      // A target with no translated Close Popup declares no onClose — passing one would fail
      // the emitted app's own typecheck, and such a popup never closes at runtime either.
      const closable = project.byLegacyPath.get(slot.targetLegacy)?.closesPopup === true;
      const slotAttrs: string[] = [];
      for (const p of slot.params) {
        const attr = targetPropName(slot.targetLegacy, p.input);
        if (attr === null) {
          notes.push(undeclaredAttrNote(slot.targetLegacy, p.input, `popup slot ${slot.slotKey}`));
          continue;
        }
        slotAttrs.push(jsxAttr(attr, p.value));
      }
      const attrs = [...slotAttrs, ...(closable ? [`onClose={() => ${popupSetter}(null)}`] : [])];
      return [
        `${pad(indent)}{${popupState} === ${tsLiteral(slot.slotKey)} &&`,
        `${pad(indent + 2)}createPortal(`,
        `${pad(indent + 4)}<div className={styles.${popupLayerClass}}>`,
        ...element(target.symbol, attrs, null, indent + 6, false),
        `${pad(indent + 4)}</div>,`,
        `${pad(indent + 4)}document.body`,
        `${pad(indent + 2)})}`
      ];
    });

  /**
   * The re-host wrapper (EXP-003 §4): the body verbatim — never reindented, a template
   * literal's inner lines are content — inside the contract the runtime gives it. The body
   * runs in an IIFE so a body-level `return` exits the *body* (as it exits the runtime's
   * compiled function) and the wrapper still returns Outputs; the catch mirrors the runtime's
   * own (a throw publishes what was written before it, pulses only unconsumed failure paths,
   * and an Expression answers 0 — expression.ts `_calculateExpression`).
   */
  const jsWrapperLines = (def: JsFunctionPlan): string[] => {
    const fieldKey = (name: string) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name));
    const inputFields = def.inputs.map((i) => `${fieldKey(i.name)}?: ${i.tsType}`);
    const inputsType = inputFields.length > 0 ? `{ ${inputFields.join('; ')} }` : 'Record<string, never>';
    const lines: string[] = [];
    if (def.kind === 'function') {
      const outputFields = [
        ...def.outputs.map((o) => `${fieldKey(o.name)}?: ${o.tsType}`),
        ...def.signals.map((s) => `${fieldKey(s)}: () => void`)
      ];
      const outputsType = outputFields.length > 0 ? `{ ${outputFields.join('; ')} }` : 'Record<string, never>';
      const seeds = def.signals.map((s) => `${fieldKey(s)}: () => {}`);
      lines.push(`// From the Function node "${def.fnName}" — the body is preserved verbatim (EXP-003 §4).`);
      lines.push(`function ${def.fnName}(Inputs: ${inputsType}): ${outputsType} {`);
      lines.push(`  const Outputs: ${outputsType} = {${seeds.length > 0 ? ` ${seeds.join(', ')} ` : ''}};`);
      lines.push('  try {');
      lines.push('    (() => {');
      lines.push(...def.body.split('\n'));
      lines.push('    })();');
      lines.push('  } catch (e) {');
      lines.push(`    console.error('Function node ${def.fnName} threw:', e);`);
      lines.push('  }');
      lines.push('  return Outputs;');
      lines.push('}');
    } else if (def.kind === 'visual') {
      /**
       * A Visual Function, re-hosted (LOGIC-BUILDER-TARGET §3.2–§3.4).
       *
       * The body is the block editor's own generated projection, verbatim — the same string the
       * runtime compiles with `new Function`. Everything around it exists to supply the
       * parameters that function is called with, so the body needs no rewriting at all:
       *
       *  - `Inputs` / `Outputs`  — the port records, keyed by the workspace's own names.
       *  - `sendSignalOnOutput`  — collects fired signals rather than pulsing.
       *  - `Noodl.Variables`     — 🔴 a real facade over the app's variables store, so the
       *                            body's verbatim `Noodl.Variables["x"]` reads and writes keep
       *                            their exact meaning. This is what the block-vocabulary gate
       *                            buys: every key is a literal from a block field.
       *  - `__p` / `__s`         — the block editor's debug probes, identity and no-op, exactly
       *                            as the runtime passes them when nobody is inspecting.
       *                            Stripping them would need an AST (they nest); shimming is
       *                            correct by construction.
       */
      const outputFields = def.outputs.map((o) => `${fieldKey(o.name)}?: ${o.tsType}`);
      const outputsType = outputFields.length > 0 ? `{ ${outputFields.join('; ')} }` : 'Record<string, never>';
      const vars = def.variables ?? [];
      lines.push(
        `// From the Visual Function "${def.fnName}" — the block program's generated code, verbatim.`,
        '// Authored as blocks; regenerate from the block editor rather than editing this by hand.'
      );
      // The `| null` in the signature is not a hedge — it names a specific block below, so the
      // reader can go and plug it in.
      const nulled = def.outputs.filter((o) => o.tsType.endsWith(' | null')).map((o) => o.name);
      if (nulled.length > 0) {
        lines.push(
          `// ${nulled.map((n) => `\`${n}\``).join(', ')}: a \`set output\` block below has an empty value socket, which`,
          '// the block editor generates as a literal `null` — so the type admits one.'
        );
      }
      lines.push(`function ${def.fnName}(Inputs: ${inputsType}): ${outputsType} {`);
      lines.push(`  const Outputs: ${outputsType} = {};`);
      // A `send signal` whose output nobody wired is a no-op in the runtime too
      // (`_createExecutionContext` registers the port on demand precisely so it can be one), and
      // a node whose signals ARE consumed defers before reaching here. So the fired names are
      // collected and go nowhere, which is exactly what they do in the interpreter.
      lines.push('  const fired: string[] = [];');
      lines.push('  const sendSignalOnOutput = (name: string): void => { fired.push(name); };');
      lines.push('  void fired;');
      if (vars.length > 0) {
        /**
         * 🔴 **The facade is `any` on both sides, deliberately** — EXP-003 §4's ruling that an
         * untyped runtime delivery's honest type is `any`, not `unknown`.
         *
         * `Noodl.Variables` really is untyped at runtime, and block programs rely on it: the
         * corpus writes `Noodl.Variables["myVariable"] = null` into a variable the store types
         * `string`, and reads a variable typed `unknown` straight into a `string` output. Under
         * the store's own types the emitted app would fail its own `tsc` on both. The store
         * keeps its type for everyone else; this facade is the loose surface the block program
         * was written against.
         */
        const pairs = vars.flatMap((name) => {
          const store = variableByName.get(name);
          if (store === undefined) return [];
          return [
            `      get ${fieldKey(name)}(): any { return ${store.exportName}.get(); },`,
            `      set ${fieldKey(name)}(v: any) { ${store.exportName}.set(v); }`
          ].join('\n');
        });
        if (pairs.length > 0) {
          lines.push('  const Noodl = {');
          lines.push('    Variables: {');
          // Joined, not pushed per line: each entry is a get/set PAIR, and a missing separator
          // between pairs is a syntax error the single-variable case cannot show.
          lines.push(pairs.join(',\n'));
          lines.push('    }');
          lines.push('  };');
        }
      }
      // Declared unconditionally, exactly as the runtime declares them: a body generated before
      // block probes existed mentions neither, and an unused local costs nothing.
      lines.push('  const __p = <T,>(_id: string, v: T): T => v;');
      lines.push('  const __s = (_id: string): void => {};');
      lines.push('  try {');
      lines.push('    (() => {');
      lines.push(...def.body.split('\n'));
      lines.push('    })();');
      lines.push('  } catch (e) {');
      lines.push(`    console.error('Visual Function ${def.fnName} threw:', e);`);
      lines.push('  }');
      lines.push('  return Outputs;');
      lines.push('}');
    } else {
      const params = def.inputs.length > 0 ? `{ ${def.inputs.map((i) => i.name).join(', ')} }: ${inputsType}` : '';
      lines.push(`// From the Expression node "${def.fnName}" — the expression is preserved verbatim (EXP-003 §4).`);
      lines.push(`function ${def.fnName}(${params}) {`);
      for (const alias of def.mathAliases) {
        lines.push(alias === 'pi' ? '  const pi = Math.PI;' : `  const ${alias} = Math.${alias};`);
      }
      lines.push('  try {');
      lines.push(`    return (${def.body});`);
      lines.push('  } catch (e) {');
      lines.push(`    console.error('Expression node ${def.fnName} threw:', e);`);
      lines.push('    return 0;');
      lines.push('  }');
      lines.push('}');
    }
    return lines;
  };

  /**
   * EXP-004's last in-code marker: the author's own code for a script node this export refused.
   *
   * ## The gap this closes
   *
   * A wrapper prints only when something that survived references it (`referencedJsIds`). When
   * nothing survived to read a Function's outputs the plan still registers the definition and the
   * emit layer drops it — correctly, because a wrapper nothing calls is dead code. But the body
   * goes with it, and the body is the only statement anywhere of what the node was meant to do.
   * On `puppy-test-3` the marker beside the empty `<p>` names `formatList.text`, and the function
   * that computed it exists nowhere in the exported repo: the developer asked to rewrite it is
   * given the node's name and nothing else.
   *
   * ## Why here, and not on the marker beside the element
   *
   * Two reasons, and the second is the load-bearing one.
   *
   * A refused Function is still a function, and module scope above the component is where the
   * printed wrappers already live — a developer who now has to write it wants it where it will
   * go, not indented six levels inside JSX children.
   *
   * 🔴 And `referencedJsIds` is only complete once the tree walk has finished. The inline markers
   * render *during* that walk, so a marker that asked "did this wrapper print?" would be asking
   * before the answer existed, and would preserve the source of functions that went on to print
   * their own. This loop runs after the walk, where the set is final.
   *
   * ## Commented, never emitted as code
   *
   * Un-dropping the wrapper here would reintroduce the dead code the reference check exists to
   * remove, and for a Function whose inputs never resolved it would reintroduce code that does
   * not typecheck. So the source is carried as a comment and nothing else.
   */
  const REFUSED_SOURCE_WORDING: Record<JsFunctionPlan['kind'], { noun: string; preserved: string }> = {
    function: { noun: 'Function', preserved: 'Its authored body is' },
    expression: { noun: 'Expression', preserved: 'Its authored expression is' },
    // A Visual Function's authored artefact is a block program, not text. `body` is the code
    // generated from it — the closest honest thing there is, and exactly what the wrapper would
    // have printed. Saying "authored" of it would be a small lie in a comment whose whole job is
    // to be the one trustworthy record.
    visual: { noun: 'Visual Function', preserved: 'The body generated from its block program is' }
  };

  /**
   * 🔴 Author content splits on **every** JS line terminator, not just `\n`. U+2028 and U+2029
   * end a `//` comment exactly as a newline does, so a body carrying one — inside a string
   * literal, which is where they occur — would close the comment early and spill its remainder
   * into the module as code. This is `commentSafe`'s hazard one construct over.
   */
  const commentSafeLines = (text: string): string[] => text.split(/\r\n|[\n\r\u2028\u2029]/);

  const refusedSourceLines = (def: JsFunctionPlan): string[] => {
    const { noun, preserved } = REFUSED_SOURCE_WORDING[def.kind];
    const label = nodeById.get(def.nodeId)?.authoredLabel;
    const named = label !== undefined ? `"${label}" (node ${def.nodeId})` : `node ${def.nodeId}`;
    const out = [
      `// TODO(export): the ${noun} ${named} has no translation here.`,
      '// Nothing that survived this export reads its outputs, so no wrapper was generated for it.',
      `// ${preserved} preserved below, because this comment is its only record in this repo.`,
      '// See the export report.'
    ];
    // Verbatim, per the IR's contract for `sourceText`: never trimmed, never reformatted. A line
    // that is only whitespace carries nothing, and is emitted bare rather than as trailing space.
    for (const line of commentSafeLines(def.body)) out.push(line.trim() === '' ? '//' : `//   ${line}`);
    return out;
  };

  /**
   * The same record for a script that is a *parameter* of a node doing something else.
   *
   * 🔴 The wording cannot borrow `REFUSED_SOURCE_WORDING`'s "no wrapper was generated for it":
   * these nodes never had a wrapper to generate. What is true of all of them is narrower and is
   * the thing the reader needs — the node is in the graph, its script is not in this repo.
   */
  const refusedScriptLines = (refused: RefusedScriptPlan): string[] => {
    const named = refused.label !== undefined ? `"${commentSafe(refused.label)}" (node ${commentSafe(refused.nodeId)})` : `node ${commentSafe(refused.nodeId)}`;
    const out = [
      `// TODO(export): the ${commentSafe(refused.typeName)} ${named} has an authored script that`,
      '// this export did not translate, so none of it is anywhere else in this repo.',
      '// It is preserved below, because this comment is its only record here.',
      '// See the export report.'
    ];
    // Verbatim, per the IR's contract for `sourceText`: never trimmed, never reformatted.
    for (const line of commentSafeLines(refused.source)) out.push(line.trim() === '' ? '//' : `//   ${line}`);
    return out;
  };

  const jsxLines = render(plan.rootId, 4);
  /**
   * The markers that cannot be siblings, as line comments above the `return`.
   *
   * Two populations reach this, and they are one line apart for a reason:
   *
   * - **The root.** It is the single expression `return ( … )` holds, so its marker cannot be
   *   placed beside it the way every other node's can.
   * - 🔴 **Anything else still unflushed** — a node whose element some *other* path emitted, so
   *   `renderChildBlocks` never saw it. Popup slots go through `popupJsx` today, and a future
   *   render path would arrive here the same way. Without this, a marker recorded for such a node
   *   would be **silently dropped**, which is precisely the failure this task exists to close:
   *   the report would list the refusal and the grep it recommends would still find nothing.
   */
  const preReturnMarkers: string[] = [...markerText(plan.rootId)];
  for (const nodeId of deferralsByNode.keys()) {
    if (flushed.has(nodeId)) continue;
    preReturnMarkers.push(...markerText(nodeId));
  }
  const preReturnComment = preReturnMarkers.length > 0 ? [...preReturnMarkers, 'See the export report.'].map((line) => `  // ${line}`) : [];
  if (plan.popups.length > 0 && plan.roleOf[plan.rootId!] !== 'group' && plan.roleOf[plan.rootId!] !== 'page') {
    notes.push(`${plan.path}: popup slots need a container root to render under — dropped, reported`);
  }

  // ---- the module ------------------------------------------------------------------------
  const symbol = plan.file.symbol;
  const hasCss = classNames.length > 0 || popupLayerClass !== undefined || hiddenKeepSpaceClass !== undefined;
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
  // Re-host wrappers print above the component — locality is what a React developer inherits
  // (EXP-003 §4). Only referenced definitions print as code, in the plan's resolution order; a
  // definition nothing kept leaves its source behind as a comment instead (EXP-004), so the node
  // the inline marker names can still be read somewhere in the repo.
  for (const def of Object.values(jsFunByNode)) {
    if (referencedJsIds.has(def.nodeId)) body.push(...jsWrapperLines(def), '');
    else body.push(...refusedSourceLines(def), '');
  }
  // The same preservation for script-bearing nodes that are not re-host wrappers — a Map
  // Collection's mapping, a Repeater's template, a Script node's code. The plan decides which
  // ones did not translate; this only prints them.
  for (const refused of plan.refusedScripts) body.push(...refusedScriptLines(refused), '');
  if (usesJoinClasses) {
    body.push(
      'function joinClasses(...classes: Array<string | false | undefined>) {',
      "  return classes.filter(Boolean).join(' ');",
      '}',
      ''
    );
  }
  // Static Data (STATIC-DATA-TARGET §3): the authored rows as a frozen module constant, above
  // the component. The inputs are `allowEditOnly`, so this is a build-time constant in the
  // runtime's terms too — there is no edit it could miss.
  for (const sd of plan.staticData) {
    for (const nested of sd.nestedTypes) body.push(nested.decl, '');
    body.push(`type ${sd.typeName} = {`);
    for (const f of sd.fields) {
      body.push(`  ${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(f.name) ? f.name : JSON.stringify(f.name)}${f.optional ? '?' : ''}: ${f.tsType};`);
    }
    body.push('};', '');
    body.push(`const ${sd.constName}: readonly ${sd.typeName}[] = Object.freeze(${staticRowsLiteral(sd.rows, 0)});`, '');
  }
  const allPropNames = [
    ...plan.props.map((p) => propName(p.name)),
    ...plan.outputProps.map((o) => o.prop),
    ...plan.liftedOutputProps.map((l) => l.prop)
  ];
  if (plan.closesPopup) allPropNames.push('onClose');
  if (allPropNames.length > 0) {
    body.push(`export interface ${symbol}Props {`);
    // The port name rides along as a doc comment wherever the identifier had to differ — the
    // graph's own vocabulary is what the author will search for.
    for (const prop of plan.props) {
      const ident = propName(prop.name);
      if (ident !== prop.name) body.push(`  /** Component input \`${prop.name}\`. */`);
      body.push(`  ${ident}?: ${prop.tsType};`);
    }
    for (const output of plan.outputProps) body.push(`  ${output.prop}?: () => void;`);
    // Lifted value outputs (CONTROLLED-STATE §4d): optional callbacks carrying the value.
    for (const lifted of plan.liftedOutputProps) body.push(`  ${lifted.prop}?: (value: ${lifted.tsType}) => void;`);
    // The popup boundary's reserved prop (POPUPS-TARGET §4), after the declared interface.
    if (plan.closesPopup) body.push('  onClose?: (action?: string) => void;');
    body.push('}', '');
  }
  if (plan.docComment) {
    body.push(`/** ${plan.docComment}${/[.!?]$/.test(plan.docComment) ? '' : '.'} */`);
  }
  const signature =
    allPropNames.length > 0
      ? `export function ${symbol}({ ${allPropNames.join(', ')} }: ${symbol}Props) {`
      : `export function ${symbol}() {`;
  body.push(signature);
  if (usesNavigate) body.push('  const navigate = useNavigate();');
  // EXP-011 Tier 2.5. `useSearchParams` returns a tuple whose setter this slice never uses —
  // nothing in the vocabulary writes the query string.
  if (usesPageParams) {
    body.push(`  const ${PAGE_PARAMS_LOCAL} = useParams();`, `  const [${PAGE_QUERY_LOCAL}] = useSearchParams();`);
  }
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
  // One session local per component, whatever the graph reads off it (USER-FAMILY-TARGET §4c).
  // It is earned by a `session-get` surviving into a binding or a handler, not by the `User`
  // node existing — a node whose every read was gated leaves nothing behind.
  if (usesSession) body.push(`  const ${SESSION_LOCAL} = useSession();`);
  for (const query of plan.queries) {
    body.push(`  const [${query.stateName}, ${query.setterName}] = useState<${query.typeName}[]>([]);`);
  }
  if (popupState !== null) {
    const union = plan.popups.map((p) => tsLiteral(p.slotKey)).join(' | ');
    body.push(`  const [${popupState}, ${popupSetter}] = useState<${union} | null>(null);`);
  }
  // The state rows (CONTROLLED-STATE §3.1) — only the vars something references print.
  for (const stateVar of referencedStateVars) {
    body.push(`  // ${stateVar.comment}`);
    body.push(
      // `bootCode` is emitted verbatim and wins over `boot` — the one row that needs it is
      // `Now`'s, whose initializer must be the lazy `() => new Date()` (EXP-011 Tier 1.3).
      `  const [${stateVar.name}, ${stateVar.setterName}] = useState<${stateVar.tsType}>(${
        stateVar.bootCode ?? (stateVar.boot === null ? '' : tsLiteral(stateVar.boot))
      });`
    );
  }
  for (const [id, local] of jsLocals) {
    const def = jsFunByNode[id]!;
    body.push(`  const ${local} = ${def.fnName}(${jsArgsObject(def, 'render')});`);
  }
  if (
    usesNavigate ||
    usesPageParams ||
    hookVariables.length > 0 ||
    hookStoreKeys.length > 0 ||
    hookCollections.length > 0 ||
    radioNameLocals.size > 0 ||
    plan.queries.length > 0 ||
    popupState !== null ||
    referencedStateVars.length > 0 ||
    jsLocals.size > 0
  ) {
    body.push('');
  }
  for (const query of plan.queries) {
    body.push('  useEffect(() => {', `    ${query.fetchName}().then(${query.setterName});`, '  }, []);', '');
  }
  // Sync effects (§3.4): the graph path of a wired control-state input — the input setter's
  // own coercion and abstain rules (§1's table), and never the Changed chain.
  for (const sync of plan.syncEffects) {
    const setter = stateSetterOf(sync.stateName);
    const src = exprCode(sync.source, 'render');
    const deps = effectDeps(sync.source).join(', ');
    if (sync.coerce === 'checkbox') {
      body.push(
        '  // Graph-path sync (checkbox): !!value, applied always — and Changed never fires.',
        '  useEffect(() => {',
        `    ${setter}(!!${SIMPLE_REF.test(src) ? src : `(${src})`});`,
        `  }, [${deps}]);`,
        ''
      );
    } else if (sync.coerce === 'slider') {
      body.push(
        '  // Graph-path sync (slider): abstain on empty, clamp to [min, max] — Changed never fires.',
        '  useEffect(() => {',
        `    const arrival = ${src};`,
        "    if (arrival === undefined || arrival === null || arrival === '') return;",
        '    const next = Number(arrival);',
        '    if (!Number.isFinite(next)) return;',
        `    ${setter}(Math.min(${sync.max}, Math.max(${sync.min}, next)));`,
        `  }, [${deps}]);`,
        ''
      );
    } else if (sync.coerce === 'dropdown') {
      body.push(
        '  // Graph-path sync (dropdown): undefined deselects, null abstains — Changed never fires.',
        '  useEffect(() => {',
        `    if (${src} === null) return;`,
        `    ${setter}(${src} === undefined ? '' : String(${src}));`,
        `  }, [${deps}]);`,
        ''
      );
    } else if (sync.coerce.startsWith('variable-')) {
      // The value Variables (EXP-011 Tier 1.4). One body per cast, all four sharing
      // `variablebase.setValueTo`'s order: `undefined` abstains and leaves the stored value
      // alone, `null` stores the `Treat empty as` coercion, anything else goes through
      // `args.cast` — and for Number a cast that produced `NaN` is banned as a stored value and
      // takes the empty coercion too, because `NaN !== NaN` would break the runtime's own
      // `changed` guard permanently once it landed.
      const empty = tsLiteral(sync.empty === undefined ? null : sync.empty);
      const cast =
        sync.coerce === 'variable-string'
          ? `String(arrival)`
          : sync.coerce === 'variable-boolean'
            ? `Boolean(arrival)`
            : sync.coerce === 'variable-number'
              ? `Number(arrival)`
              : 'arrival';
      body.push(
        `  // Graph-path sync (Variable): undefined abstains, null stores ${empty} — Changed never fires.`,
        '  useEffect(() => {',
        `    const arrival = ${src};`,
        '    if (arrival === undefined) return;',
        ...(sync.coerce === 'variable-number'
          ? [
              `    if (arrival === null) { ${setter}(${empty}); return; }`,
              '    const next = Number(arrival);',
              `    ${setter}(Number.isNaN(next) ? ${empty} : next);`
            ]
          : [`    ${setter}(arrival === null ? ${empty} : ${cast});`]),
        `  }, [${deps}]);`,
        ''
      );
    } else {
      body.push(
        '  // Graph-path sync (text input): undefined abstains, null clears (FB-026) — Changed never fires.',
        '  useEffect(() => {',
        `    if (${src} === undefined) return;`,
        `    ${setter}(${src} === null ? '' : String(${src}));`,
        `  }, [${deps}]);`,
        ''
      );
    }
  }
  // Push effects (§3.5): the lifted value output — fires on change and once at mount, which
  // is the boot delivery a parent wire gets from the interpreter.
  for (const push of plan.pushEffects) {
    const deps = [...effectDeps(push.expr), push.prop].join(', ');
    body.push(
      '  useEffect(() => {',
      `    ${push.prop}?.(${exprCode(push.expr, 'render')});`,
      `  }, [${deps}]);`,
      ''
    );
  }
  // Reactive Conditions (LOGIC-TARGET §10): the node re-tests whenever its condition arrives and
  // fires one arm, so the branch runs from an effect keyed on the condition. `actionCode` already
  // prints the negated single-arm form, which is what the auth-gate idiom (`On False` → navigate)
  // reduces to.
  for (const effect of plan.branchEffects) {
    const action = effect.action as Extract<HandlerAction, { kind: 'branch' }>;
    const deps = effectDeps(action.cond).join(', ');
    body.push(
      `  // ${effect.comment}`,
      '  useEffect(() => {',
      `    ${actionCode(action, 4)};`,
      `  }, [${deps}]);`,
      ''
    );
  }
  const actionExprsOf = (a: HandlerAction): ValueExpr[] => {
    switch (a.kind) {
      case 'emit':
        return a.payload.map((p) => p.expr);
      case 'store-set':
      case 'globalstore-set':
        return [a.expr];
      case 'state-set':
        return a.expr !== undefined ? [a.expr] : [];
      case 'collection-add':
        return a.entries.map((e) => e.expr);
      case 'collection-clear':
        return [...a.then.flatMap(actionExprsOf), ...a.unchangedThen.flatMap(actionExprsOf)];
      case 'branch':
        return [a.cond, ...a.whenTrue.flatMap(actionExprsOf), ...a.whenFalse.flatMap(actionExprsOf)];
      case 'popup-show':
      case 'popup-close':
        return a.then.flatMap(actionExprsOf);
      case 'jsfun-run':
        return [...jsArgExprs(a.nodeId), ...a.then.flatMap(actionExprsOf)];
      case 'http-call':
        return [...a.args.map((arg) => arg.expr), ...a.then.flatMap(actionExprsOf), ...a.failThen.flatMap(actionExprsOf)];
      case 'api-call':
        return [
          ...a.args.flatMap((arg) => (arg.kind === 'expr' ? [arg.expr] : arg.props.map((p) => p.expr))),
          ...a.then.flatMap(actionExprsOf)
        ];
      // EXP-011 Tier 1.3. The Read reads nothing of its own; the chain is where the expressions
      // are, and a reader of this function wants them (the `usesPayload` test below is one).
      case 'date-now-read':
        return a.then.flatMap(actionExprsOf);
      // EXP-011 Tier 2.5. The link, the wired Open In New Tab, and both chains — `usesPayload`
      // walks this list, so a link built from a received event's payload is found here or the
      // emitted callback takes no argument and its body reads one.
      case 'external-link':
        return [a.link, ...a.then.flatMap(actionExprsOf), ...a.failThen.flatMap(actionExprsOf)];
      /**
       * 🔴 **A navigation's page parameters are expressions, and this sweep is what finds
       * them.** `usesPayload` walks this list to decide whether the emitted `useSignal`
       * callback takes a `(payload)` argument; returning `[]` here meant a Navigate filling
       * `{id}` from a received event emitted a callback with no argument and a body that read
       * one — the same shape §10.3's duplicate attribute had, and equally a build failure
       * rather than a wrong value.
       */
      case 'navigate':
        return [...a.pathParams.map((p) => p.expr), ...a.query.map((p) => p.expr)];
      /**
       * ⚠️ **The chains are walked here on consistency with every sibling above, and not on a
       * measurement** (EXP-011 §17.3). `external-link`, `api-call`, `branch` and the rest all
       * flatMap their chains because `usesPayload` reads this list and nothing else flattens for
       * it; `navigate-path` did not. A firing case needs a payload read inside a Navigate To
       * Path's chain *inside an Event Receiver*, and the receiver deferred before one could be
       * built — so this closes a hole that is real in shape and that this session could not make
       * fire. Recorded that way rather than claimed as a fix.
       */
      case 'navigate-path':
        return [
          ...a.pathParams.map((p) => p.expr),
          ...a.query.map((p) => p.expr),
          // EXP-011 §18. A received payload can decide *which arm runs* as readily as it can
          // fill `{id}` — and unlike the chain walk above, this one is the direct shape the
          // comment above describes: an expression of this action, read in this handler.
          ...(a.newTabExpr === undefined ? [] : [a.newTabExpr]),
          ...a.then.flatMap(actionExprsOf),
          ...a.failThen.flatMap(actionExprsOf),
          ...a.completedThen.flatMap(actionExprsOf)
        ];
      case 'output-signal':
        return [];
    }
  };
  const containsPayload = (e: ValueExpr): boolean =>
    e.kind === 'payload' ||
    (e.kind === 'format' && e.parts.some((p) => typeof p !== 'string' && containsPayload(p))) ||
    (e.kind === 'logical' && e.operands.some(containsPayload)) ||
    ((e.kind === 'not' || e.kind === 'truthy') && containsPayload(e.operand)) ||
    // EXP-011 Tier 1.3 — a receiver whose payload feeds a date node still takes `(payload)`.
    // Without this the emitted `useSignal` callback takes no argument and the call inside it
    // reads a `payload` nothing bound.
    (e.kind === 'date-call' && e.args.some(containsPayload)) ||
    (e.kind === 'jsfun-out' && jsArgExprs(e.nodeId).some(containsPayload));
  for (const receiver of plan.receivers) {
    const channel = channelByName.get(receiver.channelName)!;
    const usesPayload = receiver.actions.some((a) => actionExprsOf(a).some(containsPayload));
    body.push(`  useSignal(${channel.exportName}, ${usesPayload ? '(payload)' : '()'} => {`);
    for (const action of expandActions(receiver.actions)) body.push(`    ${actionCode(action)};`);
    body.push('  });', '');
  }
  body.push(...preReturnComment, '  return (', ...jsxLines, '  );', '}');

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
    // The overlay box: full-viewport, unstyled — the popup component styles itself, exactly as
    // the runtime's wrapper group does (POPUPS-TARGET §5).
    if (popupLayerClass !== undefined) {
      cssBlocks.push(`.${popupLayerClass} {\n  position: fixed;\n  inset: 0;\n}`);
    }
    // The visible sink's shared rule (CONTROLLED-STATE §4b): hidden, but keeping layout space.
    if (hiddenKeepSpaceClass !== undefined) {
      cssBlocks.push(`.${hiddenKeepSpaceClass} {\n  visibility: hidden;\n}`);
    }
    files[`${baseDir}/${plan.file.fileBase}.module.css`] = GENERATED_CSS + '\n' + cssBlocks.join('\n\n') + '\n';
  }

  return { files, notes, dateHelpers: usedDateHelpers };
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

/**
 * Does this role earn a CSS class from the style tables?
 *
 * ⚠️ **`'custom'` does not, and that is the whole difference between the export having a style
 * opinion about a kit node and having none.** The tables are keyed by built-in port names; every
 * parameter on a kit node is a port the kit declared, so running `computeNodeStyle` over one
 * matches nothing and reports *every* parameter as unmapped — six lines of "dropped, reported"
 * about `label`, `amount` and `day`, each of which the wrapper passes through perfectly. The kit
 * styles itself, which is what `props.className` and its own style ports are for.
 */
function isStyledRole(role: string | undefined): boolean {
  return role !== undefined && role !== 'instance' && role !== 'repeater' && role !== 'custom';
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

/**
 * The authored rows as a TS array literal (STATIC-DATA-TARGET §3), printed rather than
 * `JSON.stringify`d so keys print bare where they can and the result reads like code a person
 * wrote. Values are re-serialized from the parsed JSON, so there is no authored text to preserve
 * verbatim — only the values themselves, which `JSON.stringify` renders exactly for each scalar.
 */
function staticRowsLiteral(value: unknown, indent: number): string {
  const inner = pad(indent + 2);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => `${inner}${staticRowsLiteral(v, indent + 2)}`);
    return `[\n${items.join(',\n')}\n${pad(indent)}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const fields = entries.map(([k, v]) => {
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${inner}${key}: ${staticRowsLiteral(v, indent + 2)}`;
    });
    return `{\n${fields.join(',\n')}\n${pad(indent)}}`;
  }
  return JSON.stringify(value);
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
