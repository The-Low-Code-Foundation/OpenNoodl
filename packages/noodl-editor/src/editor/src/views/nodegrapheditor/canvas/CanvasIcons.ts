/* eslint-disable @typescript-eslint/no-var-requires -- webpack require() keeps the svg assets in the bundle */
/**
 * The icon images painted directly onto the canvas by NodeGraphEditorNode
 * (PLAT-001 extraction). Loaded once per editor instance; `onLoaded` fires per
 * image so the owner can repaint as they arrive.
 */
export class CanvasIcons {
  home: HTMLImageElement;
  component: HTMLImageElement;
  aiAssistantInner: HTMLImageElement;
  aiAssistantOuter: HTMLImageElement;
  warning: HTMLImageElement;

  constructor(onLoaded: () => void) {
    this.home = CanvasIcons.load(
      require('../../../../../assets/icons/core-ui-temp/home--nodegraph.svg').default,
      'home icon',
      onLoaded
    );
    this.component = CanvasIcons.load(
      require('../../../../../assets/icons/core-ui-temp/component--nodegraph.svg').default,
      'component icon',
      onLoaded
    );
    this.aiAssistantInner = CanvasIcons.load(
      require('../../../../../assets/icons/core-ui-temp/aiAssistant--nodegraph-inner.svg').default,
      'AI assistant inner icon',
      onLoaded
    );
    this.aiAssistantOuter = CanvasIcons.load(
      require('../../../../../assets/icons/core-ui-temp/aiAssistant--nodegraph-outer.svg').default,
      'AI assistant outer icon',
      onLoaded
    );
    this.warning = CanvasIcons.load(
      require('../../../../../assets/icons/core-ui-temp/warning_triangle.svg').default,
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
