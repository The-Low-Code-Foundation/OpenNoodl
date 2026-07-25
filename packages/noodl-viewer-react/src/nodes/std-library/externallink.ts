import type { NodeDefinitionOptions } from '@noodl/types';

const ExternalLinkNode: NodeDefinitionOptions = {
  name: 'net.noodl.externallink',
  displayNodeName: 'External Link',
  docs: 'https://docs.noodl.net/nodes/navigation/external-link',
  category: 'Navigation',
  nodeDoubleClickAction: {
    focusPort: 'link'
  },
  inputs: {
    link: {
      type: 'string',
      displayName: 'Link'
    },
    openInNewTab: {
      type: 'boolean',
      displayName: 'Open In New Tab',
      default: true
    },
    do: {
      type: 'signal',
      displayName: 'Do',
      valueChangedToTrue() {
        // Opening a browser tab is meaningless server-side; degrade to a no-op
        // if the graph fires this during an SSR render.
        if (typeof window === 'undefined') return;

        const openInNewTab = this.getInputValue('openInNewTab');
        const params = openInNewTab ? 'noopener,noreferrer' : '';
        const target = openInNewTab === true || openInNewTab === undefined ? '_blank' : '_self';

        window.open(this.getInputValue('link') as string, target, params);
      }
    }
  }
};

export default {
  node: ExternalLinkNode
};
