# COM-005 — The recorders and the masonry

**Three gaps left after 29 community components were checked against 74 library entries.** Most of
the export is already covered; these are the ones that are not.

## 1. The person sentence

**A person records audio or video in the browser, or lays out a grid whose items are different
sizes, without leaving NodeGX to do it.**

## 2. What was measured

29 community entries checked against 43 prefabs + 31 modules. **Covered already:**
Dropzone→`file-upload`, Tiptap/TinyMCE→`rich-text-editor`, AG Grid→`table`, Better
Markdown→`markdown`, Check window width→`media-query`, CSV Download→`file-download`, Signup &
Login→`auth-pages`, Email validator→`form-validation`.

**Not covered:**

| gap | evidence | corpus graph |
|---|---|---|
| **audio recording** | `library/modules/web-camera/` contains no `MediaRecorder` and no match for `record` — it grants camera *access* only | Simple audio recorder, 24 nodes |
| **video recording** | same | WebRTC video recorder, 17 nodes |
| **masonry grid** | no library entry; nothing in `card-grid` reflows on item height | 830 chars of CSS |

## 3. The recorders

Both graphs do the same round trip — capture in the browser, then upload as a cloud file — and both
fail the strict gate today, on `module.inlineHtml` (the preview player) plus raw px spacing. See
[`MEASURED-2026-09-10.md`](MEASURED-2026-09-10.md) §4.

🔴 **The right unit is probably one module, not two prefabs.** Audio and video recording differ by
the constraints passed to `getUserMedia` and the MIME type handed to `MediaRecorder`; shipping them
as two entries duplicates the hard part (permissions, stream teardown, blob assembly) twice.
⚠️ Decide this before building, and consider whether it extends `web-camera` rather than sitting
beside it — a second module that also asks for camera permission is a confusing shelf.

**The unglamorous half is where these actually fail:** permission denial, a device already in use,
a tab backgrounded mid-recording, and stream teardown on unmount. The community graphs handle some
of this. Whatever ships must handle all of it, because a recorder that leaks a live camera light
after navigation is worse than none.

## 4. The masonry

830 characters of CSS and a naming convention: `.masonry-grid` on the repeater's parent,
`.masonry-grid-item` on each item's parent group, dropped into a `CSS Definition` node.

⚠️ **It is flex-based, not CSS Grid** — `display:flex; flex-wrap:wrap` with `flex: 0 0 auto`, so it
gives variable-*width* columns in a row, not the vertical brick layout "masonry" usually means. The
author's own note says as much (*"Could be adapted for vertical repeaters"*). 🔴 **Do not ship it
under a name that promises the other thing.** Either implement real masonry or name this what it is.

Smallest sensible unit: a variant on the existing `card-grid` prefab, not a new entry.

## 4b. The decisions, measured before building (session 5, 2026-09-11)

### AC1 — DECIDED: one new authored module, `media-recorder`, **beside** `web-camera`, not extending it

`library/modules/web-camera` was read first, because COM-004 lost its whole premise to exactly the
omission of not reading the surface that already exists. Five measurements, all from the artefact:

| measured | where | consequence |
|---|---|---|
| it is a **vendored, minified bundle** — `provenance.sourceUrl` the-low-code-foundation, `version 1.0.4`, `index.js` a webpack IIFE beside a `.js.map`, **no source in this repo** | `library.json`, `index.js` | extending it means hand-editing third-party minified code and invalidating its version/provenance claim. **Ruled out.** |
| it requests **video only** — `getUserMedia({ video: { facingMode } })`; the string `audio` does not occur in the file | `index.js` | it cannot source an audio recording at all, so "extend it" cannot answer half the task |
| its stream failure path is `console.log("Web Camera stream error", t)` and nothing else — **no output, no signal** | `index.js` | a graph cannot observe permission denial through it; **AC3 is unreachable** via this node |
| it declares **no unmount teardown**: the only `track.stop()` is inside the explicit `stopStream` signal | `index.js` | navigate away mid-stream and the camera light stays on — the AC3 leak, already shipped |
| the two community recorders are **the same script twice**, differing only in `{audio:true}` vs `{audio:true,video:true}` and the MIME literal | corpus, both graphs | two entries would duplicate permissions, chunk assembly and blob handling twice — exactly what §3 predicted |

🔴 **Why a second module is not a confusing shelf.** The two answer different questions and say so:
`Web Camera` hands you a **live stream to show**, `Record Media` hands you a **file to keep** — and
the recorder covers audio, which `Web Camera` cannot do at all. The overlap is *removed*, not
documented away: `Record Media` takes an optional **`Media Stream` input of the same `mediastream`
port type `Web Camera` outputs**, so a graph that already holds a stream records that one and is
never prompted for permission a second time. When it is given a stream it does not own, it does not
stop its tracks.

### AC4 — DECIDED: no masonry, no CSS Definition node, no new entry and no `card-grid` variant — the idiom already ships in `tags`, and what is missing is a name and an example

The 830 characters were checked declaration by declaration against the runtime. **Every one is
either an existing `Group` port or a no-op:**

| declaration | verdict |
|---|---|
| `display: flex` | a `Group` is already a flex container |
| `flex-direction: row` | `flexDirection` port |
| `flex-wrap: wrap` | `flexWrap` port — *"Multi Line Wrap"*, `group.ts:311` |
| `gap: 0.1rem` | `columnGap` / `rowGap`, which `group.ts:470-478` **unlock precisely when `flexWrap = wrap`** |
| `align-items: flex-start` | `alignY` (`addAlignInputs`) |
| `flex: 0 0 auto` on the item | **already the default**: `layout.ts:82` sets `flexShrink = 0` on every node, and `flexGrow` only when the width is a percentage — so a child at `sizeMode: contentSize` *is* `flex: 0 0 auto` |
| `break-inside: avoid` | **no-op** — a fragmentation property for multicol/print; it does nothing to a flex item |
| `min-width: 0 !important` | **inert here** — it exists to let a flex item shrink past min-content, and this item has `flex-shrink: 0` |
| `margin-bottom: 1rem` | `marginBottom` port (and redundant beside the `gap` above it) |

So the behaviour is reachable today with zero CSS. **And it is already shipped.** `library/prefabs/tags`
is the community block, built from built-in ports:

| the CSS asks for | `tags` already sets |
|---|---|
| `.masonry-grid` — `display:flex; flex-direction:row; flex-wrap:wrap` | `/Tags` root Group: `flexDirection: "row"`, `flexWrap: "wrap"`, `sizeMode: "contentHeight"` |
| `.masonry-grid-item` — `flex: 0 0 auto` | `/Tags/Tag Item` Pill: `sizeMode: "contentWidth"`, which `layout.ts` renders as exactly that |

⚠️ **This corrects §2's third row**, and it corrects the first version of this very decision, which
was written one measurement too early — the same order-of-operations mistake COM-004 made, caught
this time before it reached an artefact. §2 says *"no library entry"*; there is one, it simply is not
`card-grid`.

🔴 **So AC4 ships no new entry and no `card-grid` variant, and the reason is measured, not preferred:**

1. **"Masonry" is refused outright.** There is no column balancing anywhere in those 830 characters,
   so the name promises something the code does not do.
2. **A `card-grid` variant would misdemonstrate it.** `/Card` is deliberately `width: 100%` so it
   fills a grid cell; dropped into a wrapping row, `layout.ts` turns that into `flexGrow: 100` and
   every card takes a whole row — the *opposite* of the behaviour being shown.
3. **A new entry would duplicate `tags`.** Two ports on a `Group` is not a library entry, and the
   one entry that already sets them is right there.

What is genuinely missing is that **nobody can find it**: the idiom has no worked example and no
name a person or an agent can search for. That is what AC4 ships — under the honest name *"a
wrapping row of content-width items"*, never "masonry" — plus a pointer from `card-grid`, which is
where someone looking for "grid" actually lands, and the record that the CSS block is redundant.

## 5. Acceptance criteria

**AC1 — the recorder unit is decided.** One module or two, extending `web-camera` or beside it,
with the reason written here. 🔴 Before any building.

**AC2 — a recorder captures and uploads.** Audio and video each: record in the browser, land as a
cloud file, play it back. Measured on the artefact, driven, not on the graph validating.

**AC3 — the failure paths are handled.** Permission denied, device busy, and unmount-mid-recording
each produce a defined output and leave no live stream. ⚠️ **Grade the teardown by checking the
camera indicator after navigation**, not by reading the code.

**AC4 — the masonry ships under an honest name.** Either real masonry, or named for the variable-
width row behaviour it actually implements. Landing as a `card-grid` variant unless there is a
reason not to.

**AC5 — whatever ships has a worked example.** ⚠️ A library entry with no example is a part an agent
cannot reach for; see CMP-004.

## 5b. Built — session 5, 2026-09-11 🟢

**All five ACs closed.** `library/modules/media-recorder` (a `Record Media` node), three worked
examples, and `scripts/library/drives/media-recorder.js` — 34 checks, exit 0.

| AC | how it closed | measured by |
|---|---|---|
| **AC1** | one module, beside `web-camera` — §4b, five measurements, written before any file was created | reading `web-camera`'s own bundle |
| **AC2** | audio **11,567 bytes** of `audio/webm`; video **93,970 bytes** of `video/webm`, both played back from the blob URL | `library:drive`, fake device, both modes |
| **AC3** | denied / busy / navigate-away each reach their own port; **0 live tracks** after every one | `MediaStreamTrack.readyState`, not the source |
| **AC4** | no masonry, no new entry — the idiom already ships in `tags`; an example lands it under an honest name | reading `tags` and `layout.ts` |
| **AC5** | 3 examples, published on 5 node pages | `catalog:examples` 104/104, `docs:nodes` |

### 🔴 What the drive found that reading could not

1. **`Failure` fired after the specific signal and overwrote it.** The demo wires `Failure→Failed`
   and `PermissionDenied→Denied` — the obvious wiring — and the generic one landed last, so a
   refused prompt reported *"Failed"* and the `Denied` branch was dead on arrival. Fixed by firing
   the general signal **first**. Neither the graph nor the source shows this; only two arms do.
2. **A hidden Group is not an unmounted node.** The teardown arm first used a parent Group's
   `mounted: false` and measured **a microphone still live** after the component had vanished from
   the page — correctly: hiding a group removes children from the DOM and leaves the component's
   non-visual nodes alive and recording. Only a **route change** deletes the node scope and calls
   `_onNodeDeleted`. The harness gained an `/Away` page so any drive can measure this properly.
3. **The instrument was one beat out of phase.** A fixed 1.6s sleep read the status *before* the
   fake device handed over its track, and graded nine later arms against the wrong step — none of
   the nine failures was about the recorder. Replaced with polling; ⚠️ a track goes live one beat
   **before** the node publishes `Started`, so the poll has to require both.

### ⚠️ What is NOT driven, and why

**The cloud round trip.** `Noodl.Files.upload` needs a live backend; the `file-upload` drive beside
this one declines the same thing for the same reason — a drive that faked it would assert nothing.
What is driven instead is the **blob the node published**: its byte count and its content type, which
is the `File` that `Upload File` is handed. AC2's *"land as a cloud file"* is therefore closed on the
file, not on the storage.

### 🔴 A defect found in the SDK shim, filed as D5

`methods.onNodeDeleted` — the SDK's own unmount hook, the one a module author would reach for —
**throws a TypeError at unmount**. The shim installs it as
`e.methods.onNodeDeleted.value.call(this)` while `prototypeExtensions` stores the method as a bare
function, and `nodedefinition.ts` deliberately no longer rewrites that object in place. So `.value`
is `undefined` at exactly the moment the hook exists to free a device. This module declares
`_onNodeDeleted` directly instead, which is the path every built-in node uses. See
[`DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md`](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md) D5.

## 6. What this does not own

Where these sit on the installable shelf — CMP-004 AC3 (P85). Directus, the fourth gap, is
COM-006, because its payload is a dead link and recovering it comes first.
