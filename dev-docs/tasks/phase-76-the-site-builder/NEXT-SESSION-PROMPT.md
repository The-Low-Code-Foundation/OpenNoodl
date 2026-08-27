# Phase 76 — next session

Read `TASKS.md` here first. **Tier 2 closed at s9; SB-013/014 at s10; SB-015 driven s11, built
s12 with SB-016, both spawners wired s13. s14 closed SB-015 §6.4** — the first five minutes
now has a fix, and F27's screen names its causes. What remains is **four Tier 3 findings that
want a corpus sweep or a ruling, Richard's three open questions, and one drive nobody has run.**

Before touching the template, read **SB-007 §3** (why the content is generated) and **§4** (F22).
Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"** and §**"The endpoint
gate has no defaults tier"**. Before authoring any *browser* component, read **SB-005 §7** and
**SB-006 §7**.

## Where s14 left it (2026-08-27)

✅ **`test:ci` was taken and the number is no longer owed** — the first genuinely solo window in
three sessions. **2856 specs, 4 failures, 71s**, all four `AIX-006 style vocabulary` **by name**:
the documented floor. ⚠️ A peer's `dev:debug` overlapped the run; taken as clean on the full
spec count plus the four named failures, with the overlap on the record rather than argued away.

🔴 **F28 — both of §6.4's candidates were unbuildable as written.** Not a wrong number inside a
right recommendation, which is what the previous five instances were — **a wrong option set**.
The only door that writes a function secret is `PUT /admin/secrets/:name`, admin-gated, and this
template ships `devOpen: false`, so it is gated on loopback too: a template graph reaches it only
by carrying an admin credential. And "provisioning mints it" is self-defeating, because a minted
value the author cannot read is not a fix and the log is closed to it — `SecretValueScrubber`
redacts every `functions` value ≥8 chars, on a **5-second refresh**, so it would leak the real
token *sometimes*.

⚠️ **F28's own first census was wrong, and that is the more useful half.** It said
`/admin/secrets` had no caller. The route is **mounted** and the three `backend:*` IPC channels
**already existed** — only the renderer panel was missing, so the ruled build was much smaller
than it was sold as. **Two known grep lies stacked**: `--include="*.ts"` excluded
`BackendManager.js`, and **`HttpServer.ts` carries one NUL byte** so grep skips it as binary.
🔴 **The known-firing control fired and did not help**, because control and subject were read
through the same two blind spots. **A control only bounds the error when it sits on the other
side of the suspected blindness** — here, a control in a `.js` file or a NUL-carrying one.

✅ **RULED s14 (Richard): build the missing Secrets panel** — the only shape that adds no new
credential path. ✅ **BUILT**: `views/panels/secrets/`, the **eighth** backend surface, reachable
from the Backend Services card's overflow menu. Lists by name, writes, removes, generates a
32-byte base64url value in the *renderer*, and reports the environment's second door on every
row. **33 specs / 10 mutants, 10 killed.**

✅ **F27's screen is fixed** — three causes, three sentences, none of which names a credential,
collection or policy (all three are read by visitors; a spec asserts it).

🔴 **Two orderings were wrong on the first pass and only the DRIVES caught them.** Both first
versions passed every spec that existed before the drives were re-run.

1. **An unclaimed site makes the Page query FAIL, not return empty** — `claimSite` is what
   creates the collections. So "refused" and "not set up" are true at once, and **the condition
   that explains the other has to win**.
2. 🔴 **`claimed === false` is not evidence of an unclaimed site.** It comes from the settings
   query's `items`, and a **refused** query publishes an empty `items` exactly like an **empty**
   one — `Run` is additive, so the reader runs on `items` whether or not `fetched` fired. Arm C
   of `sb015-default-policy-drive` is the refused case and was reporting itself as "not set up".
   ✅ Fixed by wiring the settings query's **`error`** in beside it — the known-firing-signal
   rule in its exact form: **an absence only means what you think beside a signal that separates
   refused from absent, and the two want opposite fixes.**

🆕 **Three specs that ASSERTED the defect went red** and were rewritten to assert the fix (§6.4c)
— they were correct when written, and the rewrite keeps what they used to say in the comment.
🔴 **And one mutant stopped biting**: it found its target by *script content*, so when visibility
moved to a new node it mutated a node the assertion no longer read and **survived**. It failed
loudly — a surviving mutant is a red spec — which is the only reason it did not become
decoration. It now resolves its target **through the wire it asserts about**.

## Next work, in order

1. ⬜ **Nothing has still opened a project made from this template IN THE EDITOR.** SB-007
   recorded it, s13 recorded it, and it is now the only ⬜ left on SB-015 §7 that is not a
   ruling. **The Secrets panel s14 built has never been driven** — it is graded as decisions
   over values, and its spec says so in as many words. The drive that would close both: make a
   project from the template, open it, set `SITE_SETUP_TOKEN` in the new panel, claim the site,
   and see a real page. Use `run-editor`, and read the **drive traps** below first.
2. **SB-009 / SB-010 / SB-011 / SB-012** — all measured-not-fixed, all wanting a corpus sweep or
   a ruling rather than an argument.
3. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone), `Section.kind`'s fifth
   value with no destination, D3 (does SB-003's boundary fix ride 0.2.1).
4. 🧭 **Still the better half of SB-014 §5**: *for every collection a template reads, is there a
   node that creates it?* and *for every collection a template names, is there a rule?* Both are
   asked of this template; neither is asked of an arbitrary project, and both are questions a
   linter could ask of any. 🆕 s14 gives the first one teeth: **the answer for `Page` is "no",
   and that is exactly why the query fails rather than returning empty on a fresh site.**
5. ⬜ **`securityPolicy` is on `ProjectTemplate`**, so `PlatformTemplateProvider`'s `community://`
   shelf still has no channel for one. Not needed today; named so it is not assumed.

## Traps that will bite here specifically

- 🔴 **`grep` lies here in at least two ways at once.** `--include="*.ts"` silently excludes the
  `.js` half of the editor's main process; **`HttpServer.ts` contains a NUL byte** so grep skips
  it as binary and says nothing. **Census with a reader that opens every file** (a short Python
  walk) before asserting any absence — and put the control on the *other* side of the blindness.
- 🔴 **The backend's `typecheck` DOES NOT COVER ITS TESTS.** `tsconfig.json` is
  `include: ["src/**/*"]`, so `npx tsc --noEmit` exits **0** on a test file with a wrong argument
  type. s4, s11 and s13 all hit it. **Run the suite.**
- 🔴 **`test:ci`'s timeout and its clean floor are the same exit code.** The only signal is the
  **summary line**; a run without one is **NOT MEASURED**. Floor: `2856 specs, 4 failures`, all
  four `AIX-006 style vocabulary` by name.
- 🔴 **A failing spec that starts a `BackendService` leaks it** (the `stop()` is in the success
  path), so jest cannot exit. Use `--forceExit` when grading mutants that make service specs
  fail, and never conclude "hung" from a run whose specs are supposed to be red.
- 🔴 **`python3` buffers stdout** — `python3 -u`, or a killed mutant run loses every result.
- 🔴 **Kill by PID, never by name.** Three peer sessions were live throughout s14.
- 🔴 **`Run` is purely ADDITIVE**, and `isEmpty`/`count`/`firstItemId` answer **pre-fetch**. 🆕
  And a **refused** query publishes an empty `items` indistinguishably from an empty one — take
  refusal from `error`, never from emptiness.
- 🔴 **A green authoring run means well-formed and nothing else**; a green REFUSAL means nothing
  either — read the consequence, not the status code.
- 🔴 **The artefact and the component sets are two populations.** Edit a component set and
  **regenerate** (`npm run template:site-builder`) or `sb007Template.test.ts` reddens. ⚠️
  `site-builder.security.json` is **NOT** generated — hand-edited, deliberately; its gate is
  `sb015-project-policy.test.ts`.
- 🔴 **All three component sets are data files** (`sb004Components.ts`, `sb005Components.ts`,
  `sb006Components.ts`). Edit graphs there, never in a spec; **nine** suites drive them.
- 🔴 **An authored node id is a request, not a handle (F9).** Read a written graph by node
  **type** or **label**; `claimSite` has **two** `NewDbModelProperties`, so resolve by
  `collectionName`. 🆕 **The same rule applies to a MUTANT's target** — resolve it through the
  wire it asserts about, or it silently stops biting when the graph moves.
- 🔴 **A source-text assertion pins a spelling, not a property.** `toContain('if (Inputs.rows
  === undefined) return;')` passed on a guard that had been rewritten and would pass on one
  commented out. Where a graph carries a script, **run it** and assert what it publishes.
- 🔴 **jest here is `testEnvironment: 'node'`** — no jsdom, no `@testing-library/react`. A panel
  cannot be mounted. Extract its decisions (`secretsPanelModel.ts`, `buildSpawnArgs`) or the only
  assertion left is source text.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `createServer` from `src`.
- ⚠️ `npm run template:site-builder` runs `ts-node -T` deliberately — type-checking that program
  takes ts-node past 2 GB.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**.

## Gates, s14

- **`test:ci` ✅ TAKEN TWICE, both at the floor.** `2856 specs, 4 failures`, all four
  `AIX-006 style vocabulary` **by name**, both times — 71s at seed 62551 (HEAD `76465eeb`,
  before the editor changes) and 65s at seed **80902** (HEAD `c37cab73`, after them). ⚠️ The
  two readings used **different seeds**, so the floor is not a seed artefact; that is the one
  thing a single run could not have told you.
- nodegx-backend **108 suites / 1240** (10 skipped) ✅ EXIT 0 — unchanged suite count; the three
  SB-015 drives now assert the fix rather than the defect.
- noodl-mcp **64 suites / 774** ✅ EXIT 0 — +1 test over s12's 773 (`sb006PublicSite`).
- noodl-editor jest **354 suites / 5832** ✅ EXIT 0 — **+1 suite / +33 tests** from
  `tests-unit/sb-015/secrets-panel-model.test.ts`; the rest of the delta over s13's 350/5776 is
  a peer's seven FB-025/026/027 commits landing in the same tree.
- `typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` and the backend's own `tsc`: all
  exit **0**, run unpiped.
