/**
 * ERG-004 §7.7 item 2 — a port's `description` must reach the author.
 *
 * ## Why this suite exists
 *
 * The thing being guarded is not "does it set an attribute" — it is the set of
 * cases where it must **not**. Every one of them produces an empty or wrong
 * native tooltip, which is worse than no tooltip: an empty `title=""` renders as
 * a blank grey box on hover, and clobbering a row's own title replaces a specific
 * message ("Reset to default") with a general one.
 *
 * ⚠️ And it is guarding a value that arrives from the node library, where
 * `description` has already been wrong twice this phase — dropped entirely on
 * the runtime → editor hop (§7.3), and stale in a committed artefact (§7.8).
 * A port whose description is `null`, a number, or whitespace is not a
 * hypothetical.
 *
 * ⚠️ `jest.config.js` sets `testEnvironment: 'node'` for the whole package, so
 * there is no `document` here. Rather than switch the environment for one suite
 * (which would change how every other `tests-unit` file runs), the element is a
 * hand-rolled stand-in for the three DOM methods this module actually calls.
 * That also keeps the suite honest about its own surface: if `describePortElement`
 * ever needs more of the DOM than get/set/has-attribute, this stub stops
 * compiling and the change has to be looked at.
 */

import { describePortElement } from '../../src/editor/src/utils/portDescription';

function row(): HTMLElement {
  const attrs = new Map<string, string>();
  return {
    getAttribute: (n: string) => (attrs.has(n) ? attrs.get(n) : null),
    setAttribute: (n: string, v: string) => void attrs.set(n, v),
    hasAttribute: (n: string) => attrs.has(n)
  } as unknown as HTMLElement;
}

describe('describePortElement', () => {
  it('puts a real description on the row', () => {
    const el = describePortElement(row(), { name: 'items', description: 'The array to repeat over' });
    expect(el.getAttribute('title')).toBe('The array to repeat over');
  });

  it('returns the element unchanged when the port has no description', () => {
    const el = describePortElement(row(), { name: 'items' });
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('does not set an empty tooltip for a whitespace-only description', () => {
    const el = describePortElement(row(), { name: 'items', description: '   \n  ' });
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('ignores a non-string description rather than stringifying it', () => {
    // `null` and numbers both reach here from a library that has shipped a wrong
    // `description` twice. `String(null)` would render the word "null" on hover.
    for (const description of [null, undefined, 42, {}, []] as unknown[]) {
      const el = describePortElement(row(), { name: 'items', description });
      expect(el.hasAttribute('title')).toBe(false);
    }
  });

  it('never clobbers a title the row set for itself', () => {
    const el = row();
    el.setAttribute('title', 'Reset to default');
    describePortElement(el, { name: 'items', description: 'The array to repeat over' });
    expect(el.getAttribute('title')).toBe('Reset to default');
  });

  it('trims a very long description rather than opening a wall of text', () => {
    const long = 'x'.repeat(900);
    const el = describePortElement(row(), { name: 'items', description: long });
    const title = el.getAttribute('title');
    expect(title.length).toBe(400);
    expect(title.endsWith('…')).toBe(true);
  });

  it('leaves a description exactly at the limit alone', () => {
    const exact = 'y'.repeat(400);
    const el = describePortElement(row(), { name: 'items', description: exact });
    expect(el.getAttribute('title')).toBe(exact);
    expect(el.getAttribute('title')).not.toContain('…');
  });

  it('survives a missing element or a missing port', () => {
    expect(describePortElement(null, { name: 'a', description: 'b' })).toBeNull();
    expect(describePortElement(undefined, { name: 'a', description: 'b' })).toBeUndefined();
    const el = row();
    expect(describePortElement(el, undefined)).toBe(el);
    expect(el.hasAttribute('title')).toBe(false);
  });
});
