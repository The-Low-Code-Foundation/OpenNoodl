# Phase 33 — Progress

**Track R — Alpha Launch**
**7 tasks specced. ALPHA-005 complete; ALPHA-006 added 2026-07-31; ALPHA-007 added 2026-08-02.**
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| Task | Tier | Status | Notes |
|---|---|---|---|
| [ALPHA-001](./ALPHA-001-FIRST-HOUR.md) The cold-install first hour | 1 | 🟡 **Part A started 2026-08-06, §1 passed, then paused** | Discharges seven tasks' owed live-QA in one pass. **Started against a genuinely clean tree at `91fcd680` with a fresh `userData`** (the live one moved aside and restored afterwards). **§1 — launcher and first run: PASS.** Empty state renders correctly, `Welcome to NodeGX`, 0 projects, the first-run legal dialog appears and links to the legal docs (ALPHA-005's claim verified live), footer links resolve through `EXTERNAL_LINKS` to the three surviving destinations with no Noodl-era URLs. **§2–§6 not run.** Paused at Richard's instruction: driving the editor himself in parallel, he filed **thirteen findings in one message**, now [phase 42bis](../phase-42bis-alpha-driving-sprint/README.md). Resumes at §2 after that phase. ⚠️ **The lesson is the pause itself** — an hour of a human building a real app found thirteen first sightings the scripted pass had not reached |
| [ALPHA-002](./ALPHA-002-RELEASE-CUT.md) A release that reaches a Mac | 1 | 🟡 **Engineering done — credentials human-gated** | 2026-08-06. Everything that must be true *before* the certificates land is now verified statically and gated. Found and fixed **F77** (the Windows leg signing with the Apple `.p12`), **F76** (the artefact check anchored on a file CI never runs), a `merge-mac-update-feed` that exited 0 on "nothing to merge" and shipped a single-arch feed green, and an install guide sending Mac testers after a universal `.dmg` that is not built. Publish target (A8/B3) deliberately **not** changed — the complete old-name edit list is in the task file §4. **Still needs A1 + A2 + B3 from Richard** |
| [ALPHA-003](./ALPHA-003-CRASH-AND-FEEDBACK.md) Find out when it breaks | 2 | 🟢 **Built 2026-08-06 — driven live** | **Its premise was wrong and that was the finding.** Packaged *and dev* builds have written `<userData>/debug/log-<date>.txt` since the fork, teeing every `console.log` with 10,000 chars of attached data, un-redacted, un-timestamped, never pruned — nobody was told and nobody asked. So the task was scoping, not adding. Now errors/warnings only through ALPHA-007's `redact`, timestamped, capped; retention 14d/40 files/20 MB swept in **main** (the merge driver is a second writer, in another process); `Help → Open log folder` + `Open crash report folder`; `crashReporter` local-only (`uploadToServer: false` — **there is no server**, and transmission needs a policy that names it); main-process fatals to `main-errors.txt`. `PRIVACY.md` §5 rewritten, criterion 6's apology deleted. 50 tests. **ALPHA-005's gate is satisfied by never transmitting.** Not built: scope §4 (the no-provider state — it belongs to ALPHA-001) |
| [ALPHA-004](./ALPHA-004-USER-DOCS.md) Documentation for someone who is not us | 2 | 📋 Specced | **Re-scoped 2026-07-31** — platform half moved to ALPHA-006; retains the authored concept set, getting-started and troubleshooting. Blocked on ALPHA-006 |
| [ALPHA-005](./ALPHA-005-LEGAL-SURFACE.md) The paperwork that ships with a binary | 2 | ✅ **Complete** | 2026-07-30. `PRIVACY.md` + `TERMS.md` written from the code, licence fields added, both reachable from the Application/Help menus and shown at first run. **Criterion 5 (an outside reader) is owed** — see below |
| [ALPHA-006](./ALPHA-006-DOCS-PLATFORM.md) The docs platform, and the old site's disposition | 2 | 🟡 **§1 and §6 complete** | **Built 2026-08-03, merged 2026-08-06** (see the log). §1 — `utils/nodeDocs.ts` reads the bundled catalog, `docs-parser.ts` deleted, so no node's help depends on a website. §6 — the Help Center stops shipping Noodl. §2–§5 remain, and §5 needs B5 |
| [ALPHA-007](./ALPHA-007-FEEDBACK-LOOP.md) A feedback loop that closes | 2 | 🟡 **Parts A and B built; owed a live drive + B4/B6** | **Built 2026-08-03, merged 2026-08-06.** `utils/report/{collect,compose,diagnostics,errorTail,issueForm,redact}.ts`, `ReportProblemDialog`, `main/src/report-window.js`, `scripts/alpha-007/{create-labels.sh,prefill-probe.js}`, ~900 lines of tests. **Owed: B6** (verify the prefill by hand — it can still change the field contract) and **B4** (permission to run the label script). Never driven in a real editor |

## Recommended order

1. **ALPHA-002's credential steps** — human-gated and the longest lead time. Start it
   before anything else, because nothing else can be tested end to end until a
   signed build exists.
2. **ALPHA-005** — half a day, unblocks ALPHA-003.
3. **ALPHA-001 Part A** — as soon as the working tree is clean.
4. **ALPHA-007** — nothing blocks it, and it is what makes ALPHA-001's findings
   reproducible by someone other than the person who hit them. Part B first if you
   want the queue to exist before the reports do.
5. **ALPHA-003**.
6. **ALPHA-001 Part B** — needs the build from step 1.
7. **ALPHA-006 §1** — the help panel off the network. Independent of everything else
   here, and it closes all 54 undocumented nodes without a website existing.
8. **ALPHA-006** — the rest, after phase 30 Tier 1 lands so the node reference has
   something true to generate from.
9. **ALPHA-004** — once there is a site to write into.

## Findings register

Findings from this phase's tasks are recorded here with file and line. ALPHA-001 is
expected to be the main contributor. F-numbers continue the shared sequence used by
phases 25 and 27 — check the highest existing number before allocating.

> ⚠️ **Re-measure a row before you act on it.** On 2026-08-06 every row in this table
> was re-checked against HEAD in one pass. **Four were already fixed** (F66, F67, F69,
> and F70's mechanism) and **three understated what they described** (F63, F64, F71).
> That is the sixth and seventh instance of a pattern this repo keeps repeating: a
> register row is a claim with a timestamp, not a fact. **Numeric claims are the worst
> offenders** — F70's "54 of 156" and F71's "10 call sites" both described a tree that
> had already moved. If you file a number here, file the date and the command that
> regenerates it, or it will mislead someone within the week.

| # | Finding | Where | Owner |
|---|---|---|---|
| F63 | **A hardcoded GitHub OAuth client secret ships in the binary.** `GITHUB_CLIENT_SECRET` falls back to a literal when the env var is unset, so every distributed build contains it and anyone can impersonate the app to GitHub | `packages/noodl-editor/src/main/github-oauth-handler.js:19` | ✅ **Code fixed 2026-08-06** — replaced with the OAuth **device flow** (client id only, no secret): `src/main/src/github-device-flow.js` + `GitHubDeviceCodeDialog`, 19 tests in `tests-main/`. The file is now excluded from the `files` allow-list too. ⚠️ **NOT closed — two human actions remain at GitHub, see B2.** |
| F64 | **The GitHub token is not stored the way its own docstring claims.** The header says "encrypted using Electron's `safeStorage` … OS-level encryption"; the code uses only `electron-store`'s `encryptionKey`, a literal embedded in the app. Verified: zero `safeStorage` references in the file. AI keys *do* use `safeStorage` — the two credential stores disagree | `packages/noodl-editor/src/editor/src/services/github/GitHubTokenStore.ts:1-31` | Unowned. `PRIVACY.md` §8 documents the real behaviour rather than the docstring. ⚠️ **Understated, re-measured 2026-08-06: there are THREE credential paths, not two.** A *second* GitHub token store exists at `main/main.js:1047-1095` (`github-save-token`/`github-load-token` IPC) which genuinely uses `safeStorage` — **with a silent plaintext fallback when encryption is unavailable** (`main.js:1058-1059`) — and is driven by `services/GitHubOAuthService.ts:271-276`. So a GitHub token lands in one of two different stores depending on which service authenticated, and the disagreement is *inside* the GitHub path, not just GitHub-vs-AI. The plaintext fallback is a finding nobody had filed |
| F76 | **The `check-build-artefacts` gate could not see the failure it was named for.** Check 2 asserted a `dist/` package was *mentioned in `scripts/build-editor.ts`* — a file CI never runs — and skipped tracked sources unless `--built`, which only happens during a packaged build. `extraFiles` and bare-string `extraResources` entries were never read at all. So MCP-002's actual failure mode (a packaging workflow that never runs `npm run build:sidecars`, shipping an app with a missing sidecar because **electron-builder only warns on a missing `extraResources` source**) was exactly what the gate could not catch | `scripts/check-build-artefacts.js:115`, measured 2026-08-06 | ✅ **Fixed** `8f6c16b0`. New check 3 fails any workflow that packages without `build:sidecars`; four regressions demonstrated red in a fixture repo, green after. **The MCP-002 suspicion itself was already fixed** — all six `extraResources` sources resolve and each `to` matches its runtime consumer. One live remnant: `nodegx-backend/dist/cli.js.map` is shipped to every user and read by nothing (6.6 MB) |
| F77 | 🔴 **The Windows leg would sign with the Apple certificate the moment `CSC_LINK` lands.** `WIN_CSC_LINK` is not a separate variable to electron-builder: `app-builder-lib/out/platformPackager.js:83` falls back `WIN_CSC_LINK` → `CSC_LINK`, and `winPackager.js:104` does the same for the password. With the Apple `.p12` in `CSC_LINK` and no Windows certificate yet — **the exact interim state A1 creates and A2 leaves open** — `windowsSignToolManager` imports the Apple `.p12` successfully and hands it to signtool | `packages/noodl-editor/scripts/build.ts`, measured 2026-08-06 | ✅ **Fixed** `c12caca1` by scoping signing material per target platform. **This is the class of defect worth naming: it would have fired on the day the credentials landed, not before**, so it cost a round trip through Richard that nothing would have predicted |
| F65 | **Dead cloud config ships in every build.** `apiEndpoint` (`api.noodlcloud.com`), `domainEndpoint` and `aiEndpoint` (an AWS Lambda URL) are declared in `config.js`/`config-dist.js`/`config-dev.js` and have **zero consumers** anywhere in source. Harmless today, but it reads like a live third-party data flow to anyone auditing the app | `packages/noodl-editor/src/shared/config/` | ✅ **Fixed 2026-08-06** `1bc26877`. Two corrections to the row as filed: it was **four** config files, not three (`config-test.js` declared `apiEndpoint` too), and there was a **fifth site nobody had found** — `main.js` parsed a `--api=` flag into `process.env.apiEndpoint` that no code has ever read. Re-verified zero consumers across all packages, including bracket access and config spreads, before deleting |
| F66 | ~~**The update check polls GitHub every 60 seconds, forever.**~~ | `packages/noodl-editor/src/main/src/autoupdater.js` | ✅ **Already fixed before this row was re-read, 2026-08-06.** `CHECK_INTERVAL_MS` is 4 hours with exponential backoff (`RETRY_MIN_MS` 5 min → `RETRY_MAX_MS` 4 h), a single-pending-check guard, and the code cites F66 by name. **The row outlived its own fix** — the sixth time in this repo |
| F67 | ~~`packages/noodl-editor/package.json` is **committed minified onto a single line**~~ | — | ✅ **Already fixed** — the file is 200 formatted lines. Another row that outlived its fix |
| F68 | The About window read `Copyright (c) 2023 Future Platforms AB` and the menu item said "About Application" | `packages/noodl-editor/src/main/main.js:562-568` | ✅ **Fixed 2026-07-30** — now "About NodeGX", GPL-3.0 with the fork attribution kept |
| F69 | The Help Center's links still point at **`docs.noodl.net`**, the Noodl forum and the Noodl Discord, and its Algolia index is `docs_2-9` — Noodl's old documentation index | `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx` | ✅ **Fixed twice, independently, three hours apart.** POL-002 (phase 39, `d9c0f37c`) and ALPHA-006 §6 (`489c670d`) both found it; POL-002's answer was better — it centralised the surviving URLs in `noodl-core-ui`'s `EXTERNAL_LINKS` (shared with the launcher footer) **and** dropped `algoliasearch`/`react-instantsearch` from the lockfile, which ALPHA-006 could not. The 2026-08-06 merge kept POL-002's shape and took ALPHA-006's issue-form links on top. ⚠️ **The lasting lesson is on the other side:** POL-002 removed Algolia and never updated `PRIVACY.md`, so for three days the policy still listed Algolia as a live flow receiving *"anything you typed"*. **The privacy policy was more wrong than the code**, and only the merge caught it |
| F70 | **54 of 156 nodes (35%) have no working documentation page.** Every `docs` URL in `node-catalog.json` was resolved against the docs repo's file list: 102 hit a real page, **6 point at the wrong path**, **33 point at a page that does not exist**, **15 nodes have no `docs` URL at all**. It is not a random 35% — it is precisely the NodeGX-era library: all five BYOB nodes, the whole realtime family, the entire agentic-UI/state set, Logic Builder, email, magic-link/OAuth. `docs-parser.ts:75` swallows the 404, so the help panel shows nothing rather than an error | `packages/noodl-types/src/node-catalog.json` × `The-Low-Code-Foundation/opennoodl-docs`, measured 2026-07-31 | ✅ **Mechanism fixed 2026-08-06** — ALPHA-006 §1 landed (`3dbd2914`, merged `80d221c0`): `docs-parser.ts` is deleted and `utils/nodeDocs.ts` reads the **bundled catalog**, so no node depends on a website existing. ⚠️ **The row's numbers were stale when re-measured the same day:** the catalog is now **172 nodes, not 156**, and **17 have no `docs` URL, not 15**. The 33-missing/6-wrong split cannot be re-verified without the docs repo. **Do not quote "54 of 156" again** — it described the tree on 2026-07-31 and nothing recorded that it was a snapshot |
| F71 | **The docs site is the editor's content CDN, not a docs site.** `getDocsEndpoint()` has 10 call sites across **7 payload types**, and 6 are not documentation: the prefab/module library index and zips, the Learn lesson index, the new-project templates, the tutorials list, the what's-new feed. Moving or archiving that origin silently empties the **Library panel, the Learn lesson list and the new-project template picker** — all three fail without an error. Two served paths have no consumer at all (`static/nodepickerdefaults/`, `static/version.json`) | `packages/noodl-editor/src/editor/src/utils/getDocsEndpoint.ts`, **re-counted 2026-08-06** | ALPHA-006 §5. ⚠️ **The row undercounts: 15 call sites across 9 payload types, not 10 across 7.** Two payload types are new since it was filed — the **MCP docs HEAD probe** (`McpSettingsSection.tsx:199`) and the **launcher's Lessons thumbnails** (`ProjectsPage.tsx:166`) — so moving the origin now also breaks the launcher's Lessons tiles and silently disables the MCP docs link. One nuance to keep: `ModuleCard.tsx:29` resolves the endpoint at **module scope**, so a runtime endpoint change never reaches it |
| F78 | **`Config.devMode` has never been set in any build**, so `bugtracker.ts`'s `enabled = !Config.devMode` has always been true and the diagnostic log has been written from source as well as from a package. `config-dev.js` is referenced by nothing; the only config swap is `build-editor.ts:20-21` copying `config-dist.js`, which does not declare it. **Four places stated the opposite** — `errorTail.ts:16-18`, `collect.ts:107-110`, `PRIVACY.md` §5, and ALPHA-003's own brief | `packages/noodl-editor/src/shared/config/config-dev.js` × `src/editor/src/utils/bugtracker.ts` | ✅ **Found by driving it, 2026-08-06** (`8c37ddc5`). A `npm run dev` launch wrote a log and the new sweep deleted **424 stale files** out of 465. Kept enabled deliberately: a log that only exists in the build nobody develops against is a log nobody tests, which is exactly how it reached 465 files unnoticed. The dead branch is now an explicit `true` with the reason |
| F79 | **`merge-driver.js` writes into `<userData>/debug/` without creating it** and swallows the failure, so on a fresh install the first failed project merge dumped nothing at all — the one case those dumps exist for | `packages/noodl-editor/src/main/src/merge-driver.js:104-109` | ✅ **Fixed incidentally 2026-08-06** (`1acc1851`) — `initialiseDebugDirectory` mkdirs at startup; the merge driver itself is untouched |
| F80 | **`bug_report.yml` sent reporters to a menu that does not exist** — *"View → Toggle Developer Tools, or ⌥⌘I / Ctrl+Shift+I"*. `main.js` replaces the default application menu, so there is no View menu and no such accelerator; the only devtools item is **Dev → Open Editor Devtools** on ⌘E. Every tester who followed the bug form's own instructions found nothing | `.github/ISSUE_TEMPLATE/bug_report.yml:118-121` | ✅ **Fixed 2026-08-06** (`17cc1856`), in the same edit that deleted ALPHA-003 criterion 6's "does not write a log file yet" apology |
| F73 | **The Linux leg of v0.1.0 did not "succeed without a feed" — it failed, after uploading.** electron-builder built and uploaded the AppImage, then aborted building the `.deb`: *"Please specify author 'email' in the application package.json"*. `author` was the bare string `"The Low Code Foundation"`. Publishing stopped there, which is the actual cause of **A2**. The general lesson: **electron-builder uploads as it goes, so a published artifact is not evidence of a green job** | `gh run view --job 89168201500`, measured 2026-08-04 | ✅ **Already fixed** — `author` now carries `<contact@thelowcodefoundation.com>`; `.deb` was never the point, the aborted publish was |
| F74 | **`latest-linux.yml` was never the right fix for A2.** `autoupdater.js:8` returns early on `process.platform === 'linux'`, so the Linux build never asks for an update feed and would not read one if it existed. A2 is therefore "correct behaviour, undocumented" rather than a defect — but nothing said so, so it read as a bug for a week | `packages/noodl-editor/src/main/src/autoupdater.js:8-10` | ✅ **Closed by documenting it** — `RELEASE-PROCESS.md` now has a "Linux is install-only, deliberately" section, and the early return carries the reason |
| F75 | **v0.1.0's macOS build shipped the default Electron icon.** The build log says `default Electron icon is used  reason=application icon is not set` — there was no `build/icon.*` and no `mac.icon`, so the one artifact anyone would have installed had a generic icon | v0.1.0 darwin-arm64 job log | ✅ **Already fixed** by `61d45f31` — `build/icon.png` (1024×1024) is auto-discovered; the 2026-08-04 build emits `dist/.icon-icns` |
| F81 | **Two `tests-unit/erg-005/` suites were committed without the implementation they specify**, so `test:main` — a PR CI gate — was red: `componentContract` did not compile at all (`ports` does not exist on `GraphComponent`; `componentPorts` returns `string[]`, not port objects; `formatComponentPort` does not exist) and `validatorComponentContract` ran 5 green / 3 red. **The gap is larger than the tests suggest:** a component's interface is never written to disk — `ComponentModel.toJSON()` emits `{name, id, graph, metadata}` and 0 of 2 components in `tests/testfs/import_proj5/project.json` carry a `ports` key — so ERG-005 §1 is serialise-then-read, and the serialise half changes the project save path | `packages/noodl-editor/tests-unit/erg-005/` × `src/editor/src/models/componentmodel.ts:359-366`, measured 2026-08-06 | ✅ **Gate restored 2026-08-06** (`dfbfa08b`) — renamed to `*.pending.ts`, which `testMatch` does not collect, with a README stating exactly what is missing and how to turn them on. `test:main` is **63 suites / 873 passing / 0 failing**. Deliberately **not** `describe.skip`: this repo has already shipped a feature that never worked behind eleven skipping assertions (F62), and a skipped test inside a collected file reads as covered. **The feature itself is still unbuilt** and is owed to phase 35 |
| F72 | **The triage queue the issue forms promise does not exist.** All three forms declare `needs-triage`, and `node_report.yml` also declares `node-library`. **Neither label exists on the repo** — the label set is still GitHub's stock nine. GitHub silently drops labels it cannot resolve, so every report filed since 2026-07-30 is unlabelled beyond `bug`/`enhancement`, and `gh issue list --label needs-triage` returns nothing by construction. Related: there is **no severity vocabulary at all**, neither a form field nor a label, so the queue can only be ranked by date | `.github/ISSUE_TEMPLATE/*.yml` × `gh label list`, measured 2026-08-02 | ALPHA-007 §6 |

## Pre-existing findings this phase adopts

Recorded during the 2026-07-30 readiness review, before any task started. These are
evidence, not speculation — each was measured.

| # | Finding | Evidence | Owner |
|---|---|---|---|
| A1 | **The v0.1.0 draft release carries no macOS artifact of any kind** — no `.dmg`, no `.zip`, no `latest-mac.yml`. macOS is the primary development platform | `gh release view v0.1.0`, 2026-07-30 | ALPHA-002 |
| A2 | **No `latest-linux.yml`.** The AppImage ships with no update feed, so Linux has an installer and no update path | same | ALPHA-002 |
| A3 | The darwin-x64 leg's failure has a recorded cause (the retired `macos-13` image, since fixed). **The darwin-arm64 leg's failure does not**, and it ran on a supported image | `release.yml` comments vs. the asset list | ALPHA-002 |
| A4 | ~~**Packaged builds write no log file.**~~ **Wrong — corrected by ALPHA-005.** `app.getPath('logs')` is indeed never used, but the log is written *elsewhere*: `bugtracker.ts` sets `enabled = !Config.devMode`, and `devMode: true` appears **only** in `config-dev.js` — so in every packaged build the BugTracker is live and appends to `<userData>/debug/log-<date>.txt`. It monkey-patches `console.log` and installs a `window.onerror` handler, capturing all console output and every uncaught renderer error with up to 10,000 chars of attached data. The merge driver dumps whole project graphs into the same directory. A user hitting a bug therefore **does** have something to attach; nobody has ever told them so, and nobody asked their permission | `packages/noodl-editor/src/editor/src/utils/bugtracker.ts:93-99`, verified against `config-*.js`, 2026-07-30 | ALPHA-003 — this changes its design: the task is *surfacing and scoping* an existing log, not adding one |
| A5 | **No crash reporting of any kind.** The only `crashReporter`/`sentry` matches in the tree are inside gitignored webpack bundles | grep, 2026-07-30 | ALPHA-003 |
| A6 | `mixpanel-browser` was a declared dependency with **zero call sites**, and pulled `@mixpanel/rrweb` (DOM session recording) into every packaged build | grep + lockfile | ✅ **Fixed 2026-07-30** `359bd8f5` — removed with 9 transitive packages |
| A7 | The repo had **no issue templates**, while the product has no crash reporting — so the feedback channel was a blank text box | — | ✅ **Fixed 2026-07-30** `47219e05` — three issue forms |
| A8 | The publish target is `The-Low-Code-Foundation/OpenNoodl` for a product called NodeGX, so every download URL and the update feed say the old name | `packages/noodl-editor/package.json` | ALPHA-002 — a decision, not a defect |
| A9 | The root `package.json` declares **no `license` field**, though `LICENSE` exists | — | ✅ **Fixed 2026-07-30** — `GPL-3.0-only` at the root, and the two MIT packages that had a `LICENSE` file but no field (`noodl-runtime`, `noodl-viewer-react`) now declare `MIT` |

## Log

- **2026-07-30 — Phase created** from a readiness review against the full phase
  register, scoped explicitly to exclude phases 18, 20, 26, 31 and 32 (post-alpha by
  decision) and phase 17 (a G3 question). Five tasks specced. A6 and A7 were fixed
  in the same session rather than filed, being small and self-contained.

- **2026-07-30 — the working tree was landed before any of this.** The primary
  checkout carried **121 uncommitted files** across four unrelated bodies of work,
  which is what made ALPHA-001 unrunnable: a live QA pass measures whatever is on
  disk. Five commits (`61d45f31` brand/icons, `a2db2231` Blockly logic-builder,
  `22618d2d` devtools process-lifetime fixes, `62e400d4` docs, plus the screenshot
  corpus) took it to 33 — and the 33 that remain are exactly phase 30's live,
  actively-being-written set, which was deliberately not touched. Verified before
  landing: `typecheck:editor` 0, `typecheck:runtime` 0, `typecheck:core-ui` 43
  errors all pre-existing path-alias failures in files none of the groups touched
  (baseline 45), and 18 logic-builder tests passing.

- **2026-07-30 — ALPHA-005 complete.** `PRIVACY.md` and `TERMS.md` at the repo root,
  written by reading the source rather than from a template; every claim in the
  privacy policy names the file that makes it true, and the policy closes with a
  table mapping claims to source paths so the next person can re-check it instead of
  trusting it.

  **The spec asked for six data flows. There are nine**, and the three it did not
  list are the ones that matter for its own acceptance criterion 5 — *"if I never
  touch the AI features, does anything leave my machine?"*:

  - the **auto-updater**, which contacts GitHub at launch and every 60s (F66);
  - the **what's-new feed**, fetched from the docs site on opening a project;
  - **Algolia**, which receives the text typed into the help search box.

  The honest answer to criterion 5 is therefore *"your project content does not, but
  the app does talk to three services regardless"* — and the policy says exactly
  that in a "short answer" section rather than burying it. Two of the six flows the
  spec did list also turned out to be milder than assumed: the **analytics tracker
  is a permanent no-op** (`DummyTracker`; `setTracker` has no call site), and
  **telemetry has no server to send to at all**.

  Checks on the AI claims, since they are the load-bearing ones: opening any AI
  panel transmits nothing — `verify` is reachable only from the button, and
  `AiSettingsSection`'s mount effect only migrates local settings. Authoring cannot
  send the whole project by construction (`ContextBuilder`'s surface). Project
  review sends the most, and its backend summary carries **schema, not rows**
  (`review/types.ts:91`) — though it does carry backend endpoint URLs, which the
  policy flags.

  Wiring: a `Help` menu and two items beside `About NodeGX`, plus a one-time
  first-run notice. Documents render in a `data:`-URL window with no node
  integration, where every link opens in the user's browser. They ship via
  `extraResources` (`legal/`), so the repo-root file and the packaged file are the
  same file — 18 jest tests in `tests-main/legal-window.test.js` assert the renderer
  against the **real** documents, so a document that grows a construct the renderer
  cannot handle fails the suite rather than a reader.

  Gates: `lint:ci` green (828 vs baseline 3916); editor `tests-main` 61/61 passing.
  `npm run tsfixme` is **RED (+26 TSFixme, +26 any)** and was red before this task —
  the working tree contains **no `.ts`/`.tsx` files at all**, so every one of the
  four growing files is already-committed work from phase 30 and the workflow panels.
  Not touched, not re-baselined.

  **Owed:** acceptance criterion 5 — someone who did not write the documents reading
  them and answering the question from the documents alone. That cannot be
  self-certified, and it is the criterion the spec calls "the real test".

  **Also owed:** the contact/entity section of both documents is a marked `TODO` in
  an HTML comment (stripped before display). Richard needs to supply the publishing
  entity, a contact address, and governing law before a public build. Everything
  else in both documents is verified against the code.

- **2026-07-31 — ALPHA-006 specced, ALPHA-004 re-scoped.** Richard asked whether the
  docs should be rewritten from scratch on a modern framework. Reviewing
  `The-Low-Code-Foundation/opennoodl-docs` answered half of that: **it is already
  Docusaurus 3.1** with MDX, SCSS and local search, so there is no framework upgrade
  to make. The content model is what needs replacing.

  Two findings made this its own task rather than an ALPHA-004 note. **F70** — 35% of
  the node library has no working page, concentrated entirely in what we built since
  the revival. **F71** — the docs origin serves seven payload types, six of them not
  documentation, so "move the docs into the repo" silently empties three panels if
  done naively.

  The disposition of the old repo's 431 authored files was measured, not estimated:
  ~41k words of node pages are **superseded** by the enriched catalog (156/156 nodes
  already carry better prose); `javascript/` (~8k) **ports near-verbatim** — checked
  against `noodl-js-api.ts`, it accurately covers 13 of the 14 real namespaces, and
  needs `Config` and `Env` adding; ~52k words of guides yield maybe 10k of salvaged
  concepts; ~35k words **delete** because they describe the Noodl Cloud Service and
  Dashboard (deleted by WF-007), Noodl-hosted git, AWS/GCP backend setup (superseded
  by phases 19/26), and a Figma plugin with **zero** references left in the editor
  source. The prefab library's 179 files / ~60k words stay on the content host, not
  in this monorepo — they are coupled to the payload, and they are how the 413 MB
  gets back in.

  Richard's instinct to drop the assets is right and is the largest single saving:
  1,621 PNGs and 315 MP4s all show the pre-refresh editor and are wrong after phases
  23–28.

  **Nothing built.** Four documents touched: ALPHA-006 created, ALPHA-004 re-scoped,
  README and this file updated.

- **2026-08-02 — ALPHA-007 specced, ALPHA-003 re-scoped.** Richard had built an
  in-game feedback capture for a side project — screenshot, full state blob, severity,
  filed to a local queue an agent then works through — and asked whether NodeGX could
  do the same against GitHub issues for alpha testers.

  It can, but not the obvious way. **A GitHub token cannot ship in an Electron app**
  (`asar` is not encryption) and this repo is public, so "the app files the issue"
  means a proxy we host, OAuth, or a pre-filled form the user submits. Working
  through the four designs produced one non-obvious conclusion worth recording: the
  pre-filled-form design **transmits nothing from the app** — the user's own browser
  posts, under their own identity, to a payload they can read first. That is what
  separates it from ALPHA-003, whose ALPHA-005 gate exists precisely because it
  transmits. So it split out rather than being folded in, and it is now the only
  Tier 2 task with no prerequisites.

  Two things sharpened the design against the prior art. The game's report carries
  the player's own save; **a NodeGX report carries someone else's project**, which can
  contain a client's proprietary graph and their API keys — onto a public repo,
  permanently. Hence the review-before-send screen and a redactor with a behavioural
  acceptance criterion (§3, criterion 4). And Electron removes the prior art's
  largest dependency outright: `webContents.capturePage()` replaces fetching
  `html2canvas` from a CDN to rasterise the DOM.

  Richard then added the consuming half — contributors with write access working the
  queue from Claude Code via `gh`. That is what made it one task rather than two: both
  halves share the issue body, so it gets a `render: json` **diagnostics fence** that is
  legible to a human and parseable by an agent. Designing either half alone gets that
  contract wrong.

  **F72** came out of the scoping: the three issue forms have been declaring a
  `needs-triage` label since 2026-07-30 that **has never existed**, so the queue they
  promise is empty by construction and every report filed so far is unlabelled.

  **Nothing built.** Four documents touched: ALPHA-007 created, ALPHA-003 §2 and
  criterion 3 handed off, README and this file updated. The `/triage` skill's
  reference implementation lives outside this repo (`~/vscode_projects/dead-weight`)
  and is cited in ALPHA-007 §7 rather than copied.

- **2026-08-06 — ALPHA-006 and ALPHA-007 were found already built, on branches nobody
  merged.** The session opened intending to *write* them. Both had been built, tested
  and committed on 2026-08-03 in worktrees (`wt-alpha-006`, `wt-alpha-007`), branched
  from `bf35a9f4` — and left there while `cline-dev` moved **215 commits** past them.
  ~3,858 lines: the bundled-catalog help panel, the whole report composer and
  redactor, the label script, the prefill probe, ~900 lines of tests. Merged as
  `80d221c0`.

  **The lesson is not "merge your branches".** It is that a *completed, committed,
  tested* body of work is as invisible as an uncommitted one if nothing in the
  handover names the branch. The previous handover listed both tasks under "what an
  agent can build now" — its highest-confidence instruction was to rebuild something
  that already existed. **Before building anything a handover recommends, run
  `git branch -a` and grep the log for the task ID.**

  The merge produced two findings of its own. **Only three files conflicted**, not
  the dozen predicted, because phase 39's POL-002 had independently found the same
  Preact `JSX` namespace defect by the same route **three hours later** and made a
  byte-identical fix — so ALPHA-006's `bc0d15b0` landed as a pure no-op. And POL-002
  had done ALPHA-006 §6's job better (centralised `EXTERNAL_LINKS`, dropped the
  Algolia dependency and lockfile) **but never updated `PRIVACY.md`** — which still
  listed Algolia as a live flow receiving *"anything you typed"* three days after the
  dependency was gone. **The privacy policy was more wrong than the code**, and only
  merging the two halves surfaced it.

  Also this session: **F65** deleted (four config files, not the three filed, plus a
  fifth site — a `--api=` flag parsed into an env var nothing reads). **F63** replaced
  with the OAuth **device flow** per Richard's decision; the pre-existing
  `startDeviceFlow` turned out to be a stub that called the web flow and returned an
  empty device code — *a device-flow API that never ran a device flow*. **ALPHA-002**
  taken as far as it can go without credentials, yielding **F76** and **F77**. The
  README stopped offering one-click installers for OpenNoodl 1.1.0, which is what a
  stranger met first.

  `test:main` went **688 → 878 passing** across the session. ⚠️ The handover's stated
  baseline of "693 passing" was wrong; the real figure at `251a90f2` was **688**.

  **ALPHA-003** was built and driven live in the same session, and its premise was
  the finding: the log it was meant to *add* had existed since the fork, teeing every
  `console.log` un-redacted and never pruned, in dev builds too (**F78** — the
  `devMode` flag it was gated on has never been set in any build, and four separate
  places in the tree asserted otherwise). The first sweep deleted **424 stale files**.
  Three more findings fell out: **F79** (the merge driver dumping into a directory
  nothing created, so the *first* failed merge on a fresh install recorded nothing)
  and **F80** (the bug report form directing testers to a View menu that does not
  exist — every tester who followed its own instructions found nothing).

  **Gate sweep on the settled tree**, run by the orchestrator rather than taken from
  any agent's report: `typecheck:runtime|cloud|viewer|editor|editor-tests` **clean** ·
  `catalog:check` (172 nodes) / `cloud-library:check` (81) / `catalog:merge:check`
  (172/172 enriched) **up to date** · `library:check` **58/58** · runtime **2298** ·
  cloud-runtime **172** · nodegx-backend **97 suites / 1056** · observe **23** · mcp
  **196** · **`Jasmine: 2391 specs, 0 failures`** · `test:main` **878 passing, 3
  failing** — all three in `tests-unit/erg-005/`, a concurrent session's untracked
  work, deliberately untouched.

  **Still owed, and unmoved: the exit criterion.** Nothing here was demonstrated by
  someone who is not Richard. **A3 — recruiting testers — remains the long pole, and
  no amount of engineering shortens it.**
