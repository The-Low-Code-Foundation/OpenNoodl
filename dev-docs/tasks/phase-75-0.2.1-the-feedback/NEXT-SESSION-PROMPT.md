# Phase 75 — next session

**State as of 2026-08-24 (session 19).** Session 19 **deployed FB-011 to nexus-1 and verified it
as a reader sees it**, then **built, specced and drove FB-018** — the binding-chip rollout that
had been stalled at five row classes for three phases. **Both closed.** nexus-1 now serves
`acd4a9a`; nothing is ahead of the box. Read *"What session 19 found"*, then session 18's notes,
which still stand.

## What session 19 found

### 🔴 THE DEPLOY SCRIPT'S VERIFY WOULD HAVE PASSED ON THE OLD RENDERER

`ops/deploy.sh` curls `/` for a 200, the Caddy admin API for the host, sign-in for a 302, and the
backup/outbox timers. **Nothing reads a thread page.** A renderer change is exactly the class of
deploy where *"deployed."* and *"the reader sees it"* are independent facts, and FB-011 was
entirely a renderer change.

Measured on production bytes, both live threads, before and after: `nodefig` **14 → 0**,
`portlist` **0 → 2**, `port-dir` **0 → 20**, ten `<li class="port">` with **five `(input)` and
five `(output)`** spans. ✅ **The before-column is a real control**, not a formality — it proves
the old renderer was live on those threads, so the after-column cannot be a page that never had
an excerpt. ✅ **Outputs counted separately from inputs on purpose**: s18's mutation 1 (keep one
`filter`, drop the other) leaves a tidy list with every output missing, and a total-rows count
would not catch it.

✅ **Deployed from a pristine `git clone` of `acd4a9a`**, not the shared checkout. The tree was
clean so the script would not have refused — but the refusal is checked once at the start and the
rsync happens minutes later, and *"my tree is clean"* has a lifetime measured in minutes here. The
clone's payload was verified byte-identical first (`diff -rq` under the script's own excludes), so
it cost nothing.

⚠️ **FB-003's stamp is now measured, not relayed** — `eaa19c6c…` read off
`/etc/nodegx-community/deployed.json` over SSH. s18 could not (no key); the key is
`~/.ssh/nexus_hetzner` and it works.

### 🔴 FB-018 — THE ROLLOUT STALLED BECAUSE NOTHING RECORDED THAT IT HAD

The chip reached 5 of 36 row classes and stopped three phases ago. *"The chip is rolled out"* and
*"the chip is rolled out to five of thirty-six"* were **the same sentence** as far as the repo was
concerned. Now 16 chip and the other 20 carry a written reason, graded against the dispatch chain
parsed out of `Ports.ts`.

✅ **One seam, not ten components.** The ten rows that are not `PropertyPanelInput` already wrapped
themselves in `PropertyPanelRow`; the chip went there. Four bespoke implementations would have
been four more chances to drift — which is how a rollout reaches five and stops.

🔴 **Writing `exception` on a row that plainly COULD chip meets the AC's letter by lying.** Hence
three kinds: 16 `chip`, 3 structural `exception`, **17 `deferred`, each named**. 🔴 **And the
pinned deferred list first computed itself from the table it constrains** — a derived list grows
silently to match, so marking a new row `deferred` would keep the "pinned" test green while the
debt grew. It is a literal now. **A list derived from the thing it constrains pins nothing.**

### 🔴 THE DRIVE NEARLY REPORTED THE WRONG THING THREE TIMES

1. **The selector encoded the property under test.** The row-finder required a label with
   `children.length === 0` — true on a connected row, **false on a changed unconnected one,
   because the reset dot is a child of the label**. The control arm returned *"no Width label"*,
   which reads exactly like *"the control has no Width row"*. ✅ **Both arms re-measured with one
   selector**; no row is compared against a row read by a different instrument.
2. **Two rows honestly drew no chip and that was CORRECT** — the fixture wired `source`/`icon`
   when the real ports are **`src`/`iconIconSource`**. 🔴 **`isPortConnected('source')` still
   answered `true`**: the connection record exists whether or not the port does. An absent chip
   means *"the feature failed"* and *"there was nothing to show"* in identical bytes.
3. **The connection reader was dead** — `ng.model.connections` returned `[]` for **all five nodes,
   including the one visibly displaying "Bound to Number · Value"**. The contradiction is the only
   reason it was caught. ✅ Use `node.isPortConnected(port,'target')` — the accessor the panel uses.

## First moves, in order

1. **FB-021** (M, editor-side) — gated ports render present-and-disabled with their reason. Its
   AC3 reuses FB-018's chip, which now exists on every row type it needs. ⚠️ **`SizeModeType` is
   deliberately `deferred` in `connectedRowPolicy.ts` and the reason is FB-021's**: it is the
   *gate*, not a gated port, and chipping it would hide the control that explains why Width and
   Height are disabled. Decide it there.
2. **FB-015** (M) — the image picker empty state. **FB-017 (L)** revives STYLE-004's deferral and
   is worth scoping before starting.
3. **FB-016** (M/L) and **FB-022** (M/L, wants FB-017/018 in the same rows first).
4. ⚠️ **Deliberate remainders**: FB-011's AC1 is superseded — reopening it is *"give the composer
   a second rendering"*, a real decision. FB-007's composer is still not driven in a browser, and
   `apisurfaces.ts`' `personProfile` still has its flat disc — **still nobody's decision**.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — one week), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **`getConnectionSourceLabel` returned nothing for the checkbox row**, so it chips as a
  generic *"Connected"* while Width and Color name their sources. That is the documented fallback
  behaving as designed, **not** an FB-018 regression — but two `Number` sources resolving
  differently is worth one look. Not chased.
- 🔴 **`npm run check:css` in `nodegx-community` still has ONE violation and it is still not
  ours**: `--site-avatar-ink`'s literal, added in `d205b47` (UNI-013) and re-pointed by NAT-003.
  ⚠️ **Left alone deliberately** — the justification has to be NAT-003's, and writing one for a
  decision this session did not make is how an allow-list becomes a rubber stamp.
- ⚠️ **The editor mirror never renders port DIRECTION** (`attachmentPorts` returns it,
  `CommunityThreadView` uses it only as a React key). Pre-existing and unchanged.
- ⚠️ **A whole-tree textual repoint reaches build output.** `grep -rl … | while read` rewrote
  `src/editor/index.bundle.js.map`, a gitignored artefact containing the import string. Harmless —
  webpack regenerates it — but on a *tracked* artefact it would not have been.
- ⚠️ **The orphaned `AskAboutNodeDialog.module.scss` fix is STILL uncommitted**, still belongs to
  neither session, **not touched**. Richard's call. Same for the phase-70/71/72 working files.

## Gates, this tree (OpenNoodl, `cline-dev`)

- `npm run test:main`: **315 files / 5099 specs / 0 failures** (includes FB-018's 2 files, 18
  specs).
- `tests-unit/fb-018/`: **18/18**, **11 mutations red, none survived, none compile-failed**.
- `npx tsc` via `typecheck:editor`: **0 errors** — and the instrument was **proved to see these
  files** by planting a type error in `PickerTextInput.tsx` (2 errors) and removing it (0).
- `typecheck:core-ui`: **44 errors, all `TS2307` module-resolution, all pre-existing**, none in a
  file this session touched.
- **Not run** — nothing touched them: `test:ci` (the Electron suite), `noodl-core-ui`'s own suite,
  the whole `nodegx-community` side. 🔴 **Re-measure rather than quoting this line.**

## Gates, `nodegx-community`

Unchanged from session 18 and **not re-run** — this session only deployed the existing `acd4a9a`:
58 files / 1398 specs / 0 failures, `tsc` clean, `build` clean, `check:css` 1 pre-existing
violation.

## Session notes

- ✅ **The editor drive harness works.** `npm run dev:debug -- --quiet` writes **no `.logs/dev.log`
  at all** — the skill's `until grep … dev.log` loop never fires. Go straight to
  `npm run cdp -- health` once an `Electron . --dev` process appears.
- ✅ **Open a project by path**: back up `~/Library/Application Support/NodeGX/
  recently_opened_project.json`, prepend a row, `cdp reload`, click
  `[data-test=launcher-project-card]`. Remove the row **after** `dev:stop`. Done; the file is
  restored (56 rows, as found).
- ✅ **`__nodeGraphEditor` was the live graph this time** and `NodeGraphContextTmp` did not exist —
  the opposite of what the memory index warns. Check both.
- ✅ **`dev:stop` spared the peer's `render-from-disk.js` on port 8901** and all six MCP servers —
  verified by `ps` after, not assumed. A `dev:stop -- --list` dry run beforehand had already shown
  it was not a target.
- Fixture kept: `NodeGX test projects/fb018-drive` (subject + unconnected control + one row per
  chipped family, with the **corrected** port names).
