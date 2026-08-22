# FB-003 — nobody can offer, and nobody can ask

**Filed:** 2026-08-22, from Richard's item 2. **Status: ⬜ open — the sharpest gap of the
thirteen.** Size: M. No ruling blocks it.

> *"Right now in the community there's no way to add yourself as a coach or add an RFP, maybe
> that's coming in the remaining phase tasks?"*

The honest answer to his question: **partly, and the part he asked about is nobody's task.**
NAT-009/NAT-010 cover *reading and responding* to RFPs and coaching **from the editor**. Nothing
anywhere covers *offering* coaching or *posting* an RFP — and the web pages both surfaces point
at have no forms.

---

## What exists (swept 2026-08-22)

- `nodegx-community/src/lib/coaching.ts:66` `createOffer()` — the only writer of a coaching
  offer, **no caller in `src/`**: no page, no form, no `/api/v1` route. `/coaching` is read-only;
  the community coaching endpoint's own header says *"🔴 booking one is not here"*.
- `nodegx-community/src/lib/rfps.ts:68` `postRfp()` — **no caller either.** The whole site has
  two `<form>`s: the layout search and the device-approve form.
- **NAT-009 AC4 ruled posting stays on the web behind a labelled hand-off** — and the editor's
  `rfpboardview.ts:174` already says *"Posting a request for work opens the community in your
  browser."* **That hand-off is a promise to a page that cannot keep it.** This task makes the
  promise true.
- UNI-004 built the schema and its 18 tagged refusals (five plpgsql functions on the insert
  path); NAT-009's platform half built the editor-side read/respond client.

This is the 21st and 22nd instance of *build the caller*: heavily-specced lib functions whose
green suites could never see that no production code calls them.

## Scope

Two web composers, no editor half (NAT-009 AC4 already ruled the editor hands off):

1. **Post an RFP** — a form on `/rfps` for a signed-in account: title, body, budget band, the
   fields `postRfp` already takes. Nothing more than the lib function accepts.
2. **Offer coaching** — a form on `/coaching` ("Become a coach"): the fields `createOffer`
   takes, including rate band. ⚠️ NAT-008 found **4/4 rate-band keys guessed wrong** invisibly —
   derive the vocabulary from the schema, don't retype it.

## Acceptance criteria

- AC1: a signed-in account posts an RFP from `/rfps` and it appears in the board list and in the
  editor's NAT-009 client without either being redeployed.
- AC2: a signed-in account creates a coaching offer from `/coaching` and appears in the coaching
  list with their profile line.
- AC3: every one of the migration's refusal tags that can fire on these two inserts renders as
  its own sentence, not the generic "could not be reached" default — sweep the migration per
  function, state the bound in the spec (NAT-009's `nat009-board-refusals.test.ts` is the
  pattern).
- AC4: the editor's existing `POST_A_REQUEST_LINE` hand-off lands on the RFP composer (anchor or
  route), signed-out lands on sign-in with a return path.
- AC5: an `org_minor` account is refused per D15's posture (bare 404 shape where the ruling says
  the surface must not be described).

## Traps

- Writes go through the byte-capped write path; the four derived-from-disk gates and the
  envelope contract fire on any new route.
- `acceptConnection` (the relay's connect step) still has no caller — **out of scope here**;
  don't wire it in passing, it is D10-shaped.
- A coaching offer is user content with a rate — the data-inventory census will demand a
  classification for any new free-text column.
