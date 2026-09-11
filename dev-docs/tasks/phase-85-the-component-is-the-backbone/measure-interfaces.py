#!/usr/bin/env python3
"""CMP-001 — the one instrument that grades every arm.

Classifies component interfaces across the three graph dialects this project
has, so the corpus, the prefabs, a production app and a freshly built page are
measured by the same rules rather than by four hand-written passes.

  ./measure-interfaces.py corpus     packages/noodl-types/src/node-catalog-enriched.json
  ./measure-interfaces.py legacy     "library/prefabs/*/project/project.json"
  ./measure-interfaces.py legacy     "/path/to/LearnBook v5.1 Noodl/project.json"
  ./measure-interfaces.py v2         "/path/to/project/components"

A port is what a connection carries out of a `Component Inputs` node or into a
`Component Outputs` node — the same derivation `componentInterfaces()` uses.
Parameters set on an instance are NOT ports: a component nobody can vary is the
thing being measured, and counting its instance parameters would hide it.
"""
import json
import glob
import os
import re
import sys
from collections import Counter

VARIANT = re.compile(
    r'colou?r|size|variant|theme|tone|style|kind|shape|width|height'
    r'|margin|padding|gap|radius|weight|align|font|opacity', re.I)
FLAG = re.compile(
    r'^(show|hide|use|is|has|can|enable|disable|allow|visible|open'
    r'|active|checked|selected|disabled|readonly|required|loading)', re.I)
LOGIC = ('States', 'Condition', 'Switch', 'Component Children',
         'Expression', 'For Each', 'Static Data')


def flatten(roots):
    """Legacy/corpus graphs nest children; v2 stores a flat list."""
    out = []

    def walk(n):
        out.append(n)
        for ch in n.get('children') or []:
            if isinstance(ch, dict):
                walk(ch)
    for r in roots:
        walk(r)
    return out


def measure(name, nodes, conns, acc, rows):
    ci = {n['id'] for n in nodes if n.get('type') == 'Component Inputs'}
    co = {n['id'] for n in nodes if n.get('type') == 'Component Outputs'}
    ports = sorted({c['fromProperty'] for c in conns if c.get('fromId') in ci})
    outs = sorted({c['toProperty'] for c in conns if c.get('toId') in co})
    for n in nodes:
        if n.get('type') in LOGIC:
            acc['logic'][n['type']] += 1
    if not ports:
        return
    acc['n']['components'] += 1
    acc['n']['ports'] += len(ports)
    if any(VARIANT.search(p) for p in ports):
        acc['n']['with variant port'] += 1
    if any(FLAG.match(p) for p in ports):
        acc['n']['with flag port'] += 1
    if outs:
        acc['n']['with outputs'] += 1
    rows.append((name, ports, outs))


def load_corpus(path, acc, rows):
    for e in json.load(open(path))['examples']:
        for c in e['components']:
            measure(f"{e['id']}::{c['name']}", c.get('nodes', []),
                    c.get('connections') or [], acc, rows)


def load_legacy(pattern, acc, rows):
    for pf in sorted(glob.glob(pattern)):
        entry = json.load(open(pf))
        for c in entry.get('components', []):
            g = c.get('graph', {})
            measure(c['name'], flatten(g.get('roots', [])),
                    g.get('connections') or [], acc, rows)


def load_v2(root, acc, rows):
    for f in sorted(glob.glob(os.path.join(root, '**', 'nodes.json'), recursive=True)):
        d = os.path.dirname(f)
        conns = json.load(open(os.path.join(d, 'connections.json')))['connections']
        measure(os.path.relpath(d, root), json.load(open(f))['nodes'], conns, acc, rows)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    kind, target = sys.argv[1], sys.argv[2]
    acc = {'n': Counter(), 'logic': Counter()}
    rows = []
    {'corpus': load_corpus, 'legacy': load_legacy, 'v2': load_v2}[kind](target, acc, rows)

    n = acc['n']
    if not n['components']:
        sys.exit('no components with Component Inputs found — wrong dialect or path?')
    print(f"{kind}: {target}")
    for k in ('components', 'ports', 'with variant port', 'with flag port', 'with outputs'):
        pct = f"  ({n[k] / n['components']:.0%})" if k.startswith('with') else ''
        print(f"  {k:<20} {n[k]:>4}{pct}")
    print(f"  {'mean ports/comp':<20} {n['ports'] / n['components']:>6.1f}   (not a floor — see AC3)")
    print(f"  logic: {dict(acc['logic'].most_common())}")

    # CMP-001 AC3. Three floors, and only these three: mean-ports and variant-port
    # were measured against the shipped template and do not separate the arms.
    print("\n  CMP-001 AC3")
    for label, value, floor in (
            ('publishes outputs', n['with outputs'] / n['components'], 0.50),
            ('carries a flag port', n['with flag port'] / n['components'], 0.20),
            ('States per component', acc['logic']['States'] / n['components'], 0.15)):
        fmt = f"{value:.2f}" if 'States' in label else f"{value:.0%}"
        flr = f"{floor:.2f}" if 'States' in label else f"{floor:.0%}"
        print(f"    {'PASS' if value >= floor else 'FAIL'}  {label:<22} {fmt:>6}  (floor {flr})")

    if '-v' in sys.argv:
        print()
        for name, ports, outs in sorted(rows, key=lambda r: -len(r[1]) - len(r[2])):
            print(f"  {name}\n     IN : {', '.join(ports)}"
                  + (f"\n     OUT: {', '.join(outs)}" if outs else ''))


if __name__ == '__main__':
    main()
