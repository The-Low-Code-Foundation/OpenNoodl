# SBR-010 — Messages

**Closes the loop the product leaves open.** The contact form stores records with an admin-only
ACL and nothing has ever read them back — someone fills in a form and the owner never learns.
🧭 Ruled in scope s1, as its own task (severable, but ruled in).

## 1. The person sentence

**A visitor's message reaches the owner's eyes: the owner opens Messages and reads it.**

## 2. Scope

- A **Messages** entry in the admin sidebar (SBR-006's shell), listing stored contact records:
  sender, email, message, received-at, newest first.
- An empty state in words ("No messages yet") — the states rule from the screens artifact: a
  surface that cannot answer must say so in a sentence a person can act on.
- Read-only list is the scope; reply/delete/mark-read are future and recorded as such (a
  deliberate deferral note — the live-preview lesson is that undocumented dropping is the one
  state a promise must not be in).

## 3. Acceptance criteria

1. **(person)** Submit the contact form as an anonymous visitor; sign in as owner; the message
   is on the Messages screen with its sender and time.
2. Anonymous cannot read messages (drive the refusal over real HTTP — the ACL is the feature).
3. Empty state shows its sentence; with rows, it doesn't (the pair).
4. The list is ordered newest-first and renders >1 message distinctly (For Each with a real
   interface — the placed-twice-renders-identically trap).

## 4. Traps

- The record shape is whatever `submitContactForm` stores today — read the cloud component
  first; don't invent a parallel class.
- 🔴 The admin-only ACL must be asserted on the DEPLOYED backend too (policy applies only when
  the backend starts with the project dir — SBR-001's machinery).

---

## 5. 🟢 BUILT AND DRIVEN — s38, 2026-09-01. All four acceptance criteria met.

`/Pages/Messages` (11 nodes) and `/Admin/MessageRow` (9 nodes) are new; `/Admin/Shell` gains
`goMessages` and the one wire the rail item never had. The template regenerates at **33**
components, from 31, and **7** pages, from 6.

### 5.1 The shape

| | |
|---|---|
| `/Pages/Messages` | `Page` at `admin/messages` → `/Admin/Shell` with `active: 'messages'` (the **third** distinct placement) → heading, the read-only sentence, the count-or-empty line, the refusal, and a `For Each` over an unfiltered `ContactMessage` query sorted `-createdAt` |
| `/Admin/MessageRow` | sender, received-at, reply address, the message body, and — mounted only when the request carried one — which page it came from |
| the interface | `Component Inputs`: `id`, `name`, `email`, `message`, `pageSlug`, `createdAt`. **Derived from `submitContactForm`'s write set**, not typed: `sbr010Messages.test.ts` reads `CONTACT_NODES`/`CONTACT_WIRES` and asserts the port list IS that set (minus `handled`, plus the two Parse mints) |

### 5.2 The verdicts

**AC1 — 🟢 DRIVEN.** `sbr010-messages-drive.test.ts`, three arms in order, on a real
`BackendService` with the shipped policy and enforcement ON. Three anonymous visitors filled the
template's own public contact form in headless Chrome and pressed **Send**; the owner signed in
through the template's own form, **clicked Messages in the rail**, and read all three — sender,
address, body, `Sent from the hello page`, and three `1 Sep 2026, 22:41`-shaped stamps.

🔴 **The order of the arms IS the measurement.** The owner read the same screen *before* the visitor
wrote anything, and none of it was there. "There is a message on the screen" is not the claim.

**AC2 — 🟢 DRIVEN, both halves.** Over real HTTP with **no session token at all**:
`GET /classes/ContactMessage` is refused while the owner reads three rows from the same URL in the
same breath, so the refusal is about the principal and not about an empty collection. And in the
browser: a signed-out visitor at `/admin/messages` is told **two** things — *"You are not signed in"*
from the shell and *"Your messages could not be loaded"* from the screen — and is shown no message.

**AC3 — 🟢 DRIVEN, as a pair.** The empty screen says
*"No messages yet. When somebody sends the contact form on your site, their message arrives here."*
The full screen does not, and says **"Three messages"** instead. One node says both sentences, and
`sbr010Messages.test.ts` runs the shipped `functionScript` over 0, 1, 3, 9 and 24 rows.

**AC4 — 🟢 DRIVEN.** `SENT` is written oldest-first; the screen reads newest-first, and the backend
agrees — the sort is `visualSort: [{ createdAt, descending }]`, lowered to Parse's `-createdAt`, so
the order is the **collection's** and not of whatever came back. Three distinct bodies, each
appearing exactly once.

**MUTANT.** The defect restored, not a repair reversed: `navMessages.onClick → goMessages.navigate`
dropped from `/Admin/Shell`, counted `removed:1`. The item is still there and still **reachable**
(`elementFromPoint`), and the same click leaves the owner on `/admin/pages`.

### 5.3 🔴 Two defects the drive found, both invisible from the graph

- **[D42](DEFECTS-THE-SITE-BUILDER-FOUND.md#d42) — the one public endpoint stored every enquiry
  TWICE, and had since SB-004.** Three clicks, three `submitContactForm` runs, **six** rows. The
  browser was never at fault: each run's step list read `fallback → pick → save` twice, because
  `ContactRecipient`'s `SiteSettings` query had its load-time fetch ticked *and* a `storageFetch`
  wire. The node's own comment stated the rule it was breaking, from a premise
  (*"this node has no `storageFetch` wire"*) that its own wire list contradicts. **Fixed in the same
  session**; the drive asserts `stores: 1` exactly, both ways round.
- **[D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43) — a refused list said "No messages yet".** The
  signed-out screen rendered the refusal AND the empty sentence together. `run` is additive:
  `items` publishing an empty collection ran the count with no successful query behind it. Fixed
  here (`runOnChange-in-rows: false`); **`/Pages/Admin` is wired identically and was deliberately
  not touched** — it carries three other tasks' verified ACs. The spec holds the row as a
  measurement, so a later fix reddens it.

### 5.4 What this task deliberately did NOT build

Enumerated in `MESSAGES_DEFERRED` and asserted as arithmetic — neither component holds a node that
can write, delete or call anything, so a Reply arriving later reddens `sbr010Messages.test.ts` first:

| | why |
|---|---|
| reply | an outbound email is a cloud function and a second recipient contract; **SB-004 F8** has the address question open with Richard |
| delete | `ContactMessage.delete` is `nobody` in the shipped policy — a button that could only ever fail is worse than no button |
| mark as read | `handled: false` is written by the cloud function and read by nothing; making it mean something needs a write from the panel, which is the ACL question this screen does not open |
| live refresh | nothing here writes, so nothing wires `storageFetch` — a message arriving while the owner watches appears on the next visit. SBR-011's realtime hub is where that belongs |

The screen says the first of these out loud: *"Messages are read to here, not answered from here —
reply from your own email using the address on the message."*

### 5.5 The specs

`sbr010Messages.test.ts` — 32 arms over the **shipped artefact**, including the two that run the
shipped `functionScript` bodies: the count sentence over five row counts, and the received-at stamp
over a `Date` **and** its own ISO string (`_deserializeJSON` returns either, depending on whether
the class schema had loaded — the branch is keyed on the schema, not on the value).

`sbr010-messages-drive.test.ts` — 16 arms, the whole loop, ~4 minutes.
