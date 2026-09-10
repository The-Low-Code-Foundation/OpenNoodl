# Noodl code

-----------------------------

if (!Inputs.targetRecordId) {
return;
}

const results = await Noodl.Records.query("parentRecordClass",{relationFieldName:{pointsTo:Inputs.targetRecordId}});
Outputs.results = results;