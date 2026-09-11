# Form

You describe the fields; the Form builds them, holds the values, shows the
errors and tells you when a submit was valid.

```
Full name          ┌──────────────────────────┐
                   │ Ada Lovelace             │
Email              ├──────────────────────────┤
                   │ ada@example.com          │
Plan               ├──────────────────────────┤
                   │ Free                   ▾ │
What are you       ├──────────────────────────┤
building?          │                          │
                   └──────────────────────────┘
Updates            ☐ Email me when a release ships
```

Out of the box it renders those five sample fields, so you see what it is the
moment you drop it on a page.

## Feeding it your fields

The `Controls` input is an array of plain objects, one per field:

| Property | What it does |
|---|---|
| `Type` | Which control to build — `Text Input` (the default), `Text Area`, `Drop Down`, `Checkbox`, `Single Choice`, `Multi Choice`, `Slider`, `Date Input` |
| `Label` | The words above the field |
| `Property` | The key this field reads and writes on the form's value object — this is what ties a field to your data |
| `Value` | What the field starts out holding. Descriptor keys are copied over the control last, so this wins over the form's stored value |
| `Placeholder` | Text Input / Text Area |
| `InputType` | Text Input — `text`, `email`, `number`, `password`, `url` |
| `Text` | Checkbox — the sentence beside the box (the label above it stays `Label`) |
| `Options` / `Labels` | Drop Down, Single Choice, Multi Choice — the values, and optionally the words to show for them |
| `Min` / `Max` / `Step` | Slider |

Two ways to supply it:

1. **Connect the `Controls` input** to any array — a Static Data node of your
   own, a Function output, a schema you fetched. A non-empty connected array
   wins over the built-in samples.
2. **Edit the samples**: inside the **Form** component, the **Sample fields**
   Static Data node holds the demo JSON.

## Inputs and outputs

| Input | What it does |
|---|---|
| `Controls` | The field descriptors above. |
| `Object Id` | An existing object to edit. Unset, the Form creates one and reports its id, so the same graph does create and edit. |
| `Errors` | An array of `{ Property, Error }`. A field only shows its error once it has been edited — until then the form is not scolding you for fields you have not reached. `Submit` shows all of them. |
| `Submit` | Signal. Validates against `Errors` and fires one of the two outputs below. |

| Output | When |
|---|---|
| `Valid Submit` | `Submit` fired and no error matched a field on this form. |
| `Have Errors` | `Submit` fired and something did. Every error becomes visible at that moment. |
| `Object Id` | The id of the object holding the values — wire it at a Set Record / Create Record. |
| `Value Changed` / `Property` | A field was edited, and which one. |

## Things worth knowing before you change it

**The fallback is a Function, not a default.** `Choose controls` takes the
connected array and the samples and picks: a connected array with anything in
it wins, an empty or absent one falls through. That is what makes the samples
vanish the instant your data arrives rather than fighting it.

**Static Data hands over records, not plain objects.** `Choose controls`
flattens each row before passing it on, because `Build controls` copies
properties off the descriptor by name and a Noodl record answers those through
a proxy rather than as own keys. Both sources therefore reach that script in
one shape.

**A control's words live on the control.** The Checkbox sets `Enable Label`
and takes its sentence through the control's own `Label` port, so the words
render as a real `<label>` wired to the input and tapping them toggles the box.
A `Text` beside a checkbox is not a click target — the hit area is the 24px
square, and that is WCAG 2.2 SC 2.5.8's floor and nothing more. Text Input and
Text Area also have `Enable Label` on now; before that their `Label` was wired
and invisible, and every text field in the form rendered unlabelled.

**A Drop Down needs a declared height, and the symptom does not look like one.**
The Options control's content is a single `<span>` that is empty until something
is selected, so under a content-driven size mode the wrapper measures **zero**
— and because that control opts into a default `solid 2px #000000` border
(unlike Text Input, which defaults to `none`), the collapse renders as a **4px
black rule across the field**. It reads like a broken node or a missing style;
it is a missing height. This one is `Size Mode: Explicit` with a real 40px,
which is what the two Dropdowns elsewhere in this library already do.

**A throw is reported against the node that *emitted*, not the node that threw.**
This form spent two measured rounds on one error:

```
JavaScriptFunction (/Form/Set Form Value): The script threw:
Cannot set properties of undefined (setting 'Name')
```

Nothing in `Set Form Value` was wrong. `Noodl.Events.emit` dispatches
**synchronously** (`events.js` calls each listener with `ReflectApply`, it is not
a queue), so the listener's stack frame sits inside the emitting script and its
throw unwinds into *that* node's `try`. The actual write was
`Component.Object.HaveValues[ev.Property] = true` in **`Receive Value Changed`**,
a different component, and `'Name'` was the first field's `Property` rather than
anything about a form value.

`HaveValues` is created by the initialiser on the root Group's **Did Mount** —
and a repeated control mounts *before* its parent Group does, so the first
field's value reaches the listener while the map is still undefined. It is
created lazily there now. `Build controls` had guarded this same property with
`|| {}` from the start; the listener was the copy that forgot, which is the
usual shape — one defensive reader and one that trusts an ordering nobody
wrote down.

The lesson for anyone reading a Noodl stack trace: **the component in the
message is where execution was, not necessarily where the bug is.** Search for
the *written property*, not for the reported node.

**`Set Form Value` also runs during mount**, because its `Value` input changes
before anybody types — `Do` is an additional trigger, not a replacement for one.
`Component.RepeaterObject` and `Component.ParentObject` are guarded there for
that reason.

**Adding a control type** means adding a component under `/Form` named exactly
for the `Type` string — the repeater's template script resolves `'./' + item.Type`
— giving it a `Model2` for the properties it reads, and ending its edits at a
`Set Form Value`.
