# The three Parse-era rows — re-tested 2026-09-11

COM-002 AC3 asks that every row written against the old Noodl Parse backend be re-tested or carry a
visible marker. This is the marker, and the re-test.

## 🔴 First, the correction: they are not dictionary rows

AC3 says *"Several rows are written against the old Noodl Parse backend and say so in their own
Notes column"*, and places that work in COM-002 — the phrasebook, which is built from
`bubble-dictionary/Bubble Noodl dict.csv`.

**That file contains ZERO such rows.** Searching all 94 records' Notes, `Noodl code` and every other
column for `parse`, `backend` or `cloud function` returns nothing. The three quoted strings are real,
and they are in **`Components.csv`** — the 29 community *components*, not the 94 dictionary
operators:

| # | component | what its Notes say |
|---|---|---|
| 20 | Get a cloud function to return all fields from a class object, even the ACL | *"Replace CLASSNAME with the exact class name from your Parse database. **This only works with the Noodl Parse backend.**"* |
| 22 | You want to bulk add or remove relations | *"**Only works in back end cloud functions using the Noodl Parse back end**"* |
| 26 | Return all child records of a parents relation field | *"**NB: This only works as a cloud function**"* |

So the phrasebook itself has no Parse-era rows to mark. The three that exist belong to the corpus's
component half, which is COM-003's and COM-005's material — hence this file, beside them.

## The re-test: "Parse backend" is not a death sentence

The obvious reading of those notes is that the three are dead. **They are not.**

`packages/nodegx-backend-contract/src/descriptors/parse.ts` ships a Parse Server descriptor, and its
own header says it is *"kept as a preset by decision, not by inertia: projects exist that point at a
real Parse Server, and the wire is one we already speak"* — with cells marked `PROBED` against
`parseplatform/parse-server:7.3.0` running on the rig. Cloud functions are equally alive:
`library/prefabs/email-verification` ships twelve `/#__cloud__/…` components today.

**So the accurate marker is not "obsolete" but "needs a Parse-compatible backend".** What died was
Noodl's *hosted* Parse service — the SaaS somebody else ran — not the wire, not cloud functions, and
not these three snippets.

⚠️ **What is still unverified, and what a re-test would have to do.** None of the three has been
*run* against a live Parse Server; the claim above is that the backend they need is still supported,
which is a different and weaker claim than "these snippets work". Row 20 reaches for an ACL through
a `CLASSNAME` placeholder and row 22 writes relations in bulk — both touch the exact area
`parse.ts`'s header records as having been **wrong in three cells when transcribed from the
documentation rather than probed**. Anyone landing these owes them a drive against the rig's `parse`
profile, not a reading.

## What this means for whoever takes COM-003 or COM-005

Mark them, do not delete them, and do not promise them. A community snippet that needs a
Parse-compatible backend is a fair thing to publish with that sentence attached; it is not a fair
thing to publish silently, because the reader cannot tell a snippet that needs a particular backend
from one that works anywhere.
