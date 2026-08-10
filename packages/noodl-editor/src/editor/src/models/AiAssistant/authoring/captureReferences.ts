/**
 * BLD-014 — a capture, as a reference.
 *
 * The task's promise from BLD-011 was that each remaining Track B kind is "a
 * `ReferenceKind` member, a resolver here, and a glyph in `KIND_ICONS`". This
 * is the resolver, and it is short because the frame did the work: the chip
 * row, the cap, the cost meter, the carry-over rule, the persistence format and
 * the staleness rule were all written once and already handle a `capture`.
 *
 * ⚠️ **What this does not do.** It returns a picture and no findings. The task
 * is emphatic that a capture path returning only an image is the wrong shape —
 * *"always return findings alongside the picture… this is what makes the
 * feature work on a model that cannot see"* — and that is right for the CDP
 * producer, which measures a viewport. It cannot be right for this one: nothing
 * here measures anything, so any "findings" it emitted would be invented. What
 * it does instead is state that plainly, in the twin, so a model without vision
 * is told it received nothing rather than being handed a fabricated report.
 * **The findings half arrives with the CDP producer, behind F22.**
 *
 * @module AiAssistant/authoring/captureReferences
 */

import { captureLivePreview, type PreviewCapture } from '../../../views/SandboxSurface/livePreviewCapture';
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
export function captureTwinText(width: number, height: number): string {
  return [
    `A screenshot of the user's app as it is running right now in the preview, ${width}×${height}.`,
    'It is a picture only — nothing has measured it, so there are no findings attached.',
    'If you cannot see images, do not guess at its contents; say so and ask for what you need in words.'
  ].join(' ');
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

  const text = captureTwinText(shot.width, shot.height);
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
