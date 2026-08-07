# Phase 33 — Progress

**Track R — Alpha Launch**
**7 tasks specced. ALPHA-005 complete; ALPHA-006 added 2026-07-31; ALPHA-007 added 2026-08-02.**
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| Task | Tier | Status | Notes |
|---|---|---|---|
| [ALPHA-001](./ALPHA-001-FIRST-HOUR.md) The cold-install first hour | 1 | 🟢 **Part A complete 2026-08-07 — §1–§6 all walked, two real defects found** | Discharges seven tasks' owed live-QA in one pass. **§1** passed 2026-08-06. **§2/§3** effectively discharged by [LIB-005-NOTES.md](../phase-21-library-and-import/LIB-005-NOTES.md) §7–§10 (see the 2026-08-07 log entry below for detail). **§4 (app-name round trip): PASS**, 2026-08-07 — a real keystroke into App name, followed by a graceful quit *without* blurring the field, followed by reopen, round-trips correctly (the 2026-07-28 quit-flush fix holds). **§5 (PLAT-005 Parts A/B/D): root-caused, not just blocked** — the two-session-old `forEachNode`-only-sees-one-node mystery was a stale/timing artifact, not a real bug (confirmed live: it correctly enumerates all 7 top-level roots once queried properly). Found **F102** (the real reason the variant-suggestion banner never fires — `StyleAnalyzerCore.scanNode` silently drops `borderRadius` overrides because they're object-typed, not strings) and **F103** (a pre-existing deprecated `Button` node type silently loses the entire style-suggestion system with zero indication). **§6 (AI panels, no provider): PASS**, assessed via hybrid live+static — could not live-test a true no-provider state because this dev profile already has a working Anthropic key configured (discovered only after accidentally spending ~$0.06 in real API cost by clicking "Build it"; immediately rejected the staged change, confirmed no trace left in the project). Verified via source read instead: every AI entry point proactively disables its submit action with a clear "No AI provider is configured" message before any network call, with a typed error as defense-in-depth. Bonus: the live accident also confirmed the AI Build feature itself works end-to-end (self-repaired an invalid parameter, staged cleanly for Accept/Reject) — good evidence for AIB-001–009's "built" status. Full gate sweep re-run clean at the end (`Jasmine: 2418 specs, 0 failures`; `test:main` 933/933 in isolation, one flaky-under-parallel-load false alarm; typechecks/runtime/cloud-runtime/backend/observe/mcp all green) — see the 2026-08-07 log entry for the one pre-existing gate gap (catalog enrichment, not caused this session). **§4/§5/§6 are the last of Part A** — Part B (packaged build) still needs ALPHA-002's signed build |
| [ALPHA-002](./ALPHA-002-RELEASE-CUT.md) A release that reaches a Mac | 1 | 🟡 **Engineering done — credentials human-gated** | 2026-08-06. Everything that must be true *before* the certificates land is now verified statically and gated. Found and fixed **F77** (the Windows leg signing with the Apple `.p12`), **F76** (the artefact check anchored on a file CI never runs), a `merge-mac-update-feed` that exited 0 on "nothing to merge" and shipped a single-arch feed green, and an install guide sending Mac testers after a universal `.dmg` that is not built. Publish target (A8/B3) **now changed** — see 2026-08-06 log entry below. **Still needs A1 + A2 from Richard** |
| [ALPHA-003](./ALPHA-003-CRASH-AND-FEEDBACK.md) Find out when it breaks | 2 | 🟢 **Built 2026-08-06 — driven live** | **Its premise was wrong and that was the finding.** Packaged *and dev* builds have written `<userData>/debug/log-<date>.txt` since the fork, teeing every `console.log` with 10,000 chars of attached data, un-redacted, un-timestamped, never pruned — nobody was told and nobody asked. So the task was scoping, not adding. Now errors/warnings only through ALPHA-007's `redact`, timestamped, capped; retention 14d/40 files/20 MB swept in **main** (the merge driver is a second writer, in another process); `Help → Open log folder` + `Open crash report folder`; `crashReporter` local-only (`uploadToServer: false` — **there is no server**, and transmission needs a policy that names it); main-process fatals to `main-errors.txt`. `PRIVACY.md` §5 rewritten, criterion 6's apology deleted. 50 tests. **ALPHA-005's gate is satisfied by never transmitting.** Not built: scope §4 (the no-provider state — it belongs to ALPHA-001) |
| [ALPHA-004](./ALPHA-004-USER-DOCS.md) Documentation for someone who is not us | 2 | 📋 Specced | **Re-scoped 2026-07-31** — platform half moved to ALPHA-006; retains the authored concept set, getting-started and troubleshooting. Blocked on ALPHA-006 |
| [ALPHA-005](./ALPHA-005-LEGAL-SURFACE.md) The paperwork that ships with a binary | 2 | ✅ **Complete** | 2026-07-30. `PRIVACY.md` + `TERMS.md` written from the code, licence fields added, both reachable from the Application/Help menus and shown at first run. **Criterion 5 (an outside reader) is owed** — see below |
| [ALPHA-006](./ALPHA-006-DOCS-PLATFORM.md) The docs platform, and the old site's disposition | 2 | 🟡 **§1, §5 (endpoint split) and §6 complete** | **§1/§6 built 2026-08-03, merged 2026-08-06** (see the log). §1 — `utils/nodeDocs.ts` reads the bundled catalog, `docs-parser.ts` deleted, so no node's help depends on a website. §6 — the Help Center stops shipping Noodl. **§5's code half done 2026-08-07** — `getContentEndpoint()` split from `getDocsEndpoint()`; the six non-documentation payload consumers moved to it, the three real-docs consumers (`NodeLabel.tsx`, `NodePicker.hooks.ts`, `McpSettingsSection.tsx`) stayed. Both still resolve to the same origin, by design — the split is what lets them move independently, not a move by itself. **§5's disposition half (stripping `opennoodl-docs`, the 413 MB asset question) is still B5, unresolved.** §2, §3, §4 remain |
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
| F102 | 🔴 **The style-suggestion banner (PLAT-005 §2) can structurally never fire for the property that triggers it most often.** `StyleAnalyzerCore.scanNode()` coerces every node-parameter value with `String(rawVal ?? '')`, assuming all style values are strings — but `borderRadius` is stored as a structured `{value, unit}` object in the current project format. `String({value:12,unit:'px'})` → `"[object Object]"`, which silently fails `isTokenisableSpacingValue`'s numeric regex, so a `borderRadius` override is never counted. Confirmed live: a Button with `backgroundColor` (raw, correctly counted) + `borderRadius` (raw, silently dropped) + `paddingTop` (token, correctly excluded) registered only **1** of 3 attempted overrides — one short of `variantCandidateMinOverrides: 3` — so the banner never appeared, reproduced across a full page reload (genuinely fresh `useStyleSuggestions` mount) reading the already-persisted-to-disk override. This is the actual cause behind three separate failed live-QA attempts (2026-07-27, and twice 2026-08-07) that were each previously attributed to driving-tool limitations | `packages/noodl-editor/src/editor/src/services/StyleAnalyzer/StyleAnalyzerCore.ts:237-238`, measured 2026-08-07 | PLAT-005 — unowned |
| F103 | **A pre-existing (pre-NDA-011) deprecated `Button` node silently loses the entire style-suggestion/variant system, with zero indication.** `ElementConfigRegistry`'s `ButtonConfig.nodeType` is `'net.noodl.controls.button'` (the current node); the deprecated node at `nodes-deprecated/controls/button.tsx` reports `type.name === 'Button'`. `propertyeditor.ts:123`'s `renderElementStyleSection()` early-returns unless `ElementConfigRegistry.has(typeName)`, so any node still carrying the deprecated type never mounts `ElementStyleSectionHost` at all — no variant picker, no size picker, no suggestion banner, no error. Confirmed on the `NodeGX QA Fixture`'s `erg-rig`/`erg001-cloud` Button nodes (deprecated type) vs. `/Content/Changelog`'s Button (current type, correctly renders the full style section). Not a fresh-user risk — `componentmodel.ts:293`'s `isCreatable` blocks creating the deprecated node from the NodePicker today — but silently affects any pre-existing or imported project still carrying one | `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.ts:121-123` × `packages/noodl-viewer-react/src/nodes-deprecated/controls/button.tsx:86-92`, measured 2026-08-07 | PLAT-005 — unowned |

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

- **2026-08-06 (later same day) — three Tier B decisions closed.** Richard decided
  B3, B4 and B7 in one pass; all three executed and verified live rather than left
  as decisions on paper.

  **B3.** `The-Low-Code-Foundation/OpenNoodl` renamed to `.../NodeGX` (`gh repo
  rename`; old name now redirects). Six files updated to match — `package.json`'s
  `build.publish.repo`, `issueForm.ts`'s `ISSUE_REPO`, `legal-window.js`'s fallback
  doc link, the issue template's contact link, the README badge/release link, and
  `create-labels.sh`'s `REPO` var — `e8a53c94`. `tests-unit/alpha-007` (87) and the
  `tests-main` suites covering `legal-window`/`issueForm` (210) re-run green.
  Deliberately not touched: the README's product-name prose and the sibling
  `opennoodl-hosting.com`/`opennoodl-cloudservice`/`opennoodl-better-backend` repo
  names — REV-007 already scoped the rebrand to branding + packaging identity, not
  prose or sibling repos.

  **B4.** `scripts/alpha-007/create-labels.sh` run for real. Nine labels now live:
  `needs-triage`, `node-library`, four `severity:*`, `triaged`, `needs-info`,
  `cannot-reproduce`. F72's queue contract (`gh issue list --label needs-triage`) is
  no longer empty by construction.

  **B7.** Richard confirmed the Discord invite (`discord.gg/dZw4w5pKf9`) is live and
  staffed — no product change needed. Found in passing: the issue template's
  "Question or general discussion" link still points at `/discussions`, which is
  off (`has_discussions: false`) — the same dead-link shape B7 was written to avoid,
  just on the other channel. Left unowned in `HUMAN-GATED-ITEMS.md`, not filed as an
  F-number (one-line config choice, not a mechanism defect).

  **Not done this pass, and still the actual gates:** A1/A2 (signing secrets), B1
  (legal entity/contact/jurisdiction), B2's two GitHub admin actions (revoke the
  leaked secret, enable device flow), B5 (docs-CDN disposition), B6 (prefill probe —
  needs a signed-in browser session), and A3 (testers). None of them are engineering.

- **2026-08-07 — ALPHA-001 resumed, ALPHA-006 §1 re-verified, ALPHA-004 drafted.**
  Three streams, two as background agents, one driven directly.

  **ALPHA-006 §1**, sent to a background agent to re-verify against HEAD: already
  done (`3dbd2914`, 2026-08-03, predates this session). `nodeDocs.ts` reads the
  bundled catalog; all four named consumers are wired to it; 18/18 tests pass;
  `typecheck:editor` clean; spot-checked `net.noodl.SSE`/`net.noodl.WebSocket` (two
  of the previously-undocumented realtime nodes) both carry real enrichment. Nothing
  to commit — confirms the phase-33 table row above was already accurate, not stale.

  **ALPHA-004 §1/§2/§4**, also a background agent, genuinely new work (the task was
  still "Specced", nothing built). Staged in a new `docs-site-content/` directory —
  not wired into a site because ALPHA-006 §2 (the Docusaurus skeleton) doesn't exist
  yet — 11 files, ~5,000 words: seven concept-set files (node/port/wire, signal vs
  value, components, canvas and sheets, preview vs deployed, data, frontend vs
  backend), a getting-started tutorial, and a sourced troubleshooting doc. Grounded
  in `REACTIVITY-CONTRACT.md`/`PORT-TYPE-CONTRACT.md` and direct source reads rather
  than invented — `COMMON-ISSUES.md`, the nominal troubleshooting source, turned out
  to have zero user-facing content (all contributor/build issues), so the real
  troubleshooting material came from grepping task NOTES and reading source
  directly. Committed `fb0cc18f`. Spot-read live against the actual editor during
  the ALPHA-001 pass below: "Quick Start" in the launcher's create-project modal
  reads "Blank project with Modern preset" in the UI copy but the doc's claim that
  it actually starts from an App+Router+Home+"Hello World!" template (not a blank
  graph) was not independently re-verified this session — worth a two-minute check
  before trusting the getting-started doc's step 1 literally.

  **ALPHA-001 Part A, resumed** — phase 42bis (the 13-finding interruption) closed,
  so this picked up at §2. Findings:

  - §2 (import) and §3 (library install) turned out to already be **effectively
    discharged**, not by ALPHA-001 itself but by LIB-005-NOTES.md §7–§10's live QA
    (2026-07-26, 2026-08-02) running the identical checklist ALPHA-001 §2 cites
    verbatim. This wasn't visible from the phase-33 table alone — it took reading
    LIB-005-NOTES.md directly to see the checklist had already been walked.
  - §4 and §6 were not reached — time went to §5 instead (see below) and ran out.
  - §5 (PLAT-005 Parts A/B/D — variant persistence, token suggestions) hit the same
    canvas-hit-testing wall the original PLAT-005 session recorded. New information
    this time: `window.__nodeGraphEditor` is a real, live debug hook
    (`nodegrapheditor.ts:300`), confirmed scoped to the open component via
    `.model.owner.name === '/erg-rig'`, and the exact graph-to-screen transform was
    found in source (`CanvasViewport.ts`'s `canvasToGraph`, inverted:
    `screenCSS = (graphPos + panAndScale) * scale`, plus the canvas element's own
    `getBoundingClientRect()` offset). None of that was enough: `forEachNode` only
    ever yielded **one** top-level node (a `Group` with 5 children, all `Text`/one
    `Button`), while the canvas was visibly rendering `Array Filter`, `Counter` and
    `Object` nodes that never appeared in that enumeration anywhere. Where those
    nodes actually live relative to the debug hook is unresolved and worth real
    investigation — guessing pixel coordinates against a wrong mental model of the
    node tree is how two harmless-but-unintended clicks happened (see below), not a
    productive way to spend the next attempt's first hour.
  - Two accidental clicks, both harmless and both instructive. One landed on the
    fixture's observability "Record" HUD button, starting a trace with 0 events;
    stopped cleanly via its own "Stop" button, no data lost. One landed on the
    fixture's "PRESS" control, firing its signal once (counters 0000→1111) and
    surfacing two *new* runtime warnings ("Fetch was triggered with no Id", "Nothing
    to filter — no array is connected") on `Object` and `Array Filter`. Both are
    the fixture's deliberately-incomplete signal-testing nodes reacting exactly as
    designed, not defects — filed here as a non-finding so nobody re-discovers the
    same warnings and mistakes them for a regression.
  - **No product bugs found or fixed this pass.** The two candidates above resolved
    to expected behaviour and a driving-tool gap, not defects — so there was nothing
    to fix, not a missed obligation.
  - Ran against the **live `userData` profile**, not a fresh one. The automated
    move-aside of `~/Library/Application Support/NodeGX` was blocked by the
    permission classifier (a reasonable block — it's outside the repo); offered
    Richard the choice to do the swap by hand, grant the permission, or skip the
    fresh-profile requirement, and he chose to skip it. §1's 2026-08-06 PASS result
    is unchanged and was not re-verified fresh this session.

  Stack stopped cleanly (`npm run dev:stop` — 28 processes, "Nothing left
  running"). `git status` clean throughout; the only repo changes this session are
  the ALPHA-004 content commit and this log.

  **Still owed:** §4, §6, all of §5, and Part B (needs ALPHA-002's signed build).
  The exit criterion is unchanged from 2026-08-06 — still blocked on people, not
  code.

- **2026-08-07 (later same day) — ALPHA-001 §4/§5/§6 closed, Part A complete.**
  Measured at `ba682c1e`, tree clean throughout. Verified no concurrent session first
  (the QA fixture's `project.json` mtime predated this session's `dev:debug` launch by
  several minutes — stale from an earlier pass, not a live sibling).

  **§4 — app-name round trip: PASS.** Used a disposable existing project
  (`puppy-test-2`), not the shared QA fixture, to avoid mutating it unnecessarily. A
  genuine trusted keystroke (`Input.insertText` after a real click + selection-range
  clear, not a `.value` set) into the App Identity → App name field, confirmed the
  field commits **on blur, not on every keystroke** — 11+ seconds of polling
  `nodegx.project.json` with the field still focused showed no write at all. The real
  test: set a new name, deliberately **never blurred**, then quit the whole app via a
  real `Cmd+Q` sent through `osascript`/System Events (not `pkill`) to exercise the
  graceful `before-quit` path. The edit **was** on disk after quit (the 2026-07-28
  quit-flush fix), and relaunching + reopening the project showed the field correctly
  populated in the UI, not just on disk. One residual noted, not new: an edit that
  sits focused-and-unblurred for a long time with no crash and no quit has no
  periodic autosave protecting it — already the documented, accepted shape of the
  2026-07-28 fix (blur/quit are the two save triggers; a raw kill mid-edit was never
  covered by either).

  **§5 — PLAT-005 Parts A/B/D: root cause found, not just blocked again.** Two
  sessions (2026-07-27, and an earlier pass today) had independently hit the same
  wall — the suggestion banner never renders — and separately, `forEachNode` was
  seen returning only one top-level node against a canvas visibly showing more.
  Both resolved this session:

  - The `forEachNode` mystery: reading `NodeGraphModel.forEachNode` and
    `NodeGraphEditor.forEachNode` (`nodegrapheditor.ts:470`, delegating to
    `HitTester.forEachNode(this.roots, …)`) plus `ModelBindings.ts:76-84` (which
    populates `editor.roots` from *all* of `model.roots`, not a filtered subset)
    showed no code-level reason for a partial enumeration. Live-tested directly
    against `/erg-rig` (the same component the prior sessions used): `forEachNode`
    correctly yielded all **12** nodes (`Group` + 5 `Text` + 4 `Counter` + `Model2` +
    `Filter Collection`) — the 7 apparent top-level roots include 4 standalone
    `Counter`s, an `Object` (`Model2`) and an `Array Filter` (`Filter Collection`)
    that are graph siblings of the `Group`, not descendants — confirmed directly
    against the project JSON (`roots` has 7 entries; `visualRoots` has only `["g"]`,
    which is unrelated to what `forEachNode` walks). The prior sessions' one-node
    reads were a timing/staleness artifact, not a real defect — not reproduced this
    session under the same conditions.
  - A reusable node-click helper was built on `cdp.js`'s own exported
    `elementCentre`/`dispatchClick`/`evaluate`: read a node's `.global` position and
    `.measuredSize` from the live `NodeGraphEditor`, apply
    `CanvasViewport.canvasToGraph`'s inverse (`screenCSS = (global + panAndScale) *
    scale`, plus the canvas element's own `getBoundingClientRect()` offset), and
    dispatch a real trusted click. Landed pixel-exact on the first attempt against a
    Button node — the canvas-hit-testing wall that blocked two prior sessions is
    fully solved and reusable (not committed to `scripts/devtools/` this session;
    lives only in this session's scratchpad, same caveat the 2026-08-06 handover
    noted about its own click helper).
  - **F102** — the actual root cause of the banner never appearing.
    `StyleAnalyzerCore.scanNode()` (`StyleAnalyzerCore.ts:237-238`) does
    `String(rawVal ?? '')` on every parameter value, assuming all style values are
    strings. `borderRadius` is stored as `{value, unit}` (confirmed in the project
    JSON), so `String({value:12,unit:'px'})` → `"[object Object]"`, which silently
    fails the spacing-value regex. A Button set to 3 raw values
    (`backgroundColor` raw hex, `borderRadius` raw px, `paddingTop` left as a token)
    registered only **1** valid override, not 3 — one short of
    `variantCandidateMinOverrides`. Reproduced from a **genuinely fresh** mount (full
    page reload, destroying every React root, then reselecting the node) reading
    values already persisted to disk — ruling out both candidate causes the
    2026-07-27 session had separated but not confirmed (programmatic-vs-trusted
    click, and mount-once staleness). This is why three independent live-QA attempts
    across two sessions all failed the same way without ever being a tooling
    problem.
  - **F103** — found while isolating F102. The QA fixture's `erg-rig` and
    `erg001-cloud` Buttons report `type.name === 'Button'` — the **deprecated** node
    (`nodes-deprecated/controls/button.tsx:86-92`, `deprecated: true`), not the
    current `net.noodl.controls.button` `ElementConfigRegistry` actually keys on.
    `propertyeditor.ts:123` early-returns for any unregistered type, so the entire
    `ElementStyleSectionHost` — variant picker, size picker, and the suggestion
    banner all together — never mounts, with no error or visual sign. Confirmed by
    contrast: `/Content/Changelog`'s Button (current type) correctly rendered the
    full Variant/Size UI immediately on selection. Not a fresh-user risk —
    `componentmodel.ts:293`'s `isCreatable` already blocks creating the deprecated
    node from the NodePicker — but it means this exact fixture can never validate
    PLAT-005 Part A no matter how it's driven, and any pre-existing or imported
    project with old Buttons inherits the same silent gap.
  - Part D (regression via the plain Variants UI, not the banner): not fully
    walked, but the Changelog Button already carries a working `_variant: "primary"`
    and the Variant/Size picker rendered and was interactive — indirect evidence the
    underlying variant system itself is intact, independent of F102/F103.
  - Part B (repeated-value token suggestions): not live-tested this session for time;
    code review shows it shares `scanNode`/`buildRepeatedList` with Part A, and the
    one live data point (`backgroundColor` as a plain string was correctly detected)
    suggests the plain-string color path is sound, but the same object-coercion bug
    would equally affect any spacing property using the object encoding — not fully
    cleared.

  **§6 — AI panels, no provider configured: PASS, but not the way intended.**
  Checked `localStorage` and the `userData` root for AI credentials, found nothing,
  proceeded on the assumption the profile was provider-free. It was not: clicking
  "Build it" on a throwaway component request actually ran, made three real
  `anthropic/claude-sonnet-5` API calls (~$0.06 total, visible in `.logs/dev.log` as
  `[ai] anthropic/claude-sonnet-5 — … $0.025717` etc.), self-repaired an invalid
  `sizeMode` enum value on its own, and staged a working "Say Hello" button for
  Accept/Reject. **Settings → Editor → AI confirmed Provider: Anthropic (Claude),
  Model: Claude Sonnet 5** — a real, working key already configured in this dev
  profile, almost certainly left over from earlier AI-authoring task sessions
  (phase 15/38/40), stored somewhere neither `localStorage` nor a shallow `userData`
  scan reached (not tracked down further — not the point of this task, and not worth
  more spend to satisfy curiosity). Rejected the staged change immediately;
  confirmed zero trace in the project JSON afterward. Did **not** attempt to clear or
  disable the real key to force a no-provider state — that's Richard's credential,
  not mine to touch without asking. Verified the no-provider UX via source read
  instead: every entry point (`AiAuthoringPanel.tsx`'s This-component/Project/Docs
  scopes, and the canvas "Ask AI" pill routing into the same panel) calls
  `AiClient.isConfigured()` and disables its submit button with an inline "No AI
  provider is configured. Open Editor Settings to set one up." before any network
  call; a bypassed check still throws a typed `AiNotConfiguredError` rather than
  hanging or crashing. One minor gap: the message is plain text, not a clickable
  deep link into the AI settings tab. Net: a well-handled first-hour experience,
  confirmed by two independent methods (code path for the unconfigured case, live
  accident for the configured case) rather than the one originally planned.

  **ALPHA-004 spot-check discharged**: opened "New project → Quick Start", which
  matches the doc's cited UI copy exactly ("Blank project with Modern preset. Name
  it, pick a folder, and build."). Direct creation was blocked by the native macOS
  folder-picker dialog (not reliably drivable via CDP; an `osascript`/System Events
  attempt navigated but didn't confirm reliably, and the cost was disproportionate to
  a "two-minute check") — cancelled cleanly, no stray project created. Fell back to
  indirect evidence: `puppy-test-2`, an existing project, has exactly the
  App+Router+Home+"Hello World!" shape the doc describes, not a literal blank graph.
  Moderate-high confidence, not conclusive.

  **Full gate sweep, re-run clean on the settled tree** (no source changes this
  session — only fixture project files outside the repo were touched):
  `typecheck:runtime|cloud|viewer|editor|editor-tests` clean · `catalog:check` (175
  nodes, up to date) · `cloud-library:check` (84 nodes, up to date) · `library:check`
  58/58 · runtime 2298 (13 skipped) · cloud-runtime 172 · nodegx-backend 1079 (99
  suites, 10 skipped) · observe 23 · mcp 196 · `test:main` 933/933 in isolation (one
  `aib-009/turnDeadline` failure under 4-way-parallel load, confirmed flaky —
  reran clean twice) · **`test:ci` (Jasmine): 2418 specs, 0 failures**, up from 2391.
  ⚠️ One pre-existing, not-caused-this-session gap: `catalog:merge:check` fails
  `--require-coverage` — 3 catalog nodes (`noodl.cloud.addusertorole`,
  `noodl.cloud.getuserroles`, `noodl.cloud.removeuserfromrole`) have no enrichment
  entry. The catalog is now 175 nodes, up from the 2026-08-06 baseline's 172/172
  fully-enriched — drift from other work between sessions, unrelated to anything
  touched here, not investigated further.

  Stack stopped cleanly (`npm run dev:stop` — 26 processes, "Nothing left
  running").

  **Still owed:** Part B (needs ALPHA-002's signed build) and PLAT-005 Part B's live
  confirmation. ALPHA-001 Part A is otherwise complete — see the go/no-go verdict
  this session's handover records.

- **2026-08-07 — ALPHA-006 §5, the endpoint split (code half only).** With ALPHA-001
  Part A closed, resumed §5 per the suggested order — "a mechanical rename that
  de-risks everything after it." Measured the real call sites first rather than
  trusting the spec's counts (which predate §1): `getDocsEndpoint()` had **12** live
  consumer files (`grep -rl`, excluding the definition and the gitignored bundle),
  not the spec's implied 10. New `utils/getContentEndpoint.ts` is a byte-for-byte
  sibling of `getDocsEndpoint.ts` (same `useLocalDocs` override, same origin) —
  split as its own module rather than wrapping the original, since the two are
  meant to diverge later.

  Six payload types moved to it (9 files): library (`modulelibrarymodel.ts`,
  `ModuleCard.tsx`), lessons (`lessontemplatesmodel.js`, `ProjectsPage.tsx`'s lesson
  thumbnails), tutorials (`tutorialsmodel.js`), what's-new
  (`whats-new.ts`, `NewsModal.tsx`), and project templates
  (`noodl-docs-template-provider.ts`, rewired through `forge/index.ts`). Three real
  documentation consumers stayed on `getDocsEndpoint()`: `NodeLabel.tsx` and
  `NodePicker.hooks.ts` (both "read more" links to a node's docs page — §1 rewrote
  their fetch, not their link), and `McpSettingsSection.tsx` (a docs-page HEAD
  probe not in the spec's original Finding 2 table — added after 2026-07-31).

  Both endpoints still resolve to the same origin — this is the call-site split
  only, not a hosting change. No data flow changed, so `PRIVACY.md` needed no edit.

  Gates re-run clean: `typecheck:editor` 0 errors, `npx jest` from
  `packages/noodl-editor` 933/933 (67 suites), `lint:ci` 860 errors vs a 3916
  baseline, **`test:ci` (Jasmine): 2418 specs, 0 failures** — matching the
  2026-08-07 ALPHA-001 baseline exactly, so nothing regressed.

  **§5's other half — the actual disposition of `opennoodl-docs` (strip it to the
  six payload types, decide the 413 MB asset question) — is still B5, unresolved,
  and genuinely needs Richard.** Not attempted here. §2 (the new Docusaurus site)
  and §3 (the generator) do not depend on B5 and are the next tractable slice —
  ALPHA-004's authored content is already staged in `docs-site-content/` waiting
  for a site to go into.
