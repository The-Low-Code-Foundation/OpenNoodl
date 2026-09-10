# Defects the field report found — phase 84 register

Per [PHASE-EXECUTION.md](../../guidelines/PHASE-EXECUTION.md):

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.
> Otherwise it is filed here with an owner, and the next session builds the next task.**

🔴 **Every row carries an owner or the literal word `NONE`, and a disposition of `BLOCKS <AC>` or
`BACKLOG`.** An unowned row gets rediscovered at full price. Say what was **measured**, with the
instrument, not what was concluded.

## 1. Found while scoping — not in any issue

These came out of re-measuring the issues. **None of them is an open GitHub issue.** Two are more
serious than most of what is filed.

| id | what was measured | owner | disposition |
|---|---|---|---|
| N1 | 🔴 `componentPathFromRelativePath` (`ProjectFileWatcher/decide.ts:41-57`) returns `null` for every non-component path, and `saveProjectLevelFiles` (`ProjectStructure/index.ts:391-417`) writes unconditionally against its own in-memory hashes. The MCP store writes `nodegx.project.json` at `ProjectStore.ts:164`, `:190`, `:234`. **Read from source; not driven.** | **FLD-009** | **BLOCKS FLD-009 AC1** |
| N2 | 🔴 `noodl-runtime/src/node.ts:135` seeds a units port as `{value, type: defaultUnit}`; `:402` reads `.unit`. Present since `b9c60b07d`. Found independently by two research passes, from #26 and from #22 | **FLD-004** | **BLOCKS FLD-004 AC4**, and FLD-003 |
| N3 | 🔴 `withCreationDefaults` (`noodl-mcp/src/tools/author.ts:164-177`) returns a node unchanged when its id is already in the component, and the `set` door replaces the node list wholesale (`:647`). **An agent re-sending its own graph reverts every server-added creation default and seeds only the new node.** Reproduced: setting `useLabel` on the last radio only emits the reporter's exact markup byte-for-byte | **NONE** | BACKLOG — **this is the real defect behind [#25](https://github.com/The-Low-Code-Foundation/NodeGX/issues/25); it deserves a task** |
| N4 | `nodegx-export/tests/visual-controls.test.ts:319-357` asserts the `<label>` wrapper for the **checkbox** (`:320-322`) and, for the radio (`:337-341`), only the group name and `defaultChecked`. The label assertion the radio needed is the missing one | **NONE** | BACKLOG — closes with N3 |
| N5 | The emitter demands `useLabel === true` (`emit/component.ts:5092`) while the runtime accepts any truthy (`RadioButton.tsx:105`). A `"true"` string renders a label in the app and none in the export. All 538 local values are proper booleans, so **latent, not observed** | **NONE** | BACKLOG |
| N6 | `emit/component.ts:5092` uses `effectiveLiteral` (catalog-default fallback) while `emit/style.ts:859` uses `literal` (no fallback) for the same flag — if a catalog default flipped, JSX would emit a `<label>` with no wrapper class | **NONE** | BACKLOG |

## 2. Reframed — filed against something other than the defect they describe

🔴 **These are not in this phase's fifteen.** Each needs a reply saying what we measured, and three
of them hide a real gap that is smaller or different than the issue claims.

| id | issue | what re-measurement found | owner | disposition |
|---|---|---|---|---|
| C25 | [#25](https://github.com/The-Low-Code-Foundation/NodeGX/issues/25) | Not an export bug. The emitter branch is per-node with no last-child logic and is faithful to a flag that defaults false. The real defect is **N3** | **NONE** | BACKLOG — reply owed |
| C27 | [#27](https://github.com/The-Low-Code-Foundation/NodeGX/issues/27) | No mechanism found. `registerInput` **throws** on a real duplicate (`node.ts:124-127`), so a collision would be loud; the corpus has **zero** instances across 67 examples; and the second example cannot exist — no catalog node has both `size` and `color`. Most likely #26 wearing a different hat | **FLD-004** | BACKLOG — 🔴 **re-measure against the reporter's project after FLD-004 lands, before building `input-shadows-root-port`** |
| C30 | [#30](https://github.com/The-Low-Code-Foundation/NodeGX/issues/30) | The handler exists (`autoupdater.js:351`) and is tested; `setupAutoUpdate` returns early on Linux at `:179-181` **with a comment explaining why**, and the renderer's catch is deliberate (`useUpdateState.ts:72-75`). The real gap: **Linux has no update-notification path at all** | **NONE** | BACKLOG — reply owed; re-title, don't close |
| C34 | [#34](https://github.com/The-Low-Code-Foundation/NodeGX/issues/34) | "Only `value` plus min/max" is **false**: 34 inputs including `flexDirection` and `cssClassName` (the latter comes to every React node at `react-component-node.ts:1024-1045`), against Group's 94. Genuinely missing: `rowGap`/`columnGap`, `alignItems`, `justifyContent`, borders, shadows, backgrounds — and those are **not in a mixin**, they are inline in `group.ts:270-375` | **NONE** | BACKLOG — the clean shape is extracting `addFlexInputs` and calling it from both |
| C13 | [#13](https://github.com/The-Low-Code-Foundation/NodeGX/issues/13) | The mechanism asked for **already exists and gates every PR** (`pr.yml:87`). Real parser count is **582**, not ~556, with **526 in noodl-editor** and a large slice in test files | **NONE** | BACKLOG — per-package floors, not a big-bang |

## 3. Ready to close — replies owed

| issue | verdict | evidence |
|---|---|---|
| [#9](https://github.com/The-Low-Code-Foundation/NodeGX/issues/9) | Fixed | `author` carries an RFC-5322 name+email; fixed in `ee6223c3c`; the Linux release leg has shipped `.deb` since |
| [#12](https://github.com/The-Low-Code-Foundation/NodeGX/issues/12) | Done | `.nvmrc` 22, root and editor `engines >=22.0.0`, `nodegx-backend >=22.13.0`, CI on `.nvmrc`, Electron 43 bundles Node 22 |
| [#1](https://github.com/The-Low-Code-Foundation/NodeGX/issues/1) | Fixed | `dbmodelcrudbase.ts:994` (unset target means `user`) and `:1013` (an unresolvable user contributes nothing rather than a literal `undefined` key). One mixin, so Create **and** Set Record Properties. Arms at `nda-012-data-record-family.test.ts:159-231` |
| [#15](https://github.com/The-Low-Code-Foundation/NodeGX/issues/15) | Obsolete | `AiAssistantStore.ts:57-70` migrates `full-beta → openai`; the page was rebuilt around a provider picker; verify is now a real `GET /v1/models`; keys moved to OS encryption |

## 4. Passing findings — measured, not chased

| id | what | owner | disposition |
|---|---|---|---|
| P1 | 🔴 `visible` (`nodegx-render-measure/src/index.js:124`) tests `offsetParent` and ignores `opacity`/`visibility`. Four other rules inherit it: `elements-overflowing` (`:127`), accent area (`:272`), rhythm bands (`:315`), `single-column-grid` (`:352`) | **FLD-012** | BLOCKS FLD-012 AC3 |
| P2 | A full-width Slider's `<input>` is `width:100%`, height ≥ 8, so it qualifies as a **band** and pollutes the vertical-rhythm spacings | **FLD-012** | BACKLOG |
| P3 | `validation/queryBeforeFilter.ts` fires only on `DbCollection2`, **not** on `noodl.cloud.aggregate`; and the aggregate node has no `runOnValueChange` gating, so it fetches at graph-build time | **NONE** | BACKLOG |
| P4 | `utils/electron/appFocusTimer.ts` is `@deprecated` with **zero call sites** | **NONE** | BACKLOG — delete |
| P5 | `.github/workflows/test-platform-node.yml:30` uses `actions/setup-node@v2` where every other workflow uses the shared action | **NONE** | BACKLOG |
| P6 | `nodegx-export/src/ledger.ts:83` docstring says "97 of the 127"; the computed values are `pickerCoverageFloor: 117` / `pickerCoverageTotal: 127` | **FLD-013** | BACKLOG |
| P7 | The Columns runtime uses a strict `<` where the exported `@container max-width` is **inclusive** — the two disagree exactly on a boundary value | **FLD-002** | BACKLOG |
| P8 | `relay-token` is written (`relay-token.js:69`) and **never unlinked on quit** — a stale file authenticates nothing and proves nothing about a live editor | **FLD-010** | BLOCKS FLD-010 AC4 |
| P9 | 🔴 `WIRED_STYLE_SINKS` (`emit/style.ts:270-274`) has three entries, so a wire into `width`/`height`/`paddingTop`/`borderColor` is never visited and never reported. **Phase 83's HLS-005 owns this table** | **HLS-005** (phase 83) | 🔴 **COLLISION — agree the owner before FLD-015 touches it** |
| P13 | 🔴 **FLD-005 and phase 81's VIB-005 are the same defect in two phases.** V1 is `🔴 open` at `phase-81/README.md:173` with owner **VIB-005** (`:149`), listed `⬜ startable now` in phase 81's handoff, owning **V1/V2/V14/V17/V21/V38** (`NEXT-SESSION-PROMPT.md:73`). ⚠️ An earlier reading of this attributed V1 to REL-002a in phase 82 — **wrong**: REL-002a's *"Registered, not built"* (`:211-226`) registers an inert `scrollEnabled` and records `clip: true` as NOT REPRODUCED, both owner `NONE` | **FLD-005** | 🔴 **COLLISION — resolve ownership before building; do not build both** |
| P10 | This checkout carries ~16 MB of stray macOS duplicate dirs under `noodl-editor/src/external/` (`deploy 2/`, `viewer 3/`, `ssr 3/`, `cloudruntime 3/`). Gitignored, but `build.files` includes `"src"` wholesale | **FLD-017** | BACKLOG — delete locally |
| P11 | `components/_registry.json` is written by `ProjectStore.ts:559` and is excluded from the watcher by the same `parts.length < 3` test as N1 | **FLD-009** | BACKLOG |
| P12 | The three runtime copies under `src/external/` total **~46 MB**, not the ~4.8 MB the issue estimated | **FLD-017** | BACKLOG |

## 5. Replies owed — the phase does not close until this table is empty

The end condition in [README.md](./README.md) §6 is that the reporters have been **told**. A fix
nobody was told about gets re-reported.

| issue | reporter | owed | sent |
|---|---|---|---|
| #9 | @nikdjukic | close as fixed, naming the commit | ⬜ |
| #12 | @SgtSpork | close as done, naming the evidence | ⬜ |
| #1 | @richardosborne14 | close as fixed; mention the second bug found on the same path | ⬜ |
| #15 | @echelonsoftdm-source | close as obsolete, with what replaced it | ⬜ |
| #5 | @VitoMinheere | the one-line cause **and** where to patch a lesson — both halves, asked in 2024. 🟢 **Fixed `4068d139`**; draft reply in [FLD-007 §4c](./FLD-007-A-LESSON-STEP-THAT-CAN-BE-COMPLETED.md) — ready to send | ⬜ |
| #14 | @theMeysam | the `and:` rewrite that unblocks them **today**, plus the swallowed-error fix | ⬜ |
| #25 | @dishant-kumar-thakur | it is not the emitter; it is N3 | ⬜ |
| #27 | @dishant-kumar-thakur | no mechanism found; re-measure after FLD-004 | ⬜ |
| #30 | @dishant-kumar-thakur | the handler exists; the real gap is Linux | ⬜ |
| #34 | @dishant-kumar-thakur | 34 ports, not 5; the real gap is gaps and borders | ⬜ |
| #13 | @SgtSpork | the ratchet already gates every PR; the count is 582 | ⬜ |
| #37 | @dishant-kumar-thakur | the field as asked would have read green on `Circle` | ⬜ |
| #40 | @dishant-kumar-thakur | screenshots are per viewport, not per page | ⬜ |
| #43 | @dishant-kumar-thakur | inputs are majority camelCase; the round-trip pair is the sharper bug | ⬜ |

## 6. Rows this phase found

Every row carries an owner or **NONE**, and stays open until someone closes it. A row with no owner
is one that gets rediscovered later at full price.

| id | what | found by | owner |
|---|---|---|---|
| P14 | 🔴 **The launcher's "New project → Quick Start" hangs.** Name typed, location defaulted to `~/vscode_projects/NodeGX test projects`, "Create Project" clicked: the button's spinner runs indefinitely, **no project directory is created**, no error is shown to the user, and nothing reaches `.logs/dev.log` or the renderer console. Reproduced twice on `cline-dev` HEAD (`11b2d3a9`). `handleCreateProject` (`ProjectsPage.tsx:801`) only opens the wizard, so the failure is downstream in `handleCreateProjectConfirm`. **This is the front door for a first-time user.** | FLD-001 drive, 2026-09-09 — it blocked AC1 until worked around by seeding a recent-projects entry against a copied project | **NONE** — deserves a task |
| P15 | The component context menu offers **no "Make Home"** for either a page component or `App`, while the viewer's own error page reads *"No HOME component selected — click Make home as shown below"* and shows a picture of that menu item. `ComponentItem.tsx:240` gates it on `component.isPage \|\| component.isVisual`, and the menu that rendered was the folder-shaped one (`Create Folder / Open / Show in workbench / Rename / Duplicate / Move to… / Delete`). A project whose root node is unset therefore has **no route out through the UI** — the drive had to set `rootNodeId` in `project.json` by hand with the editor closed. ⚠️ Note `makeComponentHome`'s own docstring already records this gesture having been inert once before, for a different reason | FLD-001 drive, 2026-09-09 | **NONE** |
| P16 | `NodeContextMenu.ts:179` builds "Add new child" with `parentModel: editor.highlighted ? editor.highlighted.model : undefined` — the **hovered** node, not `selectedNodes[0]`, which is what the menu item's own guard (`:167-172`) tested. If the pointer is not over the node when the item is clicked, the new node is added to the root instead of as a child, silently. **Read from source; not driven** — the drive parented nodes by dragging instead | FLD-001, reading the path AC1 needed | **NONE** |
| P17 | 🔴 **Hash routing defeats every `viewerpatheq` condition, before and after FLD-007.** `navigationPathType` defaults to `'hash'` (`noodl-viewer-react/src/nodes/navigation/router.tsx:806-812`), which compiles a URL as `?query#/page` — fragment last, query first. The editor's route is everything after `http://localhost:<port>`, so a hash-routed project reports `/#/task-page`, which no authored condition matches; stripping the fragment would yield `/`. All seven hosted lesson projects set `navigationPathType: 'path'`, which is the only reason the verb works at all. The fix is to read the fragment as the path when the project is hash-routed — **a lesson authored against a hash-routed project cannot be graded on the route today** | FLD-007, 2026-09-10 — read from source while fixing the truncation; **not driven** | **NONE** |
| P18 | 🔴 **Six of the eight shipped lesson route-conditions were passing on a race, not a comparison.** `CanvasView` had two writers for `window.noodlEditorPreviewRoute` — truncating on `load-commit`, untruncated in `setCurrentRoute` — and a step phrased *"select the /X path in the Path Dropdown"* ticked because `setCurrentRoute` emits `viewer-navigated` synchronously (`EditorDocument.tsx:199-205`), so `lessonlayer2`'s refresh (`:171`) read the full route before `load-commit` clobbered it back to `''`. FLD-007 removed the divergence by putting both writers on `previewRoutePath`. **Registered because the shape recurs**: a global with two writers and two meanings reads as a passing test until the timing moves | FLD-007, 2026-09-10 — the sweep AC3 asked for | **CLOSED by FLD-007** (`4068d139`) |
| P19 | `getRelativeURL` returns `undefined` when a page has no `path` parameter (`router.tsx:610-611`), yet **every** `Page` node in all seven hosted lesson projects has `path: undefined` and their routes plainly work — so the default is supplied somewhere this reading did not find. Harmless today; noted because a reader of that function alone would conclude the lessons cannot navigate, which is the kind of wrong model that costs an hour later | FLD-007, 2026-09-10 | **NONE** |

⚠️ **P14 and P15 are both about a project that does not exist or cannot render**, and both were hit
inside twenty minutes of trying to do the most ordinary thing in the product. Neither is in any of
the fifteen issues, because the field report's agent drove an **existing** project through the MCP
and never opened the launcher.

