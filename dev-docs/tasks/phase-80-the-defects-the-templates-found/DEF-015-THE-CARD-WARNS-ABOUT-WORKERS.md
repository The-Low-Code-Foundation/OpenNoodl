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
| 1 — no warning after a correct deploy | ✅ **driven** | s12, §9.2. Four ✓ endpoints, `3 workers, run in-process by these functions`, **zero** warning rows, after an explicit `Deploy functions` click. Screenshot `ac1-card.png`. |
| 2 — negative control: a real backend/project disagreement | ✅ **driven** | s12, §9.3. The same instrument that read **0** warning rows reads **1**, naming exactly the disagreeing function. ⚠️ Driven on the `stale` arm, not `missing`, and §9.4 says why `missing` is not reachable from a drive. |
| 3 — spec with both populations + an unrecognised third | ✅ | `reports a component it has no rule for rather than absorbing it`, plus the orphan-pair and transitive-chain arms. |
| 4 — the `site/` prefix mutant reddens | ✅ | §8.1. 6 specs redden. |

### 9.0 What session 11's drive established before it was blocked

The editor was launched, a copy of a site-builder project opened, and the Backend Services panel
read. Two things came out of it:

1. ✅ **The card's stopped branch shows the fix, live.** It reads **"4 in the project. Start the
   backend to deploy them."** That line is `endpoints.length`; before this change it was
   `projectFunctions.length` and read **7**. This is the changed code rendering in the real app.
2. ✅ **The backend's own answer, from a real running service.** `GET /admin/workflows` on a backend
   holding the site-builder bundle returns exactly four: `publishPage`, `duplicatePage`,
   `submitContactForm`, `claimSite`. That is the array the card diffs against, so post-fix both sides
   of the subtraction are the same four names and `missing` is empty by construction.

✅ **Both of those were observed in session 12 — see §9.2 and §9.3.**

### 9.1 Why session 11 could not drive them, and how session 12 cleared it

**Not contention in the end — a product defect.** Two peer sessions held the editor for most of
this session, but both released it and the drive ran. It then hit this:

🔴 **Deploying this project killed the backend process, every time.** The project is a *copy*, so its
bundle name (`<projectName>-<hash of project directory>`) differs from the one already deployed on
that backend, and the two declare the same seven component names. The second bundle throws
`Duplicate component name /#__cloud__/site/SetSectionAccess` inside `CloudRunner.load`, uncaught, and
Node exits 1. **Registered as its own row in `TASKS.md`, owner `NONE`**, with the stack trace and a
`curl`-only reproduction that involves no editor code at all.

✅ **So it is not this fix.** The reproduction runs against the committed `nodegx-backend/dist/cli.js`
with `curl`, no editor in the picture; and the crash names a helper component, which is the same
population this task is about only by coincidence.

**Clearing it needs one of:** moving the colliding `*.workflow.json` out of the backend's workflows
directory (one reversible file move, but it is under `~/.noodl` and this session's permissions do not
allow writing there), or attaching the project to a backend with no deployed bundle. `Start ephemeral
(no persistence)` does **not** work — it drops data persistence, not the workflows directory.

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

---

# Session 12 — 2026-08-29

### 9.2 ✅ AC1 — driven

**The blocker was cleared without touching the defect that caused it.** s11's project was bound to
`backend_mterfnli74qwv`, the backend already holding `SBR-007 Page Editor Drive`'s bundle — which is
exactly the shared-backend collision registered in `TASKS.md`. It was cleared by giving the drive
project **its own empty backend** rather than by moving a peer's file:

- a backend directory is nothing but `config.json` + `schema.json` + `data/` + `workflows/`
  (`BackendManager.createBackend`), and `listBackends` is a plain `readdir` of
  `~/.noodl/backends/*/config.json` — so one can be created by hand, faithfully, in one command;
- `backend_mtetnar43v9c6` on port **8603**, `projectIds` stamped with the drive project's id;
- the project's `metadata.cloudservices` repointed at it (`instanceId` / `endpoint` / `appId`).
  `BackendServicesPanel` matches by `instanceId` first and by localhost port second, so that is the
  whole binding.

The editor **started it automatically on project open** and pushed to it — `ProjectBackendLifecycle`
starts a stopped backend and `onBackendStarted` forces a push. No collision, because the workflows
directory was empty.

**The reading, by the section's own `data-test` attributes** (`cloud-function-live-*`,
`cloud-function-missing-*`, `cloud-function-stale-*`, `cloud-workers-*`,
`cloud-component-unreachable-*`), after an explicit click on `Deploy functions`:

| row shape | count | contents |
|---|---|---|
| ✓ live | **4** | `claimSite`, `duplicatePage`, `publishPage`, `submitContactForm` |
| ⚠ missing | **0** | — |
| ⚠ stale | **0** | — |
| ⚠ unreachable | **0** | — |
| workers line | **1** | `3 workers, run in-process by these functions` |
| **warning rows total** | **0** | |

Screenshot `ac1-card.png`: four green ticks, the workers line under a play glyph, no triangles,
`pushed just now`. **That is AC1 in one frame.**

✅ **The deployed artefact confirms the classification is the product's, not the template's.** The
bundle the editor actually wrote to disk holds seven components, and exactly the four that carry a
`noodl.cloud.request` node are the four the backend serves:

    /#__cloud__/claimSite              request node ✓   → served
    /#__cloud__/duplicatePage          request node ✓   → served
    /#__cloud__/publishPage            request node ✓   → served
    /#__cloud__/submitContactForm      request node ✓   → served
    /#__cloud__/site/ContactRecipient  request node ✗   → worker
    /#__cloud__/site/CopySectionToPage request node ✗   → worker
    /#__cloud__/site/SetSectionAccess  request node ✗   → worker

### 9.3 ✅ AC2 — driven, on the `stale` arm

🔴 **AC2 as written in §9.1 cannot be run.** Its recipe was: delete an endpoint from the deployed
bundle, `POST /admin/workflows/reload`, refresh the card. That was done — the backend genuinely
served **three** — and **the card went on showing four ✓ and zero warnings**, through a panel
close/open *and* a full renderer reload. §9.4 has the cause. The state only corrected when
re-opening the project re-pushed the bundle and healed the deletion.

**So the control was built the other way round, from the same disagreement.** A second bundle,
`ghost-probe`, was PUT to the backend: one component copied from the real `claimSite`, renamed
`/#__cloud__/ghostFunction`, with all nine node ids rewritten so nothing collided. The backend then
served **five** while the project declared **four**. Clicking `Deploy functions` (a forced push,
which replaces the project's own bundle and leaves `ghost-probe` alone) refreshed the card:

| row shape | count | contents |
|---|---|---|
| ✓ live | 5 | the project's four, **plus `ghostFunction`** |
| ⚠ stale | **1** | **`ghostFunction — on this backend, not in the project`** |
| ⚠ missing / unreachable | 0 | — |
| workers line | 1 | `3 workers, run in-process by these functions` — unchanged |
| **warning rows total** | **1** | |

Deleting `ghost-probe` and pushing again returned it to **0**. So the instrument reads
**0 → 1 → 0**, and the 1 names exactly the disagreeing function. ✅ **That is what AC2 exists for:
a rule that had merely stopped warning would have read 0 in the middle arm too.** Screenshot
`ac2-control.png`.

⚠️ **State plainly what this control does and does not cover.** It exercises the diff and the
warning rendering, and it proves the workers line is not swallowing a real disagreement. It does
**not** exercise the `missing` branch, for the reason in §9.4. `missing` is covered by the specs
(AC3) and not by a drive.

⚠️ **One thing the frame shows that is worth a second look:** `ghostFunction` appears **twice** —
once as a green ✓ and once under the warning triangle. `backendFunctions.map` renders every function
the backend reports, including the ones the next block flags as stale. Registered in `TASKS.md`.

### 9.4 🔴 The card is a push-time readout, and its rows read like live claims

**Measured, with a control.** With the backend genuinely serving three functions and the project
declaring four, the card kept reading four ✓ / zero warnings across:

1. closing and re-opening the Backend Services panel — **the panel hides rather than unmounts**; a
   stamp set on the section survived the toggle, so `useEffect` never re-fired;
2. a full `cdp reload` of the renderer — and the backend was verified as *still* serving three
   afterwards, so this was a stale reading and not a silent re-push.

The cause is in the section's refresh triggers, and there are only two: mount, and
`CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED` with `isPushing` false. And a push whose export hash is
unchanged **returns early without calling `notify()`** (`CloudFunctionDeployer.pushToBackend`), so a
no-op save does not refresh it either.

🔴 **The consequence for the `missing` branch.** A *successful* push always leaves the backend
holding exactly the project's endpoints, so immediately after one, `missing` is empty by
construction. `missing` can therefore only ever render when a push **failed** — which is precisely
the case WFA-001 built it for, and `lastError` renders beside it. It is not reachable by changing
the backend, because the card cannot see the backend change.

⚠️ **This is not an argument that the fix is wrong**, and it is deliberately not folded into this
task. The section's header says `pushed 54s ago`, which is honest about what it is. The rows say
*"in the project, not on this backend"* and *"on this backend, not in the project"*, which read as
claims about the backend right now. Whether that gap is worth closing — a poll, a refresh on panel
open, or a reworded row — is a design question with a cost, so it is registered in `TASKS.md` with
owner `NONE` rather than decided here.

### 9.5 Drive conditions

- Stack launched by this session (`dev:debug --quiet`), CDP on 9222. **No peer stack was running at
  launch**, and a peer's two live probe processes were confirmed released first — see §9.6.
- **No repo source was edited in this session**; the only changed paths under `packages/` at teardown
  were peers' (nodegx-export, core-ui scss, an editor unit test). So `test:ci` was **not re-run**:
  there is nothing in this session for it to grade. The floor stands where s11 left it — 2905 specs,
  4 failures, the named AIX-006 vocabulary floor.
- Teardown: `dev:stop` — 27 processes stopped, **16 peer MCP servers survived**, which is
  `NEVER_SWEEP` doing its job.

### 9.6 ⚠️ A launch hazard that is not in any task file, measured with a control pair

`scripts/start.ts` sweeps before it starts, and `dev-processes.js`'s rule 1 is *"the command line
contains the repo root **and** matches `DEV_TOOL`"* — where `DEV_TOOL` includes `nodegx-backend` and
`scripts/devtools/`. **A hand-started backend and a `render-from-disk.js` are both dev-stack shapes,
and neither is in `NEVER_SWEEP`.** A dry run before launching showed this session's `dev:debug` would
have killed a peer's live 8611 backend and their `render-from-disk` renderer, seven seconds old.

🔴 **Whether it kills them turns on how the caller typed the path.** Control pair — the same
`cli.js`, the same cwd, the same flags, differing only in the script path:

| arm | invocation | `sweep({dryRun:true})` |
|---|---|---|
| A | `node /Users/…/OpenNoodl/packages/nodegx-backend/dist/cli.js serve …` | **would be swept** |
| B | `node packages/nodegx-backend/dist/cli.js serve …` | **not a target** |

Independently confirmed on live processes: a peer's absolute-path backend was a target, their
relative-path one was not. ✅ **Both directions are bad** — a peer's live drive can be reaped, and a
genuine orphan started relatively survives every `dev:stop` and every launch sweep, holding its port
forever. The evidence is the *invocation string*, not the process.

⚠️ **Not registered as a phase 80 row: it is tooling, not the product surface this phase is graded
on.** Recorded here and in memory so the next drive checks `sweep({dryRun:true})` before launching.

## 10. 🔴 A limit of this fix, found after it landed

**The card's ✓ means "the backend declares this name", and that is not the same as "a caller can
reach it".** Measured on a live backend after the fix was committed: a cloud function in a folder is
declared by `GET /admin/workflows` and is **404 over HTTP**, because the route is `/functions/:name`
and `:name` does not match a nested path. The same graph deployed as `publishPage` reaches the
runner; deployed as `nested/publishPage` it does not.

Such a function appears in the project's endpoint set **and** in the backend's serving set, so this
card matches them and shows a green tick for something nobody can call. Registered as its own row in
`TASKS.md` (owner `NONE`) with the control pair and the two-different-404s trap.

⚠️ **This is not an argument for widening what the card warns about.** The card's job is to compare
what the project has against what the backend says it serves, and it now does that correctly. "Is
the declared name actually routable" is a different question with a different owner, and answering
it here would put the card back in the business of second-guessing the backend — which is the shape
of the defect this task just removed.

✅ **It does sharpen §7's wording.** `endpoint` means *this component declares an HTTP entry point*.
It has never meant *this entry point is reachable*, and the classifier cannot know the second thing.
