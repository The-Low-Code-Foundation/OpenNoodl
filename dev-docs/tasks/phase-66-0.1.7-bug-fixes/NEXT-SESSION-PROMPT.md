# Phase 66 — next session

**Written 2026-08-15, session 13.** One drive: the launcher scoping chat, the last surface FIX-003
criterion 1 was missing. **It passes, and the main-process `will-navigate` guard is proven in use for
the first time.** No code was written and no gate was re-run — nothing in the tree changed but docs.

✅ **FIX-003 criterion 1 is complete on every drivable surface.** ✅ **FIX-002 and FIX-003 remain
closed** (`b9d39213`), and sessions 11–12's work was not re-derived. 🟡 **One new datum is owed to
Richard, not to an agent** — the scoping model *refuses* to emit links, which bears on the `linkify`
ruling he already made; see §5.

🔴 **The ruled backlog now has no buildable work left except FIX-001.** Everything else open is
either a Richard ruling or FIX-014's repackage block.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** — 🟡 14(a) vocabulary sweep still owed |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-002** | ✅ | ✅ **4/4** | **CLOSED** — c2 ruled, built and driven this session |
| **FIX-003** | ✅ | ✅ **5/5** | **CLOSED** — c2 fixed and driven; **c1 now driven on all 3 drivable surfaces** (s13), `will-navigate` proven |
| **FIX-014** | ✅ | 🔴 **0/1** | not started; ⚠️ MCP half is **blocked on a repackage**, see §5 |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Ten closed, ten open.** The ruled backlog again has no buildable work left except FIX-001.

---

## 2. Gate readings

⚠️ **Session 13 ran no gates and changed no code — only docs.** The readings below are session 12's,
carried forward unchanged and still current for the tree.

🔴 **Quote these against a *tree*, not a commit.** HEAD moved under both `test:ci` runs (peers
committing mid-run), and `test:ci` webpacks the **working tree**, not `HEAD`. What was measured is
the tree at ~11:54 — which is why `totalCount` reads 2788 rather than the 2779 in older handovers.

✅ **The floor question is settled, at the pinned seed, by two independent runs.** Session 12's run at
11:29 and phase-67's control run at 12:04 both returned **2788 / 6 with the same six names** at seed
**39393** — same seed *and* same spec set, which is the pairing earlier handovers warned was usually
missing. Runs at other seeds (50405, 73375) returned 2779 / 9. So: **the floor of 6 is real and
seed-dependent**, and the extra ~3 elsewhere are the seed-order `BEN-001` cluster, not a regression.

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ✅ **2788 specs / 6 failures**, **pinned seed 39393** — the floor exactly by name, **zero `BEN-001`** | 11:29:46 |
| `test:main` (jest, editor) | ✅ **199 suites / 3074 tests, 0 failed** | ~11:10 |
| `noodl-core-ui` jest | ✅ **24 suites / 385 tests** (was 23/369 — +1 suite, +16 specs, exactly this session's) | ~11:12 |
| editor `tsc --noEmit` | ✅ 0 errors | ~11:10 |
| `lint:ci` | not run — unchanged from s10 (877 errors, baseline 3916) | — |

✅ **Pin the seed. It works and it turns a two-run question into a one-run answer.**
`NOODL_SPEC_SEED=39393 npm run test:ci` — read by **`tests/SpecRunner.html:41-42`**. 🔴 Grepping
`scripts/run-electron-tests.js` for `--seed` finds nothing and is the **wrong surface**; three
sessions concluded "no seed control exists" from exactly that today. At the pinned seed the floor is
**6**; unpinned it is ~9, the extra ~3 being the seed-order `BEN-001` cluster.

**`totalCount` 2779 → 2788 is exactly the +9 specs added to `tests/utils/keyboardhandler.spec.ts`** —
that delta *is* the proof they ran, and it only works for `tests/` specs (a `tests-unit/` spec adds
+0 and that is correct).

---

## 3. What this session settled — do not re-derive

### ✅ The launcher scoping chat is driven; `will-navigate` is proven in use

Full record in [FIX-003](FIX-003-TEXT-YOU-CANNOT-SELECT-OR-CLICK.md). The result: `/probe-launcher`
fetched by **Firefox 153**, `sec-fetch-mode: navigate`, plus the `/favicon.ico` follow-up, while the
editor stayed on `file://…/index.html`.

🔴 **The lesson is not the pass — it is that the obvious evidence was not sufficient, and would have
produced a wrong pass.** A probe hit plus a `file://` window is *equally consistent* with a
renderer-side handler that `preventDefault`ed and called `openExternal` — which is exactly what the
Build and Explain surfaces already do. Stopping there would have credited the guard for work the
renderer might have done, on the one surface whose whole point is that the renderer does none.

**The discriminator that settles it**, and the shape to reuse for any link-policy drive:

> A **capture-phase listener at `window`** (runs before anything can `stopPropagation`), reading
> `e.defaultPrevented` from a `setTimeout(…, 0)` **after the full dispatch**.
> `defaultPrevented === false` (the renderer did *not* stop it) **+** `location.href` still `file://`
> (yet it *was* stopped) ⇒ **it was stopped outside the renderer.** That is `will-navigate`
> (`main.js:458-462`) and nothing else.

⚠️ **The assistant reply carrying the link came from a transport double, and the write-up says so.**
`AiClient.chatStream` was patched via the webpack module cache to return one turn. Everything below
the network hop is real — transcript → `setScopingMessages` → `ScopingStep` → core-ui `Markdown` →
anchor → trusted click → guard. **The drive proves the app's link behaviour; it does not prove the
model will ever emit a link.** Keep those two claims apart.

✅ **Confirmed as a by-product, from one reply carrying both forms:** `[Help](…)` rendered a real
`<a href>` **with no `target`** (which is *why* this surface needs the guard — `setWindowOpenHandler`
only sees `target=_blank` and `window.open`), while a bare URL in the same reply rendered as **plain
text, no anchor** — the `linkify` ruling, observed rather than argued. And `cursor` on that anchor
computes to **`pointer`**; a handover claim that it would not look clickable does **not** reproduce.

### ✅ Three rulings obtained from Richard (session 12)

1. **⌘C precedence → a selection-aware clipboard guard.** A live text selection outside the canvas
   owns ⌘C/⌘X, whatever holds focus.
2. **`linkify` → stays OFF.** A bare URL in AI output does not become a link, on any surface.
   Criterion 1's wording is narrowed to markdown links; the security widening was not bought for a
   formatting convenience.
3. **Composer → auto-grow to a max height**, capped in **rows** (a percentage cap would make the
   composer's feel depend on where a divider was dragged). **Eight rows** for Explain.

### ✅ Both fixes built, gated and driven

Full build records and drive tables are in
[FIX-003](FIX-003-TEXT-YOU-CANNOT-SELECT-OR-CLICK.md) and
[FIX-002](FIX-002-THE-COMPOSER-YOU-CANNOT-TYPE-IN.md). The three findings worth carrying:

🔴 **1. The repro in session 11's handover is not reachable the way it was described, and the defect
is still real.** Measured: clicking a canvas node **swaps the left panel to Properties** (unmounting
the thread), and opening a panel from the rail **deselects the node**. So "node selected on canvas +
text selected in a panel" cannot be produced *via the canvas*. It is produced two other ways —
**the Properties panel itself** (on screen precisely *because* a node is selected, and carrying
selectable prose), and **an Explain citation** (selects a node without leaving the panel). The
Properties route is the most natural repro in the product and is what the drive used.

🔴 **2. `toString().trim()` in the guard is load-bearing, not defensive.** When a panel unmounts, the
selection **range survives** — `isCollapsed` stays `false`, `rangeCount` stays `1` — and only
`toString()` empties. A guard keyed on `isCollapsed` alone would have suppressed ⌘C **for the rest of
the session** after the first panel swap. That dead-shortcut bug is strictly harder to report than
the one being fixed ("copy sometimes does nothing" vs "copy gives me JSON").

🔴 **3. `[data-keyboard-scope]` could never have fixed this.** It keys off the element the keystroke
was *dispatched at*; a text selection in a plain `<div>` dispatches nothing and moves focus nowhere.
Marking the panels as their own surface would have changed nothing while looking like a fix. This is
why a lane entirely about making prose selectable never touched the copy path — the selection is a
**third thing**, invisible to both existing scopes.

### ⚠️ Harness findings

🔴 **NEW (s13) — `cdp click` resolves `#cdp-target` to the FIRST match in document order, and a stale
tag from an earlier eval is still in the DOM.** Tagging a second element while the first still
carried the id sent the click to the **old element's coordinates** — silently re-clicking "New
project" and closing the wizard, while `cdp click` reported success at plausible-looking
coordinates. It reads as "the app ignored my click", not as a harness fault.
**Always `document.querySelectorAll('#cdp-target').forEach(e => e.removeAttribute('id'))` before
every tag**, and sanity-check the reported click coordinates against the rect you just measured — a
mismatch is the tell.

⚠️ **NEW (s13) — the first `cdp click` on a freshly loaded launcher is swallowed; the second lands.**
Not a race with layout (the element was present, unoccluded and enabled, and `elementFromPoint`
returned the button itself). Budget a throwaway click, or poll for the *outcome* rather than trusting
the first success report.

⚠️ **NEW (s13) — reaching the scoping step needs a `location`, and that field cannot be typed.**
`isReadonly` on core-ui `TextInput` renders a **`<div>`, not an `<input>`**, and the only way to fill
it is a **native** folder dialog CDP cannot drive. Stub `filesystem.openDialog` from the webpack
module cache (`../noodl-platform/src/index.ts` → `filesystem`). The wizard order for AI mode is
**entry → basics → preset → scoping → review**.

✅ **NEW (s13) — the webpack module cache is a general seam for driving this app.**
`window.webpackChunknoodl_editor.push([[unique], {}, r => req = r])` yields the require, and
`req.c['<module path>'].exports` reaches any editor module — used here for both
`filesystem.openDialog` and `AiClient.chatStream`. ⚠️ `window` state **does** persist across separate
`cdp eval` calls, so stubs and probes armed in one call are readable in the next.

⚠️ **NEW (s13) — filter the `BaseDialog` double-render *and* the rest of the page.** "Continue" and
"Next" both appeared enabled; "Continue" belonged to the launcher's Learning card, not the wizard.
Scope queries to `[class*=ProjectCreationWizard-module__Modal]` and exclude
`[class*=MeasuringContainer]`. Walking up from a step title stops at `…__Header` (0 buttons) — go to
`…__Modal`.

🔴 **An element can be `user-select: text`, `visibility: visible` and still measure `0×0`, and
`Selection.toString()` returns `''` for it.** **16 of 17** first-pass prose candidates were exactly
that (unmounted panel content still in the DOM). A probe that picks one reports an empty selection
and **silently exonerates the bug** — it produced two confident, invalid drive runs before it was
caught. Require a non-zero rect *and* verify `String(getSelection()).length > 0` at pick time.

🔴 **Tag prose AFTER selecting the node.** Selecting a node re-renders Properties and React discards
the tagged element. And the re-render is **async** — a read in the same eval sees the pre-render DOM
and reports the panel still open, which is how "13 prose blocks visible with a node selected" was
briefly believed.

✅ **The control that separates a suppressed key from an absent key**: fire the *same* key, on the
*same* connection, with only the selection differing. Over CDP both look identical (clipboard
untouched), so C1 alone proves nothing; C2 copying node JSON is what proves the key path is live.

🔴 **CORRECTED — this was NOT the "backgrounded exit code lies" trap, it was self-inflicted, and
mis-attributing it was the more instructive error.** The harness reported exit 0 while the log ended
`npm error command failed`, and the recorded trap was blamed. In fact the script's **last statement
was an `echo`**, so the compound exited 0 and masked npm's 1 — the harness reported the script's
true status. Phase-67 hit the identical thing independently within the hour, which is what prompted
the re-check.

⚠️ **The sharper half: the instrumentation was already right and went unread.** The script ended
`echo "exit: $?"`, and that line printed **`exit: 1 at 11:29:47`** — into the background task's
output file, which was never opened because the scratchpad *log* was read instead. The evidence
existed and the wrong source was consulted.

**How to apply:** end a gate command with the gate, not with an `echo`/`date`/`ls`; and if you do
add a trailing report, **read the file it writes to**. Either way `test-results.json` + its mtime is
the verdict — that part held and made this a non-event.

⚠️ **Rail buttons don't map to a stable index.** Clicking them behaved as a toggle, and six
consecutive indices produced only two distinct panels. Select by **outcome** (does the thing I need
have a non-zero rect?), not by position.

### ⚠️ Cross-session: nine peers, and the process table was right every time

A `test:ci` was already running when this session announced. **Three separate peers attributed it to
me**, and it was phase-67's (`112.sock`) pinned control run — settled by `ps -o ppid` plus
`ps -Ewww` for `NOODL_SPEC_SEED`, not by announcements. **An announcement is not evidence of a
process.** Phase-67's control run also happened to contain this session's uncommitted
`keyboardhandler` changes, because `test:ci` webpacks the **working tree**, not `HEAD` — worth
remembering before quoting any total as "the branch's".

---

## 4. What to do next and why

✅ **The launcher scoping chat is done — struck from this list.** §3 has the result and the reusable
discriminator.

1. 🔴 **FIX-014 criterion 1** — untouched, and now the oldest undriven item. Drive the **Build panel
   half** (runs from the repo); record the MCP half as **blocked**, see §5.
2. **FIX-001** (Tier 1, the explainer) — the biggest remaining user-visible win and the only Tier 1
   task with no code at all. **This is the one to pick up if you want to build rather than drive.**
3. **FIX-008 fix C** (`--scope project`) — Richard owes a measurement on C's copy first.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

- 🟡 **NEW (s13) — a datum that bears on the `linkify` ruling you already made.** Driving the scoping
  chat turned up that **the scoping model declines to emit links**: asked three times in three
  framings, it refused each time, once naming the request outright ("that request looks like it's
  trying to get me to output a clickable link to a local probe endpoint"). Combined with `linkify`
  being off, the surface for a clickable link in AI output on that screen is narrowed by **two
  independent mechanisms**. This does **not** argue for reversing the ruling — a legitimate markdown
  link is the normal case and is now proven handled — but criterion 1's premise, *"any URL the AI
  emits"*, describes a **rarer event than the wording implies**, and you ruled without that in front
  of you. Yours to weigh; no agent should act on it.
- 🔴 **FIX-014's MCP half is blocked on a REPACKAGE, not a rebuild.** Every running server executes
  `/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs` — the **packaged app**, dated
  2026-08-13, which does not contain `layoutAuthoredNodes`. The repo's `packages/noodl-mcp/dist` was
  rebuilt and *does* have it, so checking `dist` gives the wrong answer about what the servers run.
  ⚠️ There are now **26** live `noodl-mcp` processes (one per Claude session, plus three of
  Richard's long-lived ones). 🔴 They all match `pkill -f "OpenNoodl/node_modules/electron/dist"`,
  which the `run-editor` skill still suggests — **do not run it**; kill your own pids by pid.
- 🟡 **FIX-019 14(a)** — is the surface called *the workbench* everywhere? Loose thread.
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name (reverses
  VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a data-reading
  component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a **measurement**, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

**No ruling is owed on FIX-002 or FIX-003 any more.** All three outstanding ones were answered.

---

## 6. Standing constraints — unchanged, do not relearn

✅ **The announce-then-verify protocol worked again, and the process table was again the decisive
tool.** Session 13 launched into a checkout with **14 peers listed** and a live `test:ci`; reading
`ps -Ao pid,ppid,lstart,command` identified it as phase-67's (shell `83170`, suite `84502`, PPID
`112`, `NOODL_SPEC_SEED=39393`) before any peer replied. Five peers then confirmed clear. 🔴 **Note
the pid distinction phase-67 supplied: `83170` was the npm/shell wrapper, the suite itself was
`Electron test.js --ci` at `84502` — "the wrapper exited" is not "the Electron is gone".**

⚠️ **The webpack finishes ~45s into a `test:ci`; after that the contamination window is closed** and
source edits are safe. Session 13 waited for the whole run anyway because an **editor launch** (not a
source edit) is what injects phantom failures.

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; **pathspec-scope
every `git add`**. ⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to **neither**
this phase nor phase 67 — `MEMORY.md` links into it, so it is one `git clean` from gone. Leave it.

**Announce before *and* after any `test:ci`, `test:main` or editor launch** — `ListAgents` +
`SendMessage`, peers need their ` [ref]` on first contact. It worked again today, but the decisive
tool was **the process table**: `ps -o pid,ppid` plus `ps -Ewww` for the env. Announcements told this
session three contradictory things; `ppid` told it one true thing.

🔴 **`dev:stop --list` labels a running `test:ci` as "dev stack"**, and plain `dev:stop` would kill
it — plus a peer's editor. Kill your own pids **by pid** (this session killed exactly two, `37733`
and `40488`, and left all 22 MCP processes alone).

⚠️ **A different CDP port does not let two editors coexist** — the single-instance lock ignores it.
What makes a launch safe is that nobody else's stack is up.

**Drive fixtures:** `fix003-drive` ("FIX003 Drive" in the launcher recents) is the scratch copy this
session used — it absorbed one Explain answer, which is harmless. `leg003-drive` ("Kiln & Co.") is a
git repo carrying other sessions' uncommitted work — never `git checkout .` there. `fix012-drive`
has the `/Probe` with 6 typed inputs. `BaseDialog` renders every dialog **twice** — filter
`:not([class*=MeasuringContainer])`.

⚠️ **The memory index still needs a prune.** `MEMORY.md` is over its 17.1 KB target and getting under
means **dropping live trap entries**, which is Richard's call about his own knowledge base. Ask him
which sections have gone cold.
