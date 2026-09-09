# HLS-007 — `nodegx render`

The smallest of the four commands, because the machinery exists: `@nodegx/render-measure` and
`scripts/devtools/measure-from-disk.js` (`npm run render:report`) already render a project from disk
and measure it.

## 1. The person sentence

**A pipeline renders every page of an app at three viewport widths and keeps the images, without a
person opening anything.**

## 2. Scope

- `nodegx render <project> --viewports … --out-dir …`, over the existing render path.
- Exit non-zero on a page that fails to render, so CI can gate on it.
- Adjacent and worth checking before starting: [#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40)
  asks `render_report` to write screenshots to disk and render pages in parallel. If that lands
  first, this is a thin wrapper; if not, decide whether this task takes it.
- **Out of scope:** any new rendering, and any judgement about what the images show.

## 3. Acceptance criteria

1. **(person)** Run it against a multi-page project and open the output directory. There is one
   image per page per viewport, each showing that page.
2. A page that cannot render produces a non-zero exit and names the page. Driven with a project
   containing a deliberately broken page, beside a good one in the same run.
3. `render_report` sees **every** page, and the count is asserted against the router's page list —
   not against however many the renderer happened to reach.

## 4. Traps

- 🔴 **`body.scrollHeight` is 0 on a viewer page** — a height measured that way reads empty for a
  page that rendered fine.
- 🔴 **Rendered ≠ reachable.** An image proves pixels, not that anything on the page can be
  interacted with. Say what this command cannot see, in its own `--help`.
- ⚠️ The render path is on the `does-not-apply` side of the DEF-007 seam too (phase 77 D5: 37 nodes
  rewritten on load, the site root rendering no page). **HLS-003 governs what this renders** — do
  not resolve it independently here.
