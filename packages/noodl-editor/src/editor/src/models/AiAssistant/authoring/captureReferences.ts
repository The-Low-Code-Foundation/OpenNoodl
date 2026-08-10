/**
 * BLD-014 — a capture, as a reference.
 *
 * The task's promise from BLD-011 was that each remaining Track B kind is "a
 * `ReferenceKind` member, a resolver here, and a glyph in `KIND_ICONS`". This
 * is the resolver, and it is short because the frame did the work: the chip
 * row, the cap, the cost meter, the carry-over rule, the persistence format and
 * the staleness rule were all written once and already handle a `capture`.
 *
 * ✅ **It returns findings as well as a picture, and F22 is why it can.**
 *
 * Build item 4 is emphatic — *"never ship a capture path that returns only an
 * image… this is what makes the feature work on a model that cannot see"* — and
 * this producer could not honour it while `summarise` was locked behind
 * `render-report.js`'s Node requires. Richard's F22 decision (2026-08-10) moved
 * the measurement into `@nodegx/render-measure`, so the twin now carries the
 * **same findings, in the same vocabulary**, that `render_report` returns on the
 * MCP surface.
 *
 * ⚠️ It measures **the preview pane's size**, not a device viewport, and the
 * twin says so in those words. Answering "what does it look like at 390×844"
 * needs the CDP producer, which is still unbuilt.
 *
 * @module AiAssistant/authoring/captureReferences
 */

import { captureLivePreview, type PreviewCapture } from '../../../views/SandboxSurface/livePreviewCapture';
// ⚠️ From the *model*, not from `renderCapture.ts`. That one imports
// `electron`, and this module is graded in `tests-unit/` — a plain-Node runner.
import type { CapturedViewport } from '../../../views/SandboxSurface/renderCaptureModel';
import type { RenderFindingResult } from '@nodegx/render-measure';
import type { AiImageBlock } from '../client/content';
import { formatBytes } from '../thread/fileAttachments';
import { defaultPinned, type AttachedReference } from '../thread/references';
import { applyCount } from './applyCount';

let seq = 0;

/**
 * What a text-only model is told instead of the picture.
 *
 * ⚠️ The last sentence is the load-bearing one and it is deliberately blunt.
 * An image twin that said only "a screenshot of the running app" invites a
 * model to discuss what is in it; this says there is nothing to discuss and
 * names the tool that *would* have measured it. A declared absence the model
 * can act on beats a description it will treat as an observation — the same
 * argument `degradedImageText` makes, one step further because here we know
 * the substitution carries no information at all.
 */
export function captureTwinText(
  width: number,
  height: number,
  findings: readonly RenderFindingResult[] = [],
  summary?: string
): string {
  const opening = `A screenshot of the user's app as it is running right now in the preview, ${width}×${height}.`;

  // ⚠️ The picture-only wording is still reachable, and it must be. `measure`
  // swallows its own failure so a measurement that throws never costs the
  // screenshot — which means "no findings" can mean *measured clean* or
  // *measurement failed*, and only `summary` tells them apart. Saying "no
  // problems found" on a failed measurement would be the fabrication this whole
  // file is written against.
  if (!summary) {
    return [
      opening,
      'It is a picture only — the measurement did not run, so there are no findings attached.',
      'If you cannot see images, do not guess at its contents; say so and ask for what you need in words.'
    ].join(' ');
  }

  const lines = [
    opening,
    '',
    `MEASURED AT ${width}×${height} — this is the size of the preview pane, not a device viewport.`,
    summary
  ];

  if (findings.length > 0) {
    lines.push('');
    for (const finding of findings) {
      lines.push(`- [${finding.severity}] ${finding.code}: ${finding.message}`);
    }
  }

  lines.push(
    '',
    // The sentence that makes the feature work on a model that cannot see —
    // build item 4's actual purpose. Without it a text-only model has numbers
    // and no idea it is missing the picture they describe.
    'If you cannot see images, act on the measurements above and say you could not see the screenshot itself.'
  );
  return lines.join('\n');
}

/**
 * Capture the live preview into an attachable reference, or explain why not.
 *
 * `null` when there is nothing mounted to capture — the control is greyed in
 * that case, so reaching here means the preview went away between the render
 * and the click, and there is nothing to put on a chip.
 */
export async function resolveLivePreviewCapture(
  capture: () => Promise<PreviewCapture | null> = captureLivePreview
): Promise<AttachedReference | null> {
  seq += 1;
  const id = `capture:preview:${seq}`;
  const label = seq === 1 ? 'App screenshot' : `App screenshot ${seq}`;
  const base = {
    id,
    kind: 'capture' as const,
    label,
    target: id,
    // Rule 7's per-kind default: false for a capture, because it depicts a
    // thing the agent is in the middle of changing.
    pinned: defaultPinned('capture'),
    /**
     * ⚠️ Stamped at capture time, not at send time, and that is the whole
     * mechanism. `isStale` compares this against the count *when the turn is
     * rendered*, so a capture taken now and sent after two Accepts states that
     * it is two changes old — which is the case Rule 7 exists for and the one a
     * send-time stamp would silently paper over.
     */
    capturedAtApply: applyCount()
  };

  let shot: PreviewCapture | null;
  try {
    shot = await capture();
  } catch (e) {
    return { ...base, status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }

  if (!shot) {
    return {
      ...base,
      status: 'failed',
      error: 'The preview has not painted anything yet — wait for it to render, then try again.'
    };
  }

  const text = captureTwinText(shot.width, shot.height, shot.findings, shot.summary);
  const image: AiImageBlock = { type: 'image', data: shot.data, mediaType: 'image/png', text };
  return {
    ...base,
    status: 'ready',
    resolution: {
      text,
      images: [image],
      chars: text.length,
      truncated: false,
      originalChars: text.length,
      bytes: shot.bytes
    }
  };
}

/** For the control's tooltip — what one press is about to cost. */
export function captureSizeNote(bytes: number): string {
  return `${formatBytes(bytes)} of PNG, sent uncached on every turn it rides.`;
}

// ── The CDP producer ────────────────────────────────────────────────────────

/**
 * How many findings ride the twin before it starts summarising them.
 *
 * ⚠️ `REFERENCE_CAPS.capture` is 2,000 characters and a full render at two
 * viewports can produce more findings than that holds. Cut **by count, with the
 * remainder stated**, rather than with `capReferenceText`: that truncator cuts
 * on a heading boundary, which is right for a document and wrong for a list —
 * it would drop findings mid-sentence and leave the model unable to tell a
 * severed finding from a complete one. Sorted by severity first, so the twelve
 * that survive are the twelve worth having.
 */
const MAX_TWIN_FINDINGS = 12;

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

/**
 * What a CDP capture tells a model, including one that cannot see it.
 *
 * ⚠️ Deliberately **not** `captureTwinText`. That one's load-bearing sentence is
 * *"this is the size of the preview pane, not a device viewport"* — the honest
 * limit of a webview grab. Here the opposite is true and just as load-bearing:
 * this **is** a device viewport, it is the one that was asked for, and a model
 * told otherwise would discount a genuine 390px finding as an artefact of a
 * narrow pane.
 */
export function renderCaptureTwinText(capture: CapturedViewport, url: string, external: boolean): string {
  const where = external
    ? `an external page, ${url}`
    : `the user's own app, running at ${url}`;

  const opening =
    `A screenshot of ${where}, rendered at ${capture.width}×${capture.height} ` +
    `(the "${capture.name}" viewport).`;

  if (capture.measurementError) {
    return [
      opening,
      `It is a picture only — the measurement did not run (${capture.measurementError}), so there are no findings attached.`,
      'If you cannot see images, do not guess at its contents; say so and ask for what you need in words.'
    ].join(' ');
  }

  const lines = [
    opening,
    '',
    `MEASURED AT ${capture.width}×${capture.height} — this is a real device viewport, not a resized pane.`,
    capture.summary ?? 'No summary was produced.'
  ];

  if (capture.findings.length > 0) {
    const ranked = [...capture.findings].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    );
    lines.push('');
    for (const finding of ranked.slice(0, MAX_TWIN_FINDINGS)) {
      lines.push(`- [${finding.severity}] ${finding.code}: ${finding.message}`);
    }
    if (ranked.length > MAX_TWIN_FINDINGS) {
      lines.push(`- …and ${ranked.length - MAX_TWIN_FINDINGS} more, least severe first.`);
    }
  }

  lines.push(
    '',
    'If you cannot see images, act on the measurements above and say you could not see the screenshot itself.'
  );
  return lines.join('\n');
}

/**
 * One CDP render, as one reference per viewport.
 *
 * ⚠️ **Per viewport, not per render**, and the chip row is why. A render at
 * `desktop,phone` produces two pictures with different findings and different
 * costs; folding them into one chip would show a single price for two
 * screenshots and give the user no way to drop the one they did not need. Each
 * picture is a thing that can be unpinned and removed on its own.
 */
export async function resolveRenderCapture(
  url: string,
  captures: readonly CapturedViewport[],
  external: boolean
): Promise<AttachedReference[]> {
  return captures.map((capture) => {
    seq += 1;
    const id = `capture:render:${seq}`;
    const text = renderCaptureTwinText(capture, url, external);
    const image: AiImageBlock = { type: 'image', data: capture.data, mediaType: 'image/png', text };
    return {
      id,
      kind: 'capture' as const,
      /*
       * The label carries the host, and for an external page that *is* the
       * acceptance criterion — "labelled as external". A chip reading
       * `example.com · phone` beside one reading `Your app · phone` is the
       * difference between a user who knows what they are sending their
       * provider and one who does not.
       */
      label: `${external ? hostLabel(url) : 'Your app'} · ${capture.name}`,
      target: `${url}#${capture.name}`,
      pinned: defaultPinned('capture'),
      capturedAtApply: applyCount(),
      status: 'ready' as const,
      resolution: {
        text,
        images: [image],
        chars: text.length,
        truncated: false,
        originalChars: text.length,
        bytes: capture.bytes
      }
    };
  });
}

/** `https://example.com/pricing?x=1` → `example.com`. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Build item 7 — a URL capture is a network egress, said before the first one.
 *
 * ⚠️ It names **both** halves of what happens, because they are two different
 * disclosures and a user can reasonably object to either: the editor fetches
 * the page, *and* the picture of it then goes to their model provider. A notice
 * that mentioned only the fetch would understate it considerably.
 */
export function egressNotice(url: string): string {
  return (
    `${hostLabel(url)} will be loaded in a hidden browser window, and the screenshot ` +
    `will be sent to your AI provider with this message. Only load pages you are happy to share.`
  );
}
