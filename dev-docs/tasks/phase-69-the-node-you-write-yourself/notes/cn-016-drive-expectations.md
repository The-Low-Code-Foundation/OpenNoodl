# CN-016 — what I expect to observe, written BEFORE the drive

**2026-08-18, s32.** A drive can pass on a broken feature, so this is written and
committed before the editor is launched. Anything the drive reports that is not
predicted here is either a defect or a correction to this file, and both are
worth more than a green tick.

## A. AC5 — build the caller (install → place → deploy → load)

1. `library:verify-dist --serve --port 3000` serves the **built artefact**, and the
   editor picks it up as its content endpoint (`main.js` probes
   `127.0.0.1:3000/<major.minor>/version.json` for `kind: 'noodl-docs'`).
   🔴 If the editor instead reads the real origin, the install is not from the
   artefact and AC5 is not met — D21 forbids satisfying AC1/AC5 from a local
   folder that merely resolves, and this is the same trap wearing a port number.
2. The Library panel's modules tab lists **Example Node Kit**, with an enabled
   Install button (`minEditorVersion 0.1.0` ≤ editor `0.1.7`).
3. After install, the open project's directory contains
   `noodl_modules/example-node-kit/` with `manifest.json` and `index.js`.
4. `noodl_modules/kit-provenance.json` records the module with
   `origin: 'installed'` and the `127.0.0.1:3000` URL. **Not** `origin: 'local'`.
5. The node picker offers the kit's node; placing it puts a node on canvas with
   **zero uncaught console errors**.
6. Deploying to a folder copies `noodl_modules/example-node-kit/index.js`
   **verbatim** into the deploy output.
7. Loading the deploy over HTTP renders the placed node without the kit failing
   to load.

## B. CN-017's two undriven surfaces

Both render from `describeKitOrigin`, so **a disagreement between them is a real
defect, not a styling nit**.

8. Settings → Kits: the row for a kit **scaffolded in this project** reads
   **"written here"** at `[data-test=kit-origin-<dirName>]`.
   🔴 It must **never** read *"origin not recorded"* — that is the string
   `describeKitOrigin` returns for `undefined` provenance, and a scaffolded kit
   has a `local` record written by `createNodeKit`.
9. Property panel, with one of that kit's nodes selected:
   `[data-test=node-provenance-origin]` reads `· written here` and the byline
   names the kit.
10. For the **installed** kit from step 3, both surfaces read
    **"installed from 127.0.0.1"**, and agree with each other.

⚠️ `BaseDialog` renders every dialog twice — filter
`:not([class*=MeasuringContainer])` on any dialog query, or every count doubles.

## C. s29's undriven fix — a kit broken two ways

11. Break a kit two ways and read the two Settings → Kits rows:
    (a) `manifest.json` names a `main` that is not on disk;
    (b) `main` is present but registers **zero** nodes.
12. 🔴 **Neither row may say a kit is "only PARTIALLY registered" when it
    registered nothing.** Partial means *some* — a kit that registered zero nodes
    described as partially registered is a diagnostic that lies in the exact
    place a user goes to find out what went wrong.

## What would make me say the drive FAILED rather than found a defect

- The editor reads the real origin rather than the local artefact server (A1).
- No editor at all: a launch that wedges, or a peer holding the stack.
  In that case AC5 stays open and is named as the only outstanding criterion —
  it is **not** markable from unit tests.
