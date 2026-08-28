# SBR-008 — The deploy keeps the panel's wires

**Fixes finding 7.** 🧭 **Ruled s1: SB-017 §11.4 option 1 — derive it in the runtime, where
the one writer already is.** The deployed admin panel currently drops all 19 record-field
(`prop-`) wires: it writes a page that is published, in the navigation and ordered — with no
title and no slug. Works in preview, breaks on deploy, the worst way round.

## 1. The person sentence

**A client on the DEPLOYED panel edits a title and a slug, saves, and the save saves.**

## 2. The fix, as ruled (SB-017 §11.4, unchanged)

- The viewer is already the single writer for these dynamic ports, and `setDynamicPorts`
  **replaces** — so a fourth `NodeTypeAdapters` class is a second writer and the two erase each
  other. Instead: `recordFieldPorts`'s callers also mint `prop-<field>` **from the node's own
  wires**. Reachable: `ComponentModel.addConnection` emits `inputConnectionAdded` on the target
  node (`componentmodel.ts:149-158`); `NodeModel.inputs`/`.outputs` are the connection lists.
- ⚠️ **Stated cost, accepted in the ruling**: a second copy of the rule (the editor cannot
  import `@noodl/runtime`; `cloudDynamicPorts.ts` imports nothing). The mitigation exists:
  `tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts` is exactly the harness for
  grading two copies against each other — extend it to this pair.
- Why these 19 exist at all (SB-017 §12, keep in mind while fixing): `prop-<field>` is derived
  from the **columns of a class**, and a site nobody has written to has none. The wire-derived
  answer is satisfiable from the project alone — the same answer §10.2 took on the cloud side.

## 3. Acceptance criteria

1. **(person)** Deploy the template to a folder, serve it, claim, edit title+slug, save — the
   record has the new values and the public site renders them.
2. The warnings-chip census reads **0** (from 19). The census spec asserts the new number the
   same way s19's did — pinned to a reading, so a regression moves it visibly.
3. `sb017-deploy-connection-parity.test.ts`'s `REMOVED_BY_SB018` exemption is revisited
   deliberately: the shortfall list should now be empty or renamed to what remains — never
   silently widened.
4. The two copies of the derivation rule are graded against each other (extended agreement
   harness), with a mutant in each direction.
5. Preview behaviour is unchanged (the class-column derivation still works when columns exist)
   — the control pair varies only the deploy.

## 4. Traps

- 🔴 Two producers meeting = assert cardinality where they meet: if both the class-column and
  wire-derived paths mint the same port, it must exist once, not twice (the
  check-in-a-second-pipeline trap — counts doubled, suites green).
- 🔴 The export's health filter keeps meaning what it says (option 3 stays rejected) — the fix
  is runtime-side; do not touch the exporter's wire filtering.
