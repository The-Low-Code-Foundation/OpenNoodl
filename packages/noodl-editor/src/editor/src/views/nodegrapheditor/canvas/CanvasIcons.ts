/* eslint-disable @typescript-eslint/no-var-requires -- webpack require() keeps the svg assets in the bundle */
/**
 * The icon images painted directly onto the canvas by NodeGraphEditorNode
 * (PLAT-001 extraction). Loaded once per editor instance; `onLoaded` fires per
 * image so the owner can repaint as they arrive.
 *
 * UIX-011: these five are the only survivors of `assets/icons/`, which held a
 * 255-file duplicate of core-ui's set. They live in `assets/icons/canvas/`
 * (was `core-ui-temp/`, a staging name that outlived its migration) and they
 * deliberately keep their baked fills: an `<Image>` drawn onto a 2D canvas is
 * rasterised outside the DOM, so `currentColor` has nothing to resolve
 * against. ICONOGRAPHY.md already carves canvas glyphs out of the Icon
 * component for this reason.
 *
 * Consequence, and it is a real one: unlike the rest of the editor's chrome
 * these do NOT follow the light theme. Fixing it means the painter selecting
 * art per theme and repainting on the existing `nodegx:themechanged` hook —
 * canvas-paint work, so it belongs to UIX-005 rather than here. Recorded in
 * UIX-011-NOTES.md so it is not lost.
 */
export class CanvasIcons {
  home: HTMLImageElement;
  component: HTMLImageElement;
  aiAssistantInner: HTMLImageElement;
  aiAssistantOuter: HTMLImageElement;
  warning: HTMLImageElement;

  constructor(onLoaded: () => void) {
    this.home = CanvasIcons.load(
      require('../../../../../assets/icons/canvas/home--nodegraph.svg').default,
      'home icon',
      onLoaded
    );
    this.component = CanvasIcons.load(
      require('../../../../../assets/icons/canvas/component--nodegraph.svg').default,
      'component icon',
      onLoaded
    );
    this.aiAssistantInner = CanvasIcons.load(
      require('../../../../../assets/icons/canvas/aiAssistant--nodegraph-inner.svg').default,
      'AI assistant inner icon',
      onLoaded
    );
    this.aiAssistantOuter = CanvasIcons.load(
      require('../../../../../assets/icons/canvas/aiAssistant--nodegraph-outer.svg').default,
      'AI assistant outer icon',
      onLoaded
    );
    this.warning = CanvasIcons.load(
      require('../../../../../assets/icons/canvas/warning_triangle.svg').default,
      'warning icon',
      onLoaded
    );
  }

  private static load(src: string, label: string, onLoaded: () => void): HTMLImageElement {
    const image = new Image();
    image.src = src;
    image.onload = () => onLoaded();
    image.onerror = (e) => console.error(`Failed to load ${label}:`, e);
    return image;
  }
}
