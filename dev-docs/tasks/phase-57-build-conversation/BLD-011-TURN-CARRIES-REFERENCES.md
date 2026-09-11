# BLD-011 — The turn carries references

**Status:** ✅ **built and driven** (2026-08-10) · **Track B** · ⭐ **the frame for Track B**

**Driven against a real Anthropic endpoint, one call, `$0.029799`.** The frame, both resolvers, the
chip row, the meter, the caps, the carry-over rule and the retention rule are all live measurements.
Three defects came out of the drive and none of them was reachable from a spec — see the register.

⚠️ **Two acceptance criteria are partly met and say so below**: the drive attached **four references
of two kinds**, not three (the third kind is BLD-013/014/015's to add — there is nothing else to
attach yet), and **staleness is specced rather than driven**, because nothing produces a `capture`
until BLD-014.

⚠️ **The one thing the billed call did *not* establish is comprehension.** The attached
`docs/CONVENTIONS.md` carried a deliberately unmissable naming rule, and the plan never triggered it
— the model correctly *reused* the project's existing `/Library/Layout/Footer` rather than creating
anything, so the rule had nothing to apply to. The block demonstrably went on the wire (`9238`
written tokens against a turn that carries ~5k without it, `+0 cached`), and the prompt assembly is
pinned byte-exactly by spec. But **BLD-012's distinction stands: transport is not comprehension**,
and this task has only proved the first half.

## What this task is

Richard asked for four things: file upload, web search, headless render/screenshot for context, and
`@` mentions. **Built as four features they are four bolt-ons to a composer that currently sends a
single string** — four ways to stuff a prompt, four cost models, four places to get caching wrong.

Built as one mechanism they are one task plus five resolvers. **The composer stops being an input
and becomes a context builder.** A turn carries *references*; a reference resolves to text, images,
or both, at the moment you press send. `@` is the keyboard path to one, drag-and-drop is the file
path, a pasted URL is the web path, "look at it" is the render path.

## The shape

```ts
type Reference = {
  kind:    'component' | 'doc' | 'page' | 'collection'   // @ mention        (BLD-016)
         | 'file'                                        // dropped/pasted   (BLD-013)
         | 'capture'                                     // app or URL       (BLD-014)
         | 'search'                                      // query + results  (BLD-015)
  label:   string          // what the chip says: "/Pages/Checkout", "brief.pdf"
  pinned:  boolean         // rides every turn, or just this one
  resolve(): { text?: string; images?: AiContentBlock[]; chars: number }
}
```

One list, one chip row, one resolution step, one cost meter. Each later task adds a `kind` and its
resolver and nothing else.

## Rule 6 — references ride behind the cache boundary

**This is the load-bearing constraint and it is not optional.**

AIX-007 made the prompt prefix byte-stable across every turn of every session, and `AiMessage` carries
an explicit `cacheBoundary` as a character offset for exactly this reason
([types.ts:47-59](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L47)).
`DOC_CAPS` caps each doc *before* it reaches the shared budget rather than trusting the budget to
notice ([docsText.ts:62-77](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L62)).

Attachments are the same problem with a much bigger gun. **Every reference resolves after the cache
boundary**, where content already varies per turn — so a dropped screenshot can never invalidate a
cached prefix. Per-reference caps, per-turn total, and the cached share, all visible in the composer.

## Rule 7 — a reference is pinned, or it perishes

A mock you are copying should ride ten turns. **A screenshot of your own app is true for about one**
— the agent is actively changing the thing it depicts. So:

- Every reference has a `pinned` state, toggled from its chip.
- A `capture` carries its age and the apply-count since it was taken; after the next apply it greys
  and says *"taken 3 turns ago — refresh?"*.
- **Nothing stale is ever sent silently.** A stale reference is either refreshed, dropped, or sent
  with its age stated in the text — never quietly re-attached.

## Build

1. **`Reference` model + a store on the turn.** Resolution happens once, at send, into the request.
2. **The chip row above the composer**: kind glyph, label, resolved size, pin state, remove.
3. **The cost meter**: per-turn total and the cached share. This is not decoration — during an alpha
   where everyone brings their own key, it is the only feedback loop anyone has, and AIB-002 already
   made this argument for run cost
   ([ProjectAuthoringView.tsx:160-172](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L160)).
4. **Caps, reusing `truncateDoc`'s heading-boundary cut** rather than a second truncator. State
   truncation in the injected text — a silently short reference is the failure mode the docs format
   already learned to avoid.
5. **References are part of a turn**, so BLD-006 persists them: reopening a thread shows what rode
   along with each message. ⚠️ Persist the *reference*, not necessarily its bytes — a 2MB screenshot
   per turn will make thread files unusable. Decide and document a retention rule.
6. **A reference the resolver cannot fulfil fails loudly, in the chip**, before send — not silently
   at request time.

## Acceptance

- [x] **Four references of three kinds attach, show sizes, and resolve into one request.** ⚠️ **Four
      references of _two_ kinds** — `Pages/Home 2.6k`, `Library/Layout/Header 1.6k`,
      `docs/CONVENTIONS.md 12k cut`, `docs/BRIEF.md 316`. A third kind does not exist to attach: the
      remaining members of `ReferenceKind` are BLD-013/014/015/016's, and inventing one to satisfy a
      count would be the fake pass this phase keeps paying for. The mechanism is kind-agnostic and
      `KIND_ICONS` is a `Record<ReferenceKind, …>`, so a kind added without a glyph does not compile.
- [x] **A turn with references produces a request whose prefix is byte-identical to the same turn
      without them.** `tests-unit/bld-011/cacheSafety.test.ts`, on the create turn and the update
      turn, asserting the `cacheBoundary` **offset** as well as the bytes — a prefix that is the same
      length by luck is not the same prefix. ⚠️ **The check was inverted before it was trusted**:
      moving the block into `referenceBlocks` turns it red on the offset, not merely on content.
- [x] **Unpinned references do not appear on the next turn; pinned ones do.** Both halves driven, at
      different moments: unpinning `docs/CONVENTIONS.md` moved the meter's pinned figure from 15k to
      2.9k while the turn total held at 15k, and after the billed send both pinned references were
      still on the chip row. `carryOver` is specced for the drop, including the rule that a **failed**
      reference never carries.
- [ ] ⚠️ **A capture greys and offers refresh after an apply.** **Specced, not driven — nothing
      produces a `capture` until BLD-014.** `isStale` / `staleAge` / the `[STALE — taken N changes
      ago…]` sentence are graded in `references.test.ts`; the chip's `is-stale` border and its
      `title` are built and have never been on screen. Filed as R4.
- [x] **Removing a chip changes the cost meter.** Removing `docs/BRIEF.md` took the row 3 → 2 and the
      pinned figure 2.9k → 2.6k.
- [x] **Reopening a persisted thread shows what each turn carried.** The record row renders under the
      request (`Pages/Home 2.6k · docs/CONVENTIONS.md 12k cut`), and the round trip through
      `serialiseThread`/`parseThreadFile` is pinned in `threadFile.test.ts`. ⚠️ **The `.jsonl` itself
      was not driven** and the reason is stated in that file's header: a turn only reaches the file
      once the *next* request retires it, so driving it costs a second billed call to prove a
      property that is entirely about a file format. What *was* checked on disk is the negative and
      more important half — `.nodegx/plan/session.json` came back at **1,458 bytes** with no
      `references` key, no `ATTACHED CONTEXT`, and none of the attached document's body in it.

## What was measured

Driven in the running editor on `nodegx-qa-fixture` (24 components; two `docs/` files created for the
drive and **removed afterwards** — see R6).

| | result |
|---|---|
| billed call | **`$0.029799`** — `anthropic/claude-sonnet-5 — 2 in (+0 cached, 9238 written) / 670 out` |
| route taken | `plan`, 3 operations — deliberately, so no component authoring auto-ran on top of it |
| cap fired | `docs/CONVENTIONS.md` cut to **11,904 of 23,544**, stated in the chip title and in the prompt |
| meter, 3 refs | `3 attachments · 15k characters` / `15k of it is pinned — sent again, uncached, on every later turn.` |
| after unpinning the big doc | total held at **15k**, pinned fell to **2.9k** |
| horizontal overflow, **248 → 607px** | **0** at every width — row, meter, chips outside the composer, and `document.body` |
| contrast, dark / light | label **6.66 / 6.54** · size **6.66 / 6.54** · "cut" **7.96 / 4.74** · meter **7.70 / 7.10** · picker toggle **6.66 / 6.54** |
| picker list | 340px wide, opens **upward** (347→607 above a toggle at 611), 24 options, **1** label ellipsized — the fixture's deliberately-long-name component |

**Gates:** `typecheck:editor` clean · `typecheck:editor-tests` clean · `test:main` **103 suites,
1410 tests**, zero failures · `test:ci` **`2596 specs, 6 failures`, seed 27603** — the documented
baseline, the same six by name, now confirmed at a third seed.

## Register

| # | Finding | State |
|---|---|---|
| R1 | 🔴 **The picker listed the graph's internal spelling.** It offered `__page__/Home` and `__cloud__/test` — a spelling that appears nowhere else in the product. `legacyNameToPath` strips the leading `/` and `#` and leaves these two markers in; ⚠️ **its docstring claims it strips `__cloud__/` and it does not**, which is pre-existing and left alone. Mapped rather than deleted (`Pages/…`, `Cloud/…`), because stripping outright would render a page called `Home` and a component called `Home` as the same chip. ⚠️ **The kind deliberately stays `component` even for a page**: `ReferenceKind.page` is BLD-016's, for an `@`-mentioned page, and what gets attached here is a component's v2 serialization whatever folder it sits in — classifying by folder would have quietly halved `REFERENCE_CAPS` on every page in the project. | ✅ fixed |
| R2 | 🔴 **The picker list opened 113.8px wide — the width of its own button.** `.List` is `left: 0; right: 0`, which resolves against `.Picker`, and `.Picker` sat in an `HStack` that shrink-wraps to its child. So `Library/Layout/Breadcrumbs` — the exact case a picker exists to let you find — rendered as `Library/L…`. Nothing was broken and nothing threw; **the control simply could not be read**, which is the failure a screenshot taken in the wrong state hides completely. `width: 100%` on the wrapper costs nothing visually, because `PrimaryButton` only fills its parent when `isGrowing` is set. | ✅ fixed |
| R3 | ⚠️ **The "Add context" button failed AA in light at 4.33:1** — `Ghost`'s accent label on the composer's `bg-2`, which is **the same 4.33 already on the design-system list** as C7 (BLD-002) and hardened by BLD-008's R12. Third sighting. **Not fixed with a per-call-site override**: that is how one token defect becomes five copies that disagree, and R12's own note says this needs a full-surface pass. Switched to `MutedOnLowBg`, which measures **6.66 dark / 6.54 light** — and is the better control on the merits anyway, since attaching context is secondary to Send and an accent-bordered button beside the CTA was competing with the thing it supports. The muted variants carry POL-016's inset ring, so it still reads as a control. | ✅ fixed locally; **design-system row unchanged** |
| R4 | 📋 **Staleness has never been on screen.** `isStale`, `staleAge`, the `[STALE — …]` prompt sentence and the chip's `is-stale` border are built and specced; nothing produces a `capture` until BLD-014, so the whole Rule 7 refresh affordance is inference. Same shape as BLD-008's R15 (`.Proposal` survived a real drive without executing). | 📋 filed → **BLD-014** |
| R5 | ⚠️ **A truncated reference's `chars` exceeds its cap, and that is correct.** `docs/CONVENTIONS.md` capped at 12,000 reported **12,034**: `capReferenceText` cuts the *body* at a heading boundary (≤12,000) and then appends the `[TRUNCATED — …]` notice, which is overhead that exists to make the cut legible. `chars` is the length **as sent**, because a meter that reported the pre-cap length would under-report a cut reference and over-report an uncut one, in opposite directions. Same contract as `renderDocForPrompt`. | ✅ by design, recorded |
| R6 | ⚠️ **The QA fixture has no `docs/`, and that is a property BLD-008 depends on.** Two docs were created to drive the `doc` resolver and **removed afterwards**, along with the `.nodegx/plan/session.json` the drive produced; `project.json` was never touched (mtime unchanged at 09:24, and the plan was never applied). To re-drive the doc kind, recreate `docs/BRIEF.md` and a `docs/CONVENTIONS.md` larger than 12,000 characters. | ✅ fixture restored |
| R7 | ⚠️ **Aligning a container is not aligning its contents.** The record row under a turn's request is `justify-content: flex-end`, but that positions the *row*, which is a full-width flex item — so the chips inside packed left and sat under a right-aligned bubble with their right edges **154px short of it**, reading as the agent's reply rather than as part of the user's message. Fixed with `.Row.is-record`, and the consequence measured rather than the mechanism: chip right-edges moved from **263 / 274** to **422 / 422**, flush with the row. | ✅ fixed |
| R8 | ⚠️ **Attachments are charged once per operation on a plan route, and the meter had to be written to say so.** `PlanRun` spreads `options.session` into every operation's `AuthoringSession`, so a pinned 24k component is fresh input on the planning turn **and again on each component the plan builds** — none of it cached, by Rule 6's own construction. The meter reports `pinnedChars` separately from the turn total for exactly this reason; a single undifferentiated number would have made a pinned reference look like a one-off cost. | ✅ built, stated on screen |
| R9 | ⚠️ **The billed call proved transport, not comprehension.** The attached `CONVENTIONS.md` carried an unmissable naming rule and the model never reached it: asked for a footer, it correctly **reused** the project's existing `/Library/Layout/Footer` instead of creating anything, so the rule had nothing to apply to. Good behaviour, and a wasted probe. **A comprehension test has to be answerable by the route the request will actually take** — BLD-012 earned this lesson with a blue square and it was half-relearned here. | 📋 filed → **BLD-010** |
