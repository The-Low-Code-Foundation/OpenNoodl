# Phase 83 — Everything That Ships It Is Behind A Click

**Scoped:** 2026-09-09, from two community issues and a scoping sweep against `cline-dev` HEAD.
**Status: OPEN. HLS-001 (s2), HLS-002 (s3), HLS-003 (s4), HLS-004 (s5) and HLS-005 (s6) built, all 2026-09-09 — see each task's `-WHAT-WAS-BUILT.md`. `nodegx export` exists, both front doors are proved byte-identical, the export reads the graph the author saw, **the exported app now builds**, and **the report no longer says "nothing left over" when something was** — the rule that decided whether a binding was emitted is named, and every binding no builder took is now refused loudly. 5 of 14 built, 21 acceptance criteria closed. HLS-012's replies are drafted and await Richard.** **Prefix: `HLS`.** **Release: ⬜ NOT RULED** (see §2; R2–R5 are now ruled).

Everything that *makes* an app in NodeGX is already headless and, by the reporter's own account,
better than in tools designed for it: create, author, validate, render, preview. Everything that
*ships* it is behind a click. That is the whole phase.

> "Score: 5 of 9 for my use case. And the gap is not architectural." — @dishant-kumar-thakur,
> [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36), 2026-09-08

> "I was looking for a cli for continuous deployment… I tried to look into the library code I found
> but there is nowhere an implementation of the build command. Am I just blind or is this feature
> missing in the open sourced code?" — @dominikstohl,
> [#11](https://github.com/The-Low-Code-Foundation/NodeGX/issues/11), **2025-04-16**

He was not blind. It is missing, and **nobody has answered him in seventeen months.** That is
HLS-012, and it is the first thing this phase does.

## 1. The person sentence for the whole phase

**A person who has never opened the editor ships a NodeGX app from a GitHub Action: the workflow
runs `nodegx export`, then `npm ci && npm run build`, and the built site is what the author sees on
the canvas.**

Every acceptance criterion in this phase is checked against that sentence. Note what it contains
that the issues do not: **`npm run build` succeeding** (it does not today — #24), and **the export
matching the canvas** (unmeasured — §4 finding 5).

## 1b. What this is actually for — the lifecycle, as a thought experiment

🧭 **Raised by Richard, 2026-09-09, explicitly as a thought experiment:** an agent manages the whole
life of an app through the MCP server — build, deploy, updates, cloud functions — and the person
never opens the editor at all.

**It is worth stating here, because it reorders this phase without adding much to it.** Most of the
lifecycle is already the phase's spine: author (exists), export (HLS-002), ship (HLS-008), serve
(HLS-006), look (HLS-007), and it appears in the editor when a human wants it (HLS-009). The thought
experiment mostly gives those a reason to be one thing rather than six.

But it changes two judgements, and it found one hole:

- 🔴 **It moves `deploy` from optional to load-bearing, which raises R4's stakes.** A phase that ships
  `export` and no `deploy` still leaves the person opening the editor once — to press Deploy. Under
  this framing that single click is the whole failure. HLS-010 stops being "spike a legacy command"
  and becomes **the gate on whether the lifecycle is possible at all**.
- 🔴 **Cloud functions have no headless door anywhere, and nobody had noticed.** Measured 2026-09-09:
  the only deploy is `WorkflowDocument.deployFunctions()`
  (`models/workflow/WorkflowDocument.ts:465`), reached from exactly two places — a property-editor
  action (`WorkflowTypes.ts:568`) and a button on the component trail
  (`CloudFunctionTrailStatus.tsx:127`). **Both are UI.** Meanwhile the MCP server already provisions
  a backend (`provision_backend`). So an agent can create the backend and cannot put a function on
  it. **Any app with a backend — which is every app worth deploying — cannot be shipped headlessly
  today, and no task in the original scope touched it.** That is HLS-013.
- ⚠️ **"Updates" is a second deploy, and nothing here covers deploy number two.** Every task above
  describes the first one. Redeploying over a running app is an idempotency and diffing question
  with its own failure modes, and an agent doing it unattended is the case with nobody watching.
  That is HLS-014.

🔴 **What this section deliberately does NOT do is promise the lifecycle.** The end condition in §6
stays exactly as written. HLS-013 is in scope because it is a measured hole on the critical path;
HLS-014 is scoped and **gated on R4 and HLS-010's verdict**, and does not start before them. If the
lifecycle wants more than that it is the next phase, named as such. Phase 77 is what happens when a
good reframing is allowed to grow the board it arrived at.

## 2. Rulings — taken 2026-09-09 (session 2), except R1

| # | question | ruling | what it settles |
|---|---|---|---|
| R1 | Which release does this ship with? | ⬜ **STILL UNRULED** | Nothing can be ordered against 0.2.2's cut, and **nothing said publicly may name a date** — the HLS-012 drafts are written to that constraint. |
| R2 | Published to npm publicly, or private with the `bin` inside the app? | ✅ **Public on npm** | HLS-001 built it that way: `engines: node >= 22`, `files`, `exports`, `publishConfig.access: public`. Pulls in [#12](https://github.com/The-Low-Code-Foundation/NodeGX/issues/12), and makes the package boundary a compatibility promise from here on. |
| R3 | Binary name | ✅ **`nodegx`** | HLS-002 ships `nodegx export`. Consistent with the `nodegx-backend` and `nodegx-observe` bins already in the repo. |
| R4 | Does the legacy `deploy` get a CLI at all? | ⏸ **Wait for HLS-010's spike** | HLS-014 stays gated. §6's end condition still does not promise a `deploy` command. |
| R5 | Is [PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) merged before or alongside this? | ✅ **Merge it first** | 🧭 **A Richard action, not an agent one.** The exporter this phase publishes does not exist on `origin/main` at all — see §4 finding 12. |

🔴 **DO NOT SCOPE BY TIME** — standing rule from phase 77. Dependency order only. No estimates.

## 3. What the scoping sweep corrected in the issues

The issues were a proposal. This is what challenging them against the code found.

- ✅ **"It is a packaging and entry-point task, not new logic" is TRUE for `export`, and better than
  #36 knew.** [`scripts/emit-app.ts`](../../../packages/nodegx-export/scripts/emit-app.ts) *is
  already the CLI* — `emit-app.ts <projectDir> <outDir>`, plus a `--preflight` mode that prints the
  pre-flight and is specced to touch the filesystem not at all. And
  [`writeExport.ts`](../../../packages/noodl-editor/src/editor/src/utils/codeExport/writeExport.ts)
  takes `fs` as an argument **specifically so a plain-Node runner can call it** — its header says so.
  The packaging pattern also exists: `@noodl/preview` and `noodl-mcp` both ship `bin` entries and
  `@nodegx/core` already builds and declares `publishConfig.access: public`.
- 🔴 **…and FALSE for `deploy`, which #36's table puts in the same column.**
  [`deployToFolder`](../../../packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts)
  needs a live `ProjectModel` — 1,927 lines dragging in `UndoQueue`, `WarningsModel`, `NodeLibrary`,
  `EventDispatcher`, the project file watcher and the migrator — plus `Exporter.exportToJSON`. That
  is the editor's live *document* model, not a parser. **Two rows in one table that look alike and
  are not the same order of work.** HLS-010 spikes it; nothing in this phase promises a `deploy`
  command until that verdict exists.
- 🔴 **"It worked first time" is a statement about the runner, not about the output.** #36 ran
  `parseProject → emitApp → summarizePreflight → writeExport` headlessly and got an export. Nothing
  compared that export to what the editor's own command produces, and nothing compared either to the
  graph on the canvas. See finding 5 — **the exporter reads a project the editor never showed the
  author.** This is the load-bearing task (HLS-003) and it is in neither issue.
- 🔴 **`@nodegx/export` cannot be published as it stands, and #36 could not see this from a
  sourcemap.** It is `"private": true` with `main: "src/index.ts"` and no build, and two files reach
  *out* of the package by deep relative path (finding 2). "Publish the pure parts as a Node ≥22
  package" is three jobs.
- ⚠️ **A front door raises the price of the export's own defects.** [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24)
  (a freshly exported project fails `npm run build`) and [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23)
  (7 of 25 component inputs silently dropped, five of them in components the report files under
  *"Translated with nothing left over"*) are annoyances behind a GUI. **In a CI pipeline they are the
  pipeline failing, or worse, not failing.** The phase's person sentence is false while #24 stands,
  so they are in scope — HLS-004 and HLS-005.
- ✅ **`serve` is already filed as a security defect, from the other end.**
  [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31) reports `*:8574` and `*:8575`
  listening on every interface with no auth, confirmed from another machine on the LAN. #36 asks for
  `nodegx serve --host --token`. **That is the same task**: loopback by default, sharing as a
  decision that prints a URL and a token. One task, two issues (HLS-006).
- ⚠️ **The "open the project afterwards" row (#38) is a third front door, not part of the CLI** — but
  it is what closes the agent/human loop: the agent authors on disk and the project *appears* in the
  editor the person already has open. Kept, as HLS-009, and severable.

## 4. The measured findings (2026-09-09, `cline-dev` HEAD, all re-measured — not read from a task file)

| # | finding | measured at | task |
|---|---|---|---|
| 1 | `@nodegx/export` is `"private": true`, `main: "src/index.ts"`, no build script, no `bin` — it cannot be installed by anything | `packages/nodegx-export/package.json` | HLS-001 |
| 2 | 🔴 Two deep relative imports reach OUT of the package: `parse/parseProject.ts:16` → the **editor's** `StyleTokensModel/DefaultTokens`; `analyze/logicbuilder.ts:33` → **`noodl-runtime`**'s `logic-builder-io`. 42 source files, otherwise clean (`fs`, `path`, `vm`, and `react`/`vite` only inside emitted strings) | `grep '\.\./\.\./\.\./'` | HLS-001 |
| 3 | The CLI exists as a hand-run script: `emit-app.ts <projectDir> <outDir>`, and `--preflight` | `packages/nodegx-export/scripts/emit-app.ts` | HLS-002 |
| 4 | `writeExport(projectDir, outDir, app, fs)` injects `fs` on purpose, for a plain-Node runner | `codeExport/writeExport.ts:1-20` | HLS-002 |
| 5 | 🔴 **The exporter is on the `does-not-apply` side of the DEF-007 project-load seam** — registered in `NON_FROMJSON_READERS` as *"Reads the project files directly."* `parseProject` never calls `applyPatches`, so the export sees **the file as written**, not the graph the editor rewrote on open. Measured at 56 stored parameters on the site-builder template at `cdd842fc`; driven to 0 there, and 🔴 **a zero is one template, not a closed seam** — the module says so itself | `models/ProjectPatches/projectLoadSeam.ts`, `def007-project-load-seam.test.ts` | **HLS-003** — ✅ **ANSWERED 2026-09-09.** The exporter now `applies`. 🔴 And the finding was *understated*: the editor's own File → Export React reaches `parseProject` too, so both doors were on the wrong side (C49). Two readers remain open and are now asserted by name |
| 6 | A freshly exported project does not build: `TS18048: 'k' is possibly 'undefined'` from the exporter's own `Expression` wrapper, under the exporter's own emitted `tsconfig.json` | [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24) | ✅ HLS-004, closed s5 |
| 7 | 7 of 25 component inputs emitted as declared-and-never-read props; 5 in components the report calls *"Translated with nothing left over"*; one input reached three sinks and two survived | [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23) | ✅ **HLS-005, closed s6.** And the corpus had carried it all along, uncounted: **9** unread props in 4 of 21 components, **3 silent**, **1** of them filed under *"nothing left over"*. The rule was that `styleAttrs` iterates its own three-port table while `contentAttrs` skips any port with no role — so a sink in neither fell through both in silence. 🔴 `style.ts` already **said** these were *"refused by name"*; they never were |
| 8 | `*:8574` and `*:8575` listen on every interface, no auth, confirmed cross-host on a LAN | [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31) | HLS-006 |
| 9 | 🔴 `deployToFolder` requires a live `ProjectModel` (1,927 lines; `UndoQueue`, `WarningsModel`, `NodeLibrary`, `EventDispatcher`, file watcher, migrator) + `Exporter.exportToJSON`. `ProjectModel` is a singleton with no `fromDirectory` — the loaders are `readJSONFromDirectory`, `fromLocalStorage`, `fromJSON` | `build/deployer.ts`, `models/projectmodel.ts` | HLS-010 (spike) |
| 10 | No non-GUI route into the editor: no `--project`, no registered `nodegx://` handler, and the MCP server never touches the launcher's recent-projects store | [#38](https://github.com/The-Low-Code-Foundation/NodeGX/issues/38) | HLS-009 |
| 11 | `@noodl/preview` (`bin/noodl-preview.js`) and `noodl-mcp` (`bin/noodl-mcp.js`) already ship bins; `@nodegx/core` already builds to `dist/` with `publishConfig.access: public`. **The pattern to copy is in the repo** | package manifests | HLS-001, HLS-006 |
| 12 | 🔴 **The exporter does not exist on `origin/main`.** `packages/nodegx-export` and `packages/nodegx-core` are both **absent** there — 15 packages on `origin/main` against 22 on `cline-dev`. So the collaborator who reconstructed 45 TypeScript files from the shipped sourcemap could not have read them in the repo however hard they looked. `origin/main` is `d569d2bd` (2026-08-07), editor version **0.1.0**, **1,837** commits behind. ⚠️ **[#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) is an open, non-draft, MERGEABLE pull request** (cline-dev → main, 6,239 files, by @richardosborne14) — a merge waiting on a decision, not an unactioned report | `git ls-tree origin/main packages/`, `git rev-list --count origin/main..origin/cline-dev`, `gh pr view 20` | ruling **R5** |

> 🔴 **Corrected 2026-09-09, same day, by a peer session — and the correction is a lesson worth more
> than the row.** The first version of this row said *"3,428 commits behind, `main` HEAD `360cdc46`,
> 2025-09-09"* and called #20 an issue. Both were wrong: **3,428 and that HEAD came from a `main` ref
> that had never been fetched** — the local ref was itself 1,592 commits stale — and `gh issue view`
> silently answers for a pull request, so nothing in the reading announced it was a PR.
> ⚠️ **`git log main` measures your last fetch, not the remote.** Fetch before quoting a divergence.
> The finding survived only because re-measuring it found a stronger fact underneath.
| 13 | There are already **three** independent headless project readers — `@nodegx/export`'s `parseProject`, `noodl-mcp`'s `ProjectStore`, and template generation — and all three are `does-not-apply`. A fourth is not the answer to anything | `projectLoadSeam.ts` `GRAPH_READER_SITES` | HLS-003 — ✅ **ANSWERED.** Template generation was already closed (DEF-038, see C51); the exporter now applies; `noodl-preview` and MCP's `ProjectStore` remain, asserted by name in an enforced scan |

## 5. Tasks

| id | task | depends on |
|---|---|---|
| HLS-012 | **The thread gets an answer** — #11 is answered with the real answer, and #11/#36 are kept current as the phase lands | — (do this first; it is a reply, not a build) |
| HLS-001 | **`@nodegx/export` is a package you can install** — cut the two outbound deep imports, add a build, decide public/private (R2), publishable manifest | — |
| HLS-002 | **`nodegx export`, and the proof it is the same export** — the `bin`, `--dry-run` = the existing pre-flight verbatim, and a spec that runs both front doors over one project and asserts the outputs are identical | HLS-001 |
| HLS-003 🟢 **BUILT 5/5** | 🔴 **The graph the CLI exports is the graph the author saw** — the DEF-007 seam from the export side, with the existing instrument (`writes` quoted beside `familyNodes`, because a zero with no family nodes is a broken instrument) | HLS-001 |
| HLS-004 | ✅ **BUILT s5, 4/4 ACs** — [HLS-004-WHAT-WAS-BUILT.md](HLS-004-WHAT-WAS-BUILT.md). 🔴 The `tsc` gate this row asked for **already existed and was green**; what was missing was a corpus fixture with the shape. The fix is wider than #24 read it — every JS-node input, not one expression | HLS-002 (the gate is the point, not the one fix) |
| HLS-005 | **The report does not say "nothing left over" when something was** — #23: the dropped bindings, and the report's silence about them | — |
| HLS-006 | **`nodegx serve`, on loopback, with a token** — #31 + #36's `serve` row; sharing becomes a decision that prints a URL and a token | — |
| HLS-007 | **`nodegx render`** — the existing render-measure path behind the same front door | HLS-001 |
| HLS-008 | **`export_react` over MCP** — with `dry_run` returning the pre-flight verbatim; the agent half of the same core | HLS-002 |
| HLS-009 | **Something other than a mouse opens a project** — #38; `--project <dir>` and/or an `open_in_editor` MCP tool that adds to Recent and focuses the window | — |
| HLS-010 | **The deploy spike** — can `ProjectModel` load headless? Produces a written verdict and either a task or a recorded refusal. 🔴 **Does not produce a `deploy` command** | — |
| HLS-013 | 🔴 **Cloud functions deploy without a window** — the only door is `WorkflowDocument.deployFunctions()`, reachable from two UI call sites. An agent can provision a backend over MCP and cannot put a function on it | — (independent of HLS-010) |
| HLS-014 | **The second deploy** — updates: redeploying over a running app, idempotently, with a verdict an agent can read. ⚠️ **GATED on R4 + HLS-010** | HLS-010's verdict |
| HLS-011 | **The drive** — a clean machine with no display server: create, author, export, `npm ci && npm run build`, serve, open the result | everything |

**Build order:** HLS-012 now · HLS-001 → HLS-002 → {HLS-003, HLS-004, HLS-007, HLS-008} ·
HLS-005 whenever · HLS-006 whenever · HLS-009 whenever · **HLS-013 whenever — it is independent of
everything and it is the lifecycle's hard blocker** · HLS-010 early, because it gates both a
`deploy` task and HLS-014 · HLS-014 only after R4 · HLS-011 last.

🔴 **Defects this phase finds live in [DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md)**,
with an owner or the literal word `NONE` on every row. Per
[PHASE-EXECUTION.md](../../guidelines/PHASE-EXECUTION.md): a defect becomes the next session's first
job **only** if it blocks an acceptance criterion.

## 6. The end condition

The phase closes when HLS-011 is driven: **on a machine with no display server, a shell creates a
project, authors it over MCP, exports it with `nodegx export`, runs `npm ci && npm run build`
successfully, serves it, and the served pages are what the editor renders for the same project.**

Not "the commands exist". The last clause is HLS-003, and it is the one that could still be false
with every command shipped.

## 7. The one thing not to lose

Two things, and they are the same thing.

**Correct and usable were never the same criterion** — the fourth repeat of this. A `nodegx export`
that runs cleanly and emits a project failing `npm run build` has met every criterion anyone would
naturally write for a CLI, and has shipped nothing. That is why #24 and #23 are tasks here and not
in someone's backlog.

And: **a CI command has nobody watching it.** Behind the GUI, the author sees a canvas and might
notice the export disagrees with it. In a GitHub Action there is no one — the disagreement ships.
Everything this phase adds removes a human from the loop, so every silent-wrongness defect the
product already carries gets more expensive on the day the CLI lands, not less.
