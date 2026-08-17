# Phase 69 — next session

**Written 2026-08-17, session 19.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s19 drove CN-010 AC1** — the first
live-editor measurement of a kit's dynamic ports. Half the criterion is met outright; the other half
is a hole, and the drive turned up a **third** thing that is worth more than either: **a kit node's
definition is delivered once and then frozen for the session.** §1 and §2.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-018**, **CN-019** | ✅ | ✅ | Closed s13 / s15 |
| **CN-007** | ✅ s14 | ✅ s15 (D8) | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ s16 | ⚠️ **AC1 needs a live model** | §5 |
| **CN-009** | ✅ s17 | ⚠️ **AC5's consequence needs a live model** | §5 |
| **CN-010** | ✅ s18 (AC2+AC3) | ✅ **AC1 DRIVEN s19** | **AC4 not started**; two new holes fell out, §2 |
| CN-006b, CN-011 … CN-017 | 📋 | — | §4 |

**Nothing in this phase is blocked on a decision.** Two scope calls are owed (§6).

🔴 **The drive debt is now one item, not three.** CN-010 AC1 is closed. **CN-008 AC1 and CN-009 AC5
remain, and they are still one drive rather than two** — both want a live model authoring in a
project that has a kit. ⚠️ **Read §5 before attempting it**: there is a stale-build trap that would
make the whole run grade the wrong code.

---

## 1. ✅ What s19 measured, in one line each

Full readings, with the observations recorded **before** the editor was launched:
**[notes/cn-010-ac1-drive.md](notes/cn-010-ac1-drive.md)**.

- ✅ **A kit's `conditionalports/basic` works end to end, and nothing on the path is kit-aware.**
  `inputs: ['itemCount']` → the editor's own format with the condition intact → the row appears at
  `mode = list` and vanishes at `mode = grid`, reversibly → connectable through the real connection
  popup → the wire is drawn, saved, and **carries a value at runtime** (`Lanes (0)`).
- 🔴 **A kit's `channelPort` is erased in every surface and every state** — including `getPorts()`
  with the runtime live and the node **mounted**, which is what rules out *"it only exists while
  previewing"*.
- 🔴 **`channelPort` occurs once in 177 library types and it is the fixture's own node.** Zero
  built-ins. That is the explanation, not a coincidence.
- 🔴 **A kit node's definition is frozen after first delivery** — §2, the one to act on.
- ⚠️ **Two instruments nearly produced false findings**, both recorded in the notes; the second is a
  standing hazard for anyone measuring editor warnings (§3).

## 2. 🔴 The lesson from s19: a control pair rules out four explanations at once

The open question was *"what does the editor do when a kit's dynamic ports change while nodes using
them sit on canvas?"* — deliberately left without a prediction, because inventing one would have
turned an open question into a pass/fail on a guess.

**One write to `index.js` made two changes**: flipped `Panel`'s condition, and added a brand-new
`Badge` node. **One viewer reload.**

| change | delivered? |
|---|---|
| the **new** type | ✅ immediately — `NodeLibrary.types` 177 → 178 |
| the **changed** condition on the existing type | 🔴 never — five polls over 30s |
| after a full editor reload + re-open | ✅ |

✅ **Same file, same write, same reload, same round trip. The only variable is whether the editor
already knew the type name.** That eliminates the file, the watcher, the transport and the reload in
a single move — none of which any amount of polling the failing case alone could have done. **When a
change does not arrive, ship a second change alongside it that you expect to arrive.**

**The cause is a `TODO` sitting on the exact line.** `NodeLibraryImporter.mergeUpdates` takes the
`else` branch for a name it already knows and does nothing with the new data
(`// TODO: Update the node data?`); `updateIndex` only calls `NodeLibrary.instance.reload()` when
`forceUpdate || removedNodes.length > 0`. ⚠️ `mergeInByName` (`:366-388`) has the mirror-image bug for
the picker index, with the fix commented out directly beneath it.

⚠️ **s12 flagged `mergeInByName` as "wants a look".** It wanted a look. A carried ⚠️ with a named file
and line number is cheap to check and this one was load-bearing.

🔴 **Why it matters more than it sounds.** Dynamic ports work *first time*, then every subsequent
tuning edit is silently ignored. The author's natural conclusion is **"dynamic ports don't work in
kits"** — which is false, and is the opposite of what CN-010 just proved. **This is the kit author's
inner loop, and it is broken in the one way that misattributes the fault to the feature.**

**It wants a task number.** Small, well-located, and it unblocks the authoring loop D2 rests on.

## 3. ⚠️ Two instrument traps from s19, both worth carrying

1. 🔴 **`node.setParameter()` does not re-render the property panel.** The first pass at AC1 read an
   unchanged panel and would have been filed as *"the condition is not evaluated"* — **about working
   code**. The tell was free and is generalisable: **the row I was *driving* also failed to move.**
   If the thing you changed does not show your change, the instrument is dead, not the feature.
2. 🔴 **`WarningsModel.getTotalNumberOfWarnings()` returned 0 with a deliberately bogus
   `Totally.Not.A.Real.Type` node on the same canvas.** It does not fire on a known-bad input, so its
   zero says nothing. Whether the editor warns about an orphaned parameter is recorded as
   **unmeasured**, not as silence. ⚠️ **Anyone about to assert an editor-side absence via
   `WarningsModel` needs a different instrument.**

## 4. Picking the next build

**CN-006b (the kits surface)** is still the one with the most behind it and no measurement debt — its
prerequisite (CN-018's provenance) is done and it is the editor surface D1 asked for.

✅ **s19 paid down part of its cost for free.** CN-006b's AC2 and AC4 are about the property panel of
a kit node versus a built-in; s19 read exactly those panels side by side and found **no difference
attributable to kit-ness** in any surface measured — property panel, Ports tab, connection popup and
canvas all treat `dynports.kit.Panel` exactly as they treat `Group`. That is a *baseline for the P1
check*, not the check itself (which wants the screenshots AC4 asks for), but it means the check is
very likely to come back clean.

⚠️ **Confirm rather than inherit — this is now four sessions running.** CN-008's two clauses,
CN-009's `find_tools` clause, CN-010's AC3 (wrong three ways in one sentence), and now CN-010's AC1,
whose *"establish behaviour before specifying it"* section listed three unknowns of which one was
already fine, one was broken in a way the spec did not imagine, and one had an answer nobody had
asked for. **Run the thing the task describes, over real data, and count what comes back.**

## 5. ⚠️ Before attempting CN-008 AC1 / CN-009 AC5

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live `nodegx-*`
tools would grade the **old build**, so s18's and s17's work would not be under test at all. The
recorded route is to **spawn the bundle directly over stdio** — build to a *scratch* path with
esbuild (never over `packages/noodl-mcp/dist/`, which is what peers' registered servers load), pass
`--all-tools`, and read `inputSchema` from `tools/list` before calling. It needs no port, collides
with nobody, and gives a clean two-arm old-vs-new control for free.

⚠️ **Both criteria are about a *consequence*, and both say so explicitly.** CN-008 AC1: the graph the
model produces uses `Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group` — *"the handout
appears in the prompt" is the mechanism and would be equally true of a broken feature*. CN-009 AC5:
an agent **places** a kit node it was not told about.

## 6. Owed by Richard

1. 🆕 **Fix the frozen-definition path?** (§2) It is a real bug with a named cause, but it is
   *outside* CN-010's stated scope and it touches `NodeLibraryImporter`, which every runtime's
   library goes through. Own it as a new task, or fold it into CN-014 (the dev loop), which is the
   task whose subject this actually is.
2. 🆕 **What should `channelPort` do?** Three options and they are not close in cost: **(a)** revive
   the editor-side manager; **(b)** have the exporter stop stripping the port, so it behaves as an
   ordinary static one; **(c)** reject it at kit-load with a diagnostic that names it as
   unsupported. ⚠️ **Doing nothing is the current state and it is the worst of the three** — the
   author gets no port and no message.
3. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
4. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (**8**, measured s18,
   none in CN-010's files) and runs in no CI job; seven of eleven `typecheck:*` scripts run nowhere,
   and `scripts/` is in none. ⚠️ `typecheck:runtime` red at 2, pre-existing. ⚠️ `typecheck:core-ui`
   reports **44 `TS2307`s**, cause unidentified.
5. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens.
   `tests/kitTools.test.ts` has the control that fails when it changes. Narrowed by s17, unanswered.
6. **"Clean" is no longer "an empty diagnostics array" for any page** (s18's AC2). `Page` declares
   neither `title` nor `urlPath` statically, so **96 of 947 measured skips are `Page`** and the
   canonical clean page now carries one `info`. `warnings` stays **0** and nothing blocks; same trade
   CN-002 made and you ruled for, but it changes every authoring response.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake (`provision.test.ts` red in a full run, green in isolation) · 🔴
`ViewerConnection.sendRefresh()` dead at both ends.

## 7. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and only ONE copy is tokenised.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate — while
`cn001-kit-drive` and `cn019-drive` still carry the pre-D8 kit (0 × `var(--`, 6 × live `#1F8A4C`).
**Driving the wrong copy reads as "the change did not land".** D5 makes CN-007 depend on this kit
staying working and nothing enforces it. **Still wants a task number.** ⚠️ Read it via a `cp -R` into
a scratchpad; never write to it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string. One eval with a project open.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (`notes/cn019-driven.png`).

⚠️ **From s18:** `find_tools`' `query` matches tool *names* only while its `describe` text says
"names and descriptions" (noticed s17, still untouched — changing it costs resident tokens).

## 8. Checkout conditions

- 🔴 **An editor stack WAS launched and HAS been torn down.** `dev:debug --quiet` on 9222; no peer
  stack was running at launch (`dev:stop --list` clean, `ps` clean, **paired with a positive control
  matching 28 Electrons** so the zeros were attributable rather than a dead pattern).
  `npm run dev:stop` at the end reported **26 processes stopped**, and the **28 peer MCP servers on
  this checkout survived** — `NEVER_SWEEP` working as documented. **Nothing of mine is running.**
- ✅ **No repo source file was edited.** s19 wrote only task docs, notes and two screenshots, so
  there was no `test:ci` contamination window and no peer needed telling.
- ✅ **The fixture is untouched**: everything ran on a `cp -R` copy in the session scratchpad, and
  `git status packages/noodl-mcp/tests/fixtures/kit-dynports` was clean at the end. ⚠️ Confirmation
  in passing of a known trap: the copy gained `.gitignore`, `.mcp.json` and `CLAUDE.md` purely from
  being opened.
- 🔴 **No gates were run and none were needed** — no source changed. **Do not inherit s18's numbers**
  (`noodl-mcp` 613 / 52, editor 3,567 / 231, surface 8,223 / 8,280, `tsc` 8): re-measure before
  quoting them.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s19's commits are not in
  it. **Re-measure before quoting.**
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-*`, `phase-65-*`,
  `phase-68-*`, `packages/noodl-editor/scripts/aix002-measure/`, `.../AiAssistant/authoring/prompts/`,
  `scripts/library/check.ts`.
- Whoever you tell you are starting, tell you have stopped.
