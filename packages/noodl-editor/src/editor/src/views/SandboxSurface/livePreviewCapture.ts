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
 * first, and it needs no Chrome, no packaging and no ~8s wait: an Electron
 * `<webview>` already has `capturePage()`, and the bytes never leave the
 * renderer.
 *
 * ✅ **F22 is resolved (2026-08-10) and this file is one of the two reasons it
 * had to be.** The measurement half now lives in `@nodegx/render-measure`, a
 * no-build package with no `require` in it, so this runs **the identical
 * expression and the identical judgement** the CLI and the MCP tool run — which
 * is what closes build item 4 (*"never ship a capture path that returns only an
 * image"*) for this producer as well as the CDP one.
 *
 * ⚠️ **It still answers a different question from the CDP render, and the chip
 * must keep saying so.** This measures *whatever size the preview pane happens
 * to be*. It cannot answer "what does it look like at 390×844", because it does
 * not control the viewport — which is the whole of what the CDP producer is
 * still for.
 *
 * @module noodl-editor/views/SandboxSurface/livePreviewCapture
 */

import {
  measureExpression,
  placeholderStringsFromCatalog,
  summarise,
  type RenderFindingResult
} from '@nodegx/render-measure';

import { defaultCatalog } from '../../validation/catalog';

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
  /**
   * ✅ **F22 resolved (2026-08-10), so this is no longer empty.**
   *
   * Build item 4 — *"always return findings alongside the picture… this is what
   * makes the feature work on a model that cannot see"* — was unbuildable while
   * `summarise` was trapped behind `render-report.js`'s `child_process` /
   * `http` / `net` / `ws` requires. It now lives in `@nodegx/render-measure`,
   * which has none, so the editor runs **the identical measurement the CLI and
   * the MCP tool run** and gets findings in the same vocabulary.
   *
   * ⚠️ **One viewport, and it is whatever size the preview pane happens to be.**
   * That is the honest limit of a webview grab and the reason the CDP producer
   * still has a job: this cannot answer *"what does it look like at 390×844"*,
   * because it does not control the viewport — it measures the one on screen.
   */
  findings: RenderFindingResult[];
  /** `summarise`'s one-line verdict, or undefined when measurement failed. */
  summary?: string;
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
  const measured = await measure(element, size);
  return {
    data: png.toString('base64'),
    width: size.width,
    height: size.height,
    bytes: png.length,
    findings: measured.findings,
    ...(measured.summary ? { summary: measured.summary } : {})
  };
}

/**
 * Run the shared measurement inside the preview and judge the numbers.
 *
 * ⚠️ **Failure here must not lose the picture.** A measurement that throws — a
 * webview that navigated mid-call, a page that blocks eval — would otherwise
 * take the screenshot down with it, which trades a working feature for a
 * better one. The capture degrades to picture-only and says so; it never
 * degrades to nothing.
 */
async function measure(
  element: Electron.WebviewTag,
  size: { width: number; height: number }
): Promise<{ findings: RenderFindingResult[]; summary?: string }> {
  try {
    const placeholders = placeholderStringsFromCatalog(defaultCatalog());
    const raw = await element.executeJavaScript(measureExpression(placeholders));
    if (!raw || typeof raw !== 'object') return { findings: [] };
    /*
     * `summarise` keys its report by viewport name, and the name is what every
     * finding's `viewport` field reports. `preview` rather than `desktop`
     * deliberately: this is not one of `DEFAULT_VIEWPORTS`, it is whatever the
     * pane is, and calling it `desktop` would let a finding measured at 364px
     * read as a desktop finding.
     */
    const viewport = { ...(raw as object), requested: { width: size.width, height: size.height } };
    const report = summarise({ preview: viewport as never });
    return { findings: report.findings, summary: report.summary };
  } catch {
    return { findings: [] };
  }
}
