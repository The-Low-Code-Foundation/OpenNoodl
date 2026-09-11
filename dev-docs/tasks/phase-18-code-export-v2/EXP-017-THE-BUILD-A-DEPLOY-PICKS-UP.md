# EXP-017 — The build a deploy picks up

**Status:** 🟢 **BUILT AND GATED — s98, 2026-09-11.** Opened the same day by the CMP-002
landing-page publish drive. AC1, AC2, AC3, AC5, AC6 closed; AC4 closed for the producer (Inter
ships once, as woff2) and deliberately narrowed for the duplicate — read
*"What AC4 does not do"* before re-opening it.
**Owner:** P18 — `nodegx deploy` is this phase's CLI.
**Priority:** 🔴 **High.** It is not only size: a dev build carries an inline source map of the
entire NodeGX viewer source, so a contributor who runs `npm run dev` and then deploys publishes
that source without knowing. Nothing in the run says so.
**Difficulty:** 🟢 **Low** for the warning (one stat and one string match). 🟡 Medium for the font
work, which is a second producer.

## Objective

`nodegx deploy` writes a site fit to upload. Today it writes whatever build happens to be sitting
in `packages/noodl-editor/src/external/deploy/`, and on any checkout where `npm run dev` has ever
run that is the **development** bundle: unminified, with a 9.88 MB base64 source map welded to the
end of it. The run reports 39 entries and exit 0, and says nothing about which build it picked up.

A deploy should either ship the production engine or refuse, and in no case should it ship the
NodeGX source map to a public host in silence.

## What is true today (measured 2026-09-11, this checkout + the installed 0.2.2 app)

1. **The deploy copies the checkout's build verbatim.** The `noodl.deploy.js` in a deployed site
   is byte-identical to `packages/noodl-editor/src/external/deploy/noodl.deploy.js`
   (sha256 `19a3ef29…50b0`). That file's mtime was the `npm run dev:debug` run earlier the same
   session.

2. **The two builds differ by 9.6×.**

   | | dev build | production (installed app) |
   |---|---:|---:|
   | raw | 14,953,525 B | **1,560,431 B** |
   | gzip | 3,678,678 B | 386,263 B |
   | brotli | 2,374,140 B | **294,942 B** |
   | lines | 110,716 | 1 |
   | inline source map | **9,877,712 B — 66.1% of the file** | none |

   The production file's single `sourceMappingURL=data:` hit is css-loader runtime code that
   *constructs* a URL at run time; the file ends in code, not a map.

3. **The configs say exactly why.** `packages/noodl-viewer-react/webpack-configs/`:

   ```js
   // webpack.deploy.dev.js
   mode: "development", devtool: "inline-source-map", watch: true
   // webpack.deploy.prod.js
   mode: "production"            // no devtool → webpack 5 emits none, and minifies
   ```

   Neither is wrong on its own. The defect is that the deploy path does not know which one it has.

4. **Site weight follows.** The CMP-002 landing page deploys to **17.3 MB** with the dev engine and
   **4.22 MB** with the production one. The deploy already excludes unreferenced starter imagery on
   its own — that part works, and is why the remainder is 2.73 MB rather than the full bundled set.

5. **Inter ships twice, as TTF.** `fonts/Inter/Inter-Medium.ttf` **and**
   `noodl_modules/inter/Inter-Medium.ttf` are both published — the same face from two producers.
   Four weights at ~0.30 MB each; the same faces as woff2 are roughly a third of that. Lucide
   already ships `.woff2` in the same site, so the machinery is present and only Inter misses it.
   ⚠️ Not the same defect as [EXP-016](./EXP-016-THE-TYPEFACE-THAT-SHIPS-UNUSED.md), which is 🟢
   built and about the **export** path emitting a `font-family` nothing used. This is the **deploy**
   path publishing the bytes twice, in the wrong format.

## Acceptance criteria

- **AC1 — a deploy names the build it picked up.** Every `nodegx deploy` run reports which engine
  it copied and whether it is a development or production build, in the summary a person reads,
  not only in `--dry-run`.
- **AC2 — a dev engine does not reach a public host by accident.** Deploying a development build
  either fails with its own exit code, or requires an explicit flag whose name says what is being
  shipped. Whichever is chosen, the reason given must name the source map, not just the size —
  someone weighing "it is only bigger" will override a size warning.
- **AC3 — the detection is measured, not inferred from a path.** A build is classified by reading
  the artefact (trailing `//# sourceMappingURL=data:`, line count, `.LICENSE.txt` sibling), never
  by assuming a folder or an mtime. A checkout that has never run `npm run dev` must classify
  correctly too.
- **AC4 — Inter ships once, as woff2.** One producer wins, the duplicate is excluded by a named
  rule the run reports like every other exclusion, and the published faces are woff2.
- **AC5 — a gate holds it.** A test deploys a fixture project against both a dev-shaped and a
  production-shaped engine and asserts the two different outcomes. Arm the loser: an engine with
  the map stripped but still unminified must not pass as production.
- **AC6 — the numbers above are reproduced by the gate**, so a later change that re-inflates the
  bundle fails rather than being noticed by the next person who happens to look.

## What was built — s98, 2026-09-11

🟢 **BUILT AND GATED.** AC1, AC2, AC3, AC5, AC6 closed. AC4 closed for the **producer** and
narrowed for the **duplicate** — see the AC table and §"What AC4 does not do".

### AC1 — every run names the build it picked up

The engine reads `packages/noodl-editor/src/external/deploy/noodl.deploy.js` and reports it, and
`gradeDeploy` prints one line under the summary on **every** run, success or refusal:

```
  engine: production build of the NodeGX viewer, 1.49 MB — …/src/external/deploy/noodl.deploy.js
```

and on a development engine that was shipped deliberately:

```
  ! engine: DEVELOPMENT build of the NodeGX viewer, 14.27 MB, of which 9.43 MB is an inline
    source map of the NodeGX viewer source — …/noodl.deploy.js
    It was published because --allow-development-engine was given. Anyone who opens the site
    can read the viewer source. Build the production one with: npm run build:editor:_viewer
```

An engine that reports no reading (an older bundle under a newer front door) prints **nothing**
rather than "production" — `engineLines(undefined) === []`, and a spec arms it.

### AC2 — a dev engine is refused before anything is written, and the reason names the map

`EXIT.engine = 11`, its own code. Not `8` (*there is no engine here, stop retrying*) and not `9`
(*the site that WAS written renders nothing*) — the three differ in what a pipeline should do next
and in what is on disk afterwards. Driven against this checkout's real development engine:

```
$ nodegx deploy …/hello-world …/site
This deploy would publish a DEVELOPMENT build of the NodeGX viewer, so nothing was written.

…/noodl.deploy.js ends with a 9.43 MB inline source map — 66% of the file. That map is the
NodeGX viewer source, base64-encoded, and a deploy copies this file verbatim: uploading the
folder puts that source on your host, readable by anyone who opens it.
…
Nothing was written to …/site.
$ echo $?
11
```

🔴 **The refusal is taken above the engine's first write**, not after it: a folder holding a
complete, working site is a folder somebody uploads. The `in-progress` manifest the front door
writes before spawning is **taken back** on this one stage — every other failure keeps it, because
there the folder really does hold half a site.

`--allow-development-engine` ships it knowingly. It is its own parse branch and not a second member
of the flag SET it sits beside — that set assigned `force` to whatever was in it, so adding this
flag there would have made it silently grant `--force` as well.

### AC3 — the reading is of the artefact, never of a path or an mtime

`viewerBuild.ts` reads three properties of the file itself: the **trailing** `//# sourceMappingURL=
data:` comment and its size, the mean bytes per line, and a `.LICENSE.txt` sibling.

- ⚠️ **`//#` and the tail both matter.** The production bundle contains `sourceMappingURL=data:`
  once, at byte 51,291, inside css-loader's runtime, which *builds* such a URL at run time from a
  `/*#` prefix. A `grep -c` classifier refuses every clean production deploy there is.
- ⚠️ **A mean, not a line count.** *Minified means one line* is already wrong about the file it
  would be written for: webpack's production build emits a `/*! For license information …` banner,
  so the real artefact is **two** lines (1,565,992 B). The dev build is 135 bytes a line.
- 🔴 **`licenseSibling` decides nothing**, in either direction. It is a real signal of the
  production minifier having run **and** a file that survives on disk after a development build
  overwrites the bundle beside it — this checkout was in exactly that state. A reading that can be
  stale corroborates; it is reported, and it is not a vote.

Read from the engine actually used, `NODEGX_DEPLOY_CLI` included: the spec's arms run a **temporary
checkout** and the reported path is the one in it.

### AC5 — the loser is armed

`exp017-deploy-refusal.test.ts` runs the real engine four times against four viewer builds:

| arm | engine | outcome |
|---|---|---|
| 1 | production-shaped | exit ok, `engine.kind = production`, site written |
| 2 | development, 14.95 MB with the welded map | refused, `stage: engine`, **out dir does not exist** |
| 3 | 🔴 **the map stripped, still unminified** | refused — for the *other* reason |
| 4 | development + the flag | shipped, and the map is **read back out of the deployed folder** |

Arm 3 is the one that decides whether the rule measures a build or a substring: it has no
`sourceMappingURL` anywhere, `node --check` passes, it is 9.4 MB smaller — and it is still the
development build with the viewer's source readable in it. Production is therefore the
**conjunction**: map-free **and** minified.

### AC6 — the numbers are reproduced

Arm 2's fixture is built **to** the measured figures and the engine reads every one of them back:
14,953,525 B, 110,716 lines, 9,877,712 B of map, 66.1% of the file. A separate row reads the
**real** bundle in this checkout: a production one must be under a 4 MB budget with no map and few
lines; a development one — a normal state for a working tree, so not a red row — must still be
**detected**, by mean line length and by a map that is more than half the file. Neither arm grades
nothing.

### AC4 — the producer, closed; the duplicate, narrowed

**The published faces are woff2.** `scripts/library/ttf-to-woff2.js` is a WOFF2 encoder in ~200
lines of `zlib`, no dependency, null-transform (`transformVersion = 3`) so it rewrites a container
and never touches a glyph. `starterAssetList.ts` installs `noodl_modules/inter/Inter-*.woff2` and
the module's `styles.css` names them: **1,256,396 B → 488,132 B**, 61% off a payload that ships
inside every project this product creates and every app deployed from one.

That closes POL-006's stated objection — *"there is no woff2 encoder in this repo, and a font
nobody can regenerate is worse than a larger one"* — by writing the encoder rather than arguing
with the rule.

🔴 **A browser found two defects that four readers could not.** The encoder's own `--check` passed,
`fontTools` opened the file and reported every table byte-identical to the source, 2,547 glyphs and
2,505 cmap entries — and Chrome refused it, with `OTS parsing error: Failed to convert WOFF 2.0
font to SFNT` and nothing more specific. Twice:

1. **The table directory must be sorted by tag.** Inter's tables lie on disk as `glyf maxp loca
   head …`; a decoder reconstructs the sfnt directory in the WOFF2's order and an sfnt directory
   must be sorted. Same bytes either way; one of the two files loads.
2. 🔴 **A WOFF2 file must be a multiple of four bytes long**, and this is the one worth
   remembering: of Inter's four faces, `Regular` (114,688 B) and `Medium` (123,860 B) came out
   4-aligned **by luck** and loaded perfectly, while `SemiBold` and `Bold` were invisible on every
   page. A gate written against "the font" would have been green while three quarters of the fonts
   the encoder could produce were unusable. Every row now runs over all four.

All four faces now load in Chrome and measure **exactly** the same advance widths as the `.ttf`
they came from, and as `fontTools`' own reference encoding of the same face.

**The duplicate is excluded by a named rule.** `duplicateAssets.ts` + the copy step: a file is left
out when another file the same deploy ships is **byte-for-byte identical** to it, **one of the two
is under `noodl_modules/`**, and the project's own source text never mentions it. Reported like
every other exclusion — `source: 'duplicate-asset'`, with the survivor named in the reason. The
module copy wins, because its manifest is what puts its stylesheet in front of the app and that
stylesheet names its own files by relative path.

🔴 **The `noodl_modules/` half was learned by breaking a shipped spec.** The rule first
deduplicated *any* two identical files, and DEP-008's fixture holds `assets/logo.png` and
`pre.gitlab-assets/logo.png` with the same three bytes in each — two copies of a user's own
picture, in two folders they chose. It dropped one and `criterion 4 — deploys pre.gitlab-assets/`
went red. It was right to: `nodegx deploy`'s contract is *everything ships unless a named rule
excludes it*, and somebody with two copies of their logo has two URLs this deploy cannot read. The
defect EXP-017 measured is narrower than "the same bytes twice" — it is **the product installing a
file that something else already brought**.

Driven against a copy of the real CMP-002 landing page, with the checkout's live engine:

```
  ! fonts/Inter/Inter-Medium.ttf (314712 B) is the same file as
    noodl_modules/inter/Inter-Medium.ttf and both were published — the project refers to
    fonts/Inter/Inter-Medium.ttf. Point that reference at noodl_modules/inter/Inter-Medium.ttf
    to stop shipping it twice.
```

#### What AC4 does not do, and why

🔴 **A duplicate the project REFERS to still ships, and the run says so in a warning naming both
paths.** The measured case is exactly that one: the CMP-002 landing page writes
`fontFamily: "fonts/Inter/Inter-Medium.ttf"` into two Text nodes, from an imported prefab, and the
viewer derives the family `Inter-Medium` from that URL.

Dropping it needs the reference repointed at the surviving copy, and a deploy has no safe way to do
that: the paths live in exported node parameters, `Static Data` JSON, script strings and the
project's own stylesheets, and a rewrite that reaches four of those five leaves a stranger's
website with a missing typeface and a clean report. **A reported 307 KB is a smaller failure than a
silently broken page** — the same argument `planStarterImageryPrune` already makes about
photographs, and the same reason identity here is bytes and never names.

The follow-up, if it is wanted, is at the **producer**: 20 prefab projects under `library/prefabs/`
carry their own `fonts/Inter/*.ttf` and name them in 50 parameters. Repointing those at
`noodl_modules/inter/Inter-*.woff2` keeps the derived family name identical (both stems are
`Inter-Medium`) and removes the second producer at source. It is a library change with its own
blast radius and was left out of this task deliberately.

## Gates

| gate | rows | where |
|---|---|---|
| `exp017-viewer-build.test.ts` | 8 | `noodl-preview` — classification, the two mutants, the css-loader false positive, the real bundle |
| `exp017-deploy-refusal.test.ts` | 5 | `noodl-preview` — four real deploys against four engines, in a temp checkout |
| `exp017-deploy-engine.test.ts` | 12 | `nodegx-export` — exit 11, the AC1 line, the flag, the manifest a refusal takes back |
| `exp017/inter-woff2.test.ts` | 7 | `noodl-editor` `tests-unit` — all four faces, alignment, table-for-table against the `.ttf`, regeneration |
| `exp017/duplicate-assets.test.ts` | 10 | `noodl-editor` `tests-unit` — the planner, every refusal arm |
| `exp017-duplicate-assets.test.ts` | 5 | `noodl-editor` jasmine — the real copy step, with the same-size-different-bytes and user's-own-file controls |

⚠️ **`test:main` also reports one failure that is not this task's**: `TPL-003 — install writes a
project that opens` expects 21 components and gets 23, from a peer's in-progress edit to
`landing-pages.content.json` (mtime during this session). Nothing here touches templates.

## Notes for whoever takes it

- `nodegx deploy` already refuses a site that would render nothing (exit 9) and already reports
  every excluded file with the rule that excluded it. Both are the right shape to extend — AC1 and
  AC2 should look like the exclusion reporting that is already there, not like a new subsystem.
- The CLI help already documents `NODEGX_DEPLOY_CLI` for pointing at an engine. Whatever AC3 reads,
  it must read it from the engine actually used, including that one.
- The 9.88 MB map is a *trailing comment*. Stripping it is provably safe (`node --check` passes)
  but **do not make post-processing the fix** — the fix is picking the right build. A stripper
  would leave the 5 MB unminified body and paper over AC1.
