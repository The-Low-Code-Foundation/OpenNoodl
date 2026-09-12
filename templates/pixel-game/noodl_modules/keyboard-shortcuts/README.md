# Keyboard Shortcuts

A NodeGX node kit: custom nodes written in plain JavaScript, living in this
project, usable exactly like built-in nodes.

There is no build step. No npm install, no bundler, no SDK. `index.js` is loaded
by the runtime as-is.

It registers one **logic** node — no React, no DOM output — called **Keyboard
Shortcut**. The full port reference, the shortcut syntax and the text-field rule
are in the module's own README, one directory up from the project root; this
file is about the kit as a piece of code.

## Try it

1. Reload the preview (the kit is loaded when the project's runtime starts).
2. Open the node picker and search for **Keyboard Shortcut**.
3. Drop it on a canvas, type `mod+k` into **Shortcut**, and wire **Pressed**
   at something.

Or open `/Keyboard Shortcuts Demo`, which has three of them already wired.

## The rule this kit is written to

> **Ports are the product. JavaScript is the escape hatch.**

Nothing in `index.js` decides which combination an app should use, and nothing
in it decides what a shortcut does. Both are decisions, so both are ports:
`Shortcut` is text on the property panel, `Pressed` is a signal the graph wires
wherever it likes. The obvious shortcut is:

```js
// DON'T. This is the mistake the kit exists to not teach.
if (event.metaKey && event.key === 'k') openTheCommandPalette();
```

That buries both the combination and the behaviour in a file nobody can see
from the canvas.

## The one thing to copy out of this file

🔴 **A global listener must not outlive the node that added it.**

```js
initialize: function () {
  attach(this);                                  // adds the keydown listener
  this.addDeleteListener(function () {           // …and removes it, in the same breath
    detach(this);
  }.bind(this));
}
```

`addDeleteListener` is the runtime's own teardown hook: `Node.prototype._onNodeDeleted`
runs it on delete, on unmount and on navigating away. Registering the removal in
the same function as the registration is what makes it impossible to add one
without the other — which is the whole defect. Without it, every visit to the
page leaves another live listener behind, and the shortcut fires once per visit.

`detach` is idempotent, and it also sets a flag the handler checks first, so a
listener that somehow survived removal is silent rather than merely unreachable.

## Layout

```
keyboard-shortcuts/
  manifest.json          name, entry point, dependencies, types version
  index.js               the kit — parsing, matching, the node definition
  types/node-kit.d.ts    a copy of @nodegx/node-kit-types, for autocomplete
  README.md              this file
```

## Autocomplete

`index.js` carries JSDoc `@type` annotations pointing at `./types/node-kit`.
That copy is here on purpose: a kit folder has no `node_modules` and no build
step, so a bare specifier would not resolve. Open this folder in any editor that
speaks TypeScript and the fields, port types and callback signatures are all
there — no install, no `tsconfig`.

The copy is stamped with the `@nodegx/node-kit-types` version it came from
(`manifest.json`'s `nodeKitTypes`, shown in the editor's kits panel), so its age
is answerable without diffing anything.

## Adding a node

Write another definition object in `index.js` and add it to the `nodes` array
passed to `Noodl.defineModule`. Keep the `keyboard-shortcuts.` prefix on the
`name`: two kits in one project must not collide on a node type.

Visual nodes go in a `reactNodes` array instead — see the **Example Node Kit**
library entry for one.
