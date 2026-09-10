# Noodl code

-----------------------------

const appId = \_noodl_cloudservices.appId
const restApiKey = \_noodl_cloudservices.masterKey
const endpoint = \_noodl_cloudservices.endpoint
const parentClassName = Inputs.parentClassName;
const childClassName = Inputs.childClassName;
const parentId = Inputs.parentId;
const relationKey = Inputs.relationKey;

try {
// Construct the query for the $relatedTo operator
const relatedToQuery = encodeURIComponent(JSON.stringify({
"$relatedTo": {
"object": {"\__type": "Pointer", "className": parentClassName, "objectId": parentId},
"key": relationKey
}
}));

```
// Construct the URL to query child objects related to the specified parent
const url = `${endpoint}/classes/${childClassName}?where=${relatedToQuery}`;

// Make the request to fetch related objects
let response = await fetch(url, {
    method: 'GET',
    headers: {
        'X-Parse-Application-Id': appId,
        'X-Parse-REST-API-Key': restApiKey,
        'Content-Type': 'application/json'
    }
});

if (response.ok) {
    let jsonResponse = await response.json();
    Outputs.response = jsonResponse;
    Outputs.Success();
} else {
    Outputs.error = "Error: " + response.status + " " + response.statusText;
    Outputs.Failure();
}
```

} catch (error) {
Outputs.error = "Error: " + error.message;
Outputs.Failure();
}