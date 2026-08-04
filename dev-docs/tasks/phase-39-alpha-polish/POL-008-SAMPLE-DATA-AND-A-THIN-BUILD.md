# POL-008 — Sample data that never arrives, and a build worth the money

Covers reported item **10**. Two defects in one sentence; they are separated here because they have
nothing to do with each other.

## What was reported

> I did the AI builder thing to make a profile page. I clicked 'sample data' and nothing came up,
> and the component it created is basic AF — there's basically nothing but a div and a couple of
> texts.

The screenshot shows the preview rendering: an empty bordered box, the word "Text", and the words
"Email placeholder". Meanwhile the change list beside it claims:

```
Added User 'Current User'
Connected User 'Current User'.username → Text 'User Name'.text
Connected User 'Current User'.email    → Text 'User Email'.text
```

So the preview *is* rendering and the wires *are* there. The bound Texts are showing their design-
time placeholder strings, not sample values.

## Part A — DONE, 2026-08-04

Verified live end to end by `scripts/pol39-live/pol008-sandbox-session.js` — **9/9**. It builds
Richard's graph (a Group, a `net.noodl.user.User`, and two Texts whose `text` parameters are the
literal strings *"Text"* and *"Email placeholder"* from his screenshot), registers the export on
`ViewerConnection` exactly as `SandboxPreview` does, points the running preview at the sandbox URL,
and reads **what the viewer rendered**. Not the export's return value — the previous session already
proved that was complete, and proving it again would have proved nothing.

| | Rendered |
|---|---|
| signed in (default) | `sample.user@example.com sample.user@example.com` |
| signed out (toggle) | `Text Email placeholder` |

The second row is the bug report, verbatim, now reachable only when the user asks for it and under a
strip that says *"Sample data — signed out"*.

### What shipped

- **`noodl-runtime/src/sandbox/session.ts`** — writes the session the sandbox's own dataset already
  described, so `UserService`'s constructor finds one and issues the `GET /users/me` the network
  shim has always been able to answer. The dataset, the responder and every node are unchanged.
- **`attachSandboxSession`** in the viewer's sandbox entry, hung off `metadataChanged` rather than
  called beside `startSandbox()`. It has to be: the session key is
  `Parse/<publicToken>/currentUser` and the token comes out of the *export's* metadata, which has
  not arrived when the shim is installed — the shim goes in before the runtime is constructed,
  deliberately. `UserService` is a lazy singleton built on the first `User` node, so
  `metadataChanged` is early enough.
- **A `Sign out` / `Sign in` button on the strip**, and the strip's own sentence now names the auth
  state in both directions. Preview state; nothing is written to `project.json`.

### The one design decision inside the fix

**Every candidate key is written, not the one right key.** `UserService._handle()` resolves the
token from `cloudservices`, *or* from a `backendServices` entry when the project has no endpoint,
*or* to `undefined` — a rule already rewritten twice (BCN-006, BCN-009). Mirroring that if/else here
would be a second copy that fails **silently** when it drifts: the preview simply goes back to
showing placeholders, which is the defect being removed. Writing all of them is exact for whichever
branch wins and harmless for the rest, because the sandbox has its own Electron storage partition
whose only inhabitant is this fake user.

`Parse/undefined/currentUser` is in that set deliberately and is the *common* case: a project with no
backend resolves the token to `undefined` and `parseSessionKey` renders it literally. Leaving it out
would have fixed the rare case and missed every AI-authored preview.

### Two harness facts from the drive

- **Setting `webview.src` starts a navigation; the old document keeps answering CDP until it lands.**
  A fixed sleep read the signed-*in* page while asking about the signed-*out* one and reported the
  fix as broken. The two states are one query parameter apart and their DOM is identical until the
  session differs, so a stale read is indistinguishable from a failure to clear.
- **Connecting to a target that is mid-navigation hangs forever.** The CDP session detaches with the
  document and `evaluate` has no deadline. Wait from the *host* side — `webview.getURL()` and
  `webview.isLoading()` are on the element and survive the guest reloading.

### Still open in Part A

Criterion 2's second half — *"if there is no sample data for an operation, the strip says so"* — is
served today by `unknownShapeNotice` ("Fields unknown") for a class whose shape could not be
inferred. There is no case left where the dataset is *absent*: `buildSandboxDataset` is documented as
never empty, and with the session seeded the user half of it now actually reaches the graph.

## Part A — the original diagnosis (kept)

### What is known

`AuthoringSession` carries `sampleData?: AgentSampleData` and stashes it as `stagedSample`
([`AuthoringSession.ts:284,737`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/AuthoringSession.ts#L284));
`PlanRun` keeps it per operation in `sampleDataById`
([`PlanRun.ts:183,703-705`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L183));
`sandboxExport` takes it and the "Real backend" toggle deliberately ships none
([`sandboxExport.ts:47-48,156,202-207`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxExport.ts#L47-L48)).

The plumbing exists end to end. Three places it can be empty, and **which one it is has not been
determined**:

1. **The model never emitted any.** `sampleData` is an optional field on the agent's payload; if the
   model did not produce one for this operation, `sampleDataFor(id)` returns `undefined` and the
   export ships nothing. The preview would then correctly show placeholders — and the defect is that
   *the UI says "Sample data" while shipping none*, silently.
2. **It was emitted but does not bind to a `User` node.** Sample data for a `net.noodl.user.User`
   node is a different shape from sample data for a query — a signed-in user's properties, not a
   record set. The strip in the screenshot says *"Sample data — signed in as a sample user"*, so
   something intends to handle this; whether it reaches the node's `username`/`email` outputs is
   unverified.
3. **It arrives but the sandbox does not apply it.** A per-`clientId` export seam already exists
   (AIX-008) and has had a mount-path routing defect before.

### First slice: find out which

Run the flow with the scripted-session / no-provider driver, log `sampleDataFor(operationId)` at the
point `sandboxExport` is called, and log what the sandbox receives. **Do not start fixing until the
answer is one of the three.** All three are plausible and they need different fixes.

### ANSWERED — 2026-08-04. It is none of the three.

**The sandbox serves a signed-in user that nobody ever asks for. Nothing signs the preview in.**

Measured in the running editor with the no-provider driver, replaying the recorded `account-card`
candidate — which contains a real `net.noodl.user.User` node and the wire
`Connected User.email → Text.text`, the same shape Richard reported. `buildSandboxExport` was called
exactly as `SandboxPreview` calls it, with `sampleData: undefined` (his case: a profile page reads
the signed-in user, not a collection, and the tool schema tells the model `sample_data` is *"only
for components that read a backend"*, keyed by collection):

```
summary:  "Sample data — signed in as a sample user"     ← verbatim the string in his screenshot
classes:  []
user:     objectId, id, createdAt, updatedAt, __sandbox, username, email, emailVerified,
          name, firstName, lastName, sessionToken, profileImage, dob
username: "sample.user@example.com"
email:    "sample.user@example.com"
sessionToken: "r:sandbox-session"
```

So the data is **there, complete, and correctly shaped** — including a session token. Each candidate
in turn:

- **(1) never emitted** — wrong. `buildSandboxDataset` does not need the model:
  `sandboxUser()` hardcodes `username`/`email`, and its docstring already says the dataset is "never
  empty: a graph that queries nothing still gets a signed-in user".
- **(2) wrong shape for a `User` node** — wrong. The record carries exactly the fields the node's
  `username`/`email` getters read.
- **(3) the sandbox drops it** — the right family, but not the mechanism. Nothing is dropped.

The actual gap is between the two halves:

1. `installSandbox` intercepts **the network and only the network** — it patches `window.fetch` and
   `XMLHttpRequest.prototype`, and that is the entire file
   ([`install.ts`](../../../packages/noodl-runtime/src/sandbox/install.ts)). The dataset is consulted
   only when a request arrives.
2. `UserService` issues that request **only if a session already exists**:
   `getUserFromLocalStorage()` → and only `if (currentUser)` does it set `this.current` and call
   `fetchCurrentUser`
   ([`userservice.ts:141-160`](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts#L141-L160)).
3. Nothing writes one. `grep -rn localStorage` over `noodl-runtime/src/sandbox/`, the authoring
   models and `AuthoringPreviewDocument/` returns **nothing**.

A fresh sandbox window therefore has no session → `UserService.current` is `undefined` → the `User`
node's `_internal.model` is unset → `username`/`email` return `undefined` → the bound Texts keep
their design-time parameters. That is "Text" and "Email placeholder", exactly as reported, under a
strip that says *"signed in as a sample user"*. The strip is not lying about the data; it is
describing an export the runtime never consumed.

`GET /users/me` — the one route that would have served this record — is never requested. (Confirmed
structurally rather than by call-count: `responder.ts`, `store.ts` and `install.ts` are not in the
editor bundle at all, only the viewer's, which is the separation itself.)

### The fix this implies

Not "ship sample data" — it already ships. **Sign the sandbox in.** The dataset already carries a
`sessionToken`, so the seam is the one place `installSandbox` runs: seed the session the same
adapter would have written, before the runtime is constructed, so `getUserFromLocalStorage()`
answers and the existing `/users/me` interception does the rest. That keeps the mechanism the
sandbox already has and adds no branch to any node.

Criterion 2 still binds independently: with the session seeded, a `User`-node preview shows sample
values; a component that queries a collection the dataset cannot describe must still say so rather
than present placeholders as data.

#### DECIDED — Richard, 2026-08-04: signed in by default, **with a toggle**

> *"I think C is the only one that makes sense."*

The question was what seeding a session costs. The `User` node has a boolean output `authenticated`
whose getter is literally `this._internal.model !== undefined`
([`user.ts:227-234`](../../../packages/noodl-runtime/src/nodes/std-library/user/user.ts#L227-L234)),
so seeding makes it **`true` in every sandbox preview** — the logged-in branch of every graph becomes
the default, and *signed out* stops being a state the preview can show. Today the reverse is true:
signed-out is the only state it can show, which is the defect.

Right for a profile page, wrong for a login page, a signup flow or a "sign in to continue" gate. So:

- **Signed in is the default.** Richard's case works with no clicks, and the strip's existing promise
  — *"Sample data — signed in as a sample user"* — becomes true instead of aspirational.
- **The sandbox strip gets a control to sign out**, so the other branch is reachable. It is preview
  state, not project state: nothing about it belongs in `project.json`.
- The strip must say which state it is in. A preview whose `authenticated` is false while the strip
  says "signed in as a sample user" would be the same class of defect one layer down.

Options (a) *signed in, no toggle* and (b) *signed out with a toggle* were both rejected — recorded
so they are not re-proposed. (b) in particular means clicking a control before a profile page shows
anything, under a strip that already promised data.

### Then, whichever it is

The non-negotiable outcome: **"Sample data" must never silently show placeholders.** If there is no
sample data for an operation, the strip says so — "No sample data for this component" — rather than
presenting an unfed preview as a fed one. That is the same rule phase 38 adopted about silent
discarding, applied to a preview.

## Part B — RE-JUDGED, 2026-08-04. **It is not thin any more, and the premise has moved.**

Richard's instruction was *"genuinely rebuild the same Profile page and look at it before doing
anything else — the re-judge is the first slice, not a formality."* Done, against the **real
provider**, through the Build panel's single-component loop, on the same brief:
`scripts/pol39-live/pol008b-rejudge.js`.

### What the agent produced

**Seven nodes, not six, and every one of them styled.** Accepted into a throwaway copy and read back
off `project.json`:

```
Page   "Member Profile"      title, urlPath
 Group root                  alignItems/alignX center,
                             paddingTop/Bottom var(--space-8), paddingLeft/Right var(--space-4)
  Group card                 backgroundColor var(--surface), borderRadius var(--radius-2xl),
                             boxShadowEnabled, padding var(--space-8)/var(--space-6)
   Image  avatar             src "profileIcon.svg", 140×140 explicit, marginBottom var(--space-6)
   Text   nameText           textStyle "heading-3"
   Text   emailText          textStyle "muted", marginTop var(--space-2)
 User                        (wired username → nameText.text, email → emailText.text)
```

That is a spacing scale, a card with a background and a radius and a shadow, an avatar, and a
declared type hierarchy. **Cause 1 is closed and causes 2 and 3 are not what is wrong.** Writing a
styling floor into `CONVENTIONS.md` would be answering a question the model is already answering.

The font half is closed too: the preview renders in **Inter**, `document.fonts.check('400 16px
Inter')` true after an explicit load, computed family
`Inter, ui-sans-serif, system-ui, sans-serif, …`. POL-006 reached the AI sandbox.

### What is actually wrong, and it is a different defect

The rendered page ([measurements/pol008b-preview-after-build.png](measurements/pol008b-preview-after-build.png)) is still poor, and now for reasons that are visible
and nameable rather than "basic AF":

1. **`textStyle: "heading-3"` and `textStyle: "muted"` name styles this project does not have.**
   Its text styles are `Body Text`, `Button Label`, `Label Text`. Both Texts render at an identical
   16px black — **there is no type hierarchy on screen at all**, and nothing anywhere said so.
2. **`src: "profileIcon.svg"` names a file this project does not have.** It renders as a broken-image
   box, which is most of what the screenshot's emptiness is.

The spacing and colour tokens *did* resolve — the card has its background, its radius and its
padding. So this is not a token-plumbing failure. It is the phase-38 finding, exactly: **nothing
validates parameter VALUES.** The SUB-006 gate accepted a `textStyle` naming a style that does not
exist and an `src` naming an asset that does not exist, and reported *"Submitted — passed
validation."*

That reframes Part B. The remaining work is not "teach the agent to style"; it is:

- **a value check for named references** — `textStyle`, `colorStyle`, image `src` — that either
  fails the gate or reports the miss, so an invented name cannot pass silently;
- **telling the agent what this project's style names are**, which is a context question, not a
  conventions-prose question. It cannot use `Body Text` if it has never been told the project has one.

Both are bigger than a polish slot and neither is what the spec below prescribes, so **this needs
Richard's call before anything is built.** Recorded in `PROGRESS.md` under an open question.

### The original Part B analysis, kept because its causes are now answered

Six nodes for a profile page: Page Root, Current User, Profile Card, Avatar Placeholder, User Name,
User Email. Structurally correct, visually nothing — no spacing, no type scale, no colour, no
layout beyond nesting.

This is not a bug in the authoring loop; it is the loop faithfully producing what it was asked for.
Three contributing causes, in the order they are worth attacking:

1. **No default font or icon set.** [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md). A page with no
   font renders in browser-default serif, which is most of "basic AF" at a glance. Land POL-006
   first and re-judge before doing anything here.
2. **Nothing tells the agent what "finished" looks like.** The activity feed shows it read the docs
   for Group, Text, Image and `net.noodl.user.User` and then built the minimum that satisfies the
   brief. There is no styling vocabulary, no spacing scale, and no worked example of a good page in
   what it reads.
3. **`docs/CONVENTIONS.md` is where this is supposed to be answered** — and the template ships with
   every rule marked `(example)` and an instruction to ignore them. A new project therefore has, by
   design, no conventions. That is defensible for structure and indefensible for visual defaults.

### What to build

Not a model-quality project — that is a phase, not a task. Scope here:

- **Re-judge after POL-006.** Genuinely: build the same Profile page again with a font present. If
  it is still bare, continue.
- **Give the agent a styling floor.** Either a short non-`(example)` visual section in the
  CONVENTIONS template (spacing scale, type scale, "a card has padding and a background"), or a
  worked reference component in the prompt context. Prefer the template — it is the surface the
  author can then edit, which is the whole point of `docs/`.
- **Measure it.** Build the same three pages before and after, count nodes and record whether the
  result has spacing, a type hierarchy and a background. A subjective "looks better" cannot be
  reviewed and will not survive a model change.

## Criteria

1. ✅ The mechanism behind the empty sample data is **named and written down here** before any fix.
2. ✅ "Sample data" either shows real sample values or says explicitly that there are none. Never
   placeholders presented as data. Measured live: signed in renders
   `sample.user@example.com`, signed out renders `Text Email placeholder` under a strip reading
   *"Sample data — signed out"*. A class whose shape could not be inferred still raises "Fields
   unknown".
3. ✅ A Profile page built after POL-006 renders in the project font. Measured in the sandbox
   preview: computed family `Inter, ui-sans-serif, …` and `document.fonts.check('400 16px Inter')`
   true after an explicit load.
4. ◐ The "after" is measured and screenshotted (7 nodes, listed above,
   `measurements/pol008b-preview-after-build.png`). There is no "before" to pair it with — the
   reported build was Richard's, not a recorded run, and re-creating a pre-POL-006 editor to
   produce one would measure a build we no longer ship. The node count and the styling inventory
   are the comparison that can honestly be made against his description ("a div and a couple of
   texts"), and they contradict it.
5. Open — and probably moot: see the re-judge. The convention change the spec prescribes would
   answer a question the model is already answering.

## Traps

- **A fake is an unchecked claim.** If the sample-data path is stubbed to make the preview show
  something, that is not a fix — it is the defect with a nicer face.
- Remarkable eats HTML comments at a blank line; if you edit the CONVENTIONS template, re-render it
  in the Docs panel before believing it. AIB-006 lost a whole page to this.
- The launch of a dev editor rewrites the example project's `project.json`. Revert after killing it.
- Part A and Part B are independent. Do not let Part B's open-endedness hold Part A, which is a
  concrete defect with a concrete answer.
