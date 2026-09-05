# EXP-011 — Close the picker gap, ranked by what apps need

**Status:** 🟡 In progress — **Tier 1 COMPLETE; Tier 2.7 COMPLETE** (the three pure utilities, session 65; the id pair, session 66); §38–§39 the small non-pure nodes; **§40 (session 69) fixed the chain-wire / earn-scan / branch-arm defect class behind every translated node with a chain; §41 (session 69) built `Cloud Function`, the first of the nine Cloud Services; §42 (session 70) DROVE it against a live `nodegx-backend` — the session token measured on the receiving end — and fixed the two cells that disagreed (a boolean result rendered as nothing; an empty answer replaced the row); §43 (session 70) BUILT `Record` in both forms — 🔴 gates NOT run, NOT committed (the box ran out of memory; see §43.4)**. **82 of 127 (64.6%) on disk, 81 committed.** Tier 2's remainder is Cloud Services (9) and the component stack pair
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
| **Cloud Services** | 9 → **8** (`Cloud Function` translated, §41) |
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

### Tier 2 — common, not universal  🟡 **2.6's tail and the new 2.8 remain — §50**

5. **Navigation (5).** ✅ **`Page Inputs` built, driven and gated in session 40 — §11**, along
   with the route patterns and the Navigate url builder, which were both recorded `translated`
   and both emitted urls react-router could not match. ✅ **`External Link` in session 41 — §12**,
   whose drive found a defect in the node itself (DEF-016), and its `Error` output in session 43
   — §14. ✅ **`Navigate To Path` in session 44 — §15**, which also fixed a second unroutable
   route in the scaffold. The remaining two are the **component stack pair**, and §15.6 says why
   they are a routing question rather than another url builder.
6. **Cloud Services (9).** Mostly **unblocked by EXP-009**, and several may fall out of it for
   free — `Cloud Function`, `Record`, `Set User Properties`, `Sign In With`. Re-measure after
   EXP-009 lands rather than planning against today's list. ✅ **`Cloud Function` built in
   session 69 — §41**, driven in 70 — §42; ✅ **`Record` in sessions 70–71 — §43**; ✅ **`Set User
   Properties` and `Request Magic Link` in session 72 — §44**. The other five remain — `Sign In
   With`, `Subscribe To Changes`, `Upload File`, `Cloud File`, `Sign File URL` — and §44.6 says
   which of them are refuse-by-name candidates rather than builds.
7. **String/Math utilities.** ✅ **`Substring`, `String Mapper` and `Number Remapper` built,
   driven and gated in session 65 — §36**, which also found DEF-033: `Substring`'s panel declares
   an `End` the node does not use. The remainder is the **id pair**, `Unique Id` and `UUID`, and
   §36.9 says why they are `Now`'s shape rather than another pure call.

### Tier 3 — real, but a smaller audience

8. ✅ **`States` and `Animate To Value`** — the animation pair. Genuinely hard (they are time-based
   and stateful) and worth doing properly rather than early. **Built, graded frame by frame against
   the interpreter's own files, and driven in session 77 — §49**, together with the wired style sink
   (`opacity`/`color`/`backgroundColor`) neither could do without.
9. ✅ **`CSS Definition`** — built in session 76 (§48). `Script` moved to **Tier 2.8 row 2** by
    the 2026-09-03 ruling (§50): it is the escape hatch the MCP reaches for, not a niche.
10. **`Drag`, the component-tree family** — `Component Children`, `Component Stack` and its pair, the
    parent-object family all moved to **Tier 2.8** by §50; `Drag` stays here as its row 13.
11. **The transports** — `Subscribe To Changes`, `Server-Sent Events` ✅ **§64 (session 88)**, `WebSocket` ✅ **§65 (session 89)**. **Added by §50**
    (they were "not a target"). Each is a browser API in a `useEffect`: EventSource on
    `/realtime` plus one subscribe POST; EventSource; WebSocket with reconnect. Real, buildable, and
    the streaming-LLM app is the one every new user builds first.

### Tier 2.8 — the rows Richard reinstated, in the order to build them  🆕 **ruled 2026-09-03, §50**

The 2026-08-28 "not a target" list below was written from an old picker and read as an
exclusion nobody could argue with. Richard re-read it on 2026-09-03 and reversed most of it —
*"these are much loved and used nodes"* — and the phase's own first commitment (README: *every
node in the picker exports, or the picker stops offering it*) never allowed the list in the first
place. The order is by *what a refusal silences*, since §50.2 measured that a refusal cascades:

| row | nodes | why here |
|---|---|---|
| 1 | ✅ `Component Children` | **built s79 (§51)** — was: a wrapper's children vanish from the export — a working component becomes a blank one |
| 2 | ✅ `Script` | **built s80 (§52)** — was: the escape hatch the MCP reaches for when the picker has no node; ten in one MCP-built project |
| 3 | ✅ `Run Tasks` | **built s81 (§53)** — was: *"I use this all the time"* — and everything it fires is refused with it |
| 4 | ✅ `On App Error` | **built s82 (§54)** — was: an error pathway that is left out is the exact case where exporting is worse than not |
| 5 | ✅ `Create New Array` | **built s83 (§55)** — was: *"I use this all the time"* — the anonymous-Id-by-wire mechanism (§7.3) needs a design session first |
| 6 | ✅ `Filter Records` | **built s84 (§56)** — was: the search box over a fetched list |
| 7 | ✅ `Repeater Item` | **built s85 (§57)** — was: now that the node works, people will use it (§7.3 reversed) |
| 8 | ✅ `JSON Stream Parser` · `Stream Buffer` · `Text Accumulator` | **built s85 (§58)** — was: the streaming trio — pure functions over chunks, one build |
| 9 | ✅ `Hash` · `Random Bytes` · `Screen Resolution` | **built s85 (§59)** — was: one browser API each, one session for the three |
| 10 | ✅ `Set Component Object Properties` · `Parent Component Object` · `Set Parent Component Object Properties` | **built s86 (§60)** — was: own store = local state; the parent pair = context |
| 11 | ✅ `Component Stack` · `Push Component To Stack` · `Pop Component Stack` | **built s86 (§61)** — was: the in-page router — §16.2 says what it is not |
| 12 | ✅ `Add Record Relation` · `Remove Record Relation` | **built s86 (§62)** — was: a relation column through the EXP-009 client |
| 13 | ✅ `Drag` | **built s86 (§63)** — was: the smallest audience of the buildable rows |

Twenty-two nodes. With Tier 3.11's three: **25 scheduled ⇒ ceiling 117 of 127 (92.1%)**.

### Not a target — re-ruled 2026-09-03 (§50), and every one of them must now be **badged**

`Action Dispatcher` / `Action Handler`, `Optimistic Update`, `State History` / `State Snapshot` /
`Undo / Redo`, `Parse CSV` / `To CSV`, `Pattern Extractor`, and `Sign In With` (until provider
sign-in is a product decision).

Ten nodes. The original list held twenty-two; the other twelve are in Tier 2.8 and 3.11 above.
🔴 **An exclusion is only honest if the person placing the node is told.** Nothing in the editor
reads the ledger today (§50.2): the first a person hears is the pre-flight modal at export, which
lists components with counts, not nodes. That is **EXP-013**, and it is the next first job — before
row 1 above — because the ruling that reinstated these rows was made by someone reading the list,
and a person building an app never sees the list.

## §4 Acceptance criteria

1. ✅ **The picker number moves and holds.** Every slice raises `pickerCoverageFloor` in the same
   commit — `export-ledger:picker` fails if it does not.
   *(51 → 55 → 59 → 60 → 66 → 67 → 68, sessions 35–41; → 70 by session 47; → 73 in session 65; → 80 in session 68; → 81 in session 69.)*
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
   `tests/fixtures/ticket-desk` — §36.7; `Cloud Function`'s is `tests/fixtures/call-desk` — §41.5,
   exported and typechecked but not yet built and driven against a backend.)*
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

Registered as **DEF-033** — a product defect, not an export one.

🧭 **RULED by Richard 2026-08-31 (given in phase 80, relayed here): show the truth.** *"Yeah just
make it show the truth, that seems like a no brainer."* Align the **declared** default to `-1` so
the panel shows the number that already runs. **Node behaviour is unchanged and nothing already
built moves** — the export already agrees with the node, so no emitted artefact and no target-output
row changes.

🔴 **Owner is now `P18` — P80 ruled it and handed it over; P80 does not build it.**

✅ **BUILT 2026-09-01 (session 67).** `substring.ts` declares `default: -1` and its description reads
*"-1, the default, runs to the end of the string, and 0 yields an empty result"*; the catalog was
regenerated (`node-catalog.json` and `node-catalog-enriched.json` carry the new default and text).
Graded by `packages/noodl-runtime/test/nodes/substring-declared-default.test.ts` — the declaration is
asserted **equal to `_internal.endIndex` after `initialize`** and to `-1`, the description is
asserted free of the old sentence, and three `result` rows are kept as **controls** that must not
have moved (untouched `End` → rest of string; `End = 0` → `''`; `End = -1` sent → same as untouched).
`string-math-utilities.test.ts`'s §A row, which had pinned the mismatch as the finding
(`declaredEnd.default` **0**), now pins the fix (**-1**) — it went red on the catalog change, which is
the row proving the catalog is what the panel reads. ⚠️ **Not driven in the property panel**; the
panel renders the catalog's `default`, and the catalog row is what moved.

**The change is one line.** [`packages/noodl-runtime/src/nodes/std-library/substring.ts:52`](../../../packages/noodl-runtime/src/nodes/std-library/substring.ts#L52)
— the `end` port's `default: 0` becomes `default: -1`, matching `initialize`'s
`internal.endIndex = -1` at [line 29](../../../packages/noodl-runtime/src/nodes/std-library/substring.ts#L29).

⚠️ **Two things to check before calling it done, because the declared default is read by more than
the panel:**

1. **The port `description` contradicts the new default.** It currently reads *"leave it unset to
   run to the end of the string, since setting it to 0 yields nothing"* — written to explain the
   very mismatch this ruling removes. Once the declaration says `-1`, that sentence describes a
   state the panel no longer shows. **Rewrite it in the same commit.**
2. **A declared default never runs its setter** (`registerInput` writes it straight into
   `_inputValues`, `node.ts:137-139`) — which is the whole mechanism of this defect. So changing
   the declaration moves **what is displayed and what an unset port reports**, not what the node
   computes. ✅ **Grade it by reading the port's declared default and the panel, not by asserting
   `result` changed — `result` must NOT change, and a test that watches `result` will pass
   identically before and after the fix.**

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

## §38 The two small ordinary nodes — `Boolean To String` and `Color Blend` (session 67, 2026-09-01)

**Picker 75 → 77 of 127 (60.6%)**, floor raised in the same commit. Richard, after ruling that the
export rides 0.2.2: *"can we continue to push towards full node coverage?"* The ledger had five
rows scheduled since session 35 as *"a small ordinary node with no design question standing in
front of it"* — `Boolean To String`, `Color Blend`, `Value Changed`, `Delay`, `Log`. The first two
are **pure reads**, Tier 2.7's exact shape, and are built here; the other three are an effect, a
timer and an action, and are §38.6.

### §38.1 The build

One call each into the emitted `src/lib/util.ts`, through `UTIL_NODES` — so Pass 4c's whitelist,
the import clause and the module's presence in the app all followed without a second edit:

| node | emitted call | transcribed from |
|---|---|---|
| `Boolean To String` | `booleanToString(selector, whenTrue, whenFalse)` — **truthiness**, as the getter is `currentInput ? trueString : falseString`; unset strings are `initialize`'s `''` | `noodl-runtime/…/booleantostring.ts` |
| `Color Blend` | `blendColor(blend, ...colors)` — the numbered `color N` family as **variadic arguments**, index-aligned, a hole printed as `undefined` | `noodl-viewer-react/…/colorblend.ts` |

`UTIL_NODES` grew a `numberedList` field for the second. It is deliberately **not** `numbered`:
String Mapper's table is read at generation time and a wired entry defers the node (§36); a colour
is a value the call receives at run time, so **a wired colour is an argument**, and the
interpreter's sparse array (`colors[index] = value`, `length` = highest index + 1, a hole reading
`#000000` through `getColor`) is reproduced positionally.

### §38.2 Graded — `tests/small-utilities.test.ts`, 18 rows, 50 files on disk

- **§A, the differential**: both helpers against the interpreter's own node code, loaded from
  source. `colorblend.ts` lives in `noodl-viewer-react` and imports `easecurves`, stubbed to the
  two-line `linear` that file exports. 40 selector × string pairs, **72** list × blend pairs —
  holes, a single colour, a blend of `NaN` and out-of-range blends included — plus the empty list
  (`#000000` in both) and a non-hex colour (`#NaNNaNNaN` in both: **transcribed, not repaired**,
  as the port description already warns). A control row sabotages `floor` → `round` and requires
  the disagreement.
- **§B, the translation**: the panel's strings, the unopened panel (`booleanToString(undefined, '',
  '')`), the unread `inputChanged` signal, index-ordered colours, a hole, no colours, a wired colour
  (an argument, and the note list stays empty), two wires into one colour port (deferred with the
  family's shared reason).
- **§C, AC3's project** `tests/fixtures/mood-desk` — whole (the only note is the scaffold's), both
  calls present, typechecks; picked up by the five `readdirSync` suites automatically.
- **Mutants**, each restored by `md5`: holes skipped instead of printed → **1** row killed; the
  `Boolean To String` entry removed → **5**; truthiness → strict `=== true` in the helper → **1**.
- **Built and driven** — headless Chrome 151 over CDP on the built fixture, answers written down
  first: initial `Closed` / `#NaNNaNNaN`; *Open up* → `Open`; *Calm* → **`#7f7f00`**; *Angry* →
  **`#007f7f`**; *Close down* → `Closed`; console errors `[]`. `#7f7f00` is the measurement —
  `floor(127.5)`; a helper that rounded would read `#808000`.

### §38.3 🔴 What the fixture found upstream — two ordinary wires that do not translate

Building the picker-exercising project took four shapes before one was whole, and two of the three
refusals are **not this slice's**:

1. 🔴 **A checkbox's `checked` or a slider's `value` writing a Variable is refused** — *"a variable
   write is only translated from a rendered text input in step 5"*. A control's value output wired
   straight into a logic node is refused too (*"no deterministic translation in step 5"*). So the
   most ordinary graph for these two nodes — **a checkbox feeding Boolean To String, a slider
   feeding Color Blend** — exports with the logic translated and the *input* dropped. Owner
   **P18, next**: extend the controlled-state slice from text inputs to `checkbox.checked` and
   `range.value`. It is the thing that makes these two nodes useful in a real app.
2. ⚠️ **`Set Variable` with a value typed in the panel is refused** — *"nothing is wired into
   value"*. `value` is a dynamic port typed by `setWith`, and an author can type it; the exporter
   only translates a wired one. Owner **`NONE`**; cheap-looking, unmeasured.
3. ✅ The value nodes publish on **`savedValue`**, not `value` — the port ticket-desk already wires.
   A wire from `value` defers as *"feeds … which has no static binding in this slice"*, and reads
   exactly like a planner bug until you look at the port list.

The fixture therefore drives its Variables from **buttons and Set Variable fed by Boolean/Number
constants**, which is whole, and its initial colour is `#NaNNaNNaN` because a Variable nobody has
set is `undefined` in the interpreter too — §A's grid agreed on the `NaN` blend before the drive did.

### §38.4 Two comments corrected on the way

`utilLib.ts`'s emitted `substring` comment and the ledger's Substring note both still said the
port *declares* 0. DEF-033 was fixed earlier this session (§36.2), so both now say the declaration
and `initialize` agree at -1. ⚠️ The emitted comment ships in every app that calls `substring` —
a stale claim there is read by someone who cannot check it.

### §38.5 The three that are not pure — §38.6's shapes, for whoever builds them

| node | shape | what it needs |
|---|---|---|
| `Log` | an **action**: `console[level](message, data)` then `Done`; `Value` passes through | the action machinery (`TRIGGER_PORTS`, a `HandlerAction` kind, the emitter case, `actionsValidIn`, the reads sweep) — External Link is the template |
| `Value Changed` | an **effect**: fires when its input changes identity, **including the first arrival** unless it is `undefined` | the effect() slice §9.6 named and nobody has built — `useEffect` on the value, skipping an `undefined` first render; ⚠️ React's deps compare with `Object.is`, the node with `===` (differ on `NaN`) |
| `Delay` | a **timer** with state: Start/Restart/Stop with done/unchanged outcomes, Started after Start Delay, Finished after Duration, never for a stopped one | a handle in a ref, `setTimeout` chains fired later — HTTP's async continuations are the precedent; `timerStarted` fires **inside** the delayed callback, not on Start |


## §39 The three non-pure small nodes — `Log`, `Delay`, `Value Changed` (session 68, 2026-09-01)

**Picker 77 → 80 of 127 (63.0%)**, floor raised in the same commit. Richard: *"attack the most
common nodes to publish the maximum number we can with 0.2.2, at least to give people a taste."*
§38.5 had left the three shapes written down — an action, a timer with state, an effect — and each
is the first of its kind in the exporter: the first node whose action port is a *set* (`Timer`'s
Start/Restart/Stop), the first `useRef`, and the first effect() slice, which §9.6 named in session
38 and nobody had built since.

### §39.1 The build

| node | what it became | where |
|---|---|---|
| `Log` | a `log` HandlerAction: `log(level, message, data)` into `src/lib/util.ts` (a transcription of `log.ts`'s `_write` browser branch), then the Done chain as **following statements** (`popup-show`'s treatment, so `onClick={() => log('info', 'Pressed')}` stays an expression). `Value` passes straight through: a read of it resolves to whatever feeds the input, in `resolveExpr` and in Pass 4c's whitelist (§14's two opt-in sites, both opted into) | `compileLog`, `LogAction` |
| `Delay` (`Timer`) | a `delay` HandlerAction per **verb**, over a `useRef<DelayHandle \| null>` the component declares per node. `src/lib/timer.ts` is `timer.ts` over `timerscheduler.ts` in two `setTimeout`s: `startDelay` answers whether a countdown began (false while one runs — the node's `_isRunning === false`), `restartDelay` always begins again, `stopDelay` answers whether there was one to stop. Done/Unchanged are the two arms of an `if` over that answer; Started/Finished are the two callbacks, printed with `handlerArrow`. An unmount cleanup `useEffect(() => () => stopDelay(ref), [])` is `addDeleteListener` | `compileDelay`, `DelayAction`, `timerLib.ts` |
| `Value Changed` | a `ValueChangedEffectPlan`: `useEffect` keyed on the Input's render-mode expression, the last value in a `useRef<unknown>(undefined)` — return on the same value, else remember and run the chain. `lastValue` boots `undefined` in `initialize`, so a first arrival of `undefined` fires nothing and anything else fires, which is what the effect reads too | the pass after the reactive Condition's |

`TRIGGER_PORTS` is `Record<string, string>`, one port per type; `Delay` joined through the
predicate in `isTriggerWire` and a branch in the compile-all loop, the checkbox's shape.

### §39.2 What the toll was, counted

A new HandlerAction kind owes every switch the file's own comments say it owes. Counted by
`grep -n "'date-now-read'"` before starting: **6 sites in `plan.ts`, 10 in `component.ts`**, and
two of the sixteen are held by the compiler (`actionCode`, `actionExprsOf` — both `TS2366`, both
fired first). The other fourteen were carried by hand: `actionsValidIn`, `snapAction`, the attach
scan, the session walker, `fillMaterialize`; `collectActionUse`, `deepActions`, the `inAction`
reads walker, `expandActions`, `isStatement`, the no-terminator list, the helper collectors, the
`react` import list, the body printer. ✅ Every one was reached by a test row or a mutant arm
below before the session believed it.

### §39.3 🔴 What building the fixture found — the answer depended on wire ORDER

`tests/fixtures/tick-desk` lists the Delay's chain wires (`timerStarted → Set Variable` and three
more) **before** the wires that fire the node. The attach pass walks connections in file order,
and a chain wire whose target is a trigger port and whose source is not a rendered element fell
to *"the trigger is not a rendered element event or a receiver"* — reported dropped, marked
consumed, and then **emitted anyway** when the Delay attached (`doneChainOf` filters by port, not
by `consumed`). A false note about working code, invisible to every hand-built test because
`connect()` appends the trigger wire first.

The popup nodes escape this with an explicit `continue` on their `done`; the reactive Condition on
its arms. The same three lines now cover `Log`'s `done`, `Delay`'s five outputs and `Value
Changed`'s `valueChanged`. ⚠️ **Not measured, owner P18 (next):** `External Link`, `Now`, the id
pair and `HTTP Request` have no such skip, so their Done chains are order-dependent by the same
reading. One graph with the chain wire first would settle it; the fix is one line per family.

Two more ordering facts, both found by the smoke and both fixed before a test was written:

- The Log/Delay **verdict sweep** first ran before the reactive Condition and Value Changed
  passes, so a Log fired only from either was named *"never fired by a translatable source"* and
  then translated. It now runs after both. ⚠️ **The date/util/id sweep has the same hazard** for a
  `Now` or `Unique Id` fired only from a reactive Condition's arm — unmeasured, owner P18.
- A `Value Changed` whose chain fires a Log: the wire was the first thing the attach pass reported.
  Same fix.

### §39.4 Graded — `tests/log-delay-value-changed.test.ts`, 34 rows, 51 files on disk

- **§A, the differentials.** `log()` against `log.ts`'s `_write` with the console captured: 192
  rows (4 levels × 8 messages × 6 datas) must produce the **same method with the same argument
  list**. ⚠️ `toStrictEqual`, because `toEqual` reads `['x', undefined]` as `['x']` — which is
  the very difference the row exists to see, and the first draft passed trivially. The timer verbs
  against `timerscheduler.ts` **driven frame by frame at the same instants** (`runTimers(t)` at
  50 ms steps, `timer.ts`'s own verb rules applied on top): eight scripts — start, start twice,
  stop mid-run, stop after finish, restart mid-run, restart from idle, start after a finished run,
  no start delay — same event names at the same times. A zero-length countdown fires Started then
  Finished across two tasks, which is the scheduler's own shape (queued in one frame, finished in
  the next). Both comparisons have a broken-copy control.
- **§B, the translation** — 17 rows: the call, the level fallback (`''` and `shout` → `info`),
  wired message/data, the chain as following statements, the pass-through, three Log deferrals by
  name, the idle Log; Start over the ref with both callbacks and the cleanup, the bare call as an
  expression body (⚠️ needs a button of its own — the Add button already carries an action, and
  two actions are a block whatever the second is), Done/Unchanged arms and the inverted test,
  Stop and Restart, wired numbers, three Delay deferrals; the Value Changed effect and four
  deferrals; **and the order row from §39.3**.
- **§C, AC3's project** `tests/fixtures/tick-desk` — whole but for the scaffold note and the one
  Restart note the graph earns; all three nodes and both libraries present; typechecks.
- **Five mutant arms**, each restored by `diff -rq` against a post-fix snapshot:

  | arm | mutation | killed by |
  |---|---|---|
  | A | the three attach-loop skips removed | **4** — the order row, the Value Changed row, the idle-timer row, the fixture's whole-export row |
  | B | Restart keeps its Unchanged chain | **1** — the Restart row |
  | C | `log` never collected for import | **4** — including the fixture's `typechecks` row, so `typecheckEmittedApp` sees a missing import |
  | D | the ref compare dropped from the effect | **2** |
  | E | Start ignores a running countdown (emitted helper) | **2** — exactly the two start-twice rows |

  ⚠️ **One survivor, deliberate:** removing `clearTimeout` from `stopDelay` changes nothing the
  scheduler comparison can see, because the finish callback's `ref.current !== handle` guard makes
  the cleared timeout a no-op anyway. Recorded in the test file so nobody retries it as a control.
- 🔴 **A deleted affordance reddened a control** (the memory's rule, third instance).
  `unreported-deferrals.test.ts` used a bare `Timer` as *"the orphan no pass names"*; the verdict
  sweep now names it. Re-pointed to `net.noodl.Hash`, which §3 keeps out of scope for good.

### §39.5 Built and driven — headless Chrome 151 over CDP, answers written first

The fixture was emitted into s66's harness, typechecked (`tsc` exit 0) and built (`vite build`
exit 0, 49 modules), served with `vite preview`, and driven through twelve steps written down in
`EXPECTED.md` before the app ran. Four `<p>` rows read positionally against the headline.

| step | status | outcome | echo | log lines |
|---|---|---|---|---|
| load | '' | '' | '' | 0 |
| Start, read at once | '' | **Done** | '' | 0 — Started has not fired inside the 100 ms start delay |
| +150 | **Running** | Done | Running | 1 |
| Start again | Running | **Unchanged** | Running | 1 |
| +500 | **Finished** | Unchanged | Finished | 2 |
| Stop with nothing running | Finished | **Unchanged** | Finished | 2 |
| Restart, +150 | Running | **Done** | Running | 3 |
| Stop while running | Running | **Done** | Running | 3 |
| +600 | **Running** — Finished never fired | Done | Running | 3 |

Every `Status changed` line reached the console with **one** argument — no trailing `undefined`.
Console errors `[]`. `echo` (the Log's pass-through of `status`) equalled `status` on every row.

🔴 **One row could not exclude what it was for, and was re-driven.** The restart-while-running
arm read `Finished` at a moment my timing table left ~50 ms of margin against ~40 ms of CDP
round-trips — a reading that fit both "the old countdown fired" and "the new one finished on
time". Re-driven with `performance.now()` read in the page: at **405 ms** after the Restart the
old Finished (due at **335 ms**) had not fired and status was still `Running`; at 665 ms the new
one had. *A reading that fits is not one that excludes* — the margin is part of the instrument.

### §39.6 A gate that was red before this session, and is not any more

`export-ledger:check` failed on the **committed** catalog: `4e5e0fc0` (s67) carried a peer's
`node-catalog.json` hunk that added `noodl.cloud.listusersinrole` with no ledger entry. Measured on
`git show HEAD:…` before assuming it was the working tree. Cloud-only ⇒ `backend-only`, one entry,
gate green at 176 types. The s67 handoff's *"export-ledger:check # 175 types"* was true when
written and false by the time it was committed — the catalog moved under it.

### §39.7 What this leaves

- **Next by the same rule** — the remaining ordinary nodes with no design question: **Cloud
  Services (9)**, *"mostly unblocked by EXP-009"*, still unmeasured since session 35; the
  controlled-state gap (§38.3, a checkbox/slider into a Variable); `Component Children` (Tier
  3.10, but a component library's commonest node); the animation pair.
- **The order-dependence probe** (§39.3), owner P18, one graph per family.
- **The date/util/id verdict sweep vs the reactive Condition** (§39.3), owner P18.
- `Set Variable` with a typed value is still refused (§38.3 #2) — the fixture again fed every
  setter from a `String` constant's `savedValue`, the third fixture to route around it.

## §40 The chain a node owns, measured as a class — and the two defects standing behind the false note (session 69, 2026-09-01)

**Picker unchanged at 80/127.** This session built no node. It took §39.7's first item — *"the
order-dependence probe, one graph per family"* — and the probe found that the false note was the
visible end of three defects, two of them in code that ships today. All three fixed, graded by a
new suite (28 rows) and eight mutant arms, every gate green.

### §40.1 The probe — six families, three triggers each

One test file, one loop: for each of `External Link`, `Now`, `Unique Id`, `UUID`, `HTTP Request`
and `Navigate To Path` (§39.3 named the first four; Navigate To Path shares the shape), the same
graph three ways — trigger wire first, chain wire first, and no trigger at all — and then a fourth
with a **reactive Condition's `On True`** as the only trigger. Read `app.notes` and the emitted page.

| family | chain-first vs trigger-first | fired only from a reactive arm | nothing fires it |
|---|---|---|---|
| External Link | 🔴 notes differ; page identical | 🔴 both chain wires "dropped" | 🔴 node **not named at all** |
| Now | 🔴 | 🔴 "dropped" **and** *"its Read is never fired"* — while the chain was emitted | 🔴 not named; **disposition `collapsed`** with nothing emitted |
| Unique Id | 🔴 | 🔴 "dropped" + *"its New is never fired"* | 🔴 not named |
| UUID | 🔴 | 🔴 same | 🔴 not named |
| HTTP Request | 🔴 | 🔴 "dropped" + *"its Fetch is never fired"* — **and `fetchRequest`/`setrequestError` emitted with nothing declaring them** | named (the one family with a sweep) |
| Navigate To Path | 🔴 | 🔴 "dropped" | 🔴 not named |

Every family was order-dependent, exactly as §39.3 read it. But the reactive column is the one
worth the session: a chain wire whose trigger is a reactive arm was reported dropped **in every
order**, because that trigger wire is never the attach pass's to take — so the fix §39 made for
three nodes (a `continue` per family) was necessary and could never have been sufficient.

"Not named at all" has a mechanism of its own: an idle node fell to the catch-all `logic node (…)`,
and `sweepUnreportedDeferrals` suppressed even that line, because the false wire note carried the
node's id and the sweep reads "the id appears in a note" as "the node has been named". The false
note was hiding the missing one.

### §40.2 🔴 The earn scan ran before the two effect producers existed

The block that decides what a component *earned* — which popup slots, record verbs, requests,
`Now`s, ids and links actually attached, and therefore which modules, rows and `useState`s are
emitted — walks `plan.handlers`, `plan.changeHandlers` and `plan.receivers`. The reactive
Condition pass and the Value Changed pass, the two other producers of attached actions, ran
**after** it (and after the HTTP and date/util/id sweeps, and after Pass 4f's `attachedHttpNodes`
read). So a node fired only from either:

- was **filtered out of the plan while its call stayed in the effect** — `await fetchRequest()`
  with no `src/api/http.ts` export and no error row (`TS2304` ×3 on the emitted page), and a
  `setOpenPopup('AboutDialog')` with no slot state behind it;
- was named *"never fired by a translatable source"* by a sweep that ran before it attached
  (§39.3's second hazard, now measured: `Now`, both ids, `HTTP Request`);
- answered "nothing fires it" to a rendered `Response` binding in Pass 4f.

s68 had moved **one** consumer (the Log/Delay sweep) below the producers and named the rest as the
same hazard. The fix is the inverse and it is one move: the two passes now run **inside the earn
block**, after the handler scan and before the filters, and their effects are scanned there. Every
consumer downstream sees them; no sweep moved. Filed as a memory —
*a new producer owes every consumer of the old one* — because the shape is general: consumers are
written against the producer that exists, and a suite whose graphs all trigger from a button is
green over the hole.

### §40.3 🔴 A branch arm holding a *statement* printed `if (c) <statement>` — and the chain ran unconditionally

The probe's page for a Condition-gated `External Link` with a Done chain, reactive or Evaluate:

```
if (noteDraft.get()) window.open('https://example.com/docs', '_self', '');
afterdone.set(noteDraft.get());;
```

The arm printer emitted a one-action arm as `if (c) ${actionCode(a)}` whatever the action was.
`External Link` and `Navigate To Path` print their Done chain as *following statements at column
0*, so the chain landed **after the `if`** — run on every evaluation, true or false — and the `;;`
was the printer's terminator on top of the action's own. That is not a note that lies; it is an
export that does something the app does not, in the direction §11.3 forbids. Beside it, two more
in the same printer: an `HTTP Request` in an arm was `await`ed inside a **non-async** arrow
(`handlerArrow`'s `isAsync` looked one level deep; `TS1308`), and `useEffect`'s callback cannot
be `async` at all; and a `Delay`'s `if` inside an arm printed its body at column 0.

Fixed in `component.ts` by hoisting the "is this a statement" predicate out of `handlerArrow`
(`actionIsStatement`, `actionTakesNoTerminator`), a shared `blockBody(expanded, indent)`, and an
`effectBody` that wraps an awaited effect in `void (async () => { … })();`. An arm becomes a block
whenever any of its actions is a statement, is awaited, or prints more than one line; the
expression arms keep `if (c) x;` and `{ a; b; }` — the forms every older golden pins, which is the
control. `ifElse`'s `startsWith('{')` join already handled a block before an `else`.

### §40.4 Graded — `tests/chain-wire-order.test.ts`, 28 rows, 52 files on disk

§A six order rows (notes equal, page identical, chain emitted). §B six reactive rows (no false
note, no "never fired", the chain **inside** the effect's arm by brace-counting, typechecks) plus
the HTTP async IIFE + module row and a Show Popup slot row. §C the arm block: External Link and
Navigate To Path chains inside the arm once and no `;;`; HTTP `async` handler; Delay indented;
a block arm beside an `else`; and the two one-line controls. §D six idle rows by sentence. §E a
Value Changed firing a `Now` and an `HTTP Request`.

Eight mutant arms, each restored by `diff -rq` against the post-fix snapshot:

| arm | mutation | killed by |
|---|---|---|
| A | the `OWN_CHAIN_OUTPUTS` skip removed from the attach loop | **23** — all §A, §B, §D, the Now §E row, and four of s68's §39 rows |
| B | the effects not scanned by the earn block | **4** — the HTTP module rows and the popup slot row |
| B2 | the two passes moved back below Pass 4f | **6** — three reactive rows, both HTTP module rows, the slot row |
| C | a statement arm printed inline | **8** — all five §C shape rows, plus UUID and both HTTP reactive rows (typecheck) |
| D | no async IIFE around an awaited effect | **3** — the three HTTP effect rows |
| E | the idle-chain clause removed from the date/util/id sweep | **3** — Now, Unique Id, UUID idle rows |
| F | the link/navigate sweep removed | **2** — their idle rows |
| G | `isAsync` shallow again | **1** — the HTTP-in-an-arm handler row |

⚠️ Arm E's first mutation (`false &&`) **broke the typecheck** rather than the tests — `tsc` saw
`chainSink` as possibly undefined once the guard was constant — and the runner's tsc gate caught
it before jest could read `Tests: 0 total` as a kill (s66's rule, still paying). Re-run with a
comparison that compiles.

### §40.5 What this leaves

- ⚠️ **Typechecked, not driven.** The emitted shapes are graded by `typecheckEmittedApp` and by
  parse, not by a running app. The honest drive is a fixture with a reactive Condition firing an
  `HTTP Request` — and that needs a backend or a stub server. Owner P18, beside Cloud Services.
- ⚠️ A record verb (`api-call`) in a reactive arm inherits §40.2's fix and has **no row** —
  `cheer` has no backend. The row belongs on `puppy-test-3`. Owner P18.
- A named idle verdict now sits beside Pass 6's generic wire line for the same chain — a stutter,
  and the same one Log/Delay have. Accepted.
- **Next by the same rule:** Cloud Services (9) — `Cloud Function` first (3 corpus projects, 7
  nodes; the node is `CloudFunction2`: `Call`, `function` + `in-*` params, `out-*` results,
  Done/Failure/Completed + `Error`, `POST /functions/<name>` through the EXP-009 client's
  `request()`). The `http-call` action and `src/api/http.ts` are the precedent line for line.

## §41 Tier 2.6 begins — `Cloud Function`, the first of the nine Cloud Services (session 69, 2026-09-01)

**Picker 80 → 81 of 127 (63.8%)**, floor raised in the same commit. EXP-009's AC4, open since
session 33 — *"the client gains `/functions/<name>` when the node does"* — and the node is
`CloudFunction2`: `Call`, a `function` parameter naming the backend function, dynamic `in-<param>`
inputs and `out-<result>` outputs persisted under `dynamicports` (so the parser already had them
as `declaredPorts`), Done/Failure/Completed and `Error`, no `Unchanged`. The runtime POSTs
`/functions/<encodeURIComponent(name)>` with the params as the body and maps `result[key]` onto
`out-<key>` (`cloudfunction2.ts` `doCall`, `_makeRequest`). Corpus: 3 projects, 7 nodes, four
functions (`publishPage`, `duplicatePage`, `submitContactForm`, `claimSite`).

### §41.1 The build — `HTTP Request` one node over

| piece | what it is | where |
|---|---|---|
| `src/api/functions.ts` | one function per node: the declared `in-*` ports as parameters (a wired one is `params.x`, an authored one is folded into the body, in declared order), the declared `out-*` ports as a typed results interface (`any` per port — they are `*`; a result a wire reads that the declaration lacks is added; an odd name is quoted). **Connected**: `return callFunction<T>("name", { … })`. **Stub**: `throw new Error('No cloud services defined in this project.')` — the sentence the interpreter answers Failure with when the project declares no backend | `functionsModule()` in `emitApp.ts` |
| `callFunction(name, params)` on the client | `_makeRequest` line for line: the app id header, the session token when someone is signed in, JSON body, `fetch` failure → *"Could not reach the backend at ⟨endpoint⟩"*, a status other than 200/201 → the backend's `error` string else *"Failed running cloud function."*, `result ?? {}` on success | `clientModule()`; the golden `client.ts.golden` regenerated, and the diff was exactly this block |
| `cloud-call` action | `try { const answer = await callX({…}); [setXOut(answer)]; …done } catch (error) { const message = …; setXError(message); …failure }` — the two outcome chains are one try/catch, because the function throws where the node reports Failure. The results row is written only where something outside the chain reads a result; the Error row always, as the runtime writes `_internal.error` | `compileCloudCall`, `actionCode` |
| `cloud-out` expression | `Error` and `out-*`: the chain's local inside the Done chain, only `Error` inside the Failure chain (that arm runs where no result arrived, and `resultsValues` there are the previous call's), the state rows everywhere else — `httpChainScope`'s rules | `resolveExpr`, `exprCode` |
| the toll | `TRIGGER_PORTS`, `OWN_CHAIN_OUTPUTS` (§40's table, so the chain wires are order-independent from birth), the earn scan (`attachedCloudNodes`), the HTTP sweep generalised to both types, Pass 4f's `isCloudRead`, the session walker, `fillMaterialize`, the late row filter, `deepActions`, the reads walker, the async predicate, the no-terminator list, the import collector, `actionExprsOf`, the report and pre-flight sentences | counted by `grep -n "'http-call'"`: 7 sites in `plan.ts`, 9 in `component.ts`; every one paid |

Refused by name: a wired `Function` (*which cloud function is called is not statically knowable*),
no function name (*every Call answers Failure with "No function specified" and never sends a
request*), a consumed `Completed` (the join, HTTP's sentence), any other output, two wires into
one parameter, a result read from the Failure chain — and a result bound in render when the Call
never attached, or a node nothing fires, by the sweep (*its Call is never fired by a translatable
trigger*).

### §41.2 What building it found

- ⚠️ **The report bullet was keyed on the wrong field.** `usesBackend` is *"does this project ask
  anything of a backend"* — true for a cloud call whether or not a backend is declared — so the
  stub form said its calls went *"through `src/api/client.ts`"*. Caught by the first probe;
  keyed on `backendMode(data) === 'connected'` now, and §B's report row pins both sentences.
- ⚠️ **A probe's console output carries jest's four display spaces.** Two rows in two suites this
  session were first written with the wrong column, taken off a printout. The emitted file's own
  column is the only one to copy.
- ⚠️ **A second wire into a `Set Variable`'s `value` is silently ignored** (first wins). Three
  rows were green-for-the-wrong-reason until their setters were built bare; the shared helper
  wires the draft variable into `value` and that is invisible from the row.
- ⚠️ `false && x` as a mutant breaks `tsc` (narrowing) — §40.4's lesson again, so `mut41.py`
  mutates by deleting a line or returning a value, never by a constant guard.

### §41.3 Two divergences, written down rather than hidden

1. **A function that answers no result** leaves the interpreter's previous `resultsValues`
   untouched and fires Done; the export sets the row to `{}`. Faithfulness here needs the previous
   row merged in — one line in the handler — and it is left for the drive to decide whether it
   matters, because no corpus function answers nothing.
2. The runtime sends `x-noodl-cloud-version` when `deployVersion` is set; the client does not —
   and the record verbs never did either (EXP-009). Same owner.

### §41.4 Graded — `tests/cloud-function.test.ts`, 20 rows, 53 files on disk

§A the module (connected, stub, absent, the union-of-declared-and-read results type with a quoted
name, the all-authored signature). §B the component (the async handler and both arms; the row
written only where a render read needs it and the type imported; `Error` in render and in the
Failure arm; the report's two sentences). §C six refusals by their sentences. §D the §40 class
rows for this node — wire order, a reactive Condition trigger (async IIFE, module earned), an
idle node named with nothing left behind. §E `tests/fixtures/call-desk` — the second fixture
with a backend, chain wires listed before the trigger — whole but for the scaffold note and the
connected-api note, `client.ts` + `functions.ts` + `.env.example`, typechecks. ⚠️ The on-disk
sweeps (`emitted-syntax`, `typecheck-emitted`) picked the fixture up too: 36 new rows for 20
written.

Nine mutant arms, each restored by `diff -rq` against `snap41-post/`:

| arm | mutation | killed by |
|---|---|---|
| A | the node's chain outputs not skipped by the attach pass | **2** — the order row, the fixture's whole-export row |
| B | never earned (`attachedCloudNodes` never added) | **11** — every row that reads a module, a row or the client |
| C | the stub returns `{}` instead of throwing | **1** — the stub row |
| D | authored parameters dropped from the body | **3** — the folded `publish: true` rows and the fixture |
| E | results type from wires only, not the declaration | **2** — the interface rows |
| F | the results row always written | **5** — "no row is written", the stub row, and three typecheck rows (a setter nothing declares) |
| G | a result read from the Failure chain allowed | **1** — its refusal row |
| H | the sweep no longer names the node | **2** — both idle rows |
| I | `callFunction` sends no session token | **2** — ⚠️ **only the client golden's two pins.** No behavioural row here can see the header; that is the drive's job (§41.5) |

### §41.5 What this leaves

- 🔴 **Typechecked, not driven.** Nobody has called a real function from an exported app. The
  drive: a local `nodegx-backend` with a project declaring `publishPage` (the corpus has three),
  `call-desk` exported against its endpoint, `vite build`, click Publish, read `published` /
  `pageId` / `Error`; then stop the backend and read *"Could not reach the backend at …"*. Arm I
  says why it matters: the session token is pinned only by a golden.
- The other **eight** Cloud Services — `Record`, `Set User Properties`, `Sign In With`, `Request
  Magic Link`, `Subscribe To Changes`, `Upload File`, `Cloud File`, `Sign File URL` — each
  re-measured against the client. `compileCloudCall` + `functionsModule` are the precedent for
  *a client call with a typed answer*.
- §41.3's two divergences, owner P18 with the drive.
- The controlled-state gap (§38.3), `Component Children`, the animation pair — carried.

## §42 The `Cloud Function` drive — a real function called from an exported app, and the two cells that disagreed (session 70, 2026-09-02)

**Picker 81 unchanged.** §41.5's first item: nobody had called a real function from an exported
app, and arm I (the session token) was pinned only by the client golden. This section is the
drive, and what it found. Instruments in the s70 scratchpad: `control.mjs` (the curl-level
control), `EXPECTED.md` and `EXPECTED-POSTFIX.md` (both written before their drive ran — the
mtimes say so), `drive.mjs` (CDP, headless Chrome 151), `backend-data/workflows/calldesk.workflow.json`
(the drive-only function), `backend.log` / `backend2.log` (the backend's own request log, one line
per call with the principal), `harness/` (the exported app, built), `mut42.py` + `runmut42.sh`.

### §42.1 The rig

- A local `nodegx-backend` (`node bin/nodegx-backend.js serve --data-dir … --port 8591`) with one
  bundle in `<dataDir>/workflows/`: `publishPage`, a Request node (`params: pageId,publish`,
  `allowNoAuth: false`) → a Function node → three Response nodes: `{ pageId: "<pageId> by
  <userId>", published: <publish> }`, a failure *"This page could not be published."* for `bad`,
  and a Response with no params for `empty` (answers `{ result: {} }`). ⚠️ **A Function node in a
  bundle needs its signal outputs declared as `ports`** (`out-ok`, `out-fail`, `out-empty`) — the
  first bundle carried only the script, and `Outputs.fail is not a function` sat behind a 30 s
  *"did not send a response"* timeout. The corpus's own `__cloud__/publishPage` (SBR-015) needs
  `Page`/`Section` collections, an admin role and a `RunTasks` worker, so the drive function is
  the corpus function's contract without its dependencies.
- `call-desk` exported by `scripts/emit-app.ts` into a copy of s68's prepared harness, `.env`
  pointing `VITE_NODEGX_ENDPOINT` at :8591 (the built bundle carries the string once, checked),
  `vite build`, `vite preview` on :5391.
- The session: `POST /users` once (user `driver`), then the `WireSession` seeded into
  `localStorage['Parse/backend_calldesk/currentUser']` — the runtime's own key, which is why an
  exported app and its interpreter agree about who is signed in. ⚠️ **The Chrome profile persists
  localStorage across drives**: the second drive's D2 succeeded instead of being refused until
  `localStorage.clear()` was added after the first load. The backend log has the failed attempt
  as a `200 user` line at 12:24:04, before the real run.
- The control (`control.log`) before the browser: anonymous → `500 "Unauthenticated requests not
  accepted."` (enforced even with `devOpen: true`); token → `200 { result: { pageId: "p-1 by
  055b2080-…", published: true } }`; `bad` → 400; `empty` → `200 { result: {} }`; a missing
  `publish` → `400 function/bad-request` (the authored parameter is folded, so the export never
  sends that one).

### §42.2 Seven steps, written down first, every cell as predicted — including the two wrong ones

| step | action | what the export showed |
|---|---|---|
| D1 | load, no session | every readout empty; **0** calls to `/functions` on mount |
| D2 | `p-1`, Publish, no session | `Error` and the Failure chain's Variable: *Unauthenticated requests not accepted.* |
| D3 | session seeded, reload, `p-1`, Publish | `pageId` = `p-1 by 055b2080-…` (the user id — the token was sent), `lastPublished` the same, `Error` empty; **`published` = `''`** where the interpreter prints `true` 🔴 |
| D4 | `bad` | `Error` and `lastError` = *This page could not be published.*; the results untouched (the catch arm never writes the row — matches) |
| D5 | `p-2` | results move to `p-2 by …`; **`Error` still holds D4's sentence** — never cleared on success, as `cloudfunction2.ts` never clears `_internal.error` |
| D6 | `empty` | **`pageId` → `''`, `lastPublished` → `''`** where the interpreter keeps `p-2 by …` 🔴 (§41.3's first divergence, measured) |
| D7 | backend stopped, `p-3` | *Could not reach the backend at http://localhost:8591* — the client's own sentence |

The backend's log for the drive: `500 anonymous`, then `200 user`, `400 user`, `200 user`,
`200 user`. **That line is arm I measured behaviourally** — the header the mutant could only
reach through a golden pin, read off the receiving end.

### §42.3 The two defects, and their fixes

1. 🔴 **A `*`-typed result in a text sink dropped booleans.** `{publishPageOut?.published}` is a
   boolean in a JSX child position and React renders that as nothing; the runtime's Text node
   prints `String(true)` (`renderableText`, Text.tsx — `null`/`undefined` clear, everything else
   is stringified). Tier 1.2 had already made this decision for `http-out` and the cloud results
   are the same `any`; `childText` now coerces `cloud-out` results with `String(… ?? '')` and
   leaves the `Error` output on the bare path (it is the one string this emitter writes itself).
2. 🔴 **An answer replaced the row; the runtime merges it.** `doCall` writes `resultsValues[key]`
   per key the function answered and leaves the rest as the previous call left them; the export
   did `setPublishPageOut(answer)`. Now, where a row exists: `const publishPageAnswer =
   { ...publishPageOut, ...(await callPublishPage({ … })) };` — the chain's own reads go through
   the merged local, so a Set Variable fed by an unanswered result reads the previous value, as
   its node does. ⚠️ **Residual, by name:** with no row (nothing outside the chain reads a result)
   there is nothing to merge over, and a chain read of a result the function did not answer reads
   `undefined` where the interpreter reads the previous call's. A row is minted only for render
   reads (§41.4 arm F's rule) and this session did not change that; the row that pins the bare
   call names the residual so the next reader knows it was chosen, not missed.

Post-fix drive (`drive2.log`, `EXPECTED-POSTFIX.md` first): D3 `published` = `true`; D6 all three
cells unchanged; everything else identical. Re-emitted, rebuilt, re-driven — not re-read.

### §42.4 Graded — `tests/cloud-function.test.ts` 20 → 24 rows; 53 files on disk

§F: a result in a Text is coerced (and the bare form is absent); the `Error` output stays bare;
with a row the call merges and the chain reads the merged local; with no row the call stays bare
— the residual pinned by name. Three older rows re-pinned to the coerced shape (the odd-name row,
the render-read row, the fixture's whole-export row, which also pins the merge line).

| arm | mutation | killed by |
|---|---|---|
| J | `cloud-out` results no longer coerced in a text sink | **4** — the odd-name row, the render-read row, the fixture row, §F's coercion row |
| K | the answer replaces the row again | **2** — §F's merge row, the fixture row |

Gates: package `tsc` 0, editor `tsc` 0, jest **1400/1400 in 53** (53 files on disk), the picker
81/127 unchanged. Arms restored by `diff -rq` against `snap-src-post/`.

### §42.5 What this leaves

- §41.3's second divergence (`x-noodl-cloud-version` when `deployVersion` is set) — still open,
  still shared with the record verbs, owner P18.
- The §42.3(2) residual — a row minted for a chain-only read would close it; not worth the
  emitted surface until a corpus graph reads an unanswered result in a chain.
- The other eight Cloud Services, now surveyed against the client (s70's survey is in the
  handoff): by corpus count `Record` (22 nodes, every one `idSource: explicit`, the id fed by a
  Function node's output in 21 and by `PageInputs` in 1, `Fetch` fired by that Function's
  `out-ready`, outputs mostly into text inputs' `startValue` and checkboxes' `checked` — §38.3's
  controlled-state gap sits right behind it) is first; `Upload File` (17, but its only source is
  the untranslated `Open File Picker`) and the rest are 0 in the corpus.
- The record-verb row for `puppy-test-3` (§40.5) and the reactive-Condition HTTP drive — carried.

## §43 Tier 2.6 continues — `Record`, the read by Id, in both of its forms (session 70, 2026-09-02)

**Picker 81 → 82 of 127 (64.6%)**, floor raised in the same commit. The most used of the eight
Cloud Services left — 22 corpus nodes, every one `idSource: explicit`, the Id fed by a Function
node's output in 21 and by `PageInputs` in 1, `Fetch` fired by that Function's `out-ready` in 21
and by an Update Record's `done` in 4, the outputs into text inputs' `startValue` (68), checkboxes'
`checked` (17) and Texts (12). Ranked by the product surface rather than that census (the memory's
rule): a Record fed from a Page Inputs parameter or a Variable, with `Fetch` wired to a button or
left unwired, is the detail page every app has.

### §43.1 What the runtime does (dbmodelnode2.ts), and what that decides

- `setModelID(id)` binds the node to the process-wide `Model` for that id **the moment the Id
  arrives** — `id` reads it at once, every `prop-<key>` the model already holds is flagged, and
  `fetched` fires — *before* any read. `scheduleFetch` (the `Fetch` port) then GETs
  `/classes/<class>/<id>` and flags every `prop-<key>` the answer carries; an empty Id is
  `setError('Missing Id.')` → Failure without a request.
- `runOnValueChange: { controlSignal: 'fetch', inputs: ['modelId'] }` (NDA-017): with `Fetch`
  **wired**, the node reads only on the signal; **unwired**, it reads on every change of its Id.
  That is the whole reason there are two forms.
- `changed` and `changed-<column>` fire from the shared model whenever *any* node writes it — a
  pub/sub with no static shape. `fetched` is two events on one port.

### §43.2 The build — the Cloud Function shape, with the collection module where the functions module was

| piece | what it is |
|---|---|
| `fetch<Type>ById(id)` in `src/api/<plural>.ts` | joins the class's query and record verbs — **one module per class**, the query's rule. Connected: `return fetchOne<Page>('Page', id)`. Stub: **throws** (`'fetchPageById is not connected to a backend yet'`) — unlike the query's `[]`, because a record that does not exist is a Failure in the interpreter too and the graph's Failure path is already drawn |
| the interface | the schema snapshot first (`tsColumnType`, now **exported from `plan.ts`** and read by the module and by every column read, so the two cannot disagree), then the columns the graph *writes* (RECORD-VERBS §10a), then the columns a Record *reads* that neither carries — as `unknown` |
| `fetchOne<T>(collection, id)` on the client | `GET /classes/<collection>/<encodeURIComponent(id)>` → `fromWire` (`objectId` → `id`); the golden regenerated, the diff exactly that block |
| `record-fetch` action | wired form: `try { const pageRecordId = <id>; if (empty) throw new Error('Missing Id.'); const pageRecord = await fetchPageById(pageRecordId); [setPageRow(pageRecord);] …done } catch (error) { …message; setPageError(message); …failure }`. The row is **replaced**, not merged (§42's merge is the Cloud Function's — `setModelID` binds a fresh model per Id). No guard on a literal Id: the planner refused an empty one, and `'home' === ''` is a TS2367 |
| the effect form | `Fetch` unwired ⇒ `useEffect(() => { void (async () => { <the same body> })(); }, [<the Id's render local>])` — a literal Id runs once at mount (`[]`). Planned beside the reactive Conditions, inside the earn block, so a render read sees the node attached |
| `record-out` expression | `Error` and `prop-<column>`, carrying the column's **declared type**: the row (`pageRow?.title`) everywhere, the chain's local inside the Done chain; `Error` only, inside the Failure chain. `Id` resolves to the **feeder** — it is bound before any read |
| sinks | a string column folds like every string-typed read (`{pageRow?.title ?? ''}`); a boolean, a number or an undeclared column takes the untyped Variable's table — `String(… ?? '')` in a Text or a string attribute, `!!` at a boolean sink — **§42's boolean lesson decided by the declared type rather than found by a drive**, and coerced once (the first draft coerced twice) |
| the toll | `RECORD_TYPE` + `RECORD_OUTPUTS`, `OWN_CHAIN_OUTPUTS`, `TRIGGER_PORTS`, the dispatch, names (`fetch<Type>ById`, `<stem>Record`/`Message`/`RecordId` — a trailing "record" in the label is stripped, and the Id local is `RecordId` because `pageId` is the ordinary feeder and `const pageId = pageId.get()` is a TS2448), two state-var origins, `resolveExpr`, `maybeUndefined`, `exprTsType`, `exprValidIn`, `actionsValidIn`, `snapAction`, the earn scan, the session walker, the late row filter, `fillMaterialize` (**and its effect list** — the first draft left the effect's row unset, TS2552), the render pass's `isRecordRead` (**the second consumer** §7.5 named — the first draft resolved a column and dropped the wire), the idle sweep; in the emitter `collectExprUse`, `allActions`, `deepActions`, `hookExprSources`, `referencedStateNames`, names, `exprCode`, effect deps, reads, `actionCode`, the no-terminator and await lists, the `useEffect` gate, the module imports, `childText`, `bindingExpr`, the effects loop, `actionExprsOf`; in `emitApp` the module type, the loops, the emission, the client import, `fetchOne` |

Refused by name: no class; a wired class; a second backend (`backendId` other than `_active_`);
a repeater-bound Id (`idSource: foreach` / `repeaterComponent`); two wires into the Id; no Id at
all; a consumed `Fetched` (*fires when an Id is bound and again after every read*); a consumed
`Changed` / `changed-<column>` (*the in-process record store's pub/sub*); a consumed `Completed`;
any other output; a column read from the Failure chain. Two older rows re-pinned: the relation
verbs' §17 used to pin *"a single-record read by Id has no shape in the api stub"* twice, and
both now pin the positive half — the reason is gone and `fetchPuppyById` is in the module.

### §43.3 What building it found, and what is written down rather than fixed

- ⚠️ **The corpus's Records are fired by a Function node's signal output** (`out-ready`, 21 of
  22), and a JS Function's signal outputs are no-op callables in this export (EXP-003 §4) — so
  the attach pass drops that trigger wire with the *trigger's* reason, not this node's. The
  product-surface forms translate; the corpus form waits on EXP-003's signal chains.
- ⚠️ **A wire from an untranslatable trigger disposes its sink with the trigger's reason and no
  node line** — for every node type. The §D row pins that, because the first draft expected the
  idle sentence and the class rule is the honest one.
- 🔴 **Residual, wired form:** the runtime rebinds on every Id change (`setModelID`) so its outputs
  read undefined the moment a new Id arrives; the export's row is written only by `Fetch`, so it
  holds the previous record until the next Load. A row effect keyed on the Id would close it.

### §43.4 Graded — `tests/record.test.ts`, 29 rows, 54 files on disk (the gates: §43.6)

§A the module (connected through `fetchOne`, the stub that throws, the undeclared column as
`unknown`). §B the component (the handler with the `Missing Id.` guard; the row only where a
render read needs it; a string column bare, a boolean/number/undeclared column coerced once; `Id`
resolving to the feeder; `Error` in render and in the Failure arm; the effect form keyed on the
Id's render local; a literal Id with no guard and `[]`; the effect form's silent return and row
clear; the wired form keeping its throw). §C ten refusals by their sentences. §D wire order (the
cloud row's shape) and a Fetch wired from an untranslatable trigger (the class rule: the trigger's
reason, no node line). §E `tests/fixtures/page-desk` — both forms on one page — whole,
typechecked. Two rows in `relation-verbs.test.ts` §17 re-pinned to the positive half.

**Status at the end of session 70:** the rows before the effect-form fix passed 27/27; the file
with it (29 rows on disk — the handoff's "30" was a miscount), the whole suite, the mutant arms
and the drive were not run: every attempt from 15:05 died with exit 137 under the box's memory
pressure, and Richard stopped the session — *one heavy job at a time*. Session 71 ran them, one
at a time (§43.6).

### §43.5 What this leaves

- §43.3's residual (the wired form's row on an Id change) and §41.3's `x-noodl-cloud-version`.
- The other seven Cloud Services, surveyed in s70's handoff.

### §43.6 The gates, the arms and the drive — and the sentence that belonged to a different helper (session 71, 2026-09-02)

Run one at a time, `vm_stat` and `ps` read before each, every server torn down by the runner's
own `trap` the moment the drive ended (`drive43-run.sh`, s71 scratchpad) — 0 listeners left on
:8591/:5392/:9342 after both runs.

**The gates as built.** Package `tsc` 0; `tests/record.test.ts` 29/29; the whole suite 54 files,
1445/1445, exit 0 in 166 s; the editor's `tsc` 0. **The arms** (`mut43b.py` / `runmut43b.sh`,
s71 scratchpad — s70's `mut43.py` re-anchored after the effect-form fix, `snap43-post` retaken
from the gate-green source first, and two arms added for the fix itself), each tsc-gated,
each restored `diff -rq` clean:

| arm | what it removes | killed | by |
|---|---|---|---|
| A | `RECORD_TYPE` from `OWN_CHAIN_OUTPUTS` | 2 | the §D wire-order row, the fixture |
| B | the earn scan's `attachedRecordNodes.add` | 19 | nearly every row |
| C | the wired form's `Missing Id.` throw | **12** | the guard rows *and every emitted-typecheck row* — the guard is also the **narrowing**: without it the Id local is `string \| undefined` and `fetchPageById(id)` is a TS2345 |
| D | the effect pass (`viaEffect`) | 7 | the effect rows, the fixture |
| E | the declared-type coercion | 4 | the coercion rows |
| F | `fillMaterialize` over the effects | 5 | the effect materialize rows, the fixture (TS2552) |
| G | the render pass's `isRecordRead` (`id` only) | 7 | the render reads |
| H | `encodeURIComponent` in `fetchOne` | 2 | the client golden — read by two rows |
| I | the effect's silent `return` on an empty Id | 4 | the two effect-form rows + two typecheck rows |
| J | the effect's `set…Row(undefined)` clear | 1 | the row-clear row |

⚠️ Arm J's first shape (`const clear = [];`) was **not a kill — it was a TS7034**, an untyped
empty literal, and the tsc gate reported "not a kill" while measuring nothing; re-shaped to
`const clear: string[] = []` it killed its one row. A mutant that deletes an initialiser must
keep the declared type or the arm is a blank.

**The drive**, `EXPECTED43.md` written by s70 before any run; harness re-emitted and rebuilt
after the effect-form fix (`.env` → :8591, the bundle carrying the string once); the two `Page`
records from `control43.mjs`; `localStorage.clear()` after the first load.

🔴 **First run: D1–D7 as predicted, D8 timed out.** The drive waited 8 s for the live Error to
start *"Could not reach"* and threw — and, throwing, lost its snapshot of D1–D7 (the `out`
object printed only at the end; the backend's own log had to stand in: six GETs at exactly the
steps predicted — D2, D3, D4, D5, D7 ×2 — and none at D1 or D6; SIGTERM at D8 "stopped cleanly").
The cell was then **observed**, not inferred: the pre-fix bundle served with no backend, an Id
typed — `[9]` read **`Failed to fetch`** in 58 ms, and Load put the same two words in `[5]` and
`[7]`. Chrome's own sentence.

**The defect is older than §43.** `client.ts` has two `fetch` sites: `callFunction()` (§41)
wraps a network failure as *"Could not reach the backend at <endpoint>"*; `request()` — which
every query, record, session and user verb rides — did not, so an exported app answered the
**same condition with two sentences** depending on which verb met it, and the Cloud Function
drive's D7 measured only the wrapped one. `EXPECTED43.md` copied §42's sentence onto a node that
rode the other helper — [[a-predicted-sentence-belongs-to-one-code-path]]: a prediction is a
claim about a *producer*, and nobody had named which helper the Record called. **Fix:** `request()`
wraps its `fetch` in the same `try/catch` with the same sentence (`emitApp.ts`); the client golden
regenerated, the diff exactly that block; a row in `backend-client.test.ts` pins **two `fetch`
sites, two wraps, one sentence, each `catch` before `response.text()`** — the cardinality, not a
substring (a `not.toContain('Failed to fetch')` matched the comment that names it, and was
dropped for that reason). The interpreter's Record reports whatever its store passes to
`setError`; the export's client owns its own sentence, and now has exactly one.

**Second run, fixed client: 72 cells, 0 diffs** (`drive43.log`, compared programmatically
against the table in `EXPECTED43.md`, `backendStoppedBeforeD8: true`). Read out of it:

- D1 quiet — the effect ran at mount with an empty Id and printed nothing, made no request.
- D2 the effect read on the Id alone (`[8]` Welcome) while the wired row stayed empty.
- D4 the live row **cleared** on the new Id and its Error read `Object not found.` (the
  backend's sentence, carried through `request()`); the wired row kept Welcome — §43.3's
  residual, still written down, still not fixed.
- D6 an empty Id: the wired form's `Missing Id.` in `[5]` and `[7]`, the effect silent, `[9]`
  keeping the old `Object not found.` (never cleared — `dbmodelnode2.ts`).
- D7 both forms read B; every earlier Error kept its last sentence.
- D8 the backend down: `[5]`, `[7]`, `[9]` all *"Could not reach the backend at
  http://localhost:8591"* — the sentence, from both helpers, one. Console errors: `[]` (the
  harness listens to `Runtime.consoleAPICalled`/`exceptionThrown`, not `Log.entryAdded`, so
  Chrome's `net::ERR_CONNECTION_REFUSED` lines are not in that list — the cells are the
  measurement, the empty list is not).

**The gates after the wrap** (each alone on the box): package `tsc` 0 · `backend-client.test.ts`
17/17 · the whole suite **54 files, 1446/1446, exit 0** · the editor's `tsc` 0 ·
`export-ledger:check` OK (176 types, 89 translated) · picker **holds at 82/127** — the wrap is a
client fix under a node already counted. Committed by pathspec with §43; the README's one
uncommitted line is a peer's EXP-001 publish note and stays theirs.


## §44 Tier 2.6 continues — `Set User Properties` and `Request Magic Link`, the two session verbs (session 72, 2026-09-02)

**Picker 82 → 84 of 127 (66.1%)**, floor raised in the same commit. The two Cloud Services that
ride the user family's own machinery (s70's survey, §43.5): a `PUT /users/<objectId>` with the
stored session rewritten, and a `POST /auth/magic-link {email, redirect}`. Corpus: 0 of either —
ranked by the product surface (the memory's rule): a profile page that lets the signed-in person
change their name, and a sign-in page with "email me a link", are two of the four forms every
app with accounts has.

### §44.1 What the runtime does, and what that decides

- **Set User Properties** (`setuserproperties.ts` → `UserService.setUserProperties` →
  `ParseAuthAdapter.setUserProperties`): with nobody signed in, `error('Nobody is signed in.')`
  **before any request** (ERG-001 §4 closed the dead chain); else `PUT /users/<objectId>` with
  `{ email, username, …props }` (the backend accepts no id but the caller's own — `users.ts`
  answers 403 for any other), and on success `Object.assign(_cu, _content)` + `setSession` — the
  stored session is rewritten, which is what makes a `User` node re-render. The Error is never
  cleared. Ports: `email` and `username` static ("leave blank to keep the current one" — the
  node's own sentence), `prop-<key>` **runtime-discovered** per writable `_User` column
  (`user-ports.ts`), `backendId`.
- **Request Magic Link** (`requestmagiclink.ts` → `requestMagicLink`): `POST /auth/magic-link`
  with `{ email, redirect: redirect || _currentUrlWithoutAuthParams() }` — a blank redirect is the
  current page minus `nodegx_auth`/`nodegx_auth_error`. On success it **clears the Error and then
  fires Done** — the one verb in the family that does (`login.ts` and the rest leave the last
  refusal). The backend answers `200 {}` for a known and an unknown address alike (`oauth-routes.ts`
  — not an account-existence oracle), so Done never means an account exists; Failure is the
  request itself failing.

### §44.2 The build — the user family's `api-call`, two rows longer

| piece | what it is |
|---|---|
| `USER_VERBS` | two rows: `update-user` (trigger `store`, `setUserProperties`, inputs `username`/`email`, **`columns`**) and `magic-link` (trigger `send`, `requestMagicLink`, inputs `email`/`redirect`, **`clearsErrorOnDone`**). `UserVerb` is now a named union, and the three places that spelled it out (`api-call.verb`, `SessionCallPlan.verb`, the session module's `connected` record) read it |
| the columns | `Set User Properties` takes `prop-<key>` the record verbs' way — wire order, then authored literals the wires do not cover, two wires into one column refused — and `SessionCallPlan.writes` carries them typed by the wire (`string`/`number`/`boolean`, else `unknown`). The IR has no `_User` schema (`metadata.systemCollections` is not parsed, and every real project's is `[]`), and a *write's* type is its source's — §43's answer for a column the snapshot does not carry. Sign Up keeps §5.5's refusal (its columns would ride `POST /users`, whose answer the client merges into the session — not built) |
| `UserProperties` | one `type` per project in `session.ts`: `username?`, `email?`, then the union of every site's columns; a column two sites write with different types is `unknown`. A **`type`, not an `interface`** — the fixture's typecheck found TS2345: an interface has no implicit index signature, so it cannot pass to the client's `Record<string, unknown>` |
| `setUserProperties(data: UserProperties)` | `await updateUserRequest(data)`. Stub: throws the family's sentence |
| `requestMagicLink(email: string, redirect?: string)` | `await requestMagicLinkRequest(email, redirect)`. The call site **omits** the redirect when nothing feeds it (`requestMagicLink(email)`) rather than passing `''` — the client substitutes the current page for a blank one and the call should read that way; wired or authored, it is the second argument |
| `updateUserRequest(data)` on the client | `readSession()`; none → `throw new Error('Nobody is signed in.')` before any request; the body drops `undefined`, and drops `''` for `username`/`email` only (the node's contract); `PUT /users/<encodeURIComponent(objectId)>` through `request()`; then `writeSession({ …session, …body })` — the rewrite a `useSession` read re-renders on |
| `requestMagicLinkRequest(email, redirect?)` on the client | `POST /auth/magic-link` through `request()` with `redirect \|\| currentUrlWithoutAuthParams()`, the runtime's two parameters stripped |
| `clearErrorOnDone` on `api-call` | the emitter prints `set<Stem>Error(undefined);` right after the `await`, before the done chain — for the magic link only. Every other `api-call` keeps "never cleared" |
| the mint predicate | a control wired into a **column** earns local state, as one wired into a credential does (§44.3) |
| the `Backend` gate | a named `backendId` (anything but `_active_`/blank, or wired) refuses **every verb in the family** with the `User` read's sentence (§5.9) |
| the toll | `USER_VERBS` (+ `UserVerb`), `TRIGGER_PORTS`, the control-mint predicate, `compileUserOp` (the backend gate, the column loop, the per-verb args, the clear flag, `writes`), `SessionCallPlan`, the `api-call` action; in the emitter the clear line; in `emitApp` the `SPEC`/`connected` rows, the `UserProperties` type, the client import list, the two request functions + `currentUrlWithoutAuthParams`; the client golden (diff = exactly those three functions); the ledger (two rows, floor 84) |

Refused by name: a consumed `Failure`/`Completed` (the family's sentence); two wires into a
static input or into one column; a named `Backend`; an unfired `Do` (and the session export
leaves with it — earned by attachment); a column authored as something other than a literal;
Sign Up's columns (§5.5, unchanged).

### §44.3 What building it found, and what is written down rather than fixed

- 🔴 **The control-mint predicate enumerated the family by `spec.inputs`** — the Nickname input
  wired into `prop-nickname` rendered with no state, and the Save trigger was dropped with *"the
  action reads values that only exist in another handler"* — a true sentence about a state row
  nothing minted. s19's rule, third family: when a vocabulary grows a member, audit every site
  that enumerates it; this one was the sink-membership test, not the dispatcher.
- 🔴 **`interface` is not `Record<string, unknown>`** — the first `UserProperties` was an interface,
  and only the fixture's whole-app typecheck (§D2) said so. The row that grades the emitted app
  as a program caught what every substring row passed.
- ⚠️ **Read, not measured — a runtime residual, owner NONE:** `ParseAuthAdapter.setUserProperties`
  builds `_content` with `email: options.email, username: options.username` even when both are
  `undefined`, and `Object.assign(_cu, _content)` copies the `undefined`s into the stored session
  — after a username-only write, the `User` node's `email` reads empty until the next login or
  fetch (the wire body is unaffected: `JSON.stringify` drops the keys). The export's client merges
  only what it sent. Registered here because no open phase owns the user family's runtime.
- ⚠️ **Blank keeps, by whose rule:** a control's state boots `''` (§6's divergence), so an
  untouched Username input would send `username: ''` and blank the name. The export honours the
  node's own sentence for the two static ports and sends nothing; a column is sent as given, the
  record verbs' rule. Whether the *interpreter's* untouched input delivers `''` or nothing to the
  adapter was not measured here.
- ⚠️ The `Backend` gate now covers Log In / Log Out / Sign Up too — three nodes counted since
  USER-FAMILY that, naming a second backend, exported against the active one silently. One
  project on this machine mentions the parameter at all (an old-format `project.json`), so the
  corpus number cannot move.

### §44.4 Graded — `tests/set-user-properties-magic-link.test.ts`, 24 rows, 55 files on disk

§A the session module and the client (the `UserProperties` type; the two exports and their
import; `updateUserRequest`'s refusal *before* the request, the PUT to the session's own id, the
rewrite after; blank-keeps for the two static ports only; the magic link's body and the URL
helper; **the §43 cardinality as a control** — two `fetch` sites, two wraps, and both new
functions inside `request()`; the stub form; a column typed by its wire, two sites disagreeing
`unknown`). §B the component (the data object and the done chain; Save never clears, Send clears
before the chain, exactly one clear in the page; the column wire minting state; the redirect
omitted / wired / authored; an authored Email between the username and the columns; the `User`
read beside). §C six refusals by their sentences, with `_active_`/blank as the control and Sign
Up's gate re-pinned. §D the fixture whole: the report's own *"refused none of them"* sentence
(a `not.toContain('refusal')` matched the boilerplate — presence, not absence), typechecked,
parsed, the two sites counted.

### §44.5 The gates, the arms and the drive — and the two readings that were about the instrument

Run one at a time, `vm_stat` read before each, every server torn down by the runner's own `trap`
(`drive44-run.sh`, s72 scratchpad `423323ce-…`) — 0 listeners left on :8582/:5393/:9343 after
both runs.

**The gates.** Package `tsc` 0 · the new file 24/24 · the whole suite **55 files, 1486/1486, exit 0**
in 72 s (1446 + 24 + the fixture-enumerating specs picking up `account-desk`) · the editor's `tsc`
0 · `export-ledger:check` OK (176 types, 91 translated) · picker **84/127 (66.1%)**, floor 84.

**The arms** (`mut44.py` / `runmut44.sh`, twelve, each tsc-gated, each restored `diff -rq` clean
against a snapshot of the gate-green source):

| arm | what it removes | killed | by |
|---|---|---|---|
| A | the magic link's `TRIGGER_PORTS` row | 7 | §B/§C/§D — the node is never a sink |
| B | the mint predicate's column clause | 10 | the Nickname state, and Save with it (§44.3's defect, re-made) |
| C | the emitter's clear line | 1 | B2 |
| D | the magic-link row's `clearsErrorOnDone` | 1 | B2 |
| E | the family's `Backend` gate | 1 | C3 |
| F | `'Nobody is signed in.'` before the request | 3 | A3 + the client golden ×2 |
| G | blank-keeps for the two static ports | 3 | A4 + the golden |
| H | the redirect omitted when nothing feeds it | 2 | B4 + the D4 count |
| I | `writes` never reaching the session module | 4 | A1, A8, and the fixture's **typecheck** (`nickname` not in the type) |
| J | the current page for a blank redirect | 3 | A5 + the golden |
| K | `type` back to `interface` | 5 | A1/A7/A8 and **D2 — the row that found it** |
| L | the session not rewritten after the PUT | 3 | A3 + the golden |

**The drive**, `EXPECTED44.md` written before any run: `account-desk` emitted to `harness44`
(the s70 harness's `node_modules` symlinked — the export's dependency list is unchanged), a fresh
backend on :8582, one seeded user, nine steps, **63 cells**. The helpers were named first:
Save → `updateUserRequest` → `request()`, Send → `requestMagicLinkRequest` → `request()` —
neither rides `callFunction()`, so one sentence for both when the backend is down.

🔴 **Run 1: 63 cells, 4 diffs — all four the same +1 on the magic-link count, and all four
mine.** The seed script sent one `POST /auth/magic-link` of its own to prove the route answered
200, and the expectation table had not counted the instrument
([[a-url-filtered-capture-attributes-nothing-to-a-producer]], second instance — a count this
time, not a capture). The backend's per-request log settled it by principal: the probe
`anonymous`, the app's three `user`. And the post-drive verify read **`404` on `/login`** — for a
moment "the restarted backend lost its users"; it had logged in as `alice`, and the drive had
renamed the account to `alicia` at D4, which is the feature
([[a-post-drive-control-reads-the-state-the-drive-leaves]]). Run 1 preserved as the control
(`*-run1.log`); the probe moved to its own mode; the verify reads the name the drive leaves.

**Run 2: 63 cells, 0 diffs**, `backendStoppedBeforeD8: true`, `backendRestartedBeforeD9: true`,
console errors `[]`. The verify after it: `login 200 … username: alicia, email: alice@example.test,
nickname: Zed` — the column stored on an undeclared `_User` field (prediction (a) held), the
email never sent (blank kept it). Read out of the cells:

- D2 `Nobody is signed in.` with **no PUT** — refused on the client, the adapter's own order.
- D4 `who` re-rendered to `alicia` on the session rewrite; the row on the backend agreed.
- D5 a blank Username **kept** `alicia` (the node's contract), the column `Al` written; the done
  chain set the Variable to `''` — the export's own wire, correct and worth seeing.
- D7 an unknown address answered exactly as a known one — no oracle, as the backend intends.
- D8 both Errors `Could not reach the backend at http://localhost:8582`, `who` **not** rewritten.
- D9 the backend back: Send's Error **cleared** to `''`, Save's **kept** the sentence — two nodes,
  one recovery, opposite Error behaviour, each the runtime's own.

### §44.6 What this leaves

- §44.3's runtime residual (`Object.assign(_cu, _content)` copying `undefined`s into the stored
  session) — owner NONE, read not measured.
- Sign Up's §5.5 gate could now lift on the same `UserProperties`: its columns ride `POST /users`,
  and the client already merges the identity into the session — the remaining piece is merging
  the columns too. Not built; nothing in the corpus asks.
- The five Cloud Services left. `Sign In With` (a full-page redirect whose return leg is picked
  up in the client's constructor — `_consumeAuthReturn`) and `Subscribe To Changes` (SSE, and a
  pub/sub with no static shape, §43.1's `changed`) are **refuse-by-name** candidates: each names a
  mechanism the emitted vocabulary has no shape for. `Upload File` needs the untranslated `Open
  File Picker`; `Cloud File` / `Sign File URL` need a `CloudFile` value type — a build, one
  session, if the product surface wants files before it wants sign-in providers.

## §45 Tier 2.6 continues — the files: `Open File Picker`, `Upload File`, `Cloud File` and `Sign File URL` (session 73, 2026-09-02)

**Picker 84 → 88 of 127 (69.3%)**, floor raised in the same commit. Four nodes and one value
through them: the picker's `File` into the upload, the upload's stored file into a read or a sign.
Corpus: 0 of all four (`Open File Picker` was even ledgered *deliberately out of scope* as a
"specialist" node) — ranked by the product surface: an avatar on a profile page and an attachment
on a form are the two file features every app with accounts grows first, and both are exactly
pick → upload → show, with a private upload and a signed link the moment the file is personal.

### §45.1 What the runtime does, and what that decides

- **Open File Picker** (`openfilepicker.ts`): one `<input type=file>` created at initialize and
  reused; `Open` sets `accept`/`capture`, arms `onchange` and `oncancel`, and calls `click()`.
  `change` with a file is **Done** (the five outputs flagged); `change` with an empty list or a
  `cancel` is **Unchanged** (every output as it was — the port's own definition, and a superseded
  `Open` is settled the same way); a `click()` the browser refused is **Failure** with `Could not
  open the file picker: <message>`. `Path` is Electron's addition to `File` — the port's own
  description says it is blank in a browser.
- **Upload File** (`uploadfile.ts` → `CloudStore.forBackend(...).uploadFile` →
  `ParseWireAdapter.uploadFile`): `No file specified` before any request when `File` is unset;
  else `POST /files/<file.name>` with the `File` as the body (`xhr.send(file)`, no JSON content
  type — the backend sniffs), `X-NodeGX-File-Private: true` where `Private` is on, progress off
  the XHR's upload events. The 201 body is `{ url, name, size, contentType }`, `name` the
  **stored** name (`<random8>_<sanitised original>`); `new CloudFile(response)` and Done. The
  five `File Location` inputs address Supabase (bucket/path) and PocketBase (collection/record/
  field) and are inert on this wire.
- **Cloud File** (`cloudfilenode.ts`): a pure holder — `file` set only when the value is a
  `CloudFile`; `URL`/`Content Type`/`Size` are the object's getters and `Name` strips the prefix
  (`split('_')`, `length === 1 ? [0] : slice(1).join('_')`).
- **Sign File URL** (`signfileurl.ts`): `No file specified` when unset; `GET /files/<name>/sign`
  → `{ url: <url>?exp=&sig=, expiresAt, ttlSeconds }`; `URL Kind` is `signed` **unconditionally on
  this wire** (ParseWireAdapter — the only server reaching that callback is the one that signs,
  measured), so `Safe To Share` (`kind !== 'token'`) is true once a link exists. The backend's
  `assertReadable` gates the sign on real read access; the TTL is `signedUrlTtlSeconds`, 300 by default.

### §45.2 The build

| piece | what it is |
|---|---|
| the value | one `ValueExpr` kind, `file-out`, with a `family` (`pick`/`upload`/`sign`), the field as `output`, `tsType` by the wire, `viaState` off the chain. The Record rules: the chain's local inside its own Done, only `Error` inside Failure, the row everywhere else — **and the picker's Unchanged arm reads the row**, because that arm changes nothing (`fileChainScope` has a third value) |
| `Cloud File` | compiled away like a date node: `uploadFeeding` finds the one wire from an Upload File's `Cloud File`, the read is the upload's row/local, the wire is consumed and the node collapses; `Name` is `cloudFileName(...)`. It rides the pure-node deferral sweep with the date family, so its own sentence names it when nothing feeds it |
| three actions | `file-pick` (`pickFile({ accept, capture })` from `src/lib/util.ts`, three arms: `=== undefined` is Unchanged, else the row is written and Done runs, the catch is Failure), `file-upload` (`uploadFile(file, { private })` from `src/api/files.ts`), `file-sign` (`signFileUrl(file)`); the two with a file throw `No file specified` inside the try where the file expression is maybe-undefined — the row form — and emit no guard on the chain-local form, which is a `File` by type (a guard there is TS2367) |
| `src/api/files.ts` | one module per project: `CloudFile` (`name`, `url`, `contentType?`, `size?`), `SignedFileUrl` (`url`, `kind: 'signed' \| 'token' \| 'public'`, `isShareable`, `expiresAt?`, `ttlSeconds?` — the runtime's vocabulary, not this exporter's narrowing), `cloudFileName`, and `uploadFile`/`signFileUrl` over the client (`{ ...signed, kind: 'signed', isShareable: true }`), each with its site lines; the stub throws `is not connected to a backend yet` (a fabricated stored file is a success report for bytes nobody stored). An upload or a sign makes the project *use a backend* (`hasApi`), so the client is emitted with no session call or query beside it |
| the client | `request()` grows `file?: Blob` (sent as the body itself, no JSON content type) and `headers?`; `uploadFileRequest(file, isPrivate)` → `POST /files/${encodeURIComponent(file.name)}` with the private header; `signFileUrlRequest(name)` → `GET /files/<name>/sign`. Still **two** `fetch` sites and two wraps — the §43 cardinality row is the control. Golden diff = the `request()` change + the two functions |
| `pickFile` | in the util library, earned as an *action* (the walker over `deepActions`, like `log`): the input is appended hidden for the length of the dialog and removed as it settles, so every browser fires its events against a live element and a drive can reach it; `oncancel` is the Unchanged the runtime added in ERG-001 |
| the mint predicate | a control wired into any non-trigger input of a files node earns state (a checkbox into `Private`, a text input into `Accepted file types`) — s19's rule, fourth family |
| the toll | `plan.ts`: 4 type constants + 3 field tables + the location/progress lists, `OWN_CHAIN_OUTPUTS` ×3, the `file-out` kind, 3 actions, `FileOpPlan` + `ComponentPlan.fileOps`, `StateVarPlan.origin` ×2, the scope/names/rows/attached block, `fileAnswerExpr` + `uploadFeeding`, 4 `resolveExpr` cases, `maybeUndefinedExpr`/`exprTsType`/`exprValidIn`, `TRIGGER_PORTS` ×3, `fileOutputsRefusal` + 3 compiles, the dispatch, `actionsValidIn`, `snapAction`, the attach pass, the sweep, `isFileRead`, `fillMaterialize`, the session walker, the late filter, the mint clause, the pure-node sweep, the reserved-word guard; `component.ts`: `collectActionUse`, `deepActions`, `referencedStateNames`, `maybeUndefined` + `FILE_OUT_OPTIONAL_FIELDS`, `fileNamesOf`, `exprCode`, the effect-deps walker, `chainReadsChainLocal`, 3 `actionCode` cases, `actionTakesNoTerminator`, `actionsAwait`, the files import, the util earn, the coercion table, the text sink, `actionExprsOf`, both expression walkers; `emitApp.ts`: `hasFileOps`, `filesModule`, the client; `utilLib.ts`: `pickFile`; `naming.ts`: `isReservedWord`; the ledger (4 rows, floor 88); the client golden |

Refused by name: `Path`; a consumed `Completed` (all three); the progress family (`XMLHttpRequest`'s
upload events, which `fetch()` does not publish); `Error Status Code` (the client's one sentence
carries no status); `Cloud File` wired into anything but a Cloud File / Sign File URL; a named
`Backend`; any `File Location` input set or wired; the upload's `File` fed by anything but a
picker's `File`, or by nothing; the sign's / the Cloud File's `File` fed by anything but an
upload's `Cloud File`, by nothing, or by two wires; two wires into a dialog setting; a value read
from a Failure chain; a picker nobody fires (and the upload that reads it, with the same reason).

### §45.3 What building it found, and what is written down rather than fixed

- 🔴 **A sibling handler reading another node's row is compiled before the attach pass has run.**
  The upload button reads the file the pick button chose — the whole product surface — and the
  HTTP / Cloud Function / Record families' "is the source attached?" test in `resolveExpr` has no
  answer yet at that moment (their handler-argument readers were always in the *same* handler).
  `fileAnswerExpr` asks the question that can be answered at compile time — does the source
  compile, and is its trigger wired at all — and takes the row form; the late sweep keeps a wired
  files node's rows, and the emitter prints only what something reads. A wired trigger whose
  source later defers leaves the row unwritten, booted `undefined` — exactly the interpreter's
  state when the picker never fires, so the upload throws `No file specified` as the node would.
- 🔴 **A checkbox labelled "Private" minted `const [private, setPrivate]`** — a reserved word in a
  strict module, found by the fixture's own typecheck row; `naming.ts` had the list all along
  (`propIdentifier` uses it) and the state allocator never asked. `isReservedWord` is exported and
  the row takes `privateChecked` (label kept, fallback appended). Older than this slice: any
  control labelled `class`, `static`, `public`, `default`… did the same.
- 🔴 **`Cannot find name 'cloudFileName'`** — the helper's import was earned in `exprCode`, which
  runs after the import lines are decided; every other library helper is earned in the two
  expression walkers, and this one had to be too (both of them — B15 is the row where only a
  handler reads the Name, and it is what killed arm L). And its `Set` was first declared beside
  `fileNamesOf`, hundreds of lines below the walker that fills it: the §7.2 TDZ trap, again.
- 🔴 **The Cloud File's own sentences died in a `ctx` nobody read** until the node joined the
  pure-node deferral sweep (the date family's; "nothing feeds its Cloud File input" was reported
  as *no deterministic translation in step 5*).
- ⚠️ **`encodeURIComponent(file.name)` where the runtime sends the raw name** — XHR percent-
  encodes a space in a URL itself; the backend decodes the route parameter either way and
  `sanitizeName` replaces the space with `_`. Recorded, not a divergence an author can see.
- ⚠️ **The interpreter's `Set Variable` needs a wire** — an authored `value` literal on it defers
  with *nothing is wired into value*, so the fixture's cancel note rides a `String` node. Not a
  files finding; noted because it is the first thing a picker's Unchanged chain wants to do.
- ⚠️ **A dev-open backend admits an anonymous upload** (`checkAccess` returns before the files
  gate, `HttpServer.ts:1749`) while `files.upload` is declared `authenticated`; the private-file
  gate (`assertReadable`) is inside the handler and holds. The drive reads it (D6); the platform
  owns it (loopback dev mode is by design), owner NONE.
- ⚠️ **An `Image` bound to a private file's url cannot render it** — the browser's own fetch
  carries no session header, so a private upload's preview is a 403 in the export *and* in the
  interpreter's Image node. The signed url is the answer, and the drive measures both (D9/D10).

### §45.4 Graded — `tests/files.test.ts`, 40 rows, 56 files on disk

§A the module, the client and the util helper (the two types and the two functions; `cloudFileName`
**run** through `ts.transpileModule` on three names, not read; the stub throws and the page is
unchanged; the two requests; `request()`'s file body and the §43 cardinality as a control;
`pickFile`'s three answers and the attached/removed input; the util library earned only by a
picker). §B the component (the three arms in the node's order; the row reads; the sibling-handler
guard and the chain-local `cloudFileName`; Cloud File collapsed and the Image's `src`; the sign's
guard, chain read and five typed outputs; the reserved word; `private` authored / unset; the
upload inside the picker's Done — no guard; an upload nothing reads — no row; the Failure arms;
a picker nobody fires; a wired setting; **B15** a Name read only from a handler earns the import;
**B16** an upload with no session call earns the client). §C twelve refusals by their sentences,
with `_active_`/blank as the control. §D the fixture whole: refused none, typechecked (also with
no backend), parsed, the sites counted.

### §45.5 The gates, the arms and the drive — and the header the backend never allowed

Run one at a time, `vm_stat`/`ps` read before each, a peer's suite and a peer's webpack waited
out, every server torn down by the runner's own `trap` (`drive45-run.sh`, s73 scratchpad
`23187039-…`) — 0 listeners left on :8583/:5394/:9344 after both runs.

**The gates.** Package `tsc` 0 · the new file 40/40 · the whole suite **56 files, 1540/1540,
exit 0** in 80 s (1486 + 38 + the fixture-enumerating specs picking up `photo-desk`; B15/B16
came after the run, graded alone) · the editor's `tsc` 0 — after two narrowings it wanted and
this package's `tsc` did not (the editor's TypeScript keeps a `{ defer }` arm on a variable an
`in` test has excluded; narrowed by assignment) · `export-ledger:check` OK (176 types, 95
translated) · picker **88/127 (69.3%)**, floor 88 · `nodegx-backend` `sbr007-auth-preflight`
3/3 with the new row.

**The arms** (`mut45.py` / `runmut45.sh`, fifteen, each tsc-gated, each restored `diff -q`
clean against a snapshot of the gate-green source):

| arm | what it removes | killed | by |
|---|---|---|---|
| A | the picker's `TRIGGER_PORTS` row | 22 | the node is never a sink |
| B | the mint clause for the files sinks | 15 | the checkbox stateless, Upload dropped |
| C | the picker's Unchanged arm | 1 | B1 |
| D | the `No file specified` guard | 5 | B3, B5, D2/D5 (**typecheck**: `File \| undefined` into `File`) |
| E | the reserved-word guard | 7 | B7 and every typecheck row (`const [private,`) |
| F | the compile-time row form for a sibling handler | 13 | B3 and everything downstream of the upload |
| G | the Name projection through `cloudFileName` | 3 | B3, B4, B15 |
| H | the private header on the client | 1 | A4 |
| I | the file body in `request()` | 1 | A5 |
| J | Cloud File in the pure-node sweep | 1 | C10 — the sentence back to *step 5* |
| K | maybe-undefined per field | 1 | B9 — a guard on a `File` |
| L | the helper import earned in the action walker | **0 → 1** | survived on the fixture (the render walker also earns it); **B15** was written for it |
| M | the `isFileRead` render predicate | 6 | B2/B4/B6/B9/D1 — the §7.5 gap, caught by rows |
| N | `isShareable: true` for a signed link | 1 | A1 |
| O | the files module earning the client | **0 → 1** | survived on the fixture (Log In earns it too); **B16** was written for it |

Two survivors, both because the fixture had a second earner; both closed by a row that removes it.

**The drive**, `EXPECTED45.md` written before any run: `photo-desk` emitted to `harness45`, a
fresh dev-open backend on :8583, one seeded user, headless Chrome with
`Page.setInterceptFileChooserDialog` on (so the picker's click raises `fileChooserOpened` and the
drive answers it with `DOM.setFileInputFiles`, or dispatches `cancel` on the attached input),
twelve steps, **88 cells**. The helpers named first: Upload → `uploadFile` → `uploadFileRequest`
→ `request()`, Sign → `signFileUrl` → `signFileUrlRequest` → `request()`.

🔴 **Run 1: D1–D8 exactly as written, then D9 timed out — the private upload read
`Could not reach the backend at http://localhost:8583` while the backend was up.** The backend's
per-request log settled it: an `OPTIONS /files/photo%20two.png` **204, and no POST after it**.
The one new thing in that request was `X-NodeGX-File-Private: true`, and the backend's CORS
`Access-Control-Allow-Headers` (`ops/headers.ts`) did not list it — Chrome refused the request
after a successful preflight, and `fetch()` threw the browser's network error, which the client
maps to its one sentence. **A product defect, not an export one:** `ParseWireAdapter.uploadFile`
sets the same header, so a private upload from any cross-origin browser app — the normal deployed
shape — has failed the same way since BAK-006, and every same-origin preview was green because a
same-origin request never preflights. SBR-007 D21 found the identical hole for
`X-Parse-Installation-Id` and its own comment says why nothing noticed. Fixed in the backend (one
header on the list, `dist` rebuilt), a row added beside D21's (`tests/sbr007-auth-preflight.test.ts`,
3/3 with its wildcard control), run 1 preserved as the control (`*-run1.log`).

**Run 2: 88 cells, 0 diffs**, `VERIFY OK`, console errors `[]`. Read out of the cells:

- D2/D3 `No file specified` with **no request** — refused on the client, the node's own order.
- D4 cancel: `pickNote` `nothing chosen`, the row untouched, the hidden input **removed**
  (`inputLeft 0`); D5 `photo one.png`, 73 bytes, the Done chain read the chain-local's `name`.
- D6 an anonymous upload **201** (dev-open; principal `anonymous` in the log) — url
  `…/files/<16 hex>_photo_one.png`, Name `photo_one.png` (the space sanitised away by the
  backend, the prefix stripped by `cloudFileName`), type `image/png` **sniffed**, size 73; the
  `img` loaded (`naturalWidth 2`); `uploadErr` **kept** `No file specified` — never cleared.
- D7 the public sign: `url?exp=&sig=`, kind `signed`, share `true`, expires 300 s ahead, ttl 300.
- D9 private as alice (principal `user`): the row rewritten (url2, `photo_two.png`, 70) and the
  **`img` did not load** (`naturalWidth 0`) — the browser's own fetch carries no session header;
  the verify read the same url `403 This file is private.` anonymously and 200 with the token.
- D10 the private file signed: the verify read the signed url **200 anonymously** — the pair's
  whole point, measured.
- D11 backend down: both Errors the one sentence; every value cell **unchanged**.
- D12 back: a new signature and a new upload with both Error rows **still holding the sentence**.

### §45.6 What this leaves

- **Two refusals by name written into the ledger this session, no picker change:** `Sign In With`
  is *scheduled* — a full-page redirect whose Done arrives on a later page load, consumed by the
  runtime client's constructor (`_consumeAuthReturn`); the exported client needs a return leg
  first, then the node is a launcher plus a mount-time receiver — one session, when a project asks
  for provider sign-in. `Subscribe To Changes` is *deliberately out of scope* — SSE pub/sub with no
  static shape, §43.1's `changed` at node scale. That empties Tier 2.6's buildable list.
- A stored file into a **record property** (an avatar on a `_User` column, a file on a record verb's
  `prop-*`) and a Cloud File fed **from** a record's column — both refused by name; the wire
  serialises a file as `{ __type: 'File', name, url }`, and the next files session is that pair.
- The picker's Failure arm (a refused `click()`) is graded by the spec and not driven.
- The dev-open anonymous upload (§45.3) — owner NONE, the platform's loopback mode by design.
- `Error Status Code` on the upload and the sign, and the progress family — refused by name; a
  `status` on the client's thrown error would lift the first, `XMLHttpRequest` the second.

## §46 The file ↔ record pair — a stored file into a column, and a column back into a stored file (session 74, 2026-09-03)

**Picker 88 of 127, unchanged** — no node was added; two refusals by name were lifted, on both
sides of one wire. A stored file goes **into** a record: an Upload File's Cloud File wired into a
record verb's `prop-<column>` or a Set User Properties' `prop-<column>` (an avatar). And a stored
file comes **out of** a record: a `Cloud File` or a `Sign File URL` fed from a `Record`'s column.
Corpus: 0 of either shape. Ranked by the product surface, as §45 was: every app that lets a
signed-in person upload something eventually saves *which* thing on a row and shows it again later
— a profile photo, an attachment on a ticket — and until this slice that second half was refused.

### §46.1 What the runtime does, and what that decides

- **The write.** `_serializeObject` (cloudstore.js) turns a `CloudFile` in a column the project's
  schema snapshot declares `File` into `{ __type: 'File', url, name }` — url and name, nothing else
  — and `ParseWireAdapter.create/save` and `ParseAuthAdapter.setUserProperties` all go through it.
  A CloudFile in a column the snapshot does **not** declare falls to `_toJSON`, which returns the
  object as it is: `{ name, url, contentType?, size? }` with no tag. The backend's SQL adapter types
  a new column from the first value it sees (`_inferType`: `__type === 'File'` → `File`, a bare
  object → `Object`), and `toWire` hands a File/Object column's stored JSON back unchanged.
- **The read.** `_deserializeJSON(data, 'File')` makes a `CloudFile` only where the snapshot types
  the column File **and** the value carries `__type: 'File'`; the `Cloud File` node's input takes
  `instanceof CloudFile` and ignores anything else, keeping the previous file (cloudfilenode.ts).
  A file read back from a column has no `contentType` and no `size` — the port descriptions say so.
- **What that decides.** (1) The envelope is the contract between an exported app and every other
  reader of the same table, the interpreter included: a write without the tag is a column the
  interpreter can never read as a file again. So the exported app writes the envelope wherever the
  **value's own type** is a stored file — the graph is the evidence, the record verbs' rule for an
  undeclared column — which is *more* right than the interpreter, whose write depends on the
  snapshot (§46.3). (2) A read is lifted only for a column the snapshot declares `File`, because
  that is the interpreter's own condition; any other column defers with a sentence naming it.
  (3) A File column's TypeScript type is the files module's `CloudFile`, not `string` —
  `tsColumnType('File')` had read `string` since EXP-002, a Text on such a column would have
  printed `[object Object]` while typechecking clean.

### §46.2 The build

| piece | what it is |
|---|---|
| the type | `tsColumnType('File')` → `CloudFile`; the collection module and the session module `import type { CloudFile } from './files'` when a column needs it, and `src/api/files.ts` is emitted **for the types alone** when a project has a File column and no files node (`anyFileColumn`) |
| the envelope | `fileRef(file)` in `src/api/files.ts`: `undefined` stays `undefined`, else `{ __type: 'File', name, url }` — the runtime's literal; `CloudFile` gains `__type?: 'File'` so the object literal typechecks and a file read back from a column is honestly described. The emitter wraps a column argument whose expression is a stored file (`isCloudFileExpr`: an upload's `cloudFile`, or a `record-out` typed `CloudFile`) in `recordDataObject`; the import is earned in `collectActionUse`, where the argument is walked — not in `recordDataObject` (the §45 rule, again) |
| the write | the upload's `cloudFile` output resolves (`fileAnswerExpr`, `CloudFile`) where it used to defer by name; `fileOutputsRefusal` lets the wire land on a create/update verb's `prop-*` or a Set User Properties' `prop-*`; both verbs' `writes` keep `CloudFile` as a typed column |
| the read | `uploadFeeding` became `storedFileFeeding`: an Upload File's `cloudFile`, or a `Record`'s `prop-<column>` where `recordColumnType` answers `CloudFile` — two new sentences for a column the snapshot does not declare / declares as something else. The `Cloud File` branch then resolves the record's column read and returns a new `ValueExpr` kind, **`file-field`** (`source`, `field`, `tsType`) — a member off whichever form the record read takes; `compileFileSign` takes the column read itself as the argument, the row form guarded by `No file specified` as the upload's row is |
| `file-field`'s toll | plan.ts: `exprTsType`, `maybeUndefinedExpr` (the source's, plus the two optional members), `exprValidIn`, `exprTouchesSnap`, `snapExpr`; component.ts: `maybeUndefined`, `exprCode` (a member chain needs no parentheses, anything else gets them; `name` through `cloudFileName`, guarded where the source may be undefined), both walkers (recurse into the source; `name` earns `cloudFileName`), the effect-deps walker, `chainReadsChainLocal`, the text coercion table and the text sink |
| the attach order | `recordWillFire`: a sibling handler (the Sign button) compiles in Pass 2, before the Id-effect pass has attached the Record, and the `record-out` branch's "is it attached?" could not answer — §45.3's trap on the record family. The effect form's own preconditions are order-independent (`Fetch` unwired, a file to host it, a compiled action valid in render), so they are asked at read time; the late sweep keeps a fired node's rows. A wired `Fetch` stays out of it on §43's contract (§46.3) |
| the rest | `SET_USER_PROPERTIES_TYPE`; `isCloudFileExpr` is a `function`, not a `const` (§7.2's TDZ, found on the first emit); the ledger's seven notes; `tests/files.test.ts` four rows re-sentenced (A1's interface text, C5, C9, C10 — the last now the "does not declare" sentence, because photo-desk carries no snapshot) |

Refused by name: a Cloud File / Sign fed from a column the snapshot does not declare, or declares
as something other than `File`; an upload's Cloud File into a Delete verb's `prop-*` (a delete
writes nothing) or into anything but the four sinks; everything §45 refused, unchanged.

### §46.3 What building it found, and what is written down rather than fixed

- 🔴 **A File column read as `string` for fourteen sessions** — `tsColumnType`'s default, since
  EXP-002's schema mapping; nothing wired one until this slice. **`Date` still reads `string`**,
  and the wire's value is `{ __type: 'Date', iso }` (AdapterFacade `toWire`): a Text on a Date
  column prints `[object Object]` in the exported app where the interpreter prints a date.
  Registered here, owner **EXP-011 (a later slice: the Date column, `fromWire` unwrapping)**; the
  §46 spec pins today's answer (A5) so the row reddens when it is fixed.
- 🔴 **The attach-order trap, second family.** The Sign's handler reading the Record's row deferred
  with *"its Fetch is never fired by a translatable trigger"* on the first emit — false: the Id
  effect fires it, one pass later. `recordWillFire` asks what can be answered in Pass 2.
  **Measured, not designed, and registered:** a record fetched by a *wired* `Fetch` is not readable
  by a sibling handler in **either** wire order — `attachedRecordNodes` is filled by the earn scan
  after every handler has compiled, so the sibling sees an unattached node whichever wire comes
  first (spec C5, both orders). §43's contract (*a Fetch wired from nothing translatable leaves no
  row*) is what keeps the trigger form out of `recordWillFire`; lifting it means asking whether
  the trigger's source is translatable, which is Pass 2's own question. Owner: **EXP-011**.
- 🔴 **§7.2's TDZ, again** — `isCloudFileExpr` as a `const` beside `recordDataObject`, read by
  `collectActionUse` which runs first: `Cannot access 'isCloudFileExpr' before initialization` on
  the first emit of the fixture. A `function` declaration hoists. Third time in this file.
- ⚠️ **The interpreter's write depends on the snapshot; the export's does not.** A CloudFile into
  a column the project never declared reaches the backend from the interpreter as a bare object
  (no `__type`), is typed `Object`, and is never a CloudFile again on any read; from the exported
  app it reaches the backend as the envelope. Documented divergence, in the export's favour — the
  value's type is known statically and the graph is the evidence (RECORD-VERBS §4d's rule).
  Owner of the interpreter half: NONE (a runtime that reads the wire is an editor-side question).
- ⚠️ `fileRef` drops `contentType` and `size`, exactly as `_serializeObject` does — a file read
  back from a column has neither, and the Cloud File node's own port descriptions say so. Not a
  loss the export introduced; the drive's D8 reads both as `''`.
- ⚠️ A record verb's `Id` output is still refused (§5.11), so a page that saves a photo and wants
  to show *that* row reads an id the person types, as the fixture does — the corpus shape for
  "show what I just saved" is a query, not a read by Id.

### §46.4 Graded — `tests/file-record.test.ts`, 26 rows, 57 files on disk

§A the modules and the types (the collection module's `CloudFile` column and import, connected and
stub; **`fileRef` run** through `ts.transpileModule` — undefined stays undefined, and of a file with
four members exactly `__type`/`name`/`url` survive, the runtime's literal; the session module's
`avatar?: CloudFile`; a File column with **no files node at all** still gets the types module with no
functions and no client import, and typechecks both ways; `tsColumnType` on the five names, Date's
`string` pinned as the registered residual). §B the component (Save wrapped and the helper imported;
the avatar wrapped; the Cloud File fed from the record collapsed into four reads off the row and the
Image's src; the Sign's guard on the column read — a sibling handler of the Id effect; the row and
the effect both present; the chain-local inside the Record's own Done chain; a File column straight
into a Text through `String()`; a record's File column into another record's column, wrapped; an
undeclared column written from an upload typed `CloudFile`; **the envelope built in exactly one
place** — the client untouched, one literal in one file; **B11**, a Name read only in render earns the import alone — the row arm L asked for). §C four refusals by their sentences with
a declared-File control, the order probe (the sign's wires first, and the whole list reversed), and
**C5, the registered residual measured in both orders** with the record's own attachment as the
control. §D the fixture whole: refused none, typechecked, parsed, the sites counted (two `fileRef`,
one sign, two `cloudFileName`, two guards, two functions in the collection module), no-backend too.

The fixture, `tests/fixtures/gallery-desk` (47 nodes, 39 wires, a `Photo { caption: String, image:
File }` snapshot): Log In, User, pick → upload → a Cloud File on the upload (url, an Image) → Save
into `Photo.image` + `caption`, Use as avatar into `_User.avatar`; a photo id typed into a Variable →
a Record in the Id-effect form → a second Cloud File (four Texts, an Image) and a Sign File URL.

### §46.5 The gates, the arms and the drive — and the four diffs that were all the instrument's

**The gates, one at a time** (a peer's webpack watch was on the box; each of mine waited for the
last). Package `tsc` 0 · the new file 26/26 · the whole suite **57 files, 1584/1584, exit 0** (run
twice: after the build and after the sweep-clause removal) · the editor's `tsc` 0, twice · ledger
`OK — 176 types, 95 translated` · picker 88, unchanged, the floor untouched · the four §45 rows
re-sentenced and green (69/69 with §43's).

**The arms** (`mut46.py` / `runmut46.sh`, twelve, each tsc-gated, each restored `diff -q` and the
sources md5-identical after): A `File` → `string` again (17 rows), B no `fileRef` wrap (5), C the
envelope without its tag (2 — A2 *runs* it), D the snapshot check dropped (3 — **first armed as
`=== 'never'`, killed by tsc alone, which is not a kill; re-armed as `.length === 0`**), E
`recordWillFire` always false (6), F true for a wired Fetch (2 — C5 and §43's row), G Name without
`cloudFileName` (2), H the member's optionality ignored (8), I `CloudFile` dropped from the writes
(1 — B9/A3), J the verbs not admitted as sinks (9), L walker two's earn (**survived on the first
round — two earners; B11 written, killed**), M the types-only module (1 — A4). **Arm K survived
and was not re-armed**: the late sweep's "keep a fired node's rows" clause was unreachable on every
fixture because `recordWillFire` asks the effect pass's own questions, so the clause was deleted and
its one gap registered (§46.3).

**The drive** (`EXPECTED46.md` first, twelve steps, eighty-five cells). Run 1: **81/85** — every
diff the instrument's: the fetch count keyed on a guessed route name (`classes/:collection/:objectId`
where the backend spells `:id`; the routes-seen reconciliation showed the three GETs exactly where
predicted), D7's avatar error predicted `''` where it reads D3's `Nobody is signed in.` — the
Error row's own never-cleared contract, §45's D6 rule, which the expected file forgot — and a verify
that ran against a backend the drive had killed for D12 (`BACKEND NOT UP`). Run 1 preserved as the
control. Run 2, with the route named, the row's contract restated and the backend brought back on
its data dir before the verify: **85/85, 0 diffs, VERIFY OK** — the record's `image` and the user's
`avatar` both exactly `{ __type: 'File', name, url }` (keys asserted, no others), both signed urls
200 anonymously, `consoleErrors []`, 0 listeners after the `trap`. Cells about the backend's dev
mode are marked as such (D2, the anonymous create by principal `anonymous`).

### §46.6 What this leaves

- **`Date` columns** — `{ __type: 'Date', iso }` on the wire, typed `string` by `tsColumnType`,
  never unwrapped by `fromWire`; a Text on one prints `[object Object]`. A5 pins today's answer.
- **A sibling handler reading a button-fetched Record** — not readable in either wire order (C5);
  lifting it means `recordWillFire` asking whether a trigger wire's source is translatable, Pass 2's
  own question. The effect form carries the surface today.
- **The sweep's one gap** — an Id effect whose chain snapshot defers after a sibling took the row
  form: unconstructed; loud (the export fails to typecheck), not silent.
- The interpreter's own write of a CloudFile into an undeclared column (no tag, never a file
  again) — a runtime question, owner NONE.
- The remaining picker gaps are Tier 2.6's two refusals by name and the Data bucket; §45.6's list
  stands. Next by the surface: `Set Object Properties` / `Create New Array` (an ordinary page
  reaches them), or `Sign In With` once a project asks for provider sign-in.

## §47 The named Object — `Set Object Properties`, and the half of `Object` the picker offers first (session 75, 2026-09-03)

**Picker 88 → 89 of 127 (70.1%)** — `Set Object Properties` translates, and with it the "Specify
explicitly" form of `Object`, which the ledger cannot count because `Object` was already `translated`
on its repeater half (Tier 1.1). The picker's `Object` **defaults** to "Specify explicitly"; until this
slice a person who placed one, typed an Id and read a property got *"its Id Source is unset, which
the runtime reads as explicit — an id-addressed record in the global store"* — a refusal on the
first thing the node does out of the box. Corpus: **0** explicit-mode Objects, **0** `Create New
Array`, and all **8** `Set Object Properties` inside one kit's repeater row (`Filters/Multi
Choice/Item`, the same graph in eight projects) — the same population §33.1 counted. Ranked by the
product surface, as §41–§46 were: "a settings object every page reads and one page writes" is the
first shared state a beginner builds, and the handoff named it.

`Create New Array`, the handoff's other name, was re-derived and **stays refused** (§47.3).

### §47.1 What the runtime does, and what that decides

- **`Object` (modelnode2.ts) in explicit mode** is `Model.get(id)` — create-on-read against the
  app-wide `Model` store, keyed by the Id verbatim; `prop-<p>` outputs read `model.get(p)` and
  `registerOutputIfNeeded` registers *any* `prop-*` a wire asks for, so the `properties` stringlist
  gates nothing on the read side. `prop-<p>` **inputs** on the Object write through it
  (`scheduleStore` at frame end); `Fetch` rebinds and fires Fetched/Done; `changed`/`changed-<p>`
  fire off the Model's `change` event; `object` is the Model itself.
- **`Set Object Properties` (setmodelpropertiesnode.ts over modelcrudbase.ts)** on `Do`:
  `scheduleStore` → no model bound ⇒ `_failNoModel` (Failure, `set-object-properties/no-object`);
  else `_pushInputValues`: for each key in the node's **own `properties` list** whose input is not
  `undefined`, `model.set(key, value)` — `undefined` abstains, `''` and `null` write; a wired
  `prop-<x>` the list does not name is filtered out (`validProperties`) and never written; the
  `type-<p>` selector acts in exactly two cases — `array` evals a string as code, `object`
  dereferences a string through `Model.get` — and is inert for every other type.
- **Global Store is a layer over the same store** (globalstore.ts: *"a named store here is one
  `Model`, keyed `'--ndl--global-store--<name>'`"*), and `@nodegx/core`'s `store()` doc comment
  reads *"The exported equivalent of a Global Store or an Object node"* — the design was drawn when
  the core package was, and only the Global Store half had been built.
- **What that decides.** (1) An explicit Object with a literal Id **is a store module** —
  `src/stores/<id>.ts`, `store<IdState>('<id>', {})` — the Global Store machinery with a second
  declarer kind: `prop-<key>` reads are `useStore(profile, (s) => s.key)` in render and
  `profile.get().key` in a handler; the Set is one patch, `profile.set({ name, city })`, then its
  Done chain. (2) The two families are **two records in the runtime** (the prefix) and would be
  **one `store('x')`** in the export, so an Id that is also a Global Store's name refuses the
  Object side by name and the store keeps its module. (3) The keys: every `prop-*` read wire off
  an Object and every wired `prop-*` a Set's list admits; typed over the Set's sources exactly as
  a Global Store key is — with one correction: a key **nothing writes** is `unknown`, because
  `[].every(...)` is true and would have typed "nothing wrote this" as `string`. (4) Refused by
  name on the Object: a `prop-*` input wire (a write through the node itself), a wired Fetch, any
  consumed signal or the `object` port, a wired Id; on the Set: a wired Id, "From repeater"
  (§4's line, unchanged), a blank Id, an empty list, nothing wired into any listed property, the
  Array/Object selectors. (5) Dropped **with a note**: a wired `prop-<x>` the list does not admit
  (the runtime never writes it) and a `Failure` wire (with a literal Id, `Model.get` creates on
  read — there is never no object to write to; `Clear Array`'s precedent, a gate answers the cause).

### §47.2 The build

| piece | what it is |
|---|---|
| discovery (appState.ts) | `objectIdOf` (explicit or unset `idSource`, unwired `modelId`, non-empty literal), `setPropertiesOf`; a pre-pass over the whole project collects Global Store names and Object Ids and their intersection is `registry.objectCollisions`; an Object is a `declarer` (printed **"Read by"**), a Set a `writer`; a Set's wired listed `prop-*` is a `storeKeySources` entry; `StorePlan.origin: 'object'`; `typeOfSource` answers an Object's `prop-<key>` read with the key's type (the Subscribe rule one construct over — an Object read into a Set Variable types the variable) |
| the module (state.ts) | the store module unchanged but for the comment verb and the no-reader sentence |
| the reads (plan.ts) | `objectStoreOf` / `objectNodeGate` / `objectKeyReadOf` beside the Model2 pre-pass — the explicit-literal branch runs **before** `model2ForeachGate` and collapses the node into its module; `resolveExpr` answers `store-key-get` in the strict mode; Pass 4g answers a `store-key` binding in the widened mode (an `unknown` key binds and is coerced at the sink — `String(motto ?? '')`) |
| the write (plan.ts) | `compileSetObjectProperties`: the gates above, the patch in the **list's** order, `doneChainOf`; a new action **`object-set`** `{ storeName, entries, then }` — the toll: `actionsValidIn`, `snapAction` (popup-show's single-chain treatment), the session walker, `fillMaterialize`; `TRIGGER_PORTS[SetModelProperties] = 'store'`; the §45-shaped sweep gives a Set nothing fired the compiled reason or the trigger sentence |
| the emit (component.ts) | `collectActionUse` (the write earns the import on its own — B12), `expandActions` (the Done chain as following statements), `inAction`, `actionCode` → `profile.set({ name: name, city: city })`, `actionExprsOf` |
| the mint rule | `Set Object Properties` joined the `outputRead` sink-membership test — the fifth family on s19's rule, found the same way: the first emit dropped the Save wire with *"the action reads values that only exist in another handler"* |
| the sentences | `model2ForeachGate`'s explicit branch re-sentenced (a wired Id / a blank Id — the old *"id-addressed record in the global store"* sentence described the case this slice built); `recordNeighbourDefer`'s Set branch split into the three module-level constants the compiler also uses |
| the ledger | `SetModelProperties` translated; `Model2`'s note names both forms; floor 88 → 89 |

### §47.3 What building it found, and what is written down rather than fixed

- 🔴 **The vacuous `every`, in the store typing this slice inherited.** `typeOfStoreKey` types a
  key `string` when every statically-known writer is string-typed — and `[].every` is `true`, so a
  key with **no** writer typed `string`. A Global Store key only exists because a Set names it, so
  its source list is empty only when the Set's value is unwired (and that Set defers); an Object
  key exists because a **read** names it, so the empty list is the ordinary case. Fixed for
  `origin: 'object'` keys (A3 pins both directions); the Global Store half is left as it was —
  a Subscribe reading a key whose only Set has no value wire renders as a typed string — and
  registered here, owner **EXP-011**. Memory's own trap (`all([])` = the answer you wanted), met
  in code this time.
- 🔴 **`Set Global Store` is not on the control-mint list either.** The membership test that made
  the Save wire drop lists record verbs, user verbs, files nodes and now this Set; a text input
  read from a *button* into a `Set Global Store`'s value would drop the same way (the mood fixture
  writes from the input's own `textChanged`, which is why nobody met it). Registered, owner
  **EXP-011** — one line, the same clause, when a fixture asks.
- ⚠️ **One patch where the runtime writes N keys.** `_pushInputValues` calls `model.set` per key
  and the Object's `changed`/`changed-<p>` fire per key; the emitted `profile.set({ … })` is one
  commit. Invisible on the page (React batches a handler's renders either way) and only a signal
  chain could observe it — signal outputs are refused by name, so nothing translated can.
- ⚠️ **`type-<p>` other than Array/Object is ignored, as the runtime ignores it on the write
  path** — `Number` on a text input's string writes the string in both worlds (B11). The editor's
  port typing may cast on the *wire* for a typed port; `_pushInputValues` does not, and the
  written value is what the record holds.
- ⚠️ **`Create New Array` stays refused, re-derived.** Its `Id` is a generated string whose only
  consumer is a wired `Array`/mutator Id, and `Collection2` with a wired Id is not translated
  (*"collection module (literal id only)"*): the node would mint an array nothing exported could
  name. The consumer side is what would have to move first (a wired Array Id from a statically
  known minter), and the corpus holds zero instances to design against. The ledger's sentence is
  unchanged and C11 pins it.
- ⚠️ The Object's `id` output (the literal itself) and the Set's `id`/`error` outputs are not
  read by this slice — a Text showing the Id it already knows is rare, and the catch-all names
  the wire. Refused by the node gate when consumed (the `"id" output is consumed` sentence).
- ⚠️ A `Set Object Properties` in a component with **no render tree** reaches
  `recordNeighbourDefer`, which answers the same three sentences and *"its Do is never fired by a
  translatable trigger"* for the rest — nothing there can fire a Do.

### §47.4 Graded — `tests/object-store.test.ts`, 34 rows, 58 files on disk

§A the module (the golden text; the plan's origin, readers, writer and the two collapses; the
writer-less key `unknown` and `string` the moment an input writes it, `unknown` again under a
`Number` writer; Id Source unset on both nodes; the `variables` reservation). §B the component
(four selector hooks across two files importing one module; the patch in list order with the Done
chain following — and reordered; the inputs controlled *because* the Set reads them, uncontrolled
without it; the untyped sink; `.get().key` in a handler and the writer-less key's refusal there; the
unlisted wire dropped with the runtime's reason; the Failure wire dropped with its line of source;
an unfed listed key absent; no chain ⇒ the patch alone; the Object's list not gating a read; the
inert selectors; **B12** the write earning the import alone — arm L's row, written before the arm
this time). §C eleven refusals by their sentences: Fetch, a property input, a signal / the Object
port, a wired Id on either node, "From repeater" on either, the two acting selectors, the
collision (the store keeps its module and its "Declared by"), a blank Id on either, nothing wired /
an empty list, nothing fires, and **Create New Array's refusal pinned**. §D the fixture whole:
refused none (the only note is the router shell), typechecked, parsed, the sites counted,
deterministic, the ledger's three rows and the floor.

The fixture, `tests/fixtures/profile-desk` (16 nodes, 9 wires, and a badge component of 3):
two inputs → a Save into `profile { name, city }`, Done → Set Variable `status` ← "Saved."; three
Texts off the page's Object (`name`, `city`, `motto` — the last written by nothing) and a
`ProfileBadge` component whose own Object reads `name` from a second file.

### §47.5 The gates, the arms and the drive — and the instrument that read a shape it did not know

**The gates, one at a time** (a peer's look-test jest idled on the box for the first hour and the
suite was queued behind it; a peer's editor stack came up mid-session on ports this slice never
touches). Package `tsc` 0 on the first pass · the new file 33/33 after two instrument fixes (the
handler extractor assumed the multi-line button; a short handler prints on one line — brace-matched
now) · the whole suite **58 files: 1632/1634 on the first run — the two reds a neighbour's**
(`array-vocabulary.test.ts` pinned the *sentence* this slice deliberately re-wrote: an unset Id
Source with a literal Id is a module now, and what is left to refuse is the blank Id; both rows
re-sentenced, behaviour unchanged) · the final run **58 files, 1635/1635, exit 0** · the editor's `tsc` 0 ·
ledger `OK — 176 types, 96 translated` · picker **89**, floor 89.

**The arms** (`mut47.py` / `runmut47.sh`, thirteen, each tsc-gated, graded by the new file plus its
three store neighbours — 96 rows — and every arm restored `diff -q` and md5-identical after): A the
origin never set (24 rows), B the strict mode admits an unknown key (4), C the vacuous `every` back
(5 — A1 and A3), D the patch iterates the wires not the list (3 — B2's reordering and B6), E the Set
off the control-mint list (15 — the first emit's own failure, reproduced), F the Fetch gate gone (1 —
C1 alone, by design), G the collision check gone (1 — C7), H the Done chain not expanded — silently
lost (7), **I the sweep loses the compiled reason — SURVIVED**, J the Set's wires do not type the
key (5), K Pass 4g asks in the strict mode (4 — B4), L the write does not earn the import (1 —
**B12, written before the arm this time**), M the Object's reads do not register keys (8).
**Arm I was reachable code with no row**: every §C row has a trigger wire, so the attach pass
records the refusal before the sweep sees the node, and the sweep's "ask the compiler first" branch
is met only by a Set nothing fires whose compile still refused. Not dead code (a blank-Id Set
nobody wired is an ordinary half-built graph) — **C12** written, arm I re-run alone, killed by
exactly that row: 13/13.

**The drive** (`EXPECTED47.md` first, seven steps, fifty-seven cells, no backend — the object is
client-side state in both worlds). Run 1: **57/57, 0 diffs, `consoleErrors []`, 0 listeners after
the `trap`**. D4 is the consequence cell — a retyped city reads `Malmö` in the input and **`Lund`**
in the store until Save, which is what separates "the input is controlled" from "the store was
written" (the Object's own `prop-*` input shape, refused by name, would have written on every
keystroke). D6 separates abstain from write: a cleared name writes `''`, the badge follows. D7
reloads to `{}` — nothing persists, as `Model` does not. **The control**: the arm-H build driven
through the same instrument read **53/57** — D3, D4, D5 and D6's `status` all `''` and nothing
else; the prediction named three cells and the fourth (D4, the status *persisting* from D3) is
the one the prediction forgot, the instrument did not.

### §47.6 What this leaves

- **`Set Global Store` off the control-mint list** — an input read from a button into a store
  Set drops as this slice's Save did on its first emit; one clause when a fixture asks (EXP-011).
- **The vacuous `every` on Global Store keys** — a Set with no value wire types its key `string`
  for every Subscribe reading it (EXP-011; the Object half is fixed and pinned).
- The Object's `id` output and the Set's `id`/`error` outputs — refused by the gate when consumed;
  a literal the page already knows, built when a graph reads it.
- `Create New Array` — refused by decision, re-derived (§47.3); the consumer side (a wired Array
  Id from a static minter) is the slice that would move it, and the corpus has nothing to design
  against.
- The Object's own `prop-*` **inputs** (a write through the node — the interpreter's
  `scheduleStore` at frame end), a wired Fetch, the `changed`/`changed-<p>` signals — effect and
  write-through work, refused by name with the sentence that says which.
- Next by the surface: `Sign In With` (the client's return leg first, `_consumeAuthReturn`); the
  `Date` column (§46.6); or the two Global Store gaps above, which are one clause each.

## §48 Tier 3.9 — `CSS Definition`, the CSS Class it targets, the `Date` column, and the clause that was missing four families (session 76, 2026-09-03)

Session 75 left three named next steps and a Data bucket. The Data bucket's two named pairs
(`Action Dispatcher`/`Action Handler`, `Repeater Item`) are **"not a target"** and *"deliberately
out of scope"* by §3 and §7.3's own rulings — the handoff named them against the ledger, and the
ledger wins. `Sign In With` needs a provider to drive (a full-page redirect whose Done arrives on a
later load) and a decision about whether provider sign-in is wanted, which a session cannot make.
So this session took the smallest *scheduled* picker node by the product surface — `CSS
Definition` (Tier 3.9, the one §3 said to build "against a real project, not the corpus") — and
the two registered debts that were one clause each, and found the debts were bigger than a clause.

### §48.1 What the runtime does, and what that decides

- **`CSS Definition`** (css-definition.ts) has one input, `style` (`allowEditOnly`, a CSS code
  editor, which the parser carries as `{ kind: 'script', source }`), and no outputs. `updateStyle`
  appends a `<style id="style_<nodeId>">` to `document.head` and rewrites its text on every set;
  the delete listener ref-counts per node id and removes the element when the last instance goes.
  So the node is a **mount effect with a cleanup** — the `Delay` teardown's shape (§39) with a
  body — and its text is a build-time constant in the runtime's own terms. The export: a module
  constant above the component holding the CSS **verbatim** (a template literal, the three
  sequences a template literal would read as its own escaped, nothing else touched) and
  `useEffect(() => { const style = document.createElement('style'); style.textContent = X;
  document.head.appendChild(style); return () => { style.remove(); }; }, [])`. One visible
  divergence, which is invisible: N instances of one component are N identical `<style>`
  elements where the runtime shares one; the cascade is the same.
- **A stylesheet targets class names, and the export was dropping every one of them.** Every
  visual node carries `cssClassName` ("CSS Class", react-component-node.ts: `this.props.className
  = value`, joined after the node's own class — Text.tsx `['ndl-visual-text', props.className]`),
  and `style.ts` returned it as `unhandled`, so a project that authored `.hero { … }` in a CSS
  Definition and `hero` on a Group exported a stylesheet that matched nothing, with a note per
  node. So the second half of the slice: an authored literal class joins the element's
  `className` after the module class and before the visibility toggle —
  `className={joinClasses(styles.heading, 'due-title')}` — and the collapsed Group's class lands
  on the page div, which is where its parameters render. A wired CSS Class stays reported.
- **The `Date` column** (§46.3 registered, A5 pinned). On the wire a Date column is `{ __type:
  'Date', iso }` — the backend's `AdapterFacade.toWire` wraps the stored ISO string, cloudstore.js
  `_serializeObject` sends the same envelope — and once read, a JS `Date` (`_deserializeJSON(data,
  'Date')` → `new Date(data.iso)`). `tsColumnType('Date')` is now `Date`; the client's `fromWire`
  runs every field through `fromWireValue`, which turns that envelope and only that envelope into
  a `Date` (by shape: the client has no schema, and the envelope is unambiguous — a File envelope
  IS the `CloudFile` the column declares, §46); a Text on the column takes the §43 non-string
  table (`String(x ?? '')` — the runtime Text's own cast, so it prints `Date.prototype.toString`
  in both worlds); `Date To String` reads it bare (`toDate` takes a Date); a `Now` into the column
  writes the `Date` local and the wire serialises it as its ISO string, which `toWire` wraps on
  the way back.
- **The Global Store gaps, and what the probe found beside them.** §47.3's vacuous `every` is now
  `sources.length > 0 && every` for every origin (a Global Store key whose only Set has no value
  wire is `unknown`, its Subscribe read coerced). And the control-mint `outputRead` clause got
  `Set Global Store` — then a four-case probe over the Cheer Mood page (a text input's value into
  the sink, its trigger on a button) measured **`Set Variable`, `Cloud Function` and `Event
  Sender` dropping the click with the same true sentence** — *"the action reads values that only
  exist in another handler"*. A text input, a button and a variable is the plainest form idiom
  there is, and it exported as a button that does nothing. All four are on the clause now, with
  one exception spelled out: a sink whose trigger is the input's **own** `textChanged` is the
  write-through idiom, which NAMED-STORES-TARGET §2's golden pins as uncontrolled — the first emit
  broke that golden before the exception existed.

### §48.2 The build

- `plan.ts`: `CSS_DEFINITION_TYPE`, `StyleSheetPlan`, `ComponentPlan.styleSheets`, a pass beside
  the Value Changed producer (wired Style refused by name; empty Style `static` with a note; the
  constant named like a Static Data constant, deduped; disposition `collapsed` into the page
  file); `tsColumnType('Date') → 'Date'`; four sinks on the control-mint clause with the
  own-change exception.
- `component.ts`: the constant after the Static Data constants, the effect after the Delay
  cleanups, `useEffect` earned; `authoredClassName`, the `cssClassName` note skipped where one is
  folded, `classAttrOf` rebuilt around a class list (single-quoted where the name is a plain class
  list, JSON-quoted otherwise).
- `emitApp.ts`: `fromWireValue` + `fromWire` over every field; the EXP-009 client golden and its
  target doc carry it.
- `appState.ts`: the one-line `every` fix. Ledger: `CSS Definition` translated; floor 89 → 90.
- Fixture `tests/fixtures/due-desk` (20 nodes, 13 wires): a `Task` schema with `due: Date`, a
  Record reading it into a Text and a Date To String, a Create writing it from `Now`, a CSS
  Definition with two rules, `cssClassName` on the shell Group (collapsed into the page div) and
  the heading Text.

### §48.3 What building it found, and what is written down rather than fixed

- 🔴 **A note can be a shape a slice never fixtured.** Four sinks dropped the plainest form idiom
  with a true sentence, for as long as each has existed; the mood fixture writes from the input's
  own change and the record verbs had their own line. The probe (`probe48.ts`) is the instrument
  the clause owed since s19: one fixture, every handler-argument reader, the trigger on a button.
  **HTTP Request's body is NOT on the clause and was not reached by the probe** (its body ports
  need `bodyFields` configuration the probe did not build) — registered, owner **EXP-011**.
- 🔴 **The first emit broke a golden, and the golden was right.** `Set Global Store` on the clause
  minted state for cheer's `noteInput`, whose own `textChanged` fires the Set — the write-through
  idiom. The exception is the clause's own condition made explicit; G2 CONTROL and G3's control
  pin both shapes per sink.
- 🔴 **A byte-for-byte golden is a design conversation, and this slice had one.** The EXP-009
  client golden changed for the first time since it was typed: `fromWire` now unwraps the Date
  envelope. Updated with the target doc, on purpose.
- ⚠️ **A `Date` into a String column is loud, not silent.** The interpreter would send the ISO
  string; the export fails to typecheck (`Type 'Date' is not assignable to type 'string'`). B4
  pins that it is loud. A string-typed write into a Date column is the mirror (a text input's text
  into `prop-due` — the runtime wraps the string as `iso` verbatim) and is the same typecheck
  refusal; neither is wrapped at the argument this slice. Owner **EXP-011**, when a fixture asks.
- ⚠️ **A Date column read by a Cloud File, a Sign, or copied into another class's undeclared
  column** — `exprTsType` answers `Date` only for a `record-out`; the write-gate admits
  `string|number|boolean|CloudFile` and types the rest `unknown`. Two lines that would have
  admitted `Date` there were written and reverted as dead code (nothing in the vocabulary reaches
  them); registered rather than pinned.
- ⚠️ **`fromWireValue` is shape-based.** A String column holding a literal `{ __type: 'Date', iso }`
  object would read as a Date. The interpreter reads by schema and would not. Named, not fixed —
  the client has no schema, and a String column holding that literal is not a shape any node writes.
- ⚠️ **N instances = N `<style>` elements** (the runtime shares one by node id). Invisible on the page.
- ⚠️ **A wired `style`** refused by name; a wired `cssClassName` still reported as unmapped. Both are
  one effect / one binding when a fixture asks.
- ⚠️ **`update()` does not go through `fromWire`** — it answers the caller's own data plus the wire's
  `updatedAt`, so a Date the caller passed stays a Date; A3 in `date-column.test.ts` counts three
  sites, not four, and says why.
- ⚠️ **The ledger's blind spot, again:** the picker number moved by one (CSS Definition) and cannot
  see the class-name fold or the Date column, both of which change what every exported page does.

### §48.4 Graded — `tests/css-definition.test.ts` (15 rows), `tests/date-column.test.ts` (12 rows), six §48 rows in `tests/global-store.test.ts`; 60 files on disk

- **css-definition §A** the stylesheet: the constant verbatim under its comment, above the component
  (A1); the effect, the import (A2); the disposition and the vanished note (A3); the three escapes
  and a typecheck (A4); naming and dedupe across four sheets (A5); a wired Style by sentence (A6);
  empty and whitespace Style static with the note, a plain literal read too (A7); the catalog's
  own port list (A8). **§B** the class names: page div (B1), Text (B2), notes gone and a sibling
  untouched (B3), CONTROL with the params removed (B4), wired and blank stay reported (B5), the
  toggle order and JSON-quoting (B6). **§C** typecheck with and without a backend.
- **date-column §A** `tsColumnType` (A1), the interface (A2), `fromWire`'s three sites and the one
  `__type` test (A3), **the emitted helper evaluated as written** over six shapes (A4). **§B** the
  Text coercion (B1), Date To String bare (B2), the Now write and typecheck (B3), CONTROL as a
  String column — bare Text, and the Now write **loud** (B4), CONTROL undeclared — `unknown`,
  coerced, typechecks (B5). **§C** the two wire sources quoted (backend `toWire`, cloudstore.js
  both directions). **§D** the schema fact and the typecheck.
- **global-store §48** G1 + CONTROL (the `every`), G2 + CONTROL (the clause and the write-through
  exception), G3 (Set Variable, both shapes), G4 (Cloud Function, Event Sender).
- Re-sentenced beside them: `file-record` A5 (Date is Date) and B10 (the client's one `__type`
  read is the Date unwrap), `object-store` D6 (floor 90), the EXP-009 client golden.

### §48.5 The gates, the arms and the drive — and the instrument that miscounted its own rows

- Gates, one at a time, the peer's webpack watch left alone: `tsc` 0 (three passes); the full
  suite **60 files, 1684 rows** — first run 1681/1684 (the client golden, D6's floor 89, both
  §48's own consequences), the two files re-run 52/52; `export-ledger:check` OK — 176 types, 97
  translated; picker **90/127 (70.9%)**, floor 90, `--check` exit 0. No editor change, no editor tsc.
- **Fifteen arms, 15/15 killed by rows** (`mut48.py`, `runmut48.sh`): A disposition, B cleanup, C
  deps, D escaping, E wired gate, F trim, G the own-change exception (four killers incl. the
  NAMED-STORES golden), H Set Variable, I the `every`, J `tsColumnType`, K the unwrap (killed by
  the evaluated helper AND the text), L own class, M collapsed-group class, N quoting, O the two
  families. 🔴 **O took three arms.** Twice tsc alone killed it (TS2367 — narrowing made the
  later comparisons "unintentional") and jest ran 0 rows; a mutant only tsc kills is not killed
  (§46.5's rule), so the third arm flipped the `reads` branches to `false` — type-valid, killed by G4.
- **Drive** (`EXPECTED48.md` first; `drive48-run.sh`: emit → build → backend on :8587 → seed →
  headless Chrome → preview → drive → REST verify → `trap` teardown): run 1 **44/44, 0 diffs,
  consoleErrors [], VERIFY OK, 0 listeners left**. The page div carries `.due-desk` (border-left
  `6px` `rgb(0, 128, 0)` computed), the heading `.due-title` (`underline`), exactly one `<style>`
  in `head` through every re-render, the seeded task's Date prints `Date.prototype.toString`
  (`Thu Dec 24 2026 10:00:00 GMT+0100 …`) and formats `2026-12-24`, the Save stores `{ __type:
  'Date', iso }` at the page's load instant. The seed also read back BOTH storage shapes — an
  envelope stored by the interpreter's wire shape and a bare ISO string — as the envelope.
- **The sabotage control** (`arm48-ctl.sh`: the stylesheet effect and the Date unwrap cut out of the
  EMITTED app, exporter untouched): **21/44, 23 diffs — every style cell and every Date cell,
  nothing else, VERIFY still OK.** The prediction said 24: it counted a D3 `dueFmt` row the grader
  never had. The cell read blank in the log as predicted; the instrument had one row fewer than
  its author remembered. Counted, not corrected — the arithmetic error was the prediction's.

### §48.6 What this leaves

- **HTTP Request's body on the control-mint clause** — unmeasured (the probe did not build a body
  configuration); the ninth family or the tenth, when a fixture asks. Owner EXP-011.
- **A Date written into a String column, a string into a Date column** — loud typecheck refusals,
  not wrapped at the argument (§48.3). Owner EXP-011.
- **A wired `style`, a wired `cssClassName`** — refused / reported by name.
- **`exprTsType` never answers `Date` except for a record column** — a Now's instant or a date
  node's answer into an undeclared column types `unknown`. Registered.
- Next by the surface: `Sign In With` once provider sign-in is wanted (the client's return leg
  first, `_consumeAuthReturn`); `States` / `Animate To Value` (Tier 3.8, "worth doing properly");
  the component stack pair (§16.2 says what a Component Stack is not); `Script`. The Data bucket's
  remaining rows are "not a target" by §3 and stay so.
## §49 Tier 3.8 — the animation pair: `States`, `Animate To Value`, and the wired style sink neither could do without (session 77, 2026-09-03)

Session 76 left four named next steps; the one Richard-era ruling said "worth doing properly
rather than early" was the animation pair, so this session took it whole. The two nodes are the
picker's `Animation` category entire, and every prefab in `library/prefabs` that moves anything
(toggle-switch, tab-bar, rating, toast, navigation-menu, table, app-shell, auth-pages, stripe)
carries a `States`. Building it found the gap that made the pair pointless on its own: **a wire
into `opacity`, `color` or `backgroundColor` was not a sink the export could bind at all** — a
Variable into a Group's opacity dropped with the same catch-all sentence before this session.

### §49.1 What the runtime does, and what that decides

- **The engine** (timerscheduler.ts, one timer, repeat count 1): `start()` queues; the timer
  **joins at the end of the next frame** with `_start = frameTime + delay` (a zero delay plays
  `onStart` + `onRunning(0)` in the join frame); each later frame at or after `_start` computes
  `t = (now − _start)/duration` (`1` when the duration is 0), calls `onRunning(min(t, 1))`, and at
  `t ≥ 1` calls `onFinish`; `stop()` fires nothing; `start()` on a running timer stops it first.
  So the export is a `Run` in `src/lib/animate.ts` driven by `requestAnimationFrame`, with
  `runFrame(run, now)` exported so a test can drive it at chosen instants — which is how it is
  graded (§49.4). The ease table is easecurves.ts's four picker names aliased onto the cubics,
  and the bezier solver is bezier-easing 1.1.1 with its constants, both transcribed.
- **`Animate To Value`** (animate-to-value.ts): the first numeric target is **adopted outright**,
  a target equal to the current end is ignored, anything else tweens from wherever the value is;
  booleans are 1/0, a NaN is ignored, `At Target Value` fires on finish only and never for an
  interrupted run. The export: `const fade = useAnimatedValue(target, { duration, delay, ease },
  onArrive)` — the engine in a ref, the number in state, the latest `onArrive` in a ref, the
  first target adopted in the ref's lazy creation so the first render already shows it.
- **`States`** (states.ts, 1127 lines): requests are **queued per pass and drained after it**
  (`scheduleGoToState` over `scheduleAfterInputsHaveUpdated`) — a request for where the pass is
  already heading answers Unchanged at once, all but the last request are *settled immediately*,
  the last one animates. `goToState`: a falsy state is the first; the current state is Unchanged;
  a name not in the list is Failure with the node's own `Error` text (`nearestName` transcribed
  for the "Did you mean" clause); the first ever request jumps (no State Changed); after that
  booleans and strings jump, numbers and colours tween along `transition-<state>-<value>` ||
  `transitiondef-<state>` || `{[0,0,0.58,1], 300, 0}`, settled at once when both are 0, when Use
  Transitions is off, or when the pass only passed through the state. `State`, `At <state>` and
  State Changed move at the request, `Has Reached <state>` at the tween's end, Done after State
  Changed. The export: a `defineStates({…})` constant above the component (the node's parameters
  in its own names), `const panel = useStates(PANEL_STATES, 'dim', { stateChanged, reached: {…},
  done, unchanged, failure })` inside it, `panel.toggle()` / `panel.goTo('bright')` from the
  action ports, `useEffect(() => { follower.follow(wanted); }, [wanted])` for a wired State,
  and reads `panel.state`, `panel.values.opacity`, `panel.state === 'bright'`, `panel.error`.
  🔴 **Done/Unchanged/Failure are node ports, not per-trigger arms**: `reportOutcome` pulses the
  same port whichever trigger asked, so a chain off `done` is a listener passed once, and the
  first design (arms at each call site) would have printed one chain N times and fired it for
  one trigger only. The drain is a microtask — the handler that asked is the pass.
- **The wired style sink.** `WIRED_STYLE_SINKS` (style.ts): `opacity` (number), `color` and
  `backgroundColor` (strings) — unitless or a string, so no `defaultUnit` question — bound by
  every binding pass through one `styleSinkOf` (the node's catalog entry must declare the port)
  and printed as one inline `style={{ opacity: …, backgroundColor: … }}` after the class, which
  wins over the module class exactly as a wired value replaces the authored parameter.

### §49.2 The build

- `src/emit/animateLib.ts` → `src/lib/animate.ts`; `src/emit/statesLib.ts` → `src/lib/states.ts`
  (imports `./animate`); `emitApp.ts` ships the first for either node, the second for a States.
- `plan.ts`: `STATES_TYPE`/`ANIMATE_TYPE`; `states-out` and `animate-out` expression kinds;
  the `states-go` action (no chains ride on it — see above); `StatesPlan`/`AnimationPlan` on
  the component plan; `statesPlanOf` (memoized, **the core cached before the listeners are
  compiled** so a listener that fires this node's own `To <state>` through another node finds the
  handle; a later refusal flips the entry and evicts every sink compiled against it) and
  `animationPlanOf`; `compileStatesGo`; `isStatesTrigger` on the trigger predicate; the
  registration pass beside the effect producers; `ownsChainOutput` (the `reached-<state>`
  family) on the attach-loop skip; the reads in Pass 4f beside `Now`'s; the style sink on every
  `bindable`.
- `component.ts`: the constant, the hooks after the render locals (an Expression into State is
  the corpus's own shape), the follow effects, the imports, `styleAttrs`, the typed coercions
  (`String(x)` for a number or an At in a text sink, `?? ''` for the Error only), the walkers.
- Ledger: both translated; floor 90 → 92. Fixture `tests/fixtures/glow-desk` (49 nodes, 37
  wires): a Panel machine (two states; a number with a per-value 200 ms delay, a colour, a
  string) driving a box's opacity and background and a label, Toggle/To bright/To dim buttons,
  a State Changed counter, Has Reached chains, Done/Unchanged chains; a Follower machine whose
  State is wired from a Variable two buttons write; a Fade whose target is a Variable.

### §49.3 What building it found, and what is written down rather than fixed

- 🔴 **The typecheck cannot see a store object handed to a hook.** The first emit printed
  `useAnimatedValue(level, …)` and `follower.follow(wanted)` — the *store objects*, not the
  `useValue` locals — because the new plans' expressions were never walked for hooks. Both
  typechecked (`unknown` takes anything) and neither would ever have moved. Read off the emitted
  page before any test existed; B2/B6 pin the locals now. The second walker's warning
  (`hookExprSources`'s own comment) was right for the eleventh time.
- 🔴 **MEASURED: a token-coloured States value cannot reach its colour in the interpreter.**
  `resolveColor` is a lookup in a `styles.colors` table no v2 project carries, so `var(--primary)`
  reaches `setRGBA` unresolved: the first channel is `parseInt('ar', 16)` = 10, the other three
  NaN, every tween frame is `#0aNaNNaNNaN`, and — the part that matters — the tween **ends** on
  `rgbaToHex(targetValues)`, the parsed garbage, never the authored string. With transitions on
  the value stays invalid for good (the browser keeps the previous colour). Pinned by the loaded
  `states.ts` (A5 MEASURED); the export resolves a `var(--token)` off the document and degrades
  to the interpreter's own answer where there is no document. Owner **NONE** — a runtime defect
  in `states.ts`, outside this phase.
- 🔴 **MEASURED: an authored State that is not a state is refused at boot with a Failure pulse**
  and the node stays in its first state; a valid non-first authored State **animates from the
  first state at boot and fires State Changed**. Both reproduced (the second) or noted (the
  first — the export starts in the first state and files a note, without the boot pulse).
  ⚠️ The boot order is the parameter key order in the file: `currentState` before `states`
  would jump to the authored state and then animate *back* to the first. Owner NONE.
- ⚠️ **A colour with a per-value delay publishes its RGBA array for the delay** (`currentValues[v]
  = this.startValues[v]` in `onRunning`). Transcribed, not corrected — the browser ignores the
  invalid style in both worlds.
- ⚠️ **Only a String constant types a Variable.** `level`, written by two Number constants, is
  `value<unknown>`; `wanted`, written by two String constants, is `value<string | undefined>`.
  So a Number-fed Variable into `opacity` is refused by name (B15) where a Counter binds. Owner
  EXP-011 (the `typeOfSource` table in appState.ts).
- ⚠️ A States driving itself (`reached-bright → to-dim`, the bounce) is refused by
  `doneChainOf`'s self-drive rule, as a self-restarting Delay is. Registered.
- ⚠️ A listener chain that reads a handler-only value defers the node ("its X chain reads values
  that only exist inside a handler") — unmeasured by a row.
- ⚠️ `textStyle` values, wired `states`/`values`/`type-*`/`value-*`/`transition*`/
  `useTransitions`, a value unauthored in a state, `to-`/`at-`/`reached-` naming no state, a
  consumed Completed, an empty States list, a wired or unknown Easing Curve — all refused by name.
- ⚠️ The transform family (`transformX`, `rotation`, `scale`) stays an unmapped parameter; the
  toggle-switch prefab's `pos → transformX` is the first fixture that will ask.

### §49.4 Graded — `tests/animation-pair.test.ts` (55 rows); 61 files on disk

- **§A the modules against the interpreter, loaded from source and driven at the same
  instants.** A1 the run engine against `timerscheduler.ts` over seven scripts (delay, zero
  duration, stop, restart, start twice, start off a frame): the same start/finish instants and
  the same `t` on every frame, plus a broken copy that disagrees. A2 the frame loop advances
  under a `requestAnimationFrame` polyfill. A3 the ease table and the bezier solver against
  `easecurves.ts` and `bezier-easing` at 101 points. A4 `animateTo` against the loaded
  `animate-to-value.ts` node over seven scripts (adoption, same target, retarget mid-run,
  booleans, NaN/numeric string, delay, zero duration) plus a control. A5 the state machine
  against the loaded `states.ts` — the whole node, booted through a stand-in for `Node` and
  drained as the runtime drains it — over nine scripts (To, retarget, Unchanged, Toggle twice,
  unknown state, two requests in one pass, the State input in three forms), Use Transitions off,
  an authored non-first State, an authored non-state, the Error text with "Did you mean", the
  MEASURED token colour, and a control that animates every queued state. A6 both hooks under
  `renderToString`.
- **§B the translation** — 18 rows: the constant, the hook with listeners, the one-argument
  hook and the follow effect on the `useValue` local, the three calls, the five read shapes, the
  inline style, the fade hook, dispositions and the order row, which modules ship, the States
  refusals by name, a To naming no state (the trigger refuses, the node translates), an authored
  non-state, a value name with a space, the Animate refusals, no callback / a literal target,
  CONTROL the sink is general (a Counter binds, an untyped Variable is refused by name), an
  unnamed style parameter stays reported, an At into a truthiness sink prints bare, the ledger.
- **§C** the fixture typechecks whole. `object-store` D6 re-pinned to 92.

### §49.5 The gates, the arms and the drive — and the control that diffed one cell I had not predicted

- Gates, one at a time, the box otherwise idle (a peer's dev stack came up and went down while
  files were being written, and nothing of mine ran beside it): `tsc` 0 (three passes); the full
  suite **61 files, 1755 rows** (the file then grew by two rows for arm A and was re-run alone,
  57/57 — 1757 by arithmetic, not by a second full run); `export-ledger:check` OK — 176 types,
  99 translated; picker **92/127 (72.4%)**, floor 92, `--check` exit 0. No editor change.
- **Seventeen arms, 17/17 killed by rows** (`mut49.py`, `runmut49.sh`, five specs): A the
  drain's own Unchanged, B the run delay (`min` → `max`), C a run never finishes, D `t` unclamped,
  E a textStyle admitted, F a missing value as 0, G the trigger predicate, H the style attribute
  inverted, I the target not walked for hooks (the store-object defect of §49.3), J the style sink
  inverted, K the number coercion, L `reached-` off the attach skip, M `states.ts` never ships, N
  the authored State ignored at boot, O the follow effect without deps, P no "Did you mean", R the
  At comparison inverted. 🔴 **A survived round one**: the row that should have caught it
  answers Unchanged one clause earlier (`scheduleGoToState`'s pending-target test), and the only
  road to `goToState`'s own Unchanged is a *failed* request followed by a request for the current
  state in the same pass — a row that both worlds answer `[failure, unchanged]` now pins it.
  **E was TS2367 first** (a literal comparison the narrowing called unintentional) and jest ran 0
  rows — a mutant only tsc kills is not killed (§46.5's rule); re-armed through `String()`.
- **Drive** (`EXPECTED49.md` first; `drive49-run.sh`: emit → build → headless Chrome → preview →
  eleven steps → `trap` teardown, no backend): run 1 **51/51, 0 diffs, consoleErrors [], 0
  listeners left**. Read off the page: To bright moves `State`/`At`/the label/the count/`done`
  within 27 ms while the box's opacity is still `0.2` (its 200 ms delay) and the background still
  the dim colour; at +379 ms opacity `0.632182` and background `rgb(207, 172, 19)`, neither
  endpoint; settled at `1` / `rgb(255, 204, 0)` with `bright reached`; Bright again is
  `unchanged` with the count unmoved; Toggle back is `dim reached`; the Follower jumps to `1`
  and refuses `nope` with the node's own sentence; Level high is adopted outright (`1`, no
  arrival); Level low reads `0.153302` at +250 ms and settles at `0` with `arrived`.
- **The sabotage control** (`arm49-ctl.sh`: `t` forced to 1 in the EMITTED `animate.ts`, the
  exporter untouched): **46/51, 5 diffs** — D3's two mid-tween cells (opacity `1`, background
  the target) and D10's `fade`/`fadeOpacity` at `0`, as predicted, **plus D10's `arrived`**,
  which I had not predicted: a run that settles on its first frame fires At Target Value at once.
  The two D2 cells I did predict did not diff: the read landed 27 ms after the click, before the
  second frame the cut settles on — the timing margin of §39.5, on the instrument side this time.
  Counted, not corrected: the arithmetic was the prediction's.

### §49.6 What this leaves

- **The interpreter's token colour** (§49.3, owner NONE): a `var(--token)` colour value in a
  States node with transitions on never reaches its target in the interpreter. The export
  resolves it. Nobody has driven a prefab that does this in the editor; the first will see it.
- **Only a String constant types a Variable** (§49.3, owner EXP-011): a Number-fed Variable is
  `unknown` and refuses a number sink by name. One table row in `appState.ts`.
- **The transform family** (`transformX`, `rotation`, `scale`) — the next style sinks the
  toggle-switch prefab will ask for; a `transform` rule the static style has no shape for yet.
- **A States driving itself** (the bounce) is refused by the self-drive rule; a listener chain
  reading a handler-only value defers the node — neither measured by a row.
- **HTTP Request's body on the control-mint clause** (§48.6) — still unmeasured.
- Next by the surface: `Sign In With` once provider sign-in is wanted (the client's return leg
  first); the component stack pair (§16.2 says what a Component Stack is not); `Script`. The
  Data bucket's remaining rows are "not a target" by §3 and stay so.

## §50 Richard's ruling, 2026-09-03 — the "not a target" list was wrong, and the danger is the cascade nobody is told about

**No node built. Picker 92, unchanged.** A read of the board with Richard, who did not recognise
the shape of the remaining list and was right not to.

### §50.1 What was measured before the ruling

- **The picker report said 35 left; the task file had already ruled 22 of them out**, all in the
  §3 "Not a target" list written on 2026-08-28. Only 13 were being treated as buildable, and the
  hand-off put `Sign In With` first — a node Richard has never placed and that waits on a provider
  decision. Session 77 wrote it as conditional; read as an instruction it was the wrong first pick.
- **Every one of the 22 exists and is placeable** (`node-catalog.json`: `inNodePicker: true`, none
  deprecated). Their definitions, read from source rather than from the list: `Run Tasks` runs a
  worker component per array item; `On App Error` is the app-wide error boundary; `Subscribe To
  Changes` is the realtime subscription over SSE (`GET /realtime` + `POST /realtime/subscriptions`);
  the streaming trio are pure functions over chunks; `Hash`/`Random Bytes` are WebCrypto;
  `Screen Resolution` is `window.innerWidth` on resize. Nothing on the list is impossible. It was
  excluded for being *specialist*, and Richard's reading of who uses what is the better instrument:
  *"Create New Array — I use this all the time. Run Tasks — I use this all the time. Server-Sent
  Events — a new one that will excite a lot of people, danger zone. WebSocket — danger zone."*
- **The shipped template places none of the 35** (`templates/members-area`, 0 instances of every
  one), so the product-surface ranking cannot come from templates. One MCP-built drive project on
  disk holds **ten `Script` nodes** — the escape hatch is what the AI reaches for.
- **The list contradicted the README's first commitment** — *every node in the picker exports, or
  the picker stops offering it.* An exclusion list does neither.

### §50.2 🔴 The danger, measured: a refusal cascades, and nobody is told at authoring time

Richard's question: *"wtf happens to the person's app if they try to export anyway and this node is
used a lot?"* Three readings:

1. **A refusal takes its downstream pathway with it.** `plan.ts` refuses any node whose only
   trigger is a refused node, with the reason *"its Do is never fired by a translatable trigger"*
   (the record verbs, `Navigate`, `HTTP Request`'s Fetch, `Cloud Function`'s Call, the files —
   lines ~5917–6215). A `Run Tasks` in the middle of a flow silences every Cloud Function, Navigate
   and HTTP Request behind it. An `On App Error` refusal means the entire error pathway does not
   exist in the exported app. The pre-flight's sentence — *"left out, never translated wrongly"* —
   is true of the node and silent about the pathway.
2. **Nothing in the editor reads the ledger.** No badge in the node picker, nothing in the property
   panel (`grep -rlai` over `noodl-editor/src/editor/src` for any export-status text: four hits,
   all unrelated). The first a person hears is the pre-flight modal, which lists **components with
   refusal counts**, not node names; names and reasons arrive in `EXPORT-REPORT.md` after the
   write.
3. **The ledger already carries the sentence per type** — 60 `deferred` rows, each with an
   exemption the checker enforces the shape of. Showing it is a wire, not research.

### §50.3 The ruling

Richard, 2026-09-03: *"Let's do it"*, on this split —

- **Build, Tier 2.8, in the order §3 lists** (22 nodes, 13 rows): Component Children; Script;
  Run Tasks; On App Error; Create New Array; Filter Records; Repeater Item; the streaming trio;
  Hash/Random Bytes/Screen Resolution; the component-object family; the component-stack trio; the
  relation pair; Drag.
- **Build, Tier 3.11, the transports**: Subscribe To Changes, Server-Sent Events, WebSocket.
- **Out of scope, and badged**: Action Dispatcher, Action Handler, Optimistic Update, State History,
  State Snapshot, Undo / Redo, Parse CSV, To CSV, Pattern Extractor, Sign In With.
- **EXP-013 before row 1**: *"we need to be super clear when someone is doing code export which
  nodes can't be exported and what will happen"* — a badge where the node is placed, the pre-flight
  naming nodes and what each refusal silences, and a plain verdict when the cascade is large:
  change these nodes, or wait.

Reversals of earlier sections, by name: §7.3's `Create New Array` and `Repeater Item` (both
"deliberately out of scope" for mechanism reasons — the mechanisms are real and are now the work,
not the excuse); §44.6's `Subscribe To Changes` as refuse-by-name; §45.6's `Sign In With` as a
scheduled tail (now out of scope until a provider decision). The ledger's 25 sentences were
rewritten in this commit; `export-ledger:check` enforces the shape and read OK; the picker floor is
untouched because no translation changed.

### §50.4 What this leaves

- ✅ EXP-013, the warning — **built, gated and driven in session 78 (2026-09-03)**; the record is in the task file. Measured on the way: the cascade is not one sentence but three, the root was never named as a node at all, and it reaches a `Variable` and the `Text` bound to it — five nodes behind one `Run Tasks`, not three.
- ✅ Tier 2.8 row 1, `Component Children` — **built, gated, driven in session 79 (§51)**; picker 93. Next row 2, `Script`.
- ✅ `Create New Array` (row 5) — **designed and built in session 83 (§55)**: the handle is the id. Picker 97.
- The honest ceiling is now **117 of 127**; the ten out-of-scope rows stay out only while the badge
  says so where the node is placed.

## §51 Tier 2.8 row 1 — `Component Children`: the wrapper's `children` prop, rendered where the marker sits (session 79, 2026-09-03)

The first row of the list Richard reinstated in §50, taken in §50's order. Picker **92 → 93 of 127
(73.2%)**, floor 93, `export-ledger:check` OK (100 translated).

### §51.1 What the runtime does, and what that decides

- **The marker is not a node.** `nodescope.ts:217` `createNodeFromModel` creates nothing for a
  `Component Children`; if the marker has a parent it calls `componentOwner.setChildRoot(parent)` and
  returns. A parentless marker does nothing at all. The node library seeds it rather than
  registering it (`nodelibraryexport.ts:384`: *"a marker `NodeScope` interprets structurally"*).
- **The instance's placed children are inserted into that parent, at the marker's index, in
  order.** `componentinstance.ts:250` `setChildRoot` takes every child of the *instance* node
  (minus markers), and `addChild` puts each at `indexOf(child among its siblings) +
  getChildRootIndex()`, where `getChildRootIndex` is the index of the **first** marker among the
  child root's children. Contiguous, ordered, at the marker's position — which is exactly what
  React's `children` prop rendered at that position does. No marker with a parent ⇒ `childRoot`
  stays null ⇒ the placed children are never drawn.
- **Two markers.** `createNodeFromModel` runs per node in file order and each marker with a parent
  calls `setChildRoot`, so the **last** marker's parent wins; inside that parent the position is
  the **first** marker. Both rules are one pure function in the export, `chooseChildSlot`
  (plan.ts), read by the wrapper side and the instance side alike.

So the translation is: the wrapper declares `children?: ReactNode` and renders `{children}` where
the marker sits; an instance renders its placed children as JSX children; a target with no marker
drops them — with a disposition, a note and the AC3 in-file marker inside the element, since the
running app never draws them either.

### §51.2 What was measured before anything was built (`probe14-reverted.log`, HEAD da055635)

Fixture `tests/fixtures/slot-desk`: `Components/Panel` (a Group holding a Text bound to the `Title`
input, the marker, and a footer Text), `Components/Plain` (no marker), and `Pages/Home` placing a
`Panel` with two children (a Text and a Button) and a `Plain` with one.

- The wrapper's marker fell to `catalog.isVisual` → `'unsupported'` → *"visual child of panel-root
  with no deterministic generator (Component Children)"*, and the AC3 marker for it was printed
  **after the footer**, not where the node sat — `droppedChildMarkers` appends after the rendered
  children (its own comment says why: "rendered first, marked second").
- 🔴 **The three placed children were dispositioned `static`, listed under their instance in
  `childrenOf`, and never emitted** — `renderCore`'s instance branch passed `null` children. No
  note, no marker, nothing in the pre-flight: *"Pages/Home — 0 refusals"*. §3's row said *"the
  placed children vanish"*; measured, they vanish **with a disposition that says they rendered.**
  A sweep over `dispositions` (EXP-013's `collectRefusals`) cannot see this class: the node is
  `static` and absent.
- No other fixture in the corpus places children under an instance or carries a marker
  (`probe14.ts corpus`: 0 and 0 outside slot-desk), so no golden could move.

### §51.3 The build

- **plan.ts**: `RenderRole` gains `'slot'`; `renderRole` maps the type to it; `chooseChildSlot` /
  `parentMapOf` / `CHILD_SLOT_TYPE` exported. `ComponentPlan.childSlot` is set **before the walk**
  from the pure rule, so the wrapper declares the prop exactly when an instance passes children —
  the two sides cannot disagree. In the walk: the honoured marker is `static`, role `slot`, in its
  parent's `childrenOf`; any other marker is refused naming the honoured one; an instance whose
  target has no marker inside its tree (or cannot be resolved) has its placed children dropped by
  `dropSubtree` — disposition, note, `markDroppedChild`, and every descendant named so the sweep
  does not call a Text a logic node. A marker the walk never reached (parentless, or below a node
  that did not draw) is named after the walk.
- **component.ts**: role `slot` renders `{children}`; the instance branch renders
  `renderChildBlocks(id, childrenOf[id])` as the element's JSX children — so a dropped child's
  marker lands **inside** `<Plain>…</Plain>`, where the node sat (an expression container holding
  only a comment passes no `children`, and the typecheck helper confirms `PlainProps` needs none).
  `children?: ReactNode` on the interface whenever `childSlot` is set; destructured only when the
  marker rendered; `ReactNode` joins the React import; `children` joins the reserved locals.
- **Ledger**: `translated`, floor 93, the floor comment carries the vanish the number cannot see.
  The two rows that pin the floor (`animation-pair` B18, `object-store` D6) moved with it.

### §51.4 What building it found

1. 🔴 **A property decided by two rules on two sides disagrees at the corner.** The first cut set
   `childSlot` only when the walk *reached* the marker, while the instance side asked the pure
   rule. A marker under a detached second root (the runtime *does* insert into that undrawn root)
   would have had the page pass children to a component declaring none — a typecheck failure in
   the exported app, on a shape no fixture had. Fixed by making the declaration pure on both sides
   and only the *rendering* the walk's answer (§G in the spec is that shape).
2. ⚠️ A `static` disposition on a node that is never emitted is invisible to every instrument
   built on `dispositions`, including EXP-013's cascade rows. The emitted file is the only readout
   that could have caught §51.2 — which is what `typecheck-emitted` and the goldens are for.
3. ⚠️ `droppedChildMarkers` prints markers after the rendered siblings, so the AC3 comment does not
   say *where* a dropped child sat when it has rendered siblings. Not changed here (it would move
   goldens across the suite); registered, owner NONE.

### §51.5 Graded — `tests/component-children.test.ts` (19 rows), the gates, the arms

§A the wrapper (golden `Panel.tsx`, `{children}` once between title and footer, the plan's
`childSlot`/role/disposition, the marker-less control) · §B the instance (golden `Home.tsx`, order
and cardinality, order reversed ⇒ emitted reversed) · §C the marker-less target (the orphan's
disposition, note and in-element marker; a nested subtree named down to the leaf with one marker;
an unresolvable target) · §D a parentless marker · §E two markers under one parent (the first is
the position) · §F two markers under different parents (the last one's parent wins) · §G the
honoured marker below a detached root (prop declared, nothing rendered, the instance still passes;
and a wrapper with no inputs) · §H the ledger row and the pre-flight's 1 refusal · §I the whole
fixture typechecks. Six of the rows build the emitted app as a real `ts.Program`.

```
nodegx-export: tsc 0 · jest 63 files (63 on disk) 1889 rows — 1887 + the 2 floor pins moved to 93 (animation-pair B18, object-store D6), rerun 92/92
noodl-editor: tsc -p tsconfig.json --noEmit 0 (the working tree, which carries peers' uncommitted editor edits)
export-ledger:check OK — 176 types, 100 translated · export-ledger:picker --check: holds at 93/127 (73.2%), exit 0
arms 7/7 red, all restored: M1 instance passes no children (8) · M2 children reversed (3) · M3 slot renders nothing (5)
  · M4 marker-less target drops silently (5) · M5 children off the Props (6) · M6 first marker's parent instead of the last (2)
  · M7 last marker's position instead of the first (1)
```

### §51.6 The drive (`run-editor`, `dev:debug`, a copy of slot-desk registered in recents, torn down after)

- **Picker**: `Component Children` searched — the card carries **no** export-badge dot; the control,
  `Run Tasks`, carries its 14×14 dot, reachable, titled *"Not exportable yet — EXP-011 Tier 2.8 ro…"*.
  The ledger is the only list, so the badge left by itself (`drive14-01-picker-slot.png`,
  `drive14-02-picker-control.png`).
- **Pre-flight**: Settings → Project → *Export as React code…* → *16 files — 1 page, 2 components* ·
  *1 thing will not translate* · *Pages/Home — 1 refusal* · *"Orphan" (Text) — placed under instance
  bare of /Components/Plain, which has no Component Children node inside its tree — the running app
  never draws it either* · no verdict (nothing in the cascade is a pathway) · the button reads *Choose
  folder and export…* (`drive14-03-modal.png`).
- **The write, through the real path**: the native folder dialog was routed to a scratchpad
  directory through the `FileSystem.instance.chooseDirectory` seam, so `checkTarget` → `writeExport`
  → the toast all ran: *"Exported EXP-011 Slot Desk Drive — 16 files written … 1 thing is left out —
  read EXPORT-REPORT.md first"* (`drive14-04-toast.png`). On disk: `src/components/Panel.tsx` is
  **byte-identical to the spec's golden** (md5 `cd03c445…`), `src/pages/Home.tsx` passes the two
  children inside `<Panel Title="Today">…</Panel>` and holds the orphan's marker inside `<Plain>`,
  and `EXPORT-REPORT.md` lists the orphan under *Nodes left out*.
- Observed, not measured: the preview pane on this fixture copy showed *"No HOME component
  selected"* while the router declares `/Pages/Home` as its start page. The s78 task-desk copy was
  built by the same generator; whether this is the generator's project.json shape or the preview is
  unmeasured — owner NONE, registered here.

### §51.7 What this leaves

- **Next, in §50's order: row 2 `Script`** (ten in one MCP-built project), then `Run Tasks`, `On App
  Error`, `Create New Array` (design session first), … `Sign In With` stays out.
- `droppedChildMarkers` appends after the rendered siblings (§51.4 item 3) — the AC3 comment loses
  the dropped child's *position* whenever it had rendered siblings. Owner NONE.
- The `_props: XProps` signature branch (a component with no inputs whose only marker never rendered)
  is written and typechecks by construction but no row drives it; §G's second row covers the
  rendered case. Small, registered.
- A `Component Children` inside a `For Each` template component: the repeater's row component takes
  the prop like any other, but nothing places children under a repeater instance in the editor.
  Untested, and probably unplaceable — noted so nobody measures it twice.

## §52 Tier 2.8 row 2 — `Script`: hosted, not re-hosted (session 80, 2026-09-03)

The second row of §50's list. Picker **93 → 94 of 127 (74.0%)**, floor 94, `export-ledger:check` OK
(101 translated). The type id is `Javascript2`; `Script` is its display name — a grep for
`"type": "Script"` finds nothing, and this section is the first thing that says so.

### §52.1 What the runtime does, and what that decides

- **The code runs once, and declares an object.** `javascriptnodeparser.js` compiles the code as
  `new Function('define', 'script', 'Node', 'Component', prefix + code)` — non-strict, with the prefix
  `const Script = (typeof Node !== 'undefined')?Node:undefined;` — and **calls it once** at parse. Three
  generations of DSL declare the node: `define({inputs, outputs, setup, run|change, destroy, <signal>()})`,
  `script({inputs, outputs, setup, destroy, changed: {k(new, old)}, signals: {k()}, methods})` (whose
  `setup` installs `this.inputs`/`this.outputs`/`this.setOutputs` and the methods), and the bare
  `Node.*` form — `Node.Inputs`/`Node.Outputs` as type maps, `Node.Signals.k`, `Node.Setters.k`,
  `Node.OnInit`/`OnInputsChanged`/`OnDestroy`, `Node.setOutputs` — taken when neither was called
  (`_afterSourced`). Every real body on disk is the third form; one is `define`.
- **The lifecycle is the viewer's** (`javascript.ts`). Output accessors exist only for the ports on
  `model.outputPorts` (a set publishes and flags dirty — no change gate, unlike Function; a signal reads as
  a callable that pulses). After parsing: setup is scheduled, then the run, then every input delivered
  before the parse is replayed (each marks itself changed), then `Node.Inputs` becomes the live values
  and `Node.Outputs` the accessors. A value input marks itself changed and schedules a run — gen 3's
  run calls `Setters[k]` per changed key then `OnInputsChanged`; gen 2's diffs against the previous
  inputs and calls `changed[k](new, old)`. A signal input schedules its function, coalesced per name
  per pass, `this` = `{flagOutputDirty, sendSignalOnOutput, runNextFrame, createComponent,
  deleteComponent}`. Deletion runs destroy. Throws are logged and swallowed.
- 🔴 **The port set is the one on disk.** `nodemodel.ts createFromExportData` builds a node's ports
  from `ports`; the editor persists what it discovered under `dynamicports`, which `parseProject`
  already merges into `declaredPorts`. The deployed app registers exactly that set — the export never
  runs the code to find ports, and never needs to.
- 🔴 **The MCP's script-port backstop covers `JavaScriptFunction` only** (`noodl-mcp/src/scriptPorts.ts`,
  `SCRIPT_PORT_NODE_TYPE`). An MCP-authored Script node reaches disk with no ports until the editor
  opens the project, and the running app has none either. Source read, not driven — registered in
  §52.7 with an owner.
- **The corpus** (`strictprobe.js`, 15 distinct bodies across `NodeGX test projects`): all 15 compile
  sloppy **and** strict; 13 gen 3, 1 `define`, 1 junk. Every real body keeps state in module-level
  `let`s and reaches `setInterval`, `navigator.mediaDevices`, `MediaRecorder`, a DOM element through
  `Inputs.This.getDOMElement()`, or a CDN script; three of def036-dash-drive's ten call
  `Noodl.Files.upload`.

So the Function node's pure re-host is the wrong target: a timer inside a render-time wrapper would
run on every render, and the gate that keeps Function pure would refuse every real Script body. The
faithful deterministic target is a **hosted object with the runtime's lifecycle**: `src/lib/script.ts`
transcribes the parser and the viewer's lifecycle; each node's code is preserved **verbatim** as the
runtime-shaped function `(define, script, Node, Component) => { <prefix>; <code> }` in its own file
under `src/scripts/<dir>/<fileBase>/<name>.ts`; the component calls `useScript(definition, inputs,
listeners)`. Timers, the DOM, `fetch`, `async`, `this`, `Date` and `Math.random` are **not** refused —
they run inside effects and handlers the host owns, and they are what the node is for. What is refused
is only what the exported app cannot supply: `Noodl.*`, `Component.*`, `createComponent`, a dynamic
`import()`, code fetched from a URL at runtime (Use External File), and a port set the editor has not
written yet.

### §52.2 What was measured before anything was built (`probe15-reverted.log`, HEAD e1a92d95)

Fixture `tests/fixtures/script-desk`, `Pages/Home`: a gen-3 **ticker** (Start/Stop signals in, an
interval, `Seconds` out), a gen-3 **greeter** (`Name` in, `Greet` in, `Greeting` out, `Greeted`
signal out into a `Set Variable`), a gen-1 **doubler** (`define` with a reactive `change`), a gen-2
**bumper** (`script` with `signals` + `changed`), and — in the probe only — a gen-3 **uploader** that
calls `Noodl.Files.upload`.

- All five `deferred` with `logic node (Javascript2)`; every wire into or out of them dropped with
  the generic *"no deterministic translation in step 5"*; the three constants feeding them deferred
  as *"feeds Javascript2.Name, which has no static binding"*, each attributed **by graph** to its
  Script as `causedBy` (EXP-013's rows worked as built); `setGreeted` refused as *"trigger
  greeter.Greeted is not a rendered element event or a receiver"*.
- The five bodies survived only as the §27 comment blocks in `Home.tsx`; every Text bound to them
  emitted empty; the pre-flight said *Pages/Home — 5 refusals*.

### §52.3 The build

- **`src/analyze/script.ts`** (new): `SCRIPT_TYPE`, the verbatim `SCRIPT_CODE_PREFIX`, `scriptPortsOf`
  (declared ports split by plug and kind, the node's own static inputs and `intype-`/`outtype-` rows
  excluded), `scriptCodeOf`, `scriptPortTsType` (`*`/object/cloudfile → `any`, EXP-003 §4's ruling),
  `scriptNamesPorts`, and `scriptBodyDefer` — compile sloppy with the prefix, recompile strict, then
  the four marker gates over the comment-stripped text (`strippedForScan` now exported from
  jsfun.ts rather than copied).
- **plan.ts**: `ValueExpr` gains `script-out` (a live read off the handle, valid in both contexts,
  always maybe-undefined); `HandlerAction` gains `script-signal` (one call on the handle);
  `ScriptPlan` + `ComponentPlan.scripts`; `scriptPlanOf` in `statesPlanOf`'s shape (memoised,
  provisional entry before the listeners compile, `refuse` unwinds the plan, the compiled sinks and
  `translatedScriptIds`); inputs = every declared value input ∪ every wired name ∪ every authored
  literal, each resolved through `resolveExpr` and typed by **what is delivered**; listeners =
  every wired signal output through `doneChainOf`, with a pulse into a **value** port refused as
  *"consumed as a value — a pulse carries nothing to read"* before the chain compile can call it a
  chain that drives nothing; `scriptReadOf`; `compileScriptSignal`; `isTriggerInto(node, port)`
  beside `isTriggerWire` (a Script's trigger ports are the signals its own code declared, which no
  table keyed by type can list) at all six call sites; the trigger-compile loop, the handler pass
  skip, the binding pass, the registration pass beside States, and every kind switch
  (`maybeUndefinedExpr`, `exprTsType`, `exprValidIn`, `actionsValidIn`, `exprTouchesSnap`,
  `snapExpr`, `snapAction`, the session walker, `fillMaterialize`). `jsNameTaken` factored out of
  `allocJsFnName` so the definition names share the predicate.
- **component.ts**: `script-out` prints `<local>.outputs.<name>` in both modes; `script-signal`
  prints `<local>.signals.<port>()`; the binding table for a Script output at each sink (a string
  port bare, anything else through `String(x ?? '')` at a text position, a number port bare at a
  number sink, `!!` at a boolean one); the hooks after States'; the imports (`useScript` and one
  definition per node); `scriptFileSource` — `// @ts-nocheck` first, the header that says why, the
  runtime's wrapper, the prefix, the code verbatim, `defineScript<Inputs, Outputs>(label, ports, fn)`.
- **`src/emit/scriptLib.ts`** (new): `src/lib/script.ts`, shipped when any component kept a Script.
  `defineScript`, `useScript` (a ref-held instance created in the mount effect; a reducer bump on
  every output write; the listeners in a ref so the latest render's chains fire; a diff effect that
  delivers changed inputs and runs once; `signals.<k>()` queues a microtask, coalesced per name;
  unmount runs destroy and kills the node), and the three DSLs transcribed.
- **Ledger** `translated`, floor 94; the two floor pins moved.

### §52.4 What building it found

1. 🔴 **A refusal's sentence depends on which side asks first.** A pulse wired into a Text was
   refused as *"its Greeted output drives no translatable action"* — true, and the wrong sentence:
   the listener compile ran before any read could say *"consumed as a value"*. The fix is in the
   listener loop, from the sink's own port kind (its declaration, then the catalog), so the sentence
   a person reads names the mistake they made. §G pins both sentences.
2. 🔴 **The corpus control forbids a refused node in a fixture.** `in-code-markers`' false-positive
   row asserts zero preserved-script comments over every fixture; the first cut of `script-desk`
   carried the refused uploader and went red. The refused shape now lives in the spec by mutation
   and in the drive copy behind `--uploader`; the corpus stays clean, as that row demands.
3. ⚠️ **An unknown feeder has no sentence of its own.** `resolveExpr` over a `Hash` answers null with
   no `ctx.defer`; the first sentence was the bare fallback. Now the Function node's own wording:
   *"its Name input is fed by net.noodl.Hash — no statically known source in the emit vocabulary"*.
4. ⚠️ The runtime's gen-3 `change` calls `Node.Setters[key](value)` unbound and `OnInputsChanged()`
   unbound; gen 2's `setup` copies `methods` onto `this`. Transcribed as they are — a body that
   reads `this` inside a Setter gets what the runtime gives it.

### §52.5 Graded — `tests/script.test.ts` (74 rows), the gates, the arms

§A the gate: the four refusals, does-not-compile, sloppy-only, a marker in a comment, and eleven bodies
that must **not** be refused (timers, the DOM, `navigator.mediaDevices`, `fetch`, async, the clock,
randomness, `this`, module state, the four fixture bodies) · §B the ports · §C the page (golden shape:
the imports, the four hooks, the four button handlers, the four text sinks by port type) · §D the
script files (`@ts-nocheck` first, the runtime's wrapper, the prefix, every byte of the code, the
generics, the port map, the import depth, the delivered-type rule) · §E **the host run under node
through a hook harness** — refs, reducers and effects with React's ordering — gen 3's boot order and
Setters, gen 1's `change`, gen 2's `changed(new, old)` / `setOutputs` / methods, the latest listener
firing, the microtask order (a value set in the handler that pulsed is visible to the signal
function), coalescing, unmount → destroy → killed, a throw logged and swallowed, a load-time throw
leaving the node inert, undeclared outputs invisible, an unfed input reading undefined, the four
fixture bodies loading · §F the refused shape by mutation (the sentence, the four beside it
translating, the comment block, the dropped wire with its marker, the report row, the pre-flight
row with no verdict) · §G thirteen graph gates · §H the ledger (translated, no badge, floor 94) and
the pre-flight · §I the fixture and the refused variant as real `ts.Program`s · §J slot-desk ships
no host and no `src/scripts/`.

```
arms 9/9 red, all restored (md5 of the four sources unchanged after each):
  M1 the host never runs change on an input change — 3 behaviour rows (+5 typing: `&& false` breaks a narrowing in the emitted lib)
  M2 a signal function runs synchronously — 3 (the microtask-order row, coalescing, the bumper's "not yet")
  M3 a signal output never reaches the listener — 1
  M4 the gate admits the Noodl API — 5 (§A, §F ×4)
  M5 the prefix line dropped from the wrapper — 5 (§D wrapper + every verbatim row)
  M6 gen 2's changed never fires — 1 behaviour row (+5 typing, the M1 shape)
  M7 the script file is type-checked after all — 1 text row + 5 typecheck rows: `let timerId;` and `Script.Signals`
     on a `NodeApi | undefined` fail strict TS exactly as the corpus predicted
  M8 a Script nothing reads or fires is not hosted — 3 (re-armed at the value level: the first arm was
     `|| true`, which TS2872 refused and ts-jest reported as "Tests: 0 total" — the mutant-only-tsc-kills trap, again)
  M9 a hosted node's code is ALSO preserved as a comment — 2
```

### §52.6 The drive (`run-editor`, `dev:debug`, a copy of script-desk with the refused uploader registered in recents, torn down after)

- **Picker**: `Script` searched — the `Javascript2` card carries **no** export-badge dot (nor do
  Expression / Function / For Each / Map Collection beside it); the one dotted card in that result
  is `Subscribe To Changes` (Tier 3.11), and the control search `Run Tasks` shows its 14×14 dot,
  reachable, titled *"Not exportable yet — EXP-011 Tier 2.8 ro…"*. The ledger is the only list, so
  the badge left the Script card by itself (`drive15-01-picker-script.png`, `drive15-02-picker-control.png`).
- **Pre-flight**: Settings → Project → *Export as React code…* (the section is titled *Export as
  code*; s79's button-text lookup no longer matched and was replaced by a section lookup) → *18
  files — 1 page, 0 components* · *2 things will not translate* · *Pages/Home — 2 refusals* ·
  *"Uploader" (Script) — the code reads the Noodl API — the runtime-coupled tier (EXP-003 Tier B)*
  · no verdict (a Script is not a pathway type) · *Choose folder and export…* reachable
  (`drive15-03-modal.png`).
- **The write, through the real path**: the folder dialog routed through the
  `FileSystem.instance.chooseDirectory` seam, so `checkTarget` → `writeExport` → the toast ran:
  *"Exported EXP-011 Script Desk Drive — 18 files written to …/drive15-out. 2 things are left out —
  read EXPORT-REPORT.md first"* (`drive15-04-toast.png`). On disk: **18 files, every one
  byte-identical to `emitApp` over the same copy** (`compare15.ts`: same 18, diff 0) — `src/lib/script.ts`,
  the four `src/scripts/pages/Home/*Script.ts`, `Home.tsx` with four `useScript` calls, and
  `EXPORT-REPORT.md` naming the Uploader under *Nodes left out*.
- Observed again, not measured: the preview pane on this generator's copy showed *"No HOME
  component selected"* — the same observation §51.6 registered (owner NONE); both copies come from
  the same fixture generator, so the generator's project shape is the first suspect.
- ⚠️ The drive was launched twice: the first stack came up as the peer restarted the editor's
  `test:ci`, and was torn down at once rather than left idle beside a suite on a box with 80 MB
  free; the second ran after their run exited.

### §52.7 What this leaves

- **Next, in §50's order: row 3 `Run Tasks`**, then `On App Error`, `Create New Array` (design session
  first — §7.3's anonymous-Id-by-wire), `Filter Records`, `Repeater Item`, … `Sign In With` stays out.
- 🔴 **An MCP-authored Script node has no ports on disk** until the editor opens the project, and the
  running app registers only the ports on disk — so it is portless there too. Registered with its
  instrument (source read, not driven) as **§10 of P80's `UNOWNED-ROWS-TO-MEASURE.md`**, owner `NONE`.
  The export refuses such a node by name rather than hosting it portless.
- `Noodl.Files.upload` inside a Script (three of def036-dash-drive's ten) stays refused as Tier B. The
  files module (§45) is the obvious binding for a `Noodl.Files` facade in the host, the way the Visual
  Function binds `Noodl.Variables` — a later increment, not this row. Owner NONE.
- A Script whose input is fed by a Text Input's `text` is refused (*"reads a value that only exists
  inside a handler"*) — the same seam as every other hook argument; the controlled-state row is the
  place it would land. Owner NONE.
- `Use External File` is refused whole. The URL could be fetched at export time and inlined, but a
  file that changes on its server after the export would silently diverge from the app; refusing is
  the honest reading until someone asks. Owner NONE.
- A Script in a **logic-only component** falls to the early return before the registration pass and
  keeps `logic node (Javascript2)` with its code in the report's `preservedScripts` (§28) — the same
  as every hook-hosted node there. Not a regression; noted.
- Recorded divergences of the host (in its own header): delivery on `!==` rather than on every
  upstream publish; a signal's function in a microtask (React flushes a discrete event's render and
  its effects synchronously before it, so an input set in the same handler is visible — §E pins that
  order under the harness, not under React itself); throws to the console only.
- A `Script` is not an `isPathwayType`, so a refused one produces no cascade verdict even when it
  silences a pathway behind it (the uploader shape: its `Done` chain into a record verb). Whether the
  escape hatch should count as a pathway is a §50.2 question; owner NONE.

## §53 Tier 2.8 row 3 — `Run Tasks`: hosted on both sides, the way the runtime runs it (session 81, 2026-09-03)

The third row of §50's list. Picker **94 → 95 of 127 (74.8%)**, floor 95, `export-ledger:check` OK
(102 translated). The type id is `RunTasks`; `Run Tasks` is its display name — and §5.7's
`foreachTemplateHosts` branch matched the *display* name and read a `template` parameter the node
never carries (`taskTemplate`), so that branch had never fired. Fixed and pinned here (M9).

### §53.1 What the runtime does, and what that decides

- **A component instance per item, a contract by name, no wire.** `runtasks.ts` `run()` (through a
  serial operation queue): a `Do` while running is `Unchanged`; no template, no items, or Max Running
  Tasks below 1 is `Failure` (raised on the error channel — `run-tasks/no-template`, `no-items`,
  `invalid-concurrency`); an empty list is `Done`; otherwise up to Max Running Tasks start.
  `startTask` → `createTaskComponent`: `modelScope.create(item)` (`Model.get(item.id)`, so the model id
  is the item's own `id` when it has one), `createNode(template, guid(), {_forEachModel, _forEachNode})`,
  `Id`/`id` inputs set to the model id when declared, every template input whose `model.data[key] !==
  undefined` set, `creatorCallbacks.onOutputChanged` watching for a false→true edge on the template's
  outputs, then the start input pulsed once. A template with neither success nor failure output ends
  the run as failed (`run-tasks/no-completion-output`). `itemOutputSignalTriggered` matches the success
  and failure names as strings; `checkDone` is the six terminal paths (aborted → `aborted` then
  `Done`; all completed → `Done`/`Failure`; stop-on-failure → `aborted` then `Failure`; else the next
  queued task). `abort()` with nothing running is `Unchanged` and sends no `aborted`. `_endRun` sends
  the outcome then `Completed` **per token** — the run's `Do` pulses, then the `Abort` pulses it
  honoured, which are `Done` however the run ended — so an honoured abort reads `aborted, done,
  completed, done, completed`.
- **The contract names are parameters** (`runtasks-template-contract.ts`): `taskStartInput` /
  `taskSuccessOutput` / `taskFailureOutput` / `taskErrorOutput`, `allowEditOnly`, defaults
  `Do`/`Success`/`Failure`/`Error`, an empty name falling back to the default.
- **The template is a logic-only component** — `Component Inputs` declaring the start port and the
  item fields, `Component Outputs` declaring the two signals — and before this row a logic-only
  component emitted **no file** (`plan.ts`'s early return, "no visual root — logic-only components defer
  to EXP-003"), a `Component Inputs` signal port was a declared prop nothing consumed
  (COMPONENT-OUTPUTS-TARGET §6), and a wire off it into a trigger was dropped as "the trigger is not a
  rendered element event or a receiver".
- **The corpus**: three instances, all inside `__cloud__` components of def036-dash-drive (cloud
  functions, not this exporter's surface): a Function's `out-MappedArray` into `items`, a template of
  record verbs and cloud calls with a nested Run Tasks of its own, and **every contract port typed `*`**
  (the MCP's spelling), which parse reads as kind `value`. Frontend instances: none — the ranking is
  Richard's, the corpus the regression net.

So the faithful target hosts **both sides**: the template becomes a React component that renders
`null` and runs its start-input chain **once, in a mount effect** (that is exactly `startTask`'s pulse,
right after `createNode`; a ref guards StrictMode's second mount), with its Component Outputs as the
callback props it already had; the host calls `useRunTasks(label, { maxRunningTasks, stopOnFailure },
listeners)` from `src/lib/runTasks.ts` (a transcription of the state machine above) and renders one
template element per task in flight as the last child of its root container — `<Notify key={task.key}
name={task.item.name} onSuccess={task.succeed} onFailure={task.fail} />`. The contract stays by name, as
the runtime's is.

### §53.2 What was measured before anything was built (`probe16-reverted.log`, HEAD 7d651798)

Fixture `tests/fixtures/batch-desk`: `Pages/Home` (a String → a pure Function mapping names to
`{ name }` objects → `items`; two buttons into `Do` and `Abort`; `done`/`failure`/`aborted` into three
`Set Variable`s of `status`, two Texts on the `status` and `lastSent` Variables) and `Notify` (Component
Inputs `Do`: signal, `name`: string; Component Outputs `Success`, `Failure`: signal; `Do` → a Cloud
Function `notify` with `in-name`; `done` → `Success` and a `Set Variable lastSent ← name`; `failure` →
`Failure`).

- `sendAll` fell to `logic node (RunTasks)`; **one root, eight silenced** (the three setters, their three
  constants, the Function and its constant — all `causedBy: ['sendAll']`); the two click wires read
  "no deterministic translation in step 5", the three chain wires "the trigger is not a rendered element
  event or a receiver". `Notify` skipped as logic-only with four refusals of its own (its Component
  Inputs a second root; the Cloud Function `pathway: true`, so the pre-flight carried a verdict about it).
- Emitted: `Home.tsx` with two handler-less buttons and the Function's body preserved as a comment; no
  `Notify.tsx`, no `functions.ts`.

### §53.3 The build

- **`plan.ts`**: `RUN_TASKS_TYPE`, `RUN_TASKS_OUTPUTS`, `RUN_TASKS_CONTRACT` (+ `OWN_CHAIN_OUTPUTS`);
  `RunTasksAction` (`runtasks-run` carrying the items expression, read **at the pulse** — the runtime
  reads the last delivered `items` at `run()` — and `runtasks-abort`); `RunTasksPlan` and `TaskPlan`
  (`ComponentPlan.runTasks`, `.task`, `.taskRefusal`); **`planProject` orders the plans** — every
  template before the components that name it, deepest first, a template cycle named and every Run
  Tasks pointing into it refused; `planComponent` takes `plannedByLegacy` + `templateCycle`; the
  logic-only early return became `bailAsLogicOnly`, and a component some Run Tasks names statically goes
  on **without a root** to a file in `components/` (`plan.task` provisional, hosts disagreeing on the
  start name refused there); the template compile before the trigger pass — `doneChainOf(inputsNode,
  start)`, all-or-nothing, validated in the render context, snapshotted, collapsed into the Component
  Inputs node; on refusal the component bails with the reason on `taskRefusal` for every host to repeat;
  `isTriggerWire` (run/abort), the pre-compile loop, `compileSink` → `compileRunTasks`;
  `runTasksPlanOf` in `scriptPlanOf`'s shape (memoised, `refuse` unwinds), its checks **in `run()`'s
  own order** — Do wired, Template wired / missing / not in the project / on a cycle, a wired contract
  name, the template's root, the start port declared and signal-kind, success/failure declared and
  signal-kind, the template's chain, the host's root a container, Items wired once and list-typed, the
  config (literal or a render read; a literal Max below 1 refused), every consumed output one of the
  five, then the listeners (a pulse into a value port refused before the chain compile, §52.4's rule);
  the four action switches; the session walker and `fillMaterialize` over the config, the listeners
  and the start chain; the **attachment sweep** over the same (§53.4.1); a verdict sweep for an unfired
  Run Tasks; the `foreachTemplateHosts` fix.
- **`component.ts`**: the gate admits a file without a root when `plan.task` is set; `collectActionUse`,
  `allActions`, `hookExprSources`, `chainReadsChainLocal`, `actionCode`, `actionExprsOf`; the lib import;
  the hook line after the Script hooks; the mount effect (`started` ref, `effectBody`, empty deps with
  the eslint note); `runTasksJsx` (the template through `requireInstance`, props by identity from
  `task.item` — a field the list is statically known not to carry dropped and named, as the repeater
  does — `Id`/`id` from `task.id`, the two callbacks) rendered after the root's children beside the popup
  slots, or as a fragment when the host is itself a rootless template; `return null` for a template
  with nothing to render.
- **`src/emit/runTasksLib.ts`** (new): `src/lib/runTasks.ts`, shipped when any component keeps a Run
  Tasks — `useRunTasks<Item = Record<string, any>>(label, config, on)`: a ref-held instance, a reducer
  bump on every change of the tasks in flight, listeners and config in refs (read live, as `_internal`
  is), `run`/`abort`/`tasks` on a stable handle; `TaskInstance` = `key`, `id` (the item's own `id`, else
  generated — `Model.create`), `index`, `item`, `succeed`, `fail`; unmount kills the run.
- **`emitApp.ts`**: the lib file. **Ledger** `translated`, floor 95.
- **Moved rows**: `cascade.test.ts` — the task-desk root's reason is the no-template sentence now
  (the root, the 1 + 5, the verdict and the README step are unchanged), and `sync` reads "its Call is
  never fired by a translatable trigger" (its wire is a chain output the registration owns);
  `array-vocabulary.test.ts` — the §5.7 row spells `RunTasks` + `taskTemplate`, and is the M9 pin.

### §53.4 What building it found

1. 🔴 **The attachment sweep is a second walker, and it did not see the new owners.** The first
   `Notify.tsx` printed `await callNotifyGuest(…)` with no import and `setnotifyGuestError(…)` with
   no row: `scanActions` walks handlers, change handlers, receivers, the effects and the States/animate
   listeners to decide which requests keep their api export and their rows, and a template's start
   chain — or a Run Tasks' listener chains — was in none of them. §40.2's shape exactly, one owner over.
   Fixed; the §B row pins `cloudCalls` and the `cloud-error` row on the template plan.
2. ⚠️ **An honoured abort fires `Done` twice**, not only `Completed` twice — `_endRun` sends the
   outcome then Completed per token, and the abort token's outcome is `Done`. The prediction said
   "Completed ×2"; the transcription was right and the spec row moved to what the runtime does.
3. ⚠️ **Two roots, not one, once the template is skipped.** With the host refused, the template is an
   ordinary logic-only skip again, and its Component Inputs is a root of its own with three silenced
   nodes and a pathway verdict (the Cloud Function). Predicted 1 root and no verdict; the reverted probe
   already showed both. The refused-shape rows assert what the export actually says.
4. ⚠️ `component.ts` walks `plan.scripts` in neither `allActions` nor `hookExprSources` (found while
   adding the Run Tasks walks); the fixture's Script inputs are constants, so §52's rows never tripped it.
   Registered in §53.7, not fixed here.
5. 🔴 **The editor's `test:ci` webpack typechecks this package's tests.** A peer's run went red on two
   TS2532/TS18048 lines in the new spec while both editor `tsc` runs read 0 — `tsc -p noodl-editor`
   excludes a sibling's tests, the test-CI webpack reaches them through `CodeExportModal.tsx` →
   `nodegx-export/src/index.ts`. A half-written spec in this package reddens the editor gate for everyone.

### §53.5 Graded — `tests/run-tasks.test.ts` (67 rows), the gates, the arms

§A the host plan · §B the template plan (incl. the attachment sweep) · §C the emitted page (the golden
tasks block, last child) · §D the emitted template (`return null`, the once-guarded mount effect, the
try/catch, the Error row, the export) · §E **the library under a hook harness** — bounded concurrency,
keys and ids, Do-while-running, the empty list, the items setter's three cases, Max below 1,
stop-on-failure, failure without it, abort idle / in flight / while aborting, a late or double report,
the config read live, unmount, the stable handle · §F twenty refused shapes by mutation, each sentence
exact, the root and the cascade · §G the pre-flight and the report · §H the ledger · §I three variants as
real `ts.Program`s (the fixture; `Id`/`id` inputs and a wired Max; the refused shape) · §J the controls.

```
packages/nodegx-export: tsc 0 · run-tasks.test.ts 67/67 · export-ledger:check OK (102 translated) · picker 95/127, --check exit 0
arms 10/10 red, all restored (md5 of the three sources unchanged after each):
  M1 the lib starts every task at once — 4 · M2 stop-on-failure never stops — 2 · M3 `aborted` after the outcome — 2
  M4 `completed` never fires — 8 · M5 the mount effect never runs the chain — 1 · M6 the host binds no item fields — 1
  M7 the no-template refusal reads the items sentence — 5 (incl. cascade.test.ts; the first arm, a type-narrowing mutation,
     was a COMPILER kill: "Tests: 0 total", re-armed at the sentence level) · M8 an abort-only node is hosted — 1
  M9 `foreachTemplateHosts` reads `template` — 1 · M9b it matches the display name `'Run Tasks'` — 1
  (an unconditional pre-compile of unfired nodes, M8b, is an EQUIVALENT mutant — the refusal sets no disposition and the
   verdict sweep names the node either way — dropped, not counted)
gates (one at a time, behind a wait-for-quiet loop): pkg tsc 0 · jest 65 files (65 on disk) 2066 rows, exit 0 · editor tsc -p noodl-editor --noEmit 0 (11.6 s real — s80 read 14 s; NOT the gate that saw the spec's two type errors, see §53.4.5) · export-ledger:check OK 102 translated · picker 95/127 --check exit 0 · three floor pins moved (animation-pair B18, object-store D6, script §H) and cascade's task-desk list length 7 → 8 (the named refusal's wire note + sync's own verdict note)
```

### §53.6 The drive

(`run-editor`, `dev:debug`, a copy of batch-desk registered in recents, torn down after — `drive16.sh`, `drive16b.sh`)

- **Picker**: `Run Tasks` searched — the `RunTasks` card carries **no** export-badge dot (`dot: null`); the control search
  `Sign In With` shows its 14×14 dot, reachable, titled *"Not exportable — until provider sign-in …"*
  (`drive16-01-picker-runtasks.png`, `drive16-02-picker-control.png`). The ledger is the only list, so the badge left
  the card by itself.
- **Pre-flight**: Settings → Project → *Export as React code…* (found by its section this time — the text lookup s80 kept
  in `settings15.js` returned nothing, the seam `window.__drv.route` must be installed by `patchfs` FIRST) → *16 files —
  1 page, 1 component, plus the app shell, styles and build config* · *Everything translates. No node, wire or parameter is
  left out.* · *Choose folder and export…* reachable (`drive16-03-modal.png`). No cascade, no verdict, no rows.
- **The write, through the real path**: the folder dialog routed through the `FileSystem.instance.chooseDirectory` seam, so
  `checkTarget` → `writeExport` → the toast ran: *"Exported EXP-011 Batch Desk Drive — 16 files written to …/drive16-out.
  Everything translated — EXPORT-REPORT.md says how to build and run it"* (`drive16-04-toast.png`). On disk: **16 files,
  every one byte-identical to `emitApp` over the same copy** (`compare16.ts`: same 16, diff 0) — `src/lib/runTasks.ts`,
  `src/components/Notify.tsx`, `src/api/functions.ts`, `Home.tsx` with one `useRunTasks` and the tasks block.
- Not driven: the exported app running in a browser (the cloud function has no backend here — it answers the interpreter's
  own "No cloud services defined" failure, so a real run would mount three `Notify`s two at a time, each reporting Failure,
  `aborted` then `failure` under Stop On Failure). The library's behaviour is graded under the hook harness (§E), not in
  a browser. Owner NONE.
- ⚠️ The drive ran while a peer's editor `test:ci` was in flight earlier in the session — the first mutant of the arms chain
  killed their webpack once (§53.4.5); the box was handed back and forth by message after that, and every gate above ran
  alone.

### §53.7 What this leaves

- **Next, in §50's order: row 4 `On App Error`**, then `Create New Array` (design session first — §7.3's
  anonymous-Id-by-wire), `Filter Records`, `Repeater Item`, … `Sign In With` stays out.
- A template's **error value output** (the contract's `taskErrorOutput`) is not read: the runtime reads
  it off the dying node into `run-tasks/task-failed`; the host has no value channel from the element, so
  the console report carries the index only. The lifted-value-output rail (CONTROLLED-STATE §4d) is where
  it would land. Owner NONE.
- **A contract port typed `*`** (every corpus instance — the MCP writes `*`) is refused with the fix
  named; the MCP could write `signal` for a Component Inputs/Outputs port that only signal wires touch.
  Owner NONE (P82/MCP).
- A Run Tasks whose **host root is not a container** (a Text root) is refused with the popups rule; a
  fragment root would serve both. Untested row — no fixture has such a host. Owner NONE.
- `component.ts` does not walk `plan.scripts` in `allActions`/`hookExprSources` (§53.4.4). Owner P18.
- A `Run Tasks` is not an `isPathwayType` (§52.7's question, one node over): a refused one silences its
  chains without a verdict of its own; the verdict comes from what it silences. Owner NONE.
- The nested shape the corpus uses (a Run Tasks inside a template) is planned and rendered as a fragment
  of tasks; untested beyond the cycle row. Owner NONE.

## §54 Tier 2.8 row 4 — `On App Error`: the channel, the boundary, and the shell that had nowhere to put it (session 82, 2026-09-03)

The fourth row of §50's list. Picker **95 → 96 of 127 (75.6%)**, floor 96, `export-ledger:check` OK
(103 translated). The type id IS the display name (`On App Error`). The corpus has **zero** instances
(grep over every `NodeGX test project` and the templates); the ranking is Richard's (§50) and the design
is the runtime's.

### §54.1 What the runtime does, and what that decides

- **The channel** (`runtimeerror.ts`): one synchronous bus per context; `raise` returns at once with no
  subscribers; the subscriber list is cloned before the loop (a subscriber may unsubscribe during
  delivery); a throwing subscriber is logged and the rest still run; `MAX_DELIVERY_DEPTH = 2` — a raise
  while delivering at depth ≥ 2 is dropped with *"runtime error raised while delivering another; dropped"*.
  Every deployed context installs `createConsoleErrorSubscriber`: one structured line per failure, so a
  failure is never fully silent even in an app where nobody wired a Failure output.
- **The raise** (`Node.raiseRuntimeError`): provenance is filled by the runtime — `nodeId` (graph id),
  `componentName` (the legacy path, `/Pages/Home`), `nodeType` (the **type id**, `CloudFunction2`); `code`
  is the matchable half, `message` the human half. `reportOutcome(token, 'failure', …)` raises **before** the
  `failure` pulse ("a graph wiring failure → show must already be able to read the reason"), and every
  `setError` funnel flags its `Error` value dirty before that — so the order is: the Error value, the raise
  (the boundaries), the Failure pulse.
- **The boundary** (`onapperror.ts`): subscribes in `initialize`, before any input update — "errors raised
  while the graph is still being built are exactly the ones an author has the hardest time seeing";
  accepts an event when `code.indexOf(filter) === 0` (a **prefix**; empty or unset means everything;
  the setter is `undefined`/`null` → cleared, anything else `String(value)`); flags the six value outputs
  dirty and THEN pulses `Error` — values before the signal, always; **multiple instances all fire** — no
  claiming, no consumption. An instance in a page exists only while the page does.
- **The codes the translated families raise**, read from each node file: `cloud-function/call-failed`;
  `record/storage-op-failed` (the three record verbs AND `Record`'s Fetch, "Missing Record Id" and
  "Missing Id." included); `user/log-in-failed`, `user/log-out-failed`, `user/sign-up-failed`,
  `user/set-properties-failed`, `user/request-magic-link-failed`; `open-file-picker/open-failed`;
  `upload-file/upload-failed`; `sign-file-url/sign-failed`; `http/no-url`, `http/error-status`,
  `http/timeout`, `http/network-error`; `run-tasks/already-running`, `no-items`, `invalid-concurrency`,
  `task-failed`; `script/source-failed` (a Script's phase throws are `console.log` + an editor warning
  only — NOT on the bus); `function/script-threw`, `expression/threw` (the pure wrappers). `External Link`
  and `Navigate` raise nothing.

So the faithful target is **two things, not one**: `src/lib/errors.ts` — the channel transcribed
(`raiseAppError`, `subscribeAppErrors`, the depth guard, the throwing-subscriber isolation, the console
default installed at module load) with `useAppError({ filter }, onError)` over it (a stable handle whose
`last` reads a ref; a reducer bump on every accepted error BEFORE the listener; the Filter read live and
coerced as the setter coerces; armed in a **layout effect**, which runs before every passive effect in the
tree — the requests, a Script's mount, a template's start chain — the closest a hook comes to subscribing
at node creation) — and **the raise at every site the runtime raises**: each request verb's failure arm
now prints, after the Error row and before the failure chain,
`raiseAppError({ code, message, nodeId, nodeType, componentName })` with the node's own provenance; the
Run Tasks host's four diagnostics and a Script's load failure go through the same call (their hooks now
carry `{ label, nodeId, componentName }` and a definition's `at`); the http module throws an `HttpError`
whose `code` is the node's (no-url / timeout / network) so the catch can report it, and a non-2xx answer
reports `http/error-status` with the status. A boundary that hears nothing would be a boundary over an
empty bus — the raise sites are the row.

### §54.2 What was measured before anything was built (`probe17-reverted.log`, HEAD d4d3400c)

Fixture `tests/fixtures/alarm-desk`: `App` — the Router and `Catch all` (no filter) → `Error` → two
`Set Variable`s reading its `Message` and `Code`; `Pages/Home` — a `Cloud Function` "Ping" on a button
(no backend: it fails with the interpreter's own sentence), three Texts on the Variables, `Cloud only`
(`filter: cloud-function`) → `Error` → a `Set Variable` reading `Node Type`, and a Text bound **directly**
to `Cloud only.message`.

- `App`: *router shell — emitted as src/App.tsx by the scaffold*; `Catch all` and both setters `node
  beside the router shell`, the setters `causedBy: ['catchAll']` (EXP-013 attributed them by graph).
- `Pages/Home`: `Cloud only` → `logic node (On App Error)`; the setter *the value wire has no statically
  known source* (I predicted the trigger sentence — the value wire is asked first); the direct Text
  emitted **empty** with a step-5 note; the Cloud Function translated and its failure wrote a row and
  **told nobody** — no console line, no raise.
- Pre-flight: two roots, both `pathway: true`, three silenced; verdict *"…"Catch all" (On App Error) in
  `App`; "Cloud only" (On App Error) in `Pages/Home`. Without them, the app has no error pathway."*

### §54.3 The build

- **`src/emit/errorsLib.ts`** (new): `src/lib/errors.ts` as above. Shipped when any component keeps a
  boundary or raises, and whenever `script.ts` or `runTasks.ts` ships (both import it) — so every app with
  a request verb now carries it (batch-desk 16 → 17 files, script-desk 18 → 19).
- **`plan.ts`**: `ON_APP_ERROR_TYPE`, `ON_APP_ERROR_VALUE_OUTPUTS`, `APP_ERROR_TS_TYPE` (the Error Object
  spelled structurally so a store row needs no import); `ValueExpr` gains `app-error-out { field }` (always
  maybe-undefined, valid in both contexts, touches no snapshot); `AppErrorPlan` on `ComponentPlan.appErrors`;
  `appErrorPlanOf` in `scriptPlanOf`'s shape (memoised, `refuse` unwinds): no file to host it, two wires on
  Filter, an unknown input or output, `Error` consumed as a value (from the sink's port kind BEFORE the chain
  compiles — §52.4's rule), a chain that reads handler-only values, a chain that did not compile;
  `appErrorReadOf`; the `resolveExpr` branch; `[ON_APP_ERROR_TYPE]: ['error']` in `OWN_CHAIN_OUTPUTS`;
  the binding pass's whitelist (`isAppErrorRead`); the registration pass; **both walkers** (`scanActions`,
  the session walker) and `fillMaterialize` over the listener and a wired Filter; the five expression
  switches; **the shell**: a root component with a Router AND a boundary keeps a file
  (`components/<Name>Shell.tsx`, deduped) with `rootId === null` and `plan.shell = true` — only the Router
  is disposed there; what no chain reaches is still "beside the router shell" via the catch-all;
  `bailAsLogicOnly` names a boundary in a logic-only component "component emits no file to host the boundary".
- **`component.ts`**: the gate admits the shell; `raiseLine` / `errorCodeOf` / `API_CALL_ERROR_CODES` /
  `RAISING_ACTION_KINDS`; the six catch sites (api-call's inline setter became a `<state>Message` local so
  the raise can read it; http's `failArm` takes the code and, for the `!ok` arm, the status as `detail`
  and `?? ''` on a message the one-interface answer types optional); `allActions` and the imports; the hook
  line after the Run Tasks hooks; `app-error-out` in `maybeUndefined`, `exprCode`, the deps walk, the
  binding table (the Error Object at a text position takes `JSON.stringify` — NDA-014's object → string
  cast); `useRunTasks({ label, nodeId, componentName }, …)`; `defineScript(…, at)`.
- **`emitApp.ts`**: the lib; `emitScaffold(ir, shell)`; the `HttpError` class and its three throw sites.
  **`scaffold.ts`**: `ScaffoldShell`; `App.tsx` imports the shell and renders `<AppShell />` as the first
  child of `BrowserRouter`, before `<Routes>` — inside the router (a Navigate in its chain works), outside
  the routes (it lives for the app's life). **`runTasksLib.ts`**: the four `console.error`s are raises;
  **`scriptLib.ts`**: the load failure raises `script/source-failed`; the phase throws stay console.
- **Ledger** `translated`, floor 96. `logic.test.ts`'s corpus control (no template literal, no unlisted
  `if (` in generated code) now excludes `src/lib/` **by kind**, as it excludes `.md` — the channel is the
  first lib the puppy fixture ships, and its `if (index !== -1)` is the runtime's own idiom, not translation.

### §54.4 What building it found

1. 🔴 **A subscriber has no trigger side, so nothing registered it before a pass that reads it.** The
   first build refused both boundaries as *"its trigger chain is cyclic"*: the dropped-wire pass explains
   an unconsumed value wire by compiling its sink (`compiledOf(setLastError, 'do')`), the sink's value
   read (`Catch all.message`) registered the boundary from inside that compile, the registration compiled
   the listener, and the listener's chain re-entered the same key. A `Script` never sees this because
   its wired signal INPUT registers it in the early trigger-compile loop, before any read. The fix is
   the same loop: a boundary registers there unconditionally — that loop is its trigger side.
2. ⚠️ **The prediction file said "reads a value that only exists inside a handler" for a Filter fed by a
   Text Input; the export says "has no statically known source".** The controlled-state seam that hosts a
   hook argument fed by a text input (`files.test.ts` B13) runs after the boundary registers, so the read
   answers null with no reason of its own. The refusal is right; the sentence and the seam are §54.7's.
3. ⚠️ **A wired Filter of unknown type failed the emitted app's own `tsc`** (a Variable's `useValue` is
   `unknown`; the option was `string`). The runtime's setter coerces — `undefined`/`null` clear, else
   `String(value)` — so the hook does exactly that and takes `unknown`; the emitted line stays `{ filter: code }`.
4. ⚠️ **The http answer types `error` optional** (one interface serves both outcomes) — the `!ok` arm's
   raise needed `?? ''` to compile, though the module writes `error` on every failed answer. The union
   type is the honest fix; registered.
5. ⚠️ **`json.dumps` rewrote the ledger with 115 spurious lines** — the file is `ensure_ascii` (`—`),
   and the first write used the default. Diff was 4 lines once written faithfully. *Read the file's own
   escaping before writing it back.*
6. ⚠️ **A `repr()`'d raise line inside a single-quoted spec literal killed three suites** ("Cannot find
   name 'cloud'") — the quotes were the string's. The rows moved by hand, escaped.
7. ⚠️ The receiver-sentence prediction for a boundary in a logic-only component held ("component emits
   no file to host the boundary"), because `bailAsLogicOnly` runs before any registration; it is the one
   place that names the node without the plan.

### §54.5 Graded — `tests/on-app-error.test.ts` (41 rows), the gates, the arms

§A the plan (the shell kept, both boundaries, the direct binding, the six outputs, the Error Object's
structural type) · §B the shell (`App.tsx` renders it first inside the router; the hook, the stores,
`return null`; the report row) · §C the page (both halves imported; the hook line; the direct read;
the raise between the row and the chain; the JSON cast, the truthiness sink) · §D the channel's text ·
§E **the channel under a hook harness** — never silent, `last` before the listener, the prefix filter and
the empty one, every boundary fires, unmount unsubscribes, a throwing listener isolated, one level of
re-entry delivered and the second dropped, a clone before the loop, the Filter read live · §F six refused
shapes by mutation and the wired-Filter variant · §G the report and the pre-flight · §H the ledger · §I
the fixture and the shell-less control as real `ts.Program`s · §J the controls (slot-desk ships no
channel; batch-desk and script-desk do through their libs; quote-desk's `HttpError` and both arms; the
Function wrapper still `console.error`s).

Moved rows: the 13 catch-block goldens in seven specs (`cloud-function`, `record`, `record-verbs`,
`user-family`, `files`, `set-user-properties-magic-link`, `run-tasks` §D), the Run Tasks and Script
loaders (they serve `./errors` as a recording stub, and the four console-spy rows became raised-event
rows asserting cardinality), the `useRunTasks` golden, the `defineScript` tail, four floor pins.

```
packages/nodegx-export: tsc 0 · on-app-error.test.ts 41/41 · jest 66 files (66 on disk) 2125 rows, exit 0
noodl-editor: tsc -p tsconfig.json --noEmit 0 (16.3 s real)
export-ledger:check OK — 176 types, 103 translated · picker 96/127 (75.6%), floor 96, --check exit 0
emitted apps typecheck (real ts.Program): alarm-desk 16 files, batch-desk 17, script-desk 19, call-desk 17 — 0 diagnostics
arms 13/13 red, all restored (md5 of the five sources unchanged after each; one 5-file jest run per arm — on-app-error, run-tasks, cloud-function, scaffold, script):
  M1 the Filter never filters — 3 · M2 the listener runs BEFORE the values — 2 · M3 the depth guard off — 2 · M4 a throwing subscriber
  stops the rest — 2 · M5 unmount never unsubscribes — 1 · M6 the four catch sites no longer raise — 4 (three suites) · M7 the shell is
  never kept — 8 · M8 the early registration gone (the cycle returns) — 13 · M9 Error-as-a-value unchecked — 1 · M10 the console
  default not installed — 3 (its first anchor was the template-literal spelling; re-armed on the concatenation) · M11 the Run Tasks
  host raises the display name — 2 · M12 the Filter not coerced — 1 (the emitted app's tsc) · M14 App.tsx never renders the shell — 1
```

### §54.6 The drive

(`run-editor`, `dev:debug`, a copy of alarm-desk registered in recents, torn down after — `drive17.sh` for the picker,
`drive17c.sh` for the export; the box was handed to a peer between the arms and the drive by message.)

- **Picker**: `On App Error` searched — the card carries **no** export-badge dot (`dot: null`); the control search
  `Sign In With` shows its 14×14 dot, reachable, titled *"Not exportable — until provider sign-in …"*
  (`drive17-01-picker-onapperror.png`, `drive17-02-picker-control.png`). The ledger is the only list.
- **Pre-flight**: Settings → Project (through the route seam — `patchfs17.js` installs it, so it runs FIRST; the
  section lookup alone finds nothing until the panel is open, which cost one pass) → *Export as React code…* →
  *16 files — 1 page, 1 component, plus the app shell, styles and build config* · *Everything translates. No node,
  wire or parameter is left out.* · no verdict, no cascade, no rows (`drive17-03-modal.png`). The "1 component" is
  the shell.
- **The write, through the real path**: the folder dialog routed through the `FileSystem.instance.chooseDirectory`
  seam → `checkTarget` → `writeExport` → the toast: *"Exported EXP-011 Alarm Desk Drive — 16 files written to
  …/drive17-out. Everything translated — EXPORT-REPORT.md says how to build and run it"* (`drive17-04-toast.png`).
  On disk: **16 files, every one byte-identical to `emitApp` over the same copy** (`compare17.ts`: same 16, diff 0)
  — `src/lib/errors.ts`, `src/components/AppShell.tsx`, `src/App.tsx` rendering `<AppShell />`, `Home.tsx` with one
  `useAppError` and one `raiseAppError`.
- Not driven: the exported app in a browser (the cloud function answers the interpreter's "No cloud services
  defined" failure; a real run would raise `cloud-function/call-failed` once, both boundaries would hear it, the
  shell's chain would write `lastError`/`lastCode`, the page's `cloudType` = `CloudFunction2`, and the direct Text
  would show the message). The channel's behaviour is graded under the hook harness (§E). Owner NONE.
- ⚠️ `EXPORT-REPORT.md` does not name `On App Error` when everything translates — expected (the report names
  what was left out), and different from §53's report, which named Run Tasks in a note.

### §54.7 What this leaves

- **Next, in §50's order: row 5 `Create New Array` — a design session first** (§7.3's anonymous-Id-by-wire; the
  named-array model keys on a literal name), then `Filter Records`, `Repeater Item`, the streaming trio, … `Sign
  In With` stays out.
- The http answer types `error` optional (one interface for both outcomes); the `!ok` arm's raise carries `?? ''`.
  A discriminated union (`ok: true | ok: false & error: string`) is the honest fix and moves the http goldens.
  Owner NONE.
- A Filter fed by a **Text Input** is refused with the fallback sentence ("has no statically known source"): the
  boundary registers before the controlled-state seam that hosts a hook argument fed by a text input (files
  B13). The seam would host it; the sentence would then be the precise one. Owner NONE.
- **Function / Expression throws are NOT on the bus** (the runtime raises `function/script-threw`,
  `expression/threw`): the pure wrapper recomputes per render, and a raise per render through a chain that sets
  state is a render loop. Memoising the wrapper per input tuple (`useMemo` per call site) is the precondition —
  then the raise is once per computation, the runtime's own cadence. Owner NONE.
- A **Query Records** failure has no emitted catch site at all (the query effects have no failure handling —
  pre-existing, §54.1 lists its code `query-records/query-failed`). Owner NONE.
- `image/load-failed`: the emitted `<img>` has no `onError`. Owner NONE.
- A boundary in a logic-only component nothing mounts is refused ("component emits no file to host the
  boundary"); a task template hosts one per task instance, which is the runtime's own shape. Untested row.
  Owner NONE.
- The shell's `docComment` and header say *"visual"* (`GENERATED_TS`); cosmetic. Owner NONE.

## §55 Tier 2.8 row 5 — `Create New Array`: the handle is the id (session 83, 2026-09-03)

### §55.0 The design, written before any code — what a wire-fed Array Id means in the emitted app

§7.3 recorded the node as *deliberately out of scope* because "the only consumer of that Id is another
node's Array Id, by wire — which is precisely what has no emitted module, since the named-array model keys
on a literal name". §50 reversed the ruling and asked for a design session first. This is it, and the
answer is that the sentence was measuring the wrong thing: **the Id is not a string the exported app has
to resolve. It is a name for the array the wire points at, and the wire is static.**

**What the runtime does** (`collectionnode-new.ts`, `collection.ts:764`, `collection-failure.ts`,
`collectionnode2.ts`, read not guessed):

- `Do` (port `new`) schedules; after inputs settle: `Collection.get()` with no name mints a **fresh
  anonymous collection under a random guid** in the weak registry; if anything ever arrived on `items`
  (`sourceCollection !== undefined`) it is copied in once — `collection.set(source)`, a snapshot, not a
  link; `setCollection` flags `id` dirty; then `done`, then `completed`. **Every Do mints another
  array.** No `Failure`, no `Unchanged` — the node's own comment says a port that cannot fire is worse
  than none. `id` is `undefined` until the first Do.
- The consumers of `id`: `Array` (`Collection2.collectionId`, whose setter calls
  `Collection.get(id)` — which `take`s the anonymous collection out of the weak registry and **promotes
  it to the named table: the same array object**), and the three mutators (`resolveCollectionId` →
  the same `Collection.get(id)`). An `Array` bound by wire rebinds on every new id
  (`shouldRunOnValueChanged('collectionId', …)` — unless the author unticks Run On Value Change, after
  which only `Fetch` rebinds). Before the first Do the `Array` has **no collection**: `items`
  answers `undefined`, `count` 0, and a mutator's Do answers `Failure` `<prefix>/no-array` ("Nothing to
  insert — no array is bound. Set the Array Id input, or connect one, before triggering this node."),
  raised on §54's channel before the pulse.
- The corpus: **0 instances** in every project on disk (`grep -rl '"CollectionNew"' --include=project.json`
  over `~/vscode_projects`). The catalog's own example (`docs/node-catalog/examples/data-run-tasks-batch.json`)
  is the batch shape: `Do` → mint → `id` → an `Array` → `items` → `Run Tasks`. The enrichment doc's
  *whenToUse* is the product surface: *"an anonymous or per-instance array instead of one fixed
  well-known id — snapshotting a live array before batch-processing it, or a sub-array whose id you store
  on an object"*. The per-instance list — mint on the page, insert by wire, repeat by wire — is the shape a
  person builds when a named `Array` would be shared by every instance of the component.

**What the emitted app does — a handle in a state row, never a string.**

1. **The mint is a state row holding a collection handle.** A `Create New Array` whose Do is fired by a
   translatable trigger allocates `const [snapshot, setSnapshot] = useState<Collection<T> | null>(null)`
   (`allocStateVar`, origin `'array'`, boot `null` — the runtime's `id` is `undefined` until the first Do,
   and a handle minted at mount would be a phantom array an Insert could succeed into where the interpreter
   answers Failure). The Do compiles to an action `array-new`: `const snapshotNew = collection<T>([...src]);
   setSnapshot(snapshotNew); <Done chain>` — the `[...src]` because `Collection`'s constructor slices but a
   later `.add` on the same reference must not reach the source (the runtime copies too: `set` builds its own
   list). With `items` unwired the literal is `[]`. The Done chain reads the handle through the **local**
   (`mintChainScope`, the id nodes' Done-arm rule, §37): `setSnapshot` does not change `snapshot` in this
   closure, and the chain must see the array it just made. Outside the chain every read is the **row**.
2. **`id` is the handle.** The only ports that can take it are the Array Id ports (`collectionId`) of
   `Array`, `Insert Object Into Array`, `Remove Object From Array` and `Clear Array` in the same component.
   A node's array is resolved by one function, `arrayTargetOf(node)` → `{ kind: 'named', collectionName }`
   (a literal name, the module) | `{ kind: 'minted', nodeId }` (exactly one wire on `collectionId`, from a
   `Create New Array`'s `id`) | a refusal by name. **Every site that today asks `collectionNameOf` and
   `registry.collections.has` asks this instead** — `listReadOf`'s `Collection2` branch, the three mutator
   compiles, `insertChainOf`, `repeaterCollectionFeed`, and the For Each feed pass — so the named model and
   the minted one cannot disagree about what a wire means. Any other consumer of `id` (a Set Variable's
   value, a Text, a Component Output, a `NewModel` property — the "store its id on an object" pattern)
   refuses the mint by name: *"its Id is consumed as a value by X — the export keeps the minted array as a
   handle, not a string, and only an Array Id port can take it"*. That pattern is §55.7's, not this row's.
3. **Reading a minted array.** `ValueExpr` gains `minted-array-get { nodeId, viaLocal? }`. In render it is
   the hook local `const snapshotItems = useCollection(snapshot ?? noArray)` — `useCollection` is
   `useValue(source)` over `[source]`, so the hook resubscribes when the handle changes, and `noArray` is one
   module-scope `collection<never>([])` per component file, the stand-in for "no array bound" (it is never
   written: every write is null-guarded). In a handler it is `(snapshot?.peek() ?? [])`; inside the Do chain
   it is `snapshotNew.peek()`. Type `any[]`, exactly as `collection-get` answers (plan.ts 7501) — a
   `For Each` fed by it takes the `itemsExpr` path (untyped rows, every mapped input kept, fields read as
   `any`: the §10 contract), `Run Tasks` items and both transforms take it through `listReadOf` unchanged.
   The `Array` node itself collapses into the read; its `id → collectionId` wire is consumed by the read.
   Its other outputs keep the named model's parity: `count`, `firstItemId`, `changed`, `fetched`, `done`,
   `id` consumed ⇒ refused by name (today's sentence); `fetch` or `items` wired ⇒ today's "wired inputs
   (seeding or fetch)" — with the `collectionId` wire itself exempted from that gate, since it is the
   binding. `runOnChange-collectionId` authored `false` ⇒ refused: the node would hold the previous array
   until a Fetch this slice does not translate.
4. **The row type `T`.** The snapshot source's row interface when `items` is a named array read or a
   filter over one (`NotesItem`, imported from its module) **and nothing inserts into the minted array**;
   otherwise `any`. An insert chain's keys have no static home in a component-local array (the registry
   types keys per *named* module), so a minted array anything writes is `Collection<any>` — the emitted
   app typechecks, and a component-local interface from the insert keys is §55.7's.
5. **Mutators bound by wire** — the same actions with a `target: ArrayTarget` and a live Failure arm.
   For a named target nothing changes and the dead-wire notes stand (a literal id always resolves). For a
   minted target the handle can be null (no Do yet), which is the runtime's `no-array` Failure, so the
   emitted code is the runtime's fork: `if (snapshot === null) { <raise clear-array/no-array>; <Failure
   chain> } else { … }` — the raise on §54's channel with the runtime's own message, the code by prefix
   (`insert-into-array`, `remove-from-array`, `clear-array`), and the arm printed only when the guard has
   something to do (a failure chain or the raise — the raise is always there, since the interpreter always
   raises). `Remove`'s gate 3 (§30.1, "the repeater must repeat the very array being written") becomes an
   equality of targets: the row's repeater is fed by a `minted-array-get` of the same mint. `Insert` keeps
   `insertChainOf`'s three gates with the target in place of the literal; the registry registers nothing
   for a minted target (no module), and the NewModel compile emits `collection-add` against it.
6. **Registration order (§54.4.1, memory `a-subscriber-node-has-no-trigger-side`).** The mint has a
   trigger side — `TRIGGER_PORTS.CollectionNew = 'new'` — so the early loop compiles it first. A read of the
   handle from *inside* its own Done chain resolves to the local and asks `compiledOf` nothing (the id nodes'
   `inChain` rule), so `Do → Clear(bound to the same mint)` cannot re-enter. A read from *outside* the chain
   is legal only when the mint compiles **and its Do is attached** — the id nodes' `rowIsReadable`, whose
   answer must come from the attach predicate rather than from pass order (an `Array` read inside another
   sink's early compile, before the attach loop, must not read as "never fired"). §55.4 records what that
   turned out to be.
7. **Refusals, by name and predicted** (§52.4: the side that asks first owns the sentence):
   Do unwired → falls to logic: *"nothing is wired to its Do, so no array is ever created"* (replacing §7.3's
   sentence in `dispositionForLogic`); two wires on Items → last-writer-wins; Items not a list → the
   transforms' sentence; `Completed` consumed → the one-outcome sentence (`Unique Id`'s, verbatim); an
   `Array` bound from anything but a mint's `id` → *"its Array Id is wired from X's Y — only a Create New
   Array's Id binds by wire; any other source is a runtime string this slice cannot resolve to an array"*
   (replacing "not a literal name" **only** when the wire exists — the unwired, unnamed case keeps its
   sentence); two wires on an Array Id → last-writer-wins; a mint that compiles but never attaches → the
   reader defers with *"the Create New Array it is bound to is never fired by a translatable trigger"*.
8. **Divergences, recorded rather than hidden.** (a) A handler reads the handle as of its render (the id
   rows' property): a callback captured before a re-mint acts on the previous array — the interpreter's
   `Array` node rebinds synchronously. Two Dos in one frame are not a shape a click produces. (b) The
   runtime's snapshot is `set`'s diff by Model id and the export's is a shallow copy; for plain rows the
   two are indistinguishable, and a row mutated through `Set Object Properties` shows in both. (c) The
   anonymous tier is weak: a re-mint drops the previous array in both worlds.

**The fixture** — `tests/fixtures/snap-desk` (`mkfixture18.js`): a named `notes` array with the Cheer
insert chain and a `Row` template carrying a Remove button (§30's shape, on the named array); a
`Snapshot` button minting a copy of `notes` with `Done → status`; an `Array` bound by wire feeding a
second `For Each` over the same `Row`; `Add to snapshot` (a `NewModel → Insert` chain by wire),
`Clear snapshot` (`Done`/`Failure` into two status setters) and the row's Remove into a
`Remove Object From Array` by wire. Refused shapes live in the spec by mutation (§52.4.2's rule).

**Gates, in order:** the reverted arm (`probe18-reverted.log`, `EXPECTED18.md` graded at its foot) →
the build → `tests/create-new-array.test.ts` → the emitted app under real `tsc` (`typecheck18.ts`) →
the arms → pkg tsc, jest whole, editor tsc → ledger, picker floor → the drive.

### §55.1 What the runtime does, and what that decides

Recorded in §55.0 above, unchanged by the build except for one reading the build sharpened: `Collection.set`
treats a non-array source as no rows (`src = src || []`, then `src.length`), so a mint whose Items is fed by
something with no static type (a Function's output — the catalog's own batch example) copies what is an array
and starts empty otherwise. That is Run Tasks' rule for its Items (`unknown`/`any`/`undefined` admitted), and
the mint takes it too.

### §55.2 What was measured before anything was built (`probe18-reverted.log`, HEAD 86fcbcc6)

Fixture `tests/fixtures/snap-desk` (`mkfixture18.js`): `Pages/Home` (a text input → `draft`; `Add note` →
`NewModel → Insert "notes"`; `notes` → a `For Each` over `Components/Row`, whose Remove pulses
`itemOutputSignal-removed` into a `Remove Object From Array "notes"` — §30's shape; `Snapshot` → a
`Create New Array` with Items ← `notesArray.items` and `done → status = "snapshot taken"`; an `Array` with
`collectionId` ← `mint.id` feeding a second `For Each` over the same `Row`; `Add to snapshot` → `NewModel →
Insert` with `collectionId` ← `mint.id`; `Clear snapshot` → `Clear Array` bound by wire, `done` and
`failure` into two status setters; the second list's Remove into a `Remove Object From Array` bound by
wire) and `Components/Row` (text in, `removed` out). 29 nodes, 29 wires.

- Predicted and measured: the mint fell to §7.3's sentence; its click wire "no deterministic translation in
  step 5"; `snapArray`/`makeSnapNote` "array id is not a literal"; `insertSnap` "logic node
  (CollectionInsert)"; `clearSnap`/`removeSnap` the not-a-literal sentence; every chain behind them silenced
  with `causedBy`. No `src/lib/errors.ts`.
- 🔴 **Not predicted: the NAMED side died too.** `notesArray` was refused *"array feeds nothing statically
  translatable"*, its `items → notesList` wire dropped *"its items output drives logic this slice does not
  translate"*, and `removeNote` refused by gate 3 (*"not fed by a named array"*). `notesArray.items` also
  fed the mint's Items, and `collectionReadEligible`'s stray-wire predicate admitted only a `For Each` and
  the two transforms as `items` consumers — a `Create New Array` (and, measured beside it, a `Run Tasks`)
  reading a named list counted as a stray, and the named list, its insert target and its Remove fell with
  the one untranslated node. §50.2's cascade, on a **translated** construct: 14 refusals on Home against
  a prediction of ≥ 8, and nothing naming the mint as the cause. Fixed by naming every `resolveExpr` list
  reader in the predicate; pinned by `create-new-array.test.ts` A10/E1 (the mint refused by mutation, the
  named list still whole) and D2 (a named `Array` into Run Tasks' Items is a read, not a stray).

### §55.3 The build

- **`appState.ts`**: `COLLECTION_NEW_TYPE`, `ArrayTarget` (`named` | `minted { nodeId, wireKey }`), and
  `arrayTargetOf(node, component)` — two wires: last-writer-wins; one wire from a mint's `id`: minted; one
  wire from anything else: *"its Array Id is wired from X's Y — only a Create New Array's Id binds by wire;
  any other source is a runtime string this slice cannot resolve to an array"*; no wire: the literal, or the
  old not-a-literal sentence. `InsertChain.minted`; `insertChainOf` over the target (the unwired, unnamed case
  keeps "array id is not a literal"; the registry registers nothing for a minted chain).
- **`plan.ts`**: `minted-array-get { nodeId, viaLocal? }` (type `any[]`, never undefined, valid in every
  context — the five switches); `MintedTarget { nodeId, stateName, viaLocal?, sinkId, action, failThen }` on
  the three mutator actions; `ArrayNewAction { local, stateName, rowType, source?, sourceIsList?, then }`;
  `StateVarPlan.origin 'array'`; `MintedArrayPlan` on `ComponentPlan.mintedArrays`; `mintChainScope`,
  `mintLocalOf` (`<label>New`), `mintRowTypeOf` (the snapshot source's interface when it is a named read or a
  filter over one and nothing inserts; else `any`), `mintStateOf` (`allocStateVar(label, 'newArray',
  `Collection<T> | null`, …)`, `bootCode 'null'`), `arrayTargetIn` (the named module check),
  `mintedTargetFor`, `sameArrayTarget`, `mintScopeConflict`; `collectionReadEligible` exempts the
  `collectionId` wire and admits every list reader; `listReadOf`'s `Collection2` branch resolves the target
  (a wired id ⇒ the minted read, the `runOnChange-collectionId` gate, the wire consumed);
  `compileCollectionClear`/`Remove` and the NewModel compile carry `minted` (Clear's Failure live, the
  Insert's Failure compiled, Remove's gate 3 over targets with both described); `compileCollectionNew`
  (Items 0/1/>1, the Run Tasks type rule, the `id` consumers, Completed's one-outcome sentence, the Done
  chain in scope); `TRIGGER_PORTS`, `OWN_CHAIN_OUTPUTS`, the dispatch; `dispositionForLogic`'s sentence;
  `scanActions`, `actionsValidIn`, `snapAction`, `fillMaterialize` over the new chains; the For Each feed
  pass routes a wired-id `Array` to the untyped `itemsExpr` branch.
- **`component.ts`**: `NO_ARRAY`, `MINTED_CODE_PREFIX`, `mintedGuards`; the minted read in `exprCode`
  (chain-local `.peek()` / hook local / `(<row>?.peek() ?? [])`), `maybeUndefined`, the deps walker,
  `hookExprSources` (the hook + the row), `collectExprUse`, `collectActionUse`, `listExprFields`,
  `chainReadsChainLocal`, `deepActions` (which now also descends a Clear's and a Remove's chains — the emit
  twin of §30.3's walker hole), `actionExprsOf`; `array-new` and `mintedGuard` in `actionCode`
  (`if (<row> === null) { raise…; <Failure chain> } else …`, `else if` when the else is one `if`);
  `actionIsStatement`/`actionTakesNoTerminator`/`blockBody`; the hook **after** the state rows, typed
  `useCollection<T>` when the row is; `const noArray = collection<any>([])` at module scope;
  `import { collection, type Collection } from '@nodegx/core'`; `import { notes, type NotesItem }` when the
  row is typed by a module's interface; `raisesAppErrors` earns the raise import for a guard.
- **Ledger** `translated`, floor 97 (five pins moved). `mkfixture18.js`, `probe18.ts`, `typecheck18.ts`,
  `mut18.py` + `runmut18.sh`, `EXPECTED18.md` in the s83 scratchpad.

### §55.4 What building it found

1. 🔴 **A stray-wire gate written for one consumer silences every later one** (§55.2). The predicate was a
   closed list of `items` readers, and every list reader added since — Run Tasks in §53, the mint here — made
   a translated named array refuse the moment it fed the new node. The reader list is now the rule.
2. 🔴 **The hook printed before its `useState` row** — a TDZ `ReferenceError` in the running app that the
   suite's `typecheckEmittedApp` caught only because A2 runs real `tsc` ("used before declaration"). The
   minted hook reads a state row, so it prints after the rows; the named hook never did.
3. 🔴 **`Collection<never>` is not assignable to `Collection<any>`**: `listeners` is a function-typed
   property, so `T` is invariant and a `never`-typed stand-in widens to nothing. Found by the same real
   `tsc`; the stand-in is `collection<any>([])` and a typed handle's hook takes an explicit `<NotesItem>`.
4. 🔴 **The catalog's own example refused on the first build**: a Function's output into Items is typed
   `unknown`, and the mint took `listReadOf`'s list-only rule. Run Tasks had already decided this
   (`unknown`/`any`/`undefined` admitted); the emitter copies what is an array and starts empty otherwise,
   which is `Collection.set`'s own reading of a non-array source. D1 pins the batch shape.
5. ⚠️ **No "attached" check is needed for a minted read**, unlike the id nodes' `rowIsReadable`: the row
   boots `null` and stays `null` while the mint never fires, which is exactly the interpreter's unbound
   `Array` — empty reads, and a mutator's `no-array` Failure. The id rows needed the check because they boot
   with a value the runtime would regenerate. (B4 pins the unfired mint: no setter call, the app typechecks.)
6. ⚠️ **One node, two spellings**: a mutator bound to the mint and fired both from the mint's Done and from
   a button would be cached once (`compiledOf` keys on node and port) with the chain-local, and the button's
   handler would name a local it has not got. Refused by name (`mintScopeConflict`, C11). The id nodes carry
   the same hazard unrefused — registered in §55.7.
7. ⚠️ An `Array` read inside a handler collapses **into that handler**, not into the page file — the
   page-file `into` is the render-binding form. Two rows were written the other way round.
8. ⚠️ **`deepActions` never descended a Clear's or a Remove's chains** — so a `navigate` inside a Clear's
   Done chain would not have earned `useNavigate`. The emit twin of §30.3's `scanActions` hole; both
   mutators now descend, and the minted Failure arms with them. Fix by inspection: no fixture reaches it.

### §55.5 Graded — `tests/create-new-array.test.ts` (35 rows), the gates, the arms

§A the fixture whole (nothing refused, real `tsc`, every file parses, the mint's order, the row and the hook AFTER it, the
imports, the bound list's rows and `?.remove`, the two guards with the runtime's codes and messages, the named side beside the
mint, every disposition, determinism, the ledger, `arrayTargetOf` for all six consumers) · §B the shapes (a mutator inside the
mint's chain spells the local, no Items ⇒ `[]`, a typed snapshot ⇒ `Collection<NotesItem>` + the type import, an unfired mint
still typechecks, the insert's Failure rides the guard) · §C twelve refusals by sentence and the §40 wire-order rule · §D the
catalog's batch shape (mint → Array → Run Tasks items, `Array.isArray` copy; a named Array into Run Tasks is a read) · §E the
reverted arm's finding as a control.

Gates alone (one job at a time): pkg `tsc` 0 · jest **67 files (67 on disk) 2179 rows** · editor `tsc -p tsconfig.json` 0 ·
editor `test:ci` 2943 specs, 5 failures = the AIX-006 floor (4, by name) + **SB-017 acceptance 6 "Expected 38 to be 35"** — a
site-builder template connection count on a template file a peer modified at 18:24 today (not this change's population; registered
for P82) · `export-ledger:check` OK 104 translated · picker **96 → 97 / 127 (76.4%)**, floor moved, five pins moved · the emitted
apps under real `tsc`: snap-desk, cheer, note-desk, batch-desk 0 · **arms 17/17 red** (`mut18-summary.txt`: M1 any wire binds ·
M2 the old stray gate · M3 no chain scope · M4 no trigger port · M5 no two-trigger refusal · M6 no own-chain outputs · M7 no hook
line · M8 the `never` stand-in · M9 no insert guard · M10 no copy · M11 no interface · M12 no else-if · M13 the list-only Items
rule · M14 the old sentence · M15 wrong raise codes · M16 boots undefined · M17 no Run On Value Change gate), each restored
md5-checked. ⚠️ M1's first cut failed TO COMPILE (a `never` narrowing) — "0 total" is not a kill; re-cut to a compiling mutant, 4 rows red.

### §55.6 The drive — twice: the editor's real write path, then the built app in a browser

1. **The editor** (`drive18.sh`, dev editor on `NOODL_REMOTE_DEBUG_PORT=9224`, the drive copy registered in recents and restored
   after): the picker's `Create New Array` card carries **no dot** while `Sign In With` still does; the pre-flight modal reads
   *"17 files — 1 page, 1 component, plus the app shell, styles and build config. Uses no backend. Everything translates. No node, wire
   or parameter is left out."*; the folder seam routed the real write path; **17 files on disk, 17 byte-identical to `emitApp`**
   (`compare18.ts`); stack torn down (25 processes), recents restored. ⚠️ The first open failed *"project.json is missing or
   unreadable"*: the drive copy had no `components/_registry.json` — `ProjectFormatDetector` accepts either indicator, and the fixture
   generator now writes the registry (the fixture on disk gained it too; `parseProject` never reads it).
2. **The built app** (`EXPECTED18-drive.md`, answers first; `npm install` against the PUBLISHED `@nodegx/core@0.1.0`, `tsc -b` 0,
   `vite build`, `vite preview`, headless Chrome over CDP, `drive18-app.sh`): all eleven rows as written — the two guards raise
   `clear-array/no-array` and `insert-into-array/no-array` before any Do; three notes; Snapshot copies them; a note added to the
   snapshot lands there only; **removing the snapshot's middle row leaves the notes' `beta`**, and removing the notes' `beta` leaves
   the snapshot's; Clear ⇒ "snapshot cleared", Clear again ⇒ nothing; Snapshot again ⇒ the current notes. Exactly two console
   errors, both the guards'. (§30.4's rule: the middle row is the measurement — an emitter that bound the Array to `notes` itself or
   skipped the copy reads identically on every other row.)

### §55.7 What this leaves

- **The id as a string** — `mint.id → NewModel prop`, `→ Set Variable`, `→ Component Outputs` (the
  enrichment doc's "a sub-array whose id you store on an object"): refused by name. Translating it means a
  runtime array registry in the emitted app (`Collection.get`'s create-on-read table) that the named modules
  also register into, or it splits one array into two. A design of its own. Owner NONE.
- **A component-local interface from insert keys**: a minted array anything inserts into is
  `Collection<any>`; the registry types keys per named module only. Owner NONE.
- **`count`, `firstItemId`, `changed` on an `Array`** — refused for named and minted alike (the named
  model's parity). `count` is the natural "3 selected" display. Owner NONE.
- **The id nodes' two-spellings hazard** (§55.4.6): a `Set Variable ← Id` fired both from `New`'s Done and a
  button is cached once with the chain-local. Owner NONE.
- **A handler reads the handle as of its render** (§55.0.8a): a Run Tasks completion captured before a
  re-mint acts on the previous array. Not a shape a click produces. Recorded, not fixed.
- **Two Dos off one button** (`Do → mint`, `Do → Clear(bound)`): the Clear compiles outside the mint's chain
  and reads the row, which the same handler has just set — the interpreter orders both by wire order. Owner
  NONE.
- §54.7's rows unchanged.

## §56 Tier 2.8 row 6 — `Filter Records`: the search box, as a derived list (session 84, 2026-09-04)

**97 → 98 of 127 (76.4% → 77.2%).** `pickerCoverageFloor` raised in the same commit; five pins moved
(`script`, `run-tasks`, `on-app-error`, `animation-pair`, `object-store`). Type id `FilterDBModels`.

### §56.0 What a Filter Records is, in the emitted app

`filterdbmodelsnode.ts` calls itself Array Filter's twin (NDA-004 §2), and it is: an array it is *given*,
filtered client-side, with the same six trigger paths and the same value-arrival guards. So it takes
Array Filter's shape — a **derived expression** that is always current — and Array Filter's gates: a wired
Enabled, a wired setting and a wired Filter signal are runtime values a derived list cannot spell; a Run On
Value Change box unticked means the node re-filters *only* on its Filter signal, which is the trigger form
this slice does not translate. What it does not share is the grammar: Array Filter's `filterFilter` list is
six operators over literals, and Filter Records' `visualFilter` is the builder's saved tree — either
generation — with connected `fp-<name>` parameters, run through `convertVisualFilter` and matched by
`queryutils.ts`'s local matcher.

The translation is in two halves, and where the line falls is the design:

- **Static, in the exporter** (`recordFilterReadOf`, plan.ts): both saved shapes read the way
  `savedFilterToNeutral` / `visualQueryToNeutral` read them (the English operator table, `contain` →
  `containsIgnoreCase`, `exist`/`not exist` → a presence test, a rule with no operator dropped, a group of
  one collapsed); every connected condition resolved to the expression wired into its `fp-` port through
  `resolveExpr`; a connected condition whose port has *no wire* dropped with a note, which is the runtime's
  own `dropUnresolvedConnected`; the schema-bound operators refused by name (`pointsTo`, `relatedTo`,
  `textSearch`, the id and geo operators — the runtime answers them through the backend's schema, and
  `matchesQuery` says `$relatedTo` matches nothing locally); a condition on a Date, File, Pointer or Relation
  column refused by name (`parseValue` wraps a Date into the backend envelope and the local matcher then
  compares a JS Date against it — not a comparison this slice claims); sort as `compareObjects`' `-`-prefixed
  list; skip/limit with `getLimit`'s own defaults.
- **Runtime, in the app** (`src/lib/filterRecords.ts`, the eighth hosted module): the tree as data, pruned
  the way the neutral converter prunes (a connected condition whose *wired* value is `undefined` at this
  render does not narrow — that is the search box before anyone types), lowered the way `toParseWhere`
  lowers (the nine string operators onto an escaped regex, `between` onto a closed range, `exists` onto a
  null test, `isEmpty` onto an empty-string comparison) and matched the way `matchesOperator` matches (loose
  `==` on equality, strict `indexOf` on membership, `String(value)` under the regex, an `objectId` key read
  from the row's `id`); then `compareObjects`, then skip, then limit — `scheduleFilter`'s order.

The source is *any* list expression: a Query Records' state row (new — `query-get`, typed `<Type>[]` off the
declared collection, allocated on first read by `queryPlanOf` and reused by the disposition pass), a named or
minted array, another transform. The rows keep their static type through the filter (a filter selects, it
does not reshape), so a repeater over it maps the declared columns and `tsc` checks them. `Count` is a
binding (`list-count`, the derived length) for this node and for Array Filter; `firstItemId`, `Filtered`,
`Done`, `Failure`, `Completed` and `Error` are refused by name, as a derived list has no run to announce.

### §56.1 The fixture — `tests/fixtures/search-desk`

A Query Records over `Contact` (name/city/age/vip, and a Date column `joined` the fixture never filters on)
feeding a Filter Records: `name containsIgnoreCase <fp-search>` AND `vip equalTo true`, sorted by name,
limit 5. The search text arrives through a Variable the input writes (§56.4 E2). Items feed a For Each of
ContactRow; Count feeds a Text. Emitted, the page reads:

```
{filterRecords(contacts, { and: [{ field: 'name', op: 'containsIgnoreCase', value: searchValue, connected: true }, { field: 'vip', op: 'equalTo', value: true }] }, ['name'], { limit: 5 }).map((item, index) => (
```

### §56.2 The reverted arm (`EXPECTED19.md`, graded)

Five refusals with the cascade §50.2 predicted, all five predicted: the node, the query "not consumed by a
rendered repeater", the For Each unfed, three wires dropped, the pathway verdict. Nothing unpredicted on the
fixture; what the build found is below.

### §56.3 Built

plan.ts: `RecordFilterOp`, `RecordWhere`, the `query-get` / `record-filter` / `list-count` expression kinds and
their three switch sites (`maybeUndefinedExpr`, `exprTsType`, `exprValidIn`), `whereExprs`, `queryPlanOf` +
`queryReaders`, `FilterDBModels` in `LIST_PRODUCERS`, `recordFilterReadOf`, the `count` opt-in in
`LOGIC_VALUE_OUTPUTS`, the DbCollection2 disposition pass over `readByLandedTransform`. component.ts: the
three `exprCode` cases (the where printed as data, a wired value where its condition sits), the walkers, the
row-type answer for `query-get`, the lib import earned in the walkers, `recordFilterLib` on the emitted
component. emit/recordFilterLib.ts: the module. emitApp.ts: the file. Ledger: `translated`, floor 98.

### §56.4 What building it found

- 🔴 **E1 — a read-time mark kept a dead fetch.** `queryReaders` fills when `resolveExpr` reads the query; a
  Filter Records refused *after* that read (a wired Filter signal, say) left the query `stubbed` with a state
  row and a fetch effect nothing printed — and the report saying the query translated. The disposition pass
  now asks whether the query's `items` wire is in `consumed` (it is iff the reader landed) and drops the
  allocated `QueryPlan` otherwise. Pinned (E1).
- 🔴 **E2 — a text input's live text is not a render-time source.** The first fixture wired
  `searchInput.text → fp-search`; the runtime's value port is `onTextChanged`, and `input-text` is legal only
  inside the input's own handler. The search rides a Variable (`onTextChanged → Variable.value`, the
  write-through rule; `Variable.value → fp-search`), which is what a Noodl author builds and what the
  exporter already translates. Recorded, not changed.
- ⚠️ **The where prints twice** when both Items and Count are consumed (each is its own `resolveExpr`), so
  the two notes a where can raise (a dropped unwired condition; a field the rows do not carry) are deduped at
  both sites. The duplicate *call* is pure and cheap; hoisting it to a render local is a residual (§56.7).
- ⚠️ **The import block is assembled before the body prints** — a flag set in `exprCode` earned nothing. The
  walkers (`collectExprUse`, `hookExprSources`) set it.
- ⚠️ Three expectations I wrote about sorting were wrong and the matcher was right: bare `>`/`<` are stable
  around an absent value; a lowercase initial sorts after every uppercase one; `notContains 'a'` is
  case-sensitive. The spec pins the runtime's answers, not mine.

### §56.5 Gates and arms

Gates, each alone on the box: package `tsc` 0 · jest **68 files (68 on disk) 2233** (filter-records.test.ts 34 rows:
§A the fixture whole + the real `tsc` over the emitted app, §B the matcher run on rows, §C the saved shapes and the
static drops, §D ten refusals by name, §E the three findings pinned) · editor `tsc -p tsconfig.json --noEmit` 0 ·
`export-ledger:check` OK (176 types, 105 translated) · picker 98/127 `--check` 0 · editor `test:ci` — see the
hand-off. Arms: **17/17 killed** (`mut19.py`, `mut19-summary.txt`), sources restored md5-identical. Two re-cuts, both
recorded: M5's first cut never aliased the input it claimed to mutate (a mutant that mutates nothing survives
honestly); M8's first two cuts narrowed a later `=== 'Date'` comparison to `never` and **failed to compile** —
"0 total" is not a kill (§55's rule) — the cut that kills retypes the Date column in the map the gate reads.

### §56.6 Driven

Twice. **The editor's real write path** (`drive19.sh`, `drive19.log`, screenshots `drive19-0N-*.png`): the drive copy
opened from the launcher; the picker card for *Filter Records* carries **no badge** and *Sign In With* (the control)
still carries its dot; the settings section shows the alpha sentence — *"Code export is in alpha. 98 of the 127 nodes
you can place export today (77%)…"*; the pre-flight modal leads with the same sentence in the warning colour
(`rgb(253, 176, 34)`), no verdict, no cascade, no refused node, "Choose folder and export…" reachable; the folder
dialog routed through the seam; **19 files on disk, 19/19 byte-identical to `emitApp`** (`compare19.log`),
`src/lib/filterRecords.ts` among them, the report's attention section reads *Nothing*, the README opens on the alpha
line. **The BUILT app** (`drive19-app.sh`, `drive19-app.log`, `EXPECTED19-drive.md` written first and graded): `npm
install` against the published `@nodegx/core`, `tsc -b` 0, `vite build`, `vite preview` on :4319, headless Chrome on
CDP :9334, a seven-row mock backend on :8590 answering the client's one request (a POST that tunnels a GET — run 1 read
the empty boot state because the mock answered only GET, and says so). **7/7 rows**: boot (search unset, the
condition dropped) five VIPs by name; "al" four; "zz" none; back to "" five; "a.b" exactly the one row (the regex is
escaped); "A" five of five; "BOB" none (not a VIP). No console error at any step. Everything torn down by pid.

### §56.7 Residuals (registered, owner NONE unless named)

- The filter call printed twice when Items and Count are both consumed — a render local would print it once.
- `Count` on a named `Array` (`Collection2`) still refuses through `collectionReadEligible` (§55.7's parity row).
- `firstItemId` is refused; it is `filtered[0]?.id`, one expression kind away.
- A condition on a Date column is refused whole; the honest translation needs the wire envelope unwrapped on
  both sides (§48's Date column).
- A Query Records' own `visualFilter` is still not translated (it fetches the whole class) — the ledger's
  blind spot §8 records, unchanged by this slice.



## §57 Tier 2.8 row 7 — `Repeater Item`: the row's own id, and the one pulse a row can hear (session 85, 2026-09-05)

Type id `For Each Actions`, display name *Repeater Item* — the seventh row of §50's list. Picker **98 → 99**.

### §57.0 What a Repeater Item is, and what that decides

**The ports on disk** (`foreachactions.ts`, nothing added by an editor adapter — the module's `setup()` is
empty since DEBT-006 removed the `itemAction-*` block): one input, `Remove Completed` (`removeCompleted`,
boolean, connections only), and six outputs — `Added` (`added`, signal), `Try Remove` (`tryRemove`, signal),
`Item Id` (`itemId`, string) and the outcome trio `Done` / `Completed` / `Unchanged`. **No index port, no
Remove action.** The runtime hands a row *nothing to remove itself with*; removal is data-driven (a row
leaves the array), and the Repeater Item only *hears* about it.

**What the runtime does with them**, in `foreach.tsx` and `foreachactions.ts`:

- `Item Id` is `resolveForEachItem(this).getId()` — the `_forEachModel` the repeater hung on the template
  instance (`createNode(template, guid(), { _forEachModel: model })`), walked up the scope chain. The model is
  what `Collection.set` minted the row into: `Model.create(plain)` takes **`plain.id` when the row carries
  one and mints a guid otherwise** (`model.ts:238-247`), and for a Query Records row it is the record's
  objectId. A number in `id` stays a number (`_newRecord(id)` keeps the raw value; the port says `string`).
- `Added` is `signalAdded()`, called **synchronously inside `addItem` after `createNode`, once per row,
  before `target.addChild`** — one pulse per row creation, never again for that row.
- `Try Remove` is a **hold**, not a notification: `removeItem` calls `tryRemove(cb)` on the row's first
  Repeater Item; when the output has connections the node stores `cb`, pulses `Try Remove` and waits for
  `Remove Completed`, which then fires `Done` (a hold was waiting) or `Unchanged` (none was) and `Completed`
  either way. With no connections the removal proceeds on `scheduleAfterInputsHaveUpdated` — nothing an author
  can observe.
- A Repeater Item with no template host resolves nothing: `repeater-item/no-item-in-scope`, once, and
  `Item Id` reads `undefined` for ever; `Added` never fires because no repeater creates it.

**The design — the Object-in-repeater shape, not a new one.** EXP-002-MODEL2-TARGET-OUTPUT §4 already
translates "a node inside the template reads the row": an `Object` in *From repeater* mode becomes a row prop
the parent binds from `item.<field>` (`ComponentPlan.rowProps`), typed on the template side and dropped by
name on the parent side when the feed does not carry the field. `Item Id` is exactly that read with the field
fixed to `id`, and it takes the same seam:

- **`itemId` consumed** → the template declares `itemId?: string` (the port's own type — the one thing the
  template can promise without knowing its host), and every For Each that repeats the template passes
  `itemId={item.id}` through `rowAttrs`, **in all four feed branches**, so the emitted `tsc` checks the feed's
  `id` against `string` where the row type is concrete. Per feed, by name (the parent's sentence, since the
  parent is where the row's shape is known): Static Data rows without a unique primitive `id` (the runtime
  mints a guid there that the exported app does not); a Static Data `id` not typed `string` (the runtime hands
  a number through a string port — the export will not claim a type the graph did not); a named array (its
  rows are inserted without an id — a guid again); a typed list expression without `id`. An untyped list
  keeps it, under §4e's ruling. A query feed always passes it — `id` is the record's own.
- **`added` consumed** → a once-on-mount effect guarded by `useRef(false)` — §53's task-start shape verbatim
  (`startTask` pulses once after `createNode`; so does `signalAdded`), its chain compiled by `doneChainOf(node,
  'added')` in render context and registered in every walker a task's chain is (`allActions`, `scanActions`,
  `walkActions`, `fillMaterialize`, the React import).
- **Refused, by name, the whole node** (`dispositionForLogic`-level, before any prop is minted):
  1. no For Each names the component as its template — *"no For Each names /Components/X as its template,
     so there is no repeater row: Item Id reads undefined and Added never fires (the runtime reports
     `repeater-item/no-item-in-scope` once). A Repeater Item nested one component below the template walks up
     in the runtime; this slice reads only a template's own"*;
  2. a Run Tasks names it — *"named as a Run Tasks template by <comp> › <node>, where the item is a task
     input rather than a rendered row (runtasks.ts sets `_forEachModel` too) — this slice translates the For
     Each row only"*;
  3. `Try Remove` connected — *"its Try Remove is connected, which holds the repeater's teardown of this row
     until Remove Completed is pulsed — the emitted row unmounts the moment its item leaves the list and has
     no hold to offer"*;
  4. `Remove Completed` wired — *"its Remove Completed is wired: the exit handshake it completes has no
     counterpart in the emitted row, which unmounts the moment its item leaves the list"*;
  5. `Done`/`Completed`/`Unchanged` consumed — *"its "<port>" output is consumed, and it reports the exit
     handshake this slice does not translate (Done when a held removal is released, Unchanged when none was
     waiting, Completed either way)"*.
- **Two hosts** are *not* a refusal: the prop's type is the port's, and each host's feed is gated on its own
  rows, so a template repeated over two lists gets `itemId` from the one whose rows carry a string `id` and a
  named drop from the other. (The `Object` gate refuses two hosts because it reads *arbitrary* fields; this
  node reads one, whose type it declares itself.)
- A Repeater Item nothing reads collapses into the root, as an `Object` nothing reads does — inert in the
  runtime, absent in the emit, nothing lost.

What this deliberately does **not** do: mint an id on rows that have none (a guid per render would differ from
the runtime's stable one and from itself across renders); hold a row's unmount for an exit animation (the
repeater is not being redesigned — §29's ruling); expose an index (the node has no such port).

### §57.1 What is emitted

- **The template** (`PersonRow.tsx`): `itemId?: string` on the props interface, destructured, rendered where the
  Text sat — `<p className={styles.idText}>{itemId}</p>`; and, when `Added` is consumed, `useEffect`/`useRef` earned
  in the import block and a once-on-mount effect after the boundaries and before the query effects:
  ```
  // Repeater Item "This row": its Added chain runs once, on mount — signalAdded fires once per row, right after the repeater creates it (foreach.tsx).
  const added = useRef(false);
  useEffect(() => {
    if (added.current) return;
    added.current = true;
    lastAdded.set(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, like the row's own Added pulse
  }, []);
  ```
- **The host** (`Home.tsx`): `itemId={item.id}` on the row element, in every feed branch that can supply it, beside
  `key={item.id}` and §29's `onRemoved={() => …}`. A feed that cannot supply it drops the attribute with a sentence
  naming the node and the port, under the page in `EXPORT-REPORT.md`, and the pre-flight counts it.
- **The plan**: `ComponentPlan.rowProps` entries carry `repeaterItem` (the node id) so the parent's drop names the node
  rather than the generic "no row carries this field"; `ComponentPlan.repeaterItems` holds the compiled Added chains;
  `REPEATER_ITEM_TYPE` is exported beside `RUN_TASKS_TYPE`; the read is admitted in Pass 4g beside `Object`'s
  `prop-*` reads and in `resolveExpr` beside the same branch. No new lib — the effect is inline, §53's shape.
- **Refused by name** — the five whole-node sentences of §57.0 (no host; a Run Tasks host; Try Remove connected; Remove
  Completed wired; Done/Completed/Unchanged consumed), the four parent-side drops (static rows without a unique `id`; a
  static `id` typed number; a named array inserted without a string `id`; a typed list without `id`), the Added chain
  that does not translate (*"Repeater Item X: its Added chain did not translate — <reason>; its Item Id, if read, still
  does"*), and the fallback for a component with no visual root.

### §57.2 The fixture — `tests/fixtures/roster-desk`

A Static Data `People` (`p1` Ada, `p2` Grace, `p3` Linus — string ids) repeated by `peopleList` into
`/Components/PersonRow`: a Text from the `name` input, a Text from the Repeater Item's Item Id, a Remove button whose
Click is the row's `removed` output; `Added → Set Variable lastAdded ← Item Id`. The page relays `itemOutputSignal-removed`
into `Set Variable lastAction = "Removed a person."` and shows both variables. Emitted whole: 0 refusals, 15 files, the
real `tsc` over the app clean.

🔴 **The brief asked for "a Remove button that signals the item's removal through the node's own mechanism".** The node
has none — no Remove or Delete action, no index port; `tryRemove` is the repeater *asking the row* whether it may go.
Removal is data-driven (a row leaves the array), and §30's `Remove Object From Array` needs a *named* array feed, which
the exporter cannot seed from a Static Data (`collection<T>([])` boots empty). So the fixture's Remove rides §29's
relay into a page action, which is what the runtime can do with a static list too; a working delete over a named array
is `note-desk`'s and stays there.

### §57.3 Gates

```
nodegx-export: tsc 0 · repeater-item.test.ts 29/29 · jest 69 files (69 on disk = 68 + this one) 2293 rows, exit 0, alone on the box at load 6
export-ledger:check OK — 176 types, 106 translated · picker --check 99/127 (78.0%), exit 0 (was 98)
six floor pins moved 98 → 99: animation-pair, filter-records, on-app-error, object-store, run-tasks, script
neighbours re-run alone, green: unreported-deferrals 7, in-code-markers 54, logic 29, typecheck-emitted 34, static-data 23,
  collection-remove 20, repeater-row-signals 14, foreach-relay-ports 10, filter-records 34
arms 15/15 killed (mut-summary.txt), sources restored md5-identical; two first cuts did NOT compile ("0 total" is not a
  kill) and were re-cut at the value level: M4 (the outcome arm → the port names misspelt, 3 red) and M12 (the named-array
  gate → the key predicate inverted, 1 red)
```

### §57.4 Traps found

- 🔴 **Predicted a Remove signal; the node has only outputs.** §7.3 called the ports "the Repeater's removal handshake"
  and the brief read that as a signal the row sends. Reading `foreachactions.ts` first: `tryRemove(cb)` is the
  repeater's call *into* the row, and the row's only verb is `Remove Completed`. The design changed before a line was
  written — nothing to emit for removal, a hold to refuse by name.
- 🔴 **Predicted a text input's live text in the Added chain would be handler-only (§56 E2's rule).** It is not: the
  exporter syncs the input's text into `useState` and the chain reads `''` on mount — which is the runtime's answer too
  (the input is empty when `signalAdded` fires). Pinned as a row rather than refused; the row that *does* refuse an
  Added chain uses a `Navigate` with no target.
- 🔴 **A `defer()` subject does not reach the report.** I asserted the report would carry the deferral's subject phrase;
  the report carries the *note*, and the deferral only feeds in-file markers and the pre-flight count. The row asserts
  the sentence under the page and `refusals === 1`.
- ⚠️ **Notes are prefixed with the component path at `emitApp`**, so a `startsWith` on the sentence reads nothing.
- ⚠️ **`not.toContain('itemId')` matched the AC3 marker's own port name** (`rowItem.itemId` in the TODO comment) — an
  absence assertion on a substring that the *refusal prose* also contains proves nothing; narrowed to `itemId?:`.
- ⚠️ A ternary arm replaced by `false` narrows the discriminant to `never` and fails to compile under ts-jest — twice.

### §57.5 Residuals (owner NONE unless named)

- A Static Data with a **number** `id` drops Item Id by name; the honest translation is the runtime's — the number
  through a string port — which the export declines to type. Owner NONE.
- A Repeater Item **nested one component below** the template (the runtime walks up the scope chain) refuses with the
  no-host sentence, which names the case. Translating it needs an "instantiated inside a template" map. Owner NONE.
- `foreach.tsx:587-593` feeds a template's Component Input named `id`/`Id` from `model.getId()` in identity-mapping mode;
  the exporter's `template-inputs` mapping binds `id` from `item.id` (right when rows carry one) and `Id` from `item.Id`
  (never carried — dropped with the generic sentence). Pre-existing, not this row's; owner NONE.
- The exit handshake (`Try Remove` → exit animation → `Remove Completed`) stays refused by name; an honest translation
  is a deferred-unmount list in the host, which is a repeater redesign. Owner NONE.
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed.


## §58 Tier 2.8 row 8 — the streaming trio: `JSON Stream Parser`, `Stream Buffer`, `Text Accumulator`, hosted the way AGENT-007 runs them (session 85, 2026-09-05)

The eighth row of §50's list, three picker nodes in one section. Type ids `net.noodl.JSONStreamParser`,
`net.noodl.StreamBuffer`, `net.noodl.TextAccumulator` (the display names drop the `net.noodl.` and space the
words; the ledger keys on the ids). All three are `inNodePicker`, not deprecated, `availableIn: browser` —
`picker-coverage.js` counts each, so the floor moves **98 → 101**.

### §58.0 What the three nodes are, and what that decides

**The runtime** (`noodl-runtime/src/nodes/std-library/agent/`): three `_internal` state machines over
`stream-parsers.ts`'s pure functions, each with the outcome contract (`outcomeOutputs`: `done`, `unchanged`,
`failure`, `completed`) beside its own value-level signals. None spreads `outcomeInputs`, so there is no
`Treat Unchanged as` port. Read off the files, not the docs:

- **JSON Stream Parser** (`json-stream-parser.ts`). `chunk` is retained by its setter (`undefined`/`null` → `''`,
  else `String(value)`); `Parse` appends it and runs one of three framings over the whole pending buffer —
  `ndjson` (`splitDelimited` on `\n`, blank lines skipped, a line that will not parse is an error and the
  stream goes on), `single` (`scanJsonValues` without array framing, the first complete value only), else
  `stream` (`scanJsonValues` with array framing: top-level `[`, `]`, `,` are punctuation). The scanner
  tracks strings and escapes and brace depth, so a boundary inside a string, inside an escape, or inside a
  number waits (`12` at the end of a buffer might become `123`). Order per `Parse`: nothing pending →
  `Unchanged`; over `Max Pending` → buffer cleared, `Error`/`Error Count`, then `Failure` (`Is Complete` is
  NOT touched on that branch — transcribed as is); else `Is Complete`/`Pending Characters`, then the values
  (`Parsed` = the last, `Values` = this parse's, `Value Count` cumulative), one `Error` per bad value (the
  last message wins, the count grows by all), `Success` only if a value came out, then `Failure` iff this
  parse added errors (with `Error`'s text) else `Done`, then `Completed`. `Clear` resets everything and
  fires `Cleared`, then `Done` if there was anything (pending text, values, errors or a count) else
  `Unchanged`. `format`'s setter is `(value) || 'ndjson'` and an unknown name falls to the `stream` branch.
- **Stream Buffer** (`stream-buffer.ts`). `data` is retained and **marks arrival** (`hasPendingData`, set by
  the setter and never cleared). `Add` with nothing ever delivered is `Failure` (`stream-buffer/no-data`,
  `Error` set); else push, `Max Size` overflow drops the oldest (`Dropped Items`, `Overflowed`), then a
  `Flush Size` reached hands the token to the flush; else the interval timer is armed and `Done`. `Flush`:
  the timer stopped; an empty buffer is `Unchanged` (no `Flushed`); else `Flushed Data` = the buffer (a fresh
  array each time), `Flush Count`, `Flushed`, `Done`. The timer's own flush owns no token — `Flushed` only.
  `Flush Interval`'s setter re-arms on change (stop; arm iff the buffer is non-empty). `Clear` stops the
  timer, resets, `Cleared`, then `Done`/`Unchanged` by what there was — read before the reset. `Max Size`
  coerces `>= 0`, the other two `> 0`, else 0. Deletion stops the timer.
- **Text Accumulator** (`text-accumulator.ts`). The `chunk` setter accepts text and the primitives that read
  as text (`number`/`boolean`/`bigint` → `String`), blanks `undefined`/`null`, and **refuses** anything else
  at delivery: `Error` set to `describeBadChunk`'s sentence, `Failure` pulsed and `text-accumulator/chunk-not-text`
  raised — once per distinct message (`isRepeat`), the pulse before the raise. A text chunk clears `Error`.
  `Add` with an empty chunk is `Unchanged` (keep-alive frames; also the path after a refused chunk); else
  append, `truncateHead` to `Max Length` (`Dropped Characters`, `Overflowed`), `splitDelimited` on the
  delimiter (empty delimiter: no boundaries), messages appended and capped to `Max Messages` (`Dropped
  Messages`, `Overflowed`), `Message Received` once per Add that completed any, `Changed`, `Done`. `Clear`
  as the buffer's, `Error` counting as something to clear.

**The port set is the one on disk** — none of the three declares dynamic ports; the catalog rows are the
runtime's port maps and are what `plan.ts` reads. Every wire into a port the node has not got, and every
read of one, is refused by name.

**What the export does with them.** Each node is a hook over one `_internal`, in §52/§53/§54's shape:
`src/lib/streaming.ts` transcribes `stream-parsers.ts`'s cores (`splitDelimited`, `scanJsonValues`,
`tryParseJson`, `truncateHead`, `utf8ByteLength`, `describeError`) and the three machines as **pure
functions over a state object returning the ordered event list** (`parserParse(state)`, `bufferAdd(state)`,
`accumulatorAdd(state)`, …: every signal, raise and timer instruction the runtime would issue, in the
runtime's order), and three hooks over them — `useJsonStreamParser(source, options, listeners)`,
`useStreamBuffer(…)`, `useTextAccumulator(…)` — that keep the state in a ref, deliver the events (a signal
→ the listener, a raise → `raiseAppError` with the node's provenance, arm/stop → the one timer), and bump a
reducer so the host re-renders. The handle's value outputs are **live getters** over the state, so a chain
fired by a signal reads what the runtime's getter answers at that moment, and a Text bound to one re-renders
after the invocation. Value inputs: the data port (`Chunk`/`Data`) is **read at the pulse**, `runtasks-run`'s
rule — the action carries the wired expression (or the authored literal), snapped per chain, and the hook's
`parse(chunk)`/`add(data)` runs the setter then the action; with no source at all the call takes no argument
and the setter never ran (the parser and accumulator then see `''`; the buffer sees `hasPendingData` false and
fails, as the runtime does). Config ports are read live off an options object the hook re-reads every
render (§54's Filter) — absent means the `initialize` value, present means the setter's coercion — and the
buffer's interval change re-arms the timer in an effect, as the setter does at delivery.

**Refused by name** — every sentence predicted here, then pinned in §58.4:
- a logic-only component: *component emits no file to host the JSON Stream Parser* (or the node's display name);
- *its `<port>` input is not a port this node has* · *its `<port>` output is consumed, and this node has no such port*;
- *two wires feed its `<Port>` input — last-writer-wins is not statically ordered* (any value input);
- a value input with no static source: *its `<Port>` input is fed by `<type>` — `<the feeder's own reason, or>` no statically known source in the emit vocabulary*;
- a value input fed by a text input's live text: *its `<Port>` input reads a value that only exists inside a handler*;
- a signal output wired into a value port: *its `<port>` output is consumed as a value — a pulse carries nothing to read*, decided from the sink's port kind before the chain compiles (§52.4);
- a listener chain this slice cannot compile: `doneChainOf`'s own sentences; a chain reading handler-only values: *its `<port>` chain reads values that only exist inside a handler*.
Nothing else is refused: the three nodes' every port translates. A node nothing fires and nothing reads is
still hosted (Script's and the boundary's rule — the runtime instance exists and holds its defaults); its
listener chains are compiled and never fire, as the runtime's never would.

**Recorded divergences** (in the lib's header): the setters run at the pulse with the value the render or the
chain holds rather than at delivery — so the accumulator's refused-chunk `Failure` fires at the `Add` that
carries it, not the moment the wire delivers it, and once per distinct message either way; a wired `Data`
counts as arrived whether or not its source has published (the runtime's `hasPendingData` is per delivery);
`flagOutputDirty` collapses into one re-render per invocation (the chains read live getters, so nothing they
see moves).

### §58.1 What is emitted

- **`src/emit/streamingLib.ts`** (new) → `src/lib/streaming.ts`, shipped when any component keeps one of the three;
  it imports `./errors`, so `errors.ts` ships with it (the `emitApp` rule, fifth member). Exports: the cores
  (`splitDelimited`, `scanJsonValues`, `tryParseJson`, `truncateHead`, `utf8ByteLength`, `describeError`); per node a
  state factory (`createParserState` = `initialize()`), an options applier (the setters, keyed on presence), the data
  setter, and the actions as pure functions returning `StreamEvent[]` (`parserParse`/`parserClear`,
  `bufferAdd`/`bufferFlush(state, owned)`/`bufferClear`, `accumulatorSetChunk`/`accumulatorAdd`/`accumulatorClear`);
  the three hooks. `bufferFlush`'s `owned` is the token: the interval timer's flush owns none, so it reports no outcome.
- **plan.ts**: `STREAM_PARSER_TYPE` / `STREAM_BUFFER_TYPE` / `TEXT_ACCUMULATOR_TYPE`, the `STREAM_NODES` table (the
  catalog's port set per node: data port, config ports, action verbs, signals in declaration order, value fields with
  their declared-type cast and their maybe-undefined answer — §A's last row pins it against the catalog); `ValueExpr`
  gains `stream-out`, `HandlerAction` gains `stream-action` (`value` read at the pulse, `runtasks-run`'s rule, snapped
  per chain); `StreamPlan` on `ComponentPlan.streams`; `streamPlanOf` in `scriptPlanOf`'s shape (memoised, `refuse`
  unwinds the plan and the compiled sinks), `streamReadOf`, `compileStreamAction`; `isTriggerWire`; the `compileSink`
  dispatch; the trigger-compile loop; `OWN_CHAIN_OUTPUTS` (so the attach pass skips a listener wire whatever its file
  order); the registration pass beside Script's; the binding whitelist; the seven expression/action switches; both
  walkers, `scanActions` and `fillMaterialize`; `bailAsLogicOnly`'s sentence; `streamFieldMaybeUndefined` exported.
- **component.ts**: the flag, `allActions`, `collectActionUse`, `maybeUndefined`, `exprCode` (`<local>.<field>`
  both modes), the deps walk, `chainReadsChainLocal`, `actionCode` (`<local>.<verb>(<data>)`), `actionExprsOf`, the
  import (the hooks the plan kept, sorted), the config reads through `hookExprSources`, the binding table by declared
  type (an `array` port `JSON.stringify` at text; a `*` port §10's `String(x ?? '')`; number/boolean `String()`; a
  string bare; a number sink takes a number bare and refuses the rest; a boolean sink coerces `!!`), the hook lines
  after the boundaries, the gate, the return.
- **emitApp.ts**: the lib, and `errors.ts` when it ships. **Ledger**: three rows `translated`, floor **98 → 101**,
  one sentence on the floor comment. **Moved rows**: the six floor pins (`filter-records`, `script`, `animation-pair`,
  `object-store`, `on-app-error`, `run-tasks`).

### §58.2 The fixture — `tests/fixtures/stream-desk`

`Pages/Home`: a `chunk` Variable written by two Load buttons (`{"id":1,"name":"A` and `da"}\n{"id":2,"name":"Bob"}\n` —
a document split mid-string across the two) into a JSON Stream Parser (`format: ndjson`) with Parse and Clear buttons;
a `token` Variable written the same way (`Hello, wor` / `ld|Bye|`) into a Text Accumulator (`delimiter: |`) with an
Add button; a String constant `tick` into a Stream Buffer (`maxSize: 3`) with Push and Flush buttons. Every value
output is bound to a Text; `success` / `messageReceived` / `flushed` each write a `status` Variable shown in a Text.
46 nodes, 35 wires. Load and Parse are **separate clicks on purpose**: a `Set Variable` compiles with no Done chain, and
a set-and-parse pair off one click is exactly the shape whose runtime order cannot be read from source (the pulse is
queued at the click, the Variable's delivery is queued when the setter runs) — the export would print
`chunk.set(…); parser.parse(chunk.get())` and read the fresh value, and whether the runtime parses the old chunk is a
question for a drive, registered in §58.5 rather than baked into a fixture.

Emitted (`Home.tsx`): one import of the three hooks; three hook lines with the node's provenance, its authored config
and its listener inline; `parser.parse(chunk.get())`, `acc.add(token.get())`, `buffer.add('tick')`, the bare verbs;
`{JSON.stringify(parser.values)}`, `{String(parser.valueCount)}`, `{parser.error}`, … . 15 files, both libs, no
refusal, no verdict; the emitted app typechecks as a real `ts.Program` with 0 diagnostics.

### §58.3 The gates

```
packages/nodegx-export: tsc --noEmit 0 · streaming-trio.test.ts 59/59 · export-ledger:check OK (176 types, 108 translated)
picker 101/127 (79.5%), floor 98 → 101, --check exit 0
jest, the whole package, once, alone (1-min load 4.95): 69 files (69 on disk) 2323 rows, exit 0 (was 68 / 2233)
the nine moved or joined specs, one at a time, all green: filter-records 34, script 74, animation-pair 57, object-store 35,
  on-app-error 41, run-tasks 67, emitted-syntax 62, exported-readme 169, in-code-markers 54
emitted apps typecheck (real ts.Program): the fixture, the wired-config variant, the Data-less variant, the `Parsed`/truthy
  variant — 0 diagnostics; a CONTROL row proves the checker reddens on a getter the handle has not got
arms 13/13 red, all restored (md5 identical after each; mut-summary.txt):
  M1b the scanner forgets escapes in an object string — 1 · M2 Success on every Parse — 3 · M3b Completed before the outcome — 20
  M3c the raise AFTER the failure pulse — 4 · M4b the timer's flush reports an outcome — 2 · M5b a repeated bad chunk fires again — 1
  M6b a changed interval never re-arms — 2 · M7 the Chunk setter no longer clears on null — 2 · M8b a pulse read as a value
  is no longer decided before the chain — 1 (the first cut, `sinkKind === 'never'`, was a COMPILER kill — "Tests: 0 total" — and
  was re-cut at the value level, §55's rule) · M9 the data no longer read at the pulse — 3 · M10 an array port loses its JSON
  cast — 1 · M11 two wires no longer refused — 1 · M12 streaming.ts ships without errors.ts — 8
  (five lib arms were first written as multi-line anchors and cut NOTHING — the emitter is a quoted-line array, one string per
  source line, so a `\n` anchor cannot match; recorded, re-cut as single quoted lines)
```

### §58.4 What building it found

1. 🔴 **"Retained between pulses" is a behaviour, and my rows wanted the opposite.** Three §E rows expected a bare
   `parse()` / `add()` to be `Unchanged`; the transcription re-appended the last chunk, which is exactly what the
   port description says ("a second Add with no new chunk appends it again"). The rows now pin the re-append, and
   `parse(null)` — the setter's empty chunk — for the `Unchanged` path.
2. 🔴 **The scanner consumes the whitespace before an unterminated scalar.** `single` over `{"a":1} trailing` leaves
   `rest = 'trailing'`, not `' trailing'`: the skip loop runs before `scanOneValue`, and `rest` starts where the value
   would. The runtime's answer is pinned, not mine (Pending Characters 8, not 9).
3. ⚠️ **`Clear` resets `Flush Count`** — a row expected the count to survive a Clear. It does not (`clearBuffer`).
4. ⚠️ **The reverted-arm prediction put the wrong sentence on the wrong node**: I predicted "feeds X.chunk, which has
   no static binding" on the Variable-fed *wires*; it landed on the *constant node* (`tickConst`, "its savedValue read
   feeds net.noodl.StreamBuffer.data …") and the Variable wires took the generic step-5 note — a wire has no
   disposition to carry a sentence, a node does.
5. ⚠️ **A text input's live text into Chunk takes the feeder-named fallback** ("its Chunk input is fed by
   net.noodl.controls.textinput — no statically known source in the emit vocabulary"), not the precise "only exists
   inside a handler": §54.4.2's seam again — the node registers in the early trigger loop before the controlled-state
   seam mints the input's row. Pinned as it is; residual below.
6. 🔴 **The declared type, not the value, decides the cast** (`outputproperty.ts`, NDA-014): an `array` port takes
   the JSON cast at a text sink and a `*` port does not — so `Values` prints `JSON.stringify(…)` and `Parsed` prints
   §10's `String(x ?? '')`, and a parsed *object* on `Parsed` renders `[object Object]` in the export exactly as the
   runtime's Text node renders it. Read off the runtime, not preferred.
7. ⚠️ **A boundary's wired Filter is never walked by `hookExprSources`** (found while wiring my config reads): §54's
   "wired Filter from a Variable" row passes because a Text already binds that Variable and mints the `useValue`
   local; a Filter wired from a Variable nothing else reads would print a bare name. Not this row's; registered below.
8. ⚠️ **`PIPESTATUS` is bash; this shell is zsh.** The first `tsc` gate printed an empty exit — an empty error list is
   not a pass. Re-run unpiped, read the status (0).

### §58.5 What this leaves (owner NONE unless named)

- **The one-click set-then-parse order** (§58.2): the export reads the fresh Variable in the same handler; whether the
  runtime's input queue parses the previous chunk is a drive question. If it does, the export is *more* right than the
  runtime and the difference should be recorded as such; if it does not, nothing to do. Owner NONE (a drive).
- A value input fed by a **text input's live text** refuses with the fallback sentence — §54.7's seam, third family
  (boundary Filter, Script input, streaming data/config). The controlled-state row would host all three. Owner NONE.
- **A boundary's wired Filter is not walked by `hookExprSources`** (§58.4.7) — a latent §54 hole with no fixture that
  reaches it. One line beside the Run Tasks walk. Owner P18.
- **The transports** (`Server-Sent Events`, `WebSocket`, `Subscribe To Changes`, Tier 3.11) are what feed these nodes
  in a real app; until they translate, every stream-desk chunk arrives from a Variable or a constant. The hooks'
  `parse(chunk)` / `add(data)` shape is what a transport's `onMessage` chain would call. Owner: Tier 3.11.
- The accumulator's refused-chunk **`Failure` fires at the `Add` that carries the chunk**, not at delivery (recorded
  divergence, §58.0). A transport delivering into Chunk without an Add would make the difference observable; today
  nothing does. Owner NONE.
- A wired **`Data` counts as arrived** even if its source never published; the runtime's `hasPendingData` is per
  delivery. Observable only with a source that can be unset, which no fixture wires. Owner NONE.
- `flagOutputDirty` collapses into one re-render per invocation; the listener chains read live getters so nothing they
  see moves — a chain that fires a Set Variable read by a Text sees the same frame either way. Owner NONE.
- Not driven: the exported app in a browser, the editor's picker badge and pre-flight over stream-desk (the
  orchestrator's gates). The lib's behaviour is graded under the hook harness with fake timers (§D/§E).


## §59 Tier 2.8 row 9 — `Hash`, `Random Bytes`, `Screen Resolution`: three browser APIs, two libs (session 85, 2026-09-05)

Type ids `net.noodl.Hash`, `net.noodl.RandomBytes`, `Screen Resolution` (the last IS its display name; the first
two are not — `Hash` / `Random Bytes`). All three are in the picker population (`inNodePicker`, browser, not
deprecated), so the floor moves **98 → 101**.

### §59.0 Design — what each node is on disk, and what it becomes

**The port sets, read off the catalog (`node-catalog.json`), not the source files** — `outcomeOutputs` adds a
`Completed` port the literal `outputs:` object does not show (§37's trap, paid once already):

| node | inputs | outputs |
|---|---|---|
| `net.noodl.Hash` | `value` (string), `algorithm` (enum SHA-256/384/512, default SHA-256), `encoding` (enum hex/base64/base64url, default hex), `hash` (signal, display **Do**) | `digest` (string), `done`, `failure`, `completed`, `error` (string) |
| `net.noodl.RandomBytes` | `length` (number, default 32), `encoding` (enum, default hex), `generate` (signal, display **New**) | `value` (string), `done`, `failure`, `completed`, `error` (string) |
| `Screen Resolution` | none | `width`, `height`, `aspectRatio` (numbers) |

**Hash and Random Bytes are `UUID`'s shape (§37), not a request's.** `hash.ts` `_run` and `randombytes.ts`
`_generate` are: read the inputs the setters stored, produce a value or a failure, write the value row (or leave it
as it was), clear or write the Error, report the outcome. That is `compileIdNew`'s two-arm `if` — with two
differences the runtime makes and the export keeps: **the value row boots empty** (neither node has an `initialize`
that seeds it; `Digest` / `Value` read `undefined` until the first Do — where UUID's `initialize` mints one), and
**a failure raises on the error channel** (`reportOutcome(…, 'failure', { code })` → `raiseRuntimeError` before the
Failure pulse: `hash/failed`, `random-bytes/failed`; §54's rule that the raise sites are the row). Hash is
asynchronous (`crypto.subtle.digest` is a promise), so its call is awaited and the handler around it is `async`
(`actionsAwait`); Random Bytes is synchronous.

So: one action kind `crypto-call { node: 'hash' | 'random-bytes', inputs, local, materialize?, errorMaterialize?,
async, then, failThen }`, one expression kind `crypto-out { node, viaState? }` for the value output, and `outcome-error`
(the shape UUID already uses, `local: '<local>.error'`) for the Error. The three-question table is UUID's, verbatim:

| read from | `Digest` / `Value` | `Error` |
|---|---|---|
| render, or another handler | the row | the row |
| the **Done** arm | `<local>.digest` / `<local>.value` | 🔴 refused — both nodes clear the message before Done fires |
| the **Failure** arm | the row (neither node writes the value on failure) | `<local>.error` |

**The inputs are read where the setters read them.** `value`/`algorithm`/`encoding` (Hash) and `length`/`encoding`
(Random Bytes): a wire is the render expression the handler closes over (a wired `length` is wrapped in `Number(…)`,
the setter's own coercion at the delivery site); an authored literal prints as a literal; neither prints `undefined`,
and the lib applies the runtime's own fallbacks *there* — `algorithm || 'SHA-256'`, `encoding || 'hex'`, `value || ''`
(the `||`, not `??`: an author who cleared the field gets the default), and `length === undefined ? 32 : length`
(NOT `||`: a `Length` of 0 is a failure, which is the node's whole reason for existing). A wired enum is accepted:
the runtime stores whatever arrives and lets WebCrypto (`digest` rejects an unknown algorithm) or `encodeBytes`
(`Unknown encoding "x". Use hex, base64 or base64url.`) refuse it at run time; the lib does the same.

**`src/lib/crypto.ts`** (new emitter `src/emit/cryptoLib.ts`): `encoding.ts` transcribed — `bytesToHex`,
`bytesToBase64` (chunked, verbatim), `bytesToBase64Url`, `encodeBytes` (unknown → throw), `requireSubtle` (message
verbatim — it is the one realistic failure and the Error output prints it), `utf8Bytes`, `randomBytes` (the
`getRandomValues` throw verbatim; the 65536-byte chunk loop is NOT transcribed, on `idLib.ts`'s stated rule: the
node's own `MAX_LENGTH = 4096` makes it one iteration, a constraint that cannot bind); `tryHash(value, algorithm,
encoding): Promise<HashResult>` (`_run`, both catch paths — the synchronous `requireSubtle` throw and the promise
rejection — as `{ ok: false, error }`); `tryRandomBytes(length, encoding): RandomBytesResult` (`_generate`, the
range gate with its exact sentence). Discriminated unions, on idLib's reason: the Done arm reads `.digest` unguarded.
Separate from `id.ts` (which deliberately does not export `randomUuid`) and from `util.ts` (a project that formats a
string should not ship a CSPRNG).

**Screen Resolution is a hook, the boundary's shape (§54) without a listener.** `screenresolution.ts` reads
`window.innerWidth/innerHeight` at `initialize` and on every `resize` (one listener per node instance, removed on
delete — NDA-012), and `aspectRatio` is `width / height` in the getter. `src/lib/screen.ts` (`src/emit/screenLib.ts`):
`useScreenResolution(): { width, height, aspectRatio }` — a lazy `useState(() => readViewport())` (the `initialize`
read, once per mount), one `resize` listener in an effect with its cleanup (the delete listener), `aspectRatio`
computed as the getter computes it (so a zero-height viewport answers `Infinity`, the runtime's own answer). Registered
on first read (`screenPlanOf`, memoised) as `ScreenResolutionPlan { nodeId, label, local, comment }` on
`plan.screenResolutions`; expression `screen-out { local, field }`, `number`, never undefined, valid in both contexts
(a handler closes over the latest render, which is what the getter answers), touching no snapshot. The hook line
prints beside the boundaries' (it reads nothing). Recorded divergence: the runtime's SSR guard (`typeof window ===
'undefined'` → outputs unset) has nothing to guard in a Vite SPA and is not transcribed; the outputs are typed `number`.

**Refused by name** (every sentence predicted here, graded in §F of the spec):

- Hash / Random Bytes: `its <port> input is not a port this node has` · `two wires feed its <Port> input — last-writer-wins is not statically ordered` · `its <Port> input has no statically known source` (or the feeder's own sentence) · `its <port> output is not a port this node has` · `its Done|Failure output is consumed as a value — a pulse carries nothing to read` · `its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them` (UUID's sentence) · `its Error is read from its own Done chain — the node clears the message before Done fires, so that read is always empty` · a read of Digest/Value/Error while Do|New is wired but never attached: the trigger's own reason or `its Do|New is never fired by a translatable trigger` · a read while Do|New is unwired: `its Digest is read, but nothing fires its Do — no digest is ever computed` / `its Value is read, but nothing fires its New — no random bytes are ever generated` (§56 E1: a row nothing writes is a dead artefact, not a translation) · the sweep for a node nothing fires: `its Do|New is never fired by a translatable source`.
- Screen Resolution: `its <port> input is not a port this node has` (it has none) · `its <port> output is consumed, and this node has no such port` · `component emits no file to host the viewport hook` · unread: the date sweep's `its answer is read by nothing statically translatable`.
- Not translated, recorded: two `Do` pulses in one tick are coalesced by `scheduleAfterInputsHaveUpdated` into one digest with two tokens; the export runs the digest once per pulse.

### §59.1 What is emitted

- **`src/lib/crypto.ts`** (`src/emit/cryptoLib.ts`, new): `tryHash(value, algorithm, encoding): Promise<HashResult>` and
  `tryRandomBytes(length, encoding): RandomBytesResult`, both discriminated unions; the three encoders, `requireSubtle`,
  `utf8Bytes`, `randomBytes` and `MAX_LENGTH = 4096` transcribed from `encoding.ts` / `hash.ts` / `randombytes.ts`; the
  throwing internals are not exported (the nodes catch; §37's `randomUuid` rule). Shipped only where a component calls a verb.
- **`src/lib/screen.ts`** (`src/emit/screenLib.ts`, new): `useScreenResolution(): { width, height, aspectRatio }` — a lazy
  `useState(() => readViewport())`, one `resize` listener per hook with its cleanup, the ratio computed as the getter computes it.
  Shipped only where a hook line prints.
- **plan.ts**: `HASH_TYPE`, `RANDOM_BYTES_TYPE`, `CRYPTO_NODES` (port order, trigger + its display name, the raised code, `async`,
  the `Number()`-coerced port, the two sentences), `SCREEN_RESOLUTION_TYPE` + `SCREEN_RESOLUTION_OUTPUTS`; `ValueExpr` gains
  `crypto-out { node, viaState? }` and `screen-out { local, field }`; `HandlerAction` gains `crypto-call { node, fn, code, async,
  inputs, local, materialize?, errorMaterialize?, then, failThen }`; `StateVarPlan.origin` gains `crypto` / `crypto-error`;
  `ScreenResolutionPlan` on `ComponentPlan.screenResolutions`; `cryptoStateOf` / `cryptoErrorStateOf` (both allocated by a
  READ — `idErrorStateOf`'s rule, not `idStateOf`'s: no seed, so a node read only inside its chain has no row),
  `cryptoLocalOf`, `cryptoChainScope`, `attachedCryptoNodes`; `compileCryptoCall` (`compileIdNew` with the inputs, the
  port-kind check on Done/Failure sinks BEFORE the chains compile, `Completed` on UUID's sentence); the `resolveExpr` branches
  (UUID's three-question table for the verbs; the boundary's registration shape for the viewport, `screenPlanOf`); the five
  expression switches, the five action walkers (`actionsValidIn`, `snapActionList`, `scanActions`, `fillMaterialize`, the
  session-read walker), `TRIGGER_PORTS`, `OWN_CHAIN_OUTPUTS`, the binding whitelist (`isCryptoRead`, `isScreenRead`), the date
  sweep (`its Do|New is never fired by a translatable source`), and a late prune of viewport plans whose node did not collapse.
- **component.ts**: the `crypto-call` print (always the block form — the Failure arm always raises; Hash's call `await`ed;
  trailing `undefined` arguments dropped so `tryRandomBytes(16, 'base64url')` reads as written; a wired Length inside `Number(…)`),
  `errorCodeOf` → the action's code, `RAISING_ACTION_KINDS` + `actionsAwait` + `actionIsStatement` + `actionTakesNoTerminator` +
  `blockBody`'s indent list + `deepActions` + `collectActionUse` + `actionExprsOf` + `chainReadsChainLocal`; `crypto-out` /
  `screen-out` in `collectExprUse`, `hookExprSources`, `maybeUndefined`, `exprCode` (`cryptoLocalReadOf`), `effectDeps`, and the
  text-sink fold whitelist; the viewport hook line beside the boundaries', printed only for nodes an emitted expression reads
  (`usedScreenNodeIds`); the two imports earned in the walkers; `cryptoHelpers` / `screenLib` on `EmittedComponent`.
- **emitApp.ts**: the two files. **Ledger**: three rows `translated` with notes; floor **98 → 101**; six pins moved
  (`animation-pair`, `filter-records`, `object-store`, `on-app-error`, `run-tasks`, `script`).

### §59.2 The fixture — `tests/fixtures/utility-desk`

`App`: the Router alone. `Pages/Home`: a text input → `plaintext` Variable (the write-through rule, §56 E2) → Hash's Value; a
"Hash it" button → Do (SHA-256, hex authored); Digest and Error bound to two Texts; Done → Set Variable `lastDigest` ← Digest
(the Done arm's local), Failure → Set Variable `hashFailed` ← Error (the Failure arm's local); two Texts on those Variables; a
"New nonce" button → Random Bytes' New (16, base64url) with Value in a Text and nothing on Done/Failure/Error; a Screen
Resolution's three outputs in three Texts. **The reverted arm** (`probe-reverted.log`, 042f221c): the three nodes `logic node
(…)`, the two Set Variables silenced behind Hash with *"the value wire has no statically known source"* (asked from the value
side, §54.2's finding again), 13 refusals, `pathway: false`, verdict null — every node predicted, the Set Variables' sentence
predicted as the alternative. **Built**: 16 files, zero refusals, the one shell note; the page reads:

```
const hashResult = await tryHash(plaintext.get(), 'SHA-256', 'hex');
if (hashResult.ok) { setHash(hashResult.digest); setHashError(undefined); lastDigest.set(hashResult.digest); }
else { setHashError(hashResult.error); raiseAppError({ code: 'hash/failed', … nodeType: 'net.noodl.Hash' … }); hashFailed.set(hashResult.error); }
…
const nonceResult = tryRandomBytes(16, 'base64url');
if (nonceResult.ok) { setNonce(nonceResult.value); } else { raiseAppError({ code: 'random-bytes/failed', … }); }
…
const viewport = useScreenResolution();   →   {viewport.width} {viewport.height} {viewport.aspectRatio}
```

### §59.3 The gates and the arms

```
packages/nodegx-export: tsc --noEmit 0 · browser-utilities.test.ts 55/55
  §A the fixture whole + the real ts.Program (8) · §B tryHash against the real WebCrypto (8) · §B′ tryRandomBytes (5)
  §C the viewport hook under a fake window (4) · §D refusals by mutation, each sentence exact (17) · §E the shapes a wire
  changes, three of them typechecked as real programs (7) · §F the findings pinned (3) · §G the ledger and the controls (3)
logic.test.ts 29/29 (the corpus control: `if (<local>.ok)` is UUID's listed shape) · in-code-markers 54/54
whole package jest ONCE: 69 files (69 on disk: 68 + this spec), 2319 rows — 2314 green + 5 red in three files that used
  `net.noodl.Hash` as their "node with no rule" (§40 sent them there; §50 reversed it): unreported-deferrals (2), script §G
  (2), record §D (1); re-pointed to `net.noodl.PatternExtractor` (§50's own out-of-scope list) and each re-run green
  (7/7, 74/74, 29/29). No file under src/ changed after the full run.
export-ledger:check OK — 176 types, 108 translated · picker 101/127 (79.5%), floor 101, --check exit 0
arms 15/15 KILLED, every arm compiled (a "0 total" would not count — §55's rule), sources restored md5-identical after each
  (mut.py, mut-summary.txt): M1 Length `|| 32` — 2 · M2 algorithm `??` — 1 · M3 base64url keeps padding — 2 · M4 the
  synchronous requireSubtle throw escapes — 1 · M5 the resize listener never removed — 1 · M6 aspect inverted — 3 · M7 Error
  read from the Done arm allowed — 1 · M8 the sink-port-kind check removed — 1 · M9 a wired Length not Number()-coerced — 1 ·
  M10 the Failure arm no longer raises — 4 · M11 crypto-out off the fold whitelist — 2 · M12 Hash not awaited — 7 (the emitted
  app's tsc among them) · M13 the Done arm's order swapped — 2 · M14 the unread-hook prune removed — 1 · M15 a read while
  nothing fires Do allowed — 3
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §59.4 What building it found

1. 🔴 **The text-sink fold's NINTH by-hand instance.** The first build rendered `{hash}` bare and `{hashError ?? ''}` folded
   on the same page — `crypto-out` compiled, rendered, and silently did not fold, exactly as the whitelist's own comment warns
   (`id-out` was the eighth). React shows `undefined` as nothing either way; a format interpolating the digest would print the
   text "undefined". One line; pinned (A7, F1); an arm (M11).
2. 🔴 **The chain compiler asks first.** I predicted *"its Done output is consumed as a value — a pulse carries nothing to read"*
   for `nonce.done → Text.text`; the export said *"its done output drives no translatable action"* — `doneChainOf` reached the
   wire before any read did. §52.4's rule, applied: `compileCryptoCall` now reads the sink's port kind BEFORE compiling the
   chains, as `appErrorPlanOf` does. Pinned (D6); an arm (M8).
3. ⚠️ **The attach pass names an untranslatable trigger before the read can.** I predicted *"its Do is never fired by a
   translatable trigger"* for a Do wired from a Delay nothing starts; the export said *"trigger idle.finished is not a rendered
   element event or a receiver"*. The predicted sentence is the COMPILED-but-unattached case (a Do fired from a Value Changed
   nothing feeds — D9b). Both pinned; the design note's sentence was right about the kind and wrong about which pass speaks.
4. ⚠️ **A node is refused once, with the first read's sentence.** Digest and Error both read with nothing wired to Do: the
   Digest sentence names the node; the Error read is dropped under the existing disposition with the step-5 note. My row
   asserted both sentences; the second exists only when the Error is the only read (D8, D8b).
5. ⚠️ **A Variable feeding an input is read in the handler as `.get()`**, not as the render local I predicted (`plaintextValue`).
   The live read is the more faithful one — the setter's stored value at the click — and it is why a `Set Variable` earlier in
   the same chain needs no snapshot rewrite for it (F2, F3).
6. ⚠️ **A Set Variable's own Done is not a chain this exporter owns** (`state-set` has no `then`): the first F3 hung the Hash
   off `setPlain.done` and the attach pass refused the trigger. Pre-existing; the row hangs both off the nonce's Done.
7. ⚠️ **My SHA-256("é") vector was wrong** — written from memory. The row now computes it with node's own `createHash` as the
   second instrument and keeps a UTF-16 control that must differ (B4). *Pin the runtime's answer, never a remembered one.*
8. ⚠️ `Value Changed`'s input port is `value`, not `input` — read the catalog, not the display name (E7's first cut).

### §59.5 What this leaves (owner NONE unless named)

- **A Digest / Value / Error read from a SIBLING handler before the attach pass is refused with *"its Do is never fired by a
  translatable trigger"* even when Do is fired by a button** — `attachedCryptoNodes` fills in the attach pass, which runs after
  every sink has compiled, and `compiledOf` memoises the refusal. Inherited from `rowIsReadable` verbatim (the id nodes have the
  same hole; the files family keeps rows for a wired-but-unattached node instead). Owner NONE. Named in the ledger's floor comment.
- **A crypto row allocated by the sweep's diagnostic read** (a Digest wired only into an unbindable logic sink) is still written
  by the action and printed — a `useState` nobody reads. The viewport hook prunes for this case (D14); the rows do not. The id
  nodes share it. Owner NONE.
- **Two `Do` pulses in one tick** are coalesced by `scheduleAfterInputsHaveUpdated` into one digest that answers both tokens;
  the export computes once per pulse. Recorded, not translated.
- **`UUID`'s Failure arm does not raise** (`id-new` is not in `RAISING_ACTION_KINDS`) while its runtime reports `uuid/failed`
  through `reportOutcome` — §54's rule says it should. Found reading the analogue; not this row's. Owner NONE.
- **`String(algorithm)`**: the runtime passes the stored value to `digest` raw; the lib stringifies. Identical for every string;
  differs only for a non-string object over a wire, which fails in both with possibly different messages. Recorded.
- The runtime's SSR guard on Screen Resolution is not transcribed (a Vite SPA has no server render); outputs typed `number`.
- The two crypto verbs and the viewport hook are **not driven** in a built app (the orchestrator runs drives after merging). The
  libs are graded under node against the real WebCrypto (§B, 13 rows) and a fake window (§C, 4 rows).

### §59.6 The drive — the built export, headless (session 85, the orchestrator)

`emitApp` over `tests/fixtures/utility-desk` → 16 files, 0 refusals; `npm install` against the published
`@nodegx/core` 0.1.0; `tsc -b && vite build` 0; `vite preview` on :4320 under a headless Chrome (1280×800) on CDP
:9335. `EXPECTED20-drive.md` written first, six rows, six held: the boot column empty with the viewport at
`1280 / 713 / 1.7952…` (the window's 800 includes the browser's own frame — the hook reads `innerHeight`, as
`screenresolution.ts` does); *Hash it* on an empty input prints SHA-256("") `e3b0c442…b855` in both the node's Digest
and the Done chain's Variable (the runtime's `value || ''`); "abc" prints `ba7816bf…15ad` in both; *New nonce* twice
gives two distinct 22-character base64url values; zero console errors throughout. Servers torn down by pid the
moment the last row was read. `stream-desk` and `roster-desk` are not yet driven built, and the editor's write path
is not yet driven for any of the three.

### §58.6 The drive — the built export, headless (session 85, the orchestrator; recorded after §59.6)

`emitApp` over `tests/fixtures/stream-desk` → 15 files, 0 refusals; `npm install`, `tsc -b && vite build` 0; `vite
preview` on :4321 under a headless Chrome on CDP :9336. `EXPECTED21-drive.md` written first from `doParse` /
`addChunk` / `addItem`+`doFlush`, ten rows, ten held: boot all-empty; *Load A* + *Parse* leaves 17 pending characters
and no value (Success is narrower — no signal, status stays empty); *Load B* + *Parse* completes two NDJSON lines →
`[Ada, Bob]`, count 2, `isComplete` true, status "parsed"; **a bare *Parse* re-appends the retained chunk** (§58.4's
trap, now seen in a browser): `da"}` fails and line 2 parses, so Values is THIS parse's `[Bob]`, count 3, the Error
row `Line did not parse as JSON: Unexpected token 'd'…`, and ONE console line on the channel —
`net.noodl.JSONStreamParser (/Pages/Home): … [json-stream-parser/parse-failed]` with the node's provenance; *Clear*
empties values, count and error; the accumulator splits `Hello, wor` + `ld|Bye|` into two messages (accumulated "",
last "Bye", status "message"); four *Push tick* against `maxSize 3` reads size 3 / dropped 1; *Flush* hands over
`["tick","tick","tick"]`, count 1, status "flushed"; an empty *Flush* changes nothing. Servers torn down by pid.

### §57.6 The drive — the built export, headless (session 85, the orchestrator; recorded after §58.6)

`emitApp` over `tests/fixtures/roster-desk` → 15 files, 0 refusals; installed, `tsc -b && vite build` 0; `vite preview`
on :4322 under a headless Chrome on CDP :9337. `EXPECTED22-drive.md` first, two rows, two held: the three rows print
name and Item Id (`Ada/p1`, `Grace/p2`, `Linus/p3`) and the page's `lastAdded` Variable reads `p3` — every row's
Added ran once on mount, in order, the last Set Variable winning as `signalAdded` per row does in `foreach.tsx`; the
second row's *Remove* sets the page Variable to "Removed a person." and deletes nothing, which is what the fixture
wires (§57.2 — the list is static; the exit handshake stays refused). Zero console errors. Servers torn down by pid.

## §60 Tier 2.8 row 10 — the component-object trio: `Set Component Object Properties`, `Parent Component Object`, `Set Parent Component Object Properties` — own record = local state, the parent pair = context (session 86, 2026-09-05)

Type ids `net.noodl.SetComponentObjectProperties`, `net.noodl.ParentComponentObject`, `net.noodl.SetParentComponentObjectProperties`
(display names *Set Component Object Properties*, *Parent Component Object*, *Set Parent Component Object Properties*). All three are
picker nodes (`inNodePicker`, not deprecated; the Set is browser+cloud, the parent pair browser-only). Floor **105 → 108**.
This is the slice EXP-002-COMPONENT-OBJECT-TARGET §4 named three times as "not translated in this slice" (gate 3 the Set, gate 4 the
parent family, gate 7 signal-on-write) and §7 drew the upgrade path for: *the record materializes as component state; aliases become
state reads; mirror wires become sync effects*. Richard's ruling (§50, the Tier 2.8 table): *own store = local state; the parent pair = context*.

### §60.0 Design — what the nodes are on disk, and what that decides (written before a line of code)

**The record.** `componentobject.ts`: one `Model` per component *instance* (`componentState<instanceId>`), create-on-read, booting empty;
every node of the family in that instance shares it. `Component Object`'s `value-X` inputs are continuous mirrors (`scheduleStore` at
frame end); its `value-X` outputs are `model.get(X)`; `changed`/`changed-X` fire off the model's `change` event, which `Model.set`
raises **only when the value differs** (`model.ts:347`, `oldValue !== value`).

**`Set Component Object Properties`** (`base.ts` + `setcomponentobjectproperties.ts`): on `Do` (`store`), `scheduleStore` →
`Model.get('componentState' + own instance id)` — *cannot miss*, which is why the node has **no Failure and no Error port by design**
(`canFailToResolve` is opt-in and the self variant does not opt in) — then for each key in the node's **own `properties` list** that is
present in `inputValues`, `model.set(key, value, { resolve: true })`; then `done`, then `completed`. 🔴 **Verified in `base.ts`, and it is
NOT the modelcrudbase rule the brief predicted:** `_pushInputValues` there abstains on an `undefined` value; here `keysToSet` is
`Object.keys(inputValues)` filtered by the list — a key **never delivered** is absent (abstains by absence), a key delivered as `undefined`
**is written as `undefined`**. The `type-<p>` inputs are registered with an empty setter — inert on the write path, no Array/Object eval
(unlike §47's node). An authored literal on a `prop-<p>` port is delivered at creation like any parameter, so it is in `inputValues` and
is written — a literal entry in the patch (§47 only reads wires; recorded as a residual there).

**`Parent Component Object`** (`parentcomponentobject.ts`) walks the *visual* parent chain (`componentwalk.ts`: first root's visual
parent, else `parentNodeScope`) for the **nearest ancestor that owns a `net.noodl.ComponentObject` (or deprecated `Component State`)
node** — or, with `Parent Component` set, the ancestor *named* so (`target-not-found` / `target-has-no-object` distinct misses). It
binds to that record: `value-X` outputs read it (`undefined` while unbound), `value-X` inputs **write** it (`scheduleStore` — a write
through the reader node), `changed`/`changed-X`/`fetched`/`done` are its signals, `fetch` republishes; a miss is raised **once, after
the deferred first resolution** (`reportMiss`: `parent-component-object/no-ancestor`, `Failure` pulses, `Error` carries the sentence).
**`Set Parent Component Object Properties`** walks the same way on `Do`, writes the same way as the self variant, and on a miss writes
nothing, sets `Error`, raises `set-parent-component-object-properties/no-ancestor` and pulses `Failure` (`canFailToResolve: true`).

**What that decides — the shape.**

1. **A `Component Object` node has a mode, decided once per node.** *Alias* (EXP-002 §3 unchanged — the record compiles away) when no
   `Set Component Object Properties` sits in its component AND no descendant (instances + For Each templates, transitively —
   `parentFamilyReachesThisRecord`, the existing gate-4 walk) hosts a parent-family node. *Record* otherwise. This answers (a): a read
   is an alias **or** a state read, by the node's mode, never both; the two cannot print together because the mode is a property of
   the node, not of the wire.
2. **In record mode the record is a per-instance hook**, `const <local> = useComponentObject<<Local>Record>()` from
   `src/lib/componentObject.ts` — `useState` for the render snapshot (`<local>.value`) plus a `useRef` for the live read
   (`<local>.get()`), and `set(patch)` which writes **every own key of the patch** (undefined included — `base.ts`'s rule) and bumps state
   only when a key changed (`Model.set`'s rule). Not `@nodegx/core`'s `store()` — that is module-level and keyed by name (§47's named
   Object, one per app); this record is one per component *instance*, which is what `useState` is. Reads: render prints
   `<local>.value.X`, a handler prints `<local>.get().X` — live, as `model.get` is, so a Done chain reading a key the same handler just
   wrote sees the new value with no snapshot rewrite (the Variable's `.get()` precedent, §59.4 finding 5). Every `value-X` **mirror
   wire** becomes a mirror effect `useEffect(() => { <local>.set({ X: <src> }); }, [deps])` (§7's "sync effects"); a key's TS type is
   `string` when every own writer (Set entries + mirrors) is string-typed, else `unknown` (§47's vacuous-`every` correction: no writer ⇒
   `unknown`). The component's root JSX is wrapped in `<ParentComponentObjectContext.Provider value={<local>}>` — the transcription of
   "this component owns a Component Object", which is exactly the predicate `findAncestorWithComponentObject` tests. Shadowing is
   therefore right by construction: an intermediate component with its own Component Object is in record mode (the descendant reach
   forces it) and provides, so the nearest provider is the nearest owner.
3. **The parent pair read the nearest provider through `useParentComponentObject<<Local>ParentRecord>(readers)`** — one hook per
   component (every parent-family node in a component resolves the same nearest ancestor), `undefined` at the root. Keys typed
   `unknown` (a descendant cannot know its host) and coerced at the sink as an untyped Variable is (`String(x ?? '')`). The hook
   raises `parent-component-object/no-ancestor` once per reader site at mount when there is no provider — the loud point of
   `nodeScopeDidInitialize`, guarded against StrictMode's double mount — and every read answers `undefined`, which is (d)'s runtime
   answer transcribed. (d) two different parents: context, naturally. (e) a For Each template row: the row renders inside the host's
   JSX, so the provider reaches it — fixtured (`PanelRow`).
4. **`Set … Properties` is a handler action** `component-object-set`: own → `<local>.set({ title: titleText, note: 'renamed' })` with
   the Done chain, then the Completed chain, as following statements (one arm, always taken — `object-set`'s treatment); parent →
   the block form: `if (<pl> === undefined) { raise no-ancestor; <Failure chain> } else { <pl>.set({ … }); <Done chain> }`.
5. **Named `Parent Component` — REFUSED BY NAME** in this slice, on both parent nodes: the context carries the nearest owner only;
   resolving a *name* needs either a chain of providers or a static ancestor map, and the corpus has one Parent Component Object
   (Puppy test) with no name set. (b) **signal-on-write — REFUSED BY NAME**, with the sentence saying which: a `changed`/`changed-X`
   consumer on any of the three record nodes is a write-notification effect this slice does not emit; the record's readers re-render
   on every write instead. (c) **Fetch stays refused** on both readers. **Error on the parent pair — REFUSED BY NAME**: the only
   message it can carry is the miss sentence, which the raise already reports on the channel. **Failure on the parent Set —
   translated** (the `else` arm's twin); **Failure on the parent reader — refused by name** (a mount-time pulse chain; the raise is
   transcribed, the branch is not).

**Refused by name, every sentence predicted** (graded in the spec by mutation):

- Own Set: `its component has no Component Object node — the record it writes is read by nothing statically translatable (a Function's Component.Object is deferred)` · `its Properties list is empty, so Do writes nothing` · `nothing is wired into any of its properties, so Do writes nothing` · `two wires feed its "X" — last-writer-wins is not statically ordered` · `its "X" has no statically known source` (or the feeder's) · `its "X" is fed a logic truth value — only truthiness sinks take one in this slice` · `its Component Object node is refused — <the host's own sentence>` · `its Done output drives no translatable action` · `its Do is never fired by a translatable source` (the sweep) · a `prop-X` wire the list does not name: dropped with `"X" is not in the node's Properties list, so the runtime never writes it — dropped`.
- Parent Set adds: `its Parent Component names "<X>" — this slice resolves the nearest ancestor record only; a named ancestor is not translated` · `its Parent Component is wired — which ancestor it writes is not statically knowable` · `its Error output is consumed — the miss message is raised on the error channel (set-parent-component-object-properties/no-ancestor) rather than exposed as a row in this slice` · `its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them` · `its Failure output drives no translatable action`.
- Parent reader: the two Parent Component sentences (reads) · `its Fetch is wired — a batch republish with Fetched/Done ordering is signal work this slice does not translate` · `Parent object is unticked under Run On Value Change — its outputs freeze between Fetch pulses` · `its <port> signal is consumed — signal-on-write is not translated in this slice; the record's readers re-render on every write instead` (changed, changed-X, fetched, done, completed) · `its Failure signal is consumed — a missing ancestor is raised on the error channel once at mount (parent-component-object/no-ancestor) and not branched on in this slice` · `its Error output is consumed — …` · `its "X" property input is wired — a write through the Parent Component Object node itself is not translated in this slice; a Set Parent Component Object Properties is` · `property "X" is a dotted path the record would resolve through nested models` · `its <port> output is consumed as a value — a pulse carries nothing to read` · `its <port> output is not a port this node has` · `component emits no file to host the parent record` · unread: `its properties feed nothing statically translatable`.
- `Component Object` in record mode keeps gates 1, 2, 5, 6, 7 with their sentences; gates 3 and 4 are gone. Its `changed`
  sentence is re-worded to the one above (the old one said "belongs to the component-state slice" — this is that slice, and it says no).

**Not translated, recorded:** the runtime resolves the parent one update pass late (`nodeScopeDidInitialize`'s deferral) and mirrors
land end-of-frame; the mirror effect lands after the first paint — the same one-tick lag, on the other side. A `Set` writes N keys
with N `change` notifications; one patch, one render. The deprecated `Component State` node is not a provider here (it is not a picker
node and not in the ledger's population).

**Decided on the way (against §60.0 as first written):** in record mode an out-of-vocabulary read is the **wire's**
refusal, never the node's — the record is real state (a Variable read into a margin drops the wire, the Variable
stays), where alias mode's node-level defer is right because the alias *is* the wire. And the mirror-source check
moved from the verdict loop into the gate: pass 4d binds reads of the record before the verdict runs, so a late
refusal would have left bound reads pointing at a hook that never prints.

### §60.1 What is emitted

- **`src/lib/componentObject.ts`** (`src/emit/componentObjectLib.ts`, new): `useComponentObject<T>()` — a lazy `useState`
  per mount (the instance), a `useRef` beside it, `get()` live, `set(patch)` writing every own key of the patch (undefined
  included — `base.ts`) and bumping state only when a key changed (`Model.set`'s `oldValue !== value`), the handle memoised
  on the value so a Provider's consumers re-render exactly when the record does; `ParentComponentObjectContext`
  (`createContext<ComponentObject<Record<string, unknown>> | undefined>`); `useParentComponentObject<T>(readers)` — the
  context, and a once-guarded mount effect raising `parent-component-object/no-ancestor` per reader site when it is
  `undefined`; the two miss messages exported verbatim. Imports `./errors`, so it earns `errors.ts` (`emitApp.ts`).
- **The host** (record mode): `type <Local>Record = { title?: string; count?: unknown; note?: string }` at module level;
  `const panelState = useComponentObject<PanelStateRecord>()` after the state rows; one mirror effect per wired `value-*`
  input beside the sync effects — `useEffect(() => { panelState.set({ note: noteValue }); }, [noteValue])`; render reads
  `panelState.value.title ?? ''` (a string key folds bare) / `String(panelState.value.count ?? '')` (any other type, once);
  handler reads `panelState.get().title`; the Set `panelState.set({ title: title, note: 'renamed' })` with Done then
  Completed as following statements; the root JSX wrapped in `<ParentComponentObjectContext.Provider value={panelState}>`.
- **A descendant**: `type PanelParentRecord = { title?: unknown; note?: unknown; count?: unknown }`;
  `const parentObject = useParentComponentObject<PanelParentRecord>([{ nodeId, nodeType, componentName }])` (the reader sites
  that collapsed; none for a component with only a parent Set); reads `String(parentObject?.value.title ?? '')`; the parent
  Set in the block form — `if (parentObject === undefined) { raiseAppError({ code: 'set-parent-component-object-properties/no-ancestor', message: 'No ancestor component has a Component Object node — nothing was written', … }); <Failure chain> } else { parentObject.set({ count: 1 }); <Done chain> }`.
- **plan.ts**: `SET_COMPONENT_OBJECT_TYPE` / `PARENT_COMPONENT_OBJECT_TYPE` / `SET_PARENT_COMPONENT_OBJECT_TYPE`,
  `NO_ANCESTOR_WRITE_MESSAGE`; `ValueExpr` gains `component-object-out { nodeId, local, key, parent, tsType }`;
  `HandlerAction` gains `component-object-set { nodeId, local, parent, entries, then, completedThen, failThen }`;
  `ComponentObjectRecordPlan` / `ParentComponentObjectPlan` on `ComponentPlan.componentObject` / `.parentObject`;
  `componentObjectModeOf`, `componentObjectKeysOf`, `uniformTypeOf`, `componentObjectRecordOf` (registered BEFORE its
  writers are typed, so a self-mirror cannot recurse), `parentObjectPlanOf`, `parentReaderGate`,
  `parentComponentObjectReadExpr`, `compileComponentObjectSet` (the sink port-kind check before the chains, §59.4's rule);
  the gate's record-mode block (mirror sources checked there, memo pre-set against re-entry); the record-mode arm of the
  Component Object verdict; the Parent Component Object verdict; the never-fired sweep for the two Sets; the reader prune;
  `resolveExpr`'s three new branches; the five expression switches; `actionsValidIn` / `snapAction` / `scanActions` /
  `walkActions` / `fillMaterialize`; `TRIGGER_PORTS`; the `outputRead` control-mint clause (tenth family); pass 4d admits
  the parent read.
- **component.ts**: `usedParentObject`; `printsRecord` (the plan registered a record AND its node collapsed) /
  `printsParent`; the lib import; `useEffect` for the mirrors; the type aliases before the props interface; the two hook
  lines after the state rows; the mirror effects beside the sync effects (their sources through `hookExprSources` — the
  first emit closed over the store object); the Provider around the return; `component-object-out` in
  `collectExprUse` / `hookExprSources` / `maybeUndefined` / `exprCode` / `effectDeps` / the fold whitelist (string keys
  only) / `bindingExpr`'s coercion table; `component-object-set` in `collectActionUse` / `deepActions` / `inAction` /
  `expandActions` (own form) / `actionCode` (both forms) / `errorCodeOf` / `actionIsStatement` / `actionTakesNoTerminator`
  / `blockBody` / `actionExprsOf` / `raisesAppErrors`; `recordKeyAccess` / `recordKeyDeclaration` (a hyphenated key
  brackets). **emitApp.ts**: the file, and `errors.ts` earned by it. **Ledger**: three rows `translated`; floor **105 →
  108**; eight pins moved (`animation-pair`, `browser-utilities`, `filter-records`, `on-app-error`, `object-store`,
  `run-tasks`, `script`, `streaming-trio`).
- **Refused by name**: every sentence of §60.0's list, unchanged in wording except two the build corrected — a Done /
  Completed / Failure wired into a value port is `its <Port> output is consumed as a value — a pulse carries nothing to
  read` (decided from the port kind before `doneChainOf` speaks), and a parent reader's signal wired anywhere is the
  whole-node gate's sentence first.

### §60.2 The fixture — `tests/fixtures/panel-desk`

`App`: the router. `Pages/Home`: a text input `titleInput` → `setTitle.prop-title`; a Rename button → `setTitle.store`
(`properties: title,note`, `prop-note` authored `"renamed"`); `setTitle.done → setStatus` (`status ← "Renamed."`);
`panelState` (`properties: title,count,note`) → three Texts; `noteVar` (Variable `note`) → `panelState.value-note` (the
mirror); a `Panel` instance; `rows` (For Each over a two-row Static Data, template `PanelRow`). `Components/Panel`:
`parentState` (`title,note`) → two Texts; a Bump button → `bump` (`Set Parent Component Object Properties`, `count`
authored `1`), `done → setBumped` (`"Bumped."`), `failure → setBumpFailed` (`"No parent panel."`); a Text on the status.
`Components/PanelRow`: `name` input → Text; `rowParent` (`title`) → Text.

**The reverted arm** (`probe-reverted.log`, HEAD 2a2dd4fa): `panelState` deferred with gate 3's sentence, `setTitle` /
`parentState` / `bump` / `rowParent` as `logic node (…)`, the three Set Variables silenced behind them, **14 refusals**,
no pathway — every node predicted; the Set Variables' sentence was *"nothing is wired into value"* rather than the
cascade's, because the first fixture authored the values as parameters and a `Set Variable` takes a wire (fixed with
three `String` nodes, roster-desk's shape). **Built**: 19 files, 0 refusals, the shell note; the real `tsc` clean.

### §60.3 Gates

```
packages/nodegx-export: tsc --noEmit 0 (after every stitch) · component-object-trio.test.ts 60/60
  §A the fixture whole + the real ts.Program + the handler read (11) · §B the lib under a fake React (8) · §C the own Set's
  refusals (10) · §D the parent Set's (7) · §E the parent reader's (11) · §F record mode vs alias mode (7) · §G the findings,
  the ledger, the lib's surface (6)
component-object.test.ts: two pins flipped to positive rows (gate 3 ⇒ record mode with a hook, a Provider, the mirror as an
  effect, the Set named "nothing fires its Do"; gate 4 ⇒ record mode with a Provider) — 22/22
neighbours re-run in band, green: unreported-deferrals, in-code-markers, logic, cascade, typecheck-emitted + the eight pin
  specs — 14 files, 655/655
export-ledger:check OK — 176 types, 115 translated · picker --check 108/127 (85.0%), floor 108, exit 0 (was 105)
arms 18/18 KILLED (mut.py, mut-summary.txt), every arm compiled, sources restored md5-identical after each: M1 set() skips
  undefined — 1 · M2 re-render on no change — 2 · M3 get() reads the snapshot — 1 · M4 the once-guard on the mount raise — 1 ·
  M5 the gate admits an untranslatable mirror — 1 · M6 record mode ignores the descendant reach — 1 · M7 a named Parent
  Component silently the nearest — 1 · M8 an authored prop literal skipped — 12 · M9 a handler read prints .value — 1 · M10 no
  Provider — 2 · M11 the mirror effect loses its dependency — 1 · M12 the string key off the fold whitelist — 2 · M13 the
  port-kind check removed — 3 · M14 the miss arm no longer raises — 2 · M15 the Sets off the control-mint clause — 10 ·
  M16 the lib no longer earns errors.ts — SURVIVED on the first run (the Panel's own raise earned it) ⇒ G6 written (readers
  alone still ship errors.ts, typechecked) ⇒ KILLED — 1 · M17 the reader's value-* input gate removed — 1 · M18 every key
  typed unknown — 5
whole package jest ONCE, alone at load 5.4: 72 files (72 on disk = 71 + this spec), 2521/2521, exit 0; no file under src/ changed after it
  (an earlier run was stopped and re-run once: the Provider wrap indented blank lines — nine whitespace-only lines — fixed before the run that counts)
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §60.4 What building it found

1. 🔴 **The mirror effect closed over the STORE OBJECT — the hooks-walker trap's twelfth instance, and the brief's own
   warning.** The first emit printed `panelState.set({ note: note })` with deps `[note]` and no import of `note`: my
   mirror sources never passed through `hookExprSources`, so the `useValue(note)` hook line was never earned. One line at
   the sync-effects' walker site; pinned (A7, G1); an arm (M11 is the deps, the store-object shape is G1's `not.toContain`).
2. 🔴 **A non-string key folded twice** — `{String(panelState.value.count ?? '') ?? ''}`: my `bindingExpr` coercion and the
   text-sink fold whitelist both fired. The whitelist now admits a `component-object-out` only when its `tsType` is
   `string`; pinned (A7, G2); an arm (M12).
3. 🔴 **`base.ts` does NOT abstain on `undefined`** — the brief said "as the modelcrudbase family does — VERIFY": `keysToSet`
   is `Object.keys(inputValues)` filtered by the list, no undefined filter; a key never delivered is absent, a key delivered
   as `undefined` is written. The lib writes every own key of the patch (B3); an unfed key is absent from the patch (C3).
4. 🔴 **An authored `prop-<key>` literal is delivered and written.** §47's compile reads wires only and silently skips an
   authored literal on a `Set Object Properties` property; `base.ts` (and `modelcrudbase`) receive parameters into
   `inputValues` at creation. This slice writes the literal (`note: 'renamed'`, G3, M8 — 12 rows red without it); §47's
   node is registered below.
5. 🔴 **The chain compiler asks first — §59.4's finding 2, met again.** A Completed wired into a Text said *"drives no
   translatable action"*; the port-kind check now runs before `doneChainOf`, for all three chain ports (C7, C9, D5; M13).
6. ⚠️ **A click-attached sink's disposition is `into: <trigger id>`**, not the file — the attach pass's norm; my A4 first
   asserted the file for the Sets (the reads register the record node into the file, the Sets collapse into their button).
7. ⚠️ **A `Set Variable` takes a wire, never an authored value** — the first fixture authored `"Renamed."` as a parameter and
   every Set Variable refused with *"nothing is wired into value"*. Three `String` nodes, roster-desk's shape.
8. ⚠️ **A `Variable2`'s authored initial value (`value: "First note"`) is not seeded** — the emitted store boots
   `value<string | undefined>(undefined)` and nothing writes it; the mirror effect therefore writes `undefined` on mount.
   Pre-existing, not this row's (registered below); the fixture keeps the Variable because it is the shape that pins
   finding 1.
9. ⚠️ **The parent reader's whole-node gate speaks before a value-read of its signal does** — `fetched → Text.text` is
   *"its fetched signal is consumed — …"*, not *"consumed as a value"*; honest, and pinned as such (E10).
10. ⚠️ **M16 survived on the first run**: the Panel's own miss-arm raise earned `errors.ts`, so the lib's own import of it
    was unobserved. G6 (readers alone, typechecked) is the row; killed on the second run.

### §60.5 Residuals (owner NONE unless named)

- **A named `Parent Component`** on either parent node is refused by name. The translation is a chain of providers (each
  owner's Provider value carrying its name and the outer handle) so the hook can walk by name, plus a static check that the
  named component owns a Component Object; the corpus has no named target. Owner NONE.
- **Signal-on-write** (`changed`, `changed-<p>`, `fetched`, `done`, `completed` on the three record nodes) is refused by
  name; the honest translation is a per-key change effect on the record with a previous-value ref (StrictMode-safe). Owner NONE.
- **`Failure` / `Error` on the parent reader** — the mount-time raise is transcribed (the lib), the pulse chain and the row
  are refused by name. `Error` on the parent Set likewise (its only message is the miss sentence, raised). Owner NONE.
- **A key written only from a descendant is typed `unknown` on the host** (`count` in the fixture) — the host cannot see the
  child's literal; a project-wide pass over parent Sets could type it. Owner NONE.
- **`Set Object Properties` (§47) skips an authored `prop-<key>` literal** where the runtime writes it — one clause in
  `compileSetObjectProperties`, mirroring this row's. Owner **EXP-011**.
- **A `Variable2`'s authored initial value is not seeded** into the emitted store (finding 8) — **CONFIRMED observable by the §60.6
  drive (boot reads `''` where the runtime reads `First note`); the fix shape is a MOUNT WRITE in the host, per mount, not a seed**. Owner **EXP-011** (a store
  module boot value; not this row's node).
- **The deprecated `Component State` node** is a resolvable ancestor in the runtime (`COMPONENT_OBJECT_TYPES`) and is not a
  provider here; it is not a picker node. Owner NONE.
- **A host whose Component Object is refused** (gates 1/2/5/6/7) leaves its descendants' parent reads answering `undefined`
  with a mount raise — the host's refusal is reported, the descendants are not told. Owner NONE.
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed:
  Rename → the three Texts, the Panel and both rows follow; Bump → count `1` on the page; the mirror on mount.

### §60.6 The drive — the built export, headless (session 88, 2026-09-05)

`panel-desk` emitted (19 files, 0 refusals), `npm run build` exit 0 with 0 `error TS`, `vite preview` 4360, Chrome headless 9360, read
through `cdp.js eval --target=Panel` — every `<p>`, every button, every input, `window.__errs` (window errors, unhandled rejections and
`console.error`, which `raiseAppError` writes to). `EXPECTED-60-62-63.md` was written before the drive; every row graded against it:

- **P1 boot** — 12 `<p>`: headline, then `''` for title / count / note / status, `''` ×3 on the Panel, `Ada` / `''` / `Grace` / `''` on the
  rows; buttons `Rename`, `Bump`; errs `[]`. ✓ as predicted — **including the registered divergence**: the fixture's `note` Variable is
  authored `value: "First note"`, and the runtime delivers that on the node's creation (`variablenode2.ts`: the `value` input's setter
  schedules a store), so the runtime's Home AND Panel note Texts read `First note` at boot where the export reads `''` (the emitted store
  boots `undefined`; the mount mirror writes `note: undefined`). §60.4 finding 8 / §60.5, owner EXP-011 — CONFIRMED observable. The honest
  translation is **a mount write in the host** (`useEffect(() => note.set('First note'), [])`), not a module-level seed: the runtime
  rewrites the value on EVERY mount of the component that holds the node, so navigating back to Home resets the variable there.
- **P2** type `Quarterly` → the controlled input reads it ✓. **P3 Rename** → title `Quarterly` on Home, the Panel and BOTH rows; note
  `renamed` on Home and the Panel; status `Renamed.`; count still `''` ✓ (one `set` with two keys, one re-render through the Provider).
- **P4 Bump** → count `1` on Home, the Panel's status `Bumped.`; no `no-ancestor` raise ✓ (the child wrote the parent's record through
  the context). **P5 Rename again** (input unchanged) → READ byte-identical to P4 ✓ (no key changed ⇒ `set` returns before `setValue`).
  **P6** type `Annual`, Rename → `Annual` ×4, count `1`, note `renamed` ✓.
- **P7** errs `[]`; a reload with `cdp console` streaming shows only the favicon 404 — **no `parent-component-object/no-ancestor` at boot**
  for the Panel or either row ✓ (all three sit under Home's Provider).

Cannot see: the `changed` / `fetched` pulses (refused by name; nothing in the fixture observes them); a named Parent Component (none).

## §61 Tier 2.8 row 11 — the component-stack trio: `Component Stack`, `Push Component To Stack`, `Pop Component Stack` — a push is a call, a pop is its return (session 86, 2026-09-05)

Type ids `Page Stack` (display *Component Stack*), `PageStackNavigate` (*Push Component To Stack*), `PageStackNavigateBack`
(*Pop Component Stack*) — the eleventh row of §50's list, the one §16 re-tiered behind its container. All three are in the
picker population (`inNodePicker`, none deprecated), so the floor moves **105 → 108**.

### §61.0 Design — what the three are on disk, and what they become

**The port sets, read off the catalog and the three runtime files** (`navigation-stack.tsx`, `navigate.ts`, `navigate-back.ts`,
`navigation-handler.ts`):

| node | inputs | outputs |
|---|---|---|
| `Page Stack` | `name` (string, default `Main`), `useRoutes` (boolean, default false), `clip` (boolean, default true), `pages` (proplist `{id,label}[]`), per page `pageComp-<id>` (component) and — only with `useRoutes` — `pagePath-<id>`, `startPage` (enum of page ids, default `pages[0].id`), `reset` (signal), the visual style ports | `topPageName` (string, boots `''`), `stackDepth` (number, boots 0), `done`, `failure`, `completed`, the visual outputs |
| `PageStackNavigate` | `stack` (string, default `Main`), `mode` (enum push/replace, default push), `navigate` (signal), `target` (enum of the stack's page ids, default `pages[0].id`), `transition` (enum, default Push / None per mode) + `tr-*`, `pm-<input>` per Component Input of the target | `done`, `unchanged`, `failure`, `completed`, `error`, `backAction-<a>` (signal) per back action any Pop in the target declares, `backResult-<k>` (`*`) per result any Pop declares |
| `PageStackNavigateBack` | `navigate` (signal), `results` (stringlist, edit-only), `backActions` (stringlist, edit-only), `result-<k>` (`*`) per result, `backAction-<a>` (signal) per back action | `done`, `unchanged`, `failure`, `completed`, `error` |

**What the runtime does with them.** A stack REGISTERS by name in a module-level singleton (`NavigationHandler.instance._pageStacks`,
keyed `name || 'Main'`, an ARRAY per name) when its React component mounts, and registration RESETS it (the start page is created
then; before that the stack is empty, `topPageName` `''`, depth 0 — the runtime paints an empty stack first too, `resetAsync` runs
through the async queue). A push is `NavigationHandler.navigate(name, args)`: every stack under that name gets it; with NONE registered
the push is QUEUED and replayed on the next registration (which resets first). `navigateAsync`: refuses (via `hasFailed`) on an empty
Components list, a transition in progress, or a target not in the list; answers `hasUnchanged` when the top entry already shows that
page with shallow-identical params (`_isAlreadyShowing`); otherwise creates the component, sets each `params[k]` on its Component
Inputs (`content.setInputValue`), installs `back` as the callback of every `PageStackNavigateBack` in the pushed component's OWN scope
(`getNodesWithType`, NOT recursive — a Pop one component below never receives it), pushes `{ page, params, backCallback }`, writes the
two outputs, syncs the url ONLY if `useRoutes`, starts the transition, and calls `hasNavigated` — synchronously, before the transition
ends. `replaceAsync` is the same with `stack = [entry]`, the no-op only at depth 1, and NO back callback installed. `back(args)`:
depth ≤ 1 → `{ ok:false, unchanged:true }`; transitioning → failure `pop-component-stack/transition-in-progress`; else invokes the
top entry's `backCallback(action, results)`, writes the outputs for the entry below, animates, pops. The pusher's callback stores
`results`, flags every `backResult-<k>` dirty and THEN sends the `backAction-<a>` signal. The Pop's `navigate`: reads and CLEARS the
pending back action, then no callback → failure `pop-component-stack/no-stack-in-scope` ("No Component Stack to pop — this node only
works inside a component that a Component Stack pushed"), else `done`/`unchanged`/`failure` by the result. Both nodes' `reportFailure`
sets `lastError` (the `Error` output), and `reportOutcome(…, 'failure')` raises the code on the NDA-004 channel before the pulse.
`reset` (the input) → `scheduleReset` → `resetAsync`: tears everything down, rebuilds the start page, reports `done`; failure only
with no components or an unresolvable start page. The mount-path reset reports nothing.

**The design — one lib, a visual role, two actions, one reserved prop.**

- **`src/lib/pageStack.ts`** (`src/emit/pageStackLib.ts`): `navigation-handler.ts` transcribed — a MODULE-LEVEL registry
  `Record<name, PageStackStore[]>` plus the navigation queue, `pushComponent(name, args)` / `replaceComponent(name, args)` with the
  runtime's callback shape (`hasNavigated` / `hasUnchanged` / `hasFailed` / `backCallback`); a `PageStackStore` class with
  `navigate` / `replace` / `back` / `reset` transcribed from `navigation-stack.tsx` minus the transition and the url (`_isAlreadyShowing`
  verbatim, the three failure codes and sentences verbatim, `from: null` on replace, no back handle on reset/replace);
  `usePageStack({ name, pages, startPage })` — one store per mount (`useState(() => new …)`), a version counter for re-render,
  register in an effect (which resets — the runtime's `didMount`), deregister in its cleanup; returns `{ top, topPageName,
  stackDepth, reset }`; `popComponent(handle, args): StackBackResult` — `navigate-back.ts`'s `navigate` with the no-callback failure;
  the `PageStackEntryHandle` type. **Why a module-level registry and not React context:** the runtime resolves a pusher to its stack
  BY NAME through a singleton, and a pusher legitimately sits outside the stack's subtree (a tab bar beside the stack, a button in
  the page that hosts it); context reaches descendants only and would refuse the tab bar, the row's whole second use case. Nesting
  costs nothing: two stacks are two names. **Why the Pop reaches its stack through a PROP and not context:** the runtime hands the
  callback to the Pop nodes in the pushed component's own scope only (`getNodesWithType`, non-recursive) — a prop the stack row
  passes to the component it shows is exactly that reach, and a component placed elsewhere or shown by `Reset`/`Replace` gets no
  prop and answers the runtime's own `no-stack-in-scope` failure.
- **The `Page Stack` is a visual role `'stack'`** (a `StyleRole` too: the runtime's `defaultCss` — `width:100%; flex:1 1 100%;
  position:relative; display:flex; flex-direction:column; overflow:hidden` unless `clip` is authored false — becomes its class).
  Its hook line prints beside the other hooks; the row renders the top entry, one `&&` line per page (session 86; session 87 changed the row to render EVERY entry with the ones below the top hidden — §61.6, the drive):
  `{wizard.top?.pageId === 'details' && <StepDetails key={wizard.top.key} {...(wizard.top.params as StepDetailsProps)} pageStackEntry={wizard.top.handle} />}`
  (`key` is the entry's — every push creates a fresh instance in the runtime; the spread only where the target declares props;
  `pageStackEntry` only where the target's plan keeps a Pop). `topPageName` / `stackDepth` reads are `stack-out { local, field }`
  off the handle, in both contexts (a handler closes over the latest render, which is what the getter answers). `reset` wired →
  action `stack-reset { local, then }`: `wizard.reset();` then the Done chain.
- **The pusher** is action `stack-push { stack, mode, target, params, backResults?, backActions, then, unchangedThen }`, printed as
  the runtime's own call:
  ```
  pushComponent('Main', {
    target: 'details',
    params: { email: emailText },
    backCallback: (action, results) => {
      setIntroBackResults(results);
      if (action === 'confirm') { … }
    },
    hasNavigated: () => { … },
    hasUnchanged: () => { … }
  });
  ```
  A `pm-<port>` value is the authored literal or the wire (handler context; `String(x ?? '')` where an untyped source lands on a
  string input, the untyped-Variable rule; a type the target does not declare is refused by name); the prop key is the target's
  own identifier for the port. `backResult-<k>` reads: inside a `backAction-*` chain → `results.<k>` (the runtime flags the
  outputs dirty BEFORE sending the signal, and a React state read there would be the stale closure); anywhere else → one row per
  pusher `useState<Record<string, unknown>>({})`, allocated by a read, typed `unknown` (the port is `*`), folded at a text sink as
  an untyped Variable is. `replaceComponent(…)` for Replace mode — no callback, as the runtime installs none.
- **The Pop** is action `stack-pop { backAction?, results, local, then, failThen }`, always the block form (the Failure arm raises
  `pop-component-stack/no-stack-in-scope` on the channel, §54's rule):
  ```
  const popResult = popComponent(pageStackEntry, { backAction: 'confirm', results: { email } });
  if (popResult.ok) { … } else if ('code' in popResult) { raiseAppError({ code: 'pop-component-stack/no-stack-in-scope', … }); … }
  ```
  (`'code' in` is the runtime's own discriminant: an end-stop answers `unchanged`, never a code.)
  ```
  ```
  The host component's interface grows the reserved prop `pageStackEntry?: PageStackEntryHandle` (a declared port of that name
  refuses, Close Popup's `onClose` rule). A `result-<k>` value is read where the setter stored it — the render expression the
  handler closes over. `Error` is read inside the Failure arm as `<local>.message`.
- **Cross-component facts are indexed once from the IR** (`popupTargetLegacies`' shape): every `Page Stack` in the project, by name,
  with its pages resolved to components and its own refusal (if any) — so a pusher in any component knows its stack, and a Pop
  knows whether any stack lists its host.

**Refused by name** (every sentence predicted here, graded by mutation in §D of the spec):

- `Page Stack` (the whole node, as a visual refusal — nothing renders where it sat, marker + note):
  `its Use Routes is ticked — the stack then writes the browser url (history.pushState) and reads its start component back from it, which this slice does not translate; untick it, or route the pages` ·
  `its Name is wired — a pusher finds its stack by name statically, and a name that arrives on a wire has no pusher this export can bind` ·
  `its Components list is wired — the pages it can show are its structure` ·
  `its Components list is empty — the runtime reports component-stack/no-components at mount and shows nothing` ·
  `its component "<label>" names no component — the runtime cannot show it (component-stack/component-not-found)` ·
  `its component "<label>" is <legacy>, which exports no component` ·
  `its component "<label>" is <legacy>, a routed page — a Component Stack shows components; a page has a url of its own` ·
  `its Start Page is wired — which component the stack starts on is its structure` ·
  `its Start Page "<id>" is not in its Components list — the runtime reports component-stack/component-not-found at mount` ·
  `its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them` ·
  a `Failure` wire is DROPPED with a note (dead: the two mount failures are excluded statically by the gates above) ·
  a `Done` wire with `Reset` unwired is dropped with a note (the mount-path reset reports nothing).
- Pusher: `its Stack is wired — which Component Stack it pushes onto is a runtime value; this slice binds a pusher to a stack by its authored name` ·
  `no Component Stack in the project is named "<name>" — the runtime queues the push until one mounts, and none ever will` ·
  `it pushes onto the Component Stack "<name>", which did not translate — <reason>` ·
  `two Component Stacks are named "<name>" and show different components for "<target>" — the pusher's parameters are minted from one of them` ·
  `its Mode is wired — push and replace are two different calls` · `its Target Page is wired — which component it pushes is a runtime value` ·
  `its Target Page "<id>" is not in the Components list of the stack "<name>" — the runtime reports push-component-stack/component-not-found` ·
  `its Transition is wired — the export switches components without animation, and a wire choosing one would be a wire into nothing` (same for `tr-*`) ·
  `its "<port>" parameter is fed a <given> where <legacy> declares "<port>" as <declared>` ·
  `its "<port>" parameter is fed a logic truth value — only a boolean input takes one` ·
  `its Back Action "<a>" is wired, but in Replace mode the stack installs no back callback (navigation-stack.tsx replaceAsync) — the chain would never fire` (and the same for a `backResult-*` read) ·
  `its Back Action "<a>" is not one the target's Pop Component Stack declares` · `its Back Result "<k>" is not one the target's Pop Component Stack declares` ·
  `its Done|Unchanged output is consumed as a value — a pulse carries nothing to read` ·
  `its Completed output is consumed — …` (UUID's sentence) ·
  `its Error is read, and with a literal Target inside the stack's Components list none of the pusher's three failures can fire (no components, component not found, still animating) — the row would be a string nothing ever writes` ·
  a `Failure` wire is dropped with a note (dead for the same reason) · the sweep: `its Navigate is never fired by a translatable trigger`.
  A `pm-<port>` naming no input on the target is DROPPED with a note (the runtime's `setInputValue` on an undeclared input is a no-op).
  An authored non-default Transition is NOTED, not refused: `its Transition "<x>" is authored — the export switches without animation`.
- Pop: `no Component Stack lists <legacy> among its Components, so nothing ever pushes it — its Navigate answers Failure ("No Component Stack to pop") every time` ·
  `a declared port already claims the reserved prop "pageStackEntry" — rename the port` ·
  `its Unchanged output is consumed — it fires when the stack is already at its first component, which a pushed component's Pop cannot reach (only a pushed component receives the back callback; the start component's Pop answers Failure instead)` ·
  `its Completed output is consumed — …` · `its Error is read outside its Failure chain — this slice reads the message only inside the arm that writes it` ·
  `its Done|Failure output is consumed as a value — a pulse carries nothing to read` · the sweep: `its Navigate is never fired by a translatable trigger`.

**Recorded divergences (not refused):** no transition — the runtime animates every push (`Push` by default) and keeps both components
mounted until the animation ends; the export switches in one render. The stack does not survive a page navigation any more than the
runtime's does (the registry entry is removed on unmount). The Pop's `transition-in-progress` failure cannot occur.

**What this deliberately does not do:** `useRoutes` (the url is a Router's), transitions, a Pop nested one component below the pushed
one (the runtime does not reach it either), a read of a backResult typed by its feed (the port is `*`; `unknown` is the honest type).

### §61.1 What is emitted

- **`src/lib/pageStack.ts`** (`src/emit/pageStackLib.ts`, new): `PageStackStore` (`navigation-stack.tsx`'s `navigate` / `replace` /
  `back` / `reset` minus the transition and the url — `_isAlreadyShowing` verbatim, the three failure codes and sentences verbatim,
  no way back on a replaced or reset entry), the module-level registry with the navigation queue and `settledOnce` (`navigate.ts`'s
  `settle`: one press reports once across same-named stacks), `pushComponent` / `replaceComponent` / `popComponent`, and
  `usePageStack({ name, pages, startPage })` — the store once per mount, registration in the effect (which resets, so the first
  render shows nothing, as the runtime's does until its async queue has built the start component), deregistration in the cleanup.
- **The stack's host** (`Home.tsx`): one hook line per rendered stack in walk order; the row `<div className={styles.wizard}>`
  with one `&&` line per page — `{wizard.top?.pageId === 'details' && <StepDetails key={wizard.top.key}
  {...(wizard.top.params as StepDetailsProps)} pageStackEntry={wizard.top.handle} />}` (the spread only where the target declares
  props, the reserved prop only where its plan keeps a Pop); `{wizard.topPageName}` / `{wizard.stackDepth}` bare; Reset as
  `onClick={() => wizard.reset()}`; the class `width: 100%; flex: 1 1 100%; position: relative; display: flex; flex-direction:
  column; overflow: hidden` (the runtime's `defaultCss`, `clip` unticked drops the last).
- **The pusher's host** (`StepIntro.tsx`): `pushComponent('Main', { target: 'details', params: { email: draftEmail.get() },
  backCallback: (action, pushDetailsResults) => { setPushDetailsBackResults(pushDetailsResults); if (action === 'confirm') {
  confirmedEmail.set(pushDetailsResults.email); } } })`; the row `useState<Record<string, unknown>>({})`; the render read
  `{String(pushDetailsBackResults.email ?? '')}`. Replace mode: `replaceComponent('Tabs', { target: 'overview' })`, no callback.
  Done / Unchanged chains print as `hasNavigated: () => …` / `hasUnchanged: () => …`.
- **The pushed component** (`StepDetails.tsx`): `pageStackEntry?: PageStackEntryHandle` on the interface after the declared ports;
  per trigger port `const popResult = popComponent(pageStackEntry, { backAction: 'confirm', results: { email } }); if (!popResult.ok
  && 'code' in popResult) { raiseAppError({ code: 'pop-component-stack/no-stack-in-scope', … }); }` — with a Done chain the
  `if (popResult.ok) { … } else if ('code' in popResult) { … }` form, the Failure arm reading Error as `popResult.message`.
- **plan.ts**: `PAGE_STACK_TYPE` / `STACK_PUSH_TYPE` / `STACK_POP_TYPE` / `PAGE_STACK_OUTPUTS` / `PAGE_STACK_ENTRY_PROP`;
  `indexPageStacks(ir)` (module-level, cached per IR — every stack by node, by name, and by the components it lists, with its
  refusal decided from the IR alone); `renderRole` → `'stack'`, refused whole in `roleOf` by the index's sentence; `PageStackPlan`
  on `ComponentPlan.pageStacks`, `popsStack`; `StackPushAction` / `StackPopAction` / `StackResetAction`; `ValueExpr` `stack-out`
  and `stack-back-result`; `StateVarPlan.origin` `stack-back`; `stackPlanOf`, `stackBackStateOf`, `pushTargetOf`,
  `compileStackPush` / `compileStackPop` / `compileStackReset`; the `resolveExpr` branches (a Pop's Error reuses `outcome-error`
  with a local); `TRIGGER_PORTS` + `isTriggerWire` (the Pop per port, the stack's Reset); `OWN_CHAIN_OUTPUTS` + the `backAction-`
  prefix; the per-port compile loop; the five expression switches and five action walkers; Pass 4c's whitelist (`isStackRead`,
  the Pop's Error included) and a wire note carrying a stack-family read's own sentence where Pass 6 would say "step 5"; the
  never-fired sweep (the Pop over every trigger port it has); the pathway predicate (a push or pop is a navigation).
- **component.ts**: `TAGS.stack`, `renderStack`, the hook line beside the others, the three prints, `errorCodeOf`,
  `RAISING_ACTION_KINDS`, `collectExprUse` / `hookExprSources` / `maybeUndefined` / `exprCode` / `effectDeps` /
  `chainReadsChainLocal` / `actionExprsOf` / `deepActions` / `actionIsStatement` / `actionTakesNoTerminator` / `blockBody`, the
  import earned from the calls, the hook and the reserved prop's type; `requireInstance` now MERGES symbols (`withProps` imports
  the page's `Props` beside the symbol without clobbering an ordinary instance's line); `declaresPropsInterface`; the untyped
  fold for `stack-back-result` with its `noSourceReason`; `pageStackLib` on `EmittedComponent`. **style.ts**: `StyleRole`
  `'stack'`, the `defaultCss` branch, `CONTENT_PARAMS['Page Stack']`, the `pageComp-`/`pagePath-` skip. **emitApp.ts**: the file.
- **Ledger**: three rows `translated` with notes; floor **105 → 108**; eight pins moved (`animation-pair`, `browser-utilities`,
  `filter-records`, `object-store`, `on-app-error`, `run-tasks`, `script`, `streaming-trio`).

### §61.2 The fixture — `tests/fixtures/wizard-desk`

`App`: the Router alone. `Pages/Home`: a tab bar (two buttons → two pushers in Replace mode onto a stack "Tabs" showing
`TabOverview` / `TabSettings`), a wizard stack "Main" (intro → `StepIntro`, details → `StepDetails`, start intro), three Texts
(Top Component Name, Stack Depth, the Variable `confirmedEmail`), a "Start over" button → Reset. `Components/StepIntro`: a text
input → Variable `draftEmail` (the write-through rule), a Next button → push details with `pm-email` ← the Variable, `backAction-confirm`
→ Set Variable `confirmedEmail` ← `backResult-email`, a Text ← `backResult-email`. `Components/StepDetails`: Component Inputs
(`email: string`) shown in a Text, Confirm / Cancel → the Pop's two back actions with `result-email` ← the input. **The reverted
arm** (`probe-reverted.log`, 2a2dd4fa): the two stacks `visual child of shell with no deterministic generator (Page Stack)`, the
four pushers and the Pop `logic node (…)`, the Set Variable silenced with the value-side sentence, 15 refusals, verdict null,
21 files — every node predicted. **Built**: 0 refusals, 23 files, the real `tsc` clean.

### §61.3 The gates and the arms

```
packages/nodegx-export: tsc --noEmit 0 · component-stack-trio.test.ts 50/50
  §A the fixture whole + the real ts.Program (11) · §B the lib under a hook harness (12: the empty first paint, push, back,
  no way back, _isAlreadyShowing, replace, the end-stop, the queue, the fan-out + settle, the failure sentences by id and label,
  reset + deregister, the Main default) · §D refusals by mutation, each sentence exact (16 rows, 30 sentences) · §E the shapes a
  wire changes, typechecked as one real program (5) · §F findings (3) · §G the runtime files pinned (3)
component-stack-pair.test.ts 11/11 — the three `deferred` pins flipped to positive rows, the instrument rows kept, one row added
  (the Pop is reached non-recursively; only the push path installs the callback — counted over CALL expressions, see §61.4)
neighbours, one at a time, green: unreported-deferrals 7, in-code-markers 57 (was 54: the fixture joined the corpus control), logic 29,
  typecheck-emitted 37 (was 34: the fixture is typechecked there too), cascade 83, visual-roots 13, navigate-to-path 79,
  browser-utilities 55
whole package jest ONCE: 72 files (72 on disk = 71 + this spec), 2512 rows, exit 0, alone on the box at load 5.3
export-ledger:check OK — 176 types · picker 108/127 (85.0%), floor 108, --check exit 0
arms 15/15 KILLED, every arm compiled, sources restored md5-identical after each (mut.py, mut-summary.txt): M1 _isAlreadyShowing
  inverted — 2 · M2 back() never fires the callback — 1 · M3 replace installs a way back — 1 · M4 the settle guard — 1 · M5 the
  queue dropped — 3 · M6 the end-stop off by one — 1 · M7 the Replace-mode back-action refusal — 1 · M8 the typing gate (first cut
  `|| true` did NOT compile — TS7027, re-cut as `given = declared`) — 1 · M9 the attached check — 2 · M10 the Pop's discriminant
  swapped — 2 (the emitted app's tsc among them) · M11 clip default lost — 1 · M12 the empty list accepted — 1 · M13 the reserved
  prop passed to every page — 3 · M14 the Pop's Error off the whitelist — 1 · M15 reset reuses the start key — 1
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §61.4 What building it found

1. 🔴 **The fixture's first wire was to a port that does not exist.** I wired the text input's `text` output; the value port is
   `onTextChanged` (display "Value", `isSignal: false`) — §59.4's trap #8 again, read off the display name instead of the catalog.
   Pinned (F1). And its live text is not readable from a button's handler either (the brief's own trap: it rides a Variable) — the
   built probe's first refusal was `the action reads values that only exist in another handler`, and the fixture took the
   utility-desk shape.
2. 🔴 **A row nothing writes printed.** The pusher COMPILED (so `compiledOf` answered an action) and was refused at ATTACH, while
   the Text's render read had already allocated the back-results row — `useState<Record<string, unknown>>({})` in a file whose
   push had been dropped. §59.5's order (the attach registry fills after every sink compiles) is now the read's question: a
   render read (Pass 4c) asks `attachedStackPushes`; a sibling handler's read compiled earlier takes the id nodes' "never fired"
   sentence (E5, the named residual). Pinned (F2); an arm (M9).
3. 🔴 **A render read refused in Pass 4c loses its sentence.** Pass 6 names every unconsumed wire "has no deterministic
   translation in step 5", and the stack family's reads (a Pop's Error outside its Failure arm, a Back Result while nothing fires
   the push) had nowhere else to put theirs once the source node was attached or already dispositioned. They now file a wire note
   (the dead-Failure drops' shape). Three rows went red on it (D13, D14, F2).
4. 🔴 **"Adding a readable output is never one edit"** (§14's warning, paid again): the Pop's Error into a rendered sink never
   reached `resolveExpr` because Pass 4c's whitelist admitted the stack's outputs and the pusher's Back Results, not it. One line;
   pinned (D13); an arm (M14).
5. 🔴 **The grep the pair spec warns about, reached for in the pair spec.** `countText(…, '_setBackCallback(')` reads 2: the
   interface type the call is made through DECLARES the method. The file's own AST counter counts call expressions — 1. Both are
   now asserted, side by side.
6. ⚠️ **A `Set Variable` takes its value from a wire.** My first `addSetVariable` authored a literal `value`, and eleven refusals
   followed — none the row's. The helper wires a Variable read now, and E1–E3 assert `lastTab.set(confirmedEmail.get())` — the
   handler's `.get()` form, §59.4 #5, met on the way.
7. ⚠️ **The ledger stores `—` and `§` raw.** `json.dump(…, ensure_ascii=True)` (the brief's note for a ledger that HAD escapes)
   rewrote 110 lines; `ensure_ascii=False` made the diff 11/11.
8. ⚠️ The first mutation cut (`|| true`) did not compile — an unreachable `else` is TS7027 here — and "0 total" is not a kill; re-cut
   at the value level, one red.

### §61.5 What this leaves (owner NONE unless named)

- **No transition.** The runtime animates every push (`Push` by default) and keeps both components mounted until the animation
  ends; the export switches in one render. Recorded in the ledger note and per node where an author chose one (D16). Owner NONE.
- **A Back Result read from a SIBLING handler** compiled before the attach pass is refused with "never fired" even when the push
  is fired by a button — §59.5's residual, the same shape, pinned as a fact (E5). Owner NONE.
- **`useRoutes`** refuses the whole stack by name; translating it is a url story the Router owns. Owner NONE.
- **A Pop nested one component below the pushed one** answers the runtime's own `no-stack-in-scope` failure — faithful, because
  the runtime reaches the Pop non-recursively (pinned in the pair spec). Not a residual; noted so nobody "fixes" it.
- **Two same-named stacks showing different components** for a target refuse the pusher; the runtime fans out and mints the
  `pm-` ports from the first. Owner NONE.
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed — the
  wizard (push → confirm → the Variable shows the email; Start over) and the tab bar (replace → the same tab twice is Unchanged).

### §61.6 What the drive found (session 87, 2026-09-05) — the pusher's component was unmounted under the page it pushed

**Read before driven.** Writing `EXPECTED61-drive.md` against the emitted `Home.tsx` and `navigation-stack.tsx` side by side
predicted one divergence before Chrome ran: §61.1's row rendered THE TOP ENTRY ONLY (`{wizard.top?.pageId === 'intro' && <StepIntro …/>}`),
so the PUSHER's own component — StepIntro, which pushes `details` and renders `backResult-email` — was unmounted by React the moment
its push landed and remounted on the pop with a fresh `useState` (`{}`). The runtime does the opposite: `navigateAsync` keeps the
outgoing page's node as `top.from` and `backAsync` re-adds it (`this.addChild(top.from, 0)`), so a Text or a text input in the
pusher keeps its state while covered. The Variable (`draftEmail` / `confirmedEmail`, a store outside React) survived in both,
which is why the fixture's Home text still showed the confirmed email — the defect was visible ONLY in the pusher's own render.

**Arm a — the session-86 emit, driven** (`drive61-a.log`, headless Chrome on the built app, 8 rows): 7 as predicted; R4 the
divergence, confirmed — after Confirm the intro's "Came back" Text read `''` while Home's Confirmed text read the email; the
second push (R5) carried the email anyway because the push reads the Variable, not the input (my misprediction, both
sides agree). Top Component Name is the page LABEL (`Intro`), as the runtime's `topPageName: pageInfo.label` — the lib had it right.

**The fix** (`3a412ade`): `PageStackHandle.entries` (the store's stack, bottom to top); the row maps every entry into a wrapper
`<div key={entry.key} style={{ display: entry === wizard.top ? 'contents' : 'none' }}>` holding one `&&` line per page —
`display: contents` keeps the top page a direct flex child of the stack (the runtime's layout), `display: none` keeps the
covered pages mounted and unpainted. A6 pins the new row and refuses the old one (`top?.pageId ===`, `top.key`).

**Arm b — the fix, driven** (`drive61-b.log` + `drive61-b2.log`): every row as predicted BEFORE its drive — R3 the intro still in
the DOM with its input kept; R4 "Came back" = the email, the input kept, Confirmed = the email; R5 Cancel writes the row too;
R7 Start over remounts fresh (input and Came back empty); zero console errors. And the wrapper does not paint: after the
push `innerText` lists `Step 2 - confirm` and not `Step 1 - your email`, the three wrappers compute `[contents, none, contents]`,
the covered input's `offsetParent` is `null`.

**What this row now cannot see (owner NONE unless said):** the runtime removes the covered page's DOM and re-adds it (a
scroll position or a focused input is lost there and kept here); a stack under a stack renders its covered entries' hooks
(effects keep running while covered — the runtime's covered node keeps running too, so faithful, but unmeasured);
replace mode drops the covered entries in both. `EXPECTED61-drive.md`, `drive61.sh`, `emit61.ts` in the s87 scratchpad `fde4ba8c-…`.

## §62 Tier 2.8 row 12 — the relation pair: `Add Record Relation` and `Remove Record Relation`, the record verbs' shape with a Pointer on the wire (session 86, 2026-09-05)

Type ids `AddDbModelRelation` / `RemoveDbModelRelation`, display names *Add Record Relation* / *Remove Record
Relation* — the twelfth row of §50's list, designed in session 28 (RECORD-VERBS-TARGET §17) and refused since
with *"a relation write has no shape in the api stub"*. Both are in the picker population, so the floor moves
**105 → 107**.

### §62.0 Design — what the pair is on disk, and what it becomes

**The port sets**, assembled by `dbmodelcrudbase` exactly as the three record verbs are (`addBaseInfo` +
`addModelId` + `addRelationProperty`; `-addrelation.ts`, `-removerelation.ts`): inputs `collectionName`
(Class), `idSource` (explicit | foreach), `modelId` (Id — "a record itself is accepted here as well as its Id"),
`repeaterComponent`, `backendId`, `relationProperty` (Relation — an `allowEditOnly` enum the schema fills,
**no default**), `targetId` (Target Record Id — `allowConnectionsOnly`), `store` (Do); outputs `id`, `done`,
`failure`, `completed` (the family's outcome trio, declared once in `addBaseInfo`), `error` (Error — "kept
after a later attempt succeeds"). **No `Unchanged`** on either; the Remove sibling's file records why.

**What the runtime does on Do** (`scheduleAddRelation` / `scheduleRemoveRelation`): one token into the
batch, `scheduleOnce`, then `validateInputs()` — the whole pre-flight, in this order: *No class specified* →
*No relation property specified* → *No target record Id (the record to add a relation to) specified* → *No
record Id specified (the record that should get the relation)* → the NDA-012 class check (*The target record
"<id>" has not been loaded, so its class is unknown …*). The first problem is `setError`'d (Error written,
`record/storage-op-failed` raised, Failure pulsed) and the backend is never called. Otherwise
`cloudstore.addRelation({ collection, objectId: model.getId(), key, targetObjectId, targetCollection })`, which
`ParseWireAdapter.addRelation` sends as **`PUT /classes/<collection>/<objectId>` with body
`{ [key]: { __op: 'AddRelation', objects: [{ __type: 'Pointer', objectId, className }] } }`** (`RemoveRelation`
for the sibling). The backend (`parse-wire.ts classUpdate`) walks the ops, calls `facade.addRelation` per
Pointer and answers `{ updatedAt }`; the runtime merges that into the in-process record and reports `done`.
Error is never cleared by a later success.

**The design: the record verbs' shape, verbatim — an `api-call`.** The pair is the same assembly as
Create/Update/Delete with two more inputs, so it takes the same action kind rather than a sibling one (USER-FAMILY
§4e's rule: a new discriminant recruits every switch site silently; the existing one is walked by all of them).
The verb union widens to `'add-relation' | 'remove-relation'`; `MutationPlan.verb` too; the api module prints
`add<Type>Relation(id, relation, targetId, targetClass): Promise<void>` / `remove<Type>Relation(…)` beside the
class's other verbs, calling two new client functions `addRelation` / `removeRelation` (the wire above,
transcribed) — or the stub that throws, where the project declares no backend. The handler is the record verbs'
try/catch: the dynamic guards **in the runtime's order** (target first, then id — each `throw new Error(<the
runtime's own sentence>)`, emitted only where the argument is not a literal), the awaited call, the done chain,
and the catch that writes the Error row and raises `record/storage-op-failed`.

**Where the four arguments come from:**
- `id`: a wire (through `resolveExpr` — a Variable prints `.get()`, a prop its name) or the authored literal;
  two wires refused; a boolean refused; `''`/`undefined` at run time throws *"No record Id specified (the record
  that should get the relation)"* / *"(… should lose the relation)"* — `setModelID` clears the binding on those.
- `relation`: the authored literal, always — a wired one is refused (`allowEditOnly`, but a project can hold it).
- `targetId`: the one wire, whose source must be a `DbModel2` / `DbCollection2` (NDA-012's static form,
  `LOADED_RECORD_SOURCES`, unchanged); the expression it resolves to (a `Record`'s Id is its feeder — a literal or
  a Variable); a list (Query Records' Items) refused.
- `targetClass`: the source node's literal `collectionName` — the runtime reads it off the loaded record, and
  statically the record a `Record`/`Query Records` loads is of the class it names.

**Refused by name** — every sentence predicted here, graded in §D of the spec:
- the five pre-flight sentences (unchanged from §17, now shared by the compiler and the sweep): *no class is
  named, so the runtime answers Failure with "No class specified" and never calls the backend* · *no relation
  property is named, so the runtime answers Failure with "No relation property specified" and never calls the
  backend* · *no Target Record Id is wired, so the runtime answers Failure with "No target record Id ...
  specified" and never calls the backend* · *it names no record to put the relation on, so the runtime answers
  Failure with "No record Id specified" and never calls the backend* · *its Target Record Id comes from <type>
  rather than a Record or Query Records output, so the target's class is unknown and the runtime refuses the write*;
- the static-value gates, the record verbs' sentences where they have one: *its class name is not a literal* ·
  *its Relation is wired — which relation column is written is not statically knowable* · *it names a specific
  Backend — one api module per class is all this slice emits* · *its Id Source is the enclosing repeater's row —
  row identity is not statically knowable in this slice* · *its Target Record Id comes from a Record or Query
  Records whose class is not a literal, so the target's class is not statically known*;
- the consumed outputs: *its failure|completed output is consumed — only the done chain and the Error value are
  translated in this slice* (the record verbs' sentence — the pair's Failure has the same standing as Create's) ·
  *its Id output is consumed — it republishes the Id it was given, and that read is not translated in this slice*;
- the wires: *two wires feed its Id — last-writer-wins is not statically ordered* · *two wires feed its Target
  Record Id — last-writer-wins is not statically ordered* · *its Id is fed a logic truth value — only truthiness
  sinks take one in this slice* · *its Id has no statically known source* / the feeder's own sentence · *its
  Target Record Id has no statically known source* / the feeder's own · *its Target Record Id is fed the Query
  Records' Items list rather than one record's Id — a row's Id reaches the page only through a repeater, which
  this slice does not translate*;
- the chains: the done chain's own refusal; an Error read while Do is never attached: *its Do is never fired by a
  translatable trigger* (the record verbs' rule, `attachedRecordVerbs`); the sweep for a well-formed node nothing
  fires: *its Do is never fired by a translatable trigger*.

**Deliberately not done, recorded**: a Failure *chain* (the record verbs refuse it too — one funnel for the
family, and a `failThen` on `api-call` is a second pipeline through every walker); §4c's chain-local
`created.id` (a Create's consumed Id stays gate 11 — the Create's refusal, not this node's); the runtime's merge
of `updatedAt` into the in-process record (the export holds none — `Promise<void>`); `encodeURIComponent` on the
id, the client's convention where the wire adapter concatenates raw (a backend never mints an id that differs).

### §62.1 What is emitted

- **`src/api/client.ts`** gains `addRelation` / `removeRelation(collection, id, relation, targetId, targetClass): Promise<void>` beside
  `update` / `remove`: `PUT /classes/<collection>/<encodeURIComponent(id)>` with body `{ [relation]: { __op: 'AddRelation' |
  'RemoveRelation', objects: [{ __type: 'Pointer', objectId: targetId, className: targetClass }] } }` — `ParseWireAdapter.addRelation`
  / `removeRelation` transcribed; the `{ updatedAt }` answer is not returned (the export holds no in-process record to merge it into).
  The golden `tests/goldens/exp009/client.ts.golden` regenerated; the diff is exactly that block (`client-golden.diff`).
- **`src/api/<plural>.ts`**: `add<Type>Relation` / `remove<Type>Relation(id, relation, targetId, targetClass)` beside the class's other
  verbs, the client import naming both; the stub form throws `'<fn> is not connected to a backend yet'` (the write stubs' rule).
- **The page**: the record verbs' try/catch. Each dynamic guard binds a local first and the call reads it —
  `const linkTargetId = puppyId.get(); if (!linkTargetId) throw new Error('No target record Id (the record to add a relation to) specified');`
  then the record's — in `validateInputs`' order; a literal argument prints no guard. Then
  `await addInquiryRelation(linkRecordId, 'puppies', 'pup-1', 'Puppy');`, the done chain, and the catch that writes the Error row and
  raises `record/storage-op-failed` with the node's own type. The Error Text folds (`{linkError ?? ''}`).
- **plan.ts**: `RelationVerb`, `RELATION_NODES` (the verb, the fn prefix, the two "specified" sentences per node), `relationPreflight`
  (module-level, shared by `compileRelationOp`, the record-verb sweep and the logic-only path), `compileRelationOp` (`api-call` with
  `verb: 'add-relation' | 'remove-relation'`, `guardId: false`, `guards: [{ index, local, message }]`, `MutationPlan` with `writes: []`),
  `TRIGGER_PORTS` (both `store`), the sink ladder, the `error` read (`attachedRecordVerbs`, unchanged rule), the record-verb sweep, the
  render pass's `isRecordErrorRead` (the family's THIRD enumeration), and the corpus idiom's own sentence (a record verb's `id` into
  the verb's Id). **component.ts**: `API_CALL_ERROR_CODES` two rows; the `guards` print in the `api-call` case. **emitApp.ts**: the
  module print, the client import, the two client functions. **No new lib, no new action kind, no new expression kind** — nothing in
  the hook-gap `||` chain and nothing in the expression switches; the `resolveExpr` if-ladder gained no branch (the `error` clause widened).
- **Ledger**: both rows `translated`; floor **105 → 107**; eight pins moved (the brief said seven; `grep` found eight —
  `animation-pair`, `browser-utilities`, `filter-records`, `on-app-error`, `object-store`, `run-tasks`, `script`, `streaming-trio`).

### §62.2 The fixture — `tests/fixtures/link-desk`

`App`: the Router. `Pages/Home`: a Record `puppy` (class Puppy, literal Id `pup-1`, Fetch unwired — §43's effect form) whose `Id` feeds
both verbs' Target Record Id and whose `name` is a Text; a text input → `inquiryId` Variable (§56 E2's write-through) → both verbs' Id;
"Link the puppy" → `link.store` (class Inquiry, relation `puppies`); "Unlink the puppy" → `unlink.store`; each `done` → a Set Variable
`status` fed by a String (`savedValue`); each `error` → a Text; `status` → a Text. Backend `backend_linkdesk` at `localhost:8581`, a
schema snapshot for Inquiry (`message`) and Puppy (`name`).

**The reverted arm** (`probe-reverted.log`, HEAD 2a2dd4fa): both verbs on *"a relation write has no shape in the api stub …"*, the two
Set Variables silenced with *"the trigger is not a rendered element event or a receiver"* (the attach pass speaks, not the "never fired"
sentence I predicted — §59.4 item 3 again), the two Strings behind them, **16 refusals**, `whole: []`, the verdict naming both verbs,
`pathway: true`. **Built**: 18 files, **0 refusals**, the shell note and the backend note only; the page reads as §62.1.

### §62.3 The gates and the arms

```
packages/nodegx-export: tsc --noEmit 0 (after every stitch, four runs) · relation-pair.test.ts 47/47
  §A the fixture whole + the real ts.Program (10) · §B the client under node against a fake fetch — the PUT, the op, the typed Pointer,
  the header pair, encodeURIComponent, the backend's own message, the status-only failure, the unreachable sentence, the session token (6)
  · §C the shapes a wire changes — the stub form, the wired target's guards in the runtime's order (typechecked), a literal record Id (4)
  · §D refusals by mutation, each sentence exact (24) · §E the corpus shape and the logic-only path (3)
relation-verbs.test.ts 24/24 (the well-formed row re-pinned: the verb names §4c's unbuilt chain-local read from its own side)
neighbours re-run alone, green: backend-client 17 (golden regenerated), in-code-markers 57, unreported-deferrals 7, logic 29, cascade 83,
  record 29, file-record 26 (B10 re-pinned: the client's `__type` count 3 → 5, the two Pointers named and counted — writes, not File envelopes)
whole package jest ONCE at load 5.2: 72 files (72 on disk = 71 + this spec), 2508 rows — 2507 green + file-record B10, re-pinned and re-run alone
export-ledger:check OK — 176 types, 114 translated · picker 107/127 (84.3%), --check exit 0 (was 105)
arms 16/16 KILLED (mut-summary.txt), sources restored md5-identical after each: M1 pre-flight check — 2 · M2 NDA-012 rule inverted — 30 ·
  M3 op misspelt — 2 · M4 Pointer without className — 2 · M5 guards reordered — 1 · M6 target guard dropped — 1 · M7 guard not rebound
  (TS2345) — 8 · M8 Failure/Completed allowed — 2 · M9 list gate — 1 · M10 logic-only pre-flight dropped — 1 · M11 render-pass Error read
  reverted — 3 · M12 record-verb Id sentence — 1 · M13 family code dropped — 7 · M14 POST — 2 · M15 wired target class — 1 · M16 the
  source class sent as the target's — 7
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §62.4 Traps found

- 🔴 **The first reverted arm measured a fixture defect, not the product.** A `String` node's output is `savedValue`, not `value`
  (roster-desk wires `savedValue`); the Set Variables read *"the value wire has no statically known source"* and I read that as the
  cascade. Re-run with the wire fixed; the control is the fixed one. *Copy a fixture's wire, not its display name.*
- 🔴 **`if (!x.get()) throw …; await f(x.get())` does not typecheck** — the guard narrows nothing for a second call (TS2345 in the emitted
  program, caught only by the real tsc, A2). The guards now bind a local and the call reads it, which is also what the runtime does
  (the setter stored the value once). **The record verbs' own `guardId` has the same hole for a Variable-fed Id** — registered below.
- 🔴 **The family's THIRD enumeration.** `RECORD_VERBS[…] || USER_VERBS[…]` appears in `resolveExpr`'s `error` clause AND in the render
  pass's `isRecordErrorRead`; the Error Text was dropped with the step-5 note until the second was widened (§43's "second consumer"
  rule, s19's dispatcher rule). Arm M11.
- 🔴 **A sweep-side pre-flight fallback was dead code, and the arm that could not kill it said so.** Every trigger sink is compiled
  diagnostically before the sweeps (`compiledOf(node, TRIGGER_PORTS[node.type])`, plan.ts ~14005), so the record-verb sweep always
  reports the compiler's verdict. Removed; the logic-only path is the one place the sweep-side pre-flight runs (E3, M10 re-aimed).
- 🔴 **The compiler speaks before the sweep for the corpus shape too.** I predicted the gate-11 graph would leave the verb on *"never
  fired"*; the sink is compiled from the wire side and refused on its Id — now with its own sentence naming §4c's unbuilt chain-local read.
- ⚠️ **The ledger is mostly raw UTF-8** (89 raw `—` lines, 4 escaped): `json.dump(ensure_ascii=True)` rewrote 218 lines. Edited as text on
  HEAD's bytes instead; the diff is 6/6.
- ⚠️ **Three substring traps in one spec** (§57.4's): `linkError` ⊂ `linkErrorText` (the marker names the node id), `linkRecordId` ⊂
  `unlinkRecordId`. Every absence narrowed to a declaration.
- ⚠️ The first spec run pinned `into: HOME_FILE` for handler actions; a handler action collapses into its **button**, a render read into the file.

### §62.5 Residuals (owner NONE unless named)

- **`api-call`'s `guardId` for a Variable-fed Id does not narrow** (`if (!x.get()) … await f(x.get())`) — an Update/Delete Record whose Id
  is a Variable would fail the emitted tsc with TS2345. The record verbs' shape, older than this row; the fix is the `guards` print (bind a
  local). Owner NONE — a one-line change plus a row in `record-verbs`' spec.
- **§4c's chain-local `created.id`** — the corpus idiom (`NewDbModelProperties.id → AddDbModelRelation.modelId`) stays refused on both
  sides (gate 11 on the Create; the verb's own sentence). Owner NONE.
- **A Failure chain on the pair** is refused as the record verbs' is — one funnel for the family; translating it is a `failThen` on
  `api-call` through every walker. Owner NONE.
- **A Query Records' `firstItemId`** — the one Query Records string output that names a loaded record — resolves to nothing (§56 reads
  Items and Count), so a relation fed by it is refused with the feeder's sentence, not built. Owner NONE.
- **`pathwayVerdict`'s consequence clause** (`src/emit/report.ts`): when a root pathway node silences no other pathway node, the verdict
  says *"the app has no error pathway"* — written for `On App Error` (§54), reached by any refused backend verb with only Set Variables
  behind it (the reverted arm read it for the relation pair). EXP-013 is closed; owner NONE. Pre-existing, not this row's.
- The runtime's `updatedAt` merge into the in-process record, and its raw (un-encoded) id in the path, are recorded divergences (§62.0).
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed.

### §62.6 The drive — the built export, headless, against a fake backend (session 88, 2026-09-05)

`link-desk` emitted (18 files, 0 refusals), built exit 0 / 0 `error TS`, `vite preview` 4362, Chrome 9362, `--target=Link`. The backend was
**a 30-line fake on 8581** (`fakebe.js`): CORS pre-flight answered, every non-OPTIONS request appended to `fakebe.log` as a JSON line
(method, path, `X-Parse-Application-Id`, `Content-Type`, session header, body); `GET /classes/Puppy/pup-1` → `{objectId, name: 'Rex'}`,
`PUT /classes/Inquiry/missing` → 404 `{error: 'Object not found.'}`, any other `PUT /classes/Inquiry/<id>` → 200. **The request is what
was counted, not the node that would make it**; `EXPECTED-60-62-63.md` first, every row graded:

- **L1 boot** — `<p>`: `Link Desk`, `Rex`, `''`, `''`, `''`; **fakebe.log exactly 1 line**: `GET /classes/Puppy/pup-1`, app id
  `backend_linkdesk`, `application/json`, no session token ✓ (a production build — StrictMode does not double-run the mount effect there).
- **L2 Link, input empty** → linkError `No record Id specified (the record that should get the relation)`; status `''`; **still 1 line
  (no PUT)**; one `console:` entry, code `record/storage-op-failed`, node `link` ✓ — the guard throws before the request, as
  `adddbmodelrelation.ts` does.
- **L3** type `inq-7`, Link → **line 2: `PUT /classes/Inquiry/inq-7`**, body
  `{"puppies":{"__op":"AddRelation","objects":[{"__type":"Pointer","objectId":"pup-1","className":"Puppy"}]}}`; status `Linked.`;
  **linkError STILL the L2 sentence** ✓ — the node's Error output is never cleared by a later success in either world (RECORD-VERBS §1).
- **L4 Unlink** → line 3: the same path, `__op: RemoveRelation`, the same Pointer; status `Unlinked.`; unlinkError `''` ✓.
- **L5** type `missing`, Link → line 4: `PUT /classes/Inquiry/missing` (AddRelation); linkError `Object not found.` (the 404's `error`
  string); status STILL `Unlinked.`; a second `console:` entry ✓.
- **L6 totals** — **4 requests: 1 GET + 3 PUT**, every one carrying the app id and the JSON content type; errs = exactly the two
  `record/storage-op-failed` console lines, no window error, no unhandled rejection ✓. Teardown: 0 listeners on 4362 / 9362 / 8581.

Cannot see: the runtime's `updatedAt` merge into the in-process record (nothing renders it); a Failure chain (refused); the `created.id`
idiom (refused); a real backend's relation semantics (the fake accepts any id but `missing`).

## §63 Tier 2.8 row 13 — `Drag`: the wrapper drags, the child rides (session 86, 2026-09-05)

Type id `Drag`, display name *Drag* — the thirteenth and last row of §50's list. Picker **105 → 106**.

### §63.0 What a Drag is, and what that decides

**The node on disk** (`drag.ts`, `Drag.tsx`, `react-draggable` 4.5.0, the catalog): a VISUAL node (`allowChildren`, `noodlNodeAsProp`)
that renders **no element of its own**. `Drag.tsx` takes the FIRST child (`React.Children.toArray(children)[0]`), returns `null`
with none, and wraps it in a controlled `<Draggable position={state}>`, which `cloneElement`s the child's root with
`style.transform = translate(x px, y px)` and `onMouseDown / onMouseUp / onTouchEnd`; `DraggableCore` adds a native non-passive
`touchstart` on mount and `mousemove/mouseup` (or `touchmove/touchend`) on the owner document for the life of one drag. **Mouse and
touch events, not pointer events** — transcribed as such.

**Inputs**: `axis` (enum x | y | both, default **`x`**), `enabled` (true), `useParentBounds` (*Constrain to parent*, true), `scale` (1),
`inputPositionX/Y` (*Start Drag X/Y*, no default), two snap groups — `snapToPositionX.do` (*Do*), `.value` (*Value*, 0),
`.duration` (300), and the same for Y — plus the generic visual ports (`mounted`, `cssClassName`, `styleCss`, `variant`), inert on a
node that draws nothing. **Outputs**: `onStart` (*Drag Started*), `onStop` (*Drag Ended*), `onDrag` (*Drag Moved*), `positionX/Y`
(*Drag X/Y*), `deltaX/Y`, and the outcome trio `done / failure / completed` shared by both snap actions.

**What the runtime does with them**, read off both files and the library:

- The pointer position is taken in the offsetParent's coordinates (`clientX + scrollLeft − rect.left`; the core's `scale` is 1 —
  `Draggable` strips `scale` before it passes props down), and `createDraggableData` divides the *delta* by `scale` once. With
  `bounds: 'parent'` the new position is clamped against `node.parentNode` (`getBoundPosition`: offsetLeft/Top, clientWidth/Height,
  paddings, margins, borders) and the overshoot is kept as *slack* so the element does not lag the pointer on the way back. `axis`
  gates only what is **flushed to the DOM** (`canDragX`); every callback still reports both axes.
- On mount `x = inputPositionX ? inputPositionX : 0` (falsy → 0), then `positionX(x), positionY(y), deltaX(0), deltaY(0)`. When a
  Start Drag input changes: the raw value into state, `positionX(new)`, `deltaX(new − prev)`.
- `onStart`: outputs (x, y, 0, 0) → the *Drag Started* pulse → both snap timers stopped. `onDrag`: outputs (clamped x, y, delta) →
  *Drag Moved*. `onStop`: the position is committed **on the enabled axes only**, `positionX(data.x)`, `positionY(data.y)`
  (no deltas), *Drag Ended*. So on `axis: x` the *Drag Y* output moves with the pointer while the element does not — kept.
- A snap: `if (state.x === x) return`; else stop the X timer and tween `state.x → x` with `easeOutCubic` over `duration === undefined
  ? 300 : duration` on the runtime's `TimerScheduler` (a duration ≤ 0 jumps in one frame), each frame `setState` and `positionX(value)`
  — no delta. **`Done` fires after every snap call that reached the mounted component, a no-op included** (`outcomeOnInnerComponent`
  reports `done` unless the method returns a string, and neither does); **`Failure` only when the component never mounted**
  (`visual/action-dropped`). The snap *Value* setter abstains on `undefined`/`null`/`''`, raises `drag/snap-position-not-a-number`
  on anything non-numeric and leaves the target alone; *Duration* is stored raw.

**The design — a hook on a wrapper, the listeners on the hook, the snap registers filled on arrival.**

- **`src/lib/drag.ts`** (`src/emit/dragLib.ts`): `useDrag(options, listeners): DragHandle`. The core and the wrapper transcribed —
  mouse + touch, the `react-draggable-transparent-selection` user-select hack, `bounds: 'parent'`, slack, the axis flush rule — and
  `Drag.tsx` on top: the outputs' order, the per-axis commit on stop, the snap registers with the setter's abstain/NaN rules, the
  tween on **`src/lib/animate.ts`'s scheduler transcription** (`createRun / startRun / stopRun / eases.easeOut` — the same
  `TimerScheduler` and the same `EaseCurves.easeOut`, transcribed once in §49 and reused rather than copied). The handle carries
  `ref`, a fresh `style` (`{ transform }`) per render, stable `handlers` (`onMouseDown / onMouseUp / onTouchEnd`), **live getters**
  `x / y / deltaX / deltaY`, and `snapTo('x' | 'y')`.
  🔴 The getters are load-bearing: the runtime writes the outputs and *then* pulses, so a *Drag Moved* chain reads the value of
  **this** frame. A listener closing over a plain render value would read the previous render's — §58's "live getters on the handle"
  rule, for the same reason.
  The options are typed `unknown` where the runtime's ports take whatever a wire delivers, and consumed inside the lib exactly as
  the component consumes them (`scale || 1`, `enabled === false`, `startX ? startX : 0`, and `'useParentBounds' in options ? … :
  true` — the declared default applies only to a port nothing set, as `registerInput` applies it). The lib imports `./errors`
  (`raiseAppError`, the NaN snap value) and `./animate`; `emitApp` ships both wherever it ships `drag.ts`.
- **Plan**: `renderRole` gains `'drag'` (a `StyleRole` with no style ports of its own); the walk keeps the **first** child and drops the
  rest by name; `DragPlan { nodeId, label, local, comment, options, listeners, drops }` on `plan.drags`, registered by `dragPlanOf`
  (options resolved in render context, arrival semantics) and completed by a pass beside §57's Added pass (listeners: `doneChainOf`
  in render context, snapped). Wires **into** the option ports are consumed there, not by the binding pass; wires **off** the value
  outputs ride the binding pass's whitelist (`isDragRead`) and resolve to `drag-out { local, field }` — `number`, never undefined,
  valid in both contexts. The two `Do`s are trigger ports (`isTriggerWire`) compiling to `drag-snap { local, axis }` — a bare
  expression `card.snapTo('x')`, its *Done* a listener the hook fires (one `done` whichever site asked — the node owns its outcome
  ports). `OWN_CHAIN_OUTPUTS[Drag]` = the three pulses and the trio, so the attach pass never takes them as element events.
- **Emit**: a `<div ref={card.ref} style={card.style} {...card.handlers}>` where the Drag sits, its first child inside; the hook line
  after the render locals it may read; `drag-out` in the five expression switches; `drag-snap` in the action switches;
  `import { useDrag } from '../lib/drag'` earned where a plan survived.

**Refused by name.** Whole node, before the walk (the subtree is left out, marked where it sat — the visual family's own rule):
(1) no child — *"it has no child to drag — a Drag with no child renders nothing (Drag.tsx returns null)"*; (2) *Completed* consumed —
UUID's sentence; (3) a pulse into a value sink — *"its Drag Started output is consumed as a value — a pulse carries nothing to
read"*; (4) *"its <port> output is not a port this node has"* / *"its <port> input is not a port this node has"*; (5) *"two wires
feed its <Label> input — last-writer-wins is not statically ordered"*. Per wire, the element still printing and a marker naming it
(the style-wire precedent): (6) an option wire that does not resolve or reads a handler-only value; (7) a listener chain that does
not translate — §57's *"its <Label> chain did not translate — <reason>"*; (8) *Failure* consumed — dropped with a note, because the
emitted element is mounted whenever a handler in this component can run, so that arm cannot fire; (9) a second child — *"the runtime
draws only the first child of a Drag"*. Generic sentences expected to fire unchanged: a `Do` from an untranslatable trigger (the attach
pass's), `didMount`/`willUnmount` (*no DOM event equivalent*), the Bounding Box outputs (whatever a Group's read of them says today).

**Recorded divergences**: the runtime drags the **child's** root; the export drags a wrapper `<div>` that takes the child's place in
the parent's flex flow (the child lays out inside a block wrapper — a `flex-grow` on the child now relates to the wrapper, not the
Group). The three marker classes `react-draggable-transparent-selection` aside (`react-draggable`, `-dragging`, `-dragged`) are not
emitted. A snap *Value* that arrives NaN twice in a row raises once (an effect keyed on the value; the setter raises per delivery).

### §63.1 What is emitted

- **`src/lib/drag.ts`** (`src/emit/dragLib.ts`, new, 595 emitted lines — a quoted line array generated from a typechecked source):
  `useDrag(source, options, listeners): DragHandle`. `DraggableCore` (mouse + touch, the primary button only, the non-passive
  native `touchstart`, the document `mousemove/mouseup` or `touchmove/touchend` for one drag, the finger followed by identifier,
  the `react-draggable-transparent-selection` hack and its frame-later removal), `Draggable` (the controlled position, the
  live/committed pair, `bounds: 'parent'` against the parent's inner box with slack, the axis flush rule) and `Drag.tsx` (the
  outputs' order — written BEFORE each pulse — the per-axis commit on release with `positionX/Y(data)` and no deltas, the
  `componentDidUpdate` on Start Drag, the snap registers with `readSnapCoordinate`'s abstain/NaN rules, the easeOut tween on
  `./animate`'s `createRun/startRun/stopRun/eases.easeOut`, `done` after every snap call, both timers stopped on Drag Started
  and on unmount). The handle: `ref`, a fresh `style: { transform }`, stable `handlers` (`onMouseDown/onMouseUp/onTouchEnd`),
  **live getters** `x/y/deltaX/deltaY`, `snapTo(axis)`. Options typed `unknown` and consumed as the props are (`scale || 1`,
  `enabled === false`, `startX ? startX : 0`, `'axis' in options ? … : 'x'`, `'useParentBounds' in options ? … : true`).
  Raises `drag/snap-position-not-a-number` on `./errors` with the runtime's own sentence.
- **Home.tsx**: `import { useDrag } from '../lib/drag'`; after the render locals,
  `const card = useDrag({ label: 'Card', nodeId: 'drag', componentName: '/Pages/Home' }, { axis: 'both', startX: 20, startY: 20, snapX: x, snapXDuration: 200, snapY: 0 }, { onStart: () => status.set('dragging'), onEnd: () => status.set('released'), done: () => status.set('snapped') });`
  the wrapper `<div ref={card.ref} style={card.style} {...card.handlers}>` where the Drag sits with its first child inside;
  `{card.x}` `{card.y}` `{card.deltaX}` `{card.deltaY}` bare (numbers, never undefined); the button
  `onClick={() => { card.snapTo('x'); card.snapTo('y'); }}`; a Condition on Drag X is `useEffect(…, [card.x])`.
- **plan.ts**: `DRAG_TYPE`, `DRAG_OPTION_PORTS` (port → key → label), `DRAG_VALUE_OUTPUTS`, `DRAG_PULSE_OUTPUTS`, `DRAG_SNAP_TRIGGERS`;
  `ValueExpr` gains `drag-out { local, field }`; `HandlerAction` gains `drag-snap { local, axis }`; `DragPlan` on
  `ComponentPlan.drags`; `renderRole` → `'drag'` (a `StyleRole` in style.ts with its own ports consumed there —
  `DRAG_OWN_PORTS`, pinned equal to the plan's list); `dragDeferReason` before the walk; the walk keeps the first child and
  `dropSubtree`s the rest; `dragPlanOf` (options in render context, arrival semantics, per-wire drops) beside `screenPlanOf`;
  `compileDragSnap`; the listener pass beside §57's Added pass (render context, snapped, wires consumed, Failure dropped with a
  note); `OWN_CHAIN_OUTPUTS[Drag]`; `isTriggerWire`; the `compileSink` dispatch; `isDragRead` in the binding whitelist; the five
  expression switches and the action walkers; and 🔴 **a restore of `static` over every rendered id the attach pass had
  collapsed into its trigger** (§63.4 #4).
- **component.ts**: `TAGS.drag`, the hook line (after the animations, listeners inline), `hookExprSources` over the options,
  the `||` hook-gap chain, the `role === 'drag'` branch of `renderCore` (drops → `defer` markers on the wrapper), `drag-out` in
  `maybeUndefined` / `exprCode` / `effectDeps`, `drag-snap` in `actionCode` / `actionExprsOf`, `allActions` over the listeners,
  the import earned by a surviving plan, `dragLib` on `EmittedComponent`. **emitApp.ts**: `drag.ts`, and `animate.ts` +
  `errors.ts` earned by it. **Ledger**: `Drag` translated with a note; floor **105 → 106** (this branch); eight pins moved;
  the editor's `exp-013/exportBadge.test.tsx` re-pinned from `Drag` to `net.noodl.SSE` at both sites (not run here).
- **Refused by name** (§C, every sentence exact): no child · Completed consumed (UUID's) · `its Drag Moved output is consumed as
  a value — a pulse carries nothing to read` · `its <port> output|input is not a port this node has` · `two wires feed its Snap To
  Position X — Value input — last-writer-wins is not statically ordered`. **Dropped by name, the wrapper still dragging**:
  `Drag <id>: its <Label> input is dropped — it reads a value that only exists inside a handler` (a received event's payload) /
  `— <the source's own sentence>` · `Drag <id>: its <Label> chain did not translate — <reason>; the wrapper still drags` ·
  `Drag <id>: its Failure chain is not emitted — Failure fires only when a snap reaches a Drag that has not mounted (drag.ts
  outcomeOnInnerComponent), and the emitted element is mounted whenever a handler in this component can run` · `the runtime draws
  only the first child of a Drag (Drag.tsx renders React.Children.toArray(children)[0])`. Generic sentences left to fire
  unchanged: a Do from an untranslatable trigger (the attach pass's), `didMount` (*no DOM event equivalent*), a Bounding Box read
  (*no deterministic translation in step 5*), a value output into a signal port (the attach pass's).

### §63.2 The fixture — `tests/fixtures/board-desk`

`App`: the Router alone. `Pages/Home`: page › shell › [headline; **board** (320×200) › **drag** (`axis: both`, Start Drag 20/20,
Snap X Duration 200, Snap Y Value 0; Snap X Value ← `homeX` Variable ← `targetInput`) › **card** (80×80) › "Card"; four Texts on
Drag X / Drag Y / Delta X / Delta Y; a status Text on the `status` Variable; the input; a "Snap home" button → both Dos]; Drag
Started / Drag Ended / Done → three Set Variables fed by three `String` nodes. **The reverted arm** (`probe-reverted.log`, HEAD
2a2dd4fa): `node drag (Drag) is in the visual tree but has no generator yet`, the card subtree "has no translation in this slice"
(not "inside drag" — the unsupported-child path does not disposition descendants), the three Set Variables silenced from the
value side (*"the value wire has no statically known source"* — §54.2's finding, §59's again), 6 silenced, `pathway: false`.
**Built**: 16 files, 0 refusals, the one shell note, the real `tsc` over the app clean.

### §63.3 Gates

```
packages/nodegx-export: tsc --noEmit 0 · drag.test.ts 51/51
  §A the fixture whole + the real ts.Program (9) · §B the hook under a fake React + fake DOM + hand-driven frame clock (21)
  §C refusals and drops by mutation, each sentence exact (16) · §D the shapes a wire changes, two typechecked as real programs (3)
  §F the findings pinned (2)
export-ledger:check OK (exit 0) · picker --check 106/127 (83.5%), floor 106, exit 0 (was 105 on this branch)
eight floor pins moved 105 → 106: animation-pair, browser-utilities, filter-records, on-app-error, object-store, run-tasks, script, streaming-trio
neighbours re-run one at a time, green: in-code-markers 57, unreported-deferrals 7, logic 29, cascade 83, preflight 241,
  emitted-syntax 68, exported-readme 184, typecheck-emitted 37, animation-pair 57, browser-utilities 55, filter-records 34,
  on-app-error 41, object-store 35, run-tasks 67, script 74, streaming-trio 59
arms 17/17 KILLED, every arm compiled, sources restored md5-identical after each (mut.py, mut-summary.txt): M1 axis x also drags
  Y — 2 · M2 no slack — 1 · M3 outputs after the pulse — 2 · M4 commit ignores the axis — 2 · M5 no Done on a no-op snap — 1 ·
  M6 '' no longer abstains — 1 (a SURVIVOR on the first cut: B15 never observed the abstained value between two accepted ones —
  the row was added) · M7 Drag Started keeps the snap running — 1 · M8 touchstart never removed — 1 · M9 getters → captured
  values — 11 · M10 pulse-as-value refusal removed — 1 · M11 every child drawn — 1 · M12 a handler-only option prints — 1 ·
  M13 the Failure sentence inverted — 1 · M14 the disposition restore disarmed — 1 · M15 the wrapper without handlers — 9 ·
  M16 animate.ts not earned — 4 (the emitted tsc among them) · M17 an effect keyed on the handle — 1. M14 re-cut against the
  narrowed restore: KILLED — 1 (F2).
  Nine first cuts of the lib "NOT CUT": dragLib.ts is a quoted line array, and a multi-line anchor never matches — re-cut
  against the quoted lines. Two first cuts (M13, M14) did not compile ("0 total" is not a kill) and were re-cut at the value level.
whole package jest: 72 files (72 on disk = 71 + this spec), 2512 rows, exit 0, alone on the box at load 5.4 — run AFTER the last
  src/ change (a first full run read 2511/2512: visual.test.ts's "a page's sole Group child collapses into the page div" —
  the disposition restore's first cut was too broad, §63.4 #2; narrowed, re-run, 72/72)
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci (the exp-013 re-pin), any drive.
```

### §63.4 What building it found

1. 🔴 **A `String` node's output port is `savedValue`, not `value`.** The fixture's three chains read *"the value wire has no
   statically known source"* in BOTH arms until `roster-desk`'s wiring was read; §59's E7 (`Value Changed`'s port) again, on the
   fixture rather than the node. Pinned (F1).
2. 🔴 **The attach pass writes `collapsed into snapBtn` over a RENDERED sink.** The Drag whose snap Do a button fires read
   "collapsed" in its own report while it draws — the Checkbox with a wired Check has done the same since the controlled-state
   slice, unseen because nothing asserted a rendered control's disposition. One loop after every pass restores `static` for every
   rendered id that is the sink of a trigger wire; pinned (F2), an arm (M14). ⚠️ The first cut restored EVERY rendered
   collapse and the whole suite caught it (`visual.test.ts`: a page's sole Group collapses into the page div, truly) — a fix
   scoped by the symptom, not by the population that produced it.
3. ⚠️ **Predicted a text input's live text into an option would be handler-only.** It is a state row: the controlled-state slice
   mints `useState` for a control read outside its own onChange, and the option is `scale: snapTarget` — §57.4's second trap,
   verbatim. The handler-only drop needed a genuinely handler-only source: a received event's payload (C6); the state-row shape
   is pinned beside it (C6b).
4. ⚠️ **My slack arithmetic was wrong and the lib was right** (B5's first expectation said 150; the library's own sums give 120 —
   the first clamp's overshoot is 320−240 = 80, not 110). The row keeps the derivation.
5. ⚠️ **`Condition`'s input is `condition`, not `valueA`** — the panel's comparator fields are not ports (D3's first cut).
6. ⚠️ **A 1 ms frame is not "nowhere near"**: easeOut moves 20 → 0 by 0.2 in a 300 ms tween (B15).
7. ⚠️ **A mutant of a quoted line array needs a quoted-line anchor** — nine arms cut nothing on the first pass and said so.

### §63.5 What this leaves (owner NONE unless named)

- **The wrapper `<div>` takes the child's place in the parent's flex flow** — **the STRETCH case is FIXED (§63.6: `fit-content`
  on both axes; the drive had measured a 320 px wrapper around an 80 px card, pinning x)**; the rest stands — where the runtime drags the child's own root: a
  child with `flex-grow` or `align-self` now relates to the wrapper. The alternative — printing the ref, the transform and the
  handlers onto the child's own element — needs every role's printer to accept injected attrs and a style merge; recorded, not
  built. Owner NONE.
- **The three marker classes** (`react-draggable`, `-dragging`, `-dragged`) are not emitted; an author's CSS targeting them
  would not apply. Owner NONE.
- **A snap Value that arrives NaN twice in a row raises once** (an effect keyed on the value; the setter raises per delivery).
- **The Bounding Box, Child Index, Children Count, Screen Position, `this`, `didMount`/`willUnmount` ports** take the generic
  sentences a Group's take; this row translates the drag ports only.
- **A wire delivering `undefined` into Axis or Constrain to parent** reads as "set to nothing" in the lib (`'axis' in options`),
  which is the runtime's answer; a wire that DELIVERS the literal default is indistinguishable from an authored one — fine.
- The Variable `homeX`'s render local prints as `x` (the existing Variable local minting) — a poor name beside `card.x`, not this
  row's, and it typechecks. Owner NONE.
- **Not driven in a browser this session** (the brief forbids drives from a slice agent); the orchestrator's headless drive of
  `board-desk` is owed — the lib is graded under a fake DOM (§B, 21 rows), which cannot see `offsetLeft`, `getComputedStyle`
  or a real `touchstart` being passive.

### §63.6 The drive — the built export, headless; the wrapper stretched, and the X bound collapsed (session 88, 2026-09-05)

`board-desk` emitted (16 files, 0 refusals), built exit 0 / 0 `error TS`, `vite preview` 4363, Chrome 9363, `--target=Board`. The pointer
was driven with real `MouseEvent`s — `mousedown` dispatched on the card's `<p>` (bubbling to React's root listener and the wrapper's
`onMouseDown`), `mousemove` / `mouseup` dispatched on `document` (where `handleDragStart` attached the core's listeners). The READ printed
the four live values, the wrapper's inline transform, and — computed from the wrapper's MEASURED box — the position react-draggable's
`getBoundPosition` would produce for the same pointer path. `EXPECTED-60-62-63.md` first.

🔴 **PREDICTED BY READING, CONFIRMED BY ARM A: the wrapper was 320 px wide around an 80 px card.** `.board` is a COLUMN flex container;
the wrapper is an unstyled `<div>` and therefore a flex item with `align-self: auto` ⇒ `stretch` across the cross axis. `getBoundPosition`
(transcribed verbatim) computes `right = innerWidth(board) − outerWidth(node) − node.offsetLeft = 320 − 320 − 24` and
`left = −node.offsetLeft = −24`: a bound of ONE value. The first bounded move pinned x at **−24** whatever the pointer did; the interpreter
drags the card's OWN root (80 px), whose bound is `[−24, 216]`, and the same move lands at **50**. §63.5's first residual ("the wrapper takes
the child's place in the parent's flex flow"), made concrete and measurable. (`offsetLeft` being relative to `body` — nothing positioned — is
the library's own quirk and identical in both worlds; so is the y clamp at `120 − offsetTop = 58`.)

- **Arm a** (`drive63.log`): M1 boot `20 20 0 0`, transform `translate(20px, 20px)`, **wrapper rect w 320 h 80, card 80, offsetParent
  BODY, oL 24 oT 62**. M2 mousedown (100,100) → `dragging`, values `20 20 0 0`. **M3 mousemove (130,150) → x −24, y 58, Δ −44 / 38** (the
  predicted pin). M4 mouseup → `released`, x/y kept, deltas kept (the stop rewrites x/y only). M5 type `50`, Snap home, +0.8 s → `50 0`,
  `snapped`, deltas kept, `translate(50px, 0px)` (the x tween 200 ms, the y tween the 300 ms default — `snapYDuration` absent). M6 Snap
  home again → identical (already there ⇒ no tween; `done` still fires). M7 errs `[]`. M8 type `abc` → one `drag/snap-position-not-a-number`
  console line, the position unchanged. M9 the `react-draggable-style-el` is in the head, the body class removed after the drop.
- **The fix** (`src/emit/dragLib.ts`): the handle's `style` carries **`width: 'fit-content', height: 'fit-content'`** beside the transform,
  so the wrapper is the child's box on either axis of either flex direction (a definite cross size opts out of `stretch`; the main size
  shrink-wraps). One place — the lib — not the printer: the page keeps printing `style={card.style}` verbatim. Pinned as `drag.test.ts`
  F3 (the lib text, the doc sentence, and the page adding no sizing of its own); the ten §B `handle.style` rows read the pair through
  `wrapperStyle()`. 52/52; package tsc 0.
- **Arm b** (`drive63b.log`, predicted before its run): **M1 wrapper rect w 80 h 80**, oL/oT unchanged, the computed prediction now
  `x 50, y 58`; **M3 → x 50, y 58, Δ 30 / 38** — the runtime's answer for the same pointer path; M4 released with the same numbers; M5
  `50 0` (x already there ⇒ only the y tween), `snapped`; M6–M9 as arm a. Zero window errors, teardown 0 listeners.

What this leaves of the residual: a child authored with `flex-grow` or `align-self` still relates to the wrapper rather than the board
(the wrapper is fit-content, so a growing child no longer grows); the full answer remains printing the ref, the transform and the handlers
onto the child's own element. Owner NONE. Cannot see: `touchstart` `passive: false` (no `getEventListeners` under `Runtime.evaluate`), a
real touch, the un-emitted marker classes.

## §64 Tier 3.11 row 1 — `Server-Sent Events`: the streaming table's fourth member, the connection machine transcribed (session 88, 2026-09-05)

### §64.0 Design — what the node is on disk, and what that decides (written before a line of code)

`net.noodl.SSE` (display name *Server-Sent Events*, category Data, `ssr: client-only`) is `agent/sse.ts`: a thin shell over
`sse-connection.ts` — `SseConnection` (a state machine `idle → connecting → open → reconnecting → closed | error`, an exponential
backoff `base · 2^attempt` capped at a maximum, a `RecentIds` dedupe window of 512, `Last-Event-ID` carried on a reconnect) over
one of two transports (`FetchStreamTransport`: fetch + a streaming body, headers, a method and a body, the frames parsed here;
`EventSourceTransport`: the browser's EventSource, no headers, the browser's own retry reported as a self-retry) — and
`stream-parsers.ts`'s SSE half (`parseSseChunk`, the WHATWG event-stream grammar; `parseJsonOrText`; `textForPath`).

The port set on disk (the catalog): 17 inputs — every one a value port except `connect` / `disconnect` (the two Actions) —
and 21 outputs: 4 Events (`onOpen`, `onMessage`, `onError`, `onClose`), the outcome trio + Completed, 13 values (Status:
`connectionState`, `connected`, `lastError`, `retryCount`, `messageCount`, `lastMessageTime`, `duplicatesSuppressed`,
`deliverySemantics`; Data: `data`, `raw`, `text`, `eventType`, `lastEventId`).

**That is §58's shape exactly, minus a data port**: config ports read live off an options object, action verbs on the handle,
signals as listeners, values as live getters. So the node joins `STREAM_NODES` as its fourth member (`kind: 'sse'`) rather
than growing a table of its own — `streamPlanOf` / `streamReadOf` / `compileStreamAction`, `stream-out` / `stream-action`, the
attach pass's `OWN_CHAIN_OUTPUTS`, the binding table by declared type, all inherited. Two things the table had to learn:
`data` became optional (a node whose actions carry nothing), and a spec gained `lib` + `sourceFile` so a hook can live in a
module other than `streaming.ts` (component.ts groups the imports by module; emitApp ships each where a hook of its printed).

The lib is its own module, `src/lib/sse.ts` (≈1,250 lines), because the machine is large and the trio's users should not carry
it; it imports `describeError` / `tryParseJson` / `StreamSource` from `./streaming` and `raiseAppError` from `./errors`, so a
transport alone earns both. The hook follows the Drag row's shape (a machine in one ref, live getters, a `rerender` where the
runtime `flagOutputDirty`s) with the runtime's own `_internal` and methods transcribed one for one: `applyOptions` = the
setters (each coercion verbatim: `url` `''` for null/undefined else `String`, `transport || 'auto'`, `method || 'GET'`,
`headers` an object or none, `!!` for the booleans, `Number(v) > 0 ? Number(v) : default` for the three delays/retries);
`doConnect` (settle an earlier Connect as Unchanged, tear down, snapshot `_internal` into `SseConnectionOptions`, connect);
`handleState` (the state written → re-render → On Open / On Close → the pending Connect settles Done on `open`, Failure with
`sse/connect-failed` + the connection's Last Error on `error`); `handleFrame` (Raw, Data = `parseJsonOrText`, Event Type →
re-render → On Message); `handleError` (re-render → On Error); `scheduleAutoConnect`'s body as an effect run after every render
that changed URL or Auto Connect (a live connection on a changed URL is superseded and reopened when Auto Connect says so);
`_onNodeDeleted` as the unmount cleanup. `Node.beginOutcome` / `reportOutcome` as a one-shot token: on Failure the raise, then
the outcome's pulse, then Completed — the trio's transcription of the same contract.

**Refused by name** (the table's own gates, unchanged in wording): two wires on one input (*"two wires feed its URL input —
last-writer-wins is not statically ordered"*); a config wire whose source only exists inside a handler; a signal consumed as a
value (*"its onMessage output is consumed as a value — a pulse carries nothing to read"*); an input or output the node has not
got; a chain this slice cannot compile; a component with no file (*"component emits no file to host the Server-Sent Events"*).
Every port translates.

### §64.1 What is emitted

- **`src/emit/sseLib.ts`** (new) → `src/lib/sse.ts`: the parsers (`parseSseChunk`, `parseJsonOrText`, `splitPath`,
  `valueAtPath`, `textForPath`), `backoffDelay`, `RecentIds`, the two transports, `SseConnection`, `resolveTransport` —
  verbatim from the runtime, the three `'X' in options ? options.X : …` seam reads made `?? null` (the emitted app's stricter
  tsconfig; falsy-means-absent is preserved); `ServerSentEventsOptions` / `Listeners` / `Handle`; `useServerSentEvents(source,
  options, on, env = {})` — `env` is the runtime's own test seam (a fetch, an EventSource, an AbortController, timers, a
  clock), spread into the connection options; the emitted page never passes it. Generated from a plain-text source
  (`sse-lib-source.ts` + `gen-sselib.py` in the session scratchpad) into the quoted-line-array form the other libs use.
- **plan.ts**: `SSE_TYPE`; `StreamKind` + `'sse'`; `StreamNodeSpec.data?` optional, `lib`, `sourceFile`; the fourth table
  entry (15 config ports, 2 actions, 8 signals in `sse.ts`'s declaration order, 13 values with `data` maybe-undefined);
  `OWN_CHAIN_OUTPUTS[SSE_TYPE]`; `streamPlanOf` reads `spec.data` only when present, the comment from `sourceFile` / `lib`;
  `streamTypeOfKind` (the one kind→type ladder, shared with component.ts and `streamFieldMaybeUndefined`).
- **component.ts**: the hook import grouped by `lib` (`../lib/streaming` and `../lib/sse` as two lines); `sseLib` flag;
  the cast ladder through `streamTypeOfKind`. **emitApp.ts**: `sseLibUsed`; `streaming.ts` shipped when either module is
  used; `errors.ts` earned by sse.ts; the file. **Ledger**: the row `translated` with a note, floor **114 → 115**
  (90.6%), the comment sentence; 12 pins moved. **EXP-013's badge spec** pins `net.noodl.WebSocket` as the scheduled row now.
- **The page** (token-desk): `const stream = useServerSentEvents({ label: 'Stream', nodeId: 'stream', componentName:
  '/Pages/Home' }, { url: 'http://localhost:8582/stream', textPath: 'choices.0.delta.content' }, { onOpen: () =>
  status.set('open'), onMessage: () => tokens.add(stream.text), onClose: () => status.set('closed'), failure: () =>
  status.set('failed') });` — the accumulator's Chunk read AT the pulse (the trio's rule); `stream.connect()` /
  `stream.disconnect()` on the buttons; `{stream.connectionState}` bare, `{String(stream.connected)}`,
  `{String(stream.messageCount)}`, `{stream.lastError}` bare — by declared type.

### §64.2 The fixture — `tests/fixtures/token-desk`

`Pages/Home`: `stream` (SSE, URL `http://localhost:8582/stream`, Text Path `choices.0.delta.content`, nothing else authored) ←
Connect / Stop buttons; `stream.text → acc.chunk`, `stream.onMessage → acc.add` (a Text Accumulator — **the streaming-LLM
shape**, §58.5's "what a transport's onMessage chain would call"); `onOpen` / `onClose` / `failure` → three String-fed Set
Variables on `status`; Connection State, Connected, Message Count, Last Error, the accumulated text and the status each in a
Text. **The reverted arm** (`probe-reverted.log`, HEAD f23368a1): 18 refusals — `logic node (net.noodl.SSE)`, the accumulator
*"its Chunk input is fed by net.noodl.SSE — no statically known source"*, the three Set Variables *"trigger stream.onOpen is
not a rendered element event or a receiver"*, their Strings behind them, every wire into or out of the node dropped.
**Built**: 16 files, 0 refusals, the shell note alone; the real `tsc` over the app clean (`typecheck-emitted`).

### §64.3 Gates and arms

```
pkg tsc 0 (after every stitch) · sse.test.ts 35/35
  §A the plan and the page (7) · §B the refused shapes by mutation (6) · §C the lib's text, the module earning (4) ·
  §D the pure cores under node (6: the frame grammar incl. CRLF/BOM/NUL-id/comment lines, JSON-or-text, the text path,
  the backoff, the dedupe window, the transport choice) · §E the hook under the harness with a scripted fetch, a scripted
  EventSource and the runtime's timer seam (11: the happy path with a frame split across chunks, Disconnect open/closed,
  a fatal 4xx with the raise, the backoff and Max Retries' suffix, dedupe on/off, Auto Connect and a URL change, a
  superseded Connect, unmount, the EventSource transport incl. the browser's own retry, the setters' coercions and a POST
  body, Text Path live + options snapshotted at Connect + Last-Event-ID on the reconnect) · §F the ledger (1)
streaming-trio 60/60 (the catalog-set row now grades the fourth member too) · typecheck-emitted 41/41 (token-desk under
  the real tsc) · drag 52/52 · export-ledger:check OK 122 translated · picker --check 115/127 (90.6%) exit 0
arms (mut.py, mut-summary.txt; sources restored md5-identical after each): 16 armed — 14 KILLED on the first run:
  M1 dedupe off (1 row) · M2 open never settles Done (6) · M3 Failure never raises (2) · M4 Last-Event-ID dropped (2) · M6 unmount
  keeps the connection (1) · M7 the trailing newline kept on data (3) · M8 textForPath drops numbers (1) · M9 onClose off the signal
  list (13) · M10 every hook imported from streaming.ts (2) · M11 sse alone does not earn streaming.ts (1) · M12 Completed never fires
  (8) · M13 Data is the raw text (3) · M14 Disconnect leaves the pending Connect unsettled (1) · M16 a 4xx is not fatal (1).
  M15 the setter reads Reconnect Delay raw — SURVIVED and EQUIVALENT: backoffDelay re-guards `base > 0 ? base : 1000`, so no delivered
  value can tell the two apart (the runtime carries the same redundancy); recorded, not fixed.
  M5 the same-URL guard in scheduleAutoConnect removed — SURVIVED ⇒ a missing row: E6 gained "Auto Connect flipped on while the same
  URL is live does nothing" (a re-render and a manual-Connect variant); re-armed after the row: KILLED (1 row). 15/16 killed, 1 equivalent.
whole package jest ONCE on the final tree: 76 files (76 on disk), 2778/2778, exit 0 · editor tsc 0 · exp-012/013 157/157 ·
  editor test:ci 2943 specs / 5 failures = the known floor (AIX-006 ×4 + SB-017 acceptance 6), seed 88918, HEAD 9346e392,
  `.webpack-cache` cleared first, `test-results.json` fresh
```

### §64.4 What building it found

1. 🔴 **The emitted app's tsconfig is stricter than the runtime's** — `'fetchImpl' in options ? options.fetchImpl : …`
   types as `T | null | undefined` under it and the real `tsc` over token-desk was red at three lines while the package's
   own tsc, the spec and the hook harness were all green. `typecheck-emitted` is the gate that saw it; `?? null` keeps the
   runtime's falsy-means-absent reading. ✅ run `typecheck-emitted` before the first arm, not after the last.
2. 🔴 **The cascade sentence changed when the node joined the table.** Reverted, the Set Variables behind the Events read
   the attach pass's *"trigger stream.onOpen is not a rendered element event or a receiver"*; with the node in the table and
   REFUSED (an unknown port), they read the generic *"logic node (Set Variable)"* — the registration pass answers before the
   attach pass does. Both honest, both graph-rooted at the stream by EXP-013's `causedBy`; B5 pins the observed sentence.
3. ⚠️ **Completed is per token.** A Disconnect before the Connect opened logs `unchanged, completed, onClose, done,
   completed` — the superseded Connect's token and the Disconnect's own each report Completed (the runtime's
   `reportOutcome` on each `beginOutcome`). My first expectation had one; the runtime's answer is two (E7).
4. ⚠️ **The connection options are a snapshot at Connect** — `doConnect` copies `_internal` into `SseConnectionOptions`, so
   `Reconnect On Stream End` set after the Connect applies to the NEXT connection; `Text Path` is read by the getter, so it
   IS live. Pinned as E11, with the reconnect carrying `Last-Event-ID: 41`.
5. ⚠️ `Cache-Control` is not a CORS-safelisted request header, so the fetch transport pre-flights (an OPTIONS before the
   GET) against a cross-origin endpoint — the runtime's fetch does the same; a fake endpoint must answer OPTIONS.
6. ⚠️ The catalog-set row in the trio's spec iterates the whole table — the optional data port made `spec.data.port` a type
   error there before it was a runtime one; the row now grades all four members.

### §64.5 What this leaves (owner NONE unless named)

- **`WebSocket`** ✅ built session 89 (§65). **`Subscribe To Changes`** — Tier 3.11 row 3, scheduled; the badge spec pins it now.
  Owner **EXP-011**.
- A **`Headers` object fed by a wire** prints the render local; an authored Headers literal on disk (an object parameter)
  would need the object-literal print the record verbs use — no fixture authors one. Owner NONE.
- **`Body` for a POST** is JSON-encoded unless a string, as the runtime's is; a Content-Type authored in Headers wins.
  Not driven (the fake streams on GET). Owner NONE.
- StrictMode in development mounts twice: the first connection is torn down by the cleanup and the second mount's pass
  reopens it (Auto Connect) — one extra request in dev only, as the Drag row's touchstart note. Owner NONE.
- The hook re-renders once per state change / frame / error (the runtime's `flagOutputDirty` batch); a fast token stream
  re-renders per token — the runtime does too. Owner NONE.

### §64.6 The drive — the built export, headless, against a fake event stream (session 88)

`token-desk` built (exit 0, 0 `error TS`), `vite preview` 4364, Chrome 9365, `--target=Token`; `fakesse.js` on 8582 —
`GET /stream` answers `text/event-stream`, a `: hello` comment, four OpenAI-delta frames (`id: 1..4`, tokens `Hel` `lo, `
`wor` `ld!`) 120 ms apart, then ends; every request logged. `EXPECTED64.md` first: **T1** boot `idle false 0 '' '' ''`, no
request (Auto Connect off) ✓ · **T2** Connect, +250 ms: an OPTIONS pre-flight then ONE `GET /stream` with `Accept:
text/event-stream` and `Cache-Control: no-store`; `open true 2 '' 'Hello, ' 'open'` ✓ · **T3/T4** `closed false 4 ''
'Hello, world!' 'closed'` — the accumulator concatenated the Text at each On Message, the clean end closed without a reconnect,
still one GET ✓ · **T5** Stop when closed: READ identical (Unchanged, nobody listens) ✓ · **T6** Connect again then Stop: a
second GET with **no Last-Event-ID** (a fresh Connect is a fresh connection), count `3` (the new connection's), tokens
`Hello, world!Hello, wor` ✓ · **T7** errs `[]`, no raise ✓. Teardown: 0 listeners on 4364 / 9365 / 8582.

## §65 Tier 3.11 row 2 — `WebSocket`: the streaming table's fifth member, the connection machine and the rebuild policy transcribed (session 89, 2026-09-05)

### §65.0 Design — what the node is on disk, and what that decides (written before a line of code)

`net.noodl.WebSocket` (display name *WebSocket*, category Data, `ssr: client-only`) is `agent/websocket.ts`: a shell over
`websocket-connection.ts` — `WebSocketConnection` (a state machine `idle → connecting → open → reconnecting → closed | error`;
an equal-jitter exponential backoff `base · 2^attempt` capped at a maximum and scaled into [50 %, 100 %]; a FIFO send queue
with three When Disconnected policies — queue, drop, report an error — and a Max Queue Size that refuses the NEWEST; a heartbeat
that sends application text on an interval, measures the reply as Latency, swallows it, and treats an unanswered one as a dead
connection; the fatal close codes 1002/1003/1007/1008/1009/1010/1015 never retried; a clean 1000/1001 with Auto Reconnect off
`closed`, everything else `error` and loud) — plus the node's own policy: `url` / `protocols` / `autoConnect` schedule a
**rebuild** (a changed identity disposes the connection and reopens where the app still wants one; an unchanged identity does
nothing, so a Send queued in the same frame survives), every other input is tuning applied in place through `applyConfig` /
`configure` (a heartbeat interval change restarts the heartbeat at once). `Connect` mints the outcome token at the port and
nowhere else — auto-connect and rebuild mint none — so a first attempt that dropped and a retry that opened is ONE Done.

The port set on disk (the catalog): 18 inputs — `message` (`*`) the data port that only `send` carries, 14 value ports, the
three Actions — and 22 outputs: 6 Events (`onOpen`, `onMessage`, `onMessageSent`, `onError`, `onClose`, `onReconnect`), the
outcome trio + Completed, 12 values (Status: `connectionState`, `connected`, `retryCount`, `lastError`, `queueSize`,
`droppedCount`, `latency`, `closeCode`, `closeReason`; Data: `received`, `receivedRaw`, `receivedIsBinary`).

**That is the streaming table's shape with the data port back** (§58's `takesData` on one verb, §64's optional data): the node
joins `STREAM_NODES` as its fifth member (`kind: 'websocket'`, `lib: 'websocket'`), the Message read AT the pulse by the Send
verb — `socket.send(message.get())` — as the trio's Chunk/Data are. Nothing in `streamPlanOf` / `compileStreamAction` /
`stream-out` / `stream-action` changed; the `lib` union grew a third member, component.ts's import loop and path ladder took it,
emitApp ships the file. **The lib imports `./errors` only**: its source type is its own, so a socket alone does not carry the
trio's 1,000-line module (§64's sse.ts did, for `describeError` / `tryParseJson`).

The hook, `useWebSocket(source, options, on, env)`: `_internal` (connection, config, autoConnect, pendingConnect, received ×3)
in one ref; `applyOptions` = the setters keyed on presence (`url` a string else `''`, `autoConnect` / `autoReconnect` /
`jitter` `!!`, `protocols` through `parseProtocols`, the five numbers `Number(v)`, the two heartbeat strings a string else
`''`, the two enums `|| 'auto'` / `|| 'queue'`), the identity three written to `internal`, the rest through `applyConfig`;
`getConnection` lazy, rebuilt after a dispose, with the runtime's six callbacks (`onStatus` ⇒ re-render, and the `error`
state settles the pending Connect as Failure `websocket/connect-failed`; `onOpen` ⇒ On Open, On Reconnect when it is one,
then Done; `onMessage` ⇒ the three Data outputs written, re-render, On Message; `onError` / `onClose` / `onSent` ⇒ their
Events) and `...env` last (the seams: a WebSocket constructor, timers, a clock, a random); `rebuild` verbatim; an effect after
every render applies the options and runs `rebuild` at mount and whenever `url` / `protocols` / `autoConnect` changed (the
setters fire on delivery); the unmount cleanup is `_onNodeDeleted` (dispose, forget the token). The three verbs: `connect()`
(settle an earlier one Unchanged, mint, `connect()`), `disconnect()` (its own token; a pending Connect Unchanged; Done when
something closed else Unchanged), `send(message)` (Failure with the connection's own code — nothing-to-send, not-connected,
queue-full, encode-failed, send-failed — Unchanged for a policy drop, Done for sent OR queued).

**Refused by name**: the table's own gates, unchanged in wording (B1–B6). Every port translates.

### §65.1 What is emitted

- **`src/emit/websocketLib.ts`** (new) → `src/lib/websocket.ts` (≈1,050 lines): websocket-connection.ts verbatim
  (`WebSocketConnection`, `nextReconnectDelay`, `isFatalCloseCode`, the codes, the defaults) — two strictness edits for the
  emitted app's tsconfig (`_config` typed `Required<…>`; the `'WebSocketImpl' in options ? (options.WebSocketImpl ?? null)`
  seam read, §64.4's lesson applied before the first arm; `(this._socket as WebSocketLike).send(frame)` where the runtime
  relies on its callers); then the node: `WebSocketOptions` / `Listeners` / `Handle`, `createInternal` (= initialize, **Auto
  Connect true**), `identityChanged`, `parseProtocols`, `reportOutcome` / `settleConnect`, `getConnection`, `applyConfig`,
  `rebuild`, `applyOptions`, `teardown`, `useWebSocket`. Generated from a plain source (`websocket-lib-source.ts` +
  `gen-wslib.py`, the session scratchpad) into the quoted-line-array form — regenerate, never hand-edit.
- **plan.ts**: `WEBSOCKET_TYPE`; `StreamKind` + `'websocket'`; `lib` + `'websocket'`; the fifth table entry (data `message`,
  14 config, 3 actions with `send.takesData`, 10 signals in websocket.ts's declaration order, 12 values with `received`
  maybe-undefined); `OWN_CHAIN_OUTPUTS[WEBSOCKET_TYPE]`; `streamTypeOfKind`'s ladder.
- **component.ts**: the import loop over three modules, the path ladder, the `websocketLib` flag. **emitApp.ts**:
  `websocketLibUsed` earns errors.ts and ships the file; never streaming.ts. **Ledger**: the row `translated` with a note,
  floor **115 → 116** (91.3 %), the comment sentence; 13 pins moved; the two catch-all pins that used `net.noodl.WebSocket`
  as "a node nothing translates" re-pointed (relation-verbs → `net.noodl.PatternExtractor`, unreported-deferrals → an
  unwired `RunTasks`, whose own gate says "nothing fires its Do"). **EXP-013's badge spec** pins `SubscribeToChanges` now.
- **The page** (socket-desk): `const socket = useWebSocket({ label: 'Socket', nodeId: 'socket', componentName: '/Pages/Home' },
  { url: 'ws://localhost:8583/' }, { onOpen: () => status.set('open'), onClose: () => status.set('closed'), onReconnect: () =>
  status.set('reconnected'), failure: () => status.set('failed') });` — `socket.connect()` / `socket.disconnect()` /
  `socket.send(message.get())` on the buttons; `{socket.connectionState}` bare, `{String(socket.connected)}`,
  `{String(socket.queueSize)}`, `{String(socket.received ?? '')}` (the `*` port, undefined before the first frame),
  `{socket.receivedRaw}`, `{socket.lastError}` — by declared type.

### §65.2 The fixture — `tests/fixtures/socket-desk`

`Pages/Home`: `socket` (WebSocket, URL `ws://localhost:8583/`, nothing else authored — **so Auto Connect is on**) ← Connect /
Stop / Send buttons; a Text Input written through to a `message` Variable that feeds `socket.message` — **the live-chat
shape**; `onOpen` / `onClose` / `onReconnect` / `failure` → four String-fed Set Variables on `status`; Connection State,
Connected, Queue Size, Received, Received Raw, Last Error and the status each in a Text. **The reverted arm**
(`probe-reverted.log`, HEAD af752b95): 21 refusals — `logic node (net.noodl.WebSocket)`, the four Set Variables *"trigger
socket.onOpen is not a rendered element event or a receiver"*, their Strings behind them, every wire into or out of the node
dropped. **Built**: 15 files, 0 refusals, the shell note alone; the real `tsc` over the app clean (`typecheck-emitted`).

### §65.3 Gates and arms

```
pkg tsc 0 (after the stitch) · typecheck-emitted socket-desk ✓ (run BEFORE the first arm) · websocket.test.ts 37/37
  §A the plan and the page (9: incl. A8 an authored Message literal / a bare send(), A9 the input-text refusal) · §B the refused
  shapes by mutation (6) · §C the lib's text, the module earning (4: errors.ts yes, streaming.ts no; beside an accumulator both)
  · §D the pure cores under node (5: the backoff incl. equal jitter and the exponent clamp, the fatal codes, parseProtocols,
  identityChanged, the connection alone) · §E the hook under the harness with a scripted socket and the runtime's timer /
  clock / random seams (12: auto-connect at mount with no outcome + text/JSON/binary frames; Connect and the replacement;
  Send's four encodings and the refused empty one; the queue and its three policies + the full-queue refusal; Disconnect
  ×3; the outage — one Done across a never-opened Connect, the backoff growing across a failed retry and resetting on open,
  the give-up; Auto Reconnect off incl. the Failure raise; the heartbeat incl. the dead-connection path; the rebuild policy
  — URL change, tuning in place, the same-parse protocol guard, Auto Connect flips, the deliberately disconnected node;
  unmount; the setters' coercions ×4; superseded tokens) · §F the ledger (1)
streaming-trio 60/60 (the catalog-set row grades the fifth member) · sse 35/35 · relation-verbs + unreported-deferrals re-pointed ✓
export-ledger:check OK 123 translated · picker --check 116/127 (91.3 %) exit 0
arms (mut.py, mut-summary.txt; sources restored md5-identical after each): 17 armed — 17 KILLED on the first run:
  M1 the queue flushes before On Open (1 row) · M2 On Reconnect never fires (3) · M3 a queued Send is Unchanged (1) · M4 the
  give-up never settles the pending Connect (2) · M5 jitter ignored (1) · M6 a URL change re-points instead of rebuilding (1) ·
  M7 the heartbeat reply delivered as a message (1) · M8 a fatal close code retried (1) · M9 unmount keeps the socket (1) · M10
  Failure never raises (4) · M11 onReconnect off the signal list (16) · M12 the Send verb carries no data (3) · M13 the hook
  imported from sse.ts (2) · M14 websocket.ts never shipped (4) · M15 Auto Connect defaults off (9) · M16 a Disconnect with
  nothing built reports Done (1) · M17 Received is the raw text (1).
whole package jest ONCE on the final tree: 77 files (77 on disk), 2835/2835, exit 0 · editor tsc 0 (exit 0, empty log — s88's read the same) ·
  exp-012/013 157/157 · editor test:ci 2943 specs / 5 failures = the known floor (AIX-006 ×4 + SB-017 acceptance 6 "Expected 39 to be
  38"), seed 16782, HEAD b2d68b51 (a peer's commit on top of af752b95), `.webpack-cache` cleared first, `test-results.json` fresh 18:26;
  the enforced gate exits 1 on the floor exactly as s88's did
```

### §65.4 What building it found

1. 🔴 **A text input's value cannot feed a stream's data port directly.** The first built emit refused the node: *"its Message
   input reads a value that only exists inside a handler"* — a text input's `onTextChanged` resolves to `input-text`, legal
   only inside that input's own onChange (the exporter's standing rule; §3's form idiom, RECORD-VERBS §3). Every other
   fixture writes an input through a Variable, and so does this one now; A9 pins the sentence. **Not this row's to change**
   — the rule is the exporter's, and a wire from a text input into ANY handler-read port meets it — but it is the first place
   the streaming table meets it, because the trio's data ports were fed by other streams. Owner NONE (registered; the fix
   would be §4c's "a control's value output anywhere in the component reads its local state" extended to the table's data
   port, which is a table-wide decision).
2. ⚠️ **A manual Stop then Connect fires On Reconnect.** `disconnect()` does not dispose the connection, so `getConnection()`
   returns the same object, whose `_hasEverOpened` is true — the next open is "an open after the first". PREDICTED in
   `EXPECTED65.md` before the drive (T5 `reconnected`), observed. The runtime does the same; the docs' *"including after a
   reconnect"* is broader than an outage. E2 pins the replacement case, the drive the Stop/Connect case.
3. ⚠️ **`_fail` settles the token before it fires On Error** — a Connect with no URL logs `failure, completed, onError`, where
   the connection's give-up logs `onError, onClose` and a status-settled failure between (`onError, failure, completed,
   onError, onClose` for a never-opened socket with Auto Reconnect off). All three orders are the runtime's callback order
   (status first), pinned as E7 / E11.
4. ⚠️ **The fired-timer trap in the harness**: a timer that has run is not "pending" — the first `pending()` counted it and
   read a growing backoff where the counter had in fact RESET on the successful open. Fixed in the seam; E6 now shows both:
   the backoff growing across a failed retry (1000 → 2000) and starting over after an open.
5. ⚠️ `emit.ts` removes its output directory before writing — a copied `node_modules` inside it goes too; copy after the emit.
6. ⚠️ The catch-all pins that used `net.noodl.WebSocket` as "a node nothing translates" (relation-verbs ×2, unreported-
   deferrals ×1) were a countdown, not a control — the third time a Tier 3.11 row moved one (§39 Timer, §59 Hash).

### §65.5 What this leaves (owner NONE unless named)

- **`Subscribe To Changes`** — Tier 3.11 row 3, the last scheduled node; the badge spec pins it. Owner **EXP-011**. When it
  lands, the badge spec needs a scheduled node that is not being translated, or its pin becomes "no scheduled rows remain".
- A text input straight into Message (finding 1). Owner NONE.
- A **binary frame end to end**: the spec sends and receives one under the harness; the drive's fake speaks text only.
- **The heartbeat against a server that answers**: driven under the harness (E8), not against the fake. Owner NONE.
- **`wss://` with a subprotocol** the server selects: `protocols` is passed to the constructor (E2); no fake negotiates one.
- StrictMode in development mounts twice: the cleanup disposes the first connection and the second mount's rebuild reopens —
  one extra socket in dev only (§64.5's shape). Owner NONE.
- The hook re-renders on every status change / frame (the runtime's `flagOutputDirty` batch) — a chatty socket re-renders
  per message, as the runtime does. Owner NONE.

### §65.6 The drive — the built export, headless, against a fake WebSocket server (session 89)

`socket-desk` built (exit 0, 0 `error TS`; the s88 `node_modules` reused — the emitted package.json is identical bar the
name), `vite preview` 4365, Chrome 9366, `--target=Socket`; `fakews.js` (the repo's `ws`) on 8583 — greets each connection
`{"kind":"hello","connection":N}`, echoes text as `{"echo":…}`, closes 1011 "kicked" on the text `kick`; every event logged.
`EXPECTED65.md` first, every row graded: **T1** boot: the page connected at MOUNT with no button pressed (Auto Connect is the
node's default) — `open true 0 [object Object] {"kind":"hello","connection":1} '' open`, ONE server open, errs `[]` ✓ ·
**T2** type + Send: the server logged `hello there`, Raw = its echo, Queue `0` ✓ · **T3** Stop: `closed false`, status
`closed`, the server saw close 1000 `Client disconnect` ✓ · **T4** Send while closed: Queue `1`, no server line ✓ · **T5**
Connect: server open id 2, the queued message flushed AFTER the open and echoed on connection 2, Queue `0`, **status
`reconnected`** — the prediction (§65.4 #2) ✓ · **T6** `kick`: the server closed 1011; +300 ms `reconnecting`, status
`closed`, Error `Connection closed (1011): kicked; reconnecting in 617ms` (jitter inside [500, 1000]) ✓ · **T6b** +1.6 s:
server open id 3, `open true`, status `reconnected`, Raw the third hello, Error cleared ✓ · **T7** errs `[]`, no raise, no
console.error ✓. Teardown: 0 listeners on 4365 / 9366 / 8583.
