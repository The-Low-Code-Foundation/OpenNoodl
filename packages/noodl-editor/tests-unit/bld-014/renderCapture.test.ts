/**
 * BLD-014 — the CDP producer.
 *
 * The webview grab answers *"what does it look like right now?"* at whatever
 * size the preview pane happens to be. Everything here is about the question it
 * structurally cannot answer: **a named viewport**, and **a URL**.
 *
 * ⚠️ What is graded here is the *rules* half (`renderCaptureModel.ts`) and the
 * resolver above it. The transport — `main/render-capture.js` — opens a real
 * browser window and is driven live rather than mocked into a shape that agrees
 * with itself. That split is deliberate: a test double for a debugger session
 * would grade this file's opinion of CDP, not CDP.
 */

import {
  egressNotice,
  hostLabel,
  renderCaptureTwinText,
  resolveRenderCapture
} from '../../src/editor/src/models/AiAssistant/authoring/captureReferences';
import {
  applyCount,
  noteApply,
  resetApplyCountForTests
} from '../../src/editor/src/models/AiAssistant/authoring/applyCount';
import {
  appViewerUrl,
  base64Bytes,
  interpretCaptureReply,
  isExternalUrl,
  parseViewports,
  type CapturedViewport,
  type RenderCaptureReply
} from '../../src/editor/src/views/SandboxSurface/renderCaptureModel';
import { carryOver, defaultPinned, isStale } from '../../src/editor/src/models/AiAssistant/thread/references';

beforeEach(() => resetApplyCountForTests());

/**
 * A measurement blob shaped enough for `summarise` to judge it.
 *
 * Built from what `measureExpression` actually returns rather than from the
 * fields these tests happen to read — a fixture narrowed to the assertions is a
 * fixture that stops representing its subject the moment `summarise` reads one
 * more field.
 */
function measured(overrides: Record<string, unknown> = {}) {
  return {
    lists: [],
    layoutWidth: 1280,
    clientWidth: 1280,
    clientHeight: 900,
    scrollWidth: 1280,
    pageHeight: 900,
    contentBottom: 880,
    overflowing: [],
    overflowingCount: 0,
    text: {
      elements: 42,
      onScreen: 42,
      unreachable: 0,
      fontWeights: { 400: 30, 700: 12 },
      fontSizes: { 14: 30, 24: 12 },
      distinctFontSizes: 2,
      bodyFontFamily: 'Inter'
    },
    placeholders: { count: 0, byText: {}, samples: [] },
    images: { total: 6, onScreen: 6, unreachable: 0, broken: 0, brokenSources: [] },
    emptyDecoratedBoxes: { count: 0, samples: [] },
    repeatedGroups: [],
    consoleErrors: [],
    ...overrides
  };
}

describe('BLD-014 — the viewport vocabulary', () => {
  it('defaults to the two viewports the CLI and the MCP tool default to', () => {
    const parsed = parseViewports();
    expect('error' in parsed).toBe(false);
    expect((parsed as { viewports: unknown[] }).viewports.map((v: never) => (v as { name: string }).name)).toEqual([
      'desktop',
      'phone'
    ]);
    // An empty field is not a different request from no field.
    expect(parseViewports('   ')).toEqual(parsed);
  });

  it('🔴 takes the acceptance criterion\'s own spelling, 390x844', () => {
    const parsed = parseViewports('390x844');
    expect('error' in parsed).toBe(false);
    const [vp] = (parsed as { viewports: { name: string; width: number; height: number; mobile: boolean }[] }).viewports;
    expect(vp).toEqual({ name: '390x844', width: 390, height: 844, mobile: true });
  });

  it('⚠️ emulates a device below 500px, because Chrome will not open a window that narrow', () => {
    // Not cosmetic: without `mobile`, a 390px request quietly lays out at ~500
    // and reports back the width that was asked for — a phone finding measured
    // at desktop width, which is worse than no phone finding.
    const narrow = parseViewports('390x844') as { viewports: { mobile: boolean }[] };
    const wide = parseViewports('1440x900') as { viewports: { mobile: boolean }[] };
    expect(narrow.viewports[0].mobile).toBe(true);
    expect(wide.viewports[0].mobile).toBe(false);
  });

  it('mixes names and explicit sizes in one spec', () => {
    const parsed = parseViewports('desktop,390x844') as { viewports: { name: string }[] };
    expect(parsed.viewports.map((v) => v.name)).toEqual(['desktop', '390x844']);
  });

  it('names what IS known when it refuses, rather than only what is not', () => {
    const parsed = parseViewports('tablet') as { error: string };
    expect(parsed.error).toContain('tablet');
    // The repair, not just the complaint.
    expect(parsed.error).toContain('desktop');
    expect(parsed.error).toContain('phone');
    expect(parsed.error).toContain('390x844');
  });

  it('refuses a zero dimension rather than rendering a 0px window', () => {
    expect((parseViewports('0x844') as { error: string }).error).toMatch(/above zero/);
  });
});

describe('BLD-014 — which page is somebody else\'s', () => {
  it('treats the editor\'s own viewer origin as internal', () => {
    expect(isExternalUrl(appViewerUrl())).toBe(false);
    expect(isExternalUrl(`${appViewerUrl()}some/route?x=1`)).toBe(false);
  });

  it('🔴 treats anything else — including nonsense — as external', () => {
    // ⚠️ The failure directions are not symmetric. A false "external" costs one
    // extra sentence on screen; a false "internal" ships a stranger's page to
    // the user's provider with no disclosure at all, which is build item 7's
    // whole subject.
    expect(isExternalUrl('https://example.com')).toBe(true);
    expect(isExternalUrl('http://localhost:9999/')).toBe(true);
    expect(isExternalUrl('not a url')).toBe(true);
  });

  it('says both halves of what a URL capture does', () => {
    const notice = egressNotice('https://example.com/pricing');
    expect(notice).toContain('example.com');
    // Two disclosures, and a user can reasonably object to either.
    expect(notice).toMatch(/hidden browser window/);
    expect(notice).toMatch(/sent to your AI provider/);
  });

  it('labels by host, not by the whole URL', () => {
    expect(hostLabel('https://example.com/a/b?c=1')).toBe('example.com');
    expect(hostLabel('nonsense')).toBe('nonsense');
  });
});

describe('BLD-014 — interpreting what came back', () => {
  const viewports = [
    { name: 'desktop', width: 1280, height: 900, mobile: false },
    { name: 'phone', width: 390, height: 844, mobile: true }
  ];

  function reply(overrides: Partial<RenderCaptureReply> = {}): RenderCaptureReply {
    return {
      viewports: {
        desktop: { requested: { width: 1280, height: 900 }, ...measured() },
        phone: {
          requested: { width: 390, height: 844 },
          ...measured({ layoutWidth: 390, clientWidth: 390, clientHeight: 844, scrollWidth: 390 })
        }
      },
      screenshots: [
        { name: 'desktop', mimeType: 'image/png', base64: 'AAAA' },
        { name: 'phone', mimeType: 'image/png', base64: 'BBBB' }
      ],
      ...overrides
    };
  }

  it('returns one capture per viewport, each with its own picture', () => {
    const { captures } = interpretCaptureReply(reply(), viewports);
    expect(captures.map((c) => c.name)).toEqual(['desktop', 'phone']);
    expect(captures.map((c) => c.data)).toEqual(['AAAA', 'BBBB']);
    expect(captures[1].width).toBe(390);
    expect(captures[1].height).toBe(844);
  });

  it('🔴 files each finding against the viewport it was measured at', () => {
    // A horizontal overflow at 390 is a phone defect. Attributing it to the
    // desktop capture would send the model a picture that does not show the
    // thing the sentence beside it describes.
    const narrow = reply();
    narrow.viewports.phone = {
      requested: { width: 390, height: 844 },
      // `scrollWidth` past `clientWidth` is the page scrolling sideways —
      // `summarise`'s own condition, not a paraphrase of it.
      ...measured({ layoutWidth: 390, clientWidth: 390, clientHeight: 844, scrollWidth: 900 })
    };
    const { captures } = interpretCaptureReply(narrow, viewports);
    const phone = captures.find((c) => c.name === 'phone')!;
    const desktop = captures.find((c) => c.name === 'desktop')!;
    expect(phone.findings.some((f) => f.code === 'horizontal-overflow')).toBe(true);
    expect(desktop.findings.some((f) => f.code === 'horizontal-overflow')).toBe(false);
    expect(phone.findings.every((f) => f.viewport === 'phone')).toBe(true);
  });

  it('🔴 distinguishes "measured clean" from "measurement failed"', () => {
    // The same ambiguity the webview producer already guards: `summarise` skips
    // any viewport carrying an `error`, so without the branch a failed
    // measurement presents as "measured, nothing found".
    const broken = reply();
    broken.viewports.phone = { requested: { width: 390, height: 844 }, error: 'Evaluation timed out.' };
    const { captures } = interpretCaptureReply(broken, viewports);
    const phone = captures.find((c) => c.name === 'phone')!;
    const desktop = captures.find((c) => c.name === 'desktop')!;
    expect(phone.measurementError).toBe('Evaluation timed out.');
    expect(phone.summary).toBeUndefined();
    expect(desktop.summary).toBeDefined();
    expect(desktop.measurementError).toBeUndefined();
  });

  it('passes a transport failure straight through rather than reporting an empty render', () => {
    const failed = interpretCaptureReply(
      { viewports: {}, screenshots: [], error: 'Could not load https://nope.invalid: ERR_NAME_NOT_RESOLVED' },
      viewports
    );
    expect(failed.captures).toEqual([]);
    expect(failed.error).toMatch(/ERR_NAME_NOT_RESOLVED/);
  });

  it('says so when a page loaded but produced no picture', () => {
    const { error } = interpretCaptureReply({ viewports: {}, screenshots: [] }, viewports);
    expect(error).toMatch(/no screenshot came back/);
  });

  it('counts PNG bytes off the base64, padding included', () => {
    expect(base64Bytes('AAAA')).toBe(3);
    expect(base64Bytes('AAA=')).toBe(2);
    expect(base64Bytes('AA==')).toBe(1);
  });
});

describe('BLD-014 — the twin a model that cannot see reads', () => {
  const capture: CapturedViewport = {
    name: 'phone',
    width: 390,
    height: 844,
    data: 'AAAA',
    bytes: 240_000,
    findings: [],
    summary: 'Rendered clean: 42 texts, 6 images.'
  };

  it('🔴 says this IS a device viewport — the opposite of the webview twin', () => {
    // The webview twin's load-bearing sentence is "not a device viewport",
    // which is the honest limit of a grab. Here the opposite is true and just as
    // load-bearing: a model told otherwise would discount a genuine 390px
    // finding as an artefact of a narrow pane.
    const twin = renderCaptureTwinText(capture, appViewerUrl(), false);
    expect(twin).toContain('390×844');
    expect(twin).toMatch(/real device viewport/);
    expect(twin).not.toMatch(/not a device viewport/);
  });

  it('names the viewport it was asked for, so a finding can be traced to one', () => {
    expect(renderCaptureTwinText(capture, appViewerUrl(), false)).toContain('"phone"');
  });

  it('🔴 tells the model an external page is external', () => {
    const external = renderCaptureTwinText(capture, 'https://example.com/pricing', true);
    expect(external).toMatch(/an external page/);
    expect(external).toContain('https://example.com/pricing');

    const own = renderCaptureTwinText(capture, appViewerUrl(), false);
    expect(own).toMatch(/the user's own app/);
    expect(own).not.toMatch(/an external page/);
  });

  it('carries the findings, which is build item 4', () => {
    const twin = renderCaptureTwinText(
      {
        ...capture,
        findings: [
          {
            code: 'horizontal-overflow',
            severity: 'warning',
            viewport: 'phone',
            message: 'The page scrolls sideways: scrollWidth 900 against a 390 viewport.'
          }
        ]
      },
      appViewerUrl(),
      false
    );
    expect(twin).toContain('[warning] horizontal-overflow');
    // The sentence that is the actual point of build item 4.
    expect(twin).toMatch(/act on the measurements above/);
  });

  it('⚠️ cuts a long findings list by count, worst first, and states the remainder', () => {
    // `REFERENCE_CAPS.capture` is 2,000 characters and a two-viewport render can
    // exceed it. Cut by count rather than with `capReferenceText`, whose
    // heading-boundary cut would sever a finding mid-sentence and leave the
    // model unable to tell a truncated one from a complete one.
    const many = Array.from({ length: 20 }, (_, i) => ({
      code: 'empty-decorated-box' as const,
      severity: (i === 19 ? 'error' : 'info') as 'error' | 'info',
      viewport: 'phone',
      message: `finding number ${i}`
    }));
    const twin = renderCaptureTwinText({ ...capture, findings: many }, appViewerUrl(), false);
    expect(twin).toContain('…and 8 more');
    // Severity first: the single error must survive a cut that drops 8 infos.
    expect(twin).toContain('finding number 19');
  });

  it('reports a failed measurement as a picture only, without claiming it is clean', () => {
    const twin = renderCaptureTwinText(
      { ...capture, summary: undefined, measurementError: 'Evaluation timed out.' },
      appViewerUrl(),
      false
    );
    expect(twin).toMatch(/measurement did not run/);
    expect(twin).toContain('Evaluation timed out.');
    expect(twin).toMatch(/do not guess/i);
  });
});

describe('BLD-014 — a render becomes references', () => {
  const captures: CapturedViewport[] = [
    { name: 'desktop', width: 1280, height: 900, data: 'AAAA', bytes: 300_000, findings: [], summary: 'Clean.' },
    { name: 'phone', width: 390, height: 844, data: 'BBBB', bytes: 120_000, findings: [], summary: 'Clean.' }
  ];

  it('🔴 attaches one reference per viewport, not one per render', () => {
    // Two pictures with different findings and different costs. One chip would
    // print a single price for both and give the user no way to drop the one
    // they did not need.
    return resolveRenderCapture(appViewerUrl(), captures, false).then((refs) => {
      expect(refs).toHaveLength(2);
      expect(refs.map((r) => r.resolution?.bytes)).toEqual([300_000, 120_000]);
      expect(new Set(refs.map((r) => r.id)).size).toBe(2);
    });
  });

  it('🔴 labels an external capture with its host — the acceptance criterion', async () => {
    const external = await resolveRenderCapture('https://example.com/pricing', captures, true);
    expect(external.map((r) => r.label)).toEqual(['example.com · desktop', 'example.com · phone']);

    const own = await resolveRenderCapture(appViewerUrl(), captures, false);
    expect(own.map((r) => r.label)).toEqual(['Your app · desktop', 'Your app · phone']);
  });

  it('carries the picture and the twin that describes it', async () => {
    const [ref] = await resolveRenderCapture(appViewerUrl(), captures, false);
    expect(ref.kind).toBe('capture');
    expect(ref.status).toBe('ready');
    expect(ref.resolution?.images).toHaveLength(1);
    expect(ref.resolution?.images?.[0].mediaType).toBe('image/png');
    // The twin the model reads and the block's own text are the same string —
    // two copies could disagree and only one of them is sent.
    expect(ref.resolution?.images?.[0].text).toBe(ref.resolution?.text);
  });

  it('inherits Rule 7 from the kind rather than restating it', async () => {
    // Nothing in the CDP resolver re-implements staleness or pinning; it gets
    // both by being a `capture`, which is what BLD-011's union-up-front bought.
    noteApply();
    noteApply();
    const [ref] = await resolveRenderCapture(appViewerUrl(), captures, false);
    expect(defaultPinned('capture')).toBe(false);
    expect(ref.pinned).toBe(false);
    expect(ref.capturedAtApply).toBe(2);
    expect(isStale(ref, applyCount())).toBe(false);

    noteApply();
    expect(isStale(ref, applyCount())).toBe(true);
    // Rule 7: it rides exactly the turn it was attached to.
    expect(carryOver([ref])).toEqual([]);
  });

  it('keeps each viewport\'s target distinct, so two chips are two things', async () => {
    const refs = await resolveRenderCapture('https://example.com', captures, true);
    expect(refs[0].target).not.toBe(refs[1].target);
    expect(refs[0].target).toContain('desktop');
    expect(refs[1].target).toContain('phone');
  });
});
