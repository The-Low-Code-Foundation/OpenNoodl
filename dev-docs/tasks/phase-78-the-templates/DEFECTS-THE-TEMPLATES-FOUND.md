# Defects the templates found

**Richard, 2026-08-28:** *"If you find a problem with the codebase or MCP or whatever, add it to
the next session prompt to fix please. We're making templates to surface bugs and issues with the
whole NodeGX concept as well."*

So this file is a **standing output of phase 78**, not a one-off. Building a real app through the
real doors is the only thing that exercises them the way a customer will, and what it turns up
belongs here the moment it is measured.

## House rules for this file

- 🔴 **A row is a measurement, not an impression.** Say what was done and what happened. A defect
  filed on a hunch costs the next session more than it saves.
- ⚠️ **Disproved candidates stay, marked.** "I thought this was broken and it is not" is worth as
  much as a real row — it stops the next person re-deriving it. See D6.
- Each row names **where it bites a person**, not just where the code is wrong.

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

## D7 — ⚠️ A `visible: false` group ships its whole subtree to everyone

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
