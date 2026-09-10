# Noodl code

-----------------------------

```javascript
const operation = Inputs.operation; // Define as either 'AddRelation' or 'RemoveRelation'
const parentId = Inputs.parentId; // The record with the relation column
const childArray = Inputs.childArray || []; // An array of records to be added as relations
const childIds = childArray.map(child => typeof child === 'object' && child !== null ? child.id : child);
const childClassName = Inputs.childClassName; 
const parentClassName = Inputs.parentClassName; 
    // Note that Users, Roles and Sessions must be prefixed with a "_" (e.g. _Users class)
    // Recommendation - make a states node inside a logic component and add your class names as states
const relationKey = Inputs.parentRelationField;

const appId = _noodl_cloudservices.appId;
const restApiKey = _noodl_cloudservices.masterKey;
const endpoint = _noodl_cloudservices.endpoint;

let allChildren = [];

async function changeRelation(operationType,children) {
    try {
        // Create an array of pointers to the teacher objects
        const childPointers = children.map(id => ({
            "__type": "Pointer",
            "className": childClassName,
            "objectId": id
        }));

        // Setup the request body for updating the relation
        const body = {
            [relationKey]: {
                "__op": operationType,
                "objects": childPointers
            }
        };

        // Make the request to update the Group object
        const url = `${endpoint}/classes/${parentClassName}/${parentId}`;
        let response = await fetch(url, {
            method: 'PUT',
            headers: {
                'X-Parse-Application-Id': appId,
                'X-Parse-Master-Key': restApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            let jsonResponse = await response.json();
            Outputs.response = jsonResponse;
        } else {
            Outputs.response = "Error: " + response.status + " " + response.statusText;
            Outputs.Failure();
        }
    } catch (error) {
        Outputs.response = "Error: " + error.message;
        Outputs.Failure();
    }
}


async function getAllChildren() {
    try {
        // Construct the query for the $relatedTo operator
        const relatedToQuery = encodeURIComponent(JSON.stringify({
            "$relatedTo": {
                "object": {"__type": "Pointer", "className": parentClassName, "objectId": parentId},
                "key": relationKey
            }
        }));

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
            allChildren = jsonResponse.results.map(item => item.objectId);
            Outputs.allChildren = allChildren;
        } else {
            Outputs.error = "Error: " + response.status + " " + response.statusText;
            Outputs.Failure();
        }
    } catch (error) {
        Outputs.error = "Error: " + error.message;
        Outputs.Failure();
    }
}

if (operation === 'AddRelation') {
    
    await getAllChildren();

    await changeRelation("RemoveRelation",allChildren);

    await changeRelation(operation,childIds);

    Outputs.Success();
    return;

} else if (operation === 'RemoveRelation') {

    await changeRelation(operation,childIds);

    Outputs.Success();
    return;
    
} else if (operation === 'RemoveAllRelations') {

    await getAllChildren();

    await changeRelation("RemoveRelation",allChildren);
    Outputs.Success();
    return;

}
```