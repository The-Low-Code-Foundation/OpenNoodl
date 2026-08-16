# UNI-011 — the community, mirrored in the editor

**Surface:** editor + bridge · **Tier 2** (needs UNI-001's account and UNI-009's forum to exist
first) · **Effort:** M/L · 🟡 **SLICE 1 BUILT 2026-08-16 — the transport and the boundary.**
D14, D15 and D16 all ruled; nothing is waiting on a decision.

> ## Slice 1 — what was built, and the thing it found first
>
> 🔴 **D14's API did not exist, and no task owned it.** D14's second consequence is explicit —
> *"the API is a deliverable, not an implementation detail"* — and until 2026-08-16 the platform
> had **one** route under `src/app/api`, the Discourse webhook receiver. Every other surface was
> a Next.js page calling `src/lib` in-process. **There was nothing for a second client to be a
> client of**, so this task's AC1 (*"from the same API"*) was unbuildable as written.
>
> The consequence is the shape this phase keeps finding by other routes: `communityVisibility()`
> (D15) and `readThreshold()` (D16) are careful, controlled, well-specced pure functions whose
> **only callers were their own test files** — and D15's own header says the rule must live
> *behind the API* or the two clients drift. It lived behind nothing. *Build the caller*,
> seventh instance.
>
> **Platform** (`nodegx-community` `7193f92`): five routes under `/api/v1` — `me`,
> `me/assignments`, `community/home`, `community/threads`, `community/threshold`. **462 specs /
> 19 files** (baseline 442/18), `tsc` clean, `next build` **21 routes** (was 16), **four
> controls**, **14/14 driven consequences written first**.
>
> **Editor** (this repo, `f7b0b280`): `models/community/communityapi.ts` and
> `models/community/postbody.ts`, **55 specs**, `test:main` **223 suites / 3458 specs**
> (221/3403 without them), eslint clean.
>
> ⚠️ **Not built: any view.** No rail entry, no surface, nothing a user can see — deliberately.
> D16's ship order is the opposite of its build order and this task already said so: *build the
> mirror first, surface it last.* AC2, AC3 and the four editor-only features are slice 2.
>
> ⚠️ **Nothing has talked to a real platform.** `community.nodegx.dev` is unregistered; the
> drive ran against `next dev` on localhost.

> **D14** ([RULINGS.md](RULINGS.md)): the public web platform is the **canonical** community; the
> editor is a **second client of the same API**, showing the same content. Editor-only features are
> the reason to transition, not a different feature set.
>
> 🔴 **This task does not build a forum.** UNI-009 buys one (Discourse, hosted, SSO). This is a
> client for it. Anything here that starts to look like forum software is a defect — see UNI-009's
> "bought, not built".

## Premise

Richard's framing, 2026-08-15, and it is the design:

> *"There's no reason why you can't then transition into using the editor when you start using
> NodeGX properly. The front-end public-facing part can be MIRRORED in the editor, if the editor is
> calling the same backend API. The editor can have some editor-only features that make it
> attractive to transition to. The web retains the advantage of letting anyone participate whether
> they're using the editor or not."*

The immediate goal behind it is Richard retiring the Discord, which has gone quiet, and onboarding
new users into a community they meet **without being told it exists or having to join anything**.

⚠️ **The diagnosis matters, because it changes what "success" looks like.** Discord is not quiet
because it is Discord — it is quiet because a young community has low message volume, and chat
renders low volume as an empty room every time anyone looks. The same eight conversations a month,
as threads, read as a reference library. **A forum flatters low volume; chat punishes it.** So the
measure of this working is *not* message rate. It is whether a question gets an answer, and whether
the answer is still findable six months later.

🔴 **The corollary is a thing this task must not try to do.** "Shoot the shit" is what a forum does
worst — nobody starts a thread to say hello. The hangout is the **weekly call**, which Richard
already runs. A `#lounge` category and the events strip carry the social half; a chat tab would just
be a quieter Discord, and it is out of scope for a second reason (D15, and phase 68's L5 posture).

## Scope (v1)

### The mirror — same content, native chrome

- **Discussions**: thread list, filters, search, the unanswered queue. Rendered from the API as
  data, in the editor's own components.
- **Events**: next call with countdown and add-to-calendar; a live state while it runs; the replay
  library beneath it, newest first (UNI-009's list).
- **Your standing**: points, badges, progress toward the next tier (D3, D4). 🔴 **Not a leaderboard
  on the home surface** — at this community's size a leaderboard demotivates everyone outside the
  top three.
- **Showcase / shipped this week**: recently published prefabs (UNI-005's shelf) and deploys.
- **Reading works signed out**, because it does on the web (D14 consequence 4).

### The editor-only half — the reason to transition

These are the features that justify the mirror existing at all. **If a feature works just as well in
a browser, it does not belong here.**

1. **Ask about this node.** From the node context menu or a warning: a composer prefilled with node
   type, the exact warning text, NodeGX version, OS, and an optional **redacted graph excerpt**
   (types and wiring; every string, parameter and record replaced). The biggest reason people do not
   post is that writing a good question is work; this does most of it, and answers improve because
   the context is right.
2. **Share what you're seeing.** A capture of the running preview plus the **live port values**
   behind it, both redactable before anything sends. ✅ Both halves already exist:
   [`livePreviewCapture.ts`](../../../packages/noodl-editor/src/editor/src/views/SandboxSurface/livePreviewCapture.ts)
   calls `capturePage()` on the preview `<webview>` and the bytes never leave the machine; live port
   values come off the same observe relay that feeds the Provenance panel. This is the single
   feature no browser-based forum can copy.
3. **Search before you post.** Search existing threads as the title is typed, and offer the
   in-editor AI a pass first. If the AI answers, offer to post the exchange anyway — that is how the
   corpus grows on questions nobody bothered asking twice, and it is the retrieval flywheel UNI-009
   already reserves the licensing for.
4. **"Others hit this too."** A warning in the Problems panel that matches known threads shows a
   quiet inline link. This pays back the large majority who read and never post.

## The security boundary — the load-bearing part of this task

🔴 **The editor's renderer is `nodeIntegration: true, contextIsolation: false`**
([`main.js:406`](../../../packages/noodl-editor/src/main/main.js#L406)), and **so is the launcher** —
it is `pages/ProjectsPage` inside the *same* `BrowserWindow`, not a separate window. Moving this
surface to the launcher buys nothing here.

This phase has already been bitten by exactly this sink: a lesson body containing a `javascript:`
URL compiled into a live anchor in that renderer — arbitrary code with filesystem access
([RULINGS.md](RULINGS.md), "the second amendment"). That was content from a bundle a user *chose* to
install. **Forum posts are the same shape from strangers, unbounded, and changing daily.** Escaping
does not help; the payload was a scheme, not markup.

```
NATIVE (app renderer)                 │  SANDBOXED (webview or sanitiser)
──────────────────────────────────────┼──────────────────────────────────────
thread lists, titles, tags, counts    │  post bodies, replies, quotes
the composer + capture sheet          │  Discourse's own composer / mod UI
events, unread counts, points         │  anything containing a link
rendered from JSON as DATA            │  anything a stranger authored
```

**Two survivable implementations — pick one in the design, do not mix:**

| | How | Cost |
|---|---|---|
| **A. `<webview>` island** | Post bodies render in a sandboxed `<webview>` — `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, own partition, strict CSP, `will-navigate` intercepted. The recipe already ships in [`legal-window.js`](../../../packages/noodl-editor/src/main/src/legal-window.js) | Chrome/content seam is visible; styling the island to match is fiddly |
| **B. Raw markdown + sanitiser** | Request the **unrendered** markdown from the API and render it ourselves through the scheme allow-list `lessonverify` already ships | Fully native look; we own the sanitiser forever, and it must be tested as a security boundary, not a formatter |

⚠️ **B is more attractive and more dangerous, and the trap has a name in this phase.** A sanitiser
read on its own terms looks complete — that is the exact failure mode the "build the caller" method
has now caught six times here. If B is chosen, its tests must include a **known-bad corpus** that
the sanitiser is proved to reject, not only a known-good corpus it is proved to pass. Two
instruments that never disagree have not been checked.

### ✅ CHOSEN 2026-08-16 — **B's transport, with B's output changed**, and the change is the point

`postbody.ts` requests the unrendered markdown and parses it to a **data model** — `Block[]`, which
**has no field that could hold markup**. It never emits an HTML string at any stage: not escaped,
not sanitised, not allow-listed. A view walks the model and builds React elements, whose text
children the runtime escapes *because they are text*. So there is nothing for a future edit to hand
to `innerHTML` even by mistake, and AC1's *"proved by the chosen boundary's test, not by
inspection"* is satisfiable — a sanitiser's safety is always an argument about its own internals.

🔴 **A live finding in the first draft of that file, and it is the reason this section is worth
reading rather than skipping.** `[x](&#106;avascript:alert(1))` reaches `safeLessonUrl` with **no
scheme** — `&` fails the scheme test — so it is classified *relative* and passed through verbatim.
Harmless **only because React sets `href` with `setAttribute` and nothing decodes the entity**. Emit
the same string into an HTML string and the parser decodes `&#106;` to `j` before the URL is
resolved, and it is `javascript:alert(1)`. ⚠️ **The boundary's safety rested on a property of its
consumer — which is the exact class of argument the model design was chosen to eliminate.** Closed
by `safeCommunityUrl`, which decodes the *probe* to a fixed point and asks the shipped allow-list
about that, while still emitting the raw text (markdown is not HTML; `&amp;` in a markdown URL is
literally an ampersand-a-m-p).

⚠️ **Found by the corpus entry that looked most theoretical.** The cheapest-looking case was the one
carrying the assumption — the third amendment's line, in a new place.

✅ **And what was measured about the other option, so it is not re-litigated from memory:**
`renderMarkdown` in `lessonformat.ts` — the lesson renderer whose output reaches
`dangerouslySetInnerHTML`, and the thing option B invites reusing — was run over the **same
fifteen-payload corpus by the same instrument**, and it **holds on every case**. 🔴 **This is not a
defect report**, and recording it as one would be the over-claim this phase warns about as loudly as
the under-claim. The objection is structural: the lesson renderer is safe because two passes run in
a particular order, and that property can be removed by an edit while every test still passes.

## Acceptance criteria

> **Where slice 1 leaves these (2026-08-16).** 🟡 AC1 second half **met**; AC1 first half is
> unmeetable until a forum exists. 🟡 AC4's read-signed-out half **met at the API and proved by a
> drive**; its sign-in half needs UNI-001's issuer. 🟡 AC5 **met in shape** — `poll()` exists, owns
> no clock, and the client has no method that writes. 🟡 AC6 **met at the API**, unmet at the
> surface, because there is no surface. 📋 AC2 and AC3 are untouched: they are the editor-only
> half, which this task's own sequencing note puts second.

1. A thread visible on the web is visible in the editor, from the same API, with the same content —
   and **no post body is ever rendered as HTML in the editor's own renderer** (proved by the chosen
   boundary's test, not by inspection).
   - 🔴 **The first half cannot be met by any amount of editor work**: there is no forum. UNI-009
     AC1 is untouched, Discourse is bought rather than built, and nobody has bought it. What is
     built is the route that serves threads and — importantly — **reports their absence as a
     typed state rather than as an empty list**, because *"there is nothing here to mirror yet"*
     and *"the community is quiet"* want opposite things from a client.
   - ✅ **The second half is met**: `parsePostBody` cannot produce markup, and a fifteen-payload
     known-bad corpus proves it, with a known-firing control beside it.
2. Right-clicking a node offers "Ask about this node"; the composer opens prefilled with type,
   warning, version and OS; the graph excerpt is **off until enabled**, and what it will send is
   **shown before it sends**.
3. A capture from the running preview can be attached with per-port share toggles, defaulting to
   **off** for anything record-shaped. Nothing leaves the machine before the user posts.
4. Reading works **signed out**. Signing in adds posting, points and the unanswered queue; signing
   out kills both sessions (UNI-009 AC1).
5. The unread count is produced by an **editor-outbound poll**. No inbound connection, no socket, no
   OS notification.
6. With the community at zero threads, the home surface still renders real content — events,
   replays, release notes — and never shows an empty state as its primary content.

## Not in v1

- **Chat and DMs.** Discourse ships chat and it is tempting as the Discord replacement, but private
  adult↔minor messaging is a safeguarding surface D10 never covered and D15 has not ruled on.
- **In-editor moderation.** Moderate in Discourse's own UI; rebuilding flag queues is the
  "building forum software" trap.
- **Desktop/OS notifications.** A count on the rail entry is enough; an app that pings mid-build
  gets muted for good.
- **Posting rich media from the editor** beyond the capture sheet.
- **The LearnBook client** — that is phase 68's later tranche under the D13 amendment, not this task.

## Dependencies and the ordering that follows

| Needs | Why |
|---|---|
| **UNI-001** | the account and the OIDC session the mirror authenticates with |
| **UNI-009** | the forum being mirrored, its categories, and its API |
| **UNI-002** (soft) | points and badges; the mirror degrades to plain content without them |
| **UNI-005** (soft) | the prefab shelf feeding "shipped this week" |
| **phase 37** (soft) | ⚠️ scoped, **not built** — makes the launcher tab 0 so the community is reachable *without leaving a project*. 🔴 **Do not assume it.** Reachable today, better afterwards |

**Sequencing note.** Build order should be **the read-only mirror first, the editor-only features
second**. The mirror alone is testable against a live UNI-009 and proves the API contract; the
context features are where the effort is and they are worthless if the transport is wrong.

🔴 **And the ship order is the opposite of the build order.** D16 exists because the mirror is the
part that can do damage before it is ready: an entry point that opens onto a dead community is worse
than no entry point, and every user sees it. **Build the mirror first; surface it last.**
