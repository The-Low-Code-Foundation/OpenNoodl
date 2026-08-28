# SYL-001 — the hand-holding half

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | S (the field) + M (the preference) |
| **Surface** | `editor` (lesson format, compiler, verifier, CSS), `noodl-mcp` (authoring brief), `docs` |
| **Rules** | [R3](RICHARD-RULINGS-2026-08-28.md#r3--experience-changes-the-voice-not-the-lesson-set) |
| **Blocks** | **every lesson in this phase** — see §"Why this is first" |

## The job

Richard, on what the intake's `experience` answer should change:

> *"Change the voice and level of hand holding throughout the tutorial, don't need to explain to an
> intermediate user how to access the node picker."*

A step has **one `body`**
([`lessonformat.ts` `LessonStepDef`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts)) —
a single Markdown string, no audience, no variant. So the ruling is not authorable today.

**This task adds `detail?: string` to a step: the hand-holding half, authored beside the
instruction rather than mixed into it.** `body` says what to do; `detail` says where the button is.

## 🔴 Why this is first, and not "later, once we see how lessons go"

Lesson 1 (`your-creature-on-screen`) is the **most beginner-facing lesson in the curriculum** — it
is where the hand-holding is thickest. Author it as one `body` and the split becomes a re-cut of
every step's prose, in Richard's words, which are the expensive ones. The field has to exist before
he writes.

## 🔴 And why it ships RENDERING, not just a field

The obvious minimal scope — "add the type, wire the preference later" — is the
**BUILD-THE-CALLER** defect this codebase has paid for repeatedly, and **this format already
contains one**:

> `suggestedNodes` compiles to `data-suggested-nodes`, which `LessonModel.getCurrentSuggestedNodes`
> reads, **and nothing calls that getter**
> ([`lessonverify.ts:393`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts) says
> so in as many words). `noodl-mcp`'s authoring brief tells models *"not read by anything. Do not
> rely on it."*

A second dead field in the same format is not an increment, it is the same mistake twice. So the
field ships **live**:

> `detail` compiles to a native `<details>` disclosure. **No runner work, no preference plumbing,
> no JavaScript** — a learner can open and close it the day it lands. The `experience` answer, when
> it arrives, only changes the **default open state**.

## Scope — slice A (this task, now)

1. `LessonStepDef.detail?: string`.
2. `compileStep` emits it inside the popup, after the body, as a `<details>` with a fixed summary.
   **Default open**, because a collapsed-by-default field with nothing yet setting the default is
   information hidden from the learner who most needs it.
3. `CompiledStepSource.detail`, so the source is recoverable without re-parsing the HTML the
   compiler just produced — the fork [`lessonformat.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts)'s
   own header warns about ("a second compiler is how two producers of one format start disagreeing").
4. 🔴 **`urlsInStep` must learn the field.** It walks `['title', 'body']` today
   ([`lessonverify.ts:545`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts)).
   A `javascript:` href in `detail` would be dropped at the sink by `safeLessonUrl` but **never
   reported to the author** — the belt half without the braces. Both halves or neither.
5. CSS in [`LessonLayerView.css`](../../../packages/noodl-editor/src/editor/src/views/lessons/LessonLayerView.css),
   on tokens.
6. 🔴 **Document it in [`authoringBrief.ts`](../../../packages/noodl-mcp/src/lessons/authoringBrief.ts)
   and [LESSON-FORMAT.md](../phase-17-noodl-learn/LESSON-FORMAT.md).** This format's own recorded
   rule: *"a model cannot use a verb nobody told it about, so an undocumented verb is an unshipped
   one."*

## Scope — slice B (later, and NOT blocking lesson 1)

7. The `experience` preference sets the default open state.
   🔴 **The editor holds it; the bundle carries both halves.** `experience` is answered on the
   platform and rendered by the editor, and nothing crosses that gap today — but shipping the
   answer *inside the bundle* breaks D17's invariant that a lesson stays installable from a local
   directory with no origin ([`curriculum.ts`](file:///Users/richardosborne/vscode_projects/nodegx-community/src/lib/curriculum.ts)).
8. ⬜ **Open, not ruled:** whether the editor asks once, or reads the platform answer when signed in
   and treats it as a changeable default.

## Acceptance criteria — slice A

1. A manifest with `detail` compiles, and the compiled step contains a `<details>` whose content is
   the rendered Markdown of that field.
2. A step **without** `detail` compiles to **byte-identical HTML to before this change**. The
   existing corpus must not move.
3. `verifyLessonManifest` reports an unsafe URL in `detail` with `field: 'detail'`, and the sink
   drops it. 🔴 **Both, in one spec** — the two mechanisms are the pair, and a task that proves one
   has proved half.
4. `renderMarkdown` output for `detail` is escaped on the same path as `body` — proven by a spec
   with a `<script>` in it, not by reading the call site.
5. `stepSources[i].detail` round-trips the authored string exactly.
6. The authoring brief names the field, and states plainly what reads it — 🔴 **contrast with the
   `suggestedNodes` line directly above it, which had to say "nothing".**
7. `log-a-thing` still validates clean: `npm run lessons:check`, 0 findings.
8. The new specs are exported from [`tests/lessons/index.ts`](../../../packages/noodl-editor/tests/lessons/index.ts) —
   ⚠️ a spec this suite does not export **never runs**, and reads as a pass.

## Traps

- 🔴 **A dead field reads exactly like a live one from the manifest.** AC1 grades the *compiled
  output*, not that the type accepts the key.
- 🔴 **AC2 is the control.** Without it, "detail renders" is compatible with "every step's HTML
  changed", and the corpus would move under the whole curriculum silently.
- ⚠️ `<details>` inside `innerHTML` / `dangerouslySetInnerHTML` is fine — it is not a scheme sink —
  but the *content* goes through `renderMarkdown`, which is. Do not hand-build the inner HTML.
- ⚠️ The summary text is **fixed**, not authored, in slice A. An authorable summary is a second
  string per step for Richard to write, and nobody asked for one.

---

## Slice A — built and measured, 2026-08-28

**All eight slice-A acceptance criteria closed.** Readings, so nobody re-derives them:

| gate | reading |
|---|---|
| `test:ci` | **2875 specs, 4 failures @ seed 22416, 71s** — 🔴 all four are **AIX-006 style vocabulary**, the recorded floor. **Separated by name, not by count.** |
| the 12 new specs | suite went **2863 → 2875 = +12**, matching `lessondetail.test.ts` exactly. They ran; none is in the failure list. ⚠️ This delta is the evidence — a spec absent from `tests/lessons/index.ts` reads as a pass. |
| `test:main` | 375 suites / 6254 tests / 0 failures, exit 0 |
| `typecheck:editor-tests` | exit 0 — ⚠️ `typecheck:editor` does **not** cover `tests/`; this is the gate that grades the specs |
| `typecheck:mcp` | exit 0 |
| `lessons:check` | exit 0, `log-a-thing` clean (AC7) |

### What the build found

- 🔴 **The dead-field precedent was live, not historical.** `suggestedNodes` still compiles to
  `data-suggested-nodes`, `LessonModel.getCurrentSuggestedNodes` still reads it, and it still has
  no callers. That is why this task ships rendering rather than a field — see §"why it ships
  RENDERING".
- 🔴 **`urlsInStep` was half a mechanism.** The neutraliser (`safeLessonUrl` at the sink) and the
  report (`verifyLessonManifest`) are a deliberate pair, and a field added to only one half has
  only one half's protection. `detail` is now in both, with a **negative control** — a safe URL is
  neither reported nor stripped — because without it both specs also pass on a verifier that flags
  every link and a compiler that strips every href.
- ⚠️ **The Markdown link grammar is `\[([^\]]+)\]\(([^)]+)\)`**, so a URL containing a parenthesis
  truncates at the first one: `javascript:alert(1)` is read as `javascript:alert(1`. A spec fixture
  written without checking this asserts the wrong string and grades the link parser instead of the
  refusal. Use paren-free URLs in scheme fixtures.

### Left

- ⬜ **Slice B** (items 7–8): the `experience` preference sets the default open state. Not started,
  and **not blocking any lesson** — prose authored now needs no revision when it lands.

---

## Slice B — built and measured, 2026-08-28

**Item 8 ruled by Richard, this session:** *the editor asks once, and the answer is changeable.*
Not: read the platform answer when signed in. So the preference lives in `EditorSettings`, under
`lessons.detailOpenByDefault`, and no new path from platform to editor was built.

### 🔴 How "asks once" was taken — one sentence for Richard to overrule

**The disclosure itself is the question.** A learner collapsing a `Show me how` *is* the answer,
and opening one again is the answer changing back. There is no modal in front of lesson 1 and no
settings row.

That reading was chosen over an explicit prompt for a reason worth stating: the ruling's other
half is *changeable*, and a modal asked once at first launch is the version of this that is
hardest to change later — a learner who answered "fluent" in month one and wants the help back in
month three has to find a settings screen. Collapsing and opening a disclosure is the same gesture
in both directions. ⬜ **If Richard wants a literal question, it writes the same key from a
different place, and nothing built here changes.**

### 🔴 What was deliberately NOT built, and why that is the point of this task

**No `experience` field anywhere in the editor.** The mapping is decided — *none* opens, *some* and
*fluent* collapse, which is Richard's sentence ("*don't need to explain to an **intermediate** user
how to access the node picker*") read literally — but the platform answer cannot reach the editor
today, so a key holding it would be **set by nothing**. That is the `suggestedNodes` defect exactly,
in the task written to avoid it. The mapping is recorded in prose in
[LESSON-FORMAT.md §4a](../phase-17-noodl-learn/LESSON-FORMAT.md), and seeds the one live key on the
day the answer can cross.

### What is live

| piece | where | who writes it | who reads it |
|---|---|---|---|
| `lessons.detailOpenByDefault` | `EditorSettings` | the learner, by collapsing or opening a disclosure | every step render |
| `applyDetailPreference` | [`lessonhandholding.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonhandholding.ts) | — | [`lessonlayer2.ts` `loadSteps`](../../../packages/noodl-editor/src/editor/src/views/lessonlayer2.ts) |

The compiled HTML **did not change**. Every learner and every install still gets the same bundle,
`open`; one attribute is flipped at render time. That is what keeps D17 intact — a lesson installed
from a local directory with no origin contains both halves and neither learner's answer.

### What the build found

- 🔴 **`toggle` fires asynchronously, so the listener can hear its own write.** Bind a handler and
  set the attribute in the same tick and the editor records *its own guess* back as though a person
  had said it — a preference that confirms itself is indistinguishable from one a learner set.
  The guard is that **only a state differing from the applied default is persisted**, and the spec
  that proves it is a negative control (`does NOT record a toggle that merely agrees`). Without
  that control every other spec in the file also passes on the broken handler.
- 🔴 **Where it is applied is what matters, not how.** `loadSteps` copies the popup through
  `innerHTML` on its way to the screen, so a preference applied to the parsed `stepElement` would
  be applied to a node that is then discarded — and a listener bound there would never fire. It is
  applied to `root`, the element actually displayed, and there is a spec for the `innerHTML` round
  trip itself.
  ⚠️ **A claim written first and then checked: "the attribute, not the property".** `open` is a
  *reflected* IDL attribute, so `el.open = false` removes the content attribute too and would have
  survived the copy identically. `setAttribute` is explicitness, not a fix — and the spec for the
  round trip does not discriminate between the two. Recorded because it is the shape of thing that
  gets relayed forward as a lesson when it is not one.
- ⚠️ **One consumer, checked rather than assumed.** `data-template="popup"` is parsed in exactly one
  place in the editor, so there is no second renderer that would show the preference not applying.
- ⚠️ `applyDetailDefaultOpen` returns a **count**. A call that matched nothing and a call that
  changed everything read identically otherwise, and the selector is a coupling to the compiler's
  class name — the count is what would notice it being renamed.

### Gates

| gate | reading |
|---|---|
| `test:ci` | **2887 specs, 4 failures @ seed 11307, HEAD `d4c8eeb9`** — 🔴 all four **AIX-006 style vocabulary**, the recorded floor, **separated by name**. Suite **2875 → 2887 = +12**. |
| the 12 new specs | all twelve appear by name in the run's `[spec-start]` lines and none in the failure list. ⚠️ `test-results.json` records **failures only** — a grep for the new names there returns 0 whether they passed or never ran, so the evidence is the spec-start lines and the +12 delta, not that file. |
| 🔴 **the mutant** | guard removed (`if (isOpen === open) return;`) → **5 failures @ seed 47904**, and the fifth is **exactly** *"does NOT record a toggle that merely agrees with what was applied"*. Nothing else moved. The negative control kills what it was written to kill. Module restored and md5-matched against the pre-mutation copy. |
| `test:main` | 375 suites / 6254 tests, **1 failure — a flake, not this change**: `BLD-004 reasoningChannel` *"counts a reasoning delta as life"*, a timing spec that reported *"nothing arrived for 0 seconds"* while a peer session had an editor stack up. Re-run alone: **8/8, exit 0**. It touches no lesson code. |
| `typecheck:editor` | exit 0 |
| `typecheck:editor-tests` | exit 0 |
| `typecheck:mcp` | exit 0 |
| `lessons:check` | exit 0, `log-a-thing` clean |

### 🔴 The one thing NOT verified

**No drive.** Every claim above is a spec. The single line that connects them to a running editor —
`applyDetailPreference(root, EditorSettings.instance)` in `loadSteps` — is graded by reading, and
this repo's own recorded rule is that a surface can pass its specs and be dead in the app.

⚠️ **It was blocked, not skipped**: a peer session held the editor and the CDP port for a P77 drive
for the whole of this session, and two editors cannot coexist here. ⬜ **Open a lesson with a
`detail` step, collapse one disclosure, advance a step, and confirm the next one comes up
collapsed.** That is the whole drive.
