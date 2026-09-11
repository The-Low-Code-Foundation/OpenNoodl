/**
 * Strip everything executable out of an inline SVG source, for any node that puts author-supplied
 * markup through `dangerouslySetInnerHTML`.
 *
 * ## Why this is a module rather than a function inside `IconGlyph.tsx`
 *
 * It was one, and it had exactly one caller. §1 of `NOTES-UNOWNED-NODE-WORK.md` adds a second —
 * the Shape node's `svgSource` — and importing a sanitiser across the Icon boundary would make
 * every future SVG surface depend on the icon component to be safe. The trust boundary belongs to
 * neither of them.
 *
 * ## Who it defends against
 *
 * 🔴 **The SET is the trust boundary, not the author.** A project author can already write a
 * Function node, so they are not who this defends against — icon sets and shape sources *travel*,
 * through the library import pipeline and project templates, and arrive from somewhere else. That
 * is the argument `IconGlyph.tsx` made for icons and it is the same argument here, which is why
 * the rules are shared rather than re-decided per node.
 *
 * ## Why regex and not a parser
 *
 * This runs under SSR and inside `testEnvironment: node`, where there is no DOM to borrow. That
 * makes it conservative by construction: it removes more than a parser would in ambiguous cases,
 * which is the right direction for a trust boundary. ⚠️ It is **not** a general-purpose HTML
 * sanitiser and must not be reached for as one — it is a deny-list over the constructs SVG can
 * carry, kept honest by {@link SANITIZER_CASES} rather than by argument.
 *
 * @module sanitize-inline-svg
 */

/**
 * The constructs this module removes, each with a source that demonstrates it.
 *
 * 🔴 **Exported so the suite cannot drift from the implementation by testing a friendlier input
 * than the one the rule exists for.** A sanitiser suite that writes its own examples tends to
 * write the examples the code already handles; these are the cases the rules were written from.
 */
export const SANITIZER_CASES: { name: string; svg: string; mustNotContain: string }[] = [
  { name: 'script', svg: '<svg><script>alert(1)</script></svg>', mustNotContain: 'alert' },
  {
    name: 'script with no closing tag',
    svg: '<svg><script>alert(1)',
    mustNotContain: 'alert'
  },
  {
    name: 'foreignObject',
    svg: '<svg><foreignObject><img src=x onerror="alert(1)"></foreignObject></svg>',
    mustNotContain: 'alert'
  },
  { name: 'event handler', svg: '<svg><circle onclick="alert(1)" r="5"/></svg>', mustNotContain: 'alert' },
  {
    name: 'bare event handler',
    svg: '<svg><circle onload=alert(1) r="5"/></svg>',
    mustNotContain: 'alert'
  },
  {
    name: 'javascript: href',
    svg: '<svg><a href="javascript:alert(1)"><circle r="5"/></a></svg>',
    mustNotContain: 'javascript:'
  },
  {
    name: 'remote xlink:href',
    svg: '<svg><use xlink:href="https://evil.test/x.svg#a"/></svg>',
    mustNotContain: 'evil.test'
  },
  // ── The three §1 named as UNCOVERED, and the reason this module exists ──────────────────────
  {
    name: 'style block',
    svg: '<svg><style>circle{fill:red}</style><circle r="5"/></svg>',
    mustNotContain: '<style'
  },
  {
    name: 'style block loading a remote font',
    svg: "<svg><style>@import url('https://evil.test/x.css');</style></svg>",
    mustNotContain: 'evil.test'
  },
  {
    name: 'remote url() in a presentation attribute',
    svg: '<svg><circle fill="url(https://evil.test/x#g)" r="5"/></svg>',
    mustNotContain: 'evil.test'
  },
  {
    name: 'remote url() in a style attribute',
    svg: '<svg><circle style="fill:url(\'https://evil.test/x#g\')" r="5"/></svg>',
    mustNotContain: 'evil.test'
  },
  {
    name: 'SMIL <set> rewriting href AFTER sanitising',
    svg: '<svg><a><set attributeName="href" to="javascript:alert(1)"/><circle r="5"/></a></svg>',
    mustNotContain: 'javascript:'
  },
  {
    name: 'SMIL <animate> rewriting an attribute',
    svg: '<svg><a><animate attributeName="href" values="javascript:alert(1)" dur="1s"/></a></svg>',
    mustNotContain: 'javascript:'
  },
  {
    name: 'SMIL <animate> with a closing tag',
    svg: '<svg><animate attributeName="href" to="javascript:alert(1)"></animate></svg>',
    mustNotContain: 'javascript:'
  }
];

/**
 * Remove the executable constructs from `svg`, leaving the drawing instructions.
 *
 * Anything that is not a string returns `''` — a node whose port delivers `undefined` (the
 * Empty-Value Contract) must render nothing, not `"undefined"`.
 */
export function sanitizeInlineSvg(svg: string): string {
  if (typeof svg !== 'string') return '';

  return (
    svg
      // Script and foreignObject, with or without a closing tag.
      .replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '')
      .replace(/<foreignObject\b[\s\S]*?(?:<\/foreignObject\s*>|$)/gi, '')
      /**
       * 🔴 `<style>`, which the icon sanitiser did not cover.
       *
       * CSS inside an SVG can load remote resources (`@import`, `url()`), and selectors reach
       * elements the author never mentioned. Removed whole rather than filtered: a style block is
       * never load-bearing for an inline glyph or shape, whose paths carry their own presentation
       * attributes, so there is nothing to preserve and every reason not to try.
       */
      .replace(/<style\b[\s\S]*?(?:<\/style\s*>|$)/gi, '')
      /**
       * 🔴 SMIL animation, which the icon sanitiser did not cover, and which is the subtlest of
       * the three: `<set attributeName="href" to="javascript:…"/>` **rewrites an attribute after
       * this function has finished with it**, so every `href` rule above is moot while these
       * elements survive. `<discard>` is here for the same reason — it mutates the tree.
       */
      .replace(/<(animateTransform|animateMotion|animate|discard|set)\b[\s\S]*?(?:\/>|<\/\1\s*>|$)/gi, '')
      // Every event handler attribute, quoted or bare.
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // Links: only same-document fragment references survive. That covers `<use href="#id">`,
      // which is the only reference an inline source legitimately needs, and drops `javascript:`
      // and remote URLs together rather than blocklisting schemes one at a time.
      // The bare-value alternative must exclude quotes, or it matches a *quoted* fragment
      // reference as an unquoted token starting at the `"` — which is not `#`, so the lookahead
      // on the quoted branches never gets a say and `href="#glyph"` is stripped with the rest.
      .replace(/\s(?:xlink:)?href\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi, '')
      /**
       * 🔴 CSS `url()`, which the icon sanitiser did not cover. It appears in `style="…"` and in
       * presentation attributes alike (`fill="url(…)"`), so it is not reachable by the `href` rule
       * above.
       *
       * ⚠️ **`url(#…)` survives on purpose.** A same-document reference is how a shape points at
       * its own `<linearGradient>` or `<clipPath>`, and dropping it would break legitimate artwork
       * — the same line the `href` rule draws, for the same reason. Everything else becomes
       * `none`, which is a valid paint value, so the shape still renders rather than erroring.
       *
       * 🔴 **The three alternatives are spelled out because an optional quote group defeats the
       * lookahead.** Written as `url\(\s*(['"]?)(?!#)…`, the optional group backtracks to empty
       * when the lookahead fails, the lookahead then reads the QUOTE instead of the `#` behind it,
       * and `url('#g')` is destroyed as though it were remote. That is the same trap the `href`
       * rule above documents, hit a second time in this module — it was caught by the
       * quoted-fragment case in the suite, which is why that case exists separately from the bare
       * one.
       */
      .replace(/url\(\s*(?:"(?!#)[^")]*"|'(?!#)[^')]*'|(?!["'#])[^)]*)\s*\)/gi, 'none')
  );
}

/**
 * Remove `width`/`height` from the root `<svg>` element, so the container decides how big it is.
 *
 * Both callers need this and neither is about trust, which is why it is a separate export rather
 * than part of {@link sanitizeInlineSvg}: an icon must size with `iconSize`, and a Shape's custom
 * source must fill its `size` box. A source that ships `width="24"` is the common case, not the
 * exception, so the attributes are removed rather than overridden.
 *
 * ⚠️ **Applied twice on purpose.** The capture group consumes the run up to the first match, so
 * `width` and `height` on the same root element need two passes.
 */
export function stripRootSvgDimensions(svg: string): string {
  const rule = /(<svg\b[^>]*?)\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
  return svg.replace(rule, '$1').replace(rule, '$1');
}
