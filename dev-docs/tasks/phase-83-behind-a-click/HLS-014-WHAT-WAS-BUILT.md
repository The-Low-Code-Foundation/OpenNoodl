# HLS-014 — what was built

**Session 15, 2026-09-10. 4 of 4 acceptance criteria closed.**

`nodegx deploy` into a folder it has deployed to before is now an **update**: it rewrites the site,
removes the files its own previous deploy left behind, says whether anything actually changed, and
recovers a folder a killed deploy left half-written. `nodegx live <url>` is the new command that
answers *is the app being served the app I built* — by asking the server, not by reading a local
record.

## 1. What §2 said, and what re-measuring found

§2 predicted the task's subject was `checkTarget`: *"it refuses a non-empty folder or asks the
author to confirm, and there is no author to confirm in CI"*.

🔴 **Half of that was already done and the other half pointed at the wrong file.** HLS-015 shipped
`--force` — an explicit flag with the safe default — so §3's second bullet was closed before this
task started. And a real redeploy of `templates/landing-pages` after a one-word edit, run before
anything was written, found the actual damage two layers down:

```
index-842da8235ea3dad0.js                  ← deploy 1; nothing serves it any more
index-b529d7656259c342.js                  ← deploy 2; what index.html points at
noodl_bundles/b2-378e4cd5a13ab7f7.json     ← deploy 1's /Pages/Business
noodl_bundles/b2-6ac1955a1e568848.json     ← deploy 2's /Pages/Business
```

The served app was correct in that state. Three other things were not:

1. 🔴 **`readDeployedRoots` read the STALE export.** It resolved the entry with
   `readdirSync(outDir).find(/^index-.*\.js$/)`, which returned `index-842da82…js` while
   `index.html` named `index-b529d76…js`. **The blank-site refusal HLS-015 exists for was, from the
   second deploy onward, a statement about an app that is no longer being served** — and in the
   direction that matters: a deploy that would ship a blank page, into a folder whose previous
   deploy was good, exits 0.
2. **The component count grew with the number of deploys.** The reading walked `noodl_bundles/`,
   so it counted `/Pages/Business` twice and reported **22 of 22** components for a 21-component
   project.
3. **The folder kept serving the previous version of every changed page** at its old URL.

None of that is in §2. §2 was not wrong about `checkTarget`; it was aimed at the door while the
hole was in the room behind it — the fifth session running that re-measuring §2 paid for itself
(register row **C79**'s lesson, applied to a task file instead of a register row).

## 2. The shape

| piece | where | why there |
|---|---|---|
| `resolveEntry` | `noodl-preview/src/deployReading.ts` | the export is resolved **from `index.html`**, the way a browser resolves it |
| bundle read from `componentIndex` | same | the list the runtime fetches from is the only list that describes the app |
| `.nodegx-deploy.json` + `disposition`/`announce`/`sweepPlan`/`compareDeploys` | `nodegx-export/src/cli/deployManifest.ts` | the local record, and every decision on it is pure |
| `written: string[]` | `noodl-editor/.../build/deployer.ts` | what the deployer **wrote**, which no directory listing can reconstruct |
| `copiedPaths` | `noodl-editor/.../build/copy.ts` | the same, for the verbatim project-file half |
| `nodegx live` + `gradeLive` | `nodegx-export/src/cli/live.ts` | AC3: the reading that comes from a machine that is not this one |
| `EXIT.stale = 10` | `nodegx-export/src/cli/exitCodes.ts` | the only code in the table that is a statement about somebody else's server |

🔴 **The sweep is driven by what the deployer says it wrote, and the first version was not.** It
compared the previous deploy's entries against a listing of the folder — and swept **nothing**, by
construction: a stale `index-<old>.js` is still in the folder at that moment, so "previous entries
missing from the folder" is always empty. The two lists differ by exactly the files the sweep
exists to find. Threading `written` out of `deployToFolder` is the whole fix, and it is why an
editor file had to change for a CLI task.

🔴 **`--force` buys permission to overwrite, never permission to delete.** A folder with no record
is refused; with `--force` it is written into and **nothing is swept**, because there is no list
saying what this command may remove from a folder it did not write. The stale bundles that survive
are named in the output instead. A deploy command that quietly empties a web root is a far worse
failure than the stale file it was tidying up.

## 3. The acceptance criteria

`tests/hls014-drive.mjs` — one command, **22 checks, all green**:

```
node packages/nodegx-export/tests/hls014-drive.mjs
```

### AC1 — deploy, change one page, deploy again ✅

```
1. the first deploy, in a browser
  ✓ the page draws — 1881 characters, 151 elements
  ✓ control: the marker is NOT on the page before the change — 0 occurrences
2. one page changed, deployed into the same folder
   changed "Your name here" → "HLS014 CHANGED THIS LINE" in components/Site/Footer/nodes.json
  ✓ the redeploy exits 0 with no --force
  ✓ 🔴 it removed the previous deploy's stale files — 2 removed
  ✓ 🔴 exactly one export is left in the folder — index-1f3d9d211955832b.js
  ✓ AC1: the change is on the live page
  ✓ 🔴 AC1: and NOTHING else moved — exactly one line changed, and it is the edited one
        50: "Your name here" → "HLS014 CHANGED THIS LINE"
```

🔴 **The control reads zero and it comes first.** Arm 1a establishes that the same instrument, on
the same page, reports the marker **absent**. Without it, "the marker is there" afterwards is a
fact about the search rather than about the deploy.

🔴 **"Nothing else moved" is a line-by-line diff of the whole page, not a length.** The first
version compared `after === before.replace(phrase, MARKER)` and failed on a good deploy: the phrase
occurs earlier in the page inside a longer line, so `String.replace` changed a different occurrence
than the one the deploy changed. The lengths matched to the character (1881 → 1891, exactly the
replacement) — **a subtraction would have passed and told you nothing about where the change
landed.** The line diff says which line moved, and only one did.

### AC2 — an interrupted deploy, and the deploy after it ✅

An **abandoned arm**: the deploy is started for real and killed with `SIGKILL` once the folder holds
something. It never completes, which is the point — a defect in the half-written state is invisible
to every arm that does.

```
5. AC2 — a deploy killed part-way, and the deploy after it
  ✓ the deploy was killed part-way — 7 entries written when it died
  ✓ 🔴 AC2: the folder says which state it is in — state: in-progress
  ✓ 🔴 AC2: the next deploy recovers it without --force — exit 0
  ✓ and says the previous one did not finish
  ✓ the record is complete again — index-842da8235ea3dad0.js
  ✓ 🔴 AC2: and the recovered folder renders the app — 1881 characters, 151 elements
```

🔴 **The record is written BEFORE the engine is spawned, and that is the only reason it is
evidence.** Every other signal a half-written folder produces — a file count, a timestamp, an exit
code nobody was there to catch — is equally consistent with a folder that finished.

🔴 **`detached: true` on the spawn.** The engine is a child of the CLI, so the kill has to address
the process **group**; `process.kill(-pid)` without `detached` addresses the *drive's own* group,
which would kill the drive and let the check pass by never running.

### AC3 — "what is live?", read from the served artefact ✅

`nodegx live <url> [--against <folder>]`. The identity is `index-<hash>.js` — a content hash of the
export, already in the artefact and already in the served HTML, so nothing had to be added to the
deploy to make it readable. The command fetches the page, reads the entry out of the HTML **the
server sent**, and then fetches that export to confirm the server actually holds it.

```
4. AC3 — what is live, read from the server
  ✓ the live site IS the build in the folder — is serving index-1f3d9d211955832b.js
  ✓ and with no folder to compare, it still says what is live
  ✓ 🔴 a server serving the previous build is refused — exit 10
  ✓ 🔴 a page naming an export the server does not hold is refused — exit 10
```

🔴 **Two refusing arms, because a check that has never said no is not a check.** The second one is
the case a cache produces: the page is real, it names its app, and the app is not there. Every
check that stops at the HTML says that site is fine, and anybody loading it gets a blank screen.

⚠️ **Redirects are followed and reported** (`asked → final`), so a reading is never filed under a URL
it was not taken from — register row **C74**, which was filed against `render_report` for exactly
this.

### AC4 — a second identical deploy ✅

```
3. AC4 — the same project deployed again, changing nothing
  ✓ 🔴 reported as identical, not as a fresh success
      Landing pages in …/site is unchanged — the deploy already there is byte-for-byte this one
      (index-842da8235ea3dad0.js, 11 entries). Nothing was added and nothing was removed.
```

Both `buildId` **and** the entry set have to match. The export can be byte-identical while a copied
project asset moved, and "identical" is read by a person as *nothing about this site moved*.

## 4. Out of scope, recorded as a deliberate deferral

🔴 **Rollback.** §3 asked for it to be recorded rather than dropped, and this is the record.
`nodegx deploy` does not keep the previous build and cannot put it back — the sweep deletes it, on
purpose, because a folder holding two builds is the state this task exists to end. **The reason it
is not here rather than not done:** the artefact a rollback restores is the *project at the previous
commit*, which the caller already has and this command does not; keeping a shadow copy of a ~15 MB
site inside the folder being uploaded would ship it. The honest rollback is `git checkout` and
deploy again, and `nodegx live --against` is what tells you when it has landed.

## 5. The gates

| gate | result |
|---|---|
| `tests/hls014-redeploy.test.ts` (new) | **44 rows**, all green |
| `noodl-preview/tests/deploy.test.ts` (7 new rows) | 17 rows, green |
| `npm run test --workspace @nodegx/export` | **98 suites / 3,395 tests**, green |
| `npm run test --workspace @noodl/preview` | 31 tests, green |
| `npm run typecheck` / `:editor` / `:editor-tests` / `:preview` | 0 |
| `npm run test:main` | **446 suites / 7,359 tests**, green |
| `tests/hls014-drive.mjs` | **22 checks**, green |

**Two in-repo gates caught this work, and both were right to.**

1. 🔴 **`hls001-package-boundary`** — `src/cli/live.ts` imports `http` and `https`, which were not
   on the builtin inventory. Added, with a note saying why the list is an inventory and not a
   policy.
2. 🔴 **`hls002-cli`'s "--help names every exit code"** — its pattern was `^\s{2}<code>\s{2}`, which
   quietly assumed **every exit code is one digit**. `10` is right-aligned under `9` with one
   leading space, so the gate failed on correctly formatted help. Relaxed to `^\s+<code>\s{2}`; the
   two spaces *after* are what stops it matching a `10` inside a sentence, so that half stays.

⚠️ **`deployToFolder`'s `written` list has no in-CI gate of its own.** It cannot have one in
`noodl-preview`'s ts-jest runner — the engine is the editor's whole model graph, which is why it is
a separate bundle in a separate process (HLS-013 measured 201 type errors for the alternative). The
drive is what grades it, and the drive is not CI. A deploy that under-reports what it wrote would
show up as a sweep that removes too little; one that over-reports would delete a live file, and
that is the direction worth a gate the day this is cheap.

## 6. What this leaves

- ⚠️ **`environment` is still always `undefined`.** HLS-015 left this and so does this task: nothing
  in the phase has ever deployed with cloud-services metadata attached. It is not in scope for any
  remaining task and needs its own row if it matters.
- ⚠️ **`--base-url` is still never driven end to end.** `resolveEntry` and `entryFromHtml` both read
  through a prefix and both have a spec row, so a site in a subfolder is now *read* correctly. No
  arm has served one.
- ⚠️ **C69 remains guarded and latent.** Unchanged by this task.
- 🔴 **A stale `index.html` in a CDN is the failure `nodegx live` was built to name and cannot fix.**
  The command tells you the served page points at an export the server does not hold. Purging a
  cache is somebody else's command.
