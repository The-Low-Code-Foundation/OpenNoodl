# UNI-016 — artifact posts: a question renders as the thing it is about

**Surface:** platform + editor · **Tier 1** · **Effort:** M/L · ✅ **BUILT 2026-08-18
(session 28) — all five ACs met. Platform half session 27; the editor's POST, and the route
field it needed, session 28.**

> ## ✅ WHERE THIS ACTUALLY STANDS — BUILT 2026-08-18 (session 28). All five ACs met.
>
> 🔴 **THE HANDOVER'S PREMISE WAS FALSE IN BOTH HALVES, AND MEASURING IT FIRST IS WHAT MADE
> THE SESSION POSSIBLE.** It said *"the platform can receive artifact posts and nothing sends
> them"*, and that *"the bearer token the dialog already holds is the credential."* Measured:
>
> | Claimed | Measured |
> |---|---|
> | the platform can receive artifact posts | 🔴 **No.** `POST /api/v1/bench/threads` took `{section, title, body}`. **`attachToPost` had NO caller in `src/`** — only its own spec. The platform could receive *plain text* |
> | the dialog already holds a bearer token | 🔴 **No.** `AskAboutNodeDialog` had no token, no token store existed anywhere in the editor, and **`CommunityApiClient` had no caller outside its own spec** — it was also GET-only |
> | …and the credential could be obtained | 🔴 **No issuer exists.** The only `insert into sessions` statements in the whole platform repo are **in test files**. UNI-001's OAuth is recorded NOT BUILT |
>
> So the task was three pieces, not one — *build the caller* for the **ninth and tenth**
> times, and the tenth is the one where the missing caller was the reason the task existed.
>
> ### What was built
>
> **Platform** — `parseAttachments` (the boundary), `attachments` on both write routes,
> `attachAll` inside `askQuestion`/`answerThread`'s **own transaction**, three 0009 constraint
> names mapped in `bench-http.ts`. `tests/uni016-attachment-intake.test.ts` **14**, plus **2**
> real-HTTP consequences in `uni015-bench-http.test.ts`.
>
> **Editor** — `nodeartifact.ts` (the structured payload), `communitysession.ts` (the token
> seam), `CommunityApiClient.askQuestion`/`.answer` + the `Write` union, and the composer's
> two routes. `tests-unit/uni-016/` **42 across 3 files**.
>
> | AC | State |
> |---|---|
> | **AC1** a node excerpt posted **from the editor** renders as a node | ✅ **MET** — and only now: the route it names could not take an attachment until this session. Driven over real HTTP |
> | **AC2** a withheld port is visible as withheld, name and value nowhere | ✅ **MET — and the assertion MOVED to where it can fail.** See the finding below |
> | **AC3** facets derived, not typed | ✅ **MET** — generated columns, now also proved end-to-end through the wire |
> | **AC4** filtering by (node type, version) | ✅ **MET** (unchanged, session 27) |
> | **AC5** the signed-out browser hand-off still works | ✅ **MET, AND NO LONGER TRIVIALLY.** It was true only because nothing in the editor had been touched. This is the commit that adds the thing it would be deleted in favour of, and the hand-off is asserted rendered *outside* the signed-in branch, with a negative control |
>
> ### 🔴 THE FINDING: AC2's ASSERTION WAS ON A POPULATION WHERE IT COULD NOT FAIL
>
> Session 27 asserted AC2 platform-side: a withheld port's name and value appear nowhere in
> the served page. **But the withheld name was never in the request** — the editor buckets it
> away before sending — so no implementation of that route could have emitted it. The
> assertion was true by construction, and an absence check that cannot fail is not evidence.
>
> ✅ **It now lives in `tests-unit/uni-016/nodeartifact.test.ts`, where the withheld port IS in
> the input** as a row the composer offered and the user left unticked. Dropping it is work the
> code does, and the spec fails if it stops. The platform's version is **kept and relabelled**
> as the weak form — it proves the renderer does not *invent* a name from `withheldPorts`.
>
> ### 🔴 TWO SECOND-ORDER FINDINGS, BOTH CAUGHT BY A KNOWN-FIRING CONTROL
>
> 1. **`apiSql()`'s cached pool does not survive `resetSchema`, and the symptom is a suite that
>    PASSES.** postgres.js resolves enum OIDs at connect time; `drop schema public cascade`
>    invalidates them; every route-handler call after the first in a file then fails with
>    `XX000: cache lookup failed for type <oid>` — which `refusalResponse` maps, **by design**,
>    to an indistinguishable 400. So a spec asserting *"this is refused"* went green **without
>    ever reaching the route**. Fixed with `resetApiSql()`, called by `freshDb()`.
>    ⚠️ **It flipped no existing test** (692→706 = exactly the 14 new ones), so it had bitten
>    only the new file — but it was one route-handler refusal spec away from being invisible.
> 2. **An escaped quote made an absence assertion pass trivially.** `WITHHELD_VALUE` contains
>    literal double quotes, as a real text preview value does. Asserted against
>    `JSON.stringify(payload)`, the quotes are escaped to `\"`, so `not.toContain('"ACME-…"')`
>    **passes whether or not the value is there**. ✅ Compare *values*, via `artifactStrings`,
>    never serialised text. In both cases the thing that spoke was the control asserting the
>    same string is PRESENT in the positive arm.
>
> ### ⚠️ WHAT IS NOT PROVED, STATED PLAINLY
>
> 🔴 **The dialog's button was never clicked.** The payload is graded, the transport is graded,
> the platform's end is driven over real HTTP — but the wire between the button and the client
> is **read as source, not run**. There is no DOM and no React in this checkout's jest runner
> (`base-dialog/measuring-copy.test.ts` establishes both the limit and this response to it), so
> `composer-sends-what-it-shows.test.ts` holds the properties by source analysis with negative
> controls. **A real drive needs a session token no issuer can mint and a platform deployed
> nowhere.** Counted as a gap, not as met.
>
> 🔴 **No real user can post.** `readCommunitySession()` returns `null` for everybody until
> UNI-001 has an issuer, so **the browser hand-off is the only reachable route today**. That is
> AC5 working rather than a shortfall — but it means the POST path's *end-to-end* behaviour is
> evidenced by specs and not by a person.
>
> ### Scope calls made here, recorded so they are decisions rather than drift
>
> - 🔴 **The graph excerpt stays in the body; it is NOT posted as a `graph_fragment`.** That
>   kind is **UNI-018's pull unit** — the shape a reader pulls into their editor *and runs*.
>   UNI-011's excerpt is bucketed types and wiring, deliberately not executable and not
>   reconstructible. Filing it under the kind that means *"this can be pulled"* would hand
>   UNI-018 a population it cannot honour. Asserted.
> - 🔴 **No `warningCode` is sent.** This editor has no warning *code* — `WarningsModel` yields
>   a free-text sentence with the user's own content in it. Slicing a facet out of that would
>   put project content into an indexed column that renders as a public filter chip, which is
>   the opposite of what UNI-011's redactor is for. The facet is null, and null is correct.
> - **`parseAttachments` does NOT restate 0009's payload-shape rules.** The migration is the one
>   copy; the constraint names map to 400s. What the boundary *does* own is what the database
>   cannot say: **how many** (`MAX_ATTACHMENTS_PER_POST = 4`) and **how big**
>   (`MAX_PAYLOAD_BYTES = 32 KB`) — a signed-in stranger posting a 40 MB document is a resource
>   decision, not a constraint violation, and until now the only writer was a spec.
> - **`localStorage` is the session store** (`JSONStorage`), and the renderer is
>   `nodeIntegration: true`. Acceptable for a community session; 🔴 **recorded as a condition**:
>   if UNI-001 ever issues a token reaching payment, an org roster or a pupil's record, this is
>   the wrong store and the keychain is the right one.
>
> 🔴 **`lesson_step` HAS NO RENDERER, deliberately** — the scope permits it: *"ship the other
> three and say so"*. UNI-007's format is still moving.
>
> 🔴 **BLOB STORAGE IS STILL OWNED BY NO TASK.** A `capture` carries dimensions and consent and
> **no image**; `saveCaptureNextTo` still writes to the asker's Documents folder — **on both
> routes**, asserted, because that file is the only copy of the picture there is. An
> `image_url` column and a writer remain the whole change. Still Richard's call.
>
> ⚠️ **UNI-005 AC4's census moved and was fed.** `post_attachments.payload` and `.note` are
> **`minor-refused`**, not `machine-derived`.

> **This is the task D19 exists for.** UNI-015 on its own is plain-text Q&A on our own stack, which
> is strictly worse than what we chose not to buy. **The specimens are in the pitch artifact —
> ["Questions Made of Nodes"](https://claude.ai/code/artifact/7ac9fdff-757c-4cd0-8a94-879ba5fa1509)
> — in full CSS. Read it before writing markup.**

## Premise

The editor already produces the payloads. UNI-011 **AC2** sends a node question carrying its type,
warning, version and OS; **AC3** sends a capture of the running preview with live port values and a
per-port consent toggle. Both are built, specced and driven (`f73b1bd6`, `f72799b7`).

Today both **hand off to the browser with a prefilled composer**, because there was no forum and no
issuer. The payload is a string by the time it arrives. This task is the other end: the payload
arrives **structured**, and stays structured.

## Scope

- **`post_attachments`** — a post may carry attachments of a closed set of kinds:
  `node_excerpt` · `capture` · `graph_fragment` · `lesson_step`. One renderer each.
- **Facets are derived from the payload, never typed.** Node type, version, OS and warning code
  become columns/enums off the attachment, so filtering is free and nobody has to remember a tag.
- 🔴 **Visible redaction.** UNI-011's bucketing produces `<component>`, `<unknown>`, `<port>`. These
  render **as redaction chips**, not as missing fields. A reader must be able to tell something was
  held back — that is the difference between privacy and a hole. ⚠️ It is also the honest reading of
  UNI-011 AC3's per-port consent: the sender chose, and the choice should be legible to the person
  answering, who otherwise wastes a reply asking for what was deliberately withheld.
- **Editor side: the composer POSTs.** `AskAboutNodeDialog` gains a real submit against
  `/api/v1/bench/threads` with the bearer token it already holds. 🔴 The browser hand-off **stays**
  as the signed-out path — do not delete it.

## 🔴 Four things this changes that are recorded as DONE

Stated loudly, because this phase's most-repeated failure is a premise surviving in a file nobody
re-opened.

1. **UNI-011 AC2 and AC3 change from *hands off to the browser* to *posts*.** Both are marked met
   and driven. They stay met — the criterion's verb was *attached*, not *posted* — but their task
   file's ⚠️ notes about handing off become **wrong the day this ships** and must be amended in the
   same commit.
2. **`saveCaptureNextTo` is named in UNI-011 as *"the single function that becomes an upload when
   there is somewhere to upload to"*.** This task is that somewhere. The capture stops being written
   to Documents and starts being an upload — 🔴 **which means blob storage, and no task owns it.**
   Decide it here or it becomes the next deployment-shaped hole.
3. **UNI-005 AC4's free-text census floor moves.** It classifies every free-text column against
   `information_schema` and fails **by name** on an unclassified one. New attachment columns will
   trip it, which is the guard working. ✅ Most attachment leaves are booleans, integers or closed
   vocabularies and classify as `machine-derived` (UNI-006's sixth class); the ones that are not —
   a title, a user's note on a capture — are `adult-authored` and **must not be writable from an
   org-minor seat**, per UNI-006's precedent.
4. **The `lessonverify` catalogue is built-ins only** and its `unknown-node-type` is an error. A
   `node_excerpt` naming a custom kit node is legitimate content and must not be validated against
   that catalogue — 🔴 see P69/CN-003. Render the type as sent; do not resolve it.

## Acceptance criteria

1. **A node excerpt posted from the editor renders as a node** — type, ports, values in place —
   and the same payload posted twice produces the same rendering, asserted structurally rather than
   by screenshot.
2. **A withheld port is visible as withheld.** Driven: a capture with one port unticked renders a
   redaction chip, and the withheld *name and value appear nowhere in the served HTML*. 🔴 Beside a
   known-firing control — a ticked port that **does** appear — because an assertion that a string is
   absent passes identically when the whole feature is broken.
3. **Facets are derived, not typed.** A control that strips the derivation must fail a filter spec;
   no code path lets a user set a facet directly.
4. **Filtering by (node type, version) returns exactly the matching threads**, asserted over a
   seeded set that includes a near-miss on each axis.
5. **The signed-out browser hand-off still works**, unchanged — asserted, because the tempting
   cleanup is to delete it.

## Not in v1

Rendering a *whole project*; editing an attachment after posting; attachment search beyond the
facets; video; the lesson-step renderer if UNI-007's format is still moving (ship the other three
and say so).

## ⚠️ Open call for Richard, and it is small but real

**Where do capture images live?** Attachment #2 above. Options: a blob column (simplest, ugly at
scale), object storage (an account), or the deployment box's disk (ties to the nexus-1 decision).
🔴 **It intersects deployment, which is STILL OWNED BY NO TASK** — and D19 makes that gap sharper, since a forum has to be somewhere.
