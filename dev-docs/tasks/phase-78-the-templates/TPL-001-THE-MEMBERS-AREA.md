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
