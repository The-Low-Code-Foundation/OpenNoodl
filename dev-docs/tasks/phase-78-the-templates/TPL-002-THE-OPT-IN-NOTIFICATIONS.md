# TPL-002 — "Tell me when something is posted"

**Adds email notifications to [TPL-001](TPL-001-THE-MEMBERS-AREA.md).** Richard, 2026-08-28:
*"Users receive notifications by email if they opt in for that when new content is added."*

Split from TPL-001 on purpose: this half depends on SMTP credentials the template **cannot ship**
(§2), and the shelf's first row must not wait on an external dependency.

## 1. The person sentence

**A member ticks one box in their account and gets an email when the secretary posts an
announcement — and can untick it, from the email itself, without asking anyone.**

## 2. 🔴 The dependency the template cannot carry

Email is real here and does not need building: `nodegx-backend/src/email/Mailer.ts` (BAK-002)
speaks SMTP via nodemailer, and the **Send Email node** reaches it from a cloud function through
`_noodl_send_email` (`service.ts:541`).

What it needs is configuration that lives **in the backend, not the project**:

- `email.json` in the backend data dir — host, port, secure, username, from-address.
- `secrets.json`, `email` namespace, `smtpPassword` — through the product's **Secrets panel**;
  writing that file by hand is blocked, and the panel is the flow a person uses anyway (P77 s4b
  provisioned `SITE_SETUP_TOKEN` exactly this way).

Neither is a project file, and `shareAsTemplate` strips secrets by rule — *"a template that
carried one would publish it."* **So on a fresh install this feature is inert, and that is
correct.** What is not correct is being inert *silently*.

## 3. 🔴 The AC this task exists for

**An admin who posts an announcement on a backend with no SMTP configured is told so, in a
sentence, at the moment they post.** Not a silent no-op, not a spinner, not an error in a log
nobody reads.

This is SBR-002's finding applied one layer up: the site builder's no-backend deadline *never
spoke*, and only a drive found it — the specs could not. Grade this with the negative control
beside it: configured ⇒ the mail sends and the sentence does not appear; unconfigured ⇒ the
sentence appears and nothing is queued.

## 4. Scope

- **Opt-in on the account page.** 🔴 **Default off.** These are charities and congregations in
  the UK and EU; consent is opt-in, and a template that ships opt-out teaches every one of them
  to break the law on their first day.
- **A fan-out on publish** — a cloud function that reads the opted-in, **approved** members and
  sends one email each. Pending and declined members are not members (TPL-001 AC3's rule, same
  bug, new surface).
- **An unsubscribe link in every email** that works without signing in, and flips the same flag
  the account page does. One writer, one flag.
- **The admin sees what happened** — "sent to 24 members", or the §3 sentence.

## 5. Acceptance criteria

1. **(person)** Member ticks the box, admin posts, member receives the email. Driven against a
   captured transport, not a real inbox.
2. **(person)** A member who has **not** ticked it receives nothing — the negative control run in
   the same send as AC1, so "nothing sent at all" cannot pass as a green.
3. **(person)** §3 — unconfigured SMTP says so at post time, with the configured case as control.
4. **(person)** The unsubscribe link works signed out, and the account page then shows the box
   unticked — the two surfaces read one flag.
5. A pending member who opted in before approval receives nothing.
6. A send failure for one recipient does not lose the announcement or stop the other 23 —
   `Mailer.send` resolves rather than rejects, and the fan-out must not undo that.

## 6. Traps

- 🔴 **A signal into a value port arrives once as `false`** — "sent" and "opted in" are both that
  shape; an `=== true` guard never fires (SBR-002).
- 🔴 **The opt-in flag is user-writable data.** A member must be able to change their own row and
  nobody else's — this is the one place in the template where a member has write access, so it is
  the one place row-level ACL is actually load-bearing rather than table-level.
- 🔴 **Email addresses are the most sensitive thing this app holds.** The fan-out must not leak
  the member list — no `to:` with 24 addresses in it.
- 🔴 A **shipped** `email.json` with a plausible-looking host would make every install try to send
  through somebody else's server. Ship no email config at all.

---

# 7. Status — built and graded, s14 (2026-08-29)

**Everything in §5 is measured except AC4's browser half.** The feature is in the shipped artefact
(`templates/members-area/`), which now carries **eight** cloud functions and **thirteen** pages.

## What was built

| piece | where |
|---|---|
| `notifyMembers(announcementId, siteUrl)` — the **serial pump** | `tpl002Cloud.ts` §4 |
| `myNotifySetting()` / `setNotifySetting(wanted)` | `tpl002Cloud.ts` §1–2 |
| `unsubscribe(token)` — public, token-gated | `tpl002Cloud.ts` §3 |
| `notifyByEmail: false` + `unsubscribeToken` minted at approval | `tpl001Cloud.ts` — **both** row writers |
| `Pages/Account` — one box, default off | `tpl001Components.ts` §14 |
| `Pages/Unsubscribe` — no band, no session | `tpl001Components.ts` §15 |
| the Post page's fan-out and its §3 readout | `tpl001Components.ts`, `POST` |
| four `call` rules | `templates/members-area.security.json` |

## The readings

`tpl002-notifications.test.ts` — **29/29**, against a real enforcing backend (`security.enforced`
asserted before anything is read) and a captured transport. Every reading is taken off **what the
mail server was handed**, never off what the endpoint claimed.

| AC | reading |
|---|---|
| 1 | Mo ticked the box; the transport was handed **one** message, to Mo |
| 2 | Ann is approved, in `role:member`, has an address, and differs in **one field** — she was handed nothing, **in the same send** |
| 3 | `email.json` removed ⇒ `sent: 0`, `failed: 3`, and the error is `notConfiguredReason()` **verbatim** — *"Email is not configured for this backend… Backend Services panel"*. The configured arm on the same instrument is the control (`sent: 1` and `sent: 3`) |
| 4 | `unsubscribe(token)` with **no session** returns 200; `myNotifySetting` as Mo then answers `false`. Controls: Ann unaffected; an unknown token refused; a blank token refused before it reaches the query |
| 5 | Pat is pending, so `setNotifySetting` is **403** and there is no `Member` row for the flag to live on — structural, not a guard |
| 6 | one address made to throw ⇒ the other two still delivered, `sent: 2 / failed: 1`, error carries `550` |

🔴 **Three opted-in members receive three distinct messages, with three distinct unsubscribe links.**
That is the row D33 exists for, and it is what the naive graph cannot do.

✅ **Sabotage-proved.** Reverting `NOTIFY_FILTER` to `input: true` reddens exactly AC1, AC2 and the
count rows — the spec grades the product, not itself.

✅ **The browser half of the Post page is graded by the drive**, not by this suite:
`tpl001-members-drive.test.ts` §7 now reads *"Posted. Nobody has asked to be emailed yet, so no
emails were sent."* off the rendered page after the moderator types and clicks — which is the whole
chain `createAnnouncement.done → announce → notifyMembers → report → the confirmation's text`, in a
real browser.

Gates: **noodl-mcp 958/958** · **`tpl001Template.test.ts` 71/71** · the three tpl001 drives + tpl002
**108/108** · `typecheck:mcp` and the backend `tsc` clean · generation exit 0, **94 diagnostics, all
`info`**. ⚠️ `test:ci` not run — no editor source touched.

## ✅ s15 — the two pages driven, the band looked at, and what looking found

**AC4's first half and AC1/AC2's box are now graded in a browser**
(`tpl002-account-drive.test.ts`, **22/22**), and both owed appearance readings are taken.

| what | reading |
|---|---|
| the box as it ships | present, painted, **unticked**, and drawing no tick — on the screen |
| ticking it | a real trusted click ⇒ `checked` **and** a visible tick, `Saved… when something is posted`, and `myNotifySetting` answers `true` as a **second** reading |
| the send | two opted-in members mailed; Ann, differing in one field, handed nothing **in the same send** |
| the link | taken **out of the message body**, opened with `currentSession()` asserted **null**, page paints `UNSUBSCRIBED_TEXT`, and makes **zero** `myStanding` calls — it carries no band |
| what the link did | Mo `false`, **Sam still `true`**, Ann unmoved; and the **next send skipped Mo and still reached Sam** |
| the account page after | box unticked on a fresh load — two surfaces, one flag |
| back on, and off again | both directions from the screen, with the right sentence each time |

🔴 **Sam exists because Ann is not a control for the unsubscribe.** Ann is `false` before and after,
which a token that did nothing at all would satisfy exactly. Sam's `true` had to **survive**.

🔴 **The link is graded by its consequence, not its confirmation.** A page that paints "Done" and
writes nothing passes the sentence row and fails the second send — and the second send is the AC.

### The band, looked at

`tpl002-account.look.ts` writes the pictures. At 1280 the moderator's six items are **five across
with "Your account" alone on a second row**, left-aligned under Announcements, nothing clipped, gaps
even. At 390 it is a tidy 2×3. The arithmetic in `BAND_NAV`'s note was right and the result is fine
— **no change made**. ⚠️ A member's band has **three** items, not six: three are `moderatorOnly` and
ship `mounted: false`, so a look taken only as a member would have measured the wrong screen.

### 🔴 Two defects the drive found, both fixed, both inside this task's own ACs

- **[D36](DEFECTS-THE-TEMPLATES-FOUND.md)** — a `Condition` only ever turns a gate **on**. Tick then
  untick without reloading and the page showed **both** confirmations at once. Every earlier reading
  was of a *first* change, which leaves exactly one notice up and looks perfect. Fixed with
  `onClear` / `offClear` / `failClear`.
- **[D37](DEFECTS-THE-TEMPLATES-FOUND.md)** — `useLabel` defaults **false**, so a label drawn as a
  sibling `Text` emits no `<label for>` and **the words beside the box did nothing when tapped**. On
  a phone the entire opt-in was a 24×24 square — exactly WCAG 2.2 SC 2.5.8's floor and no more. The
  label is now the checkbox's own.

✅ **Control pair, and it was taken in the right order:** the drive was written and run **before**
either fix. §10 and §11 were red and the other twenty rows green; after the fixes, 22/22. The spec
follows the product.

### ⚠️ One finding left open, because it needs a ruling

**[D39](DEFECTS-THE-TEMPLATES-FOUND.md)** — the unsubscribe page does not name the association and
offers no way back. Not an oversight: the page is built to make **no** round trip, and naming the
association costs one public query. Richard's call.

Gates after: **noodl-mcp 958/958** · `tpl001Template.test.ts` **71/71** (one pinned `mounted` count
46 → 49, with the reason written beside it) · the four tpl001/tpl002 backend suites **130/130** ·
`typecheck:mcp` and the backend `tsc` clean · generation exit 0, **94 diagnostics, all `info`**.
⚠️ `test:ci` not run — no editor source touched.

---

## What was NOT graded, s14 — now closed by s15 above

**AC4's first half in a browser, and AC1/AC2's box.** `Pages/Account` and `Pages/Unsubscribe` are
authored, registered, routed and gated, and every endpoint behind them is driven — but **nobody has
ticked the box on the screen**, and nobody has opened the unsubscribe link in a page. The two pages
are graded only as artefacts. Richard's rule is that appearance is an acceptance criterion graded by
looking; that reading is owed.

⚠️ **And with it, the band.** `BAND_NAV` now has **six** items in a `gridAutoFit` at
`minWidth: 132px` in a 760px band — five across, the sixth folding. That is arithmetic, not a
reading. It may be right; it has not been looked at.

## Three defects it found

- **[D33](DEFECTS-THE-TEMPLATES-FOUND.md)** — a fan-out send delivers **one** email and reports **N**
  successes. The whole shape of `notifyMembers` is the workaround.
- **[D34](DEFECTS-THE-TEMPLATES-FOUND.md)** — a cloud function cannot learn the app's own public
  origin, so it cannot build a link into an email.
- **[D35](DEFECTS-THE-TEMPLATES-FOUND.md)** — `Component` scope is **not** per-request; a flag left
  in it made every later request hang for 30s.

## Two things that were my error, recorded because they cost real time

- 🔴 **`input` in a `visualFilter` names a PORT; `value` is the literal.** Written `input: true` the
  opt-in filter named a port nothing set and the query returned **every member** — a send that
  reached three people when one had opted in.
- 🔴 **`DbModel2.Fetched` is a value-level announcement and fires twice per fetch**; `Done` is the
  invocation's outcome and fires once. Sequenced off `Fetched`, the member query ran twice, `plan`
  reset the cursor under a running pump, and **five messages went to three people**. Both ports are
  documented correctly — the file says so at `dbmodelnode2.ts:172`. I did not read it first.

## What is left

1. ⬜ **Drive the two pages.** Tick the box, watch the email arrive, click the link from the message
   body, come back and see it unticked. The harness for it already exists (`members-drive.ts`).
2. ⬜ **Look at the band with six items in it**, at 1280 and at 390.
3. ⬜ **T5 / publishing** is unchanged and still Richard's.
