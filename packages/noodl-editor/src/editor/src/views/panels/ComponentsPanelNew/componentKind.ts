/**
 * PNL-006 — what a component *is*, derived rather than guessed.
 *
 * "Kind" is not a first-class property of a component: the project stores a name
 * and a graph, and nothing else. Everything below is derived from the graph, and
 * this file is deliberately explicit about how reliable each derivation is,
 * because the panel it feeds is the most-used surface in the editor and a wrong
 * glyph is worse than a neutral one.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE PANEL USED TO CLAIM, AND WHY IT WAS WRONG
 *
 * `useComponentsPanel` shipped four flags. Two of them could never be true:
 *
 *   checkIsCloudFunction()  matched `node.type.name === 'Cloud Function'`.
 *                           No such node type exists anywhere in the codebase.
 *                           A cloud function component is rooted in
 *                           `noodl.cloud.request` / `noodl.cloud.response`
 *                           (see `ComponentTemplates.CloudFunctionComponentTemplate`
 *                           and `noodl-viewer-cloud/src/nodes/cloud/`). So
 *                           `isCloudFunction` was **always false**.
 *   checkIsVisual()         returned `!checkIsCloudFunction(component)` — so it
 *                           was **always true**.
 *
 * `ComponentItem` picks its glyph in the order root → page → cloud function →
 * visual, so with `isVisual` always true *every* non-page, non-home component
 * rendered the same `UI` glyph. That is the reported "every node in the tree
 * gets the same glyph", and it was a dead branch rather than a design decision.
 * ---------------------------------------------------------------------------
 *
 * COLOUR IS NOT DECIDED HERE. This module answers "what kind of thing is this"
 * (which decides the glyph *shape*). The glyph's *colour* is the canvas category
 * — `ComponentModel.color`, which is what the node-graph painter colours an
 * instance of this component with — and it is applied as a CSS class that
 * resolves the very same `--theme-color-node-category-*` token `CanvasTheme`
 * reads. There is no second palette; see `ComponentsPanel.module.scss`.
 *
 * @module noodl-editor/views/panels/ComponentsPanelNew/componentKind
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';

import { IconName } from '@noodl-core-ui/components/common/Icon';

/**
 * The kinds this panel is willing to assert. Ordered by precedence — the first
 * one that matches wins (see {@link buildKindIndex}).
 *
 * There is deliberately no "logic" kind. A component with no visual root and no
 * cloud root *might* be a logic component, but it might equally be an empty
 * component, a half-built one, or one whose root node type failed to resolve.
 * All of those land on `component`, the neutral glyph — which is the honest
 * answer to "I don't know".
 */
export type ComponentKind = 'home' | 'page' | 'popup' | 'cloudfunction' | 'visual' | 'component';

/** Node type names that root a cloud-function component. */
const CLOUD_ROOT_TYPES = new Set(['noodl.cloud.request', 'noodl.cloud.response']);

/** The node type that roots a page component. */
const PAGE_TYPE = 'Page';

/** The node that *names* a popup component in its `target` parameter. */
const SHOW_POPUP_TYPE = 'NavigationShowPopup';

/**
 * Glyph per kind. `HomeFill` and the filled/outline pairing are the only place
 * weight is used to rank a row — the home component should be findable without
 * reading a label.
 */
const KIND_ICON: Record<ComponentKind, IconName> = {
  home: IconName.HomeFill,
  page: IconName.File,
  popup: IconName.Cards,
  cloudfunction: IconName.CloudFunction,
  visual: IconName.UI,
  component: IconName.Component
};

export function iconForKind(kind: ComponentKind): IconName {
  return KIND_ICON[kind];
}

/** Human-readable kind, for the row's `title` and for assistive technology. */
const KIND_LABEL: Record<ComponentKind, string> = {
  home: 'Home component',
  page: 'Page',
  popup: 'Popup',
  cloudfunction: 'Cloud function',
  visual: 'Visual component',
  component: 'Component'
};

export function labelForKind(kind: ComponentKind): string {
  return KIND_LABEL[kind];
}

export interface ComponentKindInfo {
  kind: ComponentKind;
  /**
   * The canvas category name — `ComponentModel.color`. One of the taxonomy
   * `CanvasTheme` knows (`component` | `visual` | `data` | `javascript`), or
   * `default` when the component has no root that can act as a child.
   *
   * This is *the same value* the node-graph painter passes to
   * `CanvasTheme.categoryColors()` when it paints an instance of this component,
   * so a tree glyph and the node card on the canvas cannot disagree.
   */
  category: string;
}

export type ComponentKindIndex = Map<string, ComponentKindInfo>;

/**
 * One pass over the project's graphs; every component's kind out the other side.
 *
 * Cost note (the panel is the hot path on a large project): the code this
 * replaces called `component.forEachNode` **twice** per component — once for
 * `checkIsPage`, once for `checkIsCloudFunction`, and `checkIsVisual` called the
 * latter a third time. This walks each graph exactly once, for all components,
 * and the result is memoised by the caller against the project's change counter.
 * It is strictly less work than what was there.
 */
export function buildKindIndex(project: ProjectModel | undefined): ComponentKindIndex {
  const index: ComponentKindIndex = new Map();
  if (!project) return index;

  const rootComponent = project.getRootComponent();
  const components = project.getComponents();

  /**
   * Components named as the `target` of a `Show Popup` node anywhere in the
   * project. A port of type `component` stores the component's *name* in
   * `parameters` (see `NodeGraphModel`'s rename handling, which rewrites exactly
   * these values when a component is renamed), so this is the same string the
   * runtime resolves the popup by.
   *
   * Under-detects rather than mis-detects: if `target` is driven by a connection
   * instead of a parameter there is no name to read, and the component falls
   * back to whatever it is intrinsically (usually `visual`). That is the right
   * failure direction — a popup shown as a visual component is a duller glyph, a
   * visual component shown as a popup would be a lie.
   */
  const popupTargets = new Set<string>();

  /** Root type names per component, collected in the same walk. */
  const rootTypes = new Map<string, Set<string>>();

  for (const component of components) {
    const types = new Set<string>();

    component.forEachNode((node) => {
      // `typename` is the raw string on the model; reading it avoids forcing
      // lazy type resolution for every node in the project just to classify it.
      const typename = node.typename;
      if (typename) types.add(typename);

      if (typename === SHOW_POPUP_TYPE) {
        const target = node.parameters && node.parameters.target;
        if (typeof target === 'string' && target) popupTargets.add(target);
      }
    });

    rootTypes.set(component.name, types);
  }

  for (const component of components) {
    const types = rootTypes.get(component.name) ?? new Set<string>();
    index.set(component.name, {
      kind: kindFor(component, types, rootComponent, popupTargets),
      category: categoryFor(component)
    });
  }

  return index;
}

function kindFor(
  component: ComponentModel,
  types: Set<string>,
  rootComponent: ComponentModel | undefined,
  popupTargets: Set<string>
): ComponentKind {
  // 1. Home. `getRootComponent()` is the project's own answer; nothing derived.
  if (rootComponent && rootComponent === component) return 'home';

  // 2. Cloud function. Intrinsic and unambiguous — the request/response pair
  //    only exists in a cloud component.
  for (const t of CLOUD_ROOT_TYPES) if (types.has(t)) return 'cloudfunction';

  // 3. Page. The `Page` node is a singleton and only a page component has one.
  if (types.has(PAGE_TYPE)) return 'page';

  // 4. Popup. Extrinsic (another component points at this one), so it ranks
  //    below everything intrinsic: a page that is also shown as a popup is a
  //    page first.
  if (popupTargets.has(component.name)) return 'popup';

  // 5. Visual. The model's own definition — "has a root that may act as a child
  //    of a visual tree" — rather than the old "isn't a cloud function".
  if (safeAllowAsChild(component)) return 'visual';

  // 6. Everything else. Logic components land here, and so does anything we
  //    could not classify. Deliberately the same glyph: the panel should not
  //    imply it knows the difference.
  return 'component';
}

/**
 * The categories `CanvasTheme` knows. A module is free to give a node type any
 * `color` string it likes; anything outside this set falls back to `default`,
 * which is exactly what `CanvasTheme.categoryColors()` does with it. Normalising
 * here rather than in the view keeps the two ends in agreement and keeps the
 * rendered class name predictable.
 */
const CANVAS_CATEGORIES = new Set(['component', 'visual', 'data', 'javascript']);

/**
 * `ComponentModel.color` walks `graph.roots` and touches `root.type`, which can
 * resolve to an `UnknownNodeType` for a missing module. Guarded so a project
 * with an unresolved node type renders a neutral tree instead of throwing.
 */
function categoryFor(component: ComponentModel): string {
  try {
    const color = component.color;
    return color && CANVAS_CATEGORIES.has(color) ? color : 'default';
  } catch {
    return 'default';
  }
}

function safeAllowAsChild(component: ComponentModel): boolean {
  try {
    return !!component.allowAsChild;
  } catch {
    return false;
  }
}
