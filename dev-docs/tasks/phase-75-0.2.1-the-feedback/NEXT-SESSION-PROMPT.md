# Phase 75 — next session

**State as of 2026-08-24 (session 18).** Session 18 built, specced and **drove FB-011 over real
HTTP**: the web's fake node mockup is now a list, matching what the editor mirror already drew.
**FB-011 is closed.** ⚠️ **It is web-side and NOT deployed** — it is the only thing ahead of
nexus-1's stamp. Read *"What session 18 found"*, then session 17's notes, which still stand.

## What session 18 found

### 🔴 THE TASK FILE'S PROPOSED DECISION WAS THE INVERSE OF RICHARD'S REPORT

FB-011 carried a *"## The decision (proposed)"* section written by an earlier session:
*"the structured attachment is the single rendering; the composer stops writing the port table
into the body."* Richard's filed words:

> *"the first part with **the list** makes sense… but **the bit below** where it shows a kind of
> **fake mockup of the node** is confusing and seems redundant."*

The proposal **deletes the half he said makes sense and keeps the half he called confusing**.
Two independent readings settle it, both from code rather than prose:

- **Position** — `src/app/bench/[threadId]/page.tsx` renders `<PostBody>` (62) then
  `<AttachmentList>` (64). *"The bit below"* is the attachment.
- **Shape** — `NodeFigure` drew a title bar with inputs down the left column and outputs down
  the right. That is *"a fake mockup of the node"* almost word for word.

🔴 **A *proposed* decision sits under the same heading as a ruled one and reads as settled.**
Re-derive it from the quote and the render order before building. **Ruled by Richard, 08-24:
the smallest change — mockup → list only, body prose untouched.**

### ⚠️ AC1 CAME BACK SUPERSEDED, NOT MET — and the reason is worth keeping

FB-011's AC1 says the ports render *"exactly once"*. They still render twice, by ruling. The
cost of meeting it is the thing the proposal did not have: `AskAboutNodeDialog` states
*"**the preview is the payload** — the `<pre>` below renders `question.body`"*, under a label
reading **"This is exactly what will be posted:"**. Emptying the body empties the preview, so
the label goes false while the ports still post as structure. Meeting AC1 honestly needs a
second composer rendering — precisely the *"two paths that agree today"* hazard
`nodeartifact.ts` spends thirty lines warning against. ⚠️ It would also unanchor
`tests-unit/uni-016/nodeartifact.test.ts`'s *"byte-identical to the ones the prose renders"*,
which is what proves the payload is subordinate to the prose.

### ✅ ONE-SIDED WAS SAFE WHERE NAT-007 SAID IT WOULD NOT BE

NAT-007 s8 left this alone: *"a unilateral editor fix would make the mirror disagree with the
web."* That held for an **editor** fix. The mirror has always drawn a `<ul>`
(`CommunityThreadView`'s `AttachmentPorts`), so **the web was the outlier** and fixing it
**converges** the surfaces. 🔴 Before inheriting a *"would break D15"* refusal, check which side
is actually the odd one out — the refusal may be aimed at the wrong surface.

### 🔴 THE DRIVE FOUND AN INSTRUMENT BUG THAT 14 GREEN SPECS COULD NOT

`toContain('(input)')` was green; the string was **absent from the served page**.
`renderToStaticMarkup` **joins adjacent text nodes**; React's real server render **splits them
with `<!-- -->`**, so `({port.direction})` shipped as `(<!-- -->input<!-- -->)`. It displays
correctly, so nothing looked wrong — but the bytes the spec graded were never the bytes a reader
got. ✅ Fixed at the source (interpolate once); the spec now asserts the whole
`<span class="port-dir">(input)</span>`. ⚠️ `Withheld` has the same shape and is UNI-016's, so
its **assertion** bends instead: `/26(<!-- -->)?\s*ports?/` grades either instrument.
🔴 **A `toContain` over concatenated JSX text is an assertion about the RENDERER, not the page.**

⚠️ **Two more ways the same drive nearly read green**, both CSS: the thread page links **two**
stylesheets and the first carries none of these rules (`head -1` reported the page unstyled —
false); and the built CSS **merges declarations into shared selectors**
(`.port,.portlist{display:flex;min-width:0}`), so grepping `\.portlist{` under-reports.

### 🔴 DIRECTION WAS NEARLY LOST SILENTLY

The figure carried direction **positionally**. One column cannot, so it is written down now.
⚠️ Collapsing two columns into one list is exactly the edit where somebody keeps one `filter`
and drops the other — and the page still looks perfectly reasonable, a tidy list with **every
output missing**. That is mutation 1 and it turns three rows red.

✅ **First spec over the `node_excerpt` renderer at all** — `e7-capture-render` grades the
`capture` branch beside it; the excerpt branch shipped in UNI-016 **ungraded**, which is how a
decorative rendering sat beside a prose duplicate of itself for two phases.
⚠️ **A mutation reporting `no tests` is a COMPILE failure, not a red** — re-run it so it
compiles before counting it.

### The drive (real HTTP, own database, real `next start`, no browser)

`npm run build`, then `npx next start -p 3200` against `nodegx_community_fb011drive`, seeded
with one thread whose excerpt carries **every row shape at once**: a set input, an empty input,
a redacted input, two outputs, two withheld.

| arm | what happened |
|---|---|
| **A** | `nodefig` appears **0 times** in the served page |
| **B** | one `<ul class="portlist">`, five `<li class="port">`, order preserved, outputs included |
| **C** | `<span class="port-dir">(input)</span>` and `(output)` both in production bytes |
| **D** | redacted row keeps its place; withheld chip draws; the `For Each` facet chip still draws |
| **E** | both linked stylesheets **200**; `.portlist` and `.port-dir` present in the one that has them |

✅ Cleaned up: server killed via `lsof -ti :3200 -sTCP:LISTEN`, drive DB dropped, temp seed
file deleted.

## First moves, in order

1. 🔴 **DEPLOY FB-011** — it is the only commit ahead of nexus-1's stamp, and it is a renderer
   change nobody sees until it ships. ⚠️ nexus-1 shares the box with two live sites and Caddy is
   all-or-nothing: drop-in only, curl the neighbours after.
2. **The FB-018 / FB-021 / FB-015 pair-up** (M each, all editor-side, no rulings): the binding
   chip and which value wins; gated ports rendering disabled with their reason; the image picker
   empty state. **FB-017 (L)** revives STYLE-004's deferral and is worth scoping before starting.
3. **FB-016** (M/L) and **FB-022** (M/L, wants FB-017/018 in the same rows first).
4. ⚠️ **Deliberate remainders**: FB-011's AC1 is superseded — reopening it is *"give the composer
   a second rendering"*, a real decision. FB-007's composer is still not driven in a browser, and
   `apisurfaces.ts`' `personProfile` still has its flat disc (`avatarKey`/`experience`
   unpublished) — **still nobody's decision**.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — one week), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Found while working, owned by nobody

- 🔴 **`npm run check:css` has ONE violation and it is NOT FB-011**: *"`--site-avatar-ink`
  declares a colour (#07090c) with no recorded reason."* Added in `d205b47` (UNI-013); **NAT-003**
  then re-pointed it because it *"was reaching the dark ramp through `neutral-0` while painting a
  gradient that follows no theme"*. Giving it a literal was the fix; adding its reason to
  `ALLOWED_SITE_COLOURS` was not done, so the gate has been red since. ⚠️ **Left alone
  deliberately** — the justification has to be NAT-003's, and writing one for a decision this
  session did not make is how an allow-list becomes a rubber stamp.
- ⚠️ **The editor mirror never renders port DIRECTION** — `attachmentPorts` returns it,
  `CommunityThreadView` uses it only as a React key. **Pre-existing and unchanged**: the web
  carried it positionally before and textually now, so the gap is exactly as wide as it was.
  One `<span>` whenever somebody wants it.
- 🔴 **TWO STALE STATUS LINES IN `TASKS.md`, both corrected this session.** **FB-010** read `⬜`
  although its task file has said *"BUILT, SPECCED, DRIVEN"* since the 23rd and it was deployed
  (`41fe2749`). **FB-003** read *"Not deployed"* although `67df2b1` is an **ancestor of
  `eaa19c6`** (verified locally). 🔴 **A stale index line sends the next session to rebuild
  something that already shipped.** ⚠️ The `eaa19c6` stamp itself is **session 17's reading and
  was NOT re-measured** — this session had no SSH key for `49.12.102.195`. Confirm with
  `cat /etc/nodegx-community/deployed.json`.

## Gates, this tree (`nodegx-community`)

- `tests/fb011-ports-render-once.test.tsx`: **14/14**, **nine mutations red**.
- Full `npm test`: **58 files / 1398 specs / 0 failures** — reconciles exactly against the
  56/1360 baseline: **+2 files** (FB-010's, 24 specs; FB-011's, 14) and **+38 specs**.
- `npx tsc --noEmit`: clean. `npm run build`: clean.
- `npm run check:css`: **1 violation, pre-existing and attributed above.**
- **Not run** — nothing touched them: the whole editor side (`test:main`, `tests-unit`,
  `noodl-core-ui`, `test:ci`). 🔴 **Re-measure rather than quoting this line.**

## Session notes

- ✅ **The drive harness is sessions 15/16/17's and works unchanged.** ⚠️ Kill the server with
  `lsof -ti :3200 -sTCP:LISTEN`, never the bare form. 🆕 **A `tsx` seed script inside the repo
  needs its body wrapped in `async function main()`** — top-level `await` gives
  `ERR_REQUIRE_ASYNC_MODULE`. Delete it afterwards; it was never committed.
- Postgres is docker on **55432**, user/pass `nodegx`. A drive DB of your own
  (`createdb -h localhost -p 55432 -U nodegx <name>`) keeps you clear of a peer's suite.
- ⚠️ **The orphaned `AskAboutNodeDialog.module.scss` fix is STILL uncommitted** in the OpenNoodl
  repo, still belongs to neither session, and was **not touched** — this session's work was
  entirely in `nodegx-community`. Richard's call.
