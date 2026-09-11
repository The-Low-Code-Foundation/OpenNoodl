/**
 * FIX-021 — where the project-creation wizard's Location field starts.
 *
 * The wizard opened with an empty, read-only Location, so every new project in
 * every mode cost a trip through the native folder dialog before `Next` would
 * even enable — `isStepValid('basics')` requires `location.length > 0`, and the
 * field can only be filled by `Browse…`. Ruled (B): seed it from the last
 * folder the user chose, falling back to the documents folder on first run.
 * `Browse…` still overrides, and still records.
 *
 * Kept import-free on purpose. The rule is graded from `tests-unit`, a
 * plain-Node runner that cannot reach `EditorSettings` or `@noodl/platform`;
 * the three inputs below are exactly what `ProjectsPage` reads out of those two
 * and hands in.
 */

/**
 * `EditorSettings` key holding the last folder a project was created into.
 * Exported so the reader and the writer cannot drift apart.
 */
export const LAST_PROJECT_LOCATION_KEY = 'projects.lastCreateLocation';

export interface ProjectLocationSources {
  /**
   * Whatever `EditorSettings` has under {@link LAST_PROJECT_LOCATION_KEY}.
   * Typed `unknown` deliberately: settings are JSON off disk, so a hand-edited
   * file can put a number or an object here.
   */
  remembered: unknown;
  /** `platform.getDocumentsPath()` — the first-run fallback. */
  documentsPath: string;
  /** `filesystem.exists` — a remembered folder can be deleted or unmounted. */
  exists: (path: string) => boolean;
}

/**
 * The Location the wizard should open with.
 *
 * **Invariant: the result is either the empty string, or a folder that exists.**
 * That is the whole point of the existence checks. The basics step validates
 * only that the string is non-empty, so seeding a path that has since been
 * deleted or unmounted would *enable* `Next` and then fail at creation — worse
 * than the empty field this replaces, because the failure arrives later and
 * names something the user never typed. Empty means exactly what it meant
 * before: `Browse…` is the only way on.
 */
export function pickProjectLocation({ remembered, documentsPath, exists }: ProjectLocationSources): string {
  if (typeof remembered === 'string' && remembered.length > 0 && exists(remembered)) {
    return remembered;
  }
  if (documentsPath.length > 0 && exists(documentsPath)) {
    return documentsPath;
  }
  return '';
}
