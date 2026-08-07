# Import report

Imported from `<fixture>/synthetic-unconvertible` ("Synthetic unconvertible fixture") on 2026-08-02T00:00:00.000Z.

NodeGX is a fresh start, and legacy projects import on a best-effort basis. This file is the honest half of that: every construct in the imported set is accounted for below, nothing was silently dropped, and anything that could not be converted is still in the project — visibly marked, with its original type and parameters — rather than deleted.

## Verdict

**REBUILD** — This project is small (10 nodes) and 38% of it did not convert. Rebuilding it in NodeGX will almost certainly cost you less than repairing this import. The entries below tell you what the project did, which is the part worth keeping — treat them as a specification to rebuild from rather than a defect list to work through.

- 6 of 16 constructs (38%) could not be converted.
- The imported set is 10 nodes.
- Both thresholds are met: at or under 150 nodes, and at or over 25% unconverted.

## Summary

| Outcome | Constructs |
|---|---|
| Could not be converted (`placeholder`) | 4 |
| Not carried across (`dropped`) | 2 |
| Converted, with changes (`converted-with-changes`) | 3 |
| Converted — notes (`converted`) | 7 |
| **Total assessed** | **16** |

13 entries below. The remaining 3 constructs used current node types and converted without comment — they are counted, not listed.

## Could not be converted

#### `node:/App:n-byob-query:noodl.byob.QueryData`

"Query Data" (`noodl.byob.QueryData`) was removed from NodeGX and nothing provides it. The node is kept exactly as authored so you can see what was there, but it will not run.

- **Where:** component `/App`, node "Fetch users"
- **Consider:** `DbCollection2`
- **Ports that differ:** `records` → `items`, `fetch` → `storageFetch`, `create` → `store`, `update` → `store`, `delete` → `store`
- **What to do:** The BYOB family was retired when the backend contract converged (BCN-004/010). The replacement takes different port names, so an automatic rewrite would re-point wires onto ports that mean something else. Replace it with `DbCollection2` and re-point the wires listed above by hand.

#### `node:/App:n-byob-create:noodl.byob.CreateRecord`

"Create Record" (`noodl.byob.CreateRecord`) was removed from NodeGX and nothing provides it. The node is kept exactly as authored so you can see what was there, but it will not run.

- **Where:** component `/App`, node "Add user"
- **Consider:** `NewDbModelProperties`
- **Ports that differ:** `records` → `items`, `fetch` → `storageFetch`, `create` → `store`, `update` → `store`, `delete` → `store`, `success` → `created`
- **What to do:** The BYOB family was retired when the backend contract converged (BCN-004/010). The replacement takes different port names, so an automatic rewrite would re-point wires onto ports that mean something else. Replace it with `NewDbModelProperties` and re-point the wires listed above by hand.

#### `node:/App:n-byob-subscribe:noodl.byob.SubscribeToChanges`

"Subscribe To Changes" (`noodl.byob.SubscribeToChanges`) was removed from NodeGX and nothing provides it. The node is kept exactly as authored so you can see what was there, but it will not run.

- **Where:** component `/App`, node "Watch users"
- **What to do:** Realtime subscription stopped being a node in BCN-008; it is now a property of the Query Records node. There is no node to convert to — delete this one and rebuild the behaviour.

#### `node:/App:n-module-node:SomeModuleProvidedNode`

`SomeModuleProvidedNode` resolves to no node type in NodeGX and no module is being imported that could provide it. The node is kept exactly as authored so you can see what was there, but it will not run.

- **Where:** component `/App`, node "From a module we do not have"
- **What to do:** If this came from a module, install the module and re-import. Otherwise delete the node and rebuild the behaviour with a built-in type.

## Not carried across

#### `project-field:deviceSettings`

The project carried device settings. NodeGX does not read or write them, so they are lost on the first save.

- **Where:** field `deviceSettings`
- **What to do:** Nothing in NodeGX consumes this field. If the settings mattered, re-express them as project settings or a viewport configuration; there is no automatic path.

#### `project-field:thumbnailURI`

The project carried an embedded thumbnail. NodeGX regenerates thumbnails from the running project, so the stored one is not carried.

- **Where:** field `thumbnailURI`
- **What to do:** No action needed — the launcher regenerates the thumbnail when the project first renders.

## Converted, with changes

#### `node:/App:n-rest-plain:REST2`

Converted from REST to HTTP Request. `method` has no HTTP Request equivalent and was not carried — check the request still does what you meant.

- **Where:** component `/App`, node "Fetch weather"
- **Became:** `net.noodl.HTTP`
- **Consider:** `net.noodl.HTTP`
- **Ports that differ:** `resource` → `url`, `fetch` → `fetch`, `success` → `success`, `failure` → `failure`, `cancel` → `cancel`, `canceled` → `canceled`
- **What to do:** Set the method on the HTTP Request node, or add a header, to restore the `method` behaviour.

#### `project-field:rootComponent`

The project's home was recorded by component name ("App"). NodeGX records it by node id, so the field is rewritten on load.

- **Where:** field `rootComponent`
- **Became:** `rootNodeId`
- **What to do:** No action needed, unless the home page is wrong after the import.

#### `project-field:version`

The project was written in project format 1 and was upgraded to 4 on load.

- **Where:** field `version`
- **Became:** `version 4`
- **What to do:** No action needed. The upgrade chain is well-trodden and runs on every open.

## Converted — notes

#### `node:/App:n-rest-scripted:REST2`

This REST node carries a request or response script. It is left as a REST node — REST still runs — because rewriting it to HTTP Request would discard that code, and HTTP Request has nowhere to put it.

- **Where:** component `/App`, node "Signed request"
- **Consider:** `net.noodl.HTTP`, `JavaScriptFunction`
- **What to do:** To modernise by hand: an HTTP Request node for the call, and a Function node either side for what the scripts did.

#### `user-code:/App:n-fn-legacy-react:findDOMNode`

Code in this node uses findDOMNode, which the React 19 runtime removed. The code is carried across verbatim; it will fail at runtime if the project runs on React 19.

- **Where:** component `/App`, node "Measure row", parameter `functionScript`
- **What to do:** use a ref instead

#### `type:Label`

`Label` is deprecated but still works, so it was imported unchanged. 1 instance. A current replacement exists.

- **Consider:** `Text`
- **What to do:** Optional. Replacing it with `Text` is a behaviour change nobody asked for — do it deliberately, with the diff in front of you, not as part of the import.

#### `backend:cloudservices`

The project points at an external backend (https://parse.example.invalid/parse). The configuration is carried across and still resolves, but nothing here can check that the backend answers or that its schema still matches.

- **Where:** field `metadata.cloudservices`
- **What to do:** Open Backend Services after the import and confirm the endpoint. Every Record, Query and User node in the project depends on it.

## For your AI assistant

This report is addressed to an assistant as much as to you. The machine-readable form is `import-report.json` beside this file — an assistant should read that rather than parse this prose.

**Repairable (2):** `node:/App:n-byob-query:noodl.byob.QueryData`, `node:/App:n-byob-create:noodl.byob.CreateRecord`

**No known equivalent (3):** `node:/App:n-byob-subscribe:noodl.byob.SubscribeToChanges`, `node:/App:n-module-node:SomeModuleProvidedNode`, `project-field:deviceSettings` — these are rebuilds, not repairs.

- Every entry with outcome `placeholder` is a node still present in the project, with its original type name, parameters and wiring intact. Nothing was dropped; you do not need the source project to know what was there.
- Look each `equivalents` type up in the node catalog (SUB-004/005) before proposing a replacement — the ports differ between a legacy node and its replacement more often than not, and `portChanges` lists the ones we know about.
- Propose repairs through the authoring loop (AIX-002) as a whole-component candidate. It arrives as a reviewable diff against the live component; the user accepts or rejects it. Do not edit nodes in place.
- The semantic validator (SUB-006) will reject a candidate that leaves a placeholder unresolved or wires a port that does not exist. Run it before submitting; its diagnostics are the fastest way to find a wrong port name.
- When `verdict.recommendation` is `rebuild`, say so to the user before offering repairs. A specification to rebuild from is a better deliverable than twenty partial fixes, and the entries below are that specification.
