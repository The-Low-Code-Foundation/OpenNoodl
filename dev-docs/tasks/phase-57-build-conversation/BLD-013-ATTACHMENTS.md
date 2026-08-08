# BLD-013 — Attachments

**Status:** 📋 not started · **Track B** · after BLD-011, BLD-012

## What it is

Drop, paste or pick a file into the composer and have it ride the turn as a `file` reference:
a design mock, a spec, a brand guide, a competitor's page saved as an image.

Richard's framing: *"ability to upload a file (md or PDF or image?) for context"*.

## Build

1. **Three intake paths, one destination:** drag-and-drop onto the thread, paste from the clipboard
   (this is how a screenshot from outside the editor arrives, and it is the most common path in
   practice), and a file picker from the composer's `＋ Attach`.
2. **Markdown / plain text → text.** Trivial. Capped and truncated with `truncateDoc`'s
   heading-boundary cut ([docsText.ts:96+](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L96)),
   **not a second truncator**, and the truncation is stated in the injected text.
3. **Images → an `image` block** (BLD-012), downscaled before send. ⚠️ A 4MB phone screenshot is a
   transport problem and a cost problem; the render tooling already picked a ceiling for the same
   reason (*"a full page at 1280px wide and 4000px tall is ~500KB of PNG at 0.5"*,
   [renderTools.ts:26-31](../../../packages/noodl-mcp/src/tools/renderTools.ts#L26)). Reuse that
   judgement rather than re-deriving it.
4. **PDF — behind an open decision (Q5).**
   - There is **no PDF library anywhere in the tree**. This is the one genuinely new dependency the
     phase would take on, in a packaged Electron app that is already large.
   - If adopted: `pdfjs-dist`, **text first**. Rasterise pages to images only when the model has
     `vision` *and* the document is visual (a design PDF, not a spec).
   - If declined: the composer says so plainly when a PDF is dropped — *"PDFs aren't supported yet;
     paste the text or export a page as an image"* — rather than accepting it and failing later.
   - ⚠️ **Do not implement PDF before Richard answers Q5.** It is the largest cost in the task and
     the least-used of the three kinds.
5. **Attachments are per-thread and persisted** with the thread (BLD-006), so reopening shows what a
   turn carried. ⚠️ **Store bytes once, reference by hash** — the same mock pinned across ten turns
   must not be ten copies in the thread file.
6. **An attachment is mentionable.** Once attached it appears in the `@` menu (BLD-016) so it can be
   referred to by name in a later turn without re-attaching.

## Out of scope — say it plainly

**No filesystem access.** Attachments are things the user hands over deliberately. No folder reads,
no globbing, no watching a directory. If that changes it is a separate task with a threat model.

## Acceptance

- [ ] A markdown file dropped on the thread becomes a chip with its resolved size and reaches the
      model as text.
- [ ] A pasted screenshot becomes an image chip, is downscaled, and reaches a vision model as an
      image block — and a text-only model as a **declared** substitution (BLD-012).
- [ ] An oversized file is refused or truncated **with a message**, before send.
- [ ] The same attachment pinned across five turns is stored once.
- [ ] PDF: either it works end-to-end, or dropping one produces a clear refusal. No half state.

## Register

| # | Finding | State |
|---|---|---|
| | | |
