# Noodl code

-----------------------------

Script.Inputs = {
query: {
type: {
name: 'string',
codeeditor: 'graphql'
},
default: "{\\n}"
}
}

// Proxy the input to get the right type in editor
Script.Setters.query = function () {
Script.Outputs.query = Script.Inputs.query;
}