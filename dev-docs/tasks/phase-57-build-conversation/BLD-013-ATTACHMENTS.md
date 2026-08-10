# BLD-013 — Attachments

**Status:** ✅ **built and driven** (session 15, 2026-08-10) · **Track B** · after BLD-011, BLD-012

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

- [x] A markdown file dropped on the thread becomes a chip with its resolved size and reaches the
      model as text. — **driven**: pasted `BRIEF.md` → chip `BRIEF.md 53`, meter `1 attachment · 53
      characters`.
- [x] A pasted screenshot becomes an image chip, is downscaled, and reaches a vision model as an
      image block — and a text-only model as a **declared** substitution (BLD-012). — **driven**: a
      2400×1200 PNG (83,779 B) resized to 1568×784 and reported as `45 KB`.
- [x] An oversized file is refused or truncated **with a message**, before send. — **driven**: a
      21MB PDF and a `.zip`, both refused on the chip, both blocking Send.
- [x] PDF: either it works end-to-end, or dropping one produces a clear refusal. No half state. —
      **driven**: a 300KB PDF attached as `brand-guidelines.pdf 293 KB`, no warning, because the
      configured model takes documents.
- [ ] ⚠️ **The same attachment pinned across five turns is stored once.** — **NOT driven and not
      built.** See R3.

## Register

| # | Finding | State |
|---|---|---|
| 1 | 🔴 **A ceiling round in the source printed as a non-round limit.** `documentMaxBytes: 20_000_000` renders through `formatBytes` as **"19.1 MB"**, so a user who trimmed a PDF to just under 20MB was told the limit was 19.1. The number was right and the message was useless — nobody checks a ceiling against the constant, they check it against the sentence in front of them. | ✅ fixed — binary MB, and the spec asserts the *printed* value |
| 2 | 🔴 **BLD-011's fix for the 113.8px list became this task's layout defect.** `.Picker { position: relative; width: 100% }` was correct while the picker was alone in its row; with two siblings a full-width flex item claims the whole line, pushing them onto a second row at **every** width (67px at 248px, still 67px at 800px where all three fit in 742px). Positioning context moved to the row. | ✅ fixed — list still 340px in a 364px composer, row now 30px |
| 3 | ⚠️ **Byte-identical attachments are stored twice.** Build item 5 asks for store-once-reference-by-hash. Not built: nothing persists reference *bytes* at all (`TurnReference` records kind/label/size only, by BLD-011's design), so there is no store to dedupe *into* — but the in-memory composer list will hold two copies of one mock attached twice. | 🔴 open — cheap once BLD-006 persists bytes, meaningless before |
| 4 | ⚠️ **The OpenAI leg is a declared degrade, not a document path.** Chat Completions does have a `file` part shape; this adapter does not encode it, and I did not add one I could not verify against the live API here. A PDF on OpenAI reaches the model as its twin, stated on the chip. | 🔴 open — same shape as BLD-012's open OpenAI image leg |
| 5 | ⚠️ **Drag-and-drop was not driven.** Paste and the resolver were driven end-to-end; the picker opens a native dialog and the drop path shares every line of code below the `File[]` boundary, but the `dragover`/`drop`/`dragleave` handlers themselves have not been exercised by a real drag. | 🔴 open — BLD-010 |
