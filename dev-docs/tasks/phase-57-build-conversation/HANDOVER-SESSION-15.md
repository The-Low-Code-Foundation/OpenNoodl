# Phase 57 — handover after session 15 (2026-08-10)

**What ran:** **BLD-013 built and driven; BLD-014's webview half built and driven.** Both of
Richard's open decisions are answered and recorded.

⚠️ **Phase 57 is 12 of 17 fully built, plus BLD-014's webview half** — *not* the 14 this handover
first claimed. The running total in TASKS.md was already off by one and I incremented it instead of
recounting. Counted off the tables: Track A 9 of 11, Track B 3 of 6 + a half. **Recount from the
tables; never increment the previous session's number.**

Track B's frame paid for itself exactly as BLD-011 promised — but not for free. Each task is a
`ReferenceKind` member, a resolver and a glyph *plus* the one thing BLD-011 declared and never
wired: **the media path from the composer to the wire**. `ReferenceResolution.images` existed and
nothing carried it; a turn was a string all the way down.

## 🔴 Read this before touching the opening turn

> **Media placement on the authoring turn is a Rule 6 question, not a formatting one.**

Media cannot be concatenated into a string — it has to stay blocks all the way to the adapter, or
`degradeImages`/`degradeDocuments` have nothing to degrade and the twin contract stops being
enforceable. So a turn carrying media converts its character `cacheBoundary` into a `cache: true`
marker, and **that conversion is where the money is.**

The natural implementation is media-first. It is what every provider's own guidance says (a document
before the prose that discusses it), it is what `referenceMediaBlocks` does, and it is correct for
the *planning* turn, which has no boundary to protect. Doing it on the **authoring** turn puts a
900KB screenshot ahead of the breakpoint — which does not cost the screenshot. It re-bills the
entire AIX-007 stable prefix (project overview, node catalog, style vocabulary, docs), uncached, on
every operation of every plan. Nothing on screen changes. The only symptom is the invoice.

`openingTurnWithMedia` places media *after* the marked block, and
`tests-unit/bld-013/mediaCacheSafety.test.ts` asserts the marked block's **index** as well as its
bytes — a prefix that is the same length by luck is not the same prefix. ⚠️ **Inverted before it was
trusted**: media-first turns 4 of 7 red, including both index assertions.

## ✅ The two decisions, and what they changed

### Q5 — PDF. The answer removed the dependency rather than costing one.

> Richard: *"If they're using an image model (Anthropic, OpenAI, Google) accept. If not throw a
> warning like 'PDFs might not be supported by this model'. But most people will just use Anthropic
> and OpenAI so we won't have to care."*

Read literally that is a **capability gate, not a parser**. Anthropic's Messages API takes a base64
`application/pdf` document block natively — no beta header, 32MB / 600 pages — and does its own text
extraction and page rasterisation server-side. `pdfjs-dist`, which the task costed as *"the one
genuinely new dependency the phase would take on, in a packaged Electron app that is already
large"*, would have bought a worse version of something the endpoint already does.

**Shipped: zero new dependencies.** `AiContentBlock` gains a third member, every adapter is updated
in the same commit (the union is closed for exactly this reason), and `capabilities.documents` is a
flag on the model registry.

⚠️ **`documents` is deliberately narrower than `vision`, and the gap is the finding.** A model that
reads images is not thereby a model whose *endpoint* takes a PDF — this repo's OpenAI adapter speaks
Chat Completions `image_url` parts and nothing else. Claiming the capability from the vision flag
would have sent bytes to an endpoint that refuses them: the same silent failure `vision` was added
to prevent, one media type later. So a PDF on OpenAI attaches, sends, and the chip says the model
will receive the twin instead.

### Q6 — when a capture is offered. One-click on the receipt.

Shipped as the *other* half of that decision too: `◎ Look at it` also sits in the composer. A
receipt-only offer would make "one click after an apply" the only moment the feature is ever
reachable, and *does this look right?* is a mid-conversation question.

## ⚠️ The findings worth more than the tasks

### 1. 🔴 BLD-011's own fix became this task's defect

`.Picker { position: relative; width: 100% }` was BLD-011's answer to a list that opened **113.8px
wide** and ellipsized `Library/Layout/Breadcrumbs` to `Library/L…`. It was correct while the picker
was the only thing in its row.

Add two buttons and a full-width flex item claims the entire line: `Attach` and `Look at it` were
pushed onto a second row **at every width** — measured 67px tall at 248px and *still 67px at 800px*,
where all three buttons fit in 742px with room to spare. The positioning context moved up to the row
(`.ComposerControls`), so both properties hold at once: the list is still 340px in a 364px composer
with nothing clipped, and the row is 30px.

**A rule that was right about its old subject — the sixth time this phase.** The generalisation is
sharper now: *when you add a sibling to a box, re-read the rules that box was given when it was
alone.*

### 2. 🔴 A ceiling round in the source printed as a non-round limit

`documentMaxBytes: 20_000_000` is a perfectly round constant that `formatBytes` renders as
**"19.1 MB"** — so a user who trimmed a PDF to just under 20MB was told the limit was 19.1. The
number was correct; the message was useless. **Nobody checks a ceiling against the constant in the
source, they check it against the sentence in front of them.** Now binary, and the spec asserts the
*printed* value rather than the constant.

### 3. ⚠️ A near-miss: the sweep reported a 71px overflow that did not exist

The first width sweep set `host.style.width` and measured in the same synchronous loop. It reported
71px of composer overflow at 248px and 19px at 300px. Re-swept with real frame waits between steps:
**0 at every width.** I nearly filed a defect that was not there — and made a change on the strength
of it.

> **The occlusion trap that clamps timers ~1000× and kills `ResizeObserver` also poisons a
> synchronous measurement sweep**, which is the tool this phase reaches for most.

The wrapping row it prompted is kept on its merits: below ~340px the three controls genuinely cannot
share a line, and wrapping is the right answer there. But the *reason* recorded in the commit is the
real one, not the artifact.

## What was measured

| | result |
|---|---|
| markdown paste | `BRIEF.md 53` · meter `1 attachment · 53 characters` |
| image paste, 2400×1200 PNG (83,779 B) | resized to **1568×784**, chip reads `45 KB` |
| PDF paste, 300KB | `brand-guidelines.pdf 293 KB`, **no warning** — the configured model takes documents |
| meter, all three | `3 attachments · 222 characters · 1 image · 1 PDF · 338 KB` |
| refusals | `.zip` → names what *is* supported; 21MB PDF → names both numbers. Both block Send |
| `◎ Look at it` | greyed with no preview; un-greyed within 500ms of the bench mounting; one click → `App screenshot 3 KB`, **unpinned** (Rule 7) |
| picker list, after the fix | **340px** in a 364px composer, `docs/decisions/000-initial-scope.md` **not clipped** |
| control row | **30px** (was 67px at every width); wraps below ~340px, which is correct |
| horizontal overflow, **248 → 800px** | **0** for the row, the composer, the chips, the meter and `document.body` |
| contrast, enabled, dark / light | Attach **6.66 / 6.54** · Look at it **6.66 / 6.54** · Add context **6.66 / 6.54** · PDF warning **9.20 / 5.14** |
| `Look at it` **disabled** | 3.17 — the disabled state, WCAG-exempt. Stated rather than buried |
| new state classes | `.Chip.is-warned`, `.Chip.is-stale`, `.Composer.is-dragging`, `.Warning` all compile as real selectors — none `MISSING` (BLD-005's defect shape) |

## What was NOT driven — stated, not implied

- ⚠️ **Staleness is still not on screen.** This half-closes BLD-011's R4 rather than closing it.
  `capturedAtApply` now comes from a real capture and the whole rule is graded against one for the
  first time — but `noteApply()` fires only on the accept path, so *watching a chip grey* costs a
  billed authoring session.
- ⚠️ **Drag-and-drop was not driven.** Paste was, end to end, and the drop path shares every line
  below the `File[]` boundary — but the `dragover`/`drop`/`dragleave` handlers themselves have not
  met a real drag. The file picker opens a native dialog and was not driven either.
- ⚠️ **No billed call was made.** Every path above is reachable without one, so none was spent. The
  request assembly is pinned by spec instead; what has *not* been proved on the wire is that
  Anthropic accepts our `document` block shape. That costs one send and is the first thing to do
  with the next authorised call.
- ⚠️ **The store-once-by-hash criterion is not built.** Nothing persists reference bytes at all
  (`TurnReference` records kind/label/size by BLD-011's design), so there is no store to dedupe
  into — but the in-memory list does hold two copies of one mock attached twice. Filed as BLD-013 R3.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **106 suites, 1448 tests**, zero failures (baseline 103/1410 → +3 suites, +38 tests, all new here) |
| `test:ci` | **`Jasmine: 2632 specs, 6 failures (failed). Randomized with seed 52977.`** — the documented baseline, all six inherited |

⚠️ The dev stack was stopped before `test:ci` ran — a live one makes it invent failures.

✅ **The `test:ci` baseline is now confirmed at a FOURTH seed, and again by name.** Sessions 12–14
measured the same 6 at seeds 39386, 30232 and 27603; this run measured them at **52977**:

```
AIX-006 style vocabulary AIB-009 F11: a provider that stalls during the style pass…
AIX-006 style vocabulary with guidance off, a raw candidate is accepted immediately…
AIX-006 style vocabulary offers one advisory style pass on a valid-but-raw candidate…
AIX-006 style vocabulary a style suggestion never downgrades a valid authoring…
AI model registry treats openai-compatible as sharing the OpenAI catalogue
AI model registry has exactly one default per provider that owns models
```

🔴 **And a correction to the recorded baseline that a later run forced.** After the F22 work, a
`test:ci` run at seed **82196** came back with **9** failures — the 6 plus **BEN-001 ×3**. Since I had
just changed a module the component bench imports, I could not assume it was inherited. Re-running
**the same commit at seed 97132 returned 6**. So the trio is **order-dependent**, and earlier
handovers' *"BEN-001 ×3 did not appear at any of the three seeds"* is falsified rather than
confirmed. They fail with `Expected $.length = 0 to equal 2` — the fixture component came back with
no ports at all, which is a spec-order effect on `ProjectModel`. **6 is the floor; a 9 is not
automatically yours — re-run at another seed first.**

The two real bugs behind the six are unchanged: the registry expects `gpt-4o`/`gpt-4o-mini` where the
catalogue now returns six ids led by `deepseek-ai/DeepSeek-V4-Pro`, and AIX-006's style pass is not
emitting `STYLE LINT`. ⚠️ **I checked whether adding `documents: true` to the `claudeFrontier` band
had caused the registry pair — it had not**: both are in the baseline by name, and neither touches
`isDefault` or the OpenAI catalogue.

⚠️ **The spec count moved 2596 → 2632 and none of the +36 is mine.** The Jasmine suite grew because
the sibling's *uncommitted* `makeHome.spec.ts` and `extract-to-component.spec.ts` are wired into
`tests/components/index.ts` and `tests/nodegraph/index.ts`. My specs are jest, not Jasmine, and land
in `test:main`. **Do not diff `test:ci` spec counts against session 14's number** until the sibling
lands or drops that work.

## Concurrency

The sibling's inherited set is unchanged and now carries an **ninth** session:
`dev-docs/tasks/phase-17-noodl-learn/`, the two `code-editor/` files, the `Launcher/` files,
`hello-world.template.ts`, `ProjectsPage.tsx`, `ExtractToComponent.ts`, `EditorClipboard.ts`,
`useComponentActions.ts`, the three `tests/` files and the four untracked
`ExtractToComponentPopup`/spec files. **Leave them.**

Every commit here was pathspec-scoped. No `git add -A`, no `git stash`. The pre-existing
`stash@{0}` on this branch was not touched and still wants identifying.

⚠️ **The QA fixture was not modified.** The drive attached files that existed only in the renderer's
memory and opened the component bench; `project.json` was never written and no `docs/` file was
created or removed. BLD-008's criterion-1 dependency on the fixture's state is intact.

## ✅ F22 resolved, after the handover was first written

Richard chose **option 2 — a new no-build package**. `@nodegx/render-measure` now holds
`measureExpression`, `summarise`, the thresholds, the finding vocabulary and
`placeholderStringsFromCatalog`; `render-report.js` requires it and re-exports all 22 names it used
to own, so `noodl-mcp` and `measure-from-disk.js` are untouched — its 41 specs, graded against
recorded measurements from seven real builds, stayed green across the move.

⚠️ **Plain CJS with a hand-written `index.d.ts`, unlike this repo's seven other no-build packages,
which point `main` at `.ts`.** `measure-from-disk.js` is run by bare `node`, and bare `node` cannot
`require` a `.ts` file. The cost is real and stated in the file: `tsc` cannot check the declarations
against the source, so they are narrow on purpose.

**And it closed BLD-014's build item 4 for the webview producer** — the second reason F22 had to go.
*"Never ship a capture path that returns only an image"* was unbuildable while `summarise` sat behind
Node requires. The editor now evaluates the identical expression through
`webview.executeJavaScript` and gets findings in one vocabulary. Verified inside a live sandbox:

```
0 errors, 1 warning (empty-decorated-box). preview 800×150px, 2 texts, 2 on screen, 0 images.
```

⚠️ **A spec of mine was decoration and inverting it is what showed me.** The purity check's
behavioural half patched `Module._load` and asserted the module still loaded — but jest supplies its
own module registry, so the patch intercepted nothing and it passed whatever the source did. Adding
`require('path')` turned only the *textual* check red. It now compiles the source with `require` out
of scope, which is the actual condition in a browser bundle, and both bite.

## What to do next

1. **BLD-015 and BLD-016 are now the cheap ones**, and cheaper than BLD-013 was: the media path
   exists, so a search result or an `@` mention is genuinely just a kind, a resolver and a glyph.
   BLD-016 additionally wants the `@` keyboard path into the picker that already backs it.
2. ✅ **BLD-014's CDP half is unblocked.** F22 is resolved and the measurement half is already proven
   inside the editor. What remains is transport: a `Page.navigate` entry point for an arbitrary URL,
   and the viewport vocabulary — `DEFAULT_VIEWPORTS` already exports it. ⚠️ A URL capture is a
   network egress and build item 7 says to say so before the first one.
3. **BLD-010's list is now nine**: BLD-004's R4 (Ollama) and R5 (`reasoning_content`); BLD-006's
   R12; BLD-017's F2 and F4; BLD-008's drafting turns + restart-resume; BLD-011's R9; and now
   **BLD-013's drag-and-drop + picker paths** and **BLD-014's on-screen staleness**.
4. **The design-system row is unchanged at four.** This session added no new call-site override —
   all three composer controls use `MutedOnLowBg`, the variant BLD-011 already moved to.
5. **Three tasks remain unbuilt**: BLD-009, BLD-015, BLD-016 — plus BLD-014's CDP half, and BLD-012
   still 🟡 on OpenAI's leg.
