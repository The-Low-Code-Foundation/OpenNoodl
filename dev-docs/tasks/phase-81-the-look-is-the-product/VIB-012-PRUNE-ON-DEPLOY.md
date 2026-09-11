# VIB-012 — Prune the stock library on deploy

**Register row: V36.** Opened 2026-08-31 by Richard's ruling, session 5.

He asked whether the 3.32 MB stock library is *"just per NodeGX project"* or whether *"it pushes
stock images with the deployed app"*. **It ships with the deploy**, measured — and asked to choose
between prune-on-deploy, shipping fewer, and accepting it, he said: **option 1.**

## §1 The measurement this rests on

Run against the real filter (`buildIgnoreMatcher`, v2 project, no `.noodlignore`), with three
known-excluded paths beside it so the matcher was observed working rather than assumed:

| path | decision |
|---|---|
| `docs/whatever.md` | EXCLUDED — default rule `docs/` |
| `node_modules/x/index.js` | EXCLUDED — default rule `node_modules/` |
| `components/Pages/Home/nodes.json` | EXCLUDED — default rule `components/` |
| **`noodl_modules/starter-imagery/ground-city-dusk.webp`** | **SHIPS** |
| **`noodl_modules/starter-imagery/avatar-1.webp`** | **SHIPS** |

`noodl_modules/` appears in no default ignore entry and nowhere in `utils/compilation/`.

⚠️ **Scope it correctly.** Browsers fetch only what a page references, so this is **deploy payload,
not per-visitor page weight**. The cost is in the artefact and the hosting, not in anyone's load.

## §2 🔴 The hazard, which is the whole reason this is a task and not an edit

**Image paths in this product are frequently DATA, not parameters.** `ui-testimonial-row` — a
shipped recipe — keeps its three `avatar-*.webp` paths inside a `Static Data` node's JSON string,
and a `For Each` feeds them to an `Image.src` over a connection. A pruner that walked node
*parameters* would find no reference to any of the three and **silently delete pictures a deployed
app asks for.** The failure is invisible at deploy time and shows up as three broken images on a
stranger's website.

So the rule is: **scan raw project text, and refuse to prune when anything is ambiguous.**

## §3 Design

1. **Only `noodl_modules/starter-imagery/` is prunable.** Not `assets/`, not other modules. This
   library is ours, its shape is known, and it is the only thing that is megabytes of
   mostly-unreferenced. The blast radius of a wrong prune anywhere else is a file the *user* put
   there.
2. **Reference detection reads raw text**, so a path inside a `Static Data` JSON string counts
   exactly like a parameter.
3. 🔴 **The scan must EXCLUDE the imagery directory itself — and the reason is the opposite of the
   one this task first wrote down.** Measured, after asserting it wrongly:
   - `LICENCES.json` lists bare basenames (`"file": "avatar-1.webp"`) and contains the string
     `starter-imagery/` **nowhere**. Scanning it changes nothing. The original claim — *"it names
     all 44 so everything reads as referenced"* — was simply false.
   - `manifest.json` carries the module's own documentation: *"Reference any file as
     `noodl_modules/starter-imagery/<name>`"*. `<name>` is not a filename, so it trips the
     refuse-on-ambiguity rule and **disables pruning permanently, for every project**, with a reason
     that reads entirely plausible.

   🔴 **A module's own README prose can switch off a tool that reads the project as text.** The
   directory is skipped because **documentation is not a reference** — and the spec fixture now
   carries that exact `<name>` sentence so the control is live rather than trivially true.
4. 🔴 **Refuse-on-ambiguity, and say so.** Every occurrence of `starter-imagery/` in the project must
   be followed immediately by a filename that exists. If any occurrence is not — a path built by
   concatenation, a name that has been renamed away — **prune nothing at all** and report the reason.
   Half-pruning on a partial understanding is the silent-breakage case.
5. **`manifest.json` and `LICENCES.json` always ship.** The provenance record travelling with the
   pictures is the library's defensibility (V30); a deployed app with photographs and no licence
   file is the thing the CC0 argument exists to prevent.
6. **It goes through the one copy path.** `copy.ts` is the single filter (`one-copy-path.test.ts`
   asserts no deploy target grows its own), so the prune is a second exclusion stage inside
   `scanProject`, reported through `ProjectCopyReport` with its own `source` so the deploy report
   says *why* a picture is missing.

## §4 Acceptance criteria

1. A deploy of a project that references N starter photographs carries **N of them**, plus
   `manifest.json` and `LICENCES.json`, and none of the rest.
2. **A path that lives only inside a `Static Data` JSON string keeps its file.** This is the
   regression that matters; it gets a spec built from the shipped `ui-testimonial-row` shape.
3. **An unresolvable reference prunes NOTHING**, and the report says which occurrence caused it.
4. The deploy report names the rule and the reason for every pruned file, like every other exclusion.
5. A **real deploy of a real project** is run and the output inspected: the referenced pictures are
   present, the unreferenced ones are gone, and the byte saving is stated.
6. `npm run test:ci` is run and read against the known floor (**4, all AIX-006 by name**).

---

## §5 Built and measured, 2026-08-31

**Delivered**: `build/starterImagery.ts` (the decision, pure), wired into `copy.ts`'s `scanProject`
so it goes through the **one copy path** (`one-copy-path.test.ts` forbids a second filter), reported
through `ProjectCopyReport` with its own `source: 'unreferenced-imagery'` and a new
`imageryPruneRefused` field. `clearFolders` already removes and recreates the top-level folder, so a
re-deploy does not leave yesterday's 44 behind.

### AC5 — measured on the real VIB-004 demo project, against the real library

| | |
|---|---|
| library on disk | 52 files, **3.35 MB** |
| ships | **7 files, 92 KB** — `work-potter.webp`, `avatar-1/2/3/5.webp`, `manifest.json`, `LICENCES.json` |
| dropped | 45 files, **3.26 MB** |
| **saving** | **97.3%** |

The four avatars include `avatar-5.webp`, which appears only as the component's own default `src` —
i.e. the scan caught a reference no page renders, which is the conservative direction.

### AC6 — `npm run test:ci`

**2,928 specs, 4 failures — the known floor, all AIX-006 by name**, zero from VIB-012. 12 VIB-012
specs ran (checked by name in the log, because a spec missing from `tests/utils/index.ts` never runs
at all and reports nothing).

✅ **Mutation-checked, and it is the check that found the corrected mechanism.** Removing the
`if (relativePath === STARTER_IMAGERY_DIR) continue;` line takes the suite from **4 failures to 10**,
reddening six VIB-012 specs including the manifest-prose control. Before that fixture carried the
real `<name>` sentence, the control passed against a mutant — a spec that could not fail.
