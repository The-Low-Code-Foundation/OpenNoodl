# Defects the templates found

**Richard, 2026-08-28:** *"If you find a problem with the codebase or MCP or whatever, add it to
the next session prompt to fix please. We're making templates to surface bugs and issues with the
whole NodeGX concept as well."*

So this file is a **standing output of phase 78**, not a one-off. Building a real app through the
real doors is the only thing that exercises them the way a customer will, and what it turns up
belongs here the moment it is measured.

⚠️ **Phase 77 keeps its own sibling register** —
[DEFECTS-THE-SITE-BUILDER-FOUND.md](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md).
Its D1 (nothing warns that a `Failure` reaches nobody) is the same family as **D1 below**: the
door accepts a graph whose defect it has everything it needs to see.

## House rules for this file

- 🔴 **A row is a measurement, not an impression.** Say what was done and what happened. A defect
  filed on a hunch costs the next session more than it saves.
- ⚠️ **Disproved candidates stay, marked.** "I thought this was broken and it is not" is worth as
  much as a real row — it stops the next person re-deriving it. See D6.
- Each row names **where it bites a person**, not just where the code is wrong.
- 🔴 **Every row carries an owner, or the word NONE.** Added 2026-08-29 after the three-register
  sweep created [phase 80](../phase-80-the-defects-the-templates-found/TASKS.md). A row with no
  owner is not a record, it is a thing that will be found again — which is exactly what happened to
  twenty rows across three phases. **A new row is not finished until this table has a line for it.**

## The register

⚠️ **The `status` column is AS RECORDED by the session that filed each row, not a re-measurement at
HEAD.** Only the rows dated 08-29 were measured today. A sweep that re-measures the rest is owed and
is not this table — writing "still real" over twenty rows I did not re-run would be the exact
failure this file's first house rule exists to prevent.

| row | status (as recorded) | owner | side | who it bites |
|---|---|---|---|---|
| D1 | 🔴 open | **DEF-002** | product | every agent-authored app |
| D2 | 🟠 open | **DEF-005** 🔒 ruling | product | every membership app |
| D3 | 🔴 open | **DEF-005** 🔒 ruling | product | every membership app |
| D4 | ✅ answered — not a defect | — | — | — |
| D5 | ⚠️ open | **DEF-008** | product | an author reading port names |
| D6 | ✅ disproved | — | — | — |
| D7 | ✅ fixed s6 | — | template | (was: everyone gated against) |
| D8 | ✅ disproved | — | — | — |
| D9 | 🔴 residual open | **DEF-007** | product | the next template |
| D10 | 🔴 open | **phase 78** (template-generator work) | template | every generated app |
| D11 | 🔴 open | **DEF-001** | product | every end user |
| D12 | 🔴 open | **DEF-006** | product | every agent styling on-system |
| D13 | 🔴 open | **DEF-001** | product | every end user |
| D14 | ✅ fixed s6 | — | product behaviour, worked around in template | (was: every gated reveal) |
| D15 | ⚠️ open | **DEF-006** | product | every agent styling on-system |
| D16 | ✅ fixed s6 | — | template | (was: every gated screen) |
| D17 | ✅ answered s5 | — | — | — |
| **D18** | 🔴 open (08-29) | **NONE** — ruled *not* DEF-001, see below | product | every person filling in any form |
| **D19** | ⚠️ open (08-29) | **NONE** — either way, see below | product | every person filling in any form |
| **D20** | 🔴 open (08-29) | **NONE** — **DEF-006 agreed, not yet filed** | product | every agent styling on-system |
| **D21** | ✅ disproved (08-29) | — | — | (would have been: every agent placing a component) |
| **D22** | 🔴 open (08-29) | **NONE** | template | every install — the directory's first row |
| **D23** | ⚠️ open (08-29) | **NONE** | template | anyone reading two pages titled the same |
| **D24** | ⚠️ open (08-29) | **NONE** | template | a moderator approving somebody |
| **D25** | ✅ fixed in Track A — **re-measured 08-29 (s10)** | — | template | (was: every person reading a date or filling the meeting form) |
| **D26** | 🔴 open (08-29) | **NONE** — handed to P80 as C1 | product | every template we ship, not just this one |
| **D27** | ✅ fixed s8 (08-29) | — | template | (was: anyone whose setup, join or approval threw) |
| **D28** | 🔴 open (08-29) | **NONE** | product | every agent who lays controls out in the one node that reflows |
| **D29** | ⚠️ open (08-29) | **phase 78** (Track B remainder) | template | every member — a second auth round trip on every page |
| **D30** | 🔴 open (08-29) | **NONE** | product | every app with a column of numbers — money, times, scores |

🔴 **D18/D19/D20 are the first rows created since the sweep, and they were already unowned within a
day of the process being put in place.** That is the argument for the column, not an argument
against the timing.

⚠️ **Discussed with phase 80's owner 2026-08-29 and recorded in
[THE SWEEP](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md#still-open-after-both-fixes)
— but no `DEF` task names any of the three yet, so all three stay `NONE` here.** Where it landed:

- **D20 → DEF-006, agreed by both sessions** — the agent opens the vocabulary looking for a field or
  a notice and finds nothing, the same mechanism as D12 and D15. 🔴 **Agreed is not filed:** grep
  DEF-006 for `D20` and it is absent. Until that line exists this row is still unowned in the only
  place that schedules work.
- **D18 → NOT DEF-001.** Accepted by phase 80's owner: it is a **fidelity** defect, not an
  accessibility one — monospace is perfectly legible, it is simply not the app's typeface, and
  filing it under an a11y-scoped task would widen that task silently. Needs a home about *the design
  system not reaching the rendered control*. **Re-measure before filing.**
- **D19 → genuinely either way** — it is an a11y contrast question *and* a reachability question.

⚠️ **Naming.** `D17` was briefly a second `D10` in this file and was renumbered; every historical
`D10` reference means the generators bypassing the design system. Settled 2026-08-29 (`56c9b372`):
**this register mints the `D` ids, phase 80 mints the `DEF` ids** — on a collision, the file that
issues the identifier is the one to match.

---

## D1 — 🔴 The MCP door accepts wires to ports that do not exist. Three classes, all silent.

**Severity: high.** This is the class SB-018 (1) lived in for five sessions.

Measured by sabotage during TPL-001 authoring. In each case the run came back `isError: false`
with **exactly the same 46 `info dynamic-port-skipped` diagnostics as the clean run** — no error,
no warning, and not even an info about the wire:

| what was sabotaged | what the door said |
|---|---|
| `standing.isMember` → `standing.isMemberXX` (a **component-instance** output) | nothing |
| `send.in-name` → `send.in-nameXX` on a **`CloudFunction2`** whose endpoint declares `name,email,password,message` | nothing |
| `goDetail.pm-announcementId` → `pm-noSuchParam` on a **`RouterNavigate`** whose target page declares `announcementId` | nothing |

🔴 **All three targets are components the door has already resolved on disk**, and each declares
its ports in a file the door reads:

- a component instance → the `Component Inputs` / `Component Outputs` node in the target component
  (⚠️ note the inversion: `Component Inputs` declares *output*-plugged ports inside the component,
  and those are the *inputs* an instance exposes);
- `CloudFunction2` `in-*`/`out-*` → the target cloud component's `noodl.cloud.request` `params`
  stringlist and its `noodl.cloud.response` `params`;
- `RouterNavigate` `pm-*` → the target page's `PageInputs.pathParams` and the `{braces}` in its
  `Page.urlPath`.

**Where it bites a person.** Every gate in the members' area is a component-instance port —
`isMember` reveals the content, `isModerator` reveals the moderator's tools, `Member`/`Moderator`
are the *only* triggers the queries have. A typo in any of them fails **shut and silently**: a
screen that stays empty, a list that never loads, and a green authoring run. An agent authoring
through this door has no way to learn it made the mistake.

**Fix.** Extend the connection check to resolve these three references the same way
`For Each.template` already is (`repeater-template-unresolved` is blocking, and it is the proof
this is the door's job). ⚠️ If a full check is too strong to land at once, the cheap half is worth
having on its own: **emit an info naming the wires that were not verified**, the way
`dynamic-port-skipped` does for parameters. Today the door is silent about connections in a way
that reads as "checked and fine".

**Interim cover:** `packages/noodl-mcp/tests/tpl001Template.test.ts` §3 does the instance-port
check over the shipped artefact, and since 2026-08-28 `tpl001-members-drive.test.ts` **executes**
every class named above — the eight instance ports, `in-*`/`out-*` on all four `CloudFunction2`
nodes, `prop-*` on both records nodes, `qp-today` on the meetings filter — and none of them was
wrong. ⚠️ That is evidence about **this template**, not about the door: it says the silence hid
nothing here, and costs a drive per template to say it anywhere else. The door is still silent.

---

## D2 — 🟠 The browser cannot read the current user's roles at all

**Severity: was high; ⬇️ MEDIUM since D4 was answered on the drive (2026-08-28).** It is still a
hole in the concept — but D4 shows an app *can* branch on the refusal of the query it was going to
run, so this is a convenience and a quality-of-result question rather than the only way through.
Read D4 before acting on this row.

- `_Role` is a system class: `isSystemCollection` gives every `_`-prefixed class a fixed `nobody`
  posture **regardless of config**, so no query reaches it.
- The `User` node's outputs are the columns of `_User`, and role membership is not one.
- The whole roles family (`getuserroles`, `addusertorole`, `removeuserfromrole`) is **cloud-only**,
  deliberately — *"adding the current user to a role from client-side graph is one wire from a
  button to 'make me an admin'"*, which is right for the writes.

**Where it bites a person.** Every membership app — which is to say the entire category this
template is aimed at — needs a bespoke cloud function (`myStanding`, here) *just to decide whether
to show a page*. That is a round trip, a security policy entry and four nodes before a single
screen can branch. Anyone building this without our findings will instead infer membership from
whether a query came back empty, which is D3's trap and is wrong.

**Fix candidate.** A read-only `roles` output on the `User` node, resolved from the session the
same way enforcement resolves it (`SecurityState.rolesForUser`). Reading one's own roles grants
nothing — the server still decides every request — and it would remove the round trip from the
most common branch in the product.

⚠️ **What D4 changed about the "where it bites" above.** Inferring membership from an empty query
is wrong, but inferring it from a **refused** one is not — `failure` fires. So the cost of not
having this is a screen that must issue a members-only query, have it refused, and *then* say "you
may not", flickering through "nothing here" on the way. That is worse than a round trip, not
impossible without one.

---

## D3 — 🔴 Nothing enumerates the members of a role

**Severity: medium-high. It makes an ordinary screen unbuildable.**

`getuserroles` answers *"which roles is this user in"*. There is no inverse. So **"show me the
member list"** — the most ordinary screen in a membership app, and named in TPL-001 §3 — cannot be
built at all without maintaining a projection collection that duplicates `_Role`, which then goes
stale the first time somebody changes a role by hand.

**Fix candidate.** A cloud `List Users In Role` node. The junction is already there and the
resolver already walks it in one direction.

**Until then** TPL-001 ships without the member list, and the decision is Richard's (TPL-001 §10).

---

## D4 — ✅ ANSWERED on the drive, 2026-08-28: **yes, `failure` fires.** Not a defect.

**Closed. The answer reverses what a prior session recorded, so read this before trusting any
note that says a refused query looks empty.**

`DbCollection2` has a `failure` signal and an `error` output, and `setError` raises a runtime error
code — so **if** a 403 reaches that path, an app can tell "you may not read this" from "there is
nothing here". Prior sessions recorded the opposite (a refused query publishing `[]` like an empty
one), which is why every members-only screen in TPL-001 is branched on `myStanding` instead.

**What was measured** (`packages/nodegx-backend/tests/tpl001-refused-query.test.ts`), with the
shipped policy enforcing, on one backend, in one browser, two arms minutes apart:

| arm | server | the page |
|---|---|---|
| an approved **member** | `200`, one row | list drew the row, stayed on `/members`, console clean |
| a **pending** person | `403` | **navigated away** — `failure` fired — and the console named `query-records/query-failed` |

TPL-001 never runs a members-only query as a non-member, so the twin adds **two wires and nothing
else**: `page.didMount → announcements.storageFetch` (so the query runs whoever you are) and
`announcements.failure → toLanding.navigate` (so a refusal, if legible, is unmissable). The member
arm is the control that the added fetch is live; without it a silent pending arm would be equally
consistent with "the mutation did nothing".

🔴 **The first version of this twin got the opposite answer, and it was the instrument's fault.**
It wired `failure` → `unknownNotice.visible` — a **signal** into a **value** port — and the notice
painted for the person whose query **succeeded** and not for the one who was **refused**. Exactly
inverted. That is the SB-018 class, and it is the reason the twin is now signal-to-signal
throughout. **An instrument built out of a seam you already know is broken measures the seam.**

⚠️ **TPL-001's design still stands.** Branching on `failure` means issuing the members-only query
for every stranger and flickering through "nothing here" on the way to "you may not"; the standing
check stops the query being made at all.

---

## D5 — ⚠️ `net.noodl.user.LogOut`'s signal input is named `login`

**Severity: low, and unfixable in the obvious direction.** `logout.ts:67` says why: the port name
is persisted in every project that uses the node, so renaming it breaks them. It is displayed as
"Do".

✅ **The door already handles this well** — it refused `logout` and named `login` as the
alternative, which is how it was found in one minute rather than one hour. Recorded only so the
next person does not re-derive it. If anything is worth doing, it is accepting `logout` as an
alias in the door's suggestion path.

---

## D6 — ✅ DISPROVED: "the door hides its node id remapping"

**Filed and then withdrawn in the same session, kept as a row on purpose.**

The door de-duplicates node ids **project-wide**, so a second component reusing `emptyState` is
written as `emptyState-2` — which broke two assertions written against authored ids. The first
reading was "the door rewrites ids and does not say so".

**It does say so.** `create_component` returns `remappedNodeIds` and `remapNote`, and
`responses.ts` states the reason in exactly the terms that were needed: *"a caller that intends a
follow-up `update_component` keyed on the id it just sent needs to know the id changed"*. **The
generator was throwing the payload away** — the same mistake it was making with the door's
diagnostics.

Both are now collected and printed (`built.remaps`, `built.diagnostics`). 🔴 **The lesson is about
the caller, not the door: an absence you have not looked for is not an absence the tool has.**

---

## D7 — ✅ FIXED 2026-08-28 (s6): a `visible: false` group shipped its whole subtree to everyone

**Severity: low as a defect, high as a habit.** Measured on TPL-001's drive: an approved member
loading `/post` receives the moderator's announcement form, meeting form and both submit buttons
in their document, behind `display: none`. `Post it` is absent from what is *painted* and present
in what is *in the document*, in the same reading.

It is **not** a leak here — the forms are empty and the server answers `403` to the write — and
`visible` is documented as holding its space rather than removing the node. It is filed because of
what it makes false: *"the member's UI does not offer it"* is a claim about painting, and anyone
who reaches for `visible` to hide **content** rather than a control has built a leak that every
structural spec will pass. The template itself gets this right — every members-only **fetch** is
gated on a standing signal, so hiding is never what keeps data out.

**Where it bites a person.** The first builder who puts a members-only announcement inside a
`visible: false` group instead of gating its query. `mounted` removes the subtree; `visible` does
not, and nothing in the editor says which one this decision needs.

### ✅ The fix, and how it is held

Every gate in the template is now `mounted` — **27 wires and 25 parameters**, changed at the source
(`tpl001Components.ts`) and regenerated, so the artefact diff is exactly those 52 lines and nothing
else. The drive spec that **recorded** this defect is inverted rather than deleted, because a
deleted spec cannot notice the regression back:

> `✅ D7/D16 — the form is not in the member’s document at all, not merely unpainted`

🔴 **It carries two controls**, because a bare absence proves nothing: the same reading holds the
refusal sentence (so the document rendered), and the *moderator's* reading through the same helper
DOES hold the form (so the instrument can see one when it is there).

A second ratchet in `tpl001Template.test.ts` fails on **any** `visible` wire or parameter anywhere
in the shipped artefact, and asserts the 27 `mounted` gates beside it — an empty offender census
that is a measurement rather than a walk over an empty population.

⚠️ **The race that made this worth thinking twice about does not exist here, and the reason is
worth keeping.** An unmounted node is **not destroyed** — it stays in the graph and its inputs keep
arriving, so a `For Each` inside a gated group still receives rows published while it is away
(`foreach.tsx` either applies them immediately or queues them and replays on `didMount`). Beyond
that, every query in this template is a **parentless logic node triggered *by* the same standing
signal that mounts the group**, so the group is always mounted first. Read, then measured: the
drive suite's list-rendering arms (§2, §6, §8) all pass.

---

## D8 — ✅ DISPROVED: "the viewer bundle was stale, so the drive measured an old runtime"

**Filed and withdrawn in one session, kept because the reasoning was seductive and wrong.**

`packages/noodl-editor/src/external/viewer/noodl.viewer.js` had an mtime of **08-27 20:23** and
three commits touching `noodl-runtime` / `noodl-viewer-react` carried later timestamps, so it was
rebuilt before driving anything.

**It was already current.** The pre-existing bundle was **byte-for-byte the same size** as a fresh
build, and grepping it found `_inputCauseQueue`, `_inputValuesQueue` (FB-025) and `textInputValue`
(FB-026) already present: the changes were in the working tree when the bundle was built and were
committed thirty-two minutes later. And the third commit blamed — 354b4525, SB-018 — touched
**no runtime source at all**, only tests and template content.

🔴 **The lesson is the inverse of the usual one.** *Commit time is not authorship time*, so an
artefact older than a commit may still contain it. ✅ **Grep the artefact for a marker.** Never
infer staleness from an mtime against a commit date — in either direction.

⚠️ **What was worth doing anyway**: the drive now stamps the bundle at both ends of the run and
reddens if it moved. On a shared checkout a peer's dev stack rewrites that file, and a bundle
swapped mid-drive would surface as a flake in whichever spec happened to be running.

---

## D9 — 🔴 A generated project can ship with no HOME node, and every headless gate passes over it

**Severity: high.** It is the first thing a person does after picking a template, and it fails.

Measured 2026-08-28 (s4) by doing the one thing nothing had done: **opening the artefact as a
project in the editor and pressing preview.** The viewer rendered

```
ERROR
No  HOME component selected
Click Make home as shown below.
```

— not the landing page, not a white void, not a routing error. Nothing in the app was reachable.

**The cause.** `ProjectModel.fromJSON` resolves the app's home from `rootNodeId`
(`projectmodel.ts:235`). The skeleton `tpl001Template.ts` wrote had no such field, so `rootNode`
stayed `undefined` and the viewer had no root to render. Everything else about the project was
correct — 21 components, 11 pages registered, the router present, the start page right.

🔴 **The control that makes this a defect rather than a guess.** The only other template in the
repository, `site-builder.content.json`, carries `rootComponent: '/App'`. Same mechanism, two
arms, and the arm that omits it is the arm that errors. One template had it because it was
hand-shaped; the other was generated by a script that never wrote the field.

⚠️ **And the two spellings are not interchangeable.** `rootComponent` is the **legacy** field — a
component *name* — which `import-engine/legacy/assess.ts:356` reports as something it rewrites on
load, and which `project-v2.schema.json` (`additionalProperties: false`) does not permit. A v2
project file carrying it is not a project file that validates. The v2 spelling is `rootNodeId`, a
node id. `fromJSON` accepts the legacy one only as a fallback while upgrading.

**Fixed** in `prepareArtefact` → `pinRootNode`, which reads the root back out of `App/nodes.json`
rather than typing `app_root`: the door de-duplicates node ids project-wide, so that id is stable
only because `App` is written first and nothing claims it earlier.

### 🔴 Why 45 headless specs and a 41-spec byte gate all passed over it

This is the part worth carrying to every future template.

- **The drive serves pages directly.** `withRenderedPage` navigates to a URL and reads what comes
  back. It never asks the project what its home is, so the field being absent is invisible to it —
  all 45 specs, including every one that renders a page in a real browser, pass on a project the
  editor cannot open.
- **The byte gate compares the artefact to a fresh run of the same generator.** A field neither
  side writes is a field both sides agree about. Byte-identity is a *drift* check, and it cannot
  see a defect that was present from the first run.

✅ **The gap is the same shape as the one P67 named**: a checker run over fixtures it authored
agrees with itself. What found this was running the artefact through **the door a person uses**,
which for a project template is *open it in the editor and press preview* — and that door was
outside every sweep in this phase. **Where it bites a person: they pick the template, press
preview, and the app does not exist.**

### The curated path carries no repair, and the embedded one says why it would need one

Read after the fix, and it settles which arm this defect lives on:

- 🔴 **`PlatformTemplateProvider` does no home resolution at all** — neither `rootComponent` nor
  `rootNodeId` appears in it. A curated template is a prepared directory, and what the directory
  carries is what the person gets. So before this fix, a curated install of TPL-001 gave a project
  with no home, exactly as the launcher-opened copy did.
- ✅ **`EmbeddedTemplateProvider` resolves the name into a concrete `rootNodeId` at install, and
  its own comment states the trap** (`:119-125`): `fromJSON`'s `rootComponent` hint calls
  `setRootComponent()`, which *"silently no-ops unless the NodeLibrary already has the root node's
  type loaded"* — and at project-creation time the editor is **on the launcher with an empty
  NodeLibrary**, so the hint is lost and *"the project is saved with no home component"*.

⚠️ **That is the same failure this row opens with, already known and already written down for the
other arm.** The embedded provider repairs it per-install; the curated path has no such step, so
the repair has to be *in the artefact*. Writing a concrete `rootNodeId` is what that comment
prescribes: resolved by id lookup, independent of the NodeLibrary.

⚠️ **What is measured and what is inferred.** The error, the cause and the fix were **driven** —
opened from the launcher, previewed, `rootNodeId` absent, added, app renders. That the *wizard*
install has the same hole is read **from the code above**, not driven: a curated template cannot
be installed through the picker until it is published, which is T5. **Grade it there**, and do not
let this row stand in for that reading.

---

## D10 — 🔴 The template generators bypass the design system the product ships

**Severity: high.** It is what a person judges the whole product by, before they test anything.

Richard, 2026-08-28, after driving TPL-001 by hand: *"it doesn't even look like a website… I'm at
a loss about how both templates we've tried to create so far have been fucking shit on the front
end."*

**Measured, not impressionistic**, over `templates/members-area/`:

| | |
|---|---|
| visual nodes | 137 |
| **colour or background parameters set** | **0** |
| design tokens used | **2** — `--font-bold`, `--font-semibold` |
| style parameters set | 125, and every one is layout plumbing: `flexDirection`, `padding`, `width/height`, `sizeMode` |
| the project's `settings` | `{htmlTitle, navigationPathType}` |

No font sizes, no max-width, no radius, no borders, no gaps, no shadows, no text-align, no
variants. 🔴 **And `site-builder.content.json`'s settings block is byte-identical in shape** — the
same two keys, no styles. Two templates, one failure: it is the process, not the template.

### What exists and is not being used

- **Five style presets** — `Enterprise`, `Modern`, `Playful`, `Minimal`, `Soft`
  (`StylePresets/presets/`).
- **Semantic tokens** by category, **legal variants/sizes per element type**, **named
  compositions** — all reported by `get_style_vocabulary`, whose own tool description tells an
  author to call it before setting any colour or spacing.
- **`set_project_tokens` and `set_style_preset`**, write tools that already ship.
- 🔴 **The project wizard already offers the presets to a person creating a project**
  (`ProjectsPage.tsx:109,1614`).

So a human who creates a project is offered a look. **A generated template is not**, because both
generators author behaviour graphs through the door and call none of the above.

### ✅ DISPROVED, in the same session: "a template cannot carry a look"

The obvious hypothesis — that this is a *product* gap and templates are structurally unable to
record a design — **is wrong, and it was worth ten minutes to check rather than file.**
`upsertTokens` persists to `nodegx.project.json → metadata.designTokens`
(`ProjectStore.ts:153-175`), `metadata` is a permitted property of `project-v2.schema.json`, and
the artefact ships that file.

🔴 **So the whole fix lives in the generator** — no product change, no editor source, no collision
with P77. Filing this as a platform limitation would have pointed the next session at the wrong
codebase.

⚠️ **Still open**: whether recording a preset alone visibly changes the rendered app, or whether
nodes must also reference `var(--token)` and carry variants for it to show. That decides whether
the fix is one call or a sweep over 137 nodes. **The instrument is a screenshot** — no spec in this
repository can see it.

### Where it bites a person

They open the shelf, pick the one template on it, press preview, and get black text left-aligned in
a full-width column. **Every gate in this phase passes on that**: 41 byte-gate specs, 66 drive
specs, 840 MCP specs. Not one of them can see it, because not one acceptance criterion mentions
appearance — which is P76's closing ruling (*correct and usable were never the same criterion*)
recurring for the third time.

✅ **Richard's standing ruling, 2026-08-28**: appearance is an acceptance criterion on every
template in this phase, graded **before** the behaviour work. The ratchet that enforces it — *no
preset recorded · zero colour tokens · no `maxWidth` anywhere · every page a single full-bleed
column* — is the first task of the next session, deliberately **before** any layout work, so the
pass is not marking its own homework.

---

## D17 — ✅ ANSWERED, s5: applying a preset alone changes **nothing a person can see**

⚠️ **Recorded as a second `D10` until 2026-08-29, and renumbered here.** There were two different
defects under that number and a reader could close one meaning the other. Nothing else moved: the
references to "D10" in this file (including the first line of this entry) all mean the *other* one
— the generators bypassing the design system — which is what this entry answers a question about.

D10 left one question open — *"whether recording a preset alone visibly changes the rendered app,
or whether nodes must also reference `var(--token)`"*. It is answered, and the answer is the
expensive one.

**It is a sweep, not one call.** Two measurements, neither of which needed a screenshot:

- `buildEffectiveTokens` merges the shipped defaults **as the floor** and
  `generateProjectTokenCss` stamps the whole set into `:root` — `StyleTokenCoverage.test.ts:116`
  already asserts `generateProjectTokenCss(null)` contains `--primary:`. So `var(--primary)`
  **already resolved** in the members' area before this session. There was simply nothing
  referencing it.
- Confirmed on the artefact: with the token block written and not one node changed, the appearance
  ratchet's §2 went green and §3 and §4 stayed red. The render harness reported *"182 shipped
  defaults + 34 project override(s)"* and the page looked identical.

⚠️ **And picking Modern would have been worse than doing nothing.** `ModernPreset.ts` says *"Modern
IS the defaults"* and ships `tokens: {}`; `styleTools.ts`'s `entries.length === 0` branch then
**clears** the block. A preset that writes nothing is indistinguishable from a preset never applied.

---

## D11 — 🔴 Three of the five shipped style presets fail WCAG AA on their own primary button

**Severity: high — the default is one of them.**

`--primary-foreground` on `--primary`, computed from the preset files
(`StylePresets/presets/*.ts`), against the 4.5:1 floor for normal text:

| preset | ratio | |
|---|---|---|
| `modern` | **3.68** | 🔴 **the wizard's default** |
| `playful` | **4.23** | 🔴 |
| `soft` | **4.47** | 🔴 — misses by 0.03 |
| `minimal` | 17.72 | ✅ |
| `enterprise` | 17.85 | ✅ |

🔴 **Where it bites a person.** Every project created through the wizard inherits Modern, so the
filled button — the one control on every page a person is meant to press — is sub-AA out of the box.
It is not a template defect and no template can fix it: a template that picks a passing preset only
moves itself out of the way.

✅ **What TPL-001 did about it**: based itself on `enterprise` and overrode the hue, with every pair
measured in `tpl001Theme.ts`. That is a workaround for one template, not a fix.

---

## D12 — 🔴 The `primaryButton` composition ships a parameter the runtime never reads, and the door warns on every instance

Measured: applying `composition('primaryButton')` verbatim to the template's buttons produced **12
`warning inactive-conditional-parameter` diagnostics** on the first generation run —

> *`net.noodl.controls.button`'s "borderWidth" only applies when borderStyle is solid or dashed or
> dotted, so this parameter is never read.*

The composition sets `borderStyle: 'none'` **and** `borderWidth: 0`. Both are its own.

🔴 **Where it bites a person.** `get_style_vocabulary` presents compositions as *"ready-made
parameter sets… each naming the recipe that shows it assembled"*. An agent that follows the design
system exactly as instructed is rewarded with a warning per button, and its only options are to
ignore a real diagnostic or to diverge from the system. Both are bad lessons.

✅ Repaired at the point of use in `tpl001Components.ts` (`withoutInertBorderWidth`), stated as a
rule rather than a special case so it lapses by itself when the composition is fixed.

---

## D13 — 🔴 The `textinput` `default` variant's border is 1.33:1 — the fix `outlineButton` documents was never carried across

The vocabulary reports `net.noodl.controls.textinput` `variantStyles.default` as
`{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }`. `--border` measures
**1.33:1** against the background, under the **3:1** WCAG 1.4.11 requires of a control boundary.

⚠️ **The product already knows.** `outlineButton`'s own description says it in as many words —
*"A control border needs 3:1 and no `--border*` token reaches it (best 1.48:1), so this uses
`--muted-foreground` (4.76:1)"* — and `--border-control` exists in every preset for exactly this.
The knowledge is one composition away from the element that needs it and never made the trip.

🔴 **Where it bites a person.** Every form in every project built on the system variant has invisible
field edges, which is the single most common accessibility complaint about a form. Seventeen fields
in this template alone.

✅ TPL-001's `FIELD` uses `--border-control` (**5.49:1** on this palette).

---

## D14 — 🔴 A `Condition` with a constant parameter fires on load, so every reveal it gates was visible from the first frame

**Severity: high. It shipped, and it is what a person met first.**

Seven `Condition` nodes in TPL-001 carry `condition: true` and are triggered by `eval`. The node
declares `runOnValueChange: { controlSignal: 'eval', inputs: ['condition'] }`, and wiring `eval`
**adds** a trigger rather than replacing one — the port's own description says so: *"This is
additional to Condition re-testing on change; untick it under Run On Value Change to stop that."*
So the constant parameter arriving at load counted as a change, every gate tested true before
anything had happened, and every `visible: false` it governed was overridden.

⚠️ **What a person saw.** The setup page greeted them with *"This members' area cannot be set up
with those details"* **before they typed a character** — on the exact screen Richard could not get
past.

🔴 **How it survived.** The artefact on disk is correct: `visible: false` is on the node, and
`refusalGate` is wired only to `eval`. 41 byte-identity specs, 45 drive specs and two typechecks
were green. **Only the running app disagreed, and only a picture could tell.** Found by rendering
the artefact headless and looking at it; confirmed pre-existing by rendering `HEAD`'s artefact as a
control arm, which shows the same sentence.

### 🔴 s6 — the drive spec that should have caught it was **passing because of it**

Fixing D14 turned two §7 specs red, and they were the specs whose whole job was to check the
confirmation appears after a post. They were not a regression. They read:

```ts
await clickButton(page, 'Post it');
await look('moderator.posted', '/post');   // ← navigates: a FRESH page load
expect(visits['moderator.posted'].text).toContain('Posted. Members can see it now.');
```

`look` navigates. So the assertion was *"a freshly booted `/post` shows **Posted**"* — which is
true only of a page whose gate fires on load. **That is the defect, stated as an expectation.**
While D14 lived the spec passed; the moment it was fixed the spec failed, and a session reading the
red without reading the spec would have reverted the fix.

✅ **Repaired by reading in place.** `readHere` (`helpers/site-drive.ts`) reads the current document
without navigating, so the assertion grades the *click* rather than the *boot*. And the arm that was
missing is now written down:

> `it('does NOT say so before anything is posted — the D14 arm')`

🔴 **The pair is the point.** "The confirmation is on the page" and "the confirmation is not on the
page until you post" are the two halves, and D14 is exactly the state in which the first is true and
the second is false. One alone measures nothing.

✅ Fixed by `runOnChange-condition: false` on all seven (`CONDITION_GATE`). ⚠️ Set explicitly rather
than left to the load-time migration that writes the same flag: a migration runs where projects are
loaded, and the render path that caught this reads from disk without it. **A template must be
correct as written.**

🔴 Third appearance of this family in this template — `Run` is additive for JavaScript guard nodes
(fixed s4), for the two `decideMembership` guards (fixed s4), and now for `Condition`.

---

## D15 — ⚠️ `find_tools` free-text searches tool NAMES, so the word on the group reveals nothing

`find_tools`'s `query` filters with `name.toLowerCase().includes(needle)` over tool names only. The
group whose title is **"Design tokens"** and whose purpose is *"change the design system"* holds
`set_project_tokens` and `set_style_preset` — so `query: "theme"`, `"design"`, `"colour"`, `"style
guide"` and `"palette"` all reveal **nothing**, while `group: "theme"` reveals both.

🔴 **Where it bites.** This is a contributing cause of D10 itself. The style write tools are
deferred; an agent that has been told to style on-system searches for the words it is thinking in
and is told there is nothing there. Matching group titles and purposes as well as tool names is a
small change with a direct line to "the generators bypass the design system".

---

## D16 — ✅ FIXED 2026-08-28 (s6): `visible: false` kept the element's box, so every gated screen had a hole in it

Known and recorded (D7, and the runtime is explicit: `node-shared-port-definitions.ts:215` —
*"Hides the element while keeping the space it occupies in the layout"*, implemented as
`visibility: hidden`). What is new is the **measurement of what it looks like**: the rendered
`Pages/Post` is a heading, roughly 500px of nothing, and a back button, because the moderator's two
forms are hidden rather than unmounted.

`mounted` is a standard input on every visual node (*"a false value keeps the node out of the
tree"*) and would remove both the hole and the shipped-to-everyone subtree of D7.

~~⚠️ **NOT changed this session, deliberately.**~~ Done in s6, with the drives — see D7 for the
mechanism, the ratchets and why the `For Each` race does not arise.

### The measurement, same page, same harness

| | `visible` (before) | `mounted` (after) |
|---|---|---|
| what `Pages/Post` renders to a non-moderator | heading, **~500px of nothing**, back button | heading, back button |
| texts in the document | **15** | **2** |

🔴 **The text count is the D7 half and the picture is the D16 half, from one reading.** Fifteen
texts is the entire moderator form — two labelled inputs, a textarea, five more fields and both
submit buttons — sitting in the document of somebody who is not a moderator. Two is the heading and
the back button, which is all that page has to say to them.

---

## D18 — 🔴 Form controls ignore the project's `--font-sans`: an `input` renders Arial and a `textarea` renders **monospace**

Measured 2026-08-29 (s7) on `Pages/Setup` of the shipped artefact, rendered from disk through
`scripts/devtools/render-report.js` and read with `getComputedStyle`:

| element | `font-family` |
|---|---|
| the page's `label` | `"Source Sans Pro", "Segoe UI", …` — **the project's `--font-sans`** ✅ |
| `net.noodl.controls.textinput` → `<input>` | **`Arial`** |
| the same node with `type: 'textArea'` → `<textarea>` | **`monospace`** |

🔴 **The label proves the token is reaching the page.** It is the controls that never receive it —
these are the browser's UA defaults for form elements, which is what you get when nothing sets
`font-family` on them at all. So the same node type renders in two different typefaces depending on
one parameter, and neither is the app's.

🔴 **Where it bites a person.** Every form in every NodeGX app is in a typeface the app does not
use, and any multi-line field looks like a code editor sitting in the middle of a sign-up form. It
is on the setup screen of this template — the first screen the person who installs it ever fills
in. **Found by looking at a screenshot**; five drive specs, a 42-spec byte gate and the appearance
ratchet are all green over it, and none of them can see a font.

⚠️ **Not repairable from the template.** `FIELD` in `tpl001Components.ts` already sets nine style
parameters and there is no `fontFamily` among the ones the door accepts for this node, so a template
author cannot fix their own form. Product-side, and it is one line of CSS.

### 🔴 Widened 2026-08-29 (s8): it is not "forms", it is **every control** — including buttons

Measured on `Pages/Landing` of the shipped artefact, same instrument, same run as the hero work:

| element | `font-family` |
|---|---|
| the eyebrow, the headline, the blurb (`Text`) | `"Source Sans Pro", …` ✅ |
| **"Members sign in"** — `net.noodl.controls.button` | **`Arial`** |
| **"Ask to join"** — the same node type | **`Arial`** |

🔴 **This moves the blast radius from "any app with a form" to "any app at all".** A button is on
every page of every template; the landing page a stranger sees before they have typed anything is
already in two typefaces. It also means the defect is visible in the screenshots in this repo and
has been all along — nobody looked at the *buttons*.

⚠️ **And the vocabulary actively tells an agent not to fix it.** The `body` composition's own
description reads *"Never set `fontFamily` — the project body already carries `var(--font-sans)`"*.
That is true for `Text` and false for every control: `<button>`, `<input>` and `<textarea>` do not
inherit `font-family` from `body` in any browser. An agent doing exactly what the design system says
produces an app in three typefaces.

🔴 **This is the strongest argument yet that D18 is not a `DEF-001` a11y row.** Nothing here is
illegible — it is the product failing to apply its own design token to the elements a person
actually touches. Whatever task takes it should be about **fidelity**, and the `body` composition's
description has to change in the same breath or the next agent re-derives the same wrong conclusion.

### 🔴 Narrowed at source, 2026-08-29: it is every control **except `select`**

Found by phase 80's owner and **re-measured here rather than relayed**, because the whole point of
this file is that a row is a measurement. `packages/noodl-viewer-react/src/assets/style.css` contains
**exactly one `font-family` declaration in the whole file**:

```
98:  .ndl-controls-select {
…
107:   font-family: inherit;
```

Ten `.ndl-controls-*` classes ship — `button`, `textinput`, `checkbox`, `radio`, `radiobutton`,
`range`, `fieldset`, `abs-center`, `pointer`, `select`. **One** of them inherits the page's font.
The rendering measurements above (Arial on `input` and `button`, monospace on `textarea`) and this
are the same fact from opposite ends.

Two things follow, and both change how the fix should be scoped:

- ✅ **The correct rule already exists in the file, for one of the ten.** That marks the other nine
  as an omission rather than a decision, and it means the fix is the line that is already there,
  repeated — not a design question anybody needs to settle first.
- ⚠️ **`select` is exactly the control that would have looked right.** Anyone who spot-checked
  "does the app's font reach the controls" using a dropdown would have seen it work and stopped.
  That is a plausible account of how this survived to a shipped template, and it is a reason to
  distrust single-control checks of any design token.

🔴 **`StyleCompositions.ts:382` is part of the fix, not a footnote.** The `body` composition's
description — *"Never set `fontFamily` — the project body already carries `var(--font-sans)`"* — is
what an agent reads **before deciding not to set a font**. Repairing the CSS and leaving that line
regenerates the defect the next time a generator styles a control.

---

## D19 — ⚠️ A control's own label is pure `#000`, not `--foreground`, and no composition can reach it

Same reading as D18. The `useLabel` label renders `rgb(0, 0, 0)` while the input's text beside it
renders `rgb(20, 32, 26)` — `--foreground`, correctly tokenised. Pure black is not in this
template's palette and is not in any preset's.

⚠️ Smaller than D18 and the same family: the parts of a control the design system does not reach.
The label gets the font token and not the colour token, which is the kind of half-wiring that only
shows up when somebody renders it and reads the pixels.

---

## D20 — 🔴 The vocabulary ships 18 compositions and not one for a form field, a notice, or an empty state

`get_style_vocabulary` reports `card`, `cardBody`, `band`, `shell`, `primaryButton`,
`outlineButton`, the type ramp, two grid helpers — and nothing for the three things an app is mostly
made of:

| what an app needs constantly | composition | what this template had to do |
|---|---|---|
| a field a person types into | **none** | hand-author `FIELD`, 9 parameters, 17 instances |
| a notice / refusal / confirmation | **none** | hand-author `NOTICE`, and a `notice()` node-pair helper |
| an empty state | **none** | the same `NOTICE` |

🔴 **This is the mechanism behind D10, not a separate taste question.** A generator told to style
on-system opens the vocabulary, finds nothing for the element in front of it, and writes bare text —
which is exactly the artefact Richard drove and called *"so basic, black and white"*. The 31 unstyled
`Text` nodes s7 fixed were not laziness; for the notices and empty states there was **nothing to
reach for**.

⚠️ It also means every template that ships will hand-author its own, and they will differ. Two
templates now have two unrelated ideas of what a form field looks like.

⚠️ **And a composition alone would not be enough for a notice**, which is worth recording because it
is the non-obvious half: a notice is a `Group` wrapping a `Text`, because `Group` carries the
surfaces and `Text` carries the type ramp. A composition names parameters for **one** node, so the
vocabulary would need a two-node *pattern*, which is a shape it currently has no way to express.

---

## D21 — ✅ Disproved. A component instance's parameters *are* checked; the `info` line saying they are not is about a different check

**Kept because it cost a measurement and looks exactly like D1.** Filed under this file's second
house rule: a candidate that turns out to be nothing is worth as much as a real row.

Authoring `Pages/Landing`'s three tiles as instances of `Members/InsideTile` (s8) added **six new
`info` diagnostics** to a generation run that had reported `55 × dynamic-port-skipped` and nothing
else for several sessions. All six read:

> The **"parameter values"** check did not run on this node: type `/Members/InsideTile` is not in the
> node catalog, so there is nothing to check it against. The node is unverified by this check rather
> than verified as correct.

That is D1's exact shape — *the door does not check the thing that carries all the meaning* — and the
three instances carry every visible word on those tiles in two parameters.

🔴 **It is not a hole. Measured by sabotage, not by reading the code.** `titel` (a typo of `title`)
and `nonsenseXyz: 42` were put on one instance and the template regenerated:

```
create_component "Pages/Landing" rejected — nothing was written.
  instance-unknown-parameter (warning, blocking):
  "titel" is not an input of /Members/InsideTile. A component instance has only the ports its
  Component Inputs node declares — it carries no layout, style or lifecycle ports of its own —
  and this one declares 2: "title", "line"
```

**Both** bad parameters were caught, the message named the fix, and nothing was written. The
catalog-driven check genuinely does not run on a project component type; a **dedicated** check
covers the same ground and is stricter than the generic one would have been.

⚠️ **The trap, for whoever reads the census next.** The generation summary prints
`6 × info unknown-type-check-skipped` with no location, so it reads as "six unverified nodes". The
control that settles it is cheap: regenerate from `HEAD` (55, nothing else), then with the change
(61). The six are three instances × two passes, and they are the *absence of a check that is not
needed*, beside a check that fired.

✅ This also confirms, from the other side, the standing note that **the door checks parameters and
not wires** on a component instance. Parameters: refused, by name. Wires: D1.

---

## D22 — 🔴 The directory shows the founding moderator's email address as their name, twice

Found 2026-08-29 (s8) by the first tour of every page **with content seeded** — which is exactly the
reading TPL-001 §12 recorded as owed and nobody had taken. On a fresh install the directory's only
row reads:

```
ruth@stanywhere.invalid          <- the name
ruth@stanywhere.invalid          <- the email
Moderator · since 2026-08-29
```

`claimAssociation` takes `associationName`, `blurb`, `email` and `password` and **never asks for a
person's name**, so it writes the address into `Member.name`. Every install, on the first screen a
moderator opens when they click "Who belongs".

⚠️ **Template-side and cheap**: the setup form should ask the founder their name. It is also the one
place the template can demonstrate that the directory is about people.

---

## D23 — ⚠️ Two different pages are both headed "Members"

`/members` (the noticeboard) and `/directory` (who belongs). Measured off `body.innerText` on both:
the first line of each is the word `Members`. The directory's own button on the members page says
**"Who belongs"**, which is the better heading and is already written.

---

## D24 — ⚠️ Approve and Decline are touching

The request row's button pair sets no gap, so the two controls share an edge. `Pages/Landing`'s pair
sets `columnGap: var(--space-3)` and reads correctly; this row was never given one. It is the same
class as the s7 finding about announcement cards with no gap between them — **a pair with no gap
reads as one object**, and here the two objects are *approve* and *decline*.

---

## D25 — ✅ FIXED in Track A. Re-measured 2026-08-29 (s10) and the row was stale.

🔴 **The row said `open` for a day after the fix shipped.** Track A (`98bfdea0`) replaced all three
formats with one `humanDay()` snippet and wrote the reason into `HUMAN_DAY_FN`'s own doc comment —
including that `new Date('2026-09-14')` parses as **UTC midnight**, so every meeting rendered a day
early west of Greenwich. Nobody came back and moved this row. Recorded because it is the failure the
table's own preamble warns about: a `status` column is as-recorded, and an unread row is worse than
no row.

**Measured on the artefact, 2026-08-29** — not on the task file:

| | |
|---|---|
| `toLocaleDateString` call sites in `templates/members-area/` | **5, all identical** (`day: 'numeric', month: 'long', year: 'numeric'`) |
| occurrences of `YYYY-MM-DD` anywhere in the artefact | **0** |
| what the drives render | `20 August 2026`, `29 August 2026`, `1 January 2099` |

### What it was

| where | renders |
|---|---|
| announcement rows | `26/08/2026` |
| the directory | `2026-08-29` |
| the meeting form's label | `Date (YYYY-MM-DD)` |

The third is the worst: a **storage format shown to a person filling in a form**. Same family as the
P75 finding where a template card drew the machine slug `starter` at a builder.

---

## D26 — 🔴 The vocabulary has no composition that makes two things look *different* from each other

**This is D20's larger half and it is the reason a NodeGX app reads as generic.** D20 says the
vocabulary ships nothing for a field, a notice or an empty state. Touring all eleven pages says
something worse: of the eighteen compositions, there is exactly **one surface** — `card`.

So announcement rows, meeting rows, request rows, directory rows, notices, form panels, the moderator
toolbar and the landing tiles — **nine kinds of thing** — all wear the same `--surface` fill, the same
`--radius-xl` and the same 1px hairline, because that is the only box on offer. An agent told to style
on-system reaches for the only surface there is, every time.

🔴 **Where it bites.** Richard, 2026-08-29, on seeing the landing page: *"It's definitely got that
standard bootstrap feel about it."* That is the accurate description of a kit whose whole visual
vocabulary is one rounded rectangle. It will hit **every** template we ship, so it is worth more than
this template's own styling work.

⚠️ **Not a request for more compositions — a request for contrast between them.** A second surface
that is flat and edged rather than filled and rounded, or a row treatment that is a rule rather than a
box, would do more than ten more variants of `card`. Related: the template uses **none** of `band`,
`bandSurface`, `columnsTwoUp` or `gridAutoFit`, so part of the sameness is ours and part is the kit's;
D26 is the kit's part.

---

## D27 — ✅ Fixed s8. Ten nodes across all four cloud functions whose `failure` reached nothing

**Found by a validation rule a peer was writing at the same moment**, not by this phase: generation
suddenly refused with `failure-reaches-nothing`, from `failureReachesNothing.ts` sitting untracked in
the working tree. The rule is right and it caught a real defect in this template.

### What it was

A cloud function's request ends only when a response node fires. Ten nodes could throw and had no
connection on their `Failure` output at all, so the caller waited the full **30 seconds for a 504**
with no message — **P77's D1, inside our own template**, while phase 78 was busy filing product
defects about exactly this class.

| function | nodes | now answers |
|---|---|---|
| `claimAssociation` | `gate`, `founding`, `founder` | `deny` for the gate's throw; **`res`** for the two directory writes |
| `requestAccess` | `prep`, `stamp`, `received` | `deny` |
| `myStanding` | `gate`, `decide` | **`unknown`** |
| `decideMembership` | `prep`, `route` | `deny` |

### 🔴 The comment that made it invisible

`claimAssociation`'s wiring carried, in writing, since the function was authored:

> *"🔴 `founder` reaches NEITHER response, and that is the whole decision about it."*

It reads as settled, and the reasoning under it is sound — telling a moderator who already holds
`role:admin` that setup failed would be worse, with no second setup possible. But **"do not tell them
it failed" and "send nothing at all" are different things**, and the graph did the second. The
decision was right; its implementation hung the request.

⚠️ **This is the shape to watch for.** A confident comment explaining why a node deliberately does
not reach one response reads, to every later reader, as an explanation of why it reaches nothing.

### Where the judgement was not mechanical

Two of the four functions needed a real decision rather than "wire it to `deny`":

- **`claimAssociation`'s two directory writes answer `res`** — by that point the account exists and
  holds the role, so success is the honest answer, and `mark.failure → res` was already the precedent.
- **`myStanding` answers `unknown`**, a third response that exists precisely for *"we could not check
  your membership just now"*. Answering `res` would have sent a standing nobody computed — the one
  thing that endpoint must never invent, because every gated screen in the template reads it.

---

## D28 — 🔴 A button inside a `Columns` overlaps the next one, because both button compositions pin `sizeMode: 'contentSize'`

**Measured, s9, by rendering the members' band at 1280×900 and looking at it:** the five nav items
were laid out in a `net.noodl.visual.columns`, and "Announcements" was drawn **straight across the
left edge of "Meetings"**.

The mechanism is a disagreement between two parts of the product that are meant to be used together:

- `calcAutoFit` (`Columns.tsx`) divides the container into `floor((width + marginX) / (minWidth +
  marginX))` equal boxes and hands each child exactly one.
- `outlineButton` and `primaryButton` (`StyleCompositions.ts`) both ship `sizeMode: 'contentSize'`,
  which tells the node to keep its own intrinsic width and ignore the box.

So **following the design system verbatim, inside the one node in the runtime that reflows, produces
overlapping controls.** `gridAutoFit`'s own description — *"fits as many columns as the CONTAINER
holds and reflows itself — no breakpoints to maintain"* — is what sends an author here, and nothing
in either description mentions the other.

🔴 **Where it bites.** Any agent told to build a responsive row of actions. The vocabulary offers
exactly one node that reflows and exactly two button recipes, and the three of them do not compose.

⚠️ **And it hides at the width people check.** The overlap is a function of how much room a column
has, so it appears at **wide** viewports, where the auto-fit makes many narrow columns, and vanishes
at 390px, where two wide ones fit the words. Every layout habit built up this phase — *check 390px
before committing* — points away from it.

⚠️ **It was already shipped, two pixels from visible.** `Pages/Members`' three moderator actions have
been in a `Columns` since s8: "Requests to join" measures ~163px of content into a ~165px box at
390px. It cleared, so it read as correct, and it would have failed on a different font. The template
side is fixed by `inColumn()` in `tpl001Components.ts` — a rule over *being a child of a `Columns`*
rather than a fix on the node that showed the symptom — and gated by a whole-artefact sweep in
`tpl001Template.test.ts` that reddens on any content-sized child.

**What the product needs** is one of: `Columns` clamping its children's width, a `contentHeight`
variant of the button compositions, or — cheapest and most honest — the `gridAutoFit` description
saying that a `contentSize` child will overflow its column.

---

## D29 — ⚠️ `Members/Chrome` asks the server who you are a second time, on every page

**Filed by the session that caused it, s9, rather than left for a reader to find.** The band carries
three moderator-only destinations, so something has to gate them, and the band now places its own
`Members/Standing` and fires it from its root `Group`'s `didMount`. Every signed-in page therefore
makes **two `myStanding` calls**: the page's and the band's.

⚠️ **Why the cheaper shape was not taken.** The band could publish standing as component outputs and
the five pages that own an instance could consume it instead — one call, less graph. That is a better
app and it was a worse change to make this session: **every gate AC2, AC3 and AC4 rest on is one of
those wires**, and rewiring them means re-grading the boundary, not the layout. It is a change worth
making beside a drive, not before one.

⚠️ **Why the band could not simply borrow the page's answer.** Two of the seven pages carrying it —
`Pages/Announcement` and `Pages/Meeting` — have no `Members/Standing` at all, deliberately: the record
read is their gate. Taking the answer from the page would have given a moderator their navigation on
five screens and silently removed it on the two they reach by clicking a row.

**Not a correctness defect** — the two calls are reads, they cannot disagree in a way that matters,
and the drive passes 71/71 with both in place. It is a cost, and it is written down so the next
session decides about it rather than discovers it.

---

## D30 — 🔴 The type ramp cannot reach `font-variant-numeric`, so no app built here can align a column of numbers

**Severity: medium. Owner: NONE. Side: product.** Found by TPL-001 Track B4, whose third item —
*"tabular numerals on dates"* — turned out to be unreachable through the door.

### The measurement

Every `Text` in the runtime gets its type ramp from one shared port group,
[`node-shared-port-definitions.ts:1452`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts).
The group is exactly nine ports:

`textStyle` · `fontFamily` · `fontSize` · `fontWeight` · `fontStyle` · `color` · `letterSpacing` ·
`lineHeight` · `textTransform`

There is no `fontVariantNumeric`, and a parameter naming a port that does not exist is dropped — so
**tabular figures cannot be set on any node, by any template, by an agent, or by a person in the
style panel.**

⚠️ **Beside a known-firing signal, so the absence is a reading and not a failed search.** The same
grep over the same file finds `letterSpacing` (line 1686) and `textTransform` (line 1733) — two
ports of the same kind, declared the same way, in the same block. The instrument fires; the port is
not there.

🔴 **And there is no escape hatch.** A template's `nodegx.project.json` carries `settings` and
`metadata.designTokens` and nothing else — no stylesheet, no class, no CSS. A design token is a
*value*; `font-variant-numeric` needs a *property* to consume it, and no port exposes one. So this
cannot be worked around in a template the way `--border-control` was.

### Where it bites a person

Any app with a column of numbers: subscriptions and amounts, kick-off times, scores, stock counts,
invoice totals. With proportional figures a right-aligned money column is visibly ragged — `1` is
narrower than `8` in most sans faces — and the usual one-line CSS fix is unavailable. This is the
first template to look for it and it will not be the last: an association's treasurer's report is
the obvious second screen of the members' area.

### ⚠️ Why TPL-001 does not need it, and why that is not a reason to close this

The template's one date format, since Track A, is `20 August 2026` — prose, not a numeric grid.
Month names differ in width, so tabular figures would align nothing here even if they were
reachable. **B4 therefore shipped without them deliberately**, on the merits rather than because the
port was missing, and the two reasons are independent: the item was worth dropping *and* it could
not have been done. The gap is filed because the next template will have a table in it.
