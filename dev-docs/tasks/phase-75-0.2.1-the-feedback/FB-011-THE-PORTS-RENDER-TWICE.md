# FB-011 — the ports render twice

**Filed:** 2026-08-22, from Richard's item 11. **Status: ⬜ open — the deferred decision from
NAT-007 s8, now decided by the user it was deferred for.** Size: S/M. Revises **UNI-016's
rendering pair** — name it.

> *"In the bench, the bit about 'ports I choose to share' is a bit weird, the first part with
> the list makes sense… but the bit below where it shows a kind of fake mockup of the node is
> confusing and seems redundant."*

---

## What exists (swept 2026-08-22)

- **This exact redundancy is a recorded finding**, NAT-007 s8: *"A node question's ports render
  TWICE — on BOTH clients. Body prose + attachment rows, 11 ports, one screen. The web does it
  too… a unilateral editor fix would make the mirror disagree with the web — the one thing D15
  forbids. Left alone deliberately; it is one decision on the composer/renderer pair."*
  Richard's item is that decision arriving.
- The two renderings: the **composer** writes a prose port table into the post body
  (`nodesharecontext` builds the body), and the **structured attachment** (`node_excerpt`)
  renders via `Attachment.tsx` → `NodeFigure` (web) and the core-ui community components
  (editor). The withheld-count chip (`26 ports the asker chose not to share`) is **UNI-016's
  met AC** — visible redaction so answerers don't waste a reply asking for withheld data.
  **The chip stays.**

## The decision (proposed)

**The structured attachment is the single rendering; the composer stops writing the port table
into the body prose.** The prose body keeps only the human sentence (what the asker typed).
Rationale: the attachment carries facets, withheld count and consistent styling; the prose table
is the copy with no machinery behind it.

## Scope

1. Composer (editor): stop emitting the port table into the body. The live-values list Richard
   called sensible is the attachment's port rows — unchanged.
2. Renderers: no change needed for **new** posts once the composer stops duplicating. Old posts
   still carry the prose table — **do not retro-edit user content**; old threads render as
   authored. Acceptable: they age out.
3. Both surfaces verified on the same thread — D15's agreement is the whole reason this waited.

## Acceptance criteria

- AC1: a new node question renders its ports exactly once on the web and once in the mirror;
  the withheld chip still draws (UNI-016 AC intact).
- AC2: an old thread (pre-change) renders unmodified — no migration touched stored bodies.
- AC3: the composer spec asserts the body contains no port table (and still contains the
  asker's own words); the mockup-vs-list distinction Richard drew is the assertion's shape.
- AC4: UNI-016's specs updated where they asserted the body prose; the revised AC named in the
  diff.
