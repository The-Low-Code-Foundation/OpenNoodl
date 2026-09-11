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
  PROJECT_REVIEW_CHANGED,
  ProjectReviewStore,
  REVIEW_SOURCE,
  type ProjectReviewCoverage
} from '@noodl-models/AiAssistant/review';
import {
  currentProjectDocsModel,
  DOC_PROPOSALS_CHANGED,
  DOCS_CHANGED,
  DocProposalStore,
  DocsConflictError,
  KNOWN_DOCS,
  newDocTemplate,
  ProjectDocsModel,
  type DocEntry,
  type DocInjection,
  type DocProposal
} from '@noodl-models/ProjectDocs';
import { ProjectModel } from '@noodl-models/projectmodel';
import { SidebarModel } from '@noodl-models/sidebar';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { CodeDiffView, MarkdownEditor } from '@noodl-core-ui/components/code-editor';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { Markdown } from '@noodl-core-ui/components/common/Markdown';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ListItem, ListItemVariant } from '@noodl-core-ui/components/layout/ListItem';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AiAuthoringPanel_ID } from '../AiAuthoringPanel/AiAuthoringPanel';
import { useBuildPanelEnabled } from '../AiAuthoringPanel/useBuildPanelEnabled';
import { ProjectReviewBanner } from '../AiAuthoringPanel/ProjectReviewBanner';
import { ReviewCoverageSummary } from '../AiAuthoringPanel/ProjectReviewView';
import css from './DocsPanel.module.scss';
import { DOCS_PATH_EVENT, takeRequestedDocPath } from './docsPanelRoute';

/**
 * BLD-003 moved the id into `docsPanelRoute` so that module can route here
 * without importing the panel. Re-exported under the name the rest of the
 * editor already uses.
 */
export { DOCS_PANEL_ID as DocsPanel_ID } from './docsPanelRoute';

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
  // BLD-003: a route request wins over the default, and it is read in the
  // initialiser so a first mount never renders the wrong file first.
  const [selected, setSelected] = useState<string>(() => takeRequestedDocPath() ?? KNOWN_DOCS[0].path);
  const [mode, setMode] = useState<ViewMode>('rendered');
  const [content, setContent] = useState<string | undefined>(undefined);
  /** The exact bytes the buffer was loaded from — the write's drift baseline. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: FeedbackType } | null>(null);
  const [proposals, setProposals] = useState<readonly DocProposal[]>(() => DocProposalStore.instance.list());
  // Live, because the Editor settings toggle is live — see the hook.
  const buildPanelEnabled = useBuildPanelEnabled();
  // BLD-007: the new-doc form. Inline rather than a dialog — the panel is
  // already the place you make docs, and a modal to create a markdown file
  // would be heavier than the thing it creates.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPurpose, setNewPurpose] = useState('');
  const [newInject, setNewInject] = useState<DocInjection>('pull');
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

  /**
   * BLD-003 — an already-mounted panel follows the route too.
   *
   * ⚠️ Sidebar panels are hidden, not unmounted, so the initialiser above runs
   * once per editor session and every route request after the first would be
   * dropped without this. `reviewing` is cleared with it: that is the *other*
   * way this panel picks a proposal (a click in its own list), and leaving a
   * stale one set would show the diff for a file the user did not ask for.
   */
  useEffect(() => {
    const onRequested = () => {
      const path = takeRequestedDocPath();
      if (!path) return;
      setReviewing(null);
      setSelected(path);
    };
    window.addEventListener(DOCS_PATH_EVENT, onRequested);
    return () => window.removeEventListener(DOCS_PATH_EVENT, onRequested);
  }, []);

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

  // AIX-010 criterion 4: what the review read, shown *before* an accept. A
  // proposal from the project review carries a coverage record; anything else
  // (a plan's doc operation, an MCP client) does not, and shows nothing extra.
  const [reviewCoverage, setReviewCoverage] = useState<ProjectReviewCoverage | null>(() =>
    ProjectReviewStore.instance.getCoverage()
  );
  useEffect(() => {
    const store = ProjectReviewStore.instance;
    const update = () => setReviewCoverage(store.getCoverage());
    store.on(PROJECT_REVIEW_CHANGED, update, EVENT_GROUP + ':review');
    update();
    return () => {
      store.off(EVENT_GROUP + ':review');
    };
  }, []);

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

  /**
   * BLD-007 — create a doc of the user's own invention.
   *
   * The file is written with its front matter already declaring how it reaches
   * the model, because the declaration is the whole point: before this, a doc
   * created here was carried, editable and never read.
   */
  const createDoc = useCallback(async () => {
    if (!docs) return;
    const title = newName.trim();
    if (!title) return;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const path = `docs/${slug || 'untitled'}.md`;

    if (entries.some((e) => e.path === path && e.exists)) {
      setNotice({ text: `${path} already exists — open it from the list.`, type: FeedbackType.Danger });
      return;
    }

    try {
      // `baseline: null` is "I have read disk and there is nothing there", which
      // is exactly true here and still refuses to clobber a file that appeared
      // between the check above and this write.
      await docs.write(path, newDocTemplate({ title, purpose: newPurpose, inject: newInject }), { baseline: null });
      setCreating(false);
      setNewName('');
      setNewPurpose('');
      setNewInject('pull');
      setSelected(path);
      setMode('source');
      setEntries(await docs.list());
      void reload(path);
      setNotice({
        text:
          newInject === 'always'
            ? `Created ${path}. It is sent with every build in this project.`
            : `Created ${path}. The assistant will fetch it when the task looks related.`,
        type: FeedbackType.Success
      });
    } catch (error) {
      setNotice({
        text: error instanceof DocsConflictError ? error.message : String(error),
        type: FeedbackType.Danger
      });
    }
  }, [docs, entries, newInject, newName, newPurpose, reload]);

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
      {/* AIX-010: surface two of two. Same component, same dismissal, same
          per-project memory as the one in the Build panel.

          🔴 **The offer to draft them is only made when the Build panel is switched on.**
          Richard, 2026-09-06: *"instead of having a 'write project docs' button, it advises the
          user to hook up Claude Code or another coding software to write the docs if they want
          them AI generated, don't link to the Build panel (unless the user has it turned on)."*
          Build is `experimental`, so it is off by default — and the review's progress feed and
          diff render *in that panel*, which is why this hands the job over rather than running it
          here. Omitting `onStart` is what turns the banner into the advice; see its prop. */}
      <ProjectReviewBanner
        onStart={
          buildPanelEnabled
            ? () => {
                // The run and its progress feed live in the Build panel; duplicating
                // them here would be two renderings of one job. Request, then go.
                ProjectReviewStore.instance.requestReview();
                SidebarModel.instance.switch(AiAuthoringPanel_ID);
              }
            : undefined
        }
      />
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
          <ListItem
            text="New doc…"
            icon={IconName.Plus}
            variant={ListItemVariant.Default}
            onClick={() => {
              setCreating(true);
              setNotice(null);
              setReviewing(null);
            }}
          />
        </div>

        {creating && (
          <Box hasXSpacing hasYSpacing>
            <VStack UNSAFE_style={{ gap: 8 }}>
              <TextInput
                label="Name"
                value={newName}
                placeholder="UK VAT rules"
                variant={TextInputVariant.InModal}
                isAutoFocus
                onChange={(event) => setNewName(event.target.value)}
              />
              <TextInput
                label="What it is for"
                value={newPurpose}
                placeholder="How VAT applies to the prices this app shows"
                variant={TextInputVariant.InModal}
                onChange={(event) => setNewPurpose(event.target.value)}
              />
              <Select
                label="How the assistant reads it"
                value={newInject}
                options={[
                  { label: 'When it looks relevant', value: 'pull' },
                  { label: 'On every build', value: 'always' }
                ]}
                onChange={(value) => setNewInject(value as DocInjection)}
              />
              {/* Rule 5 of the phase: never withhold a cost you can state. The
                  estimate is the template's own size; the doc will grow, and
                  the row on the selected doc keeps the number honest after. */}
              <Text textType={TextType.Shy}>
                {newInject === 'always'
                  ? `Sent with every build in this project — about ${estimateTokens(
                      newDocTemplate({ title: newName || 'Untitled', purpose: newPurpose, inject: 'always' }).length
                    )} tokens per turn to start, and more as you write.`
                  : 'Fetched only on turns where it looks relevant. Nothing is added to the standing prompt.'}
              </Text>
              <HStack UNSAFE_style={{ gap: 6 }}>
                <PrimaryButton
                  label="Create"
                  size={PrimaryButtonSize.Small}
                  isDisabled={!newName.trim()}
                  isFitContent
                  onClick={() => void createDoc()}
                />
                <PrimaryButton
                  label="Cancel"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Ghost}
                  isFitContent
                  onClick={() => setCreating(false)}
                />
              </HStack>
            </VStack>
          </Box>
        )}

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
            {/* Criterion 4: the coverage is above the diff, not below it —
                how much of the project was read is what tells you how hard to
                read what follows. */}
            {proposal.source === REVIEW_SOURCE && reviewCoverage && (
              <Box hasXSpacing hasYSpacing>
                <ReviewCoverageSummary coverage={reviewCoverage} />
              </Box>
            )}
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
              <div className={css['Injection']}>
                <Text isSpan textType={TextType.Shy} className={css['InjectionPath']}>
                  {selectedEntry?.path ?? ''}
                </Text>
                <Text isSpan textType={TextType.Shy} className={css['InjectionDetail']}>
                  {injectionDetail(selectedEntry)}
                </Text>
              </div>
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

/**
 * BLD-007 — how this doc reaches the model, on the doc itself.
 *
 * D9's whole shape was a file that looked like context and was not, so the one
 * place that cannot be silent about it is the surface you are looking at when
 * you write one. An always-injected doc states its per-turn cost in tokens,
 * because that is the number the user is agreeing to and nothing else showed it.
 *
 * ⚠️ This is the *detail* only — the path is rendered beside it and the split is
 * load-bearing rather than cosmetic. It used to be one string, `${path} — ${detail}`,
 * inside the toolbar label that F20 had made shrinkable: F20 was correct, because
 * back then the label *was* a path and a long one shoved the buttons off the
 * panel at the 240px floor. BLD-007 then appended the cost to that same label
 * without moving the rule, so the ellipsis went on truncating the label it was
 * written for and started eating the number the sentence exists to show. Measured
 * live at the shipped 400px panel: 378px of text in a 290px box, rendering
 * *"docs/uk-vat.md — sent with every build, about 4…"*. The path is still the
 * expendable half and still ellipsizes; the cost now sits in its own element and
 * never shrinks.
 */
function injectionDetail(entry: DocEntry | undefined): string {
  if (!entry) return '';
  if (!entry.exists) return '— not created yet';
  if (entry.inject === 'always') {
    return `— sent with every build, about ${estimateTokens(entry.chars)} tokens per turn`;
  }
  return '— fetched when relevant';
}

/** Characters → tokens, the usual ~4:1, rounded so it reads as an estimate. */
function estimateTokens(chars: number): number {
  const tokens = Math.round(chars / 4);
  return tokens < 100 ? Math.max(50, Math.round(tokens / 10) * 10) : Math.round(tokens / 50) * 50;
}
