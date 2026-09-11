/**
 * FLD-017 — a PrimaryButton animates only while it is loading.
 *
 * ## What this grades and why it is not a style assertion
 *
 * `.Spinner` hides itself with `opacity: 0`, and **an `opacity: 0` element still
 * animates** — only `display: none`, or not being in the tree at all, stops a CSS
 * animation. So the three `bouncedelay 1.4s infinite` dots inside every
 * PrimaryButton were running for the life of the app, on every screen that had a
 * button on it. Measured in the packaged build with a project open:
 * `document.getAnimations()` returned **three**, all of them the Deploy button's,
 * with nothing loading; after the fix it returns **zero** on the same screen.
 *
 * The dots are now mounted only when `isLoading`. Both arms are asserted here,
 * because a fix that removed the dots unconditionally would read identically to a
 * correct one on the arm anybody thinks to write.
 *
 * ⚠️ The **wrapper** is asserted present in both arms on purpose. Without that,
 * this spec would pass just as happily on a change that deleted the whole spinner
 * block — and the fade-in the wrapper's `transition` provides is the part that had
 * to survive.
 *
 * `renderToStaticMarkup` rather than a DOM: this runner is plain Node
 * (`jest.config.js`), and hooks — `PrimaryButton` calls `useMemo` through
 * `useParsedHref` — need a real React render, which the server renderer provides
 * without a document. Class names read as their own keys, via
 * `tests-unit/support/styleMock.js`.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * ⚠️ `Icon` is replaced, and only `Icon`.
 *
 * `Icon.tsx` calls `require.context(...)` — a webpack API with no type and no
 * implementation outside a bundle — so importing it fails this suite **to run**,
 * before a single assertion. Nothing here renders one: `PrimaryButton` mounts an
 * `Icon` only when an `icon` prop is passed, and no arm below passes one, so the
 * stub is never called. The spinner path is the real component throughout.
 */
jest.mock('@noodl-core-ui/components/common/Icon', () => ({
  Icon: () => null,
  IconName: {},
  IconSize: { Small: 'small' },
  IconVariant: {}
}));

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';

/** A dot class from `ActivityIndicator.module.scss`; the styleMock echoes the key. */
const DOT = 'FirstDot';
/** The wrapper class from `PrimaryButton.module.scss`. */
const SPINNER = 'Spinner';

function render(props: Record<string, unknown>) {
  return renderToStaticMarkup(React.createElement(PrimaryButton as never, { label: 'Deploy', ...props } as never));
}

describe('FLD-017 — the button spinner is mounted only while loading', () => {
  it('renders no activity dots when nothing is loading', () => {
    const html = render({});
    expect(html).toContain(SPINNER);
    expect(html).not.toContain(DOT);
  });

  it('renders no activity dots when isLoading is explicitly false', () => {
    const html = render({ isLoading: false });
    expect(html).toContain(SPINNER);
    expect(html).not.toContain(DOT);
  });

  it('renders the activity dots while isLoading is true', () => {
    const html = render({ isLoading: true });
    expect(html).toContain(SPINNER);
    expect(html).toContain(DOT);
  });

  /**
   * ⚠️ This grades that neither arm is an EMPTY answer — not that the dots are the
   * only difference. Measured: with the dots deleted outright it still passes,
   * because the wrapper and the label keep their `is-loading` class either way.
   * The dot assertions above are what carry the finding; this one only rules out
   * the failure mode where a broken component renders nothing and every
   * `not.toContain` reads clean.
   */
  it('both arms render a real button, so neither is the empty answer', () => {
    const idle = render({});
    const loading = render({ isLoading: true });
    expect(idle).not.toEqual(loading);
    expect(idle).toContain('Deploy');
    expect(loading).toContain('Deploy');
  });
});
