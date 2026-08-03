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

## Part A — sample data does not reach the node

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

### Then, whichever it is

The non-negotiable outcome: **"Sample data" must never silently show placeholders.** If there is no
sample data for an operation, the strip says so — "No sample data for this component" — rather than
presenting an unfed preview as a fed one. That is the same rule phase 38 adopted about silent
discarding, applied to a preview.

## Part B — the component is thin

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

1. The mechanism behind the empty sample data is **named and written down here** before any fix.
2. "Sample data" either shows real sample values or says explicitly that there are none. Never
   placeholders presented as data.
3. A Profile page built after POL-006 renders in the project font.
4. A before/after comparison of the same brief, with the node counts and a screenshot of each.
5. Any convention change lands in the template, not in the prompt only, so an author can edit it.

## Traps

- **A fake is an unchecked claim.** If the sample-data path is stubbed to make the preview show
  something, that is not a fix — it is the defect with a nicer face.
- Remarkable eats HTML comments at a blank line; if you edit the CONVENTIONS template, re-render it
  in the Docs panel before believing it. AIB-006 lost a whole page to this.
- The launch of a dev editor rewrites the example project's `project.json`. Revert after killing it.
- Part A and Part B are independent. Do not let Part B's open-endedness hold Part A, which is a
  concrete defect with a concrete answer.
