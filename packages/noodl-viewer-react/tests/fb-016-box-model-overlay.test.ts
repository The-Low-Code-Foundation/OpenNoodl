/**
 * FB-016 — what the box-model overlay says, graded without a renderer.
 *
 * 🔴 **jsdom has no layout engine, so asking the DOM these questions grades nothing.**
 * `getBoundingClientRect()` is all zeroes there and `getComputedStyle()` returns initial values;
 * a spec that built an element, set a width and asked for the overlay's answer would pass on a
 * box of zeroes whatever the code did. So the geometry is fed in, and what is graded is the
 * arithmetic and the wording — the two things that are actually this module's own work. The
 * running-viewer half (does `getComputedStyle` say what we think on a real element) is a drive,
 * and is recorded as one in the task file.
 *
 * The radius cases below are the two arms FB-017's drive measured in the editor's own renderer,
 * transcribed: an `<img>` that rounds with nothing clipping it, and a container whose corner is
 * genuinely square because a child paints over it.
 */
import {
  BoxModel,
  ComputedReader,
  chipPosition,
  clipsAtRadius,
  contentRect,
  describeAutoMargins,
  describeBox,
  describeParentOverflow,
  describeSize,
  describeSpacing,
  marginRect,
  overlayRadii,
  paddingRect,
  radiiToCss,
  readBoxModel,
  readCornerRadii
} from '../src/box-model-overlay';

/** A `getComputedStyle` result, or an inline `element.style`, as this module reads them. */
function style(declarations: Record<string, string>): ComputedReader {
  return {
    getPropertyValue: (property: string) => declarations[property] || ''
  };
}

const EDGES = style({
  'margin-top': '10px',
  'margin-right': '20px',
  'margin-bottom': '10px',
  'margin-left': '20px',
  'border-top-width': '2px',
  'border-right-width': '2px',
  'border-bottom-width': '2px',
  'border-left-width': '2px',
  'padding-top': '8px',
  'padding-right': '12px',
  'padding-bottom': '8px',
  'padding-left': '12px'
});

describe('the four rects', () => {
  const model: BoxModel = readBoxModel({ x: 50, y: 60, width: 200, height: 100 }, EDGES);

  it('reads every edge off the computed style', () => {
    expect(model.margin).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
    expect(model.borderWidth).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
    expect(model.padding).toEqual({ top: 8, right: 12, bottom: 8, left: 12 });
  });

  it('grows the border box by the margins', () => {
    expect(marginRect(model)).toEqual({ x: 30, y: 50, width: 240, height: 120 });
  });

  it('insets by the borders, then by the padding', () => {
    expect(paddingRect(model)).toEqual({ x: 52, y: 62, width: 196, height: 96 });
    expect(contentRect(model)).toEqual({ x: 64, y: 70, width: 172, height: 80 });
  });

  it('never inverts a rect when the padding is wider than the box', () => {
    const squeezed = readBoxModel(
      { x: 0, y: 0, width: 10, height: 10 },
      style({ 'padding-left': '40px', 'padding-right': '40px' })
    );
    expect(contentRect(squeezed).width).toBe(0);
  });

  it('reads an unlaid-out `auto` margin as zero rather than NaN', () => {
    const auto = readBoxModel({ x: 0, y: 0, width: 10, height: 10 }, style({ 'margin-left': 'auto' }));
    expect(auto.margin.left).toBe(0);
    expect(marginRect(auto).width).toBe(10);
  });
});

describe('scope 5 — the radius the overlay draws is not always the element’s own', () => {
  const rect = { x: 0, y: 0, width: 200, height: 200 };
  const rounded = style({
    'border-top-left-radius': '40px',
    'border-top-right-radius': '40px',
    'border-bottom-right-radius': '40px',
    'border-bottom-left-radius': '40px',
    'overflow-x': 'visible',
    'overflow-y': 'visible'
  });
  const radii = readCornerRadii(rounded);

  it('rounds an <img> that carries the radius with nothing clipping it — Jordan’s case', () => {
    expect(clipsAtRadius('IMG', rounded)).toBe(true);
    expect(overlayRadii({ radii, borderRect: rect, clips: true, childRects: [] })).toEqual({
      topLeft: 40,
      topRight: 40,
      bottomRight: 40,
      bottomLeft: 40
    });
  });

  it('leaves square the corner a child is painting over — the arm that is NOT a render bug', () => {
    const child = { x: 0, y: 0, width: 60, height: 60 }; // sits in the top-left corner only
    expect(clipsAtRadius('DIV', rounded)).toBe(false);
    expect(overlayRadii({ radii, borderRect: rect, clips: false, childRects: [child] })).toEqual({
      topLeft: 0,
      topRight: 40,
      bottomRight: 40,
      bottomLeft: 40
    });
  });

  it('rounds every corner again once the container clips, child or no child', () => {
    const clipping = style({
      'border-top-left-radius': '40px',
      'border-top-right-radius': '40px',
      'border-bottom-right-radius': '40px',
      'border-bottom-left-radius': '40px',
      'overflow-x': 'hidden',
      'overflow-y': 'hidden'
    });
    expect(clipsAtRadius('DIV', clipping)).toBe(true);
    expect(
      overlayRadii({ radii, borderRect: rect, clips: true, childRects: [{ x: 0, y: 0, width: 60, height: 60 }] })
    ).toEqual({ topLeft: 40, topRight: 40, bottomRight: 40, bottomLeft: 40 });
  });

  it('treats scroll and auto as clipping too', () => {
    expect(clipsAtRadius('DIV', style({ 'overflow-x': 'auto', 'overflow-y': 'visible' }))).toBe(true);
    expect(clipsAtRadius('DIV', style({ 'overflow-x': 'visible', 'overflow-y': 'scroll' }))).toBe(true);
  });

  it('control — a square element stays square, so a passing row above is not the function returning its input', () => {
    const square = style({ 'overflow-x': 'visible', 'overflow-y': 'visible' });
    expect(readCornerRadii(square)).toEqual({ topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 });
    expect(radiiToCss(readCornerRadii(square))).toBe('0px 0px 0px 0px');
  });

  it('a child clear of every corner leaves all four rounded', () => {
    const middle = { x: 80, y: 80, width: 40, height: 40 };
    expect(overlayRadii({ radii, borderRect: rect, clips: false, childRects: [middle] })).toEqual({
      topLeft: 40,
      topRight: 40,
      bottomRight: 40,
      bottomLeft: 40
    });
  });

  it('writes the corners in CSS order: top-left, top-right, bottom-right, bottom-left', () => {
    expect(radiiToCss({ topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 })).toBe('1px 2px 3px 4px');
  });
});

describe('scope 2 — the fact line answers the three confusions the report describes', () => {
  const columnParent = {
    rect: { x: 0, y: 0, width: 400, height: 800 },
    computed: style({ display: 'flex', 'flex-direction': 'column', 'justify-content': 'flex-start', 'align-items': 'flex-start' })
  };

  it('#1 “why has that group taken up the whole width” — because it was asked to', () => {
    const facts = describeBox({
      rect: { x: 0, y: 0, width: 400, height: 60 },
      computed: style({ position: 'relative', 'flex-grow': '0' }),
      specified: style({ width: '100%' }),
      parent: columnParent
    });

    expect(facts[0]).toBe('400 × 60');
    expect(facts).toContain('width: 100% of the parent');
  });

  it('#1 control — a fixed width is never reported as a percentage', () => {
    expect(
      describeSize('width', {
        rect: { x: 0, y: 0, width: 400, height: 60 },
        computed: style({ 'flex-grow': '0' }),
        specified: style({ width: '240px' }),
        parent: columnParent
      })
    ).toBe('width: fixed 240px');
  });

  it('#2 “why has it gone under another group” — because the parent stacks and it is in the flow', () => {
    const facts = describeBox({
      rect: { x: 0, y: 100, width: 200, height: 60 },
      computed: style({ position: 'relative' }),
      specified: style({}),
      parent: columnParent
    });

    expect(facts).toContain('position: relative — flows after its siblings');
    expect(facts).toContain('parent stacks its children in a column');
  });

  it('#2 control — an absolutely placed node is told apart from one in the flow', () => {
    const facts = describeBox({
      rect: { x: 0, y: 100, width: 200, height: 60 },
      computed: style({ position: 'absolute' }),
      specified: style({}),
      parent: columnParent
    });
    expect(facts).toContain('position: absolute — placed on its parent, not in its flow');
    expect(facts).not.toContain('position: absolute — flows after its siblings');
  });

  it('#3 “why is it not centred” — it names what IS placing it', () => {
    const facts = describeBox({
      rect: { x: 0, y: 0, width: 200, height: 60 },
      computed: style({ position: 'relative' }),
      specified: style({}),
      parent: columnParent
    });

    expect(facts).toContain('parent packs: flex-start  ·  lines up: flex-start');
    expect(facts.join('\n')).not.toContain('centred');
  });

  it('#3 an untouched parent reads as its default, never as the word `normal`', () => {
    // `getComputedStyle` answers `normal` for an untouched justify-content, and "packs them:
    // normal" tells an author nothing. In a flex container it behaves as the default, so the
    // default is what the line names.
    const facts = describeBox({
      rect: { x: 0, y: 0, width: 200, height: 60 },
      computed: style({ position: 'relative' }),
      specified: style({}),
      parent: {
        rect: { x: 0, y: 0, width: 400, height: 800 },
        computed: style({ display: 'flex', 'flex-direction': 'column', 'justify-content': 'normal', 'align-items': 'normal' })
      }
    });
    expect(facts).toContain('parent packs: flex-start  ·  lines up: stretch');
    expect(facts.join('\n')).not.toContain('normal');
  });

  it('#3 the other half — Noodl centres with auto margins, and the word survives only in the specified style', () => {
    expect(describeAutoMargins(style({ 'margin-left': 'auto', 'margin-right': 'auto' }))).toBe(
      'centred across by auto margins'
    );
    expect(describeAutoMargins(style({ 'margin-left': 'auto' }))).toBe('pushed right by margin-left: auto');
    expect(describeAutoMargins(style({ 'margin-top': 'auto', 'margin-bottom': 'auto' }))).toBe(
      'centred down by auto margins'
    );
    expect(describeAutoMargins(style({ 'margin-left': '8px' }))).toBeNull();
  });

  it('a percentage along the parent’s flex direction is a negotiation, and says so', () => {
    expect(
      describeSize('width', {
        rect: { x: 0, y: 0, width: 200, height: 60 },
        computed: style({ 'flex-grow': '100' }),
        specified: style({ width: '100%' }),
        parent: {
          rect: { x: 0, y: 0, width: 400, height: 60 },
          computed: style({ display: 'flex', 'flex-direction': 'row' })
        }
      })
    ).toBe('width: 100% — shares the row with its siblings (flex-grow: 100)');
  });

  it('the calc() Layout.size writes for a sized node with margins is read back as the percentage', () => {
    expect(
      describeSize('width', {
        rect: { x: 0, y: 0, width: 384, height: 60 },
        computed: style({ 'flex-grow': '0' }),
        specified: style({ width: 'calc(100% - 8px)' }),
        parent: columnParent
      })
    ).toBe('width: 100% of the parent, less its own margins');
  });

  it('an unset size is content-driven, which is a fact and not a blank', () => {
    expect(
      describeSize('height', {
        rect: { x: 0, y: 0, width: 200, height: 60 },
        computed: style({}),
        specified: style({}),
        parent: columnParent
      })
    ).toBe('height: from its content');
  });

  it('a transform is reported, because it moves the element after everything else placed it', () => {
    const facts = describeBox({
      rect: { x: 0, y: 0, width: 200, height: 60 },
      computed: style({ position: 'relative', transform: 'matrix(1, 0, 0, 1, -100, 0)' }),
      specified: style({}),
      parent: columnParent
    });
    expect(facts).toContain('transform: matrix(1, 0, 0, 1, -100, 0) — moves it after it has been placed');
  });

  it('control — `transform: none` is not a fact and is not reported', () => {
    const facts = describeBox({
      rect: { x: 0, y: 0, width: 200, height: 60 },
      computed: style({ position: 'relative', transform: 'none' }),
      specified: style({}),
      parent: columnParent
    });
    expect(facts.join('\n')).not.toContain('transform');
  });
});

describe('scope 3 — the element is bigger than the space it was given', () => {
  const parent = {
    rect: { x: 0, y: 0, width: 300, height: 200 },
    computed: style({ 'padding-left': '20px', 'padding-right': '20px', display: 'flex', 'flex-direction': 'column' })
  };

  it('measures against the parent’s content box, so a padding-sized overflow is not missed', () => {
    expect(
      describeParentOverflow({
        rect: { x: 20, y: 0, width: 280, height: 50 },
        computed: style({}),
        specified: style({}),
        parent
      })
    ).toBe('overflows its parent: 20px past the right');
  });

  it('control — an element inside its parent’s content box reports nothing', () => {
    expect(
      describeParentOverflow({
        rect: { x: 20, y: 0, width: 260, height: 50 },
        computed: style({}),
        specified: style({}),
        parent
      })
    ).toBeNull();
  });

  it('says nothing at all when there is no parent to overflow', () => {
    expect(
      describeParentOverflow({ rect: { x: 0, y: 0, width: 10, height: 10 }, computed: style({}), specified: style({}) })
    ).toBeNull();
  });
});

describe('the spacing summary the thin bands rely on', () => {
  it('lists only the groups that are set, in top/right/bottom/left order', () => {
    const model = readBoxModel({ x: 0, y: 0, width: 10, height: 10 }, EDGES);
    expect(describeSpacing(model)).toBe(
      'margin 10/20/10/20  ·  padding 8/12/8/12  ·  border 2/2/2/2   (top/right/bottom/left)'
    );
  });

  it('control — an element with no spacing at all gets no line', () => {
    expect(describeSpacing(readBoxModel({ x: 0, y: 0, width: 10, height: 10 }, style({})))).toBeNull();
  });
});


describe('where the fact chip goes', () => {
  const viewport = { width: 1000, height: 600 };
  const chip = { width: 300, height: 140 };

  it('sits beside the element, because the first drive caught it covering the siblings it was explaining', () => {
    expect(chipPosition({ x: 20, y: 20, width: 360, height: 60 }, chip, viewport)).toEqual({ x: 388, y: 20 });
  });

  it('swaps to the other side when there is no room on the right', () => {
    expect(chipPosition({ x: 650, y: 40, width: 340, height: 60 }, chip, viewport)).toEqual({ x: 342, y: 40 });
  });

  it('falls back to above, then below, when neither side fits', () => {
    const wide = { x: 10, y: 300, width: 980, height: 60 };
    expect(chipPosition(wide, chip, viewport)).toEqual({ x: 10, y: 152 });

    const wideAtTop = { x: 10, y: 10, width: 980, height: 60 };
    expect(chipPosition(wideAtTop, chip, viewport)).toEqual({ x: 10, y: 78 });
  });

  it('never leaves the viewport, whatever the element does', () => {
    const spot = chipPosition({ x: -400, y: 590, width: 200, height: 400 }, chip, viewport);
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeGreaterThanOrEqual(0);
    expect(spot.y + chip.height).toBeLessThanOrEqual(viewport.height);
  });
});
