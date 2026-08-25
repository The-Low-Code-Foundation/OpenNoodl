/**
 * FB-017 AC4 — the corner-radius hint, both arms, and the corpus the claim rests on.
 *
 * AC4 asks for "the hint draws when radius is set and the image isn't clipped, and not when it is
 * — both arms asserted." The two arms are the first two cases below. Everything after them is
 * there because a hint that fires when it should is only half of the requirement: this one appears
 * beside a control the author is already looking at, so every way it could fire *wrongly* is a way
 * of telling somebody their corners are broken when they are not.
 *
 * ⚠️ The messages are asserted by what they say, not by comparing against the exported constant.
 * Handing the expected string in as an input and reading it back grades nothing — it is the
 * eighth entry in this repo's "hole shaped like the defect" list, and it was this task's own
 * session that put it there.
 */

import {
  CORNER_RADIUS_PORTS,
  HINTABLE_PORTS,
  HINT_INPUT_PARAMETERS,
  HintSubject,
  hintsForNode,
  isChildClipped,
  isNonZeroLength
} from '../../src/editor/src/views/panels/propertyeditor/propertyPanelHints';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalog = require('../../../noodl-types/src/node-catalog.json');

/** A `Group`-shaped subject: it has every corner-radius port, `clip`, and the scroll pair. */
function group(parameters: Record<string, unknown>, childCount = 1): HintSubject {
  const ports = new Set<string>([...CORNER_RADIUS_PORTS, 'clip', 'scrollEnabled', 'nativeScroll']);
  return {
    getParameter: (name) => parameters[name],
    hasPort: (name) => ports.has(name),
    childCount
  };
}

/** A `Button`-shaped subject: corner radius and children, but no clipping control at all. */
function button(parameters: Record<string, unknown>, childCount = 1): HintSubject {
  const ports = new Set<string>(CORNER_RADIUS_PORTS);
  return {
    getParameter: (name) => parameters[name],
    hasPort: (name) => ports.has(name),
    childCount
  };
}

const px = (value: number) => ({ value, unit: 'px' });

describe('AC4 — the two arms', () => {
  it('draws when a radius is set and the children are not clipped', () => {
    const hints = hintsForNode(group({ borderRadius: px(40), clip: false }));

    expect(hints.get('borderRadius')).toBeDefined();
    expect(hints.get('borderRadius')).toMatch(/Clip Content/);
  });

  it('does not draw when the children are clipped', () => {
    const hints = hintsForNode(group({ borderRadius: px(40), clip: true }));

    expect(hints.size).toBe(0);
  });
});

describe('the ways it must not fire', () => {
  it('stays quiet when there is no radius, however the children are arranged', () => {
    expect(hintsForNode(group({ clip: false })).size).toBe(0);
  });

  it('stays quiet on a node with no children — nothing can overflow it', () => {
    expect(hintsForNode(group({ borderRadius: px(40), clip: false }, 0)).size).toBe(0);
  });

  it('treats a zero radius as unset, in both the object and the bare-number forms', () => {
    expect(hintsForNode(group({ borderRadius: px(0), clip: false })).size).toBe(0);
    expect(hintsForNode(group({ borderRadius: 0, clip: false })).size).toBe(0);
  });

  it('stays quiet when native scrolling is doing the clipping instead', () => {
    // `overflow: auto` clips to the radius exactly as `hidden` does, and `nativeScroll`
    // defaults to true — so an unset `nativeScroll` beside `scrollEnabled` still clips.
    expect(hintsForNode(group({ borderRadius: px(40), scrollEnabled: true })).size).toBe(0);
    expect(hintsForNode(group({ borderRadius: px(40), scrollEnabled: true, nativeScroll: true })).size).toBe(0);
  });

  it('does draw when scrolling is on but native scrolling is off — that path does not clip', () => {
    const hints = hintsForNode(group({ borderRadius: px(40), scrollEnabled: true, nativeScroll: false }));

    expect(hints.size).toBeGreaterThan(0);
  });
});

describe('the message tells the author something they can act on', () => {
  it('names the control when the node has one', () => {
    const message = hintsForNode(group({ borderRadius: px(40) })).get('borderRadius');

    expect(message).toMatch(/Clip Content/);
    expect(message).not.toMatch(/no Clip Content option/);
  });

  it('🔴 does not tell a Button to use a control it does not have', () => {
    const message = hintsForNode(button({ borderRadius: px(40) })).get('borderRadius');

    // Button carries `borderRadius` and `allowChildren: true` and has no `clip` port anywhere —
    // it is the second and last member of the offender set, and the one with no way out.
    expect(message).toBeDefined();
    expect(message).toMatch(/no Clip Content option/);
    expect(message).toMatch(/Group/);
  });

  it('hints every corner that is actually rounded, and no others', () => {
    const hints = hintsForNode(
      group({ borderTopLeftRadius: px(12), borderBottomRightRadius: px(8), borderTopRightRadius: px(0) })
    );

    expect([...hints.keys()].sort()).toEqual(['borderBottomRightRadius', 'borderTopLeftRadius']);
  });

  it('ignores a radius port the node does not declare', () => {
    const subject: HintSubject = {
      getParameter: (name) => (name === 'borderRadius' ? px(40) : undefined),
      hasPort: () => false,
      childCount: 1
    };

    expect(hintsForNode(subject).size).toBe(0);
  });
});

describe('isNonZeroLength', () => {
  it('reads the three shapes a stored length arrives in', () => {
    expect(isNonZeroLength(px(40))).toBe(true);
    expect(isNonZeroLength(12)).toBe(true);
    expect(isNonZeroLength('2em')).toBe(true);
  });

  it('refuses everything that is not a length, rather than guessing', () => {
    [undefined, null, '', 'auto', {}, { value: undefined }, NaN, 0, '0px', px(0), true].forEach((value) => {
      expect(isNonZeroLength(value)).toBe(false);
    });
  });
});

describe('isChildClipped', () => {
  it('is false for a bare group, which is the shipped default', () => {
    expect(isChildClipped(group({}))).toBe(false);
  });
});

/**
 * 🔴 The sweep. The cases above grade the function against subjects this file invented; this one
 * grades the *claim in the module's header* against the library that ships.
 *
 * ⚠️ It can only check the port half. `node-catalog.json` carries no `allowChildren`, so "which of
 * these can actually hold a child" is not derivable here — that half was read from the runtime
 * definitions (`react-component-node.ts:908` defaults it to `true`) and is recorded in the module
 * header rather than asserted. What the catalog *can* keep honest is the overlap, and the overlap
 * is the surprising number: of everything that rounds corners, exactly one node type also offers
 * a way to clip.
 */
describe('the offender set, against the catalog that ships', () => {
  const nodes: TSFixme[] = catalog.nodes;
  const inputNames = (node: TSFixme) => new Set<string>((node.inputs || []).map((port: TSFixme) => port.name));

  const rounded = nodes.filter((node) => inputNames(node).has('borderRadius'));
  const clipping = nodes.filter((node) => inputNames(node).has('clip'));

  it('finds corner radius on many node types and a clip control on almost none', () => {
    expect(rounded.length).toBeGreaterThan(1);
    expect(clipping.length).toBeGreaterThan(0);
    expect(clipping.length).toBeLessThan(rounded.length);
  });

  it('🔴 leaves Group as the only node that both rounds and clips', () => {
    const both = rounded.filter((node) => inputNames(node).has('clip')).map((node) => node.typeName);

    expect(both).toEqual(['Group']);
  });

  it('keeps the watch list a superset of the ports it can hint on', () => {
    // If a later hint attaches to a port nobody watches, it will draw once and then never
    // update — the failure `Ports.refreshHints` exists to prevent.
    HINTABLE_PORTS.forEach((port) => expect(HINT_INPUT_PARAMETERS.has(port)).toBe(true));
  });

  it('watches every parameter the detection actually reads', () => {
    // Starve each one in turn: a parameter that changes the answer but is not on the watch list
    // is a hint that goes stale on screen.
    const parametersRead = ['clip', 'scrollEnabled', 'nativeScroll', ...CORNER_RADIUS_PORTS];

    parametersRead.forEach((name) => expect(HINT_INPUT_PARAMETERS.has(name)).toBe(true));
  });
});
