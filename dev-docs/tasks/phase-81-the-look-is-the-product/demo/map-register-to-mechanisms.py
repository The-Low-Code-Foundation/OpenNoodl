import re
s=open('README.md').read()
rows=re.findall(r'^\| (V\d+) \| (.*?) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$', s, re.M)
state={r[0]:('CLOSED' if '🟢' in r[4] else ('REC' if '⚪' in r[4] else 'OPEN')) for r in rows}

# Which mechanism RETIRES the row — i.e. would have prevented it, or removes the need to teach it.
# '' = no mechanism retires it, and the reason is stated.
M={
 'V1' :('M2+M4','a static predicate: a visual Group in a column with no sizeMode'),
 'V2' :('M2+M4','predicate on clip+overflowable subtree; the expander always emits a scrolling page spine'),
 'V3' :('','template auth logic — VIB-008, not a look mechanism'),
 'V4' :('M3','poverty finding: a query/repeater with no empty-state sibling (doctrine §9)'),
 'V5' :('','a real capability gap; nothing procedural would have supplied a gradient port'),
 'V6' :('M4','building an expander FORCES the named section set to exist — it surfaces the gap'),
 'V7' :('','a real capability gap: nothing on disk for a src to point at'),
 'V8' :('M5','a page falls out of a corpus generated from compositions'),
 'V9' :('M1+M3','you do not need to INSTRUCT ambition if the render is mandatory and the gate demands it'),
 'V10':('M3','this row IS mechanism 3'),
 'V11':('M1','mandatory render institutionalises the door state instead of leaving it to a harness'),
 'V12':('','a gate hole, found and fixed; no mechanism prevents a rule from having a blind spot'),
 'V13':('','a token gap — --display-* had to be invented'),
 'V14':('M2+M3','predicate: a text input with no explicit placeholder; placeholder-grade copy is a poverty tell'),
 'V15':('M1+M3','only a 1900 render shows it; dead-viewport ratio is a poverty finding'),
 'V16':('M4','four section kinds that are one layout is exactly what a real section expander replaces'),
 'V17':('M2','🔴 THE decisive row: a session that had JUST READ V1 shipped V1 anyway'),
 'V18':('','instrument hygiene in a devtool'),
 'V19':('','instrument hygiene in the Judge'),
 'V20':('M2','already retired THIS way — the fix was a gate that rejects the bad icon value, not a doctrine line'),
 'V21':('M2','predicate: an Icon with no iconColor'),
 'V22':('M2','predicate: Component Inputs with no ports and connections out of it — 14 hits, purely static'),
 'V23':('M2','predicate: a glyph name absent from the installed manifest'),
 'V24':('','CI/process hygiene — run the other package suite'),
 'V25':('M5','a corpus generated from compositions CANNOT contradict them'),
 'V26':('M1+M3','needs a render; a gutter that disagrees between bands is a poverty/consistency finding'),
 'V27':('M2+M5','raw-spacing predicate; and generated cards cannot drift from the card composition'),
 'V28':('M2','predicate: a raw px where a --space token fits, and a var() in a units-typed port'),
 'V29':('M1+M2','only a 1900 render shows it; predicate: maxWidth on a Text inside a centred shell'),
 'V30':('','a licensing/sourcing decision'),
 'V31':('','a real vocabulary gap: no port takes a box-shadow string. M4 could hide it, not close it'),
 'V32':('M2','gate configuration — run the rule that already exists'),
 'V33':('M2+M5','predicate: an image param empty AND unfed by a connection — the row says only the connection list separates the two cases'),
 'V34':('','instrument hygiene — measure with the library installed'),
 'V35':('','NOT retirable: it is the CONSTRAINT that forces M1-M4 over more instruction'),
 'V36':('','a deploy-payload decision'),
 'V37':('','instrument hygiene in the pruner'),
 'V38':('M2+M4','predicate: justifyContent on a contentHeight box is inert; the expander owns vertical rhythm'),
 'V39':('M5','one source for the parameters and the prose means they cannot disagree'),
 'V40':('','build hygiene — a generated file was not regenerated'),
 'V41':('','release, not authoring'),
}
live=[r for r in state if state[r] in ('OPEN','REC')]
ret =[r for r in M if M[r][0]]
print('rows:',len(rows),' live (OPEN+REC):',len(live))
print()
print('RETIRED BY A MECHANISM: %d of %d rows (%.0f%%)' % (len(ret),len(rows),100*len(ret)/len(rows)))
lr=[r for r in live if M[r][0]]
print('OF THE LIVE DEBT:       %d of %d rows (%.0f%%)' % (len(lr),len(live),100*len(lr)/len(live)))
print()
for m in ['M1','M2','M3','M4','M5']:
    hit=[r for r in M if m in M[r][0]]
    hl=[r for r in hit if r in live]
    print(f'{m}: {len(hit):2} rows total, {len(hl):2} of them live  ->  {", ".join(sorted(hit,key=lambda x:int(x[1:])))}')
print()
print('NOT RETIRED BY ANY MECHANISM (%d):' % len([r for r in M if not M[r][0]]))
for r in sorted([r for r in M if not M[r][0]],key=lambda x:int(x[1:])):
    print(f'  {r:4} {state[r]:7} {M[r][1]}')
