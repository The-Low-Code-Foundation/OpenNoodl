# Noodl code

-----------------------------

try {
let response = await fetch(\_noodl_cloudservices.endpoint + "/classes/CLASSNAME/" + Inputs.objectId, {
headers: {
'X-Parse-Application-Id': \_noodl_cloudservices.appId,
'X-Parse-Master-Key': \_noodl_cloudservices.masterKey,
}
});

```
if (response.ok) {
    let jsonResponse = await response.json();
    Outputs.response = jsonResponse;
} else {
    Outputs.response = "Error: " + response.status + " " + response.statusText;
}
```

} catch (error) {
Outputs.response = "Error: " + error.message;
}