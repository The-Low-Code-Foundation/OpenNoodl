---
title: Getting started
sidebar_position: 1
---

*Describes NodeGX 0.1.0.*

This walks you through building a real, working two-page app with data, using only the
editor — no code required, though nothing here stops you from adding some later. It assumes
NodeGX is installed and open, and it assumes nothing else. If you haven't yet, read
[The concept set](./concepts/index.md) first — in particular
[Signal vs value](./concepts/signal-vs-value.md) — because the wiring below will make more
sense once "signal" and "value" mean something concrete.

By the end you'll have a **Home** page and an **About** page, a button that navigates
between them, and a small list of data rendered from an Array.

## 1. Create the project

In the launcher, choose **Quick Start**, give the project a name, and pick a folder for it —
NodeGX doesn't assume a default location, so choose (or create) somewhere you'll remember;
see [Where projects live on disk](./troubleshooting.md#where-projects-live-on-disk) if you
want the details before you commit to one.

This creates your project from NodeGX's starting point, not a blank graph: an **App**
component (which hosts a **Router**) and a **Home** page component, already wired together,
with a Text node reading "Hello World!" on the Home page's canvas.

## 2. Look around, then preview it

Open the **Components** panel (it should already be visible) and you'll see **App** and
**Home** listed. Click **Home** to open its canvas — you'll see one **Page** node with a
**Text** child, which is the "Hello World!" you're about to see run.

Switch the top bar from **Design** to **Preview**. This isn't a rebuild — it's a live view of
the exact graph you have open, and it updates as you change things. Leave it in Preview
whenever you want to check your work; switch back to Design to keep building. If a change
ever doesn't seem to show up, see
[When the preview doesn't update](./troubleshooting.md#when-the-preview-doesnt-update).

## 3. Add a second page

Back in Design mode, in the Components panel, open the create menu (the **+**) and choose
**Page Component**. Name it **About**. NodeGX registers it as a new route on the App's Router
automatically — you don't need to touch the Router yourself.

Open the new **About** page's canvas and drop a **Text** node onto it (drag it in from the
node picker), and give it some text of your own, like "About this app".

## 4. Wire up navigation

Go back to the **Home** page. Drag a **Button** node onto the canvas, and give it a label
like "About". Drag a **Navigate** node onto the canvas too — this is the node that actually
moves the Router to a different page. Select it and, in its property panel, set **Target
Page** to your About page and **Router** to the Router in your App component (there's only
one, so it should be the obvious choice).

Now connect them: draw a wire from the Button's **Click** output to the Navigate node's
**Navigate** input. Click is a *signal* — it fires the instant the button is clicked — and
Navigate's input is a signal too, so this is exactly the "verb wired to a verb" pattern from
[Signal vs value](./concepts/signal-vs-value.md#a-signal-is-an-event-that-happens).

Preview it: you should be able to click your button and land on the About page.

## 5. Add some real data

This is the "with data" part. On the Home page, drag an **Array** node onto the canvas — this
holds a list that lives in the running app. In its property panel, add a few items directly
(each one becomes an Object with whatever properties you give it — for example, add two or
three items with a `title` property: "Buy milk", "Write docs", "Ship it").

Now drag a **Repeater** node onto the canvas, and wire the Array's output to the Repeater's
**Items** input. A Repeater renders one copy of a *template component* per item in whatever
you wire into Items.

Create a small new component for that template — a Group with a Text node inside is enough.
On its canvas, drop an **Object** node and, in its property panel, set **Id Source** to
**From Repeater** — this binds that Object to whichever item the Repeater is currently
rendering. Give the Object the same `title` property you used on your Array's items, then
wire that property to your Text node's **Text** input. Back on the Home page, set the
Repeater's **Template** to this new component.

Preview the Home page again: you should see your list of items rendered, one per row, reading
their titles from the Array — change an item's title in the Array's property panel and watch
it update immediately, because that's the reactivity guarantee
[Signal vs value](./concepts/signal-vs-value.md) describes.

## What you've built

A two-page app, navigable with a real button, showing a real list of data driven by an Array
— all without writing a line of code. From here, the natural next steps are: replacing the
Array's hand-typed items with real backend Records (see
[Data: arrays, objects, variables and records](./concepts/data.md)), and, if your app ever
needs to call an API with a secret key, reading
[What runs in the browser, and what runs on the backend](./concepts/frontend-vs-backend.md)
before you wire it in.
