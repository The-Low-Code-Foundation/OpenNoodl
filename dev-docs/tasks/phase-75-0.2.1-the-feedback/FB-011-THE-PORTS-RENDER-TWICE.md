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

---

# ✅ RULED AND BUILT — 2026-08-24 (session 18)

**Status: done, web-side only. ⚠️ Not deployed.** `nodegx-community`, one commit.

## 🔴 THE PROPOSED DECISION ABOVE WAS BACKWARDS, AND THE REPORT SAYS SO IN TWO WAYS

The proposal was *"the structured attachment is the single rendering; the composer stops
writing the port table into the body."* That deletes the half Richard said **makes sense** and
keeps the half he called **confusing**. His sentence separates them by position and by shape:

> *"the first part with **the list** makes sense… but **the bit below** where it shows a kind of
> **fake mockup of the node** is confusing and seems redundant."*

- **Position.** `src/app/bench/[threadId]/page.tsx` renders `<PostBody>` (line 62) and then
  `<AttachmentList>` (line 64). The prose list is *"the first part"*; the attachment is
  *"the bit below"*. The proposal read the order the other way round.
- **Shape.** `NodeFigure` drew a title bar, inputs down the left column, outputs down the right
  — a picture of a node. That is *"a kind of fake mockup of the node"* almost word for word.

**Ruled by Richard, 2026-08-24: the smallest change — mockup → list only.** The body prose is
left alone. ⚠️ **AC1 (*"exactly once"*) is therefore knowingly NOT met** and is superseded, not
missed: the ports still render twice on a thread page.

## 🔴 WHY AC1 IS EXPENSIVE, WHICH IS THE FACT THE PROPOSAL DID NOT HAVE

`AskAboutNodeDialog.tsx` states its own rule at the top: *"**The preview is the payload.** The
`<pre>` below renders `question.body`, and the button copies `question.body`. There is no second
formatter."* The `<pre>` is labelled **"This is exactly what will be posted:"**.

So stripping the port table from the body also strips it from the preview, and that label
becomes false — the ports would still be posted, as structure, with nothing in the preview
saying so. Meeting AC1 honestly means giving the composer a second rendering of the attachment,
which is precisely the *"two paths that agree today"* arrangement `nodeartifact.ts` spends its
header warning against. It is a real decision and it has not been taken.

⚠️ A second consequence, recorded because it is the load-bearing one:
`tests-unit/uni-016/nodeartifact.test.ts` — *"the ticked values are byte-identical to the ones
the prose renders"* — anchors the structured payload to the prose. Empty the prose and the
subordination proof loses the thing it compares against.

## ✅ WHY ONE-SIDED WAS SAFE, WHEN NAT-007 SAID IT WOULD NOT BE

NAT-007 s8 left this alone because *"a unilateral editor fix would make the mirror disagree with
the web — the one thing D15 forbids."* That reasoning held for an **editor** fix. This is a
**web** fix, and it moves the other way: the editor mirror has always drawn these ports as a
`<ul>` (`CommunityThreadView.tsx`'s `AttachmentPorts`), so the figure was the surface that
disagreed. Replacing it **converges** the two rather than splitting them.

## What changed

- `src/components/Attachment.tsx` — `NodeFigure` → `PortList`, a `<ul class="portlist">` of
  `<li class="port">`. `PortRow` keeps the idle dot and the redaction ink unchanged.
- `src/app/globals.css` — `.nodefig` and its five children **deleted, not orphaned**, along with
  the `@media (max-width: 620px)` rule that sized the figure. Added `.portlist` and `.port-dir`.
  `.port`, `.port-dot`, `.port-name`, `.port-val` and `.port.redacted` are reused **unchanged** —
  they were already flex rows inside the old columns, so they carry over having already been
  through UNI-013's contrast pass.
- The file header claimed *"a node excerpt is drawn as a NODE — title bar, inputs down the left,
  outputs down the right"*. 🔴 **A sentence that outlived its behaviour, the third in three
  tasks** (FB-010's `--site-fg-primary`, FB-007's *"drag it into your post"*). Rewritten to say
  what still makes the structure worth storing: facets, filters, the withheld count — none of
  which needed the drawing.

### 🔴 TWO THINGS THE RESHAPE WOULD HAVE SILENTLY LOST

1. **Direction.** The figure encoded it **positionally** — inputs left, outputs right. One
   column cannot, so it is now written down as `(input)` / `(output)`, spelled the way the body
   prose spells it. ⚠️ Collapsing two columns into one list is exactly the edit where somebody
   keeps one `filter` and drops the other, and the page still looks perfectly reasonable: a tidy
   list, with **every output missing**. That is mutation 1, and it turns three rows red.
2. **The node type** is now drawn **once**, by the facet chip `AttachmentList` already renders
   above. The figure's title bar read `payload.nodeType`; the chip reads the **database-generated
   facet**, which a sender cannot type. Two spellings of one fact from two sources is the
   arrangement that drifts, and the derived one is the one that survives.

## Specs — `tests/fb011-ports-render-once.test.tsx`, 14 specs

🔴 **The first spec over the `node_excerpt` renderer at all.** `e7-capture-render` grades the
`capture` branch beside it; the excerpt branch shipped in UNI-016 and had never been rendered in
a test — which is how a decorative rendering sat next to a prose duplicate of itself for two
phases without a gate noticing.

✅ **Nine mutations, all red**, listed below. ⚠️ The `<li>` → `<span>` mutation first reported
`no tests` — a **JSX compile failure, not a spec catching it**. It was re-run as a mutation that
compiles (`<ul>`→`<div>` and `<li>`→`<span>` together) before being counted, because a spec that
fails *to run* has not drawn a red.

| # | mutation | result |
|---|---|---|
| 1 | outputs dropped (`filter(direction === 'input')`) | **3 failed** |
| 2 | direction label removed | 2 failed |
| 3 | redaction styling dropped | 1 failed |
| 4 | empty list still draws the bordered box | 1 failed |
| 5 | node-type title bar re-added | 2 failed |
| 6 | withheld count dropped | 2 failed |
| 7 | rows revert to `<span>` in a `<div>` | 1 failed |
| 8 | an empty value invents a `port-val` | 1 failed |
| 9 | note dropped | 1 failed |

✅ **A control pair, not a single reading**: *"does not repeat the node type"* asserts
`not.toContain('For Each')` on the attachment — which would pass just as well on a renderer that
dropped the type from the page **entirely**. So it is paired with an `AttachmentList` row
requiring the chip to still say `For Each`.

## Acceptance criteria

- **AC1 — ⚠️ SUPERSEDED, not met.** Ruled above. The ports render once in the *attachment*, and
  the body prose keeps its copy. The withheld chip draws (UNI-016 AC intact, asserted).
- **AC2 — ✅ met, and for free.** No migration and no retro-edit: only the renderer changed, so
  an old thread renders as authored. Nothing reads or rewrites a stored body.
- **AC3 — ⚠️ n/a under this ruling.** The composer is untouched; the body still contains the
  port table by decision. The *renderer* half of the mockup-vs-list distinction is what the new
  spec asserts.
- **AC4 — ✅ nothing to update.** No existing spec asserted the figure. `uni013-slice5` and
  `uni023-facet-bar` render a `node_excerpt` with `ports: []` and assert nothing about it; both
  still pass. UNI-016's rendering pair is revised and named in the diff.

## Found while working, owned by nobody

- 🔴 **`npm run check:css` has ONE violation and it is NOT this change**:
  *"`--site-avatar-ink` declares a colour (#07090c) with no recorded reason."* The token was
  added in `d205b47` (UNI-013) and **NAT-003** then re-pointed it — its notes say it *"was
  reaching the dark ramp through `neutral-0` while painting a gradient that follows no theme"*.
  Giving it a literal was the fix; adding its reason to `ALLOWED_SITE_COLOURS` in
  `scripts/check-built-css.mjs` was not done, so the gate has been red since. ⚠️ **Left alone
  deliberately** — the reason has to be NAT-003's, and writing a colour justification for a
  decision this session did not make is how an allow-list becomes a rubber stamp. This diff
  touches **zero** avatar lines.
- ⚠️ **The editor mirror never renders port DIRECTION.** `attachmentPorts` returns it and
  `CommunityThreadView` uses it only as a React key. This is **pre-existing and unchanged by
  this task** — the web carried direction positionally before and textually now, so the gap is
  exactly as wide as it was. Recorded rather than fixed: the ruling was the smallest change, and
  the mirror's half is one `<span>` whenever somebody wants it.

## The drive (real HTTP, own database, real `next start`, no browser)

`npm run build`, then `npx next start -p 3200` against a `DATABASE_URL` of its own
(`nodegx_community_fb011drive`), seeded with one thread whose excerpt carries **every row
shape at once**: a set input, an empty input, a **redacted** input, two outputs, and two
withheld ports. Fetched over real HTTP at `/bench/<id>`.

| arm | what happened |
|---|---|
| **A — the mockup is gone** | `nodefig` appears **0 times** in the served page |
| **B — the list is served** | one `<ul class="portlist">`, five `<li class="port">`, in the order sent, outputs included |
| **C — direction** | `<span class="port-dir">(input)</span>` and `(output)` both present in production bytes |
| **D — UNI-016 intact** | the redacted row keeps its place as `class="port redacted"` with `&lt;port&gt;`; the withheld chip draws *"2 ports…"*; the `For Each` facet chip still draws |
| **E — the styling actually arrives** | both linked stylesheets 200; `.portlist` and `.port-dir` present in the one the page links |

### 🔴 THE DRIVE FOUND SOMETHING 14 GREEN SPECS COULD NOT, AND IT IS AN INSTRUMENT BUG

`(input)` was **absent from the served page** while the spec asserting it was green.

`renderToStaticMarkup` — the instrument the whole spec file uses — **joins adjacent text
nodes**. React's real server render does not: it separates them with `<!-- -->`. So
`({port.direction})` reached the browser as `(<!-- -->input<!-- -->)`. It *displays* correctly,
so nothing was visibly wrong; what was wrong is that the markup a reader receives and the
markup the spec grades were **different bytes**, and every assertion of the form
`toContain('(input)')` was true only of the instrument.

✅ Fixed at the source rather than in the assertion: the component interpolates **once**,
`{`(${'{'}port.direction{'}'})`}`, so both renderers emit the same single text node. The spec now
asserts the whole `<span class="port-dir">(input)</span>`, which cannot pass on split nodes.

⚠️ **`Withheld` has the same shape and was deliberately NOT reshaped** — it is UNI-016's
component and not this task's. Its spec assertion is what bends instead:
`/26(<!-- -->)?\s*ports?/`, which grades either instrument. 🔴 **The general lesson: a
`toContain` over concatenated JSX text is an assertion about the RENDERER, not about the page.**

⚠️ **One more way this nearly read green:** the thread page links **two** stylesheets, and the
first one carries none of these rules. Checking `head -1` reported `.portlist` missing and the
page unstyled — both false. The rules are in the second, and the built CSS also **merges**
declarations into shared selectors (`.port,.portlist{display:flex;min-width:0}`), so a grep for
`.portlist{...}` alone under-reports what the element actually gets.

## Gates, this tree (`nodegx-community`)

- `tests/fb011-ports-render-once.test.tsx`: **14/14**, nine mutations red.
- Every render suite together — `e7-capture-render`, `uni017-queue-rows`, `uni019-home`,
  `uni023-facet-bar`, `uni013-slice5`, `nat007-device-consent`, `uni020-tutorials`,
  `uni021-replays`: **8 files / 138 specs / 0 failures**.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean. Built CSS carries `portlist` and **zero** `nodefig`.
- `npm run check:css`: 1 violation, pre-existing and attributed above.
