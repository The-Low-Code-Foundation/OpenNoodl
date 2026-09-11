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
import {
  carryOver,
  defaultPinned,
  firstImage,
  isStale
} from '../../src/editor/src/models/AiAssistant/thread/references';
import { toggleViewport } from '../../src/editor/src/views/SandboxSurface/renderCaptureModel';
import { DEFAULT_VIEWPORTS, NAMED_VIEWPORTS, type ViewportSpec } from '@nodegx/render-measure';

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
    // ⚠️ `watch`, not `tablet` — this test used `tablet` until the presets
    // landed, and it went red the moment the name became real. That is the
    // fixture doing its job: an unknown-name test whose name quietly becomes
    // known is a test that stops checking anything.
    const parsed = parseViewports('watch') as { error: string };
    expect(parsed.error).toContain('watch');
    // The repair, not just the complaint.
    expect(parsed.error).toContain('desktop');
    expect(parsed.error).toContain('tablet');
    expect(parsed.error).toContain('phone');
    expect(parsed.error).toContain('390x844');
  });

  it('refuses a zero dimension rather than rendering a 0px window', () => {
    expect((parseViewports('0x844') as { error: string }).error).toMatch(/above zero/);
  });
});

describe('BLD-014 — device presets (Richard, 2026-08-10)', () => {
  it('🔴 knows tablet by name, so a mobile-app author can ask for one', () => {
    const parsed = parseViewports('tablet') as { viewports: ViewportSpec[] };
    expect(parsed.viewports[0]).toEqual({ name: 'tablet', width: 1024, height: 1366, mobile: false });
  });

  it('🔴 does NOT add tablet to the default set', () => {
    // ⚠️ A vocabulary and a default are different things. `DEFAULT_VIEWPORTS` is
    // what `render_report` measures when nobody says otherwise, and quietly
    // making that three viewports would change the cost and the recorded output
    // of every call the CLI and the MCP tool have ever been asked to make.
    expect(DEFAULT_VIEWPORTS.map((v) => v.name)).toEqual(['desktop', 'phone']);
    expect(NAMED_VIEWPORTS.map((v) => v.name)).toEqual(['desktop', 'tablet', 'phone']);
    const parsed = parseViewports() as { viewports: ViewportSpec[] };
    expect(parsed.viewports.map((v) => v.name)).toEqual(['desktop', 'phone']);
  });

  it('offers all three by name, and a tablet gets the desktop layout', () => {
    const parsed = parseViewports('desktop,tablet,phone') as { viewports: ViewportSpec[] };
    expect(parsed.viewports.map((v) => v.name)).toEqual(['desktop', 'tablet', 'phone']);
    // 1024px is not a phone: emulating one would report a mobile layout for a
    // device that gets the desktop one, which is the opposite of the question.
    expect(parsed.viewports[1].mobile).toBe(false);
    expect(parsed.viewports[2].mobile).toBe(true);
  });

  it('🔴 toggles one preset without disturbing the others, or a custom size', () => {
    // The preset buttons edit the text and read their lit state back out of it —
    // one store, so typing and clicking cannot disagree. That only holds if the
    // toggle is a pure edit of the spec string.
    expect(toggleViewport('desktop,phone', 'tablet')).toBe('desktop,phone,tablet');
    expect(toggleViewport('desktop,tablet,phone', 'tablet')).toBe('desktop,phone');
    expect(toggleViewport('', 'phone')).toBe('phone');
    expect(toggleViewport('phone', 'phone')).toBe('');
    // A hand-typed custom size survives a preset click.
    expect(toggleViewport('390x844', 'desktop')).toBe('390x844,desktop');
    expect(toggleViewport('390x844,desktop', 'desktop')).toBe('390x844');
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

  it('🔴 scopes each capture\'s summary to its OWN viewport', () => {
    // Found by driving it, and every test above passed with it wrong.
    // `summarise` must see all viewports at once to produce cross-viewport
    // findings — but `report.summary` then describes the whole render, and
    // pasting it onto each capture told a model looking at the *desktop*
    // picture that it had 2 warnings when that viewport had 1, and recited
    // phone measurements no part of that image shows.
    const narrow = reply();
    narrow.viewports.phone = {
      requested: { width: 390, height: 844 },
      ...measured({ layoutWidth: 390, clientWidth: 390, clientHeight: 844, scrollWidth: 900 })
    };
    const { captures } = interpretCaptureReply(narrow, viewports);
    const desktop = captures.find((c) => c.name === 'desktop')!;
    const phone = captures.find((c) => c.name === 'phone')!;

    // Each sentence names its own viewport and not the other one.
    expect(desktop.summary).toContain('desktop');
    expect(desktop.summary).not.toContain('phone');
    expect(phone.summary).toContain('phone');
    expect(phone.summary).not.toContain('desktop');

    /*
     * And each counts only its own findings. Both viewports share a
     * `flat-type-scale` warning from the fixture; the horizontal overflow is
     * the phone's alone. So the phone names it and the desktop must not — the
     * whole-report summary named it on both.
     */
    expect(phone.summary).toContain('horizontal-overflow');
    expect(desktop.summary).not.toContain('horizontal-overflow');
    expect(desktop.summary).toContain('1 warning');
    expect(phone.summary).toContain('2 warnings');
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

  it('🔴 is viewable, so the user can check what the agent was shown', async () => {
    // Richard, 2026-08-10: "we can't leave users in the dark about what the AI
    // has seen." A capture is the one kind whose whole content is invisible —
    // made by a browser window nobody can see and summarised as a byte count.
    // A cookie banner, a loading state and a good render all look identical on
    // the chip.
    const [ref] = await resolveRenderCapture(appViewerUrl(), captures, false);
    const image = firstImage(ref);
    expect(image).toBeDefined();
    expect(image!.mediaType).toBe('image/png');
    // ⚠️ The viewer shows the reference's OWN bytes, so what is on screen is
    // byte-identical to what the provider receives. A preview that re-captured
    // would be a picture of something *like* what was sent.
    expect(image!.data).toBe(captures[0].data);
  });

  it('offers the view control for any image, not only a capture', () => {
    // The pasted-screenshot path (BLD-013) had the same gap and nobody noticed,
    // because that is the one route where the user has just seen the file.
    const pastedImage = {
      id: 'f1',
      kind: 'file' as const,
      label: 'mock.png',
      target: 'mock.png',
      pinned: true,
      status: 'ready' as const,
      resolution: {
        text: 'a mock',
        images: [{ type: 'image' as const, data: 'ZZZZ', mediaType: 'image/png' as const, text: 'a mock' }],
        chars: 6,
        truncated: false,
        originalChars: 6,
        bytes: 3
      }
    };
    expect(firstImage(pastedImage)?.data).toBe('ZZZZ');

    // And not for anything without one — the eye must not appear on a doc.
    const doc = {
      id: 'd1',
      kind: 'doc' as const,
      label: 'BRIEF.md',
      target: 'docs/BRIEF.md',
      pinned: true,
      status: 'ready' as const,
      resolution: { text: 'x', chars: 1, truncated: false, originalChars: 1 }
    };
    expect(firstImage(doc)).toBeUndefined();

    /*
     * ⚠️ And not on a **failed** reference that still carries bytes — which is
     * the only case that exercises the status guard at all.
     *
     * This assertion was written first against a *doc* with no images, and an
     * inversion that deleted the `status === 'ready'` check passed anyway: the
     * fixture had no `images` array, so the guard was never reached. A spec that
     * cannot fail is not a spec. The state below is the one the guard is for —
     * a resolver that failed after producing a partial resolution — and offering
     * a view control on it would open a viewer onto bytes the turn will not send.
     */
    const failedWithBytes = {
      ...pastedImage,
      id: 'f2',
      status: 'failed' as const,
      error: 'The screenshot could not be encoded.'
    };
    expect(firstImage(failedWithBytes)).toBeUndefined();
  });

  it('keeps each viewport\'s target distinct, so two chips are two things', async () => {
    const refs = await resolveRenderCapture('https://example.com', captures, true);
    expect(refs[0].target).not.toBe(refs[1].target);
    expect(refs[0].target).toContain('desktop');
    expect(refs[1].target).toContain('phone');
  });
});
