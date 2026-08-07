---
title: "Open File Picker"
---
Opens the browser's native file dialog on a signal and outputs the picked file plus its name, size and MIME type.

When the `open` (Open) signal fires, the node clicks a hidden HTML file input, showing the browser's native file dialog. When the user picks a file, the `file` output delivers the browser File object (the value upload nodes expect), the Metadata outputs update, and `done` fires. If the user closes the dialog with nothing chosen — or a later `open` supersedes this one — `unchanged` fires instead, which is a legitimate empty result and not a failure. The selection is reset after each pick, so choosing the same file again still reports `done`. `acceptedFileTypes` maps to the file input's accept attribute; `capture` maps to the capture attribute, which on mobile devices requests a camera or microphone as the source.

## When to use it

Use it whenever the user must supply a file from their device — avatar upload, CSV import — typically firing `open` from a Button's `onClick` and passing `file` to an Upload File node. It is browser-only; there is no folder or multi-file selection.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `Open File Picker` |
| Available in | browser |
| SSR compatibility | client-only — File dialogs only exist in the browser. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `acceptedFileTypes` | String | — | Comma-separated extensions or MIME types the dialog offers; leave blank to offer every file |
| `capture` | String | — | Asks a mobile browser to open a camera or microphone instead of the file list — "user" for the front camera, "environment" for the rear |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `open` | Signal | — | Opens the browser file dialog |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `file` | * | — | The chosen file itself, for passing on to an upload node |
| `name` | String | — | File name as the user chose it, extension included |
| `path` | String | — | Absolute path of the chosen file, which only the desktop app can supply — blank in a browser |
| `sizeInBytes` | Number | — | Size of the chosen file, in bytes |
| `type` | String | — | MIME type the browser reports, which is blank for an extension it does not recognise |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a file has been chosen and every metadata output is up to date |
| `unchanged` | Signal | — | Fires when the dialog closed with nothing chosen, or when a later Open superseded this one — a legitimate outcome rather than a failure |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the dialog could not be opened |
| `failure` | Signal | — | Fires when the dialog could not be opened at all, for example inside a sandboxed frame |

## Patterns

- Button `onClick` → `open`, then `file` → Upload File and `done` → the upload's trigger: the standard upload flow.
- Latch `done` into a Boolean (value pinned true, `done` → Set) to reveal post-pick UI as a level.

## Watch out for

- Treating `acceptedFileTypes` as a guarantee — users can often override the filter; check `type`/`sizeInBytes` before acting on the file.

## Examples

**File picker with a shared accent color and a viewport-aware hint**

Three utility shapes in one small screen. A Color node is the single source of truth for the accent: its savedValue fans out to the title's text color and the button's background, so one edit restyles both. The Button's onClick fires Open File Picker's open — the dialog must come from a user gesture — and after a pick the file's name flows into a Text while `done` latches a Boolean (value pinned true) that reveals the result row as a level; closing the dialog with nothing chosen reports `unchanged` instead. Screen Resolution's width feeds an Expression (width < 600) whose boolean drives the compact hint's visibility, updating live as the window resizes.

## Related nodes

[Upload File](../cloud-services/upload-file.md), [Image](../visual/image.md), [Boolean](../variables/boolean.md), [String](../variables/string.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
