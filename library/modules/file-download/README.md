# File Download

Saves a string to the user's machine as a real file download, fully client-side
(Blob + object URL + a programmatic anchor click; the object URL is revoked
after the save). This closes a genuine dead end: **To CSV** can produce CSV
text, but nothing in the core node set could download the result.

No post-install configuration is required — importing the module registers the
node. No API keys, no network access.

## The Download File node

Found under **Utilities** in the node picker after import.

| Port | Direction | Type | Notes |
|---|---|---|---|
| Content | input | string | The text to save. Objects/arrays wired in are JSON-encoded. Undefined/null (an unconnected input) fires Failure with a helpful Error instead of throwing; an empty string is a legitimate empty file. |
| Filename | input | string | Default `download.txt`. The name the browser saves under. |
| MIME Type | input | string | Default `text/plain`. Presets worth knowing: `text/csv` for CSV, `application/json` for JSON. |
| Download | input | signal | Performs the download. |
| Done | output | signal | Fires after the save is handed to the browser. |
| Failure | output | signal | Fires when the download could not be performed. |
| Error | output | string | Why the download failed; cleared to empty on success. |

## Typical wiring (the shipped demo component)

The module ships a **Download CSV Example** component:

```
Static Data (JSON rows) ──items──▶ To CSV ──CSV──▶ Download File (Content)
Button ──Click──────────────────────────────────▶ Download File (Download)
```

with `Filename` set to `export.csv` and `MIME Type` set to `text/csv`. Swap the
Static Data node for your own array (a query result, a Variable, a Function
output) and the button saves it as a CSV file.

## Notes

- Browser-only: the node needs `document`, `Blob` and `URL.createObjectURL`.
  In an environment without them (e.g. server-side rendering) the Download
  signal fires Failure with an explanatory Error instead of crashing.
- The download is triggered by a hidden `<a download>` click, so browsers treat
  it as a user-initiated save when wired to a click signal.
