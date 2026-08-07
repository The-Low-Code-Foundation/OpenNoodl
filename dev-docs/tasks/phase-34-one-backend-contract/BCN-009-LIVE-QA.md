# BCN-009 — live QA, complete

**Run 2026-07-31 from the primary checkout at `238199dd`.** All eleven steps of
[BCN-009-NOTES.md](./BCN-009-NOTES.md) §7, finishing what
[BCN-009-LIVE-QA-PARTIAL.md](./BCN-009-LIVE-QA-PARTIAL.md) started and had to abandon at step 2.

Driven over CDP against a real editor, with **real Directus, PostgREST and PocketBase servers**
from the [uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/) — the first time this panel
has been pointed at a third-party backend that actually answers.

**Every one of the eleven steps passes its stated assertion.** Three things the script does not
assert are wrong, and one piece of received wisdom about driving this UI is wrong.

---

## 1. The script, step by step

| Step | Assertion | Result |
|---|---|---|
| 1 | One section titled **Backends**, disclosure on every card, "Built-in • Port N" | ✅ |
| 2 | Six presets, Built-in selected, collapsed azure line, no fields, two buttons | ✅ |
| 2 | Disclosure expands to **two paragraphs**, collapses again | ✅ both directions |
| 3 | Supabase → RLS disclosure, four-field form appears | ✅ |
| 3 | Public API Key note reads *"Published with your app — every visitor can read this one"*, **no ⚠️** | ✅ exact, no glyph |
| 4 | Parse → form disappears, one button **Enter endpoint and app id** | ✅ |
| 4 | It closes the dialog and opens the endpoint form with its own disclosure | ✅ `backend-security-endpoint-form` |
| 4 | The tickbox swaps the disclosure Parse ↔ Built-in | ✅ **both directions**, see §2.1 |
| 5 | Inline name field, then a card reading **Built-in • Port N** not "Local SQLite" | ✅ "BCN009 QA / Built-in • Port 8579" |
| 6 | Started card's **Data** opens the record grid | ✅ opens the `backend-data` "Data Browser" panel |
| 7 | Directus card carries its disclosure; `⋯` → **Browse records** disabled with a reason | ✅ see §2.2 |
| 8 | Switch dialog, two columns naming what is published and where access is decided | ✅ |
| 8 | **No** `backend-switch-token-change` for Directus → Supabase | ✅ absent |
| 9 | Supabase → Directus, no note either | ✅ absent |
| 9 | → **Custom REST API** — the note **is** present | ✅ present, §2.3 |
| 10 | Confirm moves the ACTIVE badge and nothing else | ✅ |
| 11 | After a **relaunch**, list and active marker survive; disclosure is collapsed again | ✅ all three |

Cancelling the switch dialog leaves the active backend unchanged — also checked, also passes.

### 1.1 Two things that had never been done before

- **Test Connection against a real Directus succeeded** — *"✓ Connected successfully (203ms)"*.
  Every previous exercise of this panel used unreachable URLs.
- **The disclosure prose was read in place, rendered**, for four of the six backends.

## 2. The three assertions that passed, quoted

### 2.1 The tickbox really does swap the disclosure

```
checked   → "Your app publishes an app id, not a password."
unchecked → "Your app publishes the application id of your Parse server."
```

Toggled both ways. This is the case §7.4 exists to prove and it holds.

### 2.2 The disabled `Browse records` tooltip renders

It is **not** a `title` attribute — `MenuDialog` wraps the item in a `<Tooltip>`, so nothing is in
the DOM until a real mouse hovers it. Hovered with a synthetic `Input.dispatchMouseEvent`:

> Records on Directus are edited in its own admin, not from here. The editor can open the record
> grid for a backend it runs on this computer.

Exactly the sentence `dataBrowserAvailability` composes. Worth stating plainly because reading the
DOM alone says "no tooltip" and that reading is wrong.

### 2.3 The token-change note is not boilerplate

> This changes what your app publishes, and Rig Custom is your own API — so whether the token it
> publishes is safe for a stranger to hold is a question only you can answer.

Present for → Custom. Absent for Directus → Supabase **and** Supabase → Directus. The line
discriminates.

---

## 3. ⚠️ Three findings the script does not assert

### 3.1 Two cards say ACTIVE at the same time

With an endpoint backend configured **and** an external backend active, the panel shows **two
ACTIVE badges**, and nothing distinguishes them. Observed throughout, and it survives a relaunch.

The cause is one line:
[`CloudServicesEndpointSection.tsx:178`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/CloudServicesEndpointSection/CloudServicesEndpointSection.tsx#L178)
renders `ACTIVE` **unconditionally** whenever an endpoint is configured, while
[`BackendCard.tsx:115`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendCard/BackendCard.tsx#L115)
renders it on `backend.id === activeBackendId`. The two are independent, so both are true at once.

This is the **two-config-surface split this phase exists to end**, still visible after BCN-009
unified the panel's *appearance*. BCN-009's own notes record that step 2 — converging the metadata
keys — was out of scope, and this is what that deferral looks like on screen: a user cannot tell
which backend their app will actually use.

### 3.2 The endpoint card says ACTIVE for a backend that is stopped

The endpoint card read `Built-in • http://localhost:8578` / **ACTIVE** while the local backend on
8578 read **Stopped**. Same unconditional badge as 3.1: it reflects *"an endpoint is configured"*,
not *"this endpoint answers"*. A green-looking word for a port with nothing listening on it.

### 3.3 The first external backend activates without the switch dialog

Creating "Rig Directus" made it **ACTIVE immediately**. The second (Supabase) and third (Custom)
did not — they got a `Set active` button and went through the comparison dialog properly.

So the switch dialog — the whole point of which is that you see what changes about what your app
publishes *before* it changes — is skipped for the one case where the project goes from publishing
nothing to publishing a token. Defensible as "there was nothing to compare against", but it is the
largest single change in what the project publishes, and it is the one that happens silently.

---

## 4. ⚠️ The received wisdom about driving this UI is wrong, twice

Both of these cost time in this run and are recorded so they cost nobody else any.

### 4.1 `BaseDialog` renders every dialog **twice**, and `cdp click` targets the wrong copy

`BaseDialog` mounts a hidden **measuring** copy of its children (`opacity: 0`,
`pointer-events: none`, `height: 0`) alongside the real one, to size itself. So every
`[data-test]` inside any dialog matches **two** elements, permanently.

`cdp.js`'s `elementCentre` uses `document.querySelector` — the **first** match, which is always
the measuring copy. Its box is non-zero, so the "zero-sized box — is it hidden?" guard does not
fire. What happens next depends on the element:

- The preset cards happen to overlay exactly, so the click passes through to the real card and
  **works by luck**.
- The security disclosure's measuring copy sits **50px above** the real one. The click landed on
  empty space, the disclosure did not expand, and it looked exactly like a broken feature.

The fix is a selector that cannot match the measuring copy, because the real children are a
direct child of `VisibleDialog` while the measuring ones are nested one level deeper:

```
[class*=VisibleDialog] > [class*=ChildContainer] [data-test=whatever]
```

⚠️ **[BCN-009-LIVE-QA-PARTIAL.md](./BCN-009-LIVE-QA-PARTIAL.md) §3 attributes this doubling to
"two React trees coexisting across a reload".** That is wrong — no reload is involved, it is
permanent, and its advice ("do not file it as a defect") is right for the wrong reason. The
actionable half — *the first match is the one you must not click* — was missed.

### 4.2 `--target=dashboard` attaches to the preview window

The standing advice is *"use `--target=dashboard`, never `--target=editor`, which attaches to the
preview window"*. In this checkout that is **backwards**. `cdp.js`'s `KNOWN_TARGETS` has only
`editor` and `viewer`, matched by explicit URL:

```js
editor: '/src/editor/index.html'
viewer: ['/src/frames/viewer-frame/index.html', 'localhost:8574', 'Noodl Viewer']
```

`dashboard` is not a known name, so it is treated as a substring needle, matches nothing, and
falls through to *"the first page"* — which was the **NodeGX Viewer** window. `--target=editor` is
correct and unambiguous. The old advice presumably predates those explicit URL needles.

---

## 5. Could not verify

- **Narrow-width layout.** The panel was at its default width throughout, never 240px. Still open
  from §6.5, as it was after the partial run.
- **`IconName.QuestionFree`.** Renders as `?` in a circle; whether it reads as "help, click me"
  rather than "here is a fact" is unchanged from the partial run and is Richard's call.
- **Step 7's "confirm a deployed app resolves its backend from the unified metadata"** — needs
  BCN-009 step 2, which is not built.
- **The per-node backend picker's appear-at-two-backends rule** — needs BCN-009 step 4, which is
  not built. It is BCN-004 step 5.
- **PocketBase and Parse cards were never created.** Three of six preset types were exercised end
  to end (Directus, Supabase, Custom); Built-in was exercised as a managed backend.
- **Nothing was published.** Every claim about what an app "publishes" is read from the prose, not
  observed in a deployed bundle.
