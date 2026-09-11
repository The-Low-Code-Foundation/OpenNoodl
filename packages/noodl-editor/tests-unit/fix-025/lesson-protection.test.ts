/**
 * FIX-025 — deleting a node the lesson is grading asks first.
 *
 * Richard: *"it's easy to accidentally delete bits of the tutorial app that are needed to
 * complete the session, and you might not remember what you deleted."*
 */
import {
  protectedByLesson,
  protectionMessage,
  type LessonStepView,
  type ProtectedNodeView
} from '../../src/editor/src/models/lessonprotection';

/** The steps of the installed "State on a page" lesson, as compiled. */
const STEPS: LessonStepView[] = [
  { title: 'Find the Text node', conditions: [{ path: '/#__page__/Home:%Text', exists: true }] },
  { title: 'Find the Variable', conditions: [{ path: '/#__page__/Home:%Variable2', exists: true }] },
  { title: 'Add a second Text', conditions: [{ path: '/#__page__/Home:#Caption', hastype: 'Text' }] }
];

const caption: ProtectedNodeView = { id: 'n1', label: 'Caption', typeName: 'Text' };
const hello: ProtectedNodeView = { id: 'n2', typeName: 'Text' };
const scratch: ProtectedNodeView = { id: 'n3', typeName: 'Group' };
const variable: ProtectedNodeView = { id: 'n4', typeName: 'Variable2' };

describe('protectedByLesson', () => {
  it('🔴 warns when the graded node is deleted, and names the step', () => {
    const found = protectedByLesson([caption], STEPS, [caption, hello, variable]);
    expect(found).toHaveLength(1);
    expect(found[0].stepTitle).toBe('Add a second Text');
    expect(protectionMessage(found)).toMatch(/“Caption”.*“Add a second Text”/);
  });

  it('says nothing about a node no step mentions', () => {
    expect(protectedByLesson([scratch], STEPS, [caption, hello, scratch])).toHaveLength(0);
    expect(protectionMessage([])).toBeNull();
  });

  it('🔴 a type-only condition does NOT fire while another node of that type survives', () => {
    // Deleting one of two Texts leaves `%Text` satisfiable. Warning here would fire on the
    // learner's own scratch nodes and train them to click through the dialog.
    expect(protectedByLesson([hello], STEPS, [caption, hello, variable])).toHaveLength(0);
  });

  it('🔴 ...and DOES fire when it is the last of its type', () => {
    const found = protectedByLesson([variable], STEPS, [caption, hello, variable]);
    expect(found).toHaveLength(1);
    expect(found[0].stepTitle).toBe('Find the Variable');
  });

  it('catches a multi-node selection that takes the last Text with it', () => {
    const found = protectedByLesson([caption, hello], STEPS, [caption, hello, variable]);
    expect(found.map((f) => f.nodeName)).toEqual(['Caption', 'Text']);
    expect(protectionMessage(found)).toMatch(/stop steps completing/);
  });

  it('matches labels case-insensitively — the grammar findNodeWithPath uses', () => {
    const lower: ProtectedNodeView = { id: 'n5', label: 'caption', typeName: 'Text' };
    expect(protectedByLesson([lower], STEPS, [lower, hello, variable])).toHaveLength(1);
  });

  it('reads the two endpoints of a connection condition too', () => {
    const steps: LessonStepView[] = [
      { title: 'Wire it up', conditions: [{ from: '/App:#Button', to: '/App:#Label', hasconnection: 'click,set' }] }
    ];
    const button: ProtectedNodeView = { id: 'b', label: 'Button', typeName: 'Text' };
    expect(protectedByLesson([button], steps, [button])).toHaveLength(1);
  });
});
