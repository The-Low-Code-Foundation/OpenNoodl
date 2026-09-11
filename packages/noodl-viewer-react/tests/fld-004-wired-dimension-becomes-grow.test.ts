/**
 * FLD-004 (#26) — the runtime half of "a wire into a dimension port is honoured, or refused out
 * loud".
 *
 * The reported defect is the THIRD state: the wire validates, the connection is live, the value
 * arrives, and the box does not move — *"accepted, then silently discarded, is the worst of the
 * three."* The mechanism is that a bare number over a wire is merged into the port's CURRENT unit
 * (`noodl-runtime`'s `setInputValue`), that unit defaults to `%`, and `Layout.size` converts a
 * percentage on the parent's MAIN axis into `flexGrow` — a ratio against growing siblings, not a
 * length. The same wire into `width` works, because a percentage on the cross axis stays a real
 * CSS length.
 *
 * 🔴 Every arm below drives the REAL `Layout.size` and reads what IT reported, so the coupling
 * under test is the one that ships — both that `style.flexGrow` existing IS the conversion having
 * happened, and that the report is actually wired into the code path a node takes. An arm that
 * hand-wrote `{ flexGrow: 400 }`, or that called the reporter itself, passes with the real thing
 * unreached; the second of those is exactly what happened, and driving the editor is what caught
 * it.
 *
 * The mutant ledger:
 *  - drop the `isInputConnected` guard → the unwired arm reddens (and it is the loudest one: every
 *    visual node's width and height default to 100%).
 *  - report the cross-axis port too → the discriminator arm reddens.
 *  - drop the `diagnosticsEnabled` gate → the deployed arm reddens.
 *  - drop the memo → the repeat-render arm reddens.
 *  - unhook the call from `Layout.size` → EVERY firing arm reddens. That is the mutant the first
 *    version of this file could not run, because it called the reporter itself.
 *  - never clear (raise only when converted) → the self-clearing arm reddens.
 */

/* eslint-env jest */

import Layout, { type MainAxisGrowHost } from '../src/layout';

const KEY = 'dimensions/wired-dimension-becomes-grow';

interface Recorded {
  key: string;
  message: string | null | undefined;
}

/** A stand-in for the node, carrying only what the reporter reads off it. */
function makeHost(connected: string[], enabled = true): MainAxisGrowHost & { calls: Recorded[] } {
  const calls: Recorded[] = [];
  return {
    calls,
    diagnosticsEnabled: enabled,
    isInputConnected: (name: string) => connected.includes(name),
    setDiagnostic(key: string, message?: string | null) {
      calls.push({ key, message });
    }
  };
}

/**
 * One render of a node: `Layout.size` and NOTHING ELSE.
 *
 * 🔴 The reporter is deliberately never called directly here. It was first wired beside the ONE
 * `Layout.size` call in `react-component-node`'s render — and there are twenty-two, none of which a
 * `Group` uses — so every arm in the first version of this file passed against a report that never
 * reached the node #26 is about. Going through `size` is what makes "correct but unreached" red.
 */
function render(
  host: MainAxisGrowHost,
  props: Record<string, unknown>
): { style: Record<string, any>; props: Record<string, unknown> } {
  const style: Record<string, any> = { position: 'relative' };
  const withNode = { ...props, noodlNode: host };
  Layout.size(style as never, withNode as never);
  return { style, props: withNode };
}

const IN_A_COLUMN = { parentLayout: 'column', sizeMode: 'explicit', width: '100%', height: '400%' };
const IN_A_ROW = { parentLayout: 'row', sizeMode: 'explicit', width: '400%', height: '100%' };

describe('FLD-004 — the wired dimension says so', () => {
  it('reports #26 verbatim: 400 wired into height, in a column parent, arrives as flex-grow 400', () => {
    const host = makeHost(['height']);
    const { style } = render(host, IN_A_COLUMN);

    // The consequence first — if this ever stops being true the diagnostic is describing a
    // conversion that no longer happens.
    expect(style.flexGrow).toBe(400);

    expect(host.calls).toHaveLength(1);
    expect(host.calls[0].key).toBe(KEY);
    const message = String(host.calls[0].message);
    expect(message).toContain('"height" is wired');
    expect(message).toContain('PERCENTAGE');
    expect(message).toContain('flex-grow 400');
    // A rejection with no exit is a rejection the author argues with.
    expect(message).toContain('{value, unit}');
    expect(message).toContain('px value in the property panel');
  });

  it('🔴 THE DISCRIMINATOR — the same wire into width, same node, same parent, says nothing', () => {
    const host = makeHost(['width']);
    const { style } = render(host, IN_A_COLUMN);
    // The cross-axis percentage stayed a real CSS length: that is why it works and is not reported.
    expect(style.width).toBe('100%');
    expect(style.flexGrow).toBe(400); // the HEIGHT still converted; it is simply not the wired port
    expect(host.calls).toEqual([]);
  });

  it('mirrors on a row parent — there it is width that becomes the ratio', () => {
    const host = makeHost(['width']);
    const { style } = render(host, IN_A_ROW);
    expect(style.flexGrow).toBe(400);
    expect(String(host.calls[0].message)).toContain('"width" is wired');

    // ...and the height wire on the same row node is the silent one.
    const other = makeHost(['height']);
    render(other, IN_A_ROW);
    expect(other.calls).toEqual([]);
  });

  it('🔴 says nothing when the port is not wired — a percentage on the main axis IS how a child fills its parent', () => {
    const host = makeHost([]);
    const { style } = render(host, { ...IN_A_COLUMN, height: '100%' });
    expect(style.flexGrow).toBe(100); // the conversion happened, on the shipped default
    expect(host.calls).toEqual([]);
  });

  it('says nothing once the port holds a px value — the exit the message names actually works', () => {
    const host = makeHost(['height']);
    const { style } = render(host, { ...IN_A_COLUMN, height: '400px' });
    expect(style.flexGrow).toBeUndefined();
    expect(style.height).toBe('400px');
    expect(host.calls).toEqual([]);
  });

  it('says nothing for an out-of-flow node — Layout.size converts only position: relative', () => {
    const host = makeHost(['height']);
    const style: Record<string, any> = { position: 'absolute' };
    Layout.size(style as never, { ...IN_A_COLUMN, noodlNode: host } as never);
    expect(style.flexGrow).toBeUndefined();
    expect(host.calls).toEqual([]);
  });

  it('clears itself when the author fixes it — a diagnostic is a predicate, not an event', () => {
    const host = makeHost(['height']);
    render(host, IN_A_COLUMN);
    expect(host.calls).toHaveLength(1);

    render(host, { ...IN_A_COLUMN, height: '400px' });
    expect(host.calls).toHaveLength(2);
    expect(host.calls[1]).toEqual({ key: KEY, message: null });
  });

  it('posts once, not once per render — this runs on every render of every framed node', () => {
    const host = makeHost(['height']);
    render(host, IN_A_COLUMN);
    render(host, IN_A_COLUMN);
    render(host, IN_A_COLUMN);
    expect(host.calls).toHaveLength(1);
  });

  it('is silent in a deployed build — the gate is diagnosticsEnabled, and nothing is formatted behind it', () => {
    const host = makeHost(['height'], false);
    const { style } = render(host, IN_A_COLUMN);
    expect(style.flexGrow).toBe(400);
    expect(host.calls).toEqual([]);
  });

  it('says nothing when the parent lays out on no axis at all — Layout: None converts nothing', () => {
    const host = makeHost(['height']);
    const { style } = render(host, { ...IN_A_COLUMN, parentLayout: 'none' });
    expect(style.flexGrow).toBeUndefined();
    expect(host.calls).toEqual([]);
  });
});
