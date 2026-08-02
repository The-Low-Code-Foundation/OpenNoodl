# AIX-008 — the sandbox preview, against a real provider

**Date:** 2026-08-02
**Model:** `claude-sonnet-5`, effort `low` (AIX-007's measured default)
**Project:** `packages/noodl-editor/tests/testfs/git-repo-utf8` — the same 44-component
corpus AIX-007 measured on, with the same style vocabulary injected, so the
$/component here is comparable to its baseline
**Sessions:** 16 recorded — 12 treatment, 4 control — at **$1.84** in
`sandbox.jsonl`, plus one discarded shakedown session at $0.23 whose artifacts
were deleted before the measured runs. **Total spend $2.07.**
**Harness:** `packages/noodl-editor/scripts/aix15-live/`, `--mode=sandbox`
**Artifacts:** `measurements/live/sandbox.jsonl` plus, per session, the
transcript, the candidate, the model's raw `sample_data`, both datasets
(model-fed and heuristic-only) and every shim probe

AIX-008 shipped built and live-verified — but only by driving a **scripted,
no-provider session**. Everything downstream of the model (the spliced export,
the `fetch`/`XHR` shim, the dataset synthesis) had only ever seen candidates
written by a script. The one thing a real model changes is `sample_data`: the
optional `submit_component` field whose records take precedence over the
editor's heuristics. Nobody had ever seen a model fill it in.

This is that run. It closes the residual, and it found three things no fixture
could have produced — one of which means a documented success criterion does not
hold.

---

## The short version

| Question | Answer |
| --- | --- |
| Does a real model fill `sample_data`? | **Yes — 9 of 9 times** that the component it built actually read a backend. The three sessions that supplied nothing all built a component that queried nothing, which is exactly what the prompt tells them to do. |
| Is what it supplies usable? | **Yes, and it is the better of the two sources.** The collection name matched the graph's own in **9/9** (0 records keyed to a class nothing queries), field coverage of the graph's reads was **100%** every time, no placeholder-shaped values at all, and the copy reads as content: "Sunset Jazz Night", "ORD-1042", "Aiko Tanaka". |
| What does it cost? | **+234 input tokens per request, identical to the token in all four pairs.** $0.0007–$0.0019 per component — **2–5% of AIX-007's $0.0352 baseline** — plus $0.0009–$0.0027 of output on the components that use it. |
| Did the real candidates break anything? | **Three defects.** One of them means "renders populated lists without a backend" fails for **6 of the 9** data-reading candidates a real model produced. |
| Did the shim hold? | **144/144 probes**, nine per session across all sixteen, driven through the *installed* shim rather than the responder. |

---

## 1. The synthesiser reads wires; the model writes code

**This is the finding.** `discoverDataShape` learns which fields a graph reads
from `prop-<field>` connection endpoints and from `{{field}}` in text
parameters. That is exactly how the spec's own fixtures bind data, and it is
**not** how `claude-sonnet-5` binds a list.

Given "an orders page … order number, customer name, total, status and the date
it was placed", the model wired `DbCollection2.items` straight into an
`Expression`:

```
orders.slice().sort((a,b)=>new Date(b.datePlaced)-new Date(a.datePlaced))
      .map(o=>(o.orderNumber||'')+'   '+(o.customerName||'')+'   $'+(o.total||0)+…)
```

and, in another run, into a `JavaScriptFunction` doing the same thing. Five field
names, all of them read, **none of them on a wire**. The account page did the
same for its saved-articles list. Six of the nine data-reading candidates bound
their data this way.

The consequence is measured, not inferred. With `sample_data` stripped, the
dataset the editor builds for that page is:

```json
{ "fields": [], "records": [ { "objectId": "sandbox-1", "createdAt": "…" } ×5 ] }
```

Five records with no fields. `o.orderNumber` is `undefined` on every one of them.
The preview renders **"5 orders, totalling $0.00"** over five blank rows — which
is worse than an empty list, because it looks like it worked.

| Candidate | binds via | fields the heuristics recover | fields the model's data fills |
| --- | --- | --: | --: |
| `event-card` ×3 | `prop-<field>` wires off `DbModel2` | **5–6 of 6** | 6 of 6 |
| `orders-summary` ×3 | `Expression` / `JavaScriptFunction` | **0** | 5 |
| `account` ×3 | `JavaScriptFunction` | **0** | 2–3 |

So the spec's success criterion **"a project with no backend configured still
renders populated lists and cards" does not hold** for code-bound bindings, and
those were the majority of what a real model produced.

What makes this survivable today is the thing nobody had checked: **the model's
own `sample_data` closes the gap completely**, because it supplies exactly the
field names its own expression reads — it wrote both. The two sources are not
"nicer copy" versus "inference" as the spec framed them. For code-bound data,
`sample_data` is the *only* source of field names that exists.

Two ways out, neither taken here, because both change shipping behaviour and the
choice is a product judgement:

- **Read the code.** Extend `discoverDataShape` to scan `Expression` and
  `JavaScriptFunction` parameters for property reads off the collection input.
  Restores the heuristic fallback, at the price of a regex over user code.
- **Say so instead.** When a queried class ends up with zero fields, the preview
  toolbar could say the data could not be inferred, rather than serving five
  empty records that render as blanks.

## 2. The model's sample data reaches the network; the heuristics never do

`sample_data` for the event card came back with

```json
"photo": "https://picsum.photos/seed/jazz1/400/300"
```

on all five records, in every run that built it. The sandbox's isolation is
`fetch` and `XMLHttpRequest`, installed before the runtime exists — an
`<img src>` goes through neither, and the sandbox `<webview>` sets a `partition`
but no CSP. So a preview of unaccepted work makes five real requests to a
third-party image host, and the Desired State's "no network egress" is not true
of the path the spec prefers.

The heuristic path never does this: `synth.placeholderImage` returns an inline
`data:image/svg+xml` URI precisely so there is no network and no CSP surprise.

This is a regression in the isolation guarantee introduced by preferring the
model's data, and it is invisible to every existing spec because no fixture ever
supplied a URL. The obvious fix is one line in `completeRecord`: a model-supplied
`http(s)` URL on an image-shaped field gets replaced with `placeholderImage`.
Not applied here — it discards model content, which is a call to make
deliberately rather than in passing.

Same records, lesser problem: `"price": "35"` — a string where the heuristics
produce `19.5`. Anything doing arithmetic on it gets string concatenation.

## 3. Asked for a page, it built the row

"A page that lists the books in my Books collection … each row shows the cover
image, the title, the author and the rating" produced, in **five runs out of
five** (four in `sandbox.jsonl`, plus the shakedown session), a component with
`Component Inputs` for title/author/cover/rating and no query at all. The model
said so itself, in the description it wrote:

> A single book row: cover image on the left, title (bold), author and rating
> stacked on the right. **Used as the repeater template for the AIX Book List
> page.**

It decomposed a one-component request into two, built the half nobody asked for,
and named the other half in prose. The candidate is valid, well-styled, and not
what the user typed. It also — correctly — omits `sample_data`, because a
component that reads no backend is told to.

This is an AIX-002 finding rather than an AIX-008 one, and it is recorded here
because it is *why* three of twelve treatment sessions show no sample data. A
raw "supplied 9/12" would misread as a model that forgets the field a quarter of
the time. It never forgot it once. The three prompts whose phrasing left no room
to decompose ("take the event id as a component input and look the event up",
"a line saying how many orders there are") built the querying component every
time.

## Two smaller observations, neither a defect

**It renames the collection.** The request said "my Events collection"; two of
three runs built the graph against `Event` and keyed `sample_data` to `Event`,
one used `Events`. The graph and the data always agree — which is all the
sandbox needs — but the collection the user will go looking for in their backend
is not always the one they named.

**One "repeated value" flag, and it was right to repeat.** The harness flags a
field whose value is identical on every record; the only hit in sixteen sessions
was `SavedArticle.userId`. Those are one person's saved articles, so a constant
`userId` is the correct answer and the flag is a false positive. Recorded
because a reader of the JSONL will see it and should know it was checked.

---

## The shim, on real candidates

Every session ran nine probes through the **installed** shim — `installSandbox`
over a synthetic `window`/`XMLHttpRequest`, not `respond()` called directly,
because `respond` is a pure function a spec already covers and `installSandbox`
is the part that had never run outside a browser. The request shapes are the
ones a preview actually makes:

| Probe | What it is evidence of |
| --- | --- |
| `POST https://…/parse/classes/<C>` with `_method: GET` | a configured endpoint's mount path |
| `POST undefined/classes/<C>` (XHR) | **no backend configured** — the literal host a Parse client emits |
| `GET …/parse/aggregate/<C>?$group=…` | the "how many are there" line at the top of a list |
| `GET …/items/<C>?limit=3` | the BYOB/Directus shape, on `fetch` rather than XHR |
| `GET …/parse/users/me` (XHR) | an auth-gated component asking who is signed in |
| `POST …/parse/login` | a sign-in form must succeed whatever it is given |
| `POST …/parse/functions/<name>` | project code the sandbox cannot run |
| `GET https://api.stripe.com/v1/charges` | a REST node pointed anywhere at all |
| `GET /noodl_modules/…/index.js` | the viewer's own assets must pass through |

**144/144 green.** The data probes are graded on the served record matching the
dataset *field by field*, not merely on a 200 — so a pass means the model's
"Sunset Jazz Night" arrived at the node that asked for it, through the mount
path, through the no-endpoint path, and through BYOB.

Also asserted rather than eyeballed, on all sixteen candidates:

- the candidate is spliced in as `rootComponent` and appears exactly once,
- the project's serialisation is **byte-identical before and after** the export
  is built — the AIX-002 invariant the whole staging contract rests on,
- `routerIndex` is re-derived from the component set actually running.

---

## The cost of having asked

The spec's risk table lists "`sample_data` inflates every authoring call" with
the mitigation "measure against AIX-007's baseline". That measurement is this,
and it had never been taken.

The harness runs the corpus twice. The treatment arm is the **unmodified
product**; the control arm strips every trace of the field from what the model is
sent — the `submit_component` property and the `SAMPLE DATA FOR THE PREVIEW`
paragraph — inside the chat wrapper, throwing if either is already absent so an
ablation can never silently become a no-op. (It behaved: 0/4 control sessions
supplied anything, 9/9 treatment sessions that could, did.) The arms run back to
back rather than interleaved, because they send different cached prefixes and
interleaving would price the experiment instead of the product.

**The exact number: +234 input tokens on turn 1, in all four pairs, to the
token — and stable to the token across repeats.**

| Prompt | with (×3 reps) | without | delta |
| --- | --: | --: | --: |
| book-list | 8,856 / 8,856 / 8,856 | 8,622 | **+234** |
| event-card | 8,855 / 8,855 / 8,855 | 8,621 | **+234** |
| orders-summary | 8,852 / 8,852 / 8,852 | 8,618 | **+234** |
| account | 8,873 / 8,873 / 8,873 | 8,639 | **+234** |

Those 234 tokens (520 characters of system prompt, 254 of tool schema) sit inside
the cached prefix, so they are billed at 1.25× once and 0.1× on every turn after —
and across consecutive sessions in one project they are shared, which is the
traffic shape AIX-007 measured at a 73% cache hit rate.

| | per component |
| --- | --: |
| 234 tok, cached (write once, read on ~3 further turns) | **$0.00073** |
| 234 tok, worst case (no cache hit at all, 4 turns) | **$0.00187** |
| AIX-007 baseline | $0.0352 |
| **Share of the baseline** | **2.1% – 5.3%** |

A component that *uses* the field also pays to write the records: 310–934
characters of JSON, ≈89–267 output tokens, **$0.0009–$0.0027** at Sonnet's
$10/MTok. Total for a data-reading component: **under $0.005 — at worst ~13% of
the baseline, and 2% for every component that never touches it.** Not material.

**The arm totals do not support a stronger claim than that, and it is worth
saying why.**

| Arm | n | $/component | mean turns | first-attempt valid |
| --- | --: | --: | --: | --: |
| with (shipping) | 12 | $0.1031 | 3.17 | 11/12 |
| without (ablated) | 4 | $0.1503 | 5.25 | 3/4 |

The shipping arm came out **cheaper**, which is not a result anyone should quote.
Turn count dominates the cost of an authoring session and it varies by a factor
of four run to run — the account page took 3, 4, 5 and 8 turns across four
sessions. At n=4 in the control arm the difference is noise. The honest reading
is: **the +234 tokens is the only part measured exactly, and no cost penalty
larger than that was detectable at all.**

Worth noting separately for AIX-007's benefit: this corpus costs
**~$0.10/component against the $0.0352 baseline**, because every prompt reads a
backend and the model spends two to six turns reading node documentation before
it will commit. That is a property of data-reading components, not of
`sample_data` — the control arm pays it too, and more.

---

## What this run could not verify

- **Nothing was rendered.** This is headless: the export is built, the dataset is
  built, and the shim answers. Whether the runtime *paints* the model's data
  needs a running editor, and the Sample-data / Real-backend toggle needs a human.
- **The `<img>` egress in finding 2 is reasoned, not observed.** No browser was
  involved, so no request to `picsum.photos` was watched leaving the machine.
- **One model, one project, one effort level** — `claude-sonnet-5` at `low`
  against git-repo-utf8. Nothing here is known to hold for Opus, or for a project
  with different node conventions.
- **Mutations were not driven end to end.** The probes read; the store's
  create/update/delete are spec-covered but no live candidate exercised them,
  because none of these four prompts asks for a form.
- **`sample_data` keyed to a class the graph never queries never happened**, so
  the "records the runtime holds and nothing reads" path is still untested
  against a real model.
- **The `unrenderable` path never fired.** All sixteen candidates had a visual
  root, so the logic-only message is still only spec-covered.

## Reproducing

```bash
node packages/noodl-editor/scripts/aix15-live/build.mjs
node packages/noodl-editor/scripts/aix15-live/dist/aix15-harness.cjs \
  --mode=sandbox --model=claude-sonnet-5
```

`--arms=with|without|both` (default both), `--reps=<n>`, plus the shared
`--only=`, `--effort=`, `--outdir=` flags.

One note for whoever runs this next. The `sandbox` mode is the first in this
harness to construct a real `ProjectModel`, which drags in editor code that reads
`platform.getUserDataPath()` at module scope, so `@noodl/platform` gets a small
real shim (`platform-shim.cjs`) instead of the noop Proxy the other modes use.
The reason is worth keeping: **esbuild's `__toESM` interop copies a CJS module's
own enumerable keys, and a Proxy whose only trap is `get` has none** — so every
named import from a proxied module arrives as `undefined`, whatever the Proxy
would have answered. A stub that works for `import * as x` can silently fail for
`import { y }`.
