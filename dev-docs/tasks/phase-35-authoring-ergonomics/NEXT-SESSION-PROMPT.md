# Next-session prompt — start attacking phase 30's remainder

Paste the block below. Everything above the rule is context for choosing; everything below it is the
prompt.

## Choosing the slice

Five decisions landed on 2026-08-01 and they split the remaining work into three streams:

| Stream | Contents | State |
|---|---|---|
| **A — decided and cheap** | Repeater clears on empty · delete `shortDesc` · `Page Router` reset · `Dropdown` items setter · the three one-liners | Pinned, measured, no design work left |
| **B — decided and large** | `ERG-001` outcome contract · `NDA-017 §2` run-on-value-change | Specced 2026-08-01, needs a §0 measurement pass first |
| **C — standing priority** | Finish **phase 34** before the alpha (Richard, 2026-08-01) | Separate track, separate specs |

**Recommended first slice: stream A.** Every item is already measured and pinned, the two worst
symptoms in the library are in it, and it contains no decision. It is also the only stream that can be
done without reading a new contract first.

⚠️ **The one exclusion that matters.** Do **not** add completion signals to the seven Visual nodes that
lack them (**DV-viii**). That is one design gap, not seven defects, and `ERG-001` owns it — patching
them now means doing them twice with two different port names. `ERG-001 §0`'s collision sweep is what
decides those names.

---

## The prompt

Continue phase 30's remediation on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip: `ce582305` plus the 2026-08-01 documentation commit. One worktree, three branches, clean tree —
**an uncommitted file is orphaned work, not another session's; read it, then commit or discard it
deliberately.**

**Read first, in this order:**

1. `dev-docs/tasks/phase-30-node-library-audit/PROGRESS.md` — the **Decisions** section, items 7–11.
   Five questions were answered on 2026-08-01 and two of them overrode the recommendation. The newest
   log entry is always more current than any handover.
2. `dev-docs/tasks/phase-30-node-library-audit/NEXT-SESSION-HANDOVER.md` §3 — the fix order, with each
   defect's citation.
3. `dev-docs/reference/OUTCOME-CONTRACT.md` — **only so you know what not to touch.** It is not this
   session's work.

**Build, in this order. Each item's defect is already measured; do not re-derive it, but do verify the
citation still points at the code it describes.**

1. **`Page Router`'s `resetAsync`** — `RT-1`/`RT-2`/`RT-3`, already pinned with controls in
   `nda-012-page-router-reset.test.ts`, so the fix is guarded before it is written. An unconfigured
   router **throws a `TypeError`** (`_internal.pages` guarded on `router.tsx:272`, dereferenced bare on
   `:284`, in the else branch of the same `if`). A start page missing from the router index is compared
   by *identity* against the current page, and on a fresh router both sides are `undefined`, so
   "resolved nothing" reads as "already showing it" and the router stays **permanently blank**. These
   are the two worst symptoms in the category. NDA-004 §2 gave `navigateAsync` a full failure channel
   and never touched `resetAsync`, which is the path that runs *first*.
2. **`Dropdown`'s `items` setter** (`options.ts:57-67`) — one rewrite closes three defects:
   `Items = null` throws, a re-sent collection leaves two `change` listeners, and the listener is never
   removed on delete. Use the `addDeleteListener` shape `Drag` already uses.
3. **`Repeater`'s `items`** (`foreach.tsx:212`) — ✅ **decided by Richard on 2026-08-01: it clears.**
   Empty array, `null`, anything falsy. `if (!value) return;` is the truthiness test `DC-iii` warns
   against by name, so today a query that came back empty leaves the previous list on screen. No
   dual-path, no back-compat branch — *"we're not catering to existing projects anymore"*.
4. **Delete `shortDesc`** — ✅ decided. Fifty declarations across the three runtime packages, zero
   readers: it is in the catalog for no core node, so `ContextBuilder`'s `?? node.shortDesc` cannot
   fire, and nothing in the editor's own interface reads it either (re-checked 2026-08-01). Delete the
   field and its declarations; do not wire it up.
5. **`Icon`'s padding (DV-ii)** — delete the non-zero defaults from `icon.ts` and `button.ts` and let
   the stylesheet own it. ⚠️ **Read DV-ii's correction before touching this**: Button's padding is
   specified twice, in two files, and **only `assets/style.css:24` is load-bearing** — change the port
   default and nothing moves. `Icon` has no such rule, computes `0px`, and is the node the defect
   actually costs. The other option (dropping `applyDefault: false`) makes both copies live; this one
   removes the duplicate.
6. **The three one-liners** — `Component Stack`'s `Clip Content` (DV-iii), `Radio Button Group`'s `G1`
   (`value?.toString`), `Slider`'s `valuePercentChanged` comparing against a field nothing writes.
   ⚠️ On the last one: PLAT-003 slice 10 found that exact bug, wrote four lines explaining it, and kept
   it verbatim in the **deprecated** `range.tsx` without ever looking at the live node. Fix the live one.

**Out of scope this session, deliberately:**

- ❌ **The seven Visual nodes with no completion signal (DV-viii).** `ERG-001` owns them; its `§0`
  collision sweep decides the port names. Patching them now means doing them twice.
- ❌ `ERG-001`…`ERG-005` (`dev-docs/tasks/phase-35-authoring-ergonomics/`), `NDA-017 §2`,
  `NDA-005 §2`, `NDA-010 §1`.
- ❌ **Do not re-baseline the TSFixme ratchet.** It is RED at the inherited `any +35` /
  `@ts-expect-error +1`. **+28 of the +35 is phase 30's own corpus test files** —
  `nda-016-layout-sizemode.test.ts` (+12), `nda-004-navigation-failure.test.ts` (+9),
  `nda-008-stack-replace-transition.test.ts` (+7). Typing those three takes it most of the way to
  green and is a legitimate optional extra; re-baselining is not.

**Gates — measure all eight before you start and again at the end, and report both numbers:**

`packages/noodl-runtime` jest (93/94 suites, 1750 passing) · `packages/noodl-viewer-react` jest
(39 suites, 437 passing) · runtime typecheck · viewer-react typecheck (`--skipLibCheck`) ·
`catalog:check` · `catalog:merge:check` · `cloud-library:check` · editor `test:ci` (2000 specs).

⚠️ **The bar is 0 failures *and* no new noise.** The Data batch grew *"a worker process has failed to
exit gracefully"* alongside a green count and it took a bisect to find the cause.

**Live QA is required, not optional.** Every behavioural claim in this list needs the running editor,
and phase 30's own headline finding was disproved by it. Also still owed from the Visual salvage, and
fair to fold in: `Image`'s `On Error` reporting (needs a real DOM `error` event) and `Drag`'s
`scale || 1` fallback plus snap-timer cleanup (need a frame clock). The recipe:

```bash
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(4)"   # open a scratch project
npm run cdp -- eval "Object.keys(window).filter(k=>/Noodl|NodeLibrary|Graph/i.test(k))"
npm run cdp -- eval "…" --target=viewer                                  # computed styles
npm run dev:stop
```

⚠️ `cdp click` takes a **CSS selector only** (`text=Foo` is a syntax error) and the launcher's card
classes are hashed, so `[class*=…] > *:nth-child(n)` is the reliable form. ⚠️ **A dev launch rewrites
the project it opens** — use `VerifyFix3`/`VerifyFix4`/`bcn010-live`. ⚠️ `--target=editor` is the
default and correct; `--target=dashboard` is stale advice. ⚠️ Only one editor at a time
(`lsof -i :8574`); launch detached; **never `cdp reload`**; `npm run dev:stop` when done.

**Standing traps:** `catalog:check` can pass while `catalog:merge` and `cloud-library:check` are stale —
run all three. `noodl-runtime`'s bare `npx jest` crashes in `@jest/reporters`; use a minimal reporter.
Build `noodl-runtime`'s `dist-types` first or corpus suites do not start and the run reads short. Scope
greps to `packages/*/src` — the root hits the minified `noodl.deploy.js`. ⚠️ **`noodl.deploy.js` is a
gitignored artifact nothing rebuilds**, so a viewer change does not reach a deployed app until
`npm run build --prefix packages/noodl-viewer-react` runs. ⚠️ `graph-harness` does not call a module's
`setup` — three phase-30 findings lived there.

**Commit straight to `cline-dev`**, one commit per item, pathspec-scoped. ⚠️ **857 commits exist only
on this machine and Richard has said "leave it — I'll handle the remote". Do not push; do not
re-litigate it.**

**Update on the way out:** `PROGRESS.md`'s log and the NDA-012 cell, `audit/visual.md`'s verdicts for
anything fixed, and `NEXT-SESSION-HANDOVER.md`. **31 Visual defects were filed and this session should
close six of them — say which, by name, and which of the 31 remain.**
