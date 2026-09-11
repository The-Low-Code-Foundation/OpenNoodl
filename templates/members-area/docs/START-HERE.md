---
title: Start here
inject: pull
when: copy, text, editing, setup, association name, placeholder
---

# Start here

This members' area is ready to run. There are exactly **two** places its words
come from, and this note is the whole list.

## 1. Almost all of the copy is DATA, so there is nothing to edit

Open the site and go to **/setup**. That form asks for the association's name, a
one-line tagline and a paragraph about the association, and the pages read all
three from the record: the landing hero shows the name and the tagline, the
"About us" band below it shows the paragraph, and the band across the top of
every signed-in page shows the name.

**You do not need to open the editor to change any of them.** Sign in as the
moderator and run `/setup` again on a fresh install, or edit the `Association`
row in your backend.

You will also need the setup token, which is a **backend secret** called
`ASSOCIATION_SETUP_TOKEN` — it lives in your backend's configuration, never in
this project, so that every association that installs this template does not
share one.

## 2. The strings that could not be data are marked `EDIT —`

These are the ones with nowhere to live but the graph. Every one of them is
written to look unfinished on purpose, and every one is **named with an
`EDIT —` prefix so the editor's node tree lists them**. Search the tree for
`EDIT` and this table is what you will find.

| component | node | what it says today |
|---|---|---|
| `Members/Footer` | **EDIT — the small print** | EDIT ME — registered charity number, or delete this line. |
| `Members/Footer` | **EDIT — who to contact** | EDIT ME — your association’s contact details go here. |

Change the text, or delete the node if it does not apply to you.

---

*This file is generated from the template itself — the table above is read out of
the shipped graph rather than typed, so it cannot describe a node that is not
there.*
