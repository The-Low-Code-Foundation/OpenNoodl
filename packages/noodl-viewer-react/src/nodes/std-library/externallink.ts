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
      description:
        'Opens Link, or fires Failure if there is no Link or the link was opened outside a user action',
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

        // DEF-016. The blocked-tab test is read *before* the call, not from its return value.
        //
        // `params` sets `noopener` for a new tab, and `window.open` returns null whenever
        // `noopener` is set — by specification, on success as much as on failure. So the return
        // value below cannot distinguish the two cases, and the `!opened` test this replaces
        // reported `Failure` on every new tab the node successfully opened.
        //
        // `navigator.userActivation.isActive` is the condition the browser itself applies when
        // deciding whether to allow the open, and it is readable here, where `noopener` has not
        // destroyed anything. Measured against the exported app in Chrome 151: false exactly
        // when the open is refused, true exactly when a tab appears.
        //
        // ⚠️ Read off `window` rather than the bare global so an SSR-shaped or older host is the
        // same object the branch above already proved exists. Absent (Safari before 16.4,
        // Firefox before 120) ⇒ no claim is made and the node reports `done`: the failure
        // direction is the one that trains authors to ignore the port.
        //
        // ⚠️ A strict improvement, not a total one. It catches the dominant cause — a graph
        // firing the link outside a user gesture — and stays silent where a user has hard-blocked
        // popups despite one. That is the trade the SSR branch above already makes; always-wrong
        // is not a trade at all.
        //
        // 🔴 The open is still attempted unconditionally. `isActive` is the diagnostic, never a
        // precondition: a user who has allow-listed popups for the site gets the tab without a
        // gesture, and gating the call on activation would take a working link away to improve a
        // message. This branch decides what is *reported*, not what happens.
        // Three separate absences degrade the same way — no `navigator`, no `userActivation`,
        // or an `isActive` that is not a boolean. `blocked` is only ever true off a value that
        // was actually read, which is why the test is `typeof … === 'boolean'` and not a
        // truthiness check on the object.
        const activation = window.navigator?.userActivation as { isActive?: boolean } | undefined;
        const blocked = target === '_blank' && typeof activation?.isActive === 'boolean' && !activation.isActive;

        window.open(link, target, params);

        if (blocked) {
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
      done:
        'Fires once the link has been handed to the browser. It does not promise a tab appeared — nothing readable in the page does, once Open In New Tab is on. With it off the page is replaced, so nothing downstream of this may still exist',
      unchanged: 'Fires when there is no browser to open a link in — a server-side render, where there is nothing to do and nothing to fail at',
      failure:
        'Fires when no Link was set, or when the link was opened outside a user action — the case a browser refuses a new tab for. A tab blocked for any other reason still reports Done'
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
