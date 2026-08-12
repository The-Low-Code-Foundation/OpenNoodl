/**
 * The two shelves, and the rules for putting things on them (LGC-007 §2, §3, §4).
 *
 * §2 asks for two scopes and says why they differ:
 *
 * - **`project`** — saved into the project, so it travels with it and a collaborator gets it.
 * - **`user`** — the builder's own backpack, on disk, across projects.
 *
 * This module is the whole rule set and none of the persistence. A `MyBlocksShelf` is two
 * methods; `shelves.ts` implements them against `ProjectModel` and `EditorSettings`, and
 * `InMemoryShelf` implements them against nothing, which is what the tests use. Keeping the
 * rules on this side of that line is what makes the cycle guard, the delete refusal and the
 * import remapping testable in a plain Node runner.
 *
 * **Project wins on an id collision.** If the same definition id is on both shelves — which
 * happens the moment someone copies a block from their backpack into a project and then keeps
 * both — the project copy is the one that resolves, because that is the copy a collaborator
 * opening the project would get, and a program that generates differently for its author than
 * for everyone else is the worse failure.
 *
 * @module BlocklyEditor/myblocks
 */

import {
  cloneJson,
  emptyLibrary,
  MY_BLOCKS_FORMAT_VERSION,
  newId,
  validateLibrary,
  type BlocklyWorkspaceJson,
  type MyBlockDefinition,
  type MyBlocksLibrary
} from './format';
import { assertAcyclic, type DefinitionGraph } from './cycles';
import { callDefinitionId, collectReferences, walkWorkspace } from './references';
import { inferSignature, schemaWithCalls, type BlockSchema } from './shape';

export type MyBlocksScope = 'project' | 'user';

/** The scopes in resolution order. Project first: see the header. */
export const SCOPES: readonly MyBlocksScope[] = ['project', 'user'];

/**
 * Where a library lives. Two methods on purpose — an adapter that needs more than this is an
 * adapter that has grown a rule, and the rules belong in the store.
 */
export interface MyBlocksShelf {
  readonly scope: MyBlocksScope;
  read(): MyBlocksLibrary;
  write(library: MyBlocksLibrary): void;
}

export class InMemoryShelf implements MyBlocksShelf {
  private library: MyBlocksLibrary;

  constructor(readonly scope: MyBlocksScope, library: MyBlocksLibrary = emptyLibrary()) {
    this.library = cloneJson(library);
  }

  read(): MyBlocksLibrary {
    return cloneJson(this.library);
  }

  write(library: MyBlocksLibrary): void {
    this.library = cloneJson(library);
  }
}

export class MyBlocksInUseError extends Error {
  readonly definitionIds: string[];
  readonly nodeIds: string[];

  constructor(message: string, definitionIds: string[], nodeIds: string[]) {
    super(message);
    this.name = 'MyBlocksInUseError';
    this.definitionIds = definitionIds;
    this.nodeIds = nodeIds;
  }
}

export interface SaveDefinitionInput {
  /** Omit to create. Supply to overwrite — which is how "edit a definition" arrives here. */
  id?: string;
  name: string;
  description?: string;
  body: BlocklyWorkspaceJson;
  colour?: string;
  scope: MyBlocksScope;
}

export interface RemoveOptions {
  /**
   * Logic Builder nodes known to reference this definition. The store cannot find these
   * itself — it has no project — so the caller passes them in, and the refusal covers them.
   */
  referencingNodeIds?: string[];
  /**
   * Delete anyway. Only the inline-and-detach path sets this, *after* it has rewritten every
   * referencing body. §4 is explicit that a silent dangling reference is the worst outcome
   * available, so nothing else may set it.
   */
  force?: boolean;
}

export class MyBlocksStore {
  private readonly shelves: Record<MyBlocksScope, MyBlocksShelf>;

  constructor(shelves: { project: MyBlocksShelf; user: MyBlocksShelf }, private readonly schema: BlockSchema = schemaWithCalls()) {
    this.shelves = shelves;
  }

  /** Every definition on one shelf, or on both in resolution order. */
  list(scope?: MyBlocksScope): MyBlockDefinition[] {
    if (scope) return this.shelves[scope].read().definitions;

    const seen = new Set<string>();
    const all: MyBlockDefinition[] = [];
    for (const s of SCOPES) {
      for (const definition of this.shelves[s].read().definitions) {
        if (seen.has(definition.id)) continue;
        seen.add(definition.id);
        all.push(definition);
      }
    }
    return all;
  }

  get(id: string): MyBlockDefinition | undefined {
    for (const scope of SCOPES) {
      const found = this.shelves[scope].read().definitions.find((d) => d.id === id);
      if (found) return found;
    }
    return undefined;
  }

  scopeOf(id: string): MyBlocksScope | undefined {
    for (const scope of SCOPES) {
      if (this.shelves[scope].read().definitions.some((d) => d.id === id)) return scope;
    }
    return undefined;
  }

  /**
   * The definition graph, with the edges recomputed from each body.
   *
   * Recomputed, not read off `requires`, and that is the point: §3 requires the guard to hold
   * at generate time, and the case it is guarding against is a stored `requires` that no
   * longer matches the body it claims to describe.
   */
  graph(): DefinitionGraph {
    const definitions = this.list();
    const byId = new Map(definitions.map((d) => [d.id, d]));

    return {
      edgesOf(id: string) {
        const definition = byId.get(id);
        return definition ? collectReferences(definition.body) : undefined;
      },
      nameOf(id: string) {
        return byId.get(id)?.name ?? id;
      }
    };
  }

  /**
   * Create or overwrite a definition.
   *
   * Order matters here. The cycle check runs **before** anything is written, against the graph
   * the write would produce, so a refused save leaves the shelf exactly as it was.
   *
   * @throws MyBlocksCycleError if the write would make the definition graph cyclic.
   */
  save(input: SaveDefinitionInput): MyBlockDefinition {
    const id = input.id ?? newId();
    const body = cloneJson(input.body);
    const requires = collectReferences(body);

    assertAcyclic(id, requires, this.graph(), input.name);

    const signature = inferSignature(body, this.schema);
    const now = new Date().toISOString();
    const existing = this.get(id);

    const definition: MyBlockDefinition = {
      formatVersion: MY_BLOCKS_FORMAT_VERSION,
      id,
      name: input.name,
      description: input.description,
      shape: signature.shape,
      params: signature.params,
      requires,
      body,
      colour: input.colour,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    // A definition that changed shelf must not end up on both, or `get` would resolve the
    // stale project copy forever.
    const previousScope = this.scopeOf(id);
    if (previousScope && previousScope !== input.scope) {
      this.mutate(previousScope, (definitions) => definitions.filter((d) => d.id !== id));
    }

    this.mutate(input.scope, (definitions) => {
      const index = definitions.findIndex((d) => d.id === id);
      if (index === -1) return definitions.concat(definition);
      const next = definitions.slice();
      next[index] = definition;
      return next;
    });

    return definition;
  }

  rename(id: string, name: string): MyBlockDefinition {
    const scope = this.scopeOf(id);
    const definition = this.get(id);
    if (!scope || !definition) throw new Error(`No saved block with id ${id}`);

    // Renaming cannot break a caller: a call block stores the id, never the name. That is the
    // single reason identity is a uid in this format.
    const renamed = { ...cloneJson(definition), name, updatedAt: new Date().toISOString() };
    this.mutate(scope, (definitions) => definitions.map((d) => (d.id === id ? renamed : d)));
    return renamed;
  }

  /** The ids of definitions whose bodies call `id`. */
  referencesTo(id: string): string[] {
    return this.list()
      .filter((d) => d.id !== id && collectReferences(d.body).indexOf(id) !== -1)
      .map((d) => d.id);
  }

  /**
   * Delete a definition, refusing while anything still points at it.
   *
   * §4: *"Deleting a definition that is still referenced must be refused or must offer to
   * inline-and-detach. Silently breaking three other nodes is the worst available outcome."*
   * This is the refusal half. The detach half is `detachDefinition` in `expand.ts`, which
   * rewrites the referencing bodies and then calls back in here with `force`.
   *
   * @throws MyBlocksInUseError naming every definition and node that would be broken.
   */
  remove(id: string, options: RemoveOptions = {}): void {
    const scope = this.scopeOf(id);
    if (!scope) return;

    if (!options.force) {
      const definitionIds = this.referencesTo(id);
      const nodeIds = options.referencingNodeIds ?? [];
      if (definitionIds.length > 0 || nodeIds.length > 0) {
        const name = this.get(id)?.name ?? id;
        throw new MyBlocksInUseError(
          `"${name}" is still used by ${definitionIds.length} saved block(s) and ${nodeIds.length} node(s). ` +
            `Deleting it would break them.`,
          definitionIds,
          nodeIds
        );
      }
    }

    this.mutate(scope, (definitions) => definitions.filter((d) => d.id !== id));
  }

  /**
   * Export definitions as a standalone library.
   *
   * The transitive closure comes with them by default. An export that dropped a dependency
   * would import as a dangling reference on the far side, which is the same broken state §4
   * spends its warning on — so the default is closed, and `withDependencies: false` has to be
   * asked for.
   */
  exportDefinitions(ids: string[], options: { withDependencies?: boolean; source?: MyBlocksLibrary['source'] } = {}): MyBlocksLibrary {
    const withDependencies = options.withDependencies !== false;
    const wanted = new Set<string>();

    const visit = (id: string) => {
      if (wanted.has(id)) return;
      const definition = this.get(id);
      if (!definition) return;
      wanted.add(id);
      if (withDependencies) collectReferences(definition.body).forEach(visit);
    };
    ids.forEach(visit);

    return {
      formatVersion: MY_BLOCKS_FORMAT_VERSION,
      source: options.source,
      definitions: this.list()
        .filter((d) => wanted.has(d.id))
        .map((d) => cloneJson(d))
    };
  }

  /**
   * Import a library onto a shelf.
   *
   * An id that is already taken by a *different* definition is remapped to a fresh one, and
   * every reference to it — inside the imported bodies and inside the imported `requires` — is
   * rewritten to match. That is what lets the same block be imported into a project twice, and
   * it is the mechanism a shared library would use later; it is also why identity had to be a
   * uid rather than a name.
   *
   * An id that is already taken by a definition with the *same* id is treated as an update, not
   * a collision — re-importing the same export file is idempotent rather than duplicating.
   */
  importLibrary(
    input: unknown,
    scope: MyBlocksScope,
    options: { remapExisting?: boolean } = {}
  ): { imported: MyBlockDefinition[]; remapped: Record<string, string>; rejected: { index: number; errors: string[] }[] } {
    const { library, rejected } = validateLibrary(input);
    const remapped: Record<string, string> = {};

    if (options.remapExisting) {
      for (const definition of library.definitions) {
        if (this.get(definition.id)) remapped[definition.id] = newId();
      }
    }

    const imported: MyBlockDefinition[] = [];
    for (const definition of library.definitions) {
      const body = remapCallTargets(cloneJson(definition.body), remapped);
      imported.push(
        this.save({
          id: remapped[definition.id] ?? definition.id,
          name: definition.name,
          description: definition.description,
          body,
          colour: definition.colour,
          scope
        })
      );
    }

    return { imported, remapped, rejected };
  }

  private mutate(scope: MyBlocksScope, change: (definitions: MyBlockDefinition[]) => MyBlockDefinition[]): void {
    const library = this.shelves[scope].read();
    this.shelves[scope].write({
      formatVersion: MY_BLOCKS_FORMAT_VERSION,
      source: library.source,
      definitions: change(library.definitions)
    });
  }
}

/**
 * Rewrite every call block's target through `map`, in place, on a body you already own.
 *
 * Exported because import is not the only caller: a future "duplicate this block" and the
 * shared-library install path both need exactly this.
 */
export function remapCallTargets(body: BlocklyWorkspaceJson, map: Record<string, string>): BlocklyWorkspaceJson {
  if (Object.keys(map).length === 0) return body;

  walkWorkspace(body, ({ block }) => {
    const current = callDefinitionId(block);
    if (current && map[current]) {
      (block.extraState as Record<string, unknown>).defId = map[current];
    }
  });

  return body;
}
