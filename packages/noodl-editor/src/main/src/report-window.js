/**
 * ALPHA-007 §1 and §5 — the main-process half of "Report a problem".
 *
 * Three jobs the renderer cannot do for itself:
 *
 * 1. **Capture the screenshot at click time.** `webContents.capturePage()`
 *    replaces the prior art's `html2canvas`-from-a-CDN entirely. §1's corollary
 *    is the whole reason this lives here: by the time the composer has
 *    rendered, the evidence is behind it, so the capture happens in the menu
 *    click handler — *before* the renderer is told to open anything.
 * 2. **Write the exported bundle**, unconditionally, on every send. There is one
 *    clipboard and the reporter may well clobber it on the way to the browser;
 *    and a tester who will not use GitHub at all can send that folder to a
 *    person instead (criterion 7).
 * 3. **Reveal it in the file manager**, which needs `shell`.
 *
 * The app still transmits nothing. Everything here writes to the user's own
 * disk and their own clipboard; the only thing that crosses the network is a
 * URL their browser opens, under their identity, showing them the payload
 * before they press Submit. That is what keeps `PRIVACY.md` §5 true as written.
 *
 * @module main/report-window
 */

const fs = require('fs');
const path = require('path');

/**
 * §5: "downscaled to ≤1600px wide and encoded at ~q0.8". A retina editor window
 * is 1–3MB raw and base64 inflates it another third; at this size it is
 * 150–300KB and still perfectly legible.
 */
const MAX_SCREENSHOT_WIDTH = 1600;
const SCREENSHOT_QUALITY = 80;

/** Small enough to sit in a dialog, big enough to tell you what you captured. */
const PREVIEW_WIDTH = 480;

/** Where a report folder goes. One folder per report. */
function reportsDirectory(userDataPath) {
  return path.join(userDataPath, 'reports');
}

function bundleDirectory(userDataPath, reportId) {
  return path.join(reportsDirectory(userDataPath), reportId);
}

/**
 * Downscale, without ever scaling *up* a small window.
 *
 * Returns a `NativeImage`; the caller decides whether it wants JPEG bytes or a
 * data URL. Kept separate from the encode so the preview and the attachment can
 * share one resize policy.
 */
function downscale(image, maxWidth) {
  if (!image || typeof image.getSize !== 'function') return image;
  const { width } = image.getSize();
  if (!width || width <= maxWidth) return image;
  return image.resize({ width: maxWidth, quality: 'good' });
}

function toJpegBuffer(image, quality) {
  return downscale(image, MAX_SCREENSHOT_WIDTH).toJPEG(quality || SCREENSHOT_QUALITY);
}

/** A data URL small enough to hand to the renderer for the dialog's preview. */
function toPreviewDataUrl(image) {
  if (!image || typeof image.toJPEG !== 'function') return null;
  return 'data:image/jpeg;base64,' + downscale(image, PREVIEW_WIDTH).toJPEG(70).toString('base64');
}

/**
 * Write one report folder.
 *
 * `files` is a plain name → string map (`diagnostics.json`, `report.md`) and
 * `screenshot` is a Buffer or null. Returns the folder path so the renderer can
 * offer "Reveal in Finder".
 *
 * Deliberately synchronous and deliberately unguarded against a missing
 * directory: this runs once, on a click, and a failure here must surface to the
 * reporter rather than leave them believing a fallback exists that does not.
 */
function writeReportBundle({ userDataPath, reportId, files, screenshot }) {
  const dir = bundleDirectory(userDataPath, reportId);
  fs.mkdirSync(dir, { recursive: true });

  for (const name of Object.keys(files || {})) {
    fs.writeFileSync(path.join(dir, name), files[name], 'utf8');
  }

  if (screenshot && screenshot.length) {
    fs.writeFileSync(path.join(dir, 'screenshot.jpg'), screenshot);
  }

  return dir;
}

/**
 * Wire the IPC and return the menu action.
 *
 * `getWindow` is a function rather than a window because the editor window is
 * recreated (project open/close) and a captured reference goes stale.
 */
function setupReportIPC({ ipcMain, clipboard, nativeImage, shell, app, getWindow }) {
  // Captures live here, keyed, rather than being shipped to the renderer and
  // back: a full-size screenshot as a data URL is megabytes across the IPC
  // boundary twice, for no reason.
  const captures = new Map();

  async function capture() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return { captureId: null, preview: null, capturedAt: new Date().toISOString() };

    const capturedAt = new Date().toISOString();
    let image = null;
    try {
      image = await win.webContents.capturePage();
    } catch (error) {
      // A report without a screenshot is still a report.
      console.warn('[report] Could not capture the window.', error);
    }

    const captureId = `c${Date.now()}${Math.floor(Math.random() * 1000)}`;
    if (image) captures.set(captureId, image);

    // One at a time. A reporter who opens the composer three times should not
    // be holding three full-size bitmaps.
    for (const key of Array.from(captures.keys())) {
      if (key !== captureId) captures.delete(key);
    }

    return { captureId: image ? captureId : null, preview: image ? toPreviewDataUrl(image) : null, capturedAt };
  }

  ipcMain.handle('report-capture', () => capture());

  ipcMain.handle('report-send', (_event, payload) => {
    const { reportId, files, captureId } = payload || {};
    const image = captureId ? captures.get(captureId) : null;

    let screenshot = null;
    if (image) {
      screenshot = toJpegBuffer(image, SCREENSHOT_QUALITY);
      // §5, in this order: the clipboard first, so it is already loaded by the
      // time the browser steals focus.
      try {
        clipboard.writeImage(nativeImage.createFromBuffer(screenshot));
      } catch (error) {
        console.warn('[report] Could not put the screenshot on the clipboard.', error);
      }
    }

    const dir = writeReportBundle({
      userDataPath: app.getPath('userData'),
      reportId,
      files,
      screenshot
    });

    if (captureId) captures.delete(captureId);

    return { bundlePath: dir, hasScreenshot: Boolean(screenshot) };
  });

  ipcMain.handle('report-reveal', (_event, bundlePath) => {
    // `showItemInFolder` wants a file, not a directory, on every platform —
    // pointed at a directory Windows opens the parent and selects nothing.
    const marker = path.join(bundlePath, 'report.md');
    shell.showItemInFolder(fs.existsSync(marker) ? marker : bundlePath);
    return true;
  });

  /**
   * The menu action. Captures *first*, then asks the renderer to open the
   * composer — that ordering is §1's design law and the reason this is not
   * simply a renderer-side button.
   */
  return async function openReportComposer() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    const captured = await capture();
    win.webContents.send('report-problem', captured);
  };
}

module.exports = {
  setupReportIPC,
  // Exported for tests: the parts with logic rather than Electron chrome.
  writeReportBundle,
  bundleDirectory,
  reportsDirectory,
  downscale,
  toJpegBuffer,
  toPreviewDataUrl,
  MAX_SCREENSHOT_WIDTH,
  SCREENSHOT_QUALITY
};
