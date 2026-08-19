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

## 🟡 Status — 2026-08-19 (session 8): the reading half is built, driven against the LIVE platform

`2d3960a7`. **AC1, AC2, AC3 and AC8 close. AC5 half-closes. AC4, AC6 and half of AC7 are the
writes, and they wait on D5.** A thread opens in place on both surfaces, renders every post, and
was read from the editor against `community.nodegx.io` — which turns out to be **serving**.

| AC | State | Where |
|---|---|---|
| 1 — opens in place on both surfaces, `openExternal` no longer primary | ✅ | `useCommunityThread`, one hook for both. 🔴 Found: the row handed back a field the platform has never sent |
| 2 — every post, in order, author/time/accepted | ✅ | `threadDetailView`; 3 posts asserted by walking the element tree |
| 3 — `Block[]`, no `dangerouslySetInnerHTML`, unknown kinds skipped visibly | ✅ | `readPostBlocks` **validates rather than casts**; 9 files checked with comments stripped |
| 4 — reply from the editor | 🔴 **D5** | Not built. A *labelled* hand-off ships in its place, and says where an answer goes |
| 5 — attached fragments render | 🟡 | They render, and the **pull seam** exists (`pullFor`, drawn-and-refused). 🔴 NAT-015 cannot be built — see below |
| 6 — accept an answer | 🔴 **D5** | A write. Not built, not guessed at |
| 7 — round trip, both directions | 🟡 **half** | Web → editor **driven for real**. Editor → web is AC4 |
| 8 — offline states, neither reading as "no replies" | ✅ | Both arms **driven with the network genuinely cut**, not stubbed |

Gates on the committed tree: `typecheck:editor`, `typecheck:editor-tests` clean · `test:main`
**268 suites / 4350 tests / 0 failures** · core-ui jest **28 / 521 / 0**. 97 new tests,
**verified red 12 of 12**.

### 🔴 `externalId` was declared by the client and the platform has never sent it

`ForumThread.externalId` was a Discourse-era leftover. `mirrorThreads` returns `MirrorThread`,
which has no external identifier of any kind — and **both surfaces built their browser hand-off
out of it**, so every thread anybody clicked opened `community.nodegx.io/bench/undefined`. The web
route's segment is the thread's uuid, so `id` was right all along.

**Second field in this client to outlive the platform that sent it**, after the `{forum: 'absent'}`
arm, and it failed identically: both sides compile, TypeScript checks the declaration against its
*consumers* and never against the wire, and the value arrives `undefined` rather than as an error.
⚠️ The first was found by curling a live route; this one by looking for the field on the platform
because a task needed it. **Neither was found by a test, and nothing would find the third.**

### 🔴 The platform SERVES — on an older build, and both halves of that matter

`https://community.nodegx.io/api/v1/community/threads` answers **200** with two real threads
Richard posted from the editor this morning. The task files, `communityorigin.ts` and the last four
handovers all say the platform is deployed nowhere. ✅ **This task's read half was therefore driven
end to end against the real thing** rather than a stub — which is how the next two findings turned
up.

🔴 **But the handovers are not wrong, and the first draft of this section said they were.**
Measured in the same session: `/api/v1/community/people`, `/university` and `/rfps` — NAT-006's ten
endpoints, committed s6 as `126a0b6` — **all 404**. The box is running a build from *before* this
phase's work. *Live* and *undeployed* are claims about **different populations**: the running
deployment, and the commits since it. A 200 from a route that predates the deployment does not
refute a statement about the routes that came after it.

✅ **So: read paths that predate the deployment can be driven for real** — `/me`,
`/community/home`, `/community/threads`, `/bench/threads/:id`, which is exactly the set this task
needed. 🔴 **NAT-008/009/010/011 must not assume NAT-006's endpoints answer.** They exist in the
repo and 404 in production, and a surface built against them will read as broken for a reason that
is not in its own code.

⚠️ And the live wire really does carry **`2026-08-19 11:19:27.206885+00`** — NAT-006's pooled-
connection finding, in production, on the field every row and every post renders. `communityMeta`
already takes both spellings; a client that had normalised to ISO would have been three hours out
on a European laptop and exactly right in CI.

### 🔴 A node question renders its port list TWICE — and it is not this editor's defect

The post body says the ports in prose (*"Live values I chose to share:"*, `formatShareAttachment`)
and the `node_excerpt` attachment says the same ports again as structured rows. Eleven ports, twice,
one screen. `nodeartifact.ts` predicted the *shape* of this — *"a structured payload is, by
construction, a second path"* — and made the structure subordinate so the two would **agree**. They
do agree. Nobody asked what a renderer drawing **both** would look like.

🔴 **The web does it too** — measured, not assumed: the same thread at `/bench/<id>` contains
`opacity` twice and `transformScale` twice. So this editor is mirroring faithfully, which is D14's
whole point, and **fixing it here alone would make the editor disagree with the web** — the one
thing D15 says a mirror may not do. ⚠️ Left unfixed deliberately. It is one decision on the
composer/renderer pair and it belongs to whoever owns both.

### ⚠️ D8 decided the cache, and it decided it by being open

AC8 wants an opened thread readable offline. The obvious store is `userData`, beside the session
token — and that is **D8**, *"caching a member directory to every laptop is a privacy decision"*,
made by whoever wrote the convenient thing. A post body is a stranger's words about somebody's
project, and a copy on disk outlives both the thread and the moderation that hid it.

✅ So the cache is **in memory, this editor session**, and AC8's honest scope is: within one
session, a thread you have opened stays readable when the network drops and says how old the copy
is. Nothing has to move when D8 lands — the input is already a `{thread, at}`.

### ✅ The drift guard is the compiler

`PostBlock` is declared twice — `postbody.ts` and core-ui's `postBlocks.ts` — because core-ui
cannot import the editor. Two declarations of one model is the arrangement this phase keeps paying
for. `threadview.ts` holds an **assignability assertion in both directions**, so `typecheck:editor`
fails the day either side grows a variant the other lacks. 🔴 A grep could not catch it and a
runtime spec could not either: both sides compile happily while disagreeing.

### What is left, and what it waits on

1. 🔴 **AC4 and AC6 need D5**, and D5 needs Richard. ✅ **One fact for the ruling, measured:** the
   platform **already accepts the editor's device-flow bearer token on `POST .../posts`** —
   `apiViewer` reads `Authorization: Bearer` and `answerThread` asks nothing further. So D5 is not
   *"can it work"*; it is *"should an identity-scoped token post, or does it need re-consent"*.
2. 🔴 **AC5's other half is NAT-015, and NAT-015 has no population** — see that file.
3. ⚠️ **AC7's second direction is AC4.** The first was driven for real.
4. ⚠️ **The rail was driven, and so was the launcher** — both densities, both themes, a real
   thread. What was *not* driven is a thread with an accepted answer, because no thread on the live
   platform has one yet.

---

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
5. Attached graph fragments **render in the editor**. *Pulling* one into your own project is
   **[NAT-015](NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md)** (was UNI-018, moved into this
   phase 2026-08-19). 🔴 **Build it in this session, on this renderer** — the two halves share a
   seam, and splitting them means a second session rediscovering it. The redaction trap below
   applies to both: rendering in is not a licence to send back out.
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
