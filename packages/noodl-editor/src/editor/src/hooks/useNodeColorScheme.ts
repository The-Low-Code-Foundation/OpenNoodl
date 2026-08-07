/**
 * Theme-aware node colour schemes for the DOM surfaces (UIX-012).
 *
 * The node picker, the connection popup and the node-references panel render
 * node chrome as inline styles. They used to read the dark-only
 * `colors.nodes.*` blob from `nodelibraryexport.js`, which the light theme
 * could not reach — dark-navy islands on a light panel.
 *
 * These hooks resolve the scheme from `CanvasTheme` (the UIX-005 CSS-token
 * resolver the canvas paints from) and re-render on every theme change.
 */
import { useMemo } from 'react';

import { INodeColorScheme } from '@noodl-types/nodeTypes';

import { CanvasTheme } from '../views/nodegrapheditor/canvas/CanvasTheme';
import { useCanvasThemeGeneration } from './useThemeTokens';

export { useCanvasThemeGeneration };

/**
 * The colour scheme for a node category name (`component`/`visual`/`data`/
 * `javascript`; anything unknown or undefined falls back to `default`), kept in
 * sync with the active theme.
 */
export function useNodeColorScheme(colorName: string | undefined): INodeColorScheme {
  const generation = useCanvasThemeGeneration();

  return useMemo(() => CanvasTheme.instance.nodeColorScheme(colorName), [colorName, generation]);
}

/**
 * Category-name resolution for a `NodeGraphNode`, matching the canvas painter
 * (`NodeGraphEditorNodePainter`): an AiAssistant `colorOverride` wins over the
 * node type's own `color`.
 */
export function nodeColorNameForModel(model: TSFixme): string | undefined {
  return model?.metadata?.colorOverride || model?.type?.color;
}
