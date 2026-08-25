# Phase 75 — next session

**State as of 2026-08-25 (session 39).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session (`7e1690ce`, `85a4387e`):** queue item 1 — **FB-005's scope doc**
([FB-005-SCOPE.md](FB-005-SCOPE.md)) — plus **two real fixes it turned up on the way**, in
`unzipUrl`. Read §1 and §2a of the scope doc before touching templates.

⚠️ **Session 38 was still running when this session started** (its `3de0dcdb` landed at 23:25, mine
at 23:43). No task overlap — it was finishing FB-014, I took item 1 — but **both sessions wrote the
same memory files**, so treat mtimes there with suspicion.

🧭 **One thing is now waiting on Richard that was not before:** FB-014's option pair. Richard
supplied a **DeepInfra key for `BAAI/bge-m3`** and it was measured on the same corpus as the
others — **it wins** (68%/91% keyword, **91% conversational**, **100% on the control**) at
**£0.14 per 100k posts**. 🔴 **But 843 ms per query** vs `all-minilm`'s 14 ms. So the question is
no longer *which model* or *what it costs*: it is **whether bench posts may go to a third-party
processor at all**. See [FB-014-DESIGN.md](FB-014-DESIGN.md) → AC3.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-005 T1** — settle `templateRegistry` | **S** | ✅ **scope doc DONE.** T1 is sliced, independent of every ruling, and needs an option picked — see below |
| 2 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — see below |
| 3 | *(cheap, unowned)* **bench search ANDs its terms** | **S** | found by FB-014; **2/22 even in perfect vocabulary**. Real users, real miss |

✅ **FB-014 is off the queue** — design phase done, AC1 + AC3 met, AC2 shown to be impossible.

## ✅ Item 1, closed: FB-005's scope doc — and the task file's premise was wrong

Full slice in **[FB-005-SCOPE.md](FB-005-SCOPE.md)** (six slices, T1 first). The headline is a
correction, and it is the kind only a caller-grep finds.

🔴 **FB-005 says *"there is no template mechanism in the product at all."* There is a complete
one, and it is unreachable.** `TemplateRegistry`, `ITemplateProvider` and **four** providers.
`templateRegistry.list()` has **zero callers**, so there is no picker and never was;
`newProject`'s **one** caller (`ProjectsPage.tsx:1021`) passes the literal `projectTemplate: ''`,
which is falsy, so the registry branch never executes. ✅ Every new project *is* made from a
template — `embedded://hello-world`, via a direct `new EmbeddedTemplateProvider()` that **bypasses
the registry**. ⚠️ `models/template/README.md` documents a recipe no caller performs.

✅ **The recommendation: do not build FB-005 on `templateRegistry`. Build it on TUT-004.** The
tutorial-bundle transport ships end to end — `tutorial_bundles` (jsonb payload, structural CHECKs
at publish, 8 MiB cap), `/api/v1/community/tutorials/[slug]/bundle`, and `lessonplatforminstall.ts`
doing fetch → stage → score → install → record. 🔴 **And its curation model — `articles` has no
author column, every tutorial is editorial — IS R-templates' curated-first ruling, already built.**

🔴 **Where the analogy breaks, measured:** `stageBundleFiles` takes `Record<string, string>`, so a
template carrying its own images or fonts **cannot travel that transport**. Smaller than it sounds
— `installStarterAssets` already gives every project Inter and 1998 Lucide glyphs — so **v1 should
be text-only by construction**, refused at publish. That is an engineering call, not Richard's.

⚠️ **T4 (search) inherits queue item 3's defect.** A template search built on the same FTS helper
is born ANDing its terms. Fix item 3 first or T4 ships a keyword-only search.

## 🔴 The finding of this session: A DEAD PATH'S BUG WAS LIVE IN A REACHABLE ONE

I nearly filed `unzipUrl`'s missing `xhr.onerror` as *"a bug in dead code, deleted by T1"*. It is
not. `filesystem.unzipUrl` has **two** callers and the second is reachable — `unzipIntoDirectory`,
which has **four** callers of its own including `modulelibrarymodel.installModule`/`installPrefab`.
**Installing a module or prefab from the library with the network down hung the editor forever**,
and `unzipIntoDirectory`'s own `try/catch` was dead code for that case because nothing ever
rejected.

⚠️ **Note the shape, because it is why nobody found it: a 404 was handled.** `onload` fires with an
error body, JSZip refuses it, the caller gets "Failed to extract". Only the *no-response* case —
offline, DNS, refused connection — hung. **Testing the fast failure proves the fast failure**;
NAT-013 already wrote that trap down and it arrived here anyway.

✅ Fixed with `onerror`/`ontimeout`/`onabort` **spelled out separately**, so a timeout does not read
as a dead network.

🔴 **Second defect, same function, found on the way: a guard that could not fire.**
`const isEmpty = this.isDirectoryEmpty(to)` dropped the `await` on an **`async`** method, so the
"Folder must be empty" check tested a **Promise** — always truthy. ⚠️ The one reachable caller
masked it by doing the same check itself, correctly; a direct caller (`TemplateRegistry.download`)
got nothing. ✅ **Checked whether this is a class rather than a one-off: it is a one-off.**
`isDirectoryEmpty` is the only `Promise<boolean>` on `IFileSystem`, and the other two call sites use
the *other*, callback-style `FileSystem.instance` API correctly.

✅ **5 specs**, `packages/noodl-platform-node/tests/filesystem-unzip-transport.test.ts`, with a
**known-firing control** that drives a real archive through the fake transport and asserts files
land on disk — a fake XHR reaching nothing would have graded nothing. **Both fixes
mutation-tested**: reverting each reddens exactly its own spec and no other.

⚠️ **Two claims in the scope doc are readings of code, not measurements, and are marked as such:**
`unzipUrl` passing a *local path* to an XHR works on macOS only because the renderer's origin is
`file:///` (`main.js:444`) and a POSIX path starts with `/`; **on Windows it should miss**, and
there is no Windows machine here to prove it.

⚠️ **Read this before starting FB-013.** FB-014 measured the bench: **3 posts, 2 threads, 1,369
chars**. Chat would be a *second* corpus that does not exist yet. The ruling to build it stands and
is Richard's — but do not carry over the assumption that either feature has content to work on.

✅ **The "two functions that reach nobody" item is CLOSED.** Both are wired, specced at the
*caller*, and driven. Detail below — read it before touching either surface.

✅ **FIX-027 §17, §19 and §20 are CLOSED** — built, driven, acceptance criteria 4 and 6 met.
✅ **FIX-025 is fully driven** bar two items that are not ours to unblock (§5 needs Richard signed
*out* of his live community session; §7 needs a real answered thread *and* a platform data fix).

## ✅ Item 1, closed: FB-014's design phase — and why it says *don't ship*

Full write-up in **[FB-014-DESIGN.md](FB-014-DESIGN.md)**; the harness that produced every number
is `fb014/` beside it and **reproduces from the repo** (verified end to end after the move).

🔴 **The bench holds 3 posts.** So AC2 — *"the prototype runs against a copy of real bench data"* —
**cannot be met**, and no engineering fixes that. Semantic search is a solution to a problem this
corpus does not have yet. The mechanism was measured anyway, against **real pre-rename product
prose recovered from git** (the node catalog at `1f31d24f^`, 155 documents) and **29 real renames**
mined from its own 98-commit history.

🔴 **The number worth carrying, whatever happens to pgvector:** with an old-vocabulary control
holding corpus, documents and k constant, the renames cost the **search we already ship**
**73% → 18%** recall on keyword queries. Vectors take it to **91% @10**. ✅ And **hybrid beats
vector-only on the control** (17/22 vs 11/22 @1), so RRF is the right answer rather than a hedge.

✅ **pgvector is cheaper to get than the task feared** — `postgresql-16-pgvector` 0.6.0 is already
an Ubuntu `noble/universe` candidate on nexus-1's configured mirror. No third-party repo. The whole
DDL was **replayed on pgvector 0.5.1** — older than prod's — so nothing in the design postdates
what prod can install. ⚠️ Dev needs a compose image change (alpine → Debian: **recreate the volume**,
musl and glibc collate text differently).

## 🔴 The finding of this session: THREE OF MY OWN MEASUREMENTS WERE FICTION FIRST

Each was green, plausible, and wrong. None would have been caught by re-reading the code.

1. **A 100k-row latency table over 100,000 copies of ONE vector.** Postgres hoisted an
   uncorrelated scalar subquery and evaluated it once. `count(distinct vec)` = **1**. An HNSW index
   over a single repeated point measures nothing; the honest figure is **5.5× higher**. ✅ **Assert
   the data is what you think before timing it** — one `count(distinct)`.
2. **An index build that exited 0 twice without building anything.** Once backgrounded (exit 0,
   empty log), once starved by Docker's 64 MB `/dev/shm`. Both times `EXPLAIN` said **Parallel Seq
   Scan** while I was about to write down an HNSW number. ✅ **The plan line is the only proof an
   index was used.** `pg_indexes` is the second.
3. **`nomic-embed-text` scored without its required task prefix.** It needs
   `search_document:`/`search_query:`. Without them it read as *"the bigger model is worse"* — I
   had measured **my own omission** and nearly filed it as a property of the model. ✅ **A model
   comparison is only a comparison once each model runs the way its authors say to run it.**

## 🔴 Second: THE CONTROL READ ~ZERO, AND WOULD HAVE FLATTERED THE RESULT

The first eval used conversational queries. FTS matched **2/22 even in the era's own vocabulary** —
so a miss on today's words proved nothing. `websearch_to_tsquery` **ANDs bare terms**, and a 9-word
query matches almost nothing. ✅ Adding keyword-style queries gave the control something to say
(**73%**), and only then did the 18% mean anything.

⚠️ **That defect is real and shipped**: anyone typing a sentence into the bench search gets
nothing. It is **queue item 3** — cheap, independent of pgvector, and nobody owns it.

## 🔴 Third: TOKEN LENGTH, NOT CHARACTER LENGTH, BREAKS AN EMBEDDING WINDOW

Whole-document embedding failed on **6 of 155** at **1070–2193 chars** while a **6000-char**
document passed. This product's text (port identifiers, enum values, doc URLs) tokenises at roughly
**half** the chars-per-token of prose. 🔴 **Two of the six were ground-truth documents** — dropping
a failed embed silently would have scored the retriever on a corpus with the answers removed, and
looked green doing it.

## ✅ Item closed earlier: the two functions now reach somebody

**`refusalHeadline`** — `ConnectionBar` derives it, `DocsPopup` renders it above the detail
sentence. 🔴 **The derivation went into `refusalPlan.ts`, not the component.** That module exists
because two earlier halves of this same UI rotted in `ConnectionBar`, which needs the node library
singleton and a drag in flight, so no spec can construct it. A third rule in there would have been
the same mistake a third time.

**`resetLessonFromPlatform`** — `canReset` gained a **third arm, `'needs-network'`**: a *yes* that
the synchronous register cannot act on. `models/lessonreset.ts` routes it to the fetch and
`ProjectsPage.repullFromPlatform` supplies the client. 🔴 **A string discriminant, not a boolean —
this repo sets no `strict`.** Every surface that decides whether to *offer* Start again now asks
`isResetOffered`, never `=== 'available'`: that literal was correct with two arms and silently
became "hide the button for every Community lesson" when the third arrived.

⚠️ **Left open, and it is inherent rather than sloppy:** a learner whose network is down is told so
**at the launcher, after** the lesson has closed. Whether the platform is reachable cannot be
answered on disk, and the reset can only run once the project is closed. `resetLessonFromPlatform`
guarantees nothing was deleted, so they land on an intact lesson with the card's Reset one press
away — but the confirm now says *"downloaded from NodeGX Community"* so the trip is not a surprise.

## 🔴 The finding of this session: A CALLER-GREP IS A GATE NOTHING ELSE PERFORMS

Both functions were **green, specced, and in one case mutation-checked** — while reaching nobody.
`resetLessonFromPlatform` had **two** spec files and every row passed throughout the entire period
the feature did not exist. FB-021 already recorded the shape and it is worth restating: *mutation
testing proves the spec reads the function; only a caller-grep proves the function reaches a user.*

✅ **So the new specs grade the CHOICE, not the function** — `refusalHeadlineFor` and
`resetLesson`, both of which fail if the wiring is pulled out. A spec that only exercised
`resetLessonFromPlatform` would have stayed green through the whole outage, and did.

## 🔴 Second: TWO DEFECTS MY OWN SPECS FOUND IN MY OWN FIX

1. **`|| ''` for a missing source type** rendered *"A `<strong></strong>` output cannot drive a
   number input"*. I had argued the case was unreachable. **An argument about reachability is not
   a guarantee about output.** Fixed in `refusalHeadline`, which owns the branching — in the caller
   it would have had to restate which reasons need a source type, and the copies would drift.
2. **`!== 'available'`** in `reset()` would have refused with `reason: undefined` — a toast reading
   "undefined" at the one moment a learner is already stuck — because the new arm carries no
   `reason`. The compiler then caught the *same shape* in a neighbouring spec whose guard stopped
   narrowing. Spell the arms out when a union grows.

## ⚠️ The session-readers gate has a rule, and it is not "add the row"

`uni-001/session-readers.test.ts` went red because `ProjectsPage.tsx` now reads the community
session. Its comment forbids making it green without first answering *does this change what the
editor can do without an account?* **Answer: no** — the read is unconditional, a signed-out editor
gets `token: null`, and the re-pull goes out the same. That is recorded in the row, and backed by
three new behavioural assertions (not gated / token read once / a control proving the checker can
see a gate on that file at all).

**Blocked on Richard, do not start:** 🆕 **FB-014's external-processor option pair** (local
embedding model vs hosted API — *not* a cost question; see [FB-014-DESIGN.md](FB-014-DESIGN.md)
→ AC3), FB-012 and FB-009 (both need *content*), FB-017 scope 2's
`Source Set`, FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod `ANTHROPIC_API_KEY`
(⚠️ **intro pricing ends 2026-08-31 — six days**), the 15 lessons' prose, Discord's row in the `?`
menu, `/rfps` search.

✅ **Nothing is waiting to deploy.** ⚠️ The *stamp on the box* is still relayed from s19's SSH read —
re-read it before any deploy claim.

## 🔴 The finding of this session: THE COMPLETION MOMENT WAS BEHIND A BLOCKER

The banner rendered correctly, said the right sentence, and its two buttons **could not be
clicked**. `PopupLayer` puts a full-screen dimmer behind every popout, and FIX-027 §17 — last
session's own fix — opens a step's instructions on the edge into it. So a learner finishing a
graded last step had those instructions still open over the bar.

`document.elementFromPoint` at the middle of the banner returned **`popup-layer-blocker`**.

✅ **Carry this: a surface is not delivered until you ask what is ON TOP OF IT.** Reading the DOM,
the props, or `innerText` all said the banner was there and correct. Only a hit-test found that it
was unreachable. `elementFromPoint` at the centre of every control you add is two lines and it is
now the cheapest check I know for "did this actually arrive".

⚠️ **And two orderings needed two fixes.** Finishing *in place* leaves a popout already open → the
layer closes it on the **edge** into completion. **Re-entering an already-finished lesson** draws
the banner first and the entry edge opens instructions a moment *later* → `instructionOpenDecision`
gained `lessonFinished`. **The close cannot reach a popout that does not exist yet, and the
suppression cannot close one that is already open.** Neither covers the other; I nearly shipped
only the first.

⚠️ Still open and **inherent to popouts, not to this banner**: a learner who *manually* re-opens a
finished step's instructions buries the banner again until they dismiss it. Measured. Every popout
in the editor behaves this way and one click clears it.

## 🔴 Second: A TOKEN NAME IS NOT A COLOUR — I introduced a 1.91:1

I put the banner on `--theme-color-secondary-dim`, reasoning that the one moment a lesson
congratulates someone should not look like the eight steps before it. **That token is
`rgb(139,149,161)` — a *light* grey.** Headline **3.04:1**; the refusal sentence **1.91:1**. The
sentence explaining why *Start again* was switched off was the least readable thing on the bar.

✅ Moved to `--theme-color-bg-3`, the tone the fg tokens are designed against (the pairing
`.lesson-check` already uses), with the state signal on a primary rule along the top. Re-measured
in **both themes**: dark 10.84 / 6.81 / 5.85 / 6.94, light 13.33 / 5.07 / 4.61 / 4.57.

⚠️ `tokens:css` passes on this — it checks that a `var(--…)` **names a defined property**, not that
the pairing is legible. It would have passed the 1.91:1 too.

## ✅ What §19/§20 actually needed, in case it is revisited

- **The moment is decided, not authored.** `isLessonFinished` sits beside `stepFlowAction` in
  `lessonstepflow.ts` and takes the **same input type**, so the two cannot disagree about which
  step is last. 🔴 The two lesson shapes finish by **opposite** rules: a graded last step finishes
  when its conditions hold; a narrative one finishes **on arrival**, because `refresh()` sets
  `isComplete = false` on every conditionless step. A rule that just asked `isComplete` would
  report *Log a thing* unfinished forever **while looking correct against the graded lesson** —
  the one anybody would check.
- **Two surfaces, because the two shipped lessons end differently.** *State on a page* ends on a
  graded card with **0 popup buttons** → the bar's banner. *Log a thing* ends on a narrative step
  shown as a screen-centre **modal**, whose buttons were exactly `['EXIT LESSON']` → `START AGAIN`
  goes in the modal. A banner behind a modal dimmer is not an offer.
- **One statement of "can this reset".** `LearningFolderModel.canReset`, with `reset()` as its
  first caller. The specs assert the **agreement** — same sentence from both — not each answer
  separately, so a third refusal taught to one of them fails the pair.
- 🔴 **`Start again` closes the project BEFORE it resets.** `repairFrom` deletes
  `Learning/<slug>/` and copies a fresh bundle over it, and at the completion moment that
  directory **is the open project** — a live `ProjectModel` would write its graph back over the
  fresh copy. Stash the id, `leaveForLauncher`, reset on the launcher's mount. Consumed on read,
  so React 18's double-invoked effect cannot reset twice.

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

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

✅ **Session 39 ran `test:platform`** — **5 suites / 27 passed / 3 skipped / 0 failures**, exit 0,
summary line quoted rather than `$?` (was 4 suites / 22 before this session's new spec file). That
is the gate covering `@noodl/platform-node`, which is where s39's fix landed. 🔴 **s39 did NOT run
`test:ci`, `test:main` or `typecheck:editor`** — it changed no editor source, but `filesystem-node.ts`
is imported by the editor, so **the next session that touches the editor should run them**.

⚠️ **Session 38 ran NO gates, deliberately, and the figures below are session 37's.** It changed
**no source** — the commit is markdown plus python under `dev-docs/`, and `lint` is scoped to
`packages/noodl-editor/src` while nothing in `package.json` references `dev-docs` at all. So no
gate was implicated. **Do not read the numbers below as re-confirmed on 08-25.**

- `npm run test:main`: **340 files / 5495 specs / 0 failures** (was 339/5478; +1 file, +17 specs).
- `npm run typecheck:editor`: **0 errors**, three times.
- `npm run tokens:css`: clean — 319 stylesheets. ⚠️ **It cannot see a contrast failure**; see above.
- `npm run test:ci`: see the session's own note below — **quote the summary line, never `$?`**.
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
  this, which is what they are for.

## Still open, owned by nobody

- 🆕 🔴 **The bench search ANDs its terms.** `websearch_to_tsquery` requires *every* bare word, so a
  conversational query matches **2/22 documents even in perfect vocabulary**. Anyone typing a
  sentence into the bench search gets nothing. Cheap (`plainto_tsquery` + ranking, or OR-ing terms),
  independent of pgvector, measured by FB-014's control. **Queue item 3.**
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
