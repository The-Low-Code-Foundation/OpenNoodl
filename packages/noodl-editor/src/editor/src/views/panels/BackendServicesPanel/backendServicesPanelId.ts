/**
 * The Backend Services panel's registered id, on its own.
 *
 * It used to live at the bottom of `LocalBackendCard/backendSurfaces.tsx`, which
 * imports all seven surface panels — so anything that merely wants to *link* to
 * Backend Services had to import the whole surface registry, and a surface that
 * wanted to link back (AAQ-011/F11 gave the Data Browser a "Choose a backend"
 * action) would have closed an import cycle through itself.
 *
 * A leaf module with no imports of its own is the fix. `backendSurfaces` re-
 * exports it, so every existing importer is unaffected.
 *
 * @module BackendServicesPanel/backendServicesPanelId
 */

/** The panel a backend surface returns to when its own close button is used. */
export const BACKEND_SERVICES_PANEL_ID = 'backend-services';
