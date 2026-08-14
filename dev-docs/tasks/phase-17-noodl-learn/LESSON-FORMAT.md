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

#### ⚠️ `%Type` takes the node's **type name**, not the name on the button

Every lesson carries two vocabularies and they are frequently different strings:

- **Prose** (`title`, `body`) must use the **display name** — what the learner
  reads in the node picker and on the canvas.
- **Conditions** (`%Type`, `hastype`) must use the **type name** — the internal
  identifier. `findNodeWithPath` matches `node.type.name`
  ([lessonevalconditions.ts](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts)),
  and `hastype` does the same.

> ✅ **You do not have to hold this in your head any more.** UNI-007 shipped a
> static check —
> [`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts),
> `verifyLessonManifest()` — which reads every `%Type` segment and every
> `hasType` in a manifest, classifies it against the catalog, and names the
> problem. Run it before shipping a lesson. It is the same check UNI-010 runs
> over an AI-authored bundle before it may install.

##### The real shape of the divergence

🔴 **Corrected 2026-08-14.** This section previously tabulated **nine**
divergences and named `Variable`, `Button` and `Text Input` among the nodes that
"use the same string for both". Both statements were wrong. Re-derived from
`node-catalog.json` (175 entries), there are **three classes**, not one list:

| Class | Count | What it is | What to do |
|---|---|---|---|
| **Plain divergence** | **103** | The display name is not any type name and maps to exactly one | Use the type name — the checker suggests it |
| **Ambiguous** | **4** | The display name maps to **two** type names | 🔴 Write the type name you mean. The checker **rejects and does not substitute** |
| **Shadowed** | **6** | The string **is** a real type name — of a **deprecated** node — while the node the learner actually places carries it as a *display* name | 🔴 Use the live type name |

**The four ambiguous names:**

| Display name | Could mean |
|---|---|
| Array | `Collection` *or* `Collection2` |
| Object | `Model` *or* `Model2` |
| Component Object | `Component State` *or* `net.noodl.ComponentObject` |
| Parent Component Object | `Parent Component State` *or* `net.noodl.ParentComponentObject` |

An ambiguous name is not merely unreachable — it can resolve to the **wrong one
of two**, which is a lesson that grades the wrong node and says nothing. That is
why the checker refuses to guess for you.

**The six shadowed names — the dangerous class**, because "does this type exist?"
returns **true** for every one of them:

| Written in a condition | Actually names | The node the learner places |
|---|---|---|
| `Variable` | the deprecated Variable | **`Variable2`** |
| `Button` | the deprecated Button | **`net.noodl.controls.button`** |
| `Text Input` | the deprecated Text Input | **`net.noodl.controls.textinput`** |
| `Checkbox` | the deprecated Checkbox | **`net.noodl.controls.checkbox`** |
| `Radio Button` | the deprecated Radio Button | **`net.noodl.controls.radiobutton`** |
| `Cloud Function` | the deprecated Cloud Function | **`CloudFunction2`** |

`Variable` is in the curriculum spine (CURRICULUM-DESIGN D3 — *"Counter first,
Variable revealed in L6"*), and `Button` and `Text Input` appear in any beginner
lesson, so this class is not a corner case.

**The nine originally tabulated** are all still true, and are the ones a
curriculum author meets first:

| Prose says (display name) | Conditions must say (type name) |
|---|---|
| Repeater | `For Each` |
| Repeater Item | `For Each Actions` |
| Static Array | `Static Data` |
| Delay | `Timer` |
| Insert Object Into Array | `CollectionInsert` |
| Record | `DbModel2` |
| Page Router | `Router` |
| Array | ⚠️ **ambiguous** — `Collection` *or* `Collection2` |
| Object | ⚠️ **ambiguous** — `Model` *or* `Model2` |

`Group`, `Text`, `Image`, `Circle`, `Condition`, `Expression` and `Counter` do
use the same string for both.

The failure is silent: a condition naming a display name matches nothing, and the
learner is told they have not done a step they have in fact done.

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
