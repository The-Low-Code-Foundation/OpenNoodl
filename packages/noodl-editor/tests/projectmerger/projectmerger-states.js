var ProjectMerger = require('@noodl-versioning');
var NodeLibrary = require('@noodl-models/nodelibrary').NodeLibrary;
var fs = require('fs');
var Process = require('process');

// Project settings
describe('Project merger (states and transitions)', function () {
  it('can merge add state transitions to empty ancestor', function () {
    var a = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A'
              }
            ],
            connections: []
          }
        }
      ]
    };
    var o = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                stateParameters: {
                  hover: {
                    p1: 'changed'
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var t = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A'
              }
            ],
            connections: []
          }
        }
      ]
    };

    var res = ProjectMerger.mergeProject(a, o, t);
    expect(res.components[0].graph.roots[0]).toEqual({
      type: '0',
      id: 'A',
      stateParameters: {
        hover: {
          p1: 'changed'
        }
      }
    });
  });

  it('can merge state parameters', function () {
    var a = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {},
                stateParameters: {
                  hover: {
                    p1: 'some-string',
                    p3: 'remove-me'
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var o = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                stateParameters: {
                  hover: {
                    p1: 'changed',
                    p2: 'added-string',
                    p3: 'remove-me'
                  },
                  pressed: {
                    p4: 'new-param'
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var t = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {},
                stateParameters: {
                  hover: {
                    p1: 10 // Should conflict
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };

    var res = ProjectMerger.mergeProject(a, o, t);
    expect(res.components[0].graph.roots[0]).toEqual({
      type: '0',
      id: 'A',
      stateParameters: {
        hover: {
          p1: 'changed',
          p2: 'added-string'
          // SUB-007: a parameter deleted by one side is removed outright; the
          // legacy merger left the key behind with an explicit `undefined`.
        },
        pressed: {
          p4: 'new-param'
        }
      },
      // SUB-007: the graph merger no longer injects an empty `ports` array
      // into every node it merges; absent and [] are equivalent to readers.
      conflicts: [
        {
          type: 'stateParameter',
          state: 'hover',
          name: 'p1',
          ours: 'changed',
          theirs: 10
        }
      ],
    });
  });

  it('can merge add state transitions to empty ancestor', function () {
    var a = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {}
              }
            ],
            connections: []
          }
        }
      ]
    };
    var o = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                stateTransitions: {
                  hover: {
                    p1: {
                      dur: 0,
                      curve: 'changed'
                    },
                    p2: {
                      dur: 0,
                      curve: 'added'
                    }
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var t = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {}
              }
            ],
            connections: []
          }
        }
      ]
    };

    var res = ProjectMerger.mergeProject(a, o, t);
    expect(res.components[0].graph.roots[0]).toEqual({
      type: '0',
      id: 'A',
      stateTransitions: {
        hover: {
          p1: {
            dur: 0,
            curve: 'changed'
          },
          p2: {
            dur: 0,
            curve: 'added'
          }
        }
      }
    });
  });

  it('can merge state transitions', function () {
    var a = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {},
                stateTransitions: {
                  hover: {
                    p1: {
                      dur: 0,
                      curve: [1, 1, 1, 1]
                    },
                    p3: 'remove-me'
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var o = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                stateTransitions: {
                  hover: {
                    p1: {
                      dur: 0,
                      curve: 'changed'
                    },
                    p2: {
                      dur: 0,
                      curve: 'added'
                    },
                    p3: 'remove-me'
                  },
                  pressed: {
                    p4: {
                      dur: 0,
                      curve: [0, 1, 0, 1]
                    }
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var t = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {},
                stateTransitions: {
                  hover: {
                    p1: {
                      dur: 0,
                      curve: [0, 0, 0, 1]
                    }
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };

    var res = ProjectMerger.mergeProject(a, o, t);
    expect(res.components[0].graph.roots[0]).toEqual({
      type: '0',
      id: 'A',
      stateTransitions: {
        hover: {
          p1: {
            dur: 0,
            curve: 'changed'
          },
          p2: {
            dur: 0,
            curve: 'added'
          }
          // SUB-007: a parameter deleted by one side is removed outright; the
          // legacy merger left the key behind with an explicit `undefined`.
        },
        pressed: {
          p4: {
            dur: 0,
            curve: [0, 1, 0, 1]
          }
        }
      },
      // SUB-007: the graph merger no longer injects an empty `ports` array
      // into every node it merges; absent and [] are equivalent to readers.
      conflicts: [
        {
          type: 'stateTransition',
          state: 'hover',
          name: 'p1',
          ours: {
            dur: 0,
            curve: 'changed'
          },
          theirs: {
            dur: 0,
            curve: [0, 0, 0, 1]
          }
        }
      ],
    });
  });

  it('can merge default state transitions', function () {
    var a = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {}
              }
            ],
            connections: []
          }
        }
      ]
    };
    var o = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                defaultStateTransitions: {
                  neutral: {
                    dur: 100,
                    curve: [0, 0, 1, 1]
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };
    var t = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {},
                defaultStateTransitions: {
                  neutral: {
                    dur: 200,
                    curve: [1, 1, 1, 1]
                  }
                }
              }
            ],
            connections: []
          }
        }
      ]
    };

    var res = ProjectMerger.mergeProject(a, o, t);
    expect(res.components[0].graph.roots[0]).toEqual({
      type: '0',
      id: 'A',
      defaultStateTransitions: {
        neutral: {
          dur: 100,
          curve: [0, 0, 1, 1]
        }
      },
      // SUB-007: the graph merger no longer injects an empty `ports` array
      // into every node it merges; absent and [] are equivalent to readers.
      conflicts: [
        {
          type: 'defaultStateTransition',
          state: 'neutral',
          ours: {
            dur: 100,
            curve: [0, 0, 1, 1]
          },
          theirs: {
            dur: 200,
            curve: [1, 1, 1, 1]
          }
        }
      ],
    });
  });

  it('can merge variant', function () {
    var a = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {}
              }
            ],
            connections: []
          }
        }
      ]
    };
    var o = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                variant: 'VariantA'
              }
            ],
            connections: []
          }
        }
      ]
    };
    var t = {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              {
                type: '0',
                id: 'A',
                parameters: {},
                variant: 'VariantB'
              }
            ],
            connections: []
          }
        }
      ]
    };

    var res = ProjectMerger.mergeProject(a, o, t);
    expect(res.components[0].graph.roots[0]).toEqual({
      type: '0',
      id: 'A',
      variant: 'VariantA',
      // SUB-007: the graph merger no longer injects an empty `ports` array
      // into every node it merges; absent and [] are equivalent to readers.
      conflicts: [
        {
          type: 'variant',
          ours: 'VariantA',
          theirs: 'VariantB'
        }
      ],
    });
  });
});
