import { ProjectModel } from '@noodl-models/projectmodel';
import {
  collectExtractDestinations,
  joinComponentPath,
  labelForPath,
  parentPathOf,
  suggestExtractedComponentName,
  validateExtractedComponentName
} from '@noodl-utils/ExtractToComponent';

/**
 * "Extract to component" used to be a single click that created
 * `<current component>/Extracted component` — a name nobody chose, nested under
 * whatever component the nodes happened to be born in. The reported symptom was
 * people losing track of what they had extracted; the cause was that neither
 * the name nor the location was ever asked for.
 *
 * What jasmine can pin is the part that decides *where a name may point*: the
 * destination list, the suggested name, and the rules that reject one. The
 * dialog that shows them is React inside a PopupLayer popup and belongs to a
 * running editor.
 */
describe('extract to component — naming and destination', () => {
  function projectWith(componentNames: string[]) {
    return ProjectModel.fromJSON({
      components: componentNames.map((name) => ({
        name,
        graph: { roots: [], connections: [] }
      }))
    });
  }

  function componentNamed(project: ProjectModel, name: string) {
    return project.getComponentWithName(name);
  }

  describe('path arithmetic', () => {
    it('joins onto the project root without doubling the slash', () => {
      expect(joinComponentPath('/', 'Card')).toBe('/Card');
    });

    it('joins onto a folder', () => {
      expect(joinComponentPath('/#Pages/Home', 'Card')).toBe('/#Pages/Home/Card');
    });

    it('reads the parent of a top-level component as the root', () => {
      expect(parentPathOf('/Card')).toBe('/');
    });

    it('reads the parent of a nested component', () => {
      expect(parentPathOf('/#Pages/Home/Card')).toBe('/#Pages/Home');
    });

    it('names the root rather than drawing it as a bare slash', () => {
      expect(labelForPath('/')).toBe('Project root');
    });

    it('drops a sheet’s "#" and spells the internal sheets the way the UI does', () => {
      expect(labelForPath('/#Pages/Home')).toBe('Pages / Home');
      expect(labelForPath('/#__cloud__/Send')).toBe('Cloud Functions / Send');
      expect(labelForPath('/#__workflow__/Nightly')).toBe('Workflows / Nightly');
    });
  });

  describe('the destination list', () => {
    it('offers the root, every folder, every sheet and every component', () => {
      const project = projectWith(['/Home', '/Components/Buttons/Primary', '/#Pages/Login']);
      const paths = collectExtractDestinations(project, componentNamed(project, '/Home')).map((d) => d.path);

      expect(paths).toContain('/');
      expect(paths).toContain('/Components');
      expect(paths).toContain('/Components/Buttons');
      expect(paths).toContain('/Components/Buttons/Primary');
      expect(paths).toContain('/#Pages');
      expect(paths).toContain('/#Pages/Login');
    });

    it('classifies a folder that is also a component as a component — nesting is a real destination', () => {
      const project = projectWith(['/Home', '/Card', '/Card/Title']);
      const byPath = new Map(
        collectExtractDestinations(project, componentNamed(project, '/Home')).map((d) => [d.path, d])
      );

      expect(byPath.get('/')?.kind).toBe('root');
      expect(byPath.get('/#Pages')).toBeUndefined();
      // `/Card` is both a component and the prefix of `/Card/Title`.
      expect(byPath.get('/Card')?.kind).toBe('component');
    });

    it('marks a folder that only exists as a prefix', () => {
      const project = projectWith(['/Home', '/Components/Buttons/Primary']);
      const byPath = new Map(
        collectExtractDestinations(project, componentNamed(project, '/Home')).map((d) => [d.path, d])
      );

      expect(byPath.get('/Components')?.kind).toBe('folder');
      expect(byPath.get('/#Pages')).toBeUndefined();
    });

    it('marks a top-level "#" path as a sheet', () => {
      const project = projectWith(['/Home', '/#Pages/Login']);
      const byPath = new Map(
        collectExtractDestinations(project, componentNamed(project, '/Home')).map((d) => [d.path, d])
      );

      expect(byPath.get('/#Pages')?.kind).toBe('sheet');
    });

    it('flags the component being extracted out of, so nesting is recognisable', () => {
      const project = projectWith(['/Home', '/Card']);
      const current = collectExtractDestinations(project, componentNamed(project, '/Home')).filter((d) => d.isCurrent);

      expect(current.length).toBe(1);
      expect(current[0].path).toBe('/Home');
    });

    /**
     * Found by opening the dialog in a running editor: the built-in project
     * template ships `/#__page__/Home` alongside a bare `App`, and
     * `getComponentWithName` is an exact string match. Unnormalised, `App`
     * derived the path `/App`, failed to match its own name, and was offered as
     * a *folder* — while the row for the component the user was extracting out
     * of never carried the "current" flag at all.
     */
    describe('component names without the leading slash', () => {
      it('still classifies the component as a component, not a folder', () => {
        const project = projectWith(['App', '/#__page__/Home']);
        const byPath = new Map(
          collectExtractDestinations(project, componentNamed(project, 'App')).map((d) => [d.path, d])
        );

        expect(byPath.get('/App')?.kind).toBe('component');
      });

      it('still recognises it as the component being extracted out of', () => {
        const project = projectWith(['App', '/#__page__/Home']);
        const current = collectExtractDestinations(project, componentNamed(project, 'App')).filter((d) => d.isCurrent);

        expect(current.length).toBe(1);
        expect(current[0].path).toBe('/App');
      });

      it('still collides with a name stored either way', () => {
        const project = projectWith(['App', '/Card']);

        expect(validateExtractedComponentName(project, '/', 'App')).not.toBeNull();
        expect(validateExtractedComponentName(project, '/', 'Card')).not.toBeNull();
      });

      it('counts the suggestion up past a collision stored without the slash', () => {
        const project = projectWith(['App', 'Extracted component']);

        expect(suggestExtractedComponentName(project, '/')).toBe('Extracted component 2');
      });
    });

    it('hides the folder placeholders the components panel hides', () => {
      const project = projectWith(['/Home', '/Empty/.placeholder']);
      const paths = collectExtractDestinations(project, componentNamed(project, '/Home')).map((d) => d.path);

      // The folder itself is still offered — it is what the placeholder exists for.
      expect(paths).toContain('/Empty');
      expect(paths).not.toContain('/Empty/.placeholder');
    });

    /**
     * The runtime of a component *is* its name in this project format
     * (`utils/NodeGraph.getComponentModelRuntimeType`), so a destination across
     * the `#__cloud__` boundary would silently change what the extracted graph
     * is. The picker refuses to offer the crossing rather than validating it
     * after the fact.
     */
    describe('runtime boundaries', () => {
      const names = ['/Home', '/#Pages/Login', '/#__cloud__/Send', '/#__workflow__/Nightly'];

      it('never offers a browser extraction a cloud or workflow destination', () => {
        const project = projectWith(names);
        const paths = collectExtractDestinations(project, componentNamed(project, '/Home')).map((d) => d.path);

        expect(paths).toContain('/');
        expect(paths).toContain('/#Pages');
        expect(paths.some((p) => p.startsWith('/#__cloud__'))).toBe(false);
        expect(paths.some((p) => p.startsWith('/#__workflow__'))).toBe(false);
      });

      it('keeps a cloud extraction inside the cloud sheet', () => {
        const project = projectWith(names);
        const paths = collectExtractDestinations(project, componentNamed(project, '/#__cloud__/Send')).map(
          (d) => d.path
        );

        expect(paths).toContain('/#__cloud__');
        expect(paths).toContain('/#__cloud__/Send');
        expect(paths).not.toContain('/');
        expect(paths).not.toContain('/#Pages');
      });

      it('keeps a workflow extraction inside the workflow sheet', () => {
        const project = projectWith(names);
        const paths = collectExtractDestinations(project, componentNamed(project, '/#__workflow__/Nightly')).map(
          (d) => d.path
        );

        expect(paths).toContain('/#__workflow__');
        expect(paths).not.toContain('/');
      });
    });
  });

  describe('the suggested name', () => {
    it('is the plain suggestion when nothing collides', () => {
      const project = projectWith(['/Home']);
      expect(suggestExtractedComponentName(project, '/')).toBe('Extracted component');
    });

    it('counts up past what is already there, in the chosen folder only', () => {
      const project = projectWith(['/Home', '/Extracted component', '/Components/Extracted component']);

      expect(suggestExtractedComponentName(project, '/')).toBe('Extracted component 2');
      // The collision in `/` says nothing about `/Components/Buttons`.
      expect(suggestExtractedComponentName(project, '/Components/Buttons')).toBe('Extracted component');
    });
  });

  describe('rejecting a name', () => {
    let project: ProjectModel;

    beforeEach(() => {
      project = projectWith(['/Home', '/Card']);
    });

    it('accepts an ordinary name', () => {
      expect(validateExtractedComponentName(project, '/', 'Product card')).toBeNull();
    });

    it('rejects an empty name, and one that is only whitespace', () => {
      expect(validateExtractedComponentName(project, '/', '')).not.toBeNull();
      expect(validateExtractedComponentName(project, '/', '   ')).not.toBeNull();
    });

    it('rejects a "/" — the folder is chosen from the list, not typed into the name', () => {
      expect(validateExtractedComponentName(project, '/', 'Components/Card')).not.toBeNull();
    });

    it('rejects the "#" that would invent a sheet and the "." that hides a component', () => {
      expect(validateExtractedComponentName(project, '/', '#Pages')).not.toBeNull();
      expect(validateExtractedComponentName(project, '/', '.placeholder')).not.toBeNull();
    });

    it('rejects a name already taken in the chosen folder', () => {
      expect(validateExtractedComponentName(project, '/', 'Card')).not.toBeNull();
    });

    it('allows that same name in a different folder', () => {
      expect(validateExtractedComponentName(project, '/Home', 'Card')).toBeNull();
    });

    it('ignores surrounding whitespace when deciding both name and collision', () => {
      expect(validateExtractedComponentName(project, '/', '  Card  ')).not.toBeNull();
      expect(validateExtractedComponentName(project, '/', '  Fresh  ')).toBeNull();
    });
  });
});
