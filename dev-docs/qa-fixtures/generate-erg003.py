#!/usr/bin/env python3
"""Author the ERG-003 live-QA project on disk — the rows C1 still owes.

Run it, then open **erg003-qa** from the launcher. Results:
`dev-docs/tasks/phase-35-authoring-ergonomics/ERG-003-NOTES.md` §4 C1.

C1's rows 1 and 2 were driven during phase-35 closeout on a project that no
longer exists. This fixture carries the **four things still owed**, one node
each, so a run can be judged row by row rather than hunting for a node that
happens to have the right port:

| Node | Port | Serves |
|---|---|---|
| `Global Store` "GS literal" | `initialState` (`object`) | **row 3** — a JavaScript object literal with an unquoted key, the documented-legal case. Reopen must show the amber "stored as a JavaScript literal" hint and must NOT blank the value |
| `Global Store` "GS json" | `initialState` | the control: the same port holding canonical JSON, so "the hint appears" can be told from "the hint always appears" |
| `Repeater` "Rep bound" | `items` (`array`) | **row 4** — wired from `Array.items`, so the row must show the **binding chip** naming the source, not a stale local value |
| `Repeater` "Rep local" | `items` | the control: an unwired repeater holding 3 items, which must show the **summary** ("3 items") and an Edit button |
| `Function` "Fn long" | `scriptInputs` (`proplist`) | **C3** — 24 entries, to see whether Easy mode is legible past the short lists `Page Inputs` produces |

⚠️ The Function's per-input **Type dropdowns do not exist until a viewer has
run** — they are announced by `sendDynamicPorts` from `simplejavascript.ts`,
which returns immediately unless `editorConnection.isRunningLocally()`. `/App` is
the home component so a viewer can mount. A project with no home component shows
an empty property panel and it reads exactly like a defect.

⚠️ Regenerate before every run. Opening a project rewrites `project.json`, and
these rows are driven by editing parameters.
"""
import json, os

OUT = os.path.expanduser("~/vscode_projects/NodeGX test projects/erg003-qa")


def nid(n):
    return "cccccccc0000-0000-4000-8000-%012d" % n


# Row 3. The documented-legal case from the notes: unquoted key, single quotes.
# This is *not* valid JSON, and the whole point of the row is that the editor
# recovers it rather than blanking it.
JS_LITERAL = "{ Authorization: 'Bearer x', retries: 3 }"

# C3. 24 entries — past the point where `Page Inputs`-sized lists say anything
# about legibility. Labels are varied in length on purpose: a tree that only
# looks tidy with uniform labels has not been tested.
LONG_INPUTS = [
    "id", "name", "emailAddress", "q", "sortBy", "sortDirection",
    "pageNumber", "pageSize", "includeArchived", "customerReferenceNumber",
    "from", "to", "currency", "locale", "timezoneOffsetMinutes", "tags",
    "minimumOrderValue", "maximumOrderValue", "status", "assignee",
    "createdBefore", "createdAfter", "hasAttachments", "freeTextSearchTerm",
]

app_roots = [
    {
        "id": nid(100), "type": "Group", "label": "Root",
        "x": 0, "y": 0,
        "parameters": {"flexDirection": "column", "sizeMode": "contentSize"},
        "children": [
            {"id": nid(101), "type": "Text", "label": "title",
             "x": 0, "y": 0,
             "parameters": {"text": "ERG-003 live QA", "fontSize": 20},
             "ports": [], "dynamicports": []},
        ],
        "ports": [], "dynamicports": []
    },

    # ── row 3 and its control ────────────────────────────────────────────────
    {"id": nid(1), "type": "net.noodl.GlobalStore", "label": "GS literal",
     "x": -700, "y": -400,
     "parameters": {"storeName": "qaLiteral", "initialState": JS_LITERAL},
     "ports": [], "dynamicports": []},
    {"id": nid(2), "type": "net.noodl.GlobalStore", "label": "GS json",
     "x": -700, "y": -250,
     "parameters": {"storeName": "qaJson",
                    "initialState": '{"Authorization":"Bearer x","retries":3}'},
     "ports": [], "dynamicports": []},

    # ── row 4 and its control ────────────────────────────────────────────────
    # The source the bound repeater reads from. Its `items` carries a local
    # value too, so "the chip names the source" is distinguishable from "the
    # chip appears because there is nothing else to show".
    {"id": nid(10), "type": "Collection2", "label": "The Array",
     "x": -700, "y": -50,
     "parameters": {"collectionId": "qa-items"},
     "ports": [], "dynamicports": []},
    {"id": nid(11), "type": "For Each", "label": "Rep bound",
     "x": -300, "y": -50,
     "parameters": {"items": '[{"n":1}]'},
     "ports": [], "dynamicports": []},
    {"id": nid(12), "type": "For Each", "label": "Rep local",
     "x": -300, "y": 150,
     "parameters": {"items": '[{"n":1},{"n":2},{"n":3}]'},
     "ports": [], "dynamicports": []},

    # ── C3 ───────────────────────────────────────────────────────────────────
    {"id": nid(20), "type": "JavaScriptFunction", "label": "Fn long",
     "x": -300, "y": 350,
     "parameters": dict(
         {"functionScript": "// ERG-003 C3: 24 script inputs, to judge Easy-mode legibility.\n",
          "scriptInputs": [{"id": "l%02d" % i, "label": lbl}
                           for i, lbl in enumerate(LONG_INPUTS)]},
         # Give a handful of them non-default types, so the tree is not a
         # uniform column of "String" and a mis-attached type would show.
         **{"intype-" + lbl: t for lbl, t in [
             ("pageNumber", "number"), ("pageSize", "number"),
             ("includeArchived", "boolean"), ("hasAttachments", "boolean"),
             ("minimumOrderValue", "number"), ("maximumOrderValue", "number"),
             ("tags", "array"), ("createdBefore", "date"), ("createdAfter", "date"),
         ]}
     ),
     "ports": [], "dynamicports": []},
]

# `Rep bound`'s items come from the Array — this is what must produce the chip.
conns = [
    {"fromId": nid(10), "fromProperty": "items", "toId": nid(11), "toProperty": "items"},
]

project = {
    "name": "erg003-qa",
    "components": [
        {
            "name": "/App",
            "id": "dddddddd0000-0000-4000-8000-000000000001",
            "graph": {"connections": conns, "roots": app_roots}
        },
    ],
    "settings": {},
    "rootNodeId": nid(100),
    "version": "1.0",
    "metadata": {},
    "variants": []
}

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "project.json"), "w") as f:
    json.dump(project, f, indent=1)
print("wrote", os.path.join(OUT, "project.json"))
