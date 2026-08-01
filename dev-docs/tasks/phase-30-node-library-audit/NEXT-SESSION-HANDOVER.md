# Next session — NDA-012 is complete. What phase 30 has left is small and mostly Richard's.

Continue on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip when this was written: `ff62dff2` (plus this commit). **One worktree, three branches, clean
tree.** If you find an uncommitted file it is orphaned, not in flight — read it, then commit or
discard it deliberately.

## Where things stand

✅ **NDA-012 is done: 17 of 17 categories, 136 of 151 nodes, twelve checks each.** Visual was the
last one and closed on 2026-08-01 — 20 in-scope nodes, **31 defects across 16 of them**, and
**C1 100%**. Library-wide C1 is **90.4%**.

The 15 nodes never audited are the deprecated set, out of scope by Richard's standing decision.

| Commit | What |
|---|---|
| `4e45ad28` | The DB-ii predicate over Visual — 242 hits, 2 defects, and the four absorbers pinned |
| `9e976e62` | `Page Router`'s reset path — RT-1/RT-2/RT-3 |
| `06396131` | The audit itself — 20/20 nodes, DV-vi, DV-vii, DV-viii |
| `d2613cb8` | C1 80.0% → **100%**, the last 246 ports |
| `ff62dff2` | Live QA correcting DV-ii |

### Gates — run before *and* after, all eight

| Gate | Before | After |
|---|---|---|
| `packages/noodl-runtime` jest | 93/94 suites, 1750 passing | **93/94, 1750 passing**, 0 failed |
| `packages/noodl-viewer-react` jest | 37 suites, 417 passing | **39 suites, 437 passing**, 0 failed |
| runtime typecheck | clean | **clean** |
| viewer-react typecheck (`--skipLibCheck`) | clean | **clean** |
| `catalog:check` | clean | **clean** |
| `catalog:merge:check` | clean | **clean** |
| `cloud-library:check` | clean | **clean** |
| editor `test:ci` | 2000 specs, 0 failures | **2000 specs, 0 failures** |

⚠️ **The TSFixme ratchet is RED at the inherited `any +35` / `@ts-expect-error +1`, and this session
contributes zero.** The two new corpus files added +10 and they were typed away rather than
re-baselined. ⚠️ **Do not re-baseline it.** The unowned job named in the last handover still stands:
**+28 of the +35 is phase 30's own corpus test files** — `nda-016-layout-sizemode.test.ts` (+12),
`nda-004-navigation-failure.test.ts` (+9), `nda-008-stack-replace-transition.test.ts` (+7). Typing
those three takes the ratchet most of the way to green.

## §1 — What phase 30 has left

1. ⚠️ **31 Visual defects are filed and none are fixed.** NDA-012 is explicitly a
   verdicts-and-citations task — *"Out of scope: fixing anything"* — so this is correct, not a gap.
   But it is now the largest open register in the phase and **§3 ranks it**.
2. **NDA-010 §1.**
3. **Live-QA tails**: NDA-002, NDA-013, NDA-014, plus three owed from the Visual salvage (§4).
4. **Two decisions that are Richard's**: NDA-004's deprecated-five policy, NDA-017 §1.

**There is no audit work left.** If you are picking this phase up to make it *finish*, the work is
§3's fixes and §4's QA, not more reading.

## §2 — What Visual found, in one page

**31 defects, 16 of 20 nodes, 41 ⚠️ cells excluding C1.** Full worksheet:
[`audit/visual.md`](./audit/visual.md). Findings **DV-i…DV-viii** in
[`FINDINGS.md`](./FINDINGS.md).

⚠️ **Two of the twelve checks were being read wrongly, and that matters more than the count.**

- **`B3` had been pre-filled from "does the node have *any* signal output"**, which any node with
  `Did Mount` passes. The check is whether **every signal input has a terminating signal output**.
  Read properly, **seven of the eight Visual nodes with action inputs cannot tell a graph the action
  finished**. That is **one design gap, not seven defects** (**DV-viii**) — and the eighth node is
  the Repeater, which is right only because NDA-004 §3 gave it `Items Rendered` and recorded that
  list-then-scroll had until then been a guessed `Delay`. The same sentence applies verbatim to
  snap-then-do, scroll-then-measure and reset-then-navigate.
- **`H1` is not answered by the `ssr` field.** Three nodes leak on delete and all three declare
  `safe`.

⚠️ **So Visual's find rate is not comparable with earlier categories, and neither is Navigation's
1.88 — it was measured under the old B3 reading.** Two pre-fills have now been corrected mid-phase
(B1 last session, B3 this one). **Before comparing any two categories' rates, check which pre-fill
each was audited under.**

### The four nodes worth reading first

| Node | Failing checks | Why it is first |
|---|---|---|
| **`Page Router`** | 7 | **Four of them are in one 60-line method.** An unconfigured router **throws a `TypeError`** (`_internal.pages` guarded on `router.tsx:272`, dereferenced bare on `:284`, in the else branch of the same `if`). A start page missing from the router index is compared by *identity* against the current page, and on a fresh router both sides are `undefined` — so "resolved nothing" reads as "already showing it" and the router stays **permanently blank**. A component with no `Page` node is created then dropped by a bare `return`: never attached, never deleted, nothing reported. NDA-004 §2 gave `navigateAsync` a full failure channel and never touched `resetAsync`, which is the path that runs *first* |
| **`Dropdown`** | 6 | **Three defects in one eleven-line setter** (`options.ts:57-67`) and one rewrite closes all three: `Items = null` throws, a re-sent collection leaves two `change` listeners, and the listener is never removed on delete |
| **`Repeater`** | 6 | `if (!value) return;` (`foreach.tsx:212`) is the truthiness test `DC-iii` warns against by name, so a query that came back empty **leaves the previous list on screen**. Its Dynamic-template surface reports only to the editor |
| **`Slider`** | 5 | Its private border generator (**DV-vi**) plus `_updateOutputValuePercent` comparing against a field nothing writes |

### DV-ii, and the rule it produced

⚠️ **Live QA disproved this session's own headline finding.** DV-ii originally said a freshly-dropped
`Button` renders with no padding. Driven in the running editor on an author-created Button whose only
model parameter was `label`: the panel shows 20, the model carries nothing — **and the browser
computes `padding: 5px 20px` anyway**, because `assets/style.css:24` happens to carry the same two
numbers. `Icon` has no such rule, computes `0px`, and is the node the defect actually costs.

So Button's padding is specified **twice, in two files, by two mechanisms, and only the stylesheet is
load-bearing**: change the port default and nothing moves, change the CSS and the panel starts lying.
The two copies agreeing is why it survived.

⚠️ **The rule: a mechanism defect and its consequence are two different claims, and a static
measurement only ever establishes the first.** The corpus rows now separate them explicitly.

## §3 — If you are fixing rather than auditing, this is the order

Ranked by how cheap the fix is against how bad the symptom is. **None of these is specced; each is a
slice-sized piece of work with its defect already measured and pinned.**

1. **`Page Router`'s `resetAsync`** — `RT-1`/`RT-2`/`RT-3` are pinned in
   `nda-012-page-router-reset.test.ts`, each with its control beside it, so the fix is guarded before
   it is written. A throw on an unconfigured node and a permanently blank router are the worst two
   symptoms in the category.
2. **`Dropdown`'s `items` setter** — one rewrite, three defects, and the `H1` half is the same
   `addDeleteListener` shape `Drag` already uses.
3. **`Repeater`'s `items`** — a one-line truthiness fix, but ⚠️ **it changes behaviour an existing
   project may lean on**: today a `null` leaves the list up. Worth Richard's opinion before shipping.
4. **`Icon`'s padding (DV-ii)** — either drop `applyDefault: false` (no node's `defaultCss` sets
   padding, so it protects nothing) or delete the non-zero defaults from `icon.ts` and `button.ts`
   and let the stylesheet own it. **The second is the honest one** — it removes the duplicate rather
   than making both copies live.
5. **`Component Stack`'s `Clip Content` (DV-iii)**, `Radio Button Group`'s `G1` (one character:
   `value?.toString`), `Slider`'s `valuePercentChanged` typo.
6. **B3 as a whole (DV-viii)** — the biggest and the one to spec rather than patch. Seven nodes need
   a completion signal; the Repeater's `Items Rendered` is the worked example.

## §4 — Live QA still owed

Three fixes are verified by inspection and typecheck only, and are named in
`tests/corpus/nda-012-visual-empty-values.test.tsx` rather than left silent. **All three need a DOM
and a frame clock, which `renderToStaticMarkup` cannot provide:**

- **`Image`'s `On Error` reporting** — needs a real DOM `error` event.
- **`Drag`'s `scale || 1` fallback** and **its snap-timer cleanup** — need a frame clock.

Plus the older tails: **NDA-002, NDA-013, NDA-014**.

✅ **DV-ii's live QA is done** and is the reason §2 has a correction in it. The recipe that worked,
end to end, in about ten minutes:

```bash
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
# open a scratch project by grid position, not by text selector:
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(4)"
# then the two globals that matter, which only exist once a project is open:
npm run cdp -- eval "Object.keys(window).filter(k=>/Noodl|NodeLibrary|Graph/i.test(k))"
#   → NodeLibraryData          the port list the property panel reads
#   → __nodeGraphEditor.model  the real project graph; .roots, each node .parameters / .getParameter
npm run cdp -- eval "…" --target=viewer   # the preview window, for computed styles
npm run dev:stop
```

⚠️ **`npm run cdp -- click` takes a CSS selector only** — `text=Foo` is a `querySelector` syntax
error, and the launcher's card classes are hashed CSS-module names, so `[class*=…] > *:nth-child(n)`
is the reliable form. ⚠️ **`VerifyFix3`/`VerifyFix4`/`bcn010-live` are previous sessions' scratch
projects** and are the right things to open — a dev launch rewrites the project it opens.

## §5 — Waiting on Richard

**Answered on 2026-08-01, and all three are now acted on:**

- ✅ **Port-documentation precedence (WD-3)** — **`description` is canonical.** Enrichment `ports`
  may only add what the source cannot know; `tooltip` is display-only and derived. That is where all
  ~550 sentences from the last two sessions already went, so nothing needed moving. ⚠️ **This is now
  a rule, not a preference — write it into `NDA-005-PORT-DOCUMENTATION.md` if it is not there.**
- ✅ **A cloud function cannot make an HTTP request (DB-v)** — **make `net.noodl.HTTP` cloud-available**
  rather than reviving the deprecated `REST2`. **This needs its own slice and is not an audit
  change**; it is unowned and unspecced. NDA-011's "deprecated, not deleted" conclusion stands.
- ✅ **Visual's execution** — solo and sequential, given the spend limit that killed the last batch.

**Still open:**

- **Does phase 34 ship before or after the alpha?** The case for finishing phase 30 is now much
  stronger: **the audit is done**, and what is left is three QA tails and two decisions.
- **Should `Insert Object Into Array` treat a duplicate insert as failure or idempotent success?**
- **Should `shortDesc` exist at all?** It reaches **nobody** — not in the catalog for any core node,
  so `ContextBuilder`'s `?? node.shortDesc` cannot fire. Fifty sites declare it.
- **The `Repeater`'s `null` semantics** (§3.3) — the fix is one line and it changes behaviour.
- Standing: NDA-004's deprecated-five policy, NDA-017 §1, admin-token disclosure, Q6,
  `cloudservices` vs `backendServices`, `BCN-006-LIFECYCLE-DESIGN.md` §9, nodegx `files.delete`
  defaulting to `"nobody"`.

## §6 — Traps

### New this session

- ⚠️ **`audit/visual.md`'s `C1` column was stale *again* when this session opened it** — the file had
  been regenerated before `b7c7d599`'s shared-port pass landed, so `Slider` read 27% when the node
  was at 40% and `Text Input` read 45% when it was at 87%. **Re-derive every C1 figure from the
  catalog before quoting it, including from the worksheet that is supposed to be authoritative.**
- ⚠️ **A differential probe needs its identity noise named, or it reports everything.** The DB-ii
  sweep's first run flagged all 92 of `Slider`'s ports because `props._nodeId` differs between two
  instances, and all of `Radio Button Group`'s because `props.name` is a per-instance guid. The
  fix is a path filter *and* a value filter — the guid is not at a predictable path.
- ⚠️ **`renderToStaticMarkup` and the corpus graph measure the node's style object, not the page.**
  A static measurement cannot see a stylesheet. That is exactly how DV-ii's first version got Button
  wrong; see §2.
- ⚠️ **A predicate firing is not a defect, and the ratio can be 121:1.** 242 of 687 Visual ports fire
  DB-ii and two are real. **Pin the absorbing mechanisms as rows beside the defects** or the next
  sweep files 242 findings.
- ⚠️ **A shell heredoc plus Python plus a JS string literal is three levels of escaping**, and
  `\\'` inside a single-quoted JS string produced a syntax error that only `catalog:generate`
  caught — `tsc` had not been run yet. **Prefer `"…don't…"` over escaping an apostrophe.**
- ⚠️ **`ts-jest` here targets pre-ES2015**: `[...set]` fails to compile with TS2802. Use
  `Array.from`.
- ⚠️ **A `.js` file with ESM syntax under `src/` is not transformed by the viewer's `ts-jest`
  preset** — `Group/scroll-plugins/*.js` breaks any test that imports `Group`. A `moduleNameMapper`
  stub in a throwaway config is the cheap way past it.

### Standing, and confirmed live again this session

- ⚠️ **`catalog:check` can pass while `catalog:merge` and `cloud-library:check` are stale.** Run all
  three. Fix with `catalog:merge` and `cloud-library:generate`.
- ⚠️ **`packages/noodl-runtime`'s bare `npx jest` crashes** in `@jest/reporters`. Use a minimal
  reporter — 20 lines, rewrite it if gone.
- ⚠️ **Build `noodl-runtime`'s `dist-types` first** or corpus suites do not start and the run reads
  short.
- ⚠️ **The Bash cwd persists.** `cd` to the repo root explicitly and use absolute paths.
- ⚠️ **`zsh` eats `--include=*.ts` in greps.** Quote glob arguments.
- ⚠️ **`noodl.deploy.js` is a gitignored artifact nothing rebuilds.** This session's viewer changes
  do **not** reach a deployed app until `npm run build --prefix packages/noodl-viewer-react` runs.
- ⚠️ **`graph-harness` does not call a module's `setup`** — third finding in it this phase
  (**DV-vii**, `Page`'s dead ports).
- ⚠️ **Scope greps to `packages/*/src`** — the root hits `noodl.deploy.js`, which is minified and
  will match almost anything.

### Editor / CDP

- ✅ `--target=editor` (default), `--target=viewer` for the preview. ⚠️ `--target=dashboard` is stale
  advice. ⚠️ **A dev launch rewrites the project it opens** — use a scratch project. Launch detached;
  **never `cdp reload`**. ⚠️ **Only one editor at a time** (`lsof -i :8574`). ⚠️ **`npm run dev:stop`
  when you are done** — three webpack watchers otherwise recompile on every file change.

## §7 — The rig

Not used this session. Bring up from `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e`:
`docker compose --profile supabase --profile aggregate up -d` and
`docker compose --profile parse up -d`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8092/parse/health   # parse
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8055/server/health  # directus
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091/api/health     # pocketbase
```

- **Parse** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`, mounted at `/parse`.
- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`; static token
  `bcnorch-static-token-1234567890`. ⚠️ CORS disabled; proxy at `uba-e2e/bcn-orch-cors-proxy.mjs`.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`.
- **PostgREST (as "Supabase")** `:8056` — no GoTrue, no Realtime.
- **nodegx-backend** — start your own. ⚠️ Parse wire at the **root** (`/classes/…`), and
  `/api/_schema` rather than `/schemas`.

⚠️ **Left on Parse**: `nda012_Owner`/`nda012_Target` (`enemies` deliberately poisoned — DA-ii's
evidence) plus `nda012a_*`…`nda012d_*`, `bcn005_*`, `bcn004n`, `bcn007_*`, `bcnorch`.
⚠️ **Never truncate `articles` or `authors`.** ⚠️ **Never pipe a probe into `head`** — SIGPIPE kills
node partway and reads as the server having died.

## §8 — ⚠️ 857 commits exist only on this machine

`cline-dev` is far ahead of `origin/cline-dev` and of `main` — essentially the entire revival, on one
disk with no remote copy.

⚠️ **Asked on 2026-08-01. Richard's answer: "Leave it — I'll handle the remote."** A known, accepted,
owned risk. **Do not push, and do not re-litigate it.**

Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…` import, so
`tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one** pre-existing failing
test. The root `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.

## §9 — Read these first

- [`PROGRESS.md`](./PROGRESS.md) — **its newest log entry is always more current than this file.**
- [`FINDINGS.md`](./FINDINGS.md) — **DV-i…DV-viii** at the end.
- [`audit/visual.md`](./audit/visual.md) — the 20 verdicts, and the two corrected check readings at
  the top.
- [`audit/data.md`](./audit/data.md) — `Run Tasks`' entry is the worked example of a twelve-check
  verdict block.
- ⚠️ **There are no Visual worker notes.** `media-source.ts` still cites a `WORKER-V-NOTES.md` that
  was never written — the three workers died before writing any. The claim it points at is recorded
  in `FINDINGS.md` under `DC-iii` instead.
