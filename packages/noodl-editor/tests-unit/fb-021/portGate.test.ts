/**
 * FB-021 — what a switched-off row is actually built out of.
 *
 * `jest.config.js` sets `testEnvironment: 'node'` for this package, so there is no `document`.
 * `applyPortGate` takes an injectable `createElement` for exactly that reason — the same shape
 * `portHint.ts` uses and `portDescription.test.ts` explains — and the stub below is the whole
 * DOM this module is allowed to need. Widening it means the module started reaching for more of
 * the browser than a row wrapper should.
 */

import type { PortGateReason } from '../../src/editor/src/models/nodelibrary/portGateReason';
import {
  applyPortGate,
  GATE_TARGET_CLASS,
  revealGateTarget,
  DEAD_WIRE_SENTENCE,
  GATED_PORT_ATTRIBUTE,
  GATED_PORT_CLASS,
  GATED_PORT_CONTROL_CLASS,
  GATED_PORT_DEAD_WIRE_CLASS,
  GATED_PORT_LINK_CLASS,
  GATED_PORT_REASON_CLASS
} from '../../src/editor/src/utils/portGate';

interface StubElement {
  tag: string;
  className?: string;
  title?: string;
  textContent?: string;
  attributes: Record<string, string>;
  children: StubElement[];
  onclick?: (event: unknown) => void;
  setAttribute(name: string, value: string): void;
  appendChild(child: StubElement): StubElement;
}

function createElement(tag: string): StubElement {
  const element: StubElement = {
    tag,
    attributes: {},
    children: [],
    setAttribute(name, value) {
      element.attributes[name] = value;
    },
    appendChild(child) {
      element.children.push(child);
      return child;
    }
  };
  return element;
}

/** Depth-first search for the first descendant carrying a class. */
function find(root: StubElement, className: string): StubElement | undefined {
  for (const child of root.children) {
    if (child.className === className) return child;
    const deeper = find(child, className);
    if (deeper) return deeper;
  }
  return undefined;
}

const REASON: PortGateReason = {
  portName: 'width',
  gatePortName: 'sizeMode',
  gateLabel: 'Size Mode',
  sentence: 'Width applies when Size Mode is Explicit.'
};

function gate(reason: PortGateReason | undefined, options: Record<string, unknown> = {}) {
  const row = createElement('div');
  row.className = 'the-row';
  const result = applyPortGate(row, reason, { createElement, ...options }) as unknown as StubElement;
  return { row, result };
}

describe('FB-021 — applyPortGate', () => {
  it('returns the row untouched when there is no reason', () => {
    // The rule `portDecoration.ts` set for BCN-010: never dim a control you cannot explain. A
    // port with no reason never reaches this function at all — `ModelProxy` keeps hiding it —
    // but if one did, leaving it alone is the only safe answer.
    const { row, result } = gate(undefined);
    expect(result).toBe(row);
  });

  it('wraps the row in an inert, dimmed control', () => {
    const { row, result } = gate(REASON);

    expect(result).not.toBe(row);
    expect(result.className).toBe(GATED_PORT_CLASS);
    expect(result.attributes[GATED_PORT_ATTRIBUTE]).toBe('width');

    const control = find(result, GATED_PORT_CONTROL_CLASS);
    expect(control.attributes['aria-disabled']).toBe('true');
    // The original row is inside the dimmed part, not replaced by it: the author can still read
    // the value that is being ignored.
    expect(control.children).toContain(row);
  });

  it('puts the derived sentence under the control', () => {
    const block = find(gate(REASON).result, GATED_PORT_REASON_CLASS);
    expect(block.attributes['data-test']).toBe('gate-reason-width');
    expect(block.children[0].textContent).toBe(REASON.sentence);
  });

  it('draws a button to the gating control when there is somewhere to go', () => {
    const clicks: number[] = [];
    const { result } = gate(REASON, { onFocusGate: () => clicks.push(1) });

    const link = find(result, GATED_PORT_LINK_CLASS);
    expect(link.tag).toBe('button');
    expect(link.textContent).toBe('Show Size Mode');
    expect(link.attributes.type).toBe('button');

    link.onclick({ stopPropagation() {} });
    expect(clicks).toHaveLength(1);
  });

  it('🔴 stops the click reaching the group header that would fold the destination away', () => {
    let stopped = false;
    const { result } = gate(REASON, { onFocusGate: () => undefined });
    find(result, GATED_PORT_LINK_CLASS).onclick({
      stopPropagation() {
        stopped = true;
      }
    });
    expect(stopped).toBe(true);
  });

  it('draws no button rather than a dead one when there is nowhere to go', () => {
    expect(find(gate(REASON).result, GATED_PORT_LINK_CLASS)).toBeUndefined();
  });

  it('says nothing about a wire when there is no wire', () => {
    expect(find(gate(REASON).result, GATED_PORT_DEAD_WIRE_CLASS)).toBeUndefined();
  });

  /*
   * AC3. This is the case session 20's drive found indistinguishable: node 0040 (wired, gated)
   * and node 0050 (unwired, gated) rendered identically, because both rendered as nothing.
   */
  it('says outright that a live wire is being discarded', () => {
    const dead = find(gate(REASON, { isConnected: true }).result, GATED_PORT_DEAD_WIRE_CLASS);
    expect(dead).toBeDefined();
    expect(dead.textContent).toBe(DEAD_WIRE_SENTENCE);
    expect(dead.attributes['data-test']).toBe('gate-dead-wire-width');
  });

  it('🔴 keeps the dead-wire line OUTSIDE the dimmed control', () => {
    // A backend gate means "this cannot work". This means "this is working and being thrown
    // away", which is the more urgent of the two — dimming it to 35% along with the control
    // would bury the one line the author most needs to read.
    const { result } = gate(REASON, { isConnected: true });
    const control = find(result, GATED_PORT_CONTROL_CLASS);
    expect(find(control, GATED_PORT_DEAD_WIRE_CLASS)).toBeUndefined();
    expect(result.children.map((child) => child.className)).toContain(GATED_PORT_DEAD_WIRE_CLASS);
  });

  it('never sets innerHTML — the sentence carries a port displayName a kit can supply', () => {
    const { result } = gate({ ...REASON, sentence: '<img onerror=alert(1)>' }, { isConnected: true });
    const block = find(result, GATED_PORT_REASON_CLASS);
    expect(block.children[0].textContent).toBe('<img onerror=alert(1)>');
    expect((block.children[0] as unknown as Record<string, unknown>).innerHTML).toBeUndefined();
  });
});

describe('FB-021 AC3 — revealGateTarget puts the author in front of the gating control', () => {
  function target(focusables: { focus?: () => void }[] = []) {
    const state = {
      classes: [] as string[],
      attributes: {} as Record<string, string>,
      scrolled: false,
      rowFocused: false,
      element: null as never
    };
    const element = {
      classList: {
        add: (name: string) => state.classes.push(name),
        remove: (name: string) => {
          state.classes = state.classes.filter((c) => c !== name);
        }
      },
      setAttribute: (name: string, value: string) => {
        state.attributes[name] = value;
      },
      querySelector: () => focusables[0] || null,
      focus: () => {
        state.rowFocused = true;
      },
      scrollIntoView: () => {
        state.scrolled = true;
      }
    };
    return { state, element };
  }

  it('focuses a real control when the row has one', () => {
    let focused = false;
    const { state, element } = target([{ focus: () => (focused = true) }]);
    expect(revealGateTarget(element as never, () => undefined)).toBe('focused-control');
    expect(focused).toBe(true);
    expect(state.rowFocused).toBe(false);
  });

  /*
   * 🔴 THE case, and it is the one the drive found. `SizeModeInput` — the gating control for
   * `width`, the port this whole task was filed about — renders `div`s and `span`s and nothing
   * else. Measured live: `focusables: 0`, `tagCensus: [DIV, SPAN]`. The first implementation
   * queried for `input, select, textarea, button`, found nothing, and silently did nothing:
   * `document.activeElement` stayed on `BODY` while every spec about the sentence stayed green.
   */
  it('🔴 falls back to the row itself when nothing inside it can take focus', () => {
    const { state, element } = target([]);
    expect(revealGateTarget(element as never, () => undefined)).toBe('focused-row');
    expect(state.rowFocused).toBe(true);
    // `-1`: reachable by script, never a stop in the tab order.
    expect(state.attributes.tabindex).toBe('-1');
  });

  it('marks the destination either way — focusing a div shows the author nothing', () => {
    for (const focusables of [[{ focus: () => undefined }], []]) {
      const { state, element } = target(focusables);
      revealGateTarget(element as never, () => undefined);
      expect(state.classes).toContain(GATE_TARGET_CLASS);
    }
  });

  it('takes the mark down again rather than leaving it as chrome', () => {
    const { state, element } = target([]);
    revealGateTarget(element as never, (fn) => fn());
    expect(state.classes).not.toContain(GATE_TARGET_CLASS);
  });

  it('scrolls once, and does not let focus scroll again over the top of it', () => {
    const { state, element } = target([]);
    revealGateTarget(element as never, () => undefined);
    expect(state.scrolled).toBe(true);
  });

  it('does nothing at all rather than throwing when there is no row', () => {
    expect(revealGateTarget(undefined, () => undefined)).toBe('none');
  });
});
