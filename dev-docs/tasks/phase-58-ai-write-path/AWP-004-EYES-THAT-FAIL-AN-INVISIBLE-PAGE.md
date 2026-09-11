# AWP-004 — The eyes must fail a page nobody can see

**Status:** 📋 open · **Track: the instruments** · out of **F45** · the third repeat of one pattern

## The defect: "Rendered clean" is a claim we have never earned

Kimi K3's final artefact:

```
Rendered clean: desktop 1280×900px, 83 texts, 10 images; phone 390×844px, 83 texts, 10 images
findings: []
```

On screen: a `NoticeDialog` reading **Title / Body / Got it**, and at 390px **nothing else at all** —
the entire storefront pushed out of view by a dialog mounted into the layout instead of over it.
`validate:project`: 0 errors, 0 warnings, 149 nodes.

**Two signals were already inside that same report and neither raised a finding:**

| signal | value | what it means |
|---|---|---|
| desktop `pageHeight` | **900** — exactly the requested viewport height | the page is clipped at the fold, not scrolling. A real 83-text page is ~2,700px (DeepSeek's is 2,704) |
| phone `overflowingCount` | **43** | 43 elements overflow their own container |

`scrollWidth <= clientWidth` held, so the page-level `horizontal-overflow` check passed while 43
elements overflowed inside it.

## This is the third time, and the pattern is the point

| when | the page | what the report said |
|---|---|---|
| F38, session 6 | haiku's three repeaters had no `template`; products, categories and footer never drew | 0 errors |
| session 6 | qwen's page had **one text element** | *"Rendered clean"* |
| **F45, session 8** | Kimi's content is drawn and pushed out of view | *"Rendered clean: 83 texts, 10 images"* |

Three different mechanisms — never drawn, barely drawn, drawn and invisible. One shared cause:
**the report fails only what it has a specific check for, and calls everything else clean.** LAS-012
added `empty-list` for the first. This task is not "add a fourth check"; it is **invert the default**.

## The fix

### §1 Stop claiming "clean" for the absence of known failures

`summarise()` should distinguish *"no findings"* from *"this page looks built"*. A page is only
plausibly built if what is in the DOM is also **on screen**: content height exceeds the fold or the
page scrolls, a reasonable share of counted text is within the viewport bounds, and nothing overflows.
Where the report cannot tell, it must **abstain** — LAS-012 established abstention as the honest
third state for `empty-list` and it is the right precedent.

### §2 The three checks these runs actually earned

Each has a measured trigger on a real artefact, so none is speculative:

- **`clipped-page`** — rendered content extends past a `pageHeight` that equals the viewport exactly.
  Triggers on Kimi's desktop (900 == 900 with 83 texts). ⚠️ Distinguish a *genuinely short* page:
  a page with 6 texts that fits in 900px is fine. The signal is content **exceeding** a page height
  pinned to the viewport. The MCP server's own instructions already warn that the default clips every
  page with no scrollbar and tell planners to pass `scroll` — this makes that warning checkable.
- **`elements-overflowing`** — `overflowingCount` is non-zero. Already computed
  ([render-report.js](../../../scripts/devtools/render-report.js)); today only the page-level
  `scrollWidth` version raises anything. Triggers on Kimi's phone (43).
- **`content-not-visible`** — counted text elements vastly exceed text within the viewport's bounds
  at the top of the page. Triggers on Kimi at 390px (83 counted, ~3 visible). This is the direct check
  for F45 and the one that generalises the other two.

### §3 Placeholder strings

`Title`, `Body` and `Got it` are the untouched defaults of a dialog component and read as placeholder
to any human. `placeholders.count` was **0**. Add them, and take the opportunity to review the list
against real component defaults rather than guesses — the check exists precisely to catch content a
model left as-shipped.

⚠️ **Do not over-fit to these three strings.** The general form is "text identical to a component's
own default parameter value", which the catalog can answer. Scope it; if that is too large, add the
strings and file the general form.

### §4 Say what is on screen, not only what is in the DOM

The summary line — the part a model actually reads — reports counted texts and images. For Kimi that
line was actively misleading. It should report **visible** counts, or both (`83 texts, 3 visible`).
This is the cheapest single change here and probably the highest value: a model that reads
*"83 texts, 3 visible"* needs no finding at all to know something is wrong.

## Scope note, so this does not become a phase

Relating a DOM element to the node that produced it is **still impossible** — LAS-012 §3 established
that the viewer stamps no node id on anything it renders, and that fixing it is a viewer change plus a
bundle rebuild. Everything above is measurable **without** that: heights, bounds, counts and strings
are all in hand. Do not let §4 grow into node attribution.

## Acceptance

- `phase55-s8-kimi-k3-rerun` reports at least one error and is **not** described as clean. Today: 0
  findings.
- `phase55-s8-deepseek-v4-pro` with AWP-001 applied still reports clean (91 texts, 8 images, page
  2,704px) — **the new checks must not cry wolf on a genuinely good page**, and this is the fixture
  that proves it.
- A short, genuinely-complete page does not trip `clipped-page`.
- The summary line reports visible counts alongside counted ones.
- All four fixtures are wired into whatever gate exercises the render report.

## Register

| # | Finding | State |
|---|---|---|
| A7 | Two of the three signals needed here were **already in the report object** and simply had no rule attached. Before adding measurement, check what is already measured and ignored | 📋 method note |
| A8 | DeepSeek's page is the negative control for every check in §2, and it is free — a real agent-authored page that genuinely renders. Use it, or the checks are untested against a true positive | 📋 fixture |

---

## Built 2026-08-09 — and the two premises this task got wrong

**Status: ✅ closed.** The acceptance is met and was measured, not predicted:

| fixture | before | after |
|---|---|---|
| `phase55-s8-kimi-k3-rerun` | *"Rendered clean: 83 texts, 10 images"*, **0 findings** | **4 errors, 3 warnings**; summary reads `83 texts, 13 on screen` |
| `phase55-replay-sonnet` | Rendered clean | **Rendered clean** — no new check fires |
| `ecommerce-example` | 1 warning | **1 warning**, unchanged |
| `phase55-replay-haiku` | 4 errors | **4 errors**, unchanged |

### ⚠️ §2's proposed check would have fired on every good page

AWP-004 §2 specifies `content-not-visible` as *"counted text elements vastly exceed text
within the viewport's bounds"*. Measured across the corpus before it was written:

| build | texts | on screen, desktop | on screen, phone | verdict |
|---|---|---|---|---|
| Kimi K3 (clipped) | 83 | **13** | **9** | the defect |
| sonnet (correct) | 82 | **19** | **11** | fine |
| ecommerce (reference) | 49 | **17** | **10** | fine |

**The ratio does not separate them** — a correct long page also shows ~15 texts at a time,
because that is what a viewport holds. The doc's *"83 counted, ~3 visible"* is not what the
page measures; it is 13 and 9.

What separates them is **reachability**: sonnet's content ends exactly at its page height
(3777/3777, 6482/6482) and Kimi's runs to **5292px inside a page that stops at 900**. So
the shipped check counts elements below the scrollable extent — **70 of 83 on Kimi, 0 on
both correct builds**. Register note A8 is the only reason this was checked against a true
positive before shipping rather than after.

### ⚠️ §3's three strings are not node-type defaults

*"`Title`, `Body` and `Got it` are the untouched defaults of a dialog component"* — measured:
**zero catalog defaults match any of the three.** They are text the model hardcoded in its
own components, on ports that a `Component Inputs` node also feeds. That shape is the
general form §3 asks for and it is sharper than the catalog one:

> a port hardcoded to a string **and** wired from `Component Inputs` holds a value that is
> only ever visible when the input does not arrive

So the strings are **derived from the graph**, not listed — `overriddenDefaults()` finds all
three of Kimi's plus six more, records **every** site (`Title` is hardcoded in both
`TrustItem` and `NoticeDialog`), and `dead-placeholder-text` now splits into two causes,
because "nobody set this port" and "an input that was wired never arrived" send an agent to
different subsystems. **No false positives**: `ecommerce-example` yields 7 derived fallbacks
and none reaches the screen.

### §1 and §4

`Rendered clean` is now a claim the report has to earn — it requires an affirmative
measurement that something is on screen. Where visibility was never measured (a recording
predating these fields) it says so rather than upgrading silence into a pass. The summary
line reports both counts.

| # | Finding | State |
|---|---|---|
| A11 | **The visible/counted ratio is not a defect signal.** A correct 82-text page shows 19. Only content below the *scrollable extent* is unreachable, and that is a different number | ⚠️ measured 08-09 |
| A12 | The three placeholder strings were **authored**, not defaults — the catalog could never have answered §3. The project could | ⚠️ measured 08-09 |
| A13 | `pageHeight == viewport` held on **both** viewports, not just desktop — Kimi's phone is 844/844 with content to 5236px | ✅ measured 08-09 |
