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
