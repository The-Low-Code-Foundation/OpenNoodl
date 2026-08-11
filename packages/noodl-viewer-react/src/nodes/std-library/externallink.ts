import { outcomeOutputs } from '@noodl/runtime/src/outcome';
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
      group: 'Values',
      type: 'string',
      displayName: 'Link',
      description: 'Web address to open; one with no scheme is resolved relative to the page the app is served from'
    },
    openInNewTab: {
      group: 'Values',
      type: 'boolean',
      displayName: 'Open In New Tab',
      default: true,
      description: 'Opens the link in a new tab; when off the current page is replaced and the app unloads'
    },
    do: {
      group: 'Actions',
      type: 'signal',
      displayName: 'Do',
      description: 'Opens Link, or fires Failure if there is no Link or the browser blocked the new tab',
      valueChangedToTrue(this: ExternalLinkInstance) {
        // ERG-001 §4. Only the port mints; this node has no value-driven route into the open.
        const token = this.beginOutcome();

        // Opening a browser tab is meaningless server-side, so it degrades to a no-op if the
        // graph fires this during an SSR render — and ERG-001 §4 gave that no-op a name. It was
        // a bare `return`: told to open a link, did nothing, said nothing, which is the dead
        // chain this contract exists to close. `Unchanged` rather than `Failure`, and nothing
        // raised, for the reason the line below already gave in prose: an SSR pass firing
        // `Failure` would train authors to ignore the port.
        if (typeof window === 'undefined') {
          this.reportOutcome(token, 'unchanged');
          return;
        }

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
          this.flagOutputDirty('error');
          this.reportOutcome(token, 'failure', { code: 'external-link/no-link', message: 'No link to open' });
          return;
        }

        const opened = window.open(link, target, params);

        // Same-tab navigation (`_self`) legitimately returns null in some browsers, so only
        // treat a null as blocked when a new tab was actually asked for.
        if (target === '_blank' && !opened) {
          this._internal.lastError = 'The browser blocked opening a new tab';
          this.flagOutputDirty('error');
          this.reportOutcome(token, 'failure', {
            code: 'external-link/blocked',
            message:
              'The browser blocked opening a new tab — this usually means the link was not opened directly from a user action',
            detail: { link }
          });
          return;
        }

        this.reportOutcome(token, 'done');
      }
    }
  },
  // ERG-001 §4. `Success` became `Done` — the grep is clean, this handler is the only caller.
  //
  // ⚠️ `Done` is present on the *navigating* path rather than absent, which the navigation slice
  // settled for the whole family: with Open In New Tab off the document is replaced, but with it
  // on (the default) this graph demonstrably survives, and a `Completed` silent on the commonest
  // path defeats Rule 2's whole value. The terminality is documented rather than expressed as a
  // missing port.
  outputs: {
    ...outcomeOutputs({
      done: 'Fires once the link has been handed to the browser. With Open In New Tab off the page is replaced, so nothing downstream of this may still exist',
      unchanged: 'Fires when there is no browser to open a link in — a server-side render, where there is nothing to do and nothing to fail at',
      failure: 'Fires when no Link was set, or the browser blocked the new tab'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
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
