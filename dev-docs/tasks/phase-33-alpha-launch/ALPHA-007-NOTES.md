# ALPHA-007 Part A — build notes

Branch `wt-alpha-007`, based on `cline-dev` at `bf35a9f4`. Part A only (§1–§5),
plus §6 **prepared and not executed**. §7 and §8 are out of scope and untouched.

`PROGRESS.md` deliberately not edited — reserved for the orchestrator.

---

## What was built

| Area | Files |
|---|---|
| Redactor (§3) | `packages/noodl-editor/src/editor/src/utils/report/redact.ts` |
| Diagnostics payload (§4) | `.../utils/report/diagnostics.ts` |
| Prefill contract + URL budget (§2) | `.../utils/report/issueForm.ts` |
| Error tail (§3) | `.../utils/report/errorTail.ts` |
| Assembly (pure) | `.../utils/report/compose.ts` |
| Reading the running editor (impure) | `.../utils/report/collect.ts` |
| The composer | `.../views/DialogLayer/components/ReportProblemDialog/` |
| Capture, clipboard, bundle, reveal | `packages/noodl-editor/src/main/src/report-window.js` |
| Menu item + IPC wiring | `packages/noodl-editor/src/main/main.js` |
| Listener + error-tail arming | `packages/noodl-editor/src/editor/src/router.tsx` |
| Form fields | `.github/ISSUE_TEMPLATE/bug_report.yml` (added `severity`, `diagnostics`) |
| Labels, **not run** | `scripts/alpha-007/create-labels.sh` |
| Manual prefill check | `scripts/alpha-007/prefill-probe.js` |
| Privacy | `PRIVACY.md` §5, §6, §7 |

Tests: `packages/noodl-editor/tests-unit/alpha-007/` (4 suites, 87 tests) and
`packages/noodl-editor/tests-main/report-window.test.js` (11 tests).

---

## Gates run, and their exact results

| Gate | Command | Result |
|---|---|---|
| Editor typecheck | `npx tsc --noEmit -p tsconfig.json` in `packages/noodl-editor` | **0 errors**, before and after |
| Jest (`tests-main` + `tests-unit`) | `npx jest` in `packages/noodl-editor` | **40/42 suites, 528/531 tests pass** |
| Lint ratchet | `npm run lint:ci` | **854 errors vs baseline 3916 — 3066 under.** Green |
| Bash syntax | `bash -n scripts/alpha-007/create-labels.sh` | ok |
| Repo labels (read-only) | `gh label list --repo The-Low-Code-Foundation/OpenNoodl` | the stock nine, **F72 confirmed still true** |

**The 3 failing tests are pre-existing and unrelated.** Both suites are
`tests-main/execution-history/*` and every failure is `node:sqlite` missing:
this machine runs Node **v20.11.1**, and `require('node:sqlite')` throws
`ERR_UNKNOWN_BUILTIN_MODULE`. Nothing in this diff touches execution history.

**Not run, on instruction:** anything through `npx lerna exec --scope
noodl-editor` (`npm run test:ci`, `npm run dev:debug`) — those execute the
**primary checkout's** source, not this worktree's, and would have reported
results unrelated to this diff.

---

## Deviations from the spec, and why

### 1. The error tail comes from a ring buffer, not from `bugtracker.ts`'s log

§3 and "Current state" both lean on `bugtracker.ts` as the source ("The evidence
already exists and nobody is told"). Reading the mechanism, it cannot be:

- **The log file has no timestamps.** `bugtracker.debug`/`track` write
  `Info: …` / `Error: …` / `Stack: …` lines with nothing else. §3 asks for "the
  last few minutes"; that is not derivable from the file at all.
- **It is off in development.** `const enabled = !Config.devMode`, and
  `devMode: true` appears only in `config-dev.js`. So the file does not exist in
  the build anyone testing this feature is running.
- **The directory is hostile.** `PRIVACY.md` §5 (verified) records that
  `<userData>/debug/` also holds `git-*-merge-*.json` — whole project graphs
  written by the merge driver.

`errorTail.ts` therefore keeps its own bounded, timestamped, in-memory buffer of
`console.error` / `console.warn` / `error` / `unhandledrejection`, armed from
`router.tsx`. It deliberately does **not** touch `window.onerror`, because
`bugtracker` *assigns* that property and an assignment would silently replace
it.

Consequence for ALPHA-003: it inherits `redact.ts` as intended, but it does not
inherit a reader for the on-disk log — there isn't one, and the log's own format
is the reason.

### 2. Path redaction drops the remainder and collapses foreign paths

§3 says "the home directory to `~`; any path inside the project to
`<project>/…`". Implemented as `~/...` and `<project>/...` with the **remainder
dropped**, and anything under neither the project, the app, nor home collapsed
to `<path>`.

Rewriting only the prefix does not satisfy criterion 4. `/Users/rich/Clients/Acme/notes.txt`
becomes `~/Clients/Acme/notes.txt`, and the client's name is still on a public
issue. Inside the project it is worse: in the v2 format the file path *is* the
component name, which §3 lists as never-included. `<app>/…` keeps its
remainder — that is our own tree and the part of a stack trace anyone reads.

**Cost, accepted:** under a known root the match is greedy across spaces, so a
trailing unpunctuated word is swallowed with the path
(`reading /Users/x/y.json failed` → `reading ~/...`). Without that, a path with
a space in it leaks its middle segment — see "defects the fixture found" below.
There is a test pinning this so nobody "fixes" it by accident.

### 3. URLs are redacted, which the spec does not name

§3 lists credential shapes but not URLs. Criterion 4 requires "a backend
endpoint" not to appear, and an endpoint in a log line is a URL. Any
`scheme://host/…` collapses to `<url>` unless the host is on a short editorial
allow-list (github.com, docs.noodl.net, api.anthropic.com, localhost, …), in
which case the host survives and the path does not.

### 4. `appId` and friends are redacted

Not in §3's list. The hostile fixture surfaced it: a Parse request logs
`{"masterKey":"…","appId":"acme-legal-prod"}`. The key is obviously secret; the
application id names the reporter's client just as loudly, and §3's "never the
endpoint" is about not identifying someone else's backend.

Also added, beyond the spec: **email addresses** → `[redacted-email]`.

### 5. Severity is four levels

Open question 1 offers five or three. Four, because three collapses *blocks me*
into *serious* and that is the only distinction that changes what a maintainer
does today, while five asks a stranger to calibrate a scale they have never
seen. **Flagged for Richard** — changing the wording is cheap now (two files:
`bug_report.yml` and `issueForm.ts`, and a test enforces they agree) and
awkward once issues carry the labels.

### 6. The error tail is not duplicated into `diagnostics`

§4 says diagnostics is the join with Part B. The human-readable tail lives in
the `errors` field (`render: text`) and diagnostics carries `errorCount` only —
duplicating a 3KB tail into a 6KB budget would crowd out everything else. Both
fences are machine-locatable; the parse recipe for Part B is below.

### 7. `severity` appears in the diagnostics JSON as a slug

Not in §4's shape. Part B's labelling step should read `"severity": "blocker"`
out of the fence rather than string-matching dropdown prose that a copy edit can
change.

### 8. Native `<select>` in the composer, not core-ui's `Select`

See "possible defect, out of scope" below.

### 9. `PRIVACY.md` amended

The spec is explicit that §5 "stays true exactly as written" and no new promise
is made — and that is correct, the app transmits nothing. But §6 opens with
"These are every remaining request NodeGX makes", and a Help menu item that
opens a prefilled GitHub form containing diagnostics is a fact a reader of that
sentence would want. Added: a "Report a problem" subsection to §5, one clause in
§6's closing paragraph, and the `reports/` folder in §7. No promise is weakened;
`git diff PRIVACY.md` is three small hunks. **Revert if the orchestrator
disagrees** — nothing in the code depends on it.

---

## Could not verify — needs the live editor or a signed-in browser

Listed in the order I would check them.

### A. The GitHub prefill itself (§2's "do this first")

**Not verified, and not verifiable from here.** `github.com/…/issues/new`
redirects to `/login` for any request without a session cookie. I tried both an
anonymous fetch and one with `Authorization: token $(gh auth token)`; both
returned the sign-in page (the prefill values appeared only inside the
`return_to` hidden input). There is no `gh` API that renders an issue form.

**What to do — 30 seconds:**

```
node scripts/alpha-007/prefill-probe.js
```

It prints a URL and an eight-point checklist. Open it in a browser already
signed in to GitHub, check the list, close the tab without submitting.

The one that matters most is **the dropdowns**. If `Where`, `How bad is it`,
`Operating system` and `Does it happen in a brand-new project?` are all empty
while the text fields are filled, GitHub is not prefilling dropdowns and the
design changes — they would have to move into the body text. If only
`How bad is it` is empty, it is the em dash in the option strings, and both
sides need rewording (`issueForm.ts` `SEVERITY_OPTIONS` and `bug_report.yml`;
a test enforces they match).

The **durable** half of criterion 3 is done and green:
`tests-unit/alpha-007/issue-form-contract.test.ts` parses the real
`bug_report.yml` and asserts every id and every dropdown option string against
the editor's constants, so a rename on either side is a red test.

### B. Criterion 2 — the composer over an open menu

Asserted at the level a test can reach (the capture happens before the renderer
is told anything; the dialog has no `onClose` so a backdrop click cannot dismiss
it), but the visual claim needs doing, not reading:

1. Open an in-app popup — a node's property dropdown, or the components panel
   context menu.
2. Without closing it, use **Help → Report a problem…**.
3. The popup should still be there behind the composer, and the screenshot
   thumbnail in the dialog should show it.

Two specific risks I could not rule out:
- On macOS, opening the native menubar may blur the renderer and close the
  in-app popup by itself, before the capture runs. If that happens the menu item
  is not the right trigger for that case and the Help Center entry is.
- `PopupLayer` may dismiss on a document-level click. The composer's backdrop
  should swallow those, but a click *inside* the composer could still bubble.
  Only matters after the capture, so at worst it is cosmetic.

### C. Criterion 5 — Reveal in Finder, on three platforms

The bundle write and the `showItemInFolder` target are unit-tested; the actual
file-manager behaviour is not. Windows and Linux are unverified by anyone.

### D. Layering of the composer itself

`.dialog-layer > .Root` is `z-index: 666`; `.popup-layer` is `10`. Should be
fine. Not seen.

### E. The whole dialog, rendered

I have never seen it. Widths, the screenshot thumbnail's aspect handling, and
whether the "What gets sent" block scrolls rather than pushing the buttons off
the bottom, are all reasoned rather than observed.

### F. Criterion 1 — end to end from a packaged build, on two platforms

Not attempted. Needs a build and someone who did not write it.

---

## The Help Center addition — one block, for the orchestrator to apply

`views/HelpCenter/HelpCenter.tsx` is owned by a parallel ALPHA-006 agent and was
**not touched**. §1 wants an entry there too. Add this to the `items` array of
the `MenuDialog` (around the current `'Quick search docs'` entry), keeping the
divider that follows it:

```tsx
  {
    label: 'Report a problem…',
    icon: IconName.WarningTriangle,
    // ALPHA-007 §1: the capture must happen before the composer renders, so
    // this asks the main process to capture *and then* tell us to open —
    // exactly what the Help menu item does. Never open the dialog directly.
    onClick: async () => {
      setIsDialogVisible(false);
      const captured = await ipcRenderer.invoke('report-capture');
      openReportProblemDialog(captured);
    }
  },
  'divider',
```

with these imports:

```tsx
import { ipcRenderer } from 'electron';

import { openReportProblemDialog } from '../DialogLayer/components/ReportProblemDialog';
```

Two things to keep:

- `setIsDialogVisible(false)` runs **before** the capture, so the Help Center's
  own menu is not the thing in the screenshot. That is the opposite of the Help
  menu case and is deliberate: the reporter opened this menu on purpose, so it
  is not evidence.
- `IconName.WarningTriangle` — check it exists in that branch's `Icon`; if not,
  drop the `icon` key entirely rather than guessing.

---

## For Part B — how to read a report

```bash
gh issue list --repo The-Low-Code-Foundation/OpenNoodl --label needs-triage \
  --json number,title,labels,createdAt,author
gh issue view <n> --repo The-Low-Code-Foundation/OpenNoodl --json body -q .body
```

The body is GitHub's rendering of the form: `### <label>` then the value, and
`render:` fields inside a fence. Two regions are machine-locatable:

- **`### Diagnostics`** → a ` ```json ` fence. `JSON.parse` it. Always valid —
  when the URL budget bites, the object is *replaced* by a smaller valid one
  carrying `"truncated": ["diagnostics"]`, never cut.
- **`### Any error text`** → a plain fence, redacted, newest line last.

Diagnostics shape (`schema: 1`):

```json
{
  "schema": 1,
  "reportId": "r-20260803-142233-8f21",
  "capturedAt": "2026-08-03T14:22:33.000Z",
  "app":    { "version": "0.1.0", "buildNumber": "12", "packaged": true },
  "os":     { "platform": "darwin", "arch": "arm64", "release": "25.5.0" },
  "editor": { "route": "editor", "surface": "…", "document": "component" },
  "severity": "blocker",
  "project": {
    "open": true, "format": "v2",
    "components": 14, "nodes": 132, "connections": 98,
    "nodeTypes": { "Group": 20, "Text": 15, "<component>": 8, "<unknown>": 1 },
    "backendConfigured": true, "backendType": "parse"
  },
  "ai": { "configured": true, "provider": "anthropic" },
  "errorCount": 7,
  "truncated": ["errors"]
}
```

Reading it:

- `severity` is the slug to label from. `packaged: false` means a source build,
  which is a different animal from a packaged one.
- `project: null` means no project was open.
- `<component>` counts component instances; `<unknown>` counts node types the
  library could not resolve, which usually means a user module. Both are
  buckets, never names — do not expect to learn what the project contains.
- `reportId` names the folder on the reporter's machine
  (`<userData>/reports/<reportId>/`) holding the screenshot and the untruncated
  payload. If `truncated` is present, **ask for that folder** rather than
  guessing at what was cut.

---

## Defects the hostile fixture found (fixed here)

Both would have shipped on intent alone. Recorded because they are the argument
for criterion 4 being behavioural.

1. **A path with a space leaked its middle segment.** A path regex that stops at
   whitespace matches `/Volumes/Share/Acme Legal/rates.xlsx` only as far as
   `Acme`, leaving ` Legal` in the text — a leak assembled out of the very
   characters being redacted. macOS project directories have spaces constantly.
2. **`appId` survived.** See deviation 4.

And one design defect found while writing it:

3. **URL and path redaction cannot be two passes.** A URL rewritten first and
   then re-scanned comes out as `http<path>`, because `s:/` is
   indistinguishable from a Windows drive root. They are now one alternation.

---

## Possible defects found, out of scope

### core-ui `Select` inside a DialogLayer dialog may render its options behind it

`packages/noodl-core-ui/src/components/inputs/Select/Select.tsx:114` renders the
option list through `BaseDialog`, which portals into
`.dialog-layer-portal-target`. That element is styled `z-index: 666` in
`packages/noodl-editor/src/assets/css/style.css:289`; the DialogLayer's own root
is `z-index: 666` in
`packages/noodl-editor/src/editor/src/views/DialogLayer/DialogLayerContainer.module.scss:3`.
On a tie, later-in-DOM wins, and `router.tsx:49–57` appends the portal target
**before** the dialog layer — so anything a DialogLayer dialog opens through
`BaseDialog` should paint underneath it.

If true, every `Select` (and every `MenuDialog`) inside a `showDialog` dialog is
affected, not just this one. I could not run the editor to confirm, so the
composer sidesteps it with native `<select>` rather than "fixing" a global
z-index on a guess. **Worth ten seconds of live checking** — open any existing
DialogLayer dialog containing a Select. If confirmed it deserves a finding
number.

### `gh` label state

`needs-triage` and `node-library` still do not exist (re-verified today). F72
stands. `scripts/alpha-007/create-labels.sh` is written and syntax-checked;
**no `gh` write command was run.**

---

## The label commands, prepared and not executed

Exactly these, all with `--repo The-Low-Code-Foundation/OpenNoodl --force`:

| Label | Colour | Description |
|---|---|---|
| `needs-triage` | `D93F0B` | Filed, nobody has looked at it yet. This is the queue. |
| `node-library` | `1D76DB` | A specific node: wrong behaviour, missing port, bad default. |
| `severity:blocker` | `B60205` | The reporter cannot work around it. Ranks above everything. |
| `severity:serious` | `D93F0B` | There is a workaround, but it costs the reporter something. |
| `severity:annoying` | `FBCA04` | Wrong, but they can carry on. |
| `severity:cosmetic` | `C2E0C6` | Looks wrong, works fine. |
| `triaged` | `0E8A16` | Read, severity assigned, ready to be picked up. |
| `needs-info` | `BFD4F2` | Waiting on the reporter. Not their fault — ask a specific question. |
| `cannot-reproduce` | `CFD3D7` | Tried, could not make it happen. Say what you tried before closing. |

Run with `bash scripts/alpha-007/create-labels.sh` once Richard has agreed the
vocabulary. The first two are the F72 fix; the rest are the §6 additions the
severity field needs.

---

## Open questions the spec already lists, now with a position

1. **Severity scale** — four, phrased as consequences to the reporter. Reasoning
   in deviation 5. Cheap to change now.
2. **Bug only, or all three forms** — bug only. The composer hard-codes
   `bug_report.yml`; routing to the others means a type selector *before* the
   form, and the capture is only worth carrying for a defect. Retrofitting is
   one field id map, not a redesign.
3. **The non-GitHub address (criterion 7)** — **still open, and the composer
   says something vague because of it.** The "sent" screen currently reads: *No
   GitHub account? Send that folder to whoever gave you this build instead.*
   There is a `TODO(ALPHA-007 open question 3)` on it. This is the same decision
   ALPHA-005 owes for `PRIVACY.md` §12 and `TERMS.md` §11 — one decision, three
   places.
4. **Discord** — ~~untouched~~ **answered elsewhere.** Phase 39's POL-002
   (`d9c0f37c`) landed a NodeGX server, `https://discord.gg/dZw4w5pKf9`, in
   `noodl-core-ui/src/constants/externalLinks.ts`; the launcher footer and the
   editor's `?` menu both link to it. Corrected 2026-08-06 when this branch was
   merged, 215 commits after it was written.
5. **§8** — out of scope, untouched.
