# UNI-018 — pull a graph into your editor

**Surface:** editor (+ a platform read) · **Tier 2** · **Effort:** M · 🔴 **NOT BUILT.**
Blocked on **UNI-016** (`graph_fragment` attachments must exist).

> 🔴 **READ §"THE HAZARD" BEFORE SCOPING ANY OF THIS.** It is the sharpest security question in
> phase 67 and it was found while scoping, not while building.

## Premise

The answer to *"why is my graph broken"* is usually **a graph**, not a paragraph. This is the loop
that makes the Bench a product rather than a message board with syntax highlighting: an answer
carries a `graph_fragment`, and the asker pulls it into their project.

✅ **It stays inside D14.** The bridge is **editor-outbound only** and a pull is the editor reaching
out — the same shape as *"beaming a lesson is a pull"*. No ruling needs reopening.

## 🔴 THE HAZARD — a pulled fragment is executable code from a stranger

**Measured, not assumed** (`packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts`):
the node whose display name is **`Function`** is type `JavaScriptFunction`, and it carries a
**`functionScript` string parameter that becomes executable JavaScript**. The `Script` node carries
the same thing under `code`.

So a graph fragment is not data. **A fragment posted by anyone on the internet, pulled into an
editor, is arbitrary JS running on the puller's machine with the editor's privileges** — and the
editor is Electron, so that is not a sandbox.

⚠️ **And the delivery is perfectly disguised.** The fragment arrives as *the answer to a question
the victim asked*, from an account that may have points and badges, in a UI whose entire job is to
say "this is the fix". Every social signal points the right way.

**The scope call, and it is not negotiable in v1:**

1. 🔴 **The pull refuses any node carrying executable content** — `JavaScriptFunction`, `Script`, and
   anything else whose parameter schema is code. Refused at the **platform**, so a fragment
   containing one cannot be *stored*, and again at the **editor**, so an older client is not the
   only guard. 🔴 **Two enforcement points, because a rule in one client is one release away from
   disagreeing** — D14's own argument.
2. **The allow-list is of node types whose parameters are data**, derived from the catalogue's own
   parameter schemas, **never a deny-list of known-bad types.** A deny-list is wrong the day a new
   code-bearing node ships; the census must be over the whole population.
3. **The pull is previewed, never applied.** Nodes land in a review state the user confirms — the
   editor already has the vocabulary for this in the plan/apply MCP flow.
4. **Nothing is pulled into the open project silently**, and no pull touches a file outside it.

⚠️ **If the allow-list turns out to exclude most useful answers, that is a finding, not a reason to
weaken it** — record it and come back with a design (a reviewed diff, a signed fragment from a
bar-clearing author), not with a wider list.

## Scope

- **Editor**: a fragment renderer in the mirror, a review step, an apply into the open project.
- **Platform**: the storage-side refusal, and a `graph_fragment` shape that cannot express code.
- **Provenance carried through**: the fragment records which thread and account it came from, and
  the review step shows it. A user should be able to answer *"where did these nodes come from"*
  a week later.
- **Reuse `toLegacyName`** and the stored-node rules — 🔴 a project on disk is not the editor's
  graph, a component is a **legacy name**, and a stored node serialises **only dynamic ports**.

## Acceptance criteria

1. **A fragment containing a `Function` node is refused at the platform with a named reason**, and
   **separately** refused by the editor when handed one directly — two controls, each proving the
   other is not the only guard. 🔴 Disable one and the other's spec must still fail the payload.
2. **The allow-list is derived from parameter schemas**, asserted over the *whole* catalogue with a
   recipe-coverage check, so a new code-bearing node type fails the suite until classified.
3. **A pull is previewed and requires confirmation**; a spec asserts the project is unmodified
   before confirmation, driven in the real editor.
4. **Provenance survives the apply** — thread and author readable from the pulled nodes afterwards.
5. **Driven end-to-end**: post a fragment, pull it, confirm, and the graph renders — consequences
   written before the drive, per this phase's standing rule.

## Not in v1

Pulling a whole component or project; diffing against the user's existing graph; applying to a
project that is not open; any path that writes without confirmation.
