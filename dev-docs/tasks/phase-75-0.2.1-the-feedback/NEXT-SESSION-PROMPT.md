# Phase 75 — next session

**State as of 2026-08-26 (session 41).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it
bites.

**Committed this session:** queue item 1 — **FB-024**, the bench search
(`nodegx-community` `ee37d0a`). 🔴 **The filed defect was in a function nothing calls, and the
live one was worse than the file said.** Read
**[FB-024-THE-SEARCH-THAT-COULD-NOT-SEE-A-QUESTION.md](FB-024-THE-SEARCH-THAT-COULD-NOT-SEE-A-QUESTION.md)**
before touching search again.

⚠️ **Peers.** Four other `opennoodl-*` sessions have been seen on this machine in recent sessions,
and **every one of them runs its MCP server from *this* checkout's `node_modules/electron/dist`**,
so a sweep from any of them can match a `test:ci` electron. Nothing went wrong this session —
but note this session ran **no OpenNoodl gates at all**: the change was entirely in the sibling
`nodegx-community` repo.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-005 T2** — platform `project_templates` + list/detail/bundle routes | **M** | ✅ **now the top item.** T1 done, the editor side has a seam that takes a new provider. 🔴 **4 gates guard a new `/api/v1` route** (P73) and a **CHECK constraint passes on NULL** (TUT-004) |
| 2 | **FB-005 T4** | — | ✅ **UNBLOCKED** — it waited on the search item, which is now closed |
| 3 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |

✅ **FB-014 is off the queue** — design phase done, AC1 + AC3 met, AC2 shown to be impossible. Its
external-processor question is with Richard.

## ✅ Item 1, closed: FB-024 — and the queue item was wrong about where the bug was

The item read *"the bench search ANDs its terms — `websearch_to_tsquery` in
`nodegx-community/src/lib/bench.ts`, 2/22 even in perfect vocabulary."* Every clause of that is
true about `searchThreads`. 🔴 **`searchThreads` has exactly one importer: its own test file.** The
reader's search box goes `benchList` → `buildList` → `select()` in `facets.ts`, which matched a
**JavaScript substring** over rows already in memory. **Two different searches, and the defect was
filed against the one no reader can reach.**

⚠️ **Note the shape — it is s40's template registry one repo over.** A mechanism described
accurately, in a file nothing calls. **Grep the callers before believing the mechanism.**

🔴 **And the live defect was worse than the filed one.** `benchList` builds its rows from
`listThreads`, which returns `BenchThreadSummary` — title, handle, section, counts, **no body**. So
the box labelled *"Search questions"* **could not see one word of one question.** ⚠️ The Bench was
**the only one of the six lists** whose `searchable` named no text field; tutorials, profiles and
briefs all search a body, a bio or a description.

| query | before | after |
|---|---|---|
| a word in the TITLE | **1** | 1 (the control — the box worked at all) |
| a word in the QUESTION body | **0** | **1** |
| a word in an ANSWER body | **0** | **1** |
| the same words via `searchThreads` | 1, 1 | 1, 1 (the control — the text was always there) |
| `repeater draws` (adjacent, in order) | **1** | 1 |
| `repeater nothing` (*same title, same two words*) | **0** | **1** |
| `draws repeater` (reversed) | **0** | **1** |
| `which output fires when the row never updates` | **0** | **1** |
| that sentence with one nonsense word swapped in | 0 | **0** (the control) |

**What shipped.** `termsOf` makes the query its **words** rather than one substring — each term is
still a substring, so `kern` keeps finding `kerning`. **Postgres's own 127-word `english.stop`**
rather than a hand-written list: every term is required, so the sentence needed `which` and `when`
to appear in a thread, and **the words carrying no meaning were the only ones doing any
excluding**. `threadSearchText` feeds bodies in from the **parsed** model (as `excerptFor` does),
with **`hidden_at is null`** so a moderated post is not findable by a word inside it. And the label
now says what it searches.

🔴 **`plainto_tsquery` — the fix the item suggested — is a no-op.** Measured beside
`websearch_to_tsquery` on the same sentence it returns the **identical** tsquery. The two differ in
the syntax they accept, not in how they join what they parsed.

✅ **`searchThreads` was ORed and ranked anyway** — FB-014 measured this exact query as its lexical
arm — but 🔴 **an explicit operator is left alone, and the guard tests the PARSED query**: ORing
`repeater -solved` gives `'repeat' | !'solv'`, matching **every thread that fails to mention
"solved"** — a negation turned into its own opposite. ⚠️ It is deliberately **not** wired into the
faceted list: `select()` stays the only place a row is included or excluded, which is what makes a
pill's count equal the rows behind it.

## 🔴 Two instrument lessons worth carrying

1. 🔴 **A control arm that stops discriminating after the fix is not a passing arm — it is a dead
   one.** `nothing asker` matched before the fix by running off the end of a title into the author
   handle. After the fix it *still* matches, because both words are in the row. I nearly recorded
   that as "the span is closed". It is not closed — **term matching only ever WIDENS**, and
   anything the old whole-string match returned it returns too. The comment claiming otherwise was
   corrected before it shipped. **Re-ask what an arm excludes once the code under it has changed.**
2. 🔴 **A mutation script killed by the tool timeout LEFT A MUTANT IN THE TREE.** `mutate.py`
   reverted in a `finally`, and SIGTERM at 120 s skipped it — `facets.ts` sat with `return words;`
   in it. ✅ **Save pristine copies first, restore by `copyfile` from those, and `md5` all three
   files afterwards.** ⚠️ **And a waiter looping on `pgrep -f "vitest run"` MATCHES ITSELF** — its
   own `zsh -c` command line contains the pattern — so it never exits. Wait on the **PID**.

⚠️ **`M6`'s anchor was one space wrong and the script reported `ANCHOR-NOT-FOUND`** — the
hidden-post guard, the security-relevant one, was briefly ungraded while eight others looked fine.
**A mutant that never applied reads almost exactly like a mutant that was killed.** Re-run it; it
kills its spec.

## Gates — session 41

⚠️ **This session's change was entirely in `nodegx-community`. No OpenNoodl gate was run, and none
was implicated.** The OpenNoodl figures below are s40's and are quoted as history, not as
measurements of the current tree — **re-measure before relying on them.**

- `nodegx-community` full suite: **59 files / 1418 specs / 0 failures** (this tree, after the
  change). Needs ~22 minutes — **background it and wait on the PID**.
- `nodegx-community` `npx tsc --noEmit`: **0 errors**.
- `check:css` was **not** run — no stylesheet changed. ⚠️ It has one pre-existing non-ours
  violation.
- 🔴 **From s40, NOT re-measured this session:** `typecheck:editor` 0 errors; `test:main` 341 files
  / 5522 specs / 0 failures; `test:ci` **`Jasmine: 2849 specs, 4 failures`** — the recorded floor,
  all four AIX-006, by name. ⚠️ `test:ci` needs ~11 minutes and outlives a 600 s tool timeout.
  ⚠️ Quote the **summary line**, never `$?`: at s40 the compound exited **0** while the log's tail
  said `lerna ERR! npm run test:ci exited 1`.

## 🔴 Still open from FB-024 itself

- ⚠️ **`body_tsv`, its GIN index and its trigger still serve no reader.** The live search covers
  bodies now, so the column's only prospective caller is FB-014. If FB-014 is not built this is a
  delete — but it is a migration, and the call is **Richard's**, not a tidy-up.
- ⚠️ **`benchList` now parses the markdown of every visible post in the 200-thread window on every
  request** (the page is `force-dynamic`). Free at 3 posts; first thing to cache when the Bench has
  content.
- ⚠️ **Node names that are stopwords** — `For Each`, `Not`, `And`, `Or` are all in the snowball
  list. The all-stopword fallback covers the exact query `for each`; `Static Data For Each`
  searches `static data` and matches more widely than typed. Correct rows, extra ones.
- ⚠️ **Not deployed** — nexus-1 still runs the old matcher.

## Driving — what worked, exactly

✅ **Everything in last session's driving section still holds.** New this session (s37), driving the
**connection popup**, which is harder to reach than most surfaces:

🔴 **Stage the drag instead of aiming at connector pixels.** `window.__nodeGraphEditor` is live;
`ed.connectionPopups` is on it. Set `ed.interaction.draggingConnection = {fromNode, toNode}` (node
*views* from `ed.forEachNode`, which ⚠️ **stops on a truthy return** — push in a statement, never
`return out.push(...)`) then call `ed.connectionPopups.open()`. Real components, real props, no
canvas arithmetic. `open()` is inside a `setTimeout`, so wait ~2s.

⚠️ **The target panel is INERT until a source port is picked** — that is the product's design, not a
blocker. Before picking, the only refusals are `gated` ones (the gate pass runs outside the drag
guard); after picking, the two folded blocks appear. Both are worth measuring; they exercise
different `refusalHeadline` branches.

🔴 **Half the DOM is a measuring copy.** `[class*=refusedSummary]` returned **12 nodes, 4 real** —
the duplicates sit at `y≈1317` in a window `781` tall. Filter to `r.top>=0 && r.bottom<=innerHeight`
*and* re-query immediately before clicking; the list reflows under you between evals. The real rows
carry `aria-expanded`; the measuring copies do not, which is the cheaper discriminator.

✅ **`elementFromPoint` again, and it earned its place twice** — once catching that the target
panel's own disabled overlay was on top (correct behaviour), once confirming a row was reachable
after a reflow had moved it. ⚠️ Guard for `null` before `el.contains(top)`; it throws otherwise.

✅ **Hover via a dispatched `mouseover`,** not `cdp drag` — a real press on a refused row fires the
**redirect** and edits the project. `new MouseEvent('mouseover',{bubbles:true})` reaches React's
root listener; then wait ~2s for the async catalog lookup before reading `.popup-small-docs`.

⚠️ **`cdp click` wants a selector, not `"x,y"`.** Tag the element in an eval
(`el.setAttribute('data-drive','x')`) and click `[data-drive=x]`.

🔴 **`document.elementFromPoint` at the centre of every control you add.** See above. The two-line
version that found it:

```js
const b = el.getBoundingClientRect();
document.elementFromPoint(b.x + b.width/2, b.y + b.height/2)   // → 'popup-layer-blocker'
```

✅ **Contrast, measured live rather than from the token file** — walk the element's own
`backgroundColor`, falling back to the ancestor when it is `rgba(0, 0, 0, 0)`, and flip themes with
`document.documentElement.setAttribute('data-theme','light')`. ⚠️ Read it back in a **second**
eval; the same one still reports the old palette. `ThemeManager.instance.setMode()` threw from the
renderer — stamping the attribute is what the manager itself does (`ThemeManager.ts:175`).

🔴 **DRIVING A LESSON WRITES TO RICHARD'S OWN PROGRESS, and this session proved the restore.**
`cp -R` the whole `Learning` directory **and** `learning_folder.json` + `lessonProgress.json`,
restore after, verify by checksum:

```bash
find "$L" -type f -exec md5 -q {} \; | sort | md5 -q     # 57 files → c346394c169f9bff0baf8237c777e824
```

Both lessons back at `stepIndex: 3` afterwards, checksum identical. ⚠️ Stop the stack **before**
restoring — the running editor holds the register.

⚠️ **Tag launcher cards by the NEAREST unambiguous ancestor, not by walking N levels.** Walking up
8 parents from a *Continue* button reaches a container holding **both** lesson cards, so the tag
lands on the wrong lesson and you drive something else entirely — which I did, and only noticed
because the step count was 4 instead of 8. Walk up until an ancestor mentions one lesson **and not
the other**. ⚠️ And the button text is not stable: after a reset the card says **"Start"**, not
"Continue" — which is also a free confirmation that the reset landed.

✅ **`window.confirm = () => true` / `() => false`** to drive a native confirm, recording the
message. Drive the **cancel** arm first on anything destructive; both arms took one call each.

✅ **`PopupLayer.instance.hideModal()` alone was not enough** on a popup-only step — the view's
effect re-shows it on the next render. `hideModal()` **and** `hidePopouts(true)`, then measure in
the next call.

⚠️ **HMR did not pick up a new method on `LessonLayer.prototype`** — the live instance keeps its
old prototype. `npm run cdp -- reload` and re-open, then re-wrap; budget ~20s per cycle.

## Gate *traps* carried forward — the figures are in the s40 section above

🔴 **Figures older than the s40 section are superseded; the traps below are not.**
✅ For reference, `test:platform` was **5 suites / 27 passed / 3 skipped / 0 failures** at s39, and
`tokens:css` clean over 319 stylesheets at s37. Neither was implicated by s40's change.
⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
property, nothing more. It would have passed the 1.91:1 this phase shipped.
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — unchanged, none ours. It is only ts-jest's `tsconfig`; no npm script or workflow runs it.
- 🔴 **No gate in this repo compiles `LessonItem.jsx` or `LessonLayerView.jsx`.** They are `.jsx`,
  `tsconfig.json` has no `allowJs`, and neither is in the jasmine tests graph. **Running the app is
  the only thing that reads them** — which is why §19/§20's rules live in `lessonstepflow.ts` and
  `lessoninstructionopen.ts`, where jest can grade them.
- 🆕 ⚠️ **This repo's `tsconfig.json` sets no `strict`**, so `strictNullChecks` is off and a
  **boolean discriminant does not narrow a union**. `ResetAvailability` started as
  `{available:true} | {available:false; reason}` and a caller reading `.reason` would not compile.
  Use a **string** discriminant, as `ResetLessonOutcome` beside it already does. The specs found
  this, which is what they are for. 🆕 s40's `CreateFromTemplateOutcome` follows the same rule.

## Still open, owned by nobody

- ✅ **CLOSED as FB-024 (session 41).** This bullet said the bench search ANDs its terms via
  `websearch_to_tsquery`, cheaply fixed with `plainto_tsquery`. 🔴 **Three things were wrong with
  it**: the function it names has **no caller**; the live search was a **substring match that
  could not see post bodies at all**; and `plainto_tsquery` returns the **identical** tsquery, so
  it was never a fix. Kept here as the shape to watch for — see the top of this file.
- 🆕 ⚠️ **`Set Record Properties` → `Update Record` (2026-08-01) created a live name collision** with
  the pre-existing `noodl.byob.UpdateRecord`. Two nodes now answer to one name in the picker and the
  catalog. Found by FB-014's rename mining; excluded from its eval because a query for that name has
  two honest answers.

- ⚠️ **A manually re-opened popout still covers the completion banner.** Inherent to popouts.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — the active fill, and 1.24:1 between
  the active and inactive label, while the border is **identical** in both states. Every individual
  label passes AA (7.9–8.5:1); *which pill is on* does not. It is NAT-008's shared `.FilterPill`,
  so the **people directory has the same invisible selection**. ✅ Cheapest real fix: move the
  state onto the **border**, the one edge already at 3.57:1. ⚠️ Measure in **both** themes.
- ⚠️ Two small things FB-021 leaves undriven: the gated block is no longer given `canRedirect`, and
  the **mixed-group** case. Every group on a `Group` node was homogeneous.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`**, so the
  accepted thread reads *"no reply yet"* everywhere, web included. It is **FIX-025 §7's second
  cause**. 🔴 Do not patch `replyLatency` without deciding the other half — the tab's count is
  wrong by the same data, and fixing only the row leaves the two disagreeing on screen.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.**
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — sixteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
- ⚠️ **A wire warning is silent for two seconds after you draw it.** `EVALUATE_HEALTH_DEBOUNCE_MS`
  is 2000 and the urgent lane is 50; `con-type-unconverted` is deliberately on the lazy one.
- ⚠️ **A tooltip has no `max-width`,** so a long health message draws a very wide box — 1074 px in a
  1368 px window. `.popup-layer-tooltip-content p` caps at 268 px; bare inline markup is capped by
  nothing.
