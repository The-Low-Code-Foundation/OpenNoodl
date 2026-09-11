/**
 * BLD-014 — the capture kind, and Rule 7 finally on screen.
 *
 * ⚠️ **Staleness has been built and specced since BLD-011 and had nothing to
 * produce a capture, so it had never once run against a real one** (R4 of that
 * task, its own R15's shape). These are the first tests where the thing being
 * graded and the thing producing it are both real.
 *
 * The apply counter is module state, so every test resets it. That is not
 * hygiene — a counter inherited from the previous test would make `isStale`
 * true for reasons this file never stated, which is precisely the class of
 * defect a stale check exists to catch.
 */

import {
  captureTwinText,
  resolveLivePreviewCapture
} from '../../src/editor/src/models/AiAssistant/authoring/captureReferences';
import {
  applyCount,
  noteApply,
  resetApplyCountForTests
} from '../../src/editor/src/models/AiAssistant/authoring/applyCount';
import {
  carryOver,
  defaultPinned,
  isStale,
  referenceCost,
  referenceMediaBlocks,
  renderReferenceBlock,
  staleAge
} from '../../src/editor/src/models/AiAssistant/thread/references';
import type { PreviewCapture } from '../../src/editor/src/views/SandboxSurface/livePreviewCapture';

const SHOT: PreviewCapture = {
  data: 'AAAA',
  width: 1280,
  height: 800,
  bytes: 240_000,
  findings: [],
  summary: 'Rendered clean: 42 texts, 6 images.'
};
const shoot = async () => SHOT;

/** A capture whose measurement threw — findings empty, and NO summary. */
const UNMEASURED: PreviewCapture = { data: 'AAAA', width: 1280, height: 800, bytes: 240_000, findings: [] };

beforeEach(() => resetApplyCountForTests());

describe('BLD-014 — a capture becomes a reference', () => {
  it('resolves to an image block carrying its declared twin', async () => {
    const ref = await resolveLivePreviewCapture(shoot);
    expect(ref?.status).toBe('ready');
    expect(ref?.kind).toBe('capture');
    const images = ref?.resolution?.images ?? [];
    expect(images).toHaveLength(1);
    expect(images[0].mediaType).toBe('image/png');
    expect(images[0].text).toBe(ref?.resolution?.text);
  });

  it('reports PNG bytes, not the twin\'s character count', async () => {
    const ref = await resolveLivePreviewCapture(shoot);
    // `chars` on a screenshot counts one sentence. Reporting it beside a 240KB
    // picture prints a number that is true, meaningless and reassuring.
    expect(ref?.resolution?.bytes).toBe(240_000);
    expect(referenceCost([ref!]).bytes).toBe(240_000);
    expect(referenceCost([ref!]).images).toBe(1);
  });

  it('✅ carries the findings, which is build item 4 and F22 is why it can', async () => {
    // *"Never ship a capture path that returns only an image — this is what
    // makes the feature work on a model that cannot see."* Unbuildable until
    // `summarise` left `render-report.js`'s Node requires for
    // `@nodegx/render-measure`.
    const twin = captureTwinText(1280, 800, [
      {
        code: 'horizontal-overflow',
        severity: 'warning',
        viewport: 'preview',
        message: 'The page scrolls sideways: scrollWidth 1600 against a 1280 viewport.'
      }
    ], 'Rendered with 1 warning (horizontal-overflow).');
    expect(twin).toContain('1280×800');
    expect(twin).toContain('Rendered with 1 warning');
    expect(twin).toContain('[warning] horizontal-overflow');
    // The sentence that is the actual point: numbers alone leave a text-only
    // model unaware it is missing the picture they describe.
    expect(twin).toMatch(/act on the measurements above/);
  });

  it('⚠️ says the size is the PANE, not a device viewport', async () => {
    // The honest limit of a webview grab, and the reason the CDP producer still
    // has a job. A model told "1280×800" with no qualifier would reasonably
    // read it as a desktop viewport measurement.
    const twin = captureTwinText(364, 700, [], 'Rendered clean.');
    expect(twin).toMatch(/not a device viewport/);
  });

  it('🔴 distinguishes "measured clean" from "measurement failed"', async () => {
    // `measure()` swallows its own failure so a throw never costs the
    // screenshot — which means an empty findings array means two different
    // things, and only the summary tells them apart. Reporting "no problems
    // found" on a failed measurement would be exactly the fabrication this
    // producer is written against.
    const clean = captureTwinText(1280, 800, [], 'Rendered clean: 42 texts, 6 images.');
    const failed = captureTwinText(1280, 800, []);
    expect(clean).toContain('Rendered clean');
    expect(clean).not.toMatch(/measurement did not run/);
    expect(failed).toMatch(/measurement did not run/);
    expect(failed).toMatch(/do not guess/i);
  });

  it('degrades to picture-only without losing the picture', async () => {
    const ref = await resolveLivePreviewCapture(async () => UNMEASURED);
    expect(ref?.status).toBe('ready');
    expect(ref?.resolution?.images).toHaveLength(1);
    expect(ref?.resolution?.text).toMatch(/measurement did not run/);
  });

  it('does not pin, because it depicts a thing the agent is changing', async () => {
    expect(defaultPinned('capture')).toBe(false);
    const ref = await resolveLivePreviewCapture(shoot);
    expect(ref?.pinned).toBe(false);
    // Rule 7: it rides exactly the turn it was attached to.
    expect(carryOver([ref!])).toEqual([]);
  });

  it('fails onto the chip when nothing has painted, rather than attaching a blank', async () => {
    // "Rendered clean can mean empty" — attaching a blank rectangle and calling
    // it evidence is worse than attaching nothing.
    const ref = await resolveLivePreviewCapture(async () => null);
    expect(ref?.status).toBe('failed');
    expect(ref?.error).toMatch(/has not painted/);
  });

  it('fails rather than throwing when the webview refuses', async () => {
    const ref = await resolveLivePreviewCapture(async () => {
      throw new Error('Webview is not attached.');
    });
    expect(ref?.status).toBe('failed');
    expect(ref?.error).toBe('Webview is not attached.');
  });
});

describe('BLD-014 — Rule 7, against a real capture for the first time', () => {
  it('stamps the apply count at CAPTURE time, not at send time', async () => {
    noteApply();
    noteApply();
    const ref = await resolveLivePreviewCapture(shoot);
    // ⚠️ The whole mechanism. A send-time stamp would make every capture
    // eternally current — the picture would silently be described as depicting
    // a project it predates.
    expect(ref?.capturedAtApply).toBe(2);
    expect(applyCount()).toBe(2);
  });

  it('is current until something is applied, then states how far behind it is', async () => {
    const ref = await resolveLivePreviewCapture(shoot);
    expect(isStale(ref!, applyCount())).toBe(false);
    expect(staleAge(ref!, applyCount())).toBeUndefined();

    noteApply();
    expect(isStale(ref!, applyCount())).toBe(true);
    expect(staleAge(ref!, applyCount())).toBe(1);

    noteApply();
    expect(staleAge(ref!, applyCount())).toBe(2);
  });

  it('🔴 sends a stale capture WITH its age in the prompt, never silently', async () => {
    const ref = await resolveLivePreviewCapture(shoot);
    noteApply();
    noteApply();
    const block = renderReferenceBlock([ref!], applyCount());
    // Rule 7's "nothing stale is ever sent silently" is this sentence, not the
    // grey border: the border tells the user, this tells the model.
    expect(block).toContain('[STALE — taken 2 changes ago');
    expect(block).toMatch(/treat this as history, not as the current state/);
    // Singular, because "1 changes ago" is the kind of thing that survives to
    // production in a string nobody grades.
    const one = renderReferenceBlock([{ ...ref!, capturedAtApply: 1 }], 2);
    expect(one).toContain('taken 1 change ago');
  });

  it('does not drop a stale capture — dropping is a silent edit of what the user sent', async () => {
    const ref = await resolveLivePreviewCapture(shoot);
    noteApply();
    const block = renderReferenceBlock([ref!], applyCount());
    expect(block).toContain('SCREENSHOT: App screenshot');
    expect(referenceMediaBlocks([ref!])).toHaveLength(1);
  });

  it('exempts every other kind by having no opinion rather than by an exception', async () => {
    // A component reference has no `capturedAtApply`, so twenty applies later
    // it is still not stale — the project changed, and the reference is a live
    // read of it.
    const component = {
      id: 'c1',
      kind: 'component' as const,
      label: 'Pages/Home',
      target: '/Pages/Home',
      pinned: true,
      status: 'ready' as const,
      resolution: { text: 'x', chars: 1, truncated: false, originalChars: 1 }
    };
    noteApply();
    noteApply();
    expect(isStale(component, applyCount())).toBe(false);
  });
});

describe('BLD-014 — media ordering within a turn', () => {
  it('puts documents before images, and everything in attach order', async () => {
    const capture = await resolveLivePreviewCapture(shoot);
    const withPdf = {
      id: 'f1',
      kind: 'file' as const,
      label: 'brief.pdf',
      target: 'brief.pdf',
      pinned: true,
      status: 'ready' as const,
      resolution: {
        text: 'a pdf',
        documents: [
          { type: 'document' as const, data: 'B', mediaType: 'application/pdf' as const, title: 'brief.pdf', text: 'a pdf' }
        ],
        chars: 5,
        truncated: false,
        originalChars: 5,
        bytes: 100
      }
    };
    const blocks = referenceMediaBlocks([capture!, withPdf]);
    // ⚠️ **Attach order across references**, documents-before-images only
    // *within* one. The capture was attached first, so its image leads even
    // though the PDF is the bulkier block — the chip row is in attach order and
    // a prompt that reordered them relative to what the user sees is a prompt
    // whose "the first thing I attached" no longer means anything.
    expect(blocks.map((b) => b.type)).toEqual(['image', 'document']);

    // Reverse the attach order and the blocks follow.
    expect(referenceMediaBlocks([withPdf, capture!]).map((b) => b.type)).toEqual(['document', 'image']);
  });
});
