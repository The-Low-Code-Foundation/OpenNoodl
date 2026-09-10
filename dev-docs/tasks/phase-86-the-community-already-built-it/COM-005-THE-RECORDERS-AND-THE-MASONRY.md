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

## 6. What this does not own

Where these sit on the installable shelf — CMP-004 AC3 (P85). Directus, the fourth gap, is
COM-006, because its payload is a dead link and recovering it comes first.
