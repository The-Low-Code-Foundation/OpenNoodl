# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## s10 gave the unowned defect a task, a cause and a fix. What it did **not** do is drive it

**SBR-015 — "A failure with nowhere to go"** is written, built, gated and committed
(`48ad4dfc`). `test:ci` ran and is **at the floor**: 2889 specs, 4 failures, all four
`AIX-006 style vocabulary` **by name**.

The 30s-timeout defect SBR-006 §5.7 handed on was **one cause, not two**. Neither
`publishPage` nor `duplicatePage` wired a single `failure` edge, so every node in both
graphs had exactly one way out — the happy path — and any error became a silent 504 that
named nothing. They "disagree" only because duplicate creates its copy **before** the point
it stalls at and publish writes **after** one. `claimSite` (same file, 5 failure edges,
**29 ms**) was the control that made it visible.

## 🔴 The first job: the drive that answers the question the fix made askable

**Which node actually broke is still unknown, on purpose.** Four candidate causes each
*fitted* the evidence and each was refuted — see SBR-015 §2.3 for the table. Wiring the
failures is what lets the backend say; a fifth guess would have wasted the measurement.

**The repro is exact.** Publish a page with **zero sections** (the drive's page `0826ed8b`
had none — `Section: 0` in the whole site) and read the answer. Two candidates remain, both
now instrumented:

1. the query reports `failure` — a zero-row query against a class auto-created in that same
   second (the `Section` schema row was created at `21:14:56 UTC`, the exact second
   `publishPage` started);
2. a code node's guard returns because an input is still `undefined`.

⚠️ **They look different and you must not conflate them.** A guarded `return` is **not** a
`failure`, so case 2 shows as *no response and no failure either* — the fix will not have
made it speak. Case 1 now answers `This page could not be published.` in well under 30s.

Then record the answer in SBR-015 §2.3 — **including if it now simply succeeds**, which
would make the zero-section path the whole defect.

⚠️ Needs a project minted from the **regenerated** template. The running editor holds the
project in memory, so an on-disk patch never reaches the viewer.

## 🔴 Still owed from s9, unchanged

- **SBR-006 AC4's fix is authored and gated but NOT driven.** Click View site, expect `/`;
  the bug was `location.pathname === "/%7Bslug%7D"`. Same regenerated-template requirement.
- **SBR-006 AC1 was driven with one page, not ≥2.** Re-drive once SBR-008 lands and rows
  have titles to show.
- **SBR-006 AC2** stays half until **SBR-008** (`prop-*` is wire-only; the two-row table in
  §5.6 is the cleanest evidence the phase has).
- **§5.8 is Richard's call**: a refused query and an empty collection are the same screen —
  no rows, no count sentence, no explanation. Probably SBR-006's or SBR-010's.

## 🔴 The lessons from s10 most likely to repeat

- **A reading that FITS is not one that EXCLUDES — four times in one session.** Every
  refuted candidate was plausible enough to have been written up as the cause. The
  discipline that paid: refute against the *source*, not against the story.
- **A gate's first version is about the gate.** The new rule asked *"does this node reach a
  Response?"* — which every node on a happy path does, so it would have **passed the unfixed
  `publishPage`**. A hole exactly the shape of the defect, 14th of the family. The **mutant**
  caught it, not the green arm. It grades the failure **edge** now.
- **`completed` is the one outcome port that cannot mean success** — *"fires after every
  invocation, whatever the outcome"* (`outcome.ts`). It was wired straight into the page
  write and the Response. Two legitimate uses survive in the same file, both documented, so
  the gate grades **where it lands**, not the port.
- 🔴 **A pin can sit red for a whole session if nobody runs the gate.** Browser Function
  nodes 18 → 20 was red from `dc931e01` (SBR-006) because s9 never ran `test:ci`. The first
  run this session showed **7** failures; three were real, and only two were mine.

## Traps s10 paid for

- ⚠️ **The node type names in the artefact are not the authoring names.** `noodl.cloud.secret`,
  `noodl.cloud.addusertorole`, `noodl.cloud.sendemail` — and a component instance's type is its
  **legacyName** (`/#__cloud__/site/ContactRecipient`). A hand-written type list is an
  exclusion list that cannot fail; the gate asserts its classification is **total** instead.
- ⚠️ `execution_steps` in the backend's `executions.sqlite` is **empty for every execution** —
  the table exists and nothing writes to it for cloud functions. It can say *that* a function
  hung, never *where*. SBR-015 AC4.
- ⚠️ Two count pins move whenever a cloud graph does: `sb-007/site-template.test.ts` node ids
  (now **234**) and `sb017-helper-is-lossless.test.ts` connections (now **118**, four movers
  named in the comment). `sb017-deploy-connection-parity.test.ts` compares against a **frozen
  deployed bundle** — a removed wire must join `REMOVED_SINCE_THE_BUNDLE` with a reason.
- ⚠️ Read the summary line, not the exit code: `test:ci` exits 1 at the floor, and its readout
  is `packages/noodl-editor/tests/test-results.json` — **not** the package root.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and
  if the platform cannot express what an AC asks for, **say so and record the gap** rather
  than quietly substituting.
- Drive artefacts: **`SBR-006 Admin Drive`** (claimed, backend `backend_mtdg3sdziq5nw`, token
  `drive-token-sbr006`) — its `executions.sqlite` holds s9's three calls and is the evidence
  SBR-015 §2 is built on. `SBR-004 Mounted Drive` carries s8's.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns;
  `test:ci` alone, and never beside a live stack.
