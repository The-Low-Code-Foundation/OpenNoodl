# FLD-016 — The Linux install works on a current distribution

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
