# PLAT-006 Notes — Ship Type Declarations from `@noodl/runtime`

Slice 1, 2026-07-27. Mechanism decided and wired; four of the seven blocked modules
converted, plus the package entry point.

---

## 0. Where this change actually lives, and why the history reads wrong

**The bulk of slice 1 is in `ac2fef71`, a commit titled "fix(corpus): settings gate said a
group was missing while printing it".** The rest is in `341b21de`. Neither message
describes any of it.

A second Claude session was working the same checkout on phase-25 corpus fixes and staged
with a whole-tree `git add`, twice, while this work sat staged. It is the
concurrent-session commit-sweeping trap already recorded in memory and in
[WF-007's notes](../phase-19-cloud-workflows/), reaching a new severity: not a stray file
swept along, but an entire task's diff filed under another task's message.

Nothing was lost or altered — the tree was re-verified from scratch afterwards and every
gate below was run against exactly what is committed. Rewriting the branch to reattribute
it was rejected: the other session was still committing to `cline-dev`, and a rebase would
have destroyed live work to fix a cosmetic problem.

**What to do about it:** nothing, other than read this file. `git log -- packages/noodl-runtime/noodl-runtime.ts`
is the fastest way to see the real change set.

**What to do differently:** the earlier rule — commit with an explicit pathspec — is
necessary but *not sufficient*, because it only protects against sweeping other people's
work into yours. Protecting your own work from *their* sweep needs the opposite discipline:
commit early and often, and never leave a large change staged across a long verification
run. A 40-minute gate sweep is exactly the window a concurrent `git add -A` lands in.

---

## 1. The spec's "hard part" was half right, and its prototype could not fail

The spec opens with **"Do not assume sibling `.d.ts` files solve this"** and lists three
candidate mechanisms. That framing is correct as far as it goes, but it misses the thing
that makes the problem tractable:

**Emit was never the problem.** `@noodl/runtime/webpack-ts-rule` has given the runtime its
own ts-loader instance, pointed at the runtime's own CommonJS tsconfig, since PLAT-003
slice 2 — and every consumer's `\.tsx?$` rule already carries `exclude: [runtimePath]`. A
runtime `.ts` file that webpack bundles is *already* compiled in the right program.

What drags a runtime `.ts` into the viewer's ES-module program is **type** resolution:
`uploadfile.ts` writes `import CloudFile from '@noodl/runtime/src/api/cloudfile'`, and the
viewer's ts-loader instance follows that import into its own program to check it. The
loader that *emits* the file and the program that *checks* it are different things, and
only the second one needed redirecting.

That is why option 2 works and why it is much cheaper than the spec feared.

### 1.1 `api/configservice` was the one module that could not reproduce the bug

The spec says to prototype against "the smallest of the seven", `api/configservice.js`,
and count `[tsl] ERROR` lines. Doing exactly that yields **zero errors** for any mechanism,
including no mechanism at all — because `configservice` is imported by
`noodl-viewer-cloud/src/nodes/cloud/request.ts` and **nothing else**. The cloud viewer
compiles at `module: CommonJS`. It was never on the boundary.

`api/cloudfile.js` (20 lines) is the smallest genuinely blocked module — reached by
`noodl-viewer-react/src/nodes/std-library/uploadfile.ts` — and it reproduces `TS1203`
immediately.

**A prototype that cannot fail proves nothing.** Before trusting one, check that the
unfixed case actually breaks: convert with a bare `git mv`, confirm the expected error
class appears, and only then apply the fix. A bare rename here produced 63 errors, but
they were all ordinary conversion errors (`Property 'configCache' does not exist`) — the
absence of `TS1202`/`TS1203` among them was itself the signal.

---

## 2. The mechanism

| Piece | What it does |
|---|---|
| `packages/noodl-runtime/tsconfig.types.json` | `emitDeclarationOnly` → `dist-types/`. `allowJs` stays on so the unconverted `.js` majority ships declarations too |
| `packages/noodl-runtime/scripts/copy-handwritten-types.js` | Copies `src/**/*.d.ts` into `dist-types/src` — see §2.1 |
| `packages/noodl-runtime` `build:types` | The two above, in order |
| `paths` in the viewer, the repo root, and `noodl-core-ui` | `@noodl/runtime` and `@noodl/runtime/src/*` → `dist-types` |
| `prebuild` / `prestart` / `pretest` / `pretypecheck` hooks | Regenerate before anything that reads the tree |
| `.gitignore` + `.tsfixme-baseline.json` `exclude` | The tree is generated; it is neither committed nor counted |

`noodl-viewer-cloud` deliberately gets **no** mapping. It is `module: CommonJS`, it has
never had this problem, and it is the reason `nodescope.ts` has used `export =` since
slice 2 without trouble.

### 2.1 `tsc` does not re-emit a `.d.ts` input — and `skipLibCheck` hides it

A hand-written declaration file is an input `tsc` has nothing to emit *from*, so it is
simply **absent** from the output tree. `dist-types/src/node.d.ts` and
`dist-types/src/nodecontext.d.ts` both `import type … from './internal'`, and
`dist-types/src/internal.d.ts` did not exist. Every consumer resolving through the tree got
`TS2307`.

The reason this survived a whole verification pass: **`skipLibCheck: true` suppresses
errors inside `.d.ts` files.** The repo root sets it; `noodl-viewer-react` does not. So
`npm run typecheck` was green while `npm run typecheck:viewer` reported 45 errors on the
same tree. Run both — they are not the same gate, and the one without `skipLibCheck` is the
one that tells the truth about a declarations tree.

Five files are copied: `internal.d.ts`, `globals.d.ts`, `nodes/std-library/agent/node-instances.d.ts`,
and the two `*-types.d.ts` siblings. `globals.d.ts` carries no top-level import or export by
rule, so it stays a *global* declaration through the copy, which is what a consumer
compiling against this package should get.

### 2.2 Overriding `paths` replaces the root's map

`noodl-core-ui/tsconfig.json` extends the root and declares its own `paths`. That is a
replacement, not a merge, so the redirect had to be repeated there. Four `TS1202`/`TS1203`
in `typecheck:core-ui` were the only symptom, sitting underneath 45 pre-existing
alias errors — easy to dismiss as noise if the counts are all you look at.

`noodl-preview` needed nothing: it is `module: CommonJS`.

### 2.3 `npm run … --prefix ../pkg` is not a directory switch

The viewer's first `build:types` hook was
`npm run build:types --prefix ../noodl-runtime`. npm reads `--prefix` as **its own config**
and re-dispatches the *calling* script into that workspace, so a root
`npm run test:packages` came back as

```
npm error workspace @noodl/noodl-viewer-react
npm error Missing script: "test:packages"
```

`cd ../noodl-runtime && npm run build:types` instead.

---

## 3. What the declarations found

Redirecting resolution flipped the viewer's runtime imports from `any` to typed, and **51
real disagreements** surfaced at once. That number is the argument for the whole task: none
of these were visible before, and all of them are now either fixed or named.

### 3.1 Twenty-two assertions that had outlived their reason (15 files)

```ts
const Model = ModelImport as ModelModule;
const Collection = CollectionImport as CollectionModule;
```

Written when the import was `any`, and by the time `model.ts` and `collection.ts` existed
these only *widened the real type away*. Deleting all 30 lines produced **no new errors**,
which is the evidence that the implementation and its published contract in `@noodl/types`
actually agree.

The error that led there is worth recognising:
`Conversion of type 'ModelConstructor' to type 'ModelModule' may be a mistake … Types of
property 'prototype' are incompatible`. A cast complaining about a type you just wrote
usually means the cast is the thing that is wrong.

### 3.2 Nine reads through `unknown`

`getMetaData`, `getProjectSettings` and `graphModel.routerIndex` all returned `unknown`
once the entry point was typed, and call sites read `.cloudservices.appId`,
`.bodyScroll`, `.repeaterDisabledWhenUnmounted`, `.routers`, `.pages` off them.

`@noodl/types` gained `ProjectMetaData`, `ProjectSettingsValues`, `RouterIndex`,
`RouterIndexEntry`, `RouterPageInfo` and `CloudServicesMetaData`. `getMetaData` is now
`<K extends keyof ProjectMetaData>(key: K) => ProjectMetaData[K]`, so the eight known keys
are typed and anything else still comes back `unknown` — which is what an unrecognised key
genuinely is.

`RouterIndex` is described from the *producer*: `getRouterIndex` in the editor's exporter.
Two packages that do not depend on each other were each guessing at a shape neither owned.

### 3.3 `UserServiceLike` — a class two packages reach and neither can describe

`noodl-viewer-react`'s `UserService` hangs itself on `NoodlRuntime.Services.UserService`,
and `noodl-viewer-cloud`'s Request node calls `forScope(...).fetchCurrentUser(...)` and
reads `.current.getId()`. Neither `@noodl/runtime` nor `noodl-viewer-cloud` depends on the
react viewer, so neither could name it — and both were reaching it as `unknown`.

Named once in `@noodl/types`, with only the cross-package surface declared. Making the
concrete class satisfy it also narrowed `UserService.current` from `unknown` to `ModelLike`
— provable now that `CloudStore._fromJSON` declares its return type, and exactly what the
cloud runtime was already assuming.

### 3.4 Eight arity mismatches that were nobody's fault

`CloudStore._fromJSON(item, collectionName, modelScope)` called with two arguments, in five
places. The declaration was right and the calls were right: every read of the third
parameter is `(modelScope || Model)`, so it is **optional by construction** — and inference
from a `.js` file cannot see that. Same for `_serializeObject`, `_deserializeJSON` and
`JavascriptNodeParser.createFromCode` / `createFromURL`.

JSDoc on the still-`.js` modules now says so. Writing it down also made a finding
explicit at the definition, where it belongs:

> `modelScope` is optional by construction … omitting it puts the record in the
> process-wide store instead of a sandbox's. The five call sites in the viewer that omit it
> are therefore not broken, but a sandboxed preview driving those nodes shares records with
> the host page.

That is an AIX-008 concern, not this task's, and it is now recorded where the next reader
of `_fromJSON` will see it.

### 3.5 `JavascriptNodeParser.apis` inferred as `{}`

`_initializeAPIs` did `this.apis = {}` and then `this.apis.Node = {…}`. Inference takes the
first assignment, so the shipped declaration said `apis: {}` while every consumer read
`apis.Node`. Assigned whole instead; behaviour identical.

**The general rule:** in a `.js` file that will ship declarations, build an object in one
expression. Field-by-field construction types it as empty.

---

## 4. The entry point, and the dead branch it was hiding

`noodl-runtime.js` → `noodl-runtime.ts` is what retires the workaround NOTES §29.4
recorded: `NoodlRuntime.instance = this` is assigned inside the constructor, which
inference over a `.js` file does not track, so ~10 converted modules reached it through a
bare untyped `require`. The static is now declared on `NoodlRuntimeConstructor` — the same
constructor-function idiom `noderegister.ts` and `nodecontext.ts` already use.

**`main` moves to `noodl-runtime.ts`.** Every consumer already compiles this package's
TypeScript from source — that is what `webpack-ts-rule`, nodegx-backend's esbuild and
ts-jest all do — but `main` still named the file the rename had removed, and *no typecheck
could see it*. The backend suite found it, 61 suites failing at once with
`Cannot find module '@noodl/runtime' from '../noodl-viewer-cloud/src/index.ts'`.

**A rename of a package's `main` is invisible to every type-level gate in the repo.** Only
something that actually resolves the module at runtime will catch it.

### 4.1 `onMetaDataUpdateReceived` is gone

Its body called `EditorMetaDataEventsHandler.handleEvent(...)`. That identifier has **never
existed in this repository** — `git log -S` reaches the initial commit — so the method was
a `ReferenceError` waiting to happen. It cannot happen: `editorconnection.ts` dispatches a
fixed set of events and `'metadataUpdate'` is not among them, so nothing has ever emitted
it. Listener and method both deleted, with the reasoning left at the site.

Same shape as the `storageNew` finding in PLAT-003 slice 11: a call to something that never
shipped, surviving since the OSS release because the branch is unreachable.

---

## 5. The jasmine/jest collision, fixed rather than worked around

`tests/deprecated-node-defects.test.ts` failed to compile on `expect.any(String)` —
`Property 'any' does not exist on type '{ <T extends jasmine.Func>…`. Confirmed
pre-existing three ways: it fails at `87791a76` (five commits earlier), from a pristine
worktree, and with HEAD's own tsconfig substituted for the modified one.

The cause is that `noodl-viewer-react/tsconfig.json` had no `types` field, so every hoisted
`@types/*` in the monorepo was in scope and jasmine's globals shadowed jest's.
`noodl-preview/tsconfig.json` already carries the one-line fix, with a comment saying
exactly this. Applied the same line and the same reason. 7/7 suites, 59 tests.

PLAT-004 NOTES §14.8 recorded this collision as "an artifact of the shared-`node_modules`
setup" and moved on. It is an artifact of a missing `types` field, and it is fixable.

---

## 6. Verification

| Gate | Result |
|---|---|
| `typecheck:` runtime / viewer / cloud / editor / editor-tests / backend-tests | **0** |
| `typecheck` (root) | 18 — exactly its pre-existing `@noodl-versioning` count |
| `typecheck:core-ui` / `typecheck:preview` | 45 / 30 — pre-existing; **none name a file touched here** |
| `catalog:check` | byte-identical, 154 types / 89 dynamic |
| `noodl-viewer-react` production bundle | **0 `[tsl] ERROR`** across viewer, deploy and ssr |
| runtime jest | **973 / 0** |
| viewer jest | **59 / 59** (was 52 + 1 suite failing to compile) |
| editor Jasmine | **1573 specs / 0 failures** |
| mcp / preview / nodegx-backend / cloud-runtime | 87 / 14 / 619 / 46 |
| `tsfixme-ratchet` | Holding at 972 |

The root `typecheck` being red at 18 is worth stating plainly: `@noodl-versioning` is
declared only in `packages/noodl-editor/tsconfig.json`, so the root program cannot resolve
it, and `npm run typecheck` — a CI job — has been failing on a clean tree independently of
this work.

### 6.1 The ratchet had to gain an exclusion

`dist-types` is generated, and declarations inferred from untyped `.js` are full of `any` —
165 of them. Counting those would have been double-counting the same code and would have
made a gate whose whole value is that its numbers are hard to argue with into one that
could be moved by regenerating a build artefact. Excluded by explicit path in the
baseline's `exclude` list, which is the mechanism the script's own comments prescribe.

---

## 7. Residual

**Three of the seven modules are still JavaScript:** `api/cloudstore` (633 lines),
`api/records` (285), `javascriptnodeparser` (458).

They are **no longer blocked**. The boundary that forced PLAT-003 slice 13 to revert them
is gone, each now ships an accurate declaration through `dist-types`, and the JSDoc added
here means their consumers are typed correctly today. What is left is the conversion
itself — and for `cloudstore` that means naming the Parse wire format, which is a real
piece of work rather than a rename. Sequence them smallest-first: `records`,
`javascriptnodeparser`, `cloudstore`.

Also open:

- **`RuntimeNodeContext.nodeRegister` is still `any`** (`src/internal.d.ts`), carried over
  from PLAT-004 slice 7's residual list. `noderegister.ts` has declared the full interface
  since PLAT-003 slice 2.
- **No live editor pass.** Everything above is gates and suites. The viewer production
  bundle is the strongest signal here, but PLAT-003's convention is a live pass per slice
  and this slice has not had one.
- **`src/events.js`** stays vendored JavaScript, permanently, by PLAT-003's decision.
