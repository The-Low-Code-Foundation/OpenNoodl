/**
 * The seven backend surfaces, as registered side panels.
 *
 * ## What this replaces
 *
 * Schema, Data, Permissions, Triggers, Email, Sign-in providers and Search used
 * to be rendered by `LocalBackendCard` through `createPortal(…, document.body)`
 * into a `position: fixed; inset: 0` overlay with an 85%-black scrim — seven
 * copies of the same pattern in one file. That pattern had four costs, all of
 * them structural rather than cosmetic:
 *
 *   - the icon rail was unreachable while one was open,
 *   - there was no keyboard escape route *by construction* — the only way out
 *     was the surface's own close button,
 *   - the scrim was a hardcoded `rgba(0, 0, 0, .85)` that predates the light
 *     theme, and
 *   - none of them were addressable: they were component state on a card, so
 *     nothing outside that card could open, close or reason about them.
 *
 * PNL-009's full panel mode is the supported version of what those overlays were
 * hand-rolling, so they move onto it.
 *
 * ## Why registration, and not an ad-hoc child of full mode
 *
 * The spec offered both and said to prefer registration; this takes it. A
 * registered panel is addressable by id, gets the rail, gets `Escape`, gets a
 * header with a close button, and gets PNL-003's per-panel remembered width for
 * free. An ad-hoc child would have needed all four building again.
 *
 * They register as **transient**, which has two consequences that are both
 * wanted: `getVisibleItems()` filters them out, so they get no rail button of
 * their own (they are reached from the Backend Services card, exactly as
 * before), and `SidePanel` re-creates them on every activation, so a surface
 * always opens against the backend you just clicked rather than the one you
 * clicked last time.
 *
 * ## How the props get in
 *
 * `SidebarItem.panelProps` is read by the panel factory *at render time*, not at
 * registration time (`createPanel` closes over `item`, and reads
 * `item.panelProps` when React calls it). So writing `panelProps` immediately
 * before `switch()` is the supported way to hand a transient panel its
 * arguments, and is what `openBackendSurface` does. The alternative — a public
 * "switch with props" on `SidebarModel` — is a wider change to a model three
 * other tasks are also touching this phase.
 *
 * @module BackendServicesPanel/LocalBackendCard/backendSurfaces
 */

import React from 'react';

import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';

import { BACKEND_SERVICES_PANEL_ID } from '../backendServicesPanelId';

import { AuthPanel } from '../../auth';
import { DataBrowser } from '../../databrowser';
import { EmailPanel } from '../../email';
import { PermissionsPanel } from '../../permissions';
import { SchemaPanel } from '../../schemamanager';
import { SearchPanel } from '../../search';
import { TriggersPanel } from '../../triggers';

export type BackendSurfaceKind = 'schema' | 'data' | 'permissions' | 'triggers' | 'email' | 'auth' | 'search';

export interface BackendSurfaceProps extends Record<string, unknown> {
  backendId: string;
  backendName: string;
  /** Only `schema` reads this, but passing it everywhere keeps one call shape. */
  isRunning?: boolean;
  onClose: () => void;
}

interface BackendSurfaceDefinition {
  kind: BackendSurfaceKind;
  /** What the panel header says, and what the rail would say if it had one. */
  name: string;
  /**
   * `SidebarItem.panel` is a `ComponentType<Record<string, unknown>>` because the
   * model hands panels their props dynamically; the seven surfaces declare
   * precise prop interfaces, which an index-signature type cannot describe. The
   * cast is the same one `router.setup.ts` makes for `PropertyEditor` — the
   * shape is guaranteed by `BackendSurfaceProps` at every call site instead.
   */
  panel: React.ComponentType<Record<string, unknown>>;
}

/**
 * `search` is **not** a duplicate of the editor's own Search panel
 * (`views/panels/search-panel`, rail id `search`, which searches the node
 * graph). This one is BAK-008's backend full-text search over a local SQLite
 * backend's records. The phase's finding register (F18) says the file is a dead
 * duplicate; it is not, and deleting it would take BAK-008's UI with it.
 */
const asPanel = (c: unknown) => c as React.ComponentType<Record<string, unknown>>;

const SURFACES: BackendSurfaceDefinition[] = [
  { kind: 'schema', name: 'Schema', panel: asPanel(SchemaPanel) },
  { kind: 'data', name: 'Data', panel: asPanel(DataBrowser) },
  { kind: 'permissions', name: 'Access', panel: asPanel(PermissionsPanel) },
  { kind: 'triggers', name: 'Triggers', panel: asPanel(TriggersPanel) },
  { kind: 'email', name: 'Email', panel: asPanel(EmailPanel) },
  { kind: 'auth', name: 'Sign-in providers', panel: asPanel(AuthPanel) },
  { kind: 'search', name: 'Search', panel: asPanel(SearchPanel) }
];

export const backendSurfacePanelId = (kind: BackendSurfaceKind) => `backend-${kind}`;

/** Every surface's panel id, for anything that needs to recognise one. */
export const BACKEND_SURFACE_PANEL_IDS: readonly string[] = SURFACES.map((s) => backendSurfacePanelId(s.kind));

/**
 * The width a surface opens at when it is *docked* rather than full.
 *
 * These layouts were designed inside a 900px-wide modal, and full mode is where
 * they belong — but `Escape` docks, and a data grid in a 280px column is not a
 * thing anyone wants to meet by accident. PNL-003 clamps this against the window
 * (it always leaves 320px of canvas), and remembers whatever the user drags it
 * to afterwards.
 */
const SURFACE_DEFAULT_WIDTH = 860;

/**
 * Where these sort in `getItems()`.
 *
 * They are transient, so they never reach the rail and the number is invisible —
 * but `getItems()` sorts with `(a, b) => a.order - b.order`, and for an item with
 * no `order` that expression is `NaN`. A comparator that returns `NaN` is not a
 * valid ordering, and `Array.prototype.sort` is free to move *unrelated* elements
 * when it meets one. Two registrations already have no order; adding seven more
 * would make a silently reshuffled rail much more likely. So: ordered, just after
 * `backend-services` (8), which is also where they belong conceptually.
 */
const SURFACE_ORDER_BASE = 8.01;

/**
 * The event the workflow canvas raises to reach the Triggers surface (WFA-005).
 *
 * The canvas draws a workflow's triggers as entry nodes and can enable, disable
 * and delete one — but ADDING a trigger needs a form (type, cron or slug,
 * scheme, target), and that form already exists here. Rather than build a second
 * one on a Canvas2D surface that has no controls, the canvas asks for this
 * panel, pre-pointed at the right backend. The event keeps the model layer from
 * importing a panel: `WorkflowDocument` knows which backend, not which React
 * tree.
 */
export const OPEN_TRIGGERS_SURFACE = 'backend:openTriggersSurface';

export interface OpenTriggersSurfaceDetail {
  backendId: string;
  backendName: string;
  /**
   * WFA-008: open with this trigger's edit form already showing.
   *
   * The canvas node's *Edit this trigger…* is a door to the one form rather than
   * a second form (assessment §1), and this is what makes it land on the right
   * row instead of on a panel the user then has to search.
   */
  editTriggerId?: string;
}

/** Called once from `installSidePanel`, beside the rail-visible registrations. */
export function installBackendSurfacePanels() {
  EventDispatcher.instance.on(
    OPEN_TRIGGERS_SURFACE,
    ({ backendId, backendName, editTriggerId }: OpenTriggersSurfaceDetail) => {
      openBackendSurface('triggers', {
        backendId,
        backendName,
        editTriggerId,
        onClose: () => SidebarModel.instance.switch(BACKEND_SERVICES_PANEL_ID)
      });
    },
    // No group to unsubscribe with: these registrations last as long as the
    // editor does, exactly like the panel registrations below them.
    null
  );

  SURFACES.forEach((surface, index) => {
    SidebarModel.instance.register({
      transient: true,
      id: backendSurfacePanelId(surface.kind),
      name: surface.name,
      order: SURFACE_ORDER_BASE + index / 1000,
      defaultWidth: SURFACE_DEFAULT_WIDTH,
      panel: surface.panel
    });
  });
}

/**
 * Point a registered surface at a backend and make it the active panel.
 *
 * Does **not** change the panel mode — the caller owns that, because the layout
 * lives in React context and this is callable from anywhere.
 *
 * @returns false if the surface is not registered (a project opened before the
 *          registrations ran, or a hot reload mid-flight) so the caller can
 *          decide rather than silently doing nothing.
 */
export function openBackendSurface(kind: BackendSurfaceKind, props: BackendSurfaceProps): boolean {
  const id = backendSurfacePanelId(kind);
  const item = SidebarModel.instance.getPanel(id);
  if (!item) {
    console.error(`[backend surfaces] '${id}' is not registered — cannot open it.`);
    return false;
  }

  item.panelProps = props;

  // `switch()` short-circuits when the panel is already active, which would
  // leave the surface showing the *previous* backend's data with the new props
  // sitting unread. Re-announce instead so `SidePanel` rebuilds the transient
  // panel. Not reachable from today's UI (the card is hidden while a surface is
  // open) but it is the kind of thing that becomes reachable later and fails
  // silently when it does.
  if (SidebarModel.instance.ActiveId === id) {
    SidebarModel.instance.notifyListeners(SidebarModelEvent.activeChanged, id, id);
    return true;
  }

  return SidebarModel.instance.switch(id);
}

/**
 * The panel a surface returns to when its own close button is used.
 *
 * Defined in a leaf module (AAQ-011/F11) so that a surface can link *back* to
 * Backend Services without importing this file — which imports all seven
 * surfaces, itself included. Re-exported here so existing importers do not move.
 */
export { BACKEND_SERVICES_PANEL_ID };
