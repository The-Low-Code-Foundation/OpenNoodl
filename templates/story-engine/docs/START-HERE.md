# Story engine

A branching story. Press **Run** and read it — every choice takes you somewhere, some choices
hand you something, and some only appear once you are carrying it.

There is no backend and **no library modules**. Nothing here needs an account, a key, a server
or an install.

## The only thing you have to change

Open the **Story/Source** component and find the node labelled
**"EDIT — your story — every passage, in this one list"**. It is a `Static Data` node holding
a JSON array, and **that array is the entire story**:

```json
[
  {
    "id": "hall",
    "title": "The hallway",
    "text": "Two doors. One of them is warm to the touch.",
    "choices": [
      { "label": "Open the warm door", "goto": "kitchen", "gives": "a brass key" },
      { "label": "Unlock the far door", "goto": "out", "requires": "a brass key" }
    ]
  },
  { "id": "out", "title": "Outside", "text": "You are out." }
]
```

Delete what is there, paste your own, press Run. **No new component, no rewiring, no code.**

## Four words, and there is no fifth

| word | what it does |
|---|---|
| `goto` | where a choice takes the reader — the `id` of another passage |
| `gives` | hands the reader something; it appears under **What you carry** |
| `requires` | the choice is **invisible** until they carry that thing — not greyed out, absent |
| *no `choices` at all* | that passage is an ending |

Every passage needs an `id` and they have to be unique. Everything else is optional.

## You do not have to open the editor at all

Run the app and go to **/remix**. The box there already holds the story that is playing, so you
can change a line or select it all and paste your own over it, press **Read this story**, and
it plays immediately. If what you paste is wrong it tells you what is wrong with it — which
passage, and what it was missing — rather than showing you a blank page.

## How it works, in the graph

Worth ten minutes if you came here to learn NodeGX rather than to read a story.

- **`Story/Source`** is the one place the story lives, and it decides whether
  you are reading the shipped one or one somebody pasted. Both pages place it.
- **Every decision is a `Condition` node** you can open and follow: is there a passage with
  that id, is this an ending, did that choice give you something new, is there any way on from
  here, is what was pasted a story.
- **`Story/Choice`** publishes what was clicked to the repeater that drew it, which is how
  a row tells a page something. Look at `Pages/Read` for `itemOutputSignal-picked` beside
  `itemOutput-goto` — the signal and the value come off the same node.
- **`Story/Passage`** is a `States` node with three states — reading, an ending, a passage that
  is not there — driven by one port.
- **The `Function` nodes decide nothing.** They answer questions (which passage is this, which
  choices can you see, is this paste a story) and transform lists (add what you were given).

## The things that are deliberate

- **A locked choice is absent, not greyed out.** A reader who never picked up the thing never
  learns the choice existed. That is what makes finding it mean something — and it is why
  there is no padlock icon to add.
- **The reader carries things, not flags.** `gives: "a brass key"` is readable in the data and
  readable on screen, and it is the same string in both places.
- **A bad `goto` is reported in prose, naming the id.** It is the mistake everyone makes first.
- **The prose is set in a serif at a 680px measure.** Two nodes set a font in this whole
  project; everything else inherits the project body.
