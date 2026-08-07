---
title: The canvas, sheets, and the visual tree
---

*Describes NodeGX 0.1.0.*

## The canvas

The **canvas** is where you build a component's graph: drag nodes onto it, connect their
ports with wires, and (for visual nodes) nest them inside one another to build the structure
your app will render. Each component has its own canvas — opening a different component in
the Components panel switches what the canvas shows.

## The Components panel and sheets

The **Components panel** lists every component in your project, organized into a tree. A
**sheet** is a top-level folder in that tree — a way of grouping related components as your
project grows past a handful. Every new component lands in the *Default* sheet unless you
file it elsewhere; NodeGX also maintains its own reserved *Cloud Functions* sheet, kept
separate because those components run on the backend rather than in the browser (see
[What runs in the browser, and what runs on the backend](./frontend-vs-backend.md)) — you
can't rename or delete that one, but you can create, rename and delete your own sheets to
organize everything else. The panel's **Author in sheet** selector lets you filter the tree
down to one sheet, or show *All sheets* at once; whichever sheet is selected also decides
where a newly created component gets filed.

Each component in the tree shows a glyph that tells you what kind it is at a glance — home,
page, popup, cloud function, visual component, or plain component — so you can tell a page
from a reusable card without opening either.

## The visual tree

Within one visual component's canvas, nodes that render UI can be nested inside one another —
a Group holding a couple of Buttons, a Button holding a Text and an Icon. That nesting *is*
the structure your app renders: it becomes the actual DOM hierarchy of the running app,
independent of the wires connecting those same nodes' logic ports. When you're building UI,
you're usually doing two things on the same canvas at once — nesting nodes to build the
layout, and wiring their ports to build the behavior.
