# Noodl code

-----------------------------

const jsonObjectList = Inputs.jsonObject || \[\];
const userId = Inputs.userId;

const updatedJsonObjects = jsonObjectList.map(obj => {
return {
...obj,
originRecordId: obj.id,
userId: userId
};
});

Outputs.jsonAppended = updatedJsonObjects;
Outputs.Success();