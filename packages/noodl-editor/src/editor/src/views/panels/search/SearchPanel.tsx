/**
 * SearchPanel (BAK-008)
 *
 * The editor face of per-collection full-text search: pick the collection,
 * pick the text field(s) to index, optionally a tokenizer, and enable —
 * which rebuilds the FTS5 shadow table immediately. Edited against a running
 * nodegx-backend through the `backend:*` search IPC (which proxies to the
 * service's `/admin/search` surface), the same config the MCP search tools
 * and (residually — see BAK-008-NOTES.md) BAK-005's served dashboard edit.
 *
 * Rendered as a full-screen portal overlay from LocalBackendCard, mirroring
 * Permissions/Email/Triggers/Schema (the one-panel constraint: a section
 * here, not a new top-level panel).
 *
 * @module panels/search/SearchPanel
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './SearchPanel.module.scss';

const { ipcRenderer } = window.require('electron');

interface ColumnDefinition {
  name: string;
  type: string;
}

interface TableInfo {
  name: string;
  columns: ColumnDefinition[];
}

interface CollectionSearchConfig {
  enabled: boolean;
  fields: string[];
  tokenizer?: string;
}

interface SearchConfig {
  version: number;
  collections: Record<string, CollectionSearchConfig>;
}

const TOKENIZERS = ['unicode61', 'ascii', 'porter', 'trigram'];

export interface SearchPanelProps {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

export function SearchPanel({ backendId, backendName, onClose }: SearchPanelProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [fts5Available, setFts5Available] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Draft field selection + tokenizer per collection, keyed by table name —
  // seeded from the saved config, edited locally, applied on "Enable"/"Update".
  const [drafts, setDrafts] = useState<Record<string, { fields: string[]; tokenizer: string }>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const schema = await ipcRenderer.invoke('backend:getSchema', backendId);
      const nonSystem: TableInfo[] = (schema.tables || []).filter((t: TableInfo) => !t.name.startsWith('_'));
      setTables(nonSystem);

      const searchConfig = await ipcRenderer.invoke('backend:getSearchConfig', backendId);
      setFts5Available(searchConfig.fts5Available);
      setConfig(searchConfig.config);

      setDrafts((prev) => {
        const next = { ...prev };
        for (const table of nonSystem) {
          if (next[table.name]) continue;
          const existing = searchConfig.config.collections[table.name];
          next[table.name] = {
            fields: existing ? existing.fields : [],
            tokenizer: (existing && existing.tokenizer) || 'unicode61'
          };
        }
        return next;
      });
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

  const toggleField = useCallback((table: string, field: string) => {
    setDrafts((prev) => {
      const current = prev[table] || { fields: [], tokenizer: 'unicode61' };
      const fields = current.fields.includes(field)
        ? current.fields.filter((f) => f !== field)
        : [...current.fields, field];
      return { ...prev, [table]: { ...current, fields } };
    });
  }, []);

  const setTokenizer = useCallback((table: string, tokenizer: string) => {
    setDrafts((prev) => ({ ...prev, [table]: { ...(prev[table] || { fields: [] }), tokenizer } }));
  }, []);

  const enableOrUpdate = useCallback(
    async (table: string) => {
      const draft = drafts[table];
      if (!draft || draft.fields.length === 0) {
        setError(`Select at least one field for "${table}" before enabling search.`);
        return;
      }
      setBusy(table);
      try {
        const res = await ipcRenderer.invoke('backend:setCollectionSearch', backendId, table, {
          enabled: true,
          fields: draft.fields,
          tokenizer: draft.tokenizer
        });
        setConfig((c) => (c ? { ...c, collections: { ...c.collections, [table]: res.config } } : c));
        flash(`Search enabled on "${table}" — indexed ${res.rebuild.rowsIndexed} row(s) in ${res.rebuild.elapsedMs}ms.`);
      } catch (err) {
        reportError(err);
      } finally {
        setBusy(null);
      }
    },
    [backendId, drafts, flash, reportError]
  );

  const disable = useCallback(
    async (table: string) => {
      setBusy(table);
      try {
        await ipcRenderer.invoke('backend:disableCollectionSearch', backendId, table);
        setConfig((c) => {
          if (!c) return c;
          const collections = { ...c.collections };
          delete collections[table];
          return { ...c, collections };
        });
        flash(`Search disabled on "${table}".`);
      } catch (err) {
        reportError(err);
      } finally {
        setBusy(null);
      }
    },
    [backendId, flash, reportError]
  );

  const rebuild = useCallback(
    async (table: string) => {
      setBusy(table);
      try {
        const res = await ipcRenderer.invoke('backend:rebuildCollectionSearch', backendId, table);
        flash(`Reindexed "${table}" — ${res.rebuild.rowsIndexed} row(s) in ${res.rebuild.elapsedMs}ms.`);
      } catch (err) {
        reportError(err);
      } finally {
        setBusy(null);
      }
    },
    [backendId, flash, reportError]
  );

  const enabledCount = useMemo(
    () => (config ? Object.values(config.collections).filter((c) => c.enabled).length : 0),
    [config]
  );

  return (
    <div className={css.Root}>
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.Search} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Search</Text>
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
        {!fts5Available && (
          <div className={css.WarningBanner}>
            <Text textType={TextType.DefaultContrast} style={{ fontSize: '12px' }}>
              The database engine this backend is running on was built without the search extension, so search cannot
              be turned on here. Everything else in the backend works as normal, and there is no partial version to
              fall back on — a query with a search term will fail until this backend runs on an engine that has it.
            </Text>
          </div>
        )}

        <div className={css.Section}>
          <div className={css.SpreadRow}>
            <VStack>
              <Text textType={TextType.DefaultContrast}>Search</Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '4px' }}>
                Let the people using your app find records by typing words — <em>blue running shoes</em> — instead of
                matching a field exactly. Pick a collection below, tick the fields worth searching, and press{' '}
                <em>Enable</em>.
              </Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px' }}>
                {enabledCount === 0
                  ? 'Nothing is searchable yet. Until you enable a collection here, queries only match fields exactly — and a Query Records node with something in its Search input will fail with "search is not enabled for this collection".'
                  : `${enabledCount} collection${enabledCount === 1 ? ' is' : 's are'} searchable. Collections not listed as enabled below still match fields exactly only.`}
              </Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px' }}>
                Once a collection is enabled, the <em>Search</em> input on a <em>Query Records</em> node (under Cloud
                Services) works against it: wire a text field to it and you get back the records that match, best
                match first. Each record arrives with two extra properties you can show — <em>_score</em>, higher for
                a better match, and <em>_snippet</em>, the matching text with the words marked.
              </Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px' }}>
                What it costs: the backend keeps its own copy of the fields you tick, so the database grows by roughly
                the size of that text, and saving a record does a little extra work to keep the copy current. Reading
                and querying do not get slower. Disabling throws the copy away and leaves your records untouched, so
                turning this on is not a one-way door.
              </Text>
            </VStack>
          </div>
        </div>

        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
            Collections
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '10px' }}>
            Tick the fields holding words a person would actually type — a title, a description, a name. Numbers,
            dates and IDs are better found with an exact filter, so leaving them unticked costs you nothing. The
            dropdown decides how text is chopped into words: leave it on <em>unicode61</em> unless you know you need
            otherwise — it suits languages written with spaces between words, does not treat <em>run</em> and{' '}
            <em>running</em> as the same word, and does not split Chinese, Japanese or Korean text.
          </Text>
          {tables.length === 0 && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              This backend has no collections yet, so there is nothing to make searchable. Create one in the Schema
              panel, put some records in it, then come back here.
            </Text>
          )}
          {tables.map((table) => {
            const saved = config?.collections[table.name];
            const draft = drafts[table.name] || { fields: [], tokenizer: 'unicode61' };
            const isBusy = busy === table.name;
            return (
              <div key={table.name} className={css.CollectionRow}>
                <div className={css.CollectionHeader}>
                  <Text textType={TextType.DefaultContrast}>{table.name}</Text>
                  {saved?.enabled && (
                    <Text textType={TextType.Shy} style={{ fontSize: '10px', color: 'var(--theme-color-success)' }}>
                      search enabled
                    </Text>
                  )}
                </div>
                <div className={css.FieldList}>
                  {table.columns
                    .filter((c) => !['objectId', 'createdAt', 'updatedAt', 'ACL'].includes(c.name))
                    .map((col) => (
                      <label key={col.name} className={css.FieldCheckbox}>
                        <input
                          type="checkbox"
                          checked={draft.fields.includes(col.name)}
                          onChange={() => toggleField(table.name, col.name)}
                        />
                        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                          {col.name}
                          {col.type !== 'String' ? ` (${col.type})` : ''}
                        </Text>
                      </label>
                    ))}
                </div>
                <div className={css.RowActions}>
                  <select
                    className={css.TokenizerSelect}
                    value={draft.tokenizer}
                    onChange={(e) => setTokenizer(table.name, e.target.value)}
                  >
                    {TOKENIZERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <PrimaryButton
                    label={isBusy ? 'Working…' : saved?.enabled ? 'Update' : 'Enable'}
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={() => enableOrUpdate(table.name)}
                    isDisabled={isBusy || !fts5Available}
                  />
                  {saved?.enabled && (
                    <>
                      <PrimaryButton
                        label="Rebuild"
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.Muted}
                        onClick={() => rebuild(table.name)}
                        isDisabled={isBusy}
                      />
                      <PrimaryButton
                        label="Disable"
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.Muted}
                        onClick={() => disable(table.name)}
                        isDisabled={isBusy}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
