/**
 * A visual container for corpus graphs, reduced to the members the component walk reads.
 *
 * Not the real `Group`: that node is a React component, and standing one up needs a DOM, a
 * `ResizeObserver` and three hand-written ES-module scroll plugins that ts-jest does not
 * transform. What the upward walk in `runtime/src/componentwalk.ts` actually touches is
 * `addChild` (to build the tree) and `getVisualParentNode` (to climb out of a component), so
 * both are copied verbatim from `react-component-node.ts:1074` and `:1401`. A reconstruction
 * that diverged there would be testing the reconstruction.
 *
 * Registered under the real name `Group`, because `NodeContext.showPopup` builds its popup
 * wrapper with `createPrimitiveNode('Group')` and will not settle for a corpus-specific name.
 */

import type { NodeInstance, NodeModule } from '@noodl/types';

export interface CorpusGroupInstance extends NodeInstance {
  parent?: NodeInstance;
  children: NodeInstance[];
}

export const GroupModule: NodeModule = {
  node: {
    name: 'Group',
    displayNodeName: 'Group',
    category: 'Visual',
    allowChildren: true,
    allowChildrenWithCategory: ['Corpus', 'Component Utilities', 'Navigation', 'Visual'],
    initialize(this: CorpusGroupInstance) {
      this.children = [];
    },
    // The three `showPopup` sets on its wrapper. Declared so `setInputValue` has somewhere to
    // put them; nothing here reads them back.
    inputs: {
      flexDirection: { type: 'string', set() {} },
      cssClassName: { type: 'string', set() {} },
      position: { type: 'string', set() {} }
    },
    methods: {
      addChild(this: CorpusGroupInstance, child: NodeInstance, index?: number) {
        (child as CorpusGroupInstance).parent = this;
        this.children.splice(index === undefined ? this.children.length : index, 0, child);
      },
      removeChild(this: CorpusGroupInstance, child: NodeInstance) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
          this.children.splice(index, 1);
          (child as CorpusGroupInstance).parent = undefined;
        }
      },
      getVisualParentNode(this: CorpusGroupInstance) {
        if (this.parent) return this.parent;

        // We are a root: hop out of this component to whatever it was mounted inside.
        let component = this.nodeScope.componentOwner;
        while (!component.parent && component.parentNodeScope) {
          component = component.parentNodeScope.componentOwner;
        }

        return component ? component.parent : undefined;
      }
    }
  }
};
