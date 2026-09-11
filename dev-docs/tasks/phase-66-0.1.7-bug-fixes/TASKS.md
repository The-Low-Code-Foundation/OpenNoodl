# Phase 66 — the tasks (FIX: 0.1.7 bug fixes → 0.1.8 alpha)

**Created:** 2026-08-14 out of [README.md](README.md) and ten research lanes over the 16-item
user-test report. Every row's mechanism was read in source on 2026-08-14; the task files carry the
file:line evidence.

**Built so far (2026-08-14):** FIX-007 (docs + write-time gate), FIX-020, FIX-010 — code complete
and gated. Gates green: `tsc --noEmit`, catalog trio + `catalog:examples` 62/62 + `docs:nodes:check`,
`cloud-library:check`, MCP suite 458/458, `test:main` 188 suites / 2866, `test:ci` 2726/6 (all six
inherited by name).

**Driven (2026-08-14, session 2):** **FIX-020 and FIX-010 are CLOSED** — 3/3 criteria each, driven
live. **FIX-007** is driven for criteria 2 and 3 and for criterion 1's MCP half; criterion 1's
internal-AI half is *paid* and awaits Richard, and criterion 4 is **blocked on its own fix 4, which
is not built** — not on the drive. 🔴 The drive also found the MCP sidecar `dist/` two days stale, so
the gate was reaching the editor door but **not** the MCP door until it was rebuilt; a running server
needs a restart to pick it up. See [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) § 3.

**Built and driven (2026-08-14, session 3):** **FIX-018 is CLOSED** — all five criteria, both
themes, on a purpose-built fixture. `test:ci` **2736 / 6 failed, seed 04897**; the six are the same
inherited failures by name (`AIX-006 style vocabulary` ×4, `AI model registry` ×2) and the total rose
by exactly the 10 new specs, which is what proves the barrel registration took.

**Built and driven (2026-08-14, session 4):** **FIX-008 fixes A, B and E** — the minimum that closes
report 5, plus E. Connect is idempotent (clicked live against the real `~/.claude.json`, which came
back byte-identical); every opened **v2** project gets `.mcp.json` + `CLAUDE.md`, proved through a
launcher card click and then through `claude mcp list` in that folder; `get_project_info` returns the
bound directory, driven over real stdio. **C and D remain open** — the stale user-scope
`nodegx-puppy-test-3` is still visible in every folder. Richard ruled **silent backfill on open**,
reversing BST-005's create-only choice.

✅ **FIX-007 CLOSED (2026-08-14, session 5, paid drive).** The internal AI, asked for a
`Component Inputs → Function → Component Outputs` component **without any mention of ports**, wrote
`in-items` / `out-text` — correct, zero warnings, and **"validated once"**: right the first time, so
the docs fix carried it and the write-time gate never had to fire. That is 4/4 criteria and the
fourth task closed this phase.

**Built and driven (2026-08-14, session 5):** **the seven batchable rulings are all made** (see
README § the rulings queue — 🔴 FIX-003 went *bigger* than its recommendation: invert the global
`user-select` now, so its drag-surface test plan is in scope). **FIX-007 fix 4** shipped and driven:
a wire's red clears in **76 ms** where it took **2017 ms**, measured in the same run as its own
control. `test:ci` **2748 / 6 failed, seed 04814** — the six inherited by name, and the total rose by
exactly the 12 new specs. 🔴 **Two more premises did not survive checking:** FIX-007's **fix 3** is
redundant (`getConnectionStatus` never checked port existence; `rules/nonexistentPort` already errors
for static types) and its ⚠️ **rider is not a defect** (`add_connection` refuses duplicates, so it has
no label to drop, and a guard spec already pins it). That is **7 of 16 report premises** now found
false or already-built.

🟡 **FIX-002, FIX-003 and FIX-014 all BUILT (2026-08-15)** — merged as `4bb692a8`, build fix
`fb936f6d`, and `1716236a`. **The ruled backlog now has no buildable work left in it; what the phase
owes is drives.** All three are **built, not driven**: ten acceptance criteria between them, plus the
drag-surface regression drives the FIX-003 ruling put in scope, plus **BLD-010's re-drive** (its
driven acceptance recorded Shift+Enter as the Build composer's send key, which FIX-002 reverses).

Gates on the final merged tree at `1716236a`: `test:main` **196 / 3022, 0 failed**; `noodl-mcp`
**43 / 494**; `noodl-core-ui` **23 / 369**; `test:ci` **2779 specs / 6 failures, seed 39393** — the
floor exactly by name, on a results file that was **deleted before the run and written again**;
editor `tsc --noEmit` 0 errors; `noodl-core-ui` 44 and `noodl-mcp` 7, both known-red and both
verified pre-existing, neither naming a touched file.

🔴 **`test:ci`'s first run on this merge was the most convincing false pass this repo has produced,
and it is why `fb936f6d` exists.** It exited **0** with `totalCount: 2779`, six failures, the exact
floor **by name**, seed 81235 — every content check agreeing it was a clean baseline run. The
**mtime had not moved**: it was the previous night's file. The webpack step had failed (a `{/* … */}`
between `return (` and the root element in `curveeditor.jsx` parses as an object literal), and
`test:ci` is `webpack && run-electron-tests`, so the suite never started. ⚠️ **Nothing else could
have caught it** — no `tests-unit/` spec imports that file so jest never compiled it, and it is
`.jsx` so the typecheck never read it. **Exit 0 plus an unchanged mtime is what a broken build looks
like here, not what a pass looks like.** Delete `test-results.json` before a run rather than
remembering to `stat` it. Both spellings of the bad shape were then scanned for across all of
`packages/`: zero other instances.

**States:** built → spec-proved → driven (the phase-64 discipline: a spec proves the decision;
only a drive proves the pixels).

---

### 🔴 Read the table, not the narrative above it — reconciled 2026-08-16 (s29)

⚠️ **Every prose block above this line is dated 2026-08-14/15 and stops before the drives.** The
narrative is kept as a build log; it is **not** a status readout, and four rows of the table below had
silently drifted out of agreement with it.

**What the reconciliation found.** The table was last touched 2026-08-15. Sessions 10–18 then drove,
ruled and closed work directly in the task files and **never wrote it back here** — so the phase's own
index was advertising as outstanding roughly **fourteen acceptance drives, one re-drive and one
vocabulary sweep that were all already done**: FIX-001 (shown open, closed s17), FIX-002 and FIX-003
(both shown *"BUILT — NOT DRIVEN"*, both fully driven s11–s13), and FIX-019's 14(a) rider (shown
owed, ruled *no sweep* s18). Each row below now carries its closing session and the ruling that
closed it.

🔴 **The transferable bit: "driven" is not "passed."** FIX-003's five criteria were all *driven* while
criterion 2 was **failing** — a reader who takes a drive record as a pass reads a closed task where
there was a live defect, and a reader who takes this table's *"not driven"* at face value re-runs
fourteen drives that already happened. **The two records must be reconciled in the same direction, and
only the task file is the witness.** ✅ When you close anything here, update this row in the same
commit.

| Task | One line | Report | Tier | Effort | Blocked on a ruling? |
|---|---|---|---|---|---|
| FIX-001 ⭐ ✅ | the explainer reads live values, warnings, and the backward walk | 1a–c | **1** | M (+M/L for 1c) | ✅ **CLOSED 2026-08-15 (s17)** — 5/5 criteria driven: 1a s15 (criteria 1–3, defect fixed `f8f215d0`), 1b s16 (criterion 4, nothing to build), 1c built + driven s17 (criterion 5). Three defects found across the three drives, all three fixed. 🟡 Only the **§1a.5 `backwardWalk` stretch** remains, and s15 showed it is worth **re-deciding rather than building** |
| FIX-002 ✅ | the Explain composer becomes a real multiline input with a Send button | 1d | **1** | S→**M** | ✅ **CLOSED 2026-08-15** — built `4bb692a8`, **all 4 criteria driven**: 1 + 3 s10 (caret visible at 194 chars), 4 s11 (Send button submits), 2 s12 after its own ruling (**auto-grow, capped in rows** — 56 → 176, stops at eight). ⚠️ **BLD-010's re-drive is DISCHARGED** for the send key |
| FIX-003 ✅ | AI text is selectable and links click, app-wide | 1bis | **1** | S→**M/L** | ✅ **CLOSED 2026-08-15** — built `4bb692a8`/`1b75f99d`, **all 5 criteria driven s11–s13**. 🔴 **Criterion 2 FAILED on first drive** (⌘C copied the selected canvas *node*, not the text) → **RULED s12: a selection-aware clipboard guard**, built in `keyboardhandler.ts` (+9 specs, 5 negative controls) and **driven passing s12**. ⚠️ **Ruling 2: `linkify` stays OFF**, so criterion 1 is narrowed to URLs the model writes as markdown links. ⛔ Criterion 1's 4th surface (a modal) is **not drivable in a dev build** — argued from shared code, not driven |
| FIX-004 ◐ | conversion + log blocks; free toolbox adds; objects-as-data | 2 | 2 | S+XS+M | ◐ **SLICES A + B BUILT 2026-08-16 (s34), `43b2e521`** — `noodl_convert` (5-mode dropdown, output check follows the mode) and `noodl_log` (statement, on `HATTABLE_BLOCK_TYPES`); 7 free stock blocks added, all verified present in Blockly's registry beside a MISSING control. Homes: convert under Math **and** Text, log under a new **Debug** category (+6 locales). 15 specs. 🔴 **Ruling 1 taken as the dropdown form** — its only stated objection was *"dropdowns read badly"*, which FIX-005 fixed in the same session. Rulings 2 (plain `log`) and 3 (English labels) taken as recommended. 🔴 **NOT DRIVEN** — acceptance 1–4 want the bench. **Slice C (objects-as-data) and async are untouched** |
| FIX-005 ◐ | dropdown contrast fixed; category name ruled | 3 | 2 | S–M | ◐ **PART 1 BUILT 2026-08-16 (s34), `5b91e9c8`** — selected row off solid primary (**2.33/3.56 → 9.09/12.11**), `.blocklyMenuItemHighlight` styled at last, `[aria-selected]` now after `:hover` so the selected row responds, checkbox hidden and the gutter made uniform, dead `.goog-*` deleted. 🔴 **The selected TOOLBOX CATEGORY was worse than the reported row — 1.19:1 dark** — now 4.65/5.58. **22 specs read the tokens OUT of the SCSS**; criterion 4 discharged by watching them go **red (5 failures) with the old rule restored**. 🔴 **Screenshot in both themes still owed** — a spec cannot prove a rule wins. 🔴 **Part 2 (the rename) UNTOUCHED** ✅ **RULED s42 → `App Variables` / `App Config`; still unbuilt.** ✅ **s43 `82b33466` — the four dead toolbox selectors DELETED per the ruling**, and with them the **five specs that graded them**: they were green in both themes, with a control firing at 1.19:1, on a selector matching **zero** elements. The row above's *"1.19 dark → 4.65/5.58"* describes a rule that never applied |
| FIX-006 ◐ | the AI picks the right code node and writes 2026 JavaScript | 4a–b | 2 | S+S+M | ◐ **FIXES 1 + 2 BUILT 2026-08-16 (s34), `28310bc8`** — `THREE_WAYS_TO_COMPUTE` generated from `NodePicker.chooser.ts`'s own notes (so picker and prompt cannot drift) plus the Script node's true nature, which the chooser deliberately omits; `CODE_STYLE` (const/let, methods over regex, `Outputs.X =` vs `Outputs.X()`). Script demotion taken as recommended: *reach for it last*, still authorable. 🔴 **A FALSE PREMISE FOUND: `AUTHORING_TRAPS` does NOT reach the in-editor AI** — the task says *"already shared by both clients"*, but that is reachability, not use; measured, its only two consumers are in `noodl-mcp`. Both blocks are therefore wired into the in-editor system prompt too. 🔴 **Fix 3 (the validator rule) NOT built; nothing driven** — *superseded: fix 3 built and driven s36–s39, AC1–AC4 all driven*. ✅ **s43 `82b33466` — AC4 built**: the Script paragraph leads with `Javascript2`, so all four items name the id. ⚠️ Source-level only; not re-read off the wire. 🔴 **The Substring weighting is the remaining build, and the ruling's exception is the load-bearing half** |
| FIX-007 ✅ | the `in-`/`out-` prefix truth reaches the catalog, the validator, and the write path | 4c | **1** | S+M | ✅ **CLOSED 2026-08-14** — 4/4 criteria driven; fixes 1/2/4 shipped, fix 3 struck |
| FIX-008 ⭐ | Connect is idempotent; every opened project gets its `.mcp.json` | 5 | **1** | S+S/M (+M for scope split) | ✅ **RULED 2026-08-14: silent backfill** — A+B+E built + driven; **C, D open** |
| FIX-009 ✅ | Components/Properties/PortEditor share one stored width | 6 | 2 | S | ✅ **CLOSED 2026-08-14** — built + driven 5/5 |
| FIX-010 ✅ | a query change re-anchors the picker to its top result | 7 | 2 | S | no (one test updated deliberately) |
| FIX-011 ✅ | the bench frame gets a height, handles, and a per-component default | 8a | 2 | M (symptom fix S) | ✅ **CLOSED 2026-08-14** — built + driven 4/4 |
| FIX-012 ✅ | a None row; Reset all stops lying | 8b | 2 | S | ✅ **CLOSED 2026-08-14** — built + driven 3/3 |
| FIX-013 | the Data maze is removed; the bench is inputs and outputs | 8c | 2 | S–M | 🔴 zero-rows / AI-preview parity |
| FIX-014 ✅ | logic nodes get their own column, by prompt and by a layout pass | 9 | 2 | S+M | ✅ **CLOSED 2026-08-15** — built (`1716236a`); criterion 1 driven in **two halves**: Build panel s16, **MCP s18**. ⚠️ `COLLISION_STEP` ruled 40 → `ROW_SPACING` and driven. 🔴 **Driven ≠ shipped: the packaged app still lacks the pass** (deployment debt, not a blocker) |
| FIX-015 | style tokens: rulings session → a new phase | 10 | brainstorm | session | 🔴 all eight |
| FIX-016 ◐ | Signal offered at add time; declared-vs-called mismatch diagnosed | 11 | 3 | S+S | ◐ **§2 CLOSED `4be3f1f6`** (+ follow-up `6de1ae25`: the diagnostic no longer fails to clear when you obey it); **§3c CLOSED**, driven 6/6. **§1 is fully investigated and driven** — both open questions answered — and **awaits a ruling, not a build**. ~~**§3 (signal *inputs*) is the only genuinely blocked part**: needs the semantics ruling~~ ✅ **RULED s42 and BUILT s43 `82b33466`** — signal inputs ruled OUT; `run` documented as the Function's only trigger in `NOTATION_RULES` and the picker card. 🔴 **Both surfaces that already described this said the OPPOSITE**, and a spec enforced it: `Node.Signals` is `Javascript2`'s API (which has no built-in `Run`), and a Function body compiles without `Node` in scope at all. Corrected, with the output-side prohibition narrowed rather than dropped. **§1 still awaits ruling 1's build — the teaching diagnostic** |
| FIX-017 ◐ | completions at an empty position; `Noodl.Records.` answers; TASKS.md reconciled | 12 | 3 | S+M+S | **§B BUILT + DRIVEN + AC4 DONE 2026-08-15**: `Noodl.Records.` → **11 methods with signatures, menu rendered**, against controls `Noodl.` → 19 and `Noodl.Nonsense.` → 0/no tooltip (11 specs, control-checked); phase-61 register reconciled, the residue was **prose, not status**. 🔴 **AC3 needs a ruling — its premise is false** (ports and API names never share a prefix, so there is no ranking to control). ⚠️ The "nine live editors" that blocked s19 were **nine MCP servers**; the checkout was free. **§A BUILT `9e8b3198` + DRIVEN 2026-08-15 (s22) — AC1 is ◐, three halves of four:** both modes answer at a statement start (Function → the 5 globals; Expression → `Noodl, Variables, Objects, Arrays, min…`) and ordinary code is **not** smothered (`const x = `, `foo(1, `, `1 + ` all silent). 🔴 **"Appears without typing" is NOT met and §A alone cannot meet it** — `getUpdateType` Activates only on `input.type` or an explicit effect; a cursor landing is `tr.selection` → `Reset`, and no repo file calls `startCompletion`. 🔴 **The trap: `startCompletion` sets `explicit = true`, bypassing §A's own gate — the technique that closed criterion 2 gives a FALSE PASS on criterion 1, and would have been recorded as met.** ✅ Criterion 2 **re-driven on the automatic path with real keys** and stands: 11/11 `Records` methods, identical to the explicit path. ⚠️ **Manual triggers DO exist and were driven working** (Ctrl-Space / Alt-` / Alt-i, leak-controlled) but all take the explicit path and are **invisible in the product** — so the ruling is **discoverability**, and **§D is promoted** from nicety to the only non-ruling route to AC1. ✅ **CLOSED s43 `82b33466` on documentation, per the s42 rulings** — **AC1 accepted** (the triggers fire; Ctrl-Space is OS-bound, which is not ours to fix), **AC3 struck** (the two surfaces never compete in one list). ⚠️ §D remains unbuilt and is **not owed by any criterion**; the OS interception is still unmeasured on a real keyboard |
| FIX-018 ✅ | a component card says it opens; context menu says so too | 13 | 2 | S–M | ✅ **RULED 2026-08-14: option C** — built + driven, **CLOSED** |
| FIX-019 ✅ | "Show in workbench"; the canvas admits when it left the benched component | 14 | 2 | S+S–M | ✅ **CLOSED 2026-08-14** — built + driven 4/4. ✅ **14(a) is CLOSED too — RULED 2026-08-15 (s18): NO sweep.** "workbench" stays scoped to the context-menu label; the bench caption keeps describing the mechanism. The whole user-visible surface was **two strings**, not the docstring sweep this task assumed |
| FIX-020 ✅ | one stylesheet stops fighting the other; five popups uncrop | 15 | 2 | S | no |
| FIX-021 ✅ | project + global memory docs: slice 0 defect now, brainstorm for the loop | 16 | 3 / brainstorm | S+M+session | ◐ **SLICE 0 CLOSED 2026-08-16 (s34), `00f5c629`** — the launcher wizard's `CLAUDE.md` was written before its `docs/` existed, so it shipped with no summary and no *"Where the decisions are"* while the `create_project` twin got both. Fixed by a **guarded re-render** after `writeScopeDocs` (the ordering is deliberate and kept): it rewrites only when the bytes match what creation wrote, so a template's file or a one-character user edit is left alone. 7 specs incl. the acceptance criterion **as a byte equality** against the MCP twin. 🔴 **Slices A and B and the six memory rulings are untouched — still yours** ~~🔴 **Slices A and B and the six memory rulings are untouched — still yours**~~ ✅ **CLOSED 2026-08-18 (s63) — the sentence above is STALE.** Slice B built s58, driven s59; **slice A RULED OUT at s42/s61 (Q2: one file), not deferred** — proposing it is proposing to overturn a ruling. Q5 → `always`, 2,000-char cap, free when empty; Q6 → prose only. 🔴 **Driven in TWO halves and both were needed.** MCP **server** end 4/4 (s62) over real stdio: absent with no env var, absent with the pristine seeded template, **present** with headings answered, present on a read-only server — the third row is what licenses the two absences, and row 4 settles Richard's `allowWrites` ruling by drive rather than by reading. **Editor** end 3/3 (s63): `Connect Claude Code` clicked on the real launcher, then the **real `~/.claude.json`** read — `NODEGX_USER_PREFERENCES` written, pointing at a file that exists. 🔴 **The load-bearing observation is the CONTROL: `ELECTRON_RUN_AS_NODE` is still there beside it.** A registration that replaced the env record instead of extending it passes any probe checking only the new key, and leaves a server booting a GUI app with a dock icon (BST-004/F80). 🔴 **Two corrections to the handovers.** Connect is on the **launcher** (`[data-test=connect-agent-card]`, button `[data-test=connect-agent-connect]`), **not** the settings panel — `McpSettingsSection` has no Connect button at all. And **the MCP `open_project` tool does NOT write `.mcp.json`** — driven, it bound the project and wrote nothing, while `create_project` wrote the file carrying both keys. 🔴 **Scope that claim carefully: there are TWO writers in two packages.** The MCP one inherits the variable from its environment; the **editor** backfills on project open (`LocalProjectsModel.ts:142` → `models/template/agentConfig.ts`) and reaches the path via the **front door** instead. The MCP tool's silence is deliberate consent design (`openProject.ts:30-42`), **not** a FIX-008 regression. ⚠️ **Only the MCP writer is driven; the editor writer is spec-covered (`tests-unit/mcp-001/mcpCommands.test.ts:362`) and never driven** — carried, not owed. 🔴 **Both of this session's wrong turns were BOUNDED greps reported as absences** — `exactly one caller` was true only within `packages/noodl-mcp/src`. ✅ **A negative control the server half lacked** — same binary with the variable stripped writes `env` with `ELECTRON_RUN_AS_NODE` alone, so the arms disagree and the value demonstrably tracks the registration rather than a hardcoded path. ✅ Richard's files left correct: `PREFERENCES.md` untouched (`sha1 c3c8425950` — **sha1, not md5**), `~/.claude.json` **not** restored wholesale but compared section-by-section (only `nodegx` changed) |

| FIX-022 ◐ | does the planner over-decompose? the half FIX-006 could not reach | — | 3 | S (measured) | ◐ **MEASURED 2026-08-16 (s41)** — the report's *first* complaint (a Script node **inside a component that should not have existed**) is the planner's call, not the authoring loop's. New instrument: `scripts/aix002-measure/plan-harness.ts`, the real `PlanningSession` against the real corpus, grading the plan (structured data, so a count and a list of names). ✅ **The defect is real: 5/10 plans for a single derived value create a component for it**, against `DECOMPOSITION_PLANNING`'s own §"WHEN NOT TO FACTOR". 🔴 **AAQ-008's doctrine is NOT the cause — the pre-AAQ-008 prompt scores 6/10.** The control arm reverts **both** halves of `251a90f2` (the block *and* the bullet that cross-references it by name), so it is a prompt that actually shipped rather than one with a dangling reference; 13 specs in `test:main` hold that, **7 red under a stubbed transform**. 🔴 **An n=3 cell read 3/3 vs 1/3 and would have been published as "the doctrine causes it"** — see §5, the finding most likely to matter outside this task. ⚠️ **The positive control has a ceiling** (both models factor `multi-section` unprompted), so the doctrine's *benefit* is undemonstrated here rather than disproven. ~~🟢 **One ruling owed**~~ ✅ **RULED s42: no numeric floor — the axis is REUSE, not size**, which retired *"5/10"* as a **measurement** and left it an upper bound. ✅ **RE-GRADED s43 `82b33466`, no API calls: 11/11 creating plans place the component EXACTLY ONCE**, one parent, one site — so the rate survives on the reuse axis and the defect is real. 🔴 **The missing control prices any fix**: no arm contains a request where reuse is genuinely available, so nothing here would notice a rule that damaged deliberate single-node reuse |
| FIX-023 ✅ | one typeless node kills the whole project's write surface | — | 1 | S+S | ✅ **BUILT + DRIVEN s49 — all 5 AC met.** Fixes **A + B + C together** (C never alone): a guard at the load boundary (`normalize.ts`, **both** the v2 *and* the legacy/in-memory paths), a new `malformed-node` **error** rule registered 2nd in `ALL_RULES` naming the node id and component path **in the message**, and `isComponentRef` widened to `string \| undefined \| null` for the raw-file walkers. ✅ **Driven on a real MCP server over stdio, 2 arms × 2 tools over byte-identical project copies**: OLD bundle throws on **both** `validate_project` and `create_component`; NEW bundle returns `1 error / 1 warning` and `"created": "Fix023 Probe"`. ✅ **AC5 measured properly — 54 of 56 targets identical *diagnostic-for-diagnostic*, and the only 2 that changed are the affected project and its copy.** ✅ **Spec mutation-checked: 10 of 11 fail with the fixes reverted.** 🔴 **Three corrections to the scoping** — it was **never MCP-only** (the shared validator crashed, so `npm run validate:project` did too); the guard existed in **2** call sites not one, with ~17 unguarded, **seven in the editor's own rules**; and the corpus is **56** project dirs, not 28. ⚠️ **The repackage is still owed** — Richard's server loads the Aug-13 app and keeps crashing until then. **Not a regression — do not bisect.** |
| [FIX-024](FIX-024-THE-LAUNCHER-OPENS-ON-LEARNING.md) ✅ | the launcher opens on the Learning section, not on your projects | — | 2 | XS | ✅ **BUILT + DRIVEN 2026-08-17 — all 5 AC met.** Richard, using the app: *"you should see your projects first when you open the launcher."* D5's Learning section moved out of the Projects view into its own header tab (`views/Learning.tsx`); the section itself is unchanged. 🔴 **The tab affordance already existed** — `HEADER_TABS` in `LauncherHeader`, with persistence and a deep-link parser — so this was one table entry plus a view, **not** phase 37's project tabs arriving early. 🔴 **The trap is the naming: `'learn'` and `'learning'` are two different pages** — `'learn'` is POL-002's *retired* lesson catalogue, kept compiled and reachable from nothing, and reusing that id would have put the dead catalogue behind the live tab. `isValidPageId` is the one place a **stored** string picks between them, so the spec asserts **both** directions (accepts `'learning'`, still rejects `'learn'`); a spec checking only the first would pass with both accepted. ✅ **Consequence driven, not just the mechanism**: `H1 Recent projects` at y=81 with cards on screen, and the learning-section selector **absent on Projects while firing on the Learning tab**, which is what makes the absence evidence. ✅ **3 specs in `test:main`, control run 1/3 red.** ⚠️ **noodl-core-ui cannot be eslinted at all** — `eslintConfig` extends an uninstalled `react-app`; every file in the package fails identically, confirmed against an untouched control. Pre-existing, unowned |

## Suggested order, and why

**Tier 1 first — each is a daily-use papercut or an AI-trust breaker, and none depends on a big
ruling.** FIX-007 (the prefix) and FIX-008 (the binding) are the two that make the AI story look
broken to an outside user; both have small, fully-pinned first slices. FIX-001/002/003 turn the
"explain this node" feature from a demo into the beginner tool the report describes — 002 and 003
are small and can land while 001's live-value layer is built. FIX-020 and FIX-010 are afternoon
fixes with screenshots for acceptance; do them early for momentum and because the popup clip
touches five surfaces users hit constantly.

**Then the bench trio (FIX-011/012/013) as one sitting.** They share files, share the chrome
strip's 30px (011 and 019 both want it — decide the strip once), and 013's rulings shape what 011
has to lay out. FIX-019 rides along.

**The Blockly pair (FIX-004/005) as one sitting** — same package, same specs, and FIX-004's
dropdown-shaped conversion block wants FIX-005's readable dropdowns.

**FIX-006/014 together** — both edit the authoring prompts and both are graded by re-running the
same live build request.

**FIX-009, 016, 017 anywhere** — independent, small-to-medium, no cross-coupling.

**The two brainstorm tasks (FIX-015, FIX-021) need Richard, not an agent.** Schedule the
rulings sittings from the README's queue; the style-token session is the long one and its output
is a new phase, not code in this one. FIX-021's slice 0 (the degraded launcher CLAUDE.md) is an
ordinary S fix and should not wait for the brainstorm.

**FIX-018 is ruled and buildable now:** Richard validated **option C (chip + stacked card)** from
the mockup artifact on 2026-08-14 — it can join Tier 1's early wins.

## Two things to check before starting any task here

1. 🔴 **Reproduce the report.** Five of sixteen premises were wrong or already-built (README §
   "premises found FALSE"). Three tasks carry an explicit reproduce-first / verify-live step
   (FIX-007's artefact grep, FIX-010's devtools read, FIX-016's drive) — do it before coding.
2. ⚠️ **Gates before and after:** `test:main` + `test:ci` (compare names, read
   `tests/test-results.json`), `tsc --noEmit`, and for anything touching the catalog (FIX-007)
   the catalog trio + the MCP suite. One live session owns the editor at a time.
