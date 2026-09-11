# Defects the community corpus found

**Filed 2026-09-11, COM-003 session 4.** Every row here was found by running a gate or a runtime
over an artefact the community shipped, never by reading one. Each says who owns it, and none of
them is owned by phase 86.

> 🔴 **The corpus finds these because it is old.** These graphs and snippets were written against
> the product as it was years ago and have not been touched since. That makes them a fossil record:
> anywhere they diverge from today's product is either a mistake they always had, or **a change we
> made without carrying anyone across**. D1 is the second kind, and it is the one worth having.

---

## D1 🔴 — Renaming a built-in node's port breaks every project that wired it, silently

**Owner: the runtime (nominated).** Not phase 86.

### The measurement

COM-003's task file opened with a confident reading, and it was **wrong**:

> *"the Dropzone graph — shared for years — wires `Open File Picker.success`, and there is no such
> output. […] this is the community graph being wrong (or predating a rename), not the product."*

The parenthetical is the true branch. `success` was a **real port**, from the repository's initial
commit until six weeks ago:

```
git log --follow -- packages/noodl-viewer-react/src/nodes/std-library/openfilepicker.ts
  b9c60b07d  Initial commit                       success: { type: 'signal', displayName: 'Success' }
  …
  fb14c17be  2026-07-30  NDA-012/NDA-005          success  still present
  a139a3ce5  2026-08-02  erg-001 §4               success  REMOVED, replaced by done/unchanged
```

`a139a3ce5` — *"the small non-Data remainder — seven nodes, four renames, one dead chain closed"* —
renamed it as part of the outcome contract, with a good reason, stated in its own commit message:
`success` *"has a single caller reached only from the action port, so [it] **is** the invocation's
outcome"*. **The rename is right. The migration is what is missing.**

### What ships, and what does not

ERG-001 carefully updated **our** artefacts — four catalog examples, `library/modules/image-cropper`,
the enrichment entries, four specs. It shipped nothing at all for **projects already on disk**:

| | present? | checked |
|---|---|---|
| back-compat alias (`success` still accepted) | ❌ | `grep -rn "deprecatedPorts\|portAliases\|legacyPort"` over the runtime — no such registry exists |
| project-load migration for built-in port renames | ❌ | the only `renamePortWithName` is `NodeGraphNode.ts`, and it is for **component** ports a user renames by hand |
| a warning naming the rename | ❌ | the connection simply refers to a port that is not there |

So a project that wired `Open File Picker.success` before 2026-08-02 now holds a wire to a port that
does not exist. **Four ports moved in that one commit** — `Send Event.sent`, `Unique Id.generated`,
`Open File Picker.success`, `Send Email.sent`/`failed` — and ERG-001 is one of *seven* times its own
message says this rule was applied.

### Why it is worth a row rather than a shrug

The failure is silent and it is shaped like nothing. A signal that used to fire stops firing; no
error, no console line, no Problems entry naming the rename. The person's app simply stops
uploading, and the one thing that would explain it — *"this port was called `success` until
2026-08-02"* — exists only in a commit message.

⚠️ **This is exactly the migration story a 0.2.x product needs before it has users, not after.**
The community corpus is the only reason we know, and it knows only because it is old enough to
predate us.

### Suggested shape of a fix (not designed here)

A rename table the runtime consults when resolving a connection — old name → new name, with the
commit that moved it — that re-points the wire and reports once per project with the rename named.
The same table documents the change for humans and gives `catalog:examples` something to check
against. **Deciding this is the runtime's call, not phase 86's.**

---

## D2 ⚠️ — An `Expression` whose text ends in a `//` comment does not compile

**Owner: the runtime (nominated). Found by COM-002, recorded here so the corpus's defects are in one
place.** Full write-up: [`COM-002`](COM-002-THE-BUBBLE-PHRASEBOOK.md) §7.

`expression.ts` wraps the body as `return ( text );` on **one line**, so a trailing `//` comment
swallows the closing `);` and it dies with `Unexpected token '}'` — naming nothing the author wrote
and never mentioning comments. `grep` finds no test covering it. The fix is a newline before the
`);`, and it wants a spec beside it.

🔴 Three community rows are written that way, which is how we know they have **provably never been
run**.

---

## D3 — The community's Repeater input-mapping snippet does not compile

**Owner: nobody — it is a community artefact, not ours. Recorded as evidence, and closed.**

`corpus/components/Input mapping for re…` is the canonical answer people were given for mapping item
values onto a Repeater's item-component inputs. **Executed rather than read:**

```js
new Function('map', 'object', <the snippet verbatim>)
  → SyntaxError: Unexpected identifier 'ComponentInputPortName3'
new Function('map', 'object', <the same with one comma restored>)
  → compiles
```

One missing comma, after the second mapping. The snippet is otherwise **correct** — and notably its
`function() { return object.get(…) }` form, which looked like a reference to an undeclared variable,
is right: `foreach.tsx` builds the function as `new Function('map', 'object', script)`, so `object`
really is in scope. ⚠️ **Two accusations, one true and one false, and only executing them told them
apart** — the same lesson COM-002 recorded when two of its accusations against the community table
turned out to be wrong.

✅ **Closed by documenting the facility**, which is what the snippet was standing in for: `For Each`'s
`inputMappingScript` port now has an enrichment note describing the `map({...})` call, both mapping
forms, the pre-filled identity mapping and the fact that a script which does not compile maps
**nothing** and reports `repeater/input-mapping-syntax-error`. It is a **dynamic** port — sent by
`sendDynamicPorts` once a template component is set — which is why the generated catalog does not
carry it and why nothing described it before.

---

## D4 ⚠️ — A `setTimeout(…, 50)` in the community's dropdown recipe, unexplained

**Owner: unmeasured. Filed as a question, not a defect.**

`corpus/components/Multiple dropdowns w…` maps records onto `{Label, Value}` for a dropdown and then
does this:

```js
Outputs.EmployeesMounted = false;
setTimeout(function () {
  Outputs.EmployeesMounted = true;
  Outputs.MappedObjects = mappedObjects;
}, 50);
```

A 50 ms delay between publishing the items and announcing they are ready is the signature of a
**mount-ordering workaround** — the author is waiting for something to exist before feeding it. It
may describe a real ordering defect, or a product that has since changed, or a misunderstanding.

🔴 **Nothing here measures it, and this row does not claim it is a defect.** It is filed because a
magic delay in the most-copied dropdown recipe in the community is worth one hour of somebody's
attention, and because an unowned observation gets rediscovered at full price. The measurement to
take: feed a `Dropdown`'s `items` on the same frame as its mount and see whether the options appear.
