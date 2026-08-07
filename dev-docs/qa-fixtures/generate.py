#!/usr/bin/env python3
"""
Generate the NodeGX QA fixture project.

Deterministic: every id is a uuid5 of a stable label, so re-running produces a
byte-identical project.json and the fixture can be regenerated rather than
hand-patched.

The fixture is built to satisfy, in one project, the assertions that no project
in the repo could previously prove. See the README beside the output.
"""

import json
import os
import uuid

NS = uuid.UUID("6f1d2c1e-9a3b-4f57-8c21-2b7e4a9d0f11")


def uid(label: str) -> str:
    return str(uuid.uuid5(NS, label))


def px(v):
    return {"value": str(v), "unit": "px"}


def node(label, type_, x=0, y=0, params=None, children=None, **extra):
    n = {
        "id": uid(label),
        "type": type_,
        "x": x,
        "y": y,
        "parameters": params or {},
        "ports": [],
        "children": children or [],
    }
    n.update(extra)
    return n


def component(name, roots, connections=None, **extra):
    c = {
        "name": name,
        "id": uid("component:" + name),
        "visual": True,
        "ports": [],
        "visualStateTransitions": [],
        "graph": {
            "roots": roots,
            "connections": connections or [],
            "comments": [],
        },
        "metadata": {},
    }
    c.update(extra)
    return c


def conn(from_label, from_port, to_label, to_port):
    return {
        "fromId": uid(from_label),
        "fromProperty": from_port,
        "toId": uid(to_label),
        "toProperty": to_port,
    }


def text(label, content, style=None, **params):
    p = {"text": content}
    if style:
        p["textStyle"] = style
    p.update(params)
    return node(label, "Text", params=p)


components = []

# ---------------------------------------------------------------------------
# App — the home component. Its Router node is the project's rootNode, which is
# what makes `getRootComponent()` return this component and the tree draw the
# filled Home glyph.
# ---------------------------------------------------------------------------
PAGES = ["/#__page__/Home", "/#__page__/Catalog", "/#__page__/Settings"]

components.append(
    component(
        "App",
        [
            node(
                "app:router",
                "Router",
                40,
                40,
                {
                    "name": "Main",
                    "pages": {"startPage": PAGES[0], "routes": list(PAGES)},
                },
            )
        ],
    )
)

# ---------------------------------------------------------------------------
# Pages. Home carries the signal connection (UIX-011 row 9): a Text node's
# `onClick` signal output into RouterNavigate's `navigate` signal input.
# ---------------------------------------------------------------------------
components.append(
    component(
        "/#__page__/Home",
        [
            node(
                "home:page",
                "Page",
                40,
                40,
                {"title": "Home"},
                [
                    node(
                        "home:group",
                        "Group",
                        0,
                        0,
                        {"sizeMode": "contentHeight", "paddingTop": px(24)},
                        [
                            text("home:heading", "Welcome", "Heading"),
                            text("home:body", "A fixture project for editor QA.", "Body Text"),
                            # Signal source for row 9.
                            text("home:cta", "Go to the catalogue", "Body Text", color="#2F6FEB"),
                        ],
                    )
                ],
            ),
            node("home:navigate", "RouterNavigate", 460, 40, {"target": PAGES[1]}),
        ],
        # UIX-011 row 9 — a SIGNAL connection. The connection popup must show the
        # Lightning glyph beside these port names and not beside data ports.
        [conn("home:cta", "onClick", "home:navigate", "navigate")],
    )
)

components.append(
    component(
        "/#__page__/Catalog",
        [
            node(
                "catalog:page",
                "Page",
                40,
                40,
                {"title": "Catalog"},
                [
                    node(
                        "catalog:group",
                        "Group",
                        0,
                        0,
                        {"sizeMode": "contentHeight"},
                        [text("catalog:heading", "Catalogue", "Heading")],
                    )
                ],
            ),
            # UIX-011 row 6 — the Query/Filter pair. The rule popup itself needs a
            # backend class schema; see the README's preconditions.
            node("catalog:query", "DbCollection2", 460, 40, {"collectionName": "Product"}),
            node("catalog:filter", "FilterDBModels", 800, 40, {}),
        ],
        # A DATA connection — this is the one to enable inspect on for row 10,
        # and the one that must NOT show the Lightning glyph in row 9.
        [conn("catalog:query", "items", "catalog:filter", "items")],
    )
)

components.append(
    component(
        "/#__page__/Settings",
        [
            node(
                "settings:page",
                "Page",
                40,
                40,
                {"title": "Settings"},
                [
                    node(
                        "settings:group",
                        "Group",
                        0,
                        0,
                        {"sizeMode": "contentHeight"},
                        [text("settings:heading", "Settings", "Heading")],
                    )
                ],
            )
        ],
    )
)

# ---------------------------------------------------------------------------
# /Library/... — four levels deep, which is what PNL-006 assertion B wants and
# what no project in the repo had. `/Library/Widgets/Controls/<leaf>` renders as
# Library(0) → Widgets(1) → Controls(2) → leaf(3): four levels.
#
# One leaf carries a deliberately long name so assertion C's ellipsis half has
# something to measure at 240px.
# ---------------------------------------------------------------------------
LONG_NAME = "Secondary Action Button With A Deliberately Long Name For Ellipsis Verification"

visual_leaves = [
    ("/Library/Widgets/Controls/Primary Action Button", "Primary action", "Button Label"),
    ("/Library/Widgets/Controls/" + LONG_NAME, "Secondary action", "Button Label"),
    ("/Library/Widgets/Controls/Icon Button", "Icon", "Button Label"),
    ("/Library/Widgets/Controls/Toggle Switch", "Toggle", "Caption"),
    ("/Library/Widgets/Controls/Dropdown Field", "Dropdown", "Caption"),
    ("/Library/Widgets/Cards/Product Card", "Product", "Heading"),
    ("/Library/Widgets/Cards/Product Card Compact", "Product", "Caption"),
    ("/Library/Widgets/Cards/Promo Banner", "Promotion", "Heading"),
    ("/Library/Layout/Header", "Header", "Heading"),
    ("/Library/Layout/Footer", "Footer", "Caption"),
    ("/Library/Layout/Sidebar", "Sidebar", "Caption"),
    ("/Library/Layout/Breadcrumbs", "Breadcrumbs", "Caption"),
]

for path, label, style in visual_leaves:
    key = path.rsplit("/", 1)[-1]
    group_params = {
        "sizeMode": "contentHeight",
        "paddingTop": px(8),
        "paddingBottom": px(8),
        "paddingLeft": px(12),
        "paddingRight": px(12),
        "backgroundColor": "Surface",
        "borderRadius": px(6),
    }
    group = node(
        "lib:" + key + ":group",
        "Group",
        40,
        40,
        group_params,
        [text("lib:" + key + ":label", label, style)],
    )

    # UIX-011 rows 2-4 need a node with a variant and a non-default visual state.
    # Product Card is the one that carries both, so the QA walk has a named place
    # to go rather than "find a node with a variant".
    if key == "Product Card":
        group["variant"] = "Card Surface"
        group["stateParameters"] = {"hover": {"backgroundColor": "Surface Raised"}}
        group["stateTransitions"] = {"hover": {"backgroundColor": {"curve": [0, 0, 1, 1], "dur": 120, "delay": 0}}}
        group["defaultStateTransitions"] = {}

    components.append(component(path, [group]))

# ---------------------------------------------------------------------------
# /Logic/... — components whose roots are ALL non-visual. `ComponentModel.color`
# only takes a colour from a root with `allowAsChild`, so these come out
# `default`, which is the uncategorised glyph the PNL-006 gate needs in order to
# execute its GLYPH_CONTRAST_EXEMPT branch at all. Without one of these the
# exemption path never runs and the gate reports a meaningless green.
# ---------------------------------------------------------------------------
components.append(
    component(
        "/Logic/Session Controller",
        [
            node(
                "logic:session:fn",
                "JavaScriptFunction",
                40,
                40,
                {"functionScript": "// Fixture logic node.\nOutputs.Session = { signedIn: false };\n"},
                dynamicports=[
                    {
                        "name": "out-Session",
                        "displayName": "Session",
                        "plug": "output",
                        "type": "*",
                        "group": "Outputs",
                        "index": 4,
                    }
                ],
            ),
            node("logic:session:expr", "Expression", 40, 260, {"expression": "a + b"}),
        ],
    )
)
components.append(
    component("/Logic/Cart Totals", [node("logic:cart:expr", "Expression", 40, 40, {"expression": "price * qty"})])
)
components.append(
    component(
        "/Logic/Feature Flags",
        [
            node(
                "logic:flags:fn",
                "JavaScriptFunction",
                40,
                40,
                {"functionScript": "Outputs.Flags = { newCatalogue: true };\n"},
            )
        ],
    )
)

# ---------------------------------------------------------------------------
# /Content/... — components containing a node type that does not exist. This is
# what produces the components-tree warning dot (PNL-006 assertion D), which no
# project in the repo could previously demonstrate. "Markdown" is deliberate: it
# is absent from the node catalog, so it resolves to an UnknownNodeType.
# ---------------------------------------------------------------------------
for name, body in [
    ("/Content/Release Notes", "Release notes body"),
    ("/Content/Changelog", "Changelog body"),
]:
    key = name.rsplit("/", 1)[-1]
    components.append(
        component(name, [node("content:" + key + ":md", "Markdown", 40, 40, {"text": body})])
    )

# ---------------------------------------------------------------------------
project = {
    "name": "NodeGX QA Fixture",
    "version": "4",
    "runtimeVersion": "1",
    "rootComponent": "App",
    "rootNodeId": uid("app:router"),
    "components": components,
    "settings": {},
    "variants": [
        {
            "name": "Card Surface",
            "typename": "Group",
            "parameters": {
                "backgroundColor": "Surface",
                "borderRadius": px(8),
                "paddingTop": px(12),
                "paddingBottom": px(12),
                "paddingLeft": px(16),
                "paddingRight": px(16),
            },
            # On disk this key really is misspelled: `VariantModel.toJSON` writes
            # `stateParamaters` and its `fromJSON` reads the same. Spelling it
            # correctly here would silently drop the state.
            "stateParamaters": {"hover": {"backgroundColor": "Surface Raised"}},
            "stateTransitions": {"hover": {"backgroundColor": {"curve": [0, 0, 1, 1], "dur": 120, "delay": 0}}},
            "defaultStateTransitions": {},
        }
    ],
    "metadata": {
        "title": "NodeGX QA Fixture",
        "description": (
            "Editor QA fixture: four-level component nesting, an unresolved node type, "
            "an uncategorised component, a long name, a Router with pages, text styles, "
            "a variant, a visual state, a Query/Filter pair, and signal and data connections."
        ),
        "styles": {
            "colors": {
                "Surface": "#F5F6F8",
                "Surface Raised": "#EAECEF",
                "Ink": "#1F2328",
                "Accent": "#2F6FEB",
            },
            "text": {
                "Heading": {"fontSize": {"value": "20", "unit": "px"}, "color": "Ink"},
                "Body Text": {"fontSize": {"value": "14", "unit": "px"}, "color": "Ink"},
                "Button Label": {"fontSize": {"value": "14", "unit": "px"}, "color": "Accent"},
                "Caption": {"fontSize": {"value": "12", "unit": "px"}, "color": "#6E7781"},
            },
        },
    },
}

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nodegx-qa-fixture", "project.json")
if len(os.sys.argv) > 1:
    out = os.sys.argv[1]
with open(out, "w") as f:
    json.dump(project, f, indent=2)
    f.write("\n")

print("wrote", out)
print("components:", len(components))
