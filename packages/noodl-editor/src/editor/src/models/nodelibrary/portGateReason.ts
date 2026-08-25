/**
 * FB-021 — saying *why* a property row is missing, in a sentence derived from the
 * declaration that removed it.
 *
 * ## The defect, as measured rather than as filed
 *
 * Jordan asked "where is width?" four times. The task was filed believing
 * `sizeMode` **removes** the dimension ports, and session 20's drive found the
 * opposite, which is worse: `addDynamicInputPorts` pushes its group with no
 * `name`, `nodelibraryexport.ts` defaults that to `conditionalports/basic`, and
 * `basic` — per `portConnectivity.ts`, in those words — *"only suppresses the
 * property row; the port still exists and a wire to it stays valid."*
 *
 * So a wire into `width` on a `contentSize` Group survives a reload, delivers its
 * value, and `layout.ts` then assigns neither axis. **Delivered, then discarded.**
 * A wired port and an unwired one render identically — as nothing at all.
 * Measured on the shipped catalog: **328 input ports are in that state**, against
 * 21 `conditionalports/extended` ones that genuinely are not on the node.
 *
 * ## What this module is, and what it is deliberately not
 *
 * It **narrates**; it does not decide. `applyPortConditionsFilterForNode` remains
 * the only thing that answers *"which ports are switched off"*, and this module
 * is handed that answer and asked *"what would switch them back on"*. The task's
 * own trap says it: do not fork a second source of truth for which ports exist.
 * Nothing here evaluates a condition, so nothing here can disagree about one.
 *
 * It is **import-free**, like `dynamicPortRules.ts` and `portConnectivity.ts` next
 * to it, so `tests-unit/` (plain Node, no Electron, no editor singletons) can
 * grade it against the genuine port declarations instead of a copy of them.
 *
 * ## Why it refuses to explain some ports
 *
 * `portDecoration.ts` established the rule for BCN-010 and it is the right one
 * here too: **a disabled control with no reason converts "this is switched off"
 * into "this is broken."** A port this module cannot explain is left hidden,
 * exactly as it is today — no worse than before, and never wrong. Measured over
 * the shipped catalog (175 types, `npm run catalog:check` clean on 2026-08-25):
 *
 * | | ports | why |
 * |---|---|---|
 * | explained outright | 320 | `<param> <op> <value>` against a declared port |
 * | recovered | 18 | `range`, once an always-false disjunct is dropped (below) |
 * | **explained, total** | **338** | |
 * | refused — `#js` | 9 | `useIcon` on checkbox, radiobutton, icon |
 * | refused — unhideable | 2 | `icon`'s `iconSourceType`/`iconSize`; see below |
 *
 * 🔴 That population is **counterfactual**: it asks *"if this port were switched
 * off, could the row explain itself?"* of every port in every conditional group.
 * At runtime only the ports whose condition currently fails are hidden, which is
 * a subset. 349 is the number of gate-*able* ports, never the number gated at
 * once, and a count of "gated ports" that quotes it is over-reporting.
 *
 * 🔴 The 9 `#js` ports are a **deliberate remainder**, and `fb-021` asserts the
 * count so that a tenth cannot arrive unnoticed. Parsing the expression to reach
 * them is the "escape hatch until it is code in JSON" that `dynamicPortRules.ts`
 * warns against in its header.
 *
 * ⚠️ The 2 are not a gap. `icon.ts` calls `addIconInputs(IconNode, {
 * hideEnableIconInput: true })`, so the node never registers the `useIcon` port
 * its own gating condition asks about — `useIcon NOT SET` is therefore always
 * true, and the real filter never hides those ports at all. The refusal below
 * costs nothing because the case cannot arise, and `fb-021` proves that with the
 * real evaluator rather than by arguing it.
 *
 * ## The disjunct that can never be true
 *
 * Nine `net.noodl.controls.range` groups read
 * `trackBorderLeftStyle = solid OR … OR borderStyle = solid OR …` — and `range`
 * has no `borderStyle` port. `getParameter` returns `undefined`, `'undefined' ===
 * 'solid'` is false, so those disjuncts are **always false** and dropping them
 * leaves the condition's truth value exactly as it was. That is the only reason
 * {@link reasonsForGatedPorts} is allowed to drop them rather than refuse.
 *
 * 🔴 The same move on a `NOT SET` clause would be a lie — an unresolvable param is
 * always unset, so that clause is always *true*, and dropping it would change the
 * meaning. {@link parseCondition} refuses the whole condition in that case. No
 * such clause exists in the catalog today; the guard is there because the next
 * one would be silent.
 *
 * @module models/nodelibrary/portGateReason
 */

import { tokenizeCondition } from './dynamicPortRules';

/**
 * The shape `model.getPorts()` hands over, narrowed to what a sentence needs.
 *
 * Structural rather than `NodeGrapPort` so a test double and a `ModelProxy` row
 * satisfy it equally — the same reason `portConnectivity.ts` declares `PortLike`.
 */
export interface GatePortLike {
  name: string;
  displayName?: string;
  type?: unknown;
  [extra: string]: unknown;
}

/** One `<param> <op> <value>` clause, after the tokens have been recognised. */
export interface GateClause {
  /** The parameter the condition asks about. */
  param: string;
  op: '=' | '!=' | 'NOT SET';
  /** Absent for `NOT SET`, which has no right-hand side. */
  value?: string;
}

/** A condition, once it is known to be the plain form and internally consistent. */
export interface ParsedCondition {
  clauses: GateClause[];
  /** How the clauses combine. A single-clause condition reports `'or'`; it reads the same. */
  connective: 'and' | 'or';
}

/** Everything a gated row needs to explain and undo itself. */
export interface PortGateReason {
  /** The gated port. */
  portName: string;
  /**
   * The parameter to focus when the author clicks the reason — AC3.
   *
   * The first clause's parameter, which for every multi-clause condition in the
   * catalog is also every other clause's: a condition that gates `width` asks
   * about `sizeMode` five times, never about five different things.
   */
  gatePortName: string;
  /** That parameter's label, for the clickable part of the row. */
  gateLabel: string;
  /** `Width applies when Size Mode is Explicit or Content Height.` */
  sentence: string;
}

/** The `conditionalports/*` group shape, as `nodelibraryexport` writes it. */
interface ConditionalPortGroup {
  name?: string;
  condition?: string;
  ports?: { name?: string }[];
}

/**
 * Where a kept-but-gated port carries its {@link PortGateReason}.
 *
 * A field on the port object rather than a parallel map, so it travels with the
 * row through `_getPorts`, `getViewGroupsFromPorts` and `renderParams` without
 * any of them being taught to carry a second argument — and so that
 * `ModelProxy.setParameter`'s `isEqual(_oldPorts, this.getPorts())` sees the
 * mark appear and disappear. That comparison is what fires
 * `instancePortsChanged`, and firing it is how flipping Size Mode re-renders
 * the panel: before FB-021 the port list changed length, and now it does not.
 *
 * Prefixed and non-enumerable-looking on purpose — `portsEqual` and the port
 * exporters compare declared fields, and this is view state, not a declaration.
 */
export const GATED_PORT_REASON_KEY = '__fb021GateReason';

const CONDITIONAL_PREFIX = 'conditionalports/';

/** `'foo'` → `foo`. The evaluator trims quotes clause by clause; so does this. */
function unquote(token: string): string {
  return token.replace(/'/g, '');
}

/**
 * Recognise a condition, or decline to.
 *
 * Returns `undefined` for anything this module must not put words to: a `#js`
 * expression, a condition mixing `AND` and `OR` (none exist today — and the
 * evaluator nests those right-associatively, which no flat sentence can state),
 * a malformed clause, or an operator that has grown since this was written.
 *
 * ⚠️ **The `#js` guard is explicit rather than load-bearing for today's corpus**,
 * and that is worth knowing before anyone "simplifies" it away. Mutation testing
 * found that deleting it kills no row: every `#js` condition that ships puts the
 * expression's first word in the clause parser's operator slot
 * (`(params.useIcon===true`), so the operator check refuses it anyway. It earns
 * its place against a body whose second word happens to be `=`, which is the
 * case `fb-021` pins.
 */
export function parseCondition(condition: string | undefined): ParsedCondition | undefined {
  if (typeof condition !== 'string' || condition.startsWith('#js')) return undefined;

  const tokens = tokenizeCondition(condition);
  if (tokens.length < 3) return undefined;

  const clauses: GateClause[] = [];
  const connectives = new Set<string>();

  for (let i = 0; i < tokens.length; i += 4) {
    // The evaluator stops reading at a short tail (`tokens.length < i + 3` →
    // `true`), so a trailing fragment contributes nothing it could be given
    // words for. Refusing is the honest answer rather than inventing one.
    if (tokens.length < i + 3) return undefined;

    const param = unquote(tokens[i]);
    const op = tokens[i + 1];
    const value = unquote(tokens[i + 2]);

    if (op === '=' || op === '!=') clauses.push({ param, op, value });
    else if (op === 'NOT' && value === 'SET') clauses.push({ param, op: 'NOT SET' });
    else return undefined;

    if (tokens.length > i + 3) {
      const logic = tokens[i + 3];
      if (logic !== 'AND' && logic !== 'OR') return undefined;
      connectives.add(logic);
    }
  }

  if (!clauses.length || connectives.size > 1) return undefined;

  return { clauses, connective: connectives.has('AND') ? 'and' : 'or' };
}

/** One rendered clause phrase, and whether it dropped a repeated subject. */
interface GatePhrase {
  text: string;
  /** `true` when the gate label was left off because the previous phrase already named it. */
  elided: boolean;
}

/** A port's label as the panel would write it. */
function labelForPort(port: GatePortLike | undefined, fallback: string): string {
  return (port && port.displayName) || fallback;
}

/**
 * A condition's right-hand side, as the author sees it in the control above.
 *
 * The condition stores the enum's `value` (`contentSize`); the dropdown shows its
 * `label` (`Content size`). Naming the stored value would send an author looking
 * for a word that is not on screen anywhere.
 */
function labelForValue(port: GatePortLike | undefined, value: string): string {
  const type = port ? port.type : undefined;

  if (type && typeof type === 'object') {
    const enums = (type as { name?: string; enums?: unknown[] }).enums;
    if (Array.isArray(enums)) {
      for (const entry of enums) {
        if (entry && typeof entry === 'object') {
          const option = entry as { value?: unknown; label?: unknown };
          if (String(option.value) === value && typeof option.label === 'string') return option.label;
        } else if (String(entry) === value) {
          return String(entry);
        }
      }
    }
  }

  // A boolean gate (`useLabel = true`, 36 clauses in the catalog) reads as a
  // state rather than as a literal — the control above it is a checkbox, and
  // "is true" describes a value where "is on" describes what the author did.
  if (value === 'true') return 'on';
  if (value === 'false') return 'off';

  return value;
}

/**
 * Fold `A is x or A is y or A is z` into `A is x, y or z`.
 *
 * Not cosmetic at the sizes involved: `sizeMode` gates `width` with five `=`
 * clauses on the same parameter, and spelled out one clause at a time the
 * sentence repeats "Size Mode is" five times and stops being readable — which
 * would make the reason exactly the kind of thing an author skips over.
 */
function phraseFor(clauses: GateClause[], ports: Map<string, GatePortLike>): GatePhrase[] {
  const phrases: GatePhrase[] = [];

  let index = 0;
  let previousParam: string | undefined;

  while (index < clauses.length) {
    const clause = clauses[index];
    const port = ports.get(clause.param);
    /*
     * 🔴 The subject is dropped when it would repeat, and the drive is why.
     *
     * `width` on a Group is gated by `sizeMode = explicit OR sizeMode = contentHeight OR
     * sizeMode NOT SET`. Folding handles the two `=` clauses, but `NOT SET` is a different
     * operator so it starts a new phrase — and the row read *"Width applies when Size Mode is
     * Explicit or Content Height or Size Mode is not set."* True, and it names the control
     * twice in one short sentence, which is exactly the kind of line an author's eye slides off.
     */
    const subject = previousParam === clause.param ? '' : `${labelForPort(port, clause.param)} `;
    previousParam = clause.param;

    if (clause.op === 'NOT SET') {
      phrases.push({ text: `${subject}is not set`, elided: subject === '' });
      index += 1;
      continue;
    }

    const values = [labelForValue(port, clause.value)];
    let next = index + 1;
    while (next < clauses.length && clauses[next].param === clause.param && clauses[next].op === clause.op) {
      values.push(labelForValue(ports.get(clauses[next].param), clauses[next].value));
      next += 1;
    }
    index = next;

    const verb = clause.op === '=' ? 'is' : 'is not';
    const list = values.length === 1 ? values[0] : `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;
    phrases.push({ text: `${subject}${verb} ${list}`, elided: subject === '' });
  }

  return phrases;
}

/**
 * Explain each switched-off port, where the declaration allows it.
 *
 * `hiddenPortNames` is `applyPortConditionsFilterForNode`'s answer — this module
 * never recomputes it. A name it cannot account for is simply absent from the
 * result, and the caller keeps hiding that port.
 *
 * @param dynamicports the node type's declarations, verbatim
 * @param hiddenPortNames the ports the filter switched off
 * @param ports every port on the node, for labels and enum values
 */
export function reasonsForGatedPorts(
  dynamicports: readonly unknown[] | undefined,
  hiddenPortNames: readonly string[] | null | undefined,
  ports: readonly GatePortLike[]
): Map<string, PortGateReason> {
  const reasons = new Map<string, PortGateReason>();
  if (!Array.isArray(dynamicports) || !hiddenPortNames || !hiddenPortNames.length) return reasons;

  const byName = new Map<string, GatePortLike>();
  for (const port of ports) if (port && port.name) byName.set(port.name, port);

  const hidden = new Set(hiddenPortNames);

  // Which conditional group holds each hidden port. Every gated port in the
  // catalog belongs to exactly one — measured, all 349 of them — so a name in
  // two groups is a shape this module has never seen, and it declines rather
  // than picking the first and sounding certain.
  const groupsFor = new Map<string, ConditionalPortGroup[]>();

  for (const entry of dynamicports) {
    const group = entry as ConditionalPortGroup;
    if (!group || typeof group.name !== 'string' || !group.name.startsWith(CONDITIONAL_PREFIX)) continue;
    if (!Array.isArray(group.ports)) continue;

    for (const port of group.ports) {
      if (!port || !port.name || !hidden.has(port.name)) continue;
      const list = groupsFor.get(port.name);
      if (list) list.push(group);
      else groupsFor.set(port.name, [group]);
    }
  }

  for (const [portName, groups] of groupsFor) {
    if (groups.length !== 1) continue;

    const parsed = parseCondition(groups[0].condition);
    if (!parsed) continue;

    // A clause about a parameter this node does not declare can never be true
    // under `=` / `!=` — `getParameter` returns `undefined` and the comparison
    // is against a string — so dropping it preserves the condition exactly.
    // Under `NOT SET` it is always true, and dropping it would not; refuse.
    const usable: GateClause[] = [];
    let refuse = false;
    for (const clause of parsed.clauses) {
      if (byName.has(clause.param)) usable.push(clause);
      else if (clause.op === 'NOT SET') refuse = true;
    }
    if (refuse || !usable.length) continue;

    // 🔴 Only sound for `or`. Dropping an always-false disjunct leaves an `OR`
    // chain's value untouched; dropping any conjunct from an `AND` chain whose
    // value is fixed at false would turn "never available" into a set of
    // conditions the author could go and satisfy. No `AND` condition in the
    // catalog references an undeclared parameter — this keeps it that way.
    if (usable.length !== parsed.clauses.length && parsed.connective !== 'or') continue;

    const phrases = phraseFor(usable, byName);
    const last = phrases[phrases.length - 1];
    /*
     * The comma before the final connective is there only when the last phrase dropped its
     * subject. *"Explicit or Content height or is not set"* runs the two readings together;
     * *"Explicit or Content height, or is not set"* separates them. Where every phrase names
     * its own control there is nothing to disambiguate, and the comma would just be clutter —
     * *"Layout is not None and Enable Scroll is on"* is right as it stands.
     */
    const joined =
      phrases.length === 1
        ? last.text
        : `${phrases
            .slice(0, -1)
            .map((phrase) => phrase.text)
            .join(', ')}${last.elided ? ',' : ''} ${parsed.connective} ${last.text}`;

    const gatePortName = usable[0].param;

    reasons.set(portName, {
      portName,
      gatePortName,
      gateLabel: labelForPort(byName.get(gatePortName), gatePortName),
      sentence: `${labelForPort(byName.get(portName), portName)} applies when ${joined}.`
    });
  }

  return reasons;
}

/**
 * Apply a set of reasons to a port list: keep and mark what can be explained, drop the rest.
 *
 * The whole of FB-021's decision, in one import-free function, so that `tests-unit` can grade it
 * against real declarations. `ModelProxy.getPorts` cannot be reached from there — it imports
 * `NodeLibrary` and `NodeGraphNode`, which need a renderer — and a rule this consequential
 * (**328 ports change state**) graded only by reading the source text would keep passing after
 * the call went dead. That failure has happened in this repo before.
 *
 * 🔴 **Copies, never mutations.** `NodeGraphNode.getPorts` returns its `_ports` cache by
 * reference; stamping the mark onto those objects would leak one panel's view state into the
 * canvas, the Ports tab, and every other reader of the same node. An ungated port is returned
 * by identity, which is both cheaper and the thing a spec can check.
 */
export function partitionGatedPorts<T extends GatePortLike>(
  ports: readonly T[],
  hiddenPortNames: readonly string[] | null | undefined,
  reasons: Map<string, PortGateReason>
): T[] {
  if (!hiddenPortNames || !hiddenPortNames.length) return ports.slice();

  const hidden = new Set(hiddenPortNames);

  return ports
    .filter((port) => !hidden.has(port.name) || reasons.has(port.name))
    .map((port) =>
      hidden.has(port.name) ? ({ ...port, [GATED_PORT_REASON_KEY]: reasons.get(port.name) } as T) : port
    );
}
