import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

/**
 * This node's own instance shape.
 *
 * `NodeInstance` is deliberately closed — it describes what the *runtime*
 * guarantees, and widening it would cost every node its typo detection. A node
 * that hangs its own members off the prototype via `methods` declares them here
 * instead, and binds its callbacks to that.
 */
interface CssDefinitionInstance extends NodeInstance {
  getStyleRefId(): string;
  removeStyleDeclaration(): void;
  updateStyle(style: string | null): void;
}

const _refCount = new Map<string, number>(); //node id to ref count

const CSSDefinition: NodeDefinitionOptions = {
  name: 'CSS Definition',
  docs: 'https://docs.noodl.net/nodes/utilities/css-definition',
  category: 'CustomCode',
  color: 'javascript',
  nodeDoubleClickAction: {
    focusPort: 'Style'
  },
  initialize: function (this: CssDefinitionInstance) {
    const internal = this._internal;
    internal.style = '';

    const styleId = this.getStyleRefId();

    this.addDeleteListener(() => {
      _refCount.set(styleId, _refCount.get(styleId) - 1);
      if (_refCount.get(styleId) === 0) {
        this.removeStyleDeclaration();
        _refCount.delete(styleId);
      }
    });

    if (!_refCount.has(styleId)) {
      _refCount.set(styleId, 0);
    }

    _refCount.set(styleId, _refCount.get(styleId) + 1);
  },
  inputs: {
    style: {
      index: 4005,
      type: { name: 'string', allowEditOnly: true, codeeditor: 'css' },
      displayName: 'Style',
      group: 'Content',
      default: '',

      set: function (this: CssDefinitionInstance, value: string) {
        this.updateStyle(value);
      }
    }
  },
  outputs: {},
  methods: {
    getStyleRefId: function (this: CssDefinitionInstance) {
      return 'style_' + this.id;
    },
    removeStyleDeclaration: function (this: CssDefinitionInstance) {
      // Add SSR Support
      if (typeof document === 'undefined') return;

      const styleRefId = this.getStyleRefId();
      const styleObj = document.getElementById(styleRefId);
      if (styleObj !== null) {
        styleObj.parentNode.removeChild(styleObj);
      }
    },
    updateStyle: function (this: CssDefinitionInstance, style: string | null) {
      // Add SSR Support
      if (typeof document === 'undefined') return;

      const internal = this._internal;
      const styleRefId = this.getStyleRefId();
      internal.style = style;

      if (style !== null) {
        let styleObj = document.getElementById(styleRefId) as HTMLStyleElement | null;
        if (styleObj === null) {
          styleObj = document.createElement('style');
          styleObj.id = styleRefId;
          styleObj.type = 'text/css';
          document.head.appendChild(styleObj);
        }

        styleObj.innerHTML = '\n' + style + '\n';
      } else {
        this.removeStyleDeclaration();
      }
    }
  }
};

// `export default`, not `module.exports`: this file is now part of the viewer's
// ESM program. `register-nodes.js` default-imports it, which webpack resolves to
// the same object either way.
export default {
  node: CSSDefinition
};
