/**
 * VFN-009 — the operations the *Saved blocks* section performs, in one place.
 *
 * ## 🔴 Every write goes through `store.save`
 *
 * That is acceptance criterion 8 and it is the reason this file exists rather than the section
 * calling the store directly from six click handlers. `MyBlocksStore.save` is where the cycle
 * guard runs, where the shape and the parameter list are recomputed from the body, and where a
 * definition that changed shelf is removed from the one it left. A write that went round it would
 * be a definition with a `shape` field that no longer describes its own blocks — and `expandWorkspace`
 * trusts that field to decide whether a call site is legal.
 *
 * There are exactly three mutating doors below — {@link saveDefinitionBlocks},
 * {@link renameDefinition}, {@link duplicateDefinition} — plus the two removals, and every one of
 * them is `store.save` / `store.rename` / `store.remove`. `tests-unit/vfn-009` reads this file's
 * own source and convicts any other spelling.
 *
 * ## What is deliberately not here
 *
 * **Nothing regenerates a node.** Criterion 3: an edit to a definition does **not** rewrite the
 * `generatedCode` of the nodes that use it — they regenerate on their own next edit, which is
 * measured behaviour from LGC-007 §6 rather than a guess. A sweep would be a separate, explicit
 * action, and the section says so in words (`describeRegeneration`) rather than leaving a builder
 * to find out.
 *
 * @module BlocklyEditor
 */

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ProjectModel } from '../../models/projectmodel';
import { cloneJson, type BlocklyWorkspaceJson, type MyBlockDefinition, type MyBlocksLibrary } from './myblocks/format';
import { detachDefinition } from './myblocks/expand';
import { definitionChangeFor, type DefinitionChange } from './myblocks/definitionChange';
import { definitionUsageMap, referencingNodeIds, parseWorkspaceParameter, WORKSPACE_PARAMETER, type DefinitionUsage } from './myblocks/usage';
import { crossProjectNodeIds, type CrossProjectUsage } from './myblocks/crossProjectUsage';
import { flushShelves, myBlocksStore } from './MyBlocksShelves';
import { findNodeById, scanProject } from './MyBlocksProjectScan';
import type { MyBlocksScope } from './myblocks/store';

export interface SaveDefinitionResult {
  definition: MyBlockDefinition;
  /** What the edit changed about the definition's interface, against the version it replaced. */
  change: DefinitionChange;
  /**
   * Where it is used, **only when the interface changed**.
   *
   * `undefined` means "not asked", not "nowhere" — the walk is skipped for the common edit, which
   * changes the body and nothing a caller can see.
   */
  usage?: DefinitionUsage;
}

/** One row of the section: the definition, which shelf it is on, and where it is used. */
export interface SavedBlockRow {
  definition: MyBlockDefinition;
  scope: MyBlocksScope;
  /**
   * Where it is used **in the open project**.
   *
   * 🔴 VFN-010 — `undefined` means *"nobody asked"*, not *"nowhere"*. The launcher has no open
   * project and no cheap answer: its count is a walk of every recent project off disk, which is
   * an explicit action rather than something that happens on render. Rendering "Not used yet" for
   * a question that was never asked is how a builder is talked into a delete.
   */
  usage?: DefinitionUsage;
}

/**
 * VFN-010 — the backpack's rows, for a surface with no project behind it.
 *
 * The **user shelf only**, and no usage: see {@link SavedBlockRow.usage}. `list('user')` rather
 * than filtering `list()`, because the unqualified list resolves an id collision project-first and
 * would hide a backpack definition that a project happens to shadow — from the surface whose whole
 * job is to manage the backpack.
 */
export function backpackRows(): SavedBlockRow[] {
  return myBlocksStore()
    .list('user')
    .map((definition) => ({ definition, scope: 'user' as MyBlocksScope }));
}

/**
 * Every definition on either shelf, with its usage computed live.
 *
 * One walk of the project for the whole list — `definitionUsageMap` takes the ids together
 * precisely so that a shelf of twenty does not cost twenty walks and twenty `JSON.parse` of every
 * workspace in the project on every render.
 */
export function savedBlockRows(): SavedBlockRow[] {
  const store = myBlocksStore();
  const definitions = store.list();
  const usage = definitionUsageMap(
    definitions.map((d) => d.id),
    scanProject(),
    store
  );

  return definitions.map((definition) => ({
    definition,
    // `scopeOf` resolves project-before-user, which is the same order `get` resolves in, so the
    // shelf shown is the shelf the editor would actually read the definition from.
    scope: store.scopeOf(definition.id) as MyBlocksScope,
    usage: usage.get(definition.id) as DefinitionUsage
  }));
}

/**
 * VFN-010 criterion 6 — start the backpack's disk write **now**, not in a second's time.
 *
 * 🔴 `EditorSettings.set` debounces by 1000 ms, so every mutation below leaves a window in which a
 * quit loses the write. Every one of them is a discrete gesture, so the flush is free, and it is
 * done here rather than in each of the five call sites because a door added later would otherwise
 * silently reopen the window. `MyBlocksShelves.flushShelves` never throws.
 *
 * ⚠️ Only the backpack. The project shelf is `ProjectModel.setSetting`, which has its own save
 * path and its own dirty tracking, and forcing an editor-settings write for it would be a write of
 * an unrelated file.
 */
function flushIfBackpack(scope: MyBlocksScope | undefined): void {
  if (scope === 'user') void flushShelves();
}

/** One definition's usage, right now. Called at the moment a warning is shown, never earlier. */
export function usageNow(definitionId: string): DefinitionUsage {
  const store = myBlocksStore();
  return definitionUsageMap([definitionId], scanProject(), store).get(definitionId) as DefinitionUsage;
}

/**
 * Open the Logic Builder on a definition's body.
 *
 * The window is the tab host and the tab is keyed by its subject, so opening a definition that is
 * already open switches to that tab rather than mounting a second workspace over the same shelf
 * entry. See `contexts/tabSubject.ts`.
 */
export function openDefinitionTab(definitionId: string): boolean {
  const definition = myBlocksStore().get(definitionId);
  if (!definition) return false;

  EventDispatcher.instance.emit('LogicBuilder.OpenDefinitionTab', {
    definitionId: definition.id,
    name: definition.name,
    workspace: JSON.stringify(definition.body)
  });
  return true;
}

/**
 * A settled edit in a definition tab, written back to the same id.
 *
 * 🔴 The **same id**, which is what makes editing a saved block an edit rather than a fork: every
 * call block stores the id, so a body written back under a fresh id would leave every existing
 * call site pointing at the old copy and the change would appear to have done nothing.
 *
 * Name, description, colour and shelf all come off the definition as it is stored — the block
 * editor has no UI for any of them, and defaulting them here would silently blank fields VFN-008
 * exists to keep.
 *
 * @throws MyBlocksCycleError when the edit makes the definition graph cyclic. Nothing is written;
 *   `save` runs the check against the graph the write *would* produce, before it produces it.
 */
export function saveDefinitionBlocks(definitionId: string, workspaceJson: string): SaveDefinitionResult | undefined {
  const store = myBlocksStore();
  const existing = store.get(definitionId);
  if (!existing) {
    console.warn(`[MyBlocks] An edit arrived for a saved block that is no longer on any shelf (${definitionId}).`);
    return undefined;
  }

  const body = parseWorkspaceParameter(workspaceJson);
  if (!body) {
    // A workspace that will not parse is not a reason to blank a definition. The refusal that
    // publishes its silence has been shipped twice on this feature already.
    console.error(`[MyBlocks] Could not read the edited blocks for "${existing.name}"; the saved block is unchanged.`);
    return undefined;
  }

  /**
   * What this edit changes about the definition's **interface**, computed against the definition
   * as it is *before* the write. Criterion 6 wants the call sites named when a shape change is
   * about to make them refuse, and after the write there is nothing left to compare against.
   */
  const change = definitionChangeFor(existing, body);

  const scope = store.scopeOf(existing.id) as MyBlocksScope;
  const definition = store.save({
    id: existing.id,
    name: existing.name,
    description: existing.description,
    body,
    colour: existing.colour,
    scope
  });
  flushIfBackpack(scope);

  /**
   * ⚠️ The usage walk runs **only when the interface changed**, which is a rare edit inside a rare
   * edit — the common case is moving a block around, and paying for a walk of every Visual Function
   * in the project on every 300 ms flush would be a tax on typing.
   */
  return { definition, change, usage: change.changed ? usageNow(definitionId) : undefined };
}

/**
 * Rename, and break nothing.
 *
 * Safe by construction rather than by care: a call block stores the **id**, never the name. That
 * is the single reason identity is a uid in this format, and it is why this is one line.
 */
export function renameDefinition(definitionId: string, name: string): MyBlockDefinition | undefined {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return undefined;

  const store = myBlocksStore();
  const scope = store.scopeOf(definitionId);
  const renamed = store.rename(definitionId, trimmed);
  flushIfBackpack(scope);
  return renamed;
}

/**
 * Copy a definition onto a shelf under a fresh id.
 *
 * Through `store.save` with **no id**, which mints one — the copy has to be a different definition
 * or it would not be a copy, and every call block that pointed at the original still points at the
 * original. `remapCallTargets` is deliberately *not* applied: a duplicate that calls the same
 * dependencies is what a duplicate is, and remapping is the import path's job.
 */
export function duplicateDefinition(definitionId: string, scope?: MyBlocksScope): MyBlockDefinition | undefined {
  const store = myBlocksStore();
  const existing = store.get(definitionId);
  if (!existing) return undefined;

  const target = scope ?? (store.scopeOf(definitionId) as MyBlocksScope);
  const copy = store.save({
    name: `${existing.name} copy`,
    description: existing.description,
    body: cloneJson(existing.body),
    colour: existing.colour,
    scope: target
  });
  flushIfBackpack(target);
  return copy;
}

/**
 * Delete, refusing while anything still points at it.
 *
 * The node ids are supplied here because the store cannot find them — its own `remove` says so.
 * Recomputed at the moment of the press, never read off a list the panel rendered earlier.
 *
 * @throws MyBlocksInUseError naming every definition and node that would be left dangling.
 */
export function removeDefinition(definitionId: string): void {
  const usage = usageNow(definitionId);
  const store = myBlocksStore();
  const scope = store.scopeOf(definitionId);
  store.remove(definitionId, { referencingNodeIds: referencingNodeIds(usage) });
  flushIfBackpack(scope);
}

/**
 * VFN-010 criterion 5 — delete a backpack block, refusing while a **scanned project** still uses it.
 *
 * 🔴 The refusal is the same refusal. `MyBlocksStore.remove` counts `referencingNodeIds` and throws
 * `MyBlocksInUseError`; all this door does is supply that list from a cross-project scan instead of
 * from the open project, so the launcher and the editor refuse for the same reason and by the same
 * code. A launcher that decided for itself whether a block was in use would eventually disagree
 * with the editor, and the disagreement would surface as a delete the launcher allowed.
 *
 * ⚠️ **The scan is the caller's, and must be fresh.** The names in the message come from it — the
 * store knows ids and nothing else — so the caller runs it at the moment of the press and hands it
 * in. Nothing here re-runs it, because a second walk of every project on disk would be a second
 * answer, and the one the builder was shown is the one the refusal must be about.
 *
 * @throws MyBlocksInUseError while any scanned project, or any other saved block, still calls it.
 */
export function removeBackpackDefinition(definitionId: string, usage: CrossProjectUsage): void {
  const store = myBlocksStore();
  store.remove(definitionId, { referencingNodeIds: crossProjectNodeIds(usage) });
  void flushShelves();
}

export interface ImportResult {
  imported: MyBlockDefinition[];
  /** Entries in the file that were not valid definitions. Reported, never silently dropped. */
  rejected: { index: number; errors: string[] }[];
}

/**
 * Import a library file onto a shelf.
 *
 * `exportDefinitions` already closes over dependencies and `importLibrary` already remaps ids and
 * rewrites every reference to them, so this is the way in and not a new mechanism. That matters
 * most on the backpack: a backpack is where a builder accumulates the blocks worth sharing, and
 * before this there was an export with nothing on the other end of it.
 *
 * ⚠️ **`remapExisting` is deliberately off.** With it on, re-importing a file you already imported
 * mints fresh ids and you end up with two of everything and call blocks split between them. Off, an
 * id that is already on a shelf is treated as an update — re-importing the same export is
 * idempotent, which is what a builder syncing a backpack between machines actually wants. A genuine
 * "keep both" is `duplicateDefinition` on the result, which is an explicit gesture.
 *
 * @throws MyBlocksCycleError when the file's contents would make the definition graph cyclic.
 *   Nothing is written past that point; the check runs inside `save`, against the graph the write
 *   would produce.
 */
export function importDefinitions(input: unknown, scope: MyBlocksScope): ImportResult {
  const result = myBlocksStore().importLibrary(input, scope);
  flushIfBackpack(scope);
  return { imported: result.imported, rejected: result.rejected };
}

export interface DetachResult {
  /** How many programs — nodes plus other definitions — had the blocks pasted into them. */
  rewritten: number;
  /** The node ids whose `workspace` parameter was rewritten. */
  nodeIds: string[];
  /** The definition ids whose bodies were rewritten. */
  definitionIds: string[];
}

/**
 * §4's other half: paste the blocks in everywhere, then delete.
 *
 * > *"Deleting a definition that is still referenced must be refused or must offer to
 * > inline-and-detach. Silently breaking three other nodes is the worst available outcome."*
 *
 * Order is load-bearing: every body is rewritten **while the definition is still on the shelf**,
 * because `detachDefinition` expands from the store, and only then is `remove(id, {force: true})`
 * called. `force` exists for this caller and for no other.
 *
 * 🔴 **No `generatedCode` is touched, and the programs still generate exactly what they generated
 * before.** That is not a hope: expanding a detached body is the same transform applied at a
 * different time — `expandWorkspace(detached)` and `expandWorkspace(original)` produce the same
 * workspace, which `tests-unit/vfn-009` asserts by comparing the two expansions rather than by
 * observing that a function ran.
 *
 * ⚠️ **A node whose blocks are open in a tab is a hazard this does not solve.** The tab holds its
 * own copy of the workspace and flushes it 300 ms after the next edit, which would write the
 * un-detached body back over this one. Detaching is a rare, deliberate act and the section says so;
 * closing the block editor first is the answer until a tab can be told its model moved underneath
 * it. Written down rather than left to be rediscovered.
 */
export function detachAndRemove(definitionId: string): DetachResult {
  const store = myBlocksStore();
  const usage = usageNow(definitionId);

  // Definitions first. Each is rewritten and saved back under its own id, so `referencesTo` is
  // empty by the time the force-remove happens and the refusal would have nothing left to name.
  const definitionIds: string[] = [];
  for (const referrer of usage.definitions) {
    const existing = store.get(referrer.id);
    if (!existing) continue;

    store.save({
      id: existing.id,
      name: existing.name,
      description: existing.description,
      body: detachDefinition(existing.body, definitionId, store),
      colour: existing.colour,
      scope: store.scopeOf(existing.id) as MyBlocksScope
    });
    definitionIds.push(existing.id);
  }

  const nodeIds: string[] = [];
  for (const nodeId of referencingNodeIds(usage)) {
    const node = findNodeById(nodeId);
    if (!node) continue;

    const body = parseWorkspaceParameter(node.parameters?.[WORKSPACE_PARAMETER]);
    if (!body) continue;

    node.model.setParameter(WORKSPACE_PARAMETER, JSON.stringify(detachDefinition(body, definitionId, store)));
    nodeIds.push(nodeId);
  }

  store.remove(definitionId, { force: true });

  // Unconditional: a detach rewrites the bodies of *referring* definitions, and any of them can be
  // on the backpack whatever shelf the one being removed was on.
  void flushShelves();

  return { rewritten: nodeIds.length + definitionIds.length, nodeIds, definitionIds };
}

/**
 * A standalone library carrying this definition and everything it depends on.
 *
 * The transitive closure comes by default and has to be opted out of; an export that dropped a
 * dependency would import as a dangling reference on the far side, which is the same broken state
 * §4 spends its whole warning on.
 */
export function exportDefinition(definitionId: string): MyBlocksLibrary {
  return myBlocksStore().exportDefinitions([definitionId], {
    source: { name: ProjectModel.instance?.name }
  });
}

/** The body of a definition, as a workspace. `undefined` when it is no longer on a shelf. */
export function definitionBody(definitionId: string): BlocklyWorkspaceJson | undefined {
  return myBlocksStore().get(definitionId)?.body;
}
