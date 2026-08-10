/**
 * BLD-014 — the CDP half of "look at it", as transport only.
 *
 * The webview grab (`views/SandboxSurface/livePreviewCapture.ts`) answers *"what
 * does it look like right now?"*. This answers the other question the task
 * names — *"what does it look like at 390×844, and what is measurably wrong?"* —
 * for the live preview **and for an arbitrary URL**, which is the capability
 * nothing in the editor had.
 *
 * ## Why this is not `scripts/devtools/render-report.js`
 *
 * The task said to reuse that harness and add a `Page.navigate` entry point.
 * Checked before building, that route does not reach a shipped editor:
 *
 * - `scripts/` is **not in `package.json`'s `build.files`**, so it is absent
 *   from a packaged app entirely.
 * - `checkPrerequisites` requires a **Chrome or Chromium binary on the user's
 *   machine**, the built viewer bundle at a repo path, and `ws` out of the repo's
 *   `node_modules`. All three are dev-checkout assumptions.
 *
 * So "reuse the harness" would have shipped a feature that works in this
 * checkout and is dead for every user. **Richard decided (2026-08-10): host the
 * CDP session in Electron instead.** Electron 43 *is* Chromium, and
 * `webContents.debugger` speaks the same protocol — so this sends the identical
 * commands `render-report.js` sends (`Page.navigate`,
 * `Emulation.setDeviceMetricsOverride`, `Runtime.evaluate`,
 * `Page.captureScreenshot`) with **no Chrome to find, no `ws`, no
 * `child_process`, and no packaging change**. It is also faster: there is no
 * browser to launch.
 *
 * ## This module measures nothing, and that is deliberate
 *
 * It takes an `expression` string and hands back whatever the page returned.
 * Every judgement — which placeholders count, what the numbers mean, what the
 * findings are — stays in the renderer beside the webview producer, running the
 * one `@nodegx/render-measure` code path both producers share. A second copy of
 * `summarise` living in the main process is exactly the divergence F22 was
 * resolved to prevent.
 *
 * @module main/render-capture
 */

const { BrowserWindow } = require('electron');

/**
 * A throwaway session, so a captured page cannot read the editor's cookies.
 *
 * ⚠️ Not `persist:` — the whole point is that this loads **third-party pages**
 * on the user's behalf. A persistent partition would accumulate their cookies
 * and localStorage across captures, and a shared one would hand a hostile page
 * whatever the sandbox preview had been logged into.
 */
const CAPTURE_PARTITION = 'nodegx-render-capture';

/** How long to let a page load before measuring it anyway. */
const LOAD_TIMEOUT_MS = 15000;
/** How long to let the runtime boot and settle after load, before the first read. */
const SETTLE_MS = 2500;
/** How long to let a reflow settle after changing the device metrics. */
const REFLOW_MS = 1200;
/** Chrome refuses a screenshot beyond this; a page taller is already the finding. */
const MAX_SHOT_HEIGHT = 16384;

/**
 * One capture at a time.
 *
 * Each capture is a real browser window rendering a real page, and two of them
 * racing would double the memory and interleave nothing useful. Queued rather
 * than refused: the user clicked twice because they wanted two, and an error
 * that says "busy" for a thing that takes eight seconds is a worse answer than
 * waiting.
 */
let queue = Promise.resolve();

function serialise(work) {
  const run = queue.then(work, work);
  // The queue must not inherit a rejection, or one failed capture poisons every
  // capture after it for the life of the process.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Only ever `http(s)`.
 *
 * ⚠️ A capture target arrives from a model as often as from a user, and
 * `file://` would turn "look at this page" into an arbitrary local file read
 * whose contents come back as a picture. `data:` would do the same for anything
 * already in the turn. Neither is a viewport question, so neither is allowed.
 */
function checkUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `Not a URL: ${url}`;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `Only http and https can be captured — ${parsed.protocol} is refused.`;
  }
  return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve when the page fires `load`, or when the timeout says to stop waiting.
 *
 * ⚠️ Resolving on timeout rather than rejecting. A page that never fires `load`
 * — an open socket, a video, a hung analytics beacon — is extremely common and
 * is usually rendered *fine*. Failing the capture there would refuse to
 * photograph a page the user can plainly see.
 */
function awaitLoad(debuggerInstance, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (how) => {
      if (done) return;
      done = true;
      debuggerInstance.removeListener('message', onMessage);
      clearTimeout(timer);
      resolve(how);
    };
    const onMessage = (_event, method) => {
      if (method === 'Page.loadEventFired') finish('load');
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    debuggerInstance.on('message', onMessage);
  });
}

/**
 * Render `url` at each viewport and return raw numbers plus pictures.
 *
 * @param {object} request
 * @param {string} request.url                    http(s) only.
 * @param {Array}  request.viewports              `[{name, width, height, mobile}]`.
 * @param {string} request.expression             `measureExpression(...)` from the renderer.
 * @param {'full'|'viewport'|'none'} [request.screenshot='full']
 * @param {number} [request.deviceScaleFactor=0.5] 0.5 keeps a full page around 500KB.
 * @returns {Promise<{viewports: object, screenshots: Array, error?: string}>}
 */
async function renderCapture(request) {
  const {
    url,
    viewports = [],
    expression,
    screenshot = 'full',
    deviceScaleFactor = 0.5,
    loadTimeoutMs = LOAD_TIMEOUT_MS
  } = request || {};

  const refusal = checkUrl(url);
  if (refusal) return { error: refusal, viewports: {}, screenshots: [] };
  if (viewports.length === 0) {
    return { error: 'No viewport was asked for.', viewports: {}, screenshots: [] };
  }

  const win = new BrowserWindow({
    show: false,
    width: Math.max(viewports[0].width, 400),
    height: Math.max(viewports[0].height, 400),
    /**
     * ⚠️ **Both of these exist because a hidden window is an occluded window,
     * and this repo has already been bitten by what that does.**
     *
     * An occluded Electron renderer clamps timers by ~1000× and never fires
     * `ResizeObserver` — measured in this project and on the phase's register.
     * A capture window is hidden by definition, so without these it is the
     * worst case of that trap: `paintWhenInitiallyHidden` is what makes the
     * compositor produce a surface at all (a window that never paints
     * screenshots as blank, which reads exactly like a blank-render finding
     * about the user's app), and `backgroundThrottling: false` is what keeps
     * the page's own boot timers running at real speed while we wait for it.
     */
    paintWhenInitiallyHidden: true,
    webPreferences: {
      backgroundThrottling: false,
      // ⚠️ Every one of these is load-bearing, because the page is a stranger.
      // This window exists to render content the editor does not trust, and it
      // must not be able to reach anything the editor can.
      partition: CAPTURE_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      preload: undefined
    }
  });

  const consoleErrors = [];
  let dbg = null;

  try {
    dbg = win.webContents.debugger;
    dbg.attach('1.3');

    dbg.on('message', (_event, method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        const d = (params && params.exceptionDetails) || {};
        consoleErrors.push(String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
      } else if (method === 'Runtime.consoleAPICalled' && params && params.type === 'error') {
        consoleErrors.push(
          (params.args || [])
            .map((a) => String(a.value !== undefined ? a.value : a.description || ''))
            .join(' ')
            .slice(0, 300)
        );
      }
    });

    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('Runtime.enable');

    const loaded = awaitLoad(dbg, loadTimeoutMs);
    const nav = await dbg.sendCommand('Page.navigate', { url });
    // `Page.navigate` reports a dead host in its *result*, not by throwing —
    // and a DNS failure that came back as "measured 0 texts" would read as a
    // blank-render finding about the user's app rather than a wrong address.
    if (nav && nav.errorText) {
      return { error: `Could not load ${url}: ${nav.errorText}`, viewports: {}, screenshots: [] };
    }
    await loaded;
    await wait(SETTLE_MS);

    const measured = {};
    const screenshots = [];

    for (const vp of viewports) {
      // Everything logged from here to the read belongs to this viewport; for
      // the first one that includes the boot, which is where it belongs.
      const loggedBefore = consoleErrors.length;
      await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: Boolean(vp.mobile)
      });
      await wait(REFLOW_MS);

      let raw;
      try {
        const evaluated = await dbg.sendCommand('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true
        });
        if (evaluated.exceptionDetails) {
          const d = evaluated.exceptionDetails;
          throw new Error((d.exception && d.exception.description) || d.text);
        }
        raw = evaluated.result.value;
      } catch (e) {
        // A viewport that could not be measured is recorded as such rather than
        // dropped: `summarise` reads an `error` field, and a silently missing
        // viewport would look like one nobody asked for.
        raw = { error: e instanceof Error ? e.message : String(e) };
      }

      measured[vp.name] = {
        requested: { width: vp.width, height: vp.height },
        ...raw,
        consoleErrors: consoleErrors.slice(loggedBefore)
      };

      if (screenshot !== 'none') {
        const shot = await dbg.sendCommand('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: screenshot === 'full',
          optimizeForSpeed: true,
          ...(screenshot === 'full' && raw && typeof raw.pageHeight === 'number'
            ? {
                clip: {
                  x: 0,
                  y: 0,
                  width: vp.width,
                  height: Math.min(raw.pageHeight, MAX_SHOT_HEIGHT),
                  scale: deviceScaleFactor
                }
              }
            : {})
        });
        screenshots.push({ name: vp.name, mimeType: 'image/png', base64: shot.data });
      }
    }

    return { viewports: measured, screenshots };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      viewports: {},
      screenshots: []
    };
  } finally {
    try {
      if (dbg && dbg.isAttached()) dbg.detach();
    } catch {
      /* the window may already be gone */
    }
    if (!win.isDestroyed()) win.destroy();
  }
}

function setupRenderCaptureIPC(ipcMain) {
  ipcMain.handle('render-capture', (_event, request) => serialise(() => renderCapture(request)));
}

module.exports = {
  setupRenderCaptureIPC,
  renderCapture,
  checkUrl,
  CAPTURE_PARTITION,
  LOAD_TIMEOUT_MS,
  SETTLE_MS,
  REFLOW_MS
};
