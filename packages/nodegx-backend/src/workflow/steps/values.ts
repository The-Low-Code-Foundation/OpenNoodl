/**
 * The value language shared by conditions (WF-002) and step params (WFA-003).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * WF-002 gave `branch` / `switch` / `for-each`'s filter a declarative value
 * language — literal, `{ "$path": "…" }`, `{ "$literal": … }` — and implemented
 * it inside `conditions.ts`. WFA-003 needs the SAME language for step `params`,
 * because until now params were static literals: there was no way to feed one
 * step's output into the next step's function input (phase-27 finding F11).
 *
 * A second path implementation would disagree at the edges — a missing key, a
 * negative array index, `$literal` escaping — and authors would learn two
 * dialects of one syntax. So the resolver moved HERE and both callers use it.
 * `conditions.ts` re-exports `getPath` / `resolveValue` so its own public
 * surface (and its test suite) is unchanged; that suite passing untouched is the
 * evidence the extraction was behaviour-preserving.
 *
 * WHAT IS NOT HERE, DELIBERATELY: arithmetic, string interpolation, function
 * calls — anything that would need an evaluator. WF-002's reasoning stands and
 * WFA-003 inherits it: a workflow definition is a persisted, deployable,
 * agent-authored JSON file, so an `eval`'d string inside one is a
 * remote-code-execution surface with an admin credential in front of it. This
 * language makes *referencing* values possible, never *computing* them. Compute
 * in a cloud function — that is what the function is for.
 *
 * @module nodegx-backend/workflow/steps/values
 */

/**
 * How deep a `$path` / `$literal` spec is looked for inside a single param
 * value. Resolution is recursive through objects and arrays, so
 * `{ "order": { "lines": [ { "id": { "$path": "…" } } ] } }` resolves; past this
 * depth a subtree is left VERBATIM at run time and rejected at write time
 * (`validateValueReferences` in WorkflowEngine.ts, via `exceedsValueDepth`
 * below), so nothing is silently half-resolved. There has never been a function
 * called `validateParamDepth`; this comment named one for a year.
 *
 * 32 is far past any hand-authored or agent-authored param and exists to bound
 * the recursion, not to constrain authors.
 */
export const MAX_VALUE_DEPTH = 32;

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Read a dotted path out of a scope. `a.b.0.c` walks objects and arrays alike.
 * A missing segment yields `undefined` (which `exists`/`notExists` test for) —
 * it is not an error, because "the field is absent" is a legitimate thing to
 * branch on. A negative index counts from the end, so `-1` is last.
 */
export function getPath(scope: unknown, path: string): unknown {
  if (!path) return scope;
  let cur: unknown = scope;
  for (const rawSegment of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(rawSegment);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx < 0 ? cur.length + idx : idx];
      continue;
    }
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[rawSegment];
  }
  return cur;
}

/**
 * Resolve ONE value spec (literal / `{$path}` / `{$literal}`) against a scope.
 *
 * Shallow by design: this is the primitive WF-002's condition evaluator calls at
 * each operand, where a condition's own structure has already been walked. For a
 * param value — which may be an object or array with specs nested inside it —
 * use `resolveValueDeep`.
 */
export function resolveValue(spec: unknown, scope: Record<string, unknown>): unknown {
  if (isPlainObject(spec)) {
    if (typeof spec.$path === 'string') return getPath(scope, spec.$path);
    if ('$literal' in spec) return spec.$literal;
  }
  return spec;
}

/**
 * Resolve a value spec RECURSIVELY through objects and arrays, so a spec nested
 * inside a param value resolves too.
 *
 * `$literal` is returned verbatim and is NOT descended into — that is exactly
 * what makes it an escape hatch, and it matches `resolveValue`'s (and therefore
 * conditions') semantics precisely. Past `MAX_VALUE_DEPTH` the subtree is
 * returned unchanged rather than throwing mid-run; write-time validation rejects
 * such a param, so this branch is unreachable for a persisted definition.
 */
export function resolveValueDeep(spec: unknown, scope: Record<string, unknown>, depth = 0): unknown {
  if (depth >= MAX_VALUE_DEPTH) return spec;

  if (Array.isArray(spec)) return spec.map((item) => resolveValueDeep(item, scope, depth + 1));

  if (isPlainObject(spec)) {
    if (typeof spec.$path === 'string') return getPath(scope, spec.$path);
    if ('$literal' in spec) return spec.$literal;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(spec)) out[k] = resolveValueDeep(v, scope, depth + 1);
    return out;
  }

  return spec;
}

/**
 * Resolve a step's `params` into the values the step actually runs with.
 *
 * `rawParams` names the params that are DSL STRUCTURES rather than values — a
 * condition, a filter, a switch's `cases` — which the executor evaluates lazily
 * against the run scope. Resolving those eagerly would rewrite the authored
 * condition into its own answer in the execution record, which reads as if the
 * step had been given a boolean where the author wrote a comparison. They are
 * passed through untouched.
 */
export function resolveStepParams(
  params: Record<string, unknown> | undefined,
  scope: Record<string, unknown>,
  rawParams: ReadonlySet<string> = new Set()
): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    out[name] = rawParams.has(name) ? value : resolveValueDeep(value, scope);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Static inspection (write time)
// ---------------------------------------------------------------------------

export interface FoundPath {
  /** The `$path` string as authored. */
  path: string;
  /** Where it sits, for an error message that can be acted on. */
  where: string;
}

/**
 * Collect every `$path` spec inside a value, with its location. Used by
 * write-time validation to check step references before a definition is ever
 * persisted. Descends into conditions as well as plain params — a
 * `{"$path":"upstream.typo"}` is the same typo wherever it is written — and does
 * NOT descend into `$literal`, which by definition is not a spec.
 */
export function collectValuePaths(value: unknown, where: string, depth = 0): FoundPath[] {
  if (depth >= MAX_VALUE_DEPTH) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectValuePaths(item, `${where}[${i}]`, depth + 1));
  }
  if (!isPlainObject(value)) return [];
  if (typeof value.$path === 'string') return [{ path: value.$path, where }];
  if ('$literal' in value) return [];

  return Object.entries(value).flatMap(([k, v]) => collectValuePaths(v, `${where}.${k}`, depth + 1));
}

/**
 * True when a value nests containers deeper than the resolver will descend, so
 * a spec inside it would be left verbatim. Rejected at write time rather than
 * silently mis-resolved at run time.
 */
export function exceedsValueDepth(value: unknown, depth = 0): boolean {
  if (depth >= MAX_VALUE_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => exceedsValueDepth(item, depth + 1));
  if (!isPlainObject(value)) return false;
  if (typeof value.$path === 'string' || '$literal' in value) return false;
  return Object.values(value).some((v) => exceedsValueDepth(v, depth + 1));
}

// ---------------------------------------------------------------------------
// The served description of the language
// ---------------------------------------------------------------------------

export interface ValueFormSpec {
  form: string;
  example: unknown;
  description: string;
}

export interface ScopeEntrySpec {
  name: string;
  description: string;
  deprecated?: boolean;
}

export interface ValueLanguageSpec {
  summary: string;
  forms: ValueFormSpec[];
  /** What a `$path` may start with. */
  scope: ScopeEntrySpec[];
  pathRules: string[];
  maxDepth: number;
  /** Params that are DSL structures and are therefore NOT value-resolved. */
  rawParamNote: string;
  /** The uniform run payload every entry point delivers (WFA-003). */
  payload: {
    canonical: Record<string, string>;
    deprecatedTopLevel: string;
  };
  limits: string[];
}

/**
 * The machine-readable description of the value language, served inside
 * `GET /admin/workflow-step-kinds` so an MCP client and WFA-004's property
 * editor can render the right control for a param — and know what a `$path` may
 * address — without hardcoding any of it against a backend that might disagree.
 */
export const VALUE_LANGUAGE: ValueLanguageSpec = {
  summary:
    'Every step param, and every operand inside a condition, may be a literal or a reference. References are ' +
    'resolved before the step runs; there are no expressions and no arithmetic.',
  forms: [
    { form: 'literal', example: 'GBP', description: 'Any JSON value, used as-is.' },
    {
      form: '$path',
      example: { $path: 'previous.result.total' },
      description: 'Read a dotted path out of the run scope. An unresolvable path is `undefined`, not an error.'
    },
    {
      form: '$literal',
      example: { $literal: { $path: 'not a path' } },
      description: 'Escape: the wrapped value is used verbatim, so a param that really does need a `$path` key can say so.'
    }
  ],
  scope: [
    { name: 'body', description: "The caller's own data — the webhook body, the manual-fire body, the admin run payload." },
    { name: 'trigger', description: 'How this run started: `{ type, id, firedAt, slug?, cron?, collection?, action? }`.' },
    { name: 'headers', description: 'Request headers (webhook runs only).' },
    { name: 'query', description: 'Query string (webhook runs only).' },
    {
      name: 'previous',
      description:
        "The output of the predecessor whose edge reached this step, or its `{ error }` when that predecessor failed."
    },
    {
      name: 'upstream.<stepId>',
      description:
        'The output of an earlier step, addressed by id. Use this instead of `previous` where two branches converge ' +
        'and `previous` is whichever arrived first. Validated at write time: the step must exist and must be upstream ' +
        'of this one.'
    },
    {
      name: '<param name>',
      description: "This step's own params, which are merged into the step input.",
      deprecated: false
    },
    {
      name: '<top-level payload key>',
      description:
        'DEPRECATED. Each entry point also spreads its pre-WFA-003 keys at the top level for one release. Read ' +
        '`body` / `trigger` instead.',
      deprecated: true
    }
  ],
  pathRules: [
    'Segments are dot-separated and walk objects and arrays alike: `body.items.0.id`.',
    'A negative index counts from the end, so `previous.items.-1` is the last item.',
    'A missing segment yields `undefined` rather than an error, so optional params stay possible.',
    'A param cannot reference another param of the same step — resolution happens before params are merged.'
  ],
  maxDepth: MAX_VALUE_DEPTH,
  rawParamNote:
    'A param marked `raw: true` in this catalog is a DSL structure (a condition, a filter, a switch\'s cases), not a ' +
    'value. Its own operands use this same language, evaluated when the step runs.',
  payload: {
    canonical: {
      trigger: '{ type, id?, firedAt, slug?, cron?, collection?, action?, recordId? }',
      body: "The caller's own data. Always present; `{}` when there was none.",
      headers: 'Webhook runs only.',
      query: 'Webhook runs only.',
      triggerType: 'The trigger type as a bare string, for switching on the entry point.'
    },
    deprecatedTopLevel:
      'Every entry point also delivers the keys it delivered before WFA-003 at the top level, for one release. The ' +
      'one that could NOT be preserved is `trigger`, which was the type as a string and is now the object above — ' +
      'read `triggerType` (or `trigger.type`) for the string. Where a legacy key collides with a canonical one, the ' +
      'canonical one wins.'
  },
  limits: [
    'No arithmetic, string interpolation or function calls. Compute in a cloud function.',
    'No cross-run or cross-workflow references.'
  ]
};
