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
      displayName: 'Link',
      description: 'Web address to open; one with no scheme is resolved relative to the page the app is served from'
    },
    openInNewTab: {
      type: 'boolean',
      displayName: 'Open In New Tab',
      default: true,
      description: 'Opens the link in a new tab; when off the current page is replaced and the app unloads'
    },
    do: {
      type: 'signal',
      displayName: 'Do',
      description: 'Opens Link, or fires Failure if there is no Link or the browser blocked the new tab',
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
      group: 'Events',
      description: 'Fires once the link has been handed to the browser'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events',
      description: 'Fires when no Link was set, or the browser blocked the new tab'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the link could not be opened, set just before Failure fires',
      getter(this: ExternalLinkInstance) {
        return this._internal.lastError;
      }
    }
  }
};

export default {
  node: ExternalLinkNode
};
