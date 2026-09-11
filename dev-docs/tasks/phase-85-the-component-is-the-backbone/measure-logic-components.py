#!/usr/bin/env python3
"""CMP-003 — the logic-component census, as one committed pass.

## Why this file exists

Session 1 measured the numbers in README §2 row 3 with an uncommitted ad-hoc
script and wrote the results into the task file. Session 2 tried to reproduce
them and got different answers for two of the four, which cost most of an hour
to resolve:

  * **`/Global logical components/` = 37, 107 instantiations.** ✅ Reproduces —
    but ONLY if you count BOTH logic folders. LearnBook v5.1 has two,
    `/Global logical components/` (25) and `/#Global logic components/` (12),
    and a prefix filter on the obvious one reads 25 / 88 and looks like a
    contradiction of the task file rather than a narrower question.
  * **prefabs: "80 logic-only components, 49 of them one node".** The 80
    reproduces exactly. The 49 does not reproduce under ANY definition tried:
    one node total = 0, one non-interface node = 20, one-or-two non-interface
    nodes = 45, single graph root = 0. See `--definitions`.

That is the whole argument for committing this: a number nobody can re-derive
is a number the next session has to either believe or re-litigate, and this
phase's own §6 says one instrument, so no arm is graded by a pass written for
it.

## What it counts

A component is **logic-only** when no node in its graph is visual, taken from
the enriched catalog's own `isVisual` field rather than a regex over type names
— the product's classification, not this script's.

"How big is it" is reported two ways on purpose, because they disagree and the
doctrine rests on the difference: `nodes` counts everything in the graph;
`working nodes` excludes `Component Inputs` / `Component Outputs`, which are the
interface rather than the work. A component that does one job with one Function
has THREE nodes and ONE working node, and the shipped doctrine's "a single
node... is not a component" reads as forbidding it either way.

  ./measure-logic-components.py                       # prefabs + LearnBook v5.1
  ./measure-logic-components.py --definitions         # every one-node reading
  ./measure-logic-components.py --app <project.json>  # one legacy project
"""
import argparse
import glob
import json
import os
import sys
from collections import Counter

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CATALOG = os.path.join(REPO, 'packages/noodl-types/src/node-catalog-enriched.json')
PREFABS = os.path.join(REPO, 'library/prefabs/*/project/project.json')
LEARNBOOK = '/Users/richardosborne/Documents/LearnBook v5.1 Noodl/project.json'

# 🔴 Both of them. See the header — one folder answers 25 and the other 12.
LOGIC_FOLDERS = ('/Global logical components/', '/#Global logic components/')

INTERFACE = ('Component Inputs', 'Component Outputs')


def visual_types():
    cat = json.load(open(CATALOG))
    return {n['typeName'] for n in cat['nodes'] if n.get('isVisual')}


def walk(node):
    yield node
    for child in node.get('children') or []:
        if isinstance(child, dict):
            yield from walk(child)


def nodes_of(comp):
    out = []
    for root in comp.get('graph', {}).get('roots', []) or []:
        out.extend(walk(root))
    return out


def working(nodes):
    return [n for n in nodes if n.get('type') not in INTERFACE]


def load(path):
    return json.load(open(path)).get('components', []) or []


def is_logic_only(comp, visual):
    nodes = nodes_of(comp)
    return bool(nodes) and not any(n.get('type') in visual for n in nodes)


def instantiations(all_comps, names):
    used = Counter()
    for c in all_comps:
        for n in nodes_of(c):
            t = n.get('type')
            if t in names:
                used[t] += 1
    return used


def census_app(path, visual):
    comps = load(path)
    print('=' * 74)
    print('%s' % path)
    print('  components in project:              %d' % len(comps))

    fold = [c for c in comps if c.get('name', '').startswith(LOGIC_FOLDERS)]
    names = {c['name'] for c in fold}
    used = instantiations(comps, names)

    print('  in the logic folders:               %d' % len(fold))
    print('  ... all of them logic-only:         %d' % len([c for c in fold if is_logic_only(c, visual)]))
    print('  ... instantiated, project-wide:     %d times' % sum(used.values()))
    print('  ... used 0 or 1 times:              %d' % len([n for n in names if used[n] <= 1]))

    sizes = [len(working(nodes_of(c))) for c in fold]
    print('  ... exactly one working node:       %d' % len([s for s in sizes if s == 1]))
    print('  ... one or two working nodes:       %d' % len([s for s in sizes if s <= 2]))
    print('  most reused:')
    for n, k in sorted(((v, k) for k, v in used.items()), reverse=True)[:8]:
        print('      %3d x  %s' % (n, k))
    print()


def census_prefabs(visual):
    comps = []
    entries = sorted(glob.glob(PREFABS))
    for p in entries:
        comps.extend(load(p))
    logic = [c for c in comps if is_logic_only(c, visual)]
    sizes = [len(working(nodes_of(c))) for c in logic]

    print('=' * 74)
    print('library/prefabs (%d entries)' % len(entries))
    print('  components total:                   %d' % len(comps))
    print('  logic-only:                         %d' % len(logic))
    print('  ... exactly one working node:       %d' % len([s for s in sizes if s == 1]))
    print('  ... one or two working nodes:       %d' % len([s for s in sizes if s <= 2]))
    print()


def definitions(visual):
    """Every reading of "one node" this repo could plausibly have meant."""
    comps = []
    for p in sorted(glob.glob(PREFABS)):
        comps.extend(load(p))
    logic = [c for c in comps if is_logic_only(c, visual)]

    rows = [
        ('one node in the graph, total', lambda c: len(nodes_of(c)) == 1),
        ('a single graph root', lambda c: len(c.get('graph', {}).get('roots', []) or []) == 1),
        ('two nodes or fewer, total', lambda c: len(nodes_of(c)) <= 2),
        ('three nodes or fewer, total', lambda c: len(nodes_of(c)) <= 3),
        ('exactly one WORKING node', lambda c: len(working(nodes_of(c))) == 1),
        ('one or two WORKING nodes', lambda c: len(working(nodes_of(c))) <= 2),
    ]
    print('=' * 74)
    print('"49 of them one node" — every reading, over the same 80 components')
    for label, pred in rows:
        print('  %-38s %3d' % (label, len([c for c in logic if pred(c)])))
    print('  %-38s %s' % ('CMP-003 as filed', '49  <- reproduced by none of the above'))
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', default=LEARNBOOK, help='a legacy project.json to census')
    ap.add_argument('--definitions', action='store_true', help='resolve the "one node" number')
    args = ap.parse_args()

    visual = visual_types()
    census_prefabs(visual)
    if args.definitions:
        definitions(visual)
    if os.path.exists(args.app):
        census_app(args.app, visual)
    else:
        print('(no app censused: %s not on this machine)' % args.app, file=sys.stderr)


if __name__ == '__main__':
    main()
