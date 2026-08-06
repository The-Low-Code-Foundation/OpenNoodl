/**
 * PermissionsPanel (BAK-003)
 *
 * The editor face of the backend access-control model: per-collection
 * permissions, roles + membership, and API keys, edited against a running
 * nodegx-backend through the `backend:*` permission IPC (which proxies to the
 * service's /admin/* surface). It is the same config the MCP tools and BAK-005's
 * served dashboard edit — one model, three fronts.
 *
 * Rendered as a full-screen portal overlay from LocalBackendCard, mirroring the
 * Data Browser and Schema panels (the one-panel constraint: a section here, not
 * a new top-level panel).
 *
 * @module panels/permissions/PermissionsPanel
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { CollectionPermissions } from './CollectionPermissions';
import css from './PermissionsPanel.module.scss';
import { ClpOp, RuleValue, describeRule, roleAtom, rolesToOffer } from './ruleVocabulary';

const { ipcRenderer } = window.require('electron');

type Op = ClpOp;

interface CollectionRules {
  permissions?: Partial<Record<Op, RuleValue>>;
  creatorOwns?: boolean;
}

interface SecurityConfig {
  version: number;
  devOpen: boolean;
  defaults: { permissions: Record<Op, RuleValue>; creatorOwns: boolean };
  collections: Record<string, CollectionRules>;
  functions: Record<string, unknown>;
  files: Record<string, RuleValue>;
  signup: RuleValue;
}

interface Role {
  objectId: string;
  name: string;
  users: string[];
}

interface RateLimit {
  ratePerMinute: number;
  burst: number;
}

/**
 * One row of `GET /admin/permissions/functions` (CWF-017).
 *
 * `call` is the EFFECTIVE rule and `source` says where it came from. The panel
 * never resolves the fallback itself: the backend answers with the rule its own
 * gate would apply, so what is on screen and what runs cannot disagree.
 */
interface FunctionRules {
  name: string;
  deployed: boolean;
  workflow: string | null;
  call: RuleValue;
  source: 'configured' | 'graph';
  configured: RuleValue | null;
  allowNoAuth: boolean;
  runAs: string | null;
  rateLimit: RateLimit | null;
  /**
   * CWF-018's per-function execution bound, in MILLISECONDS as security.json
   * stores it. `null` = undeclared, and what applies instead is the service's
   * `defaultTimeoutMs`; a declared `0` is "no limit" and is not the same thing,
   * which is why this cannot collapse to a number with a falsy default.
   */
  timeoutMs: number | null;
  /**
   * CWF-016. `null` = this function does not honour `Idempotency-Key` at all,
   * which is what every function does until someone says otherwise — so unlike
   * the rule above there is no effective-value question to answer here.
   */
  idempotency: FunctionIdempotency | null;
  /** The two gates disagreeing: open at the door, closed inside the graph. */
  graphRefusesAnonymous: boolean;
}

/** CWF-016's per-function block, exactly as `security.json` stores it. */
interface FunctionIdempotency {
  enabled: boolean;
  requireKey?: boolean;
  hashBody?: boolean;
}

/**
 * The five states the row's one control can be in.
 *
 * Deliberately ONE select rather than a checkbox trio: the backend refuses
 * `enabled: false` alongside `requireKey`/`hashBody` (a setting that says two
 * things at once), and a control that cannot express the refused combination is
 * better than a control that offers it and then reports an error.
 */
type IdempotencyChoice = 'off' | 'key' | 'key-body' | 'required' | 'required-body';

function idempotencyChoice(value: FunctionIdempotency | null): IdempotencyChoice {
  if (!value || !value.enabled) return 'off';
  if (value.requireKey) return value.hashBody ? 'required-body' : 'required';
  return value.hashBody ? 'key-body' : 'key';
}

/** `null` clears the entry; anything else is the exact block to store. */
function idempotencyValue(choice: IdempotencyChoice): FunctionIdempotency | null {
  switch (choice) {
    case 'off':
      return null;
    case 'key':
      return { enabled: true };
    case 'key-body':
      return { enabled: true, hashBody: true };
    case 'required':
      return { enabled: true, requireKey: true };
    case 'required-body':
      return { enabled: true, requireKey: true, hashBody: true };
  }
}

interface ApiKey {
  objectId: string;
  name: string;
  scopes: string[];
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PermissionsPanelProps {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

/** A single rule value rendered as an editable string ("public" or "a,b"). */
function ruleToText(rule: RuleValue | undefined): string {
  if (rule === undefined) return '';
  return Array.isArray(rule) ? rule.join(', ') : rule;
}
function textToRule(text: string): RuleValue | undefined {
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : parts;
}

export function PermissionsPanel({ backendId, backendName, onClose }: PermissionsPanelProps) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [functions, setFunctions] = useState<FunctionRules[]>([]);
  const [classRateLimit, setClassRateLimit] = useState<RateLimit | null>(null);
  /** CWF-018: what an undeclared timeout means, answered by the backend. */
  const [defaultTimeoutMs, setDefaultTimeoutMs] = useState<number | null>(null);
  /**
   * CWF-016 service facts. `available: false` means the claim store did not open
   * (no sqlite), and the control is disabled rather than offering a promise the
   * backend could not keep — that is the whole lesson of TALK-007: a capability
   * that exists invisibly, and a control that implies one that does not.
   */
  const [idempotencyService, setIdempotencyService] = useState<{ available: boolean; ttlHours: number } | null>(
    null
  );
  const [roles, setRoles] = useState<Role[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [enforced, setEnforced] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState('functions:*');
  const [freshSecret, setFreshSecret] = useState<{ name: string; secret: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const perms = await ipcRenderer.invoke('backend:getPermissions', backendId);
      setConfig(perms.config);
      setEnforced(perms.enforced);
      const schema = await ipcRenderer.invoke('backend:getSchema', backendId);
      setTables((schema.tables || []).map((t: { name: string }) => t.name).filter((n: string) => !n.startsWith('_')));
      const fns = await ipcRenderer.invoke('backend:getFunctionRules', backendId);
      setFunctions(fns.functions || []);
      setClassRateLimit(fns.classRateLimit || null);
      setDefaultTimeoutMs(typeof fns.defaultTimeoutMs === 'number' ? fns.defaultTimeoutMs : null);
      setIdempotencyService(fns.idempotency || null);
      setRoles((await ipcRenderer.invoke('backend:listRoles', backendId)).roles || []);
      setKeys((await ipcRenderer.invoke('backend:listApiKeys', backendId)).keys || []);
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
    setTimeout(() => setNotice(null), 3000);
  }, []);

  const reportError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  // ---- Dev-open toggle -----------------------------------------------------
  const toggleDevOpen = useCallback(
    async (next: boolean) => {
      if (!config) return;
      try {
        const updated = { ...config, devOpen: next };
        const res = await ipcRenderer.invoke('backend:setPermissions', backendId, updated);
        setConfig(res.config);
        await load();
        flash(next ? 'Dev-open enabled — all access relaxed (local only).' : 'Enforcement enabled.');
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, config, flash, load, reportError]
  );

  // ---- Collection rules ----------------------------------------------------
  /**
   * Write one operation's rule. `undefined` REMOVES it, which is how "use the
   * default" is said on the wire — the key is deleted, not set to a copy of the
   * default, so this collection keeps following the default when it changes.
   *
   * The rule arrives already in the backend's shape (SPR-001 §3): the matrix
   * hands over a `RuleValue` built by `selectionToRule`, so no string is parsed
   * on the way in and a role name containing a comma is no longer two rules.
   */
  const setCollectionRule = useCallback(
    async (collection: string, op: Op, rule: RuleValue | undefined) => {
      try {
        const current = config?.collections[collection] || {};
        const permissions = { ...(current.permissions || {}) };
        if (rule === undefined) delete permissions[op];
        else permissions[op] = rule;
        const res = await ipcRenderer.invoke('backend:setCollectionPermissions', backendId, collection, {
          permissions,
          creatorOwns: current.creatorOwns
        });
        setConfig((c) => (c ? { ...c, collections: { ...c.collections, [collection]: res.rules } } : c));
        flash(`${collection}.${op}: ${rule === undefined ? 'the default' : describeRule(rule)}`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, config, flash, reportError]
  );

  const toggleCreatorOwns = useCallback(
    async (collection: string, next: boolean) => {
      try {
        const current = config?.collections[collection] || {};
        const res = await ipcRenderer.invoke('backend:setCollectionPermissions', backendId, collection, {
          permissions: current.permissions,
          creatorOwns: next
        });
        setConfig((c) => (c ? { ...c, collections: { ...c.collections, [collection]: res.rules } } : c));
        flash(`${collection}: creator-owns ${next ? 'on' : 'off'}`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, config, flash, reportError]
  );

  // ---- Cloud function rules (CWF-017) --------------------------------------
  /**
   * Write one function's entry and re-read the list.
   *
   * Always a re-read rather than a local patch: the effective rule can change
   * for a reason the write does not carry (clearing `call` hands the answer back
   * to the graph), and guessing that here is how a panel starts showing a
   * different rule from the one being enforced.
   */
  const writeFunctionRules = useCallback(
    async (name: string, rules: Record<string, unknown>, message: string) => {
      try {
        await ipcRenderer.invoke('backend:setFunctionRules', backendId, name, rules);
        await load();
        flash(message);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  const setFunctionCall = useCallback(
    async (name: string, choice: string) => {
      if (choice === 'graph') {
        try {
          await ipcRenderer.invoke('backend:resetFunctionRules', backendId, name);
          await load();
          flash(`${name} follows its graph's Allow Unauthenticated port again`);
        } catch (err) {
          reportError(err);
        }
        return;
      }
      await writeFunctionRules(name, { call: choice }, `${name}: ${choice}`);
    },
    [backendId, load, flash, reportError, writeFunctionRules]
  );

  const setFunctionRateLimit = useCallback(
    async (name: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        await writeFunctionRules(name, { rateLimit: null }, `${name}: no limit of its own`);
        return;
      }
      // "60" or "60/20" — sustained rate, optional burst (defaulting to the rate).
      const [rateText, burstText] = trimmed.split('/');
      const ratePerMinute = Number(rateText);
      const burst = burstText === undefined ? ratePerMinute : Number(burstText);
      if (!Number.isFinite(ratePerMinute) || !Number.isFinite(burst) || ratePerMinute < 0 || burst < 0) {
        reportError(new Error(`"${trimmed}" is not a limit. Write a rate per minute, optionally rate/burst — e.g. 60/20.`));
        return;
      }
      await writeFunctionRules(name, { rateLimit: { ratePerMinute, burst } }, `${name}: ${ratePerMinute}/min, burst ${burst}`);
    },
    [reportError, writeFunctionRules]
  );

  /**
   * CWF-018's per-function time limit, authored in SECONDS.
   *
   * The wire and security.json are milliseconds (`timeoutMs`), because the
   * workflow engine already spells every bound that way and a second word for
   * the same idea is how two of them end up disagreeing. The panel converts
   * rather than mirrors: a function's limit is an authoring decision measured in
   * "how long may a user wait", and asking someone to write 45000 in a text box
   * beside a rate of 60/min is how a stray zero becomes a twelve-minute hang.
   *
   * Blank clears the entry (the service default applies again); `0` is a
   * DECLARED no-limit, which is the honest way for a streaming function to opt
   * out (CWF-007) and is deliberately not the same as blank.
   */
  const setFunctionTimeout = useCallback(
    async (name: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        await writeFunctionRules(
          name,
          { timeoutMs: null },
          defaultTimeoutMs === null
            ? `${name}: the service default`
            : `${name}: the service default (${defaultTimeoutMs / 1000}s)`
        );
        return;
      }
      const seconds = Number(trimmed);
      if (!Number.isFinite(seconds) || seconds < 0) {
        reportError(
          new Error(`"${trimmed}" is not a time limit. Write seconds — e.g. 45. 0 means no limit at all.`)
        );
        return;
      }
      await writeFunctionRules(
        name,
        { timeoutMs: Math.round(seconds * 1000) },
        seconds === 0 ? `${name}: no time limit` : `${name}: ${seconds}s`
      );
    },
    [defaultTimeoutMs, reportError, writeFunctionRules]
  );

  /**
   * CWF-016's per-function idempotency, written as the exact block the backend
   * validates — no editor-side shape, no editor-side default.
   *
   * The notice names what CHANGED for the caller rather than echoing the value,
   * because "quick: key" tells an author nothing about whether their webhook is
   * now safe to retry.
   */
  const setFunctionIdempotency = useCallback(
    async (name: string, choice: IdempotencyChoice) => {
      const value = idempotencyValue(choice);
      const ttl = idempotencyService ? `${idempotencyService.ttlHours}h` : 'the retention window';
      const message =
        value === null
          ? `${name}: every delivery runs — duplicates are not detected`
          : value.requireKey
            ? `${name}: an Idempotency-Key is now required; a repeat replays for ${ttl}`
            : `${name}: a repeated Idempotency-Key replays the first answer for ${ttl}`;
      await writeFunctionRules(name, { idempotency: value }, message);
    },
    [idempotencyService, writeFunctionRules]
  );

  // ---- Roles ---------------------------------------------------------------
  /**
   * Create a role by name. Reachable from two places on purpose: this section,
   * and the permission matrix itself — a role you are about to write a rule
   * about is best created without leaving the rule (SPR-001 §3).
   */
  const createRoleNamed = useCallback(
    async (raw: string) => {
      const name = raw.trim();
      if (!name) return;
      try {
        await ipcRenderer.invoke('backend:createRole', backendId, name);
        await load();
        flash(`Role "${name}" created — it is now a row on every collection`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  const createRole = useCallback(async () => {
    if (!newRoleName.trim()) return;
    await createRoleNamed(newRoleName);
    setNewRoleName('');
  }, [newRoleName, createRoleNamed]);

  const deleteRole = useCallback(
    async (name: string) => {
      try {
        await ipcRenderer.invoke('backend:deleteRole', backendId, name);
        await load();
        flash(`Role "${name}" deleted`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  const addRoleUser = useCallback(
    async (role: string, userId: string) => {
      if (!userId.trim()) return;
      try {
        await ipcRenderer.invoke('backend:addRoleUser', backendId, role, userId.trim());
        await load();
        flash(`Added user to "${role}"`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  const removeRoleUser = useCallback(
    async (role: string, userId: string) => {
      try {
        await ipcRenderer.invoke('backend:removeRoleUser', backendId, role, userId);
        await load();
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, reportError]
  );

  // ---- API keys ------------------------------------------------------------
  const createKey = useCallback(async () => {
    const name = newKeyName.trim();
    if (!name) return;
    const scopes = newKeyScopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await ipcRenderer.invoke('backend:createApiKey', backendId, name, scopes);
      setFreshSecret({ name, secret: res.secret });
      setNewKeyName('');
      await load();
    } catch (err) {
      reportError(err);
    }
  }, [backendId, newKeyName, newKeyScopes, load, reportError]);

  const revokeKey = useCallback(
    async (objectId: string) => {
      try {
        await ipcRenderer.invoke('backend:revokeApiKey', backendId, objectId);
        await load();
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, reportError]
  );

  /**
   * The role atoms a function's rule select offers: every role that exists,
   * plus any a function rule already names. A rule outlives the role it names,
   * and an option list that cannot show `role:ghost` would report a perfectly
   * valid rule as "custom" and hide it behind the free-text box (SPR-001 §3).
   */
  const functionRoleOptions = rolesToOffer(
    roles.map((role) => role.name),
    functions.map((fn) => (fn.configured === null ? undefined : fn.configured))
  ).map(roleAtom);

  return (
    <div className={css.Root}>
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.Setting} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Permissions</Text>
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

        {/* Posture */}
        <div className={css.Section}>
          <div className={css.SpreadRow}>
            <VStack>
              <Text textType={TextType.DefaultContrast}>
                {enforced ? 'Enforcement active' : 'Dev-open (local development)'}
              </Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                {enforced
                  ? 'Collection permissions and record ACLs are enforced.'
                  : 'All access is relaxed while bound to localhost. Deploying with dev-open on refuses to start.'}
              </Text>
            </VStack>
            <PrimaryButton
              label={config?.devOpen ? 'Turn enforcement on' : 'Turn dev-open on'}
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={() => toggleDevOpen(!config?.devOpen)}
              isDisabled={!config}
            />
          </div>
        </div>

        {/* Collection permissions */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            Collection permissions
          </Text>
          <CollectionPermissions
            tables={tables}
            config={config}
            roleNames={roles.map((role) => role.name)}
            onSetRule={setCollectionRule}
            onToggleCreatorOwns={toggleCreatorOwns}
            onCreateRole={createRoleNamed}
          />
        </div>

        {/* Cloud function access + budget (CWF-017) */}
        {functions.length > 0 && (
          <div className={css.Section}>
            <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
              Cloud functions
            </Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '10px' }}>
              Who may call each function, and how often. Every function has a rule whether or not anyone set one:
              with nothing here, the function's own Request node decides through its <em>Allow Unauthenticated</em>{' '}
              port. Functions run with the backend's own authority — running as the caller is not built, so there is
              nothing to choose. Limits are on top of the shared budget for all functions
              {classRateLimit ? ` (${classRateLimit.ratePerMinute}/min, burst ${classRateLimit.burst})` : ''}, so a
              number here can only tighten. A function is stopped with a 504 if it has not answered within its time
              limit
              {defaultTimeoutMs === null ? '' : `, ${defaultTimeoutMs / 1000}s unless you set one`} — write{' '}
              <em>0</em> for a function that legitimately holds its connection open.
            </Text>
            {/* CWF-016. Two things an author cannot work out from the control
                itself, so both are said here: what "replay" actually returns,
                and the one duplicate path this does not cover. */}
            <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '10px' }}>
              Every webhook provider retries. Set <em>duplicate deliveries</em> to replay, and a repeat carrying the
              same <em>Idempotency-Key</em> header gets the first delivery&apos;s exact answer back without the graph
              running again
              {idempotencyService ? ` — for ${idempotencyService.ttlHours}h, then the key is forgotten` : ''}. Only a
              successful call claims a key: a failure is never replayed, so retrying still fixes it. Add{' '}
              <em>+ body</em> only if your caller reuses keys — a payload that carries a changing timestamp would
              otherwise look like a new request every time.{' '}
              {idempotencyService && !idempotencyService.available
                ? 'This backend could not open its claim store, so the setting is unavailable here.'
                : ''}
              <br />
              ⚠️ This is an HTTP door. A workflow&apos;s <em>Call Function</em> step reaches the function in process,
              so a step retry is a real second run and no key applies to it.
            </Text>
            {functions.map((fn) => (
              <div key={fn.name} className={css.CollectionRow} data-test={`function-rules-${fn.name}`}>
                <div className={css.CollectionName}>
                  <Text textType={TextType.DefaultContrast}>
                    {fn.name}
                    {!fn.deployed && ' — not on this backend'}
                  </Text>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    {fn.source === 'graph'
                      ? `from the graph: ${ruleToText(fn.call)}`
                      : `set here: ${ruleToText(fn.call)}`}
                  </Text>
                </div>
                <div className={css.FunctionGrid}>
                  <label className={css.OpField}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      who can call this
                    </Text>
                    {/* SPR-001 §3: the single-role cases are options here, so a
                        role never has to be spelled by hand. A SET of roles is
                        still the box beside it — that is the escape hatch, and
                        it is why the box did not go away. */}
                    <select
                      className={css.RuleInput}
                      data-test={`function-call-${fn.name}`}
                      value={
                        fn.source === 'graph'
                          ? 'graph'
                          : typeof fn.call === 'string' &&
                              (['public', 'authenticated', 'nobody'].includes(fn.call) ||
                                functionRoleOptions.includes(fn.call))
                            ? fn.call
                            : 'custom'
                      }
                      onChange={(e) => e.target.value !== 'custom' && setFunctionCall(fn.name, e.target.value)}
                    >
                      <option value="graph">
                        From the graph ({fn.allowNoAuth ? 'anyone' : 'signed-in'})
                      </option>
                      <option value="public">Anyone</option>
                      <option value="authenticated">Signed-in</option>
                      <option value="nobody">Nobody</option>
                      {functionRoleOptions.map((atom) => (
                        <option key={atom} value={atom}>
                          Only {atom}
                        </option>
                      ))}
                      <option value="custom">Several roles… (use the box)</option>
                    </select>
                  </label>
                  <label className={css.OpField}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      or several, comma-separated
                    </Text>
                    <input
                      className={css.RuleInput}
                      key={`${fn.name}-${ruleToText(fn.configured ?? undefined)}`}
                      defaultValue={ruleToText(fn.configured ?? undefined)}
                      placeholder={`${ruleToText(fn.call)} (from the graph)`}
                      onBlur={(e) => {
                        const next = textToRule(e.target.value);
                        const before = fn.configured === null ? undefined : fn.configured;
                        if (ruleToText(next) === ruleToText(before)) return;
                        if (next === undefined) setFunctionCall(fn.name, 'graph');
                        else writeFunctionRules(fn.name, { call: next }, `${fn.name}: ${ruleToText(next)}`);
                      }}
                    />
                  </label>
                  <label className={css.OpField}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      its own limit (rate/burst)
                    </Text>
                    <input
                      className={css.RuleInput}
                      key={`${fn.name}-limit-${fn.rateLimit ? `${fn.rateLimit.ratePerMinute}/${fn.rateLimit.burst}` : ''}`}
                      defaultValue={fn.rateLimit ? `${fn.rateLimit.ratePerMinute}/${fn.rateLimit.burst}` : ''}
                      placeholder="no limit of its own"
                      onBlur={(e) => {
                        const current = fn.rateLimit ? `${fn.rateLimit.ratePerMinute}/${fn.rateLimit.burst}` : '';
                        if (e.target.value.trim() === current) return;
                        setFunctionRateLimit(fn.name, e.target.value);
                      }}
                    />
                  </label>
                  {/* CWF-018: the bound that turns a function which never sends
                      a Response into a 504 instead of a held socket. */}
                  <label className={css.OpField}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      time limit (seconds)
                    </Text>
                    <input
                      className={css.RuleInput}
                      key={`${fn.name}-timeout-${fn.timeoutMs === null ? '' : fn.timeoutMs}`}
                      defaultValue={fn.timeoutMs === null ? '' : String(fn.timeoutMs / 1000)}
                      placeholder={defaultTimeoutMs === null ? 'the default' : `${defaultTimeoutMs / 1000} (default)`}
                      onBlur={(e) => {
                        const current = fn.timeoutMs === null ? '' : String(fn.timeoutMs / 1000);
                        if (e.target.value.trim() === current) return;
                        setFunctionTimeout(fn.name, e.target.value);
                      }}
                    />
                  </label>
                  {/* CWF-016: the same delivery twice. The graph does not run a
                      second time — that is the whole reason this is a setting
                      here and not a node on the canvas, which would already have
                      run everything upstream of itself by the time it fired. */}
                  <label className={css.OpField}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      duplicate deliveries
                    </Text>
                    <select
                      className={css.RuleInput}
                      disabled={idempotencyService !== null && !idempotencyService.available}
                      value={idempotencyChoice(fn.idempotency)}
                      onChange={(e) => setFunctionIdempotency(fn.name, e.target.value as IdempotencyChoice)}
                    >
                      <option value="off">Run every time</option>
                      <option value="key">Replay on a repeated key</option>
                      <option value="key-body">Replay on key + body</option>
                      <option value="required">Require a key, then replay</option>
                      <option value="required-body">Require a key + body</option>
                    </select>
                  </label>
                </div>
                {fn.graphRefusesAnonymous && (
                  <Text textType={TextType.Shy} style={{ fontSize: '10px', color: 'var(--theme-color-notice)' }}>
                    This rule lets an anonymous caller through, but the function's Request node does not have{' '}
                    <em>Allow Unauthenticated</em> ticked — so the call reaches the graph and then fails there. Tick
                    the port on the canvas, or set this back to Signed-in.
                  </Text>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Roles */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            Roles
          </Text>
          <div className={css.InlineRow}>
            <input
              className={css.RuleInput}
              placeholder="new role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRole()}
            />
            <PrimaryButton label="Add role" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} onClick={createRole} />
          </div>
          {roles.map((role) => (
            <div key={role.objectId} className={css.RoleRow}>
              <div className={css.RoleHeader}>
                <Text textType={TextType.DefaultContrast}>role:{role.name}</Text>
                <IconButton icon={IconName.Trash} size={IconSize.Tiny} onClick={() => deleteRole(role.name)} />
              </div>
              <div className={css.RoleMembers}>
                {role.users.length === 0 && (
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    no members
                  </Text>
                )}
                {role.users.map((userId) => (
                  <span key={userId} className={css.MemberChip}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      {userId}
                    </Text>
                    <button className={css.ChipRemove} onClick={() => removeRoleUser(role.name, userId)}>
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className={css.MemberInput}
                  placeholder="add user objectId + Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addRoleUser(role.name, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* API keys */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            API keys
          </Text>
          {freshSecret && (
            <div className={css.SecretBanner}>
              <Text textType={TextType.DefaultContrast} style={{ fontSize: '11px' }}>
                Copy the secret for "{freshSecret.name}" now — it will never be shown again:
              </Text>
              <code className={css.SecretValue}>{freshSecret.secret}</code>
              <PrimaryButton
                label="Copy & dismiss"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => {
                  navigator.clipboard.writeText(freshSecret.secret);
                  setFreshSecret(null);
                }}
              />
            </div>
          )}
          <div className={css.InlineRow}>
            <input
              className={css.RuleInput}
              placeholder="key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <input
              className={css.RuleInput}
              placeholder="scopes (e.g. functions:*, classes:read)"
              value={newKeyScopes}
              onChange={(e) => setNewKeyScopes(e.target.value)}
            />
            <PrimaryButton label="Issue key" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} onClick={createKey} />
          </div>
          {keys.map((key) => (
            <div key={key.objectId} className={css.KeyRow}>
              <VStack>
                <Text textType={key.revoked ? TextType.Shy : TextType.DefaultContrast}>
                  {key.name} {key.revoked ? '(revoked)' : ''}
                </Text>
                <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                  {key.scopes.join(', ')}
                </Text>
              </VStack>
              {!key.revoked && (
                <PrimaryButton
                  label="Revoke"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={() => revokeKey(key.objectId)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
