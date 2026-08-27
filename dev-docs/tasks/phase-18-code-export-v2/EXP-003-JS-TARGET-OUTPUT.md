# EXP-003 — the JS nodes: the paper design (session 13)

**Decided on paper before code, like every slice since step 5. Read this before touching
Function/Expression translation, the re-host wrapper, or any trace-harness code.** This is the
design the EXP-003 task doc asked for ("define equivalence rules first; everything downstream
depends on this definition") — grounded in the three runtime sources and a full census of every
JS body in the corpus.

Sources read first: `packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts` (the
Function node), `expression.ts` (the Expression node), `javascriptnodeparser.js` (the `Noodl`
API surface + the Javascript2 `define`/`script`/`Node.*` DSL). Corpus: `js-survey.ts` (session
13 scratchpad `36f6b553-…`), 139 JS nodes across the corpus, **42 distinct bodies**.

## §0 The finding that reorders the task: translation is re-hosting, not rewriting

The EXP-003 task doc frames the work as "LLM translation, verified by traces." The corpus and
the sources reorder it — the same way componentobject.ts overturned the "lifted-state" guess:

**The body of a Function or Expression node is already JavaScript, and the exported app runs
the same engine.** For a body that touches nothing but `Inputs` and `Outputs`, the correct
translation is the body **verbatim**, inside a wrapper that reproduces the node's contract
(inputs arrive as a record; assigning `Outputs.x` publishes a value). Correctness is then **by
construction** — same code, same engine — and needs neither an LLM nor a trace. What has to be
designed is the *harness*: what triggers a run, what the inputs are at that moment, and where
the outputs land. Those are exactly the things EXP-002's IR already models.

The LLM and the trace harness are still the heart of EXP-003 — but their scope narrows to the
two places translation genuinely rewrites code:

1. **Idiomatization** (optional, later): rewriting a verbatim body into idiomatic TS. An LLM
   rewrite is a *claim*, so it is trace/property-verified, and falls back to the verbatim
   wrapper on mismatch. The verbatim wrapper is always a safe floor.
2. **Tier B** (the runtime-coupled bodies, §2): code written against `Component.Object`,
   `Noodl.Events`, `Component.RepeaterObject`. These cannot be re-hosted — the APIs they call
   do not exist in the export — and cannot be translated until the state/event vocabularies
   exist (the controlled-state slice; CO target doc §7). LLM + traces is the right tool there,
   *after* the vocabulary lands.

So the first buildable slice — **the pure re-host** — is deterministic, ships without AIX-001,
and establishes the wrapper vocabulary everything later builds on.

## §1 What the runtime actually does (the run model, from the sources)

### Function (`JavaScriptFunction`, simplejavascript.ts)

- Body compiled `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script)`
  — **non-strict**, `this` is a per-instance object that **persists across runs** (line 172).
- **Triggers**: the `run` pulse (additive, NDA-017); any `in-*` value change whose
  Run On Value Change checkbox is ticked (**absent = ticked** — check `!== false`, the same
  trap family as Condition/CO); and the script-set-at-load path *only if `run` is unconnected*
  (line 248 — the one surviving old guard, deliberate). Runs coalesce per frame
  (`scheduleRun` → `scheduleAfterInputsHaveUpdated`).
- **Outputs publish through a Proxy, change-gated**: `value !== previous` or nothing is sent
  (line 162 — "Some Noodl projects rely on this behavior"). Unwritten outputs read `undefined`
  from the getter. Signal outputs are **callable** (`Outputs.Done()` or `.send()`), pulse
  synchronously via `sendPulse` (node.ts:752).
- **Outcomes**: `success` fires after every completed run and **co-fires with `done`** on the
  `Run`-token path (order in source: silence report → `success` → `done`, line 445-447);
  `unchanged` when there is no script; `failure` + `error` on throw or compile failure —
  compile errors are only reported when a run is asked for (`parseError` kept, line 360).
- Inputs seed as **absent** (`inputValues = {}` — a never-delivered input reads `undefined`);
  literal `in-X` parameters are deliveries like any other.

### Expression (expression.ts)

- Compiled `new Function(...identifiers, 'Noodl', preamble + 'return (expr);')` — the preamble
  aliases `min/max/cos/sin/tan/sqrt/pi/round/floor/ceil/abs/random/pow/log/exp` and the bare
  `Variables`/`Objects`/`Arrays` globals (line 642). Ports are **regex-mined identifiers**
  (dotted paths contribute the root only; string literals stripped; the ignore list line 681).
- Inputs seed `undefined` (NDA-017 §2 — the old `0` seed is deliberately gone). Automatic
  evaluation is **gated on any input having arrived** unless the expression references no
  ports; an explicit `Run` is never gated.
- `result`/`isTrue`/`isFalse` **abstain `null` until the first evaluation**; after that
  `result` is the raw value, `isTrue`/`isFalse` its truthiness. `asString` folds
  null/undefined → `''`; `asNumber` → `Number(v) || 0`; `asBoolean` → `!!v`.
- **`isTrueEv`/`isFalseEv` fire on *every* evaluation** — not change-gated (line 236). `done`
  is invocation-only (outcome tokens exist only on the `Run` path; a value-driven evaluation
  reports to an empty token list, which pulses nothing).
- Throw → `result` stays/returns `0` **and** `failure` + `error` (NDA-004 §2); compile failure
  likewise. `Noodl.Variables/Objects/Arrays` reads are detected and **reactively subscribed**.

### Javascript2 (the Script node, javascriptnodeparser.js)

Not a function — **a hand-written node definition**: three generations of DSL (`define({...})`,
`script({...})`, `Node.Setters/Signals/OnInit/OnInputsChanged/OnDestroy`), lifecycle methods,
per-input setters, an external-URL mode that fetches the body over XHR. Its faithful
translation target is a hand-written React component, which is a different task (it is the
export-side twin of P69's custom nodes). **Javascript2 is out of every EXP-003 slice** and
defers whole with a named reason. The corpus confirms the cost is nil (§2).

## §2 The corpus (js-survey.ts, session 13 scratchpad)

139 nodes / 42 distinct bodies after project-clone dedupe: **108 Function, 17 Javascript2, 14
Expression** (the audit's 68/11/10 is the same population deduped harder). The census, by what
the bodies actually touch:

- **Pure `Inputs`→`Outputs` bodies** (~14 distinct): every real Expression in the corpus
  (`count - 1`, `count === 0`, `price.slice(1) * 0.9`, `Text !== null && … && Text.length <= 2`)
  and the formatter Functions (`formatList`, `countFormatter`, `reviewFormatter`, `iconMapper`,
  `fn`, `formatPuppies`, `formatInquiries` — 1-3 lines each, `Outputs.text = …`). No Noodl API,
  no DOM, no timers, no `this`. **This is the re-host tier.**
- **Runtime-coupled bodies** (the Filters family, ~16 distinct × 5 clones ≈ 80 nodes): heavy
  `Component.Object` (80 marker hits), `Component.RepeaterObject` (70), `Noodl.Events` pub/sub
  (40), `setTimeout` debouncing (10), `Noodl.Object.create`, and — load-bearing — **functions
  shared between Function nodes through the `Component` scope object** (`Component
  .UpdateCondition` is *defined* in one node and *called* from another). A per-node translation
  is impossible by construction; this tier is a per-component rewrite. **Tier B.**
- **Browser-coupled Javascript2**: the ~440-line date-picker (CDN script injection, DOM
  construction, `navigator.userAgent`, `new Date`) — both variants; plus junk. Every real
  Javascript2 body is Tier C or broken. Zero cost to deferring the type.
- **Junk/broken bodies** (~8 distinct, from AI-drive fixtures): `zzzUndefinedThing;`,
  `const total = pri`, `// not written yet`, `Script.Signal.runOnce = function` (syntax
  error), empty strings. A design that assumes bodies compile ships a lie — **does-not-compile
  is a first-class defer reason**, mirroring the runtime's own `parseScript` failure path.

Sink reality (what consumed JS outputs feed): `Component Outputs` value ports (the biggest —
lifted state, deferred by session 10's ruling), `Text.text`, `textinput.clear`,
`Group.visible`/`Text.mounted` (booleans), `SetDbModelProperties.prop-*` (handler chains),
`net.noodl.visual.icon.iconIconSource`, one wired `NavigationShowPopup.target` (structure —
already a named defer). Feed reality: `Component Inputs` props, `Model2.prop-*`,
`DbCollection2.items` (stub territory), control outputs (`onTextChanged`, `range.value`), and
`run` from buttons/controls.

## §3 Eligibility: the purity gate (per node, before any translation)

A Function or Expression node enters the re-host slice only if **all** of these hold; each
failure defers the node with the *named* reason (the CO precedent — deferrals are the map for
the next slice):

1. **The body compiles.** Plan-time check with the same constructor the runtime uses
   (`new Function`/`AsyncFunction` in a try/catch — mirroring `_parseScriptForErrorsAndPorts`).
   A body that does not compile defers as `the script does not compile: <message>`. (The
   runtime would pulse `failure` at run-time; certifying an all-undefined translation for a
   broken script would be a hole shaped exactly like the defect.)
2. **No runtime-API marker.** `Noodl.` / `Component.` / `Script.` anywhere in the body (after
   comment stripping) defers, naming the API: *"reads Component.Object — the component-record
   tier (controlled-state slice + EXP-003 Tier B)"*. This single gate catches the entire
   Filters family, including the cross-node `Component.UpdateCondition` sharing.
3. **No nondeterminism or environment marker**: `new Date`/`Date.now`, `Math.random`/bare
   `random(` (Expression preamble!), `fetch`/`XMLHttpRequest`, `setTimeout`/`setInterval`,
   `window`/`document`/`localStorage`/`navigator`, dynamic `import`. Named individually.
   `console.*` is allowed (a log is not a semantic).
4. **No `this.`** (the runtime's `this` persists across runs — cross-run state is Tier B), and
   **no `async`/`await`/`.then(`** in slice 1 (an async body's completion ordering is real
   semantics; it joins the invocation tier when the harness exists).
5. **Every input statically sourced** from the existing emit vocabulary (props, state/store
   reads, literals, collection/repeater fields already modeled) or never delivered (reads
   `undefined`, faithfully). An input fed by a deferred node defers this node as collateral,
   naming the feeder.
6. **Every *consumed* output lands** (the strict-mixed verdict, sessions 10/12): value outputs
   into render binds within the emit vocabulary or into the same handler chain; `done` (and
   Expression's `done`) consumed only as chain-internal continuation. Consumed
   `success`/`failure`/`error`/`unchanged`, consumed `isTrueEv`/`isFalseEv` (they pulse per
   evaluation, which render-derived code has no faithful analogue for), or an output feeding a
   port outside the vocabulary → defer, naming the port.
7. **Run-model fit** — the node falls in one of the two translatable shapes of §4; a run-wired
   node whose outputs feed *render* sinks needs materialized state and defers to the
   controlled-state slice by name.

Expression adds two of its own: any detected Noodl dependency (`detectDependencies` — bare
`Variables`/`Objects`/`Arrays` or `Noodl.*`) defers; and an expression whose identifier set is
empty is a literal — fold it, no function needed.

## §4 The target output (hand-written first)

Two translatable shapes, both pure:

### A1 — reactive-pure (no `run` wire; runs on ticked input changes)

The node is a **derived computation** — the session-6 rule again, one tier up: *the derived row
compiles away into a function call*. The body is emitted **verbatim** inside a wrapper in the
component file, above the component (locality is what a React developer inherits):

```tsx
// From the Function node "formatList" — the body is preserved verbatim. The wrapper
// reproduces the node's contract: inputs arrive as a record, assignments to Outputs publish.
function formatList(Inputs: { items: PuppyRecord[] | undefined }): { text?: string } {
  const Outputs: { text?: string } = {};
  const list = Inputs.items || [];
  Outputs.text = list.map((p) => `${p.name} — ${p.breed}`).join('\n') || 'No puppies yet.';
  return Outputs;
}
```

In the component, one render local per node instance, sinks read its fields:

```tsx
const formatListOut = formatList({ items });
…
<span className="text-…">{formatListOut.text ?? ''}</span>
```

- **Input types** from `intype-*` parameters where authored, else `unknown`; **output types**
  from `outtype-*`, else `unknown`, every field optional — an output the body might not write
  reads `undefined`, exactly like the runtime getter. Every Function output is therefore
  **maybe-undefined** at its sinks and folds through the session-12 `{ kind: 'undefined' }`
  machinery (format → `''`, truthiness → false, children/attr → omitted).
- **tsc is part of the gate**: the emitted module is strict-mode TS, so a body that assigns an
  undeclared identifier (legal in the runtime's non-strict compile) fails the emitted app's own
  build. Plan-time approximation: the compile check of §3.1 plus a strict-mode recompile
  (`'use strict'` prefix) — a body that compiles sloppy but not strict defers named.
- An Expression is the same wrapper collapsed to a return — `function isOutOfStock({ count }:
  { count: number | undefined }) { return (count === 0); }` — with the preamble names it
  actually references destructured from `Math` above the return (never the whole preamble;
  `random` is gated by §3.3 anyway). `isTrue` reads `!!f(...)`, `isFalse` `!f(...)`, `asString`
  /`asNumber`/`asBoolean` fold exactly as the getters do (§1).
- **Recorded divergences** (cosmetic, same family as the store end-of-frame lag): the runtime
  change-gates publishes and coalesces runs per frame; render-derived code recomputes per
  render and delivers by value identity. For a pure body these agree at every quiescent point —
  that is grade Q of §6, and it is the *definition* of why A1 is safe. The Expression
  `null`-abstain before first evaluation is unreachable in the emitted world because every
  vocabulary source has a boot value — noted, not modeled.

### A2h — invocation-pure (run wired from a handler chain; outputs consumed in that chain)

The node is a **handler-inline computation** over `.get()` snapshots (the session-6 handler
rule), inside the existing handler vocabulary:

```tsx
onClick={() => {
  const incremented = increment({ count });   // Expression "count + 1", verbatim
  setStock(incremented);                      // the chain the done/result wires described
}}
```

- `result`/value outputs become handler locals; `done` is chain-internal ordering (the popup
  `done` precedent) — the actions it triggers run after the compute, in wire order.
- The corpus shape this serves: `run ← button.onClick`, `result → SetDbModelProperties.prop-*`,
  `done → SetDbModelProperties.store` (phase58). Note `done` really is invocation-only in the
  runtime (§1), so a ticked input changing does *not* fire the chain — the handler-only
  translation is exact, not an approximation.
- A run-wired node whose outputs feed **render** sinks is *not* A2h — it needs a `useState`
  home for the outputs and joins the controlled-state slice (named defer, §3.7).

### Plan/IR vocabulary

- `BindingSource` grows `jsfun`: `{ nodeId, fnName, args: Record<inputName, ValueExpr>,
  output }` — plan resolves each `in-*`/identifier feed through `resolveExpr` like any other
  source; emit hoists one render local per node instance with ≥1 consumed output and prints
  field reads at sinks. Handler side reuses the same record as a handler action step.
- The wrapper emits once per node (not per consumed output); function names sanitize from the
  node label (`formatList`, `expr_increment`), deduped per file with numeric suffixes.
- Ledger: `JavaScriptFunction` and `Expression` flip to `translated` **in the same commit** as
  the slice (the gate's own rule — trusted, not verified); `Javascript2` stays `deferred` with
  its exemption rewritten to name §1's ruling.

## §5 Equivalence rules (the harness contract — written now, enforced when rewrites begin)

Two grades, chosen by run model — this distinction is the design's answer to "what does
behaviourally equivalent mean for a reactive graph":

- **Grade Q (quiescent)** — for reactive-pure nodes. Compare the *published output record* at
  every quiescent point (both systems idle, no scheduled work). Intermediate run counts,
  coalescing, and change-gate suppressions are scheduling artifacts, **not** observable
  behavior; two systems are equivalent iff every quiescent snapshot matches. This is the grade
  that makes A1's per-render recompute faithful.
- **Grade I (per-invocation)** — for anything reached by an explicit `Run`/handler pulse. One
  invocation = one run; compare output values *and signal pulses, in count and order, per
  invocation* (`success` before `done`, the source order). A signal fired twice where the
  original fired once is a real bug at this grade.

Value comparison at both grades: `Object.is` for primitives (NaN equals NaN; ±0 distinct —
stricter than the runtime's own `!==` change-gate, which is fine because the gate is a
*publisher*, not the observer), structural-deep for plain objects/arrays, `undefined` ≠ `null`
≠ absent-key. No float tolerance while both sides run the same engine — tolerance enters only
with EXP-005's cross-framework ports, as an explicit option.

**The verifier must be shown to fail** (the task doc's own bar): the known-bad set is written
into the harness tests from day one — inverted condition, off-by-one, output-name typo,
dropped signal, doubled signal, change-gate removed (grade I catches it; grade Q must *not* —
that asymmetry is itself a test).

## §6 The trace harness (architecture on paper; built when the LLM tier starts)

- **Record in the interpreted runtime, at the seams read this session**: Function —
  `setScriptInputValue` (arrival), `runScript` entry (invocation + cause + input snapshot),
  the `outputValuesProxy` set trap **before** the change gate (writes, so the gate itself is
  replayable), `_sendSignal` (pulses), the catch arm (errors). Expression —
  `_onInputValueArrived`, `_calculateExpression` entry/exit. All five are single functions
  today; the taps are additive.
- **Format**: JSONL per node instance — `{ seq, nodeId, component, ev: 'input'|'invoke'|
  'write'|'pulse'|'error', name?, value?, cause? }`, values serialized structured-clone-style;
  a non-serializable value (function, DOM node, Model ref) records as an opaque type marker
  and **auto-classifies the node unverifiable** — never silently verified.
- **Replay** for pure nodes needs no app: load the translated function, drive it with the
  recorded input timeline, compare per grade. Tier B replay (when it exists) drives
  `@nodegx/core` primitives seeded from recorded state.
- **Recorder self-validation** (task-doc step 5, kept): record EXP-002's deterministic corpus
  in preview, replay the *generated* code — must verify clean before any LLM output is judged;
  plus the §5 known-bad set.
- **Verdicts**, per node, feeding EXP-004: `verified` / `mismatched` / `unverified` (no trace
  coverage) / `unverifiable` (nondeterministic or non-serializable) / `preserved` (untranslated,
  original body in place). Re-hosted nodes are `verified-by-construction` — a sixth verdict so
  the report never conflates "same code" with "traces agreed".

## §7 What the LLM does when it arrives (scoped by this design)

1. **Idiomatization** of re-hosted wrappers (optional, per node): prompt = verbatim wrapper +
   port types + surrounding component; accept only on grade-Q/I verification against traces
   (or, for pure bodies, exhaustive replay of recorded inputs); fall back to verbatim on
   mismatch — the export is never blocked on the LLM.
2. **Tier B translation** — after the controlled-state slice lands its vocabulary
   (`Component.Object` → the materialized record of CO §7; `Noodl.Events` → an emitted event
   bus; `RepeaterObject` → row identity). Per-*component* rewrites (the shared-function
   reality of §2), repair-loop bounded, trace-verified, honesty-reported. This is where the
   task doc's original design lives, intact but narrowed.

## §8 Corpus impact, stated honestly

The re-host slice alone translates the pure tier: the leg001 formatters, the puppy/fix007
formatters (where their feeds resolve — `DbCollection2.items` depends on how the stub binds),
the phase58 expressions, the ProductCard discount expression and the Text Search expressions
(×5 clones each) — roughly **15–25 of the 139 raw JS nodes**, plus their collateral subtrees.
The big number stays locked behind Tier B (~80 Filters-family nodes) and the Component-Outputs
value ports — which is the same wall the controlled-state slice already owns. The slice's real
value is the wrapper vocabulary + the §5 contract: every later JS session builds on both, and
the audit's named defers start pointing at *specific* APIs instead of "logic node".

## §9 Fixture & test plan (the EXP-002 discipline)

- Cheer grows a pure Function (a greeting formatter beside GreetingCard) and a pure Expression
  (a truthiness gate into a `mounted`/`enabled` sink), authored via MCP on the live project,
  snapshot re-copied (`diff -rq`).
- Tests: wrapper emission golden (byte-for-byte), purity-gate unit tests over every §3 reason
  (each producing its named defer), the strict-mode recompile gate, A2h handler inlining, the
  maybe-undefined folds at each sink kind, Expression preamble destructuring, junk-body defers
  (`zzzUndefinedThing`, `const total = pri` verbatim from the corpus).
- jsdom drive: the formatter renders through the wrapper; the expression gates its sink.
- Emitted app `tsc -b` + `vite build` clean; ledger flip same commit; audit re-run with
  named-reason spot-checks.
