/**
 * ERG-002 §2, finding #5 — "the registered libraries are not in the context
 * the loop reads". Pins `AuthoringContextBuilder.libraryOverview()` and the
 * prompt-building functions it feeds (`initialUserMessage`/`updateUserMessage`
 * in prompts/authoring.ts), run headlessly the way AIX-002's context work
 * already is — no Electron, no ProjectModel.
 */
import { AuthoringContextBuilder } from '../../src/editor/src/models/AiAssistant/authoring/ContextBuilder';
import { initialUserMessage } from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';
import type { AuthoringRequest } from '../../src/editor/src/models/AiAssistant/authoring/types';

const EMPTY_GRAPH: ExplainGraph = { components: [] };
const REQUEST: AuthoringRequest = { description: 'a page', componentPath: 'Pages/Test' };

describe('AuthoringContextBuilder.libraryOverview', () => {
  it('is undefined (and charges nothing) when no libraries are registered', () => {
    const builder = new AuthoringContextBuilder(EMPTY_GRAPH);
    expect(builder.libraryOverview()).toBeUndefined();
    expect(builder.totalChars()).toBe(0);
  });

  it('renders one line per registered library, naming its global', () => {
    const builder = new AuthoringContextBuilder(EMPTY_GRAPH, {}, undefined, undefined, {}, [
      { name: 'PocketBase', global: 'PocketBase' },
      { name: 'tinyMCE', global: 'tinymce' }
    ]);
    const overview = builder.libraryOverview();
    expect(overview).toContain('PocketBase');
    expect(overview).toContain('global `PocketBase`');
    expect(overview).toContain('global `tinymce`');
    expect(builder.totalChars()).toBeGreaterThan(0);
  });
});

describe('initialUserMessage — library block', () => {
  it('omits the REGISTERED LIBRARIES block entirely when there are none', () => {
    const opening = initialUserMessage(REQUEST, 'overview', 'catalog', undefined, undefined, undefined, undefined);
    expect(opening.content).not.toContain('REGISTERED LIBRARIES');
  });

  it('includes the library overview inside the cache-stable prefix', () => {
    const opening = initialUserMessage(
      REQUEST,
      'overview',
      'catalog',
      undefined,
      undefined,
      undefined,
      '- PocketBase — global `PocketBase`'
    );
    const stablePrefix = opening.content.slice(0, opening.cacheBoundary);
    // The block is inside the reference (stable) half, not appended after the
    // cache boundary — a library registered mid-session should still be part
    // of what a caching provider treats as the reusable prefix.
    expect(stablePrefix).toContain('REGISTERED LIBRARIES');
    expect(stablePrefix).toContain('PocketBase');
  });
});
