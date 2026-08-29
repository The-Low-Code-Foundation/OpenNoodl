# EXP-011 — Close the picker gap, ranked by what apps need

**Status:** 🟡 In progress — **Tier 1 is COMPLETE. Tier 1.3 (the date family) built, driven and gated**, session 38
**Depends on:** nothing — but sequenced after EXP-009 and EXP-010, which are worth more per hour
**Replaces:** every "what to build next" list in this phase from sessions 20–31

---

## §1 The gap, measured

```
node scripts/export-ledger/picker-coverage.js
```

> **PICKER COVERAGE: 66 of 127 placeable nodes export (52.0%)** — 2026-08-29, session 38
> (51 / 40.2% when this task was written; **Variables** left the table in session 35, four of the
> eight Data nodes of Tier 1.1 left it in session 36, `HTTP Request` in session 37, and the whole
> **date family** — all six — in session 38, which is what takes this past half)

| category | nodes a user can place and cannot export |
|---|---|
| **Data** | 22 |
| **Utilities** | 10 |
| **Cloud Services** | 9 |
| **Navigation** | 5 |
| Visual · Component Utilities | 3 · 3 |
| CustomCode · Animation · String Manipulation | 2 · 2 · 2 |
| Interpolation · Math · Logic | 1 · 1 · 1 |

The full list regenerates from the script; do not paste it into docs where it will go stale.

## §2 First, fix the corpus — this task is worthless without it

🔴 **Do not rank this work with `coverage-audit.ts` / `rank2.ts`.** That is the instrument that
cost this phase twelve sessions (README § *What went wrong*). It is weighted by ~40 old drive
fixtures, 83% of its remaining complaints are one unplaced third-party Noodl prefab, and it is
structurally blind to any node those projects never used — which is most of this gap.

The corpus stays as a **regression net**. Alongside it, build a small set of projects that exist
to exercise the picker:

- Built in the **0.2.0 editor** and by the **MCP**, not hand-edited JSON.
- One per gap cluster below, each a small app that a person would plausibly build.
- Each placed on a routed page and actually rendering — session 31 found 20% of the old corpus is
  in components no route reaches, which is code no metric should be counting.
- Added to `projects.txt` and to `build-corpus.ts`, so they gate.

**A slice is not done until a project in this set exports and runs.**

## §3 The ranking, by what an app needs

Ranked by *"can you build a normal app without it"*, not by corpus frequency.

### Tier 1 — an ordinary app hits these on day one  ✅ **complete, session 38**

1. ✅ **The client-side data vocabulary (Data, 8).** `Object`, `Array Filter`, `Array Map` and
   `Clear Array` are **built, driven and gated in session 36 — §7**. The other four defer, each
   with a reason about a *mechanism* rather than about effort, and three of them are blocked by
   something other than themselves — §7.3.
2. ✅ **`HTTP Request`.** Any app that talks to anything that is not its own backend. **Built,
   driven and gated in session 37 — §8.**
3. ✅ **The date family (Utilities, 6).** `Now`, `Date To String`, `Date Add`, `Date Compare`,
   `Date Difference`, `Date Parts`. **All six built, driven and gated in session 38 — §9.** The
   only tier item that yielded every node it named.
4. ✅ **`String` / `Number` / `Boolean` / `Color` (Variables, 4).** The plain value nodes. Cheap, and
   embarrassing to be missing. **Built, driven and gated in session 35 — §6.**

### Tier 2 — common, not universal  🟡 **2.5 down to the component stack pair, session 44**

5. **Navigation (5).** ✅ **`Page Inputs` built, driven and gated in session 40 — §11**, along
   with the route patterns and the Navigate url builder, which were both recorded `translated`
   and both emitted urls react-router could not match. ✅ **`External Link` in session 41 — §12**,
   whose drive found a defect in the node itself (DEF-016), and its `Error` output in session 43
   — §14. ✅ **`Navigate To Path` in session 44 — §15**, which also fixed a second unroutable
   route in the scaffold. The remaining two are the **component stack pair**, and §15.6 says why
   they are a routing question rather than another url builder.
6. **Cloud Services (9).** Mostly **unblocked by EXP-009**, and several may fall out of it for
   free — `Cloud Function`, `Record`, `Set User Properties`, `Sign In With`. Re-measure after
   EXP-009 lands rather than planning against today's list.
7. **String/Math utilities (4).** `Substring`, `String Mapper`, `Number Remapper`, `UUID`.

### Tier 3 — real, but a smaller audience

8. **`States` and `Animate To Value`** — the animation pair. Genuinely hard (they are time-based
   and stateful) and worth doing properly rather than early.
9. **`CSS Definition` and `Script`** — global CSS and arbitrary script. `CSS Definition` looks
   trivial and ⚠️ **every instance in the current corpus is the empty stub `".group1 "`, so it
   would buy nothing measurable there** — build it against a real project, not the corpus.
10. **`Component Children`, `Drag`, `Component Stack`, the parent-object family.**

### Not a target

`Action Dispatcher` / `Action Handler`, `Optimistic Update`, `State History` / `Undo / Redo`,
`Stream Buffer`, `SSE`, `WebSocket`, `JSON Stream Parser`, `Parse CSV` / `To CSV`,
`Pattern Extractor`, `Text Accumulator`, `Run Tasks`, `On App Error`, `Screen Resolution`,
`Gyroscope`, `Open File Picker`, `Random Bytes`, `Hash`.

These are real nodes and some are excellent, but they are specialist. **Say so in the ledger's
exemption sentence** rather than leaving them looking like a backlog — an exemption that names a
node as deliberately out of scope is a decision; one that says "pre-gate backlog" is a to-do
nobody will ever do. Most of the current 101 exemptions say the latter, verbatim.

## §4 Acceptance criteria

1. ✅ **The picker number moves and holds.** Every slice raises `pickerCoverageFloor` in the same
   commit — `export-ledger:picker` fails if it does not.
   *(51 → 55 → 59 → 60 → 66 → 67 → 68, sessions 35–41.)*
2. ✅ **Tier 1 complete ⇒ 66 of 127 (52.0%).** Tiers 1+2 ⇒ ≈87 (≈68%). Everything except the
   "not a target" list ⇒ ≈108 (≈85%).
   *(The original projection said ~72. Session 37 revised it to "nearer 66 than 72", because
   Tier 1.1 yields 4 of its 8 nodes rather than 8 — and it landed on **exactly 66**. The revised
   number was right because it was derived from the deferrals actually taken rather than from
   counting node types, which is the difference between a projection and a wish.)*
3. ✅ **Each slice has a picker-exercising project** that exports, builds and runs (§2).
   *(Tier 1.4's is `tests/fixtures/variable-dial` — §6.4; Tier 1.1's is
   `tests/fixtures/reading-shelf` — §7.4; Tier 1.2's is `tests/fixtures/quote-desk` — §8.6;
   Tier 1.3's is `tests/fixtures/deadline-desk` — §9.5.)*
4. ✅ **The exemption sentences get rewritten** so that "deferred" means one of *deliberately out of
   scope* (with the reason) or *scheduled* (with the tier), never "pre-gate backlog".
   *(All 97, session 35, and `export-ledger:check` now enforces the shape — §6.5.)*

## §5 A standing rule for this task

**Rank by the picker; verify against a project someone would actually build; never let the corpus
choose the work.** If a future session finds itself reading a deferral census to decide what to do
next, it has taken the wrong turn — that census answers "did I break anything", and nothing else.

---

## §6 Tier 1.4 as built — the value Variables (session 35, 2026-08-28)

**51 → 55 of 127 (40.2% → 43.3%).** `pickerCoverageFloor` raised in the same commit;
`export-ledger:picker --check` holds it.

### §6.1 What a value Variable turned out to be

The four nodes are one definition — `variablebase.createDefinition` — so they are one translation
with a four-row cast table, and the shape a node takes is decided **by its wires, not by its type**:

| the author's graph | what is emitted |
|---|---|
| nothing wired into `value`, nothing into `Set` | **a constant.** The read folds to a literal, cast exactly as the runtime casts it. No `useState`. String's `Length` folds with it |
| `value` wired, Run On Value Change ticked (the default) | **a `useState` + a sync effect** carrying `setValueTo`'s table: `undefined` abstains, `null` stores the `Treat empty as` coercion, otherwise `args.cast` |
| `Set` wired | **deferred, named** — see §6.3 |

Three details were the runtime being specific rather than the export being clever, and each is a
test:

- **An unauthored node reports its `startValue`,** because `initialize` seeds `currentValue` and a
  *declared default never runs a setter* (`run-on-value-change.ts` says so in its own comment). An
  untouched `Color` panel is `#f1f2f4`, not undefined.
- **`NaN` is banned as a stored value outright.** `Number("cake")` takes the `Treat empty as`
  coercion instead, because `NaN !== NaN` would break the runtime's own `changed` guard forever.
  This is emitted in the effect *and* folded over an authored literal, and the drive watched it
  happen in a live page (§6.4).
- **Absent means ticked.** `runOnChange-value` is unticked only by a deliberate `false`. Reading
  absent as unticked would have deferred every node whose author never opened the panel — which is
  most of them.

The row's type is narrowed by the panel: `Treat empty as: Zero` makes the row `number`, not
`number | null`, because with that ticked nothing can write a null into it.

### §6.2 The one thing that was nearly wrong

`resolveExpr` runs **speculatively**, and a sync effect is referenced *unconditionally* at emit
(`component.ts`'s `referencedStateNames` sweep adds every `sync.stateName` whether or not a
binding survived). Pushing the effect where the read resolved would have emitted a `useState` and
a `useEffect` that no line of the component reads, on any node whose read was later dropped — the
dead-`useSession` trap this file already warns about, one construct over. The effect is pushed in
the **verdict sweep** instead, which runs after every binding pass and therefore knows the node
actually collapsed. `tests/variables.test.ts` closes with the control that says so.

### §6.3 What is deliberately outside the slice, and why it is not laziness

**`Set` (`saveValue`).** With it wired the node stops writing through and parks arrivals in
`latestValue`; the store is then *the value that last arrived, cast, unless it was `undefined`*.
That is an abstain guard **and** a cast wrapped around a value expression, and `state-set` carries
an expression with room for neither. Faking it would store an uncast `undefined` where the
interpreter stores nothing. The emitted report names it in the author's terms.

Also deferred, each with its own sentence: a consumed `Changed`/`done`/`unchanged` (the latch
rule, for the latch's reason); an unticked Run On Value Change with no `Set`, where nothing would
ever store; a `Value` fed by a handler-only read; and `Length` over a *stored* string, where the
expression vocabulary has no member access.

### §6.4 The project (§2's requirement), and the drive

`tests/fixtures/variable-dial` — **Variable Dial**, authored through the MCP server (not by
hand-editing JSON), one routed page, every node placed on it. It carries all three shapes at once:
three mirrors off one Variable, five folded constants, and one deliberate `Set` deferral.

It exports, builds under `tsc -b && vite build`, and runs. Driven in headless Chrome over CDP,
reading the DOM back after real keystrokes:

```
boot         : ["Variable Dial","","0","Bring cake","10","42","var(--primary)","Badge is on.",""]
typed "cake" : […,"cake","0","You typed something.",…]      ← Number("cake") → NaN → banned → 0
typed "42"   : […,"42","42","You typed something.",…]       ← the Number cast
cleared      : […,"","0",…]                                  ← the flag unmounts, Boolean("") is false
after latch  : [… ,""]                                       ← the deferred Set readout stays empty
console errs : []
```

🔴 **Every row observes a consequence, not a mechanism.** The emitted source already *says*
`String(arrival)`; a `toContain` over it would pass on dead code. The golden in
`tests/variables.test.ts` is pinned to this exact file, so what the suite holds is the artefact
whose behaviour was watched.

⚠️ **The empty readouts are load-bearing.** `innerText` collapses them away — the drive reads
`textContent` per `<p>` so that "the deferred latch shows nothing" is an observation rather than
an absence nobody looked for.

### §6.5 AC4, done — and gated

All **97** deferred ledger entries now open with either `deliberately out of scope — <reason>` or
`scheduled — <tier and why>`. 95 of them said `pre-gate backlog` verbatim before this, which is
how a whole vocabulary sits unexported while the ledger looks maintained.

`scripts/export-ledger/check.js` now **enforces the shape**, so it cannot drift back. The gate was
proved with a control pair before being believed: the real ledger passes, and one entry reverted
to the old sentence fails it with that entry named.

Where §3's ranking did not name a node (`Boolean To String`, `Delay`, `Log`, `Value Changed`,
`Color Blend`, the record-relation verbs, `Unique Id`), the entry **says the tier was assigned in
session 35 rather than by §3** — a tiering nobody ruled on should not read as one somebody did.

---

## §7 Tier 1.1 as built — the client-side data vocabulary (session 36, 2026-08-28)

**55 → 59 of 127 (43.3% → 46.5%).** `pickerCoverageFloor` raised in the same commit.

Tier 1.1 is eight nodes and **four of them translate**. The other four defer on named mechanisms,
and that split is the finding rather than a shortfall: three of the four are blocked by something
that is not about them at all (§7.3).

### §7.1 What the vocabulary turned out to be

The emitted app already had the row-holder — `collection<T>([])` in `@nodegx/core`, `useCollection`
in render, `.add()` in a handler (COLLECTIONS §1–2). What was missing was everything you do to it
afterwards, and the shape of the answer is that **a list became an ordinary value expression**.

| the author's graph | what is emitted |
|---|---|
| `Object`, Id Source "From repeater" | **props on the template.** Each read `prop-p` is a minted prop; the hosting `For Each` binds `p={item.p}` — EXP-002-MODEL2-TARGET-OUTPUT §4's design, unchanged |
| `Array Filter` | `.filter(…)`, then `.slice().sort(…)`, then one `.slice(skip, skip+limit)` — `scheduleFilter`'s own order |
| `Array Map` | `.map((row) => ({ … }))`, keys in the script's order |
| `Clear Array` | `notes.clear()`, forked on `peek().length > 0` when either outcome is consumed |

Three details are the runtime being specific rather than the export being clever:

- **The filter's comparisons are loose.** `applyFilter` uses `==`/`!=`, and its own comment says
  why — *"what lets a numeric filter value match a CSV column of strings"*. `===` here would drop
  rows the interpreter keeps, in an app the author has already tested.
- **`Clear Array`'s `done` fires only when the array was not already empty.** `wasEmpty` is
  measured before `set([])`, and `unchanged` is the other arm. A `done` chain emitted
  unconditionally would fire where the interpreter stays silent. The empty arm deliberately omits
  the `.clear()` call, because `Collection.clear()` is itself `if (length === 0) return`.
- **A `Failure` on a `Clear Array` with a literal Array Id cannot fire**, because
  `resolveCollectionId` is `Collection.get(id)` and that mints a named collection for any string.
  So the wire is **dropped with a note**, not deferred — deferring a whole translation over an
  already-dead wire would be a loss to a no-op.

`collection-get` is the load-bearing new expression kind. The collections slice could reach a named
array only through `RepeaterPlan.itemsCollectionName` — a per-consumer field. `For Each` was the
only consumer then; now there are three and they **compose** (`books → filter → map → For Each`),
which a field cannot express and an expression can.

### §7.2 The three things that were nearly wrong, and what caught each

🔴 **A `}; else` that three passing tests did not see.** The first `Clear Array` fork emitted
`if (…) { books.clear(); … }; else …` — an empty statement between a block and its `else`, which
is a **SyntaxError**. Assertions for `if (books.peek().length > 0)`, for `books.clear()` and for
`else` all passed, because every one of those substrings really was there. It was visible only by
reading the emitted file. `tests/emitted-syntax.test.ts` now parses every emitted file of every
fixture, with a control pair proving the checker disagrees about the good and the broken shape.
**The same join is latent in the `branch` emit** for a two-action true arm beside a false arm; both
now go through one `ifElse` helper. No fixture in this repo reaches the `branch` case — that is a
fix by inspection, not a repro, and it is recorded as such.

🔴 **Two temporal dead zones.** `listReadOf` and the `Object` pre-pass run from Pass 2, and both
read `const`s declared thousands of lines later (`collectionReadEligible`, `wiredPorts`). A `const`
arrow read before its declaration executes is a `ReferenceError`, not a hoisted function. The suite
never saw it — **no fixture had a `Model2` node**, so 626 tests passed over a crash that fires on
the first project wiring an array into a transform. Found by emitting a real project.

🔴 **An exported app that would not build.** `Array Map`'s script names source properties by
string, so `map({ badge: 'nope' })` over a typed row emitted `row.nope` and `tsc -b` answered
*"Property 'nope' does not exist on type 'BooksItem'"*. This is the hole that had already been
closed on the repeater's side and was still open on the transforms'. Found by **sabotaging the
driven project**, not by reasoning. Both reads now go through a cast where the field is known
absent, which is exact: `model.get('nope')` is `undefined`, and `undefined` is what all six of
`applyFilter`'s operators compare against — including `$neq`, the one that answers *true*.

⚠️ A related one the same build caught: every emitted collection key is **optional**, so a sorted
field is `string | undefined` and `a.title > b.title` is a `strictNullChecks` error. The comparator
takes `(a: any, b: any)`, because the runtime's `sorter` compares with bare `>`/`<` and a null-safe
comparator would have to *invent* an ordering for absent values that the interpreter does not have.

### §7.3 What defers, and why three of the four are not about themselves

- **`Create New Array`** — *deliberately out of scope.* It mints an anonymous array with a
  generated Id, and the only consumer of that Id is another node's **Array Id input, by wire** —
  which is precisely what has no emitted module, since the named-array model keys on a literal
  name. Translating it would create an array nothing in the exported app could name.
- **`Remove Object From Array`** — *scheduled, and blocked one level up.* It needs an Object Id,
  and in every list shape a person actually builds that comes from **inside the repeater row** —
  which cannot reach the page while a row's outputs stay deferred on *"which row fired is not
  statically expressible"*. 🔴 **This was measured before it was believed.** The session began by
  planning to mint an `id` on every insert so this node could translate; checking the relay first
  showed the ids would have bought nothing and would have changed a shipped slice's output.
- **`Set Object Properties`** — *scheduled: the collection-state slice.* The read side of `Object`
  translates; the write side does not, because a row written from inside the row is state the
  enclosing list owns rather than a prop the parent passes down (§4 draws that line, §5.4 gates it).
- **`Repeater Item`** — *deliberately out of scope.* Its `Item Id` is the runtime record id of a
  row, and the emitted app has no counterpart. Its other ports are the Repeater's removal
  handshake — lifecycle signalling, which is `effect()` work.

### §7.4 The project (§2's requirement), and the drive

`tests/fixtures/reading-shelf` — **Reading Shelf**, authored through the MCP server (not by
hand-editing JSON), one routed page, every node placed on it. It carries all four translations at
once and reports **nothing dropped** beyond the router shell.

It exports, builds under `tsc -b && vite build`, and runs. Driven in headless Chrome over CDP,
reading `textContent` back after real keystrokes and real clicks:

```
boot              : rows []                            status ""
added Dune        : rows ["Dune favourite"]            ← the Object node's minted prop
added Anathem     : rows ["Anathem …","Dune …"]        ← SORTED: Dune was added first
wishlisted Ulysses: rows unchanged                     ← the filter EXCLUDES it
cleared           : rows []   status "Emptied the shelf."
cleared again     : rows []   status "The shelf was already empty."   ← the unchanged arm
console errors    : []
```

🔴 **The wishlist button is a negative control, and the slice is not measured without it.** With
every book a favourite, the filter excludes nothing, and "the right rows rendered" would read
*identically* if the filter had never been emitted — a reading that fits rather than one that
excludes.

🔴 **The map was proved by a mutant.** Its rename (`badge` ← `shelf`) was sabotaged to read a field
no row has; the badge text disappeared from every row and the drive's readings changed. Before
that, "favourite" appearing was equally consistent with the map never having run.

### §7.5 A gap Tier 1.4 left, found by building against it

`collectAppState`'s `typeOfSource` was never taught about the four value Variables. A Variable
written by a `String` node therefore had **no statically-typed writer**, typed `unknown`, and
*every read of it dropped* — the graph is as ordinary as they come (a String constant into a Set
Variable, the variable rendered in a Text) and it exported a blank element with a note. One case
added, for `String` only: this function's vocabulary is string-or-unknown, and claiming `string`
for a `Number` would assert a cast the runtime does not perform.

The general lesson is the one §6.2 was already circling: **Tier 1.4 taught `resolveExpr` about
those nodes and stopped there.** A new readable node has at least two consumers in this package,
and the second one is silent when it is missed.

---

## §8 Tier 1.2 as built — `HTTP Request` (session 37, 2026-08-28)

**59 → 60 of 127 (46.5% → 47.2%).** `pickerCoverageFloor` raised in the same commit.

One node, and the largest one this phase has translated: `httpnode.ts` is 1,288 lines and nearly
every port on it is dynamic. What made it tractable is that **almost all of that is configuration
rather than data** — the method, the body type, the auth preset and the four string lists are
`allowEditOnly`, so what the request *is* was decided in the editor and cannot change at runtime.
The translation reads a configuration; it does not solve one.

### §8.1 What the node turned out to be

| the author's graph | what is emitted |
|---|---|
| the node's own configuration | **one exported function in `src/api/http.ts`** — `fetchQuote(params)` — with the authored values folded in as literals and the wired ones as parameters |
| `Fetch` from a handler chain | `const answer = await fetchQuote({…})`, inside the handler's own `try` |
| `done` chain | the statements of the `ok` arm |
| `failure` chain | the statements of the *other two* arms — see below |
| `Response` / `Status Code` / `Response Headers` / an Output Field | a read of the answer: the chain's local inside the chain, a `useState` row anywhere else |
| `Error` | its own row, written by every failure and never cleared, exactly as `_internal.error` behaves |

🔴 **The module throws only where no answer arrived, and returns `ok: false` where one did.**
That split is the whole design, and it is not stylistic. `processResponse` runs *before* `doFetch`
reports `failure`, so a 404 publishes its body and status on the node's outputs while `Failure`
fires; and a request that never reached the server leaves `Response` and `Status Code` holding
what they held, because a value output cannot be cleared. A single throwing shape — the record
verbs' — reproduces one of those or the other, never both. The emitted handler therefore writes
the answer row *before* testing `ok`, and does not write it at all in the `catch`.

The failure chain is emitted **twice**, once per arm, and the two copies are identical by
construction because both bind `message` first: `answer.error` in one, the exception's message in
the other. A join would need a `finally` that could tell which arm it was in, which is a variable
the arms already are.

Four details are the runtime being specific rather than the export being clever, and each is a
test:

- **An absent path parameter leaves `{topic}` in the URL, literally.** `buildUrl` replaces only
  what it has a value for, because a URL segment has no way to be empty.
- **`undefined` and `null` are the same omission everywhere except a JSON body**, which has a
  native `null`. That is the one site `httpnode.ts` tests `!== undefined` alone, and it says why
  in its own comment.
- **A half-filled credential sends nothing at all** — `authConfigurators` answers `{}` for a
  Bearer with no token — so every credential is emitted as a guard, never as a header.
- **The auth headers are applied after the visual ones** (so a credential wins a collision) and
  the `Content-Type` default runs last, on a truthy body and an unset header. An empty
  urlencoded body is `''`, and gets no Content-Type.

`jsonPathSteps` compiles the Response Mapping to the accessor `extractByPath` would have walked —
`$.items[0].name` → `?.items?.[0]?.name` — **including its limitations**: a path that does not
start with `$` reads undefined on every answer, `$items` reads a key spelled `tems`, and
`$.a[0][1]` is a key literally spelled `a[0][1]`. Correcting any of those would break an author
who has already worked around one.

### §8.2 Where the read is decides what it says

A read of the node's outputs is **the chain's local inside the chain, and the state row anywhere
else**, and that is a correctness rule rather than a preference: `setQuoteOut(answer)` does not
change `quoteOut` inside the closure that called it, so a state read in the `done` chain would
deliver the *previous* request's body. It is CONTROLLED-STATE §3.2's chain-local snapshot rule
reaching a construct that cannot recompute itself — a `jsfun-run` re-runs its pure body, and a
request cannot.

The failure chain reads `Error` and nothing else. Its arm also runs where **nothing arrived**, and
what the interpreter holds on `Response` there is the previous request's answer, which no
expression in this vocabulary can name. That deferral is the one that would be easiest to fake.

### §8.3 The four things that were nearly wrong

🔴 **A state row named `error`, read as the exception.** A state read prints as the bare name in a
handler as much as in render, and every emitted asynchronous action binds `catch (error)`. Before
this slice there was nothing to *read* inside a catch, so the collision could not fire; the
failure chain is the first construct to put the graph's own statements there. A row minted from a
node labelled "Error" — `allocStateVar` lower-cases the label — would have been read as the
`Error` object where the graph says to read the latch: the right shape carrying the wrong value,
with nothing anywhere to say so. `stateNameTaken` reserves the name now.

⚠️ It was first "found" in the wrong place. The emitted Quote Desk page has
`const error = useValue(postError)` beside a `catch (error)`, and the fix went into the render
locals — where it was **inert**, because a handler reads a variable through `.get()` on the
imported store and never through the render local. The hazard was real and one construct over.
*A collision you can see is not necessarily the collision that can fire.*

🔴 **A chain whose reads earned nothing.** `collectExprUse` walks handler actions to decide which
state rows, imports and hooks the component keeps — and it **had no case for the asynchronous
actions at all**, so nothing inside a `done` or `failure` chain was counted. The emitted page read
`error2` and imported nothing for `latchNote`, and the row it read was declared nowhere: a
`ReferenceError` on the first failure. The omission is older than this slice — the record verbs'
`done` chain has the same hole in the same words — and both are walked now.

🔴 **The answer row was allocated after the action was compiled.** A render binding on `Response`
resolves two passes after the `Fetch` attaches, so reading `httpAnswerVars` at compile time
answered "nothing reads this" for *every render read there is*: the setter was omitted, the row
stayed `undefined` forever, and the page rendered a blank that no note explained. `materialize` is
filled in a verdict sweep at the end of `planComponent` instead. This is §6.2's lesson from the
other side — that one moved *later* to stop emitting a row nothing read, and this one moved later
to stop dropping a row something does.

🔴 **`compileSink` has no `default`.** It is a chain of `if`s ending in the Set Variable case, so
an HTTP node that reached it deferred with *"variable name is not a literal"* — a reason about a
node type it is not. Adding the trigger port without adding the dispatch produced exactly the
silent-recruitment failure this file's `api-call` comment warns about, in the shape the warning
does not cover: not a switch that stops compiling, a fall-through that answers plausibly.

### §8.4 What defers, and why

- **A wired `Cancel`** — *scheduled.* Abandoning a request in flight needs the `AbortController`
  to outlive the handler that made it, which is a ref and a lifetime; the emitted controller is
  the timeout and nothing else. It takes `Canceled` and `Unchanged` with it, since both are sent
  from `cancelFetch` and nowhere else.
- **A wired configuration input** (`url`, `method`, `timeout`, the four string lists, a mapping
  path) — *deliberately out of scope*, in one sentence covering all of them: those inputs decide
  what the request **is**, and they are read at fetch time by the interpreter while the module is
  built from the configuration the editor settled.
- **A consumed `Completed`** — *scheduled.* It fires once however the request ended, and this
  slice emits the two arms rather than their join.
- **A value read in the failure chain** — §8.2's reason: that arm also runs where nothing arrived.

Two wires are **dropped with a note rather than deferred**, both because they cannot fire in the
interpreter either (§7.1's Clear-Array-`Failure` rule, second and third instances): a wire from
`canceled` or `unchanged` while `Cancel` is unwired, and a wire from **`success`** — which brings
us to the defect below.

### §8.5 A defect this found in the editor, not the export

🔴 **The HTTP Request node draws a `Success` output that can never fire.** `updatePorts` still
publishes the pre-ERG-001 port list — `success`, `failure`, `canceled`, `error` — while the node
itself declares `done`, `completed`, `unchanged`, `failure` through `outcomeOutputs`. The editor's
port set is *type ports concat dynamic ports* (`NodeGraphNode.getPorts`), so an author sees
**both `Done` and `Success`** in the Events group, and a wire from `Success` runs nothing: the
runtime sends `done`.

The export reports it rather than reproducing it silently, because a dead wire is exactly what an
author cannot see. **The fix belongs in `httpnode.ts`** and is one line of `updatePorts` — it is in
the next-session prompt as work.

### §8.6 The project (§2's requirement), and the drive

`tests/fixtures/quote-desk` — **Quote Desk**, authored through the MCP server, one routed page. It
holds two requests (a GET with a path parameter, a literal query parameter, a literal header and
three Output Fields; a POST with a JSON body and a mapped id), a failure chain into a Variable, a
status line off `Error`, and a wire from `canceled` that must never fire.

It exports, builds under `tsc -b && vite build`, and runs. Driven in headless Chrome over CDP
against a local server on 5210 that **echoes what it received**:

```
boot                : quote ""                    echo ""                                      status ""
got hope            : "A quote about hope."       "topic=hope format=short client=quote-desk"   ""
saved a note        : (unchanged)                 savedId "note-2"        ← the POST body reached the server
asked for nothing   : quote ""  author ""         "topic=nothing …"       status "HTTP 404: Not Found"
posted an empty note: savedId ""                                          postStatus "HTTP 400: Bad Request"
recovered on courage: "A quote about courage."                            status STILL "HTTP 404: Not Found"
never shown         : ""  (every row)
console errors      : the two expected HTTP statuses, and a favicon
```

Three of those rows are readings that **exclude** rather than fit:

🔴 **The echo line is the negative control for the request itself.** A quote appearing is
consistent with the query parameter and the header never leaving the app; the server reports what
it actually received, so the line fails if either was dropped.

🔴 **The 404 row empties the quote while the status fills.** That is the one observation that
distinguishes "the answer is written for any answer" from "the answer is written on success" — the
§8.1 split, seen from outside.

🔴 **The recovery row shows the status line unchanged.** `_internal.error` is never cleared by a
later success, and a later success is the only thing that could have cleared it.

**The mutant.** The project was sabotaged — one Output Field pointed at `$.quote.nope`, the header
value emptied — rebuilt and re-driven: the quote line went empty while the author line did not,
and the echo read `client=` instead of `client=quote-desk`. Two readings changed, and only those
two. Before that, every row above was equally consistent with a drive that cannot fail.

### §8.7 A gap this slice found and did not close  ✅ **closed in session 39 — §10**

**A Variable written from an HTTP output renders nothing.** `typeOfSource` types the write as
`unknown` — correctly; `response` is whatever the server sent — and Pass 4 drops every read of a
variable that has no `string`-typed writer. So *fetch → Set Variable → show it*, which is the
first thing anyone would build, exports a blank element with a note.

This is not about HTTP: it blocks a Function output and an event payload in the same words, and
the fix is the same one — let a variable be `unknown`-typed and coerce at its render sinks, the
way `childText` now coerces an HTTP read. It is a slice of its own, named in the next-session
prompt. Within one page the direct binding works and is what Quote Desk does; only `Error`, which
`typeOfSource` now types (§7.5's case, extended), crosses into a Variable.

---

## §9 Tier 1.3 as built — the date family (session 38, 2026-08-29)

**60 → 66 of 127 (47.2% → 52.0%).** `pickerCoverageFloor` raised in the same commit. **Tier 1 is
complete**, and this is the only tier item that yielded every node it named.

Six nodes, and the split that organises them is not the picker's: **`Now` is stateful and the
other five are pure functions of their inputs.** The five became one expression kind and the
sixth became one action, and almost every decision below follows from that one line.

### §9.1 What the family turned out to be

| the author's graph | what is emitted |
|---|---|
| `Date Add`, `Date Compare`, `Date Difference`, `Date Parts`, `Date To String` | **one call** into `src/lib/date.ts` — `dateAdd(d, 1, 'months')` — with wired inputs as argument expressions and authored ones as literals |
| a chain of them | **one nested call.** `Now → Date Add → Date To String` is `dateToString(dateAdd(clock, 7, 'days'), '…', '')` |
| `Now`, nothing on `Read` | `useState<Date>(() => new Date())` — the mount instant |
| `Now`, `Read` wired | the same row, plus `const clockRead = new Date(); setClock(clockRead);` per press |
| a read inside the `Read` chain | the **bound local**; anywhere else, the row |
| any `Changed` / `Invalid Date` / `On Before` | deferred, named — a recomputation is a render, not an event |

🔴 **`Now` is not a live clock, and that is the question this slice existed to answer.** The
prompt asked whether it is a render read or an invoked read, and said to let the runtime answer
rather than choosing. It does, twice over: the port description says the outputs *"hold the
instant of the last Read, not a live value"*, and `initialize` reads the clock once so they are
never empty before the first Read. That is a `useState` with a **lazy initializer** — one
construction per mount, exactly as `initialize` runs once per node. `useState(new Date())` would
construct on every render, and a bare `new Date()` in render would re-render forever.

`src/lib/date.ts` is a transcription of two runtime files, and unlike `src/api/http.ts` it is the
**same text in every project** — so it is a constant rather than a builder, and it ships only when
a component imports it. Three details are the runtime being specific rather than the export being
clever, and each is a test:

- **Months and years clamp.** 31 January + 1 month is **28/29 February**, never 2 March. Both
  answers are defensible; only one is the interpreter's, and the driven page shows it.
- **`Date To String` reads its input differently from the other four, and that is faithful.** It
  predates the shared date math, and its setter is `typeof value === 'string' ? new Date(value) :
  value` — so a millisecond **number** arrives unconverted, `getDate()` throws on it, and the
  node's own catch turns that into a blank. The other four read a number as epoch milliseconds.
  Normalising the two would "fix" a blank an author has already worked around.
- **Every value parameter of every emitted helper is `unknown`, and the coercion inside is the
  interpreter's setter** — `Number(amount)`, `!!absolute`, a Format that is not a string throwing
  into the catch. A narrower parameter would also make the exported app fail to build on a graph
  the editor allows.

### §9.2 What defers, and why

- **A wired `Unit` or `Granularity`** — *deliberately out of scope*, and the reason is a throw
  rather than a doubt: those inputs are `allowEditOnly` enums, a wire can deliver any string, and
  `addToDate`'s final `else` **throws** rather than answering. An export that reproduced that
  would put an uncaught exception in someone's page. Every other input may be wired, including
  `Amount`, `Absolute`, `Format` and `Timezone`, because none of them has a throwing branch.
- **Every signal but `Now`'s `done`** — *scheduled*. `Changed`, `Date Changed`, `Invalid Date`,
  `On Before/After/Same` all announce a **recomputation**, which in an emitted component is a
  render, not an event a chain can hang off. `Now`'s `done` translates precisely because it is
  *invoked*: a Read happened, in a handler, at a point in a chain.
- **A node with nothing on its Date input and nothing authored** — it never runs `_recompute`
  past its abstain, so every output is unset for the life of the app. Said, rather than emitted as
  a call that would answer undefined for a different reason.

⚠️ **One divergence ships, and it is reported.** These functions are pure; the nodes are not. When
a Date input goes from a value back to *unset*, `_recompute` abstains and the interpreter keeps
its previous answer, where a pure call answers undefined. It is one transition wide and needs a
wire that can actually deliver an empty — and the interpreter is already inconsistent with itself
about it, since an *invalid* date clears the answer while an absent one does not. A note is filed
where the emptiness **enters** the graph, not at every link that would pass it on.

### §9.3 The transcription is tested against the thing it transcribes

🔴 **A transcription is exactly the kind of work that goes subtly wrong while reading correctly**,
so `tests/date-family.test.ts` §A does not assert what the transcription says. It transpiles the
**emitted module** — the artefact that ships, not a copy kept beside the generator — and runs it
against the interpreter's own `datemath.ts` over a grid of 8 dates × 14 amounts × 8 units, every
ordered pair of dates for the difference, and 400 consecutive days for the ISO week rule. Month
ends and leap days are over-represented, because the clamp and the whole-calendar-step trim only
show at a month boundary.

`Date To String` has no exported function to compare against, so the test drives **the node
definition's own `_format`**, reached through its `methods` and its real setters.

⚠️ It had to be **transpiled rather than imported**: `datetostring.ts` does not typecheck under
this package's stricter tsconfig, because `_format` reads a `Date | undefined` as a `Date` — which
is the load-bearing throw the node's catch depends on. `transpileModule` erases types without
checking them, which is what running the interpreter's real code from a stricter package takes.

🔴 **And the comparison is proved able to fail.** One deliberately broken copy of the emitted
module — the clamp's `result.setDate(1)` commented out — must disagree, and does. Without that
control, "the two agree" is a reading that fits rather than one that excludes.

### §9.4 The five things that were nearly wrong

🔴 **A new readable node has two consumers, and the second one is silent — for the third time.**
§7.5 wrote this rule after Tier 1.4 missed it and §8.7 named it again after Tier 1.2 missed it,
and this slice missed it **twice more**. `resolveExpr` translated all six nodes and a full test run
went green before anything reached a page, because Pass 4c matches on a **whitelist** and Pass 4f
on a **predicate**, and neither errors when a type is absent — each just quietly renders nothing.
Then `typeOfSource` had no case either, so *"save the moment I pressed the button, then show it"*
exported a Text still showing its authored placeholder. Pass 4f's predicate is now **derived from
the same tables `resolveExpr` dispatches on**, which is the only spelling under which the two
cannot drift.

🔴 **`const` is a statement, and an arrow's expression body cannot hold one.** `Now`'s Read emits
`const clockRead = new Date(); setClock(clockRead); …`, and `handlerArrow` gave it the expression
form: `() => const clockRead = …`, which does not parse. It is the fourth instance of this file's
oldest hazard, after the `}; else`, the gated popup close and the Clear Array `if` — **and it
survived a suite that parses every emitted file**, because every fixture that reached it wired the
Read to a button *that already had another action*, and two actions take the block form. Only a
Read that is the **whole** handler reaches the expression body, and that is the shape a real
project has. Found by building the exported app.

🔴 **Pass 4f dropped the expression tree's own wires and nodes.** Every earlier client of that pass
reads a *leaf* — a latch's state, a control's value, an HTTP output — so discarding `ctx.consumes`
and `ctx.logicNodeIds` cost nothing and nobody noticed. The date family is the first vocabulary to
arrive there **composed**, and the report answered *"wire shift:result→reviewFmt:input has no
deterministic translation"* and deferred `Date Add` for feeding a sink with "no static binding",
about a page that had emitted the whole nested call correctly. **The app was right and the report
was wrong, which is the worse way round**: a note claiming a working wire was dropped sends an
author looking for a feature that is already there.

🔴 **Two silent walkers would have emitted a stale read.** `exprTouchesSnap` and `snapExpr` both
end in a `default`, so a date call whose argument reads a variable written earlier in the same
chain would have answered "does not touch the snapshot" and passed the pre-write value through —
well-formed code, wrong by one chain step. Of the **eleven** sites that enumerate these unions,
the compiler holds six; the other five are if-chains, `default`s, or — in `actionsValidIn`'s case
— an exhaustive switch whose callback has no return annotation, so `every`'s `unknown` swallowed
the missing case entirely.

⚠️ **A temporal dead zone, walked into with the trap written down.** The emit-side test for
"does this chain read the local" first reused `actionExprsOf`, a `const` arrow declared hundreds
of lines below where `actionCode` runs — a `ReferenceError` at emit time, not a compile error. It
is a hoisted `function` now, which cannot reproduce it.

### §9.5 The project (§2's requirement), and the drive

`tests/fixtures/deadline-desk` — **Deadline Desk**, authored through the MCP server, one routed
page, every node placed on it. It reports **nothing dropped** beyond the router shell.

🔴 **Every expected answer was written down before the app ran**, and each is a rule stated in a
node's own description. The anchor is 31 January 2024 precisely because adding a month to it has
two defensible answers — a board built on *today's* date would look identical whether the
arithmetic was right or wrong, which is the trap §2 exists to avoid.

It exports, builds under `tsc -b && vite build`, and runs. Driven in headless Chrome over CDP,
reading `textContent` per element:

```
anchor  Jan 31, 2024   review  Feb 29, 2024   ← THE CLAMP, not Mar 02
dayName Wednesday      isoWeek 5
days    49             months  4              ← fixed unit exact; calendar unit whole steps
tokyo   2024-06-02 08:30                      ← 23:30Z on 1 June, in Asia/Tokyo, from Europe/Paris
sentences present: ["…same working day."]     ← and NOT "…the same instant."
                   ["The launch date has passed."]  ← and NOT "…is still ahead."
clock   2026-08-28T22:01:44.493Z | 00:01:44   ← ISO and formatted agree to the second
after 2s, no click: UNCHANGED                 ← Now is not a live clock
after Refresh:      moved, and saved == the row it wrote
console errors: []
```

Three of those are readings that **exclude** rather than fit:

🔴 **The granularity pair.** The same two instants are compared twice, at `day` and at
`millisecond`, and the second panel must be **absent**. "The same-day panel showed" is otherwise
consistent with granularity having been dropped entirely. Both use `mounted`, not `visible` —
`visible` keeps the element in the DOM with its text intact, so an absence read off `visible` is
not an absence at all.

🔴 **The clock's before/after pair**, the same device over a value that is not a literal.

🔴 **"Unchanged after two seconds with no click."** This is the row that answers the render-read
question from outside. Had `Now` been emitted as a render read, this moves — and it moves without
the app looking wrong in any other way.

**The mutant.** The project was sabotaged in three specific places — `Date Add`'s unit months →
days, `Date Compare`'s granularity millisecond → day, `Date To String`'s timezone emptied —
rebuilt and re-driven. **Exactly three rows changed and eleven held**: `review` read "Feb 01,
2024", `tokyo` read the Paris time "2024-06-02 01:30", and the same-instant panel appeared.
Before that, every row above was equally consistent with a drive that cannot fail.

### §9.6 What this leaves

`Now`'s `Completed` is untranslated and unmentioned by any wire in the fixture — it is the same
join-of-two-arms deferral `HTTP Request`'s `Completed` takes (§8.4). The signals of the five pure
nodes are the family's one real gap, and closing them is an `effect()` slice rather than a date
slice: they are all "this value was recomputed", which is a render, and the construct that turns a
recomputed value into a fired chain does not exist in this vocabulary yet.

---

## §10 The untyped Variable, closed — the sink is where the type question belongs (session 39, 2026-08-29)

**Not a picker slice.** It adds no node and the number holds at 66/127. What it removes is a
*recurring failure mode*: §7.5, §8.7 and §9.4 are three write-ups of the same defect, and
`typeOfSource` had acquired four one-line patches, one per session, each added after an app was
built and a placeholder appeared where a value should have been.

### §10.1 The defect, in one graph

`HTTP Request` → `Set Variable "lastQuote"` → a `Variable` read → a `Text`. Four nodes, the first
thing anyone builds. `typeOfSource` types the write as `unknown` — correctly, because `response`
is whatever the server sent — and Pass 4 required a `string`-typed writer, so it dropped **every
read** of the variable. The export was a blank element and a note.

The same drop hit a Variable written from a Function output or an event payload, in the same
words, for the same reason.

### §10.2 What changed

Pass 4 no longer gates on the writer. It binds the read and marks the binding `untyped`, and
`emitComponent` asks the question where it can actually be answered — at the sink:

| sink | emitted | why |
|---|---|---|
| a `Text`/`Label` child | `{String(x ?? '')}` | the runtime's Text node puts the value through `String()` on its way to the DOM |
| a string attribute (`placeholder`, `src`, `alt`, …) | `attr={String(x ?? '')}` | it reaches the DOM the same way |
| `enabled` | `disabled={!x}` | the runtime coerces `!!value` at the port; the caller spells the negation |
| `visible` / `mounted` | `!x &&` / `!!x &&` | already boolean over an `unknown`, and needed no coercion at all |
| a component input typed `string` | `Prop={String(x ?? '')}` | the target's own plan declares the type |
| a number attribute or a prop this vocabulary cannot fold | **refused, with a named reason** | `Number(whatever the server sent)` would be the exporter inventing a rounding rule |

🔴 **`bindingExpr` now takes a required sink argument.** That is the load-bearing part. The four
patches to `typeOfSource` were each paying for a design that asked the type question in a table
of *writers*, which has to know every readable node in the product and errors nowhere when it
does not. A sink can always say what it holds, and a sink that cannot must say so — so a new JSX
position cannot inherit the old silence.

### §10.3 The defect this found on the way past, which was never about untyped values

`<GreetingCard Name="Ada" Name={quote} />`. An instance carrying **both** an authored parameter
and a wire into the same port printed both, and duplicate JSX attributes are **TS17001** — the
exported app did not compile. It bit a `string`-typed variable exactly as hard; the old type gate
was simply hiding it at this sink. The wire now replaces the authored value, on component
instances and on kit nodes, which is what the running app does when the wire delivers.

⚠️ It was reachable from the shipped corpus. The fixture that exposed it is the one already in
the repo — `greetingCard` has carried `Name="Ada"` all along, and it only needed a wire.

### §10.4 What proves it

- **The decision table** — `tests/untyped-variable.test.ts`, 17 cases, every coercion **paired
  with a control** asserting a *typed* variable in the same sink reads bare. A suite that only
  checked for `String(x ?? '')` would pass on an emitter that printed it around everything.
- **The refusal is graded on its reason**, not on the absence of an attribute, and on being
  distinguishable from "has no statically known source" — the two have opposite fixes.
- **`npm run build` on the emitted app** (`tsc -b && vite build`): the step that decides whether
  a coercion is real, and the only one that could have caught §10.3.
- **The drive**, in Chrome against a live endpoint. Four rows written down before the app ran,
  four matched: the heading empty → the fetched text, the placeholder empty → the fetched text,
  the `mounted` badge absent → present, its text `Loaded`.
- **The sabotage**: the old gate restored, rebuilt, re-driven. It moved exactly the three rows
  predicted and no others, so the drive can fail.

### §10.5 What this leaves

✅ **Closed in session 42 — see §13.** The paragraph below is left as written because it is the
reasoning §13 acted on, and the reason it names is the reason the widening is per call site.

🔴 **The store-key gate is the same shape and is still shut.** `storeKeyReadOf` refuses a key
whose type is not `string`/`number` — so a Global Store key written from an HTTP body drops its
read exactly as a variable used to, with the note *"key … has no statically-typed value"*. It was
**not** widened here for a named reason: that gate is **shared with `resolveExpr`**, so lifting it
lets `unknown` into arbitrary expression positions (arithmetic, date arguments) that this slice
has not measured. It is a slice of its own and it is smaller than this one was.

`typeOfSource` itself is now dead weight for render sinks and still live for the *format-collapse*
decision. It was left alone deliberately: deleting it is a separate change with its own goldens,
and the reason to touch it — sessions adding a line per node — is gone either way.

## §11 Tier 2.5 as built — `Page Inputs`, and the two nodes beside it that were already lying (session 40, 2026-08-29)

**66 → 67 of 127 (52.0% → 52.8%).** `pickerCoverageFloor` raised in the same commit.

One node moved. That undersells the slice, and the ledger says so in its own floor comment now:
**a detail page needs three things, and all three were broken while two of them were recorded
`translated`.**

### §11.1 The three things, and which of them the ledger could see

`/note/{id}` is a route that carries a value, a node that reads it, and a Navigate that fills it
in. Before this slice:

| | node | ledger said | what it actually emitted |
|---|---|---|---|
| the route | `Page` / `Router` | translated | `<Route path="/note/{id}">` — react-router has no brace syntax, so this route matched the four literal characters `{id}` and nothing a user could type |
| the read | `PageInputs` | deferred | nothing, correctly |
| the Navigate | `RouterNavigate` | translated | `navigate('/note/{id}')` — the same non-url, from the other end |

🔴 **The two `translated` rows are the finding.** The ledger records whether a node is *emitted*,
never whether what is emitted *works*, and two nodes agreeing with each other about a broken url
is exactly the shape that looks healthy from every angle the gate can see. Both ends had to be
built for either to mean anything, and neither moves the number.

### §11.2 The read — one expression, because the runtime has one namespace

`Page Inputs` declares `pathParams` and `queryParams` as separate stringlists and the editor draws
a port per name. The Router does not keep them separate: it hands the node a single flat map built
as `Object.assign({}, match.params, urlQuery)` (`router.tsx:456`).

So every `pm-name` read, whichever list declared it, is:

```ts
pageQuery.get("name") ?? pageParams.name
```

🔴 **The query is read first and that is not a preference.** Because the merge puts the whole query
string *over* the matched path segments, `/note/42?id=99` reports `99` — and it does so for a name
the author only ever listed as a path parameter. The obvious code, path first with query as the
fallback, is a different function, and it differs on precisely the urls a person can type by hand.
That single row is the only one in the drive table that distinguishes the two; see §11.5.

`??` and not `||`, for the empty-value case: `?tone=` is `''` on both sides of the runtime's
`Object.assign`, so it has to win here too rather than falling through to the path.

### §11.3 The gate that stops the export being *better* than the app

A `Page Inputs` on a component the Router does not route reads nothing, ever. The Router feeds the
node by walking the **page's own** node scope (`router.tsx:602`), and a nested component has a
scope of its own — so a `Page Inputs` one component below the page is never called and every
output stays undefined for the life of the app.

`useParams()` has no such boundary. It would read the enclosing route perfectly happily.

🔴 **This is the one divergence a drive cannot find, because it looks like a success.** An export
that read the value there would work *better* than the project it came from — you would click
through it, see the right number, and conclude the slice was done. The read is therefore gated on
the component being a routed page, and the refusal reuses the sentence `dispositionForLogic`
already gave the node, now hoisted to module scope so the wire and the node cannot drift apart.
The same fix widened that sentence to both stringlists: the old one asked only about `pathParams`,
which read as a claim that a query-only node was fine off a route.

### §11.4 The sink table is *narrower* than §10's, and that is the point

An untyped Variable is `unknown` and §10 wraps it in `String(x ?? '')` because it could be an
object. A url parameter is `string | undefined` — already printable, already absent-able — and
every emitted sink is optional: a component prop prints as `Name?: string`, a DOM string attribute
omits itself for `undefined`, and React renders `undefined` in a child position as nothing, which
is exactly what the runtime's Text node does with it (*"an empty value renders nothing rather than
the words null or undefined"*, `text.ts`).

| sink | emitted | why |
|---|---|---|
| `text`, `string`, `truthy` | the read, bare | nothing to coerce; adding `String(x ?? '')` would be noise dressed as rigour |
| `boolean` | `!!(x)` | `defaultChecked` and its kin are boolean attributes and the runtime coerces `!!value` at the port |
| `number`, `opaque` | **refused, with a named reason** | `maxLength={pageQuery.get("n") ?? pageParams.n}` is not TypeScript, and `Number()` around it would be the exporter deciding what a non-numeric url segment means |

The refusal is graded on its **reason** and is distinguishable from both *"has no statically known
source"* and §10's untyped-variable refusal — three refusals, three different fixes. Its control
runs down the same function at the same sink with an untyped Variable instead, because a control
that fails earlier (at plan time, where the wire never becomes a binding at all) would be
exercising a different mechanism and proving nothing about this one.

### §11.5 What proves it

- **`tests/page-inputs.test.ts`**, 27 cases. Every value that arrives is paired with a control
  asserting the shape that should not: braces become colons **and** an unbraced path is untouched;
  the hooks are declared **and** a page whose `Page Inputs` nothing reads declares neither; a
  parameterised Navigate builds a template **and** an unparameterised one stays a plain literal.
- **Three mutations, all killed**: reversing the merge order (8 reds), dropping the route-pattern
  conversion (3), dropping the routing gate (1 — it is a single-purpose gate and one red is the
  right number).
- **`npm run build` on the emitted app**, which found two defects 748 unit tests did not (§11.6).
- **The drive**: 13 rows written down before the app ran, 13 matched.
- **Two sabotage arms**, separated so each rule is isolated.

### §11.6 🔴 The build found two defects, and both hid in switches TypeScript does not check

**One.** A Navigate whose `{id}` came from a text input's `onTextChanged`, fired by a *button*,
emitted `navigate(`/note/${encodeURIComponent(event.target.value)}`)` into the button's handler —
where `event` is the click and has no `.value`. TS18048, TS18047 and TS2339 on one line.

The hole was `actionsValidIn`'s `case 'navigate': return true`. That was **correct** while a
navigation carried nothing but a string, and became a lie the moment it carried expressions.

⚠️ **The emitter had the identical hole in `actionExprsOf` (`case 'navigate': return []`)**, which
feeds the `usesPayload` sweep — so a Navigate filling a parameter from a received event would have
emitted a `useSignal` callback taking no argument around a body that read one. Two switches, same
shape, same slice. Neither produced a compiler error: `actionsValidIn`'s callback has no return
annotation, so `every`'s `unknown` swallows a missing case — the file already warns about this at
`date-now-read`, and this is the second time it has bitten.

**Adding a field to a `HandlerAction` has to be carried to every switch by hand, and `tsc` will
not say which.**

**Two.** `encodeURIComponent` is typed `string | number | boolean` and does **not** accept
`undefined`. A page parameter fed by a Variable read is `string | undefined`, because a variable
boots undefined — TS2345.

The guard is `encodeURIComponent(x ?? '')`, applied only where the expression is maybe-undefined
(a literal gets no fallback, and there is a control for that). ⚠️ **The runtime does neither.**
Handed an undefined value the Router skips the substitution — leaving the literal `{id}` in the
path — and then appends `?id=undefined` beside it, because the leftover loop finds the key the
skipped branch never deleted. Three readings of one function, no two agreeing. There is no
faithful url to emit, so this picks the one that is visibly *nothing*: an empty segment matches no
route and the app stays put, where `/note/undefined` would render a detail page for a note called
"undefined", which looks like data.

The same reasoning is why a braced segment with **nothing** on its port defers by name rather than
reproducing the runtime. It costs nothing that worked before — the old translation emitted
`navigate('/note/{id}')`, a url react-router never matched.

### §11.7 The project, the drive, and what the sabotage showed

**Note Desk**, authored through the MCP over stdio (§2's rule — not hand-edited JSON): `Pages/Home`
with three ways into the detail page (a fixed id, a fixed id carrying a `tone` query parameter, and
an id typed into a field and held in a Variable), and `Pages/Note` at `note/{id}` reading both back
out, with a badge gated on `mounted` so its absence is an absence from the DOM.

⚠️ The typed-id path had to go **through a Variable**. Wiring the input's `onTextChanged` straight
into the Navigate is the defect in §11.6, and the export now defers it — which is how the project
came to be authored the way a person would have had to author it anyway.

13/13 rows matched, including **D9** — `/note/42?id=99` reading `99`.

**Sabotage B** (merge order reversed, nothing else) moved **exactly one row**: D9, from `99` to
`42`. That is the strongest single result here — it confirms both that the drive can fail and that
D9 is the only row in the table with any power to detect the merge order.

**Sabotage A** (braces kept in the route pattern) moved 10 of 13, by the predicted mechanism: every
`/note/…` url falls to the `*` route and redirects home.

🔴 **One prediction was wrong, and it is worth keeping.** D4 — *"the QUIET MODE badge is absent"* —
**still passed** under sabotage A, because on the redirected-to home page there is no badge either.
An absence check was satisfied by the wrong absence. It is only sound as a pair with D7 (*badge
present*), which did move; D4 alone would pass on an app that rendered nothing at all. The favicon
404 appears in every arm and is not a finding.

### §11.8 What this leaves

- **The other four Navigation nodes** — `Navigate To Path`, `External Link`, and the component
  stack pair — are the remainder of Tier 2.5 and each is small on its own. `External Link` is
  `window.open(link, target, params)` and is the cheapest node left anywhere in the ledger.
  ⚠️ `Navigate To Path` has a wrinkle the others do not: it consults the project's
  `navigationPathType` setting (hash vs path), and the scaffold emits a `BrowserRouter`
  unconditionally. That is a pre-existing decision this slice did not touch, and it is that node's
  first question rather than an afterthought.
- **The store-key gate (§10.5) is untouched and still the same shape**, one node over.
- ~~**`Page Stack`** and the component-stack family also feed `Page Inputs` at runtime
  (`_setPageParams` has two callers).~~ 🔴 **False, and this is where it entered the phase —
  struck in session 45, see §16.1.** Both callers are the Router; a component stack sets the
  pushed component's **Component Inputs** instead and never touches `Page Inputs`. This slice
  translated the Router's half, which was the only half there was.

---

## §12 Tier 2.5 continued — `External Link`, and the node that has been lying to its authors all along (session 41, 2026-08-29)

**68 of 127 (53.5%).** The cheapest node left anywhere in the ledger, and it took an afternoon
exactly as §11.8 predicted — but not for the reasons §11.8 gave, and the drive found a product
defect that has nothing to do with the export.

### §12.1 What the node turned out to be

`window.open(link, target, params)`, plus the two guards the interpreter runs around it:

```tsx
const typedLinkHref = typedId.get();
if (typedLinkHref !== undefined && typedLinkHref !== null && typedLinkHref !== '' &&
    window.open(typedLinkHref, '_blank', 'noopener,noreferrer')) {
  navigate(`/note/${encodeURIComponent('opened')}`);
} else {
  navigate(`/note/${encodeURIComponent('blocked')}`);
}
```

🔴 **`&&` is the runtime's own short circuit, and it is load-bearing.** With no link the
interpreter reports failure and returns *before* `window.open` — and `window.open('')` opens a
**blank tab**. A guard that ran the call anyway would open a window the app never opens. This is
why the guard survives even when nothing is wired to `Failure`, and sabotage arm A is the row that
proves it (§12.5).

A literal url is provably non-empty, so it emits neither guard nor local and the commonest shape in
any project stays one expression:

```tsx
<button onClick={() => window.open('https://example.com/handbook', '_blank', 'noopener,noreferrer')}>
```

### §12.2 `Open In New Tab` unset is `true`, and that is what makes the port answerable

The runtime reads this one input **two different ways in two adjacent lines** — `params` is
truthiness (`openInNewTab ? … : ''`), `target` is strict equality (`=== true || === undefined`).
They agree for `true`, for `false`, and for the unset port; they disagree for every *other* truthy
value.

Unset is `true` rather than `undefined` because the port declares `default: true` and
`registerInput` writes a declared default straight into `_inputValues` (`node.ts:138`) — so
`getInputValue` never sees the `undefined` its own target expression tests for. That collapses the
three cases the editor can express into two, and **a wired `Open In New Tab` defers**, naming the
two readings. The one deferral in this slice that is about the runtime rather than about the
export.

### §12.3 The port the node's own source does not show

`EXTERNAL_LINK_OUTPUTS` was first written by reading the node's literal `outputs:` object: `done`,
`unchanged`, `failure`, `error`. Four ports.

The editor draws **five**. The definition spreads `...outcomeOutputs({ done, unchanged, failure })`,
and that helper adds a `Completed` port to every node that uses it (`outcome.ts:164`). So the first
version of the refusal sentence told an author that a port they were looking at *did not exist* —
`its completed output is consumed, and this node publishes only Done, Unchanged, Failure and Error`.

🔴 **A definition that spreads a helper is not a port list, and reading it as one produces a
confident falsehood.** Caught by asking the catalog through the MCP server's `get_node_type` while
setting up the authoring project — not by reading the runtime file a second time, which would have
returned the same four ports however carefully it was read. The artefact is the catalog; the source
file is one input to it.

`Completed` now defers on its own sentence: it fires after every outcome, and this slice emits the
outcome arms rather than a join beneath them — `HTTP Request` deferred its own on the same ground.

### §12.4 What defers, and why each is about a mechanism

| refusal | the mechanism |
|---|---|
| a wired `Open In New Tab` | the two readings above disagree for any truthy non-`true` value, and only a wire can deliver one |
| a consumed `Error` | the message needs a state row of its own — `HTTP Request`'s `errorState`, one node over. Both messages here are static, so this is a small slice rather than a hard one |
| a consumed `Completed` | fires after every outcome; this slice emits arms, not a join |
| no `Link`, or an empty one | every emitted form of it is dead code — **and one of them does not compile**: `const href = ''` gives TS the literal type `""`, and `href !== ''` on it is **TS2367, types have no overlap** |
| a non-string `Link` | `window.open` is typed `string \| URL`, so a number is a TS2345 in the emitted app whatever the guard looks like — §11's `encodeURIComponent` trap, one slice later |

⚠️ The `unchanged` wire is **dropped with a note, not deferred**. It fires only when there is no
`window` — a server-side render — and the scaffold mounts with `createRoot` and has no server pass.
Dead in the export for the same reason it is dead in the app running in a browser, which is
`Clear Array`'s rule: a wire already dead in the interpreter must not cost a translation.

### §12.5 What proves it

**22 tests** in `tests/external-link.test.ts`, every positive assertion paired with a control, and
**four mutants killed**: target always `_blank` (2 reds), guard removed (2), done chain
unconditional (1), the `unchanged` chain treated as the failure chain (3).

**The project, built and driven.** `note-desk` — session 40's detail-page project — with three
`External Link` nodes added to `Pages/Home` **through the MCP server**, not by hand-editing JSON.
`npm run build` exits 0; **9 of 9 drive rows matched**, no console errors.

Sabotage, one rule per arm, expectations written before the run:

| arm | change | rows that moved |
|---|---|---|
| A | the empty-link guard removed | **D3 only** — an empty link opened a blank tab (6 → 7) |
| B | `_blank` forced regardless of the port | **E2 only** — `_self` became `_blank`; E1 and the guard unchanged |

🔴 **Arm A is why the pair matters, and it is not the pair anyone would have predicted.** D2 ("the
Failure arm ran") did **not** move under arm A — with the guard gone, `window.open('')` still
returns `null`, so the failure arm still ran and the app still landed on `/note/blocked`. The row
that caught the missing guard was the **tab count**, and nothing else would have. An emitter that
dropped the guard passes every assertion about where the app navigates.

### §12.6 🔴 The drive found a product defect, and it is not in the export

**`External Link` reports `Failure` on every new tab it successfully opens.** The node sets
`noopener` in its window features (`:51`) and then reads `window.open`'s return value as its
blocked-tab test (`:70`). **`window.open` returns `null` whenever `noopener` is set, by
specification** — so the test can never pass, `Done` is unreachable for a new tab, and `Error` reads
"The browser blocked opening a new tab" beside an open tab. `Open In New Tab` defaults to `true`, so
this is the ordinary configuration.

Proven by a control pair varying the features string and nothing else — both arms under a **real
user gesture**, because a scripted `element.click()` is not a user activation and `window.open` is
refused outside one, which would have made both arms return `null` for a reason that has nothing to
do with `noopener`:

| arm | features | returned | tabs |
|---|---|---|---|
| A — the node's default | `"noopener,noreferrer"` | **NULL** | 3 → **4** |
| B — without it | `""` | **a Window** | 4 → **5** |

Filed as **[DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md)**,
owner `NONE`. Phase 30's node audit graded row B2 ✅ naming both failure codes — it graded that they
**exist**, never that either can **fire**. A port census asks a different question from a drive.

**No export change is owed.** The emitted app reproduces this exactly, which is §11.3's standing
rule working as intended: the export must never work *better* than the app it came from. It stops
being wrong the moment DEF-016 is fixed.

### §12.7 What this leaves

- **Three Navigation nodes**: `Navigate To Path` and the component-stack pair. ⚠️ `Navigate To
  Path`'s first question is unchanged — it consults the project's `navigationPathType` (hash vs
  path) and the scaffold emits a `BrowserRouter` unconditionally.
- **`External Link`'s `Error` output** — ✅ **built in session 43, §14.** It was a state row, and
  it was not *"and nothing else"*: the two failures had never needed telling apart before, and
  building the port that tells them apart found a defect in the emitted code beside it.
  `Completed` still needs a join beneath the arms.
- **The store-key gate (§10.5)** — ✅ **closed in session 42, §13.**

⚠️ **DEF-016 landed** (`0c011b6b`), and with it the export's own follow-up: the emitted new-tab
test now reads `navigator.userActivation`, not `window.open`'s return value. §12.6's closing
sentence — *"it stops being wrong the moment DEF-016 is fixed"* — is therefore history rather than
a pending item, and **`External Link`'s `Error` output above is once again the cheapest increment
on the node**, unblocked and unchanged in shape: both messages are still static.


## §13 The store-key gate, closed — the same defect one construct over (session 42, 2026-08-29)

**68 of 127 (53.5%), unchanged, and that is correct**: this is a gate, not a picker node. §10.5
named it as *"a slice of its own and smaller than this one was"*, and it was.

### §13.1 The defect, and the half of it nobody had noticed

`storeKeyReadOf` refused any Global Store key not typed `string`/`number`, so a key written from
an HTTP body dropped **every read of it** with the note *"has no statically-typed value"* — §10's
blank element, reached through a different node.

🔴 **The gate also refused every `boolean` key, and that half was never about untypability at
all.** `StoreKeyTsType` is `'string' | 'number' | 'boolean' | 'unknown'`, and a key whose
`initialState` value is `true` is *perfectly* typed — it simply had no row in the render table. So
the one-line type test was doing two different jobs and getting the second one wrong.

### §13.2 What changed — the widening is per call site, which is the whole design

§10.5 named the reason not to lift the gate: `storeKeyReadOf` is **shared with `resolveExpr`**, and
an expression position is arithmetic, a date argument or a url segment — none of which has a sink
that can state what it holds. So the gate takes a mode rather than moving:

| call site | mode | why |
|---|---|---|
| pass 4b, the render binding | `'binding'` | §10's ruling — the sink knows what it holds and coerces there |
| `resolveExpr` | `'expr'` | unchanged; `unknown` in an expression position would be an invented cast |

A bound-but-untypeable key is marked `untyped: true` on the `store-key` `BindingSource` and takes
**§10's existing table**, not a second one beside it — same `unknown`, same JSX positions, and a
second table is a second thing to drift.

🔴 **A key the store plan does not carry defers in *both* modes, and it is a different refusal.**
The emitted selector reads `s.<key>` against the store's generated interface, so binding a key with
no entry is a **TS2339 in the exported app** — not a value needing a coercion. Collapsing the two
would have turned a compile error into a silent wrong render.

### §13.3 What proves it

- **13 tests** in `tests/untyped-store-key.test.ts`, every coercion paired with a CONTROL asserting
  a `string`-typed key in the same sink reads bare.
- **Four mutants, each killing distinct predicted rows**: the old gate restored (**6**), the sink
  stops coercing (**5**), `resolveExpr` widened too (**1** — the row that exists to catch exactly
  that), an absent key bound rather than deferred (**1**).
- **`npm run build` on the emitted app** — `tsc -b && vite build`, exit 0, with all four sinks
  exercised in one app.
- 🔴 **The necessity control, which is the row that matters.** A build that passes proves the
  coercion is *valid*, never that it is *needed*. Emitting the bound value **bare** and rebuilding
  fails with **TS2322 ×2** — `Type 'unknown' is not assignable to type 'ReactNode'` and the same
  for the placeholder attribute. The coercion is load-bearing, measured rather than assumed.

### §13.4 🔴 Four things that were nearly wrong, and what caught each

1. **A mutant that does not compile kills nothing and reads like a clean run.** Mutant 2's first
   form was `source.kind === 'store-key' && false ? … : null`, which ts-jest rejected — and jest
   reported **`Tests: 0 total`**, not a failure. Read as "no rows died" it would have said the
   suite was blind; read as a kill it would have been a lie. **A mutant arm owes a row count, and
   `0 total` is "it never ran".**
2. **The gate-still-shut row passed for the wrong reason first.** It wired the untyped key into the
   fixture's `themeFormat`, whose `theme` port **already carries a wire** — so it measured the
   duplicate, not the gate. A fresh `String Format` reproduced the real control pair: a `string`
   key inlines as `` `Quote of the day: ${note}` ``, the untyped one defers by name.
3. **`initialState` parses as a `json` ParamValue, not a `literal` one.** The boolean arm built its
   store with `literal({…})`, which is **silently ignored** — the store emitted
   `store<MoodState>('mood', {})` with every key optional. It fails looking exactly like a passing
   arm would if you only checked the wire was not dropped. Probing the real IR was what settled it.
4. 🔴 **The build is not a complete instrument for the boolean row, and saying so is the finding.**
   Bare `{loud}` where `loud: boolean` compiles fine — `boolean` is a valid `ReactNode`. But React
   renders a bare boolean as **nothing**, where the runtime's Text node renders `String(value)` →
   `"true"`. So that coercion fixes a real divergence **`tsc` cannot see**, and the necessity
   control above covers the `unknown` sinks only.

### §13.5 What this leaves

- **`typeOfSource` is still dead weight for render sinks** and still live for the format-collapse
  decision — §10.5's second paragraph, untouched and still true.
- **The `'expr'` mode is now the only caller of the strict rule.** If a future slice wants an
  untyped key in an expression position, it needs what §10 needed: a place that can say what it
  holds. There isn't one yet, and the deferral names itself.


## §14 `External Link`'s `Error`, and the fix DEF-016 needed on this side too (session 43, 2026-08-29)

**68 of 127 (53.5%)** — unchanged, because this is an increment on a node the ledger already
counts. §12.7 called this *"a state row and nothing else"*. The row took an hour. What the hour
also found is that the emitted app had been running its **Failure chain on every tab it
successfully opened** since DEF-016's export follow-up landed, and no test in this package could
see it.

### §14.1 🔴 `window.open` consumes the transient activation, and that is a defect on this side

DEF-016 fixed the runtime by reading `navigator.userActivation` **before** the call
(`externallink.ts:96`). The export's copy landed in the same commit and read it **after**, inside
the comma expression that keeps one failure arm:

```tsx
if (guard && (window.open(href, '_blank', 'noopener,noreferrer'), navigator.userActivation?.isActive !== false))
```

That is `false` on a successful open. `window.open` **consumes** the activation — Chrome allows
one popup per gesture and spends the gesture doing it — so the value the `if` reads is the
activation the call just used up.

Measured before any code was written, one control arm varying **only** whether the call sits
between two reads of the getter, both under a real `Input.dispatchMouseEvent` gesture:

| arm | one thing varied | `before` | `after` | tabs |
|---|---|---|---|---|
| N | — | `true` | **`true`** | 1 → 1 |
| C | the call between the reads | `true` | **`false`** | 1 → **2** |

🔴 **Arm N is what makes this attributable rather than merely observed.** A lone `false` after
the call fits "the call consumed it" and fits "the activation expired" and fits "the getter reads
false in this host" equally well. Reading the getter twice with nothing between them excludes the
second and third: the read is pure, so only the call can have spent it. Arm C's tab count is the
other half — it says the open *succeeded* while the test said blocked, which is the whole defect
in one row.

The read now binds to a local before the call, which is the runtime's own order:

```tsx
const watchedHref = typedId.get();
const watchedBlocked = navigator.userActivation?.isActive === false;
if (!(watchedHref !== undefined && watchedHref !== null && watchedHref !== '' &&
      (window.open(watchedHref, '_blank', 'noopener,noreferrer'), !watchedBlocked))) {
  setWatchedError(watchedHref === undefined || watchedHref === null || watchedHref === '' ? 'No link to open' : 'The browser blocked opening a new tab');
}
```

Hoisting the read above the *guard* as well as above the call is safe for the reason arm N
measured: the getter has no side effects, so a read taken where the interpreter would not have
bothered is unobservable. That is what keeps one failure arm instead of duplicating the chain.

⚠️ **DEF-016's AC7 was graded met, and in letter it was**: the export did stop reading
`window.open`'s return value. The ordering was never an acceptance criterion because nobody knew
it was one. A criterion written as *"reads the activation, not the return value"* is satisfied by
code that reads the activation at the wrong moment — **the AC named the expression and the defect
was in the sequencing.**

### §14.2 The row, and why it is allocated by the read

`HTTP Request`'s `errorState`, one node over, with the hard part absent: both messages are static
strings in the node's own source, so nothing has to be carried out of a service's answer.

🔴 **Allocated by the read, not by the node** — `httpAnswerStateOf`'s rule rather than
`httpErrorStateOf`'s, and the difference is the point. A request's Error row is always allocated
because the call always writes it. Doing that here would put a `useState` nobody reads into the
commonest shape in any project — a button that opens a literal url, which today emits one
expression and no state at all. The read runs passes after the node compiled, so the row reaches
the action in the late sweep (§8.3's allocation-order rule, **fourth instance**).

### §14.3 🔴 The port is the only thing that tells the node's two failures apart

Everywhere else in this action the two failures are one arm — §12's own comment says so: *"the
two failures are indistinguishable once `Error` is out of the slice"*. `Error` is what takes it
out of that state. `'No link to open'` and `'The browser blocked opening a new tab'` are two
different writes, so the single failure arm re-tests the link to pick between them.

Which message is live depends on the configuration, and only the live one is emitted:

| `Link` | `Open In New Tab` | what can fire | emitted |
|---|---|---|---|
| wired | on | both | the ternary |
| wired | off | the empty link only | `'No link to open'` |
| literal | on | the blocked tab only | `'The browser blocked opening a new tab'` |
| literal | off | **neither** | no write, and a note saying so |

The last row is the configuration that already drops its Failure chain, and it drops the write on
the same reasoning. The row is still allocated — a sink bound to it renders nothing, which is what
the interpreter's unwritten getter gives — but a reader of the export is owed the sentence rather
than a silent blank.

⚠️ **The message is `_internal.lastError`, which is the SHORT string.** The blocked failure has
*two* strings in the runtime and only one of them belongs to this port: `reportOutcome` sends a
longer sentence about user actions to the outcome channel, and nothing in the export reads it. Two
strings, one port, and it is not the one that reads better.

### §14.4 What defers, and the consumer that was silent

A read of `Error` from **inside this node's own outcome chains** defers. `setWatchedError(...)`
does not change `watchedError` inside the closure that called it, so the chain would deliver the
*previous* failure's message — §8.2's rule, third construct. `HTTP Request` mints a chain-local
for exactly this; refusing the read is the increment this slice leaves rather than the corner it
cuts.

🔴 **`resolveExpr` answering the read was half the work, and the other half is silent** — the gap
§7.5 named, hit for the third time. Pass 4f's admission predicate and Pass 4c's whitelist are both
opt-in and neither errors, so the read resolved perfectly in a function nothing called and the
wire fell through to Pass 6's catch-all: *"no deterministic translation in step 5"*, about a read
this file had just been taught. **A new readable node has at least two consumers in this package.**
Caught here by a test rather than by a build, which is the only reason it cost minutes.

### §14.5 What proves it

**33 tests** (was 22), **seven mutants killed**, every arm with a row count:

| mutant | rows killed |
|---|---|
| the activation read moved back after the call | **3** |
| the message always the blocked string | **2** |
| Pass 4f's admission clause dropped | **6** |
| a row allocated for every External Link | **3** |
| the own-chain refusal dropped | **1** |
| the never-written note dropped | **1** |
| the earning check dropped | **1** |

⚠️ **Two mutants first reported `Tests: 0 total`, which is not a kill.** Both were written as
`if (false && …)`, which ts-jest rejects as a type error, so they never ran — session 42's lesson
arriving on schedule. Re-written as outright deletions they killed one row each.

**The project, built and driven.** `note-desk` again, with a **watched link** added through the
MCP server: a guarded link into a new tab with **no outcome chains at all**, so a click never
navigates away and the message stays on screen. `npm run build` exits 0; **8 of 8 drive rows
matched**, no console errors.

🔴 **Row order is part of the design, not a convenience.** The runtime never clears
`_internal.lastError`, so the success row has to run *first* — after any failure the text is
occupied and a later success proves nothing.

| row | measured |
|---|---|
| D1 on load | empty |
| D2 a real url, clicked | **empty, and the tab count rose 1 → 2** |
| D3 the input cleared, clicked | `No link to open`, tabs unchanged |
| D4 the handbook (literal, new tab) | tab count rose, text still D3's — never cleared |

Sabotage, one rule per arm, expectations written before the run:

| arm | change | rows that moved |
|---|---|---|
| A | the activation read moved back after the call | **D2 only** — `The browser blocked opening a new tab`, beside a tab that opened |
| B | the message always the blocked string | **D3** — and D4 mirrored it |

⚠️ **Arm B's prediction said "D3 only" and that was wrong about D4, in a way worth keeping.** D4
is not an independent observation: the row is never cleared, so D4 reads whatever the last failure
wrote and mirrors D3 by construction. It was never a second rule — which also means D4 could
never have caught anything arm B's D3 did not.

### §14.6 What this leaves

- **`Completed`** — unchanged from §12.7: it fires after every outcome, and this slice still emits
  the arms rather than a join beneath them.
- **A chain-local for `Error`**, which would turn §14.4's refusal into a translation.
- **Three Navigation nodes** — `Navigate To Path` and the component-stack pair, exactly as §12.7
  left them.

---

## §15 Tier 2.5 continued — `Navigate To Path`, and the four rules that did not transfer (session 44, 2026-08-29)

**69 of 127 (54.3%).** The node the last three sessions kept describing as "the one with the
`navigationPathType` question". The question dissolved in twenty minutes of reading, and what was
actually there was a node whose url builder disagrees with `RouterNavigate`'s in four places —
plus a route the ledger cannot see, broken in the scaffold since Tier 2.5 began.

### §15.1 🔴 The setting was never the question, and reading both modes is what showed it

Three ledger rows, two session prompts and §11.8 all said the same sentence: *`Navigate To Path`
consults `navigationPathType` (hash vs path) while the scaffold emits a `BrowserRouter`
unconditionally — that is its first question, not an afterthought.* It was worth asking. It was
also answerable, and the answer is that the setting cannot reach the export.

`navigationPathType` chooses **where the same path string is written**, not what it names:

| | hash (the default, and what unset means) | path |
|---|---|---|
| `_getLocationPath` (`router.tsx:674-698`) | strips `#`, then one `/` | strips one `/` (and BaseUrl) |
| `_getSearchParams` (`router.tsx:708`) | `location.search` | `location.search` |

Both branches return **the same bare path**, and the query is read from `location.search` in
**both** — which is why every url builder in the runtime puts the query *before* the `#`
(`'' + '?tone=quiet' + '#/note/5'`). So the route named and the query carried are identical in the
two modes; only the address bar differs. The exported app has already committed to writing that
path as a real path, consistently, since before this tier: a `BrowserRouter` over `<Route path=…>`,
which is also what `RouterNavigate` has always assumed.

🔴 **The control is what makes this a measurement rather than a preference.** If the two modes
named different routes, `_getLocationPath` would differ by more than the sigil strip. If the query
lived in the hash in hash mode, line 708 would read `location.hash`. Neither does. §15.6 pins both
readings against the runtime files so the claim fails the day it stops being true, rather than
quietly becoming folklore in a fourth ledger row.

### §15.2 🔴 Four rules from `RouterNavigate` do not transfer, and copying them would have been wrong every time

The prompt said §11.2's reasoning transfers because the node has the same two-namespace `p-`/`q-`
shape. The *port shape* transfers. The url builder does not — these are two different functions:

| | `getRelativeURL` (`RouterNavigate`) | `navigate()` (this node) |
|---|---|---|
| an unset placeholder | left as the literal `{id}`, **and** `?id=undefined` appended beside it | substituted with `''` |
| encoding | `encodeURIComponent` on both halves | none — `String(v)`, and `q + '=' + v` |
| the query set | whatever is **left over** after substitution | the **authored** `Query` list |
| an unset query value | n/a | **omitted from the url entirely** |

The unset placeholder is the sharpest. §11.6 *deferred* it one node over, and the reason it gave
was specific: the Router's three readings of that case do not agree, so there is no faithful url
to emit. This node's own loop is `v !== undefined ? String(v) : ''` — coherent, and exactly the
"visibly nothing" answer §11.6 had to reach for by argument. So it **translates**, and a slice
that had inherited the rule would have deferred a case the runtime is perfectly clear about.

**Encoding is the one that would have been invisible.** Emitting `encodeURIComponent` here reads
as obviously correct — it is what the neighbouring case does, it is what makes urls robust, and
nothing in the test suite would have complained. It would also have made the exported app disagree
with the app it came from on every value carrying a url-special character, in the direction §11.3
names: the export would route where the interpreter does not. The emitted `Home.tsx` now carries
both nodes a few lines apart, one encoding and one not, which is the control stated as code.

### §15.3 The divergence that was real, and it is a leading slash

`_trimUrlPart` (`router.tsx:39`) strips one leading slash from the page pattern and
`_getLocationPath` strips one from the location, so **`note/42` and `/note/42` are one route in
the runtime**. In react-router the first is *relative to the current route* and the second is
absolute. So the emitted path is normalised to exactly one leading slash — the runtime's own
normalisation, one strip and one put back, which leaves `//x` as `//x` because that matches
nothing on either side either.

🔴 **The same slash was already broken on the route side, and it is the second finding of this
tier the ledger cannot see.** `routedPages` built `` `/${pageUrlPath(component)}` `` — a Page
whose `urlPath` was authored `/note/{id}` became `<Route path="//note/:id">`, which react-router
matches against nothing, while the Router trims the pattern before matching and routes it happily.
Every fixture in this repo happens to author the path unslashed, which is why 835 tests and four
drives never saw it. Fixed in `scaffold.ts` with the runtime's own function; it moves no number,
exactly like the two route defects §11.1 found.

### §15.4 What defers, and the `Completed` that stopped needing to

Four refusals, each about a mechanism:

- **`Open In New Tab`** — that arm is `window.open`, whose success test is the transient user
  activation rather than the return value (DEF-016, §14.1), plus a blocked-tab `Error` row. That
  is `External Link`'s slice, not a flag on this one. ⚠️ **This port's default is `false` here and
  `true` there** — the two nodes look like a pair and their unset state lands on opposite sides.
- **A wired or absent `Path`** — the braced segments of the path text are what mint the ports, so
  a path unknown here is a node whose shape is unknown here.
- **`Error`** — refused because **nothing can write it**, not because it is hard. It is set on
  exactly two paths, no-Path and blocked-tab, and both are excluded by the gates above; a
  translated read would bind a string that is `undefined` for the life of the app. §14 was careful
  to allocate that row *by the read*; here the read cannot be earned at all.
- **A `p-`/`q-` value that is a logic truth value**, on the standing rule.

**`Completed` translates here, and that is earned rather than chosen.** It is refused one node
over because it fires after *every* outcome and there are three of them there. Here the gates
leave exactly one outcome reachable — `Unchanged` needs no `window` and the scaffold never renders
on a server, and neither failure can fire for a literal in-tab path — so `Completed` is one arm to
follow, not three to join beneath. `reportOutcome` sends the outcome port and then `Completed`
(`node.ts:958-995`), and the emitted chains print in that order. The `Unchanged` and `Failure`
wires are **dropped with notes** on `Clear Array`'s rule rather than deferring the node.

### §15.5 What proves it

**38 tests**, and **twelve mutants killed, every arm with a row count**:

| mutant | rows killed |
|---|---|
| `encodeURIComponent` added, as the Router does | **2** |
| the leading-slash normalisation dropped | **18** |
| an unset placeholder deferred (§11.6's rule copied across) | **1** |
| an unset query value sent as `name=` | **2** |
| the omission loop replaced by the static suffix | **1** |
| the `?? ''` fallback dropped | **2** |
| the scaffold's `_trimUrlPart` dropped | **2** |
| `usesNavigate` blind to the new kind | **2** |
| the `Completed` chain dropped | **1** |
| `Failure` deferred rather than dropped as dead | **1** |
| the omittable value read twice | **2** |
| `deepActions` stopping at this kind | **1** |

🔴 **Two of those were not kills until the tests were fixed, and both failures were in the
measurement rather than in the code.**

**One — a metric that could not see the defect it was written for.** The row asserting each
omittable expression is read exactly once counted *lines* containing `tone.get()`. The mutant
emitted the guard and the push on **one line**, each naming the source — the exact double read the
row exists to forbid — and the count was still 1. It passed, and it was blind. Counting
occurrences kills it.

**Two — a mutant that killed nothing, which was the finding.** Stopping `deepActions` at this kind
moved no row at all, because both navigation kinds set the same `usesNavigate` flag and the outer
action is in the list whether or not anything descends into it: a navigation nested in a
navigation could never observe the walk. A **state row** can — an `HTTP Request` in the Done chain
owns an `errorState` binding, and without the walk the emitted `catch` names a row the declaration
filter has already dropped. That is now the row, and it kills the mutant.

**The project, built and driven.** `note-desk` again, six `Navigate To Path` buttons added through
the MCP server (§2's rule) plus one on the Note page. `npm run build` exits 0; **9 of 9 drive rows
matched what was written down before the app was built**, no console errors.

| row | measured |
|---|---|
| D2 `Go to 99` | `/note/99`, id `99`, no badge |
| D4 `Go quietly to 5` | `/note/5?tone=quiet`, badge **present** |
| D5 `Go with no id` | url stays `/` — the empty segment matches nothing and the `*` route redirects |
| D6 typed tone **empty** | `/note/8?sort=new` — **no `tone=` at all** |
| D7 typed tone `hush` | `/note/8?tone=hush&sort=new`, badge present |
| D8 `Chain` | `/note/third` — Done ran, then Completed, last write wins |
| D9 `Jump to 55` from `/note/99` | `/note/55` |

Sabotage, one rule per arm, predicted before running:

| arm | change | rows that moved |
|---|---|---|
| A | the leading-slash normalisation dropped | **D9 only** — `/note/55` became `/`, because a relative `note/55` from `/note/99` resolves to `/note/99/note/55` and matches nothing |
| B | the omission loop replaced by the static suffix | **D6 only** — `/note/8?tone=undefined&sort=new`, and the page rendered the word **"undefined"** as the tone |

🔴 **D9 had to be rebuilt before it was worth anything, and the first version looked fine.** It
originally went home before clicking, which made it a copy of D3 — and from `/` a relative and an
absolute `note/55` resolve *identically*, so every row in the table was blind to the rule arm A
varies. The tell was writing arm A's prediction down and finding it said "nothing moves". A row
that cannot fail is not a row; the fix was a button on the **Note** page, so the click happens
from a non-root route.

⚠️ **Arm B's written prediction said `tone=` and the truth was `tone=undefined`.** The direction
was right — D6 moves, the badge appears — and the string was wrong, because `${undefined}` in a
template stringifies rather than emptying. Worth keeping because it is §11.6's "looks like data"
failure arriving on the query side: the sabotaged app rendered a note whose tone is the word
"undefined", which reads as content rather than as a bug.

### §15.6 What this leaves

- **`Open In New Tab`** — the window.open arm, which wants DEF-016's activation read and a
  blocked-tab `Error` row. That is the increment this slice leaves rather than the corner it cuts.
- **The component stack pair** (`PageStackNavigate`, `PageStackNavigateBack`) — the last two
  Navigation nodes, and neither is a url builder. ⚠️ ~~§11.8 still stands: a component stack feeds
  `Page Inputs` at runtime (`_setPageParams` has two callers) and the export does not route one at
  all, so these two owe a **routing story**~~ — 🔴 **struck in session 45: both halves of that
  sentence were false, and it came from a grep landing on a comment. See §16.1.** The pair is
  re-tiered to Tier 3 behind the `Page Stack` it drives.
- **`External Link`'s `Completed` and a chain-local for its `Error`** — unchanged from §14.6.

---

## §16 The component stack pair, and the sentence a grep wrote into the ledger (session 45, 2026-08-29)

**69 of 127 (54.3%) — unchanged, and deliberately.** This slice translated nothing. It answered
the pair's first question, and the answer was that the question had been the wrong one for five
sessions.

### §16.1 🔴 The inherited sentence was false twice over, and a comment is where it came from

§11.8 wrote it, §15.6 relayed it, both ledger rows carried it verbatim, and two session prompts
repeated it as the pair's defining constraint:

> *A component stack also feeds `Page Inputs` at runtime (`_setPageParams` has two callers) and
> the export does not route one at all, so these two owe a routing story.*

Both halves are wrong.

**`_setPageParams` does have two callers, and both are the Router.** They are `router.tsx:604`
(inside `_updatePageInputs`, the normal page build) and `router.tsx:926` (an inline loop in
`_buildPage`). That file defines exactly one node — `RouterNode`, lines 124–957, with a single
`createNodeFromReactComponent(` call in it — so there is no other `this` either call could have
belonged to. "Two callers" was read as "the Router and something else"; it was always the Router
twice.

**A Component Stack never touches `Page Inputs` at all.** It pushes a component and sets that
component's own **Component Inputs** directly — `navigation-stack.tsx:550`, `:862` and `:976`,
three paths (initial render, `replaceAsync`, `navigateAsync`), all `content.setInputValue(...)`.
The pusher's `pm-` ports are derived from `component.inputPorts` (`navigate.ts:335`), which is the
same interface any placed component instance has. The stack's only cross-node reach into pushed
content is `getNodesWithType('PageStackNavigateBack')`, to hand back the pop callback.

🔴 **The one occurrence of the string `_setPageParams` in `navigation-stack.tsx` is a comment**
(line 983) explaining that `_setBackCallback` is reached across the node-type boundary *the same
way the Router reaches `_setPageParams` on PageInputs*. A grep for the method hits that line. That
is almost certainly the whole provenance of the claim: the search was run, the file appeared in
the results, and the conclusion was drawn without opening it. **A text search cannot tell a
mention from a call, and the sentence it produced then survived five sessions because every later
reader inherited it as a finding rather than re-running the search.**

### §16.2 What a Component Stack actually is, and why it is not a route

Having read it, the routing question is answerable — and it is not close:

| | Component Stack | the export's `BrowserRouter` |
|---|---|---|
| what is mounted | a stack of component instances; **both stay mounted through the pop transition** (`back()` re-inserts `top.from` before animating) | one element per matched `<Route>` |
| parameters | the target's **Component Inputs**, set imperatively | url params read by `useParams`/`useSearchParams` |
| the return path | `backCallback(action, results)` — the pusher grows a `backResult-*` **output port per value** and a `backAction-*` **signal per way of closing** | none; navigation is one-way |
| identity | **named** (`stack: 'Main'`), several may exist at once, and they **nest** — `getNavigationAbsoluteURL` walks the visual parent chain and concatenates | a singleton |
| the url | written **only if `useRoutes` is set**, via `history.pushState` | the url *is* the state |

The back channel is the sharpest of these. A push is a **call**, and the pop is its **return**,
carrying named values and a named outcome back to the node that made it. A url has no way to
express a return value, which is why this pair could not become a url builder however carefully it
was written — and it is a different objection from "the export does not route a stack", which is
what the inherited sentence predicted the obstacle would be.

### §16.3 🔴 The real reason they defer is a tier, not a mechanism

`Page Stack` — the container both nodes drive — is **deferred**, and scheduled to **§3 Tier 3
item 10, the component-tree family**. The pair sat in Tier 2.5. So two nodes whose entire function
is to drive a container were scheduled a **full tier ahead of the container**, and no amount of
design work on them could have produced a translation: a pusher with no stack has nothing to push
onto, and `PageStack` appears nowhere in `packages/nodegx-export/src`.

Both rows are therefore **re-tiered to Tier 3**, to sit with the thing they drive, and their
exemption now states the mechanism above rather than the sentence that was never true.

🔴 **This closes Tier 2.5's node list.** The pair were the only two ledger rows citing it. What
remains under §15.6 — `Open In New Tab`, `External Link`'s `Completed`, a chain-local for its
`Error` — are increments on rows already marked `translated`, not deferrals, so the tier's
*coverage* question is settled even though those increments are still worth doing.

### §16.4 What proves it

`tests/component-stack-pair.test.ts`, 10 assertions, and its design is the finding restated:

- 🔴 **The instrument is proved before it is trusted.** Two synthetic snippets differing by
  exactly one `//` are fed to the counter, which must return 1 and 0, while a text search matches
  **both**. Without that pair, a counter that returned 0 for everything would make every
  assertion in the file pass while measuring nothing.
- 🔴 **The text match on the real file is asserted as a known-firing control.** `navigation-stack.tsx`
  *must* still match `_setPageParams` textually — if it ever stops, the AST assertion beside it is
  excluding nothing and the file says so rather than going quietly green.
- The load-bearing readings are counted over **call expressions**, where a comment cannot appear:
  0 in the stack, 2 in the Router.
- The comment-ness is pinned directly too: every line in `navigation-stack.tsx` containing the
  string starts with `//`.
- The ledger row is pinned — **if `Page Stack` is ever translated, the test fails**, which is
  precisely the moment the pair should be reconsidered rather than a moment to discover later.

### §16.5 What this leaves

- **The pair is answered, and is Tier 3 work behind `Page Stack`.** It should not be planned again
  before its container.
- **`Open In New Tab`** (§15.6) is now the top of Tier 2.5's remainder, unchanged.
- 🔴 **The provenance lesson is the transferable one.** §15.1 killed a relayed sentence by reading
  the runtime; this section killed a second one, from the same family, that had been relayed
  *further* — into two ledger rows the gate treats as reviewed. The ledger's exemption text is
  **prose nothing verifies**: `check.js` enforces that a deferral names its *kind* and *tier*,
  never that its stated reason is true. Two rows asserted a runtime behaviour that did not exist,
  and passed every gate for five sessions. **When an exemption makes a factual claim about the
  runtime, it needs a test, exactly like a translation does** — which is what §16.4 now is.
