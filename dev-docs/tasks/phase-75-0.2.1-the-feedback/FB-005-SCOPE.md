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
| **T2** | Platform: `project_templates` + list/detail/bundle routes | **M** | nothing |
| **T3** | Editor: "New project from a template" in the create wizard | **M** | T2 |
| **T4** | Categories + text search over the curated set | **S–M** | T2, ⚠️ see below |
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

⚠️ **T4 still inherits a known defect.** FB-014 measured that the platform's FTS helper uses
`websearch_to_tsquery`, which **ANDs bare terms** — a conversational query matched 2/22 documents
even in perfect vocabulary. That is queue item 3, unowned. **A template search built on the same
helper is born with the same bug.** Fix item 3 first, or T4 ships a search that only answers
single keywords.

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
- **AC4** — categories and text search work over the curated set, and the search answers a
  **sentence**, not only a keyword (i.e. queue item 3 is fixed first or fixed here). State the
  measured recall, with an old-vocabulary control, the way FB-014 did.
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
