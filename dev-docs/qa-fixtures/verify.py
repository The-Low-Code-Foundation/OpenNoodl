#!/usr/bin/env python3
"""
Verify the QA fixture against the assertions it exists to satisfy, by mirroring
the editor's own derivations:

  - folder depth   -> useComponentsPanel.addComponentToFolderStructure
  - category       -> componentKind.categoryFor / ComponentModel.color
  - kind           -> componentKind.kindFor
"""
import json
import sys

PROJ = "dev-docs/qa-fixtures/nodegx-qa-fixture/project.json"
CAT = "packages/noodl-types/src/node-catalog.json"

proj = json.load(open(PROJ))
catalog = {n["typeName"]: n for n in json.load(open(CAT))["nodes"]}

comps = proj["components"]
failures = []
def check(ok, msg):
    print(("  PASS  " if ok else "  FAIL  ") + msg)
    if not ok:
        failures.append(msg)

# --- tree shape, mirroring the panel -----------------------------------------
# "All" strips a leading sheet segment (#__page__ etc). The leading '' segment
# is transparent. Depth = number of rendered levels for the leaf.
def display_parts(name):
    parts = [p for p in name.split("/") if p != ""]
    if parts and parts[0].startswith("#"):
        parts = parts[1:]
    return parts

max_level = 0
deepest = None
for c in comps:
    parts = display_parts(c["name"])
    level = len(parts) - 1  # leaf's own indent level
    if level > max_level:
        max_level, deepest = level, c["name"]

print("== PNL-006 assertion B: four levels ==")
check(max_level + 1 >= 4, f"deepest leaf renders {max_level + 1} levels ({deepest})")

# --- rendered row count (folders + leaves), for the scroll requirement --------
folders = set()
for c in comps:
    parts = display_parts(c["name"])
    for i in range(len(parts) - 1):
        folders.add("/".join(parts[: i + 1]))
rows = len(folders) + len(comps)
print("\n== scroll: enough rows ==")
check(rows >= 25, f"{rows} rows when fully expanded ({len(folders)} folders + {len(comps)} components)")

# --- long name for the ellipsis half of assertion C --------------------------
print("\n== PNL-006 assertion C: a name long enough to ellipsise ==")
longest = max(comps, key=lambda c: len(display_parts(c["name"])[-1]))
ln = display_parts(longest["name"])[-1]
check(len(ln) >= 40, f'longest leaf label is {len(ln)} chars: "{ln}"')

# --- category / kind derivation ---------------------------------------------
CANVAS_CATEGORIES = {"component", "visual", "data", "javascript"}

def allow_as_child(t):
    return bool(catalog.get(t, {}).get("allowAsChild"))

def category_of(c):
    color = None
    for r in c["graph"]["roots"]:
        if allow_as_child(r["type"]):
            color = (catalog[r["type"]].get("category") or "").lower()
    return color if color in CANVAS_CATEGORIES else "default"

cats = {}
for c in comps:
    cats.setdefault(category_of(c), []).append(c["name"])

print("\n== PNL-006 assertion E: an uncategorised component must exist ==")
print("   (without one, the GLYPH_CONTRAST_EXEMPT branch never executes)")
check("default" in cats, f"categories present: { {k: len(v) for k, v in cats.items()} }")
if "default" in cats:
    print("         default components: " + ", ".join(cats["default"]))

# --- the warning source ------------------------------------------------------
print("\n== PNL-006 assertion D: a component with a warning ==")
def walk(ns):
    for n in ns:
        yield n
        yield from walk(n.get("children", []))

unknown = {}
for c in comps:
    for n in walk(c["graph"]["roots"]):
        if n["type"] not in catalog:
            unknown.setdefault(c["name"], set()).add(n["type"])
check(len(unknown) >= 1, f"{len(unknown)} components carry an unresolved node type: {dict((k, sorted(v)) for k, v in unknown.items())}")

# --- the home component ------------------------------------------------------
print("\n== home glyph ==")
root_node_id = proj.get("rootNodeId")
owner = None
for c in comps:
    for n in walk(c["graph"]["roots"]):
        if n["id"] == root_node_id:
            owner = c["name"]
check(owner is not None, f"rootNodeId resolves to a node owned by: {owner}")

# --- UIX-011 prerequisites ---------------------------------------------------
print("\n== UIX-011 rows 1-11 prerequisites ==")
all_types = set()
for c in comps:
    for n in walk(c["graph"]["roots"]):
        all_types.add(n["type"])

check("Router" in all_types, "row 7: a Router node exists")
router = next(n for c in comps for n in walk(c["graph"]["roots"]) if n["type"] == "Router")
check(bool(router["parameters"].get("pages", {}).get("routes")), f"row 7: Router has {len(router['parameters']['pages']['routes'])} pages, startPage set")

styles = proj["metadata"]["styles"]
check(bool(styles.get("text")), f"row 8: {len(styles['text'])} text styles defined: {list(styles['text'])}")
used_styles = {n["parameters"].get("textStyle") for c in comps for n in walk(c["graph"]["roots"]) if n["parameters"].get("textStyle")}
check(used_styles <= set(styles["text"]) and used_styles, f"row 8: text-style fields in use, all resolvable: {sorted(used_styles)}")

check(any(t in all_types for t in ("DbCollection2", "FilterDBModels")), "row 6: a Query/Filter node exists")

# signal vs data connections
sig, data = [], []
for c in comps:
    for cn in c["graph"]["connections"]:
        src = next((n for n in walk(c["graph"]["roots"]) if n["id"] == cn["fromId"]), None)
        if not src:
            continue
        out = next((o for o in catalog.get(src["type"], {}).get("outputs", []) if o["name"] == cn["fromProperty"]), None)
        tname = out and (out["type"] if isinstance(out["type"], str) else out["type"].get("name"))
        (sig if tname == "signal" else data).append(f"{c['name']}: {src['type']}.{cn['fromProperty']}")
check(len(sig) >= 1, f"row 9: {len(sig)} signal connection(s): {sig}")
check(len(data) >= 1, f"row 10: {len(data)} data connection(s) to enable inspect on: {data}")

check(bool(proj.get("variants")), f"row 4: {len(proj['variants'])} variant(s): {[v['name'] for v in proj['variants']]}")
vnodes = [n for c in comps for n in walk(c["graph"]["roots"]) if n.get("variant")]
check(bool(vnodes), f"row 4: {len(vnodes)} node(s) use a variant")
snodes = [n for c in comps for n in walk(c["graph"]["roots"]) if n.get("stateParameters")]
check(bool(snodes), f"rows 3/5: {len(snodes)} node(s) carry a non-default visual state")

pages = [c for c in comps if any(n["type"] == "Page" for n in walk(c["graph"]["roots"]))]
check(len(pages) >= 1, f"row 1/12: {len(pages)} page component(s)")

print()
if failures:
    print(f"{len(failures)} FAILURE(S)")
    sys.exit(1)
print("all fixture assertions hold")
