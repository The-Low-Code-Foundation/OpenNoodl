# UNI-011 — the community, mirrored in the editor

**Surface:** editor + bridge · **Tier 2** · **Effort:** M/L · 🟢 **SLICES 1, 2a, 2b AND 3 BUILT.**
✅ **AC2, AC3 and AC5 MET and driven; AC1, AC4 and AC6 MET as far as the platform's data allows.**
🔴 **THE MIRROR IS SURFACED — D16 WAS REVERSED BY [D21](RULINGS.md#d21) on 2026-08-19** at Richard's
instruction: *"show the community tab immediately with no data, I'll start filling it with tutorials
and whatnot myself."* The rail entry is live and unconditional.

> 🔴 **The header below this line said, from 2026-08-16 to 2026-08-19, that *"everything still open
> in this task needs a forum or an issuer that does not exist."* Both halves stopped being true
> without this file being edited** — D19 built the forum on 2026-08-18 and UNI-001 E1 landed the
> issuer on 2026-08-19 — and the task went on reading as blocked for a day after it was not.
> ⚠️ *A blocking claim decays exactly as fast as the thing it names, and nothing re-checks it.*

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
> ⚠️ **Nothing has talked to a real platform.** The drive ran against `next dev` on localhost.
> *(As written on 2026-08-16 this said the host was unregistered. It resolves as of 2026-08-17 —
> `community.nodegx.io`, A → nexus-1 — but **nothing serves it**, so the sentence's point stands.)*

> ## Slice 2a — AC2 is BUILT and DRIVEN (2026-08-16, twenty-first session), editor `f73b1bd6`
>
> ✅ **AC2 closes.** The node context menu offers *Ask about this node*; the composer opens
> prefilled with type, warning, version and OS; the excerpt is off until enabled; and the string
> shown is the string sent. **31 new specs** (`nodeexcerpt`, `nodequestion`), `test:main`
> **225 suites / 3489 specs**, eslint clean, `tsc` still at its 31 pre-existing errors.
>
> ### 🔴 The finding: no payload in this editor had ever had to hide a PORT name
>
> ALPHA-007's project summary is a **histogram** — counts by bucketed type — so no port name has
> ever left this editor. AC2's excerpt is *"types and wiring"*, and wiring **is** port names.
>
> [`NodeGraphNode.getPorts()`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts)
> is `type.ports` ++ `this.ports` ++ `this.dynamicports`. The last two are user-authored by
> definition. The **first is user-authored too whenever the type is a component instance**,
> because a component's ports are whatever its `Component Inputs` node declares. So the rule
> composes with the type rule rather than sitting beside it: **a port name survives only when its
> node's type survived.** A node bucketed `<component>` or `<unknown>` publishes no port names.
>
> ✅ **`bucketTypeName` is exported and imported, not reimplemented.** ALPHA-007 already knew a
> component instance's type name is a component path. Two implementations of one privacy control
> is the arrangement where a fix lands on one of them.
>
> ### 🔴 The same helper, called two ways, means opposite things
>
> `bucketTypeName(name, null)` returns the type name **verbatim**. ALPHA-007's header names that
> branch and accepts it — defensible for a GitHub issue the reporter deliberately filed about a
> bug in our editor. Not defensible here, and **the branch is reachable**: the node library
> arrives asynchronously, which `getPorts()` documents at length. This module passes an **empty
> set** and gets `<unknown>`.
>
> ⚠️ **This is not recorded as an ALPHA-007 defect.** Its own comment names the case and takes
> the trade knowingly. Calling a documented, accepted trade-off a defect would be the over-claim
> this phase warns about as loudly as the under-claim — the `renderMarkdown` precedent from slice
> 1, in a new place. What *is* recorded is that an empty set reads like a long way of writing
> `null`, so the spec asserts **both** branches, or it gets simplified back.
>
> ### The instrument is a closed-vocabulary sweep, not a search for secrets
>
> A secret search is right for a regex redactor, where the list of credential shapes **is** the
> specification. It is wrong here: what leaks out of *structure* is not a secret shape, it is an
> ordinary string in an ordinary place — a component named after a client — and a search for
> known secrets only catches the ones on the list, written by the person who wrote the code.
>
> So every string the excerpt publishes is collected and asserted to come from a set the editor
> owns. 🔴 **Graded from both sides**: a known-**broken** probe (an excerpt hand-built with a
> client's name, which the sweep must reject) so a pass means something, and an assertion of what
> **survived**, because an excerpt with no nodes passes every absence test ever written.
>
> ### ⚠️ An ordering trap between two passes that look independent
>
> `WarningsModel` joins messages with `<br>`, so markup must be stripped — but `redact()` **emits**
> `<url>` and `<path>`. A tag strip running *afterwards* deletes exactly the markers that say a
> secret was removed, and the sentence reads as though nothing was there. **Strip first, redact
> second**, pinned by a spec carrying both a tag and a path.
>
> ### The drive — 8 consequences written first, 8 observed
>
> Ran against a copy of ALPHA-007's own **hostile fixture** project, with wiring and a component
> instance added so the excerpt had something to bucket. Output for the `Group` node:
>
> ```
> n1: Group   <- this node        n1.hoverStart -> n2.visible
> n2: Text                        n1.hoverStart -> n3.<port>
> n3: <component>                 n1.hoverStart -> n4.<port>
> n4: <unknown>
> ```
>
> `/Acme Legal Client Portal/Invoice Row` → `<component>`; `com.acmelegal.internal.BillingWidget`
> → `<unknown>`; `clientMatterRef` → `<port>`; and `hoverStart`/`visible` **survive**, so the
> allow-list is not merely hiding everything. 🔴 **Rows 7 and 8 are the two the unit specs
> structurally cannot reach** — they are about `libraryPorts()` and `graphInputs()` reading the
> real `NodeLibrary` and `NodeGraphModel`, which the pure half exists to avoid.
>
> ⚠️ **It hands off to the browser; it does not post.** That is D16 — *"until then the entry point
> opens the browser"* — and the threshold cannot be met because UNI-009's forum does not exist to
> have threads in. The editor-only half is the **composition**, which is what a browser cannot
> build. When there is a forum and UNI-001 has an issuer, copy-and-open becomes a `POST` through
> `communityapi.ts` and nothing above it changes.
>
> 🔴 **AMENDED 2026-08-18 (session 27) — HALF OF THAT SENTENCE IS NOW OUT OF DATE, AND HALF IS
> NOT.** *"The forum does not exist"* is **false**: UNI-015 and UNI-016 are built on the
> platform, `POST /api/v1/bench/threads` accepts a thread, and `post_attachments` accepts the
> node excerpt AC2 composes and the capture AC3 composes — structured, with facets derived from
> the payload by the database. ⚠️ *"It hands off to the browser; it does not post"* is **still
> true of this editor**: the composer's POST is **NOT BUILT**. AC2 and AC3 remain met — their
> verb was *attached*, not *posted* — and the browser hand-off remains the signed-out route by
> design. **What is missing is the editor-side POST, and it is the last piece of UNI-016.**

> ## Slice 2b — AC3 is BUILT and DRIVEN (2026-08-16, twenty-second session), editor `f72799b7`
>
> ✅ **AC3 closes.** A capture of the running preview attaches with a **toggle per port**, the
> default is **off** for anything record-shaped, and nothing leaves the machine before the button.
> **23 new specs** (`portshare`, plus four on the join), `test:main` **227 suites / 3527 specs**,
> eslint clean, `tsc` still at its 31 pre-existing errors.
>
> ### 🔴 The finding: AC3 cannot use AC2's instrument, and the reason generalises
>
> [`nodeexcerpt.ts`](../../../packages/noodl-editor/src/editor/src/models/community/nodeexcerpt.ts)
> can state its safety as *"every string it emits is chosen from a set the editor owns"*, and that
> claim is strong precisely because a graph's **structure** has an editor-owned form. A live port
> value has none. It **is** the user's data — that is the entire reason anyone would attach it — so
> a closed vocabulary here would either publish nothing or be a vocabulary of one entry per value,
> which is not a vocabulary. ⚠️ **Reaching for one anyway would have produced a control that looks
> like AC2's and checks nothing.**
>
> So the instrument changes shape, from **vocabulary** to **provenance under consent**:
>
> | | AC2, the excerpt | AC3, the values |
> |---|---|---|
> | published | structure the editor names | data the user owns |
> | decisions | **one** tick for the whole excerpt | **one tick per port** |
> | what makes it safe | a closed vocabulary | the tick, and what the ticker was shown |
> | what a test asserts | every string is in a set we own | every string traces to a port whose toggle was **on**, in the displayed form |
>
> 🔴 **The corollary is a deliberate divergence from AC2: port names are not bucketed here.** The
> excerpt rewrites a user-authored port name to `<port>` because nothing asked the user about that
> port. Here they are looking at the name and the value side by side when they decide, and a consent
> screen that hides the thing being consented to is worse than no consent screen. What AC2's rule
> becomes instead is **the default** — one of two independent grounds for starting off.
>
> ✅ **`isLibraryPort` is exported from `nodeexcerpt.ts` and imported**, not reimplemented: one
> predicate, two consumers, the same argument that made `bucketTypeName` an import in slice 2a.
>
> ### 🔴 Two grounds, recorded as a list rather than as the first one found
>
> A row starts off for its **value** (record-shaped, or free text) or for its **name** (a dynamic
> port or a component input). Independent: a dynamic port holding `1200` leaks a name, a library
> port holding `{…}` leaks a record. `offBecause` is a **list**, because collapsing it would let a
> fix that addressed one ground read as though it had cleared the row — the flattening this phase
> has already paid for once.
>
> ### Three smaller things that are load-bearing
>
> 1. 🔴 **An unrecognised preview shape is `text`, never `scalar`.** `previewValue()`'s grammar can
>    grow, and a classifier whose fallback is the permissive class publishes every shape it fails to
>    recognise on the day the runtime adds one. Flipping the fallback fails **6** specs.
> 2. ✅ **The runtime's 200-character cap is a privacy property as well as a memory one.** What is
>    published is the preview string, so what the user reviewed is byte-for-byte what ships.
> 3. **Every published value is redacted whatever its shape** — the shape decides the *default*,
>    `redact()` decides the *content* — and **exactly once**, so a second pass cannot damage `<path>`.
>
> ### 🔴 What the drive found: the app preview was never in the capture registry
>
> This task's own scope note says *"✅ Both halves already exist:*
> [`livePreviewCapture.ts`](../../../packages/noodl-editor/src/editor/src/views/SandboxSurface/livePreviewCapture.ts)
> *calls `capturePage()` on the preview `<webview>`"*. **True of a different preview.** That
> registry is BLD-014's, and its only registrants were the two AI sandbox surfaces —
> `ComponentBench` and `AuthoringPreviewDocument` — so `hasLivePreview()` answered **false** with a
> preview running in front of the user, on the very surface whose port values the other half reads.
> `VisualCanvas` now registers its webview. *Build the caller*, again, and the first time the missing
> caller was asserted as already present **in this task's own scope section**.
>
> ### The drive — 10 consequences written first, 10 observed
>
> Against a copy of ALPHA-007's hostile fixture with a `Component Inputs` interface added, so an
> instance carries a port name the library does not declare. The payload, as posted:
>
> ```
> **Screen capture attached** — 1976 × 626, 18 KB.
>
> opacity (input)              = 1
> transformScale (input)       = 1
> mounted (input)              = true
> childIndex (output)          = 0
> ```
>
> **Off by default and absent from it:** `sizeMode = "contentHeight"` (free text),
> `width = {unit:"%",value:100}` (a record), and `clientMatterRef = "AC-2291 Acme Legal retainer"`
> citing **both** grounds. A ticked row survived **6 poll cycles** unticked.
>
> ⚠️ **Two instrument defects, both from this repo's own trap list, both corrected mid-drive.**
> `BaseDialog` renders every dialog **twice** and `querySelector` took the **measuring** copy, so
> clicks landed on the real dialog's differently-scrolled list and toggled other rows — `textAlignX`
> was found **ON** having never been touched. 🔴 The control that separated *a failing tick* from *a
> failing click* was the excerpt checkbox, which is not poll-driven: it toggled with the identical
> technique, so the fault was located in the instrument rather than in the feature. Without it the
> honest reading would have been "AC3's toggles do not work".
>
> ⚠️ **The capture is written to the user's Documents folder, not uploaded**, because there is
> nowhere to upload to. `saveCaptureNextTo` is the one function that becomes an upload when there is
> a forum. 🔴 **The saved path is shown in the dialog and appears nowhere in the payload** — it names
> the machine and usually the project.
>
> ⚠️ **An enum reads as free text.** `sizeMode = "contentHeight"` is drawn from a set the editor
> owns, but the classifier reads the *preview string*, which cannot tell an enum from a free string.
> It therefore starts off. Deliberate over-redaction, in the redactor's own stated spirit, and
> recorded here so it is not read later as a defect.

> **D14** ([RULINGS.md](RULINGS.md)): the public web platform is the **canonical** community; the
> editor is a **second client of the same API**, showing the same content. Editor-only features are
> the reason to transition, not a different feature set.
>
> 🔴 **AMENDED 2026-08-18 by D19 — THE FORUM IS BUILT, NOT BOUGHT, AND SIX LINES IN THIS FILE
> ARE NOW HISTORY.** The note below, the comparison table's *"Discourse's own composer / mod UI"*
> column, the AC1 paragraph reasoning that *"Discourse is bought rather than built, and nobody has
> bought it"*, and the two "not in v1" entries deferring to Discourse's chat and mod UI all rest on
> a system that will not exist. The forum is **UNI-015** + **UNI-016**.
>
> ✅ **What is UNCHANGED, and it is most of the task:** AC2 and AC3 stay **met and driven**; the
> mirror still consumes `/api/v1`, which this task's own slice 1 built; D14's outbound-only rule
> still binds. 🔴 **What changes:** AC2/AC3 gain a **posting** path (UNI-016) while the browser
> hand-off **stays** as the signed-out route, and `saveCaptureNextTo` — described here as *"the
> single function that becomes an upload when there is somewhere to upload to"* — becomes exactly
> that. ⚠️ **In-editor moderation was deferred to "Discourse's own UI" and now has nowhere to go**:
> it is not in scope here either, but the reason it was out of scope has evaporated and somebody
> should say so out loud rather than let it sit deferred to a thing that does not exist.
>
> ✅ **STATUS 2026-08-18 (session 27):** the platform half landed. `post_attachments` (0009)
> stores the four kinds, facets are **generated columns** so no caller can type one,
> and a withheld port renders as a redaction chip with its name and value absent from
> everything served. 🔴 **`saveCaptureNextTo` is STILL a write to Documents** — blob storage is
> owned by no task and intersects deployment, so a `capture` attachment carries its DIMENSIONS
> and its consent record and **no image**. That is exactly what `CaptureAttachment`
> (`{width, height, bytes}`) publishes today, so nothing has to be migrated when the answer
> arrives: an `image_url` column and a writer are the whole change.

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
   behind it, both redactable before anything sends. 🔴 **"Both halves already exist" was HALF
   WRONG, and slice 2b's drive is what found it** — the sentence below names
   `livePreviewCapture.ts`, whose registry only ever held the two *AI sandbox* previews, so
   `hasLivePreview()` returned false while the **app** preview was running. The port-values half
   was correct as written. ⚠️ Left standing rather than rewritten, because the shape of the mistake
   is the value: *a scope note that names a mechanism is a claim about a place, and the place is not
   checked by naming it.* Original text: ✅ Both halves already exist:
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

> ## Slice 3 — the mirror is SURFACED (2026-08-19, thirty-seventh session)
>
> 🔴 **D21 reverses D16.** The community panel is registered in the editor's rail, unconditionally
> and **not** behind the experimental flag, and it renders whatever the platform has — including
> nothing. Richard fills it.
>
> ✅ **DRIVEN 2026-08-19 against a live platform — 8 consequences written first, 10 observed, two
> real bugs found and fixed. See the drive block below.**
>
> **Built:** [`CommunityPanel/`](../../../packages/noodl-editor/src/editor/src/views/panels/CommunityPanel/)
> — `mirrorview.ts` (the view model, pure), `useCommunityMirror.ts` (the poll), `CommunityPanel.tsx`
> (the view), registered at `order: 5.9` in
> [`router.setup.ts`](../../../packages/noodl-editor/src/editor/src/router.setup.ts). **19 new
> specs** (16 on `mirrorview`, 3 on the AC4 gate), `test:main` **257 suites / 3923 specs, 0
> failures**, `typecheck:editor` **clean**, eslint clean on the touched files.
>
> ### 🔴 The finding: D16's gate had no production caller, and that is not a tidy-up note
>
> `entryPointFor()` — the function that *was* D16, in code — was called by **its own three specs
> and nothing else**. *Build the caller*, **eighth instance in this phase**, and the first where
> the uncalled function was a **ruling's enforcement**. ⚠️ The honest reading is that D16 was never
> in force: it did not gate the surface, it **substituted** for building one. A ruling that names
> a mechanism is a claim about a place, and the place is not checked by ruling it.
>
> ✅ Retired as a gate in its own header rather than deleted — the specs beneath it still prove the
> client follows the API's `entryPoint` instead of recomputing the threshold, which is D15's rule
> and is still live now the reading is shown as a **readout**.
>
> ### 🔴 The second finding: the gate had been applied wider than it was ruled
>
> D16 gates *the mirror* — a browsable forum. Its own closing paragraph names events, replays,
> release notes and the shelf as the things that **cannot look empty**, and therefore as things
> outside the gate. **None of them were built either.** A ruling about threads became a ruling
> about the whole rail entry by nobody's decision, and no document recorded the widening.
>
> ### What protects the surface now the threshold does not
>
> D16's **design obligation** is the half D21 keeps, and it is now the only thing there is:
> four sections, four independent empty lines, each saying what the section is *for*.
> `mirrorview.ts` makes `loading`, `empty` and `unreachable` three separate states because
> collapsing them renders "the community is dead" during the 300ms before the first response —
> the `useCommunityAccount` `undefined`/`null` bug, in a new place.
>
> ### 🔴 D15's `absent` is the one case that draws NOTHING, and its spec is a control pair
>
> `absent` is how the platform answers an org-minor whose school has the community switched off,
> and a panel saying *"the community is unavailable"* would narrate the door in the act of closing
> it. ⚠️ **The trap: a `composeMirror` that returned `hidden` for anything less than a perfect `ok`
> would satisfy that assertion and destroy the panel.** So every hidden assertion is paired with a
> NOT-hidden assertion over a payload failing some other way — `unreachable`, `absent` forum,
> empty, signed-out. Both mutations were run: blanking the D15 guard reds 2 specs, re-introducing
> D16's gate reds 13.
>
> ⚠️ **The rail ENTRY is still drawn for a refused viewer, and that is a recorded gap rather than a
> solved one.** `SidebarModel.register` is synchronous at editor setup and has no async predicate,
> so the icon is there and the panel behind it is blank. It reveals the *word* "Community", not
> any content — but D15's standard is that a pupil is not told a door exists, and an icon is a
> door. **Owned by phase 67b.**
>
> ### The drive — 8 consequences written first, 10 observed, and **TWO REAL BUGS**
>
> Driven 2026-08-19 against `uni011-ac3-drive` (slice 2b's copy of ALPHA-007's hostile fixture),
> signed in as **@richardosborne14**, against a **live** `community.nodegx.io`. 🔴 **The two extra
> observations are the two bugs — neither reachable by any spec in this repo.**
>
> #### 🔴 BUG 1 — the transport had never made a real request
>
> Every section rendered *"Could not reach the community (TypeError: Failed to execute 'fetch' on
> 'Window': Illegal invocation)"* against a platform answering **200**.
> `CommunityApiClient` stored a bare `globalThis.fetch` as an object property, so `this.doFetch(…)`
> handed it the client as its receiver.
>
> ⚠️ **The precise rule, because *"fetch needs a receiver"* is not it:** WebIDL substitutes the
> global only when `this` is **undefined**. A bare `fetch(…)` is fine; a *method* call on anything
> else is not. That is why `communitysignin.ts` worked untouched — it holds its fetch in a local
> `const` and calls it bare. **One reference, two call shapes, opposite outcomes.**
>
> 🔴 **Unreachable by every spec BY CONSTRUCTION**: they all inject `fetchImpl`, the branch that
> exists so the suite needs no network. The default had therefore never executed anywhere —
> `AskAboutNodeDialog` hands off to the browser rather than posting — so **until this panel, this
> client had never made a request**. *Build the caller*, **ninth instance**, and the first where
> the thing with no caller was the transport itself.
> ⚠️ **And it cannot be asserted by making a request**: jest here has no `Window`, so Node's fetch
> tolerates the wrong receiver and a round-trip test passes on the broken code. The spec asserts
> the stored function **is not** the global one, with an injected-impl control beside it.
> ✅ Found independently by a second session within minutes, which is where the WebIDL wording came
> from.
>
> #### 🔴 BUG 2 — the editor declared a shape the platform had deleted
>
> `GET /api/v1/community/threads` returns a bare `{threads: []}`. This editor still declared
> `ForumState = {forum:'absent'; reason} | {forum:'present'; threads}`, and `ThresholdResponse`
> still declared `source`. **D19 removed both from the platform** — `src/lib/mirror.ts:45,60,123`,
> with a spec asserting the branch is absent from its own source — because we own the Bench, so an
> empty Bench is empty and there is no second reading to distinguish.
>
> ⚠️ **A discriminated union whose discriminant never arrives makes every consumer fall into its
> `else`**, so the panel rendered the right thing for the wrong reason and nothing failed. 🔴 **This
> is D15's *"the two clients drift"* warning arriving in the TYPE layer rather than the rule layer,
> where there is no test to fail because both sides compile.** Found by curling the live route, not
> by reading either repo.
>
> #### The eight rows, as written beforehand
>
> | # | expected | observed |
> |---|---|---|
> | 1 | a **Community** rail entry with no experimental setting enabled | ✅ `community-panel`, between `versioncontrol-panel` and `backend-services-panel` |
> | 2 | clicking it opens a panel titled **Community** | ✅ |
> | 3 | three content headings | ✅ Discussions · Guides and tutorials · Call replays |
> | 4 | each with its **own distinct** empty line | ✅ three different sentences, none shared |
> | 5 | header reads **Reading as a guest** | ⚠️ **NOT TESTED AS WRITTEN** — a real session existed, so it read `@richardosborne14 · 0 points`. The signed-**in** arm was driven; the signed-out arm was not |
> | 6 | unreachable renders as unreachable, **not** as "no discussions yet" | ✅ **BOTH ARMS OBSERVED** — the bug gave the unreachable arm, the fix gave the empty arm, same panel ten minutes apart |
> | 7 | the health readout appears only if `home` answered | ✅ **BOTH ARMS** — absent while broken, `0 of 30 threads · 0 of 3 weeks · no replies yet (n=0)` after |
> | 8 | no uncaught exception in the renderer | ✅ no `renderer:exception` in `.logs/dev.log` |
>
> 🔴 **Row 5 is recorded as not-tested rather than passed.** The machine had a session, and calling
> that a pass for a criterion about the *signed-out* path would be the reading-that-fits this phase
> warns about. The signed-out branch is covered by `mirrorview.test.ts`, not by this drive.
>
> ⚠️ **A near-miss worth recording about the INSTRUMENT.** The first read used
> `querySelector('[data-test=panel-header]')` and got *"Components"* — the panel was open all along
> and the sweep took the **first** of two headers. One more step and it would have been written up
> as a blocked click. *A singular selector over a plural DOM reports the wrong element, not an
> error.*

> ### AC4's gate caught this build, which is what it is for
>
> `session-readers.test.ts` went red the moment `useCommunityMirror.ts` read the session: the
> recorded set of readers is a **failing test**, not a lint. The row was added only after its third
> column was answered — the token is a bearer header on reads that already work without one, plus
> a handle in the header line — and the panel now carries the same structural proof the composer
> does: the sign-in *pointer* is the known-firing gated arm, the three content sections and the
> link out are proved ungated.

## Acceptance criteria

> **Where slice 1 leaves these (2026-08-16).** 🟡 AC1 second half **met**; AC1 first half is
> unmeetable until a forum exists. 🟡 AC4's read-signed-out half **met at the API and proved by a
> drive**; its sign-in half needs UNI-001's issuer. 🟡 AC5 **met in shape** — `poll()` exists, owns
> no clock, and the client has no method that writes. 🟡 AC6 **met at the API**, unmet at the
> surface, because there is no surface. 📋 AC2 and AC3 are untouched: they are the editor-only
> half, which this task's own sequencing note puts second.
>
> **Updated 2026-08-16 (slice 2a).** ✅ **AC2 is MET and driven** — see the slice 2a block above.
>
> **Updated 2026-08-16 (slice 2b).** ✅ **AC3 is MET and driven** — see the slice 2b block above.
> 🔴 **Every editor-only criterion is now met. What is left is the mirror**, and D16's gate on it
> cannot be met until UNI-009 buys a forum: AC1's first half, AC4's sign-in half, and AC6's surface.
> AC5 remains met in shape. 📋 **Nothing in this task is buildable without a forum or an issuer.**
>
> 🔴 **UPDATED 2026-08-19 (slice 3) — THE PARAGRAPH ABOVE IS OUT OF DATE IN EVERY CLAUSE, and it is
> left standing because the shape of the mistake is the value.** *"Until UNI-009 buys a forum"* was
> reversed by D19 on 08-18 (built, not bought); *"an issuer that does not exist"* was landed by
> UNI-001 E1 on 08-19; and D16's gate itself was reversed by [D21](RULINGS.md#d21) the same day.
> ⚠️ **Three separate blockers, none of which un-blocked itself in this file.**
>
> ✅ **AC1** — second half was already met; the first half is now met *for the threads the platform
> has*, which is the most any client can do. ✅ **AC4** — reading signed out is met and the
> structural proof is in `session-readers.test.ts`; the sign-in half points at the launcher, which
> is where UNI-001 put the one device flow. ✅ **AC5** — met in fact, not just in shape:
> `useCommunityMirror` is `poll()`'s first production caller, three outbound reads a minute, no
> socket, no notification. 🟡 **AC6** — the surface renders and its non-forum content is composed
> so it cannot be empty *by construction*; whether it is empty *in fact* is now Richard's to
> change, which is the whole point of D21.

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
   - ✅ **MET and driven 2026-08-16** (slice 2b, `f72799b7`). Ten consequences written first, ten
     observed. 🔴 **The capture half needed a fix before it could be met at all**: the app preview
     was never in `livePreviewCapture`'s registry, so `hasLivePreview()` was false with a preview on
     screen. 🔴 **The disclosure rule is provenance-under-consent, not a closed vocabulary** — see
     the slice 2b block for why AC2's instrument is unavailable here.
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
