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

