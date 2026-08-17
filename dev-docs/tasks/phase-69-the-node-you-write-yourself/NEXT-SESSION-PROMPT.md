# Phase 69 — next session

**Written 2026-08-17, session 16.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s16 built CN-008** — the authoring
loop now names a project's own kits. **CN-009 is the natural next build, and s16 measured that two
of its five acceptance criteria are already met; see §4.**

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-018**, **CN-019** | ✅ | ✅ | Closed s13 / s15 |
| **CN-007** | ✅ s14 | ✅ s15 (D8) | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ **s16** | ⚠️ **AC1 needs a live model** | §1, §2 |
| CN-006b, CN-009 … CN-017 | 📋 | — | **CN-009 next** — §4 |

**Nothing in this phase is blocked on a running editor**, and nothing is blocked on a decision.

---

## 1. 🔴 The one lesson from s16

**A spec clause that selects nothing passes every mechanical acceptance criterion.**

CN-008 said to include *"the ports an instance would actually set — the inputs with no default"*.
**That selector matches zero ports on either kit in this phase**, because a kit author declares a
`default` on essentially every port and ✅ **D8** pushes them harder that way.

Had it been followed literally, the handout would have printed a heading, a kit name and a node name
per node with an **empty list under each** — and AC2 (byte-identical without kits), AC3 (in the
cache-stable half) and AC4 (charged through `charge()`) would all still have passed, because none of
them looks at whether the block *says anything*. Only AC1 — the live-model consequence, the one
criterion that cannot be run headlessly — would have caught it.

✅ **Before implementing a selector a spec hands you, run it over the real data and count what comes
back.** It cost one `filter` and it is now pinned as a test, so re-introducing the clause fails.

⚠️ This is the same shape as CN-007's retired observation O3 (s15) and CN-006's AC4 false pass
(s9): *the mechanism fired, so the feature looked delivered.*

## 2. ✅ What s16 built and measured

`AuthoringContextBuilder.nodeKitOverview()` + a `THIS PROJECT'S NODE KITS` block in the cache-stable
half immediately after the catalog, wired at both `AuthoringSession` call sites. **17 tests, 7/7
mutations killed.** Full editor jest: **3555 passed / 229 suites**.

Three findings worth more than the feature, all in
[CN-008](CN-008-THE-AI-CAN-USE-YOUR-NODES.md):

1. 🔴 **The task's problem statement was false.** "The AI does not know the lane exists" — **it
   does.** A kit node is `inNodePicker`, so `catalogOverview()` already named it and
   `nodeTypeDetails()` already rendered its full ports and defaults. What was missing is
   **attribution and salience**: it arrived buried in an alphabetical run of ~30 names on the
   `- Visual:` line, with **no kit named anywhere in the prompt**. That is why the handout names
   ports rather than describing them — describing them pays twice for the half that was never broken.
2. 🔴 **`docs` is one field over two vocabularies.** On a **shipped** catalog node it is a **URL**:
   158 of 175 built-ins carry one and **158 of 158 of those are `https://docs.noodl.net/…`; zero are
   prose.** On a **kit** node it is prose. Reading the field without splitting the two puts a link
   where a summary goes on 158 node types.
3. ✅ **A real defect fixed in passing.** `renderNodeType` sourced its summary from `enrichedNode()`,
   which is generated at repo-build time and keyed by type name — **a kit type can never be in it**.
   So the author's `docs` string was carried all the way into the overlay by `@nodegx/kit-catalog`
   and then **dropped**, and every kit node reached the model with a heading, a placement line and no
   statement of what it is for.

⚠️ **The inherited-port exclusion is a named set, not a derived one, and that was forced.**
Intersecting the shipped catalog's visual nodes gives the **empty set** (`Component Children` is a
visual node with zero inputs); intersecting the project's own kit nodes also swallows `radius`,
which both demo-kit authors declared and both meant. The gate asserts **containment** against the
recorded payload — it catches the runtime *dropping* a base port, not *adding* one.

## 3. ⚠️ What CN-008 does NOT close

- 🔴 **AC1 is the consequence and is not met.** It needs a live model in a project with the cashflow
  kit. Everything asserted so far is mechanism, and AC1's own wording says mechanism *"would be
  equally true of a broken feature"*. ⚠️ **`cp -R` the project first** — the Build composer authors
  on a one-character prompt and `ed.undo()` does not undo an AI apply.
- **A session captures its catalog at construction**, so a kit scaffolded mid-session is not in that
  session's handout. That is CN-014's measured behaviour, not a new defect — answered rather than
  left open.
- **The scaffold still emits no `docs` key**, so absent is the *common* case and is rendered as
  omission. Making CN-006's scaffold emit one is the P2-shaped fix and is left to that task.

## 4. ✅ CN-009 is next — and s16 measured that two of its ACs are already met

Same shape as CN-004, where items 1–3 turned out to have been done by CN-003. Measured today:

- **`src/catalog.ts` in `noodl-mcp` carries the same overlay mechanism as the editor**, so
  `list_node_types` and `get_node_type` already answer about kit types. `tests/kitTools.test.ts:97`
  already asserts exactly that, through CN-003's headless extractor.
- **`get_project_info` already reports kits** — `kitsReport()` in `src/tools/read.ts:83`, with
  modules, their node types, collisions and failures.

So **AC1 and AC2 are substantially built**; what is left is **provenance marking on
`list_node_types`' rows**, **`find_tools` matching kit names and `docs`**, AC4 (a no-kit project
unchanged) and AC5 (the drive). ⚠️ **Confirm this rather than inherit it** — s16 measured that the
catalog carries the overlay and that a test asserts the resolution; it did not run `list_node_types`
and read a provenance field off a row.

✅ **The token margin, re-measured on a passing run today, not relayed:**

```
[surface] 8223 tokens / 20 resident tools — 57 under the 8280 budget
```

The task file's numbers are still accurate. 🔴 **The renegotiation condition is binding**: the gate's
own note says there should not be a third, and **CN-009 is the next one** — the sanctioned move is
the `$ref`ed node schema, not a higher bar.

## 5. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and only ONE copy is tokenised.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate — while
`cn001-kit-drive` and `cn019-drive` still carry the pre-D8 kit (0 × `var(--`, 6 × live `#1F8A4C`).
**Driving the wrong copy reads as "the change did not land".** D5 makes CN-007 depend on this kit
staying working and nothing enforces it. **Still wants a task number.**

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.
Vocabulary gap, not a kit problem; it will recur.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string. One eval with a project open.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (`notes/cn019-driven.png`).

⚠️ **From s12, still unmeasured:** `NodeLibraryImporter.mergeInByName` replaces a group **wholesale
by name** (`NodeLibraryImporter.ts:366-388`). Wants a look if CN-013 is picked up.

## 6. Owed by Richard

Unchanged from s7–s15, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (8) and runs in no CI
   job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
   ⚠️ `typecheck:runtime` is red at 2, proven pre-existing. ⚠️ `typecheck:core-ui` reports **44
   `TS2307`s**, cause unidentified — s13 guessed and the guess was wrong.
3. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens out of the same
   57. `tests/kitTools.test.ts` has the control that fails when it changes.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends.

## 7. Checkout conditions

- ✅ **No editor launched, nothing torn down.** s16 was entirely headless — no CDP, no stack, no
  `dev:stop`. Nothing of mine is running.
- ⚠️ **s16 edited three editor SOURCE files**, all on the AI authoring path and all inside the
  editor's webpack entry: `ContextBuilder.ts`, `prompts/authoring.ts`, `AuthoringSession.ts`
  (plus a new `tests-unit/cn-008/`). **No peer was messaged.** `ps` showed no `test:ci`, no
  SpecRunner and no `run-electron-tests` in flight at any edit; the only concurrent run was a peer's
  `jest` in **`noodl-core-ui`**, which no webpack of mine touches. A 22-way broadcast was judged to
  be the noise Richard has asked to be curbed. **If a peer reports an odd editor bundle between
  roughly 09:30 and 11:00 on 2026-08-17, this is the candidate.**
- ⚠️ **One flaky failure, and it was not mine.** A full `npx jest` run showed
  `tests-unit/bld-004/reasoningChannel.test.ts` failing on a wall-clock stall deadline
  (*"nothing arrived for 0 seconds"*) while a peer's jest was running. It passed 3/3 in isolation and
  **green on a second full run (3555 / 229)**; it imports only the AI client and `turnDeadline`, none
  of the modules s16 touched.
- ✅ Gates run: `noodl-editor` **full jest 3555 passed / 229 suites**; `noodl-mcp`
  `toolDisclosure` + `kitTools` + `kitOverlay` green.
- 🔴 **`test:ci` was NOT run.** The floor still stands where s12 left it (`2843 / 6 @ 39393`).
  **Re-measure before quoting it**; s13–s16's commits are not in it.
- ⚠️ **Peer work is live in the tree and was not touched**: `noodl-core-ui/src/components/code-editor/*`,
  `scripts/library/check.ts`, `dev-docs/tasks/phase-50-*`, `phase-65-*`, `phase-68-*`. s16 committed
  **only its own pathspecs**.
- ✅ **`git commit -F <file> -- <pathspecs>`, always.**
- Whoever you tell you are starting, tell you have stopped.
