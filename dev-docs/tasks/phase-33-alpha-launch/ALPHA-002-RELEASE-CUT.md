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

#### The edit list, so the decision is one edit rather than a hunt

Swept 2026-08-06. `productName`, `appId` (`com.nodegx.app`) and `protocols`
(`nodegx`) are already NodeGX; the About menu item reads "About NodeGX" and
`about-window` renders `productName`, so the About window is **already clean**.
What follows is everything else, split by whether it reaches a user.

**A — the decision itself (baked into every binary)**

| Where | What |
|-------|------|
| `packages/noodl-editor/package.json:73-80` | `build.publish` → `owner: The-Low-Code-Foundation`, `repo: OpenNoodl`. electron-builder writes this into `app-update.yml` **inside each artifact**, so it is the update feed for every copy already installed. Changing it strands them. |

**B — user-visible inside the running app**

| Where | What | Note |
|-------|------|------|
| `views/HelpCenter/HelpCenter.tsx:49` | `REPO_URL` | "report an issue" links |
| `utils/report/issueForm.ts:26` | `ISSUE_REPO = 'The-Low-Code-Foundation/OpenNoodl'` | its docstring claims it "matches `build.publish`" — **nothing asserts that**, so it can drift silently |
| `src/main/src/legal-window.js:268` | fallback link when a legal doc is missing from the build | |
| `views/migration/steps/FailedStep.tsx:94` | issues link | |
| `views/migration/AIConfigPanel.tsx:104,157` | prose: "OpenNoodl uses Claude…", "never sent to OpenNoodl servers" | plain product-name copy |
| `views/panels/MigrationNotesPanel/MigrationNotesPanel.tsx:128` | `https://docs.opennoodl.com/migration/react19` | a domain that may not resolve — check before or instead of renaming |
| `utils/getDocsEndpoint.ts:5` | `https://the-low-code-foundation.github.io/opennoodl-docs` | the **live** docs CDN behind the Help panel, What's New feed, tutorials and module cards. Renaming means moving that repo. |
| `services/github/GitHubClient.ts:118` | `userAgent: 'OpenNoodl/1.1.0'` | sent to GitHub; the version is stale too |
| `services/github/GitHubTokenStore.ts:30` | `encryptionKey: 'opennoodl-github-credentials'` | ⚠️ **do not change** — it is the electron-store encryption key; changing it makes every existing user's saved GitHub token undecryptable |

**C — written into users' project files**

`$schema: 'https://opennoodl.dev/schemas/*-v2.json'`, emitted by
`io/ProjectExporter.ts:302,320,337,366,411,431,521`,
`services/ProjectStructure/ComponentSaver.ts:283` and
`models/AiAssistant/authoring/candidate.ts:208,219,227`; declared in
`schemas/validator.ts:31-38` and as `$id` in the eight `schemas/*.schema.json`.
REV-007 deliberately left these alone. Changing them rewrites every saved project.

**D — the download instructions a tester follows** (worth fixing *regardless* of
the naming decision)

| Where | What |
|-------|------|
| `README.md:13-15` | download links to **OpenNoodl 1.1.0** `.dmg`/`.exe` — the old upstream release, not NodeGX. A tester following the README installs the wrong app. |
| `README.md:1,3,5,7,9,19,21,29,35,39,47,58` | title, CI badge, AUR package name, prose |
| `CONTRIBUTING.md:1,33,36` | prose |
| `.github/ISSUE_TEMPLATE/config.yml:4` | Discussions URL |

**E — CI only, no user impact**

`.github/workflows/nightly.yml:77` (artifact name `opennoodl-<platform>-<sha>`),
`.github/actions/setup/action.yml:20-21` (`ci@opennoodl.local` git identity).

**F — deliberately unchanged; record so the decision does not re-open them**

- `library/{modules,prefabs}/*/library.json` `sourceUrl` (~30 files) →
  `the-low-code-foundation.github.io/opennoodl-docs/…`. A live CDN in the docs
  repo; same move as `getDocsEndpoint`.
- `packages/nodegx-observe/src/token.ts:30` —
  `['NodeGX', 'Noodl Editor', 'OpenNoodl']`. Keeping the old names **is** the
  feature: it is how a user's existing token directory is still found.
- `utils/report/redact.ts:129` — `the-low-code-foundation.github.io` on the
  host allowlist; must track whatever `getDocsEndpoint` points at.
- The GitHub OAuth callback scheme stays `noodl://` (RELEASE-PROCESS.md §6).

### 5. Verify on a machine that has never built NodeGX

For each platform: download from the draft, install, launch, create a project.
Then — separately and more importantly — verify **auto-update across two published
releases**, which by definition cannot be tested until a second release exists.

## Pre-flight, verified statically 2026-08-06

Everything below was checked at file:line without running a packaged build. It is
what has to be true for the release to be worth cutting once the five macOS
secrets land.

### `extraResources` — the MCP-002 suspicion, resolved

The suspicion on record was that every published artifact has been missing
`Resources/nodegx-backend/cli.js`. **It is already fixed in the tree**, and not
by luck: `npm run build:sidecars` exists as the single sidecar list, both
packaging workflows run it (`release.yml`, `nightly.yml`) *before*
`build:editor:_editor`, and it ends in `check-build-artefacts.js --built`, which
turns electron-builder's "file source doesn't exist" warning into a failed build.

All six entries, resolved against the filesystem as a build leaves it. There is
no `extraFiles` and no `asarUnpack`.

| `from` | `to` | Verdict |
|--------|------|---------|
| `../nodegx-backend/dist/cli.js` | `nodegx-backend/cli.js` | built by `npm --prefix packages/nodegx-backend run build` (esbuild, `scripts/build.js`) inside `build:sidecars`; CI runs it. Consumed at `src/main/src/local-backend/ServiceSupervisor.js:80` — path matches. |
| `../nodegx-backend/dist/cli.js.map` | `nodegx-backend/cli.js.map` | same step (`sourcemap: true`). Nothing reads it; 6.6 MB of shipped sourcemap. Harmless, deliberate-looking, not verified as intended. |
| `../noodl-mcp/dist/noodl-mcp.cjs` | `noodl-mcp/noodl-mcp.cjs` | built by `packages/noodl-mcp/build.mjs:29`; in `build:sidecars`. Consumed at `src/main/src/mcp/resolveMcpServer.js:100-101` — path matches. |
| `../nodegx-observe/dist/nodegx-observe.cjs` | `nodegx-observe/nodegx-observe.cjs` | built by `packages/nodegx-observe/build.mjs:22`; in `build:sidecars`. Same consumer — path matches. |
| `../../PRIVACY.md` | `legal/PRIVACY.md` | tracked file, present. Consumed at `src/main/src/legal-window.js:46` — path matches. |
| `../../TERMS.md` | `legal/TERMS.md` | tracked file, present. Same consumer. |

**What was actually broken was the check.** `scripts/check-build-artefacts.js`
asserted that a `dist/` source's package is *mentioned in
`scripts/build-editor.ts`* — a file CI never runs. Three holes, all closed:

- the two tracked sources were skipped entirely without `--built`, and `--built`
  only runs during a packaged build, so a rename would have surfaced at release
  time;
- `extraFiles` and bare-string entries were never read at all;
- nothing asserted that a packaging *workflow* builds the sidecars — which is
  what MCP-002 actually was, and is invisible to any path check.

Now: check 2 anchors on `npm run build:sidecars`, asserts tracked sources on
every commit, and check 3 fails any workflow that runs `build:editor:_editor`
without `build:sidecars` in front of it. Gate: `pr.yml` → `artefacts`, plus
`check-build-artefacts.yml`. Both already ran this script; neither needed a new
line.

### What would have failed *after* the credentials land

🔴 **The Windows leg would sign with the Apple certificate.** `release.yml` hands
every matrix leg every secret. `WIN_CSC_LINK` is not a separate variable to
electron-builder, it is a preference:
`app-builder-lib/out/platformPackager.js:83` returns
`chooseNotNull(process.env.WIN_CSC_LINK, process.env.CSC_LINK)`, and
`winPackager.js:104` does the same for the password. With the Apple `.p12` in
`CSC_LINK` and no Windows certificate bought yet — the *expected* interim state —
`windowsSignToolManager` imports the Apple certificate (it is a valid `.p12`, so
the import succeeds) and hands it to signtool, which fails on a leg that has
nothing to do with macOS. Fixed: `packages/noodl-editor/scripts/build.ts` now
scopes signing material to the target platform.

🟠 **Apple secrets without `CSC_LINK` failed late and opaquely.** Apple cannot
notarise an unsigned app. `build/macos-notarize.js` now fails first, on CI only,
naming the missing secret.

**Verified sound.** The "absent secret → unsigned artifact, not a failed job"
claim at `release.yml:9-13` still holds, and the mechanism is
`packages/noodl-editor/scripts/build.ts:77-87`: CI passes secrets
unconditionally, so an absent one arrives as an empty string, and electron-builder
reads an empty-but-set `CSC_LINK` as a certificate *path*. Stripping the empties
is what makes the promise true. (The three App Store Connect API-key variables
were missing from that list and have been added.) The notarisation hook is
correctly wired and will engage on `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/
`APPLE_TEAM_ID` (`Y35J975HXR`) or the API-key trio; `hardenedRuntime: true` with
`build/entitlements.mac.plist` carries `allow-jit`,
`allow-unsigned-executable-memory` and `allow-dyld-environment-variables`, which
is the set Electron needs.

**Still unproven, and cannot be proven statically:** the first notarisation
submission itself. NodeGX ships third-party Mach-O binaries inside the bundle
(`dugite`'s `git`, `desktop-trampoline`), which electron-builder auto-unpacks
from the asar and must sign individually for the hardened runtime. Expect to
iterate there — RELEASE-PROCESS.md §6 already says so.

### A partially-populated draft can no longer end quiet

`fail-fast: false` means a failed leg goes red, and that was the only signal.
Three ways the run could end green-ish while the draft was wrong, all closed —
see the `verify-release-assets` job, the mac-feed merge now exiting 1 rather than
0 on "nothing to merge", and `if-no-files-found: error` on the per-arch feed
upload. Rules are fixture-tested by `node scripts/check-release-assets.js
--self-test`, wired into `pr.yml`.

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
