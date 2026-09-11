import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * FB-005 T4 recorded a finding and handed it on as *"a design-token decision, Richard's — changing
 * the token touches every surface in the editor"*. The finding was real; that framing of the FIX
 * was the wrong one, and this file is the measurement that says so.
 *
 * 🔴 `--theme-color-border-default` IS SUPPOSED TO BE INVISIBLE. `colors.css` says so twice: it is
 * a DIVIDER tone, deliberately 1.01–1.73:1, and NAT-003 already records the day the ramp moved
 * without it and a hairline became a visible line — *"the opposite of what it is for"*. Raising it
 * to clear 3:1 would restage that regression across all 376 declarations, and VFN-002's c3 negative
 * control (which asserts `border-default` is INVISIBLE on bg-3) would go red by construction.
 *
 * ✅ THE TOKEN THAT WAS ALREADY RIGHT IS `--theme-color-border-control`. POL-016 defined it for
 * exactly this — *"without a ring at THIS weight it reads as a label, not a button"* — and it
 * clears 3:1 on bg-0/1/2/3 in both themes. So the defect was never 376 declarations; it was the
 * ~60 that are CONTROL boundaries wearing a divider's token. This file fixes T4's three and pins
 * them.
 *
 * 🔴 THIS SPEC READS THE STYLESHEET, NOT THE PALETTE. Asserting `border-control` clears 3:1 would
 * pass on a build where `TemplateStep` never names it — the ratio is a property of the token, and
 * the claim here is about the CARD. Each row resolves the selector's own `border` token and its own
 * `background-color` out of the .scss and measures those, so reverting line 76 goes red at a
 * NUMBER rather than at a string match.
 */

const SCSS = path.resolve(
  __dirname,
  '../../../noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/TemplateStep.module.scss'
);

/** The ground the wizard's body paints, which is what the card's edge is seen against. */
const PANEL = '--theme-color-bg-2';

function block(selector: string): string {
  const source = fs.readFileSync(SCSS, 'utf8');
  // Non-greedy to the first closing brace at column 0 — these are all top-level blocks.
  const match = source.match(new RegExp(`^\\${selector} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`no such selector in TemplateStep.module.scss: ${selector}`);
  return match[1];
}

/** The token a declaration names, e.g. `border: 2px solid var(--x)` -> `--x`. */
function tokenOf(body: string, property: 'border' | 'background-color'): string {
  const match = body.match(new RegExp(`^\\s*${property}:[^;]*var\\((--[a-z0-9-]+)\\)`, 'm'));
  if (!match) throw new Error(`${property} in this block does not name a token`);
  return match[1];
}

/**
 * The three CONTROLS on the shelf. `.TemplateCard` is a `<button aria-pressed>`, `-pill` is a
 * toggle and `-search` is a text input — WCAG 1.4.11 asks 3:1 of every one of their boundaries.
 *
 * ⚠️ DELIBERATELY ABSENT: `.TemplateStep-notice` (a static region) and `.TemplateCard-tag` (a
 * non-interactive chip). Both still wear `border-default` and both should — they are dividers,
 * and the negative control at the bottom of this file is what stops a later reader "finishing the
 * job" by sweeping them too.
 */
const CONTROLS = ['.TemplateCard', '.TemplateFilter-pill', '.TemplateFilter-search'] as const;

describe.each(['dark', 'light'] as ThemeName[])('FB-005 T4: the shelf in %s', (theme) => {
  describe.each(CONTROLS)('%s', (selector) => {
    it("its boundary clears 3:1 against its own fill", () => {
      const body = block(selector);
      const ratio = tokenContrast(theme, tokenOf(body, 'border'), tokenOf(body, 'background-color'));
      const verdict =
        ratio >= 3
          ? 'passes'
          : `${selector}'s border is ${ratio.toFixed(2)}:1 on its own fill in ${theme} — a control ` +
            `boundary under 1.4.11's 3:1, so the control has no perceivable edge`;
      expect(verdict).toBe('passes');
    });

    it('its boundary clears 3:1 against the wizard panel behind it', () => {
      // 🔴 The edge has TWO sides and only one of them is the control's own fill. A border that
      // cleared its fill and vanished into the panel would still leave the card without an outline.
      const ratio = tokenContrast(theme, tokenOf(block(selector), 'border'), PANEL);
      const verdict =
        ratio >= 3 ? 'passes' : `${selector}'s border is ${ratio.toFixed(2)}:1 on the panel in ${theme}`;
      expect(verdict).toBe('passes');
    });
  });

  it('🔴 NEGATIVE CONTROL: `border-default` is still a divider and was NOT raised to pass this file', () => {
    // This is the row that makes the three above mean what they say. The cheap way to turn them
    // green is to raise the shared token — which would fix nothing here and break every hairline
    // in the editor plus VFN-002's c3. If this row goes red, read NAT-003's note in `colors.css`
    // BEFORE changing anything: the ramp has probably moved and the dividers have not followed.
    const onPanel = tokenContrast(theme, '--theme-color-border-default', PANEL);
    expect(onPanel).toBeLessThan(1.2);
  });

  it('🔴 the two NON-controls on the shelf still wear the divider token', () => {
    // ⚠️ The complement of CONTROLS. Without this, sweeping every `border-default` in the file to
    // `border-control` — the over-correction this task exists to refuse — passes silently.
    for (const selector of ['.TemplateStep-notice', '.TemplateCard-tag']) {
      expect([selector, tokenOf(block(selector), 'border')]).toEqual([
        selector,
        '--theme-color-border-default'
      ]);
    }
  });
});
