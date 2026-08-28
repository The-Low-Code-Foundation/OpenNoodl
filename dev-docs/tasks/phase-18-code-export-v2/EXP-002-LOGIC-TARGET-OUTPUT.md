# EXP-002 statically-knowable logic — the `derived()` row, written by hand first

> Step 6. EXP-001's table maps Expression/logic nodes to `derived()`. This slice settles what
> that row actually means for the two nodes whose semantics are fully static — **String Format**
> and **Condition** — as generator decisions on real fixture material, before the generator
> exists, exactly as every step has. The headline decision: **the derived is compiled away.**
> Neither node becomes a `derived()` object, a `src/derived/` module, or a `useDerived` hook;
> each becomes an inline expression in the code that consumes it. §1 argues why.

The fixture is the **Cheer** project extended again
(`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`, snapshot at
`packages/nodegx-export/tests/fixtures/cheer`). The additions:

```
Pages/Home
  previewFormat            (String Format, format "Cheering for {name}!")
  visitorVar value         → previewFormat name       (the placeholder port)
  previewFormat formatted  → cheerPreview text        (new Text under the input)

Pages/Mood
  themeFormat              (String Format, format "Feeling {theme} today")
  subTheme value           → themeFormat theme        (REPLACES subTheme → themeText.text)
  themeFormat formatted    → themeText text
  hasVisitor               (Condition, runOnChange-condition: false)
  readVisitor-2 value      → hasVisitor condition
  themeButton onClick      → hasVisitor eval          (REPLACES onClick → setTheme.set)
  hasVisitor ontrue        → setTheme set
```

The runtime semantics were read from the source, not assumed (`stringformat.ts`,
`condition.ts`, `run-on-value-change.ts` in `noodl-runtime/src/`):

- **String Format** parses `{placeholder}` ports out of its format string
  (`/\{[A-Za-z0-9_]*\}/g`), substitutes `String(v)` for each, and an unset placeholder
  substitutes the empty string. A repeated placeholder fills **every** occurrence with the same
  value — the sequential `replace` walks forward through the string — despite the port
  description claiming it "fills only the first time"; the code is the authority. Formatting is
  deferred to end-of-frame (`scheduleAfterInputsHaveUpdated`), the divergence class step 5
  already accepted.
- **Condition** tests plain truthiness (`condition ? 'ontrue' : 'onfalse'`), exactly one branch
  signal per test. `Evaluate` is **additive** (NDA-017): wiring it does *not* stop the node
  re-testing on every change of `condition` — only the authored checkbox
  `runOnChange-condition: false` does, and absent means ticked. `Is True`/`Is False` answer
  `null` until the first test.

---

## 1. Where a `derived()` lives: nowhere — the derived is compiled away

EXP-001 built `derived()` to mirror how the interpreted runtime's output ports work: compute on
read, track dependencies, memoise. In the *exported* code that job is already taken. A rendered
sink that reads a variable or a store key does so through `useValue`/`useStore`, and those hooks
are what make the component re-render — precisely the reactivity a `Derived`'s tracking would
provide, one layer up. So a String Format whose output lands in rendered content needs no
runtime object at all: the computation is a template literal over locals the hooks already
provide, recomputed on render because that is what renders do.

- **A module-level `derived()`** (`src/derived/<name>.ts`) would earn its place only for a
  computation shared *across* components — and a logic node lives inside exactly one component;
  its wires cannot leave it. There is nothing to share, so there is no module.
- **`useDerived`** would add memoisation to a string concatenation — the bookkeeping costs more
  than the computation it saves, and no human would write it.
- **In handler context** the same expression appears over `.get()` snapshots, exactly as step
  5's value reads do.

What this slice adds is therefore not a new runtime construct but a new *analysis* construct:
logic nodes resolve into **expression trees** over the same source vocabulary handlers already
use (prop, variable, store key, literal), and the trees are rendered inline wherever their
output lands. This is the pattern every later statically-knowable node (And, Or, Inverter,
Switch) will follow.

Two vocabulary extensions fall out, shared by both contexts:

- `store-key` joins the value-expression vocabulary (a single-key Subscribe read was previously
  only a render binding): in render it is the existing `useStore` selector local; in a handler
  it is `<store>.get().<key>`.
- `format` and branch conditions compose recursively — a placeholder may itself be fed by
  another translated logic node. Resolution carries a visited set; a wire cycle defers.

## 2. `Home` — String Format over a variable, in render

```tsx
// src/pages/Home.tsx
// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useValue } from '@nodegx/core/react';

import { CheerBanner } from '../components/CheerBanner';
import { GreetingBadge } from '../components/GreetingBadge';
import { celebrate } from '../events';
import { visitorName } from '../stores/variables';
import styles from './Home.module.css';

/** Home. */
export function HomePage() {
  const name = useValue(visitorName);

  return (
    <div className={styles.page}>
      <title>Cheer</title>

      <p className={styles.headline}>Cheer for a visitor</p>

      <input
        className={styles.nameInput}
        placeholder="Type a visitor name"
        onChange={(event) => visitorName.set(event.target.value)}
      />

      <p className={styles.cheerPreview}>{`Cheering for ${name ?? ''}!`}</p>

      <GreetingBadge />

      <button
        className={styles.cheerButton}
        onClick={() => celebrate.emit({ message: visitorName.get() })}
      >
        Cheer
      </button>

      <CheerBanner />
    </div>
  );
}
```

**What this settles.**

- **A format lands as a template literal at its sink** — `{`Cheering for ${name}!`}` — not as a
  named local, mirroring step 4's rule that one input feeding two sinks is two interpolations.
  The hook (`useValue(visitorName)`) is earned by the expression tree exactly as a direct
  binding would earn it, with the same local-name rule (`visitorName` → `name`).
- **Static text in the format is transcribed verbatim** into the literal, with backslash,
  backtick and `${` escaped.
- **A placeholder set as a literal parameter folds into the text** at generation time; a format
  whose placeholders are all static folds to a plain string and lands as static text. A
  placeholder with neither wire nor parameter substitutes `''` (the runtime's own rule), i.e.
  it simply disappears from the literal.
- **A format that is exactly one placeholder** (`{name}`, no surrounding text) collapses to the
  bare expression when the source is string-typed — a human would never write `` `${name}` `` —
  and stays a template literal otherwise, keeping the runtime's `String(v)` coercion.
- **A placeholder whose source can statically be undefined interpolates with `?? ''`** — the
  variable here boots `undefined` (step 5's honest module shape), the runtime substitutes the
  empty string for an unset input, and `String(undefined)` would print the word. The drive
  caught exactly this: `Cheering for undefined!` on first render. Sources that cannot be
  undefined (an initial-state store key like `theme` below) interpolate bare. The bare
  single-placeholder collapse needs no guard — JSX drops `undefined` on its own.
- Template-literal substitution of a number is `String(v)` — the same coercion the runtime
  applies, so number-typed placeholders need no special case.

## 3. `Mood` — String Format over a store key, and the Condition branch

```tsx
// src/pages/Mood.tsx
// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useStore } from '@nodegx/core/react';

import { mood } from '../stores/mood';
import { visitorName } from '../stores/variables';
import styles from './Mood.module.css';

/** Mood board. */
export function MoodPage() {
  const note = useStore(mood, (s) => s.note);
  const theme = useStore(mood, (s) => s.theme);

  return (
    <div className={styles.moodPage}>
      <title>Mood</title>

      <p className={styles.moodHeading}>Mood board</p>

      <input
        className={styles.noteInput}
        placeholder="Write a note"
        onChange={(event) => mood.set({ note: event.target.value })}
      />

      <p className={styles.noteEcho}>{note}</p>

      <p className={styles.themeText}>{`Feeling ${theme} today`}</p>

      <button
        className={styles.themeButton}
        onClick={() => {
          if (visitorName.get()) mood.set({ theme: visitorName.get() });
        }}
      >
        Steal the visitor's name
      </button>
    </div>
  );
}
```

**What this settles.**

- **A Condition in a handler chain is an `if` statement.** The pattern
  `trigger → eval`, `ontrue → <action sink>` compiles the whole chain into the trigger's
  handler: `if (cond) action;` — with an `else` when `onfalse` is also wired
  (`if (cond) a; else b;`; a multi-action arm braces: `{ a; b; }`). The Condition node and its
  arm sinks collapse into the handler owner; a branch statement always forces the block arrow
  form (`() => { … }`), since an `if` cannot be an expression body.
- **Truthiness is transcribed as truthiness.** The runtime tests `condition ? … : …` on
  whatever arrives; `if (visitorName.get())` tests the same thing. No boolean coercion is
  added and no boolean-typedness is demanded of the source — the bare `if` is the faithful
  translation.
- **The branch translates only when `runOnChange-condition: false` is authored.** Evaluate is
  additive: with the checkbox ticked (the default), the runtime *also* fires the branch
  whenever the condition input changes — behaviour an `onClick` handler cannot carry. An
  author who wires Evaluate and unticks re-test is following the node's own port description;
  one who leaves it ticked has authored an on-change behaviour this slice defers (it is
  `effect()` territory). Same trap family as `Run` on the query nodes: wiring the control
  signal does not silence the value inputs.
- **The condition source resolves in the handler's context** with step 5's rules — here a
  variable read is a `.get()` snapshot, appearing once in the test and once in the arm, as the
  statement demands. (The runtime reads its input per-getter too; the duplicate read is
  faithful, and synchronous code cannot observe a change between the two.)
- **Boot silence matches.** Evaluate-only plus the untick means the runtime tests nothing at
  boot; the exported handler runs nothing at boot. The `null`-until-first-test subtlety of the
  value outputs never arises, because the value outputs are not part of this translation.
- **The theme sentence** shows a format over a store key: the selector hook and its local
  (`theme`) are exactly the ones a direct binding would have earned; only the sink text
  changes.

## 4. What defers, all with notes, none silently

**String Format:**

- A wired `format` port (the format string itself must be literal).
- A format containing a `{}` placeholder (empty name — the runtime registers a nameless port;
  nothing sane can be said about it).
- A placeholder wire from a source the context cannot resolve (the usual step-5 rule); the
  whole node defers, never a half-filled literal.
- A wire cycle through logic nodes (visited-set guard).

**Condition:**

- **The value outputs `result` / `isfalse` defer wholesale this session.** The translated
  render vocabulary has no boolean sink today (no conditional visibility, no `disabled`
  mapping, no boolean instance props in the fixture), so there is no honest material to hold a
  golden to — and they carry the `null`-until-first-test subtlety besides. They join the
  expression vocabulary when a boolean sink does.
- `ontrue`/`onfalse` wired while `eval` is unwired, or while `runOnChange-condition` is absent
  or true: the node's firing is driven by value changes — `effect()` territory, deferred.
- An `eval` wire from anything that is not a rendered element's DOM event or a translated
  receiver — including another Condition's arm (nesting defers this session).
- An arm wire into anything that is not a translatable action sink; the `done` outcome output
  wired anywhere.

**Recorded divergences (cosmetic, the accepted class):**

- Formatting and testing are end-of-frame in the runtime, synchronous in the export (the step-5
  ordering divergence, again).
- The runtime's sequential `replace` re-scans text it has already substituted, so a runtime
  *value* that itself contains `{placeholder}` text can be re-substituted by a later
  placeholder's pass; a template literal never re-substitutes. Pathological input, recorded.
- `Is True`/`Is False` answering `null` before any test has no inline equivalent — moot while
  the value outputs defer, recorded for when they land.

## 5. What comes next

- **And / Or / Inverter / Switch** extend the same expression vocabulary (`&&`, `||`, `!`,
  ternary) with nothing new to decide about *where* the code lives. *(Corrected by §6 — Switch
  turned out not to belong here at all.)*
- **Condition's value outputs** land when a boolean render sink exists (an `enabled` →
  `disabled` content mapping is the natural first). *(Landed — §6–§9.)*
- **On-change firing** (`runOnChange` ticked, arms wired) is the `effect()` row, its own slice.
- **Model2** (id provenance) — unchanged from the collections slice's §5: the literal-id read
  and the same-handler NewModel id are next.

---

# Extension (session 7): the expression family grows — And, Or, Inverter, and the Condition value outputs

> §5 predicted "And / Or / Inverter / Switch extend the same expression vocabulary with nothing
> new to decide about *where* the code lives." Reading the sources (`and.ts`, `or.ts`,
> `inverter.ts`, `switch.ts` in `noodl-runtime/src/nodes/std-library/`) corrects that in two
> places before any generator work:
>
> - **Switch is not a ternary. It is a stateful latch** — `on`/`off`/`flip` are signal inputs
>   that mutate `_internal.state`, with `switched`/outcome signals on top. There is no
>   expression to compile away; the honest translation is *component state* (a boolean
>   `useState` with three setter paths), a design decision of its own, sitting beside the
>   `effect()` row. It leaves the expression family and is deferred whole, as ordinary logic.
> - **The other three, plus Condition's value outputs, are truthiness devices whose faithful
>   short translations are truthiness-equal, not value-equal.** `a && b` evaluates to an
>   *operand*, the And node's `result` to a strict boolean; `String(a && b)` could print
>   `"Ada"` where the runtime prints `"true"`. So this slice admits boolean expressions into
>   **truthiness sinks only** — a Condition's `condition` input, another logical node's
>   operand, and the one boolean render sink this slice adds (§7). A boolean expression
>   arriving anywhere value-shaped (a format placeholder, a store write, an event payload, a
>   collection entry, a text sink) defers with a note. Value-shaped use can land later by
>   emitting the `!!(…)`-coerced forms; there is no fixture material to hold a golden to today,
>   so it waits.

## 6. The three nodes, from source

- **And** (`numbered-inputs`, ports `input 0`, `input 1`, …): each setter coerces
  (`value ? true : false`); `result` is *false with no inputs*, else true only while no input
  is false. The result is cached and only flagged dirty when the answer changes — an
  optimisation with no translated equivalent needed (React re-renders on dependency change and
  equal values render equal DOM). Translation: operands in port order, `a && b`.
- **Or** (same port scheme): `inputs.some(isTrue)`, no cache. Translation: `a || b`.
- **Inverter**: `!value` **with an undefined passthrough** — a never-set Inverter reports
  `undefined`, not `true`; the source comments call it deliberate ("not yet set" vs "set to
  false"). `!x` is only faithful when `x` cannot be undefined: with `x` undefined the runtime's
  output is `undefined` (falsy) while `!x` is `true` — opposite answers in an `enabled` sink.
  **An Inverter whose operand can statically be undefined defers with a note**; one over a
  source that cannot (a required store key, a folded literal, a format) translates as `!x`.
- **Condition `result` / `isfalse`** (`Is True`/`Is False`): both read the condition input back
  (`!!condition` / `!condition`), `null` until the first test. As *expressions* they are live
  only while the node re-tests on change — so the gate is the branch gate mirrored:
  **value-output use requires `runOnChange-condition` ticked (absent), and translates the
  outputs as the condition's own truthiness (`result` → the bare condition expression,
  `isfalse` → `!condition`)**. A value-mode Condition must be *only* that: `eval` unwired, both
  arms unwired, `done` unwired — a node doing both branch- and value-work in one graph has no
  single honest translation and defers. (The branch gate from §3 is unchanged: arms need the
  *untick*. The two modes are mutually exclusive by construction.)

Numbered-input details that fall out of the port scheme: the runtime's input array is sparse
and `some`/`every` skip holes, but every translatable source pushes a value at boot, so the
exported strict evaluation matches the settled graph (recorded, with the boot-window class). A
*literal parameter* on `input N` is a literal operand; literal operands fold — a folded-true
And operand disappears, a folded-false one collapses the whole And to `false` (mirrored for
Or), an all-literal node folds to a boolean literal. A single surviving operand collapses to
the bare expression (`and(x)` is `!!x`, truthiness-equal to `x`). And with *nothing* wired or
authored at all defers — the constant `false` is real runtime behaviour, but a node nobody fed
is authoring debris, and a note beats a silently disabled button.

## 7. The boolean render sink: `enabled` → `disabled`

Buttons and text inputs carry the control `enabled` input (`addControlEventsAndStates` in
`noodl-viewer-react/src/nodes/controls/utils.ts`): boolean, default true, coerced `!!value`.
The DOM already has this concept, inverted: `disabled`. The mapping joins `CONTENT_PARAMS` as
an *inverting* attribute role:

- A literal authored `enabled: false` emits the bare `disabled` attribute; `enabled: true`
  (the default restated) emits nothing.
- A bound `enabled` emits `disabled={!expr}`, with the negation simplified per shape:
  `!name` over a plain read, `!(a && b)` over a logical, `!cond` over a Condition's `result`,
  and `!!x` over an Inverter or `isfalse` (the double negation *is* the honest form — a human
  disabling a control while `x` is set writes `disabled={!!x}`).
- `disabled` sits after the content attributes in the JSX attribute order, before handlers.

Boot behaviour matches by the same accepted class as §3: the runtime pushes the not-yet-tested
`null`/coerced value down the wire at connect and settles at end of the first frame; the
exported expression is the settled value, synchronously.

## 8. The fixture grows — three sinks, three pages

```
Pages/Home            "you cannot cheer for nobody"
  hasName             (Condition, runOnChange DEFAULT — value mode)
  visitorVar value    → hasName condition
  hasName result      → cheerButton enabled

Pages/Mood            "steal the name onto a fresh board only"
  freshBoard          (Inverter)
  subNote value       → freshBoard value        (note is initial-state ⇒ never undefined)
  canSteal            (And)
  readVisitor-2 value → canSteal "input 0"
  freshBoard result   → canSteal "input 1"
  canSteal result     → themeButton enabled

Pages/Notes           "an empty note needs at least someone to blame it on"
  visitorRead         (Variable2 visitorName — new reader on this page)
  draftOrVisitor      (Or)
  noteDraftVar value  → draftOrVisitor "input 0"
  visitorRead value   → draftOrVisitor "input 1"
  draftOrVisitor result → canAdd condition
  canAdd              (Condition, runOnChange-condition: false — branch mode)
  addButton onClick   → canAdd eval             (REPLACES onClick → makeNote.new)
  canAdd ontrue       → makeNote new
```

Home's button — the Condition value output over the hook local the page already earns:

```tsx
      <button
        className={styles.cheerButton}
        disabled={!name}
        onClick={() => celebrate.emit({ message: visitorName.get() })}
      >
        Cheer
      </button>
```

Mood — the composed logical earns the `useValue` hook exactly as a direct binding would
(`visitorName` was previously handler-only on this page), and the And-over-Inverter renders as
the negated group:

```tsx
// src/pages/Mood.tsx (excerpt)
import { useStore, useValue } from '@nodegx/core/react';

export function MoodPage() {
  const name = useValue(visitorName);
  const note = useStore(mood, (s) => s.note);
  const theme = useStore(mood, (s) => s.theme);
  …
      <button
        className={styles.themeButton}
        disabled={!(name && !note)}
        onClick={() => {
          if (visitorName.get()) mood.set({ theme: visitorName.get() });
        }}
      >
        Steal the visitor's name
      </button>
```

Notes — the Or in *handler* context, as the branch test over `.get()` snapshots (the logical
node collapses into the condition, the Condition into the handler, exactly as §3's chain did):

```tsx
      <button
        className={styles.addButton}
        onClick={() => {
          if (noteDraft.get() || visitorName.get()) notes.add({ text: noteDraft.get(), mood: 'sunny' });
        }}
      >
        Add note
      </button>
```

**What these settle.** Operand order is port order (`input 0` first). The expression tree's
hooks are earned by use, with the same local-name rules. In handler context every read is a
`.get()` snapshot, appearing as many times as the statement demands. A logical feeding a
Condition's `condition` port is ordinary composition — the visited-set cycle guard now spans
all five node types.

## 9. What defers, what folds, what diverges (this extension)

**Defers, all with notes:**

- A boolean expression into any value-shaped sink (format placeholder, store write, payload
  key, collection entry, text/content binding) — truthiness sinks only, §5's headnote.
- An Inverter whose operand can statically be undefined (the passthrough, §6).
- An And/Or with no operands at all; any of the three with an operand the context cannot
  resolve (the whole node defers, never a half expression).
- A Condition mixing modes: value outputs wired while `runOnChange-condition: false` is
  authored (stale snapshots), or while `eval`/arms/`done` are also wired.
- Switch, wholesale — component-state territory, its own slice.
- A logic-node output driving nothing statically translatable (the existing String Format
  sweep, extended to all four).

**Folds:** literal operands fold at generation time (And drops true / collapses on false, Or
drops false / collapses on true, Inverter inverts, Condition value-mode over a literal is the
literal's truthiness); double negation folds (`Inverter → Inverter`, `isfalse` of a folded
`not`); a single-operand And/Or collapses to its operand's truthiness.

**Recorded divergences (the accepted classes):** end-of-frame vs synchronous, again, including
the value outputs' `null`-until-first-test boot window; And's answer-change-only dirty flag
(no observable difference in React); the sparse-holes subtlety for an operand whose source
never pushes (unreachable through translatable sources, which all push at boot).

# Extension (session 27): the reactive Condition — the other half of the node

§3 translated the Condition that a handler pulses. This extension translates the one nobody
pulses: the box ticked, `Evaluate` unwired, re-testing on its own. It was the last untranslated
shape of a node the slice otherwise owned, and in the corpus it is one idiom — the auth gate.

## 10. The reactive Condition is a `useEffect`, not a handler

**What the runtime does** (`packages/noodl-runtime/src/nodes/std-library/condition.ts`). The
`condition` setter calls `scheduleEvaluate` whenever `shouldRunOnValueChange('condition')` — the
ticked box — answers true. The scheduled test flags both value outputs dirty and then
`sendSignalOnOutput(condition ? 'ontrue' : 'onfalse')`: **exactly one arm fires per test**, and a
test happens per arrival, coalesced to one per frame by `hasScheduledEvaluation`.

A test-per-arrival firing one branch is a re-run keyed on a value. That is `useEffect`:

```tsx
const session = useSession();

// Require Login — re-tested whenever its condition changes (LOGIC-TARGET §10).
useEffect(() => {
  if (!session.authenticated) navigate('/admin-login');
}, [session.authenticated]);
```

The branch itself is the **same `branch` action** §3 already compiles, so `actionCode` prints it
unchanged — including the negated single-arm form, which is what the auth-gate idiom (`On False`
→ navigate, no `On True`) reduces to. The two halves of the node differ in *what fires the
branch*, never in what the branch does, and the analysis says so: one
`compileConditionBranch` behind two gates.

### 10a — Why a literal condition still fires once, and an unfed one never does

`NodeScope` applies authored parameters through `node.queueInput`, which reaches the same setter a
wire does — so a Condition with a literal `condition` and a ticked box tests **once at boot** and
never again, which is `useEffect(…, [])`. A Condition with neither a wire nor a parameter is never
set at all, so it never tests and never fires an arm; the existing `nothing statically known feeds
condition` gate already refuses that one, and refusing it is correct rather than conservative.

### 10b — The gates (any hit ⇒ the node defers, reason named)

- **`Evaluate` is wired *and* the box is ticked** — the node does both, independently (NDA-017
  made `Evaluate` additive). A handler reproduces the pulse and drops the re-tests; an effect
  reproduces the re-tests and drops the pulse. Neither is faithful, so it defers, and the reason
  now says which: *"the two fire independently"*.
- **A value output (`result`/`isfalse`) or `done` is wired** — the existing stray-output check.
  One node cannot be a comparator and a branch at once; `conditionValueExprOf` refuses the mirror
  case with its own named reason.
- **No arm at all** — not an effect; that is the pure-comparator shape the value pass owns.
- **An arm reads a handler-only value** (an input's text, an event's value, a receiver's payload)
  — an effect body reads the render closure, so `actionsValidIn(…, { kind: 'render' })` refuses
  it. Same rule the DOM and receiver attachments already apply, with `render` as the context.
- **The component emits no file** — nowhere to host the effect.
- Plus everything `compileConditionBranch` already refused: an unresolvable condition, an arm
  driving nothing translatable, a nested Condition.

### 10c — Two walkers, twice, and the file said so both times

The emit layer keeps `collectExprUse` (handler actions) and `hookExprSources` (render bindings)
separately, with a ⚠️ on the second recording that a `session-get` set in only one of them emitted
`session.authenticated` with no `const session` above it — *"and only building the emitted app
caught it"* (USER-FAMILY §9). This slice met the same shape twice:

1. **`effectDeps` had no `session-get` case.** It fell through `default:` and added nothing, so
   the auth gate would have emitted `useEffect(…, [])` — a **mount-only** gate that never
   re-tests on sign-out. The dependency list is a third place a value kind has to be enumerated.
2. **A branch effect's condition earns a render local.** The arms print in handler mode
   (`store.get()`), so they earn nothing; but the *condition* is also the dependency list, and
   `effectDeps` spells a dependency as the render local. Registering only in `collectExprUse`
   would have named a `const` no line declares.

The body reading `visitorName.get()` while the dep reads `name` is deliberate, not a slip: the
arm reads the store when the effect runs, and the dep is the reactive local that re-runs it. Two
spellings of one variable, and only one of them can be a dependency.

### 10d — 🔴 The session read is earned in a fourth place

`planProject`'s pass 5 collapses a `User` node only when a surviving expression reads it, walking
`bindings`, `handlers`, `changeHandlers` and `receivers`. A reactive Condition's own test is the
commonest session read there is and lives in **none** of those. Without adding `branchEffects` to
that walk the page imports `useSession` from a module that never exports it — a compile error in
the emitted app, in the three projects the slice exists to fix. Grepping the consumers of
`sessionCalls` before writing the pass is what found it; the corpus build would have found it too,
one step later and with a worse error.

## 11. What it bought, same instrument both sides

**Coverage 3,766/4,441 (84.80%) → 3,775/4,441 (85.00%)** — `coverage-audit.ts` over the 40-project
corpus. **The first coverage movement since session 21.** All nine are the predicted set, three
per project across `Puppy test 3`, `puppy-test-3-fix008c` and `tut001-drive`: the `Condition`, the
`net.noodl.user.User` it gated, and the one `RouterNavigate` its arm drives. `rank2.ts` loses all
three deferral rows outright rather than shrinking them.

**`build-corpus.ts`: 40/40, unchanged** — the floor held, which is all it can now say (§15g).

**The emit diff is bounded to the three projects**: `dumpall.ts` into two trees, **9 files, 66
lines** — three `Admin.tsx` (the effect, `const session`, the `useEffect` import), three
`session.ts` (`useSession` minted with its provenance), three `__NOTES__.txt` (three deferral
notes gone). Every other project is byte-identical, which is also the measured bound on the
`effectDeps` change: **no other effect in the corpus reads a session.** A bound from the corpus,
not a guarantee from the mechanism.

**Consequence, not just mechanism:** before this slice the exported admin page had no gate at all
— it rendered to anyone. The emitted app now redirects a signed-out visitor, against a session
stub that always answers signed-out until someone connects it.

## 12. Tests (10 new, 446 total)

`tests/logic.test.ts` §10, plus the user-family pair. **Both primary cases are real fixture
artefacts**: `puppy-test-3`'s auth gate is authored reactive, and `cheer`'s two Conditions are
authored Evaluate-only — the rule and its control are each read off a graph somebody built.

The discriminating pair runs **both directions**: unticking the puppy fixture's `authGate` moves
it out of the effect, and ticking `cheer`'s `hasVisitor` moves it out of a handler and into one —
via the additive case, which must defer while `Evaluate` is still wired.

Mutation-checked against HEAD's analysis and emit: **9 red, and the controls green on both sides**
— the nowhere-landing session read, the no-arm shape, the unticked direction, and the branch
inventory. A control that cannot pass on both sides is a second opinion, not a control.

🔴 **One pre-existing test had to keep passing and does:** *"a ticked Run On Value Change defers
the Condition — Evaluate is additive"* unticks nothing and leaves `Evaluate` wired, so it lands on
§10b's first gate. Its message assertion survives because the new reason deliberately keeps the
phrase *"Run On Value Change is ticked"*. A gate that changed the wording would have made that
test pass for the wrong reason or fail for a cosmetic one.

⚠️ **`the puppy fixture is untouched by the slice` is now an inventory, not an absence.** Its
`not.toContain('if (')` stood in for "no Condition branch"; this slice puts one there on purpose.
The claim is now that every branch in the fixture was put there by a slice deliberately, pinned as
a list — an unlisted `if (` is still the regression it catches.
