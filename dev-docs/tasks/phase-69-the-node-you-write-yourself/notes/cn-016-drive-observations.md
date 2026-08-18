# CN-016 — what the drive actually observed

**2026-08-18, s32.** Driven against the expectations committed in
[cn-016-drive-expectations.md](cn-016-drive-expectations.md) **before** the
editor was launched. Twelve predictions; **eleven met, one met with a correction,
two defects found that no prediction anticipated.**

## Provenance of the thing under test

⚠️ `library-dist/` is gitignored, so the artefact is recorded here or its
provenance does not exist:

| | |
|---|---|
| artefact | `library-dist/modules/example-node-kit-1.0.0.zip` |
| md5 | `66b53969ea68e0e17518a84c3267e041` |
| built | 2026-08-18 22:09:54, from tree `502400b8` |
| served at | `http://127.0.0.1:3000` via `library:verify-dist --serve --port 3000` |
| editor | 0.1.7, `useLocalDocs: true`, main process logged *"Using local docs"* |
| drive project | `~/Documents/cn016-ac5-drive` (throwaway; safe to delete) |

🔴 **The install is provably from the artefact and not from the real origin.**
Three independent readings say so: the main process chose the local endpoint; the
modules tab listed **Confetti**, which exists in `library/` and **not** at the
real origin (one of the four the divergence gate baselines); and the consent
dialog and the written provenance record both name
`http://localhost:3000/library/modules/example-node-kit-1.0.0.zip`. D21 forbids
satisfying this from a local folder that merely resolves — a port number would be
the same trap in different clothes, so it is worth having three readings rather
than one.

## A. AC5 — build the caller. ✅ MET, end to end.

| # | prediction | observed |
|---|---|---|
| 1 | editor reads the artefact server | ✅ three readings above |
| 2 | Example Node Kit listed, Install enabled | ✅ 30 module cards; no `module-card-incompatible` badge (0.1.0 ≤ 0.1.7) |
| 3 | `noodl_modules/example-node-kit/` with `manifest.json` + `index.js` | ✅ plus `README.md` and `types/node-kit.d.ts` |
| 4 | provenance `origin: 'installed'` with the localhost URL | ✅ exactly, with the verification result and consent stamp |
| 5 | node placeable, zero console errors | ◐ **placed; NOT zero errors — see Defect 1** |
| 6 | `noodl_modules/` ships verbatim in the deploy | ✅ all four files byte-identical by `cmp` |
| 7 | the deploy loads and renders | ✅ |

**On (2), CN-017's consent gate fired on a real download** and read well:

> Install Example Node Kit · This download contains code that will run inside
> your app… From `http://localhost:3000/library/modules/example-node-kit-1.0.0.zip`
> … **Defines 1 node: example-node-kit.StatTile.**

**On (5)**, the node library went **128 → 129 nodes**, and the picker listed
**"Stat Tile"** under **EXTERNAL LIBRARIES**, labelled **"Example Node Kit"** —
CN-018's "the picker names the kit", live.

**On (7)**, the deployed folder was served over HTTP and loaded in headless
Chrome over CDP. `document.body.innerText` was **"Hello World! / Revenue / —"** —
`Revenue` is the StatTile's label and `—` its value placeholder, so **the kit's
node rendered in the deployed app**, with
`/noodl_modules/example-node-kit/index.js` fetched by the page. The only 404 in
the whole load was `/favicon.ico`.

## B. CN-017's two undriven surfaces. ✅ MET, and they agree.

| surface | scaffolded kit | installed kit |
|---|---|---|
| Settings → Kits (`kit-origin-*`) | **"written here"** | **"installed from localhost:3000"** |
| property-panel byline | — | **"from Example Node Kit · installed from localhost:3000"** |

The Settings row's tooltip carries the full sentence — URL, date, consent, and
*"When installed, its code declared: Defines 1 node: example-node-kit.StatTile."*
🔴 **Neither surface ever said "origin not recorded" for a kit that had a
record**, which was the specific failure prediction 8 existed to catch.

⚠️ **One correction to the prediction, not to the product:** I predicted
*"installed from 127.0.0.1"*. It reads **localhost:3000**, because
`getContentEndpoint()` returns `http://localhost:3000` on its local branch. The
prediction was wrong about the host string; the product is right.

⚠️ A third row appeared that I had not predicted: a kit I created by copying a
folder on disk reads **"origin not recorded"** — correctly, since nothing
installed or scaffolded it. That string is right when it is earned.

## C. s29's undriven fix. ✅ MET, with both arms.

Four kits, four states, read from the same panel in one pass:

| kit | broken how | the row says |
|---|---|---|
| `example-node-kit` | healthy | `▸ 1 node` |
| `broken-missing-main` | manifest names a `main` that is not on disk → registers **nothing** | *"failed to load: its script could not be loaded (…). **None of its nodes are available** — a node from this kit will report as an unknown type."* |
| `half-registered-kit` | registers one node, **then throws** | *"failed to load: … **It is only PARTIALLY registered** — nodes defined before the failure are available and every node after it is missing, so the kit looks present while being incomplete."* |
| `scaffolded-drive-kit` | runs clean, declares **zero** nodes | *"Installed. Reload the preview to load its nodes…"* |

🔴 **The two branches DISAGREE on the two cases, which is the whole point.**
Prediction 12 was an absence claim — *no row may say "PARTIALLY registered" of a
kit that registered nothing* — and an absence is only worth reading beside a
signal known to fire. `half-registered-kit` exists solely to make it fire. It
does. So the "None of its nodes are available" reading on `broken-missing-main`
is a discriminating result and not the appearance of one, which is what it would
have been had the `partial` branch simply been deleted.

⚠️ **The fourth row is a documented limit, not a defect.** A kit that ran and
declared nothing is indistinguishable from one not yet loaded, and
`KitsSection.tsx` says so in writing: *"this caller genuinely cannot tell
'registered nothing' from 'not loaded yet' … a zero-node warning here would
collapse them."* Only a runtime that reports a failure can separate them, which
is CN-015's channel — and this kit fails quietly by construction, so there is
nothing to report. Recorded so a later session does not read it as a bug.

---

## 🔴 Defect 1 — every install throws two uncaught TypeErrors, and the write's error path is dead

`writeImportReport` ([importAssessment.ts:118](../../../../packages/noodl-editor/src/editor/src/utils/import-engine/legacy/importAssessment.ts#L118))
does `await FileSystem.instance.writeFile(path, content)` **with no callback**.
[filesystem.js:110](../../../../packages/noodl-editor/src/editor/src/utils/filesystem.js#L110)
is callback-style and returns `undefined`, so:

1. the `await` is a no-op — it does not wait, and `written.push(name)` records
   success before the write has completed;
2. `callback({result:'success'})` throws `TypeError: callback is not a function`
   **asynchronously and uncaught**. Measured: **exactly two exceptions per
   install**, matching the **two** files it writes (`import-report.json`,
   `IMPORT-REPORT.md`);
3. 🔴 **the `try/catch` around it can never fire.** A write failure is delivered
   to a callback that does not exist, so `Failed to write ${name}` is
   **unreachable** and a failed write would be reported as a successful one.

Twelve other call sites `await filesystem.writeFile(...)` identically; one
(`nodesharecontext.ts:125`) calls `.then()` on the `undefined` return and is
therefore already dead code.

**Not fixed here, and not CN-016's.** The honest fix — return a promise when no
callback is passed — strictly improves all thirteen callers, but it changes a
shared primitive in a `.js` file, which is invisible to every gate but `test:ci`.
That is a change that deserves its own task and its own run, not the tail of a
long session.

## ⚠️ Defect 2 — the deploy publishes the project's bookkeeping

The deploy dialog reported *"19 project files will be deployed. 3 will not:
.gitignore, components/, nodegx.project.json"*. What shipped into the public
folder included **`CLAUDE.md`**, **`IMPORT-REPORT.md`**, **`import-report.json`**
and **`noodl_modules/kit-provenance.json`** — the last of which carries the URL a
kit came from and a consent timestamp.

None of it is secret and none of it breaks the app, so this is a note rather than
an alarm. But CN-017 was careful that a provenance record *"is deliberately not
carried by an export"*, and a deploy is the more public of the two. Worth a
decision by whoever owns the exclusion list; it is not CN-016's to make.
