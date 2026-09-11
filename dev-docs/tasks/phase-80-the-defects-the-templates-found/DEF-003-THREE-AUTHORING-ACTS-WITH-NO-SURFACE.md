# DEF-003 — Three ordinary authoring acts with no honest surface

**Rank 3.** Sources: phase 77 **D8** = phase 76 **F15**; phase 77 **D7**; phase 76 **F16**. All
**NONE**-owned.

Three unrelated-looking rows with one shape: **a builder does an ordinary thing, the product accepts
it, and it does not mean what it says.**

## 1. (a) A bare number on a dimension port silently means *percent*

**Confirmed at HEAD**, `packages/noodl-viewer-react/src/react-component-node.ts:1925`:

```ts
if (typeof value !== 'object' && type.defaultUnit) {
  value = { value, unit: type.defaultUnit };     // 240  →  { value: 240, unit: '%' }
}
```

So `width: 240` renders as `240%`. The object form is the fix and the door refuses the bare form —
but *"easy to write, hard to see"* is the whole of it.

🔴 **Two phases found this independently and neither gave it an owner**, and neither knew about the
other: phase 76 recorded it as **F15** (s6, *"a bare number on a dimension port being read as a
percentage"*) and phase 77 re-recorded it as **D8** (s9). **That is what an unowned row costs — it
gets rediscovered instead of fixed.**

## 2. (b) `Text` has no padding and no `borderRadius`

**Confirmed at HEAD** through the door — `get_node_type("Text", ports: [...])`:

```
"notFound": ["paddingLeft", "borderRadius"]
```

`text.ts:149-157` calls `addMarginInputs(TextNode)` and no padding or border equivalent. So a padded
label needs a wrapping `Group` — every time, for every author, with nothing saying why.

## 3. (c) A page title cannot be set without an editor attached

Recorded in phase 76 as **F16**, *"a `Page` node's `title` port is dead after export"*. At HEAD it
is **worse and more precise**:

```
"notFound": ["title"]
"runtimeBehavior": "`title` and `urlPath` are registered per instance
                    by the editor connection"
```

🔴 **The port does not exist unless an editor is attached.** It is not that the title dies at export
— it is that **an agent authoring headlessly cannot set a page title at all**, and the door reports
it as an unknown port rather than as a limitation. The workaround (`Noodl.SEO.setTitle`) was found on
the template **whose product is SEO**.

## 4. Scope

Each of the three is a separate decision, and the task is to take all three rather than the cheapest:

1. **(a)** Either refuse a bare number on a units port at the door with a message naming the object
   form, **or** make the editor show the implied unit. ⚠️ **Do not change the coercion** —
   `defaultUnit` is load-bearing for every existing project, and silently reinterpreting `240` as
   `240px` would move every graph in the corpus.
2. **(b)** Add padding and `borderRadius` to `Text`, **or** state the omission in the node's own
   description so the `Group` wrapper reads as the design and not as a workaround.
3. **(c)** Register `title` and `urlPath` from the **component definition** rather than the editor
   connection, so a headless author can set them. If that is not possible, the door must say
   *"`title` is editor-only, use `Noodl.SEO.setTitle`"* instead of `notFound`.

## 5. Acceptance criteria

1. **A person's sentence:** *when I set a width, a padding or a page title, either it does what I
   asked or the thing I am building tells me why it cannot.*
2. **(a)** A bare number on a units port produces a **named** diagnostic or a visible unit — and the
   object form still works unchanged. A regression arm over the existing corpus proves nothing moved.
3. **(b)** `paddingLeft`/`borderRadius` resolve on `Text` **or** `Text`'s description names the
   limitation and the vocabulary teaches the `Group` wrapper.
4. **(c)** A page authored **headlessly** carries a title into the deployed HTML `<title>`, driven —
   not asserted from source. ⚠️ **Verify the consequence, not the mechanism**: a `toContain` over
   source text passes on dead code.
5. Each of the three has a **known-broken arm** in the suite.

## 6. Traps

- 🔴 **This row already proved that recording is not fixing.** If any of the three is deferred,
  it must be deferred **with an owner**, not returned to a register.
- ⚠️ **`Text`'s ports are contextual** — the catalogue says *"explicit width/height ports appear
  only in the matching size mode… treat the catalog's list as the superset the editor filters."*
  A `notFound` from one query is not proof of absence in every mode. Check the mode you mean.
- 🔴 **(c) is read from the door, not driven.** The claim that a headless author cannot set a title
  is a catalogue reading. **Drive it before building the fix** — and if it turns out an editor
  connection is present in the path that matters, the row shrinks to a documentation fix.

---

# §7 — CLOSED 2026-08-29. What the drive changed.

**Status: ✅ done.** All five acceptance criteria met. The task's §6 said *"(c) is read from the
door, not driven — drive it before building the fix"*, and taking that seriously is what this
session was: **two of the three parts were not what the file says they are**, and neither could have
been discovered by reading more source.

## §7.1 What each part turned out to be

| part | the file's claim | measured at HEAD, 2026-08-29 |
|---|---|---|
| **(a)** a bare number silently means percent | *"easy to write, hard to see"* | 🔴 **Already answered, since phase 40.** The door emits `unitless-dimension` — a **blocking** warning naming both object forms — and **rejects the write**. AC2 was met before this task opened. |
| **(b)** `Text` has no padding or `borderRadius` | *"nothing saying why"* | Half true. The door refused it with `unknown-parameter`, which is **true and a dead end** — there is no differently-named port to look for. Now it names the `Group` wrapper. |
| **(c)** a page title needs an editor attached | *"an agent authoring headlessly cannot set a page title at all"* | 🔴 **FALSE.** Driven: a page authored through the real MCP door with `title` set, no editor ever attached, renders with that `document.title`. |

## §7.2 The measurements

Everything below was driven in a real headless Chrome against the working-tree runtime, on a
project authored through the real MCP door. The arms are
`packages/noodl-mcp/tests/def003PageTitleDrive.test.ts`.

- **(c)** `Page { title: "The Honest Title", urlPath: "titled" }` → `document.title` is
  `"The Honest Title"`, and the page is reachable at `/titled`. The **control** — the identical
  page minus the `title` parameter — comes back `"Plain"`, its component name.
- **(a)** `width: 240` on a `Text` in a 756px page renders **1814.39px** — 240% — while
  `{value: 240, unit: "px"}` renders exactly **240px**. `unitless-dimension` has claimed *"renders
  at 240%"* since phase 40 and nothing had ever measured it. Now something does.
- **(b)** `paddingLeft: 24` on a `Text` computes `padding-left: 0px`; the same value on a wrapping
  `Group` computes `24px`. Both read off one DOM, so they are one comparison.

## §7.3 Why (c) was really broken, and what it cost

The port was never the problem. `title` and `urlPath` have always been read straight off the node's
parameters by the exporter (`editor/src/utils/exporter/router.ts`, `_getPageInfo`) into the router
index, from which the Router hands the title to `Noodl.SEO.setTitle`. What was missing was the
**declaration**: both existed only inside `page.ts`'s `setup()`, which returns immediately unless an
editor connection is running locally, so the generated catalog never saw them and
`get_node_type("Page")` answered `notFound: ["title", "urlPath"]` — for the two most commonly set
ports on the most commonly written node in the product, with a `runtimeBehavior` that said they were
*"registered per instance by the editor connection"*.

🔴 **An agent reading that does not set the parameter.** It reaches for `Noodl.SEO.setTitle` in a
JavaScript node — which is exactly the workaround phase 76 found on the site-builder template, *"the
template whose product is SEO"*. The declaration gap did not stop anyone setting a title; it stopped
them **knowing they could**, and the cost was paid in workarounds and in two phases re-recording the
row.

**A previous session had already worked this out and written the fix down.** `parameterValues.ts`'s
D16 carve-out — which suppressed the `dynamic-port-skipped` notice for these two names, because it
fired on **96 of 947 measured skips** and on every correct page anybody had written — closed with:
*"the honest fix is to declare the ports on `Page`, at which point this function has no population
and should be deleted rather than left."* Both are declared now, and the carve-out is deleted per
that instruction.

## §7.4 What was built

| file | what |
|---|---|
| `noodl-viewer-react/src/nodes/navigation/page.ts` | **(c)** `title` and `urlPath` declared as ordinary inputs. The `setup()` dynamic ports stay and still win where they are sent — FB-026's `replaceOrAppendPorts` means a dynamic port *replaces* a static one of the same name and plug, so an editor-connected property panel keeps its component-name defaults. The now-unreachable `registerInputIfNeeded` override is gone. |
| `noodl-types/src/node-catalog*.json`, `docs/node-catalog/enrichment/page.json`, `docs-site/` | Regenerated. `runtimeBehavior` now says the truth: the editor re-sends them for its panel; both are settable as parameters with no editor attached. |
| `noodl-editor/src/editor/src/validation/parameterValues.ts` | **(b)** `noBoxExit` — the `Group` wrapper, named at the moment it is needed. D16's carve-out deleted. |
| `noodl-mcp/src/catalog.ts`, `tools/responses.ts`, `editor-deps.ts` | **(b)** `get_node_type` returns `notFoundNotes` — the same sentence, imported rather than twinned, because the write gate and the catalogue tool are two doors onto one fact. |
| `docs/node-catalog/enrichment/text.json` | **(b)** `Text`'s own description and `whenToUse` name the omission, so the `Group` wrapper reads as the design. |
| `scripts/devtools/render-from-disk.js` | The exporter's component-name fallback for a page `title` — see §7.6. |

**(a) needed no code.** What it needed was for somebody to ask the door instead of reading the
coercion, and for the message's claim about the DOM to be measured. Both done.

## §7.5 Acceptance criteria

| AC | verdict |
|---|---|
| 1 — *when I set a width, a padding or a page title, either it does what I asked or the thing tells me why* | ✅ width: blocked, both units offered. padding: blocked, wrapper named. title: it does what you asked, and the door now says so. |
| 2 — (a) named diagnostic, object form unchanged, corpus unmoved | ✅ `unitless-dimension`, already blocking; nothing was changed, so nothing moved. Object form driven at 240px. |
| 3 — (b) ports resolve **or** description names the limitation and the vocabulary teaches the wrapper | ✅ second branch, and at both doors rather than only in prose. |
| 4 — (c) a headlessly authored page carries its title into the browser, **driven** | ✅ driven, with a discriminating control. |
| 5 — a known-broken arm each | ✅ see §7.7. |

## §7.6 🔴 Two defects this task's own instruments had

**1. The harness produced a title the product cannot.** `render-from-disk.js` reconstructed the
router index without the exporter's fallback, so a page with no `title` parameter reached the Router
as `undefined`, `Noodl.SEO.setTitle(undefined)` ran, and `document.title` became the literal string
`"undefined"`. Every measurement of a title through that harness — including `render_report`, a
shipped MCP tool — was reading a defect belonging to the instrument. It cost the first hour of this
session, chasing it as a product finding. Fixed there, and the drive's control now asserts the
component name rather than merely "something else", so it cannot come back.

**2. Declaring `title` broke the blank-page diagnosis, and the suite caught it.**
`render-report.js` derives "which types show content of their own" from **port names**, and `title`
is in that regex. It had no population before — `Page` is the only type in the catalog with a
`title` input — so the moment `Page` declared one, a page whose visual root is a bare `Page` counted
as content-bearing and `blankDiagnosis` went from `page-has-no-content` to `undetermined` on
AWP-003's real DeepSeek artefact. A blank page the tool could no longer explain. `Page` is now
excluded by name, with the reason: **a `Page`'s `title` is the *document* title and never reaches
the screen**, which is precisely what a name test cannot see.

⚠️ Both belong to the same family and are worth carrying forward: **a heuristic keyed on a port's
name changes meaning when a port is declared.** Anything that widens a node's declared surface
should be checked against every name-keyed rule in the repo, not only against the rule it is about.

## §7.7 The arms, and what killed them

- `noodl-editor/tests-unit/def-003/threeAuthoringActs.test.ts` — 13 specs.
- `noodl-mcp/tests/def003BoxlessPortNote.test.ts` — 7 specs, both doors.
- `noodl-mcp/tests/def003PageTitleDrive.test.ts` — 7 specs, real browser.

**Sabotage, run:**

| mutant | reds |
|---|---|
| `noBoxExit` returns `undefined` always | **3** of the (b) rows |
| `BOX_PROBE` back to box-only names (the first version of the rule) | **1** — the `Circle` control |
| — (c) at HEAD | `Page` declared **neither** `title` nor `urlPath`; every (c) row reads the real catalog |

🔴 **The `Circle` control is the one that matters, and it caught a false positive of mine.** The
first version of `noBoxExit` probed only `paddingLeft`/`backgroundColor`/`borderRadius`, and `Circle`
declares none of them — it paints through `fillColor`, `fillEnabled`, `strokeColor`, `strokeWidth`.
The rule would have told a `Circle` author *"it has no box of its own to paint, wrap it in a Group"*
and walked them straight past the port they wanted. The probe now asks *"does this node paint a
surface, under any name this library gives it?"*, and the remaining population — `Text`, `Columns`,
`For Each`, `Drag`, `Component Children` — is the one the sentence is true of, pinned by name in the
spec so a new arrival shows up as a failing row.

## §7.8 Gates at close

`test:ci` **2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** (the floor, seed 85339)
· viewer-react **1087/1087** · nodegx-export **797/797** · nodegx-backend **1306 passed / 10
skipped, 112 suites** (serial — two backend drives in one run flake on each other) · noodl-mcp
**927/928**, see below · `typecheck:editor` and `typecheck:mcp` clean · `catalog:check`,
`catalog:merge:check`, `catalog:groups:check`, `docs:nodes:check` all clean.

## §7.9 🔴 Two reds that are not mine, both with owners

1. **`catalog:check` was RED at HEAD before this session, and it is a PR CI gate**
   (`.github/workflows/pr.yml:198`). `0c011b6b` (DEF-016) changed three `External Link` port
   descriptions in the node source and never regenerated the catalog. This session's regeneration
   folds that in — so the commit carries three description lines it did not author, and the gate is
   green again. Nothing else drifted. **This is last session's own lesson arriving a second time: a
   closed task's outstanding debts need an owner.** DEF-016's was a stale generated artifact behind
   a CI gate nobody ran locally.
2. **`noodl-mcp/tests/templateAppearance.test.ts` — `site-builder has the pinned page count`,
   expected 5, received 6.** Created by `e5922d21` (**TPL-001, phase 78**) with the pin at 5, over a
   template that already has six pages. Nothing in this task can affect a count of `Page` nodes.
   **Owner: TPL-001 / phase 78** — whether the sixth page is intended (bump the pin) or not is
   theirs to say, and the pin exists precisely so that growing a page reddens here first.

## §7.10 Left for someone else, with an owner

- 🔴 **`packages/noodl-mcp/dist/noodl-mcp.cjs` is stale**, and the live MCP servers on this machine
  load `/Applications/NodeGX.app/…/noodl-mcp.cjs`. So `get_node_type("Page")` **through a running
  server** still answers `notFound` until that artifact is rebuilt and the app updated. The source,
  the suites and the committed catalog are all correct. **Owner: whoever cuts the next 0.2.1
  build** — this is the known `dist` seam, not a new defect.
- ⚠️ `render-from-disk.js` also diverges from `_getPageInfo` on **`urlPath`**: the exporter falls
  back to the title and appends any `PageInputs` path parameters, and the harness does neither. Not
  touched here because `routedPages` computes reachability separately and moving it would move URLs
  three drive suites assert on. **Owner: `NONE`** — it has never bitten anybody, and it is written
  down here so the next person who meets it does not re-derive it.
