# EXP-011 — Close the picker gap, ranked by what apps need

**Status:** 🟡 In progress — **Tier 1.2 (`HTTP Request`) is built, driven and gated**, session 37
**Depends on:** nothing — but sequenced after EXP-009 and EXP-010, which are worth more per hour
**Replaces:** every "what to build next" list in this phase from sessions 20–31

---

## §1 The gap, measured

```
node scripts/export-ledger/picker-coverage.js
```

> **PICKER COVERAGE: 60 of 127 placeable nodes export (47.2%)** — 2026-08-28, session 37
> (51 / 40.2% when this task was written; **Variables** left the table in session 35, four of the
> eight Data nodes of Tier 1.1 left it in session 36, and `HTTP Request` left it in session 37)

| category | nodes a user can place and cannot export |
|---|---|
| **Data** | 22 |
| **Utilities** | 16 |
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

### Tier 1 — an ordinary app hits these on day one

1. ✅ **The client-side data vocabulary (Data, 8).** `Object`, `Array Filter`, `Array Map` and
   `Clear Array` are **built, driven and gated in session 36 — §7**. The other four defer, each
   with a reason about a *mechanism* rather than about effort, and three of them are blocked by
   something other than themselves — §7.3.
2. ✅ **`HTTP Request`.** Any app that talks to anything that is not its own backend. **Built,
   driven and gated in session 37 — §8.**
3. **The date family (Utilities, 6).** `Now`, `Date To String`, `Date Add`, `Date Compare`,
   `Date Difference`, `Date Parts`. Anything with a timestamp needs at least two of these.
4. ✅ **`String` / `Number` / `Boolean` / `Color` (Variables, 4).** The plain value nodes. Cheap, and
   embarrassing to be missing. **Built, driven and gated in session 35 — §6.**

### Tier 2 — common, not universal

5. **Navigation (5).** `Page Inputs` is the important one — no path parameters means no detail
   pages. Then `Navigate To Path`, `External Link`, the component stack pair.
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
   commit — `export-ledger:picker` fails if it does not. *(51 → 55 → 59 → 60, sessions 35–37.)*
2. 🟡 **Tier 1 complete ⇒ 51 → ~72 of 127 (≈57%).** Tiers 1+2 ⇒ ≈87 (≈68%). Everything except the
   "not a target" list ⇒ ≈108 (≈85%). *(1.1, 1.2 and 1.4 done — 60 of 127; only 1.3, the date
   family, remains. ⚠️ Tier 1.1 yields 4 of its 8 nodes, not 8: the projection above counted node
   types, and four of these defer on mechanisms named in §7.3. So Tier 1 will finish nearer 66
   than 72, and the six date nodes are the whole of the difference left to find out about.)*
3. ✅ **Each slice has a picker-exercising project** that exports, builds and runs (§2).
   *(Tier 1.4's is `tests/fixtures/variable-dial` — §6.4; Tier 1.1's is
   `tests/fixtures/reading-shelf` — §7.4; Tier 1.2's is `tests/fixtures/quote-desk` — §8.6.)*
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

### §8.7 A gap this slice found and did not close

**A Variable written from an HTTP output renders nothing.** `typeOfSource` types the write as
`unknown` — correctly; `response` is whatever the server sent — and Pass 4 drops every read of a
variable that has no `string`-typed writer. So *fetch → Set Variable → show it*, which is the
first thing anyone would build, exports a blank element with a note.

This is not about HTTP: it blocks a Function output and an event payload in the same words, and
the fix is the same one — let a variable be `unknown`-typed and coerce at its render sinks, the
way `childText` now coerces an HTTP read. It is a slice of its own, named in the next-session
prompt. Within one page the direct binding works and is what Quote Desk does; only `Error`, which
`typeOfSource` now types (§7.5's case, extended), crosses into a Variable.
