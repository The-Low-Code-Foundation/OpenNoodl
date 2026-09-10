# FLD-016 — The Linux install works on a current distribution

🟡 **PARTLY BUILT** — session 9, 2026-09-10. `packages/noodl-editor/package.json`,
`packages/noodl-editor/src/main/src/linux-display.js`, `scripts/check-release-assets.js`,
`.github/workflows/release.yml`.

🔴 **Deliberately NOT `🟢 BUILT`, so the board's grep keeps counting it open.** All four
sub-problems are FIXED, and **AC2, AC4 and AC5 are measured against built artefacts on this
machine**. **AC1 and AC3 are NOT met and cannot be met here** — they need a real FUSE-3 Wayland
distribution, and no amount of work on a Mac closes them. See §7.

## ✅ What was built, and what it was measured against

| # | fix | where | graded |
|---|---|---|---|
| (a) | `toolsets.appimage: "1.0.3"` — the static, FUSE-free AppImage runtime | `noodl-editor/package.json` | ✅ artefact, reverted arm |
| (b) | `--no-sandbox` disappears from the `.desktop` Exec line | *same one line* | ✅ **AC2**, artefact, reverted arm |
| (c) | `ozone-platform-hint=auto` when a Wayland session has no `$DISPLAY` | `src/main/src/linux-display.js` | ✅ 9 specs, 3 reverted arms |
| (d) | `rpm` target + the release-asset check that fails without it | `package.json`, `check-release-assets.js`, `release.yml` | ✅ **AC4** (check half), **AC5** |

## 1. 🔴 The first question was "is this gradeable here", and the answer was better than expected

The handoff said to decide gradeability **before** building. The answer is **yes, for three of the
five ACs**, and it turns on two facts nobody had checked:

- ✅ **electron-builder builds a Linux x64 AppImage, `.deb` AND `.rpm` on darwin-arm64.** All three
  exit 0. The AppImage needs nothing installed; the `.rpm` needs `brew install rpm` (bottled,
  ~1 min) for `rpmbuild`, and `.deb` needs nothing.
- 🔴 **The repo's own release path CANNOT be run on this checkout.**
  `scripts/noodl-editor/build-editor.ts:62` runs **`npx rimraf ./node_modules`** and reinstalls.
  On a shared checkout with peer sessions live that is destructive. The artefacts below were built
  by invoking `node_modules/.bin/electron-builder` directly against the existing bundles, with
  **`--config.npmRebuild=false`** so `@electron/rebuild` could not rewrite native modules in the
  shared tree, and `--config.directories.output=` pointed at the scratchpad so `dist/` stayed
  clean. `packages/noodl-editor/node_modules` was verified untouched afterwards, and
  `src/main/main.bundle.js` md5-verified unchanged.

## 2. ✅ AC2 — measured on our own AppImage, with a reverted arm

AC2 says *"asserted against the built artefact — not against the config that is supposed to produce
it."* So it was. `NodeGX-0.2.2-linux-x86_64.AppImage` was built twice from the **real**
`packages/noodl-editor` package, changing exactly one thing. The reverted arm passes
`--config.toolsets.appimage=0.0.0`, which `AppImageTarget.js:27` treats **identically to absent**
(`appimageTool == null || appimageTool === "0.0.0"`), so it reproduces HEAD-before without editing
a file a peer might commit:

| arm | `.desktop` `Exec=` | AppImage runtime | size |
|---|---|---|---|
| **REVERTED** (`0.0.0` ≡ no `toolsets`) | `AppRun --no-sandbox %U` | links **`libfuse.so.2`** | 217,169,161 B |
| **FIXED** (`1.0.3`) | `AppRun %U` | **no FUSE linkage** | 198,423,686 B |

The `.desktop` was read out of the squashfs with `7zz` (electron-builder ships one at
`~/Library/Caches/electron-builder/7zip@1.0.0/…/bin/7zz`; macOS has no `unsquashfs`). FUSE linkage
was read as `strings` over the first 200 KB — the ELF runtime that is prepended to the image.

🔴 **One line fixes both (a) and (b), and the artefact proves it rather than the config asserting
it.** The `.deb` Exec (`/opt/NodeGX/noodl-editor %U`) and the `.rpm` Exec (identical) never carried
`--no-sandbox`, which confirms §2(b)'s claim that it is AppImage-only.

## 3. ✅ (c) — nine specs, three reverted arms, and the spec's own hole

`tests-main/fld016-linux-display.test.js`, **9 tests, exit 0**. The decision lives in
`src/main/src/linux-display.js` as a pure function so it is gradeable without launching Electron.

The guard is exercised over **all four** environments, because three of them are sessions that work
today and a fix that moved them would be a regression:

| `$DISPLAY` | `$WAYLAND_DISPLAY` | hint? | |
|---|---|---|---|
| — | set | ✅ **true** | the reported failure |
| set | set | false | Xwayland |
| set | — | false | plain X11 |
| — | — | false | headless |

Plus `DISPLAY=""` → **true** (Chromium treats an empty `DISPLAY` as unusable; reading it as "X11 is
available" would leave the reported session broken), and `darwin`/`win32` → false.

🔴 **The switch name is asserted literally, because #29 asks for the wrong one.**
`ozone-platform=auto` is not a valid value for `ozone-platform` and would be silently ignored —
which is indistinguishable from this fix on any machine that is not a Wayland box.

**Reverted arms — the baseline is green, so it grades nothing until something reddens it:**

| arm | result |
|---|---|
| A — `appendSwitch('ozone-platform', 'auto')`, the #29 spelling | 🔴 1 of 9 failed |
| B — the call in `main.js` **commented out** | 🔴 1 of 9 failed |
| C — the call in `main.js` **deleted** | 🔴 1 of 9 failed |

🔴 **Arm B passed 9/9 on the first attempt, and that was the spec's defect, not the arm's.** The
wiring assertion was `expect(mainSource).toContain("require('./src/linux-display')…")` — and
`// require('./src/linux-display')…` still contains it. **A source-text match reads dead code as
live code.** It is now anchored to the start of a line (`/^[ \t]*require\(…/m`), where a `//`
breaks the match. Both arms redden now. `main.js` was restored by `cp` from a snapshot, md5
verified — never `git checkout`.

## 4. ✅ (d) — AC4's check half and AC5, on the real filenames

All three Linux targets were produced from the real package, exit 0 each:

```
NodeGX-0.2.2-linux-x86_64.AppImage   198,423,686 B
NodeGX-0.2.2-linux-amd64.deb         164,728,592 B
NodeGX-0.2.2-linux-x86_64.rpm        131,942,169 B    # rpm -qip: noodl-editor 0.2.2-1, x86_64
```

🔴 **That is AC5 as well: adding a third target did not cost the other two.**

⚠️ **The task file's own §3(d) was WRONG.** It says `check-release-assets.js` *"asserts only
`latest.yml`/`latest-mac.yml`"*. It already asserted the AppImage and the `.deb` — the `.deb` row
exists precisely because of the F73 incident §5 cites. The real gap was the `.rpm` alone.
[[measure-the-artefact-before-believing-the-task-file]], again.

**AC4's second half — "asserted by removing it, because a check that has never failed has not been
tested"** — graded against the **filenames actually produced above**, not invented ones:

| asset list | exit | says |
|---|---|---|
| all 10, real Linux names | **0** | `✓ all 10 expected artifacts are present` |
| the same list, `.rpm` removed | **1** | `missing Linux .rpm (/\.rpm$/)` |

`--self-test` is **5/5, exit 0** (was 4/4; the new case is the removal arm, and
`the real v0.1.0 draft is caught` moved 6 → 7 problems because that draft is now also short an rpm).

⚠️ **`release.yml` needed a step, or the leg would have gone red exactly like F73.**
`rpmbuild` is not on `ubuntu-latest`; without it electron-builder builds and **uploads** the
AppImage and the `.deb`, then dies on the third target. `Install rpmbuild (Linux)`, gated
`if: matrix.platform == 'linux-x64'`, is what stops that — and `verify-release-assets` is now what
shouts if it happens anyway.

## 5. Gate readings — session 9, 2026-09-10

- `tests-main/fld016-linux-display.test.js` — **9 tests, exit 0**; arms A/B/C each **1 failed**.
- `node scripts/check-release-assets.js --self-test` — **5/5 cases, exit 0**.
- `release.yml` parses; the new step's `if` is `matrix.platform == 'linux-x64'`.
- `package.json`: `toolsets = {"appimage":"1.0.3"}`, `linux.target = ["AppImage","deb","rpm"]`.

## 6. ⚠️ What a reader should NOT read into this

- 🔴 **`toolsets` is Beta in electron-builder's own types.** The AppImage runtime can change under
  us on a bump. **Tested against electron-builder 26.15.3 / app-builder-lib 26.15.3**, runtime
  `appimage-tools-runtime-20251108`. §5 of the original task asked for this to be recorded.
- ⚠️ **`chrome-sandbox` ships inside the AppImage** and nothing in our source passes `--no-sandbox`
  any more (grepped across `src/main/` and `package.json`). That is a **necessary** condition for
  AC3, **not** a confirmation of it — the SUID bit cannot be set inside an AppImage and Chromium
  falls back to user namespaces, which only a real kernel can answer.
- ⚠️ The AppImage above was packaged from the **existing** `main.bundle.js`, which predates the (c)
  edit. That is deliberate — rebuilding it would clobber a bundle a peer may be running — and it
  does not weaken AC2, whose Exec line is a function of `toolsets` and productName alone. (c) is
  graded by its own specs instead.
- ⚠️ `brew install rpm` was installed on Richard's machine to produce the `.rpm`. Reversible with
  `brew uninstall rpm`. It conflicts with `rpm2cpio`, which was not installed.

## 7. 🔴 What is left, and why it cannot be done here

**AC1** — *the AppImage launches by double-click and from a terminal with no `DISPLAY` on a Wayland
session, on a FUSE-3-only distribution* — and **AC3** — *Chromium's sandbox is confirmed active in
the shipped AppImage*.

Both need a **real current Linux distribution**. Docker is up on this box and can run a container,
but a container has no Wayland compositor, no session bus, and no `/dev/fuse` without
`--privileged` — so it can answer neither question honestly, and a container that said "yes" would
be answering an easier one.

🔴 **AC3 is the one with teeth**, and §5 of this task already says why: *"Removing the flag and
leaving the sandbox disabled some other way would satisfy AC2 and fix nothing."* Re-enabling the
sandbox is a **real behaviour change** on older kernels and under restrictive AppArmor profiles.
**This must be smoke-tested on at least two distributions before 0.2.3 ships** — the change makes
the Linux app strictly better on a modern Fedora and could, in principle, stop it launching
somewhere it launches today.

**The three artefacts to hand a tester** are in this session's scratchpad and are reproducible with
the commands in §2 and §4.


Four sub-problems, independently shippable. **Two of them are the same config line**, and one of the
four is a security default nobody chose.

## 1. The person sentence

**Someone on Fedora downloads NodeGX, runs it from a terminal on a Wayland session, and it starts.**

## 2. What was reported, and what the code says

[#29](https://github.com/The-Low-Code-Foundation/NodeGX/issues/29). Measured 2026-09-09 against the
electron-builder config in `packages/noodl-editor/package.json`.

**(a) FUSE 2 — still true.** `build.linux.target` is `["AppImage", "deb"]` with **no `toolsets`
block anywhere in the repo**. electron-builder 26 defaults `toolsets.appimage` to `"0.0.0"`, the
legacy toolset, whose runtime dynamically links FUSE 2. Many current distributions ship only FUSE 3.
**Fix: one line** — `"toolsets": { "appimage": "1.0.3" }`.
`app-builder-lib/out/configuration.d.ts:325-335` documents `1.0.3` as the static, FUSE-free runtime.

**(b) `--no-sandbox` — still true, and it does not come from this repo.** It appears nowhere in our
config. `app-builder-lib/out/targets/appimage/AppImageTarget.js:25-28`:

```js
const appimageTool = packager.config.toolsets?.appimage;
const defaultArgs = appimageTool == null || appimageTool === "0.0.0" ? ["--no-sandbox"] : [];
```

🔴 **So `Exec=AppRun --no-sandbox %U` is the legacy-toolset default, and the (a) fix removes it
automatically.** One change, two problems. It affects the AppImage only; the `.deb` Exec has never
carried it.

**(c) No `$DISPLAY` on Wayland — still true.** `src/main/main.js` appends only
`disable-site-isolation-trials` (`:107`) and the debug-port switches. No ozone switch anywhere, and
there is no `.desktop` template in the repo.

**(d) No `.rpm` — still true.** Only `deb` and `AppImage` are configured.

## 3. Scope

- **(a)+(b):** add the `toolsets` block. Smoke-test on a FUSE-3-only distribution **before** shipping;
  the field is marked Beta in the type.
- **(c):** prefer the in-app fix over `executableArgs`, because it also covers the `.deb` and a
  terminal launch:
  ```js
  if (process.platform === 'linux' && !process.env.DISPLAY && process.env.WAYLAND_DISPLAY) {
    app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  }
  ```
  🔴 **`ozone-platform-hint=auto`, not `ozone-platform=auto`** — the latter is not a valid value. The
  issue proposes the invalid spelling.
  ⚠️ If `executableArgs` is used instead, note it **overrides** `defaultArgs` and therefore interacts
  with (b); check the precedence at `AppImageTarget.js:27`.
- **(d):** add `rpm` to the targets, install `rpm` on the Linux CI leg, **and** add the artefact to
  `scripts/check-release-assets.js` (which today asserts only `latest.yml`/`latest-mac.yml`) so a
  missing rpm fails the release instead of passing.
- Document FUSE, AppImage, Wayland and the sandbox in the README, which mentions none of them today.
- ⚠️ **Flatpak is out of scope.** Real, and a separate multi-day workstream.

## 4. Acceptance criteria

1. **(person)** On a FUSE-3-only distribution, the AppImage launches by double-click **and** from a
   terminal with no `DISPLAY` exported on a Wayland session.
2. The generated `.desktop` Exec line **does not** contain `--no-sandbox`, asserted against the built
   artefact — not against the config that is supposed to produce it.
3. Chromium's sandbox is confirmed **active** in the shipped AppImage. Removing the flag and leaving
   the sandbox disabled some other way would satisfy AC2 and fix nothing.
4. An `.rpm` is produced, installs, and launches. The release-asset check fails when it is absent —
   asserted by removing it, because a check that has never failed has not been tested.
5. The Linux release leg still produces the AppImage **and** the `.deb`. `release.yml:271` records a
   past incident where the leg uploaded its AppImage and then aborted on the `.deb`; adding a third
   target is exactly when that recurs.

## 5. Traps

- 🔴 **(b) is the one that can break launches.** Re-enabling the sandbox is a real behaviour change on
  older kernels and under restrictive AppArmor profiles. Test before and after on more than one
  distribution.
- 🔴 **Not a duplicate of #9 or of phase 83's packaging work.** #9 was a *source build* failure and is
  fixed; this is the *released artefact* failing at runtime.
- ⚠️ `fail-fast: false` is already set on the release matrix, which is why a new leg fails quietly
  rather than loudly. Make the asset check the thing that shouts.
- ⚠️ The Beta marking on `toolsets` means the AppImage runtime changes underneath us on an
  electron-builder bump. Pin and record the version that was tested.
