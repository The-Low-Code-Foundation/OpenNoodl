#!/usr/bin/env python3
"""Author the ERG-004 live-QA project on disk.

Run it, then open **erg004-qa** from the launcher. Full results and the traps
this thing cost to build: `dev-docs/tasks/phase-35-authoring-ergonomics/
ERG-004-NOTES.md` §7.

Two `Object Changed` nodes and two `Array Changed` nodes, wired the two ways an
author can wire them:

  * "direct"  — fed a real live Object / Array value from a Script node.
  * "by id"   — fed the `Id` string output of the `Object` / `Array` node, which
                is how every other node in the Data category identifies data,
                and which the catalog's typecast table declares legal
                (string -> object, string -> array).

The second pair is the measurement, and it is **deliberately mis-wired**: delete
those two nodes before using this project to judge a clean-Problems-panel
criterion.

What it measured (2026-08-02): `Object Changed` has no producer in the library —
nothing outputs a live Noodl Object — so the by-id wiring is what an author will
reach for. `node.ts:360-390` then evaluates the id string as a JavaScript
literal, `eval('(qa-obj)')` throws `ReferenceError: qa is not defined`, and `{}`
is substituted, so the node watches nothing.

It is **not silent** — an `invalid-object` warning fires and reaches the topbar
chip. An earlier draft of this file predicted silence; that was wrong, and the
measurement wins.

Mutations are driven from outside over CDP against the same ids, e.g.

    npm run cdp -- eval "Noodl.Object.get('qa-obj').set('name','alpha')" --target=viewer
"""
import json, os

OUT = os.path.expanduser("~/vscode_projects/NodeGX test projects/erg004-qa")

def nid(n):
    return "aaaaaaaa0000-0000-4000-8000-%012d" % n

DRIVER_CODE = """define({
  inputs: {},
  outputs: {
    obj: 'object',
    arr: 'array'
  },
  setup: function (inputs, outputs) {
    // Real runtime data, published onto the ports as live values. Mutations are
    // driven from outside (CDP) against the very same ids, so what the graph sees
    // is exactly what an author's Set Object Properties / Insert Object would do.
    //
    // Deferred by a frame on purpose: on the FIRST open of a project whose
    // Script node carries no `dynamicports` on disk, `setup` runs before the
    // editor has round-tripped the code-derived ports back to the node, and
    // `flagOutputDirty('obj')` warns "doesn't have a port named obj".
    // `window.__erg004` is the probe: read it over CDP to tell "the node never
    // ran" apart from "it ran and the port was missing", which look identical
    // from the readouts.
    var self = this;
    window.__erg004 = { setupRan: true, deferred: false, flagged: false, err: null };
    setTimeout(function () {
      window.__erg004.deferred = true;
      try {
        outputs.obj = Noodl.Object.get('qa-obj');
        outputs.arr = Noodl.Array.get('qa-list');
        self.flagOutputDirty('obj');
        self.flagOutputDirty('arr');
        window.__erg004.flagged = true;
      } catch (e) {
        window.__erg004.err = String(e);
      }
    }, 500);
  }
})
"""

def row(i, label, y):
    """A labelled readout: the static label and the bound value side by side.

    Reading the value out of the DOM by position was ambiguous and produced a
    wrong reading once already. The label travels with the value.
    """
    return {
        "id": nid(i + 100), "type": "Group", "label": label + " row",
        "x": 0, "y": y,
        "parameters": {"flexDirection": "row", "sizeMode": "contentSize"},
        "children": [
            {"id": nid(i + 200), "type": "Text", "label": label + " label",
             "x": 0, "y": 0, "parameters": {"text": label + ": ", "fontSize": 16},
             "ports": [], "dynamicports": []},
            {"id": nid(i), "type": "Text", "label": label,
             "x": 0, "y": 0, "parameters": {"text": "<unset>", "fontSize": 16},
             "ports": [], "dynamicports": []},
        ],
        "ports": [], "dynamicports": []
    }

# ── visual tree ──────────────────────────────────────────────────────────────
texts = [
    (20, "OC key"),        # Object Changed -> key
    (21, "OC value"),
    (22, "OC prev"),
    (23, "AC count"),
    (24, "AC index"),
    (25, "AC item"),
    (26, "AC key"),
    (27, "OC-byid value"),  # the id-wired Object Changed
    (28, "AC-byid count"),  # the id-wired Array Changed
    # Signal counters. A readout shows the values a signal carried; only a count
    # shows *which* signal fired, and that a reorder fires none at all.
    (30, "n keyAdded"),
    (31, "n keyChanged"),
    (32, "n objReplaced"),
    (33, "n itemAdded"),
    (34, "n itemRemoved"),
    (35, "n itemChanged"),
    (36, "n arrReplaced"),
]
group = {
    "id": nid(10), "type": "Group", "label": "Readouts",
    "x": 0, "y": 0,
    "parameters": {"flexDirection": "column", "sizeMode": "contentSize"},
    "children": [row(i, lbl, n * 40) for n, (i, lbl) in enumerate(texts)],
    "ports": [], "dynamicports": []
}

roots = [group]

# ⚠️ The `dynamicports` below are NOT optional decoration. The runtime registers a
# Script node's outputs from `this.model.outputPorts` — i.e. from what the exported
# graph carries — not from the ports its own parser derives from the code. A
# hand-authored Script node with `"dynamicports": []` therefore parses fine, runs
# `setup` fine, and throws "Node Javascript2 doesn't have a port named obj" the
# moment setup touches an output. The editor writes these back on save; authoring
# by hand means writing them yourself.
roots.append({
    "id": nid(1), "type": "Javascript2", "label": "Driver",
    "x": -700, "y": -400,
    "parameters": {"code": DRIVER_CODE},
    "ports": [],
    "dynamicports": [
        {"name": "obj", "type": {"name": "object"}, "plug": "output", "group": "Outputs", "index": 5},
        {"name": "arr", "type": {"name": "array"}, "plug": "output", "group": "Outputs", "index": 6},
    ]
})

# The Object node, identifying its object the way the Data category does: by id.
roots.append({
    "id": nid(2), "type": "Model2", "label": "The Object",
    "x": -700, "y": -200,
    "parameters": {"idSource": "explicit", "modelId": "qa-obj", "properties": "name,count"},
    "ports": [], "dynamicports": []
})

# The Array node, same.
roots.append({
    "id": nid(3), "type": "Collection2", "label": "The Array",
    "x": -700, "y": 0,
    "parameters": {"collectionId": "qa-list"},
    "ports": [], "dynamicports": []
})

roots.append({
    "id": nid(4), "type": "net.noodl.ObjectChanged", "label": "OC direct",
    "x": -300, "y": -400, "parameters": {}, "ports": [], "dynamicports": []
})
roots.append({
    "id": nid(5), "type": "net.noodl.ArrayChanged", "label": "AC direct",
    "x": -300, "y": -100, "parameters": {}, "ports": [], "dynamicports": []
})
roots.append({
    "id": nid(6), "type": "net.noodl.ObjectChanged", "label": "OC by id",
    "x": -300, "y": 200, "parameters": {}, "ports": [], "dynamicports": []
})
roots.append({
    "id": nid(7), "type": "net.noodl.ArrayChanged", "label": "AC by id",
    "x": -300, "y": 400, "parameters": {}, "ports": [], "dynamicports": []
})

# One Counter per signal, so "which signal fired" is a number on screen.
COUNTERS = [
    (40, 30, 4, "keyAdded"),
    (41, 31, 4, "keyChanged"),
    (42, 32, 4, "objectReplaced"),
    (43, 33, 5, "itemAdded"),
    (44, 34, 5, "itemRemoved"),
    (45, 35, 5, "itemChanged"),
    (46, 36, 5, "arrayReplaced"),
]
for n, (cid, tid, src, port) in enumerate(COUNTERS):
    roots.append({
        "id": nid(cid), "type": "Counter", "label": "count " + port,
        "x": 100, "y": -400 + n * 120,
        "parameters": {"startValue": 0},
        "ports": [], "dynamicports": []
    })

conns = []
def wire(a, ap, b, bp):
    conns.append({"fromId": nid(a), "fromProperty": ap, "toId": nid(b), "toProperty": bp})

# direct wiring — a live value
wire(1, "obj", 4, "object")
wire(1, "arr", 5, "array")
# id wiring — the string an author actually has to hand
wire(2, "id", 6, "object")
wire(3, "id", 7, "array")

# readouts
wire(4, "key", 20, "text")
wire(4, "value", 21, "text")
wire(4, "previousValue", 22, "text")
wire(5, "count", 23, "text")
wire(5, "index", 24, "text")
wire(5, "item", 25, "text")
wire(5, "key", 26, "text")
wire(6, "value", 27, "text")
wire(7, "count", 28, "text")

for cid, tid, src, port in COUNTERS:
    wire(src, port, cid, "increase")
    wire(cid, "currentCount", tid, "text")

project = {
    "name": "erg004-qa",
    "components": [
        {
            "name": "App",
            "id": "cccccccc0000-0000-4000-8000-000000000001",
            "graph": {"connections": conns, "roots": roots}
        }
    ],
    "settings": {},
    "rootNodeId": nid(10),
    "version": "1.0",
    "metadata": {},
    "variants": []
}

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "project.json"), "w") as f:
    json.dump(project, f, indent=1)
print("wrote", os.path.join(OUT, "project.json"))
