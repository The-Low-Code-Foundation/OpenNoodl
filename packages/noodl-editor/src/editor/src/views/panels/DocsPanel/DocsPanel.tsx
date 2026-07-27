/**
 * AIX-009 — Docs panel.
 *
 * The project's `docs/` folder: a file list, the doc rendered as markdown, a
 * toggle to a CodeMirror source view, and — the reason the panel earns its
 * place — the surface where an AI-proposed doc change is reviewed as a diff and
 * accepted or rejected.
 *
 * Deliberately not a markdown IDE. These are files on disk in git and VS Code
 * exists, so the panel is built around the assumption that the *other* editor
 * is the real one: it polls for external edits, follows them into the rendered
 * view, and refuses to write over an edit it has not seen. A panel that quietly
 * clobbered the file the user was editing elsewhere would make the format worse
 * than having no format.
 *
 * @module noodl-editor/views/panels/DocsPanel/DocsPanel
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  currentProjectDocsModel,
  DOC_PROPOSALS_CHANGED,
  DOCS_CHANGED,
  DocProposalStore,
  DocsConflictError,
  KNOWN_DOCS,
  ProjectDocsModel,
  type DocEntry,
  type DocProposal
} from '@noodl-models/ProjectDocs';
import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { CodeDiffView, MarkdownEditor } from '@noodl-core-ui/components/code-editor';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { Markdown } from '@noodl-core-ui/components/common/Markdown';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ListItem, ListItemVariant } from '@noodl-core-ui/components/layout/ListItem';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './DocsPanel.module.scss';

export const DocsPanel_ID = 'project-docs';

const EVENT_GROUP = 'docs-panel';

type ViewMode = 'rendered' | 'source';

/**
 * The docs model for whatever project is open, rebuilt when that changes.
 *
 * Prefers the boot-installed instance so the panel and the authoring loop share
 * one cache and one poll — a doc saved here is what the next build is told,
 * immediately, rather than up to a poll interval later. Falls back to its own
 * instance (and disposes only that one) if the boot install never ran.
 */
function useProjectDocs(): ProjectDocsModel | undefined {
  const resolve = () => currentProjectDocsModel() ?? ProjectDocsModel.forProject(ProjectModel.instance);
  const [docs, setDocs] = useState<ProjectDocsModel | undefined>(resolve);

  useEffect(() => {
    const rebind = () => setDocs(resolve());
    EventDispatcher.instance.on(['ProjectModel.instanceHasChanged', 'ProjectModel.importComplete'], rebind, EVENT_GROUP);
    return () => {
      EventDispatcher.instance.off(EVENT_GROUP);
    };
  }, []);

  useEffect(() => {
    if (!docs) return;
    const owned = docs !== currentProjectDocsModel();
    docs.startWatching();
    void docs.refresh();
    return () => {
      if (owned) docs.dispose();
    };
  }, [docs]);

  return docs;
}

export function DocsPanel() {
  const docs = useProjectDocs();

  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [selected, setSelected] = useState<string>(KNOWN_DOCS[0].path);
  const [mode, setMode] = useState<ViewMode>('rendered');
  const [content, setContent] = useState<string | undefined>(undefined);
  /** The exact bytes the buffer was loaded from — the write's drift baseline. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: FeedbackType } | null>(null);
  const [proposals, setProposals] = useState<readonly DocProposal[]>(() => DocProposalStore.instance.list());
  const [reviewing, setReviewing] = useState<string | null>(null);

  const dirty = draft !== null && draft !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const reload = useCallback(
    async (path: string) => {
      if (!docs) return;
      const text = await docs.read(path);
      setContent(text);
      setBaseline(text ?? null);
      setDraft(null);
      setEntries(await docs.list());
    },
    [docs]
  );

  useEffect(() => {
    if (!docs) {
      setEntries([]);
      setContent(undefined);
      return;
    }
    void reload(selected);
  }, [docs, selected, reload]);

  // External edits: refresh the list, and follow the file into the rendered
  // view. A buffer the user is actively editing is NOT overwritten — they are
  // told instead, because silently discarding either side is the wrong answer.
  useEffect(() => {
    if (!docs) return;
    const onChanged = async ({ paths }: { paths: string[] }) => {
      setEntries(await docs.list());
      if (!paths.includes(selected)) return;
      const text = await docs.read(selected);
      setContent(text);
      if (dirtyRef.current) {
        setNotice({
          text: `${selected} changed on disk while you were editing. Your unsaved text is still here; ` +
            'saving it will be refused until you discard or re-apply it.',
          type: FeedbackType.Notice
        });
        return;
      }
      setBaseline(text ?? null);
      setDraft(null);
    };
    docs.on(DOCS_CHANGED, onChanged, EVENT_GROUP + ':changed');
    return () => {
      docs.off(EVENT_GROUP + ':changed');
    };
  }, [docs, selected]);

  useEffect(() => {
    const store = DocProposalStore.instance;
    const update = () => setProposals([...store.list()]);
    store.on(DOC_PROPOSALS_CHANGED, update, EVENT_GROUP + ':proposals');
    update();
    return () => {
      store.off(EVENT_GROUP + ':proposals');
    };
  }, []);

  const proposal = useMemo(
    () => proposals.find((p) => p.id === reviewing) ?? proposals.find((p) => p.path === selected),
    [proposals, reviewing, selected]
  );

  const save = useCallback(async () => {
    if (!docs || draft === null) return;
    try {
      await docs.write(selected, draft, { baseline });
      setBaseline(draft);
      setDraft(null);
      setContent(draft);
      setNotice({ text: 'Saved.', type: FeedbackType.Success });
      setEntries(await docs.list());
    } catch (error) {
      setNotice({
        text: error instanceof DocsConflictError ? error.message : String(error),
        type: FeedbackType.Danger
      });
    }
  }, [docs, draft, baseline, selected]);

  const seed = useCallback(async () => {
    if (!docs) return;
    const created = await docs.seed();
    setNotice({
      text: created.length > 0 ? `Created ${created.join(', ')}.` : 'Nothing to create — the docs already exist.',
      type: FeedbackType.Success
    });
    setEntries(await docs.list());
    void reload(selected);
  }, [docs, reload, selected]);

  const acceptProposal = useCallback(
    async (id: string) => {
      if (!docs) return;
      try {
        await DocProposalStore.instance.accept(id, docs);
        setReviewing(null);
        setNotice({ text: 'Applied. Undo restores the previous file in one step.', type: FeedbackType.Success });
        void reload(selected);
      } catch (error) {
        setNotice({
          text: error instanceof DocsConflictError ? error.message : String(error),
          type: FeedbackType.Danger
        });
      }
    },
    [docs, reload, selected]
  );

  if (!docs) {
    return (
      <BasePanel title="Docs" isFill>
        <Box hasXSpacing hasYSpacing>
          <Text textType={TextType.Shy}>
            Open a project — and save it to disk at least once — to give it a docs folder.
          </Text>
        </Box>
      </BasePanel>
    );
  }

  const selectedEntry = entries.find((e) => e.path === selected);
  const hasAnyDoc = entries.some((e) => e.exists);

  return (
    <BasePanel title="Docs" isFill>
      <ExperimentalFlag />
      <div className={css['Root']}>
        <div className={css['FileList']}>
          {entries.map((entry) => (
            <ListItem
              key={entry.path}
              text={entry.name}
              icon={entry.exists ? IconName.File : IconName.Plus}
              variant={entry.path === selected ? ListItemVariant.Active : ListItemVariant.Default}
              isActive={entry.path === selected}
              UNSAFE_className={entry.exists ? undefined : css['Missing']}
              affix={
                proposals.some((p) => p.path === entry.path) ? (
                  <Icon icon={IconName.MagicWand} variant={FeedbackType.Notice} />
                ) : undefined
              }
              onClick={() => {
                setSelected(entry.path);
                setNotice(null);
                setReviewing(null);
              }}
            />
          ))}
        </div>

        {!hasAnyDoc && (
          <Box hasXSpacing hasYSpacing>
            <VStack UNSAFE_style={{ gap: 8 }}>
              <Text textType={TextType.Shy}>
                This project has no docs yet. Docs hold intent, decisions, external contracts and the rules the
                assistant should follow here — not a description of the graph, which Explain Mode narrates from the
                live version.
              </Text>
              <PrimaryButton
                label="Create docs folder"
                size={PrimaryButtonSize.Small}
                isFitContent
                onClick={() => void seed()}
              />
            </VStack>
          </Box>
        )}

        {notice && (
          <Box hasXSpacing hasYSpacing>
            <div className={notice.type === FeedbackType.Danger ? css['Danger'] : css['Notice']}>
              <Text textType={TextType.Secondary}>{notice.text}</Text>
            </div>
          </Box>
        )}

        {proposal && (
          <div className={css['Proposal']}>
            <div className={css['Toolbar']}>
              <Text textType={TextType.Secondary}>
                Proposed change to {proposal.path} — from {proposal.source}
              </Text>
              <HStack UNSAFE_style={{ gap: 6 }}>
                <PrimaryButton
                  label="Reject"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Ghost}
                  isFitContent
                  onClick={() => {
                    DocProposalStore.instance.reject(proposal.id);
                    setReviewing(null);
                  }}
                />
                <PrimaryButton
                  label="Accept"
                  size={PrimaryButtonSize.Small}
                  isFitContent
                  onClick={() => void acceptProposal(proposal.id)}
                />
              </HStack>
            </div>
            <div className={css['DiffHost']}>
              <CodeDiffView
                original={proposal.baseline ?? ''}
                modified={proposal.proposed}
                language="markdown"
                height="100%"
              />
            </div>
          </div>
        )}

        {!proposal && (
          <div className={css['Body']}>
            <div className={css['Toolbar']}>
              <Text textType={TextType.Shy}>{selected}</Text>
              <HStack UNSAFE_style={{ gap: 6 }}>
                {mode === 'source' && (
                  <PrimaryButton
                    label={dirty ? 'Save' : 'Saved'}
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    isDisabled={!dirty}
                    isFitContent
                    onClick={() => void save()}
                  />
                )}
                <PrimaryButton
                  label={mode === 'rendered' ? 'Edit' : 'Preview'}
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Ghost}
                  isFitContent
                  onClick={() => setMode(mode === 'rendered' ? 'source' : 'rendered')}
                />
              </HStack>
            </div>

            {content === undefined && (
              <Box hasXSpacing hasYSpacing>
                <VStack UNSAFE_style={{ gap: 8 }}>
                  <Text textType={TextType.Shy}>
                    {selectedEntry?.kind
                      ? KNOWN_DOCS.find((d) => d.kind === selectedEntry.kind)?.purpose
                      : 'This file does not exist yet.'}
                  </Text>
                  <PrimaryButton
                    label="Create from template"
                    size={PrimaryButtonSize.Small}
                    isFitContent
                    onClick={() => void seed()}
                  />
                </VStack>
              </Box>
            )}

            {content !== undefined && mode === 'rendered' && (
              <div className={css['Rendered']}>
                <Markdown content={draft ?? content} />
              </div>
            )}

            {content !== undefined && mode === 'source' && (
              <div className={css['Source']}>
                <MarkdownEditor
                  value={draft ?? content}
                  onChange={setDraft}
                  onSave={() => void save()}
                  height="100%"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </BasePanel>
  );
}
