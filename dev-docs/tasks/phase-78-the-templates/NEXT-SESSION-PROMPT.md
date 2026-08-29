# Phase 78 — next session

## Where it stands

**TPL-002 is built and graded.** s13 closed D29 and finished Track B; s14 took the item the prompt
called *"the interesting half"* — an admin posting on a backend with no SMTP is told so, in a
sentence, at the moment they post — and built the whole notification feature around it.

The shipped artefact (`templates/members-area/`) now carries **8 cloud functions** and **13 pages**.

| | before s14 | after |
|---|---|---|
| cloud functions in the artefact | 4 | **8** |
| pages | 11 | **13** |
| `tpl002-notifications.test.ts` | — | **29/29** |
| noodl-mcp suite | 958/958 | **958/958** |
| `tpl001Template.test.ts` | 71/71 | **71/71** (14 pinned counts moved, 2 gate populations scoped) |
| the three tpl001 drives | 75/75 | **79/79** |
| generation | 63 + 6 info | **88 + 6 info**, exit 0, no warnings |

✅ `typecheck:mcp` and the backend `tsc` clean. ⚠️ `test:ci` **not run** — no editor source touched,
deliberately, as every session this phase.

## 🔴 Read this first

- 🔴 **The fan-out is shaped by a product defect, and the shape is not optional.**
  [D33](DEFECTS-THE-TEMPLATES-FOUND.md): pulse `Send Email`'s `Do` three times in one pass with three
  different addresses and it sends **one** message — to the last — and reports **three** successes.
  Measured with a control pair (one pass vs one pass each). There is also no loop node in the cloud
  runtime: `For Each` is `noodl-viewer-react`'s visual repeater. So `notifyMembers` is a **serial
  pump** — a `JavaScriptFunction` holding the cursor, and `Send Email`'s `done` **and** `failure`
  both wired back to advance it. **Do not "simplify" it.**
- 🔴 **Two ports I got wrong, both documented correctly, both expensive.**
  - `visualFilter`'s `input` names a **port**; `value` is the literal. `input: true` made the opt-in
    query return every member.
  - `DbModel2.Fetched` is a **value-level announcement** and fires twice per fetch; `Done` is the
    outcome and fires once. Sequenced off `Fetched`, five emails went to three people.
- 🔴 **[D35](DEFECTS-THE-TEMPLATES-FOUND.md): `Component` scope is not per-request.** A `planned`
  flag left in it made every later `notifyMembers` call **hang for 30s** — a graph that returns early
  fires no Response. Write that object whole, never merge into it.
- ⚠️ **`CLOUD_KEYS` in `tests/helpers/members-drive.ts` was a hand-written list of four** and now
  reads the `__cloud__` directory. Before that fix every call to a new endpoint answered **404**,
  which reads exactly like a broken endpoint rather than an undeployed one.
- ✅ **[`tpl001-rows.look.ts`](../../../packages/nodegx-backend/tests/tpl001-rows.look.ts) is still
  the only way to SEE this template with content in it.** Unchanged this session — s14 changed no
  existing layout. Run it whenever you touch a row:

      npx jest --config packages/nodegx-backend/jest.config.js \
        --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
        packages/nodegx-backend/tests/tpl001-rows.look.ts

## Then, in order

1. ⬜ **Drive TPL-002's two pages — the one thing s14 did not grade.** Every endpoint is measured
   over HTTP; `Pages/Account` and `Pages/Unsubscribe` are graded only as artefacts. Tick the box,
   watch the email arrive, take the link **out of the message body**, open it signed out, come back
   and see the box unticked. The harness exists (`members-drive.ts`: `clickButton`, `controls`,
   `signIn`, `withRenderedPage`). This is AC4's first half and AC1/AC2's box.
2. ⬜ **Look at the band.** `BAND_NAV` has **six** items now, in a `gridAutoFit` at `minWidth: 132px`
   in a 760px band — five across and the sixth folding, by arithmetic. Nobody has looked. Richard's
   rule is that appearance is an acceptance criterion graded **by looking**.
3. ⬜ **T5 / publishing.** Unchanged, and still **Richard drives it first**. AC1 of TPL-001 is
   ungradeable until the template is on the shelf.
4. ⬜ **T3**, the category question. Untouched, and it needs Richard.
5. 🔴 **D32, D28, D30, D22–D24, D33, D34, D35 are all `NONE`.** Eight unowned rows now. Phase 80 owns
   the register sweep; three of them were filed today.

## 🔴 Traps this session paid for

- 🔴 **A spec that reads the endpoint's own answer would pass on D33.** `notifyMembers` reported
  `sent: 3` while one message was sent — that is precisely the defect. Every row in
  `tpl002-notifications.test.ts` reads the **transport**: what the mail server was handed, and for
  whom. The endpoint's numbers are asserted too, but as a second reading, never the first.
- 🔴 **The negative control has to be in the same send.** Ann is approved, in `role:member`, has an
  address on her row, and differs from Mo in exactly one field. Her silence is asserted off the same
  transport in the same call as Mo's delivery — otherwise "Ann got nothing" is equally consistent
  with a mailer that was never reached.
- 🔴 **A gate's population is part of the gate.** Two `tpl001Template.test.ts` rules — *every
  members-only query carries `NO_LOAD_TIME_FETCH`* and *its only trigger comes from the standing
  gate* — are sentences about a **page**. The four new endpoints landed in their population and made
  them demand a gate that cannot exist in a cloud function, whose boundary is the `call` rule. Both
  are now scoped, with the reason written where the scope is.
- ⚠️ **And the exclusion I first wrote matched nothing**: `shipped` paths carry a leading slash
  (`/#__cloud__/myStanding`), so `startsWith('#__cloud__/')` was a filter that filtered nothing. It
  went red, which is the only reason I found out.
- ⚠️ **A response parameter is under `result`.** Eight rows were red against a graph that was
  answering correctly, because the spec read `res.json.sent` instead of `res.json.result.sent`.
  Settled by probing `/functions/myStanding` — an endpoint the template has always had — rather than
  by reading the Response node.
- ⚠️ **The drive is what proved the browser half.** `tpl001-members-drive.test.ts` §7 went red with
  the new sentence on the page, which is better evidence than any assertion I wrote: it means the
  Post page's whole chain runs in a real browser.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ⚠️ Not honoured for TPL-002's two pages — item 2 above is the debt, recorded rather than skipped.
- **Seeding, 2026-08-29: close the delete gap, seed nothing.** AC6's designed empty state stands.
- **Opt-in, never opt-out** — these are UK and EU charities and congregations. `notifyByEmail` is
  written `false` at approval, and the box on the account page ships unticked.
- **Scope: A + B + all of C, with C done by phase 80.**
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
