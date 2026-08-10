/**
 * BLD-014 — the CDP producer's rules, with nothing in them that needs a browser.
 *
 * ## The three-way split, and why it is three
 *
 * - `main/render-capture.js` owns the window and the debugger. Only the main
 *   process can open one. It measures and judges **nothing**.
 * - **This file** owns the meaning: which viewport was asked for, which URL is
 *   somebody else's, and what the numbers that came back amount to.
 * - `renderCapture.ts` is the wire between them, and is the only one of the
 *   three that imports `electron`.
 *
 * ⚠️ **That last line is the whole reason this file exists separately.** A
 * single top-level `import { ipcRenderer } from 'electron'` would put every rule
 * below out of reach of `tests-unit/`, which is a plain-Node runner with no
 * Electron in it — and the rules are the half worth grading. The transport is
 * six lines and an `await`; the grammar, the external-origin call and the
 * measured/failed distinction are where a defect can hide.
 *
 * @module noodl-editor/views/SandboxSurface/renderCaptureModel
 */

import {
  DEFAULT_VIEWPORTS,
  NAMED_VIEWPORTS,
  summarise,
  summaryLine,
  type RenderFindingResult,
  type ViewportSpec
} from '@nodegx/render-measure';

import { viewerOrigin } from './viewerOrigin';

/** The running app, as a URL a second browser window can load. */
export function appViewerUrl(): string {
  return `${viewerOrigin()}/`;
}

/**
 * Whether a capture target is somebody else's page.
 *
 * ⚠️ Drives the egress notice and the chip's label, so it errs towards
 * *external*: anything that is not the editor's own viewer origin — including
 * anything unparseable — is treated as third-party. A false "external" costs one
 * extra sentence on screen; a false "internal" silently ships a stranger's page
 * to the user's model provider without the disclosure build item 7 requires.
 */
export function isExternalUrl(url: string): boolean {
  try {
    return new URL(url).origin !== new URL(appViewerUrl()).origin;
  } catch {
    return true;
  }
}

/**
 * `"desktop,phone"`, `"390x844"`, or a mix — the same grammar `render_report`
 * takes, deliberately.
 *
 * The vocabulary is `DEFAULT_VIEWPORTS`' own names, so a viewport the CLI, the
 * MCP tool and this control all understand is spelled one way everywhere.
 *
 * ⚠️ Returns its refusal rather than exiting, unlike `measure-from-disk.js`'s
 * copy of this grammar — that one is a CLI and can `process.exit(2)`. Here the
 * unknown name arrives from a text field or from a model, and the message
 * naming what *is* known is the whole repair.
 */
export function parseViewports(spec?: string): { viewports: ViewportSpec[]; error?: undefined } | { error: string } {
  if (!spec || !spec.trim()) return { viewports: DEFAULT_VIEWPORTS };

  // ⚠️ Names resolve from the **vocabulary**, not the default set, so `tablet`
  // is spellable here without `render_report` measuring a third viewport on
  // every call it has ever been asked to make.
  const known = new Map(NAMED_VIEWPORTS.map((v) => [v.name, v]));
  const viewports: ViewportSpec[] = [];

  for (const token of spec.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const match = known.get(trimmed);
    if (match) {
      viewports.push(match);
      continue;
    }

    const explicit = /^(\d+)x(\d+)$/.exec(trimmed);
    if (!explicit) {
      return {
        error: `Unknown viewport "${trimmed}". Use ${[...known.keys()].join(', ')}, or WIDTHxHEIGHT such as 390x844.`
      };
    }

    const width = Number(explicit[1]);
    const height = Number(explicit[2]);
    if (width < 1 || height < 1) {
      return { error: `A viewport must have a width and a height above zero — "${trimmed}" does not.` };
    }
    /*
     * The same threshold `measure-from-disk.js` uses, and it is not cosmetic:
     * Chrome will not open a real window under ~500px, so a narrow viewport has
     * to be device-emulated or it quietly lays out at 500 and reports back the
     * width that was asked for. A phone finding measured at desktop width is
     * worse than no phone finding.
     */
    viewports.push({ name: trimmed, width, height, mobile: width < 500 });
  }

  if (viewports.length === 0) return { error: 'No viewport was asked for.' };
  return { viewports };
}

/**
 * Add or remove one viewport name from a spec, preserving everything else.
 *
 * 🔴 **The device-preset buttons are derived from the spec string, not stored
 * beside it** — BLD-016's rule, applied a second time. The obvious build is a
 * `Set` of chosen devices *plus* the text field, which is two stores that have
 * to be kept equal; every *"I typed `390x844` and the Mobile button did not
 * light up"* bug is a missing edge in that graph. A toggle edits the text and
 * the lit state is re-read from it, so typing and clicking cannot disagree —
 * and a hand-typed custom size keeps working with no special case.
 *
 * Lives here rather than in the control because `tests-unit/` is a plain-Node
 * runner: a helper inside a `.tsx` file drags React and a stylesheet with it.
 */
export function toggleViewport(spec: string, name: string): string {
  const tokens = spec
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const next = tokens.includes(name) ? tokens.filter((token) => token !== name) : [...tokens, name];
  return next.join(',');
}

/**
 * The word on the preset button, where it differs from the word in the spec.
 *
 * ⚠️ `phone` is the vocabulary's name — the CLI, the MCP tool and the spec
 * string all use it — but Richard asked for *mobile*, which is what someone
 * building a mobile app calls it. The label is presentation; the token stays
 * `phone`, so one viewport is spelled one way everywhere it is parsed.
 */
export const PRESET_LABELS: Record<string, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  phone: 'Mobile'
};

/** One viewport's picture and what was measured in it. */
export interface CapturedViewport {
  /** `desktop`, `phone`, or the literal `390x844` that was asked for. */
  name: string;
  width: number;
  height: number;
  /** Raw base64 PNG. No `data:` prefix — the block contract in `content.ts`. */
  data: string;
  bytes: number;
  findings: RenderFindingResult[];
  /** `summarise`'s verdict, or undefined when the measurement did not run. */
  summary?: string;
  /** Why the measurement did not run, when it did not. */
  measurementError?: string;
}

/** What `main/render-capture.js` sends back. */
export interface RenderCaptureReply {
  viewports: Record<string, { error?: string; [field: string]: unknown }>;
  screenshots: { name: string; mimeType: string; base64: string }[];
  error?: string;
}

/** Decoded byte length of a base64 string, without decoding it. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Turn a transport reply into per-viewport captures, judged.
 *
 * This is the half that runs the same `summarise` the webview producer, the CLI
 * and the MCP tool run — one vocabulary of findings across every surface, which
 * is what F22 was resolved to make possible.
 */
export function interpretCaptureReply(
  reply: RenderCaptureReply,
  viewports: readonly ViewportSpec[]
): { captures: CapturedViewport[]; error?: string } {
  if (reply?.error) return { captures: [], error: reply.error };

  /*
   * 🔴 `summarise` is given **every** viewport at once, not one at a time, and
   * that is not an optimisation. Some of its findings are comparisons *across*
   * viewports — a layout that refuses to collapse below some width is only
   * visible by reading the narrow measurement against the wide one — so
   * summarising each viewport alone would silently lose exactly the findings a
   * multi-viewport render was asked for.
   */
  const report = summarise(reply.viewports as never);
  const byViewport = new Map<string, RenderFindingResult[]>();
  for (const finding of report.findings) {
    const list = byViewport.get(finding.viewport) ?? [];
    list.push(finding);
    byViewport.set(finding.viewport, list);
  }

  const shots = new Map(reply.screenshots.map((s) => [s.name, s]));
  const captures: CapturedViewport[] = [];

  for (const vp of viewports) {
    const shot = shots.get(vp.name);
    if (!shot) continue;
    const measured = reply.viewports[vp.name];
    captures.push({
      name: vp.name,
      width: vp.width,
      height: vp.height,
      data: shot.base64,
      bytes: base64Bytes(shot.base64),
      findings: byViewport.get(vp.name) ?? [],
      /*
       * ⚠️ Only a viewport `summarise` actually judged gets a summary — it skips
       * any entry carrying an `error`. Without this branch a failed measurement
       * would present as "measured, nothing found", which is the one ambiguity
       * this task's acceptance list calls out by name and the webview producer
       * already guards against.
       *
       * 🔴 **And the summary is scoped to THIS viewport, which the drive is why.**
       * `summarise` must see every viewport at once (above), so `report.summary`
       * describes the whole render — *"2 warnings … desktop 1280×900px …; phone
       * 390×844px …"*. Pasting that onto each capture was measured live and
       * told a model looking at the **desktop** picture that it had 2 warnings
       * when that viewport had 1, and recited phone measurements no part of
       * that image shows. `summaryLine` re-derives the sentence from one
       * viewport and its own findings, in the same vocabulary.
       */
      ...(measured?.error
        ? { measurementError: String(measured.error) }
        : { summary: summaryLine({ [vp.name]: measured as never }, byViewport.get(vp.name) ?? []) })
    });
  }

  if (captures.length === 0) {
    return { captures: [], error: 'The page was loaded but no screenshot came back.' };
  }
  return { captures };
}
