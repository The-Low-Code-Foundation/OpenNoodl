/**
 * FLD-012 (#32) — the empty-box warning, and the two ways it used to cry wolf.
 *
 * *"I started ignoring the warning."* Five of the reporter's ten pages carried `empty-decorated-box`
 * purely for containing a control, and a warning people have learned to skip is worth less than no
 * warning at all.
 *
 * 🔴 **The trap this suite exists to hold shut is the OPPOSITE one.** A rule that suppresses
 * everything reads perfectly green — no false positives, because no findings. So every assertion
 * that something is no longer reported is paired, in the same fixture, with an author's genuinely
 * empty decorated box that MUST still be reported. That is FLD-012's AC2, and without it AC1 is
 * satisfied by deleting the rule.
 *
 * ## Why a fake DOM rather than a real browser
 *
 * `measureExpression` is a string of JavaScript evaluated inside the page, and `purity.test.js`
 * already pins that it touches nothing but DOM APIs. So the predicate can be graded exactly by
 * handing it a DOM — the browser adds layout, and layout is not what this rule reads. The real
 * controls ARE driven in a real Chrome, on a real project, by
 * `dev-docs/tasks/phase-84-.../demo/fld-012-arms.js`; the numbers are in the task file. This suite
 * is the half that can run on every PR.
 *
 * ⚠️ Which means the fake DOM has to be honest about the markup. Every element below was read off
 * a real render of the FLD-012 fixture (`demo/fld-012`), including the two that surprised the task
 * doc: the Radio Button's checked fill is an unclassed absolutely-positioned div, and `appearance`
 * computes to `none` on an ordinary `<div>`.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'src', 'index.js');

// ── the reverted arms, applied textually to the module's own source ───────────────────────────
// The FLD-008 shape: assert each replacement is present EXACTLY once before applying it, so a
// source that has moved fails loudly instead of grading nothing. A reverted arm that no longer
// reverts anything is indistinguishable from a fix that works.
const VISIBLE_NEW = `  const visible = all.filter((el) => {
    const cs = styleOf(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') {
      transparentExcluded += 1;
      return false;
    }
    return el.offsetParent !== null || cs.position === 'fixed';
  });`;
const VISIBLE_OLD = `  const visible = all.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');`;

const SKIPS_NEW = `    if (FORM_CONTROL_TAGS.indexOf(el.tagName) !== -1) return false;
    if (isControlFurniture(el)) return false;
`;

function revert(src, from, to, label) {
  const occurrences = src.split(from).length - 1;
  expect(`${label}: occurrences of the reverted text`).toBe(`${label}: occurrences of the reverted text`);
  if (occurrences !== 1) {
    throw new Error(
      `FLD-012 reverted arm "${label}" expected exactly one occurrence of the text it reverts, found ` +
        `${occurrences}. src/index.js has moved and this arm would have graded nothing.`
    );
  }
  return src.replace(from, to);
}

function compile(src) {
  const module_ = { exports: {} };
  new Function('module', 'exports', `${src}\nreturn module.exports;`)(module_, module_.exports);
  return module_.exports;
}

const HEAD_SRC = fs.readFileSync(SOURCE, 'utf8');
const ARMS = {
  head: () => compile(HEAD_SRC),
  'no-visible': () => compile(revert(HEAD_SRC, VISIBLE_NEW, VISIBLE_OLD, 'no-visible')),
  'no-skips': () => compile(revert(HEAD_SRC, SKIPS_NEW, '', 'no-skips')),
  original: () => compile(revert(revert(HEAD_SRC, VISIBLE_NEW, VISIBLE_OLD, 'original/visible'), SKIPS_NEW, '', 'original/skips'))
};

// ── a DOM small enough to read and real enough to grade ───────────────────────────────────────
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

function element(tag, opts = {}) {
  const style = {
    // Chrome's computed defaults for an ordinary element, which is the point of two of these:
    // `appearance` is `none` on a plain div — measured, and the reason it is not a discriminator —
    // and `opacity` is the string '1', not the number.
    appearance: 'none',
    opacity: '1',
    visibility: 'visible',
    position: 'static',
    backgroundColor: TRANSPARENT,
    borderStyle: 'none',
    fontWeight: '400',
    fontSize: '16px',
    fontFamily: 'Inter, sans-serif',
    display: 'block',
    ...(opts.style || {})
  };
  const node = {
    tagName: tag.toUpperCase(),
    className: opts.cls || '',
    classList: { contains: (c) => String(opts.cls || '').split(/\s+/).indexOf(c) !== -1 },
    children: [],
    parentElement: null,
    __style: style,
    __text: opts.text || '',
    __rect: { width: opts.w != null ? opts.w : 0, height: opts.h != null ? opts.h : 0, top: opts.top || 0, left: 0 },
    __attrs: opts.attrs || {},
    __detached: Boolean(opts.detached),
    get textContent() {
      return node.__text + node.children.map((c) => c.textContent).join('');
    },
    // `display: none` is the ONE thing the old predicate got right, so the fake keeps it honest:
    // offsetParent is null for a display-none element and non-null for a transparent one.
    get offsetParent() {
      if (node.__detached || style.display === 'none') return null;
      return node.parentElement || FAKE_BODY;
    },
    getBoundingClientRect() {
      const r = node.__rect;
      return { width: r.width, height: r.height, top: r.top, left: r.left, right: r.left + r.width, bottom: r.top + r.height };
    },
    getAttribute: (name) => (name in node.__attrs ? node.__attrs[name] : null),
    querySelector(selector) {
      // Only `:scope > tag` lists are used by the code under test; anything else is a mistake in
      // the spec rather than something to guess at.
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        const m = /^:scope > ([a-z]+)$/.exec(part);
        if (!m) throw new Error(`fake DOM: unsupported selector "${part}"`);
        const hit = node.children.find((c) => c.tagName === m[1].toUpperCase());
        if (hit) return hit;
      }
      return null;
    },
    querySelectorAll: () => [],
    append(...kids) {
      for (const k of kids) {
        k.parentElement = node;
        node.children.push(k);
      }
      return node;
    }
  };
  return node;
}

let FAKE_BODY = null;

/** Run one arm's expression against a tree of elements, and hand back the raw measurement. */
function measure(armName, roots) {
  const mod = ARMS[armName]();
  const body = element('body');
  FAKE_BODY = body;
  body.append(...roots);

  const all = [];
  const walk = (n) => {
    for (const c of n.children) {
      all.push(c);
      walk(c);
    }
  };
  walk(body);

  const documentElement = { clientWidth: 1280, clientHeight: 900, scrollHeight: 2000 };
  const sandbox = {
    document: {
      documentElement,
      body,
      querySelectorAll: (sel) => {
        if (sel !== 'body *') throw new Error(`fake DOM: unsupported document selector "${sel}"`);
        return all;
      }
    },
    getComputedStyle: (el, pseudo) => (pseudo ? { content: 'none' } : el.__style),
    window: { innerWidth: 1280, innerHeight: 900, projectData: undefined }
  };

  const expression = mod.measureExpression([], []);
  const run = new Function(
    'document',
    'getComputedStyle',
    'window',
    `return (${expression});`
  );
  return run(sandbox.document, sandbox.getComputedStyle, sandbox.window);
}

/**
 * The fixture, in the markup a real render produces. Deliberately ONE page carrying all four
 * cases at once, because that is the only arrangement in which a suppression cannot hide.
 */
function page() {
  // 1. The author's genuinely empty decorated box. It MUST be reported in every arm.
  const authorBox = element('div', { w: 320, h: 120, style: { backgroundColor: 'rgb(238, 238, 238)', borderStyle: 'solid', position: 'relative' } });

  // 2. A deprecated Radio Button: a styled `<input type="radio">`, 24x24, solid border, visible.
  //    `nodes-deprecated/controls/radiobutton.tsx:62` + `assets/style.css:64`.
  const legacyRadio = element('input', {
    cls: 'ndl-controls-radiobutton-a ndl-controls-radiobutton',
    w: 24,
    h: 24,
    attrs: { type: 'radio' },
    style: { borderStyle: 'solid', position: 'relative' }
  });
  const legacyGroup = element('div', { cls: 'ndl-controls-radiobuttongroup', w: 24, h: 48 }).append(legacyRadio);

  // 3. The CURRENT Radio Button: an `opacity: 0` input (`.ndl-controls-radio-2`) and, beside it,
  //    the checked fill — an unclassed absolutely-positioned div that IS drawn and IS 16x16.
  const modernInput = element('input', {
    cls: 'ndl-controls-radio-2',
    w: 24,
    h: 24,
    attrs: { type: 'radio' },
    style: { opacity: '0', position: 'absolute', backgroundColor: 'rgb(255, 255, 255)' }
  });
  const checkedFill = element('div', { w: 16, h: 16, style: { position: 'absolute', backgroundColor: 'rgb(0, 0, 0)' } });
  const modernRadio = element('div', { cls: 'ndl-controls-pointer', w: 24, h: 24 }).append(checkedFill, modernInput);

  // 4. The Slider: an unclassed track and an unclassed thumb, absolutely positioned, siblings of
  //    the range input (`Slider.tsx:146-176`).
  const track = element('div', { w: 320, h: 12, style: { position: 'absolute', backgroundColor: 'rgb(201, 201, 201)' } });
  const thumb = element('div', { w: 16, h: 16, style: { position: 'absolute', backgroundColor: 'rgb(47, 111, 237)' } });
  // Measured on the real render: the range input itself is transparent with NO border, so it
  // never tripped the rule. It is here because its PRESENCE is what makes its siblings furniture.
  const rangeInput = element('input', { cls: 'ndl-controls-range', w: 320, h: 32, attrs: { type: 'range' } });
  const slider = element('div', { w: 320, h: 32 }).append(track, thumb, rangeInput);

  const heading = element('div', { cls: 'ndl-visual-text', w: 1280, h: 24, text: 'Pick one, then set the amount' });
  const shell = element('div', { w: 1280, h: 600, style: { backgroundColor: 'rgb(255, 255, 255)' } }).append(
    heading,
    legacyGroup,
    modernRadio,
    slider,
    authorBox
  );
  return { roots: [shell], authorBox, checkedFill, thumb, track, legacyRadio, modernInput };
}

const boxes = (raw) => raw.emptyDecoratedBoxes;

describe('FLD-012 — empty-decorated-box stops firing on controls', () => {
  it('🔴 the reverted arm reproduces the defect: six findings, only ONE of them the author\'s', () => {
    const raw = measure('original', page().roots);
    // The deprecated radio input, the modern radio's transparent input, the modern radio's checked
    // fill, the slider track, the slider thumb — and the author's box. FIVE of the six are things
    // the runtime drew for a control. That ratio is the whole of #32.
    expect(boxes(raw).count).toBe(6);
    const tags = boxes(raw).samples.map((s) => `${s.tag} ${s.width}x${s.height}`).sort();
    expect(tags).toEqual(
      ['DIV 16x16', 'DIV 16x16', 'DIV 320x12', 'DIV 320x120', 'INPUT 24x24', 'INPUT 24x24'].sort()
    );
  });

  it('AC1 — at HEAD the controls report nothing, and ONLY the author\'s box survives', () => {
    const raw = measure('head', page().roots);
    expect(boxes(raw).count).toBe(1);
    expect(boxes(raw).samples[0]).toMatchObject({ tag: 'DIV', width: 320, height: 120 });
  });

  it('🔴 AC2 — the presence control: the author\'s empty box is reported in EVERY arm', () => {
    for (const arm of Object.keys(ARMS)) {
      const raw = measure(arm, page().roots);
      // ⚠️ `samples` is capped at six. Assert it is not truncated FIRST, or a fixture that grew by
      // one would push the author's box off the end and this control would fail — or worse, pass —
      // for a reason that has nothing to do with the rule.
      expect(boxes(raw).samples.length).toBe(boxes(raw).count);
      const authors = boxes(raw).samples.filter((s) => s.width === 320 && s.height === 120);
      expect(`${arm}: author box reported ${authors.length} time(s)`).toBe(`${arm}: author box reported 1 time(s)`);
    }
  });

  it('AC3 — an opacity:0 element is absent from `visible`, and the count is reported', () => {
    const withFix = measure('head', page().roots);
    const without = measure('no-visible', page().roots);

    // The modern radio's input is the only transparent element on this page.
    expect(withFix.transparentExcluded).toBe(1);
    expect(without.transparentExcluded).toBe(0);
    expect(withFix.visibleCount).toBe(without.visibleCount - 1);
  });

  it('AC3 — `visibility: hidden` is excluded too, and `display: none` still is', () => {
    const hidden = element('div', { w: 200, h: 200, style: { visibility: 'hidden', backgroundColor: 'rgb(1, 2, 3)' } });
    const goneDisplay = element('div', { w: 200, h: 200, style: { display: 'none', backgroundColor: 'rgb(1, 2, 3)' } });
    const shown = element('div', { w: 200, h: 200, style: { backgroundColor: 'rgb(1, 2, 3)' } });
    const root = element('div', { w: 1280, h: 600 }).append(hidden, goneDisplay, shown);

    const raw = measure('head', [root]);
    expect(raw.transparentExcluded).toBe(1); // the `visibility: hidden` one
    expect(boxes(raw).count).toBe(1); // only the one a person can see
    expect(boxes(raw).samples[0]).toMatchObject({ width: 200, height: 200 });
  });

  it('the form-control skip is what removes the deprecated radio, not the visibility fix', () => {
    const onlyVisibilityFix = measure('no-skips', page().roots);
    const legacy = boxes(onlyVisibilityFix).samples.filter((s) => s.tag === 'INPUT');
    expect(legacy.length).toBe(1);
    expect(boxes(measure('head', page().roots)).samples.filter((s) => s.tag === 'INPUT').length).toBe(0);
  });

  it('🔴 `appearance: none` is NOT used as a discriminator — it is a div\'s computed default', () => {
    // Measured on the real fixture: an ordinary `<div>` computes `appearance: none` in Chrome. A
    // rule that skipped on it would skip the author's box too, which is precisely the suppression
    // AC2 forbids. This asserts the shipped predicate ignores it.
    const p = page();
    expect(p.authorBox.__style.appearance).toBe('none');
    expect(boxes(measure('head', p.roots)).count).toBe(1);
  });

  it('the furniture skip needs BOTH conditions, so an absolutely-positioned author box survives', () => {
    // Absolute, but no control sibling — still reported.
    const absoluteBox = element('div', { w: 300, h: 100, style: { position: 'absolute', backgroundColor: 'rgb(9, 9, 9)' } });
    // Beside a control, but not absolute — still reported.
    const staticBesideControl = element('div', { w: 300, h: 100, style: { backgroundColor: 'rgb(9, 9, 9)' } });
    const input = element('input', { w: 100, h: 20, attrs: { type: 'range' } });
    const withControl = element('div', { w: 400, h: 200 }).append(staticBesideControl, input);
    const root = element('div', { w: 1280, h: 600 }).append(absoluteBox, withControl);

    expect(boxes(measure('head', [root])).count).toBe(2);
  });
});
