# Next session — phase 72

**Written 2026-08-19, seventh session.** **NAT-005 landed and Tier 3's vocabulary now exists.**
The launcher's Community tab and the editor's rail panel draw from one set of components, rows
carry the metadata the view model always had, and there is a way to grade a React component in
this repo's jest. **NAT-004 is the only unstarted Tier-1 task.** Two rulings still block writes.

## Read first, in this order

1. [NAT-005](NAT-005-THE-TAB-THAT-IS-A-LIST-OF-GREY-LINES.md) §Status — the AC table and four
   findings. **Read the "this runner CAN grade a React component" one before writing any spec for
   NAT-007..011**; it is the instrument, and it comes with one design constraint.
2. `packages/noodl-core-ui/src/components/community/` — the vocabulary itself. `CommunityRow`,
   `CommunitySectionBody`, `CommunitySection`, `communityMeta.ts`, two densities.
3. [NAT-006](NAT-006-THE-API-THE-EDITOR-CANNOT-SEE.md) §Status and `nodegx-community/docs/API.md`
   §4 and §6 — still the contract every Tier-3 task reads.
4. [TASKS.md](TASKS.md) §The order, then [README §4](README.md) — five rulings open (D5, D6, D7,
   D8, D10).

## What happened this session

**NAT-005 AC1, AC2, AC3, AC5, AC6 and AC7 are closed** — `5c5bb08f`. Gates on the committed tree:
`test:main` **263 suites / 4210 tests / 0 failures**, core-ui jest **28 / 521 / 0**,
`typecheck:editor` and `typecheck:editor-tests` clean. 51 new tests, **verified red 6 of 6**.

### 🔴 The finding worth carrying: this jest CAN grade a React component

`tests-unit/` has assumed that no DOM means components are ungradeable, so component-shaped
questions get **source analysis** — read the `.tsx` as text, match strings. That is blind to a
rename, and it cannot tell a component that *drew nothing* from one that was *never called* —
which is exactly what a D15 assertion is asking.

A React element is a plain object and a hook-free component is a plain function from props to
elements. **`tests-unit/support/renderElements.ts`** walks one: no DOM, no `react-dom`, no jsdom.
Both arms of AC5 now come out of one call to one component with one field different.

✅ **Use it for NAT-007..011.** The constraint it asks for is small and worth it: keep the pure
half of a surface separate from the half that reads context — `CommunityTab(props)` beside
`Community()` — because a hook throws under this walk. ⚠️ It sees no effects, no layout, no paint.
⚠️ And anything importing `common/Icon` cannot be loaded by this runner at all (`require.context`),
which is why the shared row has no leading glyph.

### 🔴 A gate said no to me twice, and was right both times

**AC7 went red on a comment** — the sentence *"No `dangerouslySetInnerHTML`, ever"* in the module
note of a file that does not use it. Comments are stripped now (`stripComments`, in the same
support file, reusable). The dangerous direction is the other one: a file that both uses the
construct and documents the prohibition reads identically to a naive checker, and the prose is
what makes it look reviewed.

**NAT-001's PAIRS table rejected two rows** I added at `min: 1.09`. It grades **words at 4.5 and
shapes at 3** and refuses any other bar on purpose; an elevation step is neither, and a third bar
would have loosened the guard for every future row. Those two claims moved to the elevation test.
⚠️ **Five existing PAIRS rows also had to be *corrected*, not appended to**: this task moved the
tab up a ground (cards on `bg-1`), so familiar foregrounds were asserting grounds nothing paints
any more. **The trigger for editing a row is the same as for adding one — a new pairing.**

### 🔴 My red-verification harness reported a false GREEN

Five of six injected defects fired by name; the sixth read as *passed*. The spec was fine. The
harness counted failures by regexing `Tests: N failed` out of jest's output, and the mutation left
the file unparseable — so the **suite failed to run**, that line never appeared, and it reported
zero failures. **An unparseable file and a clean pass rendered identically.** Re-run as valid code
it failed immediately. ✅ Give a mutation harness its own control.

### ⚠️ Storybook does not start in this repo, and 99 stories cannot be opened

`npm run start:storybook` fails before serving anything, and did before this task. I fixed three
causes (an `import.meta` shim that makes esbuild emit ESM; `@storybook/addons`, gone since SB7; an
MDX1 stories glob SB8 cannot parse) and **did not narrow the fourth**: all 99 `.stories.tsx` fail
with `Module parse failed: Unexpected token (1:12)` at their first `import type`. A `webpackFinal`
helper that replaced an absent `include` instead of widening it looked like the answer, is a real
defect, was fixed — **and was not the cause.** The file says so in both halves.

That is why **NAT-005 AC4 is the one criterion still open**. The four states were looked at through
a purpose-built esbuild harness instead (real components, real compiled stylesheets, both themes,
both densities, plus `hidden` drawing nothing beside the others as its control) — which answers
AC1 but not AC4's actual claim, that a designer can open these.

⚠️ **Worth weighing before Tier 3 writes four surfaces' worth of stories.** A story nobody can
render is a story nobody wrote — it is how this tab spent a whole phase as two inline style
objects without anyone seeing it outside the running app.

## Where to start

**NAT-007 is the flagship and its read half is unblocked** — threads have an endpoint, and the row,
the four states and the metadata formatters it needs now exist. What it still cannot do is reply,
which is AC5/D5. The honest shape is *build the whole reading experience, land the reply behind the
ruling*, with **NAT-015 in the same session on the same renderer**.

**NAT-004** (light by default on the web, S, `nodegx-community`) is now the only unstarted Tier-1
task and is independent of everything above — a good session on its own, or a warm-up.

**If you would rather close something completely, two are one decision each:**

- 🔴 **D5 — what authorises a write from the editor?** `docs/API.md` §6 has the three writes
  specified. Closes NAT-006 AC5 and unblocks four Tier-3 tasks.
- 🟡 **NAT-005 AC4** — one webpack-loader question in `.storybook/main.ts`, and 99 stories come
  back with it.

🔴 **Do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4 on the strength of NAT-006.** They close
when mail reaches a human — NAT-014 AC2/AC7, still needing a deploy.

## Loose ends

- ⚠️ **Eight phase-72 files remain modified and uncommitted** from previous sessions (NAT-006/007/
  009/010/011/012/013 and the README) — they carried somebody else's unlanded edits and a pathspec
  commit would sweep them. Everything of mine is committed: `5c5bb08f`, by pathspec.
- ✅ **The shared 55432 Postgres does not need queueing** — `create database <yours>` and pass
  `DATABASE_URL`. 🔴 **A peer found the trap in doing so**: `nat014-outbox-drain.test.ts` spawned
  the drainer with a hard-coded `DEFAULT_DATABASE_URL` while `freshDb()` honoured `DATABASE_URL`,
  so it seeded one database and drained another — **20/20 on the shared DB, 11 of 20 red on an
  isolated one**, all reading as "the drainer sent nothing". Fixed in `f9e7151`.
- ⚠️ The peer also landed UNI-006's bridge; the platform floor is now **47 files / 1132 tests / 0
  failures**, after `npm run build`.
- ⚠️ **`AskAboutNodeDialog.module.scss`, the ~99 fill-role files, and the active-line contrast
  finding** are unchanged from the last four handovers.
