/**
 * BLD-014 — the cheap half of "look at it".
 *
 * Doctrine §11 — *you have not finished until you have looked at it* — has been
 * true on the MCP surface since LAS-005 and false inside the editor, where the
 * agent authors a component, the user watches it render, and the agent never
 * sees the thing it made. This closes that for the case that costs nothing.
 *
 * ## Why the webview grab ships before the CDP render
 *
 * The task names two producers behind one control and says to ship this one
 * first. It needs no packaging decision — **F22 is still open** and gates the
 * CDP half only: the render harness's pure measurement code is plain CJS under
 * `scripts/`, which the editor bundle cannot import without either dragging
 * `child_process` into the renderer or compiling it, and `scripts/` is not
 * shipped in a packaged editor at all. That is a decision about where a shared
 * module lives, and it is Richard's to make before anyone writes the CDP entry
 * point. None of it touches this file: an Electron `<webview>` already has
 * `capturePage()`, and the bytes never leave the renderer.
 *
 * ⚠️ **This answers a different question from the CDP render, and the chip
 * says so.** A webview grab is *"what does it look like right now"* at whatever
 * size the preview pane happens to be — it is not a viewport measurement, it
 * carries no findings, and it must never be presented as though it were. The
 * findings half arrives with the CDP producer.
 *
 * @module noodl-editor/views/SandboxSurface/livePreviewCapture
 */

/**
 * The live sandbox webviews, newest last.
 *
 * A registry rather than a ref passed down, because the two ends are in
 * different trees: the `<webview>` is inside a *document* (the authoring
 * preview, or the component bench) and the control that captures it is in the
 * Build *panel*. There is no common ancestor to hold a ref, and inventing a
 * React context spanning the whole editor to carry one element would be a much
 * larger change than the feature.
 *
 * A `Set` rather than a single slot because both hosts mount one: the bench and
 * the authoring preview can be alive at once, and the one the user is looking
 * at is the one that mounted most recently.
 */
const live = new Set<Electron.WebviewTag>();

export function registerLivePreview(element: Electron.WebviewTag): void {
  live.add(element);
}

export function unregisterLivePreview(element: Electron.WebviewTag): void {
  live.delete(element);
}

/** Whether there is anything to capture — what greys the control. */
export function hasLivePreview(): boolean {
  return live.size > 0;
}

export interface PreviewCapture {
  /** Raw base64 PNG. No `data:` prefix — the block contract in `content.ts`. */
  data: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Grab the most recently mounted preview.
 *
 * ⚠️ The **last** registered element, not the first. Opening a component bench
 * over a running authoring preview leaves both mounted, and the one on top is
 * the one the user means — capturing the older one would return a picture of
 * something they cannot currently see, which is worse than returning nothing.
 */
export async function captureLivePreview(): Promise<PreviewCapture | null> {
  const element = Array.from(live).pop();
  if (!element) return null;

  const image = await element.capturePage();
  // A webview that has not painted yet returns an empty image rather than
  // throwing. Sending that would attach a blank rectangle and call it evidence,
  // which is precisely the "rendered clean can mean empty" trap the render
  // report already documents.
  if (image.isEmpty()) return null;

  const png = image.toPNG();
  const size = image.getSize();
  return {
    data: png.toString('base64'),
    width: size.width,
    height: size.height,
    bytes: png.length
  };
}
