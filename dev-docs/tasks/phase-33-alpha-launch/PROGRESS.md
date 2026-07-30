# Phase 33 — Progress

**Track R — Alpha Launch**
**All 5 tasks specced as of 2026-07-30. None started.**
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| Task | Tier | Status | Notes |
|---|---|---|---|
| [ALPHA-001](./ALPHA-001-FIRST-HOUR.md) The cold-install first hour | 1 | 📋 Specced | Discharges seven tasks' owed live-QA in one pass. Part A can start as soon as the tree is clean; Part B needs ALPHA-002 |
| [ALPHA-002](./ALPHA-002-RELEASE-CUT.md) A release that reaches a Mac | 1 | 📋 Specced | **The v0.1.0 draft has no macOS artifacts at all.** The credential half is human-only and is the long pole |
| [ALPHA-003](./ALPHA-003-CRASH-AND-FEEDBACK.md) Find out when it breaks | 2 | 📋 Specced | Depends on ALPHA-005 — nothing transmits before a policy names it |
| [ALPHA-004](./ALPHA-004-USER-DOCS.md) Documentation for someone who is not us | 2 | 📋 Specced | Blocked on phase 30 Tier 1 + NDA-005. Node reference is **generated**, never authored |
| [ALPHA-005](./ALPHA-005-LEGAL-SURFACE.md) The paperwork that ships with a binary | 2 | ✅ **Complete** | 2026-07-30. `PRIVACY.md` + `TERMS.md` written from the code, licence fields added, both reachable from the Application/Help menus and shown at first run. **Criterion 5 (an outside reader) is owed** — see below |

## Recommended order

1. **ALPHA-002's credential steps** — human-gated and the longest lead time. Start it
   before anything else, because nothing else can be tested end to end until a
   signed build exists.
2. **ALPHA-005** — half a day, unblocks ALPHA-003.
3. **ALPHA-001 Part A** — as soon as the working tree is clean.
4. **ALPHA-003**.
5. **ALPHA-001 Part B** — needs the build from step 1.
6. **ALPHA-004** — after phase 30 Tier 1 lands, so the node reference has something
   true to generate from.

## Findings register

Findings from this phase's tasks are recorded here with file and line. ALPHA-001 is
expected to be the main contributor. F-numbers continue the shared sequence used by
phases 25 and 27 — check the highest existing number before allocating.

| # | Finding | Where | Owner |
|---|---|---|---|
| F63 | **A hardcoded GitHub OAuth client secret ships in the binary.** `GITHUB_CLIENT_SECRET` falls back to a literal when the env var is unset, so every distributed build contains it and anyone can impersonate the app to GitHub | `packages/noodl-editor/src/main/github-oauth-handler.js:19` | **Unowned — needs a decision.** The fix is a public OAuth client (PKCE, no secret) or device flow |
| F64 | **The GitHub token is not stored the way its own docstring claims.** The header says "encrypted using Electron's `safeStorage` … OS-level encryption"; the code uses only `electron-store`'s `encryptionKey`, a literal embedded in the app. Verified: zero `safeStorage` references in the file. AI keys *do* use `safeStorage` — the two credential stores disagree | `packages/noodl-editor/src/editor/src/services/github/GitHubTokenStore.ts:1-31` | Unowned. `PRIVACY.md` §8 documents the real behaviour rather than the docstring |
| F65 | **Dead cloud config ships in every build.** `apiEndpoint` (`api.noodlcloud.com`), `domainEndpoint` and `aiEndpoint` (an AWS Lambda URL) are declared in `config.js`/`config-dist.js`/`config-dev.js` and have **zero consumers** anywhere in source. Harmless today, but it reads like a live third-party data flow to anyone auditing the app | `packages/noodl-editor/src/shared/config/` | Unowned — safe deletion |
| F66 | **The update check polls GitHub every 60 seconds, forever.** `update-not-available` re-arms a 60s timer, so an idle editor makes ~1,440 requests a day. The retry-on-error path does the same | `packages/noodl-editor/src/main/src/autoupdater.js:44-48` | ALPHA-002 |
| F67 | `packages/noodl-editor/package.json` is **committed minified onto a single line** with no trailing newline, so every diff touching it is unreadable | — | ALPHA-002 (touching that file anyway) |
| F68 | The About window read `Copyright (c) 2023 Future Platforms AB` and the menu item said "About Application" | `packages/noodl-editor/src/main/main.js:562-568` | ✅ **Fixed 2026-07-30** — now "About NodeGX", GPL-3.0 with the fork attribution kept |
| F69 | The Help Center's links still point at **`docs.noodl.net`**, the Noodl forum and the Noodl Discord, and its Algolia index is `docs_2-9` — Noodl's old documentation index | `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx` | ALPHA-004 |

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
