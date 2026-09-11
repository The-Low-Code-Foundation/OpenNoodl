/**
 * FB-017 AC4 — the half that nearly shipped drawing nothing.
 *
 * ## Why this suite exists
 *
 * The two wrappers already on `Ports.renderParams` key off `v.name`, and copying that would have
 * been the obvious implementation. It would also have been dead on arrival: the five corner-radius
 * ports declare `tab: { group: 'corners' }`, so `getViewGroupsFromPorts` folds them into a
 * `TabGroup` and pushes *that* into `this.views` — and a `TabGroup` has no `name`. A per-port
 * wrapper would have compiled, passed a pure-logic suite, and put a note on screen exactly never.
 *
 * The first two cases below are that failure, stated as a test.
 *
 * ⚠️ `jest.config.js` sets `testEnvironment: 'node'` for the package, so there is no `document`
 * here. The stub is hand-rolled, following `portDescription.test.ts` — which also keeps the module
 * honest about its surface, since needing more of the DOM stops the stub compiling.
 */

import {
  HINTED_PORT_CLASS,
  HINT_PORTS_ATTRIBUTE,
  PORT_HINT_CLASS,
  applyPortHint,
  hintPortsOf,
  portNamesForView
} from '../../src/editor/src/utils/portHint';

interface StubElement {
  tag: string;
  className: string;
  attributes: Record<string, string>;
  children: StubElement[];
  textContent?: string;
  title?: string;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  querySelector(selector: string): StubElement | null;
  appendChild(child: StubElement): StubElement;
  removeChild(child: StubElement): StubElement;
}

function element(tag = 'div'): StubElement {
  const el: StubElement = {
    tag,
    className: '',
    attributes: {},
    children: [],
    setAttribute(name, value) {
      el.attributes[name] = value;
    },
    getAttribute(name) {
      return name in el.attributes ? el.attributes[name] : null;
    },
    querySelector(selector) {
      const wanted = selector.replace(/^\./, '');
      return el.children.find((child) => child.className.split(' ').indexOf(wanted) !== -1) || null;
    },
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = el.children.indexOf(child);
      if (index !== -1) el.children.splice(index, 1);
      return child;
    }
  };
  return el;
}

const CORNERS = new Set(['borderRadius', 'borderTopLeftRadius']);
const notes = (el: StubElement) => el.children.filter((child) => child.className.indexOf(PORT_HINT_CLASS) !== -1);
const apply = (el: StubElement, names: string[], hints: Map<string, string>) =>
  applyPortHint(el as TSFixme, names, hints, CORNERS, (tag) => element(tag) as TSFixme);

describe('portNamesForView — reaching a port that arrives inside a tab group', () => {
  it('🔴 speaks for the ports a nameless TabGroup holds', () => {
    // This is the corner-radius case verbatim: the view pushed into `this.views` has no `name`,
    // and the five ports are only reachable through its `views`.
    const tabGroup = { views: [{ name: 'borderRadius' }, { name: 'borderTopLeftRadius' }] };

    expect(portNamesForView(tabGroup)).toEqual(['borderRadius', 'borderTopLeftRadius']);
  });

  it('still speaks for an ordinary row', () => {
    expect(portNamesForView({ name: 'clip' })).toEqual(['clip']);
  });

  it('survives the shapes `renderParams` can actually hand it', () => {
    expect(portNamesForView(undefined)).toEqual([]);
    expect(portNamesForView({})).toEqual([]);
    expect(portNamesForView({ views: [] })).toEqual([]);
    expect(portNamesForView({ views: [{}] } as TSFixme)).toEqual([]);
  });
});

describe('applyPortHint', () => {
  const hint = new Map([['borderRadius', 'The children are not clipped.']]);

  it('draws the note on a tab group that has no name of its own', () => {
    const el = element();

    apply(el, portNamesForView({ views: [{ name: 'borderRadius' }] }), hint);

    expect(notes(el).length).toBe(1);
    expect(notes(el)[0].textContent).toBe('The children are not clipped.');
    expect(el.className).toContain(HINTED_PORT_CLASS);
  });

  it('records the ports it could hint on, so a later pass can find the row again', () => {
    const el = element();

    apply(el, ['borderRadius', 'borderTopLeftRadius'], new Map());

    // No note — but the row is still marked, which is what makes the live refresh possible
    // without re-rendering the panel.
    expect(notes(el).length).toBe(0);
    expect(el.getAttribute(HINT_PORTS_ATTRIBUTE)).toBe('borderRadius,borderTopLeftRadius');
  });

  it('leaves a row it can never hint on completely untouched', () => {
    const el = element();
    el.className = 'property-row';

    apply(el, ['backgroundColor'], hint);

    expect(el.getAttribute(HINT_PORTS_ATTRIBUTE)).toBeNull();
    expect(el.className).toBe('property-row');
    expect(el.children.length).toBe(0);
  });

  it('draws one note, not five, when a tab group carries several hinted ports', () => {
    const el = element();
    const both = new Map([
      ['borderRadius', 'same sentence'],
      ['borderTopLeftRadius', 'same sentence']
    ]);

    apply(el, ['borderRadius', 'borderTopLeftRadius'], both);

    expect(notes(el).length).toBe(1);
  });
});

describe('re-applying in place — the live refresh', () => {
  const hint = new Map([['borderRadius', 'first']]);

  it('does not stack a second note when applied twice', () => {
    const el = element();

    apply(el, ['borderRadius'], hint);
    apply(el, ['borderRadius'], hint);

    expect(notes(el).length).toBe(1);
  });

  it('replaces the sentence when the answer changes', () => {
    const el = element();

    apply(el, ['borderRadius'], hint);
    apply(el, ['borderRadius'], new Map([['borderRadius', 'second']]));

    expect(notes(el).length).toBe(1);
    expect(notes(el)[0].textContent).toBe('second');
  });

  it('🔴 takes the note away when the condition clears', () => {
    // The `clip` arm, at the DOM level: the author ticks Clip Content and the note must go,
    // without the panel re-rendering. A wrapper that only ever adds would leave it there for
    // the rest of the session.
    const el = element();

    apply(el, ['borderRadius'], hint);
    apply(el, ['borderRadius'], new Map());

    expect(notes(el).length).toBe(0);
    expect(el.className).not.toContain(HINTED_PORT_CLASS);
  });
});

describe('hintPortsOf', () => {
  it('round-trips what applyPortHint wrote', () => {
    const el = element();
    apply(el, ['borderRadius', 'borderTopLeftRadius'], new Map());

    expect(hintPortsOf(el.getAttribute(HINT_PORTS_ATTRIBUTE))).toEqual(['borderRadius', 'borderTopLeftRadius']);
  });

  it('reads an absent or empty attribute as no ports', () => {
    expect(hintPortsOf(null)).toEqual([]);
    expect(hintPortsOf(undefined)).toEqual([]);
    expect(hintPortsOf('')).toEqual([]);
  });
});
