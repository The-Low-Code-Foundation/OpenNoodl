/**
 * ✅ **CN-017 D6 part 3 — the consent step, and the one surface that decides
 * whether third-party code is allowed to land.**
 *
 * ## Why this is not a stage inside `ImportFlow`
 *
 * 🔴 **Measured: `ModuleLibraryModel._install` skips the flow entirely when
 * nothing collides** (LIB-005's "keep the one-click case one click" — it plans
 * the whole source and calls `applyToProject` directly). A consent stage added to
 * the flow would therefore be *absent on the most common install path*, which is
 * the shape of a guard that reads as present and is decoration. This is its own
 * modal so that both routes call the same one.
 *
 * ## What it does NOT claim
 *
 * ⚠️ **CN-017 AC5.** Nothing in this file's copy says a verified kit is safe, and
 * nothing may be added that does. `verifyKitSource` establishes *what a script
 * defines*; a `vm` context is a shape smoke test, not a security boundary, and a
 * kit is arbitrary JavaScript with the app's full reach by design — that is what
 * makes a custom node as capable as a built-in. The honest offer is: here is what
 * this code declares, here is what installing it means, decide.
 *
 * @module noodl-editor/views/ImportFlow/openKitConsent
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import type { ImportOrigin, KitConsent } from '@noodl-utils/import-engine';

import { scanExecutableModules, type ScannedExecutableModule } from '../../../../shared/utils/projectmodules';
import PopupLayer from '../popuplayer';
import { KIT_CONSENT_COPY } from './kitConsentCopy';
import { ImportFlowCancelled } from './openImportFlow';

/** One row in the dialog: a module, and whether it can be offered at all. */
interface ConsentRow {
  module: ScannedExecutableModule;
  /**
   * 🔴 **AC2: a failing kit writes nothing.** A module whose source could not be
   * loaded is not offered for consent and is not copied — there is no "install it
   * anyway" affordance, because the only thing it could do is fail identically
   * inside the user's project with the reason a step further away.
   */
  offerable: boolean;
  /** What the row says about verification. Never the word "safe". */
  detail: string;
}

function toRow(module: ScannedExecutableModule): ConsentRow {
  const verification = module.verification;

  // ⚠️ Three states, not two. "Not checked" is offerable — there was nothing to
  // read, which is a fact about the module's shape and not a failure of it — and
  // the copy says so rather than letting a silent row read as a pass.
  if (verification.outcome === 'not-checked') {
    return { module, offerable: true, detail: verification.message };
  }

  return { module, offerable: verification.ok, detail: verification.message };
}

const CARD: React.CSSProperties = {
  padding: '8px 10px',
  marginTop: '6px',
  borderRadius: '4px',
  border: '1px solid var(--theme-color-bg-3)',
  backgroundColor: 'var(--theme-color-bg-2)'
};

function ConsentDialog({
  title,
  url,
  rows,
  onAccept,
  onCancel
}: {
  title: string;
  url: string;
  rows: ConsentRow[];
  onAccept: () => void;
  onCancel: () => void;
}) {
  const offered = rows.filter((r) => r.offerable);
  const refused = rows.filter((r) => !r.offerable);

  return (
    <div
      data-test="kit-consent-dialog"
      style={{
        width: '560px',
        maxHeight: '70vh',
        overflowY: 'auto',
        padding: '20px',
        backgroundColor: 'var(--theme-color-bg-1)',
        color: 'var(--theme-color-fg-default)',
        borderRadius: '6px'
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: 600 }}>{title}</div>

      {/*
        ⚠️ **AC4: one sentence, neither minimising nor catastrophising.** It states
        the capability as a fact about how kits work, because it IS how they work
        — a warning tone here would read as "this particular download is suspect",
        which is a claim this dialog has no evidence for either way.
      */}
      <div style={{ marginTop: '10px', fontSize: '12px', lineHeight: 1.5 }} data-test="kit-consent-statement">
        {KIT_CONSENT_COPY.statement}
      </div>

      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--theme-color-fg-muted)' }}>
        From <span data-test="kit-consent-origin">{url}</span>
      </div>

      {/*
        🔴 **AC5 in the one place a reader is most likely to infer otherwise.**
        A list of green ticks beside "verified" would be read as an assurance;
        this says what the check is and what it is not, next to the ticks.
      */}
      <div
        style={{ marginTop: '12px', fontSize: '11px', color: 'var(--theme-color-fg-muted)', lineHeight: 1.5 }}
        data-test="kit-consent-limits"
      >
        {KIT_CONSENT_COPY.limits}
      </div>

      {offered.map((row) => (
        <div key={row.module.dirName} style={CARD} data-test={`kit-consent-item-${row.module.dirName}`}>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>{row.module.displayName}</div>
          <div style={{ fontSize: '11px', color: 'var(--theme-color-fg-muted)', marginTop: '2px' }}>
            noodl_modules/{row.module.dirName}
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px' }}>{row.detail}</div>
        </div>
      ))}

      {refused.length > 0 && (
        <>
          <div style={{ marginTop: '14px', fontSize: '12px', fontWeight: 600 }}>
            {KIT_CONSENT_COPY.refusedHeading}
          </div>
          {refused.map((row) => (
            <div
              key={row.module.dirName}
              style={{ ...CARD, borderColor: 'var(--theme-color-error)' }}
              data-test={`kit-consent-refused-${row.module.dirName}`}
            >
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{row.module.displayName}</div>
              <div style={{ fontSize: '11px', color: 'var(--theme-color-error)', marginTop: '4px' }}>{row.detail}</div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
        <button
          onClick={onCancel}
          data-test="kit-consent-cancel"
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            background: 'none',
            border: '1px solid var(--theme-color-bg-3)',
            borderRadius: '4px',
            color: 'var(--theme-color-fg-default)',
            cursor: 'pointer'
          }}
        >
          {KIT_CONSENT_COPY.cancel}
        </button>
        <button
          onClick={onAccept}
          disabled={offered.length === 0}
          data-test="kit-consent-accept"
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            backgroundColor: offered.length === 0 ? 'var(--theme-color-bg-3)' : 'var(--theme-color-primary)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: offered.length === 0 ? 'default' : 'pointer'
          }}
        >
          {offered.length === 0 ? KIT_CONSENT_COPY.acceptNothing : KIT_CONSENT_COPY.accept(offered.length)}
        </button>
      </div>
    </div>
  );
}

/**
 * Ask for consent to the executable modules in `sourceDir`, and return the
 * {@link ImportOrigin} that records the answer.
 *
 * ⚠️ **No dialog when there is no code.** A prefab or project archive that
 * carries no executable module returns `consents: []` without interrupting
 * anyone — LIB-005's one-click case survives, and a consent prompt for an icon
 * set would train people to click through the one that matters.
 *
 * @throws {ImportFlowCancelled} if the user declines or dismisses.
 */
export async function requireDownloadConsent(options: {
  title: string;
  url: string;
  sourceDir: string;
}): Promise<ImportOrigin> {
  const modules = await scanExecutableModules(options.sourceDir);
  if (modules.length === 0) {
    return { kind: 'downloaded', url: options.url, consents: [] };
  }

  const rows = modules.map(toRow);
  const offered = rows.filter((r) => r.offerable);

  const accepted = await new Promise<boolean>((resolve) => {
    const el = document.createElement('div');
    const root: Root = createRoot(el);
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      PopupLayer.instance.hideModal(modal);
      // React forbids unmounting from inside a handler still on the stack.
      setTimeout(() => root.unmount(), 0);
      resolve(value);
    };

    root.render(
      React.createElement(ConsentDialog, {
        title: options.title,
        url: options.url,
        rows,
        onAccept: () => settle(true),
        onCancel: () => settle(false)
      })
    );

    const modal = PopupLayer.instance.showModal({
      content: { el },
      // Dismissed by clicking away or Escape. 🔴 Resolves to DECLINED, never to
      // accepted: a consent that can be given by not answering is not consent.
      onClose: () => settle(false)
    });
  });

  if (!accepted) throw new ImportFlowCancelled();

  const consentedAt = new Date().toISOString();
  const consents: KitConsent[] = offered.map((row) => ({
    module: row.module.dirName,
    verification: row.module.verification,
    consentedAt
  }));

  return { kind: 'downloaded', url: options.url, consents };
}
