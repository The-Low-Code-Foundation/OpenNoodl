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

## 5. The fix — measured, and no longer a three-way ruling

The blocked-tab detection and `noopener` are mutually exclusive **as the node writes them today**:
one reads a return value the other guarantees to be `null`. That framing offered only bad trades —
give up the security property, or give up the diagnostic.

**There is a fourth option, and it was measured rather than reasoned about.**
`navigator.userActivation.isActive` is the condition the browser itself uses to decide whether to
allow the open, and it is readable *before* the call, where `noopener` has not destroyed anything.

### 5.1 The measurement

Chrome 151, headless, against the exported app. Script: `probe-activation.mjs`, session 41's
scratchpad. `typeof navigator.userActivation === 'object'`.

| arm | `isActive` | `window.open` returned | tab actually opened |
|-----|-----------|------------------------|---------------------|
| no user gesture | **false** | NULL | **no** — 1 → 1 |
| real user gesture (`Input.dispatchMouseEvent`) | **true** | NULL | **yes** — 1 → **2** |

🔴 **`isActive` separates exactly the two cases the return value can no longer separate.** The
return value is `NULL` in both rows and is therefore worthless; `isActive` differs in both rows and
tracks what actually happened. That is the discrimination the `:70` branch was written to make.

### 5.2 The recommended change

Keep `'noopener,noreferrer'` exactly as it is. Replace the post-hoc return-value test with a
pre-flight activation test, and let a `_blank` open that passes it report `done`:

```ts
const opened = window.open(link, target, params);

// `noopener` makes `opened` null on success as well as on failure, so it cannot be the test.
// `navigator.userActivation` is the condition the browser itself applies, and it is readable
// here. Absent (older Safari) ⇒ no claim is made, which is the honest degradation: `done`.
const activation = typeof navigator !== 'undefined' ? navigator.userActivation : undefined;
if (target === '_blank' && activation !== undefined && !activation.isActive) {
  this._internal.lastError = 'The browser blocked opening a new tab — this usually means the link was not opened directly from a user action';
  this.flagOutputDirty('error');
  this.reportOutcome(token, 'failure', { code: 'external-link/blocked', … });
  return;
}
this.reportOutcome(token, 'done');
```

⚠️ **Check `navigator.userActivation` in Safari before landing.** The measurement above is Chrome
only. The `activation !== undefined` guard is what makes an absent API degrade to "report `done`"
rather than to "report `failure`" — the failure direction is the one that trains authors to ignore
the port, which is the mistake this row exists to undo.

⚠️ **This is a strict improvement, not a total one.** It catches the dominant cause — a graph that
fires the link outside a user gesture — and stays silent where a user has hard-blocked popups for
the site despite a gesture. Silent-on-the-rare-residue is the trade the node already makes for SSR;
**always-wrong is not a trade at all.**

### 5.3 Why not the other three

- **Keep `noopener`, drop the detection entirely.** Acceptable, and strictly better than today, but
  it discards a diagnostic that §5.1 shows is recoverable.
- **Keep the detection, drop `noopener`.** A security regression — the opened page gets a live
  `window.opener` handle back into the app — traded for a diagnostic §5.2 gets for free.
  ⚠️ `noreferrer` alone does not help: it *implies* `noopener` per spec, so the return is still null.
- **A `blur`/`visibilitychange` heuristic.** Timing-dependent and flaky, and unnecessary now that a
  declarative signal exists.

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
6. **Where `navigator.userActivation` is absent, the node reports `Done`, not `Failure`** — the
   guard degrades toward the claim it can still support. A test with the API stubbed away is the
   only way to hold this, and it is the one an implementer is most likely to skip.
7. ⚠️ **The code export's `External Link` translation is checked after this lands** — it emits the
   runtime's control flow deliberately (§6), so this fix makes it stale.
   `packages/nodegx-export/src/emit/component.ts`, `case 'external-link'`, and its 22 tests in
   `tests/external-link.test.ts`. It is a small edit, but it is **not** optional: leaving it makes
   the exported app diverge from the app, which EXP-011 §11.3 treats as the worst class of bug.

## 8. Owner

**`NONE` — unowned, and open.** Phase 18 found it and cannot take it: this is a runtime node,
and phase 18 is the code export. It is recorded here so it is not rediscovered at full price by
whoever next drives the Navigation group.
