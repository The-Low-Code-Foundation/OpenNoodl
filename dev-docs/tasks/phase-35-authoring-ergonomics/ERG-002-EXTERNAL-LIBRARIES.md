# ERG-002 — External libraries in app config

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Prerequisites** | none. The runtime plumbing already exists and is live-verified |
| **Recommended executor** | Sonnet for the build; the design work is done in §0/§1 below |
| **Origin** | Richard, 2026-08-01, on why `Script Downloader` is the one deprecated node he misses |

## The ask, in Richard's words

> currently it's a huge pain in the ass to pull in an external library and make it available in the
> app. I'm thinking about pocketbase and tinyMCE and stuff. You have to do a very specific head code,
> with a specific code source that's compatible with the Noodl front end webpack thingy that I don't
> really understand, but it was always a pain and you had to attach the thing to the 'window' so
> you'd call window.PB.whatever in the code in the app.

## §0 — What actually exists today (measured 2026-08-01)

**The good news, and it changes the size of this task: the plumbing is already there, it already does
the right thing, and it is already live-verified in a real deploy. What is missing is entirely
surface.**

### Route 1 — `noodl_modules/` (the good one, invisible to authors)

A folder under `<project>/noodl_modules/<name>/` with a `manifest.json`. Scanned by exactly one
scanner, [`projectmodules.ts`](../../../packages/noodl-editor/src/shared/utils/projectmodules.ts) —
LIB-003 merged the two that used to exist. `injectIntoHtml` (`:275-302`) then:

- injects a `<script>` tag for the module's own `index`;
- injects a `<script>` tag for **every entry in `dependencies`** — and already handles both absolute
  `http(s)` URLs and project-relative paths (`:296-297`);
- filters on `runtimes` so a module can declare it is browser-only (`:285`);
- is consumed by **all four** HTML paths: the editor preview's web-server, the deploy
  `HtmlProcessor`, the headless `noodl-preview` loader and `ViewerConnection`.

And `noodl_modules/` **ships verbatim in a deploy** — it is absent from `build/ignore.ts`'s defaults,
checked, and NDA-007 §2 confirmed it live: the asset resolved over http in a real deployed build, and
removing the file produced a measurable failure, so the witness discriminates.

⚠️ **There is no UI for any of this.** No panel, no "add a library", nothing. An author must hand-write
a folder and a JSON file, and nothing in the product mentions that the mechanism exists. Grep for a
modules panel returns the icon picker and the settings tab's legacy-ports notice.

### Route 2 — `headCode` (the one authors actually find, and the worse one)

A raw HTML string in project settings, injected at `{{#customHeadCode#}}`
([`html-processor.ts:46-66`](../../../packages/noodl-editor/src/editor/src/utils/compilation/build/processors/html-processor.ts#L46-L66),
and `web-server.js:73` for the preview). No validation, no assistance, no participation in the module
system. **This is the "very specific head code" of the ask.**

### ⚠️ And the correction that matters

**`Script Downloader` has no replacement, and an earlier claim that it did was wrong.** The Script
node's *External File* mode looks like the replacement: it takes a URL and loads it. But
`JavascriptNodeParser.createFromURL` (`javascript.ts:692-694`) parses the fetched file as **that
node's own body**, scanning it for the node's declared inputs and outputs. It cannot load a
third-party library. So `Script Downloader` — a numbered list of URLs, a `Load` signal and a `Loaded`
output — was the only *node* that did this job, and it did it with **no failure surface at all**,
which is the easiest "yes, that's broken" in the deprecated set.

## §1 — What is actually missing

Five things, none of them plumbing:

1. **No UI.** You must know the folder convention exists.
2. **No guidance on which build to use.** This is Richard's "specific code source compatible with the
   webpack thingy". The truth is simpler than it sounds and nothing says it: the script is loaded by
   a **plain `<script>` tag with no bundler**, so it must be a **UMD or IIFE build that assigns a
   global** — not an ES module. An ESM build fails silently: the tag loads, no global appears, and
   every later reference is `undefined`.
3. **Nothing records or surfaces the global name.** You have to know it is `window.PocketBase` or
   `window.tinymce`. Nothing declares it, so nothing can check it, autocomplete it, or tell you when
   you got it wrong.
4. **The code editors don't know.** A Function or Script node referencing the global gets no
   completion and no validation.
5. **The AI authoring loop doesn't know.** "Use PocketBase for this" is unanswerable because the
   registered libraries are not in the context the loop reads.

## §2 — The design

**An app-config "Libraries" section that writes a `noodl_modules` manifest, and verifies it on the way
in.** Deliberately not a new mechanism — the existing one already ships correctly to preview, deploy,
SSR-served HTML and the headless renderer, and inventing a second would mean four more injection
sites.

### What the author fills in

| Field | Example | Why |
|---|---|---|
| **Name** | `PocketBase` | Identity; becomes the folder name under `noodl_modules/` |
| **Source** | a URL, or a file dropped into the project | Both already supported by `dependencies` |
| **Global name** | `PocketBase` | The bit nobody currently knows to record. Everything below depends on it |
| **Stylesheet** (optional) | a CSS URL | Many libraries need one — tinyMCE does. `browser.stylesheets` already exists |

### The part that carries the value — verify on add

Load the source in the editor and **check the declared global actually appears.** If it does not, say
so immediately and name the likely cause:

> `PocketBase` loaded but defined no global called `PocketBase`. This is usually an ES-module build —
> look for the UMD or "browser" build on the CDN (often `…/dist/pocketbase.umd.js`).

This single check is the whole of Richard's pain: it converts a silent runtime `undefined` an hour
later into an install-time sentence that names the fix. **Build this before anything cosmetic.**

### Then make it visible to the three things that should know

- **The code editors** — an ambient declaration for the registered global, so a Function or Script
  node stops flagging it and can complete it. Types are a bonus; *knowing the name exists* is most of
  the value. See [`REUSING-CODE-EDITORS.md`](../../reference/REUSING-CODE-EDITORS.md).
- **The AI authoring loop** — registered libraries go into the context `ContextBuilder` reads.
- **The validator** — a graph referencing a global no library declares is a warning, not a mystery.

### Offer to vendor it locally

A CDN URL in a deployed app is a runtime dependency on someone else's uptime. Offer to download the
file into the project on add; `noodl_modules/` ships verbatim, so the local copy needs no further
work. Pin the version in the URL either way.

## §3 — ⚠️ The SSR/SSG trap, stated up front

**A library attached to `window` does not exist during server rendering.** SSR reads
`globalThis.__noodl_modules` (`external/ssr/index.js:68`, populated in `runtime-globals.js:33-36`),
which only carries modules that called `Noodl.defineModule`. A third-party UMD bundle assigning a
browser global is not in that list, and there is no `window` for it to assign to.

So:

- `runtimes` must be honest — a browser-only library declares `['browser']` and the existing filter
  (`projectmodules.ts:285`) already respects it.
- **The UI must warn** when a project uses SSR or SSG and registers a browser-only library. This is
  the exact class NDA-004 §2 criterion 2 was closed on: a mechanism that read as working because
  nobody had run the deployed build. Do not let this one repeat.
- Whether a registered library should be usable from a **cloud function** is out of scope here and
  overlaps the open `net.noodl.HTTP` cloud-availability slice. Note it, do not solve it.

## §4 — What this does *not* do

- **It does not resurrect `Script Downloader`.** Richard was explicit: *"I don't want to revive it."*
  A per-graph node that loads a library at some point during a page's life is the wrong shape — the
  library belongs to the app, not to one graph, which is exactly why app config is the right home.
- **It does not add a bundler.** No `npm install`, no module resolution, no build step. A script tag
  and a global, made discoverable.

## Success criteria

1. An author can add PocketBase and tinyMCE from app config, without touching a file or knowing what
   UMD means, and use them in a Function node.
2. Adding an ES-module build **fails at add time** with a message naming the cause. This is the
   criterion the task exists for; if it passes only for correct input, it has not been met.
3. The registered global is declared to the code editor and appears in the AI loop's context.
4. ⚠️ **Verified in a real deployed build, not just the preview** — one library registered, project
   deployed, the global present and a call to it working over http. Phase 30 found four separate
   defects that only a deployed build revealed; the preview is not evidence.
5. Registering a browser-only library in an SSR project produces a warning that names the page that
   will fail.
6. A library added as a local file survives a deploy with no network access at run time.
7. `headCode` still works and is left alone. It is the escape hatch for everything this feature does
   not model.
