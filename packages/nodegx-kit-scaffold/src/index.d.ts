/**
 * Hand-written declarations for `@nodegx/kit-scaffold`.
 *
 * The implementation is plain CommonJS with no build step (a kit scaffold that
 * needed compiling would be a poor advertisement for ✅ D2), so the types are
 * written here rather than emitted. The TypeScript callers — `noodl-mcp` and
 * the editor — `require` the module and import these.
 */

/** The filename a kit's local copy of the published types is written to. */
export declare const KIT_TYPES_FILENAME: 'node-kit.d.ts';

/** The kit-relative path of that copy. */
export declare const KIT_TYPES_RELPATH: string;

/** The specifier the generated `@type` annotations use. Relative, deliberately. */
export declare const TYPES_SPECIFIER: './types/node-kit';

/** One port on the generated example node. */
export interface ExamplePort {
  name: string;
  where: 'inputProps' | 'inputCss' | 'outputProps';
  type: string;
  group: string;
  /** The literal default, as it appears in the generated source. */
  default: string;
  doc: string;
}

export declare const EXAMPLE_PORTS: readonly ExamplePort[];
export declare const EXAMPLE_NODE: { readonly id: string; readonly displayName: string };

/** What the caller gets back about the kit it just asked for. */
export interface ScaffoldedKit {
  /** The directory under `noodl_modules/`. */
  dirName: string;
  /** The name as typed, used as the manifest's `name`. */
  displayName: string;
  /** The node type the example node registers, e.g. `weather-kit.StatTile`. */
  nodeType: string;
  nodeDisplayName: string;
  /** The `@nodegx/node-kit-types` version the types copy was taken from. */
  typesVersion: string;
}

export interface ScaffoldFile {
  /** Kit-relative, POSIX separators. */
  path: string;
  contents: string;
}

export interface ScaffoldFailure {
  ok: false;
  code: 'name-empty' | 'name-not-a-path' | 'name-unusable' | 'no-project' | 'kit-exists';
  message: string;
}

export interface ScaffoldPlan {
  ok: true;
  kit: ScaffoldedKit;
  files: ScaffoldFile[];
}

export interface ScaffoldWritten {
  ok: true;
  kit: ScaffoldedKit;
  /** Absolute path of the kit directory. */
  kitDir: string;
  /** Project-relative POSIX paths, in write order. */
  written: string[];
}

export interface ResolvedName {
  ok: true;
  dirName: string;
  displayName: string;
}

/** Lowercase, alphanumerics and dashes; `''` when nothing usable survives. */
export declare function slugify(name: string): string;

/**
 * Validate a kit name and derive its directory name.
 *
 * ⚠️ Checks the **raw** input for path traversal, not the slug: slugging
 * `../../etc` yields the harmless `etc`, so a slug-only check would accept the
 * traversal.
 */
export declare function resolveKitName(name: string): ResolvedName | ScaffoldFailure;

export declare function nodeTypeName(dirName: string, nodeId: string): string;

/** The installed published types, read at call time — never a checked-in copy. */
export declare function readPublishedTypes(): { body: string; version: string };

/**
 * Whether a kit's `types/node-kit.d.ts` still matches what is published.
 *
 * Compares the body, not the stamped version, so a hand-edited stamp and a
 * hand-edited body are both caught.
 */
export declare function typesCopyStatus(contents: string): {
  current: boolean;
  stampedVersion: string | null;
  publishedVersion: string;
  reason?: string;
};

/** The file set as data. Pure — no filesystem writes. */
export declare function scaffoldKitFiles(options: { name: string }): ScaffoldPlan | ScaffoldFailure;

/** Write a kit into a project. Refuses rather than overwrites. */
export declare function writeKitScaffold(
  projectDir: string,
  options: { name: string }
): Promise<ScaffoldWritten | ScaffoldFailure>;
