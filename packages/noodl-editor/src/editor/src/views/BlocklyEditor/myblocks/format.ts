/**
 * My Blocks — the saved-definition format (LGC-007 §2).
 *
 * A saved group of blocks is JSON and nothing else. This module owns the shape of that JSON
 * and its validation, and it owns nothing else: no Blockly, no editor singletons, no I/O.
 * That is deliberate — the format, the cycle guard, the shape inference and the inliner all
 * have to be verifiable in a plain Node runner, because the alternative is verifying them by
 * driving an Electron editor, which is how the expensive half of this repo's defects survived.
 *
 * ## Why the format looks like this
 *
 * §2 says a definition is JSON so that export and import are free, and says explicitly: do
 * not design a format that forecloses a shared library. Three properties buy that:
 *
 * 1. **Identity is a uid, not a name.** `id` is what a call block stores; `name` is display
 *    and is renameable without breaking a caller. Two libraries authored independently can
 *    therefore be merged, because a name collision is a display problem, not a link break.
 * 2. **A definition names its dependencies** (`requires`). A partial export can carry its
 *    transitive closure without the exporter having to re-derive it, and the import side can
 *    remap a colliding id and rewrite the edges.
 * 3. **The envelope is separate from the shelf.** A `MyBlocksLibrary` is scope-free: the same
 *    envelope is a project's shelf, a user's backpack, an export file, or one day a package
 *    fetched from a shared library. `source` is where that last one will record provenance;
 *    it is free-text today and nothing reads it.
 *
 * ## What is cached and what is authoritative
 *
 * `shape`, `params` and `requires` are all **derived from `body`** and are stored anyway, so
 * that the toolbox can render a call block without parsing every definition body on every
 * flyout open. The store recomputes all three on every write. **No guard trusts them**: the
 * cycle check re-walks the body (`collectReferences`), because §3 requires the check to hold
 * at generate time too, and a stale `requires` in a file edited by hand or produced by an
 * older version is exactly the case where it would not.
 *
 * @module BlocklyEditor/myblocks
 */

/** The format version written into every definition and every envelope. */
export const MY_BLOCKS_FORMAT_VERSION = 1;

/** One block in Blockly's `serialization.workspaces.save()` output. */
export interface BlocklyBlockJson {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson };
  extraState?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Blockly's whole-workspace serialisation. */
export interface BlocklyWorkspaceJson {
  blocks?: { languageVersion?: number; blocks?: BlocklyBlockJson[] };
  variables?: { name: string; id: string; type?: string }[];
  [key: string]: unknown;
}

/**
 * Blockly's own grammar decides this, and §1 is explicit that we do not invent one of our
 * own: a group that produces a value and has no effects is a block with an output plug that
 * drops mid-expression; anything with signals or several outputs is a block you stack.
 */
export type MyBlockShape = 'value' | 'statement';

/**
 * A hole in a definition body, addressed from the body root.
 *
 * The path alternates a root index with edge tokens, so it is a plain string array that
 * survives JSON with no reader: `['0', 'i:VALUE', 'n', 'i:A']` means "root block 0, into its
 * `VALUE` input, then down one `next`, then into that block's `A` input". The last token is
 * always the input the argument is spliced into.
 *
 * It is recomputed from the body on every write, so it cannot drift out of step with the
 * blocks it addresses.
 */
export type MyBlockHolePath = string[];

export interface MyBlockParam {
  /** Stable within the definition; the call block names its argument input after this. */
  id: string;
  /** Display label on the call block. */
  name: string;
  /** A Blockly connection check, or `'*'` for "anything". */
  type: string;
  /** Where in `body` the argument is spliced at expansion time. */
  hole: MyBlockHolePath;
}

export interface MyBlockDefinition {
  formatVersion: number;
  /** Referenced by call blocks. Stable across renames; unique within a shelf. */
  id: string;
  /** Display name, shown in the toolbox and on the call block. Renameable. */
  name: string;
  description?: string;
  /** Derived from `body`. Recomputed on every write; never trusted by a guard. */
  shape: MyBlockShape;
  /** Derived from `body`. Recomputed on every write; never trusted by a guard. */
  params: MyBlockParam[];
  /** Ids of definitions this body calls. Derived; recomputed on every write. */
  requires: string[];
  /** The saved blocks, as `Blockly.serialization.workspaces.save()` returns them. */
  body: BlocklyWorkspaceJson;
  /** Toolbox/block hue. A string because Blockly's category colours are strings. */
  colour?: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
}

/**
 * A shelf, an export file, or a future package — the same envelope in all three cases.
 * Nothing in here says *where* it is stored; that is the shelf's business, not the format's.
 */
export interface MyBlocksLibrary {
  formatVersion: number;
  /**
   * Free-text provenance. Written by an export, ignored by everything today. It exists so
   * that a shared library has somewhere to put its name and version without a format bump.
   */
  source?: { name?: string; url?: string; version?: string };
  definitions: MyBlockDefinition[];
}

export function emptyLibrary(): MyBlocksLibrary {
  return { formatVersion: MY_BLOCKS_FORMAT_VERSION, definitions: [] };
}

/**
 * Not a discriminated union, on purpose: this repo compiles with `strictNullChecks` off, and
 * without it TypeScript will not narrow `{ok: true} | {ok: false}` on the literal. A shape
 * that reads correctly only under a compiler flag we do not set is a shape that lies.
 */
export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors?: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate one definition.
 *
 * Strict about the things a later reader depends on (id, name, body, shape) and forgiving
 * about the derived fields, which are healed rather than rejected: a definition that arrives
 * from an export written by an older build should import, not bounce. A future version bump
 * is rejected loudly, because silently loading a format we do not understand is how a saved
 * program gets quietly downgraded on the next write.
 */
export function validateDefinition(value: unknown): ValidationResult<MyBlockDefinition> {
  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, errors: ['a definition must be an object'] };
  }

  const version = typeof value.formatVersion === 'number' ? value.formatVersion : MY_BLOCKS_FORMAT_VERSION;
  if (version > MY_BLOCKS_FORMAT_VERSION) {
    errors.push(
      `this block was saved by a newer version of the editor (format ${version}, this build reads ${MY_BLOCKS_FORMAT_VERSION})`
    );
  }

  if (typeof value.id !== 'string' || value.id.length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    errors.push('name must be a non-empty string');
  }
  if (value.shape !== 'value' && value.shape !== 'statement') {
    errors.push("shape must be 'value' or 'statement'");
  }
  if (!isPlainObject(value.body)) {
    errors.push('body must be a serialised Blockly workspace');
  }

  const params: MyBlockParam[] = [];
  if (value.params !== undefined) {
    if (!Array.isArray(value.params)) {
      errors.push('params must be an array');
    } else {
      value.params.forEach((param, index) => {
        if (!isPlainObject(param) || typeof param.id !== 'string' || typeof param.name !== 'string') {
          errors.push(`params[${index}] must have a string id and name`);
          return;
        }
        params.push({
          id: param.id,
          name: param.name,
          type: typeof param.type === 'string' ? param.type : '*',
          hole: Array.isArray(param.hole) ? (param.hole.filter((s) => typeof s === 'string') as string[]) : []
        });
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    value: {
      formatVersion: version,
      id: value.id as string,
      name: value.name as string,
      description: typeof value.description === 'string' ? value.description : undefined,
      shape: value.shape as MyBlockShape,
      params,
      requires: Array.isArray(value.requires) ? (value.requires.filter((r) => typeof r === 'string') as string[]) : [],
      body: value.body as BlocklyWorkspaceJson,
      colour: typeof value.colour === 'string' ? value.colour : undefined,
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now
    }
  };
}

/**
 * Validate a whole envelope.
 *
 * One bad definition does not sink the file: the good ones come back in `value` and the bad
 * ones come back as errors on `rejected`, because losing an entire project shelf to one
 * malformed entry is a worse outcome than losing the entry.
 */
export function validateLibrary(value: unknown): {
  library: MyBlocksLibrary;
  rejected: { index: number; errors: string[] }[];
} {
  if (!isPlainObject(value) || !Array.isArray(value.definitions)) {
    return { library: emptyLibrary(), rejected: [] };
  }

  const definitions: MyBlockDefinition[] = [];
  const rejected: { index: number; errors: string[] }[] = [];

  value.definitions.forEach((entry, index) => {
    const result = validateDefinition(entry);
    if (result.ok) {
      definitions.push(result.value);
    } else {
      rejected.push({ index, errors: result.errors });
    }
  });

  return {
    library: {
      formatVersion: typeof value.formatVersion === 'number' ? value.formatVersion : MY_BLOCKS_FORMAT_VERSION,
      source: isPlainObject(value.source) ? (value.source as MyBlocksLibrary['source']) : undefined,
      definitions
    },
    rejected
  };
}

/** A structural deep copy. Definitions are plain JSON by construction, so this is total. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A uid for a definition or a parameter.
 *
 * Deliberately not `crypto.randomUUID` — this module must import nothing, and it runs in a
 * renderer, in a plain Node test runner and (once export lands) potentially in the MCP
 * server. 22 characters of base36 randomness is more than enough for a shelf.
 */
export function newId(prefix = 'mb'): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand()}${rand()}`;
}
