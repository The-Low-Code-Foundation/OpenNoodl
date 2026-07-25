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

import css from './PermissionsPanel.module.scss';

const { ipcRenderer } = window.require('electron');

const OPS = ['find', 'get', 'create', 'update', 'delete'] as const;
type Op = (typeof OPS)[number];
type RuleValue = string | string[];

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
  const setCollectionRule = useCallback(
    async (collection: string, op: Op, text: string) => {
      try {
        const current = config?.collections[collection] || {};
        const permissions = { ...(current.permissions || {}) };
        const rule = textToRule(text);
        if (rule === undefined) delete permissions[op];
        else permissions[op] = rule;
        const res = await ipcRenderer.invoke('backend:setCollectionPermissions', backendId, collection, {
          permissions,
          creatorOwns: current.creatorOwns
        });
        setConfig((c) => (c ? { ...c, collections: { ...c.collections, [collection]: res.rules } } : c));
        flash(`Updated ${collection}.${op}`);
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

  // ---- Roles ---------------------------------------------------------------
  const createRole = useCallback(async () => {
    const name = newRoleName.trim();
    if (!name) return;
    try {
      await ipcRenderer.invoke('backend:createRole', backendId, name);
      setNewRoleName('');
      await load();
      flash(`Role "${name}" created`);
    } catch (err) {
      reportError(err);
    }
  }, [backendId, newRoleName, load, flash, reportError]);

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

  const effectiveRule = (collection: string, op: Op): string => {
    const c = config?.collections[collection];
    const own = c?.permissions?.[op];
    if (own !== undefined) return ruleToText(own);
    return config ? ruleToText(config.defaults.permissions[op]) : '';
  };

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
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '10px' }}>
            Rules: public, authenticated, nobody, role:&lt;name&gt; (comma-separate for OR). Blank inherits the default.
          </Text>
          {tables.length === 0 && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              No collections yet — create one in the Schema panel.
            </Text>
          )}
          {tables.map((table) => {
            const c = config?.collections[table];
            const creatorOwns = c?.creatorOwns ?? config?.defaults.creatorOwns ?? true;
            return (
              <div key={table} className={css.CollectionRow}>
                <div className={css.CollectionName}>
                  <Text textType={TextType.DefaultContrast}>{table}</Text>
                  <label className={css.CreatorOwns}>
                    <input
                      type="checkbox"
                      checked={creatorOwns}
                      onChange={(e) => toggleCreatorOwns(table, e.target.checked)}
                    />
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      creator-owns
                    </Text>
                  </label>
                </div>
                <div className={css.OpGrid}>
                  {OPS.map((op) => (
                    <label key={op} className={css.OpField}>
                      <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                        {op}
                      </Text>
                      <input
                        className={css.RuleInput}
                        defaultValue={effectiveRule(table, op)}
                        placeholder={config ? ruleToText(config.defaults.permissions[op]) : ''}
                        onBlur={(e) => setCollectionRule(table, op, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

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
