/**
 * FLD-016 (c) — the Wayland startup hint. Issue #29.
 *
 * The reported failure is that the released Linux app does not start on a
 * Wayland session with no Xwayland: no `$DISPLAY`, Chromium defaults to the
 * X11 ozone backend, and the process dies with "Unable to open X display"
 * before any window exists.
 *
 * 🔴 What makes this worth a spec rather than a glance at the diff: the fix is
 * one switch name, #29 proposes the WRONG one (`ozone-platform`, which has no
 * `auto` value and would be silently ignored), and neither spelling can be told
 * apart by reading the app start up on macOS. So the switch name is asserted
 * literally, and the guard is exercised over every combination of the two
 * environment variables that decide it — including the case the fix must NOT
 * touch, which is the one that works today.
 */

const { shouldHintOzoneAuto, applyLinuxDisplayHint } = require('../src/main/src/linux-display');

/** A stand-in for Electron's `app`, recording what was appended. */
function fakeApp() {
  const switches = [];
  return {
    switches,
    commandLine: {
      appendSwitch(name, value) {
        switches.push(value === undefined ? name : `${name}=${value}`);
      }
    }
  };
}

describe('FLD-016 (c): the Wayland startup hint', () => {
  describe('shouldHintOzoneAuto — the four environments, on Linux', () => {
    // The reported case is the ONLY true one. Each of the other three is a
    // session that starts today, and a fix that changed them would be a
    // regression rather than a fix.
    const cases = [
      { name: 'Wayland with no Xwayland — the reported failure', env: { WAYLAND_DISPLAY: 'wayland-0' }, expect: true },
      { name: 'Wayland with Xwayland running', env: { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' }, expect: false },
      { name: 'a plain X11 session', env: { DISPLAY: ':0' }, expect: false },
      { name: 'neither — a headless box with no session at all', env: {}, expect: false }
    ];

    for (const testCase of cases) {
      it(`${testCase.name} → ${testCase.expect}`, () => {
        expect(shouldHintOzoneAuto('linux', testCase.env)).toBe(testCase.expect);
      });
    }

    it('DISPLAY="" counts as no display, not as X11 being available', () => {
      // Chromium treats an empty DISPLAY as unusable. Reading it as "X11 is
      // there" would leave exactly the reported session broken, and `!env.DISPLAY`
      // is the only reason it does not.
      expect(shouldHintOzoneAuto('linux', { DISPLAY: '', WAYLAND_DISPLAY: 'wayland-0' })).toBe(true);
    });
  });

  it('never fires off Linux, even in an environment that would qualify', () => {
    // macOS and Windows have no ozone platform; the switch is meaningless there
    // and this is what keeps the fix from reaching the two platforms that ship
    // today and work.
    const waylandish = { WAYLAND_DISPLAY: 'wayland-0' };
    expect(shouldHintOzoneAuto('darwin', waylandish)).toBe(false);
    expect(shouldHintOzoneAuto('win32', waylandish)).toBe(false);
  });

  describe('applyLinuxDisplayHint — what actually reaches Chromium', () => {
    it('appends ozone-platform-hint=auto, by that exact name', () => {
      // 🔴 The literal name is the assertion. `ozone-platform=auto` is the
      // spelling #29 asks for; it is not a valid value for that switch and
      // would be ignored, which looks identical to this fix from the outside.
      const app = fakeApp();
      const applied = applyLinuxDisplayHint(app, 'linux', { WAYLAND_DISPLAY: 'wayland-0' });

      expect(applied).toBe(true);
      expect(app.switches).toEqual(['ozone-platform-hint=auto']);
      expect(app.switches[0].startsWith('ozone-platform=')).toBe(false);
    });

    it('touches the command line not at all when the session already works', () => {
      // Asserting the empty array rather than "does not contain ozone" — an
      // absence is only worth reading beside a case where the same instrument
      // is known to record something, which the test above supplies.
      const app = fakeApp();
      const applied = applyLinuxDisplayHint(app, 'linux', { DISPLAY: ':0' });

      expect(applied).toBe(false);
      expect(app.switches).toEqual([]);
    });
  });

  it('main.js applies the hint through this module', () => {
    // The unit above grades the decision; this grades that the decision is
    // WIRED. A pure function nobody calls passes every test in this file and
    // fixes nothing on Fedora.
    //
    // 🔴 This assertion was written as `toContain(...)` first, and the arm that
    // comments the call out — `// require('./src/linux-display')…` — PASSED it,
    // because the substring is still there inside the comment. A source-text
    // match reads dead code as live code. So the match is anchored to the start
    // of a line: a `//` in front of it breaks the anchor, which is the whole
    // difference between "is called" and "appears in the file".
    const fs = require('fs');
    const path = require('path');
    const mainSource = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');

    const liveCall = /^[ \t]*require\('\.\/src\/linux-display'\)\.applyLinuxDisplayHint\(app\);/m;
    expect(mainSource).toMatch(liveCall);
    // And the invalid spelling must not have crept in anywhere in the main process.
    expect(mainSource).not.toContain("appendSwitch('ozone-platform'");
  });
});
