# File Upload

A file, from the disk it is on to a URL you can link to.

```
Idle ──click──> Picking ──file chosen──> Uploading ──> Done
 ^                 │                         │          │
 └───cancel────────┘                         └──> Failed┘
                                                   │
                                       Try again ───┘
```

`Open File Picker` → `Upload File` → `Cloud File`, wired end to end with the
three things a real upload needs and a bare chain does not have: something to
look at while it works, a number that moves, and a sentence when it does not.

## What comes out

| Output | When |
|---|---|
| `Uploaded` | The file is stored. Fires once. |
| `Cloud File` | The stored file, ready to wire into a record property. |
| `URL` | Where it can be fetched from. On a **private** upload this needs a `Sign File URL` node before it works. |
| `File Name` | The original name, with the storage prefix stripped. |
| `Failed` | Any of the three ways this can go wrong — too big, picker refused, backend refused. |
| `Error` | Why, in one sentence. Empty until something fails. |
| `State` | `Idle` / `Picking` / `Uploading` / `Done` / `Failed`, for anything outside that wants to follow along. |

| Input | What it does |
|---|---|
| `Accepted File Types` | Whatever `<input accept>` takes — `".csv, .png"` or `"image/*"`. Filters the dialog **and** rewrites the hint line, so the zone says what it takes. |
| `Max Size MB` | Checked in the browser before a byte is sent. Default 10. |
| `Hint` | Overrides the generated second line. |
| `Private` | Stores the file readable only by whoever uploaded it. |

Nothing is required. Placed and left alone it is a 10 MB, any-file drop zone.

## Where you go to finish the wiring

Two of the five backends cannot store a file without being told **where**, and
neither value can be guessed. Select the **Upload** node inside the component:

* **Supabase** — fill `Bucket`, and `Path` if you want something other than the
  file's own name.
* **PocketBase** — fill `Collection` and `Field`.

NodeGX, Parse and Directus ignore all five. They are ports on the node rather
than inputs on this component on purpose: an Upload File with them blank is a
file with nowhere to live, and that is worth seeing on the node that needs them.

## The `To CSV` dead end this sits next to

`To CSV` builds a CSV string and there is nothing in the product that will hand
it to a user as a file. This prefab is the way out, and it does not need the
picker to do it: `Upload File`'s `File` port takes any `File`, so a one-line
Function —

```js
Outputs.File = new File([Inputs.Csv], 'export.csv', { type: 'text/csv' });
```

— wired at `Upload.File` and pulsed at `Upload.Upload` gives you a `Cloud File`
whose `URL` is a link that downloads. The panels here follow it the same way
they follow a picked one, because they are driven by the state machine and not
by the picker.

## Five things that look right and are not

Every one of these was decided against the node source, not guessed.

**A Function's signal outputs do not survive a project loaded from disk.**
`NodeModel.createFromExportData` reads a node's `ports` and never its
`dynamicports`, so `model.outputPorts` is empty outside the editor and
`_isSignalType` answers no — which means the callable is never built and
`Outputs.Accept()` throws *"is not a function"* in a viewer. The size check
therefore publishes a **boolean** (`Fits`) that a `Condition` tests, and the
`Condition` is pulsed by the picker's own `Done`.

**And that second half is not belt-and-braces.** `Outputs` publishes only on
*change*. Wire the verdict straight at `to-Uploading` and the second acceptable
file re-writes `true` over `true`, reaches nobody, and the component sits in
`Picking` for ever. `Done` fires once per pick whatever the answer is, so the
pulse is the honest trigger and the boolean is only the answer.

**The boot run must not have an opinion.** Every Function runs once at load with
its inputs undefined, and `Condition` re-tests on every change of its input — so
writing `Fits = false` in the no-file branch would open the component in its
error state before anyone touched it. That branch writes the display values and
leaves `Fits` alone.

**`Upload File`'s byte counts do not reset between uploads.** They hold the
previous transfer's numbers until the first progress event of the next one
arrives, so a bar wired straight through opens the second upload at the first
file's 100% and walks backwards. The `Progress` Function reads `State` as well
as the percentage and zeroes itself on entering `Uploading`; `Seen` is its
memory of which state it last drew.

**The drop zone is one hit area, and the "Browse files" pill is a Group.** A
`Button` inside a clickable Group means one click reaches `Open` twice — and a
second `Open` supersedes the first, which the node reports as `Unchanged`, which
is wired at `to-Idle`. The component would bounce straight back out of `Picking`
on every click. The pill is `pointer-events: none` and the zone owns the click.

## Two things it does not pretend about

**`Cancel` is a real button, not decoration.** `<input type="file">` fires
`cancel` in current browsers and the picker reports it as `Unchanged`, which
returns the component to `Idle`. Where it does not fire — older browsers, and
anywhere the dialog is dismissed in a way the page never hears about — `Picking`
would be a dead end. The button is the way out that does not depend on the
browser telling the truth.

**The preview is a local object URL and is not revoked.** One per pick, released
when the page goes. It costs no round trip, which is the point: you see the file
before the upload has had a chance to fail.
