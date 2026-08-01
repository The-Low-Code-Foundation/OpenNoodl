#!/bin/zsh
# Break the implementation deliberately, rebuild, and count which checks notice.
WT=/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/68d1c7c7-cb68-4f0c-829f-802a51ab8fb8/scratchpad/wt-bcn005d
SP=$WT/packages/noodl-editor/src/editor/src/models/BackendServices/schemaParsers.ts
PS=$WT/packages/noodl-editor/src/editor/src/models/BackendServices/publishSafe.ts
OUT=/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/68d1c7c7-cb68-4f0c-829f-802a51ab8fb8/scratchpad/bcn005d
cp $SP $OUT/schemaParsers.orig.ts; cp $PS $OUT/publishSafe.orig.ts

run() {
  cd $WT
  npx esbuild packages/noodl-editor/src/editor/src/models/BackendServices/schemaParsers.ts --bundle --format=esm --platform=node --outfile=$OUT/parsers2.mjs >/dev/null 2>&1 || { echo "BUILD FAILED (mutation did not compile)"; return; }
  npx esbuild packages/noodl-editor/src/editor/src/models/BackendServices/publishSafe.ts --bundle --format=esm --platform=node --outfile=$OUT/publishsafe.mjs >/dev/null 2>&1 || { echo "BUILD FAILED"; return; }
  cd $OUT
  node livesync.mjs > $OUT/last-run.txt 2>&1
  grep -E "^[0-9]+ passed" $OUT/last-run.txt || echo "HARNESS CRASHED: $(tail -3 $OUT/last-run.txt | head -1)"
}

restore() { cp $OUT/schemaParsers.orig.ts $SP; cp $OUT/publishSafe.orig.ts $PS; }

echo "M0 baseline (unmutated):        $(run)"

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("return type === 'directus' ? '/relations' : undefined;", "return undefined;")
open(p,'w').write(s)
PY
echo "M1 no relation endpoint:        $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("  schema.relations = relations;\n", "  // MUTATED: descriptors dropped\n")
open(p,'w').write(s)
PY
echo "M2 descriptors never stored:    $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("    if (!field.relationTarget) field.relationTarget = relation.target;", "    if (false) field.relationTarget = relation.target;")
open(p,'w').write(s)
PY
echo "M3 fields never enriched:       $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("          const targetId = f.collectionId ?? f.options?.collectionId;", "          const targetId = undefined as string | undefined;")
open(p,'w').write(s)
PY
echo "M4 PB collectionId ignored:     $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("        if (f.hidden === true) field.hidden = true;", "        // MUTATED: hidden dropped")
open(p,'w').write(s)
PY
echo "M5 PB hidden not propagated:    $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("            field.relationType = maxSelect === 1 ? 'many-to-one' : 'many-to-many';", "            field.relationType = 'many-to-many';")
open(p,'w').write(s)
PY
echo "M6 PB maxSelect ignored:        $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("    if (!Array.isArray(rows)) return undefined;", "    if (!Array.isArray(rows)) return [];")
open(p,'w').write(s)
PY
echo "M7 'could not ask' becomes []:  $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("""    const field = collection.fields.find((candidate) => candidate.name === relation.field);
    if (!field) continue;""",
"""    let field = collection.fields.find((candidate) => candidate.name === relation.field);
    if (!field) {
      field = { name: relation.field, displayName: relation.field, type: 'relation', nativeType: 'relation', required: false };
      collection.fields.push(field);
    }""")
open(p,'w').write(s)
PY
echo "M8 missing columns synthesised: $(run)"; restore

python3 - "$SP" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("  return relation.write.kind === 'foreignKey' ? 'one-to-many' : 'many-to-many';", "  return 'many-to-many';")
open(p,'w').write(s)
PY
echo "M9 relationType from cardinality only: $(run)"; restore

python3 - "$PS" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace("const EDITOR_ONLY_CREDENTIALS = ['adminToken', 'username', 'password'] as const;", "const EDITOR_ONLY_CREDENTIALS = [] as unknown as readonly string[];")
open(p,'w').write(s)
PY
echo "M10 nothing stripped:           $(run)"; restore


python3 - "$SP" <<'PYX'
import sys; p=sys.argv[1]; s=open(p).read()
old = "  if (/[?&]perPage=/.test(configuredPath)) return configuredPath;"
assert old in s
i = s.index(old)
end_marker = "perPage=${POCKETBASE_COLLECTION_PAGE_SIZE}`;\n"
j = s.index(end_marker, i) + len(end_marker)
s = s[:i] + "  return configuredPath;\n" + s[j:]
assert "perPage=${POCKETBASE_COLLECTION_PAGE_SIZE}" not in s, "mutation did not apply"
open(p,'w').write(s)
PYX
echo "M12 PB page size not requested: $(run)"; restore

echo "M13 restored baseline:          $(run)"
