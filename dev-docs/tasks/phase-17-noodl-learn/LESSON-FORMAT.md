# The Noodl Lesson Format

**Status:** v1 (LEARN-001). This is the format LEARN-002 authors the curriculum
against. Changing it after curriculum exists means rewriting lessons, so it is
designed to be stable — additions are cheap, changes are expensive.

**Audience:** curriculum authors. You do **not** need to be a programmer or edit
any editor source. A lesson is a single JSON file plus its media.

> ⚠️ **Validation with a real non-programmer author is still pending.** This
> spec and its compiler are implemented and tested, but the task's success
> criterion "a non-programmer can author a simple lesson from the format
> documentation alone" must be checked with an actual learning designer before
> LEARN-002 commits to authoring 10–15 lessons. Treat v1 as proposed-and-working,
> not yet field-validated. Feedback from that session may add fields (it should
> not need to change existing ones).

---

## 1. What a lesson is

A lesson is an ordered list of **steps** shown to a learner working inside the
editor. Each step is either:

- a **card** on the timeline at the bottom of the editor (the default), usually
  with a **task** the learner must actually perform — the editor watches their
  project and advances automatically when they do it; or
- a **popup**: a modal with no card, for an intro or an outro or a pure
  explanation with a *Next* button.

A lesson lives in its project as a file named `lesson.json`, alongside the
project and its media (videos, images). The old hand-authored `lesson.html`
format still runs (the 8 legacy lessons use it) but new lessons should use this.

---

## 2. The file

```json
{
  "format": "noodl-lesson@1",
  "title": "Noodl Basics",
  "description": "Build your first app and learn how nodes fit together.",
  "steps": [
    { "kind": "popup", "body": "Welcome! ...", "media": { "type": "video", "src": "intro.mp4" } },
    {
      "title": "Select the Start Page",
      "body": "In the **Components** panel, click **Start Page**.",
      "media": { "type": "video", "src": "select-start-page.mp4" },
      "completeWhen": [ { "activeComponentEquals": "/Start Page" } ]
    }
  ]
}
```

### Lesson fields

| Field | Required | Meaning |
|---|---|---|
| `title` | recommended | The lesson's name. |
| `description` | optional | One-line summary, shown in the lesson list. |
| `completionBadge` | optional | Badge awarded when the lesson is completed. |
| `format` | optional | `"noodl-lesson@1"`. Records which format version this is. |
| `steps` | **yes** | The ordered list of steps (at least one). |

### Step fields

| Field | Required | Meaning |
|---|---|---|
| `title` | for cards | Short imperative shown on the timeline card, e.g. "Create a Group". |
| `body` | optional | Fuller instructions shown in the popup (Markdown — see §4). |
| `media` | optional | A `video` or `image` shown in the popup (§5). |
| `kind` | optional | `"card"` (default) or `"popup"` (modal-only, no card). |
| `completeWhen` | optional | Conditions that auto-advance the step (§3). Omit for a manual *Next* button. |
| `actions` | optional | Editor side-effects when the step opens (§6). |
| `suggestedNodes` | optional | Node types to surface in the node picker during this step. |
| `disableIcons` | optional | Toolbar icons to hide during this step. |
| `width` | optional | Fixed card width, e.g. `"320px"`. |

---

## 3. `completeWhen` — how the editor knows the learner did the task

`completeWhen` is a list of **conditions**. The step completes and advances only
when **all** of them hold at the same time. If you omit `completeWhen`, the step
shows a *Next* button instead and the learner advances manually.

Conditions observe the learner's **project** — the nodes they placed, how they
connected them, which component is open — never the pixels on screen. That is
what keeps a lesson working when the editor's UI changes.

Each condition is one object with exactly one "verb":

| Condition | Holds when… |
|---|---|
| `{ "node": "<path>", "hasType": "Group" }` | the node at `<path>` is a Group. |
| `{ "node": "<path>", "hasLabel": "Header" }` | the node's label is "Header". |
| `{ "node": "<path>", "hasPort": "width" }` | the node has a port named "width". |
| `{ "node": "<path>", "exists": true }` | a node at `<path>` exists (`false` = does not). |
| `{ "node": "<path>", "isVisualRoot": true }` | the node is the app's visual root. |
| `{ "node": "<path>", "hasParams": ["a","b"] }` | the node has all those parameters set. |
| `{ "node": "<path>", "paramsEqual": { "align": "center" } }` | those parameters have those values. |
| `{ "connection": { "from": "<path>", "to": "<path>", "fromPort": "x", "toPort": "y" } }` | those two ports are connected. |
| `{ "metadata": "key:subkey", "equals": <value> }` | project metadata `key.subkey` equals `<value>`. |
| `{ "previewRouteEquals": "/Home" }` | the preview is showing route `/Home`. |
| `{ "activeComponentEquals": "/Start Page" }` | the component open in the canvas is `/Start Page`. |

### Node paths

A path points at a node inside a component. Read it left to right:

```
Start Page:#My Group:%Text
└ component  └ child by  └ its child
   name        label       by type
```

- The first segment is a **component name** (e.g. `Start Page`, or `/Home`).
- `#Name` selects a child by its **label**.
- `%Type` selects a child by its **node type** (e.g. `%Group`).
- A bare number selects a child by **position** (`0` = first).

Matching is case-insensitive. Example: `App:#Card:%Text` means "inside component
*App*, the node labelled *Card*, its child that is a *Text* node".

> Tip: prefer `#label` paths. Ask the learner to give a node a specific label as
> part of the task, then match on it — it is the most robust way to identify a
> node the learner created.

---

## 4. `body` — Markdown

`body` is Markdown, so instructions read as prose and stay separate from logic.
Supported: `**bold**`, `*italic*`, `` `code` ``, `[links](https://…)`, `#`–`####`
headings, `- ` bullet lists, `1. ` numbered lists, and blank-line-separated
paragraphs. HTML in prose is escaped, so a stray `<` can never break the step.

---

## 5. `media`

```json
"media": { "type": "video", "src": "step-03.mp4", "loop": true }
"media": { "type": "image", "src": "diagram.png" }
```

`src` is relative to the lesson file's folder. Videos autoplay muted and loop.

---

## 6. `actions` — nudging the editor

Run when the step opens, to set the scene:

| Action | Effect |
|---|---|
| `{ "selectComponent": "/Home" }` | open a component in the canvas. |
| `{ "selectNode": "<nodeId>" }` | select a node. |
| `{ "navigatePreview": "/Home" }` | navigate the preview to a route. |

---

## 7. A complete tiny lesson

```json
{
  "format": "noodl-lesson@1",
  "title": "Your first Group",
  "description": "Place a Group node and give it a label.",
  "steps": [
    {
      "kind": "popup",
      "body": "## Welcome\nIn this lesson you'll place your first node. Click **Next** to begin.",
      "media": { "type": "video", "src": "intro.mp4" }
    },
    {
      "title": "Add a Group",
      "body": "Double-click the canvas and add a **Group** node.",
      "suggestedNodes": ["Group"],
      "completeWhen": [ { "node": "App:%Group", "exists": true } ]
    },
    {
      "title": "Label it \"Card\"",
      "body": "Select your Group and set its **label** to `Card`.",
      "completeWhen": [ { "node": "App:%Group", "hasLabel": "Card" } ]
    },
    {
      "kind": "popup",
      "body": "🎉 That's a node! Click **Exit lesson** to finish.",
      "media": { "type": "image", "src": "done.png" }
    }
  ]
}
```

---

## 8. For engineers: how it runs

The compiler (`packages/noodl-editor/src/editor/src/models/lessonformat.ts`)
lowers a manifest into the same per-step internal representation the legacy HTML
reader produces, so the whole runtime — step rendering, media loading, and the
completion evaluator (`views/lessons/lessonevalconditions.ts`) — is shared
between old and new lessons. `LessonModel.fetch()` picks the reader by file
extension / content sniff. Authors never see the internal representation.

The friendly conditions in §3 compile 1:1 onto the evaluator's internal
`LessonCondition` vocabulary; the evaluator reads project/graph state only, and
is unit-tested in `tests/lessons/`.
