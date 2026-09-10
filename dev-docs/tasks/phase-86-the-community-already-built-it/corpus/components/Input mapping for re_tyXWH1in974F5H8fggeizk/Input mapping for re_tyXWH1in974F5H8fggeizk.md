# Noodl code

-----------------------------

map({
ComponentInputPortName1: () => false, // Maps a new key pair regardless of incoming item values to a port of the component input inside the repeater
ComponentInputPortName2: 'objectKey' // Maps the 'objectKey' value of your incoming objects to a port of the component input inside the repeater
ComponentInputPortName3: function() { return object.get('objectKey') + 'Whatever else you want' } // Can use one or more keys in a function to return a specific value to the component input port inside the Repeater
})