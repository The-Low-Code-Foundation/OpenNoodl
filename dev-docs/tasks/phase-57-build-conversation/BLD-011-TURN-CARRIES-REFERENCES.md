# BLD-011 — The turn carries references

**Status:** 📋 not started · **Track B** · ⭐ **the frame for Track B** · after BLD-001

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

- [ ] Four references of three kinds attach, show sizes, and resolve into one request.
- [ ] A turn with references produces a request whose **prefix is byte-identical** to the same turn
      without them. This is the cache-safety check and the reason the task exists.
- [ ] Unpinned references do not appear on the next turn; pinned ones do.
- [ ] A capture greys and offers refresh after an apply; sending it anyway states its age in the text.
- [ ] Removing a chip changes the cost meter.
- [ ] Reopening a persisted thread shows what each turn carried.

## Register

| # | Finding | State |
|---|---|---|
| | | |
