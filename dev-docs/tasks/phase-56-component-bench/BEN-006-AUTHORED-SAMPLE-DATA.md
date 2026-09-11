# BEN-006 — Your own sample data, in the AI preview

**Status:** ✅ **CLOSED — built and driven** (§1–§6 built 2026-08-08, every Live criterion closed
2026-08-09).

| Part | Where | State |
|---|---|---|
| §1 the fourth layer | [`sandboxData.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxData.ts) | ✅ 15 specs; reaches `buildSandboxExport` **and** `buildBenchExport` |
| §2 the editor | [`SandboxDataEditor.tsx`](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxDataEditor.tsx) + [`sandboxDataDraft.ts`](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/sandboxDataDraft.ts) | ✅ built + driven, 13 specs on the value rules |
| §3 unknown shape → invitation | same | ✅ driven — and it is the case the fixture actually lands in |
| §4 Apply, not keystroke | same | ✅ driven: the panel survives the reload, the marker does not |
| §5 both surfaces | `buildBenchExport` takes `userData` | ✅ mechanism; the AI preview is the surface driven |
| §6 session-scoped | `SandboxPreview` `useState` | ✅ nothing is written anywhere — 0 project files touched |

**The drive found one defect in this task's own panel (B25, fixed) and two things that are not this
task's to fix (B26, B27, filed).** · ⭐ **Richard's specific ask**

> *"It would be cool if we could extend the 'set your own static data' to the AI preview with the
> dummy data existing option, so users can set their own data ideas and see what they render like."*
> — Richard, 2026-08-08

## The evidence

The AI preview's sample data is assembled by `buildSandboxDataset` from three sources, in a stated
order of authority ([sandboxData.ts:8-35](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxData.ts#L8-L35)):

1. the authoring model's `sample_data` — *"always wins"*;
2. the graph's wires (`prop-<field>` endpoints, `collectionName` parameters);
3. the JavaScript the graph runs (`Expression`, `Function`, `Script` …), added after a live run found
   six of nine data-reading candidates binding their data inside a code string, which sources 1 and 2
   could not see at all.

**There is no fourth source, and the missing one is the user.** Today the human reviewing an agent's
work looks at whatever the agent imagined — "Northern Atlas 1", five synthesized rows — and has no
way to say *"show me what this looks like with a 60-character product name"* or *"show me it with one
row"* or *"show me it with my actual copy"*. Those are exactly the questions that decide whether a
component is any good, and the preview cannot answer any of them.

The dataset already flows through the export as plain data (`metadata.sandbox`, keyed
`SANDBOX_METADATA_KEY`) and is typed at
[noodl-runtime/src/sandbox/types.ts](../../../packages/noodl-runtime/src/sandbox/types.ts) as
`{ classes: Record<string, { fields, records }>, user, summary?, unknownShape? }`. It is editable
data that nothing lets you edit.

## Build

### 1. A fourth layer, highest authority

`buildSandboxDataset` gains a `userData?: AgentSampleData` argument (the same
`Record<string, Array<Record<string, unknown>>>` shape the agent's `sample_data` already uses —
[types.ts:69](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/types.ts#L69)),
layered **above** the agent's.

Layer per class, not per dataset: overriding `Products` must not blank `Categories`. Within a class,
the user's records replace the agent's outright — a merge would produce rows the user did not write
and cannot explain.

Keep the existing behaviour intact when `userData` is absent. This is additive, exactly as the code
scan was.

### 2. The editor

A **Data** control in the preview toolbar, beside the existing Sample data / Real backend pair, open
only while Sample data is selected (the same gating `Sign out` already uses — offering to edit data
against a real backend would be a claim the preview cannot honour).

It opens a panel showing, per class:

- the field names the graph reads — this is already computed and it is genuinely useful on its own,
  because it tells you what the component will actually look at;
- the records, editable. A table for flat data, raw JSON as an escape hatch, and the two must edit
  the same underlying value;
- **row count** control — 1, 3, 5, 20. "What does this look like with one result" is one click, and
  it is the question that finds every layout that assumed three.
- per class: **Reset to generated**.

Prefill with the currently-served records, not an empty box. The user is editing what they are
looking at, which makes the round trip obvious.

### 3. Say when the shape is unknown, here too

`unknownShape` already exists and already drives the "Fields unknown" chip
([SandboxPreview.tsx:177-182](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L177-L182)).
In the data editor that class should be the one the user is *invited* to fill in — it is precisely
the case where inference failed and a human knows the answer. Turn the warning into an action.

### 4. Applying an edit

⚠️ **The dataset rides in the export's metadata**, so changing it is a changed export, so the runtime
calls `location.reload()`. Unlike BEN-002's per-keystroke inputs, that is acceptable here — a data
change is a deliberate act, not typing — but it must be **applied on a button, not on every
keystroke**, and the reload must not be a surprise. An **Apply** button, and the panel stays open
across the reload.

⚠️ The window returns under the same clientId, so `lastExports[clientId]` clearing
([ViewerConnection.ts:577-581](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L577-L581))
is load-bearing on this path. If Apply appears to do nothing, that cache is the first suspect.

### 5. Where it is reachable from

Both surfaces, one implementation:

- the **AI authoring preview** (`AuthoringPreviewDocument`) — the ask;
- the **bench** (BEN-004), which uses the same toolbar component and therefore gets it for free.

A component's inputs (BEN-002) and its backend data (this task) are different things and should stay
different controls — one is the component's interface, the other is the world it runs in. Both being
editable is what makes a preview trustworthy.

### 6. Persistence

Session-scoped by default, per R5. If it should survive, it survives as part of a **scenario**
(BEN-005) — same explicit-save rule, same storage. Do not invent a second persistence mechanism.

## Acceptance

- [x] Spec: `userData` for one class overrides that class and leaves others untouched.
- [x] Spec: absent `userData` produces a byte-identical dataset to today's — this must not change the
      existing preview.
- [x] Spec: user records survive the `completeRecord`/`synthesizeRecords` path without having
      synthesized fields injected over the top of what the user wrote.
- [x] **Live:** edit a product name in the AI preview's data editor, Apply, and read the new string
      out of the rendered DOM.
- [x] **Live:** set row count to 1 on a list component and see one row.
- [x] **Live:** a class flagged `unknownShape` can be filled in by hand and renders populated.
- [x] The Data control is absent in Real backend mode.

## The drive, 2026-08-09

Driven in the **AI authoring preview** — the surface the ask names — on a copy of *Puppy test 3*,
with `/Pages/Landing` replayed through the real Build panel by
[`scripted-session.js`](../../../packages/noodl-editor/scripts/aix15-live/scripted-session.js) (no
provider, no API key). Every number came out of the running editor; the rendered strings were read
from the sandbox webview's own DOM, not from the panel.

The fixture is a genuine list: `For Each` → `/Components/PuppyCard`, over
`DbCollection2 collectionName=Puppy`.

| Claim | Evidence |
|---|---|
| The preview opens on inference alone | Toolbar: `Sample data — 5 Puppy, signed in as a sample user`, chip `Fields unknown` |
| ⚠️ **and inference found nothing** | The rendered sandbox carried **20 leaves reading the literal `Text`** — 5 cards × 4 text nodes. **B26** |
| §3: the invitation appears on that class | *"Nothing here could be inferred from the graph — write a row and it will render."* |
| **Live 3** — filled in by hand, renders populated | 3 records typed as JSON → `Biscuit / Marlow / Pip` with breed, age and description each rendered; **0** literal `Text` left |
| §4: Apply reloads, deliberately | Planted marker `mk-2dn04i` → **null**; the panel is still open on the other side |
| The strip says whose data it is | `Sample data — 3 Puppy (yours), …`; the `Fields unknown` chip is **gone** |
| **Live 1** — a table edit reaches the DOM | `name` cell → a **57-character** name; after Apply the sandbox DOM reads `Bartholomew Wigglesworth the Third, Esquire of Muddy Paws`. Richard's *"show me a 60-character product name"*, answered |
| **Live 2** — one row | Row count `1` → draft `1 row`, and the rendered page holds **1** card, **0** placeholders |
| **Live 4** — absent against a real backend | `Real backend` → Data **and** Sign out both gone, summary `Real backend — this preview uses your project's live data.` |
| …and the open panel goes with it | Panel open, switch → panel unmounted. Switching back re-shows it: `dataOpen` survives the round trip |
| §6: nothing is written | R5 holds by construction — `userData` never leaves `useState` |

### What the drive changed (B25)

The panel captioned the sandbox's **own bookkeeping** as fields the graph reads, and did it worst in
the `unknownShape` case this feature exists for:

```
before   Read by the graph: createdAt, updatedAt      2 columns, 10 editable cells
after    Read by the graph: — nothing inferable       0 columns, 0 cells
         No columns yet — switch to JSON and write a row like { "name": "…" }.
```

`SandboxClass` gains `inferred` so the caption can never again name a key merely because the served
records carry it — verified live, it still reads `— nothing inferable` *after* the user has supplied
`name, breed, age, description`, which is the honest answer.

## Risks

| Risk | Mitigation |
|---|---|
| A user's records lack a field the graph reads, and rows render blank | Complete missing fields the way `completeRecord` already does, and show which fields were filled in — do not silently substitute |
| Edited JSON is invalid | Validate on Apply, keep the panel open, name the line. Never apply a partial dataset |
| The reload on Apply is read as a crash | Keep the panel open across it and show that it re-rendered. An unexplained white flash is a bug report |
| Feature drifts into "seed my real backend" | It does not write anywhere. The records exist for the length of a preview. Say so in the panel |
