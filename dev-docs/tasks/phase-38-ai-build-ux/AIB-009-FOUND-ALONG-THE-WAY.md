# AIB-009 — Found along the way

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | mixed — see each entry |
| **Difficulty** | mixed |
| **Recommended executor** | 🟢 Sonnet for most; the marked ones need judgement |
| **Prerequisites** | none |

A register, not a task. Items found while diagnosing the nine reports, each with its evidence and
its confidence. Worked opportunistically alongside the rest of the phase; anything that grows past
a slice gets promoted to its own AIB.

**Confidence is stated per item and means what it says.** *Verified* = a file was read or a script
was run. *Observed* = seen in the running app this session, cause not traced. *Suspected* = reasoned
from the code, not confirmed.

---

## F1 — A failed operation's model output is unrecoverable

**✅ Closed 2026-08-03 (AIB-002 pass) · was: Verified · 🔴 High**

The recovery half is built: a failed operation now offers **Retry** in the panel once the run is
done, calling the `PlanRun.retryOperation` AIB-001 slice 4 already built and tested, with the gate's
own error as repair context. Nothing had to be added to the model — the panel was only ever offering
that path for an *apply* failure, which is the rarer of the two.

**One stated mechanism here is wrong, and checking it is why the fix stayed small.** The entry says
the run "keeps **nothing** — no partial candidate". True, but not because anything is discarded:
within a single `run()`, `AuthoringSession` returns `authored` the moment a submission passes the
gate (including the AIX-006 style-pass fallbacks at lines 673, 679, 727 and 743, all of which finish
`authored` on `stylePassBaseline`). So an `exhausted` outcome in a plan run means *nothing ever
passed the gate*, and `session.stagedFiles` is genuinely empty. A "keep the last valid candidate"
fix would have had nothing to keep. It only becomes reachable through `refine()`, which `PlanRun`
never calls.

Original entry follows.

**Verified · 🔴 High · related to [AIB-001](AIB-001-PARAMETER-VALUE-CONTRACT.md) slice 4**

When an operation's session ends `failed` or `exhausted`,
[`PlanRun`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L331-L338)
records `status: 'failed'` and an error string, and keeps **nothing** — no partial candidate, no
transcript. `acceptedOperations` then closes the failure over the dependency graph, dropping every
operation that depended on it.

So one failed operation in a three-operation plan can silently invalidate the other two, and the
user's only options are Abandon or apply what survived. There is no *"retry this one"*, and the
tokens spent on the failed attempt bought nothing that is still on the machine.

AIB-001 slice 4 adds retry for an **apply** failure. This is the **authoring** failure, and it is
the more common one. Same shape, same fix: keep the last candidate even when it failed the gate,
show why, and offer to re-run that operation alone with the diagnostics as repair context.

## F2 — Model-authored HTML reaches `dangerouslySetInnerHTML`

**✅ Closed 2026-08-03 · was: Verified · 🟠 High · security**

`Markdown.tsx` builds Remarkable with `html: false` now. Off at the parser rather than sanitised at
the output, and the choice was **measured rather than reasoned** — which is what made it small:

- `html: false` escapes every raw-HTML vector. Blocks, inline tags and event-handler attributes all
  come out as text, visible and inert.
- **Remarkable already refuses `javascript:`, `vbscript:` and `data:text/html` link targets**, and
  leaves the markdown literal rather than emitting an anchor. So raw HTML was the *only* remaining
  vector, and there is nothing an allow-list sanitiser would add that this does not already deny.

That second point is why the entry's own suggestion — "add a sanitiser (or the comment-stripping pass
extended to a full allow-list)" — was not taken. A hand-rolled HTML allow-list is the one kind of
security code that is worse than the hole it closes, and the alternative it was competing with turned
out to close the same hole in one line. The cost is that genuine inline HTML in a document renders as
literal text; nothing shipped writes any (checked: no doc template, no prompt).

**One thing worth carrying: the obvious assertion is wrong.** The first version of the spec asserted
`expect(html).not.toMatch(/ onerror=/)` and it **failed against the fixed code** — an escaped
`&lt;img src=x onerror=&quot;…&quot;&gt;` contains that substring as *text* and is entirely inert.
Substring checks over rendered HTML cannot tell markup from content, which is the same confusion that
produces XSS in the first place. The spec asserts that every `<` in the output opens a tag markdown
itself generated (`tests-unit/aib-009/markdownHtml.test.ts`), and carries a guard that reads
`html: false` out of `Markdown.tsx` so the duplicated options cannot drift.

Original entry follows.

**Verified · 🟠 High · security**

[`Markdown.tsx`](../../../packages/noodl-core-ui/src/components/common/Markdown/Markdown.tsx)
constructs Remarkable with `html: true` and injects the result with `dangerouslySetInnerHTML`, with
no sanitiser.

That was defensible when doc bodies were written by the user. Since AIX-011 criterion 7, `DocSession`
authors them — and since AIX-009 the Docs panel renders them. A prompt-injected or simply careless
model can emit `<img onerror=…>` into `docs/ARCHITECTURE.md` and it executes in the editor renderer,
which has the editor's privileges.

Not hypothetical enough to hold the phase, but it should not ship to alpha. Add a sanitiser (or the
comment-stripping pass from [AIB-006](AIB-006-MARKDOWN-RENDERING.md) extended to a full allow-list).
Note the precedent: OBS-004 shipped a relay readable by any web page and it was caught late.

## F3 — `PageInputsAdapter` propagates a bad value before it throws

**Verified · 🟡 Medium · fold into AIB-001 slice 3**

[`nodeAdded`](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/PageInputsAdapter.ts#L47-L63)
copies `queryParams` and `pathParams` from a sibling `PageInputs` node onto the new one — then calls
`updatePortsForNode`, which is where the `.split` throws. And `parametersChanged` does the same in
reverse, writing the value to every sibling via `setParameter`.

So a malformed value is *spread across the component* before anything notices. Inside the apply
transaction the rollback covers it; outside one (an import, an MCP write, a hand-edited file) it
would not.

## F4 — Cancelling a run strands the components it already built

**✅ Closed 2026-08-03 · live QA green · was: Verified · 🟡 Medium**

Both halves, because the entry's "either/or" was a false choice: a user who is told what stopping
costs still needs the way back, and a way back nobody mentions is not offered.

- `PlanRun.runDocPass()` writes the skipped documents against what is staged *now*. Same
  `runDocOperation`, same gate, same in-memory staging — the only new thing is that it can be
  reached a second time.
- The panel says, under the Stop button while the run is going, that the documents are written last
  and will be skipped. Afterwards it offers **Write the documentation (N)**.

**The distinction that made this small is `skippedByCancel`.** A doc operation ends `skipped` for two
unrelated reasons — the agent read the finished work and decided there was nothing worth recording
(an answer), or the user pressed Stop before the pass reached it (not an answer) — and from the
outside they were identical. Re-running the first buys another model call and the same reply. The
flag is set in the two places a *cancel* skips a doc, and `runDocPass` reads only that; a doc that
`failed` keeps its error, because what failed there was a precondition and repeating the turn cannot
fix it.

**Live QA found two defects in this fix, both in prose it had just added.** The screen read *"The 1
document are written last"* — the count was interpolated and the verb was not — and *"What was built
is still staged — it can be written against it now"*, where the two "it"s are different things.
Neither is visible from the diff, and both are on the screen where the user decides. That is now
**seven** of this phase's defects that came from a mount.

Driver: `scripts/aib38-live/scripted-stop.js`, which also covers AIB-003 criterion 6 (scope tab away
and back, panel closed and reopened, with a candidate staged and the run still going). Its turns are
held on a promise the driver resolves over CDP rather than paced by `setTimeout`, so the throttling
trap that produced F11 cannot reach it.

Original entry follows.

**Verified · 🟡 Medium**

`cancel()` sets `this.cancelled`, which the doc pass then honours by marking every doc operation
`skipped` ([PlanRun.ts:350-353](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L350-L353)).
Staged components survive, which is right — but the plan then has components with no documentation
recorded, and no way to run just the doc pass afterwards.

Either allow the doc pass to be re-run against staged components, or say in the UI that stopping
skips the documentation. Currently it does neither.

## F5 — The Settings dialog opens over the launcher at startup

**Downgraded 2026-08-03 · 🟢 Low · a mechanism, at last · was: Observed**

Five clean cold launches now, on the same `userData` that filed it, with no dialog over the launcher
— which kills the entry's own best explanation: persisted state would persist.

What replaces it is [F12](#f12--the-launcher-decides-ai-is-off-before-it-has-read-the-settings),
found this session. A launcher that lost the settings race told the user **"AI is turned off"** on
the first screen, and the only control it offered was **Set up AI…**, which opens the app-wide
Settings dialog *on the AI section* — which is exactly what the F5 screenshot shows. One click, on a
card that should never have been disabled, in a session that had already been running.

That does not prove nobody clicked it, and the report says no action preceded it. But it is a
mechanism that produces exactly this screen, it is now fixed, and it is a better answer than a third
"did not reproduce". Left open at low priority: if it happens again after F12, it is something else.

Original entry follows.

**Observed · 🟡 Medium · cause not traced**

On a clean `npm run dev:debug` launch this session, the launcher rendered with the app-wide Settings
dialog already open on the AI section — see
[`launcher-settings-open-at-startup.png`](launcher-settings-open-at-startup.png), captured via CDP
immediately after mount. No user action preceded it.

Could be persisted UI state from a previous session rather than an auto-open. Worth ten minutes:
launch with a fresh `userData` and see whether it reproduces. If it does, it is a first-run defect on
the very first screen of the product.

## F6 — GitHub repo probing logs an error per repo on every launch

**✅ Closed 2026-08-03 · measured · was: Verified from `.logs/dev.log` · 🟢 Low · noise**

Both lines are gone, and the entry's second suggestion — *"probe with a request whose miss is not an
error"* — turned out to be the only one that could work. Demoting our own logging was necessary and
not sufficient: **Chromium logs a failed request to the console itself, at error level, before any of
our code sees it**, so as long as the probe was `GET …/contents/project.json` there was a
`Failed to load resource … 404 (project.json)` per repo no matter what `GitHubClient` did with the
rejection.

`isNoodlProject` now lists the repository root and looks for `project.json` in the result: same one
request per repo, same cache, same rate-limit cost, and a **200 whether or not the file is there**.

Measured on a launch against Richard's real account: 242 repos probed, **5** error lines (empty
repositories, which have no tree to list) where there used to be one per repo, and 16 repos still
correctly identified as NodeGX projects. The `🔍`/`📦`/`❌` step lines are `console.debug` now and
land in the log's debug stream rather than beside real errors.

Original entry follows.

**Verified from `.logs/dev.log` · 🟢 Low · noise**

The launcher probes every repo in the user's GitHub account for a `project.json` to decide which are
NodeGX projects. Each miss produces two log lines — a `renderer:error` for the 404 and an
`❌ [getFileContent] Error … status: 404`.

The behaviour is correct; the logging is not. A 404 from a probe is the expected answer, not an
error, and it currently buries real errors in a launch log. Demote to debug, or probe with a request
whose miss is not an error.

## F7 — The scoping conversation does not stream

**✅ Closed 2026-08-03 · live QA green · was: Verified · 🟡 Medium**

It needed no work in `ScopingSession` at all, which the entry allowed for and which is worth
recording: `send()` has taken `AiStreamCallbacks` since AIX-012 and passes them to every round. The
launcher passed none. So the one AI surface in the product with no feedback was the one whose
feedback had already been built and never wired.

The wizard now renders the reply as it arrives, through the same `Markdown` component AIB-006 wired
in. The thinking row survives for the part of a turn that genuinely has nothing to show — the
`record_scope` round produces no prose, and inventing something to display there would be worse than
saying nothing.

Live, via `scripts/aib38-live/scripted-scoping.js`: the bubble was on screen at 39 of 140 characters
with the turn still in flight, already rendered as a heading and bold; `Thinking…` was gone rather
than sitting beside it; and the streamed copy was *replaced* by the transcript at the end rather than
added to it. The same run closes **AIB-006 criteria 1 and 2** live — every construct rendered
(heading, bold, list, code) and the user's own `**Signup**` shown verbatim, unbolded.

Original entry follows.

**Verified · 🟡 Medium · folded into [AIB-006](AIB-006-MARKDOWN-RENDERING.md)**

`ScopingStep` shows a static `Thinking…`
([line 80](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/ScopingStep.tsx#L80))
for the whole turn. This is the first AI interaction any new user has with the product and it is the
one with no feedback at all. Listed separately from AIB-006 because it may need work in
`ScopingSession` rather than the step.

## F8 — Mid-run partial accepts are invisible to later operations

**✅ Closed 2026-08-03 — the mechanism had already changed · was: Verified · 🟠 High**

Not true by the time AIB-002 was built, and not because of AIB-002. AIB-003's rewrite made
`workingGraph()` a method that recomputes from `filesById` at the point each session starts, so a
mid-run `setOperationFiles` *is* what the remaining operations author against. What this pass added
is the spec that pins it (`authoring-plan.test.ts`, "hands a later operation the candidate as the
user edited it mid-run"). Worth noting for anyone reading the entry as written: a test aimed at the
**gate** would have passed either way — `validateCandidateComponent` gives the semantic validator
only `components.map(c => c.name)`, so a sibling candidate's *shape* reaches the prompt and never
the gate.

Original entry follows.

**Verified · 🟠 High · folded into [AIB-002](AIB-002-THE-RUN-IS-LEGIBLE.md) slice 1**

Only reachable once AIB-002 lets you review during a run, which is why it is filed here rather than
as a live defect. `workingGraph` is extended from `outcome.files` at stage time
([PlanRun.ts:325-327](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L325-L327));
a later `setOperationFiles` replaces `filesById` but **not** the working graph. So an operation the
user pruned mid-run is still what operation 3 authors against, and the mismatch surfaces at apply as
a validation refusal on a component the user thought they had fixed.

## F9 — `contextNote` is the only thing explaining the plan/project boundary

**✅ Closed 2026-08-03 by AIB-004 · was: Verified · 🟡 Medium**

The buttons carry the meaning now — `Keep all in plan` / `Drop from plan` against the single
`Apply to project (N)` — and the plan context is a persistent chip rather than a title suffix. The
note is kept, unshortened for the moment: it is the only place that states *why* the levels differ,
and shortening it is a judgement worth making against the live surface rather than the source.

Original entry follows.

**Verified · 🟡 Medium · folded into [AIB-004](AIB-004-ONE-VOCABULARY-AND-A-REAL-PREVIEW.md)**

The sentence *"Keeping a selection updates the plan — nothing reaches your project until you apply
the whole plan"* is the entire explanation of the model that confused Richard, and it is prose in a
panel next to a full-screen canvas. Structural affordances beat prose here; AIB-004 is where that
gets fixed, but the note is worth keeping in a shorter form once the buttons carry the meaning.

## F10 — State is mutated during render in `ProjectAuthoringView`

**✅ Closed by [AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) · was: Verified · 🟢 Low**

The take moved into the `useState` initialiser, which runs before anything is subscribed and at most
once per mount, and the guard is now the store's own content rather than a ref sentinel.

Original entry follows.

**Verified · 🟢 Low · correctness hazard**

[Lines 119-122](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L119-L122)
perform a destructive `takePendingScopePlan()` in the render body, guarded by a ref sentinel. The
guard works for one component instance, but writing to a module-level store during render is a
StrictMode and concurrent-rendering hazard, and the codebase is on React 19.

[AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) rewrites this seam anyway. Flagged so it is not
faithfully reproduced in the new store.

## F11 — Nothing anywhere ends a turn that never returns

**✅ Closed 2026-08-03 · live QA green · was: Verified (AIB-002 live QA) · 🟠 High**

`withTurnDeadline` wraps the chat seam of all three sessions — authoring, doc, scoping — so there is
no path into any loop that can wait forever. Three decisions are the substance:

- **The deadline is on silence, not duration.** A reasoning model may think for minutes and that is
  the turn most worth waiting for; a stream that delivers *nothing* for three minutes is not. The new
  `AiStreamCallbacks.onActivity` is what makes the difference legible: the three HTTP providers fire
  it per stream event, including Anthropic's `ping` and the `thinking_delta`s this client drops on
  purpose.
- **It aborts its own controller, never the caller's.** `AuthoringSession` reads
  `abortController.signal.aborted` to decide whether a failed turn was the user pressing Stop. Had
  the deadline aborted that controller, every stall would have reported as a cancellation — and
  inside a plan run a cancellation marks every remaining operation `skipped`, which is precisely the
  damage the entry describes.
- **A candidate that passed the gate survives it.** The stall most likely to happen is the *optional*
  style pass, because it is the extra turn nobody asked for. The first version of this fix reported
  that as an error and threw the accepted component away, which is worse than hanging: the user paid
  for it and it validated. The exhausted and aborted paths already had this rule; the error path did
  not.

Live, via `scripts/aib38-live/scripted-stall.js` against a provider that accepts the request and
never answers: the run ended by itself after 188 seconds, the operation read *"The model stopped
responding — nothing arrived for 180 seconds"*, and the panel offered **Retry**. Deliberately slow —
the shipped constant is three minutes and the panel exposes no override, so a faster check would be
testing a different number than the one users get.

Original entry follows.

**Verified 2026-08-03 (AIB-002 live QA) · 🟠 High**

Found by accident and worth keeping. During the AIB-002 live replay two operations reported 3m21s
and 4m25s for turns whose scripted work is seven seconds — Chromium throttling `setTimeout` in an
occluded window, so the *cause* was the harness. The *screen* was not: the panel read
`Writing — 3 nodes so far` and nothing else, indefinitely, and there was no way from inside the
editor to tell a throttled timer from a provider that had stopped answering.

Neither `AuthoringSession.run()` nor `PlanRun` has a deadline. The budget they enforce is turns and
submissions, both of which require the model to *reply*. A provider that accepts the request and
never responds leaves the run `busy` forever, the Stop button as the only exit, and — because
`PlanRun.cancel()` marks the remaining operations `skipped` — the rest of the plan unbuilt.

The fix is a per-turn deadline with a clear message, not a global one: a long turn is normal, a
silent one is not. AIB-002 now shows elapsed per operation, which makes the symptom *visible*; it
does not make it *end*.

## F12 — The launcher decides AI is off before it has read the settings

**✅ Found and closed 2026-08-03, live · was: unknown · 🔴 High · blocks the phase's own exit criterion 1**

Found while trying to drive the wizard for F7: the **Start with AI** card was disabled, reading *"AI
is turned off. Pick a provider and add a key to use it."* — while `AiConfigStore.getProvider()`
returned `anthropic` and `isConfigured()` returned `true` **in the same renderer, at the same
moment**. Opening the Settings dialog and closing it again, changing nothing, enabled the card.

The mechanism is a race with a cache on the losing side. `EditorSettings` loads from disk
asynchronously and `get()` answers `undefined` until it lands, so `AiConfigStore.getProvider()` reads
`'disabled'` for the first moments of a launch. `readAiAvailability` runs inside a `useMemo` in
`ProjectsPage` whose only other trigger is *the settings dialog closing* — so a launcher that lost
that race kept the wrong answer for the whole session.

What the user gets is the first screen of the product telling them, over a working API key, that the
feature this phase is about does not exist. It is exit criterion 1 — *"Describe a chat app in the
launcher's AI wizard"* — failing before the wizard opens, and it is invisible to every test: there is
no DOM runner for the launcher, and the race does not exist in one.

The fix is one effect on the seam `EditorSettings` documents for exactly this
(`ready: Promise<void>` — *"consumers that must read a value before first paint await this"*): bump
the re-read trigger once it resolves. Verified as a before/after on the same machine — the launch
that found it had the card disabled; the next cold launch, after the fix, had it enabled with no user
action and no Settings visit.

Worth carrying: **`AiClient.isConfigured()` is read in three other places** and the two in
`AiAuthoringPanel` recompute per render, which is why this only ever bit the launcher. A cached read
of an asynchronously-loaded store is the shape to look for, not the store itself.

What guards it is the driver, deliberately: `scripted-scoping.js` fails with *"the AI card is
disabled"* before it does anything else, so any regression stops the F7 and AIB-006 checks dead
rather than being reported as a separate red. There is no unit guard, and writing one would mean
extracting `readAiAvailability` from a React page for a runner that does not exist — the race is
between a promise and a first render, and neither is present in jest.

---

## How to work this register

Items folded into another task (F3, F7, F8, F9) are cross-referenced there and should be closed by
that task, not separately. F1, F2, F5 and F6 are standalone. F4 and F10 are one slice each.

**Closed:** F1 (AIB-002 pass), F2 (AIB-007/AIB-008 pass), F4, F6, F7, F8, F9, F10, F11, F12.
**Open:** F5 (downgraded to low, with a mechanism that explains it), F3 (half, and the half that
remains is harmless).

Everything closed in the 2026-08-03 register pass — F4, F6, F7, F11, F12 — was checked in the running
app, not only in a suite. Three of the five could not have been checked any other way: F7 and F12 are
launcher React with no DOM runner, and F6's remaining half was a line Chromium emits before our code
runs.

**The drivers, all no-provider:** `scripted-scoping.js` (the wizard, streaming and markdown; `--create`
carries through to a real project and the plan announced in the editor), `scripted-stop.js` (stop
mid-run, the documents afterwards; also AIB-003 criterion 6), `scripted-stall.js` (a provider that
never answers). All three hold their turns on a promise the driver resolves over CDP instead of
pacing with `setTimeout`, so the occluded-window throttling that produced F11 cannot reach them.

**F3 is half closed and the half that remains is now harmless.** AIB-001 replaced the raw
`.split(',')` in `updatePortsForNode` with `readNameList`, so nothing throws. But `nodeAdded` still
copies `queryParams`/`pathParams` verbatim from a sibling, and `parametersChanged` still writes them
to every sibling with `setParameter` — the *spread* the entry describes is unchanged. It no longer
rolls back a transaction, because every reader now tolerates any shape; what it still does is carry a
malformed value to nodes the user never touched, where the next reader to be written without
`readNameList` will find it. Left as written rather than closed.

Anything that turns out to be larger than described gets promoted to AIB-010+, with the finding kept
here as a pointer rather than deleted — the register is the record of what one real session
surfaced, and that is worth keeping intact.
