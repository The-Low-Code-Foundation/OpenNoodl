# DEF-008 — The measurement owed

**Rank 8, and deliberately last.** Sources: phase 77 **D6**, phase 78 **D5**.

🔴 **This is not a fix owed. It is a measurement owed** — and it is in the phase so that a row whose
*cause was disproved* does not quietly become a row that was *closed*.

## 1. `maxWidth` on `Text` — the cause is refuted, the symptom is not explained

Phase 77 **D6** says *"`maxWidth` is **inert on `Text`** — authored, driven (`computed: none`),
removed."*

**Refuted at HEAD, 2026-08-29**, through the door a builder uses:

```
get_node_type("Text", ports: ["maxWidth"])
→ "name": "maxWidth", "group": "Dimension Constraints",
  "type": { "name": "number", "defaultUnit": "%", "units": ["%","px","vw","vh"] }
```

The port **is declared** and the door knows it. `addDimensions`'s `useDimensionConstraints` defaults
to **`true`** (`node-shared-port-definitions.ts:755`) and **no node in the repository passes it at
all**, so every visual node gets the constraint ports.

🔴 **And the platform did not move under the row.** `node-shared-port-definitions.ts` was last
touched **2026-08-08**, three weeks *before* D6 was measured. The port was declared when D6 was
measured too. **The row's cause is wrong, not stale** — which is a different thing and is why the
symptom still needs explaining.

**Two candidates, neither tested:**

1. **The `%` coercion of DEF-003(a).** A bare `maxWidth: 240` becomes `240%`
   (`react-component-node.ts:1925`), which is not `none` but is not what was wanted either — and on
   a full-width column would be invisible as a *change*.
2. **`Text`'s contextual port filtering**, which the catalogue announces itself:
   *"explicit width/height ports appear only in the matching size mode — treat the catalog's list as
   the superset the editor filters contextually."* `Text` sets `defaultSizeMode: 'contentHeight'`.

## 2. `net.noodl.user.LogOut`'s signal input is named `login`

Phase 78 **D5**. Severity low, and **unfixable in the obvious direction** — `logout.ts:67` says why.
Carried here so it is not rediscovered a third time; **no work is proposed**.

## 3. Acceptance criteria

1. **A person's sentence:** *when I set a maximum width on a piece of text, either it applies or I am
   told which of the two reasons stopped it.*
2. D6's symptom is **reproduced or not reproduced**, driven, with the value written **both ways** —
   bare `240` and the object form `{value: 240, unit: 'px'}`. 🔴 That pair is the experiment: if only
   the bare form fails, D6 is a duplicate of DEF-003(a) and closes into it.
3. If it reproduces in **both** forms, `sizeMode` is varied as the second arm.
4. The outcome is written back into phase 77's register **whichever way it goes**, including
   *"it works and D6 was wrong"*.

## 4. Traps

- 🔴 **A reading that FITS is not one that EXCLUDES.** Four candidate causes each fitted the SBR-015
  evidence and each was refuted. Both candidates above fit. **Vary one thing.**
- 🔴 **A control pair proves what you varied, only.** Bare-vs-object with `sizeMode` held constant
  says nothing about `sizeMode`.
- ⚠️ **Verify the consequence**: read the *computed* style, not the authored parameter. A
  `toContain` over source text passes on dead code.
- ⚠️ **A write is invisible in the same eval** — take the reading in a second call.
