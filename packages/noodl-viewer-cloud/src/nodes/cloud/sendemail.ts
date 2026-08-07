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

import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

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
      description: 'Address the message goes to; the send fails outright when this is blank',
      set: function (value) {
        this._internal.to = value;
      }
    },
    template: {
      group: 'Content',
      displayName: 'Template',
      description: 'Which stored template to render, or None to use Subject, Text Body and HTML Body instead',
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
      description: 'Values substituted into the template placeholders, and ignored when Template is None',
      set: function (value) {
        this._internal.variables = value;
      }
    },
    subject: {
      group: 'Content',
      displayName: 'Subject',
      type: 'string',
      description: 'Subject line of the message, and ignored when Template is set',
      set: function (value) {
        this._internal.subject = value;
      }
    },
    text: {
      group: 'Content',
      displayName: 'Text Body',
      type: 'string',
      description: 'Plain-text body of the message, and ignored when Template is set',
      set: function (value) {
        this._internal.text = value;
      }
    },
    html: {
      group: 'Content',
      displayName: 'HTML Body',
      type: 'string',
      description: 'HTML body sent alongside Text Body; optional, and ignored when Template is set',
      set: function (value) {
        this._internal.html = value;
      }
    },
    send: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Sends the message',
      valueChangedToTrue: function () {
        // ERG-001 §4. Only the port mints; `scheduleSend` has no other caller and no value
        // setter on this node runs the send.
        this.scheduleSend(this.beginOutcome());
      }
    }
  },
  outputs: {
    // ERG-001 §4. `Sent` became `Done` and `Failed` became `Failure` — §0.2 Result 2's "eight
    // ports displaying Done under four wire names" loses another one. No `Unchanged`: the
    // message is either handed to the mailer or refused, and there is no branch where the
    // post-condition already held. §5 must not expect one.
    ...outcomeOutputs({
      done: 'Fires once the mail server has accepted the message for delivery',
      failure: 'Fires when the message could not be sent, including when no mail service is configured'
    }),
    error: {
      displayName: 'Error',
      type: 'string',
      group: 'Error',
      description: 'Why the message could not be sent',
      getter: function () {
        return this._internal.error;
      }
    }
  },
  methods: {
    /**
     * Publish on `Error` and report the failure for every invocation in this batch.
     *
     * ERG-001 §4: `tokens` is the batch drained in `doSend`, not a field read back — an outcome
     * must not be inferred from state a branch has already changed, so it is passed.
     */
    setError: function (err, tokens) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      reportOutcomes(this, tokens || [], 'failure', { code: 'send-email/failed', message: err });
    },
    /**
     * ⚠️ The pending array is created lazily here rather than in `initialize`: several suites
     * build this node as a bag of bound methods and never call `initialize`, and an eager field
     * is `undefined` exactly where the first invocation reads it.
     */
    scheduleSend: function (token) {
      if (token) {
        if (!this._internal.pendingSendOutcomes) this._internal.pendingSendOutcomes = [];
        this._internal.pendingSendOutcomes.push(token);
      }

      // The guard drops the second pulse's *send* deliberately — that is how "set the fields,
      // then press Do" batches — but Rule 1 is per invocation, so the second pulse's outcome is
      // already queued above.
      if (this._internal.sendScheduled) return;
      this._internal.sendScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.sendScheduled = false;
        this.doSend();
      });
    },
    doSend: function () {
      // Taken into a local *before* the request starts, so a second `Do` arriving mid-flight
      // owns its own batch rather than being settled by this request's answer.
      const tokens = this._internal.pendingSendOutcomes || [];
      this._internal.pendingSendOutcomes = undefined;

      if (!this._internal.to) {
        this.setError('Send Email: "To" is required.', tokens);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendEmail = (globalThis as any)._noodl_send_email;
      if (typeof sendEmail === 'undefined') {
        this.setError(
          'Send Email: no email service is available. This node only works inside a nodegx-backend cloud ' +
            'function/workflow (BAK-002) — it is not usable in the browser viewer.',
          tokens
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
            reportOutcomes(this, tokens, 'done');
          } else {
            this.setError((result && result.error) || 'Send Email: failed to send.', tokens);
          }
        })
        .catch((e) => {
          this.setError(e instanceof Error ? e.message : String(e), tokens);
        });
    }
  }
};

export function setup() {
  // No editor-only dynamic-port behavior (unlike Request/Response) — every
  // port here is static.
}
