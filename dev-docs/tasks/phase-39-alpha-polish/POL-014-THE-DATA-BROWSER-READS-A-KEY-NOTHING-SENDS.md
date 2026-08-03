# POL-014 — The Data Browser reads a key nothing sends

Found on 2026-08-03 while running **POL-005 slice 3** — the pass that opens each backend surface at
860px and asks whether it is usable there. The Data Browser is usable at 860px. It is not usable at
any width, and that has nothing to do with POL-005.

Not reported by Richard. Nobody has met it yet because the surface only fills with rows once a
backend has records, and the grid looks completely normal until you touch it.

## The mechanism — confirmed

Records reach the grid from `backend:queryRecords`, which proxies `GET /api/:collection` and returns
the backend's rows verbatim:

```js
// BackendManager.js:872
const result = await supervisor.request('GET', `/api/${...}?${params}`);
return { results: result.results, count: ... };
```

```ts
// DataBrowser.tsx:151
setRecords(result.results || []);
```

Those rows carry **`objectId`**. Every write channel beside this one names the parameter `objectId`
too — `backend:saveRecord(id, collection, objectId, data)`,
`backend:deleteRecord(id, collection, objectId)`.

The grid reads **`id`**:

```ts
// DataGrid.tsx:158
const recordId = record.id as string;
```

`record.id` is `undefined` for every row, and it is `undefined` in five load-bearing places.

## What it costs — all five observed live

| # | Consequence | How it presents |
|---|---|---|
| 1 | `id` is a declared system column (`DataBrowser.tsx:73`) | The column renders **blank in every row** |
| 2 | `key={recordId}` on the `<tr>` | React logs *"Each child in a list should have a unique key prop. Check the render method of `DataGrid`"* — in `.logs/dev.log`, every load |
| 3 | `isEditing = editingCell?.recordId === recordId` | `undefined === undefined` is **true for every row**, so clicking **one** cell opens an edit box in **all** of them |
| 4 | `onDeleteRecord(recordId)` → `DELETE /api/:collection/undefined` | The confirm appears, you accept, **nothing is deleted and no error is shown** |
| 5 | `onSaveCell` and its optimistic `prev.map(r => r.id === recordId ? …)` | The write goes to `undefined`; the local map would paint the new value into **every** row |

Consequence 3 is the screenshot that settles it: one click on `author` in row 1, eight open editors.
Consequence 4 is the one a user will report: eight records before, eight after, no message.

## What to build

**Slice 1 — one normalisation, at the boundary.** The renderer is the only layer that disagrees; the
IPC layer, the backend and the Parse wire all say `objectId`. So either

- (a) map at `setRecords`: `setRecords((result.results || []).map(r => ({ ...r, id: r.objectId })))`, or
- (b) read `record.objectId` in `DataGrid` and drop `id` from `systemColumns`, showing `objectId`.

**Take (b) if the column header should tell the truth**, (a) if `id` is meant to be the editor's
word for it. Do not do both — two names for one field is how this started. Whichever is chosen,
`READ_ONLY_FIELDS` and the `where` clause in the search path (`DataBrowser.tsx:142`, which also
searches `id`) must use the same name.

**Slice 2 — make the silent delete loud.** `handleDeleteRecord` only calls `setError` if
`ipcRenderer.invoke` throws. It did not throw for `DELETE …/undefined`. Find out what that route
returns for a missing id and make a non-delete visible, because the fix in slice 1 does not stop the
*next* delete failure being silent.

**Slice 3 — a test with two rows.** Every consequence above needs exactly two records to show up, and
none of them needs a backend: `DataGrid` takes `records` and `columns` as props. A test that renders
two rows and asserts one `CellEditor` after one cell click would have caught this.

## Criteria

1. The `id` (or `objectId`) column shows a value for every row.
2. Clicking one cell opens exactly one editor.
3. Editing a cell writes that record, and only that record — checked against the backend, not the grid.
4. Deleting a row deletes that row; the count drops.
5. A delete that does not happen says so.
6. No React key warning in `.logs/dev.log` after loading a populated collection.
7. A jest/jasmine test covering criterion 2 with two records.

## Traps

- **`window.confirm` in Electron is a native modal.** It blocks the renderer, and CDP cannot dismiss
  it — `Page.handleJavaScriptDialog` answers *"No dialog is showing"* while every subsequent
  `cdp eval` hangs. Focus the Electron process and send a real Return
  (`osascript -e 'tell application "System Events" to tell process "Electron" to set frontmost to true'`
  then `keystroke return`). This cost one session two stuck commands.
- Reading React state through a DOM node's `__reactFiber$` can return the **alternate** fiber, one
  render stale. A step index read that way disagreed with the rendered text. Prefer asserting on
  rendered text; use the fiber only for values that are never rendered.
- The `Boolean` formatter renders `false` as `''` (`DataGrid.tsx:48`), so an explicit `false` and an
  unset field look identical. Deliberate tick-or-nothing, and *not* part of this task — but do not
  mistake it for another instance of this defect while fixing it.
