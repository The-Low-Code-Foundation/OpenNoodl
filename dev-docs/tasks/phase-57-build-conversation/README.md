# Phase 57 — The Build panel is a conversation

**Created:** 2026-08-08
**Status:** 🟡 **3 of 16 built** — **BLD-007** and **BLD-012** (merged 2026-08-09, built the day
before in worktrees beside a live phase-56 session) and **BLD-001 ⭐ the frame** (built 2026-08-09).
⚠️ **None of the three has been driven in a real editor.** The other thirteen are specced only.
Tasks are **[TASKS.md](TASKS.md)** (BLD-001…016, two tracks).

**BLD-001 landing changes how you read the rest of this file.** The panel is now one thread of
turns with one composer, and the scope tabs are gone — so every defect below that says "the panel
switches subtrees" is describing history. D1 is closed. D2, D3, D4, D5, D6, D7, D8, D9 (closed by
BLD-007) and D10 are **not**: BLD-001 moved the panel's Accept/Discard onto the outcome card, which
means the preview document's copy is now the *second* one on screen rather than one of two peers.
**Do not count live controls until BLD-003 lands.**

⚠️ **Both were finished work that produced nothing for a day**, because a committed branch in a
scratchpad worktree is invisible to `git log cline-dev`. If you build in a worktree, the merge is
part of the task, not a follow-up.
**Design:** the mockup this phase was approved from —
[claude.ai/code/artifact/a37f0d32-b7f8-4104-97fd-2ee46a188c9f](https://claude.ai/code/artifact/a37f0d32-b7f8-4104-97fd-2ee46a188c9f)
(before/after at true panel width, nine mocked states, the reference model, the front-matter spec).
**Origin:** Richard, 2026-08-08, looking at the shipped panel mid-build:

> *"The 'Build' panel in the editor is really embarrassing right now. At the very least we need a
> more 'chat' like interface … where the left panel serves as conversation (creation) history and
> chat, showing tool use and results, the agent's thinking, what it produces and any questions it
> has for the user."*

## What this phase is, and what it is not

**Phase 55 owns what the agent builds. This phase owns the surface it reports through.** The two
must not blur, and the failure mode is specific enough to name: *fixing a legibility complaint by
changing the prompt*. If a task in here finds itself editing `prompts/authoring.ts`, it has wandered
into phase 55 and should stop.

The panel is a **form that produces a log**. Every defect below is a consequence of that one shape.
The phase replaces it with a **thread that accumulates**, and then gives that thread the things a
conversation needs to be worth having: eyes, a memory, and a way in.

## The diagnosis

Ten defects. Every one was read in source before it was written down — the phase-55 rule ("read the
mechanism in source before trusting any stated fact") is in force here too, and it earned its keep
immediately: **two of the four complaints Richard raised turned out to be about a different
mechanism than the one they looked like.**

### The two corrections — read these before building anything

**Correction 1 — the dark-mode text is not a contrast problem.**
Measured on the panel ground (`bg-1` = `#12161b`): `fg-default` (`#a6b0bb`) is **8.26:1**,
`fg-default-shy` (`#8b95a1`) is **5.98:1** — the same figure POL-017 banked when it moved `Text`
off `fg-muted`. Both clear WCAG AA comfortably.

The problem is that **nothing has a size**. Every line in the feed is 12px
([Text.module.scss](../../../packages/noodl-core-ui/src/components/typography/Text/Text.module.scss),
`.is-size-default`) with inherited leading, and of the four `TextType` roles the panel uses, **two
resolve to the identical hex** (D4). Brightening it would destroy the last of the hierarchy. The fix
is type scale and rhythm. ⚠️ **Any task that reaches for a colour token to fix legibility is wrong.**

**Correction 2 — the project run is not a black box.**
It already renders a headline with position, elapsed and cumulative cost, a row per operation with
its own live clock, and an expandable per-operation activity feed. That is considerably more than it
feels like.

It feels like nothing because **the headline is inside the scroll area**
([ProjectAuthoringView.tsx:1091](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1091)
opens the `ScrollArea`;
[:1309-1313](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1309)
renders `runHeadline` inside it). Within thirty seconds of a seven-operation run the one element
answering *"where am I"* is off screen, and what is left is a column of identical wand icons. **The
information exists; its placement destroys it.** BLD-005 is mostly a `position: sticky` and an
honest estimate — not a new instrumentation layer.

### The defects

| # | Defect | Evidence |
|---|---|---|
| **D1** | **Three scopes are three applications wearing one panel.** A segmented control picks `component` / `project` / `review` before the user has typed anything — each with its own start button, stop button, state and result treatment. The choice is demanded at the moment the user knows least. | [AiAuthoringPanel.tsx:74](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L74) — `type AuthoringScope`; [:471-479](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L471) — a three-way ternary switching whole subtrees |
| **D2** | **Accept / Reject / Review changes are rendered twice, simultaneously**, in different variants — once in the panel's pinned bottom bar, once in the preview document's top bar. Both are on screen together in Richard's screenshot. Neither defers. | [AiAuthoringPanel.tsx:635-645](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L635) · [AuthoringPreviewDocument.tsx:195-197](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/AuthoringPreviewDocument.tsx#L195) |
| **D3** | **Reject is red in both, and rejecting destroys nothing.** Nothing has been written; reject is the absence of a call. The repo's own law is red = danger, AIB-004 applied it correctly to "Discard plan" one screen over, and the Docs panel gets it right. The two AI surfaces are the outliers. | [DocsPanel.tsx:328-330](../../../packages/noodl-editor/src/editor/src/views/panels/DocsPanel/DocsPanel.tsx#L328) — `Ghost` ✅ · [AiAuthoringPanel.tsx:644](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L644) + [AuthoringPreviewDocument.tsx:197](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/AuthoringPreviewDocument.tsx#L197) — `Danger` ❌ |
| **D4** | **Two of the four text roles are the same colour.** `TextType.Secondary` and `TextType.Default` both resolve to `neutral-800`, in dark **and** light. The panel alternates between them across ~40 call sites believing they express a hierarchy. | [colors.css:277](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L277) `fg-default: neutral-800` · [:299](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L299) `secondary-as-fg: neutral-800` · light: [:506](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L506)/[:521](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L521), same collision |
| **D5** | **Accepting a build deletes the record of it.** `setState(null)` + `session.dispose()` — what you asked, what it read, what it repaired, gone at the moment it became part of your project. | [AiAuthoringPanel.tsx:349-352](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L349); and the codebase already knew — [ProjectAuthoringView.tsx:1182](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1182): *"This is also the answer to 'I don't see any conversation history'"* |
| **D6** | **The one signal separating "thinking hard" from "dead socket" is computed and thrown away.** All three providers emit `onActivity`; its only consumer is the turn deadline. | emit: [anthropic.ts:457](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L457) · [openai.ts:287](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/openai.ts#L287) · [ollama.ts:244](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/ollama.ts#L244). Only consumer: [turnDeadline.ts:107](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/turnDeadline.ts#L107). Its own doc comment ([types.ts:189](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L189)) calls it *"the only signal that separates a model thinking hard from a provider that has stopped answering"* |
| **D7** | **Reasoning is deliberately discarded, for a reason that binds the parser and need not bind the UI.** Adaptive thinking runs with `display: 'omitted'` so reasoning cannot leak into the response text the XML templates parse. Correct decision about the parser; it became a decision about the interface by default. | [models.ts:81-84](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L81) |
| **D8** | **Docs are click-and-pray.** One button infers everything, drafts three confident files, marks what it could not know `TODO` — and the panel **displays the TODO count as a feature**. The agent never asks a question, then hands off to a different panel to accept diffs. | [ProjectReviewView.tsx:132](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewView.tsx#L132) — `` `${draft.todoCount} TODOs for you to confirm` ``; and [templates.ts:5](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/templates.ts#L5) already says *"These are prompts to a human, not content. Every heading asks a question the graph cannot answer for itself."* |
| **D9** | **A doc you write yourself can never reach the builder.** The vocabulary is closed at three, and the retrieval tool's parameter is a **one-value enum** that scolds anything else. Richard's example — a doc explaining local tax rates — can be created, listed and rendered, and will be silently ignored forever. | [docsText.ts:11](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L11) — *"exactly four paths are known to the system. Anything else under `docs/` is carried and editable but never injected"*; [:37](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L37) `KNOWN_DOCS`; [projectDocsTool.ts:47](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/projectDocsTool.ts#L47) `enum: [ARCHITECTURE_ARG]` |
| **D10** | **A twenty-minute build does not belong in a 400px sidebar, and the stylesheet knows it.** POL-007 spent a page of commentary making one operation row survive its own panel. That fix is correct and stays; it is also a symptom — the surface is wrong for the job, not just the layout. | [AiAuthoringPanel.module.scss:18-32](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.module.scss#L18) — *"the Build panel fits inside the Build panel"* |

**Controls live at once, today: 8 in the panel + 4 in the document.**

## The move — seven rules

1. **There is one thread, and it never resets.** Header, turn list, composer — in every state. Nothing
   is a mode. Accepting appends a receipt; it does not clear the screen.
2. **Scope is inferred from what you asked, and stated before it acts.** The segmented control goes.
   The judgement moves from the user's first second to the agent's first sentence, which is where the
   information is.
3. **A decision lives on the thing it decides.** No pinned bottom bar — actions attach to the outcome
   card. And exactly one surface owns them at a time: **whichever surface is showing the candidate.**
4. **Machine chatter recedes; prose, questions and outcomes advance.** Five message kinds, five
   treatments, not four kinds sharing two colours.
5. **Never claim progress you cannot evidence, and never withhold progress you can.** The heartbeat
   animates only when a stream event landed; the estimate appears only after two completed
   operations and says it is an estimate; the run header never scrolls away.
6. **References ride behind the cache boundary.** (Track B.) AIX-007 made the prompt prefix
   byte-stable and `DOC_CAPS` caps each source *before* the shared budget. Attachments are the same
   problem with a bigger gun — a screenshot must never invalidate a cached prefix.
7. **A reference is pinned, or it perishes.** (Track B.) A mock you are copying should ride ten
   turns; a screenshot of your own app is true for about one. Nothing stale is ever sent silently.

## Track B — and the two things that already exist

Richard's second ask (2026-08-08): file upload, web search, headless render/screenshot for context,
and `@` mentions. Built as four features they are four bolt-ons to a composer that sends one string.
**Built as one mechanism — a turn carries `Reference`s that resolve to text and/or images at send —
they are one task plus five resolvers.** See BLD-011.

Two findings that change the cost of the track sharply:

- **The headless render harness is built and already returns images to a model.**
  [render-report.js](../../../scripts/devtools/render-report.js) launches Chrome `--headless=new`,
  drives raw CDP and calls `Page.captureScreenshot`;
  [renderTools.ts:91](../../../packages/noodl-mcp/src/tools/renderTools.ts#L91) returns
  `{ type: 'image', data, mimeType }`. It renders a project from disk — pointing CDP at an arbitrary
  URL is a new entry point on a working harness, not a new harness. The editor half is **F22**,
  already filed by LAS-005, and its blocker is *a packaging decision, not wiring*.
- **A second, much cheaper capture path exists and is unused.**
  [SandboxPreview.tsx:86](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L86)
  holds an `Electron.WebviewTag`, and `PreviewTokenInjector` already reaches into it on `dom-ready`.
  Webviews have `capturePage()`. "Show me what is on screen right now" is a handful of lines and no
  Chrome — and it answers a different question from a render report.

And the long pole: **the editor's messages cannot carry an image at all.** `AiMessage.content` is a
`string` ([types.ts:39](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L39)).
Encouragingly, the Anthropic adapter already builds `AnthropicRequestBlock[]` with an open block
type and already promotes string→blocks for cache breakpoints
([anthropic.ts:138-145](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L138),
[:176](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L176)).
The machinery is one layer down; the shared type is the narrow waist. That is BLD-012.

## ⚠️ Shared surface with phase 56 (the Component Bench) — read before starting

Phase 56 ([`phase-56-component-bench`](../phase-56-component-bench/README.md), BEN-001…007) was
specced in a **parallel session on the same day**, from a different request of Richard's, and the two
phases were written without knowledge of each other. They are **not** file-disjoint, and file
disjointness would not be the point anyway — *[[parallel-agents-solve-it-twice]]*: the trap is two
sessions solving the same design twice, differently.

**The shared surface is `SandboxPreview` and `AuthoringPreviewDocument`:**

| This phase | Phase 56 | The conflict |
|---|---|---|
| **BLD-009** wants `SandboxPreview` as the right pane of expanded mode, inside the existing `FrameDivider` split | **BEN-004** rebuilds the stage chrome around the same component and adds a mode selector | Both restructure the same document. **Whichever lands second must adopt the other's chrome, not add a second one.** |
| **BLD-014** wants `capturePage()` on the `SandboxPreview` webview ref | **BEN-001/002** change what that webview is *mounting* (a component with its inputs set, not as bare root) | Low risk, but a capture taken from a bench mount is a picture of a harness, not of the app. **BLD-014 must state which mount it captured.** |
| **BLD-003** moves Accept/Discard off the document top bar | **BEN-004** owns R1–R5, including the way back out of the surface | Both edit `AuthoringPreviewDocument`'s top bar. **Serialise these two**, or they will sweep each other. |
| **BLD-011**'s reference chips and **BEN-002**'s inputs rail are both new left-rail furniture in the same document | | Not a conflict yet. Worth one look before either is built. |

**Recommended order:** phase 56 first. It is smaller (7 tasks), it is closer to shipping, and BLD-009
is the last task in Track A anyway — so this phase can run Tracks A/B up to BLD-009 without touching
the bench at all. **Do not run BLD-009 and BEN-004 concurrently.**

## Standing constraints

- **Phase 55 owns authoring quality.** No task here edits an authoring prompt.
- **Open-weight models must work.** Phase 55's rule stands: a support system that only works with the
  strongest frontier model is a demo. Most mid-tier open-weight models cannot take an image, and
  LAS-009 shipped per-role providers — so a user may legitimately have Anthropic planning and Ollama
  acting *in one build*. Two consequences, neither optional:
  - **Every image-carrying reference needs a text twin.** LAS-005 already built exactly this and said
    why: the render report returns numbers *and* screenshots, because the JSON is what a text-only
    agent can act on. Degradation is **declared in the UI**, never silent.
  - **Web search is editor-side, not provider-native.** A tool that exists on the design role and
    vanishes on the act role is a worse interface than no tool.
- **Red means danger** (phase 23). Discarding an unapplied candidate is not danger.
- **Contrast is not the legibility problem** (correction 1). Type scale is.
- **One implementation, two hosts** — the panel and the expanded document render the same thread
  component with a width prop. No second implementation to drift.
- **Write the check before the fix** (phase 39). Several tasks here are "the mechanism already
  exists and nothing surfaces it"; the check is what proves the surfacing, not the mechanism.

## Exit test

The phase closes when a single continuous session does all of this **without the thread ever
resetting and without a second copy of any control on screen**:

1. Describe a change spanning four components; watch the plan, prune it, watch it build with the
   run header always visible and a heartbeat that stops when the stream stops.
2. Attach a design mock; `@` a component and a project doc; send.
3. Ask it to look at the result on a phone viewport; get a screenshot **and** findings back.
4. Accept — and still be able to read the whole conversation, including step 1, afterwards.
5. Ask it to write the project docs; answer its questions rather than correcting its guesses; add a
   doc of your own invention and have the next build actually use it.
6. Close the editor, reopen it, and find the thread.

Measured, not felt: **controls live at once ≤ 4**; **zero duplicated actions across surfaces**; every
mocked state driven live at 400px and expanded, in both themes (BLD-010).

## Deliberately out of scope

- **What the agent builds.** Phase 55.
- **The preview canvas and the change-review document.** Both work. BLD-003 and BLD-009 change who
  owns their buttons, not what they render.
- **Markdown rendering inside the thread.** Tempting, and a rabbit hole. Prose is prose until
  something measured says otherwise.
- **A browsing agent.** BLD-014 screenshots a URL; it does not click through a site, fill a form or
  follow a flow. Different product, different threat model.
- **Reading the user's filesystem.** Attachments are handed over deliberately. No folder access, no
  globbing, no watching.
- **The experimental-flag banner.** Honest, and it stays — but it moves to the panel header where it
  stops competing with the task.

## Open decisions — Richard's calls

Carried from the design review; **none of them block starting BLD-001**, and each is named again in
the task that needs it.

| # | Question | Assumed answer | Task |
|---|---|---|---|
| Q1 | Inferred scope, or an explicit override control? | Inferred, with a one-line override in the agent's first sentence | BLD-001 |
| Q2 | Threads in `.noodl/` or in git? | `.noodl/ai-threads/` — machine records, not prose, should not land in a PR | BLD-006 |
| Q3 | Does the docs interview block drafting, or run alongside it? | Blocks — ask, then draft. The alternative reproduces D8 | BLD-008 |
| Q4 | Which search backend, and who pays for the key? | Undecided; one editor-side provider, key in AI settings | BLD-015 |
| Q5 | Is a PDF dependency worth it? | Undecided — `pdfjs-dist` is not small and PDF is the least-used attachment kind | BLD-013 |
| Q6 | Should "look at it" run automatically after every apply? | A one-click offer on the receipt, not a default (~8s + a Chrome launch per apply). Doctrine §11 argues the other way | BLD-014 |
