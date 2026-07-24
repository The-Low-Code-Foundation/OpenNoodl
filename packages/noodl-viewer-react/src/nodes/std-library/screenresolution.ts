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
  initialize(this: ScreenResolutionInstance) {
    // Add SSR Support
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', () => {
      this._viewportSizeChanged();
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
      get(this: ScreenResolutionInstance) {
        return this._internal.width;
      }
    },
    height: {
      type: 'number',
      displayName: 'Height',
      get(this: ScreenResolutionInstance) {
        return this._internal.height;
      }
    },
    aspectRatio: {
      type: 'number',
      displayName: 'Aspect Ratio',
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
