import Model from '../../../shared/model';
import { tracker } from '../utils/tracker';
import { compileLessonSource, isManifestUrl, looksLikeManifest } from './lessonformat';

/**
 * Instruction/content model for a single lesson.
 *
 * LEARN-001: converted from `lessonmodel.js` to typed TypeScript (assessment
 * verdict "repair — type it; keep behaviour") and taught to read the new
 * declarative `lesson.json` format. `fetch()` detects the format and either
 * compiles a manifest (new) or splits the hand-authored HTML on `<!-- # -->`
 * (legacy compatibility path). Both paths produce the same internal per-step
 * HTML representation the runtime already consumes, so nothing downstream —
 * step DOM construction, the React views, the completion evaluator — changes.
 */

export interface LessonModelArgs {
  index: number;
  url: string;
  name?: string;
  header?: string;
  title?: string;
  completionBadge?: string;
  numberOfLessons?: number;
  baseURL?: string;
}

export interface LessonModelJSON {
  index: number;
  numberOfLessons?: number;
  url: string;
  name?: string;
  header?: string;
  title?: string;
  baseURL?: string;
  completionBadge?: string;
}

type LessonAnnotations = Record<string, string>;

export default class LessonModel extends Model {
  index: number;
  url: string;
  name?: string;
  header?: string;
  title?: string;
  completionBadge?: string;
  numberOfLessons?: number;
  baseURL?: string;
  absoluteURL: string;

  /** Per-step HTML strings (legacy shape, produced by both readers). */
  lessons?: string[];
  /** Per-step `data-*` annotations, extracted from the step HTML. */
  annotations?: LessonAnnotations[];

  constructor(args: LessonModelArgs) {
    super();

    this.index = args.index;
    this.url = args.url;
    this.name = args.name;
    this.header = args.header;
    this.title = args.title;
    this.completionBadge = args.completionBadge;

    this.numberOfLessons = args.numberOfLessons;
    this.baseURL = args.baseURL;
    this.absoluteURL = this.url.startsWith('http') ? this.url : (this.baseURL ?? '') + this.url;
  }

  private extractAnnotations(): void {
    this.annotations = [];
    if (!this.lessons) return;

    for (const step of this.lessons) {
      const annotations = step.match(/data-[^=]+="[^"]+"/g);
      const parsed: LessonAnnotations = {};
      if (annotations) {
        for (const a of annotations) {
          const name = a.substring(0, a.indexOf('='));
          const value = a.substring(a.indexOf('=') + 2, a.length - 1);
          parsed[name] = value;
        }
      }
      this.annotations.push(parsed);
    }
  }

  /**
   * Split a legacy `lesson.html` document into per-step HTML strings, mirroring
   * the historical `<!-- # -->` convention.
   */
  private loadLegacyHtml(html: string): string[] {
    return html
      .split('<!-- # -->')
      .map((step) => step.trim())
      .filter((step) => step.length > 0);
  }

  fetch(callback?: () => void): void {
    const url = this.url.startsWith('http') ? this.url : (this.baseURL ?? '') + this.url;

    // cache: 'no-store' matches jQuery's `cache: false` (which appended a cache buster)
    window
      .fetch(url, { cache: 'no-store', headers: { Accept: 'text/html, application/json' } })
      .then((response) => (response.ok ? response.text() : undefined))
      .catch(() => undefined)
      .then((text) => {
        if (text === undefined) {
          this.lessons = undefined;
        } else if (isManifestUrl(this.url) || looksLikeManifest(text)) {
          // New declarative format.
          const compiled = compileLessonSource(text);
          this.lessons = compiled.steps;
          if (compiled.title && !this.title) this.title = compiled.title;
          if (compiled.completionBadge && !this.completionBadge) this.completionBadge = compiled.completionBadge;
          this.numberOfLessons = this.lessons.length;
          this.extractAnnotations();
        } else {
          // Legacy hand-authored HTML.
          this.lessons = this.loadLegacyHtml(text);
          this.numberOfLessons = this.lessons.length;
          this.extractAnnotations();
        }
        callback && callback();
      });
  }

  start(): void {
    this.fetch(() => {
      if (this.lessons) {
        if (this.index === 0) {
          // Track the the lesson is started
          tracker.track('Lesson started', {
            url: this.absoluteURL,
            name: this.name
          });
        }

        this.notifyListeners('instructionsFetched');
      }
    });
  }

  reportChanged(): void {
    if (this.lessons && this.index >= this.lessons.length - 1) {
      tracker.track('Lesson completed', {
        // Track that lesson is completed
        url: this.absoluteURL,
        name: this.name
      });
    } else if (this.index > 0) {
      tracker.track('Lesson next', {
        // Track that user moves to next lesson
        index: this.index,
        url: this.absoluteURL,
        name: this.name
      });
      tracker.increment('TotalLessonPartsCompleted', 1);
    }

    this.notifyListeners('instructionsChanged');
  }

  next(): void {
    if (this.numberOfLessons === undefined || this.index >= this.numberOfLessons - 1) {
      return;
    }

    this.index++;
    this.reportChanged();
  }

  getInstructions(step?: number): string | undefined {
    if (!this.lessons) return undefined;
    if (step === undefined) step = 0;

    return this.lessons[step];
  }

  getAnnotations(step?: number): LessonAnnotations | undefined {
    if (!this.annotations) return undefined;
    if (step === undefined) step = 0;

    return this.annotations[step];
  }

  getCurrentSuggestedNodes(): string[] | undefined {
    if (!this.annotations) return undefined;

    for (let i = this.index; i >= 0; i--) {
      const nodes = this.annotations[i]['data-suggested-nodes'];
      if (nodes) return nodes.split(',');
    }
    return undefined;
  }

  getCurrentIconsDisabled(): string[] {
    let disabledIcons: string[] = [];

    if (this.annotations) {
      for (let i = this.index; i >= 0; i--) {
        const icons = this.annotations[i]['data-disable-icons'];
        if (icons) {
          disabledIcons = icons.split(',');
          break;
        }
      }
    }

    return disabledIcons.concat(['deploy', 'cloudServices']); //always disable deploy and cloudServices
  }

  getLength(): number {
    if (!this.lessons) return 0;
    return this.lessons.length;
  }

  getProgress(): number {
    if (!this.numberOfLessons || !this.index) return 0;

    return Math.min(Math.round((this.index / this.numberOfLessons) * 100), 100);
  }

  toJSON(): LessonModelJSON {
    return {
      index: this.index,
      numberOfLessons: this.numberOfLessons,
      url: this.url,
      name: this.name,
      header: this.header,
      title: this.title,
      baseURL: this.baseURL,
      completionBadge: this.completionBadge
    };
  }

  static fromJSON(json: LessonModelJSON): LessonModel {
    return new LessonModel(json);
  }
}
