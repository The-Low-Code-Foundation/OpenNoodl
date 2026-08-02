#!/usr/bin/env python3
"""Author the ERG-005 §0 live-QA project on disk.

Run it, then open **erg005-qa** from the launcher. Full results:
`dev-docs/tasks/phase-35-authoring-ergonomics/ERG-005-COMPONENT-INTERFACE.md` §0.

ERG-005 §0 asks how a `Component Input`'s type is inferred from what it is
connected to *inside* the component. The five questions are about ordering,
conflict, deletion, symmetry with outputs, and whether the inferred type escapes
the editor. None of them can be answered by adding one connection — they need a
*sequence* of edits with a reading after each.

So this project deliberately ships the **nodes and the ports but almost none of
the connections**. The measurement wires and unwires them live over CDP against
`ProjectModel.instance`, reading `component.getPorts()` after every step, which is
the same call the property editor and the node-instance ports are built from.

  npm run cdp -- eval "<probe>"      # see ERG-005-COMPONENT-INTERFACE.md §0

What it carries:

  /Probe   the component under test. A `Component Inputs` node with six ports and
           a `Component Outputs` node with four, plus typed sinks (String, Number,
           Boolean, Text) and typed sources to wire them to. Every port starts
           with type `*` and no connection, which is the state the Port Editor
           leaves a freshly-created port in.
  /App     the home component. Visual, so a viewer actually mounts — a project
           with no home component never mounts one, and a dynamic port that is
           merely waiting for a viewer reads exactly like a missing port
           (ERG-004-NOTES §7.5). It places an instance of /Probe so the *outer*
           contract can be read from the instance as well as from the model.

⚠️ Regenerate before every run. The editor autosaves over a hand-authored
project.json, and this one is mutated live by design — after a measurement the
file on disk carries whatever the last step left behind.
"""
import json, os

OUT = os.path.expanduser("~/vscode_projects/NodeGX test projects/erg005-qa")


def nid(n):
    return "eeeeeeee0000-0000-4000-8000-%012d" % n


# Ports are authored exactly as `componentports.tsx` creates them: type `*`,
# an explicit group, and a 1-based index. A port the Port Editor has just made
# carries no type of its own — the type in the outer contract is *derived*.
def port(name, plug, index, group="General"):
    return {"name": name, "plug": plug, "type": {"name": "*"}, "group": group, "index": index}


# ── /Probe — the component under test ────────────────────────────────────────
probe_roots = [
    # The two nodes whose ports become the component's public interface.
    {
        "id": nid(1), "type": "Component Inputs", "label": "Inputs",
        "x": -600, "y": 0, "parameters": {},
        "ports": [
            port("pStr", "output", 1),      # Q1 — one connection, string
            port("pNum", "output", 2),      # Q1 — one connection, number
            port("pAB", "output", 3),       # Q1/Q2 — string first, then number
            port("pBA", "output", 4),       # Q1/Q2 — number first, then string
            port("pClash", "output", 5),    # Q2 — a pair with no common cast
            port("pNone", "output", 6),     # the control: never connected
        ],
        "dynamicports": []
    },
    {
        "id": nid(2), "type": "Component Outputs", "label": "Outputs",
        "x": 600, "y": 0, "parameters": {},
        "ports": [
            port("oStr", "input", 1),       # Q4 — one connection, string source
            port("oNum", "input", 2),       # Q4 — one connection, number source
            port("oAB", "input", 3),        # Q4 — two sources, different types
            port("oNone", "input", 4),      # the control: never connected
        ],
        "dynamicports": []
    },

    # Typed sinks. A Component Input's type is derived from the *input* port it
    # feeds, so these supply the candidate types.
    {"id": nid(10), "type": "String", "label": "sink String",
     "x": -200, "y": -300, "parameters": {}, "ports": [], "dynamicports": []},
    {"id": nid(11), "type": "Number", "label": "sink Number",
     "x": -200, "y": -150, "parameters": {}, "ports": [], "dynamicports": []},
    {"id": nid(12), "type": "Boolean", "label": "sink Boolean",
     "x": -200, "y": 0, "parameters": {}, "ports": [], "dynamicports": []},
    # A second string sink, so "two connections of the same type" can be told
    # apart from "two connections of different types".
    {"id": nid(13), "type": "String", "label": "sink String 2",
     "x": -200, "y": 150, "parameters": {}, "ports": [], "dynamicports": []},

    # Typed sources. A Component Output's type is derived from the *output* port
    # feeding it, so these supply the candidate types on the other side.
    {"id": nid(20), "type": "String", "label": "src String",
     "x": 200, "y": -150, "parameters": {"value": "hello"}, "ports": [], "dynamicports": []},
    {"id": nid(21), "type": "Number", "label": "src Number",
     "x": 200, "y": 0, "parameters": {"value": 7}, "ports": [], "dynamicports": []},

    # A visual node, so /Probe is a visual component and can legally be a child
    # of /App's Group. Its `color` input is also the clash candidate: `color`
    # and `number` share no cast in either direction.
    {"id": nid(30), "type": "Text", "label": "probe text",
     "x": 0, "y": 400, "parameters": {"text": "probe", "fontSize": 16},
     "ports": [], "dynamicports": []},
]

# The project ships with *no* connections into or out of the two interface
# nodes. Every question in §0 is about what happens as connections arrive and
# leave, so the baseline has to be the empty one.
probe_conns = []

# ── /App — the home component ────────────────────────────────────────────────
app_roots = [
    {
        "id": nid(100), "type": "Group", "label": "Root",
        "x": 0, "y": 0,
        "parameters": {"flexDirection": "column", "sizeMode": "contentSize"},
        "children": [
            {"id": nid(101), "type": "Text", "label": "title",
             "x": 0, "y": 0,
             "parameters": {"text": "ERG-005 §0 probe", "fontSize": 20},
             "ports": [], "dynamicports": []},
            # The instance. Its ports are the *outer* contract, and they are what
            # an author placing this component actually sees.
            {"id": nid(102), "type": "/Probe", "label": "Probe instance",
             "x": 0, "y": 0, "parameters": {}, "ports": [], "dynamicports": []},
        ],
        "ports": [], "dynamicports": []
    }
]

project = {
    "name": "erg005-qa",
    "components": [
        {
            "name": "/App",
            "id": "ffffffff0000-0000-4000-8000-000000000001",
            "graph": {"connections": [], "roots": app_roots}
        },
        {
            "name": "/Probe",
            "id": "ffffffff0000-0000-4000-8000-000000000002",
            "graph": {"connections": probe_conns, "roots": probe_roots}
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
