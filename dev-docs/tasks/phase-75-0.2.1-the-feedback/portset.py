import re, os, json, sys

ROOT='packages/noodl-viewer-react/src'
units_ports=set(); dim_ports=set()
for dirpath,_,files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith(('.ts','.tsx','.js','.jsx')): continue
        p=os.path.join(dirpath,fn)
        lines=open(p,encoding='utf-8',errors='replace').read().split('\n')
        for i,l in enumerate(lines):
            hit=None
            if re.search(r'^\s*units:\s*\[', l): hit='units'
            elif re.search(r"^\s*(name|type):\s*'dimension'", l): hit='dim'
            if not hit: continue
            # walk back to the enclosing `type: {` (or the dimension line itself)
            j=i; typ_indent=None
            while j>=0:
                m=re.match(r'^(\s*)type:\s*\{', lines[j])
                if m: typ_indent=len(m.group(1)); break
                m2=re.match(r"^(\s*)type:\s*'dimension'", lines[j])
                if m2: typ_indent=len(m2.group(1)); break
                j-=1
            if typ_indent is None: continue
            k=j-1
            while k>=0:
                m=re.match(r"^(\s*)['\"]?([A-Za-z0-9_]+)['\"]?:\s*\{", lines[k])
                if m and len(m.group(1))<typ_indent:
                    (units_ports if hit=='units' else dim_ports).add(m.group(2)); break
                k-=1
print(json.dumps({'units':sorted(units_ports),'dimension':sorted(dim_ports)},indent=1))
