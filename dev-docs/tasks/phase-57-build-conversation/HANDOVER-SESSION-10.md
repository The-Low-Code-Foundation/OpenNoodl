# Phase 57 — handover after session 10 (2026-08-09)

**What ran:** **BLD-006 built, driven and closed.** **D5 is closed.** The Build panel's conversation
moved out of `useState` and into a store with a disk behind it, a switcher went into the header slot
BLD-005 deliberately left free, and **R6** — the request rendering twice — is fixed. All five of
BLD-006's acceptance criteria are live measurements.

Phase 57 is **9 of 16 built, 8 driven** (BLD-001 ✅, 002 ✅, 003 ✅, 004 ✅, 005 ✅, **006 ✅**,
007 ✅, 012 🟡).

## 🔴 Read this before you plan anything AI-shaped

> **The editor has a real Anthropic provider configured, and session 9's handover says it does not.**

`~/Library/Application Support/NodeGX/editorSettings.json` holds `ai.provider = "anthropic"`,
`ai.hasKey.anthropic`, `ai.verified.anthropic = true`. **The first send of this session was a real,
billed API call** — a four-operation plan came back with real prose — and it took several steps to
work out why, because the drive hook had been wiped by a webpack reload and `isConfigured()` was
*legitimately* true.

Session 9's check looked at `localStorage`, which is empty. **`EditorSettings` is a file.** Check
this before assuming a drive is free:

```bash
node -e "const s=require(process.env.HOME+'/Library/Application Support/NodeGX/editorSettings.json').settings;
console.log(Object.keys(s).filter(k=>/^ai\./.test(k)).join('\n'))"
```

Everything after that first call was driven through the scripted hook. Richard: **the key session 9
supplied is in the editor's store and you said you would cycle it.**

## ⚠️ The findings worth more than the task

### 1. A flush that was built for the quit path and never called

`PlanSessionSidecar.flush()` says in its own header that it exists "for the one case where a second
matters — the quit path, which has already cost this project one data-loss defect". **Nothing in the
editor ever called it.** The renderer already has the handshake (`flush-project-save`, added after
the one-second-quit defect); the sidecar just was not on it. So an unapplied build staged inside the
750ms debounce was lost to ⌘Q, silently, since AIB-003.

Both AI sidecars are drained from that handshake now (`flushAiSidecars`), and from `blur`.

**The reusable version:** *a mechanism with no caller passes every gate there is.* `tsc` sees a used
export, the specs exercise it directly, and the grep that would have caught it — "who calls this?" —
is the one nobody runs on their own code.

### 2. `MenuDialog.is-highlighted` does not recolour its end slot — 1.16:1

The dropdown's *selected* row was the one row whose timestamp could not be read. `is-highlighted`
paints `--theme-color-primary` behind the row and recolours exactly three things to
`--theme-color-on-primary`: `h2`, `.Label span`, `.Icon path`
([MenuDialog.module.scss:29-42](../../../packages/noodl-core-ui/src/components/popups/MenuDialog/MenuDialog.module.scss#L29)).
`EndSlot` is not one of them.

| | before | after |
|---|---|---|
| selected row, dark | **1.16** | 6.94 |
| selected row, light | (same class) | **4.57** |
| other rows | 5.98 / 5.34 | unchanged |

Fixed in this panel's own module. **Filed for a design-system pass** — it is a trap at every
`MenuDialog` with an `endSlot`, not a defect here. Note 4.57 in light: the tightest point in the
sweep, and it is the token pair's own property.

⚠️ **1.16:1 is the same number BLD-004 measured** for its state-class collision. That is the phase's
recurring shape for the **fifth** time: **a rule that was right about its old subject.**
`is-highlighted` was written when an item was a label and an icon; the end slot arrived later and
nothing revisited it.

### 3. R6, and the hole the duplicate was hiding

The request rendered twice for the whole of every component build. `send` awaits `routePlan`, and
`routePlan` awaits `session.run()` — so `planningRequest`, and the pending turn carrying the user's
words, outlived the producer that had the same words. It *looked* like a retired turn because
`composeThread` clears `busy` on all but the last.

⚠️ **The obvious fix is wrong and the docs path is where it shows.** Clearing `planningRequest` once
the route is decided leaves a render with a route and no producer — `routePlan` sets the route and
*then* awaits `startProjectReview` — which would blank the thread and drop `busy` at the same
instant. The condition has to be about **what is on screen**: the pending turn stands in until
`liveTurns` returns something.

⚠️ **And removing the duplicate uncovered what it was hiding.** `docsTurns` has always accepted a
`request` and `liveTurns` has never had one to give it, so **a docs run has been rendering with no
request at all** — invisible, because the pending turn was showing the same words two lines up.
`LiveSources.request` now carries it.

## What the drive found that the build could not

- ⚠️ **Restore left an empty *"New thread"* in the switcher, on every launch.** The store mints a
  blank on first `get()`, the disk read re-points away from it, nothing pruned it. **Every spec in
  the file seeded a thread that had something in it** — the one case where there is nothing to
  prune. Now pruned, with the case added.
- ⚠️ **`IconButton`'s `label` renders as visible text.** The `+` read *"New thread"* beside a
  switcher reading *"New thread"*. Icon-only with a tooltip — and B8's reason, not minimalism: a
  fixed-width label takes its space from the one element in the row that shrinks.

And one the *spec* found before the drive, worth recording because the distinction is easy to miss:

- ⚠️ **"Is the current thread blank?" is not "did anyone choose it?"** A blank the user asked for by
  pressing New thread is as blank as the one the store minted; re-pointing away from it yanks them
  into last week's conversation because a disk read finished. `ThreadsState.chosen` separates them.

## The design decision that is not obvious from the task

> **The switcher's two controls answer to different rules, and that is doctrine, not inconsistency.**

- **New thread** is allowed exactly when Send is. Starting a new conversation is at least as strong a
  statement as sending a new request, and `retire()` already encodes that contract — freeze the
  record, release the sources.
- **Switching to an existing thread is navigation, and navigation may not destroy.** AIB-003's rule
  is that authored output is durable from the moment it validates. Routing a dropdown click through
  `retire()` would make a staged eight-node component evaporate. So the dropdown is **disabled while
  anything is live, with the reason stated** — nothing is destroyed, and no live control can mount
  under a conversation it has nothing to do with.

The alternative considered and rejected: track which thread owns the live work and render live turns
only there. It is more code and it still leaves "what does Send do while you are reading thread B?".

## Two task premises that were wrong about mechanism

- **`.noodl/ai-threads/` does not exist.** The sidecar directory has been `.nodegx/` since the
  rebrand, with one helper (`utils/nodegxSidecar`) both existing writers go through so "make sure git
  ignores it" cannot exist in two copies that disagree. Built at `.nodegx/threads/<id>.jsonl`. Q2's
  *decision* is honoured exactly, and verified — `.nodegx/` is in the fixture's `.gitignore`.
- **"Append-only" has no platform support.** `IFileSystem` has `writeFile`, `writeFileOverride`,
  `readFile` and no append. The sidecar rewrites the file from the in-memory thread; the *content* is
  still append-only, which is the property the format was chosen for.

## What is built

| Module | What it is |
|---|---|
| `thread/threadRecord.ts` | Pure. The jsonl format, the title rule, relative time, and what a malformed file costs (one turn, never the file). |
| `thread/ThreadStore.ts` | `Model` singleton, per project, injected persistence. Runs in the plain-Node runner. |
| `thread/ThreadSidecar.ts` | `.nodegx/threads/<id>.jsonl`, debounced + queued, `readAll`, `flush`. |
| `thread/installThreadPersistence.ts` | Boot wiring + `flushAiSidecars`. |
| `thread/ThreadSwitcher.tsx` | The header control. Two rules, above. |
| `turns.ts` | `retiredTurns` (the retired half of `retireLive`, for a store that appends) and `LiveSources.request`. |
| `tests-unit/bld-006/` | 53 specs across the format, the store and the derivation. |

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **95 suites, 1322 tests**, zero failures |
| `test:ci` | run with the dev stack **stopped** — see the closing commit for the `Jasmine:` line |

⚠️ `test:main` was 92/1268 in session 9's handover and is 95/1322 here. +3 suites and +53 tests are
mine exactly; the remaining +1 against session 9's figure is unattributed and predates this session's
edits. Nothing failed either way.

## Driving this panel — additions to the recipe

Sessions 5–9 hold. Four more:

- ⚠️ **`MenuDialog` renders its item list TWICE in the DOM, at different offsets.** A selector count
  reports double, and — worse — a click computed from the first copy's rect **lands on a different
  row of the visible one**. It cost one wrong thread switch. Find the copy that is actually on top:
  ```js
  rows.find(r => { const b = r.getBoundingClientRect();
    return document.elementFromPoint(b.left+b.width/2, b.top+b.height/2)?.closest('[class*=MenuDialog-module__Item]') === r; })
  ```
  Same family as session 5's `Turn`/`Turns` and session 6's `Run`/`RunCaret`.
- **HMR applied TSX to *this* panel without a reload** — twice. Handover 9's "HMR misses the Docs
  panel's TSX" is not universal; check before paying for a restart. A *later* edit did reload back to
  the launcher, so it is not reliable in either direction: **verify the change landed, do not assume
  which way it went.**
- **`closest('[class*=Foo]')` can match the element itself.** `span.LauncherProjectCard-module__Name`
  is its own nearest `[class*=LauncherProjectCard]`. Use the specific part (`[class*=Card--]`).
- **The way back to the launcher is `[class*=SideNavigation-module__BrandExit]`** — the logo, top
  left. Needed for the project-switch criterion, and not findable by text.

## Fixture and cleanup

`ai-test` is **as it was found**, and this was checked rather than assumed:

- `project.json` — the drive accepted `/Ui/DriveOne` (acceptance criterion 1 requires an accept).
  It was **removed afterwards**, byte-for-byte back to the sibling's Slider/Expression diff:
  90 insertions / 1 deletion, same as before, `grep DriveOne` returns 0.
- ⚠️ **`.nodegx/plan/session.json` was overwritten** by the accidental real call, then removed when
  the drive pressed New thread. Whatever an earlier session had left there is gone. Nothing else in
  the fixture depends on it.
- `.nodegx/threads/*.jsonl` — the three drive conversations, **deleted**. `.nodegx/code-history.json`
  untouched. `docs/uk-vat.md` (BLD-007's fixture) untouched.
- The temporary `AiClient` drive seam is reverted — `grep __driveAiClient` returns 0.
- Dev stack stopped. Screenshots and the `test:ci` log are in the session scratchpad, not the repo.
  No worktree created.

## Concurrency

`ps` showed no editor at start and `git status` showed exactly the four sibling-owned things the
prompt named. `packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx,
codemirror-theme.ts}` are **still theirs, still uncommitted** — inherited for a fourth session,
untouched. `dev-docs/tasks/phase-59…61/` untracked, left alone. Every commit pathspec-scoped; no
`git add -A`, no stash.

## What to do next

1. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity`, with its treatment built
   (`BuildThread.module.scss` `.Question`) and its collapse rule decided. **Add the author, not a
   fifth opinion about how it should look.**
2. **BLD-010** now owns four debts: BLD-003's docs route has **never been on screen**; BLD-004's
   **R4** (Ollama, inferred) and **R5** (OpenAI-compatible `reasoning_content`, unwired); and
   BLD-006's **R12** (the quit *flush* is wired, not driven — it needs a timed append-then-quit).
3. **BLD-012's two remaining gaps** — the chip (blocked on BLD-011) and OpenAI against a real
   endpoint. ⚠️ **And the editor now has a live Anthropic key**, so the "no provider" constraint that
   shaped session 9's harness no longer applies — a provider-backed drive is possible in-editor, at
   Richard's expense.
4. **The design-system row** from R8 (`MenuDialog` end slot) joins C6 (`HStack` `height:100%`) and C7
   (`Ghost` 4.33:1 in light) on the UIX list. Three now.
