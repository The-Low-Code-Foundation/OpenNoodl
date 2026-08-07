var ProjectMerger = require('@noodl-versioning');

function mergeComments(base, ours, theirs) {
  const baseComponent = {
    components: [
      {
        name: 'comp1',
        graph: {
          roots: [],
          comments: base
        }
      }
    ]
  };

  const ourComponent = {
    components: [
      {
        name: 'comp1',
        graph: {
          roots: [],
          comments: ours
        }
      }
    ]
  };

  const theirComponent = {
    components: [
      {
        name: 'comp1',
        graph: {
          roots: [],
          comments: theirs
        }
      }
    ]
  };

  return ProjectMerger.mergeProject(baseComponent, ourComponent, theirComponent);
}
// Project settings
describe('Project merger - comments', function () {
  it('can merge new comments', function () {
    const ours = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const theirs = [
      {
        id: 'c2',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const res = mergeComments(undefined, ours, theirs);

    expect(res.components[0].graph.comments).toEqual([
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      },
      {
        id: 'c2',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ]);
  });

  it('can merge updated comments - theirs updated', function () {
    const base = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const ours = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const theirs = [
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const res = mergeComments(base, ours, theirs);

    expect(res.components[0].graph.comments).toEqual([
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ]);
  });

  it('can merge updated comments - ours updated', function () {
    const base = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const ours = [
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const theirs = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const res = mergeComments(base, ours, theirs);

    expect(res.components[0].graph.comments).toEqual([
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ]);
  });

  it('can merge deleted comments - ours deleted', function () {
    const base = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const ours = [];
    const theirs = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const res = mergeComments(base, ours, theirs);

    expect(res.components[0].graph.comments).toEqual([]);
  });

  it('can merge deleted comments - theirs deleted', function () {
    const base = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const ours = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const theirs = [];
    const res = mergeComments(base, ours, theirs);

    expect(res.components[0].graph.comments).toEqual([]);
  });

  it('can merge deleted and changed comments - ours modified, theirs deleted', function () {
    const base = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const ours = [
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const theirs = [];
    const res = mergeComments(base, ours, theirs);

    expect(res.components[0].graph.comments).toEqual([
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ]);
  });

  it('can merge deleted and changed comments - ours deleted, theirs modified', function () {
    const base = [
      {
        id: 'c1',
        text: 'hej',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const ours = [];
    const theirs = [
      {
        id: 'c1',
        text: 'hopp',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ];
    const res = mergeComments(base, ours, theirs);

    // SUB-007: we deleted the comment, they edited it. Legacy silently
    // restored their edit. The graph merger keeps our deletion and reports the
    // conflict, matching how it treats delete-vs-edit everywhere else.
    expect(res.components[0].graph.comments).toEqual([]);

    const commentConflicts = res.metadata.mergeConflicts.filter((c) => c.kind === 'comment');
    expect(commentConflicts.length).toBe(1);
    expect(commentConflicts[0].deletedBy).toBe('ours');
  });
});
