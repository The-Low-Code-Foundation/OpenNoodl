/**
 * SecretsPanel (SB-015 §6.4a) — the last mile of CWF-009 slice 4.
 *
 * ## What was missing, and what was not
 *
 * CWF-009 shipped the store, the resolver, the `Secret` node, the
 * `/admin/secrets` route family (`nodegx-backend/src/server/admin-secrets.ts`,
 * mounted in `HttpServer.ts`) **and** the three `backend:*` IPC channels that
 * proxy to it (`BackendManager.js:340-348`). What it never shipped is a renderer
 * surface that calls them, so the only way to provision a credential a cloud
 * function reads was to hand-edit a mode-0600 `secrets.json` inside a backend
 * data directory the editor never shows you. This file is that surface and
 * nothing more — it adds no route, no channel and no storage.
 *
 * ⚠️ SB-015 §6.4a records that the first census of this said the *route* had no
 * caller. It does; two of the three layers already existed. The census had been
 * run with `--include="*.ts"` (which excludes `BackendManager.js`) over a tree
 * containing a NUL byte in `HttpServer.ts` (which grep skips as binary). The
 * scope of this file is the corrected answer, not the first one.
 *
 * ## The one rule this panel must not bend
 *
 * **Names come out; values only go in.** `admin-secrets.ts` §2 refuses a
 * read-back by construction — there is no GET of a value, no echo after a write,
 * and no length or fingerprint in the listing — because a surface that can read a
 * secret back is one that has to be permissioned, and admin-gating it is not the
 * same as being safe to have. That constraint is *why* this panel shows a value
 * exactly once: in the field the user just typed it into, client-side, before it
 * is sent. Nothing here ever asks the backend for a value, because nothing can.
 *
 * ## Why `alsoInEnvironment` is on every row rather than in a footnote
 *
 * The resolver has two doors (store first, then `NODEGX_SECRET_<NAME>`), so a
 * secret can be deleted here and still resolve in a running function. The route
 * reports that on the listing and again on the delete response, and this panel
 * repeats it in both places — an unexplained "deleted" over a credential that
 * still works is how somebody concludes the backend caches credentials and goes
 * looking for a bug that is not there.
 *
 * @module panels/secrets/SecretsPanel
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './SecretsPanel.module.scss';
import {
  SecretListing,
  canSave as canSaveSecret,
  describeDeleteOutcome,
  describeNameProblem,
  environmentOnlyVariables,
  envNameForSecret,
  generateSecretValue
} from './secretsPanelModel';

const { ipcRenderer } = window.require('electron');

/** One row of `GET /admin/secrets`. Names and provenance — never a value. */
type SecretRow = SecretListing;

interface SecretsResponse {
  namespace: string;
  secrets: SecretRow[];
  environment: string[];
  readable: boolean;
  envPrefix: string;
}

export interface SecretsPanelProps {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

export function SecretsPanel({ backendId, backendName, onClose }: SecretsPanelProps) {
  const [listing, setListing] = useState<SecretsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftValue, setDraftValue] = useState('');
  /** Whether the value field is legible. Off by default; never a read-back. */
  const [revealDraft, setRevealDraft] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setListing(await ipcRenderer.invoke('backend:listSecrets', backendId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [backendId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 6000);
  }, []);

  const reportError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
    setNotice(null);
  }, []);

  const nameProblem = useMemo(() => describeNameProblem(draftName), [draftName]);

  const existingNames = useMemo(() => new Set((listing?.secrets || []).map((s) => s.name)), [listing]);

  const save = useCallback(async () => {
    if (nameProblem || draftName.length === 0 || draftValue.length === 0) return;
    setBusy('__save__');
    try {
      const res = await ipcRenderer.invoke('backend:setSecret', backendId, draftName, draftValue);
      // The value is gone from this panel the moment it is stored: there is no
      // read-back to restore it from, so leaving it in the field would be the
      // only copy and would read as "still unsaved".
      setDraftName('');
      setDraftValue('');
      setRevealDraft(false);
      await load();
      flash(
        res.created
          ? `"${res.name}" is provisioned. A Secret node with that Name resolves it now — no restart needed.`
          : `"${res.name}" was replaced. Functions resolve the new value on their next run.`
      );
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(null);
    }
  }, [backendId, draftName, draftValue, nameProblem, load, flash, reportError]);

  const remove = useCallback(
    async (name: string) => {
      setBusy(name);
      try {
        const res = await ipcRenderer.invoke('backend:deleteSecret', backendId, name);
        await load();
        const outcome = describeDeleteOutcome({
          name,
          existed: Boolean(res.existed),
          stillResolvesFromEnvironment: Boolean(res.stillResolvesFromEnvironment),
          envName: res.envName
        });
        if (outcome.severity === 'error') {
          // Not a flash: an environment-shadowed delete must not disappear
          // after six seconds, because the secret still resolves.
          setNotice(null);
          setError(outcome.message);
        } else {
          flash(outcome.message);
        }
      } catch (err) {
        reportError(err);
      } finally {
        setBusy(null);
      }
    },
    [backendId, load, flash, reportError]
  );

  const secrets = listing?.secrets || [];
  /**
   * `NODEGX_SECRET_*` variables this backend has that no stored secret shadows.
   *
   * Shown because they resolve exactly like a stored secret does, and a panel
   * that lists only the store reports "STRIPE_KEY is not provisioned" about a
   * function that works fine. The route's own listing makes the same point.
   */
  const envOnly = useMemo(
    () => environmentOnlyVariables(secrets, listing?.environment || []),
    [listing, secrets]
  );

  const saveDisabled = !canSaveSecret({ name: draftName, value: draftValue, busy: busy !== null });

  return (
    <div className={css.Root}>
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.Setting} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Secrets</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {backendName}
            </Text>
          </VStack>
        </HStack>
        <IconButton icon={IconName.Close} onClick={onClose} />
      </div>

      <div className={css.Body}>
        {error && (
          <div className={css.ErrorBanner}>
            <Text textType={TextType.Default} style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </Text>
          </div>
        )}
        {notice && (
          <div className={css.NoticeBanner}>
            <Text textType={TextType.Default}>{notice}</Text>
          </div>
        )}

        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast}>What these are</Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '4px' }}>
            A secret is a credential a <em>cloud function</em> can read with a <em>Secret</em> node — an API key, a
            setup token, a signing key. The function asks for it by Name; it never appears in your graph, in your
            project files, or in anything you share.
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px' }}>
            🔒 <strong>Values can be written here but never read back.</strong> Not by this panel, not by the editor,
            not by anything over HTTP — the backend has no route that returns one. If you lose a value, replace it;
            there is nowhere to look it up.
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px' }}>
            Secrets are stored in this backend&apos;s own folder on this machine, and they do{' '}
            <strong>not</strong> travel with a deploy or a shared project. A function that works here and fails on a
            server is usually a secret nobody provisioned there.
          </Text>
        </div>

        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
            Add or replace a secret
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '10px' }}>
            The Name must match the <em>Name</em> on the Secret node that reads it. Saving a name that already exists
            replaces its value.
          </Text>

          <div className={css.FormRow}>
            <input
              className={css.TextInput}
              placeholder="Name — e.g. SITE_SETUP_TOKEN"
              value={draftName}
              spellCheck={false}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <input
              className={css.TextInput}
              placeholder="Value"
              type={revealDraft ? 'text' : 'password'}
              value={draftValue}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setDraftValue(e.target.value)}
            />
          </div>

          <div className={css.RowActions}>
            <PrimaryButton
              label={busy === '__save__' ? 'Saving…' : 'Save secret'}
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={save}
              isDisabled={saveDisabled}
            />
            <PrimaryButton
              label="Generate a value"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={() => {
                setDraftValue(generateSecretValue((bytes) => window.crypto.getRandomValues(bytes)));
                setRevealDraft(true);
              }}
              isDisabled={busy !== null}
            />
            {draftValue.length > 0 && (
              <PrimaryButton
                label={revealDraft ? 'Hide value' : 'Show value'}
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setRevealDraft((v) => !v)}
                isDisabled={busy !== null}
              />
            )}
          </div>

          {nameProblem && (
            <Text textType={TextType.Default} style={{ fontSize: '11px', marginTop: '8px' }}>
              {nameProblem}
            </Text>
          )}
          {!nameProblem && draftName.length > 0 && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '8px' }}>
              {existingNames.has(draftName)
                ? `"${draftName}" already exists — saving replaces its value.`
                : `New secret. On a server without this folder, the same value can be supplied as ${envNameForSecret(
                    draftName
                  )}.`}
            </Text>
          )}
          {revealDraft && draftValue.length > 0 && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px' }}>
              Copy this now if you need it elsewhere — once it is saved, nothing can show it to you again.
            </Text>
          )}
        </div>

        <div className={css.Section}>
          <div className={css.SpreadRow}>
            <Text textType={TextType.DefaultContrast}>Provisioned on this backend</Text>
            <PrimaryButton
              label="Refresh"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={load}
              isDisabled={busy !== null}
            />
          </div>

          {listing === null && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '10px' }}>
              Reading…
            </Text>
          )}
          {listing !== null && secrets.length === 0 && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '10px' }}>
              No secrets are provisioned here yet. A <em>Secret</em> node in a cloud function fires its{' '}
              <em>failure</em> output for a name that is not in this list, which is what a function that refuses
              everything usually turns out to be.
            </Text>
          )}
          {secrets.map((secret) => (
            <div key={secret.name} className={css.SecretRow}>
              <VStack>
                <Text textType={TextType.DefaultContrast}>{secret.name}</Text>
                <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '2px' }}>
                  {secret.alsoInEnvironment
                    ? `⚠ Also set as ${secret.envName} in this backend's environment — removing it here will not stop functions resolving it.`
                    : `Falls back to ${secret.envName} on a server that has no secrets file.`}
                </Text>
              </VStack>
              <PrimaryButton
                label={busy === secret.name ? 'Removing…' : 'Remove'}
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => remove(secret.name)}
                isDisabled={busy !== null}
              />
            </div>
          ))}
        </div>

        {envOnly.length > 0 && (
          <div className={css.Section}>
            <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
              Supplied by the environment
            </Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '8px' }}>
              This backend was started with these variables set. Functions resolve them exactly like the secrets
              above, but they are not stored here and cannot be removed from this panel — unset them where the
              backend is started.
            </Text>
            {envOnly.map((name) => (
              <Text key={name} textType={TextType.Shy} style={{ fontSize: '11px' }}>
                {name}
              </Text>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
