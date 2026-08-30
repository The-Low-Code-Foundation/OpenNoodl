# EXP-011 — Close the picker gap, ranked by what apps need

**Status:** 🟡 In progress — **Tier 1 COMPLETE; Tier 2.7 COMPLETE** (the three pure utilities, session 65; the id pair, session 66). **75 of 127 (59.1%).** Tier 2's remainder is Cloud Services (9) and the component stack pair
**Depends on:** nothing — but sequenced after EXP-009 and EXP-010, which are worth more per hour
**Replaces:** every "what to build next" list in this phase from sessions 20–31

---

## §1 The gap, measured

```
node scripts/export-ledger/picker-coverage.js
```

> **PICKER COVERAGE: 73 of 127 placeable nodes export (57.5%)** — 2026-08-30, session 65
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
7. **String/Math utilities.** ✅ **`Substring`, `String Mapper` and `Number Remapper` built,
   driven and gated in session 65 — §36**, which also found DEF-033: `Substring`'s panel declares
   an `End` the node does not use. The remainder is the **id pair**, `Unique Id` and `UUID`, and
   §36.9 says why they are `Now`'s shape rather than another pure call.

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
   *(51 → 55 → 59 → 60 → 66 → 67 → 68, sessions 35–41; → 70 by session 47; → 73 in session 65.)*
2. ✅ **Tier 1 complete ⇒ 66 of 127 (52.0%).** Tiers 1+2 ⇒ ≈87 (≈68%). Everything except the
   "not a target" list ⇒ ≈108 (≈85%).
   *(The original projection said ~72. Session 37 revised it to "nearer 66 than 72", because
   Tier 1.1 yields 4 of its 8 nodes rather than 8 — and it landed on **exactly 66**. The revised
   number was right because it was derived from the deferrals actually taken rather than from
   counting node types, which is the difference between a projection and a wish.)*
3. ✅ **Each slice has a picker-exercising project** that exports, builds and runs (§2).
   *(Tier 1.4's is `tests/fixtures/variable-dial` — §6.4; Tier 1.1's is
   `tests/fixtures/reading-shelf` — §7.4; Tier 1.2's is `tests/fixtures/quote-desk` — §8.6;
   Tier 1.3's is `tests/fixtures/deadline-desk` — §9.5; Tier 2.7's is
   `tests/fixtures/ticket-desk` — §36.7.)*
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

- **`Open In New Tab`** — ~~that arm is `window.open`, whose success test is the transient user
  activation rather than the return value (DEF-016, §14.1)~~ 🔴 **false, and struck in session 46
  — see §17.1.** The activation test is `External Link`'s and exists only because that node sets
  `noopener`; this one sets no features string, so its own return-value test works. The
  blocked-tab `Error` row was right. ⚠️ **This port's default is `false` here and `true` there** —
  the two nodes look like a pair and their unset state lands on opposite sides.
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

- **`Open In New Tab`** — the window.open arm. ⚠️ ~~which wants DEF-016's activation read~~ —
  🔴 **struck in session 46: it wants the *return value*, which is what the runtime reads.** The
  activation read belongs to `External Link` and only because that node passes `noopener`; this
  one passes no features string. See §17.1. The blocked-tab `Error` row was right. **Built in
  session 46, §17.**
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

---

## §17 Tier 2.5 continued — `Open In New Tab`, and the second inherited sentence in two sessions (session 46, 2026-08-29)

**69 of 127 (54.3%)** — unchanged, because this is an increment on a node the ledger already
counts. §15.6 left it as "the top of the list", and the plan it left was wrong: the sentence
three ledger rows and two session prompts gave as the reason to defer asserted a runtime
behaviour this node does not have. §16 found the same failure one session earlier, in a
different node, from a different cause. This is its second instance, and this time the false
sentence was the *plan for the work* rather than an explanation of old work.

### §17.1 🔴 The inherited sentence was false, and the control is the node it was copied from

§15.4 deferred this arm saying its success "is read from the transient user activation rather
than from the return value (DEF-016, §14.1)". Every clause of that is true — of `External Link`.

The mechanism DEF-016 is about is `noopener`. `externallink.ts` builds a features string
(`openInNewTab ? 'noopener,noreferrer' : ''`) and passes it to `window.open`, and **`window.open`
returns null whenever `noopener` is set, by specification, on success as much as on failure** —
the runtime's own comment says so at `externallink.ts:69`. That is why that node cannot read its
return value and reads `navigator.userActivation` instead.

`navigate-to-path.ts:205` is `window.open(compiledUrl, '_blank')`. **No features string.** So its
own `if (!opened)` is a working blocked test, and the return value is what the export must read.

🔴 **Measured, not argued, because a reading that fits is not one that excludes.** Three arms in
Chrome 151, each under a real `Input.dispatchMouseEvent` gesture except where noted:

| arm | call | gesture | returned | tabs |
|---|---|---|---|---|
| **A** | `window.open(u, '_blank', 'noopener,noreferrer')` | real | **null** | 2 → **3** |
| **B** | `window.open(u, '_blank')` — this node's exact call | real | **a Window** | 1 → **2** |
| **C** | `window.open(u, '_blank')` | **none** | **null** | 1 → 1 |

Each arm has a job, and dropping any one of them loses the conclusion:

- **A is the known-firing control.** It reproduces DEF-016's mechanism *in this host*, so "that
  does not apply here" is a measurement rather than an assumption. Without it, B is consistent
  with "this browser never returns null" and the inherited sentence survives.
- **B is the subject** — the node's literal call, and it opened a tab while returning a Window.
- **C is the negative control, and it is the one that decides the slice.** B alone shows only
  that the return value is non-null on success. `!opened` is a *blocked* test: it has to go null
  when the open is refused. Without C the measurement covers false positives and says nothing
  about false negatives, which is the half that matters.

Predictions for all three were written down before the run and all three matched.

⚠️ **Copying the activation read across would have been worse than merely unfaithful.** The
activation is `false` after every successful open, because the call consumes it — that is §14.1,
measured one node over — so it is a proxy the runtime here has no need of. `externallink.ts`'s
own comment calls it "a strict improvement, not a total one" and names what it cannot see. This
node has the actual outcome available and reads it.

### §17.2 The arm is one call; what changed is everything beneath it

The call itself is a line. Three things underneath it are not, and all three follow from one
fact: **in tab this node cannot fail, and in a new tab it can.**

| | `Open In New Tab` off | on |
|---|---|---|
| the call | `navigate(url)` — react-router | `window.open(url, '_blank')` |
| `Failure` | dead; dropped with a note | **live** |
| `Error` | nothing can write it; the read defers | **earned by the read** |
| `Completed` | follows `Done`, flat | **a join beneath both arms** |

🔴 **`Completed` is the one that would have gone wrong silently.** §15.4 earned translating it
with a specific argument: it is refused on `External Link` because it fires after every outcome
and there are three there, while here "the gates leave exactly one outcome reachable, so
`Completed` is one arm to follow, not three to join beneath". Opening this arm makes two
reachable and **retires that argument**. The port still translates, but as a join printed after
the branch — emitted inside the `Done` arm it would run only on success, and no test written
before this slice looked at where it printed.

`Error` is simpler here than one node over: `External Link` needs a ternary because both of its
failures can be live at once, whereas the Path gate admits a literal non-empty path, so the
missing-path write is unreachable and **the blocked tab is the only failure there is**. One
static string, no re-test.

⚠️ **One wrong turn worth keeping.** The `error` wire was first *consumed* in the compile loop,
on the rule that nothing should be left silently unconsumed. That satisfied the rule and removed
the wire from Pass 4f, so the binding was never made: the sink rendered an empty element **with
no note anywhere** — a silent blank that reads exactly like a message that happened to be
undefined. A value read is the render sweep's to make, which is what `External Link` does and
what the shape of the sweep already said.

### §17.3 🔴 Three walkers did not know this action carries chains, and one of them was already wrong

§11.6 and §15.5 warn that a new `HandlerAction` **kind** must be carried by hand to six places
and that `tsc` finds only two. This slice adds a **new chain to an existing kind**, which is the
same hazard with less to see: nothing at all changes shape, so nothing at all complains.

Walking every consumer of `navigate-path` rather than the ones this slice touched found three
that were already blind — and one of them was a live defect, present since §15 shipped:

| walker | what it decides | state before this slice |
|---|---|---|
| `collectActionUse` (`component.ts`) | which rows, variables and imports are *referenced* | 🔴 **no case at all — a live defect** |
| `fillMaterialize` (`plan.ts`) | wires a written row to its writer; no `default`, so a missing kind is not descended into either | no case at all |
| `actionExprsOf` (`component.ts`) | `usesPayload` — whether a receiver's callback takes `(payload)` | chains not walked, unlike every sibling |

🔴 **`collectActionUse` had no case for this action, so a Variable read *only* by a path
parameter was never counted as a reference — and the emitted component called `.get()` on an
identifier it never declared.** Measured with a control pair varying exactly one thing, whether
anything *else* in the component also reads the variable:

| arm | one thing varied | import | `useValue` hook | the handler's call |
|---|---|---|---|---|
| subject | nothing else reads it | **absent** | **absent** | `probeVar.get()` |
| control | a Text bound to the same variable | present | present | `probeVar.get()` |

The defect is the omission, not something about variables — which is what the control buys, and
without it the subject reads equally well as "a variable used this way needs no declaration".

⚠️ **Every fixture that reached this code happened to render the value somewhere too**, which is
why 845 tests and four drives never saw it. `expectParses` cannot: an undeclared identifier is
valid syntax. This is the same sentence `collectActionUse`'s own Tier 1.2 comment has carried
since the async chains were added — *"the chains were not walked here at all"* — arriving on a
third action.

⚠️ **`actionExprsOf` is fixed on consistency, not on a measurement, and that is stated in the
code.** A firing case needs a payload read inside this action's chain *inside an Event Receiver*,
and the receiver deferred before one could be built (the payload port needs a registered channel
that an `Event Sender` declares). The hole is real in shape — every sibling walks its chains
because nothing else flattens for `usesPayload` — and this session could not make it fire. It is
recorded that way rather than counted as a defect closed.

### §17.4 What defers, and the one that changed its reason rather than its answer

| refusal | the mechanism |
|---|---|
| **a wired `Open In New Tab`** | 🔴 **scope, not mechanism** — a wire makes both of the node's actions reachable in one handler, so the emitted code needs `pushState` and `window.open` under a runtime branch with two different outcome sets beneath them. ⚠️ Unlike `External Link`'s identically-named port, the runtime reads this one **once**, as `!!value` — so the value is perfectly answerable and the deferral is about the slice, not the node |
| a wired or absent `Path` | unchanged — the braced segments are what mint the ports |
| an in-tab `Error` read | unchanged in answer, sharper in reason: the Path gate excludes the missing-path write and there is no tab to block |
| a `p-`/`q-` logic truth value | unchanged, on the standing rule |

⚠️ **The wired-port refusal is the one to watch.** It replaced a sentence that was false, and the
replacement makes a factual claim of its own — that the runtime reads the port once. That claim
is pinned by a test naming both runtime files (§16.5's rule), alongside two more pinning the
call shape and the return-value test, each with `externallink.ts` as the control that must
disagree.

### §17.5 What proves it

**57 tests** in `tests/navigate-to-path.test.ts` (was 37), **862 across the package** (was 845),
and **twelve mutants killed, every arm with a row count**:

| mutant | rows killed |
|---|---|
| the activation read copied across — the inherited sentence, as code | **1** |
| `noopener` added, as `External Link` does | **4** |
| `Completed` emitted inside the `Done` arm instead of beneath the branch | **1** |
| the `Failure` chain still dropped when the new-tab arm is on | **1** |
| `newTab` read with `External Link`'s default (`!== false`) | **23** |
| `collectActionUse`'s case deleted — the measured defect restored | **2** |
| the `Error` wire consumed at compile — the silent-blank turn | **1** |
| Pass 4f's admission clause dropped | **1** |
| `fillMaterialize`'s case deleted | **1** |
| the blocked message replaced by the missing-path one | **2** |
| `deepActions` blind to the `Failure` chain | **1** |
| `navigatePathIsStatement` blind to the new-tab arm | **1** |

🔴 **Two mutants killed nothing on the first pass, and both failures were in the measurement.**

**One — `deepActions` blind to the new chain moved no row**, which is §15.5's own `deepActions`
mutant repeating: the sweeps that walk it mostly ask questions the *outer* action already
answers, and `usesNavigate` is true because this node is itself a navigation whichever chains
are descended into. A **state row** tells the difference — an `HTTP Request` in the `Failure`
chain owns an `errorState` the emitted `catch` names, and without the walk the declaration
filter drops the row and the handler references an identifier that was never declared. That is
now the row.

**Two — `navigatePathIsStatement` blind to the new-tab arm moved no row, and the reason was a
fixture habit.** Every case in the file fires the node from the Cheer fixture's Add button,
which *already has an action* — two actions take the `{ a; b; }` block form and parse whatever
this predicate answers. Only a node that is the **whole** handler reaches an arrow's expression
body, where `() => const goOpened = …` does not parse. ⚠️ **§15's `date-now-read` note says the
same sentence about the same fixture**, so this is the second time the same habit hid the same
class of bug from a test — the seventh instance of this file's oldest hazard.

🔴 **A third failure was in the harness rather than in a mutant.** The first mutation run hit the
120-second tool timeout and was killed mid-mutation, leaving `plan.ts` on M5 in the working tree.
`tsc` was still green — the mutant compiles, that is the point of it — so nothing announced the
state. Re-running in the background then reported *completed* for the `nohup` wrapper while the
Python was still working, and the empty log read exactly like a finished run with no output.
**Both readings were checked against `diff` before anything else was believed**, and the tree was
restored from a snapshot taken before the first mutation.

**The project, built and driven.** `note-desk` again, with the new-tab node added **through the
MCP server** (§2's rule) — a button, a `Done` chain, a `Completed` chain and an `Error` read.
`npm run build` exits 0. The emitted handler is the whole slice in seven lines, and the
`External Link` nodes a few lines above it carry `'noopener,noreferrer'` and the activation read
— the control stated as code, in one file:

```tsx
const tabGoOpened = window.open('/note/5', '_blank');
if (tabGoOpened) {
  tabTrail.set(tabTrailSeed.get());
} else {
  setTabGoError('The browser blocked opening a new tab');
}
tabCompleted.set(tabTrailSeed.get());          // ← after the branch, not inside the arm
```

**3 of 3 drive rows matched what was written down before the app ran**, no console errors:

| row | measured |
|---|---|
| D1 on load | error text **empty** |
| D2 clicked under a real gesture | error text **stays empty**, tabs 2 → **3** |
| D3 clicked with no gesture | **"The browser blocked opening a new tab"**, tabs unchanged |

🔴 **D2 and D3 are the pair, and they have to disagree.** Either alone exercises one arm of the
emitted `if` and reads as a pass while the other arm is never run. ⚠️ D2 runs **first** because
the row is never cleared (§14.5's ordering rule) — after a failure the text is occupied and a
later success proves nothing.

Sabotage, one rule varied, predicted before running:

| arm | change | rows that moved |
|---|---|---|
| A | `'noopener,noreferrer'` added — what copying `External Link` across would have done | **D2 only** — "The browser blocked opening a new tab" **beside a tab that opened** (2 → 3) |

🔴 **Arm A is the whole session in one row.** The inherited sentence did not merely describe this
node wrongly; the code it prescribed reintroduces DEF-016 here — a `Failure` chain and an error
message on every tab the app successfully opens. D3 did not move, because it was already blocked
and already showing that text, which is why the arm needed D2 to be a row at all.

### §17.6 What this leaves

- **A wired `Open In New Tab`** — the branch with both actions under it, now deferred on a reason
  that is about this slice rather than about the node. It is the natural next increment and it is
  no longer blocked on a question about the runtime.
- **A chain-local for `Error`** — unchanged from §14.6, and now owed by two nodes rather than one:
  a read from inside either node's own outcome chains still defers on §8.2.
- **`actionExprsOf`'s `usesPayload` walk (§17.3)** — closed in shape, unproven in fact. A firing
  case needs an `Event Sender` declaring a channel payload; whoever builds one should check it.
- **The component stack pair** — Tier 3, behind `Page Stack`, exactly as §16 left them.

## §18 Tier 2.5 continued — the wired `Open In New Tab`, and a correction that outlived the session that made it (session 47, 2026-08-29)

**69 of 127 (54.3%)** — unchanged, and deliberately so. This is the third increment on a node the
ledger already counts, and `Open In New Tab` now translates in **all three** of its states: off
(`navigate`), on (`window.open`), and **wired** (both, under a runtime branch).

§17.4 deferred this by **scope rather than by mechanism**, and that distinction turned out to be
the whole of the work: nothing had to be learned about the runtime, only built.

### §18.1 🔴 The sentence §17 killed was still in the file, in the function it was about

§17.1 is the most-cited paragraph in this document: §15.4's deferral asserted that this node's
success "is read from the transient user activation rather than from the return value", the
sentence was inherited from `External Link`, and it was false. §17 rewrote the deferral string,
rewrote the ledger row, added a long refutation at the `newTab` constant and pinned three tests
against both runtime files.

**And the sentence was still there.** `compileNavigateToPath`'s own header comment — twenty lines
above the block refuting it — still opened its list of refusals with:

> `Open In New Tab` defers — that arm is `window.open`, whose success test is the transient user
> activation and not the return value (DEF-016, §14.1) […] That is `External Link`'s slice.

It survived the session that killed it, in the same function, and it would have been the first
thing the next reader of that function read.

🔴 **A correction has to be applied to every place the claim was written, and the grep for that is
the claim, not the code that returned it.** §17 corrected everything that *returned* the wrong
answer — the deferral string, the ledger note — and nothing that merely *said* it. One
`grep -rna "transient user activation"` over the package and the runtime found it in seconds;
that grep was never run, because the fix felt complete when the behaviour was right.

⚠️ **The header also said "Four refusals" and there are now three**, so the count had to move too
— a stale list is a claim about how many things are true, not only about what they are.

### §18.2 The branch is the runtime's own; what is hoisted out from under it is the work

The emitted shape is `navigate-to-path.ts:204` line for line, with the outcomes lifted out:

```tsx
let wireGoOpened = true;
if (typedId.get()) {
  wireGoOpened = window.open('/note/9', '_blank') !== null;
} else {
  navigate('/note/9');
}
if (wireGoOpened) { …Done } else { setWireGoError('The browser blocked opening a new tab'); …Failure }
wireCompleted.set(…);            // ← after the branch, as §17 established
```

Four decisions, and each is a claim rather than a formatting choice:

| | why it is not tidiness |
|---|---|
| **`let … = true`** | 🔴 the initialiser **is** the same-tab arm's outcome. `pushState` cannot fail and the Path gate already excluded this node's *other* failure by admitting only a literal non-empty path, so in tab there is exactly one outcome and it is `Done`. Initialised `false`, every same-tab navigation runs the Failure chain |
| **the outcome branch is hoisted, not copied per arm** | `Done` runs after *either* call succeeds. A copy per arm sends the graph's one signal twice, and then owes `Completed` a third copy |
| **the url is built once, above the branch** | the runtime builds `compiledUrl` before it looks at the flag; an omittable query is a `for` loop with side effects, and a `const` declared inside one arm cannot be read from the other |
| **`!== null` rather than the bare `Window`** | two arms assign this local, so it is a boolean in both or the emitted `let` is `Window \| null \| boolean` |

🔴 **`newTab` in the IR now means "the new-tab arm is reachable", not "the port is on".** Every
consumer already asked it that question — is `Failure` live, is `Error` writable, is `Completed` a
join — and a wired port answers all of them the way an authored `true` does, because the tab can
still be refused. Making it mean the other thing costs **14 test rows**, which is the largest
single mutant in this file.

⚠️ **The port is a truthiness sink, so a logic truth value lands here** where a `p-`/`q-` value
still defers. The runtime coerces it once with `!!` and the emitted read is the `if` test itself.
The `p-` control is what makes that a claim about *sinks* rather than a hole in the standing rule.

### §18.3 🔴 A new *field* on an action owes the same six walkers a new *kind* does

§11.6 is about a new `HandlerAction` kind carried by hand to six places; §17.3 is about a new
*chain* on an existing kind, where nothing changes shape. This is a new **expression** on an
existing kind, which is the same hazard again — and `tsc` finds none of it, because an optional
field is optional everywhere.

| walker | what it decides | proven? |
|---|---|---|
| `collectActionUse` | which variables are *referenced*, and so which are imported | ✅ **killed a row** — §17.3's measured defect, on a new field |
| `navigatePathIsStatement` | block body vs arrow expression body | ✅ killed a row |
| the wire's `consumes.push` | whether Pass 4f reports it as untranslated | ✅ killed a row, **once a test was written for it** |
| `exprValidIn` | whether the expression is legal in this handler's scope | ⚠️ **killed nothing** |
| `actionExprsOf` | `usesPayload` — does the receiver callback take `(payload)` | ⚠️ **killed nothing** |
| `chainReadsNowLocal` | whether a `Now`'s `const … = new Date()` is emitted | ⚠️ **killed nothing — and the reason is a finding** |

🔴 **`chainReadsNowLocal`'s firing case exists, was built, and this exporter refuses it.** A
`Navigate To Path` inside a `Now`'s Done chain whose wired `Open In New Tab` reads that same Now
is reported **"its trigger chain is cyclic"**, and both wires are dropped.

**The control is what makes that a finding rather than an excuse.** The identical shape with a
`Set Variable` in place of this node — same Now, same Done chain, same value wire back from the
Now — translates and emits `const clockRead = new Date();`. So the refusal is about **this node**,
not about the graph, and the cycle detector and `resolveExpr` disagree here in a way no sibling
action reproduces. That is **unowned** and is recorded in the code at the line it defends.

⚠️ Without the control, "cyclic" reads as a fact about the graph and the walker looks unprovable.
It is the second time this session that a reading which *fit* was not one that *excluded*.

### §18.4 What defers now

| refusal | the mechanism |
|---|---|
| a wired or absent `Path` | unchanged — the braced segments are what mint the ports |
| an `Error` read where **no** tab can open | sharper than §17's: the gate now asks "can this open a tab", which a wired port answers yes to whatever it delivers |
| a wired `Open In New Tab` with no statically known source | the standing rule for every port — the source, not the port |
| a `p-`/`q-` logic truth value | unchanged. ⚠️ **Not** `Open In New Tab`, which is a truthiness sink |

**`Open In New Tab` itself no longer appears in this table in any state.**

### §18.5 What proves it

**74 tests** in `tests/navigate-to-path.test.ts` (was 57), **881 across the package** (was 864),
`tsc --noEmit` clean, both ledger gates green, `nodegx-module-inject` 31/31.

**Fourteen mutants, eleven killed:**

| mutant | rows |
|---|---|
| `newTab` reads "the port is on" rather than "a tab can open" | **14** |
| `collectActionUse` blind to the wired expression | 1 |
| `navigatePathIsStatement` blind to the wired form | 1 |
| the success flag starts `false` | 1 |
| the flag binds the raw `Window` rather than a boolean | 1 |
| the Error gate asks "is the port on" | 1 |
| the Failure drop asks "is the port on" | 1 |
| the two arms swapped | 1 |
| the wire left unconsumed | **0 → 1** (see below) |
| the Failure chain not compiled for a wired port | 1 |
| `exprValidIn` blind to the wired expression | **0** |
| `actionExprsOf` blind to the wired expression | **0** |
| the `reads()` sweep blind to the wired expression | **0** — §18.3 |

🔴 **One mutant killing nothing was a hole in the tests and was closed.** Removing the wire's
`consumes.push` left the app emitting perfectly *and* Pass 4f reporting the wire as untranslated —
a note that is simply false, and the kind a reader trusts. Nothing in the suite looked at the
notes for a *translated* wire. There is now a row, with the unresolvable case as its control.

⚠️ **A third failure was in the harness, before any mutant ran.** The first mutation pass reported
`killed=None` for all thirteen — the runner searched jest's `--json` output for a key that is not
first in the object, so every parse failed and the failure looked exactly like "this mutant killed
nothing". **Thirteen zeros that meant nothing.** The tree was checked by `diff` against a
snapshot after each run, never by the log or the exit code.

**The project, built and driven.** `note-desk` again, the wired node added **through the MCP
server** (§2's rule). `Open In New Tab` is wired from the `typedId` variable that the id box
writes, so *the text box chooses which arm runs*. `npm run build` exits 0; the emitted handler
matched the shape written down before emitting, line for line.

**4 of 4 drive rows matched the predictions, no console errors:**

| row | measured |
|---|---|
| D1 on load | error **empty**, url `/home` |
| D2 box `x`, real gesture | error **stays empty**, tabs 2 → **3**, url unchanged |
| D3 box `x`, **no** gesture | **"The browser blocked opening a new tab"**, no new tab |
| D4 **box empty**, real gesture | url → **`/note/9`**, no new tab |

🔴 **D2 and D4 are the pair, and they are the control on the *wire*.** Same button, same node,
two different actions — and the only thing varied is the contents of a text box. Without the wire
D4's arm is unreachable, and a suite that only ever measured the new-tab arm passes on an emitter
that ignored the wire entirely. D2 and D3 remain the pair for the new-tab arm itself.

Sabotage, one rule varied, predicted before running:

| arm | change | rows that moved |
|---|---|---|
| A | `'noopener,noreferrer'` added to the **wired** call | **D2 only** — "The browser blocked opening a new tab" **beside a tab that opened** (2 → 3) |

🔴 **D3 and D4 *not* moving were predictions, not gaps.** D3 was already blocked and already
showing that text; D4 is the same-tab arm and has no features string to poison. An arm that moved
every row would be measuring the page, not the rule.

### §18.6 What this leaves

- **A chain-local for `Error`** — unchanged from §14.6 and §17.6, still owed by two nodes.
- **`exprValidIn` and `actionExprsOf` on this action** — closed in shape, unproven in fact, for
  the reason §17.3 gave: the firing case needs an `Event Sender` declaring a channel payload.
- 🔴 **The cycle refusal §18.3 measured** — a value wire back from a `Now` into this node is
  called cyclic where the same wire into a `Set Variable` is not. **Unowned.** It is a fact about
  `Navigate To Path`'s resolution, not about the graph, and the control proving that is in the
  code comment at `component.ts`'s `reads()` sweep.
- 🔴 **Whether "a correction must be grepped for by its claim" becomes a rule** — §16.5 asked
  whether an exemption citing a runtime file must have a test naming it, and §17 gave that two
  instances. §18.1 is a third and a different shape: the claim was corrected everywhere it was
  *returned* and nowhere it was merely *said*. Still unowned.

## §19 The report the markers pointed at, and a defect fixed in the editor rather than reported (session 48, 2026-08-29)

**69 of 127 (54.3%)** — unchanged, and nothing on the picker moved. This session did the two
things at the top of §18's list, and neither is a node: the dead `Success` port §8.5 found in
`httpnode.ts`, and **EXP-004's export report**, which two generated `TODO(export)` markers have
pointed at by name since EXP-002 without it existing.

### §19.1 🔴 §18.1's rule, applied before the fix rather than after it — and it found three more

§18.1 is the lesson that a correction has to be grepped for **by its claim, not by the code that
returned it**. §8.5's fix is one deleted `ports.push` in `updatePorts`, and the fix on its own
would have left four statements of the old fact standing. `grep -rn "still publishes"` and a walk
of the claim found them:

| place | what it said | now |
|---|---|---|
| `httpnode.ts` `updatePorts` | drew `Success` beside `Done` | **deleted**, with the rule in its place |
| `plan.ts`'s `success` arm | *"a stale port name the editor **still draws**"* | rewritten — **the arm stays** |
| `http-request.test.ts` | asserted that sentence | asserts the new one |
| `PROGRESS.md` §8.5 | *"`updatePorts` **still publishes**"* | past tense, and names the fix |

🔴 **The export's arm is not dead code and deleting the port is not deleting the wires.** A project
authored before this fix still has the `success` connection saved in its `nodes.json`, and the
export reads what is on disk. That arm is the only thing between such a project and a wire the
export would otherwise report as untranslated. What *changed* is the tense of every sentence
around it — which is the whole finding, because the code was already right.

⚠️ **The editor's half of the same statement already existed.** `evaluateConnectionHealth` raises
`con-no-source-port` — *"Source port doesn't exist."*, `level: 'error'`, shown globally — so an
author with a `Success` wire now sees a red error where they previously saw a wire that ran
nothing. That is the migration answer: the port was **never fired under either name**, so nothing
that worked stops working, and the one thing that changes is that the author can see it.

**The catalog was right all along**, which is why the export could report this rather than
reproduce it: `node-catalog.json` lists the static declaration (`done`/`unchanged`/`failure`/
`completed`, no `success`), and only the *running* editor concatenated the stale dynamic list over
it. A defect visible from exactly one of the three surfaces that describe this node.

**The test is a rule, not a row.** `test/nodes/http-outcome-ports.test.ts` (6 rows) asserts that
**every signal output `updatePorts` publishes is one the node type declares** — because
`reportOutcome` gates on `hasOutput`, that set *is* "what this node can fire". A row naming
`success` would pass the next time a stale name is copied in. ⚠️ Its population is asserted
non-empty first: a subject set of zero passes on a publish that carries no outputs at all.

### §19.2 EXP-004 — the report, and the three framing rules that are the actual work

`EXPORT-REPORT.md` is now written into every exported app, from a structured channel built beside
`notes` in `emitApp`. The prose is the deliverable, and EXP-004 names what it has to do:

- **Lead with what worked.** Counts, then the components that came out whole, then what is
  missing. A project with nothing to report says **"Nothing."** rather than printing an empty
  heading — a case no fixture produces, which is why `renderReport` is pure and driven directly.
- **Be specific, not statistical.** No percentage and no confidence score. Every line is a named
  component, a named node or wire, and the exporter's own sentence for refusing it.
- **Never let unverified code look verified.** ⚠️ The honest statement today is *narrower* than
  EXP-004 anticipated — EXP-003's trace verification does not exist, so nothing has been run,
  replayed or compared. The report says exactly that, and the test **counts** the uses of the word
  "verified" rather than asserting its absence, because the page has to carry one sentence
  denying it.

🔴 **Grouping is by what the caller already knew, never by reading the prose back.** Scope is a
fact at the push site (`plan` is in hand); `skipKind` — two assignments in `plan.ts` — is what
tells the router shell, which the scaffold *emits*, from a logic-only component, which nothing
emits. Both arrive as one sentence prefixed with a component path, and told apart by matching
words they would swap sides the day either was reworded.

⚠️ **No timestamp, and that is not an oversight.** The generators are byte-stable by design; a
date line would break every golden in the package and turn "nothing changed" into noise.

### §19.3 🔴 Two predicates wearing one name, and it printed a false sentence about working code

The report's data-access line was keyed on **"were any api files emitted"**. `quote-desk` emits
`src/api/http.ts` — a real, generated `fetch` for an `HTTP Request` — and declares no backend. So
the report told its author, in the app they had just exported:

> **Data access** in `src/api/`, emitted as **stubs**: reads answer empty and writes throw. The
> project declares no backend…

Every word of which is false about `http.ts`. `apiModules` had **already computed** the right
predicate — `byCollection.size > 0 || hasSessionCalls`, "does this project ask anything of a
*backend*" — and used it for its own note; the report re-derived a different one from the file
list and got a question nobody had asked answered.

🔴 **The reading fit and did not exclude.** The bullet rendered, it was grammatical, and on five of
seven fixtures it was even right. It is now returned from `apiModules` rather than re-derived, and
`src/api/http.ts` has its own line saying what it actually is. The rows are a control pair: same
sentence generator, opposite answers, and the only thing varied is whether the project asks
anything of a backend.

### §19.4 🔴 Two green checkers whose populations had quietly grown

Adding one Markdown file to the output reddened two suites, and neither was a defect in the
report:

- **`logic.test.ts`** sweeps every emitted file for backticks, meaning *"no template literals"*. A
  backtick in TypeScript is a template literal; in Markdown it is a code span. The sweep already
  carried `README.md` as a **named** exemption — so the population had grown before, and been
  patched by name. It now excludes `.md` **by kind**, which is the population it always meant.
- **`missing-interface.test.ts`** asserted a refusal touches *"the two files it names and nothing
  else"*. The report is a third file, and it moving is **the point of it** — a new refusal that
  left the report unchanged would ship an app whose report did not describe it. The code claim is
  kept, unweakened, as its own line.

### §19.5 🔴 The report nearly overstated itself, in the file whose job is not to

The honesty section closed with what read as a promise:

> Every marker names the node it stands in for, so a line here and a marker there are the two ends
> of the same fact.

Which says *every line has a marker*. It does not. **`puppy-test-3`'s emitted code carries no
`TODO(export)` at all** while its report lists nine refusals — because a marker goes where an
element could not be generated, and a wire dropped from an element that still renders leaves that
element in place, looking right and doing nothing. PROGRESS.md's "what a gap looks like" section
has said so since session 21 and is **still true**; EXP-004's in-code-marker half is not built.

⚠️ **The failure this would have caused is the specific one this task exists to prevent**: a
reader greps, finds nothing, and reads that as an all-clear — from the one document they were told
to trust. The report now names itself as the complete list and the markers as a shortcut, and the
row asserting it is written as the pair it is: **the markers are absent *and* the report says so.**
Asserting only the wording would pass on the day markers arrive and the sentence went stale.

🔴 It was found by grepping the emitted output for the string the report tells the reader to grep
for. Nothing in the suite would have caught it, because prose that overstates is still prose.

### §19.6 A defect in the one shipped entry point, which no test drives

`scripts/emit-app.ts` wrote `files` and **dropped `copies` on the floor** — the `noodl_modules`
assets that travel byte-for-byte (EXP-010 AC5): a kit's script, an icon set's `.woff2`, Inter's
four `.ttf`. They are a separate channel precisely because a font is not a string.

⚠️ **This is the defect `kits.ts` closed, reintroduced one layer up**, in the words of its own
copy sites: *"a file the author wrote, silently absent from their exported repo."* Every gate
stayed green throughout, because no test drives this script. Driven by hand on the `kits` fixture:
17 files and **12 copied assets**, and `dots.woff2` md5-identical to its source.

### §19.7 What proves it

**911 tests** across the package (was 881) in **39 suites** (was 38) — `tests/export-report.test.ts`
is 30 of them. `tsc --noEmit` clean, `nodegx-module-inject` 31/31, both ledger gates green
(`69/127`; 175 types). `noodl-runtime`: **2564 passed, 13 skipped, 144 suites**, including the new
`http-outcome-ports.test.ts`.

**Twelve mutants, ten killed on the first pass, and the harness was checked before the zeros were
believed** — the runner reads jest's **summary line and exit code**, never a `--json` key (§18.5's
thirteen meaningless zeros), and restores the tree from a snapshot and byte-compares it after
every mutant, so a mutant that failed to *apply* cannot read as one that killed nothing. Baseline
and post-run tree both green.

| mutant | rows |
|---|---|
| the report file is not emitted at all | **20** |
| the per-component note list is truncated | 5 |
| attention printed before what worked | 2 |
| unreachable components never flagged | 2 |
| the stub sentence keyed on any api file (§19.3) | 1 |
| `stripScope` trims up to the first colon, whatever it belongs to | 1 |
| the report left out of its own file count | 1 |
| the router shell not marked `scaffolded` (§19.2) | 1 |
| the report carries a timestamp | 1 |
| a project with no gaps prints an empty heading | 1 |
| **kit load failures never reach the report** | **0 → 1** |
| **the honesty section's heading is renamed** | **0 → 1** |

🔴 **One survivor was a real hole.** `modules: []` — every kit load failure silently absent from
the report — passed all 910. `renderReport` was driven on *synthetic* module data, and the
per-component rows walk `report.components`, which module failures are not in; **nothing crossed
the one wiring that carries them.** There is now a row on the `kits` fixture, whose four failing
modules are the population that makes it checkable.

⚠️ **The other survivor was weak, and is recorded as weak.** Renaming the honesty section's
heading survived *honestly*: every sentence the rows assert was still on the page, so nothing the
tests claimed had stopped being true. A row was added anyway — it closes a gap in **legibility**,
not in a claim — and saying which of the two it is, is the point. A survivor is a finding about
the tests only until a control shows otherwise.

### §19.8 What this leaves

- 🔴 **EXP-004's editor half is untouched, and it is the larger half.** The pre-flight estimate
  (*before* exporting, so the user chooses with accurate expectations) and the in-editor
  post-export report with drill-down are both editor surfaces, and nothing here builds either.
  What is done is the copy that travels with the code — the one the markers name.
- 🔴 **EXP-004's in-code markers are also not built**, and §19.5 is the measurement: a deferred
  wire on an element that still renders leaves nothing in the file. The report now says so rather
  than implying otherwise, which makes this a *stated* gap rather than a silent one — but it is
  the next piece of EXP-004 worth building, and it is where "the original node source preserved
  in a comment" belongs.
- **A chain-local for `Error`** — unchanged from §14.6, §17.6 and §18.6, still owed by two nodes.
- **`exprValidIn` and `actionExprsOf` on `Navigate To Path`** — still closed in shape and unproven
  in fact; still needs an `Event Sender` declaring a channel payload.
- 🔴 **The cycle refusal §18.3 measured** — still **unowned**, still a fact about that node rather
  than about the graph.
- ⚠️ **A second copy of the HTTP node's `error` port, drifted.** `updatePorts` republishes `error`
  with `group: 'Events'` while the node's static declaration says `group: 'Error'`, and
  `replaceOrAppendPorts` makes the dynamic one win — so the editor files that port under a group
  the node did not ask for. Cosmetic, measured, **not fixed**: moving a port between groups in the
  property panel is a ruling, not a cleanup. **Unowned.**
- 🔴 **Whether "a correction must be grepped for by its claim" becomes a rule** — §18.6 left this
  unowned and §19.1 is the first session to *apply* it prospectively, where it found three
  statements a behaviour-only fix would have left standing. Still unowned as a rule.

## §20 The markers §19.5 measured, and the layer they were nearly built at (session 49, 2026-08-29)

**69 of 127 (54.3%)** — unchanged, and nothing on the picker moved. This session built EXP-004's
in-code-marker half: the thing §19.5 measured, named as a *stated* gap, and left.

### §20.1 🔴 The first implementation was complete, correct, and fired on almost nothing

The marker channel went in where the refusals visibly are — `component.ts`, sixteen `notes.push`
sites that drop a wire from an element which still renders. Every site got a structured `defer`
beside its note, the flush points went into `renderChildBlocks` and above the `return`, `tsc` was
clean and **911/911 stayed green**.

🔴 **Green was the warning.** If markers were landing, the row asserting `puppy-test-3` emits
**no** `TODO(export)` had to redden — it is written to detect exactly that — and it did not. A
direct probe over the corpus said why: **the sixteen sites fire on nothing the corpus contains.**

The refusals an author actually meets are recorded a layer earlier. `plan.ts` refuses the wire
*before* emit sees it, so no binding is ever created, so `contentAttrs` is never called with one
and never files a note. The emit-layer population is real and rare; the plan-layer population is
the report.

⚠️ **The instrumented layer was chosen from where the note-pushing code was, not from where the
corpus's refusals were.** Grepping `notes.push` in the emitter answers "where does the emitter
report a drop", and the question was "where does *this project's* drop get decided" — a checker's
population is part of the checker, and this one was a 3,900-line file when the answer lived in a
9,635-line one.

### §20.2 The chokepoint that made the plan layer affordable

61 sites in `plan.ts` file a dropped wire, and all 61 write the same sentence shape:
`` `wire ${c.key} dropped: <reason>` ``. That is a **pure expression** — so `wireNote(c, …)`
substitutes for the template wherever it appears, including inside a ternary, and returns the
identical string:

```ts
const wireNote = (connection: ConnectionIR, reason: string): string => {
  droppedWires.push({ key: connection.key, fromId: …, toId: …, label: connection.label, reason });
  return `wire ${connection.key} dropped: ${reason}`;
};
```

**58 of the 61 converted mechanically**; the three left over are a different sentence (`wire X:` —
a boot-value read, which is not a defect and must not be marked) or live in `planProject`.

🔴 **The control was already written.** Three dozen suites assert on note wording, so a rewrite
that changed one sentence by one byte could not stay green. It went red exactly once — the
converter rewrote `wireNote`'s **own return statement** into a call to itself, and 229 tests
failed on `Maximum call stack size exceeded`. A mechanical edit over a file that contains its own
output shape will match its own definition; the suite caught it in one run.

### §20.3 🔴 Both ends of a dropped wire can be the one that renders

A wire *into* a rendered node leaves that node showing a stale value — the sink is where a reader
looks, and `listText` is the case: `<p className={styles.listText} />`, empty, because
`formatList` registers no output named `text`.

A wire *out of* one is the more visible failure and has no marker at the sink at all, because the
sink is a logic node that emits nothing. `deleteBtn:onClick` feeds a Record verb naming no class:
**the button renders, looks live, and does nothing when clicked.** A pass that marked only sinks
would miss it.

So: the sink when it renders, else the source when it renders. A wire between two logic nodes has
no element to mark — **which is why the report stays the complete list, and why the honesty
paragraph could not simply be deleted.**

### §20.4 Where a marker may not go, which is most of the design

- **Not inside `renderCore`.** It also returns the body of `{cond && ( … )}` and the whole of
  `return ( … )`, and both hold exactly one JSX expression. A comment prepended there is a second
  one and does not parse. The marker is placed by `renderChildBlocks`, the only caller that puts a
  node among siblings — and *after* the child renders, because the child's deferrals are pushed
  during its own render.
- **The root is marked with `//` lines above the `return`**, for the same reason.
- 🔴 **A port name is author content and a marker is a block comment.** A comment terminator inside
  one ends it early and the remainder becomes code. `commentSafe` breaks the sequence; no fixture
  produces one and the corpus never will, which is exactly why it is a row rather than a comment.

### §20.5 🔴 The guard against the failure this task is about

A marker is recorded against a node id and flushed where that node's element is placed. A node
whose element some *other* path emits would record a marker nothing ever wrote out — the report
would list the refusal, the recommended grep would find nothing, and the suite would stay green.
**That is §19.5's shape, one layer down.**

So the invariant is asserted directly over every fixture: a refusal on a node that renders reaches
the emitted code. It is paired with a row proving the population is not empty, because a sweep over
nothing passes on an emitter that writes no markers at all.

### §20.6 What proves it

**927 tests** across the package (was 911) in **40 suites** (was 39) — `tests/in-code-markers.test.ts`
is 16 of them. `tsc --noEmit` clean, `nodegx-module-inject` 31/31, both ledger gates green
(`69/127`; 175 types).

**Six mutants, three killed, and the two survivors are one fact rather than two holes:**

| mutant | rows |
|---|---|
| `commentSafe` is the identity | 1 |
| only the sink end of a wire is marked | 3 |
| losses on one node are not grouped | 1 |
| the explicit root call is removed | **0** |
| the leftover sweep is removed | **0** |
| **both root paths removed together** | **1** |

⚠️ **The two zeros are redundancy, not absence of a test.** They are two entry points to one
mechanism: drop the explicit root call and the root stops being flushed, so the leftover sweep
collects it instead. Removing **both** reddens the row. The explicit call is kept for what it says
and for putting the root's losses first.

⚠️ **The leftover sweep's distinctive population is empty today, and that is recorded rather than
claimed shut.** Every node now carrying a marker is either the root or somewhere in the render
tree. It stays load-bearing for a shape the corpus does not hold — a roled node no parent places,
or a future path like `popupJsx`, which builds its element without going through
`renderChildBlocks` — and the `it.each` invariant is what would redden if one appeared.

### §20.7 The two documents that had to move with the code

🔴 **The report's own paragraph was true and is now false in its second clause.** It said a wire
dropped from an element that still renders "leaves that element in place, looking right and doing
nothing" — which was the measurement, and is now the thing that got fixed. Rewritten to the
narrow claim that survives: a marker needs an element to sit on, a logic-to-logic refusal has
none, **the report is still the complete list**. Saying "every" here would be §19.5's error one
iteration later.

**The row that pinned it is still the pair it was, with the sides swapped** — markers present,
wording present, and now a third assertion that the subset is **proper** (more reported refusals
than marked nodes). If those ever came level, "the complete list" would have stopped meaning
anything.

⚠️ **One existing row was narrowed, not deleted.** `untyped-store-key` asserted the emitted file
does not contain `nosuchkey`; the marker now prints the refused port by name, which is what it is
for. Comments are stripped and the claim is made against the **code**, so what it always meant —
no invented `s.nosuchkey` read reaches the app — is checked exactly as hard.

### §20.8 What this leaves

- 🔴 **EXP-004's editor half is still untouched, and it is still the larger half** — the pre-flight
  estimate and the in-editor post-export report with drill-down are both editor surfaces.
- ⚠️ **A marker line is not wrapped**, so a long reason prints as one long comment line in the
  exported app. Cosmetic, measured, not fixed.
- ⚠️ **Popup slot refusals cannot be marked**: the popup target is emitted inline by `popupJsx`
  and has no node id in the render tree to key on. They stay report-only, which the honesty
  paragraph covers.
- **A chain-local for `Error`**, **`exprValidIn`/`actionExprsOf` on `Navigate To Path`**, **the
  cycle refusal §18.3 measured**, and **the HTTP `error` port group drift** — all unchanged and
  still unowned.

## §21 EXP-004's pre-flight, and the host neither editor surface has (session 50, 2026-08-29)

**69 of 127 (54.3%)** — unchanged for a third session, and nothing on the picker moved. This
session built EXP-004's *before you export* surface and measured the layer it should be built at.
🔴 **It also established, with a repo-wide grep, that `@nodegx/export` has no consumer anywhere in
the product** — which changes what "the editor half" means and is the most important thing here.

### §21.1 🔴 The package has zero consumers, so the editor surfaces are not a UI problem

Every list in this phase — PROGRESS's EXP-004 row, §20.8, the session-49 prompt — describes what
remains as *"both editor surfaces (pre-flight estimate, in-editor report)"*, which reads as two
panels waiting to be drawn. They are not.

```
grep -rln "emitApp\|nodegx-export\|@nodegx/export" packages/ --include=*.ts --include=*.tsx \
  --include=*.js --include=*.json | grep -v packages/nodegx-export/
```

Three hits, **all of them comments**: two in `nodegx-module-inject` describing who its synchronous
scanner exists for, one in a `noodl-runtime` test crediting where a defect was first seen. There is
no import, no dependency entry, no webpack alias. `packages/noodl-editor/package.json` lists four
`@nodegx/*` packages and this is not one of them.

⚠️ **`exportProjectComponents.ts` is not this.** The editor's only thing called "Export" zips a
*component bundle* — Noodl's own `.json` interchange — and has nothing to do with code export.

So an in-editor **post-export** report has no post-export moment to attach to: there is no command
in the product that runs this pipeline at all. The one shipped entry point is
`scripts/emit-app.ts`, run by hand through `ts-node`. EXP-004 puts the export *mechanism*
explicitly out of scope ("the export mechanism itself (EXP-002/003)"), so the honest statement is
that **one of EXP-004's two editor surfaces is blocked on a task that is not EXP-004**, and it has
been listed as ordinary remaining work for two sessions.

🔴 **The wiring itself is not the hard part, and saying so keeps the estimate honest.** The editor
aliases sibling packages by path (`@noodl-core-ui` → `packages/noodl-core-ui/src`), `ts-loader`'s
`exclude: /node_modules/` does not bite a symlinked workspace package once webpack resolves it,
and the resolver already accepts `.ts`. What is missing is the command, the directory picker, the
progress and failure handling, and a panel with drill-down — a feature, not a wire.

### §21.2 🔴 The cheap pre-flight was measured *before* it was written, because it is the one to reach for

EXP-004 asks for a pre-flight **estimate** whose testing plan is that it "match the actual outcome
within a reasonable margin". The obvious implementation stops after `planProject`: that is where
most refusals are decided (§20.1), and it is most of the answer for a fraction of the work.

A probe over all seven fixtures, run before any code was written:

| | refusals |
|---|---|
| plan layer only (`plan.notes`) | **28** |
| what the export actually records | **32** |

The four it cannot see are decided during emission — three `parameter … has no style/content
mapping` on `puppy-test-3`, one retired kit parameter on `kits`. ⚠️ **The divergence is invisible
at component level today: `cleanFlips = 0`, no fixture has a component whose *only* refusals are
emit-layer ones.** That is a fact about the corpus, not a property of the layers — one unmapped
`padding` and no dropped wires would be called clean and export dirty.

**So the pre-flight is exact, and EXP-004's "estimate" framing is what gave way.** `emitApp` is
pure: it reads nothing, writes nothing, returns strings, and takes about a tenth of a second per
corpus project. Writing to disk is the caller's separate act. There is no reason to approximate a
number you can compute, and **building a deliberately worse predictor so that a margin exists to
measure would have been the measurement measuring nothing** — a reading that fits rather than one
that excludes.

The control pair is in the suite rather than only in this document: `planLayer < exact` is asserted
over the corpus, so a future rewrite to the cheap layer reddens a row instead of quietly
under-reporting.

### §21.3 Two accounts of one export, and the decision that must not exist twice

`renderReport` prints one sentence about `src/api/` and the pre-flight a shorter one. The
discriminator behind both — *does the project ask anything of a backend, and did it name one* —
is now `backendMode()` in `report.ts`, read by both. A second copy would have been right until
`usesBackend` grew a third case, at which point the before and after surfaces would disagree about
the same project in the same export.

`summarizePreflight` reads everything off `EmittedApp` and recomputes nothing, for the same reason:
the moment it decides for itself what counts as whole, an author can be told "six of ten come out
clean", proceed on it, and read a report describing something else.

### §21.4 🔴 Two defects the rendered output showed that the types could not

Both were found by printing the thing and reading it, not by a failing test.

- **The headline number could not see the largest omission there is.** It counted refusals recorded
  *inside* generated components, so `puppy-test-3` announced **18** and then printed nineteen
  bullets — the extra being `Components/BenchLogicProbe`, a whole component with no file at all.
  A component that does not exist is not a node dropped from one, and the number that led the
  section was blind to exactly that.
- **The sentence introducing the list described a different list.** *"Each one is a node, wire or
  parameter…"*, printed directly above a bullet that is a whole component. Widened to name it.

⚠️ **`- **6 of 10** components translate…`** also sat one line under `- **34 files** — 4 pages and
6 components`, so the same ten were "components" twice with two different meanings. The noun is
gone: `**6 of the 10** come out with nothing left over`.

### §21.5 What proves it

**986 tests** across the package (was 927) in **41 suites** (was 40) — `tests/preflight.test.ts` is
59 of them. `tsc --noEmit` clean, `nodegx-module-inject` 31/31, both ledger gates green
(`69/127`; 175 types). The report goldens are byte-identical through the `backendMode` refactor.

🔴 **Three rows drive `scripts/emit-app.ts` itself.** §19.6 records a defect that lived in this
runner while every gate stayed green, for one reason — *no test drives this script*. `--preflight`'s
whole promise is a negative about the filesystem, and a negative about the filesystem cannot be
checked anywhere else. The third row is the control: the same runner, without the flag, must write
the app, its report **and its copied assets**, or "nothing was written" would pass on a runner that
writes nothing either way.

**Nine mutants, eight killed, and the survivor is proven equivalent rather than excused:**

| mutant | rows |
|---|---|
| `refusals` drops the no-file components | 1 |
| copied assets folded into the file count | 1 |
| the pre-flight computed at the plan layer | 5 |
| the problem list printed before what worked | 7 |
| the honesty sentence softened to claim verification | 7 |
| `--preflight` writes the app anyway | 2 |
| the attention list not sorted at all | 1 |
| the attention list sorted best-first | 1 |
| **the tie-break removed** | **0 — equivalent** |

⚠️ **The zero was checked rather than argued.** The tie-break was mutated out and the rendered
attention order dumped for all seven fixtures: **byte-identical**. `puppy-test-3` does hold a
genuine tie — `Components/BenchEmitter` and `Pages/Admin Login`, four refusals each — and its
emission order already happens to be alphabetical, so nothing in the corpus distinguishes the
clause from its absence. It stays for a tie that is *not* alphabetical, and the comment on it now
says that instead of the determinism claim it used to make, which was wrong: `Array.prototype.sort`
is stable by specification, so emission order was never non-deterministic.

⚠️ **One of this session's own rows was decorative when first written**, and is recorded because
the shape recurs. *"The pre-flight sees a refusal only decided during emission"* asserted that
`emitApp` produces such notes and that `summary.refusals` was at least their count — both facts
about `emitApp`, neither about where the pre-flight reads from. A plan-layer pre-flight would have
passed it. It now compares against the cheap layer's own answer for the same project.

### §21.6 A relayed timing that does not reproduce

The session-49 prompt warns that `ts-node` "takes **well over two minutes** to start, so run it
with `run_in_background`". Measured here on `scripts/emit-app.ts`: **1.5 s wall**. That is why the
runner can be driven from the suite at all. Whatever the original reading was about, it is not a
property of running these scripts today — and it had already hardened into standing advice.

### §21.7 What this leaves

- 🔴 **The in-editor post-export report is blocked, and on a task that is not EXP-004** — §21.1.
  Whoever picks it up owns an editor export command first. **`NONE` today.**
- 🔴 **The pre-flight has an engine and a CLI host, and no host an author reaches.** It is exactly
  as reachable as the export itself is, which is the consistent position — but "an author decides
  with accurate expectations" is not true of anyone who is not running `ts-node`.
- ⚠️ **A marker line is still not wrapped**, popup slot refusals still cannot be marked, and the
  leftover sweep's distinctive population is still empty — all unchanged from §20.8.
- **A chain-local for `Error`**, **the collection-state slice**, **the date family's signals** and
  the **EXP-009 drive leftovers** are all unchanged and still unowned.

## §22 EXP-004's README, and the front door that was conditional on a backend (session 51, 2026-08-29)

**69 of 127 (54.3%)** — unchanged for a fourth session, and nothing on the picker moved. This
session built EXP-004's two remaining unblocked scope items: **a `README.md` in the exported
project** and **actionable next steps ordered by priority**. 🔴 **The first of them was not a new
file — it was a file that already existed and was emitted for one project in seven.**

### §22.1 🔴 The README was conditional on the project having a backend, and six of seven fixtures got none

`README.md` has been emitted since EXP-009, from inside `apiModules`:

```ts
if (backend !== undefined && hasApi) {
  stubs.push(['src/api/client.ts', clientModule(backend)]);
  stubs.push(['.env.example', envExample(backend)]);
  stubs.push(['README.md', readmeMd(ir, backend)]);   // ← the defect
}
```

Read in place that condition looks right: it guards the three files that are *about* the backend
client. Two of them are. The third is the repository's front door.

Measured across the corpus before anything was written:

| fixture | backend | `README.md` |
|---|---|---|
| `puppy-test-3` | connected | ✅ |
| `cheer` | none | ❌ |
| `deadline-desk` | none | ❌ |
| `kits` | none | ❌ |
| `quote-desk` | none (has `src/api/http.ts`) | ❌ |
| `reading-shelf` | none | ❌ |
| `variable-dial` | none | ❌ |

**Six of seven exports had no README at all**, and the one that did said nothing about what the
export left out, never named `EXPORT-REPORT.md`, and did not mention that the export is one-way.

🔴 **A test was pinning it.** `backend-client.test.ts` had a row named *"no client, no
`.env.example`, no README"* asserting `expect(stubApp.files['README.md']).toBeUndefined()`, under a
`describe` block titled **"AC7 — a project with no backend still exports and builds, and says so"**.
The assertion and the heading it sat under were in direct contradiction: a missing README is the
opposite of *saying so*. The absence was never what AC7 was about, and a green row had made it look
settled. This is [a gate with a hole shaped like the defect] one more time — the hole was named,
described, and asserted on.

### §22.2 The ordered next steps, and the criterion written down so it can be argued with

`nextSteps(data)` returns a list, and its ordering criterion is **how much of the running app is
missing without it, most first**. Not difficulty, not refusal count, and deliberately not the order
the report prints its sections in — the report is organised for *looking something up* and this list
is organised for *doing the work*.

1. Components with no file at all — a route can lead to something never written.
2. A stubbed `src/api/` — every read answers empty and every write throws, across the whole app.
3. Refusals in components a route reaches — screens that render, missing behaviour.
4. Refusals in components no route reaches — the same work, nothing runs it today.
5. Kits that shipped files but contributed no nodes.
6. Anything the export said about the project as a whole.
7. Test what was generated — on every export, always last, the only step not about an absence.

⚠️ **1 above 2 is a judgement and not a measurement, and is recorded as one.** A missing component
takes out one screen; a stubbed backend takes out every data path in the app. They are ranked the
way they are because *"nothing was emitted"* is strictly more absent than *"a stub exists and it
names the node it came from"* — but an author whose app is one page and six queries would
reasonably reverse them. Both lines state what they cost, so the reading does not rest on the rank.

**Within a group, components stay in emission order.** Sorting them by refusal count was considered
and rejected: it would break the correspondence with the report's own section order to express a
ranking the counts printed beside them already express. 🔴 That is the §21.5 lesson applied
forward — an ordering that changes nothing observable is a tie-break kept for a tie that is not.

### §22.3 One decision, two readers — and the third surface that deliberately does not get it

The list renders into **both** `EXPORT-REPORT.md` and `README.md`, from one `nextSteps` call, the
pattern `backendMode` established in §21.3. Both are needed because they are **reached by different
routes**: a developer opens the README, and the `TODO(export)` markers in the generated code point
at the report by name. A reader who arrives by either route has to be able to find out what to do.

⚠️ **The pre-flight does not get it, and that is a choice.** `renderPreflight` is read standing up,
before the export exists, by someone deciding whether to proceed — not by someone with a repository
in front of them to work on. Adding seven steps about files that do not exist yet would lengthen the
one document whose whole value is being short. Recorded here rather than left to be re-derived.

What the two documents do **not** share is the itemised refusals. Those are in the report only; the
README gives the count and sends the reader next door. Two full copies of that list would be two
things to keep in step, and the one that drifted would be the one nobody regenerated.

### §22.4 🔴 A golden was retired, and the bar for that is higher than for adding one

`tests/goldens/exp009/README.md` was EXP-009's **hand-written target output** for a backend-only
README about two environment variables. That document no longer exists: the README is now generated
from the report data, emitted for every project, and is mostly about what needs doing.

The golden could not be kept, and it could not honestly be *regenerated* either — a "golden" written
by copying this session's own output is a snapshot of prose written an hour earlier, and it grades
nothing about whether the prose is right. It was deleted, and replaced by `tests/exported-readme.test.ts`
(52 rows), including one that pins this fixture's endpoint and application id against the same
values `.env.example` uses — which is the part of the old golden that was making a claim.

### §22.5 What proves it

`packages/nodegx-export`: **`tsc --noEmit` exit 0**, **jest 1039/1039 across 42 suites** (986/41
before this session — 52 new rows in `exported-readme.test.ts`, and one existing row split in two).

🔴 **Sixteen mutants, run against the whole suite rather than the new file** — the README is emitted
by `emitApp`, so a mutation to it can redden rows in `missing-interface`, `backend-client` and
`export-report` too, and scoping the run to one test file would have graded a smaller thing than the
change.

**Eighteen mutants, eighteen killed, none survived.** Tree restored byte-identical after every one.

| mutant | verdict | reds |
|---|---|---|
| the ladder is reversed | KILLED | 3 |
| unreachable components are ranked above reachable ones | KILLED | 3 |
| the stub step is ranked below the component refusals | KILLED | 3 |
| the last step is dropped when there is other work | KILLED | 2 |
| a refusal count counts components instead of refusals | KILLED | 3 |
| one is printed as a digit | KILLED | 1 |
| the real HTTP module is listed as a stub to connect | KILLED | 1 |
| a component with no file is located by nothing | KILLED | 1 |
| **the README is emitted only for a project with a backend, as before EXP-004** | KILLED | **35** |
| the README is left out of the file count it is part of | KILLED | 2 |
| the README claims the generated code was verified | KILLED | 14 |
| the README copies the report's itemised refusals instead of pointing at them | KILLED | 5 |
| the README stops naming the report at all | KILLED | 5 |
| the one-way warning is dropped | KILLED | 7 |
| a clean export is still sent grepping for markers that do not exist | KILLED | 2 |
| the README leads on what is missing rather than how to run it | KILLED | 1 |
| the env-var section is printed for a project that never queries the backend | KILLED | 1 |
| the report renders its own, shorter list | KILLED | 5 |
| the continuation indent is lost, so details leave their list item | KILLED | 1 |

🔴 **The 35-red row is the §22.1 defect, reintroduced deliberately** — restoring the old condition
reddens rows in four suites, which is what "six of seven fixtures lost their README" looks like from
inside the suite. Before this session it was green.

⚠️ **Two mutants came back NOT-APPLIED first** — their search text matched zero times because the
indentation and the string-concatenation break were guessed rather than read off the file. Both were
corrected and re-run, and **NOT-APPLIED was never counted as a survivor**. A mutation table where a
typo reads as "nothing to fix here" is the instrument grading itself.

### §22.6 What the rendered output showed that the types could not

Both readings of the generated documents found things no test would have:

- 🔴 **"Write the 1 component the export could not generate."** The obvious pluraliser prints a bare
  digit at n=1, and that is the sentence a reader trips on. One is now spelled and everything else
  is a digit.
- 🔴 **"Write the 11 things left out of 2 components"** — *things* is exactly the vagueness EXP-004's
  *"be specific, not statistical"* rule forbids. It is now *refusals*, which is the vocabulary the
  pre-flight already uses.
- 🔴 **Three near-identical caveats in a row** on a clean export: the report's *"Nothing."*, then a
  next-step saying nothing had been run, then the honesty section saying it again at length. That is
  EXP-004's own risk — *"the report is so cautious that a good export looks bad"* — arriving through
  the addition rather than the original. The step's detail is now two lines and points below.
- ⚠️ **A straight apostrophe.** `report.ts` emits `’` and the new `readme.ts` emitted `'`, in two
  Markdown files that sit next to each other in the same folder. Normalised.

### §22.7 A stale claim in a test's own framing

`export-report.test.ts`'s header says *"The corpus has no project with zero refusals, which is the
case the 'lead with what worked' rule is really about."* **It has two** — `reading-shelf` and
`deadline-desk` both refuse nothing and both render the *"Nothing."* branch. The sentence was true
when session 48 wrote it and stopped being true when later sessions added fixtures.

It is a comment and not a check, so nothing was green that should have been red. It is worth
correcting anyway: a false *"no fixture covers this"* is how a directly-driven row gets deleted two
sessions later by someone who greps, finds a fixture, and believes the comment about why the row
exists. Corrected in place, with the two fixtures named.

### §22.8 What this leaves

- 🔴 **The in-editor post-export report is still blocked, still owned by `NONE`** — §21.1, unchanged.
  `@nodegx/export` still has no consumer in the product, and this session did not add one.
- 🔴 **EXP-004's last unchecked scope line is the in-code marker's missing node source.** It names
  the refused port and the reason; EXP-004 asks for the original node source in the comment. Still a
  recorded narrowing, still unbuilt, and **not** blocked by anything.
- ⚠️ **The stub-backend step is exercised only by hand-built data.** No corpus project both queries a
  backend and declares none, so §22.5's stub-locations row and the `src/api/http.ts` exclusion are
  driven directly. That is a fact about the corpus, not about the code — and it is the same shape as
  §21.2's `cleanFlips = 0`.
- ⚠️ **The trace-coverage scope line is still not applicable.** EXP-003 does not exist, so there are
  no traces; both surfaces say nothing has been run, which is narrower than EXP-004 anticipated and
  is the honest statement today.

## §23 The code of a node the export refused, and the field built to carry it that nothing reads (session 52, 2026-08-29)

**69 of 127 (54.3%)** — unchanged for a fifth session; nothing on the picker moved, deliberately.
This session built EXP-004's last unblocked scope line: *"the original node source preserved in
comments so a developer can see what the code is meant to do."*

### §23.1 🔴 A translated Function keeps its body; a refused one lost it — which is backwards

A re-host wrapper prints only when something that survived references it (`referencedJsIds`), and
that reference check is correct: a wrapper nothing calls is dead code. But the **body went with
it**, and the body is the only statement anywhere of what the developer now has to write.

So the export preserved author code in exactly the case where the code was already there as code,
and dropped it in exactly the case where the comment was the only remaining record.

Measured across the corpus before anything was built:

| | count |
|---|---|
| nodes carrying `sourceText` | 4 of 332 |
| of those, reaching a `jsFunctions` definition | 3 |
| of those, whose body **never prints** | **1** |

The one is `puppy-test-3`'s `formatList`, a `JavaScriptFunction` deferred because *"its outputs
feed nothing statically translatable"*. Its marker sat beside the empty `<p>` naming
`formatList.text`, and `formatList` existed **nowhere in the exported repo**.

🔴 **One in the corpus is not one on the product surface**, and the ledger's own rule applies: a
Function whose outputs feed nothing statically translatable is an ordinary thing to author, and
Function nodes are among the most common nodes there are. The corpus number is a regression net,
not a priority.

### §23.2 The near-miss that a control caught — `reading-shelf`'s `toRow`

The first sweep flagged **two** script nodes whose source reached no output. The second,
`reading-shelf`'s `toRow` (`Map Collection`, a `mapScript`), looked identical to `formatList` by
every measurement taken: its node id appeared in no emitted file, and its script text appeared
nowhere. Its pre-flight, meanwhile, said *"Every node and every wire in this project has a
translation, and the export refuses none of them"* — which read like a second, worse defect.

Reading the emitted page settled it. The mapping **is** translated, inlined into the collection
chain:

```tsx
booksItems.filter((row) => row.shelf == 'favourite').slice().sort(…).map((row) => ({ title: row.title, badge: row.shelf }))
```

The pre-flight was right and the instrument was wrong: *"is the author's text in the output"*
answers a different question from *"was this node translated"*, and for every node that translates
into something other than a verbatim quotation it answers **no** on correct code. Had the sweep
been trusted, this session would have filed a defect against a working translation and "fixed" it
by preserving source beside code that already did the job. **The reading fitted; it did not
exclude.**

### §23.3 Why the source sits at module scope, and not on the marker beside the element

Two reasons, and the second decided it.

A refused Function is still a function, and module scope above the component is where the printed
wrappers already live — a developer who now has to write it wants it where it will go, not
indented six levels inside JSX children.

🔴 And **`referencedJsIds` is only complete once the tree walk has finished.** The inline markers
render *during* that walk, so a marker that asked *"did this wrapper print?"* would have been
asking before the answer existed, and would have preserved the source of functions that went on to
print their own. The block is emitted in the wrapper loop, after the walk, where the set is final.

⚠️ **Registration is not emission, and this was nearly the bug.** `plan.jsFunctions` was the
obvious discriminator and it is the wrong one: `formatList` **is** registered. Only
`referencedJsIds` separates a body that prints from one that does not, and a measurement was what
showed it — the proxy was tested before it was used, and it failed.

### §23.4 🔴 U+2028 ends a `//` comment, and the first control that said otherwise was measuring nothing

Author code goes into a line comment, so every JS line terminator has to split it — including
U+2028 and U+2029, which end a `//` comment exactly as a newline does and spill the rest of the
line into the module as code.

The first negative control reported **0 parse errors with the guard removed**, which would have
made the guard decoration. It was measuring nothing: the probe carried a literal U+2028 in *its own
TypeScript source*, where it had already been consumed as a line break — so the body under test
never contained one. Writing it as the escape `\u2028` made the hazard appear at once:

| | emitted file carries U+2028 | parse errors |
|---|---|---|
| guard in place | no | **0** |
| naive `\n` split | yes | **1 — *Unterminated string literal*** |

Confirmed independently against all three parsers the exported app meets — **TypeScript, esbuild
and V8** — each reporting *Unterminated string literal* on the naive rendering. This is the
`commentSafe` hazard one construct over, and [a literal in your own source reads as absence] again.

### §23.5 What was measured, and what was not

- **`tsc --noEmit`** exit 0; **1044/1044, 42 suites** (1039 before; five rows added).
- **Six mutants, six killed** over the branch, the body loop, the U+2028 split, the reference test
  and the marker's node name. The rows include a control pair whose only variable is the one wire
  that decides whether anything reads the node's outputs.
- 🔴 **The exported app builds** — `puppy-test-3` emitted into a harness, `tsc -b && vite build`
  exit 0, and the report's own `grep -rn "TODO(export)" src` now returns **6 markers** where the
  reader is pointed: `Admin.tsx:67` names `formatList.text` and `Admin.tsx:9` carries its body.

⚠️ **`NodeIR.sourceText` still has no consumer.** The field the IR documents as *"the
preserved-as-comment fallback when a translation stays unverified"* is written by the parser and
read by nothing — this session used `JsFunctionPlan.body`, which is what the wrapper would have
printed and is therefore the honest thing to quote. For `kind: 'function'` the two are the same
text. The field is left as it was rather than quietly deleted or quietly adopted.

⚠️ **A Visual Function's preserved block is generated code, not authored text**, and its wording
says so — its authored artefact is a block program. No corpus fixture exercises that branch.

⚠️ **Nothing here is a comprehension measurement.** Whether the preserved block actually lets an
unfamiliar developer rewrite the function is unmeasured, and belongs with the two EXP-004 lines
already owed to a person.

## §24 The `Error` a node's own chain could not read, and the arm that still cannot (session 53, 2026-08-29)

**69 of 127 (54.3%)** — unchanged for a sixth session, and correctly so: this is a fidelity
increment on two nodes the picker already counts, not a new type. `export-ledger:check` holds at
175 types.

This session built the increment §14.4 named and §17.6, §18.6 and §21.7 carried forward unchanged:
**a chain-local for `Error`, owed by two nodes.** One construct closed both.

### §24.1 Three chains, three different answers — and only one of them is the chain-local

The refusal was real and was pinned by a test row: a read of `Error` from inside `External Link`'s
or `Navigate To Path`'s own outcome chains deferred, because `setHelpError(...)` does not change
`helpError` inside the closure that called it (§8.2). `HTTP Request` has always minted a
chain-local for exactly this. These two now do too.

🔴 **What made it more than a copy of `HTTP Request` is that "the node's own chains" is not one
question.** It is three, and answering them the same way would have been wrong twice:

| chain | what the interpreter answers | what the export emits | why |
|---|---|---|---|
| **Failure** | the message just written | the arm's own `const` | the row is one render behind, in the closure that set it |
| **Done** | the *previous* failure's message — `_internal.lastError` is **never cleared** | the **state row** | the stale row is the faithful answer here, not a concession; and the `const` is declared in the `else` and is not even in scope |
| **Completed** (`Navigate To Path` only) | the message just written | **nothing — still refused** | it prints as a join *beneath* both arms, so the `const` is out of scope **and** the row is still the previous message |

The `Completed` row is the one worth keeping. A slice that translated "a read from any of this
node's own chains" would have emitted a Completed chain showing a message one failure out of date
— §8.2's exact bug surviving in the one place nobody looked — and every other assertion here would
still have been green. `External Link`'s `Completed` is refused further upstream (§12.7), so the
asymmetry only surfaces on one of the two nodes.

### §24.2 The message is bound once, and that is what the `const` is for

The guarded-new-tab form picks between two strings by re-testing the link. Before this slice that
ternary had exactly one reader, the state setter. A chain read would have given it a second — and
printing the decision again at each sink is two copies of one rule, free to drift. The arm now
binds it once and everything reads the binding:

```tsx
} else {
  const helpErrorMessage = helpHref === undefined || helpHref === null || helpHref === '' ? 'No link to open' : 'The browser blocked opening a new tab';
  setHelpError(helpErrorMessage);          // the row, for render and for other handlers
  lastLinkError.set(helpErrorMessage);     // the chain
  navigate(`/mood?msg=${helpErrorMessage}`); // and the chain again, through a different sink
}
```

⚠️ **The `const` is emitted only where the arm's chain actually reads it.** A node whose `Error`
is read only from render emits the setter with the message inline, exactly as before — the
commonest shape gains nothing and loses nothing. And the two forms differ in one more way that is
not cosmetic: the row is **maybe-undefined** (nothing has written it before the first failure) and
the `const` is not, so `{helpError ?? ''}` folds at a text sink while `${helpErrorMessage}`
interpolates bare. That divergence is asserted with a control pair, because a mutation run showed
nothing else in the suite could see it.

### §24.3 🔴 The suite could not tell a row that is *read* from a row that is *declared*

The most useful thing a mutant found was not about this slice's code. Removing **every** clause
that earns an `Error` row through `referencedStateNames` emits a component containing
`lastLinkError.set(helpError)` with **no `useState` above it** — a file that cannot compile — and
**all 1054 tests passed.**

`expectParses` parses, and an undeclared identifier is perfectly good syntax. Rows across this
file assert that a read *appears*; none asserted that it *resolves to anything*. Two rows now do,
one per node, and the mutant dies. 🔴 **The general hole is wider than these two rows** — every
emitted-code assertion in this package is a parse, not a typecheck — and it is recorded in §24.6
rather than fixed here.

### §24.4 A redundant pair, taken apart by measurement rather than argued

Two clauses earn the row, one on the read side and one on the writer side. Each was mutated out
alone and **both survived** — which reads like dead code and was nearly recorded as "belt and
braces". Removing **both** is what breaks it. So neither is redundant with nothing; they are
redundant with *each other*, and the honest statement is that the pair is load-bearing and either
half is spare. Both are kept, and the assertion added in §24.3 now grades the pair.

⚠️ **The first attempt at that measurement was invalid and is recorded because the shape recurs.**
The "both removed" arm left a *third* clause standing — the render walker's — so the row was still
earned, and the export built cleanly. The reading fitted and did not exclude. Only when all three
were removed did the build fail with `Cannot find name 'helpError'`.

### §24.5 What proves it

- **`tsc --noEmit`** exit 0; **jest 1054/1054 across 42 suites** (1044 before — 10 new rows).
- 🔴 **The exported app builds**, which is the step that finds what these tests structurally
  cannot. A project was authored on the `cheer` fixture carrying an `External Link` with a wired
  link and a new tab, its `Error` read from **all four** places at once — the render, the Done arm,
  and the Failure arm through two different sinks. `tsc -b && vite build` exit 0, 68 modules.
- 🔴 **Two control arms, because a green build proves nothing unless it can go red.** With the Done
  arm reading the local, the build fails `TS2304: Cannot find name 'helpErrorMessage'` — the
  out-of-scope error no parse-only test can see. With all three earning clauses gone it fails
  `TS2304: Cannot find name 'helpError'`.

**Fifteen mutants: thirteen killed, and the two survivors are the §24.4 pair.**

| mutant | verdict | reds |
|---|---|---|
| the Failure arm reads the row — §8.2's bug reintroduced | KILLED | 4 |
| the Done arm reads the local, which is not in scope there | KILLED | 1 |
| both chains compile under one arm, as before §24 | KILLED | 1 |
| the earning check is asked inside the chains too | KILLED | 6 |
| `outcome-error` invalid in every context | KILLED | 8 |
| the `Completed` refusal branch disabled | KILLED | 1 |
| `Completed` compiles under the failure arm | KILLED | 1 |
| the `const` is never declared (External Link) | KILLED | 4 |
| the `const` is never declared (Navigate To Path) | KILLED | 1 |
| the setter re-derives the message instead of reading the binding | KILLED | 1 |
| the text sink stops folding an `Error` read | KILLED | 2 |
| the local is treated as maybe-undefined, like the row | KILLED | 1 |
| **all earning clauses removed — the row is read and never declared** | KILLED | 2 |
| the read-side earning clause alone | **SURVIVED — §24.4's pair** | 0 |
| the writer-side earning clause alone | **SURVIVED — §24.4's pair** | 0 |

⚠️ **Two of those were only killed after the suite was strengthened, and that is the point of
running them** — the maybe-undefined mutant and the earning-clause mutant both passed a green suite
first. ⚠️ **One came back NOT-APPLIED** because its search text carried a real `’` where the source
carries the escape `’` — guessed rather than read off the file, the §22.5 shape again. It was
corrected and re-run, and **NOT-APPLIED was never counted as a survivor.**

**The app, driven.** Expectations written down before it ran. Row order is forced twice over: the
Error row is never cleared, so the success row must precede any failure row, and the failure arm
**navigates away**, so it runs last.

| row | measured |
|---|---|
| D1 on load | `/notes`, the error text empty |
| D2 a real url, clicked | **tab count 1 → 2**, url still `/notes`, error text **still empty** — the Done arm read the row, which nothing had written |
| D3 the input cleared, clicked | **`/mood?msg=No link to open`** |

D3 is the row that carries the slice: that message can only be there if the ternary tested the
link *and* the `const` carried the answer into a sink.

| arm | change | rows that moved |
|---|---|---|
| A | the ternary always picks the blocked string | **D3 only** — `/mood?msg=The browser blocked opening a new tab` |
| B | the Failure arm reads the row (§8.2's bug) | **D3 only** — `/mood`, the message **gone entirely** |

⚠️ **Arm B's written prediction was `/mood?msg=` and the measurement was `/mood`.** Both say the
message was lost; the shape differs because an undefined query value is **omitted from the url**
rather than sent as an empty key — §15.2's own rule, arriving from the other side. The prediction
was right about the defect and wrong about its surface, and the arm is stronger than predicted: a
user of the interpreted app sees a reason and a user of the exported one saw nothing at all.

🔴 **Three instrument faults, all of which first read as findings.** The drive is recorded with
them because each is cheap to repeat:

1. **The router ate the evidence.** The first drive navigated to an unrouted `/oops/{msg}`, and the
   scaffold's `<Route path="*" element={<Navigate to="/" replace />} />` replaced the url with `/`
   before it could be read. The measurement said "nothing happened"; what happened was erased.
2. **A plain `i.value = …` is swallowed by React's value tracker**, so the input never reached the
   store and the success row silently became a failure row. The native setter plus an `input` event
   is required even for an *uncontrolled* input.
3. 🔴 **A fixed sleep after a rebuild raced the preview server, and the control stopped
   reproducing** — which looked exactly like the sabotage working. Every wait is now a poll on a
   condition, and the control was re-run and re-confirmed before either arm was believed.

### §24.6 What this leaves

- ✅ **The chain-local for `Error` is closed for both nodes**, and is no longer on any list.
- 🔴 **`Navigate To Path`'s `Completed` chain still refuses an `Error` read**, deliberately and
  with its own reason. Translating it needs the message hoisted above the branch, which changes the
  emitted shape for every node of this kind — a slice of its own, and not obviously worth it.
- 🔴 **Every emitted-code assertion in this package is a parse, not a typecheck** (§24.3). One
  class of defect — a name that is read and never declared — is invisible to all 1054 rows, and was
  found here only by building the app. A `ts.createProgram` over the emitted files, in one suite,
  would close it for the whole package. **Owner: `NONE`.**
- **`External Link`'s `Completed`**, the collection-state slice, the date family's signals and the
  EXP-009 drive leftovers are unchanged and still unowned.
- ⚠️ **No corpus fixture contains an `External Link` or a `Navigate To Path` at all**, so every row
  above is driven from hand-built graphs and one authored project. That is a fact about the corpus,
  not about the code — the same shape as §22.8's stub-backend note.

## §25 The typecheck suite §24.6 asked for — and why the suite it described would not have worked (session 54, 2026-08-29)

§24.6 left one item owned by `NONE`: *"a `ts.createProgram` over the emitted files, in one suite,
would close it for the whole package."* That suite now exists. **The sentence describing it was
wrong in one load-bearing way, and the measurement that shows it is below.**

### §25.1 What was built

`tests/helpers/typecheckApp.ts` builds a real `ts.Program` over an emitted app's `src/**` and
returns its semantic diagnostics. `tests/typecheck-emitted.test.ts` runs it over **all seven
fixture projects**, each of which compiles to **zero diagnostics**.

The compiler options are the ones the scaffold writes into the exported app's own `tsconfig.json`,
so this is not a laxer dialect than `tsc -b`. What resolves for real: `react`, `react-dom` (the
root's `@types/*`), and **`@nodegx/core` mapped to its committed `src`** — deliberately not to its
`dist`, which is gitignored, so this suite's reach does not depend on whether somebody ran a build.

🔴 **`react-router-dom` and `vite/client` are declared in the helper rather than resolved**, because
the app depends on `react-router-dom@^7` and this repo has **v5** — a different API — and no Vite at
all. Those declarations are typed rather than shorthand-`any` (`useParams()` answers
`string | undefined` per segment, which the generator reasons about), but **router prop misuse is
graded against them and not against the real package.** Building an exported app remains the only
instrument for that. The `*.module.css` declaration is the same loose index signature `vite/client`
ships, so it is not a weakening.

### §25.2 🔴 A fixture-only suite is green on the defect that motivated it

§24.6's own note — *no corpus fixture contains an `External Link` or a `Navigate To Path`* — is
what breaks its recommendation, and the two facts were recorded three lines apart without being put
together. **The defect class lives in the nodes the corpus does not have.**

Measured, by restoring §24.3's mutant (all four earning clauses removed) and running both suites:

| suite | population | under the §24.3 mutant |
| --- | --- | --- |
| `typecheck-emitted.test.ts` | the 7 fixture projects | **11/11 GREEN — misses it entirely** |
| the new rows in `external-link` / `navigate-to-path` | hand-built graphs | **RED**, `TS2304 Cannot find name 'helpError'` |

So "one suite over the fixtures closes it for the whole package" is **false**. It closes the class
only for node types the corpus contains, and the picker's own number says 69 of 127 types are
translated while the corpus exercises far fewer. **A typecheck row belongs beside the hand-built
graph wherever a slice has one** — which is why `typecheckEmittedApp` is an exported helper and not
a private function inside the fixture suite.

### §25.3 What proves it

- **`tsc --noEmit`** exit 0; **jest 1067/1067 across 43 suites** (1054/42 before — 13 new rows).
- 🔴 **The control pair is permanent, not a scratchpad artefact.** Three rows in
  `typecheck-emitted.test.ts` sabotage the emission and assert the checker goes red: a synthetic
  undeclared name, **§24.3's exact shape** (a state read whose `useState` line is deleted), and a
  row asserting that the same sabotage **still parses cleanly** — the two halves of why the parse
  rows missed it, sitting next to each other.
- 🔴 **The checker's first two findings were about the checker**, both caught by requiring the
  known-good arm to reach zero rather than by reading the diagnostics as defects:
  1. Stubbing every bare import as `any` gave **107 diagnostics on `cheer` alone** — `TS7026` (no
     `JSX.IntrinsicElements`), `TS2347` (generic calls on an untyped `useState`). Real
     `@types/react` removes all of them; an exclusion list would have hidden them instead.
  2. A `directoryExists` that read only from disk made module resolution **prune directories that
     existed only in memory**, reporting `TS2307 Cannot find module './client'` for a file that had
     just been emitted. It reads exactly like a real defect in the emission.

### §25.4 What this leaves

- ✅ **§24.6's typecheck item is done and off the list.** Owner was `NONE`; the suite is committed.
- 🔴 **The remaining hole is population, not mechanism.** Slices whose nodes no fixture contains
  are graded only where someone adds a `typecheckEmittedApp` row to the hand-built graph. Two have
  one. **The other eight files carrying a private `expectParses` do not** — `array-vocabulary`,
  `emitted-syntax`, `in-code-markers`, `page-inputs`, `date-family`, `untyped-store-key`,
  `http-request`, `untyped-variable`. That is the cheapest remaining EXP-011 work and it is
  currently owned by `NONE`.
  > 🔴 **Corrected by §26 — this list of eight is wrong in three ways, and five of the eight
  > needed no row.** It was written from a grep for parse helpers rather than from what the
  > fixture population already reaches. Read §26 before working from it.
- ⚠️ **Cost, measured**: one program is ~750 ms, so converting all 32 `expectParses` call sites
  wholesale would roughly triple the suite. The two rows added here compile the richest graph in
  each file rather than every configuration, which is what keeps the suite at ~20 s.

---

## §26 The rows §25 asked for — and the list it asked for them on was wrong three times over (session 55, 2026-08-29)

§25.4 left one item owned by `NONE`: add a `typecheckEmittedApp` row to each of **eight** files
still carrying a private parse-only helper. Three rows were added. **Five of the eight needed
none**, and finding that out was most of the work.

### §26.1 🔴 The list was built from the checkers, not from the population

§25's own headline lesson is *"ask what population a checker runs over before believing its
reach."* Its closing list was then built by grepping for files that carry a parse helper — which
is a fact about the **checkers**, not about what the fixture suite already compiles. Checked
against the population, the eight fall into three groups:

| File | Verdict | Why |
|---|---|---|
| `untyped-variable` | ✅ **row added** | No fixture wires a port that already carries an authored value |
| `untyped-store-key` | ✅ **row added** | No fixture writes a store key from an untypable source; `cheer` feeds `GlobalStore.Set` only from string-typed sources |
| `page-inputs` | ✅ **row added** | No fixture carries a `PageInputs` node, and no fixture `urlPath` has a braced segment |
| `emitted-syntax` | ❌ **not applicable** | Runs over the **fixtures**, not a hand-built graph — the exact population `typecheck-emitted.test.ts` already compiles at zero |
| `in-code-markers` | ❌ **not applicable** | Same — iterates the fixture directory |
| `http-request` | ❌ **duplicate** | `quote-desk` wires `HTTP.out-text/out-author/out-echo → Text.text`, `error → Text`, `failure → Set Variable` — the generated answer interface, the cross-file import and the optional-chained read are all already compiled |
| `array-vocabulary` | ❌ **duplicate** | `reading-shelf` wires `Collection2 → Filter Collection → Map Collection → For Each`, plus a `Model2` prop-minting `BookRow` — the composed row shape is already compiled |
| `date-family` | ❌ **duplicate** | `deadline-desk` carries all six date nodes **and** the exact chain the hand-built case builds: `button.onClick → Now.read`, `Now.done → Set Variable.do`, `Now.iso → Set Variable.value`, `Variable2.value → Text.text` |

🔴 **Two of these were caught only after the row had been written and was passing.** The rows for
`http-request` and `array-vocabulary` were added, went green, and were then reverted when the
fixtures were actually read. A green row is not evidence that it grades anything new.

### §26.2 What was added

Three rows, each over the richest graph in its file, each reached by an emitted page file proven
to be in the program:

- `tests/untyped-variable.test.ts` — the `onHome` graph: HTTP → `Set Variable` (`unknown`) →
  a read into a text sink on one page, plus a second read into a component instance prop on
  another.
- `tests/untyped-store-key.test.ts` — HTTP → `GlobalStore.Set` into a key `initialState` does not
  type → `Subscribe` back into a render sink.
- `tests/page-inputs.test.ts` — a parameterised route with both router hooks declared. This is the
  one slice whose value type comes from a **hook signature** rather than from the emitter.

### §26.3 What proves it

- **`tsc --noEmit`** exit 0; **jest 1070/1070 across 43 suites** (1067/43 before — 3 new rows).
- 🔴 **The reach argument, measured a second time and on a different defect class.** Deleting the
  instance-side dedup in `src/emit/component.ts` (`if (plan.bindings[node.id]?.[param.name] !==
  undefined) continue;`, the second of the two occurrences) reintroduces the real
  `<GreetingCard Name="Ada" Name={x} />` defect. With that mutant in place:

  | Suite | Population | Result |
  |---|---|---|
  | `tests/untyped-variable.test.ts` — the new row | hand-built | 🔴 **red**, `TS17001 src/pages/Home.tsx:88` |
  | `tests/typecheck-emitted.test.ts` | 7 fixtures | 🟢 **11/11 green** — misses it entirely |
  | `tests/emitted-syntax.test.ts` | 7 fixtures | 🟢 **16/16 green** |

- 🔴 **No parse can catch this class.** A duplicate JSX attribute yields **zero**
  `parseDiagnostics` — measured directly, not inferred — so every `expectParses` in the file
  passes on the mutant. TS17001 is a grammar error the *checker* raises.
- ✅ **Neither of the other two rows is vacuous.** Each graph's emitted page file was sabotaged
  through the helper's `overrides` and produced a diagnostic naming that file
  (`src/pages/Mood.tsx`, `src/pages/Notes.tsx`), proving it is genuinely in the program rather
  than passing on an empty one.
- ⚠️ **Cost**: the suite moved **23 s → 27.7 s**. §25's "~750 ms per program" is a warm figure;
  a cold program in a fresh jest worker measured **1.0–2.9 s**.

### §26.4 What this leaves

- ✅ **§25.4's item is closed.** Every file where a typecheck row reaches a population the fixture
  suite does not now has one. Owner was `NONE`.
- 🔴 **The remaining hole is the one §25 named and it has not moved**: `react-router-dom` is
  *declared* by `tests/helpers/typecheckApp.ts`, not resolved — the repo has v5 and the app wants
  v7. `page-inputs`' new row is graded against that declaration. **Building an exported app is
  still the only instrument for the real third-party libraries.**
- ⚠️ **`array-vocabulary` emits `mood2?: any;`** for a minted `Model2` prop (`tests/array-vocabulary.test.ts`,
  "mints a prop, reads it at the sink"). A typecheck row over that graph would grade nothing at
  the prop, because `any` is what it emits. Noticed in passing, not investigated; owner `NONE`.


---

## §27 `sourceText`'s consumer, and the contract it was not keeping (session 56, 2026-08-30)

Session 55 left `NodeIR.sourceText` as a decision: *"the field the IR documents as the
preserved-as-comment fallback is written by the parser and read by nothing. **Adopt it or delete
it**, rather than carrying the ambiguity a sixth time."*

**Adopted** — because measuring what deleting it would cost found a live defect, and measuring
what adopting it would print found a second one. Both are fixed. Picker coverage is unchanged at
**69/127 (54.3%)** and correctly so: no node type gained a translation.

### §27.1 The field had no consumer — confirmed, and the grep nearly said otherwise

`grep sourceText src` returns a hit in `src/emit/component.ts`. It is a **comment**, inside
`refusedSourceLines`, and the code beside it reads `JsFunctionPlan.body`. The trap the memory
already names — *a MENTION reads as a CALL* — with the mention sitting in the one file where a
consumer would live.

### §27.2 🔴 Deleting it would have closed nothing, and left a measured hole open

Of **4 nodes in 332** across the seven fixtures carrying `sourceText`, three are Function or
Expression — `jsFunctions`, whose refused bodies §20 already preserves. The fourth is
`reading-shelf`'s `toRow`, a **`Map Collection`**, and it is the interesting one.

Its mapping was sabotaged into a function-valued one, which `parseIdentityMapping` refuses:

| Question | Before |
|---|---|
| Is the refusal reported? | ✅ `EXPORT-REPORT.md` names it, with the reason |
| Is there an in-code marker? | ✅ `src/pages/Home.tsx`, naming `Map Collection toRow.items` |
| **Is the author's script anywhere in the repo?** | 🔴 **Nowhere** — all four probes missed |

That is §20's argument verbatim, one node-family over: *a script this export refused is exactly
the case where the authored text is the only statement of what the developer now has to write.*
`refusedSourceLines` covers Function / Expression / Visual Function because those three have a
wrapper to withhold. Every other script-bearing node carries its JavaScript as a **parameter of a
node doing something else**, and had no equivalent.

### §27.3 🔴 Adopting it as written would have printed a Text node's CSS as "its authored script"

The contract said *"verbatim author-written code for script-bearing nodes."* The writer selected
on `isCodeEditorType` — *does this port open a code editor* — and those are not the same set. The
catalog was asked, and it names the language:

| `codeeditor` | ports | what they hold |
|---|---|---|
| `javascript` | **7** — `functionScript`, `expression`, `mapScript`, `templateScript`, `code`, REST's two | code |
| `text` | **29** — 27 × `styleCss`, Static Data's `csv`, ParseCSV's `text` | CSS and data |
| `css` | 1 — CSS Definition's `style` | CSS |
| `json` | 1 — Static Data's `json` | data |

Measured, not inferred: giving `cheer`'s `headline` Text node an authored `styleCss` put
`.headline { color: rebeccapurple; }` into `sourceText`. So the writer now selects on
`isJavaScriptCodeEditorType`, **derived from the catalog** rather than listed here (EXP-007's
rule). The field's doc comment says what it actually holds.

### §27.4 What was built

- **`isJavaScriptCodeEditorType`** (`src/catalog.ts`) — the language predicate, beside the port
  predicate it is repeatedly mistaken for.
- **`RefusedScriptPlan` / `ComponentPlan.refusedScripts`** — script-bearing nodes that are not
  `jsFunctions` and whose script this component did not translate, in node order.
- **`translatedScriptIds`** — the success-arm register. 🔴 **Registered where the translation
  happens, not inferred from the absence of a deferral**, and the difference is a wrong-node bug:
  a refusal is filed against the **dropped wire**, whose `fromId` is the *outermost* node of the
  chain. In `Collection2 → Filter → Map → For Each` a refusing **Filter** files against the
  **Map**'s wire, so reading the script off the dropped wire's source would preserve the Map's
  mapping under the Filter's reason — a comment naming the wrong node's code.
- **`refusedScriptLines`** (`src/emit/component.ts`) — the comment block, through the existing
  `commentSafe` / `commentSafeLines` pair. It cannot borrow `REFUSED_SOURCE_WORDING`'s *"no
  wrapper was generated for it"*: these nodes never had a wrapper.

### §27.5 What proves it

- **`tsc --noEmit`** 0; **jest 1076/1076 in 43 suites** (1070/43 before — 6 new rows); both ledger
  gates OK; picker unchanged at 69/127.
- 🔴 **Two mutants, and the disagreement is the finding.**

  | Mutant | Refusal rows | CONTROL + corpus rows |
  |---|---|---|
  | emit hook removed | 🔴 **2 red** | 🟢 green |
  | writer widened back to every codeeditor port | 🔴 **1 red** (`parse`) | 🟢 green |

  Anchors were asserted before replacement in both, and `cp -a snap/src/. src/ && diff -r`
  restored between them.
- ✅ **The control is a row, not a note.** A `Map Collection` whose mapping *does* translate gets
  no comment and keeps its mapping as code — without it, "a comment appeared" is equally
  consistent with a comment appearing always.
- ✅ **The false-positive half is a row too**: all seven fixtures, every emitted file, **zero**
  preserved-script comments. The rule's population is every node in every component, and one
  predicate too wide would decorate a clean corpus with claims that code was lost.
- ✅ **The reach is measured, not argued.** A hand-built probe added a `Javascript2` and a
  `For Each` with an authored `templateScript`; both preserve their script, and `toRow` beside
  them — translated — still gets nothing. `Javascript2` matters most: it is a deferred *type* with
  no named site, and a Script node is nothing **but** its code, so the whole node was leaving the
  export with no trace of what it did. That case is now a row.
- ⚠️ **Verbatim means the author's own indentation too**, and the first draft of the assertion got
  this wrong — `//   ` prefix *plus* the script's two-space indent. The row now pins all four
  lines, because "never trimmed, never reformatted" is the contract and a re-indented record is a
  rewritten one.

### §27.6 What this leaves

- ⚠️ **Only components that emit a file are covered**, and the planner says so in a comment. The
  router shell and a **logic-only component** return before the sweep — there is no module for a
  comment to live in — so a `Script` node in a logic-only component still loses its code to the
  report alone. Named rather than silently included. Owner **`NONE`**.
- ⚠️ **`REST2`'s `requestScript`/`responseScript` are covered by the same rule** but were not
  driven: the type is deprecated and out of scope, so no row asserts it.
- 🔴 **The mutation lesson worth keeping**: editing a parsed `ExportIR`'s *parameter* does not move
  `sourceText`, which the **parser** writes from that same parameter. The first draft of these
  rows did exactly that and watched the original mapping come back in the comment. The rows now
  re-parse a patched copy from disk, so the two agree the way they always do in production.

---

## §28 The components with nowhere to put a comment, and a note that pointed at the smallest case (session 57, 2026-08-30)

Session 56 closed §27 with two items owned by `NONE`. Both are answered here — one by building,
one by measuring and deciding it needed no build.

Picker coverage is unchanged at **69/127 (54.3%)**, correctly: no node type gained a translation.

### §28.1 §27.6, closed — the report carries what no module can

§27's sweep runs at the bottom of `planComponent`, which the two early returns never reach. So a
`Script` node in a **logic-only** component, or beside the **router shell**, kept losing its code
entirely: the export named the node and preserved nothing, which is the sentence §27 was written
to stop it saying.

**The decision §27.6 left open was between the report carrying the source and a component that
emits nothing gaining somewhere to put it.** The report, for three reasons:

- A component that emits nothing has, by definition, nowhere for a comment to sit. Giving it a
  module means emitting a file nothing imports — a worse artefact than the hole.
- The report already carries every other refusal for exactly these components.
- 🔴 **The identical shape was already closed once, at the same early return.** The
  record-neighbour sweep has a line in `plan.ts` explaining that it returns before the bottom
  sweep, so a relation verb in a logic-only component would fall through. Same return, same
  reason, one sweep over.

The sweep became `sweepRefusedScripts()` and is called at all three exits.

🔴 **Which carrier holds a script is decided by whether a file exists, never by a filter.**
`emitApp` fills `ReportComponent.preservedScripts` in its skip branch and only there; the
emitting branch leaves it unset because `refusedScriptLines` has already written the script into
the module. The two consumers sit on opposite sides of `plan.file`, so "exactly one copy" is
structural rather than a condition that could drift.

### §28.2 🔴 The report could have said "Nothing" while a script vanished

`nothingToReport` gated the whole "what needs your attention" half on three terms —
`attention`, `deferred`, `modules`, `project`. A script-bearing node beside the **router shell**
is `scaffolded`, which lands in the *what worked* half and in none of those terms.

Measured, not argued: `reading-shelf` unmutated reports **"Nothing. Every node and every wire in
this project had a translation, and the export refused none of them."** Add a `Javascript2` beside
its router and, without the gate, that sentence is unchanged while the script is nowhere in the
export. The gate now counts preserved scripts, and the row that names this reddens without it.

⚠️ A preserved script is author content and a fence is markup — `commentSafe`'s hazard in a
second output format. `longestBacktickRun` opens the block with one more backtick than the script's
longest run, so a body containing ``` cannot close it early.

### §28.3 What proves it

- **`tsc --noEmit`** 0; **jest 1081/1081 in 43 suites** (1076/43 before — 5 new rows); both ledger
  gates OK; picker unchanged at 69/127.
- 🔴 **The corpus population is empty, and that was measured before the rows were written.**
  36 components across the seven fixtures, **8** emitting no file, **4** carrying `sourceText`,
  and **0** of those 4 inside a skipped component. So the corpus is this rule's *zero control*,
  never its subject, and the rows are graded on components written into a temp copy.
- 🔴 **Three mutants, and the disagreement is the finding.**

  | Mutant | Preservation rows | Duplicate CONTROL | Corpus CONTROL |
  |---|---|---|---|
  | `sweepRefusedScripts()` removed from both early returns | 🔴 **3 red** | 🟢 green | 🟢 green |
  | emitting branch *also* fills `preservedScripts` | 🟢 green | 🔴 **red** | 🟢 green |
  | `nothingToReport` stops counting preserved scripts | 🔴 **1 red** (router shell) | 🟢 green | 🟢 green |

  Anchors were asserted before replacement in each.
- ⚠️ **The first restore was from the pre-fix snapshot and silently reverted the fix**, which the
  suite then reported as green — a snapshot taken before a change is not an undo for a *mutant*
  applied after it. Caught by re-running; the fix was re-applied and re-measured.
- 🔴 **The suite count is the honest reading, not the test count.** The full run said **44 suites**
  where 43 were expected: a scratch probe left in `tests/`. `1082 − 1076 = 6` against 5 rows
  written reconciled it exactly. Delete the probe, and the number is 1081/43.

### §28.4 §26.4's `mood2?: any` — measured, and not a defect

§26.4 recorded, uninvestigated: *"`array-vocabulary` emits `mood2?: any;` for a minted `Model2`
prop, so a typecheck row over that graph would grade nothing at the prop."* True, and the `any` is
correct. The note pointed at the **smallest instance of a wider honest refusal**.

The census across all seven fixtures — **20 emitted props, 11 of them `any`, 9 `string`**:

| Population | Count | Why `any` |
|---|---|---|
| Declared `Component Inputs` ports | **10** | Every one declares port type `"*"` — the editor's wildcard. `tsTypeOf` maps it to `any` because the author stated no type. `PuppyCard`'s five ports declare `"string"` and emit `string`. |
| The minted `Model2` row prop | **1** | The row's shape is not stated by the graph, and both ends refuse consistently: `collection-get`/`list-map`/`list-filter` resolve to `any[]`, each with a written reason. |

🔴 **Only one of the eleven is the minted prop §26.4 named.** And the fixture that carries a real
collection schema (`puppy-test-3` — the other six declare no `metadata.dbCollections`, matching
the 32-of-39 figure the code already records) is exactly the one whose ten `any` props are
wildcard-typed, so the schema could not have helped them.

So: a typecheck row over an emitted component interface grades **9 of 20** prop positions today,
and the other 11 are positions the graph itself leaves untyped. Nothing to fix; the item is closed
with a denominator rather than left open a second time. Owner was `NONE`.

## §29 The button in a list row, which exported as a button that does nothing (session 58, 2026-08-30)

The session began where §28.5 pointed — the collection-state slice, whose two picker nodes both
defer on *"which row fired is not statically expressible"*. That sentence did not survive being
read against the runtime it describes. What it was hiding was not a missing feature but a
**silent loss**, in the most common interaction a list has.

### §29.1 🔴 The recorded blocker was wrong about its own runtime

`Remove Object From Array` and `Set Object Properties` both defer, and both reasons lead to the
relay gate: a repeater's row outputs *"cannot reach the page at all yet"*. The gate is still in
the code at HEAD, so the refusal is current rather than stale — but `foreach.tsx` says otherwise:

```js
itemOutputSignalTriggered(name, model, itemNode) {
  this._internal.itemActionItemId = model.getId();   // ← the runtime NAMES the row
  this._internal.itemActionSignal = name;
  this.flagOutputDirty('itemActionItemId');
  ...
  this._internal.itemOutputs[key] = itemNode._outputs[key].value;   // ← and snapshots ITS values
  this.sendSignalOnOutput('itemOutputSignal-' + this._internal.itemActionSignal);
}
```

The runtime publishes which row fired, as `itemActionItemId`, and the relayed values are that
row's, snapshotted at signal time. And on the emit side the question is never even asked: each
row is `<NoteRow …/>` inside a `.map()`, so its callback closes over its own `item`. **The
sentence was true of neither end.** It had been repeated across ten sessions.

🔴 **This is the "check the tense" trap in its sharpest form.** The recorded mechanism was not
stale and was not the wrong runtime's — it was an *under-reading of this one*, which no amount of
re-reading the task file would have corrected. Only opening `foreach.tsx` did.

### §29.2 🔴 What the refusal was hiding: a wire planned, claimed, and then discarded

Probing the three relay shapes against the emitter found something worse than a deferral. With a
delete button in `NoteRow` and its `removed` signal relayed to a `Clear Array` on the page:

| Shape | Before | Report said |
|---|---|---|
| relayed signal → the page's `Component Outputs` | deferred, named | the deferral |
| **relayed signal → an action chain** | **nothing emitted** | **`notes: []`** |
| **the repeater's own `itemsRendered` → an action chain** | **nothing emitted** | **`notes: []`** |
| `itemActionItemId` → a Text | deferred, named | the deferral |

The two middle rows are the defect. `plan.handlers['notesList']['itemOutputSignal-removed']`
was populated correctly — the action compiled, `{kind:'collection-clear', collectionName:'notes'}` —
and the sink was dispositioned **`{kind:'collapsed', into:'notesList'}`**. The plan therefore
*affirmatively claimed the node was translated, into the repeater*. `renderRepeater` then never
read `plan.handlers` at all.

🔴 **A delete button in a list row exported as a button that does nothing, and the export report
said nothing needed attention.** Not a gap in the report's wording — the report was told the node
was fine.

🔴 **The absence was only worth believing beside a firing control.** The same `Clear Array`, driven
by an ordinary page button, emits `notes.clear();`. That is what separates "the relay is dropped"
from "the sink does not translate", and they have opposite fixes.

### §29.3 What was built

- **`rowSignalAttrs` in `renderRepeater`** — a relayed `itemOutputSignal-<name>` becomes the
  template's own callback prop on the row element, spliced into all **four** feed branches
  (static data, list expression, named collection, query). `<NoteRow … onRemoved={() => notes.clear()} />`.
- **The `outputSinkOf` gate corrected** — a relayed row signal into the parent's own output now
  translates (`onRemoved={() => onRowGone?.()}`); what still refuses is a port that is *not* a
  relayed row signal, and the reason now says that instead of the disproved sentence.
- **`ITEM_OUTPUT_SIGNAL` / `ITEM_OUTPUT_VALUE` in `ir/types.ts`** — the runtime's own prefixes,
  shared because the plan gates on them and the emitter strips them.
- **Nothing is lost in silence.** A repeater's own pulse, and a relay whose template declares no
  such output, are both named in the report.

⚠️ **One runtime nuance deliberately not reproduced**: `hasScheduledTriggerItemOutputSignal`
coalesces two rows firing in the *same frame* into one pulse. Per-row callbacks run both. Two rows
cannot be clicked in one frame, so only a programmatic fire reaches the divergence. Recorded
rather than papered over.

### §29.4 What proves it

`tests/repeater-row-signals.test.ts`, 14 rows — and three mutants, because a suite that cannot go
red grades nothing:

| Mutant | Killed |
|---|---|
| the fix removed from all four feed branches (the original defect) | **9 of 12** |
| the `itemOutputSignal-` prefix guard removed | **exactly the 4 lifecycle rows** |
| a callback emitted even when nothing relays | **exactly the negative control** |

🔴 **The negative control is what makes the rest mean anything** — a template that declares
`removed` while the repeater relays nothing must get **no** attribute, or every positive row above
would read identically for an emitter that always emitted one.

🔴 **A `toContain` passes on dead code** (§24.3), so the slice is graded by `typecheckEmittedApp`
as well: the emitted app **compiles**, and `NoteRow.tsx` really declares `onRemoved?: () => void;`.
The two ends agree by construction rather than by assertion.

Gates: **jest 1095/1095 in 44 suites** (was 1081/43), **tsc 0**, picker **69/127**, ledger check
175 types. The picker number is unchanged and correctly so — this fixed a *wire shape* on a node
that already translated, not a node type.

### §29.5 What this leaves

- **The collection-state slice is no longer blocked on what §7.3 said it was.** `Remove Object
  From Array` needs an Object Id from inside the row; the row's identity now reaches the page in a
  callback, so the next session should re-derive that node's disposition from the code rather than
  from the recorded reason — which is exactly what this session had to do.
- **`itemActionItemId` still defers, and that reason did survive**: it is read as a *value*,
  continuously, and its value is whichever row fired last — state the emitted list does not hold.
  A row in the suite pins this so §29 is not read as having translated the whole node.
- **The repeater's lifecycle pulses (`itemsRendered`, `done`, `completed`, `failure`) are
  `effect()` work** — now reported rather than lost, but still not translated.
- 🔴 **No fixture carries a row with a button in it.** The suite builds the shape by hand onto
  `cheer`'s `NoteRow`. A fixture that has one would put this shape under the corpus audit and the
  emitted-typecheck sweep permanently, and is worth an hour.
- ⚠️ **Not driven in a browser this session.** The slice is graded by compile + mutants, and the
  callback-prop end of it (`NoteRow` calling `onRemoved`) is the Component Outputs slice's, which
  §10 drove. A drive of a list with a working delete button is still owed.

---

## §30 The node the disproved sentence was blocking, and the fix that could not fire (session 59, 2026-08-30)

**69 → 70 of 127 (54.3% → 55.1%).** `pickerCoverageFloor` raised in the same commit.

§29 disproved the sentence two nodes were deferring on and asked the next session to re-derive
their dispositions **from the code rather than from the recorded reason**. Doing that translated
one of them — and then a fixture built to protect §29 found that **§29's own fix could not fire
on a real project.**

### §30.1 `Remove Object From Array`, and why it needs no id

§7.3 blocked it on *"it needs an Object Id, and in a list an author actually builds that comes
from inside the repeater row — which cannot reach the page at all yet"*. The first half is true
and is what the translation is built on; the second half was §29's disproved sentence.

`foreach.tsx` publishes the firing row as **`itemActionItemId`** — `model.getId()`, set
*synchronously* before the `itemOutputSignal-<name>` pulse is scheduled. So the wire an author
draws, `Item Id → Object Id`, is not a value this slice has to hold state for: it is a *name for
the row whose callback the emitted code is already standing in*. The emitted form spells no id
at all:

```tsx
{notesItems.map((item, index) => (
  <NoteRow key={index} text={item.text} onRemoved={() => { notes.remove(item); lastAction.set('Removed a note.'); }} />
))}
```

Three gates, and each is a way the emitted call would otherwise be silently wrong:

1. the Array Id is a literal name with an emitted module (`Clear Array`'s gate);
2. exactly one wire feeds `Object Id`, and it is a `For Each`'s `itemActionItemId`. The action is
   then **valid in one place only** — `actionsValidIn` refuses it unless the handler is that same
   repeater's `itemOutputSignal-*`. `ExprContext`'s `dom` variant gained a `port` for this: a
   chain hung off the same repeater's `itemsRendered` is the list's own progress and names no row,
   and `nodeId` alone cannot tell the two apart;
3. **that repeater must repeat the very array being written.** `Collection.remove` is `indexOf` —
   reference equality — so a repeater fed by a mapped list (`.map((row) => ({…}))`, a fresh object
   per row) or by a different array would emit a call that removes nothing at all. A *filtered*
   list would happen to work, since `.filter` keeps the references; it is refused anyway, because
   "happens to work" is not a property this compile can read off an expression.

🔴 **Neither `Failure` nor `Unchanged` can fire once those hold, and it is measured rather than
assumed.** Failure's three causes (`collectionnode-remove.ts`) are answered by gates 2, 1 and —
for "an Object Id nothing has loaded" — `Model.exists`, which answers from both registry tiers
for as long as something holds the record, which the collection does. `Unchanged` needs
`contains(model)` false, and gate 3 makes the row a member by construction. Both wires are
**dropped with a note**, exactly as `Clear Array`'s dead `Failure` is.

⚠️ **The §29 divergence recurs here and now moves data rather than a pulse.**
`hasScheduledTriggerItemOutputSignal` coalesces two rows firing in one frame into a single pulse
carrying the last row's id — the interpreter would remove one row where the emitted app removes
both. Two rows cannot be clicked in one frame.

### §30.2 `Set Object Properties` — re-derived, and still blocked, for a different reason

The prompt warned against assuming §29 unblocked both, and it had not. Read against the code:

- **Inside the row** (`idSource = foreach`) it is still §4's line exactly: the write is the
  enclosing list's state, and the row is a template that receives props.
- **From the page** (`Id ← Item Id`, fired by a relayed row signal) the *id* now resolves — that is
  what §30.1 does. What does not resolve is the **value**: in every shape an author builds, the
  new value comes from a control *inside* the row, and a row's value reaches the page only as
  `itemOutput-<name>`, a continuous read of "whichever row fired last" — the one port §29
  measured and left deferred. **The blocker moved from identity to value; it did not go away.**
- ⚠️ And a third thing, for whoever builds it: `Collection.updateWhere` **replaces** the row
  object, so `item` goes stale for anything later in the same chain. A write followed by a removal
  in one handler would remove nothing.

The recorded reason in `dispositionForLogic` and in the ledger now says this instead of the half
of it that was written down.

### §30.3 🔴 The fixture found that §29 could not fire on a real project

§29 closed by asking for a fixture carrying a row with a button in it, because the suite built the
shape by hand. `tests/fixtures/note-desk` — Note Desk, three components, a delete button per row —
was authored for that, and its **first export refused the wire**:

```
wire noteList:itemOutputSignal-removed->removeNote:remove dropped: the trigger is not a rendered
element event or a receiver
```

A relayed row signal is a **dynamic port**: `registerOutputIfNeeded` mints
`itemOutputSignal-<name>` at runtime, so it is in no catalog, and dynamic ports are derived rather
than persisted, so it is in no project file either. `resolveSourcePortKind` — correctly refusing
to guess `'signal'` — answers `'value'`, and the wire fell out of the handler branch.

🔴 **Every row of §29's suite passed over this**, because the test helper `wire()` *declares* the
connection a signal. The fix was real and the grading was on a population the defect could not
appear in. The escape hatch added is the `instanceSignal`/`customSignal` rule one node type over —
the definition decides, not the parse — and the runtime is unambiguous: the registration hands
back a getter that returns nothing and the port is pulsed with `sendSignalOnOutput`.

🔴 **The absence was read beside a firing control**: `portKind('For Each','itemsRendered')` is
`'signal'` and `portKind('For Each','itemOutputSignal-removed')` is `undefined`, in the same
assertion — so this is a gap in what the parse can *see*, not a resolver that answers `'value'`
for everything.

A second, older hole surfaced in the same work: **`scanActions` never descended into an array
mutator's chains**, so a popup opened from a `Clear Array`'s Done chain never earned its slot
registration. §17.3's shape — not a switch that stops compiling, a walk that quietly stops
walking. Fixed for both mutators, and graded by a row that goes red without it.

### §30.4 What proves it

`tests/collection-remove.test.ts`, 20 rows, and **six mutants**, because a suite that cannot go
red grades nothing:

| Mutant | Killed |
|---|---|
| the validity gate answers true everywhere | the 2 negative controls (page button, lifecycle pulse) |
| only the **port** half of the gate removed | **exactly** the lifecycle-pulse row |
| gate 3 (the repeater must repeat this array) removed | **exactly** the 2 feed rows |
| `scanActions` no longer descends a `Clear Array` chain | **exactly** the `clear` popup row, not the `remove` one |
| a row callback emitted for any port (§29's guard) | 4 rows across both suites |
| the `repeaterRowSignal` escape hatch removed (**§29 as shipped**) | **exactly the 2 from-disk rows, and no hand-built row** |

The last one is the finding stated as a measurement: the in-memory rows are *blind* to it, which
is what a fixture buys.

**And it was driven.** The built export served by `vite preview`, in headless Chrome over CDP,
reading `textContent` back after real clicks — expected answers written down first:

```
boot                  rows []                        status ""
add alpha/beta/gamma  rows ["alpha","beta","gamma"]   status ""
delete MIDDLE (beta)  rows ["alpha","gamma"]          status "Removed a note."
delete last  (gamma)  rows ["alpha"]                  status "Removed a note."
delete only  (alpha)  rows []                         status "Removed a note."
console errors        []
```

🔴 **The middle row is the whole measurement.** Deleting the first or the last reads identically
for an emitter that removed `notesItems[0]` — a reading that fits rather than one that excludes.
The sabotage arm (`notes.remove(item)` → `notes.remove(notesItems[0])`, rebuilt and re-driven)
reads `["beta","gamma"]` at that step, exactly as written down beforehand.

⚠️ **One reading was wrong before it was right, and the fix was in the instrument.** The status
line read `""` on every step because the reader asked for "the last `<p>` with no button beside
it" — and the status `<p>`'s parent is the page div, which holds the Add button. The DOM said
`Removed a note.` all along. Probing before reporting is what separated a broken reader from a
Done chain that does not fire.

Gates: **jest 1131/1131 in 45 suites** (1095/44 before), **tsc 0**, picker **70/127**, ledger
check 175 types.

### §30.5 What this leaves

- 🔴 **CORRECTED by §33.1** — the bullet below ranks a port that gates **zero** wires the exporter
  can reach: all 14 authored `Set Object Properties` sit *inside* a row, never on a page, so the
  blocker every real instance meets is §4's. Original text kept as written:
- 🔴 **`itemOutput-<name>` — a relayed row *value* — is now the single port standing in front of
  the rest of the collection-state slice.** It blocks `Set Object Properties` (§30.2) and it is
  what `itemActionItemId` read as a value still refuses. Inside a row callback the value is
  knowable only when the template's output is a pass-through of a prop; in general it is the row's
  own local state, which the parent cannot see. Whether the pass-through case is worth carving out
  is the next design question in this area, owned by **`NONE`**.
- ⚠️ **Two more fixtures' worth of population is still unreached.** `note-desk` closes "a row with
  a button in it"; §26.1's list of what no fixture has still holds for `PageInputs`, a braced
  `urlPath`, an `External Link`, a `Navigate To Path`, an untyped store key, and a wire into a port
  that already carries an authored value.
- ⚠️ `Create New Array` and `For Each Actions` remain deliberately out of scope, and both reasons
  survived this session's reading unchanged.

## §31 The sweep §30.3 asked for, and the branch that was telling nine projects the wrong thing (session 60, 2026-08-30)

**70 of 127 (55.1%), unchanged.** No node was translated this session; a refusal that was
misdescribing the author's own graph now describes it.

§30 closed by asking for a deliberate sweep of the §30.3 defect class — *a dynamic port is
invisible to the parse, and the exporter has more than one* — graded **from disk** rather than
from a hand-built IR. That sweep came back clean, and the thing it found on the way was a
different defect standing in the same place.

### §31.1 The sweep, and the shape of its answer

Three prongs, because "which translations gate on a port kind" has three answers:

1. **`ConnectionIR.kind` has exactly one consumer in the whole exporter** — the handler branch in
   `plan.ts`. It already carries all three escape hatches (`instanceSignal`, `customSignal`,
   `repeaterRowSignal`), so there is no second gate to have missed one.
2. **`catalog.portKind` has exactly one caller** — `resolveSourcePortKind` itself, which *is* the
   fallback site. Everything else that classifies a port reads `declaredPorts`, and those are
   persisted in the project file, which is the property the defect needs to be absent.
3. **The population itself.** A probe replicating `resolveSourcePortKind`'s three checks was run
   over the 8 fixtures and ~60 projects under `NodeGX test projects`, listing every connection
   that reaches the `'value'` fallback because neither the node's own ports nor the catalog knows
   the source port. That is the complete set of places the defect can live.

🔴 **The probe was calibrated on a known-firing case before it was believed**: it re-found
`note-desk`'s `itemOutputSignal-removed` — §30.3's defect — unprompted. Its output classifies as:

| Fallback port | Verdict |
|---|---|
| `For Each` `itemOutputSignal-*` (10 wires, 7 projects) | a real signal — **covered by §30.3's fix** |
| `Logic Builder` `ok` / `bad` (8 wires, 4 projects) | real signals, **deliberately** deferred through `detectIO` with named reasons — not blind |
| `DbModel2`/`Model2` `prop-*`, `net.noodl.HTTP` `out-*`, `ComponentObject` `value-*`, `JavaScriptFunction` outputs, `Event Receiver` `message` | genuine values — the fallback is the right answer |
| `For Each` bare relay names, `SetModelProperties` `stored` | **wires from ports the runtime never registers** — see §31.2 |

**So: the exporter holds no unfound instance of the §30.3 class.** ⚠️ **A third limit, added by
§33.2:** the probe read all 101 corpus directories, **40 of which are a classic `project.json`
that `parseProject` cannot open at all** — the conclusion holds, the counts read wider than the
exporter's reach. ⚠️ Stated with its limit — the
probe reads *source* ports on projects that exist on disk. A catalog that disagreed with the
runtime about a port it *does* declare would not appear in it, and neither would a target-side
port; both are different questions from the one §30.3 raised.

🔴 **§30.3's fix has real reach, and that was measured rather than inferred.** Re-exporting
`cn027-drive` shows `itemOutputSignal-Selection Changed` now dropped for a *downstream* reason
(its script reads the Noodl API — Tier B) instead of being swallowed by the handler gate. The fix
was graded on one fixture; it fires on real projects.

### §31.2 🔴 One branch, two populations, and a sentence true of only one

A wire out of a `For Each` that is not an `itemOutputSignal-<name>` relay was refused as *"the
repeater's own pulse — it fires from the list's own progress rather than a row, which is effect()
work this slice does not translate"*.

That is exactly right for `itemsRendered` and the outcome signals. It is **false** for a bare
relay name. `registerOutputIfNeeded` (`foreach.tsx`) registers only `itemOutputSignal-<name>` and
`itemOutput-<name>`, and **returns having done nothing for anything else** — so `addToBasket` on a
repeater is not a lifecycle pulse, it is *no port at all*, and the wire is dead in the editor too.

🔴 **The two readings ask the author for opposite things.** One says *wait for a later increment
of the exporter*; the other says *go and re-draw a wire that has never worked*. Telling an author
the first when the second is true is the more expensive error of the two, because it recommends
patience for a bug.

⚠️ **The population is real, and lopsided.** The same from-disk sweep counted **26** such wires in
**9** projects — `cn027-drive`'s "add to basket" and "browse" among them, which is that site's
primary call to action — and **zero** wires drawn from a genuine list-level pulse anywhere in the
corpus. Every occurrence this branch had ever met in a real project was getting the wrong sentence.

Which arm applies is now read **off the catalog** rather than restated in code (the Rise lesson):
a port the catalog declares is a real output; a dynamic one is known by the runtime's own two
prefixes; anything else is not a port.

⚠️ **The hand-built row that should have caught it asserted the defect instead.** `component-outputs`
§4 wired a bare `waved` off a repeater and asserted *"is not a row's relayed signal"*, its comment
reasoning that a bare name *"can only be one of its own pulses"* — the one step that does not
follow. The row is corrected and renamed, and it is the second time in two sessions that a
hand-built IR row has been the thing standing between a defect and its discovery.

### §31.3 What proves it

`tests/fixtures/relay-desk` — `note-desk` plus a `NoteList` component whose repeater carries
**both** arms out to Component Outputs: a bare `removed`, and a real `itemsRendered`. Parsed off
disk, so neither arm can be satisfied by a hand-made IR. `tests/foreach-relay-ports.test.ts`, 5
rows, and **two mutants that disagree**:

| Mutant | Killed |
|---|---|
| the discriminator answers "registered" everywhere | **exactly** the 2 bare-name rows |
| the discriminator answers "not registered" everywhere | **exactly** the 2 lifecycle rows |

The disagreement is the finding: one predicate, two populations, each row pinned to its own.
Both mutants typecheck (`tsc` exit 0 on each), so neither result is a `Tests: 0 total` in
disguise. The control lives inside a row rather than beside it — `portKind('For Each',
'itemsRendered')` is `'signal'` and `portKind('For Each','removed')` is `undefined`, asserted in
one breath, so this is a discriminator and not a predicate that answers the same way for
everything.

The fixture also joins the five whole-corpus sweeps (emitted syntax, typecheck, markers, README,
preflight) automatically, which is the first coverage any of them have of **a project containing a
wire the author drew wrong**.

Gates: **jest 1153/1153 in 46 suites** (1131/45 before), **tsc 0**, picker **70/127**, ledger check
175 types.

### §31.4 What this leaves

- 🔴 **A product finding this phase cannot close, owned by `NONE`.** Two families of wire in real
  projects point at ports the runtime does not register: a `For Each`'s bare relay names (26
  wires, 9 projects) and `SetModelProperties`'s `stored` (8 wires, 5 projects — `stored` was
  renamed to the shared `done` by ERG-001 §4, which migrated `library/prefabs`' seven connections
  but could not migrate anybody's project). In both the author's graph looks wired and does
  nothing. **What was measured is that the port is unregistered; what was *not* measured is
  whether the editor warns about it** — that check is the first thing whoever picks this up should
  do, because it decides whether this is a silent failure or a reported one.
- ⚠️ `itemOutput-<name>` — §30.5's relayed row *value* — is untouched and remains the single port
  in front of the rest of the collection-state slice.
- ⚠️ The two sweep limits in §31.1 are unexamined by anything: a catalog/runtime disagreement over
  a *declared* port, and the target-port side of the same question.

## §32 The question §31 left for the editor, and the prefix that was a claim rather than a fact (session 61, 2026-08-30)

**70 of 127 (55.1%), unchanged.** No node was translated this session. §31 asked whoever picked up
its `NONE`-owned finding to check one thing first — *does the editor warn about these wires?* — and
that check both answered the question and found a third family standing in the same place.

### §32.1 The answer: the editor reports it, measured in the editor

**Yes.** `evaluateConnectionHealth` (`NodeGraphModel.ts:757`) raises `con-no-source-port` —
*"Source port doesn't exist."*, `level: 'error'`, `showGlobally: true` — for every one of these
wires, on project open, **without navigating to the affected component**. The count reaches the
author: the topbar renders an amber **1** (`titlebar.ts` sums `showGlobally` warnings), and
PNL-006's per-component dot uses the same source.

So §31.4's finding is **not a silent failure**. That disposition is settled and the phase-sized
version of it can be struck.

🔴 **What is still true, and is the useful half:** the surface that reports it cannot say what to
do, and the surface that could say it never speaks.

- The **editor health warning** fires, with a generic sentence and no suggestion.
- The **validator** (`rules/nonexistentPort.ts`) has `suggestPort` and an alternatives list, and
  **abstains** — `catalog.isDynamicNode('For Each')` is true, and legitimately so: the catalog
  records its mechanisms as `["declared-port-groups","runtime-discovered"]`. So the AI/MCP write
  path that authored these wires got nothing, which is why they exist at all.
- ⚠️ FIX-007 §fix-3 already named where a real fix would go — *"an eleventh check in
  `authoredPreconditionDiagnostics`, which has `catalog` and needs no loaded NodeLibrary"* — and
  LAS-012's `repeaterTemplate.ts` is a precondition of exactly that shape for the sibling defect,
  built because `NormNode` carries no `parameters`. The design question is answered; only the
  building is open. Still owned by **`NONE`**.

### §32.2 🔴 The control failed, and the failure was the finding

The drive was set up as a discriminator: in `cn027-drive`, two bare relay names against
`itemOutputSignal-Selection Changed` as the arm that should stay clean. **All three warned.**

The reason is not that the check is noise. Asking the editor what ports the node actually has:

| Node | port the editor registers | the wire says |
|---|---|---|
| `FeaturedProducts.repeater` | `itemOutputSignal-addToBasket` | `addToBasket` |
| `Multi Choice` repeater | `itemOutput-Selection Changed` | `itemOutputSignal-Selection Changed` |

`_managePortsForNode` (`foreach.tsx`) reads the **template component's** output ports and mints
`itemOutputSignal-<name>` for a **signal** and `itemOutput-<name>` for anything else.
`/Filters/Multi Choice/Item` declares `Selection Changed` as type `*`, so the signal-prefixed port
was never registered. My control was a **third instance of the same defect**, drawn from the very
population being searched — the boundary was never tested.

✅ A real control was then run on `relay-desk`, whose repeater carries a static `itemsRendered`
beside the bare `removed`: **one warning in the whole project**, on `removed` alone. Same node,
same component, same pass.

🔴 It also corrects §31.1's own table, which classified `itemOutputSignal-*` (10 wires, 7 projects)
as *"a real signal — covered by §30.3's fix"*. At least twelve of them are not real signals at all.

### §32.3 The census, corrected, and what the "9 projects" was

A from-disk sweep over the fixtures and every project under `NodeGX test projects`, reproducing
`_managePortsForNode`'s rule and **calibrated against the editor's own `getPorts()` first`**:

| Verdict | wires |
|---|---|
| `OK` | 43 |
| `BARE-NAME` — the name without the prefix | 19 |
| `WRONG-PREFIX` — signal prefix over a value output | 12 |
| `NO-TEMPLATE` — repeater with no template at all | 8 |

**39 of 82** For Each output wires name a port that does not exist.

⚠️ **The `NO-TEMPLATE` rows are already owned** — LAS-012's `repeaterTemplate.ts`, and
`phase55-s6-haiku` is the project in its own docblock. Not a new finding; struck from the count.

🔴 **And the spread is an artefact of copying.** `md5` on
`components/Components/FeaturedProducts/connections.json` is **byte-identical across all nine**
projects carrying the `addToBasket`/`browse` pair. §31.4's *"26 wires in 9 projects"* is true and
reads as nine independent authors making one mistake; it is **one authored graph copied nine
times**. The honest count of distinct authoring mistakes is ~3 graphs. That is an argument about
priority, and it belongs beside the number.

### §32.4 The defect this phase could close, and did

The exporter trusted the `itemOutputSignal-` prefix on sight — `repeaterRowSignal` (`plan.ts`)
tested the string and nothing else. So a wire whose template contradicts the prefix passed the gate
as a genuine relay and was refused **downstream**, for its target: in `cn027-drive`,
*"the script reads the Noodl API — Tier B"*.

🔴 **That sentence is §31.1's own evidence that §30.3's fix "has real reach".** It is true of the
target and it sends the author to wait for an increment of this exporter, after which the wire
would still not fire. A dead source port outranks every downstream reason — §31.2's lesson, one
layer along, and the third session running in which a recorded row asserted a reason true of a
different population.

The gate now reads the kind off the **template's own declaration**, before the action compiles.
`cn027-drive` re-exported says instead: *"the row template declares "Selection Changed" as a value,
so the runtime registers "itemOutput-Selection Changed" and never "itemOutputSignal-Selection
Changed" — this wire names a port that does not exist, and never fires in the editor either."*

⚠️ **Deliberately narrow.** Only the `value` arm. A template declaring no such output at all is
already reported by `rowSignalAttrs` on the emit side, which names the template component — the
better sentence — and §29's rows pin it. The first cut intercepted that too and broke two of them;
the census says **zero** corpus wires have that shape, so widening would have traded a better
message for a worse one to serve nobody.

### §32.5 What proves it

`relay-desk` gains a third arm — `NoteRow` declares a **value** output `noteId` beside its signal
`removed`, and the repeater carries `itemOutputSignal-noteId` out to Component Outputs. Parsed off
disk, so no hand-built IR can satisfy it. `tests/foreach-relay-ports.test.ts` gains 5 rows, and two
mutants that disagree:

| Mutant | Killed |
|---|---|
| the kind reads `'signal'` everywhere (guard never fires) | **exactly** §32's 3 positive rows |
| the kind reads `'value'` everywhere (guard always fires) | **8** rows across §29/§30/§31/§32 — every genuine relay |

Disjoint kill sets; both mutants typecheck, so neither is a `Tests: 0 total` in disguise. The
control lives inside a row: `NoteRow` declares one signal output and one value output, asserted in
one breath.

⚠️ **Mutant A also caught a bad row of mine.** *"It is not refused for a downstream reason"* was
three `not.toContain`s, and under the mutant it passed on a note that never fired — an absence
asserted with no known-firing signal beside it. A positive anchor was added; it now dies with the
others.

Gates: **jest 1158/1158 in 46 suites** (1153/46 before), **tsc 0**, picker **70/127**, 46 test
files on disk.

### §32.6 What this leaves

- 🔴 `itemOutput-<name>` — §30.5's relayed row *value* — is still the single port in front of the
  rest of the collection-state slice. Untouched. — **CORRECTED by §33.1: zero exportable wires.**
- 🔴 The `NONE`-owned product finding is now **scoped**: not "the editor hides it" but "the write
  path that authors it cannot see it, and the surface that reports it cannot advise". The place to
  fix it is named in §32.1.
- ⚠️ §31.1's two sweep limits remain unexamined: a catalog/runtime disagreement over a *declared*
  port, and the target-port side. This session examined the source side only.

## §33 The carve-out §30.5 asked about, and the population it was standing in front of (session 62, 2026-08-30)

**70 of 127 (55.1%), unchanged. No node was translated.** The session's product is a measurement
that answers §30.5's question **no**, three recorded numbers corrected, and one scope fact that
applies to every from-disk sweep this phase has run.

§32 closed by naming `itemOutput-<name>` — a relayed row *value* — as "the single port in front of
the rest of the collection-state slice", and asked whether the **pass-through-of-a-prop** case is
worth carving out, because that would unblock `Set Object Properties`. The honest way to answer it
is to count what authors have actually drawn, so that is what this session did.

### §33.1 The answer: the carve-out is real, and it is worth nothing

The static fact §30.5 described **does hold** where it occurs. Corpus-wide there is exactly **one**
wire drawn from a correctly-spelled `itemOutput-<name>`, and its template output *is* a
pass-through of a prop:

```
fb020b-drive  /Card Grid   itemOutput-Title  (template output "Title" ← Component Inputs)
                                             → Component Outputs."Clicked Title"
```

That is one wire, in one project, and **the exporter cannot open that project** (§33.2). Over the
60 projects the exporter *can* parse, the count of `itemOutput-<name>` wires is **zero**.

🔴 **And the shape the carve-out was meant to unblock is built by nobody.** Every
`Set Object Properties` in the corpus — **14 nodes across 11 projects, without exception** — sits
**inside a repeater template**, not on a page:

| Host | Independent graphs | Copies | Format |
|---|---|---|---|
| `/Filters/Multi Choice/Item` | 1 | 8 (byte-identical, `md5 cbca43c8…`) | v2 |
| `/Cashflow/Row` | 1 | 2 (byte-identical) | classic |
| `fb020b-drive` `/Multi Select/{Dropdown/Option, Dropdown/Pill, List/Item, Pills/Item}` | 4 | 4 | classic |

**6 independent authored graphs; 6 of 6 inside a row; 0 on a page.** In the exportable half the
number is **1** independent graph. Its 24 wires are the same three every time:
`Model2.id → modelId`, `checkbox.checked → prop-Checked`, `checkbox.onChange → store`.

🔴 **So §30.2's sentence is half right in the way that misdirects.** It says *"in every shape an
author actually builds, the new value comes from a control inside the row"* — true, and the
**node is inside the row too**. The page-side shape it goes on to describe (`Id ← Item Id`, value
`← itemOutput-<name>`, fired by a relayed row signal) is the shape the recorded blocker guards, and
**no author in this corpus has ever drawn it.** The port ranked "single blocker in front of the
slice" gates nothing that exists.

The blocker in front of `Set Object Properties`, for every instance an author has actually written,
is the one §4 named and §30.2 listed *first* and then moved past: **the write is state the
enclosing list owns.**

### §33.2 🔴 Two in five "corpus" projects are a format the exporter refuses at the front door

`emit-app.ts` on `fb020b-drive` does not refuse a wire; it never gets that far:

```
Error: ENOENT: … /fb020b-drive/nodegx.project.json
    at parseProject (src/parse/parseProject.ts:66)
```

`parseProject` reads **`nodegx.project.json` only**. A classic `project.json` — the pre-0.2.0
format, which the editor imports rather than opens — is not a bad export, it is not an export at
all. Of the 101 directories under `NodeGX test projects`: **60 v2, 40 classic, 1 neither.**

This is very likely correct as product behaviour (a user's classic project is imported to v2
first; `fb020b-drive` still carries its `IMPORT-REPORT.md`). **It is a fact about this phase's
instrument, not about the exporter**, and it has been unmarked on every from-disk row since §30.3.
Split by format, s61's own census reads:

| | v2 (60, exportable) | classic (40, unparseable) |
|---|---|---|
| `For Each` output wires | 67 | 9 |
| `BARE-NAME` | 18 | 0 |
| `WRONG-PREFIX(sig→val)` | **8** | **4** |
| `itemOutput-<name>` | **0** | 1 |

🔴 **Correction to §32.3.** *"12 such wires sit in 10 project directories"* is arithmetically right
and reads one way too wide: **4 of the 12 are in `fb020b-drive`**, which the exporter cannot open,
and the other 8 are §32.3's own one-graph-copied family. The comment at `plan.ts:7874` says 12; it
now says which 8 the exporter can ever reach. This is the same shape §32.3 caught by `md5` — a
count that is true, over a population that is not the one the reader assumes.

### §33.3 §31.1's limit #1, measured — and it comes back clean on the exportable half

§31.1 left "a catalog/runtime disagreement over a *declared* port" explicitly unexamined, and both
§31 and §32 answered the port question by reading the **template**. But `resolveSourcePortKind`
(`parseProject.ts:313`) reads the node's own **`dynamicports` first**, and never consults the
template at all — so the two can disagree and nothing had compared them.

They were compared. Over the 60 v2 projects: **33 relay wires declared in `dynamicports`, 33
agree with the template, 0 disagree.**

⚠️ **4 disagreements exist and they are all in `fb020b-drive`** — `dynamicports` says
`itemOutputSignal-Selection Changed` is a `signal`, the template declares that output a value.
`dynamicports` is the loser: `_managePortsForNode` (`foreach.tsx`) mints ports from the
template's declarations, so the runtime registers `itemOutput-Selection Changed` and the persisted
record is a stale snapshot. It is an **imported** classic project, which is where a stale snapshot
would come from, and the exporter cannot read it. So the limit is real, its only instances are
out of reach, and §32's template-first gate is the right way round.

⚠️ **Also measured, and it is why this was not obvious:** dynamic ports **are** persisted, as
`dynamicports` on the For Each node, in 48 of the 62 projects that have a repeater. §30.3 recorded
*"dynamic ports are derived rather than persisted, so in no project file either"* — that is **false
as written**; what is true is that they are not persisted **in the fixtures**, which is where §30.3
was measuring. `note-desk` and `relay-desk` carry none, so every fixture row exercises the
fall-through path and none exercises the path 48 real projects take first.

### §33.4 The branch that still carries the sentence §29 disproved — and why it is left alone

`plan.ts:7211` refuses a `For Each → Component Outputs` **value**-port wire with
*"which row fired is not statically expressible in this slice"* — word for word the sentence §29
disproved for the id, and §31.2's shape exactly: one branch, several populations, a reason true of
one. It never looks at `fromProperty`, so a bare relay name (dead port), a lifecycle pulse, a
signal-prefixed value and a genuine `itemOutput-` all get the same sentence.

**It is left unchanged, deliberately, and the measurement is the argument.** Wires reaching that
branch: **v2 corpus 0, fixtures 0, classic 2.** All 18 exportable `For Each → Component Outputs`
wires go into **signal** ports and take the other path (`plan.ts:6979`), which §31 already split.
Changing behaviour here would need a new fixture arm for a shape no reachable project has — which
is the case §32.4 declined on its own census, for the same reason. The comment now records that the
sentence is the disproved one and that its population is empty, so the next reader inherits the
measurement rather than the sentence.

### §33.5 What proves it, and the reading that was wrong first

Four sweeps in the s62 scratchpad, all from disk, all reusable: `rowvalue_sweep.py` (row values and
where they come from), `declared_sweep.py` (is the relay port declared on the node),
`disagree_sweep.py` (dynamicports vs template; and every wire into a `SetModelProperties`),
`outsink_sweep.py` (the `plan.ts:7211` population). Plus `foreach_sweep_fixed.py` — s61's census
with the loader fix below.

🔴 **The first run of `declared_sweep.py` reported 9 wires, and 9 was a lie.** 69 of 101 projects
had thrown inside the loader and the handler wrote `ERR …` to a stderr file **that was not read**.
A per-project `try/except` in a sweep does not report an absence; it manufactures one, and the
number it prints is small, plausible, and shaped like a finding.

✅ **What caught it was running s61's census unmodified as a control first** — it reported **76**
against a recorded 76, so the corpus was reachable and my 9 was mine. This is
[[a-control-pair-proves-what-you-varied-only]] doing its job: without the known-firing arm beside
it, "only 9 relay wires exist in the whole corpus" is exactly the kind of clean result that gets
written down.

⚠️ **The crash itself is a parse fact worth keeping**: in some v2 components a node's `children`
holds **id strings**, not nested objects, so any walker must skip non-dicts. s61's loader never
flattened and so never hit it — and, checked directly, walking children changes the corpus count
**not at all** (76 either way), because every `For Each` sits at root level. s61's census needed no
correction on this point.

⚠️ **Instruments marked**: all of the above read **source** ports, on projects **on disk**, and
now report the v2/classic split. The target-port side (§31.1's limit #2) is still examined by
nothing.

Gates: **tsc 0**, **jest 1158/1158 in 46 suites**, picker **70/127 (55.1%)**, ledger 175 types,
46 test files on disk. No behaviour changed this session; comments and recorded reasons did.

### §33.6 What this leaves

- 🔴 **`itemOutput-<name>` should come off the top of the list.** It gates **zero** exportable
  wires. §30.5 and §32.6 both name it "the single port in front of the rest of the collection-state
  slice"; measured, it is in front of a shape nobody builds. Both entries are corrected in place.
- 🔴 **The shape actually in front of the slice is the row-owned write** (§4): a control inside a
  row writing onto that row's record — `checkbox.onChange → Set Object Properties.store`,
  `Model2.id → modelId`. **1 independent graph in the exportable corpus, 6 corpus-wide, 14 nodes.**
  Whether it translates is a real question and nobody has asked it against the code since §4; the
  emitted row already closes over its own `item`, which is the fact that unblocked §29 and §30.
  Owner **`NONE`** — and it is a design question (`Collection.updateWhere` **replaces** the row
  object, §30.2's third warning) rather than a wiring one.
- ⚠️ **Every from-disk row in this phase now owes a v2/classic split.** §30.3, §31.1 and §32.3 were
  all measured over a corpus 40% of which the exporter refuses at `parseProject`. None of their
  *conclusions* moves — checked, not assumed — but their counts read wider than they are.
- ⚠️ **No fixture carries `dynamicports`**, and 48 of 62 real projects with a repeater do. Every
  fixture row exercises the fall-through in `resolveSourcePortKind`; none exercises the branch real
  projects hit first. Cheap to close: one fixture arm.
- ⚠️ §31.1's limit #2 — the **target**-port side — remains examined by nothing.

## §34 The row §33.6 ranked first, and the hole its own report was standing in (session 63, 2026-08-30)

**70 of 127 (55.1%), unchanged. No node was translated, and a defect that had never been counted
was fixed.** §33.6 put the **row-owned write** at the top of the list. This session drove that
reading before building against it, which is the rule that has now paid five sessions running: the
recorded blocker is not the one that fires, and one screen further out the export was dropping
**73 of 73** deferred visual controls out of the generated code with nothing where they stood.

### §34.1 The real graph, and the gate that actually fires

Every `Set Object Properties` an author has drawn is one of two graphs, and the dominant one — 8
byte-identical copies, the single exportable independent graph — is `/Filters/Multi Choice/Item`:

```
Model2 (idSource=foreach, properties "Label,Checked")
  prop-Label   → checkbox.label
  prop-Checked → checkbox.checked
  id           → SetModelProperties.modelId
checkbox.onChange → SetModelProperties.store
checkbox.checked  → SetModelProperties.prop-Checked
SetModelProperties.stored → Component Outputs."Selection Changed"
```

🔴 **The `Model2` here has no `prop-` *input* at all**, so §5.4 — *"a row written from inside the
row is state the list owns"*, the sentence the ledger, `plan.ts:10100` and §33.6 all name as this
family's blocker — **never fires**. Read off the disposition rather than reasoned about, the gate
that fires is **§5.3**:

```
Model2 55bc9a45  deferred: Object 55bc9a45: its Id output is consumed,
                           and a repeater row has no id in the emitted app
```

The write is refused *because the read side already collapsed*, and it collapsed on the `id`
output, not on a write into the row. That is a different question with a different answer: §29 and
§30 established that the emitted row closes over its own `item`, and `Collection.updateWhere`
matches by predicate — so "which row" has a referent on this side that is **not** a string id. The
recorded blocker asks for an id the emitted app does not have; the shape may not need one.

⚠️ **Not built, deliberately** — it is still the design question §33.6 named (`updateWhere`
*replaces* the row object), and the measurement below turned out to be worth more. Owner **`NONE`**.

### §34.2 🔴 The reason is computed, stored, and shown to nobody

`model2ForeachGate`'s sentence goes into `dispositions` at `plan.ts:2173` with **no `notes.push`
beside it**. It reaches the report only when some *wire* resolution path happens to quote it. In
`/Filters/Range` it does (`wire … dropped: Object 57b6ed64: no For Each names this component as its
template`). In `/Filters/Multi Choice/Item` the consumer is a checkbox that defers first, so all
three wires fall to pass 6's `has no deterministic translation in step 5` and the computed sentence
is printed nowhere. The catch-all at `plan.ts:9591` cannot rescue it: it fires only on
`dispositions[id] === undefined`, and this node has one.

### §34.3 🔴 The finding: every deferred visual control vanished, and 1077 of its neighbours did not

`Item.tsx` exports as `<div className={styles.group} />`. The checkbox is **not** in the file, and
there is no marker saying it ever existed. A node with a defer reason never reaches
`plan.childrenOf`, so the emitter closes over the gap.

Measured over the **60 exportable** projects, in-process:

| | before | after |
|---|---|---|
| deferred visual nodes (`range`, `options`, `checkbox`, Radio Button, Radio Button Group) | 73 | 73 |
| **marked in generated source** | **0** | **70** |
| silent | **73** | **3** |
| *control:* node ids named in a `TODO(export)` marker in the same files | 1077 | 1155 |

✅ **The control is what makes the zero mean anything.** "marked = 0" reads identically if the
detector is broken; the export writing 1077 marked ids over the same corpus, through the same
detector, says the absence is real.

🔴 **This is EXP-010 AC3 — *"nothing dropped silently"*, ticked ✅ — holding for one population
only.** AC3 marked the child whose *type* could not be identified (a kit that failed to load).
Every identified-but-deferred visual child had the same hole, and the AC's own words cover it. The
fix widens the existing machinery: `markDroppedChild` now marks both, the unidentifiable case
keeping its own sentence because "a kit did not load" is something the node's reason cannot say.

### §34.4 ⚠️ The sentence that claimed the opposite of what the file showed

`visualDeferReason` ended *"— the structure renders, the value is not statically known"*. The
structure does **not** render; the node is left out entirely. Session 30 introduced that half to say
the wall is the *source* and not the port, which is right and is kept — but as written it told an
author to look for a checkbox that is not there. It now reads *"— the value is not statically known,
and the node is left out rather than drawn with a wrong one"*. Behaviour is unchanged: rendering a
control without its authored bound would be the export emitting a 0–100 slider where the app draws
the row's, which is what the defer is for.

### §34.5 The gate hole, and the three still silent

🔴 **The two rows pinning that sentence asserted `result.notes` and never `result.files`** — the
suite could not see that the claim was false, which is the [[a-gate-can-have-a-hole-shaped-like-the-defect]]
shape for the eighteenth time in this phase. Three rows now assert the emitted **file**, including a
discriminating one: a control that renders must **not** also be marked, or the marker stops meaning
anything.

⚠️ **3 of 73 are still silent, and they are a different defect.** All three are `options` nodes whose
ancestor chain runs through a **component instance** (`/Admin/Shell`): `walk` descends into an
instance's children and dispositions them, but `renderInstance` emits `<Shell … />` self-closing, so
the marker is attached to a parent the emitter never renders — EXP-010's "nearly wrong #3" (the page
collapse orphaning markers) one construct over. Corpus-wide, **19 component instances in 8 projects
have children authored inside them, 217 nodes in those subtrees**. ⚠️ **Do not read that as a
finding yet**: the probe's `src.includes(id)` counts a node that *rendered* and one merely *named in
a marker* alike, so its 96/217 split separates nothing. Splitting those two is the first move for
whoever takes it. Owner **`NONE`**.

### §34.6 What proves it

`silenthole.ts` (the table above, with its control arm) and `instkids.ts` in the s63 scratchpad, both
in-process over s62's `v2only` farm. 🔴 **The first run of `silenthole.ts` read 73 marked / 0 silent
— the exact opposite of the truth — because `app.files` includes `EXPORT-REPORT.md`, which names
every deferred node id.** Joining all the emitted files made every hole look marked; the number that
would have been written down was produced by measuring the wrong property, and it would have read as
"there is no problem here". Restricting to `.tsx`/`.ts` inverted it. That is
[[a-recommendation-carries-a-measurement-of-some-property-not-the-right-one]] a seventh time, caught
by asking what the number would be if the defect *were* present.

Gates: **tsc 0**, **jest 1161/1161 in 46 suites** (46 files on disk), picker **70/127 (55.1%)**,
ledger 175 types.

### §34.7 What this leaves

- 🔴 **The row-owned write is still the top row, and its question is now sharper**: not "can a row
  write to itself" but **"does the write need an id at all, when `updateWhere` matches by
  predicate and the row closes over its own `item`?"** Owner `NONE`; design question.
- 🔴 **A deferred *logic* node's reason still reaches the report only by accident** (§34.2). The
  visual half is fixed; the logic half is one `notes.push` and a decision about noise.
- ⚠️ **Children authored inside a component instance** (§34.5) — unowned, unmeasured, and the
  instrument that would measure it needs fixing first.
- ⚠️ **Every gate in this phase that asserts a sentence should be checked against the artefact.**
  §34.5 found two; the same pattern (`toContain` on notes, nothing on files) is cheap to grep for.

## §35 The half §34.7 left, measured as a class rather than taken as a row (session 64, 2026-08-30)

§34.7's second bullet said *"a deferred logic node's reason still reaches the report only by
accident — one `notes.push` and a decision about noise"*. Both halves of that sentence turned out to
be about a bigger and differently-shaped thing than the row it was written against, and the
"decision about noise" is now decided by a measurement instead of a guess.

### §35.1 The property nobody was checking

`src/emit/report.ts` renders a component's **`notes`** and **never** its `dispositions`
(`renderReport` reads `c.notes` at the per-component section and nothing else per node). So the
invariant EXP-004 rests on — *nothing dropped silently* — is really the claim **"every gate that
files a `deferred` disposition also remembered its own `notes.push`"**, and that is a property of
42 separate assignment sites which nothing verified. `model2ForeachGate` was one of them; it was
not the interesting one.

### §35.2 The measurement, and the control that makes it mean something

Over s62's `v2only` farm (the 60 exportable projects), asking of every deferred node **"does its id
appear anywhere in its own `EXPORT-REPORT.md`"** — the weakest bar there is, weaker than "its reason
is explained":

| | |
|---|---|
| deferred nodes, id **present** in the report (CONTROL) | **1490** |
| deferred nodes appearing **nowhere** in it | **76** |

🔴 **The control shares a reason shape with the finding.** `logic node (…)` reads **212 present**
and **39 absent** — so the absence is a fact about *those nodes*, not about an unreportable family,
which is what a bare "76 are missing" could not have told anyone.

Splitting the 76 by whether a note in that component could render at all — `report.ts` renders
per-component notes only for `c.file !== null`:

| | |
|---|---|
| `file=NONE skip=scaffolded` (the router shell) | 36 |
| `file=NONE skip=deferred` (component already named at component level) | 21 |
| **`file=yes` — a note here WOULD render** | **19** |

⚠️ **The 19 is the number a fix can move**, and checking it first is what stopped this being graded
against 76 nodes, 57 of which no `notes.push` could ever have reached. That is
[[a-recommendation-carries-a-measurement-of-some-property-not-the-right-one]] avoided rather than
walked into.

### §35.3 🔴 The premise of §34.7's bullet was true and its instance count was zero

`model2ForeachGate`'s sentence does reach the report only by accident — but over 60 projects the
accident **always happens**. Model2 reads **silent = 0**: every deferred `Model2` in the corpus has
dropped wires whose notes name it. The same for the larger `query result is not consumed by a
rendered repeater` (86 instances, DbCollection2, likewise no `notes.push` at `plan.ts:9403` while
its neighbours 15 lines up have one) — **all 86 ids are in their reports**, via wire notes reading
`wire <id>:items->…:in-rows has no deterministic translation in step 5`.

So the single `notes.push` §34.7 proposed would have changed **no report in the corpus**. What is
actually invisible is a deferred node with **no wires** — the case a wire note cannot cover, and the
one a corpus hides best because authors rarely leave nodes unwired.

### §35.4 The fix: a sweep, not a push

`sweepUnreportedDeferrals()` runs at all **three** exits of `planComponent`, beside
`sweepRefusedScripts()` — the two early returns included, because those are where a gate is most
likely to be the last word on a node (§17's hole, one construct over). It asks the same weak
question the measurement did: *does any note mention this node at all?* If one does, it says
nothing, so a node already named by a dropped-wire note gains no duplicate line and the report grows
by exactly what nothing else said.

**The noise decision, made from the data**: the catch-all's own reason is `logic node (<type>)`,
which restates the type — rendered through the generic format it would read *"node … (Timer)
deferred: logic node (Timer)"*. That branch emits **"node … (Timer) has no translation in this
slice — it is not in the generated app"** instead; every other reason is printed verbatim.

**After**: 76 absent → **57**, and the `file=yes` bucket → **0**. Control moved 1490 → 1509, +19,
in step.

### §35.5 What proves it

🔴 **No fixture on disk exercises the sweep's rendered path** — checked, not assumed: over
`tests/fixtures` it produces zero report lines, because every fixture's deferred logic nodes already
have a wire note. A row phrased *"over every fixture, nothing is unreported"* would have been the
`all([])` trap — true, vacuous, and green against a deleted sweep. So
`tests/unreported-deferrals.test.ts` **builds** the case: an orphan logic node, wired to nothing, in
`Components/PuppyCard` (a component that generates a file, asserted).

All seven rows assert the emitted **`EXPORT-REPORT.md`**, not `plan.notes` — §34.5's lesson, applied
where it was learned. Four mutants, each killed by different rows, `tsc` clean on every one:

| mutant | rows killed |
|---|---|
| bottom-exit `sweepUnreportedDeferrals()` removed | *deferred and unnamed*, *names it in the report*, *a gate with a real sentence* |
| both early-return calls removed | *reaches the logic-only early return* |
| the `said.includes(node.id)` dedupe guard removed | *says it once, not once per pass* |
| the stutter branch removed | *names it in the report*, *does not stutter* |

§34.7's fourth bullet, done: grepping the suite for `toContain` on a **note** where the row's claim
is about a **file** returned 30 candidates, of which 27 also assert `result.files` (`global-store`'s
*"but still renders"* and `stores-events`'s *"still renders"* both do). The three that did not are
all in `visual-controls.test.ts` — the dropdown's *"rather than render an empty shell"*, `useLabel`'s
*"whether the label element exists"*, and the radio's *"which child is checked"* — and each now
asserts the marker in `src/components/Showcase.tsx` beside its note. The existing row *"a control
that renders is not marked as dropped"* is their control.

Gates: **tsc 0**, **jest 1168/1168 in 47 suites** (47 files on disk), picker **70/127 (55.1%)**,
ledger 175 types.

### §35.6 What this leaves

- 🔴 **The row-owned write is still the top row**, with §34.7's sharpened question untouched by this
  session. Owner `NONE`; design question.
- ⚠️ **The 36 router-shell nodes are still unreported, and a `notes.push` cannot fix them** — the
  App component has `file === null`, so `report.ts` renders none of its notes. `withPreserved`
  (§27.6) already rescues the script-bearing ones; a non-script `Group` beside the Router is
  mentioned nowhere. Closing it means changing **`report.ts`**, not `plan.ts`. Owner `NONE`.
- ⚠️ **The 21 in `skip=deferred` components** are named at component level under *"Components with
  no generated file"* with the component's own reason. Judged adequate, not measured against a
  reader.
- ⚠️ **Children authored inside a component instance** (§34.5) — still unowned, still needs
  `instkids.ts` fixed before any conclusion.

---

## §36 Tier 2.7 as built — the three small utilities, and the panel that disagrees with its own node (session 65, 2026-08-30)

**`Substring`, `Number Remapper` and `String Mapper` are built, driven and gated.**
Picker **70 → 73 of 127 (57.5%)**, floor raised in the same commit.

Seventeen sessions had passed since §18 added a picker node — §19–§35 were all report, honesty and
defect work, and every one of them was worth doing. The board re-derived from the task files put
Tier 2.7 first all the same: four nodes named in §3, no design question standing in front of any of
them, and an acceptance criterion that moves when they land.

### §36.1 What they are

Each is a function of its inputs and holds nothing else, which is `date-call`'s shape one library
over — so each becomes **one call** into a new emitted `src/lib/util.ts`, and they compose. The
emitted page from the fixture, whole:

```tsx
import { mapString, remapNumber, substring } from '../lib/util';

<p className={styles.text}>{substring(subjectValue, 0, 12)}</p>
<p className={styles.text}>
  {mapString(subjectValue, { 'open': 'Open now', 'waiting': 'Waiting on the customer', 'closed': 'Closed for the day' }, 'Not a status I know')}
</p>
<p className={styles.gaugeText}>{remapNumber(34, 0, 100, 0, 10, true)}</p>
```

A separate module from `date.ts` deliberately: a project that formats no date ships no date
library, and a row asserts that.

### §36.2 🔴 The panel says 0 and the node answers -1 — DEF-033

`Substring`'s `End` port **declares a default of `0`** in the catalog and in the property panel.
Its `initialize` writes **`-1`**. `registerInput` writes a declared default straight into
`_inputValues` **without calling the setter** (`node.ts:137-139`), and `result`'s getter reads
`_internal.endIndex` — so the value the node is actually holding is `-1`.

The two are not a near-miss. They are opposite:

| `End` | what it means | what the node returns for `"hello"` |
|---|---|---|
| `-1` — what `initialize` wrote, and what runs | to the end of the string | `hello` |
| `0` — what the panel shows | stop before character 0 | `` (empty, for every input) |

An export that trusted the catalog would have emitted an app in which **every `Substring` returned
the empty string**, and it would have looked right in review: the fallback would have matched the
documented default, and no fixture in the corpus contains the node. §A's harness leaves an unset
port genuinely unset and drives the interpreter, which is the only way the difference is visible.

Registered as **DEF-033** — a product defect, not an export one. Owner **`NONE`**.

### §36.3 The two rules an object literal does not get for free

`String Mapper` is `inputs.indexOf(current)` over two index-aligned numbered families, and the
emitted object literal reproduces it only because the planner fixes two things when it builds the
table. Both were measured on the interpreter first, in §A, and then asserted on the emitted call:

- **First wins.** `indexOf` finds the earliest matching Input; an object literal keeps the *last*
  value written for a repeated key. A repeat is dropped at table-build time.
- **A present key with an `undefined` value.** An Input whose Mapping was never filled in publishes
  **empty**, not Default — the interpreter reads `mappings[idx]` off the index it found, and a hole
  there is an empty answer. So the helper tests `hasOwnProperty` rather than `??`, and the table
  keeps the key. A `??` is right about every case except the author's half-filled table.

The port names are `input 0`, `output 0`, … **with a space** — read off
`registerNumberedInput`'s `inputName.slice(name.length + 1)` (`nodedefinition.ts:145`), not guessed.

### §36.4 What defers, and what does not

A wired numbered port defers the mapper, naming the port: the table is read at generation time and
a wire is not knowable until the app runs. Two wires into one input defer on last-writer-wins.

**Nothing defers on an editor-constrained port**, and that is a departure from Tier 1.3 rather than
an oversight. The date family's enum gate exists because `addToDate` **throws** on a unit it does
not know; `Number Remapper`'s `clamp` is `value ? true : false` and its arithmetic coerces, so
there is nothing here a wire can break.

One divergence is translated-with-a-note rather than refused: `Substring`'s `string` setter is
`value.toString()`, which **raises** on an empty arrival. The helper answers `''` and the report
says so, on the date family's rule that an export whose failure mode is an uncaught exception in
somebody's page is worse than one that says what it did.

### §36.5 🔴 The clause that was added on this file's own warning and turned out to be dead

§9's comment says, in bold: *"Adding a readable output to a node in this file is **never** one edit.
The two that are silent are this one and Pass 4c's whitelist below."* So both were done.

Then the mutants disagreed:

| mutant | what it changes | rows killed |
|---|---|---|
| M4 | remove the `isUtilRead` clause from Pass 4f's predicate | **0** |
| M6 | remove Pass 4c's whitelist entry | **0** |
| M7 | remove **both** | **12** |

They are an **OR**, and Pass 4c strictly dominates for this family: it runs first (line 8664 vs
8810), it consumes every wire it matches, and Pass 4f skips a consumed wire — so no read of these
three can reach the later predicate at all. A `visible`-sink probe was run across both arms to look
for a discriminating case and found none.

The clause was removed and the reasoning left in its place. **The warning is still right for the
family it was written about**: a node whose read needs a *state row* — `Now`, `HTTP Request`, an
`Error` output — is not in Pass 4c's whitelist, so the later predicate is its only way in. What
decides which site a new node needs is whether its read is a pure expression or a row. Adding it to
both and shipping a branch nothing can execute is not the safe option, it is an unmeasured one.

### §36.6 The instrument

`tests/string-math-utilities.test.ts`, 27 rows in three parts, and §A is the one that can catch a
mistake: the emitted `src/lib/util.ts` is transpiled, loaded, and driven against **the three node
definitions themselves**, transpiled out of `noodl-runtime/src` and called through their real
setters and getters. 600 `Substring` cells, 300 `Number Remapper` cells, and the mapper's holes,
repeats and unset input. A transcription is exactly the kind of work that reads correctly and is
subtly false; comparing it against a second copy of its own logic would have proved only that both
copies say the same thing.

Every mutant lands on the row written for it:

| mutant | rows killed |
|---|---|
| `end` fallback `-1` → `0` (the declared default) | 1 — *"an unopened panel exports the value initialize wrote"* |
| `??` instead of `hasOwnProperty` in the helper | 1 — *"an Input with no Mapping publishes empty"* |
| no first-wins guard when building the table | 1 — *"a repeated Input keeps the first mapping"* |
| `slice(offset, to)` instead of the `substr` length | 1 — the 600-cell grid |
| Pass 4c's whitelist removed (after §36.5) | **12** |

⚠️ **§A alone would not have caught the `-1`.** The fallback lives in the planner, not in the
library, so M1 kills a §B row and leaves all ten §A rows green. The measurement and the use of the
measurement are two different assertions and they needed two.

### §36.7 The fixture

`tests/fixtures/ticket-desk` — a subject box, a truncated echo of it, a status word mapped to a
label, and a priority score remapped onto ten. Routed, rendering, and picked up automatically by
the five suites that enumerate `tests/fixtures` (`emitted-syntax`, `exported-readme`,
`in-code-markers`, `preflight`, `typecheck-emitted`), so it gates from here on without anyone
adding it to a list.

🔴 **None of the three nodes appears anywhere in the 60-project corpus** — 0 instances against
controls of 1564 `Text`, 4 `String Format` and 1 `Date Add` over the same 2667 files. That is the
README's point restated: the corpus cannot see a node nobody in it used, and a new fixture is the
only instrument this slice could have been graded by.

### §36.8 The corpus, and the one red that is not this slice's

`build-corpus.ts` over the 60 v2 projects reads **59/60**, and the failure is
**pre-existing**: `Members area (TPL-001)`, `src/components/MemberRow.tsx(16,15)`, `TS7053` —
`LABELS[standing]` inside a **preserved `Function` node body**, an author's own JavaScript emitted
verbatim under EXP-003 §4. An inferred object literal indexed by a `string` does not typecheck
under the harness's settings.

🔴 **Measured, not assumed.** The diagnostic *fits* a `mapString` table so exactly — an object of
two string fields, indexed by a string — that it read as this slice's regression at first glance.
The control is the same project, the same harness and the **pre-change `src`**, and it produces the
identical diagnostic at the identical line and column. Owner **`NONE`**; it is EXP-003's, and it
is the second thing this session nearly attributed to the wrong cause.

Gates: **tsc 0**, **jest 1211/1211 in 48 suites** (48 files on disk), picker **73/127 (57.5%)**,
ledger 175 types, corpus **59/60** (unchanged — the one red is pre-existing and controlled).

### §36.9 What this leaves

- 🔴 **`Unique Id` and `net.noodl.UUID` are the rest of Tier 2.7 and are a different shape.** Both
  hold a generated id and both have a `New` action with `done`/`failure` outcomes, so neither is a
  pure call — they want `Now`'s treatment: a state row seeded by a lazy `useState` initializer, an
  action that writes it, and a chain-local read inside the action's own chain. `nowStateOf` and
  `date-now-read` are the pattern to copy. **UUID additionally has an `Error` output**, which is
  §14's row-allocated-by-the-read rule for the third time.
- ⚠️ **The row-owned write is still the top row** and is still untouched by this session.

---

## §37 Tier 2.7 finished — the id pair, and the port that clears where its neighbour does not (session 66, 2026-08-30)

**73 → 75 of 127 (57.5% → 59.1%).** `pickerCoverageFloor` raised in the same commit. Tier 2.7 is
complete, and Tier 2's remainder is now **Cloud Services (9)** and the **component stack pair**.

§36.9 called these "the other half of the tier" and predicted `Now`'s treatment. That was right
about the shape and it understated the difference: `Now` has one arm, and the second arm is where
everything interesting in this slice turned out to be.

### §37.1 They are two nodes, and the export has to keep saying so

| | `Unique Id` | `UUID` |
|---|---|---|
| generator | `Model.guid()` — **10 chars from `Math.random()`** (`model.ts` `_randomString`) | `crypto.randomUUID`, falling back to `getRandomValues` |
| can it fail | **no**, and it has no Failure port — `uniqueid.ts` says a port that can never fire is what §5's dead-end check complains about | **yes**, with `failure` *and* an `Error` output |
| the row | `useState<string>(() => randomId())` | `useState<string \| undefined>(() => initialUuid())` |
| the `New` | `date-now-read`'s shape — a `const`, a setter, the chain | a `const` and an `if`/`else` over a `UuidResult` |

🔴 **Collapsing them into one generator is the way this slice is most likely to be wrong, and it
raises the picker number by two either way.** Every shape check anyone would think to write —
"is there an id here", "is it non-empty", "does it change on New" — passes on the wrong one. It is
graded in three places: an exact differential per node, a `not.toContain` in the fixture rows, and
sabotage arm A, which swapped `Unique Id`'s generator and moved exactly the two rows predicted.

### §37.2 🔴 `Error` is cleared here and is not cleared next door

§24 settled "a read from the node's own chains" for `External Link` and `Navigate To Path` and
found it was three questions. It is three here too, and **one of the three answers is the
opposite one**:

| read from | `Id` | `Error` |
|---|---|---|
| render, another handler | the row | the row |
| the **Done** arm | the arm's own local | 🔴 **refused** — `_generate` *clears* the message before Done fires, so every such read is empty |
| the **Failure** arm | 🔴 **the row** — the interpreter left `Id` as it was, so the pre-write row is the faithful answer | the arm's own local |

`External Link`'s `_internal.lastError` is **never** cleared, so §24 reads the stale row in the
Done arm and is right to. `_generate` does `this._internal.error = undefined` and flags it dirty.
Copying §24 here would have printed a message the running app had just erased — and it would have
been the natural thing to do, because the two nodes are one file apart and look alike.

The two diagonals are the other half. Reading the local in the Failure arm names a property that
does not exist on a failed `UuidResult`; reading the row in the Done arm delivers the previous id.

⚠️ **The success arm's `setRecordIdError(undefined)` is a line no driven app can grade.** Sabotage
arm C deleted it, rebuilt, re-drove — and **every row was identical**, because the failure never
fires in a browser that has a CSPRNG. It is recorded as a row the drive **cannot** see rather than
as one that passed, and a test grades it instead.

### §37.3 The result is a discriminated union, and that is a typing decision with a reason

`tryRandomUuid()` returns `{ ok: true; uuid } | { ok: false; error }` rather than
`{ uuid?, error? }`. An optional-property pair does not narrow, so `recordIdNew.uuid` in the
success arm would be `string | undefined` and every sink downstream would guard a value that is
always present. This is what lets the emitted app typecheck with no `!`:

```tsx
const recordIdNew = tryRandomUuid();
if (recordIdNew.ok) {
  setRecordId(recordIdNew.uuid);
  setRecordIdError(undefined);        // ← §37.2, and not decoration
  lastRecord.set(recordIdNew.uuid);
} else {
  setRecordIdError(recordIdNew.error);
  lastFailure.set(recordIdNew.error);
}
```

### §37.4 What defers, and the one deferral that names its own fix

- **`Completed`, on both nodes** — it fires after every outcome and this slice emits the arms, on
  `HTTP Request`'s and `External Link`'s sentence. ⚠️ **`Unique Id`'s reason is a different
  sentence, because the node has only one outcome and its own catalog description says so**:
  *"it always fires together with Done, and wiring either one does the same thing."* So the
  refusal names the one-move fix — wire it to Done — instead of the generic join sentence. What
  stops it being free is the case where **both** are wired: two chains whose relative order this
  file would be choosing rather than reading.
- **`Done`/`Failure` read as a value** — a pulse carries nothing to read, on `Now`'s sentence.
- **A wired `New` that never attached** — `Now`'s §4a rule: binding to a row nothing writes would
  freeze the app at its mount id with nothing to say why.

### §37.5 🔴 The instruments, and what each one cannot see

**The differential is exact, not statistical.** Both generators are random, so "it looks like an
id" is the assertion that cannot fail. The entropy source is pinned instead — a seeded
`Math.random` for one, a fixed `getRandomValues` for the other — and then the **emitted module**
and the interpreter's own code must produce the same string character for character. That catches
a reordered alphabet, a changed length, `Math.floor((1 + r) * 0x10000)` "tidied" to
`Math.floor(r * len)`, the version nibble in the wrong byte, and the hyphen positions. A broken
copy of the emitted module is run beside it and must disagree.

⚠️ **The `getRandomValues` throw message is asserted verbatim against the interpreter's**, because
it is the only sentence `Error` can ever carry.

**Eight mutants, six killed and two survivors that both say something:**

| mutant | rows killed |
|---|---|
| Pass 4f's `isIdRead` clause dropped | **6** |
| the Done arm reads the row instead of the chain-local | **2** |
| the row-boot import earning dropped | **4** |
| the lazy initializer made eager | **2** |
| the success arm's Error clear dropped | **1** |
| the Done-chain Error refusal dropped | **1** |
| `id-out` dropped from the text-fold whitelist | **0 → 1** (a row was added) |
| the id nodes added to Pass 4c's whitelist **as well** | **0**, deliberately |

🔴 **The last row is §36.5's question answered from the other side, and it says something narrower
than "Pass 4f is the right home".** Both passes call `resolveExpr`, so both bind the *same* row
read; the output is identical, and since Pass 4c runs first and consumes the wire, adding them
there would make the Pass 4f clause the dead one. So it is not a choice between a right and a
wrong translation — it is one site or two, and §36.5's finding was that two leaves a branch
nothing can execute. Pass 4f is the site because that is where the rest of the **state-row**
family already lives (`Now`, `HTTP Request`, both `Error` ports), none of which is in Pass 4c's
whitelist. **Consistency is the argument; the mutants are what say the alternative was redundant
rather than wrong.**

⚠️ **The text-fold survivor was a real hole.** `id-out` was added to `childText`'s whitelist — the
one keyed by expression kind with no exhaustiveness, whose own comment records §24 being bitten by
it — and nothing graded it. **No driven row and no typecheck could:** React renders `undefined` as
nothing, so a dropped fold is invisible until the same read reaches a format, where it prints the
text `undefined`. The row added is a **control pair** — a `UUID`'s Id must fold, a `Unique Id`'s
must not — because asserting only the first passes on an emitter that folds every id read.

### §37.6 The project (§2's requirement), and the drive

`tests/fixtures/badge-desk` — **Badge Desk**, one routed page, both nodes, both value reads through
the row, both Done chains reading the chain-local, and `UUID`'s `Error` read from both the render
and the Failure arm. It reports **nothing dropped** beyond the router shell, and is picked up
automatically by the five suites that enumerate `tests/fixtures`.

Exports, builds under `tsc -b && vite build` (48 modules), and driven in headless Chrome over CDP
with every expected answer **written down before the app ran**:

```
D1  rowKey   T5xgwU3923                              ← 10 chars, NOT a UUID
    recordId ec23585e-6944-44bf-a082-09deaaeaaa2c    ← v4, variant a
    lastKey / lastRecord / error / lastFailure: all empty
D2  click New row key → rowKey changes, and lastKey == THE NEW rowKey
D3  click New record id → recordId changes, lastRecord == THE NEW recordId
D4  2s, no clicks: everything unchanged
console errors: []
```

🔴 **D2 and D3 are the rows that exclude rather than fit.** A state-row read in the Done chain
gives the *previous* id — which is a real, plausible, correctly-shaped id, and on any board that
only asked "did something get saved" it looks perfect.

**Three sabotage arms, one rule each, predictions written first:**

| arm | change | measured |
|---|---|---|
| **A** | `Unique Id` draws from the UUID generator | **rowKey only** — 36 chars — and lastKey followed it; recordId untouched. As predicted. |
| **B** | the Done arm reads through the row | **lastKey and lastRecord only**, each one click behind; D1 identical. As predicted. |
| **C** | the success arm stops clearing `Error` | 🔴 **nothing moved** — as predicted, and recorded as a row this drive cannot grade |

⚠️ **One claim in this slice was written and then measured false, and the correction is kept.** A
comment said the eager `useState(randomId())` "would draw a fresh id on every render, and an id
that changes on every render remounts the row it keys". React **discards** that argument after
mount, so the rendered id is identical and no drive row can separate the two. The lazy form is
right because it is the faithful transcription of a once-per-construction `initialize` — the cost
of the eager one is a generator call, and a **CSPRNG draw**, per render. Mutant M7 kills it in the
emitted *text*, which is the only place the difference exists.

### §37.7 The corpus cannot grade this slice either

**0 instances of both types across all 60 v2 projects**, against controls of **1564 `Text`** and
**1 `net.noodl.Now`** over 796 `nodes.json` files. Same finding as §36 and for the same reason: the
fixture was the only possible instrument, and the corpus is the regression net.

### §37.8 What this leaves

- 🔴 **Tier 2's remainder is `Cloud Services` (9) and the component stack pair** (§15.6 says that
  pair is a routing question). Tier 2.7 is done.
- **`Unique Id`'s `Completed`** is a translatable increment — §37.4 has the whole argument and the
  one thing to settle, which is the order of two chains when both ports are wired.
- ⚠️ **The row-owned write is still the top row** and is still untouched.
