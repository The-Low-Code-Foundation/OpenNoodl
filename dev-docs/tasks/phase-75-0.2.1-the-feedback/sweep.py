"""
FB-019 — every connection in the repo whose target port is units- or dimension-typed.

Run from the repo root:  python3 dev-docs/tasks/phase-75-0.2.1-the-feedback/sweep.py

🔴 THE BOUND. This matches by PORT NAME, using the set `portset.py` extracts from the viewer
source. A port name is not a port type: the first run of this reported 189 hits, and 7 were
`Expression.width` — a plain number input that happens to share a name with a dimension port.
So the summary below SPLITS BY TARGET NODE TYPE, and only visual targets (Group/Image/Text/
net.noodl.visual.icon) are the real population. Anything that reads a total off this script
without that split is over-reporting.
"""
import json, os, subprocess, sys, collections

UNITS = set("""borderRadius borderWidth boxShadowBlurRadius boxShadowOffsetX boxShadowOffsetY
boxShadowSpreadRadius columnGap fillSpacing fontSize height iconSize iconSpacing labelSpacing
marginBottom marginLeft marginRight marginTop marginX marginY maxHeight maxWidth minHeight
minWidth objectPositionX objectPositionY paddingBottom paddingLeft paddingRight paddingTop
rowGap thumbHeight thumbRadius thumbWidth trackHeight transformOriginX transformOriginY
transformRotation transformX transformY width""".split())
DIM = {"width", "height"}

files = subprocess.run(["find",".","-name","project.json","-not","-path","*/node_modules/*"],
                       capture_output=True, text=True).stdout.split()

hits = []           # connections INTO a units/dimension port
params = collections.Counter()   # what those ports are set to as parameters
scanned = 0; unreadable = []

def walk_components(doc):
    for c in doc.get("components", []) or []:
        yield c

def nodes_of(root, out):
    if not isinstance(root, dict): return
    out.append(root)
    for child in root.get("children", []) or []:
        nodes_of(child, out)

for f in files:
    try:
        doc = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        unreadable.append((f, str(e)[:60])); continue
    scanned += 1
    for comp in walk_components(doc):
        ns = []
        g = comp.get("graph") or {}
        r = g.get("roots") or []
        for root in r: nodes_of(root, ns)
        byid = {n.get("id"): n for n in ns}
        for n in ns:
            for k, v in (n.get("parameters") or {}).items():
                if k in UNITS:
                    params[(k, type(v).__name__)] += 1
        for conn in g.get("connections") or []:
            tp = conn.get("toProperty")
            if tp in UNITS or tp in DIM:
                tgt = byid.get(conn.get("toId"), {})
                src = byid.get(conn.get("fromId"), {})
                hits.append({
                    "file": f, "component": comp.get("name"),
                    "toPort": tp, "toType": tgt.get("type"),
                    "fromPort": conn.get("fromProperty"), "fromType": src.get("type"),
                    "storedParam": (tgt.get("parameters") or {}).get(tp, "<never set>"),
                })

print(f"scanned {scanned} project.json files; {len(unreadable)} unreadable")
for f, e in unreadable: print("  !!", f, e)
VISUAL = {"Group", "Image", "Text", "net.noodl.visual.icon", "Columns"}
real = [h for h in hits if h["toType"] in VISUAL]
print(f"\nCONNECTIONS INTO A UNITS/DIMENSION PORT: {len(hits)} matched by name, "
      f"{len(real)} on a VISUAL target (the real population)")
print("by target node type:")
for t, n in collections.Counter(h["toType"] for h in hits).most_common():
    print(f"  {str(t):45} {n}{'' if t in VISUAL else '   <- NOT a units port; name collision'}")
for h in hits:
    print(json.dumps(h))
print("\nparameter value shapes on units ports (all projects):")
for (k, t), n in sorted(params.items()): print(f"  {k:22} {t:8} x{n}")
