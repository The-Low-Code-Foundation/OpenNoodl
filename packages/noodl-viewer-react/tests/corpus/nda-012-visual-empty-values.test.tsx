/**
 * NDA-012 (Visual) — the Empty-Value Contract on the three ports where it is visible.
 *
 * `Text`'s value and the two media `Source` ports are the places in the library where G1
 * failing is not an internal wrongness but something the end user of the app sees: four
 * characters of `null` painted on a page, or a request for `/null` that 404s.
 *
 * ⚠️ **These rows pin work that was written by a parallel worker which was terminated
 * mid-task by an account spend limit, before it could write any tests.** The source changes
 * were reviewed, applied and are measured here by the orchestrator; the reasoning in the
 * files is the worker's and has been checked against the code rather than taken on trust.
 * Two claims it made that these rows deliberately do **not** cover are listed at the bottom.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Text, renderableText } from '../../src/components/visual/Text/Text';
import { resolveMediaSource } from '../../src/nodes/visual/media-source';

type AnyProps = Record<string, unknown>;

/**
 * The two globals these components reach for outside React.
 *
 * `getAbsoluteUrl` reads `Noodl.baseUrl`, and `Text` resolves its colour through the node's
 * style context. Neither is what the rows are about; both have to exist for the component to
 * reach the line that is.
 */
beforeAll(() => {
  (globalThis as unknown as { Noodl: unknown }).Noodl = { baseUrl: '/' };
});

const noodlNode = {
  context: { styles: { resolveColor: (c: unknown) => c } }
};

describe('VE-1 — Text renders an empty value as empty, not as the word "null"', () => {
  it.each([
    ['null', null],
    ['undefined', undefined]
  ])('%s renders nothing', (_label, value) => {
    // Before: `String(props.text)`, so the page showed `null` / `undefined` in the element.
    // Both are ordinary arrivals — a record property nobody filled in, a Function node's
    // early return, a Repeater item missing a field.
    expect(renderableText(value)).toBe('');
  });

  it.each([
    ['zero', 0, '0'],
    ['false', false, 'false'],
    ['empty string', '', ''],
    ['a string', 'Ada', 'Ada'],
    ['a number', 42, '42']
  ])('control: %s still renders as before', (_label, value, expected) => {
    // ⚠️ The guard tests `null`/`undefined` explicitly rather than truthiness, and that is the
    // whole care in this fix: `0` and `false` are legitimate things to put in a Text node, and
    // `!value` would blank both.
    expect(renderableText(value)).toBe(expected);
  });

  it('and the rendered element carries no text for null', () => {
    const html = renderToStaticMarkup(
      React.createElement(Text as unknown as React.FC<AnyProps>, { text: null, dom: {}, style: {}, noodlNode })
    );
    expect(html).not.toContain('null');
  });

  it('control: the rendered element still carries a real value', () => {
    const html = renderToStaticMarkup(
      React.createElement(Text as unknown as React.FC<AnyProps>, { text: 'Ada', dom: {}, style: {}, noodlNode })
    );
    expect(html).toContain('Ada');
  });
});

describe('VE-2 — an empty media Source makes no request', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', '']
  ])('%s resolves to no source at all', (_label, value) => {
    // Measured on `getAbsoluteUrl` before the change: `null` and `undefined` became the
    // literal paths `/null` and `/undefined`, which the browser fetched and 404'd; `''`
    // resolves against the document URL and refetches the page.
    //
    // `undefined` is the only spelling that produces no request, because React omits an
    // attribute whose value is `undefined`.
    expect(resolveMediaSource(value)).toBeUndefined();
  });

  it('control: a real URL is still resolved to an absolute one', () => {
    const resolved = resolveMediaSource('images/cat.png');
    expect(resolved).toBeDefined();
    expect(resolved).toContain('cat.png');
  });

  it('control: an object with a toString is still usable as a source', () => {
    // This is why `getAbsoluteUrl` opens with `String(_url)` and why the fix guards the three
    // empty spellings rather than changing that cast: a Cloud File is an object whose
    // `toString()` is the URL, and it has to keep working.
    const cloudFile = { toString: () => 'https://cdn.example.com/f.png' };
    expect(resolveMediaSource(cloudFile)).toContain('https://cdn.example.com/f.png');
  });
});

/**
 * ⚠️ **Not covered here, and deliberately named rather than left silent:**
 *
 * - **`Image`'s `On Error` reporting.** The worker rewrote it from a bare DOM forward into a
 *   handler that raises on the runtime channel, sets an `Error` string and fires the signal.
 *   The wiring is verified by inspection and by the typecheck, but firing a real `<img>`
 *   `error` event needs a DOM and a load failure, which `renderToStaticMarkup` cannot produce.
 *   **Live QA owes this one.**
 * - **`Drag`'s `scale` fallback and its snap-timer cleanup.** `props.scale || 0` became
 *   `|| 1` (react-draggable divides pointer deltas by `scale`, so `0` makes every delta
 *   `Infinity`), and `stopSnapTimers` was added on unmount and on node delete. Both are
 *   reasoned from the library's arithmetic and from `TimerScheduler`'s `runningTimers`, and
 *   neither is measured here — driving them needs a mounted component and a frame clock.
 *   **Live QA owes these too.**
 */
