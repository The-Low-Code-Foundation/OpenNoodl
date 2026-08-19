# NAT-007 — A thread you can actually answer

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | L |
| **Surface** | `editor`, `core-ui` |
| **Rulings** | ✅ D3 · 🔴 **D5 OPEN** (write auth) · 🔴 **D7 OPEN** (moderation) |
| **Depends on** | **NAT-005** (the shapes), **NAT-006** (posts endpoint exists but is unused by the editor) |
| **Flagship** | ⭐ This is the task the phase is named after |

## The job

Today: you right-click a node, choose *Ask about this node*, the question posts — and
[`AskAboutNodeDialog.tsx:353`](../../../packages/noodl-editor/src/editor/src/views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx)
opens your browser. The answer to the question you asked from inside the editor arrives somewhere
the editor cannot show you. The launcher lists the thread's **title** and
[`ProjectsPage.tsx:1325`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx)
sends you to Chrome to read it.

Make a thread a first-class editor object: open it, read every post, read the graph fragments
attached to it, and **reply without leaving**.

The platform half already exists — `/v1/bench/threads/[threadId]`, `.../posts` and `.../accept`
are built. This is almost entirely an editor task.

## Acceptance criteria

1. Clicking a thread in the launcher tab **or** the rail panel opens it *in place*. `openExternal`
   is no longer reachable from either as the primary action.
2. The thread renders **every post**, in order, with author, time and accepted-answer state — the
   whole conversation, not the opening question.
3. Post bodies render through `parsePostBody` → `Block[]`. 🔴 **No `dangerouslySetInnerHTML`, no
   exceptions.** Both surfaces live in the `nodeIntegration: true, contextIsolation: false` window;
   a community post is a string a stranger wrote. Any block kind the editor cannot render is
   **skipped visibly**, never passed through raw.
4. **Reply from the editor**, with optimistic state that is honest: a reply that fails to send says
   so and keeps the text. Losing somebody's typed answer to a network blip is worse than the
   browser hand-off this task replaces.
5. Attached graph fragments **render in the editor**. ⚠️ *Pulling* one into your own project is
   **UNI-018 and belongs to phase 67b** — render it, offer nothing more, and link the task.
6. Accepting an answer works from the editor if you are the asker (the endpoint exists).
   🔴 **D7 decides** whether report/flag ships alongside; the task does not guess.
7. The **round trip is driven end to end**: ask about a node from the editor → the thread appears
   in the editor → an answer posted from the *web* appears in the editor → a reply posted from the
   *editor* appears on the web. 🔴 Both directions, both clients. One direction proves half a bridge.
8. Offline: an already-opened thread states that it is showing a cached copy and when from; an
   unopened one states it needs the network. Neither renders as "no replies".

## Traps

- 🔴 **`AskAboutNodeDialog` publishes graph structure, and a port survives only if its *type* did.**
  Rendering an attachment in the editor is safe; do not let the render path grow an "edit and
  repost" affordance that would round-trip user content back out without going through the same
  redaction. Port names are user content whenever their type is.
- 🔴 **D5 blocks the reply path entirely.** `communitysignin.ts`'s device flow was scoped for
  identity. Posting from a desktop client with an identity-scoped token is a decision, not an
  implementation detail — and if it needs a re-consent step, that step is UI in this task.
- 🔴 **D15 applies to the thread view too.** A refused viewer who somehow holds a thread id gets
  nothing drawn — and the spec for that needs a permitted control beside it.
- ⚠️ **`postbody.ts` has a generated corpus** (`scripts/gen-postbody-corpus.mjs` on the platform).
  Use it as the editor renderer's fixture rather than hand-writing three blocks that happen to work.
- ⚠️ **A code popout outlives a document swap** in this editor. A thread view that hosts a code
  block and is then closed must not leave one behind.
- ⚠️ The rail panel is inside a project and the launcher tab is not. The same thread view has to
  work in a narrow rail and a wide page. Build it width-responsive or build it twice — and building
  it twice is how the two surfaces drift, which is the failure UNI-011 already paid for.
