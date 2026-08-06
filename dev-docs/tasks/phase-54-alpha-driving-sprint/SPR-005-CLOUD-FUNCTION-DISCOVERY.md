# SPR-005: Finding cloud functions

| Field | Value |
|-------|-------|
| **ID** | SPR-005 |
| **Phase** | 54 — The alpha driving sprint |
| **Tier** | 1 — blocks the alpha |
| **Findings** | F83 |
| **Measured** | 2026-08-06 against `91fcd680` |
| **Branch** | commit directly to `cline-dev` |

## Objective

**Richard:**

> *"there's nowhere in the editor to create and manage cloud functions, only workflows"*

The feature exists. He could not find it. **That is the defect** — and it is a more
serious one than a missing feature, because the person who commissioned the cloud
function runtime is the person who could not find it.

## What actually exists, at file:line

Verified 2026-08-06:

| Piece | Where |
|---|---|
| A cloud function component template | `views/panels/ComponentsPanelNew/ComponentTemplates.ts:138` — `CloudFunctionComponentTemplate`, labelled *"Cloud Function Component"*, with `IconName.CloudFunction` |
| It is registered | Same file `:285`, in the constructor's template list |
| A component kind and glyph | `views/panels/ComponentsPanelNew/componentKind.ts:56` — `'cloudfunction'` is one of six kinds |
| A create gesture | `ComponentsPanelReact.tsx:209-228` — right-click empty space in the components tree → *"Create Cloud Function Component"* |
| A deploy action | `views/panels/BackendServicesPanel/LocalBackendCard/CloudFunctionsSection.tsx:178` |

## Why it is invisible

`ComponentsPanelReact.tsx:55`:

```js
const runtimeType = currentSheet?.isCloud ? 'cloud' : 'browser';
```

and the create menu is filtered by it (`:215-220`). The docstring above it is explicit
about the intent:

> *"on the Cloud Functions sheet you get the cloud ones, everywhere else the browser
> ones — offering 'Cloud Function Component' inside a browser folder would produce a
> component in the wrong sheet."*

That reasoning is sound. The consequence is not: **the entry point to cloud function
authoring is a right-click on empty space, on a sheet you must already have switched
to.** Two invisible affordances in series.

In Richard's screenshot the sheet selector renders as a dropdown labelled **"All"** next
to "Components" — which reads as a *filter over what is shown*, not as *the surface you
are authoring into*. So:

- there is no visible control that says "make a cloud function";
- the control that switches you to where that control appears looks like a filter;
- and its current value, "All", implies you are already seeing everything.

A user who has not read the source concludes exactly what Richard concluded.

## Scope

**In scope**

1. **A visible create affordance.** The panel header already has a plus button
   (`ComponentTemplates.ts:275` — *"Panel that opens in the sidepanel components header
   plus icon"*). Whatever it offers today, it should offer cloud functions when that is
   meaningful, rather than requiring a right-click on emptiness.
2. **Make the sheet selector read as a place, not a filter.** If "All" is a sheet
   selector it should not be named like a filter, and the current sheet should be legible
   without opening the dropdown.
3. **Say where a thing will land.** The `runtimeType` guard prevents creating a cloud
   component in a browser folder by *hiding the option*. Telling the user why is
   strictly better than silently offering less.

**Out of scope**

- Renaming "cloud function" (phase 43 owns the vocabulary question — *"The names carry
  history, not meaning"*).
- The workflow-vs-function distinction itself. **Read
  `dev-docs/reference/BACKEND-AUTHORING-MODEL.md` first**; that argument is settled and
  this task must not reopen it.

⚠️ **Check phase 43 before designing anything.** Phase 43 exists because of an almost
identical episode on 2026-08-05, and its README already covers the node picker as *"the
only signal, and it is a silent one"*. There is a real risk of two sessions building two
different answers to one problem — this repo has done that before (F10/F13). If the fix
belongs in phase 43, **move it there and say so** rather than building it twice.

## Related, already known

`CWF-004 S6` built a *"New cloud function from this step"* gesture on the workflow
canvas. Its 15 jasmine specs pass and **the gesture has never been performed in a real
editor** — it is on ALPHA-001's carried-forward live-QA list. It is a second door to the
same room; verify it while you are here, and check the two doors agree.

## Acceptance criteria

1. A user who has never read the source can create a cloud function, starting from the
   editor with a project open, without being told where to look.
2. The sheet the new component will land in is legible before the click, not after.
3. Driven in a real editor, and the CWF-004 S6 gesture driven in the same pass.
4. Phase 43 checked, and this task's overlap with it explicitly resolved in writing.

## What would make this task fail

Adding a third entry point. There are already two (the components-panel right-click and
CWF-004's workflow-step gesture) and the problem is that neither is visible — a third
invisible one makes it worse.
