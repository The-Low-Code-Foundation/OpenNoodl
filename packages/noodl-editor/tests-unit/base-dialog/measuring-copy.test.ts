/**
 * `BaseDialog` renders every dialog twice, and only one of the two copies is for the user.
 *
 * Filed as the SECOND FINDING of `NOTES-saveblock.md` and fixed here. `.MeasuringContainer` is
 * `pointer-events: none; height: 0; opacity: 0` — hidden from the mouse and from the eye, and
 * **not** from the keyboard. Every focusable element in every dialog in the editor was therefore
 * in the tab order twice, invisible copy first: Tab into a dialog and focus went somewhere
 * nothing could be seen, and the next Tab appeared to do nothing.
 *
 * ## What this file can measure, and what it deliberately does not try to
 *
 * There is no DOM in this runner and no React in it either, so this is **not** a rendered tab
 * order. What it holds is the property the rendered tab order is a consequence of: *how many
 * times does one focusable child of a dialog end up in sequential focus navigation?* That is
 * decided entirely by the component's own JSX — how many times `{children}` is rendered, and
 * which of those sites sit inside an `inert` subtree — and it is decided in the source, where a
 * spec can read it.
 *
 * The step from "one non-inert render site" to "one tab stop" is `inert`'s specification and is
 * the browser's job, not this file's. What this file rules out is the thing that was actually
 * wrong: **two** render sites, neither inert.
 *
 * 🔴 Every assertion here is of the form "this count is 1" or "this attribute is present", and a
 * parser pointed at the wrong region satisfies all of them by finding nothing. So the same
 * analyser is run over the component **with the fix taken back out**, derived from the real
 * current source rather than pasted, and is required to convict it — see the NEGATIVE CONTROLs.
 * They are the reason to believe the rest, and they print `2` today.
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE_DIALOG_TSX = path.join(
  __dirname,
  '../../../noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.tsx'
);

/**
 * The source with every comment removed.
 *
 * 🔴 Not tidiness — correctness. The subject of this file is the token `inert`, and the
 * component now carries a twenty-line comment explaining why it is there, which mentions
 * `inert` and `MeasuringContainer` repeatedly. A parser that read comments would find the
 * attribute in the sentence describing the attribute and would keep passing after someone
 * deleted it. The repo has a register entry for exactly this shape: *a spec can contain the
 * sentence it forbids.*
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** One open JSX element on the stack: its tag name and its raw attribute text. */
interface OpenTag {
  name: string;
  attributes: string;
}

/**
 * Every place the component renders `{children}`, with the chain of elements it sits inside.
 *
 * A hand-rolled scanner rather than a real JSX parser, for the reason `MyBlocksSaveDialog`'s
 * specs give: this runner has no build step and the region being read is the one block of pure
 * JSX at the end of the file. It skips balanced `{…}` expression containers and quoted strings
 * so that an arrow function in an attribute cannot be mistaken for markup.
 */
function childRenderSites(source: string): OpenTag[][] {
  const start = source.lastIndexOf('return (');
  if (start === -1) return [];
  const jsx = source.slice(start);

  const sites: OpenTag[][] = [];
  const stack: OpenTag[] = [];

  let i = 0;
  while (i < jsx.length) {
    const character = jsx[i];

    if (character === '{') {
      const end = matchBrace(jsx, i);
      if (end === -1) break;
      if (jsx.slice(i + 1, end).trim() === 'children') {
        sites.push(stack.slice());
        i = end + 1;
        continue;
      }
      /**
       * ⚠️ Descend rather than skip, and this is the whole reason the scanner is not three
       * lines shorter. **Two of the three `{children}` are nested inside an expression
       * container** — the `variant === Select ? … : …` conditional — so a scanner that jumped
       * over every brace it did not recognise would find exactly one site, conclude the
       * children are rendered once, and pass. It did, on the first run.
       *
       * Descending is safe because an *attribute* expression never reaches this loop:
       * `endOfOpenTag` consumes the whole opening tag, braces and all. Every `{` seen here is
       * a JSX child.
       */
      i++;
      continue;
    }

    if (character === '<') {
      if (jsx[i + 1] === '/') {
        stack.pop();
        i = jsx.indexOf('>', i) + 1;
        continue;
      }

      const nameMatch = /^<([A-Za-z][\w.]*)/.exec(jsx.slice(i));
      if (!nameMatch) {
        i++;
        continue;
      }

      const tagEnd = endOfOpenTag(jsx, i);
      if (tagEnd === -1) break;

      const selfClosing = jsx[tagEnd - 1] === '/';
      if (!selfClosing) {
        stack.push({
          name: nameMatch[1],
          attributes: jsx.slice(i + nameMatch[0].length, selfClosing ? tagEnd - 1 : tagEnd)
        });
      }
      i = tagEnd + 1;
      continue;
    }

    i++;
  }

  return sites;
}

/** The index of the `}` closing the `{` at `from`, skipping nested braces and strings. */
function matchBrace(source: string, from: number): number {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const character = source[i];
    if (character === '"' || character === "'" || character === '`') {
      i = endOfString(source, i);
      if (i === -1) return -1;
      continue;
    }
    if (character === '{') depth++;
    else if (character === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The index of the `>` closing the tag opening at `from`, skipping attribute expressions. */
function endOfOpenTag(source: string, from: number): number {
  for (let i = from + 1; i < source.length; i++) {
    const character = source[i];
    if (character === '{') {
      const end = matchBrace(source, i);
      if (end === -1) return -1;
      i = end;
      continue;
    }
    if (character === '"' || character === "'") {
      i = endOfString(source, i);
      if (i === -1) return -1;
      continue;
    }
    if (character === '>') return i;
  }
  return -1;
}

/** The index of the quote closing the one at `from`. */
function endOfString(source: string, from: number): number {
  const quote = source[from];
  for (let i = from + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++;
      continue;
    }
    if (source[i] === quote) return i;
  }
  return -1;
}

/** Is this element the zero-height copy the component measures with? */
function isMeasuringContainer(tag: OpenTag): boolean {
  return tag.attributes.includes('MeasuringContainer');
}

/**
 * Does this element mark its subtree as not-for-the-user?
 *
 * `inert` is a boolean attribute, so JSX spells it bare (`<div inert>`). Matched on a word
 * boundary so that a future `data-inert-reason` would not satisfy it.
 */
function isInert(tag: OpenTag): boolean {
  return /(^|\s)inert(\s|=|$)/.test(tag.attributes);
}

/**
 * How many times one focusable child of a dialog appears in sequential focus navigation.
 *
 * `{children}` is rendered at **three** sites, and that is not three tab stops: the two inside
 * the visible dialog are the two arms of the `variant === Select` conditional, so exactly one of
 * them is live for any given dialog. The measuring copy is unconditional and is rendered as well
 * as whichever arm applies. So:
 *
 *     tab stops = 1 (whichever visible arm rendered) + (the measuring copy, unless it is inert)
 *
 * which is **2** as the component stood, and **1** now.
 */
function tabStopsForAFocusableChild(source: string): number {
  const sites = childRenderSites(source);
  const measuring = sites.filter((stack) => stack.some(isMeasuringContainer));
  const visible = sites.filter((stack) => !stack.some(isMeasuringContainer));

  const measuringStops = measuring.filter((stack) => !stack.some(isInert)).length;
  // The visible arms are mutually exclusive, so they contribute one between them — but only if
  // they are actually reachable, which is what makes an `inert` accidentally landing on the
  // wrong container fail this rather than pass it.
  const visibleStops = visible.some((stack) => !stack.some(isInert)) ? 1 : 0;

  return measuringStops + visibleStops;
}

const source = withoutComments(fs.readFileSync(BASE_DIALOG_TSX, 'utf8'));

/** The fix taken back out of the real current source — the component exactly as it was. */
const sourceBeforeTheFix = source.replace(/(<div className=\{css\['MeasuringContainer'\]\}) inert>/, '$1>');

describe('BaseDialog — the measuring copy is not in the tab order', () => {
  it('still renders {children} three times: the measuring copy and one arm per variant', () => {
    // The premise of everything below. If this ever becomes 2, the double render was removed
    // outright and the `inert` attribute is dead weight that should go with it.
    const sites = childRenderSites(source);
    expect(sites).toHaveLength(3);

    expect(sites.filter((stack) => stack.some(isMeasuringContainer))).toHaveLength(1);
    expect(sites.filter((stack) => !stack.some(isMeasuringContainer))).toHaveLength(2);
  });

  it('🔴 a focusable child of a dialog has exactly one tab stop', () => {
    expect(tabStopsForAFocusableChild(source)).toBe(1);
  });

  it('🔴 NEGATIVE CONTROL — the same analyser finds two, with the attribute taken back out', () => {
    // The whole reason to believe the assertion above. This is the real component source with
    // one attribute removed, run through the same functions: the invisible copy comes back into
    // the tab order and the count goes to 2, which is the defect as reported.
    expect(sourceBeforeTheFix).not.toBe(source);
    expect(tabStopsForAFocusableChild(sourceBeforeTheFix)).toBe(2);
  });

  it('NEGATIVE CONTROL — the analyser is not passing by finding nothing', () => {
    // Every count above would also be satisfied by a scanner that returned an empty stack for
    // every site. Require it to have actually walked into the containers it is reasoning about.
    const sites = childRenderSites(source);
    for (const stack of sites) {
      expect(stack.length).toBeGreaterThan(0);
      expect(stack.map((tag) => tag.name)).toContain('div');
    }

    // And require `isInert` to be able to say no: the visible copies must not be inert, or the
    // fix has been applied to the wrong container and the dialog is unusable.
    const visible = sites.filter((stack) => !stack.some(isMeasuringContainer));
    expect(visible.every((stack) => !stack.some(isInert))).toBe(true);
  });
});

describe('BaseDialog — what `inert` must not have broken', () => {
  /**
   * ⚠️ The one property this container exists for.
   *
   * `inert` removes a subtree from focus, hit-testing, text selection, find-in-page and the
   * accessibility tree. It does **not** affect layout, so `getBoundingClientRect` reads exactly
   * what it read before — which is the whole of what this component does with the measuring
   * copy. This test is the guard on that sentence staying true: if a later edit reaches into
   * the measured element through an API `inert` *does* suppress, it goes red here rather than
   * silently doing nothing in the app.
   */
  it('🔴 the measured element is read for geometry and nothing else', () => {
    const uses = Array.from(source.matchAll(/dialogRef[?]?\.current[?]?\.(\w+)/g)).map((match) => match[1]);

    expect(uses.length).toBeGreaterThan(0);
    expect(Array.from(new Set(uses)).sort()).toEqual(['getBoundingClientRect']);
  });

  it('the ref that is measured is the one inside the inert container', () => {
    // A measurement of the *visible* copy would be a different component with a different bug;
    // this pins which copy `dialogRef` is on, so the test above is about the right element.
    const measuring = source.slice(source.indexOf("css['MeasuringContainer']"));
    const nextChildren = measuring.indexOf('{children}');
    const refHere = measuring.indexOf('ref={dialogRef}');

    expect(refHere).toBeGreaterThan(-1);
    expect(refHere).toBeLessThan(nextChildren);
  });

  it('⚠️ does not also carry aria-hidden, which would be the worse half of the same fix', () => {
    // `aria-hidden` on a focusable subtree is itself an accessibility defect — it hides the
    // element from the screen reader and leaves it reachable by Tab, which is the state a
    // reader cannot recover from. `inert` already removes the subtree from the accessibility
    // tree, so the pair is both redundant and wrong.
    const measuringTag = /<div className=\{css\['MeasuringContainer'\]\}[^>]*>/.exec(source);
    expect(measuringTag).not.toBeNull();
    expect(measuringTag![0]).not.toContain('aria-hidden');
  });
});
