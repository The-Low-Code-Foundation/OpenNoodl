# F52 — the scrolled read, promoted

**Built:** 2026-08-11, late. Closes the register's **F52 (the probe)** and the §6 item that the
previous session moved to first place. `scripts/devtools/scroll-probe.js`, `npm run render:scroll`.

---

## §1 — What was wrong

`render:report` reads every page at **scrollTop 0**, and at scrollTop 0 a band that is stuck and a
band that is about to scroll away are pixel-identical. The previous session rendered nine
counter-builds of `ui-sticky-nav`; four were dead or illegible and the report called every one of
them *"Rendered clean"*.

That was re-measured from scratch here rather than inherited. Three variants rebuilt from the shipped
example, run through `render:report` on a fresh checkout:

```
variant-b-clip            — Rendered clean: desktop 1280×1205px, 12 texts, 10 on screen, 0 images.
variant-d-aligny-center   — Rendered clean: desktop 1280×1205px, 12 texts, 10 on screen, 0 images.
variant-f-no-zindex       — Rendered clean: desktop 1280×1205px, 12 texts, 10 on screen, 0 images.
```

Three different defects, one identical sentence, and the same 12 texts and 10-on-screen count as the
correct build. The report was not wrong; it was reading the one scroll position where the defect
cannot exist.

## §2 — What the probe does

Two questions a rect at scrollTop 0 cannot answer.

**Does it actually stick?** Measured as **drift**: how far the element's viewport-relative top moved
against how far its container scrolled. Computed `position` is not evidence — a `position: sticky`
under an `overflow: hidden` ancestor computes as sticky and behaves as static. The container is the
nearest scrollable ancestor, not an assumption about the document.

**Is it on top?** F53. `elementFromPoint` at three points across the element's width, at a scroll
position where something has arrived underneath. A band at top 0, full width, opaque, computed
sticky, that every rect-based check passes and no human can read.

It auto-discovers every sticky/fixed element, so it needs no selector to be useful; `--selector`
adds anything else.

## §3 — The measurement

Same three variants, same builds, same viewport:

| Variant | `render:report` | `render:scroll` |
|---|---|---|
| shipped `ui-sticky-nav` | Rendered clean | **PINNED at 0px**, z 10, no findings — desktop *and* phone |
| **B** — `clip: true` on the page column | Rendered clean | 🔴 `sticky-scrolls-away`: **drift 122 of 122**, and it names the clipping ancestor |
| **D** — `alignY: "center"` | Rendered clean | ⚠️ `sticky-pins-away-from-edge`: **pinned at 422px**, computed top **450px** |
| **F** — `zIndex` removed | Rendered clean | 🔴 `sticky-occluded`: pinned at 0 and **covered at 3 of 3 points**, blocker named |

⚠️ **Variant D's 422px and computed `top: 450px` are the previous session's recorded figures to the
pixel**, reproduced by an independently written probe against a rebuilt fixture. So is the scroll
range — 305px desktop, 811px phone. That is the corroboration that makes the rest of this table worth
reading.

## §4 — The blind spots report themselves

A probe that cannot detect its own failure to prove anything is F52 one level up, so:

| Page | Reported |
|---|---|
| shorter than the viewport | ⚠️ `no-scroll-range` — *"Nothing on this page scrolls, so the probe proved nothing."* |
| no sticky or fixed element, no `--selector` | ⚠️ `nothing-to-probe` — and it says `render:report` already covers that page |

**Without these a short page passes silently**, which is exactly how `narrow-survives` came to pass a
blank page (§6 item 4 of the close prompt).

## §5 — Two corrections found by testing, not by review

1. 🔴 **A `--selector`ed `position: relative` element scrolling away was reported as
   `sticky-scrolls-away`.** It is the correct behaviour of a relative box. The finding now fires only
   for an element that *claims* to stay put — `sticky` or `fixed`. A false positive here would train
   the reader to ignore the code that matters, which is the whole value of the two real ones.
2. ⚠️ **`sticky-pins-away-from-edge` fired on a legitimate bottom bar.** A fixed footer pins far from
   the top and is entirely correct. It now checks distance from **both** edges and only reports an
   element floating between them.

⚠️ Its threshold (`EDGE_SLACK_FRACTION`, 25% of viewport height) is **not** derived from a
measurement — the corpus holds exactly one element pinned away from an edge, and one point cannot set
a threshold. That is why it is a warning and never an error, and the constant says so. `DRIFT_SLACK`
is different: it only absorbs sub-pixel rounding, and the corpus has no middle ground.

## §6 — The refactor underneath

`renderReport` and the probe need the same eight steps — spawn the server, spawn Chrome, wait for the
debugging port, connect, enable two domains, navigate, settle, kill all of it. They are now
`withRenderedPage(options, fn)` in `render-report.js`, and `renderReport` is a caller. `parseViewports`
moved there too, from `measure-from-disk.js`, for the same reason: a second copy is the copy that
drifts.

**Unregressed, checked both ways:**

- `render:report` on `ui-sticky-nav` returns byte-identical output to the figures recorded in
  [`notes-ui-sticky-nav.md`](measurements/notes-ui-sticky-nav.md) — `desktop 1280×1205px, 12 texts,
  10 on screen; phone 390×1655px, 12 texts, 9 on screen`.
- `packages/noodl-mcp/tests/renderReportModule.test.ts` — **41 of 41 pass**. It requires the module
  directly and destructures ten of its exports; nothing was removed, two were added.
- `measure-from-disk.js` still exits **2** on an unknown viewport name (verified), because that is a
  usage error and the shared parser now throws instead of exiting.

## §7 — Findings

| # | Finding | State |
|---|---|---|
| F52 | ⚠️ **`render:report` reads at scrollTop 0** and cannot decide a scroll-dependent recipe | ✅ **closed** — `scroll-probe.js`, proven red on B/D/F and green on the shipped recipe |
| F53 | 🔴 **`zIndex` on a sticky band is structural, not styling** — correct geometry, unreadable page, every rect check passing | ✅ **detectable** — `sticky-occluded`, 3/3 points on variant F |
| F64 | ⚠️ **The register uses F52 for two different findings** — the scrolled-read probe in `NEXT-SESSION-PROMPT.md:135`, and *"three of six replays rendered no page"* in `NOTES-F38-F39-F40.md:339`. The second is §6 item 4 and is **still open**; only the first is closed here. Two notes files numbering into one register independently is how it happened | 🟠 filed — renumber before the next citation |
| F65 | ⚠️ **A probe with no negative control proves nothing.** The value here is not the three red variants, it is that a short page and a static page both report *"nothing was tested"*. Written the obvious way, this tool would have reported clean on both | 🟠 habit |

## §8 — What a next session should know

- **Any recipe about scroll, sticky, a scroll container, or `visible`-on-scroll needs
  `npm run render:scroll` as well as `render:report`.** Neither subsumes the other: the report reads
  content and the probe reads behaviour.
- The probe **exits 0 whatever it finds**, like `measure-from-disk.js`, so a harness never reads
  *"this page has a defect"* as *"the tool broke"*. Read `findings`, not the exit code.
- It is **not wired into any gate**, deliberately — it needs a project, and most projects have no
  sticky element, where it correctly reports `nothing-to-probe`. Promoting it to `catalog:*` would
  need a list of which examples are scroll-dependent, which does not exist yet.
