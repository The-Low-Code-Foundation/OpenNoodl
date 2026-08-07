# EXP-007: Exported files know where they came from and whether a human has touched them

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-007 |
| **Phase** | Phase 18 — Code Export v2 (Track F) |
| **Status** | Not started — blocked on EXP-002 having a generator to inject into |
| **Priority** | 🟠 High — cheap to build now, impossible to retrofit onto exports already in users' repos |
| **Difficulty** | 🟢 Low–🟡 Medium — no hard problems; one policy decision and one harvested utility |
| **Estimated Time** | 1 week on top of a working generator |
| **Prerequisites** | EXP-002 (generators). Complements [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) — same injection point, different payload |
| **Source** | Rise salvage assessment, 2026-07-30 ([docs/research/rise-assessment.md](../../../docs/research/rise-assessment.md)) — harvest candidates 1 and 2 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1 (the policy), 🟢 **Sonnet 5** for §2–§3 (specified and mechanically verifiable) |

## Objective

Every generated file states which graph element produced it, under which catalog and exporter version;
and a re-export can tell, without asking, whether a human has edited that file since.

## Why this is separate from EXP-006

They share an injection point and nothing else.

| | EXP-006 | EXP-007 |
|---|---|---|
| Payload | What a **human wrote** — node comments, wire labels, authored titles, comment boxes | What the **machine knows** — node id, component, versions, content hash |
| Audience | The developer reading the export | The exporter, on the next run |
| Governing rule | "Never invent" — every comment traces to typed text | Always present, on every generated file |

EXP-006 makes an export *comprehensible*. EXP-007 makes it *re-runnable*. Build them together — one pass
over the header-emitting code — but do not let the second get folded into the first and quietly dropped,
which is how phase 7's CODE-008 nearly vanished (see the phase README's F57 note).

## §1 — The marker set (decide first)

Rise shipped a working version of exactly this, and it is the one part of that project's
bidirectional-sync ambition that actually got built —
[`CommentHeaderBuilder.ts`](../../../../rise/src/core/codegen/CommentHeaderBuilder.ts), ~175 lines,
emitter plus `parseCommentHeader` regex reader:

```js
/**
 * @lowcode:generated
 * @lowcode:component-id: comp_button_001
 * @lowcode:level: 1
 * @lowcode:last-generated: 2025-11-27T12:00:00.000Z
 * DO NOT EDIT: This file is auto-generated. Changes will be overwritten.
 */
```

Adopt the *shape*; the field list needs to be ours. A strawman:

| Marker | Carries | Why |
|---|---|---|
| `@nodegx:generated` | presence only | Lets any tool classify the file without parsing further |
| `@nodegx:component` | component path, e.g. `Pages/Start` | The unit a reader navigates by |
| `@nodegx:node-id` | node id, where a file maps to one node | The substrate's primary key — SUB-012 established it is the identity that matters |
| `@nodegx:catalog-version` | `catalogFormatVersion` + package versions | An export is only reproducible against the vocabulary that produced it |
| `@nodegx:exporter-version` | generator version | Distinguishes "graph changed" from "exporter improved" — decides whether a re-export diff is expected |
| `@nodegx:generated-at` | ISO timestamp | Freshness for humans |
| `@nodegx:content-hash` | hash of the emitted body, excluding the header | §2. **The load-bearing one** |

**Learn from Rise's bug here.** Its header hardcodes `LEVEL: 1` at
[`CommentHeaderBuilder.ts:90`](../../../../rise/src/core/codegen/CommentHeaderBuilder.ts#L90) even when
generating from a Level 1.5 manifest — so the field that exists to describe the source lies about it. Every
marker's value must be read from the thing it describes. Worth a test that asserts exactly that.

Open questions for §1 to settle, not for this doc:

- **Do non-1:1 files get node ids?** A generated store or router aggregates many nodes. Options: omit
  `node-id`, or carry a list. Omitting is probably right; decide deliberately.
- **Does `DO NOT EDIT` belong?** Rise says it unconditionally. Ours is an *eject* — the entire promise is
  that the code is now yours to edit. A blanket "DO NOT EDIT" contradicts the phase's reason for existing.
  Recommend a truthful variant: this file was generated from `<component>`; re-exporting overwrites it.
- **Comment syntax per target.** EXP-005 ports the export to Svelte/Vue; markers must survive that or be
  regenerable. Cheapest answer is to make marker emission a function of the target's comment syntax from
  the start.

## §2 — Content hashing, and the harvested utility

`@nodegx:content-hash` is what turns a header into a mechanism. On re-export, hash the file's current body
and compare: equal means untouched and safe to overwrite silently; different means a human has edited it
and the exporter must not clobber it without saying so. This is what makes EXP-004's report able to say
"3 files you modified were skipped" instead of destroying work.

For the mechanism, harvest [`FileChangeTracker`](../../../../rise/src/core/FileChangeTracker.ts) (525
lines, 50 tests, imports only `node:crypto`). It is the strongest single asset in the Rise repo and it
solves the adjacent problem completely: telling a tool's own write apart from a human's. Take in
particular:

- SHA-256 of intended content stored **before** the write, not after.
- **Per-file pause** during generation, so concurrent writes to other files stay observable.
- A **watchdog timer that auto-resumes** if the generator crashes between before/after — without it, one
  crash permanently deafens the tracker for that file. This is the detail most hand-rolled versions miss.
- **Fail-safe to "assume human edit"** on any error. Wrong in the safe direction: a spurious skip costs a
  message, a wrong overwrite costs work.

Two adaptations. First, Rise pairs this with a live filesystem watcher; we have none
(`grep` for `chokidar`/`fs.watch` across `noodl-editor/src` and `noodl-mcp/src`: zero hits), so **take the
hashing and attribution logic and leave the pause/resume machinery** unless and until a watcher exists.
Second, its 100 ms settle constant is tuned for network drives and is over-conservative locally.

**Do not port the surrounding `FileChangeTypes.ts` indirection or `ChangeDetector`.** The latter is coupled
to Rise's manifest shape; its one transferable idea — *exclude volatile fields from an identity hash* — is
already stated here as "excluding the header".

## §3 — Read it back

Ship the reader with the writer, or the markers are decoration. A `parseExportHeader` that returns the
marker set or `null`, plus:

- `nodegx export --check <dir>` — report, per file: unmodified / human-modified / orphaned (no
  corresponding graph element) / stale (older catalog or exporter version).
- EXP-004 consumes this directly; it is a large part of that task's "what needs review" column.

## §4 — What this does *not* commit us to

**Round-trip editing stays out of scope**, as the phase README states and as
[phase-7's overview](../phase-7-code-export/CODE-EXPORT-overview.md) stated before it. This task does not
reopen it, and the markers are worth having whether or not it ever happens.

What it does is preserve the *option* at near-zero cost. Identity plus a modification signal is the
irreducible substrate for any future reverse path, and it can only be established at emit time — an export
shipped without markers can never be retrofitted, because the files are already in users' repositories.
That asymmetry, not any round-trip ambition, is the argument for doing this in the first export release.

## Success criteria

1. Every generated file carries the full marker set; a test asserts each value derives from its source
   rather than a literal (the Rise `LEVEL: 1` bug, encoded as a regression test).
2. `parseExportHeader` round-trips every marker the writer emits, over a fixture corpus.
3. Re-exporting an untouched directory reports zero modified files and rewrites nothing.
4. Editing one exported file by one character makes `--check` classify exactly that file as
   human-modified, and the re-export refuses to overwrite it silently.
5. Deleting a node makes its file classify as orphaned rather than being silently left behind.
6. Markers survive EXP-005's Svelte/Vue post-processing, or the report says which were lost and why.

## Out of scope

- Round-trip / reverse sync (§4).
- Human-authored comments — [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md).
- A filesystem watcher. If one is ever added for the MCP-writes-while-editor-is-open case, revisit the
  pause/resume half of `FileChangeTracker` then.
