/**
 * REL-002c — the redesign, photographed at the door while it is being built.
 *
 * ⚠️ **A working instrument, not the close protocol.** The AC is graded by
 * `vib001-members.look.ts` in both states; this renders the door state only, so
 * the loop between an edit and a picture is a minute rather than half an hour.
 * It asserts only what would make the pictures lie.
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/rel002c-look.look.ts
 */
import { judge, today } from './helpers/judge';
import { copyTemplateProject, TEMPLATE_DIR } from './helpers/members-drive';

import * as path from 'path';

jest.setTimeout(1800000);

const SHIPPED_PROJECT = path.join(TEMPLATE_DIR, 'nodegx.project.json');
const DATE = today();

describe('REL-002c — the door, while the redesign is being built', () => {
  it('photographs every page a stranger can reach', async () => {
    const projectDir = copyTemplateProject('rel002c-door');
    const run = await judge({
      task: 'rel-002c',
      subject: 'members-area',
      state: 'door',
      projectDir,
      shippedProjectFile: SHIPPED_PROJECT,
      date: DATE,
      pages: [
        { label: 'landing', url: '/', as: 'the first thing anyone sees' },
        { label: 'join', url: '/join', as: 'a stranger asking to join' },
        { label: 'setup', url: '/setup', as: 'the owner, first run' },
        { label: 'sign-in', url: '/sign-in', as: 'a member coming back' }
      ]
    });
    expect(run.shots.length).toBe(16);
    // eslint-disable-next-line no-console
    console.log('DOOR MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });
});
