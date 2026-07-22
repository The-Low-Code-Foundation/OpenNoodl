# REV-007: Ship v0 — Signed Builds & Auto-Update

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-007 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium (mostly process, credentials, and platform bureaucracy) |
| **Estimated Time** | 2 weeks |
| **Prerequisites** | REV-003 (CI), REV-004 (Electron upgrade — sign the version you intend to ship) |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟠 **Opus 4.8** — technically moderate but full of platform-specific failure modes (notarisation, entitlements, code-signing identities, update feeds) where errors are opaque and partial states are dangerous. Requires a human for credential/account steps regardless of model. |

## Objective

Produce signed, installable, auto-updating OpenNoodl builds for macOS, Windows, and Linux, published from CI, so that every subsequent milestone can ship to real users.

## Background

Distribution was scoped as Phase 8 of the original roadmap and never started. The revival plan deliberately pulls it forward into Horizon 0, for a reason worth stating plainly: **release infrastructure should be debugged when the stakes are lowest.** Building it now, against a product with no users, means the first genuinely important release (the AI-authoring demo that gates the whole strategy) is not also the first time anyone has tried to sign and ship a build.

There is a second reason. Every later phase of the revival plan produces something that needs to reach people — lessons, pilots, the AI demo, exported projects. Without a distribution channel, all of that work stays on developer machines, and the demand evidence the plan depends on cannot be gathered.

Note the deliberate ordering with REV-004: sign and ship the *upgraded* Electron, not the two-year-old one. Signing a build you are about to replace wastes the effort.

## Current State

- No signed builds, no release channel, no auto-update feed.
- `electron-builder` 24.13.3 is present and configured in `packages/noodl-editor/package.json`; `npm run build:editor:pack` (`scripts/build-pack.ts`) exists as the packaging entry point.
- `scripts/build-editor.ts` already reads a `DISABLE_SIGNING` environment flag, implying signing was anticipated but never wired.
- REV-003 will produce unsigned nightly artifacts; this task adds signing, notarisation, publishing, and update checks on top.
- The original Phase 8 folder (`dev-docs/tasks/phase-8-distribution/`) contains prior scoping (~38–56 hours estimated) — read it before starting; this task supersedes it and should note that in `phase-8-distribution/PROGRESS.md`.
- The product is currently named OpenNoodl; a possible rename ("Nodegex") is deliberately deferred to ECO-005 in Phase 20. **Ship under the current name** — renaming after there is an installed base is a known cost, but renaming before there is any traction is a distraction.

## Desired State

- macOS: signed with a Developer ID certificate and notarised by Apple; installs without Gatekeeper warnings; universal or per-arch builds as appropriate.
- Windows: code-signed installer; installs without SmartScreen blocking (reputation builds over time).
- Linux: AppImage and/or deb/rpm as chosen; documented install path.
- Auto-update: the app checks a published feed and can update itself, with a visible changelog and a way to decline.
- Releases are produced by CI from a tag, not from a developer's laptop.
- A published, working download page or GitHub Releases entry a stranger can use.

## Scope

### In Scope
- [ ] Apple Developer ID signing + notarisation (incl. entitlements and hardened runtime)
- [ ] Windows code signing (certificate acquisition may gate this — start early)
- [ ] Linux packaging (AppImage baseline)
- [ ] `electron-updater` (or equivalent) wired into the app with an update UI
- [ ] Release workflow in GitHub Actions triggered by version tags
- [ ] Secure credential storage in CI secrets; no keys in the repo
- [ ] Release documentation: how to cut a release, how to roll one back
- [ ] Update `phase-8-distribution/PROGRESS.md` to record that this task supersedes it

### Out of Scope
- App Store / Microsoft Store distribution (different review pipelines; later if ever)
- Delta/differential updates (optimisation; full updates are fine at this scale)
- Telemetry and crash reporting (worth doing, but a separate decision with privacy implications — especially given the education wedge in Phase 17)
- The rename decision (ECO-005)

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/package.json` | `build` block: signing identity, notarisation config, publish targets, per-platform artifact settings |
| `scripts/build-pack.ts` | Signing/publish invocation; honour `DISABLE_SIGNING` for local and nightly builds |
| `packages/noodl-editor/src/main/main.js` | Auto-update check on launch; update-ready notification |

### New Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/release.yml` | Tag-triggered signed build + publish for all three platforms |
| `packages/noodl-editor/build/entitlements.mac.plist` | macOS hardened-runtime entitlements |
| `dev-docs/guidelines/RELEASE-PROCESS.md` | How to cut, verify, publish, and roll back a release |

## Implementation Steps

1. **Start credential acquisition immediately** — Apple Developer Program membership and a Windows code-signing certificate both involve external approval and can take days to weeks. Everything else in this task is blocked behind them, so begin on day one.
2. **macOS signing and notarisation** locally first, with `DISABLE_SIGNING=false`; verify with `spctl -a -vvv` and by installing on a machine that has never seen the app.
3. **Windows signing**; verify the installer runs without a blocked-publisher warning (SmartScreen reputation accrues with downloads — expect early warnings even when correctly signed, and document that).
4. **Linux AppImage** build and launch verification.
5. **Auto-update wiring** — `electron-updater` against GitHub Releases (simplest credible feed); add an in-app "update available / restart to install" flow and a changelog surface. Test an actual upgrade from an older build to a newer one; that end-to-end path is the thing most often shipped broken.
6. **Release workflow** — tag-triggered, matrix across platforms, credentials from CI secrets, artifacts published to GitHub Releases as a draft for human confirmation before going public.
7. **Cut v0.1.0** and install it, as a stranger would, on a clean machine per platform.
8. **Write `RELEASE-PROCESS.md`**, including rollback: how to pull a bad release and how to stop the update feed from serving it.

## Testing Plan

- Install each platform artifact on a **clean** machine or VM (not a development machine — dev machines mask signing problems).
- macOS: confirm no Gatekeeper prompt; `spctl` assessment passes; notarisation ticket stapled.
- Auto-update: install v0.1.0, publish v0.1.1, confirm the running app detects, downloads, and applies the update, and that declining works.
- Confirm the release workflow runs from a tag with no manual laptop steps.

## Success Criteria

- [ ] Signed macOS build installs clean (no Gatekeeper warning) on a fresh machine
- [ ] Signed Windows installer runs without publisher-blocked errors
- [ ] Linux AppImage launches on a clean system
- [ ] Auto-update verified end-to-end across two consecutive releases, including decline
- [ ] Release produced entirely by CI from a version tag; no local build steps
- [ ] No credentials committed to the repository
- [ ] `RELEASE-PROCESS.md` written, including rollback procedure
- [ ] v0.1.0 publicly downloadable

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Certificate acquisition delays the whole task | Start step 1 on day one; unsigned nightly builds (REV-003) keep the team unblocked meanwhile |
| Notarisation failures with opaque error messages | Test the full notarisation path early with a trivial build rather than at the end with the real one |
| A broken auto-update ships and bricks the update path for existing installs | Test upgrades on clean machines before publishing; keep releases as drafts pending human confirmation; document rollback before the first public release |
| Signing keys leak through CI logs | Use CI secret storage, mask values, and never echo credential-bearing commands |
| Shipping before REV-004 means signing an outdated Electron | Prerequisite ordering is explicit — do not start step 2 until REV-004 has landed |

## References

- [Revival roadmap — Horizon 0](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §5 roadmap triage (phase 8)](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/tasks/phase-8-distribution/` — prior scoping, superseded by this task
- electron-builder and electron-updater documentation

## Checklist

- [ ] Branch `task/rev-007-ship-v0`; begin credential acquisition immediately
- [ ] macOS signing + notarisation verified on a clean machine
- [ ] Windows signing verified
- [ ] Linux AppImage verified
- [ ] Auto-update tested across two releases, including decline path
- [ ] Tag-triggered release workflow with secrets; draft-then-publish
- [ ] `RELEASE-PROCESS.md` incl. rollback; supersede note in phase-8 PROGRESS
- [ ] Cut and publish v0.1.0; commit to cline-dev and push
