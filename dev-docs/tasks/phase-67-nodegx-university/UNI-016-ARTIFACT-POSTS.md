# UNI-016 — artifact posts: a question renders as the thing it is about

**Surface:** platform + editor · **Tier 1** · **Effort:** M/L · 🟡 **PLATFORM HALF BUILT
2026-08-18 (session 27). THE EDITOR'S POST IS NOT BUILT.**

> ## 🟡 WHERE THIS ACTUALLY STANDS — read the second list as carefully as the first
>
> ✅ **Built:** `0009_uni016_attachments.sql` (`post_attachments`, four kinds), `src/lib/
> attachments.ts`, `src/components/Attachment.tsx` (the node figure, the capture panel, the
> graph-fragment chips), the node-figure CSS, and `tests/uni016-attachments.test.ts` — **24
> specs**. Attachments are served on every post by `threadById`.
>
> | AC | State |
> |---|---|
> | **AC1** a node excerpt renders as a node; the same payload renders the same way | ✅ **MET** — asserted structurally, and the two posts' ids are asserted DIFFERENT so it is not comparing a row to itself |
> | **AC2** a withheld port is visible as withheld, name and value nowhere | ✅ **MET** — beside the known-firing control AC2 asks for by name (a shared port that DOES appear) |
> | **AC3** facets derived, not typed | ✅ **MET, and stronger than asked** — they are GENERATED columns, so the control is not a grep for a missing setter but an attempted write that Postgres refuses. Asserted on both INSERT and UPDATE, whose messages differ |
> | **AC4** filtering by (node type, version) over a set with a near miss on each axis | ✅ **MET** — four-thread matrix, each axis varied independently, plus the empty-filter and hidden-thread cases |
> | **AC5** the signed-out browser hand-off still works, unchanged | ✅ **TRUE, and trivially so — because nothing in the editor was touched.** ⚠️ It is NOT the assertion AC5 wanted, which presumes the POST exists beside it |
>
> 🔴 **NOT BUILT — the whole editor half.** `AskAboutNodeDialog` does not POST; it still hands
> off to the browser with a prefilled composer. **This is the last piece of the task**, and
> until it lands the platform can receive artifact posts that nothing sends. The route is
> ready (`POST /api/v1/bench/threads`), the payload shapes are `NodeExcerptPayload` /
> `CapturePayload` in `src/lib/attachments.ts`, and the bearer token the dialog already holds
> is the credential.
>
> 🔴 **`lesson_step` HAS NO RENDERER, deliberately** — the scope permits it: *"ship the other
> three and say so"*. UNI-007's format is still moving.
>
> 🔴 **BLOB STORAGE IS STILL OWNED BY NO TASK, and the decision is deferred rather than
> dodged.** A `capture` attachment carries its DIMENSIONS and its consent record and **no
> image**; `saveCaptureNextTo` still writes to the asker's Documents folder. That is exactly
> what `CaptureAttachment` (`{width, height, bytes}`) publishes today, so **nothing will have
> to be migrated** when the answer arrives — an `image_url` column and a writer are the whole
> change. ⚠️ It intersects deployment. Still Richard's call.
>
> ⚠️ **UNI-005 AC4's census moved and was fed.** `post_attachments.payload` and `.note` are
> **`minor-refused`**, not `machine-derived` — the first draft claimed the latter and the
> census caught it by demanding a probe the class could not supply. A pupil cannot reach the
> table at all: an attachment hangs off a `bench_post`, which `board_actor_is_eligible()`
> refuses them.

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
