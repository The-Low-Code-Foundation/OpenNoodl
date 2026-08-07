import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

interface ScreenResolutionInstance extends NodeInstance {
  _internal: {
    width: number;
    height: number;
  };
  _viewportSizeChanged(): void;
}

const ScreenResolution: NodeDefinitionOptions = {
  name: 'Screen Resolution',
  docs: 'https://docs.noodl.net/nodes/utilities/screen-resolution',
  category: 'Utilities',
  ssr: {
    compat: 'client-only',
    note: 'The viewport size is unknowable server-side; width/height stay unset until the browser runs.'
  },
  initialize(this: ScreenResolutionInstance) {
    // Add SSR Support
    if (typeof window === 'undefined') return;

    /**
     * NDA-012 (Utilities), check H1. The listener was an anonymous arrow with no matching
     * `removeEventListener` anywhere, so every Screen Resolution node ever created stayed
     * subscribed to `window` for the life of the page: a node inside a Repeater template, or
     * on a page the author navigated away from, kept its whole node instance reachable and
     * kept calling `flagAllOutputsDirty()` on a graph that no longer exists.
     */
    const onResize = () => {
      this._viewportSizeChanged();
    };
    window.addEventListener('resize', onResize);
    this.addDeleteListener(() => {
      window.removeEventListener('resize', onResize);
    });

    this._viewportSizeChanged();
  },
  getInspectInfo(this: ScreenResolutionInstance) {
    return this._internal.width + ' x ' + this._internal.height;
  },
  outputs: {
    width: {
      type: 'number',
      displayName: 'Width',
      description: 'Width of the browser viewport, in pixels',
      get(this: ScreenResolutionInstance) {
        return this._internal.width;
      }
    },
    height: {
      type: 'number',
      displayName: 'Height',
      description: 'Height of the browser viewport, in pixels',
      get(this: ScreenResolutionInstance) {
        return this._internal.height;
      }
    },
    aspectRatio: {
      type: 'number',
      displayName: 'Aspect Ratio',
      description: 'Width divided by Height, so anything wider than it is tall is greater than one',
      get(this: ScreenResolutionInstance) {
        return this._internal.width / this._internal.height;
      }
    }
  },
  methods: {
    _viewportSizeChanged(this: ScreenResolutionInstance) {
      this._internal.width = window.innerWidth;
      this._internal.height = window.innerHeight;
      this.flagAllOutputsDirty();
    }
  }
};

export default {
  node: ScreenResolution
};
