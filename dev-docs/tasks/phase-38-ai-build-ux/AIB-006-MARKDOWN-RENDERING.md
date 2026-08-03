# AIB-006 — The assistant's words render as markdown

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🟠 High (cheap, and it is the first thing a new user sees) |
| **Difficulty** | 🟢 Easy |
| **Recommended executor** | 🟢 Sonnet |
| **Prerequisites** | none |
| **Status** | ✅ **BUILT 2026-08-03** — both defects, both halves of defect 2. Criteria 3–5 tested; 1, 2 and 6 owed to live QA (core-ui has no jsdom). |

## What was built, and one thing the task did not anticipate

Defect 1: assistant turns render through `Markdown`; user turns stay plain text.
Chat-bubble proportions are a local `--markdown` modifier, **not** an edit to the
sheet the Docs panel shares, as the task asked.

Defect 2, both halves: `stripHtmlComments` runs before Remarkable, and the
template's 14-line comment becomes a visible `## How this file is used` section.

**Not anticipated: stripping cannot be unconditional.** `Markdown` has three
consumers, and one of them is `AiChatMessage` — the editor's AI chat. A model
explaining an HTML comment inside a code fence would have had its own example
silently removed, which is the same defect class the task exists to close,
introduced by the fix. Stripping therefore skips fenced blocks and inline code
spans.

**Streaming was not done.** The task offers it as "related and worth doing here";
it needs `ScopingSession` to emit partial text, which is a change to the session's
contract rather than to this step, and it belongs with AIB-002's work on making a
run legible.

### The trap the task listed that is real, and unaddressed

`dangerouslySetInnerHTML` with `html: true` over model-authored content is an XSS
surface, and doc bodies are model-authored now. Stripping comments does not touch
it. It belongs in AIB-009 and is not fixed here.

## Objective

Every surface where the assistant speaks, and every surface where a project document is previewed,
renders markdown as markdown.

Two independent defects, same class, both verified.

---

## Defect 1 — the scoping conversation renders raw markdown

> *"I described the app I wanted with the project creation wizard, that worked fine except the
> assistant answers weren't formatted markdown, just pure markdown."*

### The mechanism

[`ScopingStep.tsx:69-78`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/ScopingStep.tsx#L69-L78):

```tsx
{messages.map((message, index) => (
  <div key={index} className={…}>
    {message.text}
  </div>
))}
```

A raw text node. The model writes `## Pages`, `- **Login**`, and the user reads `## Pages` and
`- **Login**`.

`Markdown` already exists at
[`@noodl-core-ui/components/common/Markdown`](../../../packages/noodl-core-ui/src/components/common/Markdown/Markdown.tsx)
and is used by the Docs panel. `ScopingStep` is in the same package — no import barrier.

### The fix

Render assistant messages through `Markdown`. Keep user messages as plain text (a user who types an
asterisk means an asterisk).

Check `Markdown.module.scss` renders sanely inside a narrow chat bubble — it was styled for a
full-width document pane. Constrain heading sizes and list indentation in a chat variant rather than
editing the shared stylesheet.

**Related and worth doing here:** the conversation has no streaming — a turn shows `Thinking…`
([line 80](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/ScopingStep.tsx#L80))
until the whole reply lands. The props are already shaped for it (`isBusy`, `messages`); if the
scoping session can emit partial text, streaming the assistant's reply costs little and removes the
longest unexplained pause in the wizard.

---

## Defect 2 — CONVENTIONS.md previews as a blank page

> *"I made the docs for the project in the 'build' docs panel. They look great except
> 'CONVENTIONS.md' which seems to have raw content, but the preview just shows a blank page."*

### The mechanism — verified by rendering the real file

[`Markdown.tsx`](../../../packages/noodl-core-ui/src/components/common/Markdown/Markdown.tsx) uses
Remarkable with `html: true` and injects via `dangerouslySetInnerHTML`.

Remarkable terminates an HTML **comment** block at the first blank line, not at `-->`.
[`templates.ts:66-99`](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/templates.ts#L66-L99)
opens CONVENTIONS.md with a 14-line comment containing **three blank lines**. So Remarkable emits
the `<!--` and then treats the following paragraphs as markdown — and the closing `-->` never
survives to the output at all.

Run against Richard's actual file
(`NodeGX test projects/ai-test/docs/CONVENTIONS.md`, 3081 chars):

```
raw length     3081
html length    3631
occurrences of <!--   1
occurrences of -->    0     ← never closed
visible before the comment:  "<h1>Conventions</h1>"
```

The browser opens a comment and never closes it, swallowing the entire rest of the document. The
preview shows one `<h1>` and nothing else. That is the "blank page".

Checked across all four generated docs — **only CONVENTIONS.md is affected**, because it is the only
template whose comment spans a blank line:

| File | `<!--` / `-->` in output | |
|---|---|---|
| BRIEF.md | 0 / 0 | fine |
| ARCHITECTURE.md | 0 / 0 | fine |
| decisions/000-initial-scope.md | 0 / 0 | fine |
| **CONVENTIONS.md** | **1 / 0** | **swallows the page** |

Which is exactly why Richard reported three docs looking great and one blank.

### The fix — do both halves

**Half 1: make the renderer safe.** Any doc anyone writes can contain a multi-paragraph HTML
comment, and this must not be able to blank a page again. Options, in order of preference:

1. **Strip HTML comments before rendering** — the preview has no use for them, and it is one
   regex applied to the source, not the output. Note the DocsPanel's raw/edit view must keep them.
2. Sanitise the rendered HTML and drop unbalanced comment openers.
3. Turn off `html: true` — rejected: the docs legitimately use inline HTML elsewhere.

Prefer 1, and cover it with a test that renders a comment containing a blank line and asserts the
following heading is present in the output.

**Half 2: fix the template.** A 14-line HTML comment as the first thing in a file the *user* is
meant to read and edit is poor design regardless of the renderer. It is instructions-to-the-agent
sitting inside the user's document. Either compress it to a comment with no blank lines, or —
better — move the guidance out of the comment and into visible prose under a `## How this file is
used` heading, since it is genuinely useful to the human too.

The `(example)` rules have a real purpose (see `renderConventions` — they keep the file honest about
what was actually agreed) and should stay, but they are currently invisible for the same reason
everything else is.

---

## Acceptance criteria

1. Assistant messages in the wizard render headings, bold, lists and code.
2. User messages are not markdown-rendered.
3. Rendering a document containing an HTML comment with a blank line shows all content after it.
4. All four generated docs preview fully in the Docs panel — asserted against real generated output,
   not a fixture.
5. The raw/edit view still shows the comments.
6. **Live**: run the wizard, then open Docs → CONVENTIONS.md.

## Traps

- Two `Markdown` consumers exist; changing the shared component affects the Docs panel. Test both.
- `dangerouslySetInnerHTML` with `html: true` on model-authored content is an XSS surface. Doc bodies
  are model-authored now. Worth raising in AIB-009 even if out of scope here.
- Remarkable is old and unmaintained. Replacing it is not this task, but note the version and
  whether a newer markdown-it handles the comment case correctly — if the migration is small, it may
  be the better fix.
