# HLS-004 — what was built

**Session 5, 2026-09-09.** 4 of 4 acceptance criteria closed. The exported app builds, and the
build was run rather than reasoned about.

> **The person sentence:** *someone exports an app they did not write, runs
> `npm install && npm run build`, and gets a built site — without editing a generated file.*
> Measured below, end to end, on `budget-desk`.

## 1. 🔴 The correction that reorders the task: the gate already existed

The task was scoped around building a `tsc --noEmit` gate over the emitted corpus — *"this, not the
fix, is the deliverable"*. **It was already there and already green.**
`tests/typecheck-emitted.test.ts` has compiled every fixture under the scaffold's own
`compilerOptions` — `strict: true` included — since EXP-011 §24.6, with a presence control beside
it. It passed at HEAD before a line of this task was written: 46 rows, 43 fixtures.

What it did not have was **a fixture with the reported shape.**

The corpus contained exactly **one** `Expression` node in 42 projects, and its text was
`(name || '').length > 1`. The `|| ''` guards the very read that trips. So a gate that compiled
everything, under the right compiler, with a working sabotage arm beside it, had **never once
compiled issue #24's shape** — and read exactly like a gate that had.

This is *a gate can have a hole shaped like the defect*, and the hole was in the corpus rather than
the instrument. It is why the deliverable below is a fixture first and a fix second.

## 2. What was measured before anything was changed

Reproduced #24 rather than reasoning from the issue text. `cheer` copied to a scratch directory,
its one expression changed to do arithmetic, parsed, emitted, typechecked:

```
TS18048 src/pages/Home.tsx:34: 'name' is possibly 'undefined'.
```

The same error code the reporter filed. The wrapper it came from:

```ts
function hasLongName({ name }: { name?: string }) {   // ← every input field, unconditionally `?:`
  try { return (name * 2 > 1); }
```

🔴 **And the first correction to the task file: it is not the `Props` interface.** The task located
the defect at `analyze/plan.ts:4655` — *"every `Component Inputs` port is a typed optional prop"*.
That line is real, but the `?` that produces TS18048 is a different one, at
`emit/component.ts:5809`, on the **re-hosted JS wrapper's** input record. A component input reaches
an `Expression` *through* that wrapper, and so does a Variable, a page parameter and another
node's output. The rule is wider than the task thought: **every JS-node input, whatever feeds it.**

## 3. The contract, and why it is not a default

`JsFunctionPlan.inputs` already distinguished three classes and the emitter flattened all three to
`?:`. They now type differently:

| class | the graph | emitted | why |
|---|---|---|---|
| wire-fed | `expr` present, not literal | `months: number \| undefined` | the call site always passes it; the **value** may not have landed |
| literal-fed | `expr.kind === 'literal'` | `rate: number` | a constant folded in at the call — it cannot be absent |
| mined, unfed | no `expr` | `drift?: any` | no wire, no parameter: nothing ever passes it |

**The `?` was wrong about absence, and the call site is the proof.** A wrapper is called with its
input's resolved source spliced in — `projected({ months, rate: 250 })` — so the property always
arrives. What may be undefined is the *value*, and that is a different claim.

🔴 **Nothing is defaulted, and that was the one tempting wrong answer.** The obvious repair is
`drift = 0`. `registerInputIfNeeded` seeds a discovered input to `undefined` **rather than `0`**,
deliberately, under NDA-017 §2: an `a + b` whose producers have not landed must answer `NaN` —
visibly absent — instead of a plausible zero no downstream branch can tell from a real one.
Defaulting in the exporter would reinstate exactly that defect, in generated code nobody would
think to look at. `budget-desk` carries the case on purpose and a row pins it.

### What compiles the body, then

The author's expression is **JavaScript preserved verbatim** (EXP-003 §4) evaluated in the
runtime's untyped scope. Strict-null-checking it is checking a contract that never existed. So the
interface above is what the **call site** is held to, and the names enter the body as the runtime
has them:

```ts
function projected(__inputs: { months: number | undefined; rate: number }) {
  const { months, rate } = __inputs as { [K in keyof typeof __inputs]: any };
  try { return (months * rate); }
```

⚠️ **Mapped over `keyof`, not `Record<string, any>`, and the difference is asserted.** The keys stay
the mined set, so a read of a name that was never an input is still an error — the class
`typecheck-emitted.test.ts` exists to catch. What is loosened is the type of the author's own
declared inputs inside the author's own body, and nothing else. It is the same bounded loosening
`scriptFileSource` already states for its `// @ts-nocheck`, and this repo had therefore already
ruled on the principle once.

## 4. The acceptance criteria

**AC1 (person) — closed, by running it.** `budget-desk` exported through the packed CLI
(`node dist/cli.mjs export …`, exit 0, 14 files, *"Everything translated"*), then in the exported
directory:

- `npm install` — 72 packages, 0 vulnerabilities.
- `npm run build` → `tsc -b && vite build` → **exit 0**, gated on the status and not on the log.
  46 modules transformed, `dist/assets/index-CX_f9Kcq.js` 234.69 kB.
- **Not one generated file was edited**, which is the half of the sentence a green build does not
  prove on its own.

Then the arithmetic, because *"it built"* is a statement about the compiler and not about the
answer. The emitted page server-rendered through `react-dom/server` — the real component, not a
source-text match:

```
<p class="Gauge_gaugeTotal">1500</p>          ← months=6 × rate=250. Right.
<p class="Gauge_driftTotal">NaN</p>           ← the unfed input, still abstaining.
```

✅ Both halves. The arithmetic is right **and** NDA-017's abstain survived the export. React itself
remarks on the second one (*"Received NaN for the `children` attribute"*) — that is React
commenting on the author's graph, which is the correct place for the complaint to land.

**AC2 — closed.** `hls004-an-export-that-builds.test.ts`, 11 rows. The reverted arm is a transform
on the emitted output that inverts exactly the two things that changed, so it cannot drift from
what it claims to reproduce. It restores `TS18048 'months' is possibly 'undefined'`, and two rows
guard the mutant itself: it must have fired (`not.toBe` the original), and it must still be a
**program** — no `TS1xxx` syntactic diagnostics, and every diagnostic it does produce is TS18048.
A reverted arm that does not compile grades nothing.

**AC3 — closed.** Two presence controls on this fixture specifically, not on some other one: an
undeclared name is caught, and — the row that matters — an input the graph never mined is *still*
an error, which is what pins the scope cast to `keyof` rather than `Record<string, any>`.

**AC4 — closed, and by construction rather than by contrivance.** `projected` carries a guaranteed
input and a non-guaranteed one **in the same interface**: `rate: number` beside
`months: number | undefined`. `withDrift` carries the third. The rows also assert the emitted
*caller* matches — `projected({ months, rate: 250 })` and `withDrift({ months })`, the optional one
omitted.

### The cost decision the task asked for

**`tsc --noEmit` is in the suite; `vite build` is not.** Bundling needs a real `npm install` of
`react@19`/`react-router-dom@7` per fixture — network and minutes per row, across 43 fixtures. What
that costs is named rather than waved at: tsc does not resolve `react-router-dom` or `vite/client`
against the real packages (`helpers/typecheckApp.ts` declares both ambiently and says so), does not
run PostCSS over the emitted CSS modules, and cannot see a bundler-only failure such as an
unresolvable asset URL. The one real build above is what covers that, once, by hand.

## 5. C43 — closed, and which arm the export actually takes

The task said to find out before deleting. Both `case 'collection-clear':` arms are in the **same**
`switch` (`analyze/plan.ts:18562`), so the **first wins** and the second was unreachable. They were
not identical: the live arm walks `action.minted?.failThen`, the dead one did not. So the dead arm
was a strict subset — deleting it changes no behaviour, and keeping it invited the *less* complete
one to be read as live. `npm run build` is now warning-free.

## 6. What this leaves, and what it does not

**Leaves you:**

- An export that builds, proved by building it, and a fixture that will keep it that way.
- 90 suites / 3204 rows green in `nodegx-export`. `tsc --noEmit` clean (it covers `tests/**`, so the
  editor-webpack exposure that reddens `test:ci` from this directory is covered too).
- The corpus identity golden regenerated **once, deliberately, with the count taken first**:
  **2 of 840** hashes differ (`batch-desk` and `cheer` — the only two corpus projects with a
  re-hosted JS node), **0** files appeared or vanished in an existing project, **1** project added.
  The diff in each is confined to the signature line and the binding beneath it. Recorded in the
  gate's own header, where the HLS-001 counts already are.

**Does not leave you:**

- ⚠️ **A `budget-desk` that bounds anything on its own.** It is a fixture minted for a task, which
  is the thing HLS-001's gate header warns about. The 42 projects around it are what keep the
  identity gate honest; this one keeps the *shape* in the corpus.
- 🔴 **Any claim about `Script` nodes.** They are `// @ts-nocheck` by a deliberate earlier ruling
  and this task did not revisit it. An author's Script body is still not compiled by anything.
- ⚠️ **A second exported project built by hand.** One was. The gate is what generalises, and its
  blind spots are listed above rather than assumed away.
- ⚠️ **HLS-005's subject.** `budget-desk` translated fully, so the *"Everything translated"* line
  was accurate here — which is not evidence about C42, and does not touch it.
