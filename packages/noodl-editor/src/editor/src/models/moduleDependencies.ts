/**
 * ✅ LBR-007 — the entries an entry cannot work without, and the order to
 * install them in.
 *
 * **Deliberately import-free**, for the same reason `moduleCompatibility.ts` is:
 * `modulelibrarymodel.ts` reaches `@electron/remote` (through
 * `getContentEndpoint`), the editor's `Model` base and the whole ImportFlow view
 * tree, none of which start under a plain-Node runner. The rule here is pure —
 * a list off an index row — so it lives where a jest spec can reach it, and the
 * model wraps it with the two impure things it needs: the content endpoint and
 * `_install`.
 *
 * ## Where the list comes from
 *
 * An entry's `library.json` authors dependencies as `"<type-dir>/<slug>"`
 * strings (`"modules/custom-html"`, `"prefabs/avatar"`).
 * `scripts/library/build.js` resolves those against the other entries on disk —
 * failing `library:build` on an unknown slug or a cycle — flattens the
 * transitive closure into dependency-first order, and publishes it into
 * `index.json` as the resolved descriptors this file consumes. So by the time
 * the editor sees the field it is already a flat, ordered, install-ready list:
 * there is no graph walk in the click path, no slug to derive back out of a
 * versioned zip URL, and no need for the *other* tab's index to have loaded
 * before a module can pull in a prefab.
 *
 * ## 🔴 Why this refuses rather than skips
 *
 * A dependency the editor cannot understand is not a dependency it can do
 * without: the entry that declared it is built ON it, so installing the entry
 * alone reproduces exactly the failure the field exists to abolish — a node
 * that installs cleanly and then renders as a red dashed placeholder with
 * nothing anywhere saying why (`modules/pdf-viewer`, verbatim, for two
 * releases). Skipping a malformed row would put that failure back and make it
 * silent again, so `dependencyInstallOrder` throws and names the row.
 */

/**
 * One resolved dependency, as `scripts/library/build.js` publishes it. The
 * field set is exactly what an install needs: `project` to fetch,
 * `type` to pick prefab vs module semantics, `label` for the dialogs and the
 * refusals, and `minEditorVersion` so the compat gate can answer for the
 * dependency and not only for the entry that asked for it.
 */
export interface IModuleDependency {
  /** `"<type-dir>/<slug>"`, as authored. Identity for dedupe and for messages. */
  key?: string;
  label?: string;
  type?: 'prefab' | 'module';
  /** Index-relative zip path, e.g. `library/modules/custom-html-1.0.2.zip`. */
  project: string;
  version?: string;
  minEditorVersion?: string;
}

/** The fields of a library entry this rule reads. Structural, so no import is needed. */
export interface DependencyCandidate {
  label?: string;
  dependencies?: IModuleDependency[];
}

/**
 * The dependencies of `entry`, in install order, deduplicated.
 *
 * Order is preserved from the index because the build already made it
 * dependency-first; this only drops repeats, which a diamond in the graph can
 * produce even though the build dedupes within one entry's closure.
 *
 * Throws on a row that carries no `project`, because that row names something
 * this editor cannot install and the caller must not proceed as if the entry
 * were self-contained — see the header.
 */
export function dependencyInstallOrder(entry: DependencyCandidate): IModuleDependency[] {
  const declared = entry?.dependencies;
  if (!declared) return [];

  if (!Array.isArray(declared)) {
    throw new Error(
      `The library index entry for "${entry.label ?? 'this entry'}" declares dependencies in a form ` +
        `this editor does not understand. Update NodeGX, or install the entry's dependencies by hand.`
    );
  }

  const seen = new Set<string>();
  const out: IModuleDependency[] = [];

  for (const dep of declared) {
    if (!dep || typeof dep !== 'object' || typeof dep.project !== 'string' || dep.project.length === 0) {
      throw new Error(
        `The library index entry for "${entry.label ?? 'this entry'}" lists a dependency this editor ` +
          `cannot resolve to something installable (${JSON.stringify(dep)}). Update NodeGX, or install ` +
          `the entry's dependencies by hand.`
      );
    }
    // `project` is the identity that matters: two rows pointing at the same zip
    // are the same install, whatever they call themselves.
    if (seen.has(dep.project)) continue;
    seen.add(dep.project);
    out.push(dep);
  }

  return out;
}

/**
 * Whether a dependency installs with prefab or module semantics.
 *
 * Mirrors `ModuleCard`'s rule rather than inventing a second one: the explicit
 * `type` field when the index has it, and the legacy `/prefab` substring on the
 * zip URL when it does not.
 */
export function dependencyKind(dep: IModuleDependency): 'prefab' | 'module' {
  if (dep.type) return dep.type === 'prefab' ? 'prefab' : 'module';
  return dep.project.includes('/prefab') ? 'prefab' : 'module';
}
