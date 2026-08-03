/**
 * ALPHA-007 §1 and §5 — the main-process half.
 *
 * The window chrome is not worth a test; the ordering is. Two things here are
 * load-bearing and neither is visible from reading the renderer:
 *
 * - **The capture happens before the renderer is told anything** (§1's
 *   corollary). Asserted by recording the call order, because "read the code
 *   and see" is exactly how this regresses.
 * - **The bundle is written on every send**, screenshot or not (§5, and
 *   criterion 5). It is the fallback for a clobbered clipboard and the whole of
 *   the path for a tester with no GitHub account (criterion 7).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  setupReportIPC,
  writeReportBundle,
  bundleDirectory,
  downscale,
  MAX_SCREENSHOT_WIDTH
} = require('../src/main/src/report-window');

function tempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-007-'));
}

/** A `NativeImage` with only the surface this module uses. */
function fakeImage(width, height) {
  return {
    getSize: () => ({ width, height }),
    resize: jest.fn(({ width: w }) => fakeImage(w, Math.round((height * w) / width))),
    toJPEG: jest.fn(() => Buffer.from(`jpeg:${width}x${height}`))
  };
}

/** A minimal Electron stand-in that records what was called, and in what order. */
function harness({ image = fakeImage(3200, 2000) } = {}) {
  const calls = [];
  const handlers = new Map();
  const userDataPath = tempUserData();

  const webContents = {
    capturePage: jest.fn(async () => {
      calls.push('capturePage');
      return image;
    }),
    send: jest.fn((channel) => calls.push(`send:${channel}`))
  };

  const window = { isDestroyed: () => false, webContents };

  const electron = {
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    clipboard: { writeImage: jest.fn(() => calls.push('clipboard')) },
    nativeImage: { createFromBuffer: jest.fn((buffer) => ({ buffer })) },
    shell: { showItemInFolder: jest.fn((target) => calls.push(`reveal:${target}`)) },
    app: { getPath: () => userDataPath },
    getWindow: () => window
  };

  const openComposer = setupReportIPC(electron);
  return { calls, handlers, electron, openComposer, userDataPath, webContents };
}

describe('the screenshot is captured at click time, not at send time', () => {
  it('captures before it tells the renderer to open anything', async () => {
    const { calls, openComposer } = harness();

    await openComposer();

    // If these ever swap, the screenshot is a picture of the dialog.
    expect(calls).toEqual(['capturePage', 'send:report-problem']);
  });

  it('hands the renderer a preview and a handle, not the full bitmap', async () => {
    const { webContents, openComposer } = harness();

    await openComposer();

    const [, payload] = webContents.send.mock.calls[0];
    expect(payload.captureId).toEqual(expect.any(String));
    expect(payload.preview).toMatch(/^data:image\/jpeg;base64,/);
    expect(payload.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('still opens the composer when the capture fails', async () => {
    const { calls, handlers, webContents, openComposer } = harness();
    webContents.capturePage.mockRejectedValueOnce(new Error('no window server'));

    await openComposer();

    expect(calls).toContain('send:report-problem');
    const [, payload] = webContents.send.mock.calls[0];
    expect(payload.captureId).toBeNull();
    // And a send with no capture still produces a bundle.
    expect(handlers.has('report-send')).toBe(true);
  });
});

describe('the screenshot is downscaled before it travels', () => {
  it('resizes a retina window to the documented width', () => {
    const image = fakeImage(3200, 2000);
    downscale(image, MAX_SCREENSHOT_WIDTH);
    expect(image.resize).toHaveBeenCalledWith({ width: MAX_SCREENSHOT_WIDTH, quality: 'good' });
  });

  it('does not scale a small window up', () => {
    const image = fakeImage(800, 600);
    expect(downscale(image, MAX_SCREENSHOT_WIDTH)).toBe(image);
    expect(image.resize).not.toHaveBeenCalled();
  });
});

describe('send', () => {
  const files = { 'diagnostics.json': '{"schema":1}', 'report.md': '# NodeGX problem report r-test' };

  it('puts the screenshot on the clipboard and writes the bundle', async () => {
    const { handlers, calls, electron, userDataPath } = harness();
    const opened = await handlers.get('report-capture')();

    const result = await handlers.get('report-send')(null, {
      reportId: 'r-test',
      files,
      captureId: opened.captureId
    });

    expect(electron.clipboard.writeImage).toHaveBeenCalled();
    expect(calls).toContain('clipboard');
    expect(result.hasScreenshot).toBe(true);
    expect(result.bundlePath).toBe(bundleDirectory(userDataPath, 'r-test'));

    const written = fs.readdirSync(result.bundlePath).sort();
    expect(written).toEqual(['diagnostics.json', 'report.md', 'screenshot.jpg']);
  });

  it('writes the bundle even when there is no screenshot at all', async () => {
    const { handlers, electron } = harness();

    const result = await handlers.get('report-send')(null, { reportId: 'r-noshot', files, captureId: null });

    expect(result.hasScreenshot).toBe(false);
    expect(electron.clipboard.writeImage).not.toHaveBeenCalled();
    expect(fs.readdirSync(result.bundlePath).sort()).toEqual(['diagnostics.json', 'report.md']);
  });

  it('writes one folder per report, so a second report does not overwrite the first', () => {
    const userDataPath = tempUserData();
    writeReportBundle({ userDataPath, reportId: 'r-one', files, screenshot: null });
    writeReportBundle({ userDataPath, reportId: 'r-two', files, screenshot: null });

    expect(fs.readdirSync(path.join(userDataPath, 'reports')).sort()).toEqual(['r-one', 'r-two']);
  });
});

describe('reveal', () => {
  it('points the file manager at a file inside the folder, not the folder', async () => {
    // `showItemInFolder` on a directory opens the *parent* on Windows and
    // selects nothing, which reads as "the button does not work".
    const { handlers, calls } = harness();
    const { bundlePath } = await handlers.get('report-send')(null, {
      reportId: 'r-reveal',
      files: { 'report.md': '# x' },
      captureId: null
    });

    await handlers.get('report-reveal')(null, bundlePath);

    expect(calls).toContain(`reveal:${path.join(bundlePath, 'report.md')}`);
  });
});

describe('the Help menu wires it up', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf8');

  it('adds Report a problem to the Help menu', () => {
    expect(source).toContain("label: 'Report a problem…'");
    expect(source).toContain('openReportComposer()');
  });

  it('registers the IPC before the menu is built', () => {
    // `setupMenu` closes over `openReportComposer`; if the order slips, the
    // menu item is wired to a no-op and clicking it does nothing at all.
    expect(source.indexOf('setupReportIpc();')).toBeLessThan(source.indexOf('setupMenu();\n'));
  });
});
