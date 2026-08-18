# RUN 3 (continued) — **finish CN-016 and close phase 69 at 20/20.**

**Written 2026-08-18, end of s31.** Phase 69 is at **19 of 20**. CN-016 is the only task left, it is
**unblocked** (✅ D21), and **item 1 and half of AC1 are already built** — s31 got the reference kit
shipping-clean and repaired the artefact harness. What remains is four items and three acceptance
criteria, and **the whole of it is reachable in one focused session** if you take it in the order in
§3, because one editor launch closes three separate debts at once.

> ## The ambition, stated plainly
>
> **Close CN-016. That closes phase 69.** No blocker, no ruling, no other phase's work in the way.
>
> ⚠️ **And the honest fallback, so it is not decided by exhaustion:** AC5 needs a live editor. If the
> stack cannot be had — a peer holds it, or it wedges — **do §5 without AC5, say AC5 is the only
> criterion outstanding, and stop.** 19.5/20 with one named criterion beats a phase closed on a
> criterion nobody drove. 🔴 **Do not mark AC5 met from unit tests.** Its whole text is *"build the
> caller: install the kit, place the node, deploy the project, and load the deploy."*

## Read, in this order

1. **[CN-016-PUBLISH-A-KIT.md](CN-016-PUBLISH-A-KIT.md)** — the task, with **AC1 amended in place by
   D21** and s31's progress section at the end. **The "What is left" table there is your checklist.**
2. **[RULINGS.md D21](RULINGS.md)** — what AC1 now is, and **the two moves it does not permit**.
3. **§2 and §3 of this file** — what is already done, and the order that makes the rest fit.
4. **[CN-017-TRUST.md](CN-017-TRUST.md) §9** — 20 lines, and it will change how you build item 3.

---

## 1. 🔴 Three rules that decide whether this session succeeds

**a. `library:check` is not the gate you think it is.** It grades **sources**.
`library:verify-dist` grades the **artefact**, and until s31 it had been failing on *every entry*
since ALPHA-006 §5 while nobody noticed, because it was not in CI. It is in CI now. **When you change
anything about how an entry is shaped, run both.**

**b. Ask what being WRONG costs before you make a check block.** CN-017 shipped a verifier whose
verdict marked kits un-installable, and its sandbox false-negatives on any kit needing real DOM —
**four working library kits could not be installed at all**. Item 3 is *"compat gating that means
something"*, which is the same shape of decision. A gate that **informs** costs a confusing line; one
that **blocks** costs the user the feature. See CN-017 §9b.

**c. Run any new check over the 29 modules that already exist, before committing it.** CN-017's
verifier had 52 passing specs, all on fixtures and on this repo's own scaffold. One pass over
`library/` found two defects in minutes, one of them user-facing. The corpus is right there.

---

## 2. ✅ What s31 already built — do not redo it

| | state |
|---|---|
| **Item 1 — the minimal reference kit** | ✅ **DONE.** `library/modules/example-node-kit/` — scaffold output, one React node, token defaults by construction (D8), a `docs` sentence, kit types, README, MIT `LICENSE`. `library:check` **59/59 clean, zero new warnings**. |
| **AC1 — installs from a built artefact** | ✅ **DONE.** `library:build` → `library:verify-dist` reports **29 prefabs + 30 modules, 0 problems, installable-shaped**. |
| **AC1 — the divergence gate** | ◐ **HALF.** `verify-dist` is repaired and **now runs in CI** (`.github/workflows/pr.yml`, beside `library:check`). The origin-vs-`library/` comparison itself is **designed in CN-016's progress section but not written** — that is §3 step 1. |
| **The origin, re-measured** | ✅ Both indexes **HTTP 200**. prefabs **29/29 shared, 0 unpublished**; modules **26/30 shared, 4 unpublished** (Confetti, Lucide Icons, QR Code, Example Node Kit). ⚠️ **Compared on `label` only — content equality is UNPROVEN.** |
| **The fleet, measured for the first time** | ✅ **15 of 22 kit-shaped modules demonstrably declare nodes.** 4 `threw` are **instrument false-negatives**, not broken kits. |
| **CN-017** | ✅ Closed, then **corrected twice** — read §9 of its file. |

🔴 **Two inherited premises were wrong and are corrected in the task files. Do not re-inherit them:**
*"the origin serves 2024 content"* (measured s28, before the 2026-08-13 repoint — the origin is live
and 26/30 matched) and *"`unzipIntoDirectory` has no path checks"* (JSZip normalises `../`; the real
hole was Windows backslashes, fixed in `ba8e3674`).

---

## 3. The order, and why it is this order

**Step 1 — the divergence gate (finishes AC1). ~1 hour, no stack, no peer collision.**
CN-016's progress section has the design: assert **coverage by `label`**, both tabs, `library/` vs
what `getContentEndpoint()` serves. 🔴 **Say in the gate's own output which of coverage or content it
checks** — content cannot be asserted until a publish from `library/` has happened once, and a gate
that implies more than it checks is worse than no gate.
⚠️ **Home it in `verify-dist.ts` or a new script — NOT `scripts/library/check.ts`** (see §4).
⚠️ It must be **network-tolerant**: CI without egress, or an origin 500, must fail *loudly as
unavailable*, never silently pass.

**Step 2 — item 2, the taxonomy (unblocks item 3). ~1 hour.**
**22 of 29 shipped modules are already kit-shaped**, so `type: 'kit'` is a migration, not a new field.
Decide, write it into the task file with the reasoning, and **say what happens to the 22**. A field
only new entries carry describes nothing. ⚠️ The schema is strict (`additionalProperties: false`), so
any new field is a deliberate edit to `schema.json` — which **is** yours; only `check.ts` is not.

**Step 3 — item 3, compat gating (AC3). ~1–2 hours.**
`minEditorVersion` / `runtimeVersion` exist and `isModuleCompatible` already reads the first.
AC3 wants a refusal **that names why**. 🔴 **Re-read §1b first.** Refusing an install on a version
comparison is defensible; refusing on a *heuristic* about React semantics is the CN-017 mistake in a
new costume.

**Step 4 — item 4, versioning and update (AC2). ~1–2 hours.**
*"A project has kit v1, the library offers v2, and v1's nodes are on canvas."* The floor the task sets
is **do not silently replace**. ✅ You inherit a lot: `ImportPlan.origin` is required, the copy loop is
in `moduleGate.ts` with the copy injected (so it is gradeable off-renderer), and
`recordKitProvenance` already stores `version`-bearing install records. **AC2's "installing twice is
safe" is testable at `copyPlannedModules` without a renderer.**

**Step 5 — ONE editor launch, and it pays for three things at once.** This is the step that makes the
session ambitious rather than long:
1. **AC5 — build the caller:** install the kit from the built artefact, place the node, deploy, load
   the deploy. `noodl_modules/` ships verbatim in a deploy and NDA-007 §2 proved that live **for an
   asset, not a kit**.
2. **CN-017's two undriven surfaces:** the kit-origin row in Settings → Kits (a scaffolded kit must
   read *"written here"*, never *"origin not recorded"*) and the property-panel byline
   (`from <kit> · written here`). Both render from `describeKitOrigin`, so **a disagreement between
   them is a real defect**, not a styling nit.
3. **s29's undriven fix** (README §4): break a kit two ways and read the two Settings → Kits rows.
   Neither may say *"only PARTIALLY registered"* of a kit that registered nothing.

🔴 **Write the observation you expect BEFORE driving.** A drive can pass on a broken feature.

---

## 4. Peers, and the one file that will collide

⚠️ **`scripts/library/check.ts` is held uncommitted by the peer scoping phase 65** (their change is
LBR-002 — surfacing warning *messages*, which is why `library:check` now prints 183 warnings).
**Announce before touching it.** Nothing in §3 requires it: the gate goes in `verify-dist.ts` or a new
script, and `schema.json` is uncontested.

```bash
git status --short packages/noodl-editor/src   # empty is NOT sufficient
ListAgents                                     # then ASK, by name, before launching
```

🔴 **A launching stack is invisible for ~75s** — no Electron process, 9222 still free. Two editors do
not coexist here. ⚠️ **Attribute Electron processes by their command line**: this machine routinely
runs five `electron/dist/…/Electron` processes that are all `noodl-mcp.cjs` MCP servers.

🔴 **Never `git stash`. Never `git add -A`. Commit with explicit pathspecs.**
⚠️ **And never leave a file staged.** s31 ran `git checkout <commit> -- <file>` to test a harness
against an older revision; that **stages** the revert, and a peer committing in that window would have
swept a revert of CN-017 into their commit. Caught in `git status`, unstaged with `git restore
--staged`. If you revert a file to measure something, unstage it in the same breath.

---

## 5. Gates — measured on `cab2a24c`, s31. Re-measure; never quote these.

| Gate | Result |
|---|---|
| `test:ci` @ `NOODL_SPEC_SEED=39393` | ✅ **2849 / 10 failed — AT FLOOR, the same ten by name** |
| editor `test:main` | ✅ **3884 / 254 suites, zero failures** |
| `typecheck:editor` · `:editor-tests` · `:mcp` | ✅ 0 |
| `test:platform` | ✅ 22 |
| `test:packages` | ✅ green |
| `library:check` | ✅ **59/59 clean** (183 warnings, not gated) |
| `library:build` + `library:verify-dist` | ✅ **29 prefabs + 30 modules, 0 problems** |
| `tests-unit/cn-017` | ✅ **58 / 4 suites** |

The ten `test:ci` failures, by name — unchanged all session, so a delta is yours:
4 × `AIX-006 style vocabulary` · 2 × `AI model registry` · 1 × `AIX-011` · 3 × `SUB-011 expression
parameters`.

- 🔴 **Delete `packages/noodl-editor/tests/test-results.json` before a run and prove completion from
  its mtime.** A clean floor run exits **1**; any pipe reports the pipe's last command.
- 🔴 **Never pipe a suite to `tail`** — it loses the failure list *and* the exit code.
- 🔴 **A `.js`/`.jsx`/`.tsx` change is invisible to every gate but `test:ci`** — and so is a
  **type-level** change reaching a `.js` caller. s31 made a parameter required; three typechecks and
  `test:main` were green and only `test:ci` caught the two untyped callers, at runtime.
- 🔴 **Editing source while `test:ci` runs invalidates it** — the bundle is built at the start. s31
  discarded two runs for this. Freeze source, then run.
- ⚠️ **Do not run `test:packages` beside `test:ci`** — contention produced 2 phantom `@noodl/mcp`
  failures that were 0 when re-run alone.
- ⚠️ `typecheck:mcp` is **stricter** than `typecheck:editor`; pulling an editor module into
  `editor-deps.ts` surfaces pre-existing null errors. A **type predicate** is usually the right fix.
- ⚠️ **`library-dist/` is gitignored** — `git check-ignore -v` before trusting anything measured
  against it, and remember an ignored build leaves an observation with no provenance.

---

## 6. When you finish

Update `CN-016-PUBLISH-A-KIT.md` and `TASKS.md` with what you **measured**, including corrections to
the task's own premises — s31 corrected four in CN-017 and two in CN-016, and those are the most
useful paragraphs in either file.

**If CN-016 closes, phase 69 is done at 20/20.** ✅ **Overwrite [README.md](README.md) rather than
amending it** — it still opens on a ruling that has been made. Move anything that outlives the phase
to memory, not to a file here. There is no remaining blocker and no remaining ruling; **D21 was the
last one.**

⚠️ **If AC5 is the only thing left undone, say exactly that** — *"CN-016 complete but for AC5, which
needs a live editor"* — rather than closing the phase or leaving it ambiguous. Ambiguity is the one
bad ending, and it has been the tempting one for four sessions.
