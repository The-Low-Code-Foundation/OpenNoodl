# Phase 30 — next session

**Written 2026-08-01 (ninth session of the day), current to `461859be`.** Work on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`, commit directly to it, **explicit pathspecs on
every commit**, Claude co-author line at the end of each message.

⚠️ **If you write a handover, overwrite this file. Do not add a sibling.** Two files with the same
job is how one of them goes stale unnoticed, which has already happened once in this phase.

⚠️ **If HEAD has moved past `461859be`, prefer PROGRESS.md's newest entries to this file** — but
verify PROGRESS.md is itself current before trusting it. Both its halves (the task table *and* the
Log) are current as of this commit.

## §0 — the state, re-derived today

| | |
|---|---|
| NDA-012 audit | ✅ **COMPLETE — 17 / 17 categories, 136 of 151 nodes**, twelve checks each |
| NDA-012 remediation | ✅ **Visual: 32 of 47 in-scope ⚠️ cells closed. 15 remain and not one is this phase's** |
| **NDA-002 / 013 / 014 live QA** | ✅ **CLOSED — the register's last bookkeeping item.** All three open criteria discharged; NDA-014's found a real defect |
| NDA-017 | ✅ **CLOSED — all six criteria** |
| Gates | viewer jest **579**, runtime **1,767 / 13 skipped**, editor jasmine **2007 / 0**, all four catalog gates exit 0 |
| Typechecks | root **18 errors, all `TS2307`, all `@noodl-versioning`** — pre-existing and environmental (that package is not built in this checkout) |

**The runtime baseline moved 1,758 → 1,767**: nine new rows in
`packages/noodl-runtime/test/corpus/nda-014-outbound-string-cast.test.ts`. Skips unchanged at 13.

### What closed this session, and what it cost to find

⚠️ **§1.2 of the last handover — "status genuinely unclear; re-derive, do not inherit" — was the
right instruction and re-deriving paid.** The NDA-002/013/014 task rows said *"live QA pending"*;
the Audit-coverage row said the 2026-07-29 pass verified Tier 1 live. **Neither was stale.** That
pass *named* four tasks in its header, but every claim it recorded was about collection semantics
and the editor's typecast **table**, and it listed two residuals in its own last sentence — the
screenshot-corpus run, and *"a live wiring demo of an `object` output to a Text node (table verified
live, DOM demo not performed)"*. The header is what later readers took.

Three criteria were genuinely open. **NDA-013 (criterion 5) and NDA-002 (criterion 3) held.
NDA-014 (criterion 1) did not, and the DOM demo is the only thing that could have shown it.**

## §1 — what is actually left

**There is no remaining code change in this phase that it owns and can make unilaterally.** What
remains:

1. **The three Visual prose defects** — ⚠️ **ask first, see §2.** `DV-vi` (`Slider`'s drifted private
   `addBorderInputs`, incl. `Slider.tsx:45`'s stray assignment writing four invalid CSS keys),
   `DV-vii` (`Page`'s dead `Title`/`Url Path` — **also `Page`'s `B2`**, blocked on §2.1), `DV-ix`
   (`Component Stack` derefs `pages[0].id` behind a `length === 0` guard, so a *malformed* `pages`
   throws). ⚠️ **"No ⚠️ cell" is not "nothing open".**
2. **The eight questions in §2**, none of which blocks anything. **§2.8 is new and is the one to
   put first** — it is a contract wording change that is already implemented.
3. **Handing `ERG-001` (11 cells) and `NDA-014` (2 cells) their inputs** — both specced, neither is
   phase 30's.

### Where the 15 remaining Visual cells live — none is this phase's

| Cells | Owner | Note |
|---|---|---|
| 7 `B3` + 4 `B1` | **`ERG-001`** (phase 35) | Outcome ports as one collision sweep. Adding any one alone half-builds the contract |
| 2 `E1` (Dropdown, Repeater) | **`NDA-014`** | `array` casts only to `collection` — the **typecast table's** property, not these nodes' |
| 1 `B2` (`Page`) | **Richard** | §2.1 |
| 1 `F1` (`Radio Button`) | **design** | §2.2 |

✅ `A1`, `A2`, `A3`, `D1`, `G1`, `H1` closed for the whole category. Every number is reproducible —
the cell count comes from the worksheet, not a tally beside it:

```bash
awk '/^## In scope/{f=1} /^## Out of scope/{f=0} f' \
    dev-docs/tasks/phase-30-node-library-audit/audit/visual.md \
  | grep -E "^\| (A1|A2|A3|G1|B1|B2|B3|D1|E1|F1|H1) \| ⚠️" \
  | sed -E 's/^\| ([A-Z0-9]+) \|.*/\1/' | sort | uniq -c | sort -rn
```
→ `7 B3`, `4 B1`, `2 E1`, `1 F1`, `1 B2` = **15**.

### The known-red register is still **4 rows**

⚠️ `test.failing` reports as *passed*, so maintain this by grep, never by memory:

```bash
grep -rn "test.failing(" packages/noodl-runtime/test packages/noodl-viewer-react/tests
```

`nda-012-cloud-services-category.test.ts` M1/M2/M3 and `nda-012-logic-builder.test.ts` L12. Both
filed deliberately. The 13 skipped runtime rows are not debt: 7 in `agent-live-endpoint.test.ts`,
6 in DEBT-014's `model-registry-lifetime.test.ts` (`--expose-gc`).

## §2 — what needs Richard. Surface it; do not decide it.

1. ⚠️ **`Page`'s `Title` port is dead, and fixing it is an ownership decision.** The Router already
   sets the document title from its own copy (`router.tsx:428`), so a Page node calling
   `Noodl.SEO.setTitle` would fight it, Router winning on every navigate. *Who owns the document
   title — the Page node or the Router?* One line either way.
2. **`Radio Button` cannot name its group.** Class F's *report* half is built and live-verified; the
   *nameable target* half needs a name→group registry like `Component Stack`'s and `Page Router`'s —
   which is exactly why both of *their* `F1` cells pass. A design change, not a remediation.
3. ⚠️ **NDA-017 §2 has one site that does not follow the decision word for word.** The *definition*
   port (`expression`, `functionScript`) keeps the old `!isInputConnected(...)` guard. Making it
   unconditional is the literal reading of "`Run` is purely additive", and it would **run every
   `Run`-driven script once at load, including the ones that POST.**
4. **`Value Changed` cannot see an Object or Array being edited.** Needs a decision, not a patch.
5. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results. ⚠️ Re-read
   `showpopup.ts:129-177` first; §1's premise is partly stale.
6. **The picker-integrity question — a missing *check*, not a bug.** `SignInWith`/`RequestMagicLink`
   creatable but unlisted; four password/verify nodes listed but not creatable; `On App Error`
   registered and working but absent; `Page Inputs` in the picker with no connectable ports.
   **Each was found by a different accident and none by any check this phase runs.**
7. **No pickable node can make an outgoing HTTP request from a cloud function.** The hole
   **predates** the `inNodePicker` fix, so that fix made it discoverable rather than real.
8. 🆕 ⚠️ **`PORT-TYPE-CONTRACT.md`'s outbound-cast clause is amended in the file and needs your
   confirmation.** It was phrased over the **runtime shape of the value** — "a non-null
   `object`/`array` value arriving at a `string`-typed input is `JSON.stringify`ed". Built literally,
   that also fires for an object handed to a string port **directly through `setInputValue`** (not a
   wire at all) and for one arriving from a `*`-typed *output*, and it broke two behaviours earlier
   tasks had pinned: `TextAccumulator` refusing an object chunk and naming the mis-wiring
   (NDA-004 B1), and the `Object` node dereferencing a plain object wired to `Id` (NDA-012 C3).
   **As built it is a property of a wire between two declared ports.** The amendment is written into
   the contract as a blockquote with the pre-amendment text left visible. FINDINGS `TT-ii`.

## §3 — carry these; they were learned the hard way

### The ones this session added

- ⚠️ **Three things had to be true for one typecast to work, and only the one the earlier check
  looked at was.** The table permitted the cast (checked live on 07-29 ✅); the *receiving* port had
  to be recognisable as `string` (it was untyped at runtime, for **every** declared string port in
  the library); the *sending* port had to be recognisable as `object` (the Function node registered
  author-declared outputs with no type). **Verifying the permission is not verifying the conversion.**
- ⚠️ **"No corpus row" is a distinct failure mode from "a row that passes for the wrong reason", and
  it is easier to miss.** `grep -rn "unstringifiable\|outbound" <test dirs>` returned nothing. When a
  feature ships, grep for its *distinctive string* in the test tree before believing it is covered.
- ⚠️ **A fake that declares its ports the easy way is a claim about the real collaborator — and the
  easy way is exactly what the real one does not do.** Eight rows emitting from a corpus node with
  `type: 'object'` went green while the editor still rendered `[object Object]`. Only the ninth,
  which instantiates the **real** Function node and lets it register its own ports, reddens on
  revert. `DV-xvii` was the same lesson from the other side. **For any node with runtime-discovered
  ports, one row must be the real node.**
- ⚠️ **A contract phrased over *values* will over-apply if the thing it describes is a relationship
  between *ports*.** Both counter-examples were already tested and neither was found by reading the
  contract — they were found by running the suite. **Run the full package suite after touching a
  shared value path, and read the failures as evidence about scope rather than as breakage.**
- ⚠️ **The Function node's author-declared outputs are `out-<label>`, not `<label>`**
  (`simplejavascript.ts:569`). The first fixture build wired four connections by the bare name and
  **every one was dropped in total silence** — the preview rendered each Text's authored placeholder
  and an empty Repeater, which reads exactly like a runtime that evaluated and produced nothing.
  ⚠️ **Do not confuse it with the Script node** (`Javascript2`, viewer-react `javascript.ts:788`),
  which names the same family of ports **bare**. Two script hosts, two conventions.
- ⚠️ **The Problems panel and the toolbar warnings chip are two different systems.** The chip reads
  `instance.warningsAmount` — the editor **warnings service**, fed by `editorConnection.sendWarning`,
  which is where `runtime/cyclic-loop` surfaces. The Problems panel lists **semantic-validator**
  findings. Reading the panel to check for cyclic warnings is the wrong instrument and reports clean
  either way. The QA fixture legitimately shows `3` on one and `2` on the other.
- ⚠️ **A criterion that names an instrument by name goes stale when the instrument is replaced.**
  NDA-002 criterion 3 and NDA-013 criterion 4 both name "the QA fixture"; the NodeGX QA Fixture
  superseded *Shine Phase 2* and has **no `For Each` node at all**, DB-backed Collection consumers
  with no local data, and two Function nodes wired to nothing. All three criteria would have gone
  green having exercised none of the named code. **Check the fixture contains the thing before
  measuring against it** — `python3` over `project.json` counting node types takes a minute.
- 💡 **A parked global is load-bearing in a mutation fixture, not a shortcut.** `window.__qaList`
  makes every Function evaluation return the *same* array, so `foreach.tsx:240`'s identity guard
  holds and the only thing that can move the row count is `refresh()`. A literal array in the script
  would mint a new one each time and the Repeater would resync on its own — deleting the measurement.
- 💡 **Read a Repeater's `_internal.itemNodes[]._forEachModel.getId()`, not just the DOM count.**
  The count says "something changed"; the model ids say *it re-read the source* (`['a','b']` →
  `['a','b','c-2']`).

### Carried forward, still true

- ⚠️ **Run every new row against the OLD code first, and predict which rows redden.** Ten reverts
  across the last two sessions, ten correct predictions. **Say the number out loud** — this session
  predicted "3 red, 3 green" and got exactly that, then "only the 9th" and got exactly that.
- ⚠️ **A row that stays green under revert is not necessarily a bad row** — it may guard an
  *implementation choice*, or the *scope* of a fix rather than the fix.
- ⚠️ **Before believing a green live reading, say out loud what it would read under the old code.**
- ⚠️ **A cell's check letter is where someone filed it, not what it is. When you bank a lesson, bank
  the query.**
- ⚠️ **A recorded consequence can outlive the fix that changed it.** Re-derive the mechanism from the
  code before fixing what a cell says.
- ⚠️ **A declared `default` never runs its setter** (A-D1), so the panel and the runtime read
  different defaults and **both** must be declared.
- ⚠️ **`update()` is synchronous and `settle()` yields**, so a row written with `settle()` reports the
  whole signal-freshness defect class as absent.
- ⚠️ **`flagOutputDirty` on a `type: 'signal'` output sends a *value*, not a pulse** (`node.ts:647`).
- ⚠️ **Run each jest suite from inside its package.** From the repo root the root babel config picks
  the file up and `import type` is a syntax error — **374 suites "failed to run" this session for
  exactly that reason**, and it looks like catastrophic breakage rather than a wrong `cwd`.
  ⚠️ A `cd` in an earlier command persists; check where you are before blaming the change.
- ⚠️ `npx jest 2>&1 > file` loses stderr (wrong redirect order). Use `> file 2>&1`.
- ⚠️ **The editor jasmine suite is a barrel of explicit exports.** An unregistered spec does not run
  and the total does not move.
- ⚠️ **Only a date or commit stamp indicates currency.** "Read to the end of the section" does not
  help when the stale sentence *is* the end of the section.

### Live QA

- **Register a fixture** by patching `~/Library/Application Support/NodeGX/recently_opened_project.json`
  **with the app stopped**. Five generators in `scripts/nda-live-qa/`; read each one's header table
  before changing a graph. ⚠️ **Two cards can share a name** — map `retainedProjectDirectory` before
  clicking, and for a card below the fold `scrollIntoView` + set an `id`, then click that id.
- ⚠️ **The registered copy of a fixture drifts from the committed one.** The registered
  `nodegx-qa-fixture` had **lost `rootComponent`** to a previous shutdown save. `cp` the committed
  one over it before measuring, with the app stopped.
- ⚠️ **The preview runs the bundle it loaded.** A runtime source change does **not** hot-reload. Wait
  for the served bundle — `curl -s localhost:8574/noodl.viewer.js | grep -o "<distinctive expr>"` —
  and then **restart the stack**. Grep for something that survives minification: a **string literal**
  or a **property name** (`_setValueFromConnection(...)`, `'outtype-' + label`), never a comment.
- **Reach a runtime node from the preview through the React fiber.** Walk `el.__reactFiber$…` up
  `.return` to `memoizedProps.noodlNode`, then `nodeScope.getNodeWithId('<id>')`. ⚠️ **The scope you
  land in is the scope of the element you started from** — anchoring on a repeated item gives you the
  *item component's* scope, not `/App`'s. Anchor on something in the component you want.
- ⚠️ **`node.outputs` / `node.inputs` are not the registered ports.** Use `node._outputs` /
  `node._inputs`. A probe reading the wrong field reports every node as having no ports, including
  ones that plainly do — which reads like a broken graph.
- ⚠️ **A connection to a port that does not exist is dropped in total silence.** Check port names
  against the catalog before believing a null reading.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher,
  `--target=viewer` for the preview. **Wrap every eval in an IIFE.** Never `cdp reload`. `cdp click`
  takes only a selector and hits the **first** match — for the second of two identical elements use a
  structural selector (`div > *:nth-child(3).ndl-controls-button` worked).
- ⚠️ **A dev launch rewrites the `agent-chat` example project** on open *and* shutdown — check
  `git status` after every editor session.
- **Stop the stack when done** (`npm run dev:stop`).

### Shipping and hygiene

- **Catalog:** `node scripts/node-catalog/generate.js`, `node scripts/node-catalog/merge.js`,
  `npm run cloud-library:generate`, then `catalog:check`, `catalog:merge:check`, `catalog:examples`
  **and `cloud-library:check`** — the first can pass while the others are stale.
- **Screenshot corpus:** `dev-docs/tasks/phase-23-visual-refresh/corpus/`. Open a fixture first, then
  `node corpus/capture.mjs`, then `node corpus/gallery.mjs <newest>`. ⚠️ **The 2026-07-26 baseline is
  not comparable to anything captured now** — different fixture (*Shine Phase 2*, gone) plus the
  intervening UI phases. The `2026-08-01-22-16` set (30 surfaces × 2 themes, NodeGX QA Fixture) is the
  new baseline; a *diff* only becomes meaningful from here on.
- ⚠️ **Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back.
- **One worktree.** An uncommitted file is orphaned work, not another session's.

## §4 — where phase 30 ends

The audit is complete, Visual remediation is done to the boundary of what this phase owns, NDA-017 is
closed, and **the live-QA bookkeeping that had been ambiguous for four sessions is resolved and
discharged**. What is left is §1's three items — of which only the three Visual prose defects are
code, and all three want an answer from §2 first. **Phase 30 has no unowned work left that does not
begin with a question.**
