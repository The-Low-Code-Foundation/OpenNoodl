/**
 * F49 — a design token on `Columns`' gutter ports must survive to the DOM.
 *
 * The same defect class as `design-token-lengths.test.ts` documents for `Group`, in the one
 * component that was not covered: `Columns` builds three of its container declarations by
 * running the authored port value through `parseFloat`. `parseFloat('var(--space-4)')` is
 * `NaN`, so the container asks for
 *
 *     width: calc(100% + NaNpx)
 *
 * which the CSSOM rejects, dropping the declaration. With no width the flex container
 * shrink-to-fits: measured on the `ui-footer-columns` recipe at 175px where 1292px was
 * authored, items 58px where 431px was authored. The negative gutter margins go the same way.
 *
 * What kept it invisible is an asymmetry inside this one file. The *items* get their gutter as
 * `paddingLeft: props.marginX`, passed through verbatim, so a tokenised gutter spaces the
 * columns correctly while the container that has to compensate for it collapses. And the
 * project's own doctrine tells authors to tokenise every spacing value, while `catalog:tokens`
 * resolves `var(--space-4)` happily — so every gate agrees the project is correct.
 *
 * These render through `react-dom/server`, which serialises the whole style object into one
 * attribute. That is the strictest of the two consumers: the comment above the `width`
 * declaration records an earlier bug where an unbalanced `calc(` swallowed every declaration
 * after it on this path while the client-side CSSOM path masked it.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Columns } from '../../src/components/visual/Columns/Columns';

type AnyProps = Record<string, unknown>;

function renderColumns(props: AnyProps): string {
  return renderToStaticMarkup(
    React.createElement(
      Columns as unknown as React.FC<AnyProps>,
      {
        layoutString: '1 1 1',
        minWidth: '100px',
        justifyContent: 'flex-start',
        direction: 'row',
        ...props
      },
      [React.createElement('div', { key: 'a' }), React.createElement('div', { key: 'b' })]
    )
  );
}

/** The container is the outermost element; its style attribute is the first in the markup. */
function containerStyle(markup: string): string {
  const match = markup.match(/style="([^"]*)"/);
  return match ? match[1] : '';
}

describe('F49: a token on the Columns gutter reaches the DOM', () => {
  test('a tokenised marginX keeps the container width declaration', () => {
    const markup = renderColumns({ marginX: 'var(--space-4)', marginY: 'var(--space-4)' });
    const style = containerStyle(markup);

    expect(style).not.toContain('NaN');
    // The width is what actually collapses the layout when it is dropped.
    expect(style).toMatch(/width:calc\(100% \+ var\(--space-4\)\)/);
  });

  test('a tokenised gutter still produces the compensating negative margins', () => {
    const markup = renderColumns({ marginX: 'var(--space-4)', marginY: 'var(--space-6)' });
    const style = containerStyle(markup);

    expect(style).toMatch(/margin-left:calc\(var\(--space-4\) \* -1\)/);
    expect(style).toMatch(/margin-top:calc\(var\(--space-6\) \* -1\)/);
  });

  test('a px string still behaves exactly as before', () => {
    const markup = renderColumns({ marginX: '16px', marginY: '10px' });
    const style = containerStyle(markup);

    expect(style).not.toContain('NaN');
    expect(style).toContain('width:calc(100% + 16px)');
    // -16px and calc(16px * -1) are the same computed value; assert the effect, not the spelling.
    expect(style).toMatch(/margin-left:(-16px|calc\(16px \* -1\))/);
    expect(style).toMatch(/margin-top:(-10px|calc\(10px \* -1\))/);
  });

  test('the bare numbers `initialize` seeds still behave as pixels', () => {
    // `columns.ts` seeds `marginX`/`marginY` as bare numbers; they only become strings once
    // an author touches the input. Both shapes have to work.
    const markup = renderColumns({ marginX: 16, marginY: 16 });
    const style = containerStyle(markup);

    expect(style).not.toContain('NaN');
    expect(style).toContain('width:calc(100% + 16px)');
    expect(style).toMatch(/margin-left:(-16px|calc\(16px \* -1\))/);
  });

  test('an unset gutter does not emit NaN', () => {
    const markup = renderColumns({ marginX: undefined, marginY: undefined });
    const style = containerStyle(markup);

    expect(style).not.toContain('NaN');
    expect(style).not.toContain('undefined');
  });

  test('the item gutter and the container compensation use the same value', () => {
    // The two halves have to agree or the right edge lands off the parent's. This is the
    // asymmetry that hid the defect: the item padding always honoured the token.
    const markup = renderColumns({ marginX: 'var(--space-4)', marginY: 'var(--space-4)' });

    expect(markup).toContain('padding-left:var(--space-4)');
    expect(containerStyle(markup)).toContain('calc(100% + var(--space-4))');
  });
});
