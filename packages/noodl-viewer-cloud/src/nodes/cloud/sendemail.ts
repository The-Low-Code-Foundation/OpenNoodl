/**
 * Send Email node (BAK-002) — the WF-002 "cloud" node family's mail sender.
 * Server-side only (this package only ever runs inside a cloud function /
 * workflow), which is why it lives beside `noodl.cloud.request/response`
 * rather than in the browser viewer.
 *
 * It reaches the running nodegx-backend's Mailer through a process-global
 * function, `_noodl_send_email` — the exact idiom `_noodl_cloudservices`
 * already establishes for database access from inside functions (see
 * `nodegx-backend/src/service.ts`, which sets both). Two distinct "not
 * available" cases, both loud, never silent:
 *
 *   - `_noodl_send_email` is undefined: this graph isn't running inside
 *     nodegx-backend at all (e.g. a stray copy of the component elsewhere).
 *   - It's defined but SMTP isn't configured: the call resolves
 *     `{success:false, error}` — the backend's own loud-failure message,
 *     surfaced verbatim on `failed`/`error`.
 *
 * Either way this node NEVER silently drops a send or fakes success.
 */

export const node = {
  name: 'noodl.cloud.sendemail',
  displayNodeName: 'Send Email',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/send-email',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Content', 'Actions']
  },
  initialize: function () {
    this._internal.template = 'none';
  },
  inputs: {
    to: {
      group: 'General',
      displayName: 'To',
      type: 'string',
      set: function (value) {
        this._internal.to = value;
      }
    },
    template: {
      group: 'Content',
      displayName: 'Template',
      type: {
        name: 'enum',
        enums: [
          { label: 'None (use Subject/Text/HTML below)', value: 'none' },
          { label: 'Password Reset', value: 'passwordReset' },
          { label: 'Verify Email', value: 'verifyEmail' }
        ]
      },
      default: 'none',
      set: function (value) {
        this._internal.template = value;
      }
    },
    variables: {
      group: 'Content',
      displayName: 'Template Variables',
      type: { name: 'object', allowConnectionsOnly: true },
      description: 'Only used when Template is set. A plain object of {{variable}} values (e.g. from a Set Variables node).',
      set: function (value) {
        this._internal.variables = value;
      }
    },
    subject: {
      group: 'Content',
      displayName: 'Subject',
      type: 'string',
      description: 'Ignored when Template is set.',
      set: function (value) {
        this._internal.subject = value;
      }
    },
    text: {
      group: 'Content',
      displayName: 'Text Body',
      type: 'string',
      description: 'Ignored when Template is set.',
      set: function (value) {
        this._internal.text = value;
      }
    },
    html: {
      group: 'Content',
      displayName: 'HTML Body',
      type: 'string',
      description: 'Optional. Ignored when Template is set.',
      set: function (value) {
        this._internal.html = value;
      }
    },
    send: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      valueChangedToTrue: function () {
        this.scheduleSend();
      }
    }
  },
  outputs: {
    sent: {
      displayName: 'Sent',
      type: 'signal',
      group: 'Events'
    },
    failed: {
      displayName: 'Failed',
      type: 'signal',
      group: 'Events'
    },
    error: {
      displayName: 'Error',
      type: 'string',
      group: 'Error',
      getter: function () {
        return this._internal.error;
      }
    }
  },
  methods: {
    setError: function (err) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failed');
    },
    scheduleSend: function () {
      if (this._internal.sendScheduled) return;
      this._internal.sendScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.sendScheduled = false;
        this.doSend();
      });
    },
    doSend: function () {
      if (!this._internal.to) {
        this.setError('Send Email: "To" is required.');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendEmail = (globalThis as any)._noodl_send_email;
      if (typeof sendEmail === 'undefined') {
        this.setError(
          'Send Email: no email service is available. This node only works inside a nodegx-backend cloud ' +
            'function/workflow (BAK-002) — it is not usable in the browser viewer.'
        );
        return;
      }

      const useTemplate = this._internal.template && this._internal.template !== 'none';
      const request = {
        to: this._internal.to,
        subject: this._internal.subject,
        text: this._internal.text,
        html: this._internal.html,
        template: useTemplate ? this._internal.template : undefined,
        variables: this._internal.variables
      };

      Promise.resolve(sendEmail(request))
        .then((result) => {
          if (result && result.success) {
            this.sendSignalOnOutput('sent');
          } else {
            this.setError((result && result.error) || 'Send Email: failed to send.');
          }
        })
        .catch((e) => {
          this.setError(e instanceof Error ? e.message : String(e));
        });
    }
  }
};

export function setup() {
  // No editor-only dynamic-port behavior (unlike Request/Response) — every
  // port here is static.
}
