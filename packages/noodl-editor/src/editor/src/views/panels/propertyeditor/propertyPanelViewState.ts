/**
 * FB-017 — what the property panel remembers between selections, and where it keeps it.
 *
 * Two different things are remembered, and they are deliberately kept in two different stores
 * with two different lifetimes. Collapsing them into one keyed structure — which is how the
 * task file first framed it — gets one of the two wrong whichever lifetime you pick.
 *
 * ## Expansion is per GROUP NAME, globally, and it is persisted
 *
 * `Ports.ts` already declared `const groupExpansions = {}` at module scope and read it on every
 * render. Nothing ever wrote to it, and `addToGroup` hardcoded `isExpanded: true`, so the
 * collapse mechanism has been dead code with a live reader for as long as it has existed. This
 * module is the writer it was missing, and it keeps the original key: the **group name**.
 *
 * That is the right key, not a fallback. A builder who opens `Advanced CSS` on one Group is
 * telling you what they want to see on the next Group too; re-collapsing it on every selection
 * would be the same disrespect the panel already shows by resetting scroll. Keying by node id
 * instead would also make the store unbounded — a project's node ids are not a fixed set, and
 * this one goes to disk.
 *
 * ⚠️ Persisted through {@link EditorSettings}, which is user state (`JSONStorage`), **not**
 * project state. Writing panel chrome into the project dirties every component — see
 * `opening-a-project-dirties-every-component`. FB-017's own trap list names this.
 *
 * ## Scroll is per NODE ID, and it is NOT persisted
 *
 * Jordan's session 2 named scroll reset as the specific source of the session's headaches: the
 * panel rebuilds at scroll 0 on every reselect. That has to be keyed by node — the whole point
 * is that going away to a wired node and coming back leaves you where you were.
 *
 * It deliberately does not go to disk. A scroll offset measured against a panel that has since
 * changed height is not a preference, it is a stale number, and restoring one on a fresh
 * editor start would scroll a builder to a place they have never been. It is also unbounded in
 * exactly the way expansion is not, hence {@link SCROLL_MEMORY_LIMIT}.
 *
 * ## Why module state rather than React state
 *
 * `index.tsx` already carries this lesson for the tab strip, in `rememberedTab`:
 * `SidebarModel.createPanel` builds a brand-new function component on every node selection, so
 * the element *type* changes identity and React unmounts and remounts the panel every time you
 * click a different node. Anything held in `useState` here is destroyed by the very event it
 * exists to survive.
 */

import { ADVANCED_CSS_GROUP } from './propertyPanelTiers';

/** `EditorSettings` key. Namespaced so the panel's chrome cannot collide with a feature's settings. */
export const GROUP_EXPANSION_SETTINGS_KEY = 'propertyPanel.groupExpansion';

/**
 * How many nodes' scroll offsets are kept.
 *
 * Large enough that moving between the handful of nodes one task touches never forgets, small
 * enough that a long session on a big project cannot grow this without bound. Eviction is
 * oldest-touched-first.
 */
export const SCROLL_MEMORY_LIMIT = 50;

/**
 * Whether a group starts expanded when nothing has been stored about it.
 *
 * 🔴 This is the whole user-visible behaviour of FB-017's scope 2: `Advanced CSS` — and only
 * `Advanced CSS` — starts collapsed. Every other heading behaves exactly as it does today, so
 * the change a builder sees is one new collapsed section, not a panel that has hidden things
 * from them in places they did not ask about.
 */
export function defaultExpansionFor(groupName: string): boolean {
  return groupName !== ADVANCED_CSS_GROUP;
}

/**
 * The persisted expansion map, as read from settings.
 *
 * Kept as a plain record of the groups whose state has been *changed from default*, rather than
 * of every group ever seen. A settings blob that lists all 58 visual group names would encode
 * today's library into a user's profile, and a group later renamed would sit there forever.
 */
export type GroupExpansionMap = Record<string, boolean>;

/**
 * Reads a stored expansion map defensively.
 *
 * Anything that is not a plain object of booleans is answered with an empty map rather than a
 * repaired version of nonsense — the same rule `popoutSize.restoreCodeEditorSize` applies to a
 * stored size, and for the same reason: a malformed blob from an older build must degrade to
 * defaults, not to a panel with arbitrary sections shut.
 */
export function parseGroupExpansion(stored: unknown): GroupExpansionMap {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};

  const map: GroupExpansionMap = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value === 'boolean') map[key] = value;
  }
  return map;
}

/**
 * The two calls this module needs from a settings store, and nothing else.
 *
 * 🔴 It is an interface rather than a direct `EditorSettings` import because importing
 * `editorsettings` here would make this whole module unloadable by the `tests-unit` jest runner.
 * `EditorSettings` builds its singleton at module scope, and that constructor reaches
 * `JSONStorage` in `@noodl/platform`, which needs an Electron renderer around it — the module
 * does not fail a test, it fails the suite *to run*, which is the failure mode that looks like a
 * spec nobody wrote.
 *
 * Injecting the store instead means the behaviour below — the defaults, the delete-on-default
 * rule, the LRU eviction — is graded against the real code with a plain object standing in for
 * disk, rather than against a mock of itself.
 */
export interface ExpansionStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * The panel's remembered chrome. One instance, module-scoped — see the note at the top of this
 * file for why this cannot live in React state.
 */
export class PropertyPanelViewState {
  private expansion: GroupExpansionMap | null = null;
  private readonly scrollByNode = new Map<string, number>();

  constructor(private readonly store: ExpansionStore) {}

  /**
   * Lazily loaded on first read rather than in the constructor.
   *
   * `EditorSettings` fetches from disk asynchronously and resolves `ready` when it has; the
   * singleton below is built at import time, which for this panel is before that fetch can have
   * finished. Reading late means the first render after startup sees real settings instead of an
   * empty object — and `isExpanded` is read on every render anyway, so there is no first-paint
   * flash to protect against.
   */
  private load(): GroupExpansionMap {
    if (this.expansion === null) {
      this.expansion = parseGroupExpansion(this.store.get(GROUP_EXPANSION_SETTINGS_KEY));
    }
    return this.expansion;
  }

  isExpanded(groupName: string): boolean {
    const stored = this.load();
    return Object.prototype.hasOwnProperty.call(stored, groupName) ? stored[groupName] : defaultExpansionFor(groupName);
  }

  setExpanded(groupName: string, isExpanded: boolean): void {
    const stored = this.load();

    if (isExpanded === defaultExpansionFor(groupName)) {
      // Back to the default: drop the entry rather than storing the default value, so the map
      // stays a record of deliberate choices. A user who never touches a heading leaves no trace
      // of it, and a default changed in a later release reaches them.
      delete stored[groupName];
    } else {
      stored[groupName] = isExpanded;
    }

    this.store.set(GROUP_EXPANSION_SETTINGS_KEY, { ...stored });
  }

  getScroll(nodeId: string | undefined): number {
    if (!nodeId) return 0;
    return this.scrollByNode.get(nodeId) ?? 0;
  }

  setScroll(nodeId: string | undefined, scrollTop: number): void {
    if (!nodeId) return;

    // A negative or non-finite offset is not a place anybody scrolled to.
    if (!Number.isFinite(scrollTop) || scrollTop < 0) return;

    // Re-insert so the Map's insertion order is a true least-recently-touched order.
    this.scrollByNode.delete(nodeId);
    this.scrollByNode.set(nodeId, scrollTop);

    while (this.scrollByNode.size > SCROLL_MEMORY_LIMIT) {
      const oldest = this.scrollByNode.keys().next();
      if (oldest.done) break;
      this.scrollByNode.delete(oldest.value);
    }
  }
}

/**
 * The store the running editor uses: `EditorSettings`, reached through a `require` at call time.
 *
 * ⚠️ The lazy `require` is the point, not an accident of style. A top-level import would drag
 * `@noodl/platform` into every consumer of this module, including the jest runner — see
 * {@link ExpansionStore}. By the time either method runs there is a renderer, because the only
 * caller is a rendering property panel.
 */
const editorSettingsStore: ExpansionStore = {
  get(key) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../../utils/editorsettings').EditorSettings.instance.get(key);
  },
  set(key, value) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../../utils/editorsettings').EditorSettings.instance.set(key, value);
  }
};

export const propertyPanelViewState = new PropertyPanelViewState(editorSettingsStore);
