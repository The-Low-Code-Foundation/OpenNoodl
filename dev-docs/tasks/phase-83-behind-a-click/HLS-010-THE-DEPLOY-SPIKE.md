# HLS-010 — The deploy spike

🔴 **This task does not produce a `deploy` command.** It produces a written verdict, and then either
a task or a recorded refusal. It exists because #36 puts `deploy` in a table beside `export` as
though they were the same shape, and they are not.

## 1. The person sentence

**The next person who asks "why is there no `nodegx deploy`?" gets a measured answer instead of a
guess — including, possibly, "there will not be one, and here is what to use instead".**

## 2. What is known (measured 2026-09-09)

| | |
|---|---|
| the entry point | `compilation/build/deployer.ts` → `deployToFolder({ project, direntry, environment, baseUrl, … })` |
| what it needs | a live `ProjectModel`, and `Exporter.exportToJSON(project, …)` / `Exporter.exportComponentBundle(...)` |
| what `ProjectModel` is | **1,927 lines**, a singleton (`ProjectModel.instance`), importing `UndoQueue`, `WarningsModel`, `NodeLibrary`, `EventDispatcher`, `ProjectFileWatcher`, `projectMigrator`, `VariantModel`, `LessonModel` |
| its loaders | `readJSONFromDirectory`, `fromLocalStorage`, `fromJSON`. **There is no `fromDirectory`** |
| the encouraging half | it goes through `@noodl/platform`'s `filesystem`, and **`@noodl/platform-node` exists** (`filesystem-node.ts`, `platform-node.ts`, `storage-node.ts`) |
| ✅ the reason to hope | `compilation.ts` is registered in the DEF-007 seam as `inherits` — it clones an already-loaded project. Nothing about the deploy *itself* is inherently GUI |

## 3. What the spike must answer

1. **Does `ProjectModel` construct and load under plain Node with the `platform-node` backend?**
   Try it. This is a two-hour question and the whole estimate turns on it.
2. If yes: what does `deployToFolder` still need that is not present — `@electron/remote`, a window,
   a renderer-only global?
3. What does the deploy actually produce, and **is it the thing we want a CLI for at all?** It
   bundles the *interpreted viewer* plus cloud functions. The React code export is the direction the
   product is going. This is R4, and this spike informs it rather than taking it.
4. What does the 2.9 CLI's `build` command in the original docs actually correspond to here? #11's
   author was reading those docs — the answer belongs in HLS-012's reply.

## 4. Acceptance criteria

1. A written verdict in this file, with the measurement beside each claim, ending in one of:
   *a task exists and here it is* / *refused, and here is what to tell people instead*.
2. The headless-load question is answered by **running it**, not by reading imports. A stack trace is
   an answer; "it imports Electron" is not.
3. If refused: #11 and #36 are updated with the reason, and the register carries a row with an owner
   or the word `NONE`.

## 5. Traps

- 🔴 **Do not start building a deploy command inside this task.** The failure mode this phase is most
  exposed to is a spike that quietly becomes the biggest task on the board.
- 🔴 **Measure, do not reason.** `ProjectModel`'s import list looks fatal and may not be — several of
  those are lazily reached. Equally it may fail for a reason not in the import list.
- ⚠️ Time-box by dependency, not by clock, per the standing rule: the spike ends when questions 1–4
  have answers, not when it feels long.
