/**
 * Is a conditionally-declared port switched on by its node's other parameters?
 *
 * Half the node catalog (88 of 175 types) declares `dynamicPorts`, and for 20 of
 * them — every visual and control type an author actually builds a page from:
 * `Text`, `Group`, `Image`, `Button`, `Text Input`, … — the dynamism is entirely
 * `declared-port-groups`: a list of `{ condition, inputs }` where the condition
 * is a question about *sibling parameter values* and the port set is fully
 * enumerable ahead of time. Nothing read that condition outside the property
 * panel, so a parameter aimed at a switched-off port was accepted in silence.
 *
 * ## Why this is a second evaluator
 *
 * The canonical one is `evaluateDynamicPortsCondition` in
 * `models/nodelibrary/dynamicPortRules.ts`, and this module deliberately does
 * **not** import it. `validation/` imports nothing but itself and
 * `noodl-types` — it runs in the editor, in the MCP server and in a CLI, and
 * reaching into `models/` would drag the renderer into all three. The same
 * trade-off is already made for `RUN_ON_CHANGE_PREFIX` in `CatalogIndex`.
 *
 * The drift that would cost us is a *false positive*, so the two are not
 * mirror images by design: the canonical evaluator answers "show this port?" and
 * must return a boolean for every input, while this one answers "is this port
 * definitely off?" and is free to abstain. `portConditions.test.ts` runs both
 * halves of the contract over every distinct condition string in the shipped
 * catalog.
 *
 * @module validation/portConditions
 */

/** What this module needs of a node: its authored parameters, nothing more. */
export type ParameterBag = Record<string, unknown>;

/**
 * A condition this module refuses to judge.
 *
 * `#js …` is an arbitrary expression, and `'{{portname}}.startMode = explicit'`
 * names a port whose real name is only known once a template is instantiated.
 * Both appear in the shipped catalog; neither can be answered from a parameter
 * bag, and guessing would mean warning about a port that is in fact live.
 */
function isUnjudgeable(condition: string): boolean {
  return condition.startsWith('#js') || condition.includes('{{');
}

/**
 * Evaluate one `<param> <op> <value>` clause.
 *
 * `NOT SET` occupies the operator and value slots together, which is why the
 * token walk advances four at a time — the shape the canonical evaluator uses,
 * kept identical so a condition cannot mean two things.
 */
function evalClause(params: ParameterBag, name: string, op: string, value: string): boolean | undefined {
  const actual = params[name];
  switch (op) {
    case '=':
      return String(actual) === value;
    case '!=':
      return String(actual) !== value;
    case 'NOT':
      // `NOT SET` — and only that. Anything else is a shape we do not know.
      return value === 'SET' ? actual === undefined || actual === null : undefined;
    default:
      return undefined;
  }
}

/**
 * `true` only when the condition is definitely **not** satisfied.
 *
 * `false` means either satisfied or not confidently answerable — the caller
 * stays quiet in both cases. A single unjudgeable clause abstains for the whole
 * condition, because `OR` makes one unknown enough to make the result unknown.
 */
export function conditionIsUnsatisfied(condition: string | undefined, params: ParameterBag): boolean {
  if (!condition || isUnjudgeable(condition)) return false;

  // Split on whitespace, respecting single quotes — the catalog quotes a
  // parameter name whenever it contains a dot.
  const tokens = condition.match(/(?:[^\s']+|'[^']*')+/g);
  if (!tokens || tokens.length < 3) return false;

  let result: boolean | undefined;
  let pendingLogic: string | undefined;

  for (let i = 0; i + 2 < tokens.length; i += 4) {
    const clause = evalClause(params, tokens[i].replace(/'/g, ''), tokens[i + 1], tokens[i + 2].replace(/'/g, ''));
    if (clause === undefined) return false; // abstain

    if (result === undefined) result = clause;
    else if (pendingLogic === 'AND') result = result && clause;
    else if (pendingLogic === 'OR') result = result || clause;
    else return false; // a joiner we do not know — abstain

    pendingLogic = tokens[i + 3];
    if (pendingLogic !== undefined && pendingLogic !== 'AND' && pendingLogic !== 'OR') return false;
  }

  return result === false;
}

/**
 * DEF-006 — the bag a condition must actually be answered against.
 *
 * The canonical evaluator asks `node.getParameter(name)`, and that falls back
 * to the port's catalog `default` when nothing is authored
 * (`NodeGraphNode.getParameter`, the `return port ? port.default : undefined`
 * tail). Answering from the authored bag alone makes every unset gate read as
 * the string `"undefined"`, which no condition ever matches — so a port whose
 * gate is satisfied *by its default* reads as switched off.
 *
 * That is not hypothetical: `iconIconSource` is declared
 * `useIcon = true AND iconSourceType = icon`, `iconSourceType` defaults to
 * `icon`, and `ui-slide-over`'s close button — which sets `useIcon: true` and
 * nothing else — was reported as carrying two parameters the runtime never
 * reads. It reads both.
 *
 * 🔴 **`NOT SET` keeps working, and that is the reason this is a merge rather
 * than a lookup inside `evalClause`.** Canonically `NOT SET` is
 * `getParameter(...) === undefined`, which is *"unset and no default"* — not
 * *"unauthored"*. `Group`'s `width` is declared
 * `sizeMode = explicit OR … OR sizeMode NOT SET` and `sizeMode` defaults to
 * `explicit`, so the first clause carries it either way; a port whose gate has
 * no default at all still has an undefined entry here and `NOT SET` still
 * answers true. Filling the bag first is what makes both halves agree with the
 * canonical evaluator at once.
 *
 * An authored `null` shadows the default, because `getParameter` returns it:
 * only `undefined` means "nothing was written here".
 *
 * Measured before it landed, over the compositions, all 62 catalog examples and
 * the 40 projects in `NodeGX test projects` (1,601 nodes): **3 findings
 * removed, 0 added**. The sabotage control — letting defaults *win* over
 * authored values — moves the same measurement to 70 added, so the zero is a
 * reading and not a blind instrument.
 */
export function resolveAgainstDefaults(params: ParameterBag, defaults: ParameterBag): ParameterBag {
  const resolved: ParameterBag = { ...defaults };
  for (const [name, value] of Object.entries(params)) if (value !== undefined) resolved[name] = value;
  return resolved;
}

/** One conditionally-declared group of ports, as the catalog stores it. */
export interface DeclaredPortGroup {
  condition?: string;
  inputs?: string[];
  outputs?: string[];
}

/**
 * The condition governing an input port, when exactly one group declares it.
 *
 * A port named by two groups is left alone: the runtime shows it when *either*
 * applies, so reporting on one group's condition would be wrong. Returns
 * `undefined` when no group declares the port — the ordinary case of a plain
 * static port.
 */
export function conditionForInput(groups: readonly DeclaredPortGroup[] | undefined, portName: string): string | undefined {
  if (!groups) return undefined;
  const owning = groups.filter((g) => g.inputs?.includes(portName));
  return owning.length === 1 ? owning[0].condition : undefined;
}
