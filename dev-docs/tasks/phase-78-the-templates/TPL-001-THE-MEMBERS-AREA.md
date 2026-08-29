# TPL-001 — The members' area

**Phase 78's first template.** Richard, 2026-08-28: *"a 'membership' app for charities,
associations, churches etc where users can log in and access restricted, curated content added by
the moderators or admins… a members-only website behind a simple landing page advertising their
association."*

Category **`data-app`** — see §7 on why not `site`.

## 1. The person sentence

**A church secretary picks "Members' area", finishes the wizard, and has a working members-only
site: a public page saying who they are, a sign-in behind it, announcements and upcoming meetings
that only members can read, and a way to post them that does not involve a developer.**

## 2. Why this app

It is the shape of an entire market NodeGX is aimed at — a charity, a club, a congregation, a
professional association — and each of them currently owns this app in three broken pieces: a
website nobody can edit, a mailing list, and a WhatsApp group. It is also **instantly legible on
a shelf card**, which matters when the shelf has one row on it.

Two structural reasons it is the right *first* one:

- **It is the control on SBR-001/002.** The wizard's create → attach → start → bind →
  security-policy path has been exercised by exactly one template. This is a second, and it
  either confirms the attach is template-generic or finds the site-builder-shaped hole while P77
  is still live to absorb the finding.
- **It exercises roles**, which the site builder only ever uses as `role:admin` on its own
  tables. This template's whole product is *what a non-member cannot see*.

## 3. Scope — TPL-001 is the app WITHOUT email

🔴 **The notifications are [TPL-002](TPL-002-THE-OPT-IN-NOTIFICATIONS.md), deliberately.** This
task ships a complete, publishable template on its own; TPL-002 adds the email fan-out on top.
The split is not tidiness — email depends on SMTP config the template cannot ship (§6), so
binding the two together would mean the shelf's first row could not be finished until an external
dependency was solved.

Public:

- **Landing** — who the association is, and how to join. ⚠️ **Deliberately a plain page
  component.** Do not reach for site-builder machinery: P77 owns it, and phase 78 T4 is parked
  behind that work.
- **Sign in / Request access** — a person asks to join; an admin approves. (Self-registration
  with approval is the real flow for these organisations; open registration would let a stranger
  into the members' area, which is the one thing this template exists to prevent.)

Members-only:

- **Announcements** — a list, newest first, and a detail view.
- **Meetings** — upcoming ones, with date, place and description.
- **Account** — name, and (from TPL-002) the notification opt-in.

Moderator / admin:

- **Post an announcement**, **add a meeting**, **approve or decline a request to join**, and see
  the member list.

Ships with the project:

- 🔴 **`nodegx.security.json`, written deliberately** (SB-015) — the product *is* the policy here.
  Do not copy the site builder's. Anonymous gets the landing page and nothing else; a **pending**
  member is not a member; members read; only `role:admin` writes.
- A shelf `summary` written as the sentence someone would type into the box. The search ORs terms
  over title + summary, and that is the whole document being ranked — "members only site for a
  club, charity or church" is a better summary than anything with the word "template" in it.

## 4. How it is built — through the door, headless

Follow `scripts/generate-site-template.ts` (SB-007): author the components **through the MCP
door**, read back with the editor's own `ProjectImporter`, write one JSON, and let a spec re-run
the generation and assert byte-identity. SB-007 chose this over hand-writing graphs because a
hand-written twin agrees with the artefact until the first edit that reaches one of them.

🔴 **It also keeps TPL-001 off P77's back** — generation needs no editor seat, which P77 is using
for SBR-004's drives. Only the drive (§5) and the share need the editor, by appointment.

## 5. Acceptance criteria

1. **(person)** Picking "Members' area" and finishing the wizard lands on a working public
   landing page — backend created, started, bound, enforcing this template's policy, with no
   detour through Backend Services and no white void. Driven on a wizard-fresh project.
2. **(person)** A signed-in member sees announcements and meetings. **Negative control, and the
   one that matters most: signed out, the same URLs yield nothing** — not a flash of content, not
   an empty shell that briefly rendered the data, *nothing* — asserted beside a known-firing
   signed-in read so the absence is a refusal and not a wrong query.
3. **(person)** A **pending** member — approved by nobody — is refused exactly as an anonymous
   visitor is. This is its own row because it is the failure mode a hand-rolled version of this
   app always has.
4. **(person)** An admin posts an announcement and a member sees it. A member who tries to post
   cannot — the control is that the *member's* UI does not offer it **and** the write is refused
   server-side. UI-only enforcement fails this AC.
5. **(person)** An admin approves a request to join, and that person can now sign in and read.
6. The first thing a person sees on a fresh install is a designed empty state, not a blank list.
   **A template ships graphs, not rows** — the collection is empty on install, and that screen is
   the first impression. (Seeding sample content stays open and additive.)
7. Generation is deterministic and gated: committed JSON byte-identical to a fresh run; a
   component-set edit without regeneration reddens.
8. The submission files with `category: 'data-app'`, a written summary, and an excluded-files
   list that is **read and checked** — this project has a backend and auth, so the check is not a
   formality.

## 6. What the association must supply, and what that costs

Nothing for TPL-001 — that is the point of the split. TPL-002's email needs SMTP credentials in
the backend's own `secrets.json` (`email` namespace) and `email.json` config, neither of which is
a project file and neither of which a template may carry. See TPL-002 §2.

## 7. The category, and why not `site`

`data-app`. It is arguably a `site`, and a reasonable person would file it either way — but the
product is the restricted content, the roles and the approval flow; the landing page is one page.
🔴 **The rule that decides it: this template must not need a new slug.** The vocabulary is ruled
(`starter`, `data-app`, `dashboard`, `site`, `form`, `integration`) and lives in **four copies**;
extending it is phase 78 **T3**, which is parked behind P77 because the vocabulary constant sits
in `ProjectTemplate.ts`, a file P77 is editing.

## 8. Traps

- 🔴 **A signal into a value port arrives once as `false`** — one entry per input name in the
  drain queue, so a true-then-false pair coalesces and an `=== true` guard never fires. SBR-002's
  watchdog could never bark. Every "saved", "approved" and "sent" flag here is that shape.
- 🔴 **`devOpen: true` disables row-level ACL entirely**, so locally every draft renders to every
  visitor — a members-only app tested with `devOpen: true` will look like it works and be wide
  open. Grade AC2 and AC3 with the policy actually enforcing.
- 🔴 **Deployed with `devOpen: false` and nothing else, collection reads fall back to
  `authenticated`** — which for this template means *any signed-in person*, including a pending
  one. AC3 exists because of this.
- 🔴 **A parameter is not a connection** — the export filters wires and copies parameters verbatim.
- 🔴 **Driving:** modal renders twice (stamp the non-Measuring copy, click twice);
  `elementFromPoint` before every click; `null` means below the fold, not hidden; the honest
  hidden signal is `visibility`; preview is 988×313 until a device size is picked.
- 🔴 **Shared checkout:** commit by pathspec (untracked ⇒ add+commit one chain), never
  stage-then-commit. `test:ci` alone. Announce editor launches **and** teardowns — P77 is driving.

## 9. Findings (s1, 2026-08-28)

The vertical slice is built, generated and committed: `App` + `Pages/Landing` +
`Pages/SignIn` + `Pages/Members`, authored through the door, `npm run template:members`,
artefact at `templates/members-area/`.

- ✅ **The pending state is mechanical, not a convention.** `roles/SystemRoles.ts` is the only
  way into `_Role` from a graph (`_noodl_system_roles`, cloud-function-only), and
  `users/SystemUsers.ts` guarantees a user it creates resolves to `roles: []` — *"a node that
  can create a user" is provably not "a node that can create an admin"*. So: visitor = no
  session, **pending = signed in with `roles: []`**, member = `role:member`, moderator =
  `role:admin`. 🔴 **Therefore no rule may say `authenticated`** — it is true for the pending
  user, and it is also what a deployed backend falls back to. The failure mode is the default.
- 🔴 **The Log Out node's signal input is named `login`.** Not a typo and not fixable —
  `logout.ts:67`: *"the port name is persisted in every project that uses this node."* Displayed
  as "Do". Found because the door refused `logout` and named the alternative.
- 🔴 **The door treats WARNINGS as refusals.** `unresolved-navigation` is `severity: warning`
  and still returns `isError`. That is why the deferred pass must run after **every** page
  exists — and it means a clean run is genuine evidence, not silence.
- 🔴 **A prepared directory cannot drop the volatile fields, so it must pin them — and the id
  lives in THREE files.** `component.json:id`, plus a `componentId` in both `nodes.json` and
  `connections.json`; the registry keeps per-component `created`/`modified` beside
  `lastUpdated`. The first normaliser pinned one of them and looked right. **Regenerating twice
  and diffing is what found it**; two runs are now byte-identical.
- ✅ **`startPage` is the first page written**, so `Pages/Landing` is authored first — a
  stranger meets the association, not a password box.

## 10. Where it stands (s2, 2026-08-28)

**The template is built: nineteen components, four endpoints, a hand-authored policy, and a
gate.** Nothing has been driven and nothing is published.

| | |
|---|---|
| artefact | `templates/members-area/` — 19 components, 10 pages, `startPage: /Pages/Landing` |
| policy | `templates/members-area.security.json`, hand-authored, copied in by the generator |
| graphs | `tpl001Components.ts` (browser), `tpl001Cloud.ts` (endpoints), `tpl001Vocabulary.ts` (the words both use) |
| gate | `tpl001Template.test.ts` — 41 specs, byte-identity plus the checks the door does not do |
| gates run | `typecheck:mcp` clean · noodl-mcp **834/834** · `test:ci` **2875 specs, 4 failures**, all four the known AIX-006 set by name |

### What it does now

- **Landing** reads the `Association` row — the one record a stranger may read — and shows a
  "not set up yet" card when there is none.
- **Setup** creates the first moderator against a backend secret (`ASSOCIATION_SETUP_TOKEN`),
  because a fresh backend has neither role and therefore nobody who can approve anybody.
- **Join** files a request; **Requests** is the moderators' queue, with Approve and Decline as two
  instances of one endpoint.
- **Members** is the hub: announcements, a pending notice, a moderator's toolbar. **Meetings** is
  the upcoming diary, filtered by an ISO day. Both notices and both lists have detail pages.
- **Post** is the moderator's desk: an announcement form and a meeting form.

### 🔴 What is deliberately NOT built, and it is scope from §3

- **The member directory.** §3's *"see the member list"* is **not buildable with the nodes that
  exist**: `getuserroles` reads one user's roles and nothing enumerates a role's members, and
  `_User` is a system class no browser query can reach. It needs a `Member` projection row
  written on approval — which is a second copy of a fact `_Role` already holds, so it wants a
  decision rather than a quiet implementation. **Ask Richard.**
- **The Account page.** §3 lists name plus the TPL-002 opt-in. The opt-in is TPL-002's, and a page
  that shows a person their own name and nothing else is not worth a route yet.
- **Seeded sample content.** AC6 says a template ships graphs, not rows, and every list ships a
  designed empty state instead. Still open and additive.

### The trade-off taken on privacy, which is Richard's to overturn

`requestAccess` answers an address that **already has an account** exactly as it answers a new
one, and files nothing in that case. Telling a stranger "you are already registered" tells them
who belongs to this congregation. The cost is that a returning person who has forgotten gets a
cheerful "your request has been passed to the moderators" and nothing happens; the join page
carries a standing line pointing them at sign-in. **If Richard would rather be plain, it is one
edge and one message.**

## 11. Findings (s2, 2026-08-28)

- 🔴 **The door does not check a connection to a component-instance port. At all.** Measured by
  sabotage: renaming `standing.isMember` to `standing.isMemberXX` in `Pages/Members` produced a
  run **identical** to the clean one — 46 `dynamic-port-skipped` infos and nothing else, no
  error, no warning, not even an info about the wire. It matters more here than almost anywhere
  else, because **every gate in this template is an instance port**: `isMember` reveals the
  content, `isModerator` reveals the moderator's tools, and `Member` / `Moderator` are the only
  triggers the queries have. A typo in any of them fails **shut and silently** — the same shape
  as SB-018 (1), a wire naming a port no runtime has, dead for five sessions. §3 of the spec is
  now that check.
- 🔴 **"The authoring run was clean" was a claim about the `isError` flag and nothing else.** The
  builder now collects every diagnostic the door raises and the generator prints them by code.
  Today: 46, all `info dynamic-port-skipped`, all about **parameters** — so the silence about
  connections is a real absence rather than an unread payload. It also makes the instrument
  known-firing: something is being counted.
- 🔴 **The door de-duplicates node ids across the whole project, not per component.** A second
  component reusing `emptyState` is written as `emptyState-2`. Two assertions were written against
  authored ids and failed on the third page; they now find nodes by **what they are** (the text
  they carry, the script they run), which is what they were about anyway.
- 🔴 **A hand-authored file cannot live in the generated directory.** The generator clears
  `templates/members-area/` wholesale before copying the door's output in, so a policy written
  there would be deleted by the next regeneration — silently, and leaving the artefact looking
  complete. The source is `templates/members-area.security.json`, **beside** the directory, copied
  in as the last step. ✅ That also *removes* the exclusion the handoff expected: a regeneration
  reproduces the whole artefact including the policy, so the drift gate compares everything.
- 🔴 **The drift gate did not compare bytes until it was made to.** Written first, it compared
  component-key lists and the policy file and was named "reproduces every committed byte". The
  pinning lived in `scripts/` where a spec could not reach it, so the gate could only re-check
  *some* of the artefact — the exact failure `toTemplateContent`'s own comment warns about.
  `prepareArtefact` moved into `tpl001Template.ts` and the spec now runs **the same code the
  generator runs**, not a twin of it.
- ✅ **All three headline gates were shown to fail on a deliberate defect before being trusted** —
  the instance-port check on `isMemberXX`, the `authenticated` sweep on one changed rule, the
  byte gate on one hand-edited artefact file — then restored, regenerated and re-run green.
- ✅ **`validateSecurityConfig` is imported from `nodegx-backend` and run over the shipped
  policy**, with a control that shows it rejects a bad one. An invalid policy is a backend that
  refuses to start on the association's machine, after they installed the template.
- 🔴 **`role:member` alone would lock the moderator out of what they just posted.** Roles are
  flat: a moderator is not implicitly a member, so every members-only read rule is the two-atom
  array `["role:member", "role:admin"]`, and the standing component reports `isMember` true for a
  moderator. One-atom rules are the obvious version and they are wrong.
- 🔴 **`defaults` is `nobody` on all five operations**, not `authenticated`. The shipped default
  is `authenticated`, which for this template is every pending member reading everything, and it
  is what a collection read falls back to when nobody wrote a rule. `nobody` means a class
  somebody adds later is refused **loudly** rather than opened silently.


## 12. The drive (s3, 2026-08-28) — 🟢 AC2, AC3, AC4, AC5 measured

**The template has been run.** Nineteen components that had never executed now have
**45 specs across two files** taken against a real enforcing backend and a real headless browser.

| | |
|---|---|
| the drive | `packages/nodegx-backend/tests/tpl001-members-drive.test.ts` — 39 specs |
| D4's arm | `packages/nodegx-backend/tests/tpl001-refused-query.test.ts` — 6 specs |
| the harness | `packages/nodegx-backend/tests/helpers/members-drive.ts` |
| subject | `templates/members-area/` — **the shipped directory**, copied and served, not re-authored |
| conditions | `devOpen: false` asserted from `started.security.enforced`; policy read from the shipped file |
| gates | nodegx-backend **1280 passed / 10 skipped, 111 suites** · `typecheck` clean · noodl-mcp **834/834** · `typecheck:mcp` clean |

⚠️ **`test:ci` was not run** — nothing in the editor was touched, and a peer held the editor stack
for SBR-004 for the whole session.

### What each criterion now rests on

- **AC2** — a moderator and an approved member read the announcement, over HTTP *and* in the
  browser (the known-firing signal). Signed out, `/members` and `/meetings` **navigate the
  stranger back to the public landing page** — `standing.Visitor → toLanding.navigate`, so it is a
  refusal and not an empty screen — the announcement appears nowhere in `outerHTML`, and the
  server answers **403** rather than an empty list.
- **AC3** — a **pending** person, signed in (asserted: a real session token from the app's own
  form), gets the pending notice, no announcement anywhere in the document, no moderator tools,
  and **the same 403 with the same body as an anonymous stranger**. That comparison is the AC's
  whole sentence.
- **AC4** — the moderator is offered `Post something` / `Requests to join` and the member is not
  (same run, same instrument); `/post` reached by URL says *Only a moderator can post here*; and
  the server answers **403** to a member's `POST /classes/Announcement` and to a member's
  `decideMembership`. UI-only enforcement would have passed the first three and failed the fourth.
- **AC5** — the moderator saw both names in the queue, **Approve was clicked in Mo's own row**,
  the queue then listed only Pat, and Mo signed in and read — while Pat, in the same run, is
  still refused. The only difference between the two readings is that click.
- **AC1** — 🔴 **still not gradeable, and it is not a gap in the work.** It says *pick "Members'
  area" and finish the wizard*, and delivery is **curated**: until Richard publishes there is no
  picker row to pick. What the drive does grade is every part that does not depend on
  publication — the directory boots, binds, and renders its landing page to a stranger with no
  white void. **The rest of AC1 belongs to T5.**
- **AC6** — the empty states were not measured this session: content is seeded before the first
  visit. Cheap to add and it is the only acceptance criterion with no reading against it.

### 🔴 The Post page was driven, because the door cannot check any of it

The seeded announcement exercises nothing the template writes. So the moderator **types** into the
Post page and submits: five `prop-*` wires across two `NewDbModelProperties` nodes, plus
`stampAnnouncement.out-go`. All of it works — the confirmation lines appear, and a **different
person in a later session** reads the row back with `body`, `when`, `place` and `details` intact.
That is the class TPL-001 §11 says the door is silent about, and it is now covered by execution.

Between them the drive exercises every wire class D1 names: the eight component-instance ports,
`in-*`/`out-*` on all four `CloudFunction2` nodes, `prop-*` on both records nodes, and `qp-today`
on the meetings filter. **None of them was wrong.** The door's silence hid nothing here — which is
worth saying plainly, because it is evidence about this template and not about the door.

## 13. Findings (s3, 2026-08-28)

- 🔴 **D4 is answered, and the answer reverses what was recorded.** A refused query **is**
  distinguishable from an empty one: `DbCollection2.failure` fires on a 403. Measured with a
  two-wire twin (`didMount → storageFetch`, `failure → toLanding.navigate`) and a control — the
  allowed person drew rows and stayed on `/members`; the refused person was navigated to `/`. The
  runtime also logs `query-records/query-failed`, only for the refused arm. **This downgrades D2
  from a necessity to a convenience.** ⚠️ It does not loosen this template's design: branching on
  `failure` means issuing the members-only query for every stranger and flickering through
  "nothing here" on the way to "you may not", where `myStanding` stops it being issued at all.
- 🔴 **The first version of that twin was wired through the platform's own broken seam and read
  exactly inverted.** `failure` (a **signal**) into `unknownNotice.visible` (a **value** port)
  painted the notice for the person whose query **succeeded** and left it dark for the person who
  was **refused**. A fourth sighting of the signal-into-a-value-port class, in a new shape — not
  "the signal never arrives" but "it arrives on the wrong arm". **An instrument built out of a
  seam you already know is broken measures the seam.** The fix was to make the twin
  signal-to-signal throughout.
- 🔴 **An absence read off a button's `innerText` is not a measurement.** `innerText` **skips**
  `display: none`; `textContent` does not. Every "the member was not offered the moderator tools"
  assertion here passed on that quirk before it passed on anything else — the buttons were on the
  page. The harness now separates **`present`** (in the document), **`painted`** (has a box) and
  **`reachable`** (hit-testable at this scroll), and an absence claim belongs on `painted`.
- 🔴 **…and `reachable` alone would have made the absence satisfiable by scrolling.**
  `elementFromPoint` answers `null` for any coordinate outside the viewport, so a button four
  hundred pixels down reads exactly like one behind a modal. It cost two false "the button is
  blocked" findings before both click helpers learned to scroll to the control and *then* say so.
- ⚠️ **The moderator's form ships in every member's document, unpainted.** `tools` is gated with
  `visible: false`, so both forms and both submit buttons are in the markup a member's browser
  holds. Not a leak — the forms are empty and the write is refused server-side — but "the member's
  UI does not offer it" is true only of what is *painted*. ✅ **The rule the template gets right is
  the one that matters**: every members-only **fetch** is gated on a standing signal, so hiding is
  never what keeps the data out.
- ⚠️ **The viewer bundle's mtime is not evidence about its contents.** The bundle predated three
  commits and was rebuilt on that reasoning; it then turned out to be **byte-for-byte the same
  size** as a fresh build and to already contain `_inputCauseQueue`, `_inputValuesQueue` and
  `textInputValue`. The changes were in the working tree before they were committed, and the
  third commit blamed (SB-018) touched **no runtime source at all**. ✅ **Grep the artefact for a
  marker; never infer staleness from mtime against a commit date.** The drive now stamps the
  bundle at both ends of the run and reddens if it moved, because a peer's dev stack rewrites it.
- ⚠️ **A stranger at `/members` is redirected, not shown an empty page.** Read as a routing bug
  for several minutes — `location.pathname` was `/` after navigating to `/members` — before
  `standing.Visitor → toLanding.navigate` explained it. It is the designed behaviour and it is
  better than the alternative; recorded so the next reader does not re-derive it.

## 14. The directory, and the first time a person opened it (s4, 2026-08-28)

**Richard ruled on all three open questions**, and the first two are now built.

| question | ruling |
|---|---|
| the member directory (§10) | **build the `Member` projection**, drift cost accepted |
| the privacy trade (§10) | **keep the non-answer** — `requestAccess` still answers an existing account exactly as a new one |
| publishing (T5) | **not yet** — *"I need to drive it myself before we talk about publishing"* |

### What was built

| | |
|---|---|
| collection | `Member` — `userId`, `name`, `email`, `joinedAt`, `standing`; moderator-only in the policy and in every row's ACL |
| written by | `decideMembership` on `grant.done`, and `claimAssociation` on the founding moderator |
| read by | `Pages/Directory` — moderator-gated, sorted by name, empty state, back button |
| the row | `Members/MemberRow` — the fourth repeater row |
| the way in | `Who belongs`, a third button on the moderator's toolbar |
| artefact | **21 components, 11 pages** (was 19 and 10) |

**Two decisions taken while building, both cheap to reverse:**

- 🔴 **Setup writes the founding moderator's own row.** Richard's ruling named
  `decideMembership`; setup is the *other* node in this template that puts somebody in a role, and
  without a row there the first moderator holds `role:admin`, is a member of the association in
  every sense, and is **absent from the only list they can open** — on a fresh install, where they
  are the only person in it. ⚠️ Setup asks for the *association's* name and never the moderator's,
  so the row's `name` is their email.
- 🔴 **The page says what it is.** `DIRECTORY_PROJECTION_NOTE` is painted above the list:
  *"Everybody admitted through this app. Somebody given access directly on the backend will not
  appear here."* The ruling was taken with the drift cost stated; a projection that omits people
  silently is worse than no list, and the person who needs that sentence is the moderator reading
  it, not the next developer.

⚠️ **Where the projection can be wrong, stated once**: `Member` is a copy of what `_Role` holds.
Every row is written by the endpoint that adds the role, in the same request, and nothing else
writes one — so it drifts only when a role changes **outside this app**. One failure edge is
deliberate: if the `Member` write fails after the role was granted, the queue entry is still
removed and the decision still succeeds (`member.failure → remove.store`). The person **is** a
member; making a projection able to block the membership decision it is a copy of would be the
worse bug. The cost is a member missing from the list, and it is silent.

### 🔴 The new query was invisible to the specs that make AC2 structural

Both AC2 specs filter on a **literal list** of members-only collections, so the directory's
`DbCollection2` — a members-only query by every argument in this file — was graded by neither
until `COLLECTION_MEMBER` was added to both lists and the counts moved 3 → 4.

✅ **Shown to discriminate before being trusted**, the rule §11 set:

| sabotage | what reddened |
|---|---|
| drop `NO_LOAD_TIME_FETCH` from the directory query | *every members-only query carries NO_LOAD_TIME_FETCH* |
| fetch on `page.didMount` instead of `standing.Moderator` | *each one's only trigger comes from the standing gate* |

⚠️ **The general shape**: a spec that names its population by literal list does not grow when the
product does. It stays green, and the green is about the four things somebody typed in a previous
session. **Anything added to this template must be added to those lists by hand** — and the count
assertions beside them are what force the question.

### 🔴 The template had no HOME node, and every headless gate passed over it

The one thing nothing in this phase had done: **open the artefact as a project and press
preview.** It rendered `ERROR — No HOME component selected`. Nothing in the app was reachable.

Full account in **[D9](DEFECTS-THE-TEMPLATES-FOUND.md)**, including why 45 drive specs and a
41-spec byte gate all agreed on a project the editor could not open — the drive navigates to URLs
and never asks the project what its home is, and byte-identity cannot see a defect present since
the first run. Fixed in `prepareArtefact` → `pinRootNode`.

✅ **The lesson for every template after this one**: the door a person uses is *open it and press
preview*, and it was outside every sweep here. A headless gate over a generated artefact grades
the artefact against the generator, never against the app.

### Gates (s4)

| | |
|---|---|
| template gate | `tpl001Template.test.ts` **41/41** |
| the drive | `tpl001-members-drive.test.ts` + `tpl001-refused-query.test.ts` **45/45**, against the regenerated artefact |
| noodl-mcp | **840/840**, 65 suites |
| `typecheck:mcp` | clean |

⚠️ **`test:ci` not run.** No editor source was touched — the changes are the generator, the graphs,
the gate and the policy. ⚠️ The drive was run **before** the editor stack came up; it reads the
viewer bundle and stamps it at both ends, and a live dev stack rewrites that file (D8).

### 🔴 What the directory still does not have: a reading

**It is built, gated and never executed.** The drive's own log shows `Who belongs` painted on the
moderator's toolbar and absent from the member's — that is the AC4 machinery working, not the
directory working. Nothing has opened `/directory`, and §12's whole argument is that a component
that has never run is not evidence about anything.

**Next, and it is small** — the harness already mints a moderator, an approved member and a
pending person:

1. The moderator opens `/directory` and sees **two** rows: themselves (`Moderator`) and the person
   they approved (`Member`) — which is also the one reading that proves setup's founding row and
   `decideMembership`'s projection row are both written.
2. A member reaches `/directory` by URL and is told *only a moderator can see the member list*,
   with no row anywhere in `outerHTML` — beside a **403** from the server on `Member.find`, since
   UI-only enforcement is what AC4 forbids.
3. The empty state, which belongs with **AC6** — the criterion that still has no reading.

## 11. The look (s5, 2026-08-28)

Richard drove it and said it did not look like a website. It was measured (137 visual nodes, **0**
colour parameters, **0** type-ramp parameters, **0** constrained widths, no token block), gated,
and then fixed — in that order, so the fix was not marking its own homework.

| | |
|---|---|
| the gate | `templateAppearance.test.ts` — **22 specs over every installable template**, written first |
| the design system | `tpl001Theme.ts` — the shipped `enterprise` preset plus 20 measured overrides |
| how it is applied | `find_tools({group:'theme'})` → `set_style_preset` → `set_project_tokens`, through the same door as the graphs |
| the parameter sets | `composition(id)` — looked up from `buildStyleVocabulary()`, never typed |
| the sweep | 11 page grounds · 18 texts · 25 buttons · 4 rows as cards · 17 fields |

🔴 **The open question from s4 is answered and the answer was the expensive one.** A preset alone
changes nothing a person can see: the shipped defaults are already the floor of `:root`, so
`var(--primary)` resolved before any of this and nothing referenced it. §2 of the ratchet went green
on the token block; §3 and §4 needed the sweep.

🔴 **The setup page greeted a person with a refusal before they typed** — seven `Condition` nodes
carrying a constant `condition: true` fired at load, because re-testing on value change is
*additional* to `eval`, and overrode every `visible: false` they governed. Invisible to 41
byte-identity specs, 45 drive specs and two typechecks; the artefact on disk was correct all along.
**Found by rendering it and looking, with `HEAD` rendered as a control arm.** Fixed by
`runOnChange-condition: false` — set explicitly, not left to the load-time migration, because a
template must be correct as written. See D14.

✅ **The setup form now names the blank box**, in the browser, before the call. The endpoint's single
message is untouched: *wrong token* and *already set up* are the only two refusals that leak
anything, and they stay indistinguishable.

### 🔴 Left, and why it was left

**`visible` → `mounted` on the five gated pages.** `visible` hides with `visibility: hidden` and
keeps the box, so `Pages/Post` renders as a heading, ~500px of nothing, and a back button.
`mounted` fixes that *and* D7. Not done blind: an unmounted subtree does not exist, so a `For Each`
inside one is not there to receive rows published while it is away — and the instrument that would
catch it is the backend drive suite, which could not run beside a peer's `dev:debug`.

---

## 12. The gates (s6, 2026-08-28) — 🟢 `mounted`, driven, and a defect in the instrument

**Every gate is `mounted`.** 27 wires and 25 parameters, changed at the source
(`tpl001Components.ts`) and regenerated — the artefact diff is exactly those 52 lines. D7 and D16
are closed.

| same page, same harness | `visible` | `mounted` |
|---|---|---|
| `Pages/Post` to a non-moderator | heading, **~500px of nothing**, back button | heading, back button |
| texts in that person's document | **15** — the whole moderator form | **2** |

### ✅ It was driven, and the suite is green for the first time

**47 passed, 0 failed.** The baseline before the change was **44 passed, 2 failed** of 46 — taken
first, on purpose, because a suite whose floor you have not read cannot tell you what your change
did.

🔴 **Those two reds were not a regression. They were D14's fix arriving.** The specs read
`clickButton('Post it')` and then `look('moderator.posted', '/post')` — and `look` **navigates**. So
they asserted *"a freshly booted `/post` says **Posted**"*, which is true only of a page whose gate
fires on load. That is the defect, written as an expectation: while D14 lived the specs passed, and
the moment it was fixed they went red. Repaired with `readHere`, which reads in place, plus the arm
that was missing — `does NOT say so before anything is posted`. See D14 §s6.

### How the change is held

- The D7 spec is **inverted, not deleted** — a deleted spec cannot notice the regression back — and
  carries **two controls**: the same reading holds the refusal (the document rendered), and the
  moderator's reading through the same helper holds the form (the instrument can see one).
- A ratchet in `tpl001Template.test.ts` fails on **any** `visible` wire or parameter in the shipped
  artefact, asserting the 27 `mounted` gates beside it so an empty census is a measurement.

### ⚠️ The race, read and then measured

An unmounted node is **not destroyed** — it stays in the graph and its inputs keep arriving, so a
`For Each` inside a gated group still receives rows published while it is away (`foreach.tsx` either
applies them immediately or queues them and replays on `didMount`). And every query here is a
**parentless logic node triggered *by* the same standing signal that mounts the group**, so the
group is always mounted first. §2, §6 and §8 pass.

🔴 **The honest limit**: the drive never exercises "rows arrive while unmounted", because in this
template that ordering cannot occur. The reasoning above is what covers it, and it is a property of
*this* template rather than of `mounted`.

---

## 13. The surfaces (s7, 2026-08-29) — 🟢 the design system is finished, not merely opened

§11 gave this template a palette, a type ramp and a measure. It did not finish the job, and the
size of what was left is the finding: **31 of the 45 `Text` nodes in the shipped artefact set
neither a size nor a colour**, every notice and empty state was an unboxed grey line, and the only
cards in the app were the four repeater rows.

🔴 **`templateAppearance.test.ts` was green over all of it, and correctly so.** It asks whether this
template opened the design system — *a* colour, *a* type size, *a* constrained width, all `> 0`.
That is the right question to ask of a template that might have ignored the system entirely, and
the wrong one to ask of a template that opened it and stopped half way.

### What changed

| | before | after |
|---|---|---|
| `Text` with no size and no colour | **31 of 45** | **0** |
| notices / empty states / refusals | bare text on the page ground | **17 surfaced boxes** |
| forms (`SignIn`, `Setup`, `Join`, both on `Post`) | fields loose on the ground | **5 panels** |
| gap between two announcement cards | **0px — borders touching** | `--space-4` |
| `Pages/SignIn` refusal | **no gate at all** | gated on `login.failure` |

⚠️ **The row gap was a real defect, not a polish item.** `For Each` renders its rows as siblings
inside itself, so a `rowGap` on the section above never reaches between them — the row has to carry
its own `marginBottom`. Without it every announcement card's border sat flush against the next.

### 🔴 The gate that did not exist, found by drawing a box round it

`Pages/SignIn`'s refusal was an ungated `Text` whose `text` was wired to `Log In`'s `error`. An
empty string renders nothing, so **"always mounted" and "hidden until it has something to say" were
the same picture** — and every spec was green. Giving the notice a surface is what made the
difference observable: without a gate it would have shipped as a padded, bordered, permanently empty
card under the form. `Pages/Setup` gated its refusal and this one never did, and the asymmetry was
invisible while both were unstyled.

✅ Driven: §1b of the drive signs in with a wrong password, asserts no session is minted, and reads
the page **in place** (`readHere`, for D14's reason — the gate fires on the click). The arms grade
*that a refusal appeared*, not its wording, because the wording is the runtime's.

### How the change is held

Three new rows in `tpl001Template.test.ts`, each proved with a control pair:

| ratchet | mutant run against it | result |
|---|---|---|
| §1 every `Text` sets a type ramp | — | census, names the node |
| §2 every notice box carries a fill and an edge (**exactly 17**) | gate moved onto the inner `Text` | 🔴 reddened AC6 |
| §3 **no container of a `For Each` carries its own fill** | fill added to the four sections | 🔴 reddened §3 alone |

🔴 **§3 is the one worth keeping.** Adding that fill made `templateAppearance` **greener** — more
colour parameters, another structural parameter, §2 still satisfied — while the screen got worse.
Every other instrument pointed at this template would have approved of it.

### ✅ Appearance was graded by looking, and that is where the defects came from

Rendered from disk (`scripts/devtools/render-report.js`) and read with `getComputedStyle`. Three
product defects fell out that no gate here can see, all now in the register: **D18** (form controls
ignore `--font-sans` — `input` renders Arial, `textarea` renders monospace), **D19** (a control's
label is pure `#000`), **D20** (the vocabulary has no composition for a field, a notice or an empty
state — the mechanism behind D10).

### 🔴 Left, and why

- **The landing hero.** Everything around it moved, so it is now the least designed screen in the
  template — and it is the one a stranger sees.
- **No reading of the row cards with the new gap.** Every list renders its empty state on a fresh
  install (AC6, correct), so the change to `ROW_CARD` is gated and typechecked but **has not been
  looked at with rows in it**. That reading is owed and belongs with the seed-content work.

### Gates (s7)

`tpl001Template.test.ts` + `templateAppearance.test.ts` **67/67** · drive **51/51** · `typecheck`
and `typecheck:mcp` clean. ⚠️ `test:ci` not run — no editor source touched.

---

## 15. The landing page (s8, 2026-08-29) — 🟢 the least designed screen is designed

⚠️ **Numbered 15, not 14.** This file's headings restarted once already — there are two §11s, two
§12s and two §13s — so the next free number in *either* run is 15. Same lesson as the duplicate D10
this phase spent a session untangling: a colliding identifier costs more than an ugly one.

### What it was

Read with a backend at 1280×900 before anything was changed, because the standing ruling is that
appearance is graded **by looking at it**. A name, a blurb and two buttons occupying **333px of a
900px viewport**, and nothing else on the one page a stranger sees. The column *was* correctly
centred (712px wide, centre at x=640) — the emptiness was vertical, not horizontal.

### What it is

- An **eyebrow** — "Members' area", `--primary` on `--background` at **7.36:1**. A literal where the
  name and blurb are records, deliberately: the eyebrow is a fact about *this template*, the name is
  a fact about the *recipient*.
- The hero's three lines wrapped in **`sectionHead`**, the composition that exists for exactly this.
- **"What members can see"** — three tiles naming `Pages/Members`, `Pages/Meetings` and
  `Pages/Directory`. Claims the artefact keeps, and §1 of the ratchet pins the page list so a later
  edit cannot quietly break them.

### 🔴 Two compositions had no user, and the list that should have caught it was decoration

`USED_COMPOSITIONS` in `tpl001Theme.ts` carried the sentence *"asserted by the gate, so a rename
reddens"* since it was written. **No gate read it** — `grep` returned the declaration and nothing
else — and it had drifted accordingly: `eyebrow` and `sectionHead` were on the list while the
template used neither.

✅ Both are now used, and **§4** compares the list against `requestedCompositions()`, which
`composition()` records as it is called. A declaration against a measurement, not against a second
declaration. Proved by sabotage: removing `eyebrow` reddens it.

### 🔴 The door refused the first attempt, and was right

Three identical tile subtrees came back `repeated-sibling-subtree` — *"Make one component and
instantiate it 3 times."* Hence `Members/InsideTile`, placed by **parameter**. Most of
[DEFECTS-THE-TEMPLATES-FOUND.md](DEFECTS-THE-TEMPLATES-FOUND.md) is the door failing to say
something; this is worth recording as the door saying it.

The six new `unknown-type-check-skipped` info lines that came with it look exactly like D1 and are
not — **D21, disproved by sabotage**: `titel` was refused as `instance-unknown-parameter` naming both
existing ports.

### ⚠️ The rhythm was wrong before it was measured

First render put **60px above the two buttons and 21px below** them, so they read as the heading of
the section beneath rather than as the hero's call to action. `sectionHead`'s `paddingBottom` is
overridden to `--space-6` and the section below takes `--space-12`: **44 above, 69 below**.

### 🔴 A drive spec's instrument broke, not its subject

`§3` asserted `not.toContain('Announcements')` as a proxy for *the members page did not render* — and
the new tile owns that word. Swapped for **"Sign out"**, which appears twice on `Pages/Members` and
zero times on `Landing`, `SignIn` and `Join`. Read off `text` and not `html`, because `html` **fails**:
the members page's chrome *is* in a stranger's document, unpainted, before the RouterNavigate takes
them away. Not a leak — the load-bearing spec (no announcement title or body anywhere in `html`)
passed throughout, and the chrome is static graph text while the records are what ACL protects.

### 🔴 Six files had never been committed

`tpl001Theme.ts`, `templateAppearance.test.ts`, `tpl001-empty-states.test.ts` and the **`Pages/Directory`
and `Members/MemberRow` component directories**. A pathspec commit does not pick up untracked files,
so two sessions that believed they had committed the template had shipped one missing two of its
components on a fresh clone. Now in history.

### ⚠️ Regenerating carried a peer's product fix into the artefact

DEF-001 (`30eb92b2`) moved the outline button's border to `--border-control`. The shipped template
still said `--muted-foreground`, so **the byte-identity gate was red at that commit** until this
regeneration. A composition change on the product side silently reddens every template that consumes
it, and the person changing the composition has no reason to run the template suite.

### Gates (s8)

`tpl001Template.test.ts` + `templateAppearance.test.ts` **68/68** · the three tpl001 drives
(`members-drive`, `empty-states`, `refused-query`) **71/71** · `typecheck:mcp` clean. Re-run after
the peer commits landed mid-session, not before. ⚠️ `test:ci` not run — no editor source touched.

---

## 16. The navigation (s9, 2026-08-29) — 🟢 B2, and a defect the design system had all along

**Every signed-in page used to end in a button back to the noticeboard. That was the whole of this
app's navigation.** Six of them, one per page, each the page's only exit and every one leading to the
same screen — so reaching the diary from the moderators' queue was a round trip through the
noticeboard. They are gone; the band carries five destinations instead.

| | before | after |
|---|---|---|
| ways out of a page, other than the browser's Back | **1**, always to `/members` | **5**, from the band |
| destinations a moderator can reach in one click | 5 (only from `/members`) | **5, from any page** |
| "Back to …" buttons in the artefact | 6 | **0** |
| children of a `Columns` that overflow their box | **8** | 0 |
| `tpl001Template` + `templateAppearance` | 68/68 | **73/73** |
| the three tpl001 drives, real backend, real browser | 71/71 | **71/71** |

### What the band is now

Two rows inside the same 760px cap: the identity and `Sign out` on top, five nav items beneath.
`Announcements`, `Meetings` for everybody; `Post`, `Requests`, `Who belongs` gated on `isModerator`.

🔴 **The band asks the server who you are for itself, and the alternative was measured rather than
assumed.** Two of the seven pages carrying it — `Pages/Announcement` and `Pages/Meeting` — have **no
`Members/Standing` at all**, deliberately, because the record read is their gate. Borrowing the
page's answer would have given a moderator their navigation on five screens and silently removed it
on the two they reach by clicking a row. The cost is a second `myStanding` call per page and it is
filed as **D29** rather than absorbed quietly.

⚠️ **The moderator's toolbar on `Pages/Members` STAYS.** The band names *places* in one word; the
toolbar names *actions* in a moderator's own words, under an eyebrow saying who they are for, and it
carries the page's one filled button. A nav and a call to action are not the same control — and
`navBtn` exists so the band can never inherit `primaryButton` from `PRIMARY_LABELS` and put a filled
button in the header of all eleven screens.

### 🔴 The defect was in the design system, and only a picture could see it

`outlineButton` and `primaryButton` both pin `sizeMode: 'contentSize'`. `Columns` hands each child an
equal box. A content-sized child **ignores the box**, so at 1280 the five-column band drew
"Announcements" straight across the left edge of "Meetings". Following the design system verbatim,
inside the one node in the runtime that reflows, produces overlapping controls — **D28**.

⚠️ **It hides at the width this phase learned to check.** The overlap is a function of how much room
a column has: it appears at **wide** viewports, where auto-fit makes many narrow columns, and vanishes
at 390px, where two wide ones fit the words. *"Check 390px before committing any layout"* — s8's own
trap, correctly learned — points away from this one.

⚠️ **And it was already shipped, two pixels from visible.** `Pages/Members`' three moderator actions
have been in a `Columns` since s8: "Requests to join" measures ~163px into a ~165px box at 390px. It
cleared, so it read as correct. The fix is `inColumn()` — a rule over *being a child of a `Columns`*
rather than a repair on the node that showed the symptom — and a whole-artefact sweep reddens on any
content-sized child, `graded` pinned at 8 so an empty walk is not a pass.

### 🔴 The first draft of the new gate could not fail, and the sabotage is what said so

The band's specs compared the artefact against `BAND_NAV` — **the table the artefact is generated
from**. That reads like "a declaration against a measurement" and is neither. Proved by deleting
`moderatorOnly` from the `Post` row: both sides of the comparison moved together and the whole
describe block stayed **green**, with only the unrelated `mounted` census noticing. The expectations
are literals now. *A second statement of a fact has to be written independently of the first, or it is
not a second statement.*

Re-sabotaged after the repair: the ungated door reddens the census, a nav button wired to nothing
reddens the destination spec — **and nothing else did**, the door included. The generation run was
clean with a nav item that goes nowhere.

### ✅ Graded by looking, and then by driving

Rendered at **1280×900 and 390×844** before and after, for a member (two items, one row) and a
moderator (five items on desktop, two columns × three rows at 390). Nine of eleven pages render
clean at both widths, **0 console errors**; the two skipped take a route parameter the harness has no
value for.

🔴 **Then driven, because a picture cannot show that `didMount` fires.** The band's standing call
hangs off its root `Group`'s `didMount` — a shared output every visual node carries — and that was
read from source, not observed. The drive settles it: `moderator.*` pages paint
`Sign out | Announcements | Meetings | Post | Requests | Who belongs`, and `member.*` and `pending.*`
paint only the first three, **absent from `outerHTML`, not merely unpainted**. Same run, same
instrument, opposite readings.

### Gates (s9)

`typecheck:mcp` clean · noodl-mcp **904/904, 67 suites** · the three tpl001 drives **71/71** against a
real enforcing backend and a real headless browser. ⚠️ `test:ci` **not run** — no editor source
touched, which is what has kept this phase from colliding all week.
