# Icon provenance

Everything in `icon-component/` is inlined into the app by `Icon.tsx`, which globs
this folder with `require.context`. Adding a glyph is a file drop plus an `IconName`
entry — there is no icon dependency in any `package.json`, and adding one here does
not change the bundle graph.

## House glyphs

Most of the set is ours. The current house style is a **16-unit grid, 1.5 stroke,
`stroke="currentColor"`, round caps and joins** — match it when you add one.

`explain.svg`, `build_ai.svg` and `workflow.svg` additionally carry the brand mark's
vocabulary (a filled port, a wire, a node card) so the panels that are specific to
this product don't look borrowed. See `Logo.tsx` for the mark itself.

⚠️ The set is **not** uniform yet: 154 glyphs span six viewBox sizes and both fill
and stroke conventions, because ~98 are legacy filled Figma exports from the Noodl
era on 24/25/30/31 grids. The 16/1.5 stroke subset is the one to extend. Mixing the
two in a single surface is visible — a filled 25-grid glyph reads about twice as
dense as a 16/1.5 stroke one at the same rendered size, and `IconSize` is inert
(see the `uix-010-iconsize-is-inert` note), so there is no per-icon compensation.

## Lucide (ISC)

`git_branch.svg`, `git_pull_request.svg`, `database.svg`, `history.svg` and
`book_open.svg` are derived from [Lucide](https://lucide.dev) v1.27.0. They are
conventions rather than design opportunities — a bespoke git or database mark is
*less* recognisable than the standard one, so these are taken rather than drawn.

Lucide's 24-grid path data is kept **verbatim**; each file wraps it in
`transform="translate(0.5 0.5) scale(0.625)"` with `stroke-width="2.4"`, which lands
the geometry on the house 16 grid at an effective 1.5 stroke. Keeping the source
coordinates untouched means a glyph can be re-synced from upstream by swapping the
paths and nothing else.

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

Note that Lucide **removed its brand icons**, so there is no `github` mark to take
from it. The GitHub panel deliberately uses `git_pull_request` rather than pulling
the Octocat from a second upstream: one slot is not worth a second licence and a
trademark question, and paired with `git_branch` on Version control it encodes
local-vs-remote instead of repeating a shape. Decided 2026-07-28.

Unrelated to this folder: `library/modules/lucide-icons/` ships Lucide to *end users*
as a webfont, inside a Noodl library module. Different artefact, same upstream.
