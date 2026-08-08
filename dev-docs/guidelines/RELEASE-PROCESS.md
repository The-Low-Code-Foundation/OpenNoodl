# Release Process — NodeGX

How to cut, verify, publish, and roll back a signed NodeGX release.

> **Status (updated 2026-08-08, after shipping v0.1.4).**
>
> **macOS is signed and notarised.** The five Apple secrets were added to the
> repository on 2026-08-07 and both v0.1.3 and v0.1.4 built with them. From a
> release log:
>
> ```
> • signing  file=dist/mac-arm64/NodeGX.app type=distribution
>            identityName=Developer ID Application: Osborne Solutions (…)
> • notarization successful
> [notarize] Notarisation complete — ticket will be stapled by electron-builder.
> ```
>
> **macOS auto-update therefore works from v0.1.4 onward**, and this section used
> to say the opposite. Squirrel.Mac requires a signed app, so the in-app updater
> had nothing it could install for as long as builds were unsigned; that is no
> longer the case. v0.1.3 → v0.1.4 is the first pair where both ends are signed
> and so the first upgrade that can be tested end to end — see §"Auto-update
> (needs two releases)".
>
> **Do not paste [INSTALLING-UNSIGNED-BUILDS.md](./INSTALLING-UNSIGNED-BUILDS.md)
> into macOS release notes any more.** It tells users to bypass Gatekeeper, which
> is now both unnecessary and bad advice. It remains correct for Windows until
> the item below is closed.
>
> **Windows signing is NOT confirmed.** `WIN_CSC_LINK` is unset, so no certificate
> is provisioned — but electron-builder still logged `signing with signtool.exe`
> and raised no error, which is ambiguous rather than reassuring. Nobody has run
> a Windows artifact on a clean machine to see whether SmartScreen blocks it.
> Treat Windows as unsigned until someone checks, and keep the unsigned-install
> instructions in the notes for that platform.
>
> The infrastructure itself has been complete since REV-007: tag-triggered CI,
> per-platform signing hooks, notarisation, auto-update feed, draft-then-publish.
> [§1](#1-one-time-credential-setup-human-required) is now only outstanding for
> Windows.

---

## 0. TL;DR

```bash
# 1. Bump the version in packages/noodl-editor/package.json (e.g. 0.1.0 -> 0.1.1).
# 2. Commit it.
# 3. Tag and push:
git tag v0.1.1
git push origin v0.1.1
# 4. Watch the "Release" workflow in GitHub Actions.
# 5. Go to GitHub → Releases → the new DRAFT release.
# 6. Download and smoke-test each platform artifact on a CLEAN machine.
# 7. Click "Publish release". Only now can existing installs auto-update.
```

The tag **must** match the `version` in `packages/noodl-editor/package.json`
prefixed with `v`. electron-builder names the release from the package version,
not the tag; a mismatch produces a confusing release.

---

## 1. One-time credential setup (human required)

None of this can be automated — each step involves an external account,
payment, or identity verification. Do it once; the secrets then live in GitHub
and every release uses them.

### 1a. macOS — Apple Developer ID + notarisation

1. Enrol in the [Apple Developer Program](https://developer.apple.com/programs/)
   (~US$99/year). Allow days for approval.
2. In the Apple Developer portal, create a **Developer ID Application**
   certificate. Download it and export it from Keychain Access as a `.p12`
   (set a strong password).
3. Base64-encode the `.p12`: `base64 -i DeveloperID.p12 | pbcopy`.
4. Create an **app-specific password** for notarisation at
   <https://account.apple.com> → Sign-In and Security → App-Specific Passwords.
5. Find your **Team ID** in the Apple Developer portal (Membership details).

Add these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `CSC_LINK` | base64 of the Developer ID `.p12` |
| `CSC_KEY_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | Apple account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password from step 4 |
| `APPLE_TEAM_ID` | your Team ID |

(Alternatively, notarisation can use an App Store Connect API key —
`APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER`. See
`packages/noodl-editor/build/macos-notarize.js`.)

### 1b. Windows — code signing

1. Buy an **OV or EV code-signing certificate** from a CA (DigiCert, Sectigo,
   SSL.com, …). EV builds SmartScreen reputation faster but needs a hardware
   token / cloud-HSM flow that does not drop cleanly into `WIN_CSC_LINK`; an OV
   `.pfx` is the simplest fit for this pipeline. Allow days-to-weeks for
   identity vetting.
2. Export the certificate as a `.pfx` and base64-encode it.

Add:

| Secret | Value |
|--------|-------|
| `WIN_CSC_LINK` | base64 of the `.pfx` |
| `WIN_CSC_KEY_PASSWORD` | the `.pfx` password |

> **SmartScreen reputation:** even a correctly-signed installer from a *new*
> certificate will show a SmartScreen warning until enough users have installed
> it. This is expected and improves over time. Do not treat an early SmartScreen
> prompt as a signing failure.

### 1c. Linux

No signing credentials required. AppImage and `.deb` are produced unsigned;
this is normal for Linux desktop distribution.

### 1d. GitHub token

Publishing uses the workflow's built-in `GITHUB_TOKEN` (granted `contents:
write` in `release.yml`). No secret to add. For publishing from a *fork* or a
different repo you would need a PAT in `GH_TOKEN`.

---

## 2. What the release workflow does

`.github/workflows/release.yml`, triggered by a `v*.*.*` tag (or manual
dispatch):

1. Builds on a 4-way matrix: `linux-x64`, `win32-x64`, `darwin-arm64`,
   `darwin-x64`.
2. Runs the editor build with `DISABLE_SIGNING=false` and `PUBLISH_RELEASE=true`.
   - macOS: signs with the Developer ID (`CSC_LINK`), then `build/macos-notarize.js`
     notarises with Apple and electron-builder staples the ticket.
   - Windows: signs the NSIS installer (`WIN_CSC_LINK`).
   - Linux: builds AppImage + deb (unsigned).
3. electron-builder publishes every artifact **plus the update manifests**
   (`latest.yml` for Windows, `latest-mac.yml` for both mac arches) to a
   **draft** GitHub Release named for the package version.

### Linux is install-only, deliberately

`src/main/src/autoupdater.js` returns early on `process.platform === 'linux'`,
so the Linux build never asks for an update feed and would not read one if it
were published: electron-updater cannot replace an AppImage it did not itself
launch, and a `.deb` belongs to the package manager. Linux users update by
downloading the next AppImage.

**A `latest-linux.yml` *is* published, and it is inert.** This section used to
say there was none and none was intended; electron-builder emits one for the
Linux targets regardless, and v0.1.4 shipped with it. Nothing reads it — the
early return above is what makes Linux install-only, not the absence of a feed.
Corrected here because the file's presence looks like a promise the app does not
keep.

The distinction is worth writing down because an absent feed and a broken feed
look identical from the outside — the v0.1.0 draft had no `latest-linux.yml` and
it was read as a bug for over a week. It was a bug, but a different one: see
below.

> **What actually happened to Linux in v0.1.0.** The leg is recorded as
> "succeeded, no update feed". It did not succeed — it **failed**, after the
> AppImage had already uploaded. electron-builder built the AppImage, uploaded
> it, then aborted building the `.deb` with *"Please specify author 'email' in
> the application package.json"*, because `author` was the bare string
> `"The Low Code Foundation"` with no address. So the release carries an
> AppImage, no `.deb`, and a red job. Fixed: `author` now carries an email, and
> `.deb` builds. The lesson worth keeping is that **a published artifact is not
> evidence of a green job** — electron-builder uploads as it goes.

### The draft is checked for completeness before you ever look at it

A `verify-release-assets` job runs after the matrix (with `if: always()`, so it
runs *because* something failed) and asserts the draft carries every expected
artifact: both mac `.dmg`s and `.zip`s, the Windows `.exe`, the AppImage, the
`.deb`, `latest.yml`, and a `latest-mac.yml` that lists **both** architectures.
It fails naming what is missing.

This exists because of the lesson in the Linux note above — a draft with files in
it is not evidence of a green run — and because the mac feed merge could
previously exit 0 with "nothing to merge", shipping a single-architecture update
feed with no symptom on the machine that cut the release. Both are now failures.

Run the rules against fixtures any time with
`node scripts/check-release-assets.js --self-test`; the PR gate does.

Because the release is a **draft**, it is invisible to the public and to
electron-updater until a human clicks Publish. An unsigned or broken build
therefore can never reach a user by accident.

**If a signing secret is missing,** that platform still builds and publishes,
but the artifact is unsigned (macOS: not notarised; Windows: unsigned). The
`macos-notarize.js` hook logs a clear "skipping notarisation" line in that case.

This is a mechanism, not a hope, and it is worth knowing which line does it.
CI passes every secret to every leg, so an *absent* secret arrives as an **empty
string** — and electron-builder reads an empty-but-set `CSC_LINK` as a
certificate *path*, failing with "`<cwd>` not a file". That is what actually
broke the v0.1.0 darwin legs. `packages/noodl-editor/scripts/build.ts` deletes
the empty ones before invoking electron-builder, which is what turns "secret
absent" into "unsigned build" rather than "failed job".

> **Add the certificates one platform at a time and it still works — but only
> because of a second guard.** `WIN_CSC_LINK` is not a separate variable to
> electron-builder, it is a *preference*: `getCscLink("WIN_CSC_LINK")` falls
> back to `CSC_LINK`, and `WIN_CSC_KEY_PASSWORD` falls back to
> `CSC_KEY_PASSWORD`. With the Apple `.p12` in `CSC_LINK` and no Windows
> certificate yet — the expected interim state — the Windows leg would import
> the Apple certificate and hand it to signtool. `scripts/build.ts` now scopes
> signing material to the target platform so that cannot happen.

**If you add the Apple *notarisation* secrets without `CSC_LINK`,** the macOS leg
fails immediately with a message naming the missing secret. Apple cannot
notarise an app that is not signed with a Developer ID, and its own error for
that arrives late and says little. Add all five macOS secrets together.

---

## 3. Cutting a release

1. Decide the new version (semver). Update `version` in
   `packages/noodl-editor/package.json`. **The version must only ever increase** —
   electron-updater compares semver and will never offer a lower version.
2. Commit on `cline-dev` (per `.clinerules`): `chore(release): v0.1.1`.
3. Tag and push:
   ```bash
   git tag v0.1.1
   git push origin cline-dev
   git push origin v0.1.1
   ```
4. Watch **Actions → Release**. All four matrix jobs must go green.

---

## 4. Verifying before publishing (do NOT skip)

The whole point of REV-007's ordering is to debug releases while the stakes are
low. Verify on **clean** machines/VMs, never a development machine — dev
machines have already trusted the app and mask signing problems.

- **macOS:** download the `.dmg`, install on a Mac that has never seen the app.
  - No Gatekeeper prompt on first launch.
  - `spctl -a -vvv /Applications/NodeGX.app` → `accepted`, `source=Notarized Developer ID`.
  - `xcrun stapler validate /Applications/NodeGX.app` → `The validate action worked!`.
- **Windows:** run the `.exe` installer on a clean Windows VM. It should install
  without a *blocked-publisher* error (an early SmartScreen "unrecognized app"
  prompt is expected for a new cert — see §1b).
- **Linux:** `chmod +x NodeGX-*.AppImage && ./NodeGX-*.AppImage` on a clean
  Ubuntu 22.04+ box; it should launch with no extra dependencies.
- **Auto-update (needs two releases):** install version N, publish version N+1,
  confirm the running app detects it, downloads it, shows the update popup, and
  that **declining** leaves N running while **accepting** restarts into N+1.

Only when every platform you intend to ship passes: **GitHub → Releases → the
draft → Publish release.**

---

## 5. Rollback

If a bad release has been published:

1. **Stop new installs / auto-updates immediately.** In GitHub → Releases, edit
   the bad release and either **delete** it or set it back to **draft**.
   electron-updater reads the *latest published* release; removing it stops it
   being served. Deleting the release does **not** delete the git tag.
2. If a good older release exists, it becomes "latest" again automatically once
   the bad one is unpublished — clients will not downgrade (semver), but new
   downloads get the good one.
3. **Ship a forward fix, do not rely on downgrade.** Because electron-updater
   never moves users to a lower version, the real remedy for a bad N is to
   publish a fixed N+1 quickly. Bump the version, fix, re-tag, re-release.
4. Delete the bad git tag if you want to reuse the number *before* anyone pulled
   it (rare — prefer a new number):
   ```bash
   git push origin :refs/tags/v0.1.1   # delete remote tag
   git tag -d v0.1.1                    # delete local tag
   ```

---

## 6. Known limitations & follow-ups (REV-007)

These are documented deliberately rather than silently shipped:

- **macOS ships as per-arch builds** (`darwin-arm64` for Apple Silicon,
  `darwin-x64` for Intel), each fully functional — the standard "which Mac do
  you have?" download split. A single-file **universal** build was evaluated and
  **deferred**: `@electron/universal` correctly refuses to ship the bundled
  single-arch native binaries (`desktop-trampoline`, `dugite`'s `git`) in a
  universal app, so a real universal build needs each arch's natives built
  separately and lipo-merged — a CI change worth doing later, not required for
  distribution now.
- ~~**macOS multi-arch auto-update feed.**~~ **Resolved.** The two mac jobs each
  write a `latest-mac.yml` and the later upload would have won, leaving the feed
  pointing at one arch. The `merge mac update feed` job now rebuilds it from both
  legs' artifacts and re-uploads; v0.1.4's published feed lists all four mac
  files (arm64 and x64, `.zip` and `.dmg`) under one `version: 0.1.4`.
- ~~**Signing is credential-gated, not verified end-to-end.**~~ **Done for
  macOS** as of 2026-08-07 — see the status banner. Notarisation ran clean on the
  first attempt, so the entitlement problems anticipated here did not materialise.
  **Still open for Windows:** `WIN_CSC_LINK` is unset and no artifact has been run
  past SmartScreen on a clean machine.
- **The auto-update *upgrade path* has still never been exercised.** Signing was
  the blocker and it is gone, but "0.1.3 installs 0.1.4 by itself" has not been
  observed. It cannot be tested from CI — it needs a machine with the older
  version actually installed.
- **AppImage build is CI-verified only.** AppImage cannot be built on macOS, so
  it is exercised by the Linux runner, not locally. Local verification here
  covered the macOS packaging path only.
- ~~**App icons.**~~ **Fixed (F75).** `packages/noodl-editor/build/icon.png` is a
  1024×1024 master, which electron-builder converts to `.icns` and `.ico` for
  macOS and Windows. Linux keeps its explicit `linux.icon`
  (`src/assets/images/icon.png`, 512×512). The old text here said the build used
  a 256×256 icon; both the size and the file were wrong.
- **GitHub OAuth deep-link scheme is still `noodl://`.** The app's own protocol
  was rebranded to `nodegx://`, but the GitHub OAuth callback
  (`github-oauth-handler.js`) deliberately keeps `noodl://` because it is bound
  to the externally-registered OAuth app's redirect URI. Changing it requires
  updating that registration in the GitHub OAuth app settings first, then the
  `OAUTH_PROTOCOL` constant — an external-credential step, out of REV-007 scope.

---

## 7. Security notes

- **No credentials in the repo.** All signing material lives in GitHub Actions
  secrets. `.p12`/`.pfx` files and passwords are never committed.
- Workflow logs must never echo secret-bearing commands; electron-builder masks
  them, and the notarize hook logs only non-secret status.
- Secrets are only exposed to the `release.yml` workflow, which runs on tags.
