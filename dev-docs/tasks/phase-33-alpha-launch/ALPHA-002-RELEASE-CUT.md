# ALPHA-002: A release that reaches a Mac

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-002 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 1 — gates the alpha |
| **Priority** | 🔴 Critical — nothing else in this phase means anything until a build exists |
| **Difficulty** | 🟡 Medium — the engineering is small; the credentials are the work |
| **Estimated Time** | 2–3 days of engineering, plus whatever Apple and the CA take |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** for the CI half; the credential half is **human-only** |

## Objective

Cut a v0.1.x draft that carries a signed, installable artifact for macOS (both
architectures), Windows and Linux, with a working auto-update feed for each — and
verify each one installs on a machine that has never built NodeGX.

## The finding this task exists for

Measured 2026-07-30 against the real draft release:

```
$ gh release view v0.1.0 --json assets
latest.yml                            345 B
NodeGX-0.1.0-linux-x86_64.AppImage    194 MB
NodeGX-0.1.0-win-x64.exe              155 MB
NodeGX-0.1.0-win-x64.exe.blockmap     163 KB
```

**There are no macOS artifacts.** Not a `.dmg`, not a `.zip`, not a
`latest-mac.yml`. The release notes in the phase register describe a known issue
where the two mac legs *overwrite each other's* feed file — but the actual outcome
was worse and different: neither leg produced anything at all. macOS is the primary
development platform for this project. The one release that exists cannot be
installed on it.

Also absent: **`latest-linux.yml`**. The AppImage is there, but nothing describes it
to `electron-updater`, so Linux has an installer and no update path.

Present and correct: `latest.yml` and the Windows `.exe` + blockmap. Windows is the
only platform with a complete story, which is not the one anyone expected.

### What has since been fixed, and what that means

`.github/workflows/release.yml` in the current tree already contains fixes the
v0.1.0 tag predates:

- `macos-15-intel` replaces the retired `macos-13` image. The workflow comments
  record that macos-13 jobs "queue for 24h and are cancelled — that is what *hung*
  the v0.1.0 darwin-x64 leg."
- A `merge-mac-update-feed` job now rebuilds `latest-mac.yml` from both legs'
  uploaded artifacts, so the overwrite issue is genuinely handled.

**So the v0.1.0 tag cannot be re-run into a good state — it builds old workflow
code.** This task cuts a new tag, it does not repair the old one. Do not spend time
diagnosing the v0.1.0 run beyond what is written above.

The arm64 leg's failure is **not** explained by the macos-13 retirement and is
unexplained as of this writing. Assume nothing; read that job's log first.

## Scope

### 1. Find out why darwin-arm64 produced nothing

The Intel leg has a recorded cause. The arm64 leg does not, and it ran on a
supported image. Read the actual run log before changing anything — a fix aimed at a
guessed cause is how this comes back.

Candidates worth ruling out in order: the `afterSign` notarisation hook failing hard
rather than skipping when Apple credentials are absent; `dmg-license` (an
`optionalDependencies` entry) failing on the runner; `extraResources` pointing at a
`nodegx-backend/dist/cli.js` that the mac leg had not built.

### 2. Give Linux an update feed

`latest.yml` exists for Windows; `latest-linux.yml` does not exist at all. Either
produce it or state, in `RELEASE-PROCESS.md`, that Linux is install-only for the
alpha and why. A silently absent feed is the failure mode to avoid — an AppImage
that never updates and never says so.

### 3. The credentials

Human-only, and the long pole. Per `RELEASE-PROCESS.md`: Apple Developer ID
certificate + notarisation credentials, and a Windows code-signing certificate, into
CI secrets. Unsigned macOS builds are Gatekeeper-blocked and unsigned Windows builds
are SmartScreen-blocked, so "ship unsigned for the alpha" is not the shortcut it
sounds like — it converts every install into a support conversation.

If the certificates will genuinely not arrive in time, that is a legitimate
decision, but it must be taken deliberately and paired with
[`INSTALLING-UNSIGNED-BUILDS.md`](../../guidelines/INSTALLING-UNSIGNED-BUILDS.md)
linked from the download page — not discovered by users.

### 4. Decide the publish target

`packages/noodl-editor/package.json` publishes to
`The-Low-Code-Foundation/OpenNoodl`. The product is called NodeGX. The auto-update
feed and every download URL therefore say "OpenNoodl" to users.

This is a decision, not a defect, and it is **not** safe to change casually: pointing
`publish` at a repository that does not exist breaks releases, and moving the repo
breaks the v1.1.0 release already published under the old name. Decide it once,
here, and record it. Note that REV-007 deliberately left internal names, source dirs
and schema `$id` URIs alone — this is the same class of decision.

### 5. Verify on a machine that has never built NodeGX

For each platform: download from the draft, install, launch, create a project.
Then — separately and more importantly — verify **auto-update across two published
releases**, which by definition cannot be tested until a second release exists.

## Acceptance criteria

1. A draft release carries installable artifacts for darwin-arm64, darwin-x64,
   win32-x64 and linux-x64.
2. `latest-mac.yml` lists **both** mac architectures; `latest.yml` and the Linux feed
   (or its recorded absence) are correct.
3. Each artifact has been installed and launched on a machine that has never built
   this project, by someone following `RELEASE-PROCESS.md` and nothing else.
4. Signing status is either "signed and notarised" or "deliberately unsigned, with
   the install guide linked from the download page" — never unstated.
5. The publish-target decision is recorded with its reasoning.
6. Auto-update is demonstrated from v0.1.x to v0.1.(x+1), on at least one platform,
   between two *published* releases.

Criterion 6 cannot be met by the first release. Ship the first, then meet it — do
not let it block the cut.

## What "done" does not mean

It does not mean the release is *public*. `releaseType: draft` exists so a human
confirms before anything reaches the update feed, and that gate stays.
