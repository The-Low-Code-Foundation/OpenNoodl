# DEF-015 — The backend card calls three components undeployed that can never deploy

**Found by phase 77's SBR-015 drive, 2026-08-29.** After a successful `Deploy functions` —
the card's own timestamp reads *"pushed just now"* — three of the site-builder's seven cloud
components still carry a warning triangle and the words **"in the project, not on this
backend"**. They are Run Tasks workers. They have no endpoint and never will.

## 1. The person sentence

**An author who deploys their cloud functions and sees no warnings has deployed their cloud
functions.** Today a correct, complete deploy reports three failures that are not failures,
and the only way to find that out is to read the graph.

## 2. The evidence

The backend card for a freshly wizard-created site-builder project, immediately after
clicking `Deploy functions`:

```
Cloud functions                                   pushed just now
  ✓ publishPage
  ✓ duplicatePage
  ✓ submitContactForm
  ✓ claimSite
  ⚠ site/ContactRecipient   — in the project, not on this backend
  ⚠ site/CopySectionToPage  — in the project, not on this backend
  ⚠ site/SetSectionAccess   — in the project, not on this backend
```

Clicking `Deploy functions` again changes the timestamp and nothing else.

**The three are not endpoints.** In `site-builder.content.json`, the four that deploy each
contain a `noodl.cloud.request` node; the three that warn contain none. They are the
`taskTemplate` of a `RunTasks` node — `/#__cloud__/site/SetSectionAccess` is what
`publishPage`'s `tasks` node runs per section — and they are invoked in-process by the run,
never over HTTP. SBR-015 §4 AC2 already says so in the template's own words: *"they answer
through the Run Tasks contract's failure output, so they are a legitimately different
population"*.

The proof that they work is beside the warning: `publishPage` returns **200** and sets the
world-read ACL, which is the work `SetSectionAccess` does, on a backend where the card says
`SetSectionAccess` is not present.

### 2.1 Why this is worth a row rather than a shrug

It is a warning triangle on a healthy system, and the cost is paid by whoever meets it next.
SBR-015's own diagnosis burned a whole drive on *"one symptom over at least two causes"*; a
deploy screen that says three things are missing when nothing is missing is the same tax
paid up front. A signal that is always on is not a signal.

## 3. Scope

- `LocalBackendCard`'s `CloudFunctionsSection` — the classification that decides which
  `#__cloud__` components are expected on the backend. The discriminator is whether the
  component contains a `noodl.cloud.request` node.
- Decide what to *show* for a worker. Silence is one answer; a separate, unalarming line
  ("workers, run in-process: 3") is a better one, because a worker that has genuinely been
  deleted from the project is worth noticing.
- ⚠️ **The classification must be total.** Every `#__cloud__` component is an endpoint, a
  worker, or something the card has no rule for — and the third bucket must be visible rather
  than silently folded into one of the first two.

## 4. Acceptance criteria

1. **(person)** After `Deploy functions` on a project whose cloud components are all present
   and correct, the card shows **no warning**. Driven on a site-builder project, which has
   both populations.
2. A **negative control in the same drive**: delete an endpoint from the backend and the card
   warns about *that*. A rule that simply stops warning passes AC1 alone.
3. A spec over the classifier with both populations and a third input the rule does not
   recognise, asserting the unrecognised case is reported rather than absorbed.
4. A mutant: classify by name prefix (`site/`) instead of by node content, and the spec
   reddens — the prefix happens to work for this template and is not the property.

## 5. Traps

- 🔴 **`site/` is a coincidence.** These three sit in a folder; nothing requires a worker to.
  Classifying on the path is the fix that passes today's drive and fails the next template.
- ⚠️ **Artefact node types are not authoring names** — a component instance's type is its
  `legacyName`. Match `noodl.cloud.request` on the type field, and do not hand-write a list of
  cloud node types: an exclusion list cannot fail.
