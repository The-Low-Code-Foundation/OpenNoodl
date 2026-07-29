import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

interface ExternalLinkInstance extends NodeInstance {
  _internal: { lastError?: string };
}

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
      valueChangedToTrue(this: ExternalLinkInstance) {
        // Opening a browser tab is meaningless server-side; degrade to a no-op
        // if the graph fires this during an SSR render.
        if (typeof window === 'undefined') return;

        const openInNewTab = this.getInputValue('openInNewTab');
        const params = openInNewTab ? 'noopener,noreferrer' : '';
        const target = openInNewTab === true || openInNewTab === undefined ? '_blank' : '_self';
        const link = this.getInputValue('link') as string;

        // NDA-004 §2/§3. This node had no outputs at all, which mattered more here than the
        // bare count suggests: the common failure is a *browser popup blocker* silently
        // refusing the new tab. `window.open` returns null and the author sees a button that
        // does nothing, with nothing anywhere to say why.
        if (link === undefined || link === null || link === '') {
          this._internal.lastError = 'No link to open';
          this.raiseRuntimeError('external-link/no-link', 'No link to open');
          this.flagOutputDirty('error');
          this.sendSignalOnOutput('failure');
          return;
        }

        const opened = window.open(link, target, params);

        // Same-tab navigation (`_self`) legitimately returns null in some browsers, so only
        // treat a null as blocked when a new tab was actually asked for.
        if (target === '_blank' && !opened) {
          this._internal.lastError = 'The browser blocked opening a new tab';
          this.raiseRuntimeError(
            'external-link/blocked',
            'The browser blocked opening a new tab — this usually means the link was not opened directly from a user action',
            { link }
          );
          this.flagOutputDirty('error');
          this.sendSignalOnOutput('failure');
          return;
        }

        this.sendSignalOnOutput('success');
      }
    }
  },
  outputs: {
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter(this: ExternalLinkInstance) {
        return this._internal.lastError;
      }
    }
  }
};

export default {
  node: ExternalLinkNode
};
