const OutputProperty = require('../src/outputproperty');

test('Throws an exception if no owner is specified', () => {
    expect(()=>{
        new OutputProperty();
    }).toThrow(Error);
});
