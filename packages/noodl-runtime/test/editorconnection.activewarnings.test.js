const ActiveWarnings = require('../src/editorconnection.activewarnings');

describe('Tracks active warnings that are sent to the editor', ()=>{
    let activeWarnings;

    beforeEach(async ()=>{
        activeWarnings = new ActiveWarnings();
    });


    test('Set and clear a warning', () => {
        expect(activeWarnings.setWarning('testId', 'testKey', 'testWarning')).toBe(true);

        //these warnings shouldnt exist
        expect(activeWarnings.clearWarning('testId', 'otherKey')).toEqual(false);
        expect(activeWarnings.clearWarning('otherId', 'testKey')).toEqual(false);
        
        //this warning is the one we set
        expect(activeWarnings.clearWarning('testId', 'testKey')).toEqual(true);

        //and now the warning should be gone
        expect(activeWarnings.clearWarning('testId', 'testKey')).toEqual(false);
    });

    test('Set and clear multiple warning on one node', () => {
        expect(activeWarnings.setWarning('testId', 'testKey1', 'testWarning')).toBe(true);
        expect(activeWarnings.setWarning('testId', 'testKey2', 'testWarning')).toBe(true);

        expect(activeWarnings.clearWarning('testId', 'testKey1')).toEqual(true);
        expect(activeWarnings.clearWarning('testId', 'testKey1')).toEqual(false);

        expect(activeWarnings.clearWarning('testId', 'testKey2')).toEqual(true);
        expect(activeWarnings.clearWarning('testId', 'testKey2')).toEqual(false);
    });

    test('Clear multiple warnings at once', () => {
        expect(activeWarnings.setWarning('testId1', 'testKey1', 'testWarning')).toBe(true);
        expect(activeWarnings.setWarning('testId1', 'testKey2', 'testWarning')).toBe(true);
        expect(activeWarnings.setWarning('testId2', 'testKey1', 'testWarning')).toBe(true);

        expect(activeWarnings.clearWarnings('testId3')).toEqual(false);

        expect(activeWarnings.clearWarnings('testId1')).toEqual(true);
        expect(activeWarnings.clearWarnings('testId1')).toEqual(false);

        expect(activeWarnings.clearWarnings('testId2')).toEqual(true);
        expect(activeWarnings.clearWarnings('testId2')).toEqual(false);
    });

    test('Set same warning multiple times', () => {
        expect(activeWarnings.setWarning('testId', 'testKey', 'testWarning')).toBe(true);
        expect(activeWarnings.setWarning('testId', 'testKey', 'testWarning')).toBe(false);
        expect(activeWarnings.setWarning('testId', 'testKey', 'testWarning2')).toBe(true);
    });

    // OBS-003. The three rows above pass with `===` because they compare *strings*, and no
    // caller in the library sends a string — every one builds `{ showGlobally, message }` fresh.
    // So the de-duplication this class exists for had never once applied in production, and the
    // suite could not see it. These rows are written in the payload shape callers actually use.
    describe('Object payloads, which is what every caller actually sends', () => {
        test('An identical payload built as a fresh literal is not re-sent', () => {
            expect(activeWarnings.setWarning('testId', 'testKey', { showGlobally: true, message: 'same' })).toBe(true);
            expect(activeWarnings.setWarning('testId', 'testKey', { showGlobally: true, message: 'same' })).toBe(false);
            expect(activeWarnings.setWarning('testId', 'testKey', { showGlobally: true, message: 'same' })).toBe(false);
        });

        test('A payload whose message changed is re-sent', () => {
            expect(activeWarnings.setWarning('testId', 'testKey', { showGlobally: true, message: 'a' })).toBe(true);
            expect(activeWarnings.setWarning('testId', 'testKey', { showGlobally: true, message: 'b' })).toBe(true);
        });

        test('A payload that gained or lost a property is re-sent', () => {
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a' })).toBe(true);
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a', level: 'error' })).toBe(true);
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a' })).toBe(true);
        });

        // The safe direction to be wrong in: a nested object compares by identity, so it
        // re-sends rather than risking suppressing a warning whose detail actually changed.
        test('A nested object re-sends rather than being compared deeply', () => {
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a', detail: { n: 1 } })).toBe(true);
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a', detail: { n: 1 } })).toBe(true);
        });

        test('Clearing still works on an object payload', () => {
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a' })).toBe(true);
            expect(activeWarnings.clearWarning('testId', 'testKey')).toBe(true);
            // Cleared, so the same payload is new again.
            expect(activeWarnings.setWarning('testId', 'testKey', { message: 'a' })).toBe(true);
        });
    });
});
