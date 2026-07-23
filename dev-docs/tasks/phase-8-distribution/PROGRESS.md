# Phase 8: Auto-Update & Distribution - Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🟡 Mostly not started, with one significant partial (CI build matrix) and one task superseded

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside tests.
- **Complete** — deliverable exists, tested, and (for this build/release phase) wired into the actual build/release pipeline (package.json build config, electron-builder targets, GitHub Actions workflows) — not merely present as a script or stub.
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary

The previous PROGRESS.md (dated 2026-01-07) claimed all five tasks were 0%/"Not Started." That is **mostly still accurate**, with two corrections. First, **TASK-7.1 (rebrand to Nodegex) is not merely not-started — it has been explicitly superseded**: `dev-docs/tasks/phase-20-ecosystem/ECO-005-REBRAND-DECISION.md` reclassifies the rebrand as a deliberately-deferred decision gated behind product traction ("the default is no"), and `dev-docs/tasks/phase-12-reanimation/REV-007-SHIP-V0.md` states explicitly: "Ship under the current name." The product is not going to be called Nodegex any time soon, so tracking TASK-7.1 as an open TODO is actively misleading. Second, **TASK-7.5 (GitHub Actions CI/CD) has real, non-trivial partial progress** that the old doc missed entirely: `.github/workflows/nightly.yml` (landed in REV-003, commit `f02d1e9`) already runs a four-platform packaging matrix (linux-x64, win32-x64, darwin-arm64, darwin-x64) daily and uploads unsigned installers as artifacts — it just deliberately runs with `DISABLE_SIGNING: true` and is not tag-triggered or publish-to-GitHub-Releases. Everything else (7.2 macOS signing, 7.3 auto-update publish config, 7.4 Linux AppImage) remains genuinely not/barely started, and all of it — including finishing 7.5 — is explicitly the scope of **REV-007 ("Ship v0 — Signed Builds & Auto-Update")** in `dev-docs/tasks/phase-12-reanimation/REV-007-SHIP-V0.md`, which itself states plainly: "No signed builds, no release channel, no auto-update feed." A notable and slightly alarming finding: Linux AppImage support was actually built and working in Dec 2024 (commits `42f6aed`, `8b4b4b8`) and then **explicitly reverted** ten days later (`c6460b2 "Revert 'Fix linux builds'"`), leaving the `linux.target` back at `deb`-only — this is a regression, not a gap that was never addressed.

---

## Task Status

| ID | Title | Status | Evidence (commit / file) | Notes |
|----|-------|--------|---------------------------|-------|
| 7.1 | Rebrand to Nodegex | **Superseded** | `dev-docs/tasks/phase-20-ecosystem/ECO-005-REBRAND-DECISION.md`; `dev-docs/tasks/phase-12-reanimation/REV-007-SHIP-V0.md` line 35 ("Ship under the current name"); current `packages/noodl-editor/package.json` still has `productName: "OpenNoodl"`, `appId: "com.opennoodl.app"`, protocol `opennoodl://` | Rebrand decision moved to Phase 20 (ECO-005), gated behind demonstrated traction post-Gate-G2. No "Nodegex" string exists anywhere in current code, config, or app-facing docs (verified via repo-wide search) — this was never implemented and per ECO-005 will not be revisited until much later, if at all. Do not treat as an open TODO for near-term work. |
| 7.2 | Fix macOS Code Signing | **Not started** | `packages/noodl-editor/package.json` build.mac block (`hardenedRuntime: true`, `entitlements` set, but no `CSC_NAME`/`CSC_LINK` wiring, no `gatekeeperAssess`, no explicit target array, no `asarUnpack` for dugite/desktop-trampoline); `packages/noodl-editor/build/macos-notarize.js` is a one-line stub: `console.log('Notarization skipped - Windows build')` | The notarize script's own message ("Windows build") shows it's a placeholder that was never filled in for macOS — notarization is currently a no-op. CI (`.github/workflows/nightly.yml`) builds macOS with `DISABLE_SIGNING: true`. Closing task: **REV-007** (Ship v0), step 2 in its implementation steps ("macOS signing and notarisation locally first"). |
| 7.3 | Configure Auto-Update Publishing | **Not started** | `packages/noodl-editor/package.json` build block has no `publish` key at all; `packages/noodl-editor/src/main/src/autoupdater.js` (unchanged since `b9c60b0` initial commit) is wired into `main.js:268` (`AutoUpdater.setupAutoUpdate(win)`) and the UI popup (`showAutoUpdatePopup`) is wired into `BaseWindow.tsx` and `editor/index.ts` | The UI/IPC scaffolding the task doc describes as "already exists" is accurate and pre-dates this task — but it is disconnected from any real feed: no publish provider, no update server, so `checkForUpdates()` has nothing to check against. This is genuinely unstarted work, not a wiring gap. Closing task: **REV-007**, step 5 ("Auto-update wiring... against GitHub Releases"). |
| 7.4 | Linux Universal Distribution | **In progress** (regressed) | `packages/noodl-editor/package.json`: `linux.target = "deb"` only, no AppImage; commits `42f6aed` ("Build appimage instead of deb for linux") and `8b4b4b8` ("Take appimages into account during packing"), both Dec 19 2024, **reverted** by `c6460b2` ("Revert 'Fix linux builds'", Dec 29 2024); no `build/icons/` directory exists in the current tree (icon files present in Dec 2024 were later removed) | AppImage was built, then explicitly reverted — a regression rather than an untouched gap. `.deb` target does build (unsigned, via nightly CI). No Linux auto-update enablement in `autoupdater.js` (it returns early on `process.platform === 'linux'`). Closing task: **REV-007**, "Linux: AppImage and/or deb/rpm as chosen." |
| 7.5 | GitHub Actions CI/CD | **In progress** | `.github/workflows/nightly.yml` (landed `f02d1e9`, "feat(REV-003): stand up GitHub Actions CI with six merge gates") — matrix build across linux-x64/win32-x64/darwin-arm64/darwin-x64, runs daily, uploads unsigned installers as artifacts; `.github/workflows/build-noodl-editor.yml` is an older, largely superseded manual-dispatch equivalent; no `release.yml`, no tag-triggered workflow, no GitHub Release creation, no certificate secrets configured | Real, working CI packaging infrastructure exists and is more than the old PROGRESS.md credited — but it is explicitly and deliberately unsigned/unpublished (`DISABLE_SIGNING: true`, per the workflow's own comment: "Signing and publishing arrive with REV-007"). Closing task: **REV-007**, items "Release workflow in GitHub Actions triggered by version tags" and "Apple Developer ID signing + notarisation." |
| 7.6 | Windows Code Signing (optional, no task doc) | **Not started** | No `WIN_CSC_LINK`/`CSC_LINK` for Windows in `package.json`; `nsis` target builds unsigned | Never had its own task spec in this folder; carried in the old PROGRESS.md as an optional stretch item. Closing task: **REV-007**, "Windows code signing (certificate acquisition may gate this — start early)." |

---

## Flagged for human review

None of the above evidence was ambiguous — package.json, the notarize script, the workflow files, and the git history for the AppImage revert are all unambiguous. The one judgement call worth flagging: TASK-7.1 is marked **Superseded** rather than **Not started**, because the decision to *not* do it now is itself a documented, deliberate decision (ECO-005), not an absence of work. If a reviewer prefers to track "superseded" only for goals that were *achieved* by different means (rather than *deferred*), this could arguably be relabeled "Not started, deferred to ECO-005" — flagging for a second opinion rather than guessing which convention the audit intends.

---

## Dependencies

**Depends on:** Phase 0-3 (stable editor)

**Effectively depends on / is subsumed by:** `dev-docs/tasks/phase-12-reanimation/REV-007-SHIP-V0.md`, which now owns the actual delivery of signing, publishing, Linux packaging, and CI release automation. TASK-7.2 through 7.5 in this folder should be read as background/reference material for REV-007's implementer, not as separate work items still to be scheduled independently.

```
7.1 Rebrand ──╳ (superseded by ECO-005; do not schedule)

7.2 macOS Signing ─┐
7.3 Auto-Update ───┼──► REV-007 "Ship v0 — Signed Builds & Auto-Update"
7.4 Linux Distro ──┘         (Phase 12 — Reanimation)
7.5 GitHub Actions CI/CD (partially done via nightly.yml) ──► REV-007 finishes signing+publish
7.6 Windows Signing (optional) ──► REV-007
```

---

## Success Criteria (from README.md, unchanged — none yet met)

1. ⬜ User can receive update notification without losing projects — not possible yet, no publish feed configured
2. ⬜ macOS build requires zero manual signing steps — notarize script is a stub
3. ⬜ Linux AppImage runs on Ubuntu 22.04+ without dependencies — AppImage target was reverted
4. ⬜ `git tag v1.2.0 && git push --tags` triggers full release — no release workflow exists
5. N/A "Nodegex" branding — superseded, ship stays "OpenNoodl" (see ECO-005, REV-007)
6. ⬜ Existing OpenNoodl users' data migrates automatically — N/A per above (no rename underway)

---

## Recent Updates

| Date       | Update                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| 2026-07-23 | **REV-007 landed the release infrastructure that supersedes this folder** (`dev-docs/tasks/phase-12-reanimation/REV-007-SHIP-V0.md`). Closes the *code* side of 7.2 (real `@electron/notarize` hook, gated), 7.3 (GitHub `publish` feed wired to the existing `electron-updater`), 7.4 (AppImage target restored after the Dec-2024 revert), 7.5 (tag-triggered `release.yml`), and 7.6 (Windows signing env wired). **Not closed here — deliberately human-gated:** signing certificates/notarisation credentials → CI secrets, clean-machine verification, and the public v0.1.0 cut (see `dev-docs/guidelines/RELEASE-PROCESS.md` §1). Note also that REV-007 **rebranded the product OpenNoodl → NodeGX** (`com.nodegx.app`, v0.1.0), which *overrides* 7.1's "Superseded/ship-as-OpenNoodl" reasoning and ECO-005's deferral — a user-directed override recorded in the REV-007 docs. This folder remains reference material; REV-007 owns delivery. |
| 2026-07-23 | REV-006 documentation truth pass: rewrote this file against code + git history; corrected 7.1 to Superseded (ECO-005), corrected 7.5 to In progress (nightly.yml CI matrix exists), documented the Dec 2024 AppImage build-then-revert for 7.4, named REV-007 as the closing task for 7.2/7.3/7.4/7.5/7.6 |
| 2026-01-07 | Updated PROGRESS.md to reflect actual task status (superseded by this pass — was already stale in some respects) |
| 2026-01-07 | Renumbered from Phase 7 to Phase 8 |

---

## Notes

Previously Phase 7 "auto-update-and-distribution". Covers macOS code signing, Windows signing, auto-update infrastructure, Linux distribution, and GitHub Actions CI/CD. No per-developer progress file (`PROGRESS-*.md`) exists in this folder as of this audit — all evidence here comes directly from code and git history per REV-006's evidence-priority order.

See [README.md](./README.md) for the original technical analysis and architecture decisions (still broadly accurate as a design reference; only the "what already exists" table there is now outdated — e.g. it lists the notarization script as "✅ Exists" without noting it is a non-functional stub).
