/**
 * Which Chromium ozone backend to ask for on Linux.
 *
 * ## Why this exists
 *
 * A Wayland session that is not running Xwayland has no `$DISPLAY`. Chromium's
 * default ozone backend is X11, so the app exits during startup with "Unable to
 * open X display" — and because that goes to stderr, someone who launched from
 * the desktop sees nothing happen at all. Running it from a terminal is the only
 * way to discover why (#29, FLD-016 (c)).
 *
 * 🔴 The switch is `ozone-platform-hint`, NOT `ozone-platform`. `ozone-platform`
 * takes a concrete backend name and has no `auto` value, so the spelling #29
 * proposes would be ignored and fix nothing.
 *
 * `auto` selects Wayland when a compositor is present and falls back to X11
 * otherwise. That makes it safe to set unconditionally on Linux — but it is
 * gated on the narrow case anyway, so that an X11 or Xwayland session (which
 * works today) keeps the exact startup path it has now. The bug being fixed is
 * *no `$DISPLAY` at all*; that is the only case this changes.
 *
 * Done in the app rather than through electron-builder's `executableArgs`
 * because this also covers the `.deb`, the `.rpm` and a plain terminal launch —
 * and because `executableArgs` REPLACES the AppImage target's `defaultArgs`,
 * which is the same field the `toolsets` fix in package.json works through.
 */

/**
 * @param {string} platform  `process.platform`
 * @param {Record<string, string | undefined>} env  `process.env`
 * @returns {boolean} whether to append `--ozone-platform-hint=auto`
 */
function shouldHintOzoneAuto(platform, env) {
  if (platform !== 'linux') return false;
  // An empty string is as unusable as an unset variable — Chromium treats
  // `DISPLAY=` as no display, so it must not count as "X11 is available".
  const hasDisplay = Boolean(env.DISPLAY);
  const hasWayland = Boolean(env.WAYLAND_DISPLAY);
  return !hasDisplay && hasWayland;
}

/**
 * Applies the hint to an Electron `app` when the session needs it.
 *
 * @returns {boolean} whether the switch was appended — returned so a caller (and
 *   a test) can tell "decided not to" from "never asked".
 */
function applyLinuxDisplayHint(app, platform = process.platform, env = process.env) {
  if (!shouldHintOzoneAuto(platform, env)) return false;
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  return true;
}

module.exports = { shouldHintOzoneAuto, applyLinuxDisplayHint };
