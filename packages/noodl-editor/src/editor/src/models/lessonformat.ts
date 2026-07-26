/**
 * LEARN-001 Slice 2 — the new declarative lesson-content format and its compiler.
 *
 * WHY THIS EXISTS
 * ---------------
 * The legacy authored format is a single `lesson.html` document, split into
 * steps on `<!-- # -->` comments, with completion logic hand-written as a JSON
 * blob inside a `data-conditions` HTML attribute and node addressing in a
 * path grammar. Authoring a lesson meant writing HTML *and* JSON-in-an-attribute
 * *and* knowing the node-path grammar — unfit for the non-programmer curriculum
 * authors LEARN-002 assumes, and (per the task brief) changing the format after
 * LEARN-002 authors against it means rewriting every lesson. So the format is
 * the phase's highest-leverage deliverable.
 *
 * THE NEW FORMAT (`lesson.json`)
 * ------------------------------
 * A lesson is a JSON document: a title and an ordered list of step objects.
 * Prose is Markdown (separated from logic); completion conditions are declared
 * as first-class, human-readable fields (`completeWhen`) rather than a JSON
 * string smuggled through an HTML attribute. See LESSON-FORMAT.md for the
 * authoring guide.
 *
 * COMPILE STRATEGY
 * ----------------
 * `compileLessonManifest` lowers a manifest into the SAME per-step HTML-string
 * representation the legacy reader produces (`<div data-conditions=...>` wrapping
 * `data-template="item"`/`"popup"` divs). That means the entire working runtime —
 * step DOM construction (lessonlayer2 `loadSteps`), the React views, media
 * loading, and the completion evaluator — is reused unchanged; only
 * `LessonModel.fetch()` needs to detect the format and pick a reader. The
 * HTML-string shape is now an internal runtime representation; authors never see
 * it. The legacy `lesson.html` reader stays as the compatibility path so the 8
 * hosted lessons keep running.
 */

import type { LessonCondition } from '../views/lessons/lessonevalconditions';

// ─── Authoring types (what a lesson author writes) ──────────────────────────

export type LessonMediaDef =
  | { type: 'video'; src: string; loop?: boolean }
  | { type: 'image'; src: string };

/**
 * A completion condition in the author-facing form. Exactly one "verb" per
 * object. These map 1:1 onto the internal {@link LessonCondition} vocabulary.
 */
export type LessonConditionDef =
  | { node: string; hasType: string }
  | { node: string; hasLabel: string }
  | { node: string; hasPort: string }
  | { node: string; exists: boolean }
  | { node: string; isVisualRoot: boolean }
  | { node: string; hasParams: string[] }
  | { node: string; paramsEqual: Record<string, unknown> }
  | { connection: { from: string; to: string; fromPort: string; toPort: string } }
  | { metadata: string; equals: unknown }
  | { previewRouteEquals: string }
  | { activeComponentEquals: string };

/** An editor side-effect performed when a step becomes active. */
export type LessonActionDef =
  | { selectNode: string }
  | { navigatePreview: string }
  | { selectComponent: string };

export interface LessonStepDef {
  /** Short imperative shown on the timeline card, e.g. "Create a Group". */
  title?: string;
  /** Fuller instructions shown in the popup when the step is active (Markdown). */
  body?: string;
  media?: LessonMediaDef;
  /**
   * 'card' (default) puts a card on the timeline; 'popup' is a modal-only step
   * with no card, for intros/outros.
   */
  kind?: 'card' | 'popup';
  /** All conditions must hold for the step to complete. Omit for a manual Next step. */
  completeWhen?: LessonConditionDef[];
  actions?: LessonActionDef[];
  /** Node types to surface in the node picker while this step is active. */
  suggestedNodes?: string[];
  /** Toolbar icons to disable while this step is active. */
  disableIcons?: string[];
  /** Optional fixed width for the timeline card, e.g. "320px". */
  width?: string;
}

export interface LessonManifest {
  /** Format tag, e.g. "noodl-lesson@1". Optional but recommended. */
  format?: string;
  title?: string;
  description?: string;
  /** Optional badge shown on completion. */
  completionBadge?: string;
  steps: LessonStepDef[];
}

// ─── Compiled output ────────────────────────────────────────────────────────

export interface CompiledLesson {
  title?: string;
  description?: string;
  completionBadge?: string;
  /** Per-step HTML strings in the legacy internal shape. */
  steps: string[];
}

// ─── Format detection ───────────────────────────────────────────────────────

/** True if `url` names a new-format manifest (by extension). */
export function isManifestUrl(url: string): boolean {
  return /\.json(\?|#|$)/i.test(url);
}

/**
 * Best-effort content sniff for when the URL is ambiguous: a manifest is a JSON
 * object with a `steps` array. Legacy content is HTML and fails JSON.parse.
 */
export function looksLikeManifest(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed[0] !== '{') return false;
  try {
    const parsed = JSON.parse(text);
    return !!parsed && typeof parsed === 'object' && Array.isArray(parsed.steps);
  } catch {
    return false;
  }
}

// ─── Condition compilation (friendly → internal vocabulary) ─────────────────

class LessonFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonFormatError';
  }
}

function compileCondition(def: LessonConditionDef, where: string): LessonCondition {
  const d = def as Record<string, unknown>;

  if ('hasType' in d) return { path: str(d.node, where, 'node'), hastype: str(d.hasType, where, 'hasType') };
  if ('hasLabel' in d) return { path: str(d.node, where, 'node'), haslabel: str(d.hasLabel, where, 'hasLabel') };
  if ('hasPort' in d) return { path: str(d.node, where, 'node'), hasport: str(d.hasPort, where, 'hasPort') };
  if ('exists' in d) return { path: str(d.node, where, 'node'), exists: bool(d.exists, where, 'exists') };
  if ('isVisualRoot' in d)
    return { path: str(d.node, where, 'node'), isvisualroot: bool(d.isVisualRoot, where, 'isVisualRoot') };
  if ('hasParams' in d) {
    if (!Array.isArray(d.hasParams)) throw new LessonFormatError(`${where}: "hasParams" must be an array of names.`);
    return { path: str(d.node, where, 'node'), hasparams: d.hasParams.join(',') };
  }
  if ('paramsEqual' in d) {
    if (!isObject(d.paramsEqual)) throw new LessonFormatError(`${where}: "paramsEqual" must be an object.`);
    return { path: str(d.node, where, 'node'), paramseq: d.paramsEqual as Record<string, unknown> };
  }
  if ('connection' in d) {
    const c = d.connection as Record<string, unknown>;
    if (!isObject(c)) throw new LessonFormatError(`${where}: "connection" must be an object.`);
    return {
      from: str(c.from, where, 'connection.from'),
      to: str(c.to, where, 'connection.to'),
      hasconnection: `${str(c.fromPort, where, 'connection.fromPort')},${str(c.toPort, where, 'connection.toPort')}`
    };
  }
  if ('metadata' in d) return { metadata: str(d.metadata, where, 'metadata'), equals: d.equals };
  if ('previewRouteEquals' in d) return { viewerpatheq: str(d.previewRouteEquals, where, 'previewRouteEquals') };
  if ('activeComponentEquals' in d)
    return { activecomponentnameeq: str(d.activeComponentEquals, where, 'activeComponentEquals') };

  throw new LessonFormatError(
    `${where}: unrecognised condition ${JSON.stringify(def)}. ` +
      `Expected one of: hasType, hasLabel, hasPort, exists, isVisualRoot, hasParams, ` +
      `paramsEqual, connection, metadata, previewRouteEquals, activeComponentEquals.`
  );
}

export function compileConditions(defs: LessonConditionDef[] | undefined, where: string): LessonCondition[] {
  if (!defs) return [];
  if (!Array.isArray(defs)) throw new LessonFormatError(`${where}: "completeWhen" must be an array of conditions.`);
  return defs.map((def, i) => compileCondition(def, `${where} condition ${i + 1}`));
}

interface CompiledAction {
  action: 'selectNode' | 'navigatePreview' | 'selectComponent';
  nodeId?: string;
  url?: string;
  componentName?: string;
}

function compileAction(def: LessonActionDef, where: string): CompiledAction {
  const d = def as Record<string, unknown>;
  if ('selectNode' in d) return { action: 'selectNode', nodeId: str(d.selectNode, where, 'selectNode') };
  if ('navigatePreview' in d) return { action: 'navigatePreview', url: str(d.navigatePreview, where, 'navigatePreview') };
  if ('selectComponent' in d)
    return { action: 'selectComponent', componentName: str(d.selectComponent, where, 'selectComponent') };
  throw new LessonFormatError(
    `${where}: unrecognised action ${JSON.stringify(def)}. Expected selectNode, navigatePreview, or selectComponent.`
  );
}

// ─── Markdown (minimal, safe subset) ────────────────────────────────────────
// Lesson prose is author-controlled, not untrusted input, but we still escape
// HTML first so a stray `<` never breaks the step structure, then apply a small
// Markdown subset sufficient for instructions.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?:\*|_)([^*_]+)(?:\*|_)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${escapeAttr(href)}">${label}</a>`);
}

/** Render a Markdown-subset string to an HTML fragment (headings, lists, paragraphs, inline). */
export function renderMarkdown(md: string | undefined): string {
  if (!md) return '';
  const blocks = md.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const heading = /^(#{1,4})\s+(.*)$/.exec(lines[0]);
    if (lines.length === 1 && heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inlineMarkdown(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
      html.push(`<ul>${items}</ul>`);
      continue;
    }
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inlineMarkdown(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('');
      html.push(`<ol>${items}</ol>`);
      continue;
    }
    html.push(`<p>${lines.map(inlineMarkdown).join('<br>')}</p>`);
  }

  return html.join('\n');
}

// ─── HTML emission ──────────────────────────────────────────────────────────

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMedia(media: LessonMediaDef | undefined): string {
  if (!media) return '';
  if (media.type === 'video') return `<video src="${escapeAttr(media.src)}"></video>`;
  // Legacy markup uses <image>, which loadSteps' _loadImages selects via 'img'.
  return `<img src="${escapeAttr(media.src)}">`;
}

/**
 * UIX-011: the task checkmark used to be four `content: url(...)` SVGs swapped
 * by CSS state — one per colour, including a filled one baked in the pre-azure
 * Noodl yellow `#FCCC73`. An SVG loaded through `url()` renders as its own
 * document and cannot inherit the theme, so none of them could follow UIX-008.
 *
 * This is the editor's one *imperative* icon site: the card is built as an HTML
 * string, so a React `<Icon>` is not available. Inlining the glyph markup gets
 * the same result — `currentColor` resolves against the host element, so
 * `LessonLayerView.css` drives both shape (which of the two is displayed) and
 * colour (tokens) from the item's state. Four assets collapse to two glyphs,
 * because two of the four differed from each other only in baked colour.
 *
 * Kept in sync by shape with core-ui's `check_circle` / `check_circle_fill`.
 */
const LESSON_CHECKMARK_HTML =
  '<span class="lesson-checkmark">' +
  '<svg class="lesson-checkmark-incomplete" width="16" height="16" viewBox="0 0 16 16" fill="none" ' +
  'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="8" cy="8" r="6.5"/><path d="M5.2 8.2 7.1 10.1 10.8 6.2"/></svg>' +
  '<svg class="lesson-checkmark-complete" width="16" height="16" viewBox="0 0 16 16" fill="none">' +
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 0.75A7.25 7.25 0 1 0 8 15.25 7.25 7.25 0 0 0 8 0.75Zm3.33 ' +
  '5.94a.75.75 0 0 0-1.13-.99L7.06 9.29 5.79 7.99a.75.75 0 1 0-1.08 1.04l1.84 1.9a.75.75 0 0 0 1.1-.02l3.68-4.22Z" ' +
  'fill="currentColor"/></svg>' +
  '</span>';

/** Compile one authored step into a legacy-shaped HTML string. */
export function compileStep(step: LessonStepDef, index: number): string {
  const where = `Step ${index + 1}${step && step.title ? ` ("${step.title}")` : ''}`;
  if (typeof step !== 'object' || step === null || Array.isArray(step))
    throw new LessonFormatError(`${where}: each step must be an object.`);

  const conditions = compileConditions(step.completeWhen, where);
  const actions = (step.actions ?? []).map((a, i) => compileAction(a, `${where} action ${i + 1}`));
  const kind = step.kind ?? 'card';

  const bodyHtml = renderMarkdown(step.body);
  const mediaHtml = renderMedia(step.media);

  // A modal-only step is just a popup with no timeline card.
  if (kind === 'popup') {
    return `<div data-template="popup">${mediaHtml}${bodyHtml}</div>`;
  }

  // Card step: a wrapper carrying data-* metadata, an item card, and a popup.
  const wrapperAttrs: string[] = [];
  if (conditions.length) wrapperAttrs.push(`data-conditions="${escapeAttr(JSON.stringify(conditions))}"`);
  if (actions.length) wrapperAttrs.push(`data-actions="${escapeAttr(JSON.stringify(actions))}"`);
  if (step.suggestedNodes?.length)
    wrapperAttrs.push(`data-suggested-nodes="${escapeAttr(step.suggestedNodes.join(','))}"`);
  if (step.disableIcons?.length) wrapperAttrs.push(`data-disable-icons="${escapeAttr(step.disableIcons.join(','))}"`);

  // The card header carries the checkmark span for conditioned (task) steps.
  const header = conditions.length ? `Task${LESSON_CHECKMARK_HTML}` : '&nbsp;';
  const itemStyle = step.width ? ` style="width: ${escapeAttr(step.width)}"` : '';
  const titleHtml = step.title ? inlineMarkdown(step.title) : '';

  const item = `<div data-template="item"${itemStyle}><header>${header}</header><h3>${titleHtml}</h3></div>`;
  const popup = mediaHtml || bodyHtml ? `<div data-template="popup">${mediaHtml}${bodyHtml}</div>` : '';

  return `<div${wrapperAttrs.length ? ' ' + wrapperAttrs.join(' ') : ''}>${item}${popup}</div>`;
}

// ─── Top-level compile ──────────────────────────────────────────────────────

/** Compile a parsed manifest into the internal per-step representation. */
export function compileLessonManifest(manifest: LessonManifest): CompiledLesson {
  if (!isObject(manifest)) throw new LessonFormatError('Lesson manifest must be a JSON object.');
  if (!Array.isArray(manifest.steps)) throw new LessonFormatError('Lesson manifest is missing a "steps" array.');
  if (manifest.steps.length === 0) throw new LessonFormatError('Lesson manifest has no steps.');

  return {
    title: manifest.title,
    description: manifest.description,
    completionBadge: manifest.completionBadge,
    steps: manifest.steps.map((step, i) => compileStep(step, i))
  };
}

/** Parse a manifest string (JSON) and compile it, with author-friendly errors. */
export function compileLessonSource(source: string): CompiledLesson {
  let manifest: LessonManifest;
  try {
    manifest = JSON.parse(source);
  } catch (e) {
    throw new LessonFormatError(`Lesson file is not valid JSON: ${(e as Error).message}`);
  }
  return compileLessonManifest(manifest);
}

// ─── tiny validators ────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, where: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new LessonFormatError(`${where}: "${field}" must be a non-empty string.`);
  return value;
}

function bool(value: unknown, where: string, field: string): boolean {
  if (typeof value !== 'boolean') throw new LessonFormatError(`${where}: "${field}" must be true or false.`);
  return value;
}

export { LessonFormatError };
