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
