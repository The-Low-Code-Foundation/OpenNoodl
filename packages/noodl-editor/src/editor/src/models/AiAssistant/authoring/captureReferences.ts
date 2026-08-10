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
