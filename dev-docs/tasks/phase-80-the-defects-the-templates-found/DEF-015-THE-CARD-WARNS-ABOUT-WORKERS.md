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

---

# Session 11 — 2026-08-29

## 6. What was measured before anything was built

Per the standing instruction: **the claim in this file that was a reading rather than a
measurement, driven first.** There were two, and they disagreed with each other.

### 6.1 🔴 §3's scope named the wrong seam, and the right seam is a *third* reader of one rule

§3 says the classification lives in `LocalBackendCard`'s `CloudFunctionsSection`. It does not.
That component only subtracts two lists:

```
missing = projectFunctions.filter((name) => !backendFunctions.includes(name))
```

- `projectFunctions` is `deployState.functionNames` → `getCloudFunctionNames(project)`
  (`utils/exporter/cloudFunctions.ts:42`), which applies **only the `/#__cloud__/` prefix**.
- `backendFunctions` is `GET /admin/workflows` → `declaredFunctionsIn`
  (`nodegx-backend/src/workflow/functionDeclarations.ts:91`), which applies the prefix **and**
  SB-003's Request-node rule.

So `missing` is not "the components that failed to deploy". It is **the set difference between two
predicates**, and it equals the helpers exactly — in every project, forever, immediately after a
successful deploy. There was no classification in the card to correct; there was no classification
in the editor at all.

🔴 **`functionDeclarations.ts`'s own header names this failure in advance:** *"Two readers of one
predicate is how a gate starts disagreeing with the thing it gates."* It was written about the
backend's two readers, which it keeps in step. The editor was a third reader nobody counted, holding
half the rule.

### 6.2 🔴 §2's mechanism is wrong for one of the three, and a fix built from it fails AC1

§2 says the three warned components "are the `taskTemplate` of a `RunTasks` node". Measured against
`site-builder.content.json` (mtime `2026-08-29 20:19:15`, a peer's edit — read only):

| component | Request node | how an endpoint reaches it |
|---|---|---|
| `claimSite` | ✓ | — (endpoint) |
| `duplicatePage` | ✓ | — (endpoint) |
| `publishPage` | ✓ | — (endpoint) |
| `submitContactForm` | ✓ | — (endpoint) |
| `site/SetSectionAccess` | ✗ | `publishPage`'s `RunTasks.taskTemplate` |
| `site/CopySectionToPage` | ✗ | `duplicatePage`'s `RunTasks.taskTemplate` |
| `site/ContactRecipient` | ✗ | **a component instance at the root of `submitContactForm`** |

**Two of three, not three of three.** `ContactRecipient` is placed as a node whose type *is* the
component's legacyName; there is no `RunTasks` in `submitContactForm` at all. A classifier written
from §2's sentence — "exclude the task templates" — would have left one warning triangle standing
and failed AC1 on the drive. §3's discriminator (the Request node) is the correct one and is what
was built; §2's account of *why* those three are not endpoints is right about the category and wrong
about the mechanism for a third of the population.

## 7. What was built

`classifyCloudComponents(project)` in `utils/exporter/cloudFunctions.ts`, giving every
`/#__cloud__/` component one of three roles:

- **`endpoint`** — its **own** graph holds a `noodl.cloud.request` node. Own graph, not recursive:
  that is the boundary `findRequestNode` draws over the exported bundle, where an instance's inner
  nodes are not inlined. `getNodesWithTypeRecursive` would have made every *caller* of a
  Request-node-holding helper an endpoint too.
- **`worker`** — no Request node, but transitively reachable from an endpoint.
- **`unreachable`** — neither. §3's third bucket, and the thing that makes the classification total.

Reachability counts a component named **any** way: as a placed instance (`node.typename`) or as any
parameter value equal to a cloud component's name, prefixed or bare. ⚠️ **No list of node types and
no list of parameter names**, per §5 — so `RunTasks.taskTemplate` and `CloudFunctionAdapter`'s bare
`function` are both picked up without being enumerated, and a mechanism this does not know about
surfaces its target as `unreachable`, which is **visible**, rather than being absorbed.

The predicate reads `node.typename` — the raw string — rather than `node.type.name`, which resolves
through the `NodeLibrary` singleton. A predicate that answers differently depending on which library
a spec bundle loaded last is one that passes its spec and fails in the app.

The card now diffs **endpoints only**, counts workers on one unalarming line, and warns about
`unreachable` — the one case in the section where a warning is honest.

## 8. Gates

**`test:ci` — 2905 specs, 4 failures, seed 60404, at `6c358a3f`.** All four are the named
**AIX-006 style vocabulary** floor; the floor is 4 by name and this run is on it. The suite grew
2894 → 2905, which is exactly the 11 specs this task adds, and all 11 ran. `test-results.json` was
deleted before the run and rewritten at `21:23:46`.

`tsc -p packages/noodl-editor --noEmit` and `tsc -p packages/noodl-editor/tsconfig.tests.json
--noEmit` both clean (exit 0, no output).

### 8.1 🔴 AC4's mutant, and the thing it proved that was not on the list

Mutant: `declaresCloudEndpoint` returns `!component.name.startsWith('/#__cloud__/site/')` — §5's
"the fix that passes today's drive". **2905 specs, 10 failures, seed 45798** — the 4-failure floor
plus **6 DEF-015 specs**. Reverted by its exact text and `diff`ed byte-for-byte against a scratchpad
snapshot taken before it was applied.

🔴 **All four `the shipped site-builder template` specs PASSED under the mutant — including the
parity assertion this file calls load-bearing.** They ran (all 11 started; 6 in the same file failed
in the same run, so "did not fail" is not "did not run"). Every one of the six that discriminate is
a **synthetic** arm.

That is worth more than the AC. The instinct on this phase has been *run the checker over the corpus
that exists* — and here the corpus **cannot see the defect**, because in today's template the folder
name and the node content agree perfectly. A session that had written only "assert it against the
real template, and against what the backend would serve" would have had a green suite over the wrong
rule, and would have shipped it. The real-artefact specs are the regression net; **the property is
only visible where the two rules were made to disagree on purpose.**

### 8.2 The pre-fix population, measured on a live deployment

Not the template file: the bundle a peer's editor had actually deployed this session,
`~/.noodl/backends/backend_mterfnli74qwv/workflows/SBR-007-Page-Editor-Drive-ec9dab7e.workflow.json`
(read only). Running the backend's own rule over it: **7 cloud components, 4 endpoints served, 3
helpers** — `site/ContactRecipient`, `site/CopySectionToPage`, `site/SetSectionAccess`. Exactly the
three in §2's screenshot, on a project created independently of this task, so the population is the
product's and not the template artefact's.

## 9. Acceptance criteria status

| AC | state | evidence |
|---|---|---|
| 1 — no warning after a correct deploy | 🟡 **not driven** | Blocked: see §9.1. Asserted computationally in `expects exactly what the backend would serve` — the editor's expected set and the backend's served set are equal over the real template, so the diff the card renders is empty. That is the arithmetic behind AC1, not AC1. |
| 2 — negative control: an endpoint really missing | 🟡 **not driven** | Same blocker. |
| 3 — spec with both populations + an unrecognised third | ✅ | `reports a component it has no rule for rather than absorbing it`, plus the orphan-pair and transitive-chain arms. |
| 4 — the `site/` prefix mutant reddens | ✅ | §8.1. 6 specs redden. |

### 9.1 🔴 Why AC1 and AC2 are not driven, and what it would take

The editor is a **single-instance** resource on this checkout: one remote-debug port, one
`Application Support/NodeGX` user-data dir, and launching a second stack reaps the first. A peer
session held it for this entire session driving phase 77's SBR-007 (`start-electron-dev.js` pid
`17789`, owning `:9222`, up 17 minutes at the time of writing, still running at the end). Taking it
would have destroyed their drive.

⚠️ **Do not read AC3/AC4 as covering AC1.** The specs grade `classifyCloudComponents`. What they
cannot see is the one link the drive exists to check: that `CloudFunctionsSection` reads
`cloudComponents` and not `functionNames`. That link is three lines of list arithmetic and it is
exactly the kind that a later edit reverts silently.

**The drive, ready to run:**

1. Copy a site-builder project (never open the original — opening writes three files into it).
2. Start its backend, click `Deploy functions`, read the card. **AC1: no warning triangle, and one
   line reading `3 workers, run in-process by these functions`.**
3. **AC2**, without touching the project: edit the deployed bundle at
   `~/.noodl/backends/<id>/workflows/<name>.workflow.json`, delete one *endpoint* component
   (`claimSite` is the least entangled), `POST /admin/workflows/reload`, and refresh the card.
   Expect a warning naming `claimSite` and nothing else. This is a real backend-side deletion with
   the project unchanged, which is what AC2 asks for — a rule that merely stopped warning fails it.
4. ⚠️ **The card re-reads on every deploy-state change**, so an autosave-driven push after step 3
   would re-deploy the deleted function and heal the control before it is read. Read the card
   *before* touching the graph.

🔴 **A `git checkout --` on `CloudFunctionsSection.tsx` is not how to undo anything here** — that
file carries the fix.
