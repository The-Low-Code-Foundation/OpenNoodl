import React from 'react';

import { Noodl } from '../../../types';

/**
 * The one place an icon source becomes DOM.
 *
 * NDA-007 §1's tagged union (`dev-docs/reference/ICON-SOURCE-MODEL.md`), rendered. Before
 * this there were **six** copies of the same `codeAsClass ? … : …` splat — `Icon`, `Button`,
 * `Checkbox`, `RadioButton`, `Select` and `TextInput` — each one hard-wired to icon-font
 * semantics, which is why "add a custom icon set" meant getting a font *and* a stylesheet
 * into two documents. Widening the model meant widening it in six places or in one.
 *
 * **Size and colour are handled here, identically for all three kinds**, which is the
 * requirement that makes the union coherent rather than three nodes in a trenchcoat. The
 * caller passes the style it already built for the font case — `fontSize` carries the icon
 * size and `color` the icon colour — and the SVG kinds inherit both by sizing at `1em` and
 * filling with `currentColor`. So a caller needs no per-kind branch of its own.
 */
export function IconGlyph({
  source,
  style,
  className
}: {
  source: Noodl.Icon;
  style: React.CSSProperties;
  /**
   * Prepended to the glyph's own classes, in that order — `RadioButton` centres its icon
   * with `ndl-controls-abs-center` and the font branch has to keep emitting exactly the
   * class list it emitted before.
   */
  className?: string;
}) {
  if (source === undefined || source === null) return null;

  const classes = (...rest: string[]) => (className ? [className, ...rest] : rest).join(' ');

  if (source.kind === 'sprite') {
    return (
      <span className={classes('ndl-icon-glyph', 'ndl-icon-glyph--sprite')} style={style}>
        <svg style={SVG_STYLE} focusable="false" aria-hidden="true">
          <use href={source.url + '#' + source.symbolId} />
        </svg>
      </span>
    );
  }

  if (source.kind === 'inline') {
    return (
      <span
        className={classes('ndl-icon-glyph', 'ndl-icon-glyph--inline')}
        style={style}
        // Sanitised — see `sanitizeInlineIconSvg`. The model puts the scrub at registration
        // time, and it moves there when NDA-007 §2 exists; until a registration path does,
        // this is the only boundary an inline source crosses, so it happens here.
        dangerouslySetInnerHTML={{ __html: sanitizeInlineIconSvg(source.svg) }}
      />
    );
  }

  // Font — the original two branches, byte-identical. `codeAsClass` sets contain one class
  // per glyph; the others put a codepoint in the element's text.
  return source.codeAsClass === true ? (
    <span className={classes(source.class, source.code)} style={style}></span>
  ) : (
    <span className={classes(source.class)} style={style}>
      {source.code}
    </span>
  );
}

/**
 * `1em` of the wrapper's `fontSize`, filled with the wrapper's `color`.
 *
 * This is what makes `iconSize`/`iconColor` mean the same thing for an SVG as for a font
 * glyph. A set whose paths hard-code their own fills keeps them — multicolour icons are
 * legitimate — and `iconColor` is then documented as inert for that glyph rather than
 * silently half-applied.
 */
const SVG_STYLE: React.CSSProperties = {
  width: '1em',
  height: '1em',
  fill: 'currentColor',
  display: 'block'
};

/**
 * Strip everything executable out of an inline SVG source.
 *
 * Deliberately regex-based rather than DOM-based: this runs under SSR and inside
 * `testEnvironment: node`, where there is no parser to borrow. That makes it conservative by
 * construction — it removes more than a parser would in ambiguous cases, which is the right
 * direction for a trust boundary.
 *
 * **The set is the trust boundary, not the author.** A project author can already write a
 * Function node, so they are not who this defends against — icon sets *travel*, through the
 * library import pipeline and project templates, and arrive from somewhere else.
 */
export function sanitizeInlineIconSvg(svg: string): string {
  if (typeof svg !== 'string') return '';

  return (
    svg
      // Script and foreignObject, with or without a closing tag.
      .replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '')
      .replace(/<foreignObject\b[\s\S]*?(?:<\/foreignObject\s*>|$)/gi, '')
      // Every event handler attribute, quoted or bare.
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // Links: only same-document fragment references survive. That covers `<use href="#id">`,
      // which is the only reference an inline set legitimately needs, and drops
      // `javascript:` and remote URLs together rather than blocklisting schemes one at a time.
      // The bare-value alternative must exclude quotes, or it matches a *quoted* fragment
      // reference as an unquoted token starting at the `"` — which is not `#`, so the
      // lookahead on the quoted branches never gets a say and `href="#glyph"` is stripped
      // along with the rest.
      .replace(/\s(?:xlink:)?href\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi, '')
      // Fixed dimensions on the root element would beat the `1em` sizing above, so the glyph
      // would ignore `iconSize`. Removed rather than overridden — an inline set that ships
      // `width="24"` is the common case, not the exception.
      .replace(/(<svg\b[^>]*?)\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
      .replace(/(<svg\b[^>]*?)\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
  );
}
