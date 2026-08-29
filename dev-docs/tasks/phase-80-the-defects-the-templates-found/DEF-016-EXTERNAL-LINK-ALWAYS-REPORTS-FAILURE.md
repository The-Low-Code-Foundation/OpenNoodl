# DEF-016 — `External Link` reports Failure on every new tab it successfully opens

**Found by phase 18's EXP-011 Tier 2.5 drive, 2026-08-29 (session 41).** The node sets
`noopener` in its window features and then reads `window.open`'s return value as its
blocked-tab test. `window.open` returns `null` whenever `noopener` is set — by specification —
so the test can never pass. With the node's **default** settings, every successful open reports
`Failure`, sets `Error` to *"The browser blocked opening a new tab"*, and never fires `Done`.

## 1. The person sentence

**An author who wires `Done` to "we sent you there" and `Failure` to "we could not open that"
gets the second message every single time, on a link that worked.** The tab is open beside
them while the app tells them it was blocked.

## 2. The mechanism, in the node's own four lines

`packages/noodl-viewer-react/src/nodes/std-library/externallink.ts:50-52, 66, 70`:

```ts
const openInNewTab = this.getInputValue('openInNewTab');
const params = openInNewTab ? 'noopener,noreferrer' : '';        // :51  ← sets noopener
const target = openInNewTab === true || openInNewTab === undefined ? '_blank' : '_self';

const opened = window.open(link, target, params);                 // :66  ← always null now

if (target === '_blank' && !opened) {                             // :70  ← therefore always true
  this._internal.lastError = 'The browser blocked opening a new tab';
  this.reportOutcome(token, 'failure', { code: 'external-link/blocked', … });
  return;
}
this.reportOutcome(token, 'done');                                // :82  ← unreachable for a new tab
```

`Open In New Tab` defaults to `true` and `registerInput` seeds a declared default into
`_inputValues` (`node.ts:138`), so **the unset port takes this path**. This is the ordinary
configuration, not an edge case.

The `_self` path is unaffected: `params` is `''` there, and `:70` only tests `_blank`.

## 3. The evidence — a control pair that varies the features string and nothing else

Both arms are a **real user gesture** (`Input.dispatchMouseEvent` on an injected button;
a scripted `element.click()` is not a user activation and `window.open` is refused outside one,
which would have made both arms return `null` for a reason that has nothing to do with
`noopener`). Chrome 151, headless. Script: `probe-noopener.mjs` in session 41's scratchpad.

| arm | features | `window.open` returned | browser tabs |
|-----|----------|------------------------|--------------|
| A — what the node sets by default | `"noopener,noreferrer"` | **NULL** | 3 → **4** |
| B — the same open without it | `""` | **a Window** | 4 → **5** |

**A tab opened in both arms.** The only thing that changed is what the caller was handed back,
which is exactly what `:70` reads. 🔴 A single arm proves nothing here — arm A alone is equally
consistent with "the browser blocked it", which is precisely the reading the node makes.

Observed end to end in an exported build of the same graph: clicking the button opens a tab
**and** the app runs the `Failure` chain (`drive-links.mjs` row D4).

## 4. Why phase 30's audit did not find it

[`phase-30-node-library-audit/audit/navigation.md`](../phase-30-node-library-audit/audit/navigation.md)
graded this node's outcome ports ✅ on row B2, naming both failure codes —
`external-link/no-link` and `external-link/blocked`. It graded that the codes **exist**, never
that either can **fire**. The same audit did find the neighbouring `undefined` disagreement
between `:51` and `:52` and filed it, so this is not a gap in attention: a port census asks a
different question from a drive, and only the drive can answer this one.

## 5. The fix, and the decision inside it

The blocked-tab detection and `noopener` are **mutually exclusive by specification**; one of
them has to give, and which one is a decision rather than a patch:

- **Keep `noopener`, drop the detection.** `noopener` is a real security property — it denies
  the opened page a live `window.opener` handle back into the app. Dropping the `:70` branch
  means `Done` fires for every new tab and a genuinely blocked one is silent, which is the
  state NDA-004 §2/§3 added this branch to end.
- **Keep the detection, drop `noopener`.** Restores a working `Failure` and hands the opened
  page a handle back. A security regression for a diagnostic.
- **Keep both, detect differently.** `window.open` with `noopener` gives the caller nothing to
  test, so detection has to come from elsewhere — a `document.visibilityState` or `blur` probe
  shortly after the call. Heuristic, and worth measuring before choosing.

⚠️ **Whichever way it goes, `Done`'s description is currently wrong** — it says *"Fires once
the link has been handed to the browser"*, and it does not.

## 6. What it does **not** block

**Nothing in phase 18.** The code export reproduces this faithfully and deliberately:
EXP-011 §11.3's standing rule is that the export must not work *better* than the app it came
from, and a divergence here would be the one class of difference a drive cannot catch. The
exported app is wrong in exactly the way the interpreter is wrong, and it stops being wrong
the moment this row is fixed — no export change is owed.

## 7. Acceptance criteria

1. A new tab opened with the node's default settings fires **`Done`**, not `Failure`.
2. `Error` is not set on that path.
3. Whatever the ruling in §5, the `Done` and `Failure` descriptions say what actually happens.
4. A test that would have caught this — one that asserts the **outcome**, not the port set.
   ⚠️ It cannot be a unit test against a stubbed `window.open` that returns a truthy object:
   that stub is the bug's blind spot. It has to return what a real `noopener` open returns.
5. The `_self` path still reports `Done`, and a genuinely empty link still reports `Failure`.

## 8. Owner

**`NONE` — unowned, and open.** Phase 18 found it and cannot take it: this is a runtime node,
and phase 18 is the code export. It is recorded here so it is not rediscovered at full price by
whoever next drives the Navigation group.
