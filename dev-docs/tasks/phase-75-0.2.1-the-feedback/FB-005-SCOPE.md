# FB-005 — scope: templates anyone can share

**Written:** 2026-08-25 (session 39), as queue item 1. **Status of the parent task:** ⬜ OPEN,
R-templates ruled 2026-08-22 (**curated first**). This document is the slice the task file asks
for before starting, and it is written against **what the code does**, not what the task file or
the module READMEs say it does.

🔴 **The headline is a correction.** FB-005 says *"There is no template mechanism in the product
at all."* That is wrong. There is a complete one — registry, provider interface, four providers,
download, unzip, cache — and **it is unreachable**. That changes where the work is, and it puts a
user-visible hang in the product today that has nothing to do with templates being shared.

---

## 1. What is actually there (swept 2026-08-25, `cline-dev` @ `3de0dcdb`)

| thing | where | reached by |
|---|---|---|
| `TemplateRegistry` (`list` + `download`) | `utils/forge/template/template-registry.ts` | see below |
| `EmbeddedTemplateProvider` | `models/template/EmbeddedTemplateProvider.ts` | ✅ directly, **not** via the registry |
| `NoodlDocsTemplateProvider` | `utils/forge/template/providers/` | registered; unreachable |
| `HttpTemplateProvider` | `utils/forge/template/providers/` | registered; unreachable |
| `LocalTemplateProvider` | `utils/forge/template/providers/` | 🔴 **registered nowhere at all** |

**The caller-grep, which is the only gate that finds this** (FB-021's shape, restated in s37):

- `templateRegistry.list()` — **zero callers** in `packages/**` across `.ts/.tsx/.js/.jsx`. The
  only two hits are its own JSDoc example and the internal `provider.list()` loop. **There is no
  template picker and there never was one.** `TemplateListFilter` is an empty interface, so
  "filter by category" has no data model either.
- `templateRegistry.download()` — one caller, `LocalProjectsModel.ts:306`, inside
  `if (projectTemplate)`.
- `LocalProjectsModel.newProject` — **one** product caller, `ProjectsPage.tsx:1021`, and it passes
  the literal `projectTemplate: ''`. `''` is falsy, so **the registry branch never executes**.

✅ The `else` branch is what actually runs, and it hardcodes `embedded://hello-world` and does
`new EmbeddedTemplateProvider()` **directly, bypassing the registry** (`LocalProjectsModel.ts:343`).
So every new project already comes from a template — just not through the mechanism built for it.

⚠️ **`models/template/README.md` is stale in a way that will cost someone an afternoon.** Its
"Step 3: Use Your Template" recipe says to call `newProject` with
`projectTemplate: 'embedded://<id>'`. No product surface does. Adding a template to
`EmbeddedTemplateProvider`'s map today makes it reachable by **nothing**. Fix the README as part
of whichever slice lands first.

---

## 2. 🔴 Do not build FB-005 on `templateRegistry`. Three measured reasons

The registry path has never run in the shipped product, and it does not survive reading.

1. **`unzipUrl` is an XHR transport handed a local filesystem path.**
   `IFileSystem.unzipUrl(url, to)` does `xhr.open('GET', url)` (`filesystem-node.ts:346`).
   `TemplateRegistry.download` downloads the zip to `templatePath` — a path under
   `platform.getUserDataPath()` — and then passes **that path** as the `url`. The renderer's
   origin is `file:///` (`main.js:444`), so on macOS/Linux an absolute path beginning `/`
   accidentally resolves to `file:///Users/…` and works. On Windows `getUserDataPath()` yields
   `C:\Users\…`, which is not a path-absolute URL; it resolves against the page and misses.
   ⚠️ Not measured on Windows — no Windows machine here. Recorded as a reading of the code.

2. ✅ **FIXED 2026-08-25, and it was never template-specific — see §2a.** `unzipUrl` set only
   `xhr.onload`, so a transport failure settled the promise **never**.

3. **The cache key is the URL; the probe is the unzipped directory.**
   `if (!filesystem.exists(templateZipPath))` — a template whose contents change at a stable URL
   is downloaded exactly once, ever. For community templates that get revised that is a
   correctness bug on the second version, and it needs a version or etag in the key.

   ⚠️ Fourth, smaller: `downloadViaProvider` catches each provider's error, logs it, and
   continues — then throws `Cannot find a valid template provider for: '<url>'`. Since
   `HttpTemplateProvider.canDownload` returns `true` for everything, the message a user gets when
   the download fails names the wrong cause. The provider was found. It failed.

### 2a. 🔴 The hang was NOT confined to the dead template path — fixed this session

I nearly filed the missing `onerror` as *"a bug in dead code, deleted by T1"*. It is not.
`filesystem.unzipUrl` has **two** callers, and the second one is reachable:
`projectmodel.editor.ts:153`'s `unzipIntoDirectory`, which has **four** callers of its own —
`modulelibrarymodel.installModule`/`installPrefab`, `LessonsProjectModel`, `LocalProjectsModel`
and `EditorPage._importProject`. **Installing a module or prefab from the library with the network
down hung the editor forever.** `unzipIntoDirectory` wraps the call in `try/catch`, and that catch
was dead code for the offline case because nothing ever rejected.

⚠️ Note the shape: a 404 was *handled* — `onload` fires with an error body, JSZip refuses it, the
caller gets "Failed to extract". Only the no-response case (offline, DNS, refused connection)
hung. **Testing the fast failure proves the fast failure** — NAT-013's trap, arriving here.

✅ **Fixed**, with `onerror`/`ontimeout`/`onabort` spelled out separately so a timeout does not
read as a dead network. 🔴 **And a second defect in the same function, found on the way:**
`const isEmpty = this.isDirectoryEmpty(to)` dropped the `await` on an `async` method, so the
"Folder must be empty" guard tested a **Promise** — always truthy — and **could not fire**. The
one reachable caller masked it by doing the same check itself, correctly; a direct caller
(`TemplateRegistry.download`) got nothing.

5 specs in `packages/noodl-platform-node/tests/filesystem-unzip-transport.test.ts`, with a
known-firing control that drives a **real archive** through the fake transport and asserts files
land on disk — a fake XHR that reached nothing would otherwise have graded nothing. **Both fixes
mutation-tested**: reverting each one reddens exactly its own spec and no other.
`npm run test:platform` — **5 suites / 27 passed / 0 failures** (was 4 / 22).

---

## 3. ✅ The transport that already works — TUT-004

Templates are structurally the same artefact as tutorial bundles, and that path ships end to end.

- **Storage:** `tutorial_bundles` (`nodegx-community/src/db/sql/0017_tut004_tutorial_bundles.sql`)
  — one row per `articles` row, `payload jsonb` holding a **flat, path-keyed**
  `{ "files": { "<relative path>": "<contents>" } }`, a `version integer`, an 8 MiB
  `pg_column_size` cap, and structural CHECK constraints that refuse a malformed bundle **at
  publish** rather than on a learner's disk.
- **Routes:** `GET /api/v1/community/tutorials` (index, no payloads, with an `installable` flag
  computed by one `slugsWithBundles` query), `/[slug]`, `/[slug]/bundle`.
- **Editor:** `models/lessonplatforminstall.ts` — fetch → stage to a scratch directory → score →
  install → record the source → make re-pull possible. `communityapi.ts:1757` is the fetch.
- **Curation is already the model.** `articles` has no author column and no authoring UI; every
  tutorial is editorial, and `PLATFORM_PROVENANCE = 'curated'` says so in one place.
  🔴 **That is R-templates' curated-first ruling, already implemented.** Nothing needs inventing.

The migration's own argument transfers verbatim: *"no new storage service, no signed URLs and no
unzip dependency in an editor that has none."*

### 🔴 The one place the analogy breaks: a lesson is text, a template may not be

`stageBundleFiles(files: Record<string, string>, …)` writes `fs.writeFile(full, contents)` —
**string contents only**. TUT-004's migration justifies jsonb explicitly on the grounds that *"a
lesson bundle is text — TUT-003's is 35 files and 168K with not one binary in it"*. A **template
is a project**, and a project may carry images or fonts under `assets/`.

✅ **This is smaller than it sounds, and the reason is `installStarterAssets`.** Every project —
template branch and default branch alike — already receives Inter (nine `.ttf` weights) and
Lucide (a `.woff2` covering 1998 glyphs, 212 in the manifest), copied out of the app bundle with
no download. So a **text-only** template already has real typography and a full icon set. The
binary case is genuinely a template that ships *its own* photography or brand font.

**So the decision to take, and it is an engineering one rather than Richard's:**
- **v1: text-only payloads, refused at publish** with a constraint in the same style as
  `tutorial_bundle_has_manifest`. Say so in the submission UI. Recommended.
- Later: either base64 in the payload (⚠️ **+33% against an 8 MiB cap** — a 6 MiB project stops
  fitting) or E7's object store for the binary half only. Do not decide this now; the curated
  first batch is ours to author and can be text-only by construction.

---

## 4. The slice

Ordered so each step is shippable and the earliest ones are independent of any further ruling.

| # | slice | size | depends on |
|---|---|---|---|
| **T1** | ✅ **DONE (s40)** — zip transport deleted, registry made reachable, AC1 met | **S** | — |
| **T2** | ✅ **DONE (s42)** — `project_templates`, three routes, a publisher, AC3 met | **M** | — |
| **T3** | ✅ **DONE (s43)** — the picker, a second provider, AC2 met | **M** | — |
| **T4** | ✅ **DONE (s44)** — categories, sentence-tolerant search, AC4 met | **S–M** | T2 |
| **T5** | "Share as template" — files a **submission**, does not publish | **M** | T2, R-templates |
| **T6** | Star ratings | **M** | 🔒 needs a ruling; see §5 |

✅ **T1 is done (2026-08-26, session 40).** The recommended option was taken — the zip path is
deleted and the provider interface kept — but the sweep found the deletion was only half of it.

🔴 **The root cause was a contract, and it is worth carrying out of this task.**
`ITemplateProvider.download`'s own doc comment read *"@param destination The destination we will
save the ZIP file"*, and `TemplateRegistry.download` was written against exactly that: fetch a zip
to a path, unzip it next door. The only implementation ever reached — `EmbeddedTemplateProvider` —
writes a `project.json` **into a directory**. Two opposite contracts, both
`(url: string, destination: string) => Promise<void>`, so nothing in the type system had anything
to say and the registry would have tried to unzip a directory. **A type signature is not a
contract.** The method is now `install`, the contract is written on the interface, and the rename
is what makes the change loud enough that a future provider cannot implement the old semantics
silently.

**What shipped:**

- ❌ Deleted: `HttpTemplateProvider`, `NoodlDocsTemplateProvider`, `LocalTemplateProvider`,
  `TemplateRegistry.download`'s download/unzip/cache, `ProgressCallback`, and the never-read
  `useCloudServices`/`cloudServicesTemplateURL` fields on `TemplateItem`.
- ✅ `TemplateRegistry.install(url, destination)`, which resolves a provider by `canInstall` and
  **does not swallow a failed install**. The version it replaces wrapped the claim and the install
  in one `try/catch`, so a provider that claimed a URL and then failed fell out of the loop and the
  caller was told `Cannot find a valid template provider` — a message about the wrong thing, at the
  one moment somebody needed to know what actually broke.
- ✅ `models/template/createFromTemplate.ts` — the seam. `newProject` cannot be graded by a spec
  (it reaches `electron-store`, `@noodl/git`, and an `_addProject` that writes into Richard's real
  launcher list), so the decisions moved to a module plain-Node jest can drive. Precedent:
  `refusalPlan.ts`, s37.
- ✅ `newProject` has **one branch**. `resolveTemplateUrl` turns the wizard's `''` — and a missing
  argument — into `DEFAULT_PROJECT_TEMPLATE`, so "no template" and "the default template" stopped
  being two code paths that had drifted apart.

🔴 **Two live defects came out of it, neither of them the one T1 was about.**

1. **`newProject` is not awaited by its caller**, so any rejection was an unhandled promise
   rejection: the launcher's *"Creating new project"* activity toast was never hidden and `fn` was
   never called. A user creating a project into a location they cannot write to watched a spinner
   belonging to a creation that had already stopped. It now returns a **string-discriminated**
   outcome and `fn()` is called on every path. ⚠️ Same shape as s39's `unzipUrl` hang, one layer up:
   **the failure that was handled was the fast one**.
2. **A failed agent configuration destroyed a correctly installed project.** `writeAgentConfigFor`
   was awaited in the same unguarded run as the template, so an unwritable `.mcp.json` refused the
   whole creation — a file `backfillProjectAgentConfig` writes again the next time the project is
   opened. It is now outside the guard and non-fatal.

⚠️ **Left deliberately:** a refusal leaves the (empty) project directory behind. Deleting a
directory the caller chose is the more destructive of the two mistakes, and the one caller passes a
`makeUniquePath`. AC2's *"a refusal leaves nothing on disk"* belongs to T2/T3, where a partial
install of a multi-file bundle is a real possibility rather than a hypothetical.

✅ **The spec grades the chain, not the registry** — `tests-unit/fb-005/template-install-path.test.ts`,
27 specs. AC1 says it outright: a spec over `TemplateRegistry` alone would have been green through
the entire outage. So it asserts `ProjectsPage` → `newProject` → `createProjectFromTemplate` →
`templateRegistry.install` as a **caller-grep made executable**, with comments stripped (the doc
comment names `templateRegistry` while explaining the outage) and two controls: a comment-only
phrase proving the stripper works in both directions, and a neighbouring method proving the body
extractor discriminates rather than returning the whole file.

🔴 **The body extractor was wrong on its first run and said `newProject` called nothing.**
`indexOf('{', start)` finds the **parameter list** — `options: { name?: string; ... }` is an inline
object type — so brace-matching returned the type literal. It walks the parentheses first now. ⚠️
Had the control not been there, that would have read as *"the wiring is missing"* on correct code.

✅ **Six mutants, each killed by its own spec and no other**: the registry bypass restored, the
default dropped, POL-006's ordering reversed, the swallowed install error restored, the fatal agent
config restored, and a `download()` alias re-added to the registry.

## 4a. ✅ T2, closed 2026-08-26 (session 42) — and a CHECK constraint that RAISED instead of refusing

**What shipped**, all in `nodegx-community`:

- `0020_fb005_project_templates.sql` — `project_templates`: a **standalone** table, not a
  `tutorial_bundles` with a different `kind`. A tutorial bundle hangs off `articles` because a
  tutorial **is** an article; a template has no prose to hang off, and giving it an empty article
  would mean teaching `listArticles` to hide half its rows — which is how a list ends up right on
  one page and wrong on the other. ⚠️ **No author column**, and the absence is R-templates'
  enforcement rather than a policy sentence: there is nothing for a write route to fill.
- `src/lib/projecttemplates.ts` — publish, list, detail, bundle. Path safety is **imported** from
  `tutorialbundles.ts`, not re-implemented; a second copy of the rule that decides where files land
  is the last place drift is affordable.
- Three routes under `/api/v1/community/templates`, matching TUT-004's shape exactly.
- `scripts/publish-project-template.ts` — the caller. ⚠️ **This is the half a table is useless
  without**, and building it is what P67's "build the caller" lesson keeps buying. `readBundleDirectory`
  was extracted out of `publish-tutorial-bundle.ts` rather than copied.

**AC3 is met and AC2 is now T3's.** The payload's structural rules are enforced at publish, in the
database, in `tutorial_bundle_has_manifest`'s style, every one of them beginning with `jsonb_exists`.

### 🔴 The finding: a CHECK constraint can RAISE rather than refuse, and the order is alphabetical

`project_template_files_are_text` was written as
`check (not jsonb_path_exists(payload, '$.files.keyvalue() ? (@.value.type() != "string")'))`.

**`.keyvalue()` applied to anything that is not an object RAISES** — *"jsonpath item method
.keyvalue() can only be applied to an object"* — rather than returning false. And **postgres
evaluates a table's CHECK constraints in constraint-NAME order**, which puts `..._files_are_text`
before `..._has_files` alphabetically. So a payload whose `files` was an **array** was refused by a
jsonpath internal error before the constraint whose job that case is ever ran.

| what a publisher got | before | after |
|---|---|---|
| `{files: ["a.json"]}` | `err.constraint` **undefined**, message *"...keyvalue() can only be applied to an object"* | **`project_template_has_files`** |
| `{files: {"a.json": 5}}` | `project_template_files_are_text` | unchanged |
| `{files: {...}}` all text | accepted | unchanged |

The row was refused either way, so nothing unsafe was ever stored. What was broken is the **message**:
`refusals.ts` maps constraint *names*, and there is no name on a raised error — so it reached the
caller raw, naming nothing they could act on. Fixed with a `jsonb_typeof(...) is distinct from 'object'`
guard, which hands the array case back to the constraint that owns it.

🔴 **`0017`'s `tutorial_bundle_has_solution` carries the same unguarded expression and is correct
today only by alphabetical luck** — `tutorial_bundle_has_files` sorts before it and returns false
first. ⚠️ It **cannot be edited**: the migration ledger stores a checksum, and changing an applied
migration is the mistake that file's own header calls the most expensive available here. A
constraint added to that table with a name sorting before `has_files` would expose it.

⚠️ **The instrument is what found it.** `expect(err.constraint).toBe(...)` — TUT-004's rule, that
*"some constraint fired"* cannot tell a working guard from a missing one. An assertion that the
insert threw would have been green on the defect.

### Decisions taken inside T2, each reversible and each stated

1. **Text-only payloads, refused at publish** — §3's recommended arm, taken.
2. **A fixed category vocabulary in DDL** (`starter`, `data-app`, `dashboard`, `site`, `form`,
   `integration`), `0011`'s pattern for `articles`. ⚠️ It is a **product** decision and Richard may
   want different words; it is one migration to change. `TEMPLATE_CATEGORIES` in TS is a second copy,
   and the spec reads the vocabulary out of `pg_get_constraintdef` and compares the **sets**, both
   directions — a value in TS but not SQL is a publish that dies, a value in SQL but not TS is a
   category no reader can name.
3. **The manifest rule is `ProjectFormatDetector.detect()` restated**, not invented: a payload must
   carry `nodegx.project.json`, `components/_registry.json` or `project.json`. ⚠️ `components/`
   **alone** is refused, because the detector scores it 1 against its own threshold of 2 — so it
   would install into a directory the editor answers `unknown` for.
4. **No `installable` flag**, unlike `tutorialSummary`. The payload is `not null` and the row **is**
   the bundle, so the flag could only ever read true — and an always-true field is one a client
   eventually branches on for the wrong reason.
5. **Detail carries `paths`, not `body`.** A template has no prose; what a detail route can honestly
   add is *what is in it*. A manifest of paths answers "page or app" for a few hundred bytes.
6. 🔴 **Omitting `publishedAt` on a republish leaves the row where it was.** Written the obvious way
   — `published_at = excluded.published_at` — pushing a new version of a **live** template with the
   field left out would take it off the shelf as a side effect of fixing a typo in it. Absent means
   *leave it alone*; an explicit `null` is still a working unpublish. Both arms specced.
7. **No `readTemplates` capability was added.** `READ_CAPABILITIES` is what a *client* reads to
   decide what to draw and **nothing dispatches on it** — the gate these routes pass is
   `communityGate`, which refuses the whole surface. Adding a fourth entry no consumer reads is
   P73 s3's shape: a new case in a shared vocabulary admitted by every consumer that dispatches on
   absence from a list.

### ⚠️ What T2 deliberately does NOT include

- **No curated template content.** The shelf is empty; `publish-project-template.ts` is how it gets
  filled, and authoring the first batch is content work T3 needs, not schema work T2 owed.
- **No thumbnail column.** `TemplateItem.iconURL` exists editor-side, but a `thumbnail_url` here is
  `articles.project_url`'s hazard again — free text on an arbitrary host — and a binary in the
  payload is the decision §3 parks. A card draws a title, a category and a file count.

## 4b. ✅ T3, closed 2026-08-26 (session 43) — the picker `list()` was built for, and a sentence about the wrong subject

**What shipped**, all in OpenNoodl:

- **`models/template/PlatformTemplateProvider.ts`** — the second `ITemplateProvider` that has ever
  run, and the first that fetches anything. `community://<slug>` is an **identifier the registry
  resolves**, not an address anything dereferences — the base URL is decided once, from
  `communityorigin`, so the picker's rows are not fetchable URLs held in React state
  (`TutorialSummary`'s stated rule, one shelf over).
- **`communityapi.templates()` / `templateBundle()`** — and `readBundlePayload` **extracted** out of
  `tutorialBundle` rather than copied, because the rules in it are all safety rules (one bad entry
  refuses the whole bundle; a non-string is refused; a parse failure is `unreachable`, never
  `absent`). ⚠️ The *cross-repo* copy of the path check stays deliberate; this is the opposite
  case, two callers in one process.
- **`TemplateRegistry.listing()`** — items **tagged with the provider that supplied them**, plus the
  providers that could not answer. 🔴 **It exists because a short shelf and a broken shelf are the
  same array.** `list()` keeps its old shape and drops the failures; a surface a user looks at must
  not call it.
- **The wizard's fourth mode.** `'template'` → `basics` → `template` → `review`. **No preset step**:
  a template ships its own look, and `setPendingPresetId` maps the untouched default `'modern'` to
  `null`, so a template-mode creation applies no preset at all. The Review screen shows a
  **Template** row *instead of* the Style row — naming a preset nobody chose and which will never
  be applied is the one thing that screen must not do.
- **`hooks/useProjectTemplates.ts`** — `templateRegistry.list()`'s **first caller in the product**,
  which is T1's whole finding closed. Gated on the wizard being open, so the launcher makes no
  community request on cold start.

**AC2 is met**: `createProjectFromTemplate` now removes the project directory on a refusal —
**only when it created it**. `directoryExists` is asked **before** `makeDirectory`, which is the
entire precondition; T1's "leave it behind" argument was right and is now the *reason for the
guard* rather than a reason to do nothing. The provider buys the other half by fetching and
checking the **whole** bundle before writing one byte, so a refused template writes nothing at all.

### 🔴 The finding: one refusal sentence served two different questions

`refusalSentence` mapped an outcome to a sentence, and both `list` and `install` called it. With
the platform undeployed, opening the picker logged:

> `Error: that template is no longer on the community shelf`

— a sentence about **a template**, in a refusal where **no template was named**. A 404 on
`/templates` means the shelf could not be read; a 404 on `/templates/x/bundle` means *x* is gone.
Two different facts, one string. It now takes a `subject`.

⚠️ **No spec could have caught it, and the reason generalises.** Both arms are `absent`, both are
refusals, and every available assertion — *it threw*, *it refused*, *it did not narrate
permission* — is green on either wording. **The instrument that found it was the running app**,
at the first moment the code met a platform that answers 404. Re-measured live after the fix:
`Error: the community shelf is not available to this editor`.

### Decisions taken inside T3, each reversible and each stated

1. **`'template'` is a MODE, not a step inside `guided`** — see the preset argument above.
2. **`PlatformTemplateProvider.list` THROWS on a failed read** rather than returning `[]`. An empty
   array and a failed read are the same length, and `listing()` can only report a short shelf if the
   provider says so. Returning `[]` would make an outage look like curation.
3. **The embedded provider is FIRST in the registry.** Order does not decide installs (no two
   providers claim each other's scheme) — it decides the picker's row order, and the first card
   should be the one that draws with no network.
4. **No `fileCount` on a picker row**, though the platform sends one. Rows reach the screen as
   `TemplateItem`, which the *embedded* provider also fills and which has no such field; an optional
   field only one of two sources can populate is T2's rejected `installable` in mirror image.
   Widening `TemplateItem` is the honest way to add it, and that is T4's business.
5. **The selected card is marked in TEXT** (`✓ Selected`) as well as in colour. Measured: the border
   carries the state at **4.46:1 dark / 3.61:1 light** between selected and unselected, and the fill
   alone would be **1.16:1 / 1.11:1** — which is FB-002's shipped defect exactly.
6. **`TemplateStepBody` is split out of `TemplateStep`** so the plain-Node runner can evaluate it —
   `views/Community.tsx`'s precedent. The three states (loading / empty / rows) are **rendered and
   read**, not grepped.

### ⚠️ What T3 deliberately does NOT include

- 🔴 **No curated template content, so the community half has never installed a REAL template.** The
  shelf is still empty and the platform is still undeployed. ✅ **Narrowed this session**:
  `tests-unit/fb-005/template-install-over-http.test.ts` drives the provider through a real
  `http.Server` and a real `CommunityApiClient` onto a real temporary directory — so the wire and
  the disk are no longer stubbed, and the traversal refusal is proved to leave nothing behind on an
  actual filesystem. ⚠️ **What is still a claim rather than a measurement is the ENVELOPE**: that
  server answers the shape `nodegx-community` is believed to produce. The platform's own four route
  gates drive the real handlers with seeded rows; **no gate in either repo covers the two meeting.** **The drive exercised the embedded provider end to end** —
  picker → Review → Create → a project that opens and renders — and it exercised the *community*
  provider's failure path for real, against a live 404.
- **No editor "Templates" tab.** The launcher has shipped one saying *"coming soon"* the whole
  time (`noodl-core-ui/.../Launcher/views/Templates.tsx`). ✅ **Phase 76, opened 2026-08-26 in a
  parallel session, owns it** — *"add the first template to the templates tab"*. 🔴 **T3's plumbing
  is what it should draw with**: `useProjectTemplates(enabled)` for the rows,
  `templateRegistry.listing({})` for rows-plus-failures (never `list()`, which hides an outage as
  an empty shelf), and `TemplateStepBody` — deliberately hook-free so a plain-Node runner can
  evaluate it. ⚠️ **T3 touched neither `Templates.tsx` nor `LauncherHeader.tsx`**, so the only file
  the two phases share is `ProjectsPage.tsx`, where T3's edit is five lines.

### 🔴 The second finding: a mutant survived, and the defect was in the SPEC

The AC2 precondition — *"`directoryExists` is asked before `makeDirectory`"* — was asserted as
`order.indexOf('directoryExists') < order.indexOf('makeDirectory')`. A mutant that **deleted the
`directoryExists` call outright** left it out of the array, `indexOf` returned **-1**, and
**`-1 < 0` is true**. The spec passed on code that never asked the question — the one thing it
exists to detect.

✅ Fixed by asserting `toContain` for **both** entries first. 🔴 **The general rule**: an `indexOf`
comparison is an ordering test only once both operands are known present; until then it is a
presence test that silently answers *yes* to absence.

⚠️ **And the reason it survived this session rather than shipping**: an earlier 10-mutant run had
this same spec down as killed, because that mutant **moved** the call instead of **removing** it.
**A weaker mutant made a broken instrument look sound** — which is the failure the mutant set exists
to prevent, one level up.

### Gates, session 43

- `tests-unit/fb-005/` — **107 specs, 0 failures** across three files (T1's 27 unchanged, plus T3's
  74 and a 6-spec integration file driven over a **real socket onto a real disk**).
- 🔴 **`npm run test:ci` — `Jasmine: 2856 specs, 4 failures`, all four `AIX-006 style vocabulary`,
  by name. The clean floor.** The count reconciles exactly: **2849 + 7**, this session's seven added
  jasmine specs. ⚠️ ~25 minutes, not the ~11 older notes quote. `COMPOUND_EXIT=1` — which the clean
  floor also exits, so the summary line is the verdict.
- **13 mutants, 13 killed** (after the survivor above was fixed).
- `npm run test:main` — **342 files / 5592 specs / 0 failures** (s40: 341 / 5522 / 0). ⚠️ The new
  file accounts for the extra suite; the counts reconcile.
- 🔴 **`tests-unit/uni-001/session-readers.test.ts` caught the new session reader and refused it**
  until the question in its third column was answered. `PlatformTemplateProvider` is now a recorded
  reader with a structural assertion block: the token is used **once**, neither read is gated, the
  hook that decides what is drawn never sees a session, **and the picker still has a provider with
  no account and no network** — which is a stronger form of "withholds nothing" than any other row
  in that table can claim.
- `npm run tokens:css` — clean over **320** stylesheets (s37: 319; the new one is counted).
  ⚠️ It still cannot see a contrast failure — the selection ratios above were measured by hand.
- `npx tsc` — `typecheck:editor` **0 errors**; `typecheck:editor-tests` **0 errors** (it caught the
  three `WizardState` literals that needed the new field). `typecheck:core-ui` reports **44**
  errors, **all `TS2307` alias resolution, none ours** — pre-existing.

### Gate *trap* met this session

⚠️ **A jest suite that fails TO RUN reads as a smaller, passing suite.** A straight apostrophe
inside a single-quoted TS string in the new spec made ts-jest reject the file: the run reported
`2 total, 1 passed, 1 failed` and **`Tests: 27 passed, 27 total`** — a green-looking Tests line
over 56 specs that never executed. **Reconciling the count against the previous run** is what
caught it, not the exit code.

### Gates, session 42

- `tests/fb005-project-templates.test.ts` — **42 specs, 0 failures**.
- The four route gates, all green **with the new routes discovered from disk**:
  `nat006-api-contract` + `uni011-mirror-api` **38 passed**; `uni005-data-inventory` +
  `db-schema-drift` **83 passed**.
- `npx tsc --noEmit` — **0 errors**.
- **8 mutants, all killed**, each by the spec named beside it: `has_files` loses its `jsonb_exists`;
  `files_are_text` loses its `typeof` guard; `has_manifest` forgets the legacy spelling; the SQL
  vocabulary gains a value TS has not; the bundle forgets `published_at is not null`; a republish
  always decides visibility; `nonTextEntries` returns `[]`; a constraint loses its refusal code.
  ⚠️ **Measured with `-t` filtered to the one spec, so "killed by its own spec" is established and
  "and by no other" is NOT** — the full file was green before and after, which is a weaker claim.
  Pristine copies were restored by `copyfile` and all three files `md5`-verified identical.
- `check:css` not run — no stylesheet changed. **No OpenNoodl gate was run or implicated**: the
  change is entirely in `nodegx-community`.

---

✅ **RESOLVED BY NOT INHERITING IT (s44).** The warning below stood: FB-014 measured the
platform's FTS helper ANDing bare terms, so a template search built on it would have been born
with the same bug. **T4 does not touch the platform.** The search is client-side over a shelf
already fetched whole, and it applies `searchThreads`' fix — OR the terms, let the ranking supply
precision — from the start. §4c measures the two arms side by side: **10/10 ORed, 5/10 ANDed.**

🔴 **The platform defect is untouched and still owned by nobody.** The day a web `/templates` page
or a server-side filter is built, it is born with it. That is queue item 3, unchanged.

---

## 4c. ✅ T4, closed 2026-08-26 (session 44) — categories, a search that answers a sentence, and a card that had been drawing a machine slug at a person

**What shipped**, all in OpenNoodl:

- **`ProjectCreationWizard/steps/templateFilter.ts`** — the whole of T4's logic, pure and
  exported. `filterTemplates(items, filter)` returns **the rows and the pills from one pass over
  one predicate**, which is `facets.ts`' rule imported wholesale: *"a facet count comes from a
  `group by` and the list comes from a `where`; two producers of one number is exactly where they
  drift."* A pill's `count` is `matches()` re-run over the filter that pill's own click would
  produce — the text query held, the category dimension swapped.
- **`TEMPLATE_CATEGORY_LABELS` + `categoryLabel()`** — `starter` → *Starter*, `data-app` →
  *Data app*, with an unknown slug falling through to itself (`ORIGIN_LABELS`' rule).
- **The filter bar in `TemplateStepBody`** — a search box and a pill row, **still hook-free**, with
  `filter`/`onFilterChange` **optional** so T3's three-argument call site keeps working.
- **A fourth screen.** *"There are no templates"* and *"nothing here matches what you typed"* are
  now different sentences with different remedies, told apart by `isFilterActive` rather than by
  the row count.
- **`tests-unit/fb-005/template-search.test.ts`** — 43 specs, including the AC4 measurement.

### 🔴 The finding the ruling left behind: the card was drawing `starter` at a person

The category vocabulary was ruled to the platform's on 2026-08-26 — right for a CHECK constraint,
and **nothing turned the slugs back into words on the way to a screen**. `TemplateCard-tag`
rendered `{item.category}` verbatim, so from that ruling until this session the picker drew the
literal string `starter`, and would have drawn `data-app`. It is the ruling's cost, paid at the
one surface the ruling was made *for*, and T3's own spec had **asserted the slug was drawn** —
a spec written against the defect, in good faith, one session earlier.

✅ Both directions now: the label is drawn **and** the slug is not. A `toContain('Data app')`
alone stays green if both are rendered side by side.

### 🔴 The second finding: three of Richard's eight templates have no honest category

`0020`'s vocabulary — `starter`, `data-app`, `dashboard`, `site`, `form`, `integration` — was
written before the 0.2.1 template roster existed. Run the roster through it (phase 76 README §1:
site builder → personal landing page → pixel game; then storefront, membership hub, data
dashboard, interactive fiction, shared pixel canvas) and **`pixel-game`, `interactive-fiction` and
`shared-canvas` are none of the six.** The CHECK constraint forces them into `starter`, and a pill
labelled **Starter** holding a game, a story engine and a shared canvas is not a filter, it is a
bin.

⚠️ **Not fixed here — it is a platform migration plus a ruling, both Richard's.** Recorded as an
executable note in `template-search.test.ts` §2, which goes red the day the vocabulary grows.

### 🔴 The third finding: a mutant survived, and again the defect was in the SPEC

Same shape as T3's `indexOf`, one layer over. A spec named *"answering every term outranks
answering one of them"* asserted that `personal landing page` puts Personal Landing Page first.
A mutant **deleting the `matchedAll` clause from the sort survived it** — because for that query
the intended row also wins on raw score. The spec was green for a mechanism it never touched.

✅ Fixed with a query built so the two mechanisms **disagree**: `site bio` scores Site Builder and
Personal Landing Page at **exactly 3 each** (`site` is one's title at weight 3 and the other's
category at weight 2; `bio` is only the second's summary at weight 1), so score cannot separate
them and shelf order would put the wrong one first. Only `matchedAll` puts the row that answered
the whole query on top. The mutant is killed by it.

🔴 **The general rule, restated**: a spec that passes is not a spec that grades the thing in its
name. Both survivors this phase were found by mutating the mechanism the name claimed.

### ✅ AC4: the measurement, and what it is worth

`recall — ORed terms (shipped): 10/10; ANDed terms (control): 5/10; rank-1: 10/10`

Ten queries typed as sentences, over a ten-row corpus built from Richard's own roster.

🔴 **The absolute figure is worth nothing and the DIFFERENCE is the measurement.** One author
wrote both the corpus and the queries, and an author who wants 100% recall gets it by writing the
summaries to match. So the identical corpus and the identical queries are run through a
**known-broken arm** — every term must match, which is what `websearch_to_tsquery` does to a bare
sentence — and it retrieves **half**. The five it loses are exactly the multi-word ones
(*"a website my client can edit themselves"*, *"how do I let people sign up and log in"*), and it
keeps the ones that were already keywords, which is why the defect survived so long elsewhere.
**Two arms that agreed would have measured nothing.**

⚠️ **Honest scope: this grades the MATCHER, not the shelf.** The published shelf holds **one row**,
because the platform half is undeployed. When there are real rows, re-run §4 over them — 52 green
specs over fixtures once shipped two defects that one pass over the real corpus found.

**The old-vocabulary control** (FB-014's shape): `hello-world`'s category was the prose string
*"Getting Started"* until 2026-08-26. Searching `getting started` no longer reaches a row through
its category — proved by a `starter` row whose text never says "start" (`pixel-game`) **not** being
returned — while `hello-world`, whose summary says *"to start from nothing"*, still is. 🔴 The
second half is load-bearing: **a control that returns nothing proves nothing**, and without it the
first assertion is satisfied by a search that is simply broken.

### Decisions taken inside T4, each reversible and each stated

1. **The filtering is IN MEMORY, in the client, over rows already fetched whole.** `facets.ts`'
   choice and `facets.ts`' stated limit: the shelf is curated and small by construction, and the
   day it is thousands of rows this becomes a `where` and a `group by` on the platform.
2. 🔴 **NO server-side `?q=`/`?category=` was added, and the omission is the point.** FB-005 exists
   because four providers were registered, typechecked and reached by nobody. A filter on
   `listProjectTemplates` with no caller would be that finding committed again, in the same task
   that was opened to clean it up. It goes in the day a caller exists — the web `/templates` page,
   or a shelf too large to send whole.
3. **Terms are ORed and the ranking supplies precision** — `searchThreads`' trade, client-side.
   ANDing five words against a twelve-word summary matches nothing, ever.
4. **Pills come from the rows PRESENT, not from the vocabulary.** A pill promising zero is a dead
   click; an unknown category still gets one, or a platform row with a new category is reachable
   only by not filtering at all. ⚠️ The **active** pill survives a zero count — it is the only way
   back out of the state the person is looking at.
5. **The filter is local `useState` in `TemplateStep`, not a `WizardState` field.** The wizard's
   state is the answers the creation is built from; a search box is how somebody looked for one.
   Putting it in `WizardState` would carry it into `ReviewStep`'s props and every literal.
6. **`onFilterChange` optional.** Phase 76's SB-007 names `TemplateStepBody` as a piece to reuse;
   a required prop here would have broken that call site before it was written.
7. **No `fileCount` on a card.** T3 flagged it as "T4's business" — but a size is not a way to
   narrow a shelf, and widening `TemplateItem` on both providers is its own change.

### The drive — what the running app showed

✅ Full path driven: `New project` → *Start from a Template* → basics → picker. All four screens
**observed live**, not inferred:

- The bar renders: `Search templates`, `All (1) ✓`, `Starter (1)` — **labels, not slugs**, and the
  card's tag reads **Starter**.
- Typing `dashboard` → the `Starter` pill **disappears** (count 0, not active), `All (0) ✓`
  survives, and the screen says *"No templates match that search. Clear filters"* — **not** the
  empty-shelf sentence. `Clear filters` restores box, pills and row.
- 🔴 **A ten-word sentence of which only one term appears in the document still finds it**:
  *"I want a blank app to start a dashboard from"* returns Hello World. An AND matcher returns
  zero. That is AC4's claim, observed in the product rather than in a fixture.
- Selecting the card and then filtering it out draws *"The template you chose is not in this list.
  It is still selected. Show it"* — beside, not instead of, the community-outage notice.
- Clicking `Starter (1)` moves the ✓ and `aria-pressed` onto it and off `All`.

### Contrast, measured live in BOTH themes

| pair | dark | light | verdict |
|---|---|---|---|
| **active pill BORDER vs panel** | **4.80:1** | **4.14:1** | ✅ the state, carried properly |
| active pill text vs its own fill | 8.46:1 | 6.14:1 | ✅ |
| inactive pill text vs its own fill | 9.82:1 | 6.80:1 | ✅ |
| search field text vs field | 9.82:1 | 6.80:1 | ✅ |
| **active pill FILL vs panel** | **1.16:1** | **1.11:1** | 🔴 which is why nothing depends on it |

🔴 **That last row is FB-002's shipped defect, reproduced exactly** — and it is the measurement
that justifies the design rather than a claim about it. Had the active state been a background
colour, this surface would have shipped the same invisible selection the people directory has. It
is on the **border** and in the **text** (`✓`), so neither ratio can take it away.

⚠️ **A pre-existing finding fell out of the same pass, and it is NOT T4's**:
`--theme-color-border-default` measures **1.07:1 dark / 1.15:1 light** against the panel, and the
card's background is **identical** to the panel (1.00:1). So an **unselected `TemplateCard` — T3's,
shipped — has an effectively invisible boundary**, as does an inactive pill. WCAG 1.4.11 wants
3:1 for a control's boundary. The fix is a design-token decision, not a T4 edit, and changing the
token touches every surface in the editor. **Richard's.**

### ⚠️ What T4 deliberately does NOT include

- **No web `/templates` page.** Still unowned, and still the surface Richard's original ask most
  obviously describes. T4 narrows the shelf **in the editor**, which is the only place the shelf
  is drawn today.
- **No launcher "Templates" tab.** Phase 76's, unchanged — and T4 touched neither `Templates.tsx`
  nor `LauncherHeader.tsx`. ⚠️ **It is still inert as of this commit.**
- 🔴 **No fix for the queue-item-3 defect on the platform.** It did not need one: the AND-ing lives
  in `websearch_to_tsquery`, and T4's search never reaches the platform. **The defect is untouched
  and still owned by nobody** — the day a `/templates` page or a server-side filter is built, it is
  born with it.

### Gates, session 44

- `tests-unit/fb-005/` — **150 specs, 0 failures** across four files. Reconciles exactly:
  **107 at HEAD + 43 new**, and the 107 was verified by counting `git show HEAD:` rather than
  trusting a note. ⚠️ The **NEXT-SESSION-PROMPT for s43 said 97** and the scope file said 107; the
  scope file was right.
- `npm run test:main` — **344 files / 5649 specs / 0 failures**. ⚠️ **Only +1 file / +43 specs is
  mine**; the rest of the delta against s43's 342/5592 is two peer commits (SB-001, SB-002) that
  landed mid-session.
- **14 mutants, 14 killed** — after the one above survived and its spec was rebuilt. Run with `-t`
  filtered to the single spec, so *"killed by its own spec"* is measured and *"and by no other"* is
  **not**. Pristine copies restored by `copyfile`, both files `md5`-verified identical afterwards.
- `typecheck:editor` **0**; `typecheck:editor-tests` **0**; `typecheck:core-ui` **44, all `TS2307`
  alias resolution, none ours** — unchanged from s43.
- `npm run tokens:css` — clean over **320** stylesheets. ⚠️ Blind to every ratio in the table above.
- 🔴 **`npm run test:ci` — `Jasmine: 2856 specs, 4 failures`, ALL FOUR `AIX-006 style vocabulary`,
  by name. The clean floor.** ⚠️ **2856 is s43's count unchanged**, which is the right answer: T4
  added **no** jasmine spec, and no jasmine spec reads a template category or renders `TemplateStep`
  (checked by grep both ways). ~26 minutes. The summary line is the verdict, never `$?`.

---

## 4d. ✅ T5, session 45 — the queue, built and specced. **The button is §4e, session 46.**

**Read the state honestly before anything else: AC5 is met and measured, and "Share as template"
is not yet a thing a person can click.** Everything a share needs exists and is graded — the
table, the route, the capability, the promotion caller, the editor-side collector and the client
method. What is missing is the dialog and the menu entry that call `shareAsTemplate`. 🔴 **That is
this phase's own "build the caller" finding, left open deliberately rather than closed badly**: a
five-field dialog written blind and never driven would be the *appearance* of a caller, and the
one thing worse than an unreachable mechanism is one that looks reachable.

**What shipped in `nodegx-community`:**

- **`0021_fb005_template_submissions.sql`** — `project_template_submissions`, a **separate table**,
  because `0020`'s header said it would be: *"so that 'submitted' and 'published' cannot be one
  column somebody flips by accident."* It has the `submitter_account_id` that `project_templates`
  deliberately refuses to have, and R-templates' enforcement survives intact — the write route
  reaches this table and nothing it calls can reach the shelf.
- **`src/lib/templatesubmissions.ts`** — submit, list-your-own, the reviewer's queue, the bundle a
  reviewer reads, promote, decline, withdraw. Path safety **imported** from `tutorialbundles.ts`,
  third caller.
- **`POST`/`GET /api/v1/community/templates/submissions`** — `submitTemplate` is a **checked**
  write capability, so an org-owned minor reads `notFound()`, and `d15-visibility.test.ts`
  quantifies over the list so it was governed the day it was added.
- **`scripts/promote-template-submission.ts`** — `list`, `show`, `promote`, `decline`. The half a
  queue is useless without.

**What shipped in OpenNoodl:**

- **`models/template/shareAsTemplate.ts`** — the seam, behind two narrow host interfaces so plain
  Node jest can drive it. `createFromTemplate.ts`'s arrangement, in the opposite direction.
- **`CommunityApiClient.submitTemplate` / `.submissions`** — named for what they do. There is
  deliberately **no `publishTemplate`**, and a spec asserts its absence.

### 🔴 The finding that matters most: a share would have uploaded `.mcp.json`

`readBundleDirectory` on the platform says of itself *"skips nothing silently"*, which is right for
a publisher pointed at a prepared directory. **"Share as template" points at the project somebody is
working in right now.** The editor writes `.mcp.json` into every project it creates or opens, that
file holds **absolute paths into the author's home directory and into their install of NodeGX**, and
`agentConfig.ts` already adds it to the project's own `.gitignore` with the reason written out — a
committed one *"arrives on a colleague's laptop as a registration that points at nothing."*

A template is that failure **with an audience**: uploaded to a public shelf and written onto the
disk of everybody who installs it. `NEVER_SHARED` withholds it, along with `.git/`, `.nodegx/`,
`node_modules/`, `.env*` and `.DS_Store`, and ⚠️ **every exclusion is REPORTED rather than dropped
silently** — a hazard list is a hypothesis, so a person must be able to see what stayed behind.

### 🔴 The second finding: the alphabetical constraint-order defect, reproduced in `0021`

`0020` found it and wrote it down: postgres evaluates a table's CHECK constraints **in constraint-
NAME order**, so the rule that fires first is not the rule the caller broke. **It happened again,
in the new table, in this session** — `..._review_timestamp` sorts before `..._status_known`, and
written symmetrically the timestamp rule refuses an unknown status too. Somebody who typed
`'approved'` was told their review **timestamp** was wrong: a true statement about a rule they had
not broken.

✅ Fixed with `0020`'s guard in a different costume — phrase the rule so an unknown status falls
through to the constraint that owns it. 🔴 **An assertion that the insert merely THREW would have
been green on it.** It was caught because the spec asserts `err.constraint` by name, which is
TUT-004's rule and now has three instances in this one family.

⚠️ **And a third, on the spec itself**: the control for that fix — an `accepted` row with no
timestamp — first reported `..._published_link`, which sorts earlier still. A row must be valid in
every other respect or it measures the wrong constraint.

### Decisions taken inside T5, each reversible and each stated

1. 🔴 **A licence is a REQUIRED field of the act**, not a checkbox in one client's UI, so a second
   client cannot skip it. §5's *"the licence question returns the moment T5 lands"* is answered
   rather than parked. ⚠️ **Not a boolean** — `0020` decision 4's argument against an always-true
   field applies exactly. `MIT`, `Apache-2.0`, `CC0-1.0`, `other`, where **`other` means *"I wrote
   this and I will agree terms with you"*** — a real answer, better recorded than coerced into MIT
   by a form with no honest option. **The vocabulary is Richard's to change; it is one migration.**
2. **Promotion is a SCRIPT, not an admin route.** AC5 says *"until Richard promotes it"*, and the
   cheapest honest reading is that promotion needs a **database credential**. An admin route needs
   an authorisation model nobody has decided.
3. 🔴 **Promotion refuses a slug already on the shelf** unless told to replace. `publishProjectTemplate`
   **upserts**, so the obvious implementation would let a stranger overwrite a live template by
   proposing its name — and the shelf would look unchanged in the list. Both arms specced.
4. **The submitter can read their own queue**, and a decline **cannot be recorded without a reason**
   (a biconditional CHECK). D8 ruled moderation reactive because *"an approval queue only one person
   can clear is a bottleneck"*; a template is code that runs on somebody else's machine rather than
   speech, so T5 builds the queue anyway — and the obligation that comes with it is that the
   bottleneck is **visible from the side that suffers it**.
5. **The route's byte cap is 8 MiB, not `MAX_WRITE_BYTES`.** The wrapper's 64 KiB default was
   derived from an RFP response message; a project is not a message, and a real template would have
   been refused with a 413 naming a number nobody could derive from the product. ⚠️ The two caps do
   **not measure the same quantity** — `pg_column_size` is compressed storage, this is JSON bytes on
   the wire — so matching the numbers is a stated approximation, not a shared constant.

### Gates, session 45

- `tests/fb005-template-submissions.test.ts` — **35 specs, 0 failures**, against a private database
  (`nodegx_community_fb005t5`) because `resetSchema` is destructive and peers share the instance.
- `tests/fb005-project-templates.test.ts` — **42, unchanged**, re-run after `0021` to prove the new
  migration applies cleanly and changed nothing on the shelf.
- `tests-unit/fb-005/template-submission.test.ts` — **20 specs, 0 failures**; the `fb-005`
  directory totals **170** across five files.
  🔴 **MEASURED, AND IT CORRECTS A FIGURE THIS SESSION ITSELF PUBLISHED EARLIER AS 21.**
- **9 mutants, 9 killed.** ⚠️ One SURVIVED first: adding a fourth entry to `MANIFESTS` was invisible
  to every assertion, because the accept/reject decision cannot see it (a files map is keyed by
  **files**, so it never holds a bare `components` key) — but `looked` is **user-facing text** and
  nothing graded it. The finding was the unasserted field, not the mutant.
- `typecheck:editor` **0**; `typecheck:editor-tests` **0**; platform `tsc --noEmit` **0**.
- `npm run test:main` — **345 files / 5670 specs / 0 failures**; **+1 file, and 20 specs of it
  are mine (counted, not inferred)**. ⚠️ s44's note recorded **5649**, which would make the
  delta 21. `git log fe9bade4..HEAD -- packages/noodl-editor` shows **only this session's
  commit** touched editor sources or tests, so the prior tree held **5650** and the inherited
  figure was one short. **The s43 97-vs-107 discrepancy, recurring.** Reconcile a count against
  the source, never against a note — including a note written this session.
- **Full platform suite — 61 files / 1508 tests / 0 failures.** ✅ +8 against the first pass's
  1500, which is exactly the four licence and four notification specs — reconciled, not assumed.

### 🔴 The third finding, and it is the most reusable: a new table and a new route owe THREE repo sweeps

**`fb005-template-submissions.test.ts` was 35/35 green while three repo-wide sweeps were red.** A
new artefact in `nodegx-community` must also be registered in:

| sweep | what it demands |
|---|---|
| `db-schema-drift` | the table declared in the **Drizzle mirror** (`src/db/schema.ts`) |
| `uni005-data-inventory` | every free-text column **classified** — and a `minor-refused` row needs an **executed probe**, not a classification |
| `uni011-mirror-api` | a **D15 verdict recipe** for every route on disk |

✅ **AC6 named the census explicitly and I still missed it.** The lesson is not "read the AC" — it
is **run the whole suite, not the file you wrote**. A green new spec beside three red sweeps is the
exact shape of work that looks finished.

🔴 **And the probe is the sharpest of the three.** `uni005` does not accept a classification; it
demands the claim be **executed**. ⚠️ Mine is **the only probe in that file whose mechanism is CODE
rather than a constraint** — the database would happily accept a pupil's submission row, because
nothing in `0021` mentions `accounts.kind` and adding such a constraint would be inventing a rule
D15 already expresses. So it drives **the real route**, with a **`read_only`** minor (an `off` one
is refused by `communityGate` *before* the capability is consulted, which would measure a different
gate), and asserts **nothing was stored** as well as the 404.

⚠️ **`review_note` is `platform-content`, not `minor-refused`** — it is written by a reviewer
through a script and reachable from no route at all. The class is about who *can* write, and the
honest answer there is nobody holding a session token.

### ✅ T5 second pass — two rulings from Richard, and a defect the first pass shipped

🔴 **THE LICENCE DIED AT PROMOTION, AND NO SPEC NOTICED.** `0021` made a submitter attest a
licence, required it, checked it against a vocabulary and stored it — and `project_templates` had
nowhere to put it, so `promoteTemplateSubmission` dropped it between the two tables. A third-party
template reached the public shelf with **no discoverable terms at all**: P69's defect with an extra
step in front of it, the question asked, answered, recorded and then binned.

⚠️ **It was found by being asked what the vocabulary should be, not by a test.** Every spec passed —
the submission stored the licence, the promotion published the template, and nothing asserted that
the second still knew what the first had been told. 🔴 **A field is not carried just because both
ends of the wire have one.**

`0022` fixes it: `project_templates.attested_licence`, carried by `publishProjectTemplate` and
supplied only by `promoteTemplateSubmission` — and surfaced on **all three readers**, the bundle
most of all, because that is the moment the files land on somebody's disk and become theirs to ship.

- 🔴 **`null` MEANS "PUBLISHED BY US", not "unknown".** The curated batch has no third party to
  attest anything, and R-templates' ruling is that we assert the licence for what we wrote. So
  `attested_licence is not null` is exactly the predicate for *"this came from outside"* — more
  useful than a boolean, and the reason the column is nullable rather than backfilled with a name
  somebody else's column was for.
- ⚠️ **A republish TAKES the new licence where it leaves visibility alone.** The asymmetry is
  deliberate: visibility is a decision about the shelf a republish must not silently reverse; the
  licence is a fact about the **payload**, and a republish replaces the payload. Keeping the old
  licence beside new files is the worst of both.

**Ruling 1 — the vocabulary, 2026-08-26: `CC0-1.0`, `MIT`, `other`.** `Apache-2.0` dropped. The
argument decides what may be added later: **a template is not a library.** Nobody depends on one;
it is copied and becomes the installer's own code, so the test is *"can somebody build a business
on this without reading anything?"* Apache-2.0's patent grant and NOTICE obligations are library
machinery nobody honours on a starter project, and an unhonoured obligation on a public shelf is
worse than one never offered. 🔴 **Copyleft is excluded on purpose and must stay excluded** — a GPL
template would place its terms on the app somebody builds from it, inverting the shelf's promise.
That is why the vocabulary is **closed** rather than free text.

**Ruling 2 — Richard owns the queue (`richardosborne14`), and is now told.** §5.2's question is
answered. 🔴 **A named owner who is never told and a black hole are the same thing in practice**, so
`0022` adds a `template_submitted` notification carrying what arrived, how big, under what terms,
and the exact command that reads it.

- ⚠️ **It cannot fail the submission.** A person who successfully shared their project must not be
  told it failed because our mail configuration is wrong. 🔴 **This is T1's finding available again
  immediately, in the other direction** — there, a failed agent config destroyed a correctly
  installed project because it was awaited in the same unguarded run.
- 🔴 **The cost is stated rather than hidden**: a swallowed failure means a submission nobody hears
  about. `promote-template-submission.ts list` stays the source of truth, and a spec asserts the
  queue is readable with no notification sent.
- ⚠️ **A constant, not an env var.** An unset env var makes the notification silently do nothing —
  the black hole this closes. A wrong constant is greppable.
- ⚠️ **Its own `template_submission_id` column, never a reuse of `submission_id`** (which means an
  *assignment* submission): sharing one would let the biconditional pass while the foreign key
  pointed into the wrong table.
- ⚠️ **The enums are renamed and re-created, not extended** — `0008` measured that
  `alter type … add value` followed by a use in the same transaction is refused, and `migrate.ts`
  runs each file in one.

⚠️ **Two more sweep registrations were owed and caught**: `project_template_licence_known` had no
refusal code (the T2 sweep), and three editor fixtures had to gain the new field —
`typecheck:editor` passed while `typecheck:editor-tests` would have caught it, which is the gate to
run after changing a shared type.

### ⚠️ What T5 deliberately does NOT include

- 🔴 **The UI.** See the top of this section. The seam is built and graded; the dialog and the menu
  entry are not, and **nothing in the product files a submission today.**
- **No admin surface.** `listPendingTemplateSubmissions` has no route — a page listing strangers'
  unpublished projects needs visibility rules got right before it has a user.
- **No total cap on pending rows per account.** The partial unique index stops the same person
  filing the same slug twice; a distinct slug each time is one character apart. At 8 MiB a row that
  is a storage cost, bounded only by the rate limit. **Recorded as a gap, not fixed.**

## 4e. ✅ T5's second half, session 46 — **the button exists, and driving it found FIVE defects**

**AC5 is now met by something a person can click.** The kebab on every launcher project card
carries *"Share as template…"*, it opens a five-field dialog, and the dialog files a submission
through the seam session 45 built. 🔴 **Every one of the five defects below was invisible to the
fb-005 specs and visible within minutes of driving the real app** — which is the whole of why
the previous session left this open rather than closing it badly.

**What shipped in OpenNoodl:**

- **`models/template/shareTemplateForm.ts`** — the decisions: the opening draft, what may be sent,
  and the sentence for every arm of `ShareAsTemplateOutcome`. Pure, and graded by 49 specs.
- **`pages/ProjectsPage/useShareTemplate.ts`** — the caller: a session token, the real filesystem,
  and the fact that a share reads a directory belonging to a project row.
- **`noodl-core-ui/.../ShareTemplateModal`** — markup and `onChange`, and nothing else.
- **`Projects.tsx` / `Launcher.tsx` / `LauncherContext.tsx`** — the kebab entry and the plumbing.

🔴 **The split is forced rather than chosen.** The dialog draws `Modal`, `TextInput` and `TextArea`,
all of which reach `common/Icon`, and `Icon.tsx` uses webpack's `require.context`, which ts-jest
rejects at type-check time. **A rule written in the dialog is a rule no spec in this repository can
load** — so every rule lives in `shareTemplateForm.ts`, and the dialog is verified by being driven.

### 🔴 Defect 1: a `Select` inside a `Modal` closes the `Modal`. The form could not be completed.

Picking a category **closed the whole dialog**, reproducibly. Measured cause: `Select` renders its
options through `BaseDialog` into `dialog-layer-portal-target` — a portal **outside** the modal's
DOM subtree. `BaseDialog` dismisses when a gesture starts and ends outside `visibleDialogRef`
(`isOutsideDialog`), and an option in that portal is outside it by that test.

⚠️ **This dialog is the FIRST `Modal` in the editor to contain a `Select`** — swept, one hit, and it
is mine. The combination had no instance, so nothing was broken until there was one.
🔴 **The underlying defect is `BaseDialog`'s and is NOT fixed here**: `isOutsideDialog` is the
dismissal rule of every dialog in the editor, and changing it is a change to all of them. **Recorded
as unowned.** The dialog instead draws both vocabularies inline, which it should have done anyway.

### 🔴 Defect 2: a radio `name` is document-global, so `BaseDialog`'s double render put TWELVE radios in ONE group

Replacing the `Select`s with native radios produced a second, stranger failure: a pick appeared to
take and then flapped back. **Measured: 12 inputs under one `name`** — six from the visible copy and
six from the hidden `MeasuringContainer` copy, each unchecking its twin while React's controlled
`checked` fought the browser's group behaviour.

⚠️ **This is the recorded `BaseDialog`-renders-everything-twice trap in a place the recorded form
does not cover.** The known statement is about *querying* the DOM — filter out `MeasuringContainer`.
This is about a **browser-global namespace**: `name` is document-scoped, so the ghost copy is not
merely an extra node to skip, it is a **participant**. 🔴 **A `name` derived from a prop cannot fix
it** — both copies get the same props, which is the point of the measuring copy. `useId` can,
because the two copies are two component instances at different positions in the tree.

### 🔴 Defect 3: `.DS_Store` was withheld only at the project ROOT, and the symptom was not a leak

`NEVER_SHARED` matched a non-directory rule by **exact project-relative path**. That is right for
`.mcp.json`, which only ever exists at the root, and wrong for `.DS_Store`, which Finder writes into
**every directory it opens**. Walking 25 real projects found **seven** nested ones
(`components/.DS_Store`, `components/Pages/.DS_Store`) that the rule could not see.

⚠️ **And the visible symptom was the opposite of the obvious one.** A `.DS_Store` is binary, so each
one landed in `binaries` and **refused the whole share** — a project that could not be shared, with
a message naming a file its author had never heard of. 🔴 **Every one of the 20 existing specs was
green through it, because every fixture put `.DS_Store` at the root.** Fixed with a `basename` rule,
two mutants killed, and the control asserts the exact-path rule stayed exact.

### 🔴 Defect 4, and the one with a ruling attached: 11 of 25 real projects CANNOT BE SHARED

Running the collector over the 25 real projects on this machine — the *corpus that exists*, not
fixtures — measured the verdict each would get:

| verdict | count |
|---|---|
| **OK** | 13 |
| **binaries — refused** | **11** |
| no-manifest (a backup folder, correctly refused) | 1 |

🔴 **Not one was too big.** The blocker is the text-only transport, and **42 of the 46 blocking files
are `.ttf`/`.woff2` inside `noodl_modules/`** — the editor's own kit modules (`inter`,
`lucide-icons`). Only 4 are `.png`. So the button, as first built, refuses **44% of real projects**
with a sentence about images, for a folder full of fonts the author never chose.

⚠️ **`.DS_Store` accounted for 7 of the original 58 and fixing it changed the tally by zero** — the
same projects also carry fonts. A true fix that moves no number is worth saying out loud.

### ✅ The ruling, and why it is not "drop the awkward folder": **exclude only what the editor puts back**

**Richard, 2026-08-26, on being shown the 44%:** *"in theory exclude modules, but like node modules,
there should be an easy way to do an equivalent of npm install to install the missing modules, with
the user being asked to approve any that are 'community' modules or whatever. Don't leave people
with a half working template."*

🔴 **The restore he asked for already exists for the case that matters, and already runs.**
`createProjectFromTemplate` calls `installStarterAssets` **after** `installTemplate`, and
`installStarterAssets` never overwrites — its own comment says why: *"a template that ships its own
font or icon set keeps it"*. `inter` and `lucide-icons` are **bundled inside the editor**
(`src/assets/starter-project/`, plus the editor's own Inter), not downloaded. So a template with no
`noodl_modules/inter` is written to disk and then given one, **byte for byte, with no network and
nothing for the installer to approve.** Nothing is half-working, and no approval flow is owed for
these two because they are not community content — they are NodeGX's own files.

**So `RESTORED_ON_INSTALL` is DERIVED FROM `STARTER_ASSETS`**, not written out beside it. The rule
that governs it is stated on the constant and is the whole of why the exclusion is legitimate:
🔴 **a module may go on that list ONLY IF THE EDITOR CAN PUT IT BACK.**

| | shareable | refused |
|---|---|---|
| before | 13 / 25 | **11** (42 of 46 files were starter-module fonts) |
| after | **19 / 25** | 5 |

⚠️ **The remaining five are refused correctly** and the residue is the author's own content:
`fonts/Roboto/*.ttf` dropped into a project by hand, and real `assets/*.png`. Nothing can restore
those, so a text-only transport must refuse them rather than ship a template missing a third of
itself. **That is the transport's limit, and it is the next task, not this one.**

### 🔴 What is still owed, and it is Richard's ask minus the half that was free

- **A restore for a module that is NOT a starter asset.** There is no record to restore from:
  `kit-provenance.json` has **no `builtin`/`starter` arm** and is not written for starter assets at
  all; `inter` is not a library entry, so it cannot be installed through the library browser;
  `listNodeKits` filters on a manifest with a `main`, which neither starter module has, so **they
  never appear in the Kits panel**. And **nothing in the product detects a missing module** — the
  scanner reports what is there, never what should be.
- **The approval step for community modules.** Owed the moment the first non-starter module is
  excluded, which this change deliberately does not do.
- **`.cache/cached-thumb.png` was checked and is NOT ours** — no editor code writes a project-level
  `.cache`. A fixture from another session's drive. Recorded because "looks like editor state" was
  the obvious wrong conclusion.

### 🔴 Defect 5, found by pressing the button: **the platform half of FB-005 IS NOT DEPLOYED**

The real send was driven end to end and came back `absent`. Probing `community.nodegx.io` directly:

| route | | |
|---|---|---|
| `/api/v1/community/threshold` | **200** | the control — the host is up and serving `/api/v1/community/*` |
| `/api/v1/community/templates` | **404** | T3's shelf, session 43 |
| `/api/v1/community/templates/submissions` | **404** | T5's queue, session 45 |

The editor's **authorised** request and an anonymous probe agree. 🔴 **Production predates FB-005 T3
entirely** — T3, T4 and T5's platform halves are committed and undeployed, so the picker's community
provider and the whole share path reach nothing in production today. ⚠️ *Deployed is not committed*, in
the direction that is easier to miss: everything is merged, every spec is green, and none of it is
live. **The curated shelf is empty because there is no shelf.**

⚠️ **And it improved a sentence.** `absent` used to read *"Sharing is not available on this
account"* — which blamed somebody's account for a deployment gap. `absent` now has **four** causes
(D15 refusing an account, a missing template, a draft, and a route that was never deployed) and the
client cannot tell them apart, so the sentence names them as possibilities instead of asserting one.
🔴 **A sentence that asserts a cause the code cannot know is worse than one that does not.**

### ✅ Defect 5 RESOLVED, session 48 — deployed, and the routes flipped

`ops/deploy.sh 49.12.102.195`, run from a **pristine `git clone` of `27be4d1`** rather than the
working checkout. That is [[deployed-is-not-committed]]'s prescribed method and it is not
ceremony: the script **rsyncs the working tree**, a peer session was committing to this machine
throughout, and the refusal's first-ever production catch was a peer's half-finished file. A clone
satisfies the clean-tree refusal *honestly* instead of silencing it with `--allow-dirty`, and it
makes the host's stamp true.

**What the deploy reported.** Live before: `acd4a9a` deployed **2026-08-24T17:40:43Z** — so the
gap was two days, and *the script prints this before it deploys*. ⚠️ **That line is a free answer
to "is this shipped?" and running a deploy is not the only way to get it.** Migrations: 19 already
applied, then `0020_fb005_project_templates`, `0021_fb005_template_submissions`,
`0022_fb005_licence_on_the_shelf` — the three FB-005 tables, all additive, applied **before** the
restart so the new code never served against the old schema. Service `active`, stamped
`✅ 27be4d19a10b on main` **dirty=false**, `community.nodegx.io` wired in Caddy's loaded config,
`https://community.nodegx.io/` **200**, sign-in start **302 → github.com**, capture hosting ✅,
off-site backup ok 17.6 h old. Neighbours **`200 → 200`** on all three — `nodegx.io`,
`nexus.digitalbricks.io`, `digitalbricks.io`. `EXIT=0`.

**The measurement that settles the defect**, re-running session 46's probe with its control:

| route | s46 | s48 | |
|---|---|---|---|
| `/api/v1/community/threshold` | 200 | **200** | the control — held |
| `/api/v1/community/templates` | **404** | **200** | T3's shelf |
| `/api/v1/community/templates/submissions` | **404** | **200** | T5's queue |
| `/api/v1/community/templates/does-not-exist` | — | **404** | 🆕 the **negative** control |

🔴 **The negative control is the row session 46's table did not have, and it is what makes the two
200s mean anything.** A catch-all handler answering 200 to every path under `/templates` would
produce exactly the middle two rows. A known-bad slug still 404ing is what excludes it. ⚠️ Generalise
it: **when an absence turns present, a positive control proves the host is up and only a negative
control proves the route is real.**

### ⚠️ A second probe that could not have answered its own question

The authorised `GET /templates/submissions` (Richard's real token) and an anonymous one **both**
returned `200 {"items":[]}`. Read carelessly that is a leak — the reviewer's queue answering
strangers. It is not: the route is documented as doing this deliberately (`if (!viewer) return []`,
with the `submitter_account_id` predicate inside `listMyTemplateSubmissions` rather than in the
route, and a 401 rejected on the grounds that it would confirm to a stranger that submissions
exist — the disclosure `communityGate` exists to avoid).

🔴 **But the probe could not have told the two apart, because the queue holds zero rows: the empty
set fits "correctly scoped" and "wide open" equally.** It was settled by reading the route, not by
the curl. The curl becomes evidence only once a submission exists and a *second* account asks —
which is exactly what AC5 already specifies, and why AC5 says *from a second account*.

### 🔴 What the deploy did NOT fix: the shelf is real and EMPTY

`/api/v1/community/templates` → `{"items":[],"page":{"limit":50,"offset":0,"total":0}}`.

*"The curated shelf is empty"* has stopped being a deployment fact and become a **content** one, and
the two want opposite work. `scripts/publish-project-template.ts` is the publisher and it takes a
database credential, so promoting is deliberately not something a client can do. **Which of
Richard's eight templates go up is his editorial call** — and §4c already measured that
**three of the eight have no honest category** (`pixel-game`, `interactive-fiction`,
`shared-canvas`), so publishing them is blocked behind the vocabulary gap rather than behind effort.

⚠️ **`nodegx-community`'s `origin/main` was ELEVEN commits behind local `main`** at deploy time —
every FB-005 platform commit, plus FB-001, FB-002, FB-003, FB-010, FB-011, FB-023 and FB-024,
exists only on this laptop. Not blocking and not deploy-related, but it is the same shape as the
finding that produced the stamp in the first place: **a fact that lives in exactly one place.**

## 4f. ✅ The binary transport, session 49 — **a template carries its own font, and a false positive went with it**

**Queue item 2**, taken because item 1 needs Richard. §4e ended by naming this as *"the transport's
limit, and it is the next task, not this one"*, and `0020`'s header had already written the exit
condition three sessions earlier: *"what it cannot carry is its own photography or brand font, and
that is the day this becomes base64 (⚠️ +33% against the cap) or E7's object store."*

### 🔴 The measurement first, because it decided the design and it moved a number

Run over **77 real projects** on this machine — every directory under `NodeGX test projects` and
`project-examples` that has a manifest — through the **real** `isNeverShared`, not a restatement of
it. ⚠️ **The denominator is not §4e's 25.** That corpus was the editor's recent-projects list, which
has changed since; this one is the disk. The two are not comparable and the figures below are not
a correction of that table.

| | count |
|---|---|
| projects with a manifest | **77** |
| still refused by the text-only transport (after `RESTORED_ON_INSTALL`) | **11** |
| refused for SIZE, before or after | **0** |
| **over the 8 MiB cap once every binary is base64'd** | **0** |

The blocking files were **19 `.ttf`** the author had dropped into `fonts/` (Roboto, Inter) and
**4 `.png`** under `assets/` — exactly the residue §4e predicted, and content nothing can restore.

🔴 **And the `+33%` `0020` warned about is not the problem it might have been.** With every binary
encoded, the **largest of the 77 projects comes to 1,445,478 bytes against a cap of 8,388,608** —
17% of the limit. ✅ **So the cap is untouched.** Raising a limit on the strength of a hypothesis is
how a limit stops meaning anything, and there is no project on this machine that needs it raised.

### The design, and the one alternative that had to be refused

**Two maps: `payload = { files, binaryFiles }`,** the second being path → base64.

🔴 **NOT a sentinel inside the value** (`"base64:iVBOR…"`), and the reason is not taste. `files`
holds a builder's **source code**, and a source file whose first line is `base64:` is a file a
person can write — a sentinel would let a text file **forge** a binary and arrive on a stranger's
disk as decoded rubbish. Two maps make the discriminant the **key set**, which no file's contents
can influence.

✅ **Inside `payload` rather than in a new column**, which bought two properties for free:
`promoteTemplateSubmission` copies `payload` onto the shelf unchanged, and `pg_column_size(payload)`
already counts the new bytes — so the 8 MiB cap and the route's matching wire cap both keep working
with no second number to hold in step.

⚠️ **`0020`'s `project_template_files_are_text` is untouched and still true.** That constraint is
what `stageBundleFiles` depends on — it calls `writeFile(path, contents)` with no branch for a
non-string. Weakening it to admit a tagged union would have made every existing reader responsible
for a case it has never seen. A client that never learns about `binaryFiles` behaves exactly as it
did.

### 🔴 The classifier got STRICTLY better, and it fixed a false positive nobody had noticed

The editor's walk used to read through `filesystem.readFile`, which decodes to UTF-16 before the
module sees anything — so it had to test for a NUL **or a U+FFFD**, the second tell being necessary
precisely *because* the decode had already happened.

It now reads `readBinaryFile` and asks the question directly: **encode the decoded string back and
compare the bytes.** ⚠️ **That retires a real false positive.** A source file that genuinely
contains U+FFFD — a Markdown note quoting a mojibake bug — round-trips perfectly, so it is text.
Under the old rule it was classified as a binary, and a binary **refused the entire share**.

⚠️ The same upgrade landed on the platform's `readBundleDirectory`, which had the opposite bug of
the same family: a latin-1 `.txt` or a JPEG with no NUL byte passed the NUL scan and was stored as
a string `toString('utf8')` had already replaced bytes in — publishing without error and installing
**corrupted**.

### What shipped

**Platform (`nodegx-community`), all new:**

- **`0023_fb005_binary_template_files.sql`** — **eight** CHECK constraints, four per table, no new
  column: values are strings, values are base64-**shaped**, no key in both maps, and `binaryFiles`
  is an object when present. ⚠️ **Every one of them PASSES on a missing key**, because
  `alter table … add constraint` validates the rows already on the shelf and one that required the
  key could not have been added at all.
- ✅ `readBundleDirectory` **sorts rather than throws**; `publish-tutorial-bundle.ts` keeps the old
  refusal **in the same words**, because a lesson bundle's transport is `0017`'s and its staging
  writer still has no decode branch.
- Path safety, base64 shape and disjointness are checked in the **module** as well, so a publisher
  holding a 200-file project is told **which file** — a constraint fires with a name and no idea
  which entry broke it.
- `fileCount` and the detail route's `paths` now describe the **whole** project. A card reading
  "40 files" for a project holding 40 sources and 2 fonts is a number that disagrees with the
  folder the installer gets.

**Editor (`OpenNoodl`):**

- `collectTemplateFiles` sorts into two maps; **`TemplateReadFs.readFile` became `readBinaryFile`**
  — the swap *is* the transport. ✅ `FileSystemElectron extends FileSystemNode`, so nothing new was
  required of the platform.
- ❌ **The `binaries` outcome is DELETED from `ShareAsTemplateOutcome`**, not left unreachable, and
  the dialog sentence *"Templates cannot carry images yet"* went with it. A dead arm in a union is
  an arm somebody writes a message for, and that message would describe a limit that no longer
  exists. A spec now asserts **no arm anywhere** still says it.
- `PlatformTemplateProvider.install` decodes and writes bytes, in a **second loop** rather than a
  branch — a merged iteration would need a predicate to tell the maps apart, which is the sentinel
  design again.
- 🔴 **`readBundlePayload` runs the SAME gate over the new map** — path safety, string-ness, and a
  path in both maps. `isSafeBundleEntry`'s own comment is why: *"a validator on the far side of a
  wire is a claim about a server, not a gate on a disk."* **A second map added to the payload and
  not to that loop is exactly a gate with a hole shaped like the new feature.**

### 🔴 Three findings worth carrying out of this task

1. **`->` and `||` share a precedence class in postgres and associate LEFT.** The disjointness
   constraint was written `payload -> 'files' || payload -> 'binaryFiles'` and parsed as
   `((payload -> 'files') || payload) -> 'binaryFiles'`, which evaluates to `{}` for every real
   payload — a merged count of 0 against a sum of N, **refusing every insert**. 42 specs went red
   on rows with no binaries in them at all. ✅ **The negative control is what pins it**: a spec that
   only asserted *"an overlapping payload is refused"* is green while the constraint refuses
   everything.
2. **A backtick inside a SQL comment inside a JS template literal ends the string.** `0020`'s
   author left the warning in the file (*"it cost one syntax error to learn"*) and it cost a second
   one anyway — three of the new SQL comments used `` `0023` `` and produced *"Octal literals are
   not allowed"*. The lesson survived; reading it before writing did not.
3. ⚠️ **The exclusion list's JUSTIFICATION changed even though the list did not.**
   `RESTORED_ON_INSTALL` used to be the fix for a refusal; those fonts would now travel fine. It is
   now about not shipping a third of a megabyte of base64 that `installStarterAssets` writes out of
   the app bundle for free. 🔴 **And the failure mode of a stray `.DS_Store` moved from *refuses the
   share* to *uploads to a public shelf*** — the same rule, a worse consequence, which is a reason
   to keep measuring it rather than to relax.

### ⚠️ What this deliberately does NOT include

- **A deploy.** The migration and routes are committed and **not live**; production is `27be4d1`.
  🔴 *Deployed is not committed*, and §4e records the direction that is easy to miss. Nothing on
  the shelf needs `0023` yet — it holds zero rows — so this is a queued deploy, not a broken one.
- **Raising the 8 MiB cap.** Measured as unnecessary; see above.
- **An object store (E7).** base64 is the branch `0020` named as cheap and reversible, and the
  measurement says it is sufficient for every project on this machine.
- **A binary in a LESSON bundle.** `publish-tutorial-bundle.ts` still refuses one. The decoder was
  built for templates because a need was measured there; neither half of that is true for tutorials.

## 4g. ✅ The deploy that would have taken capture hosting dark — session 50

Found while doing the **pre-flight** for queue item 1, not while looking for it. The deploy was
not run first and then inspected; the script was read, a claim in it looked too strong, and the
host was queried before a byte moved.

### The measurement

| | |
|---|---|
| `HETZNER_S3_*` values set on nexus-1 | **5 of 5** |
| the same keys in `~/nodegx-community-deploy.env` | **0 of 5** |
| lines `ops/deploy.sh` writes into the app env file | **the whole file**, unconditionally |

`ops/deploy.sh` rewrites `/etc/nodegx-community/nodegx-community.env` **whole**, so every line
absent from the laptop is a line *erased* from the host. `DATABASE_URL` has always been read back
off the host for exactly that reason. The five Hetzner keys were not.

🔴 **So the next deploy from this laptop would have blanked all five.** Nothing would have
errored: `objectStoreConfig()` trims and returns `null` on any blank, and its callers degrade to
*"not hosted"* by design. Capture hosting would simply have been **off** after a deploy that
printed green — the precise failure mode `src/lib/objectstore.ts` says out loud is unacceptable
(*"What is NOT acceptable is being quiet about it"*).

### ⚠️ The second-order hazard the shape of the fix exists to avoid

The obvious fix — fall the `S3_*` variables back to the host and carry on — **introduces a worse
bug than it fixes.** `ops/install-backup.sh` branches on whether credentials were *passed to it*:
given none it takes `elif [ -f "$BACKUP_ENV" ]` and leaves the existing `backup.env` alone, and
that is the only thing preserving **`BACKUP_ENCRYPT_PASSPHRASE`** — a value that lives in that
file *and nowhere else*, recoverable from neither the laptop nor the app env.

Host-recovered keys reaching that call would take its credentials-*present* branch and rewrite
`backup.env` with an **empty** passphrase, turning off backup encryption exactly as quietly.

✅ **So the fallback feeds the app env file only**, through separate `APP_S3_*` variables. The
backup wiring still sees the laptop's values and only the laptop's values. The separation is the
fix, not an implementation detail.

### 🔴 The fix reverses a stated intent, and that is worth saying plainly

The blanking was **deliberate**, and its rationale is written down at
`tests/ops-deploy-provenance.test.ts` — *"an unset key cannot survive from a previous deploy"*,
guarding against a revoked key living on forever.

That intent is not being overruled casually. Two things narrow it:

1. **The specs never pinned it.** All three existing E7 cases hold the host at `DATABASE_URL`
   only, so *"write what the laptop has"* and *"keep what the host has"* give the **same answer**
   in every one of them. The new behaviour passes all three unchanged; it fills a gap rather than
   contradicting a rule.
2. **Revocation-by-deletion was never a working mechanism for these keys.** They have never been
   in the live secrets file, so nothing was lost that previously worked — whereas the data loss
   was real and imminent.

⚠️ And the deploy is **not quiet** about which side won: every run now prints `KEEPING the host's
existing keys`, `using this laptop's HETZNER_S3_* keys`, or that both are unset.

### The control

🔴 **The regression spec was run against the unfixed script and FAILED** (`expected
'DATABASE_URL=…' to contain 'HETZNER_S3_BUCKET=host-bucket'`), then against the fixed one and
passed. Known-good and known-broken **disagree**, so the spec has discriminating power rather
than merely being green. Two more pin the other half — the laptop must still **win** over the
host, or rotating a key would be impossible — and the region derivation re-running *after* the
fallback.

### ⚠️ What is NOT proven

**That `backup.env` survives is source-level reasoning, not a driven observation.** The harness's
`ssh` stub fakes the backup step (`backup wiring: ok`), so `install-backup.sh`'s preserve branch
is **not executed** by any test. The argument rests on reading its `elif [ -f "$BACKUP_ENV" ]`
branch — which is the weaker kind of evidence, and is recorded here as such.

---

## 5. What is still Richard's to rule — narrowed by the sweep

Two of the task file's four questions are now answered by precedent rather than by decision:

- ~~*Open public upload, or curated first?*~~ **Ruled 2026-08-22: curated.** And `articles` +
  `tutorial_bundles` already implement exactly that posture, so v1 is a re-use, not a build.
- ~~*Licence posture?*~~ **Moot for v1.** A curated batch is ours; we assert the licence because
  we wrote the templates. 🔴 It returns the moment **T5** lands, because a submission is
  third-party code — P69's *"20/20 ≠ fit to publish"* finding is the trap, and it stays parked
  with ECO-002's G3 gate.

Still genuinely open:

1. **Stars (T6).** UNI-004 ruled dev reviews/ratings out of v1; a star system partially reverses
   that. ⚠️ And it is close to meaningless over a curated batch we authored — rating our own
   shelf. **Recommendation: defer T6 until T5 has produced third-party templates to rate.** If it
   goes ahead, the spec must state the count-floor formula: a 5.0 with one vote must not outrank
   a 4.6 with forty.
2. **Moderation floor for T5.** D7 gave report/flag verbs for the **bench only** and no posture
   for third-party content. A submission queue needs a named person who takes something down.
3. **Does a template carry its own binaries?** See §3 — recommended answer is *not in v1*, and it
   is cheap to reverse later.

---

## 6. Acceptance criteria (firmed up; supersedes the task file's sketch)

- **AC1** — `templateRegistry`'s unreachable download path is settled: either removed, or given a
  versioned cache key and a local-path-safe transport. A spec **fails if it is reachable-but-unfixed**.
  🔴 The spec must grade the *caller*, not the registry — a spec that only exercises
  `TemplateRegistry.download` stays green through exactly the outage we are in now.
- **AC2** — a curated template listed on the platform installs from the launcher into a new
  project that opens and renders, with the same fetch → stage → install → record shape as
  `installTutorialFromPlatform`, and a refusal leaves nothing on disk.
- **AC3** — the payload's structural rules are enforced **at publish, in the database**, in the
  style of `tutorial_bundle_has_manifest`. 🔴 Each CHECK begins with `jsonb_exists` — a CHECK
  constraint **passes on NULL**, which TUT-004 measured the hard way.
- **AC4** — ✅ **MET (s44).** Categories and text search work over the curated set, and the
  search answers a **sentence**: `10/10` recall ORed against `5/10` for the ANDed control over one
  corpus and one query set, with the old-vocabulary control (`getting started`) measured in both
  directions. ⚠️ **The corpus is a fixture** — the published shelf holds one row — so the figure
  grades the matcher, not the shelf. Queue item 3 was **not fixed**; it was **not inherited**,
  because nothing in T4 reaches the platform's FTS helper.
- **AC5** — "Share as template" files a submission and **publishes nothing**; the submitted
  template is invisible on the public shelf until Richard promotes it. A spec asserts the
  invisibility from a *second* account, not from the submitter's.
- **AC6** — the four platform gates + the envelope contract pass; new columns classified in the
  census; `models/template/README.md` no longer describes a recipe no caller performs.

---

## 7. Traps carried in from elsewhere — read before starting

- 🔴 **A caller-grep is a gate nothing else performs** (s37, FB-021). This whole document exists
  because four registered providers were green, typechecked, and reached by nobody.
- 🔴 **A CHECK constraint passes on NULL** — `jsonb_exists` first, always (TUT-004).
- 🔴 **`websearch_to_tsquery` ANDs bare terms** (FB-014) — queue item 3.
- ⚠️ **This repo sets no `strict`**, so a boolean discriminant does not narrow a union. Any new
  outcome type here uses a **string** discriminant, as `ResetLessonOutcome` and
  `PlatformInstallOutcome` already do.
- ⚠️ **`Set Record Properties` → `Update Record` created a live name collision** with
  `noodl.byob.UpdateRecord` (FB-014's rename mining). If templates are searchable by node type,
  that name has two honest answers.
- ⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
  property. Measure any new surface's pairs live, in **both** themes.
