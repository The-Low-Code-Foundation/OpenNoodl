/**
 * REL-019 §1/§2/§3 — the WIRES, graded at the source, because that is the layer that broke.
 *
 * 🔴 **Two green gates on the ends of a chain read as coverage and were not.** FB-013's write
 * half shipped with a composer the hook composed (`chatwrites.test.ts`) and a view that drew it
 * (`chat-composer-render.test.tsx`) — and `ProjectsPage` never carried the one to the other,
 * so from the launcher the river could not be written to. Richard, 2026-09-06: *"STILL doesn't
 * have the ability to add chat"*. The same shape hid `/articles/` (a route the web has never
 * served) behind a row spec that only checked the click reached `onOpenArticle`.
 *
 * `ProjectsPage` reads context, models and a router, so it cannot be executed here; what CAN be
 * graded is that the host object it builds names the fields. That is a weaker gate than a
 * render, and it is the gate that would have caught both.
 *
 * @module noodl-editor/tests-unit/rel-019/launcher-wiring
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { stripComments } from '../support/renderElements';

const EDITOR = join(__dirname, '../../src/editor/src');
const read = (rel: string) => stripComments(readFileSync(join(EDITOR, rel), 'utf8'));

describe('ProjectsPage → the launcher’s community host state', () => {
  const page = read('pages/ProjectsPage/ProjectsPage.tsx');
  const chatPane = page.slice(page.indexOf('chat: {'), page.indexOf('onOpenArticle'));

  it('🔴 carries the chat composer AND the reply box from the hook into the pane', () => {
    expect(chatPane).toMatch(/composer:\s*communityChat\.composer/);
    expect(chatPane).toMatch(/reply:\s*communityChat\.reply/);
  });

  it('opens a tutorial at /tutorials/<slug>, the route the web serves — never /articles/', () => {
    expect(page).toMatch(/onOpenArticle:.*\/tutorials\/\$\{slug\}/);
    expect(page).not.toContain('/articles/');
  });

  it('reads the spine once and hands it to the shelf', () => {
    expect(page).toMatch(/const chain = shippedChainOnStartup\(\)/);
    expect(page).toMatch(/toLearningCards\(model\.list\(\),\s*chain\)/);
  });
});

describe('the hook and the view still agree about what the pane carries', () => {
  it('`useCommunityChat` returns `composer` and `reply`, which the pane type names', () => {
    const hook = read('hooks/useCommunityChat.ts');
    expect(hook).toMatch(/composer:\s*composeChatComposer\(/);
    expect(hook).toMatch(/\breply:\s*\n?\s*pane\.state === 'open'/);
    const view = stripComments(
      readFileSync(join(__dirname, '../../../noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx'), 'utf8')
    );
    const pane = view.slice(view.indexOf('interface LauncherCommunityChatPane'), view.indexOf('interface LauncherCommunityProfilePane'));
    expect(pane).toMatch(/composer\?:\s*CommunityChatComposerBox/);
    expect(pane).toMatch(/reply\?:\s*CommunityReplyBox/);
  });
});

describe('useLearnerPath withdraws the projection offer once the community refuses it', () => {
  const hook = read('hooks/useLearnerPath.ts');

  it('flips the flag on `unavailable` and on `refused`, and returns no `onProject` while it is set', () => {
    expect(hook).toMatch(/outcome\.kind === 'unavailable' \|\| write\.value\.outcome\.kind === 'refused'/);
    expect(hook).toMatch(/setProjectionOff\(true\)/);
    expect(hook).toMatch(/onProject:\s*projectionOff \? undefined : onProject/);
  });
});
