# DEF-003 — Three ordinary authoring acts with no honest surface

**Rank 3.** Sources: phase 77 **D8** = phase 76 **F15**; phase 77 **D7**; phase 76 **F16**. All
**NONE**-owned.

Three unrelated-looking rows with one shape: **a builder does an ordinary thing, the product accepts
it, and it does not mean what it says.**

## 1. (a) A bare number on a dimension port silently means *percent*

**Confirmed at HEAD**, `packages/noodl-viewer-react/src/react-component-node.ts:1925`:

```ts
if (typeof value !== 'object' && type.defaultUnit) {
  value = { value, unit: type.defaultUnit };     // 240  →  { value: 240, unit: '%' }
}
```

So `width: 240` renders as `240%`. The object form is the fix and the door refuses the bare form —
but *"easy to write, hard to see"* is the whole of it.

🔴 **Two phases found this independently and neither gave it an owner**, and neither knew about the
other: phase 76 recorded it as **F15** (s6, *"a bare number on a dimension port being read as a
percentage"*) and phase 77 re-recorded it as **D8** (s9). **That is what an unowned row costs — it
gets rediscovered instead of fixed.**

## 2. (b) `Text` has no padding and no `borderRadius`

**Confirmed at HEAD** through the door — `get_node_type("Text", ports: [...])`:

```
"notFound": ["paddingLeft", "borderRadius"]
```

`text.ts:149-157` calls `addMarginInputs(TextNode)` and no padding or border equivalent. So a padded
label needs a wrapping `Group` — every time, for every author, with nothing saying why.

## 3. (c) A page title cannot be set without an editor attached

Recorded in phase 76 as **F16**, *"a `Page` node's `title` port is dead after export"*. At HEAD it
is **worse and more precise**:

```
"notFound": ["title"]
"runtimeBehavior": "`title` and `urlPath` are registered per instance
                    by the editor connection"
```

🔴 **The port does not exist unless an editor is attached.** It is not that the title dies at export
— it is that **an agent authoring headlessly cannot set a page title at all**, and the door reports
it as an unknown port rather than as a limitation. The workaround (`Noodl.SEO.setTitle`) was found on
the template **whose product is SEO**.

## 4. Scope

Each of the three is a separate decision, and the task is to take all three rather than the cheapest:

1. **(a)** Either refuse a bare number on a units port at the door with a message naming the object
   form, **or** make the editor show the implied unit. ⚠️ **Do not change the coercion** —
   `defaultUnit` is load-bearing for every existing project, and silently reinterpreting `240` as
   `240px` would move every graph in the corpus.
2. **(b)** Add padding and `borderRadius` to `Text`, **or** state the omission in the node's own
   description so the `Group` wrapper reads as the design and not as a workaround.
3. **(c)** Register `title` and `urlPath` from the **component definition** rather than the editor
   connection, so a headless author can set them. If that is not possible, the door must say
   *"`title` is editor-only, use `Noodl.SEO.setTitle`"* instead of `notFound`.

## 5. Acceptance criteria

1. **A person's sentence:** *when I set a width, a padding or a page title, either it does what I
   asked or the thing I am building tells me why it cannot.*
2. **(a)** A bare number on a units port produces a **named** diagnostic or a visible unit — and the
   object form still works unchanged. A regression arm over the existing corpus proves nothing moved.
3. **(b)** `paddingLeft`/`borderRadius` resolve on `Text` **or** `Text`'s description names the
   limitation and the vocabulary teaches the `Group` wrapper.
4. **(c)** A page authored **headlessly** carries a title into the deployed HTML `<title>`, driven —
   not asserted from source. ⚠️ **Verify the consequence, not the mechanism**: a `toContain` over
   source text passes on dead code.
5. Each of the three has a **known-broken arm** in the suite.

## 6. Traps

- 🔴 **This row already proved that recording is not fixing.** If any of the three is deferred,
  it must be deferred **with an owner**, not returned to a register.
- ⚠️ **`Text`'s ports are contextual** — the catalogue says *"explicit width/height ports appear
  only in the matching size mode… treat the catalog's list as the superset the editor filters."*
  A `notFound` from one query is not proof of absence in every mode. Check the mode you mean.
- 🔴 **(c) is read from the door, not driven.** The claim that a headless author cannot set a title
  is a catalogue reading. **Drive it before building the fix** — and if it turns out an editor
  connection is present in the path that matters, the row shrinks to a documentation fix.
