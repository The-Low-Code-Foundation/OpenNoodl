"""The rename-recall eval set.

Every `doc` is a REAL node whose vocabulary really changed, on the date given. Every item
carries TWO phrasings of the SAME intent:

  q_new  — how somebody would type it TODAY (post-rename vocabulary)
  q_old  — how somebody would have typed it THEN (the vocabulary in the document)

🔴 q_old is the CONTROL, and it is the whole reason this measures anything. If a retriever
misses on q_new we learn nothing unless it HITS on q_old with the same document, the same
corpus and the same k — otherwise "not found" might just mean "this document is hard to
find", not "the rename hid it". The pair holds everything constant except the vocabulary.

EXCLUDED DELIBERATELY: SetDbModelProperties ("Set Record Properties" -> "Update Record",
2026-08-01). The new name COLLIDES with an unrelated node, noodl.byob.UpdateRecord, which
was already called Update Record before the rename. A query for the new name has two honest
answers, so it cannot grade a single ground truth.
"""
import json
import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
EVAL = [
 {
  "doc": "Logic Builder",
  "fam": "total",
  "renamed": "Logic Builder -> Visual Function (2026-08-12)",
  "q_new": "visual function node to compute a value from several inputs",
  "q_old": "logic builder node to compute a value from several inputs",
  "kw_new": "visual function",
  "kw_old": "logic builder"
 },
 {
  "doc": "Logic Builder",
  "fam": "total",
  "renamed": "Logic Builder -> Visual Function (2026-08-12)",
  "q_new": "how do I build a visual function instead of writing a code expression",
  "q_old": "how do I build logic visually instead of writing a code expression",
  "kw_new": "visual function compute",
  "kw_old": "logic builder compute"
 },
 {
  "doc": "NewDbModelProperties",
  "fam": "total",
  "renamed": "Create New Record -> Create Record (2026-08-01)",
  "q_new": "create record node for cloud data",
  "q_old": "create new record node for cloud data",
  "kw_new": "create record",
  "kw_old": "create new record"
 },
 {
  "doc": "net.noodl.HTTP",
  "fam": "outcome",
  "renamed": "HTTP success -> done (2026-08-02)",
  "q_new": "which output fires when the http request is done",
  "q_old": "which output fires when the http request succeeds",
  "kw_new": "http request done",
  "kw_old": "http request success"
 },
 {
  "doc": "net.noodl.user.LogIn",
  "fam": "outcome",
  "renamed": "LogIn success -> done (2026-08-02)",
  "q_new": "signal that fires when logging a user in is done",
  "q_old": "signal that fires when logging a user in succeeds",
  "kw_new": "log in done",
  "kw_old": "log in success"
 },
 {
  "doc": "net.noodl.user.SignUp",
  "fam": "outcome",
  "renamed": "SignUp success -> done (2026-08-02)",
  "q_new": "done output after creating a new user account",
  "q_old": "success output after creating a new user account",
  "kw_new": "sign up done",
  "kw_old": "sign up success"
 },
 {
  "doc": "net.noodl.user.LogOut",
  "fam": "outcome",
  "renamed": "LogOut success -> done (2026-08-02)",
  "q_new": "done signal after signing the current user out",
  "q_old": "success signal after signing the current user out",
  "kw_new": "log out done",
  "kw_old": "log out success"
 },
 {
  "doc": "net.noodl.user.RequestMagicLink",
  "fam": "outcome",
  "renamed": "RequestMagicLink success -> done (2026-08-02)",
  "q_new": "done output after emailing a passwordless sign in link",
  "q_old": "success output after emailing a passwordless sign in link",
  "kw_new": "magic link done",
  "kw_old": "magic link success"
 },
 {
  "doc": "CloudFunction2",
  "fam": "outcome",
  "renamed": "CloudFunction2 success -> done (2026-08-02)",
  "q_new": "know when calling a cloud function is done",
  "q_old": "know when calling a cloud function succeeded",
  "kw_new": "cloud function done",
  "kw_old": "cloud function success"
 },
 {
  "doc": "Upload File",
  "fam": "outcome",
  "renamed": "Upload File success -> done (2026-08-02)",
  "q_new": "fires when the file upload is done",
  "q_old": "fires when the file upload succeeds",
  "kw_new": "upload file done",
  "kw_old": "upload file success"
 },
 {
  "doc": "Open File Picker",
  "fam": "outcome",
  "renamed": "Open File Picker success -> done (2026-08-02)",
  "q_new": "done output after the user chooses a file from disk",
  "q_old": "success output after the user chooses a file from disk",
  "kw_new": "file picker done",
  "kw_old": "file picker success"
 },
 {
  "doc": "Sign File URL",
  "fam": "outcome",
  "renamed": "Sign File URL success -> done (2026-08-02)",
  "q_new": "done signal after signing a file url",
  "q_old": "success signal after signing a file url",
  "kw_new": "sign file url done",
  "kw_old": "sign file url success"
 },
 {
  "doc": "noodl.cloud.sendemail",
  "fam": "outcome",
  "renamed": "sendemail sent -> done, failed -> failure (2026-08-02)",
  "q_new": "done and failure outputs when emailing from a cloud function",
  "q_old": "sent and failed outputs when emailing from a cloud function",
  "kw_new": "send email done failure",
  "kw_old": "send email sent failed"
 },
 {
  "doc": "noodl.cloud.response",
  "fam": "outcome",
  "renamed": "response sent -> done (2026-08-02)",
  "q_new": "done output after replying to the caller of a cloud function",
  "q_old": "sent output after replying to the caller of a cloud function",
  "kw_new": "response done",
  "kw_old": "response sent"
 },
 {
  "doc": "Event Sender",
  "fam": "outcome",
  "renamed": "Event Sender sent -> done (2026-08-02)",
  "q_new": "done signal after broadcasting an event",
  "q_old": "sent signal after broadcasting an event",
  "kw_new": "event sender done",
  "kw_old": "event sender sent"
 },
 {
  "doc": "Unique Id",
  "fam": "outcome",
  "renamed": "Unique Id generated -> done (2026-08-02)",
  "q_new": "done output after making a unique identifier",
  "q_old": "generated output after making a unique identifier",
  "kw_new": "unique id done",
  "kw_old": "unique id generated"
 },
 {
  "doc": "SetModelProperties",
  "fam": "outcome",
  "renamed": "SetModelProperties stored -> done (2026-08-02)",
  "q_new": "done signal after writing properties onto an object",
  "q_old": "stored signal after writing properties onto an object",
  "kw_new": "set properties done",
  "kw_old": "set properties stored"
 },
 {
  "doc": "net.noodl.SetComponentObjectProperties",
  "fam": "outcome",
  "renamed": "SetComponentObjectProperties stored -> done (2026-08-02)",
  "q_new": "done output after setting properties on the component object",
  "q_old": "stored output after setting properties on the component object",
  "kw_new": "component object properties done",
  "kw_old": "component object properties stored"
 },
 {
  "doc": "CollectionNew",
  "fam": "outcome",
  "renamed": "CollectionNew created -> done (2026-08-02)",
  "q_new": "done signal after making a new collection",
  "q_old": "created signal after making a new collection",
  "kw_new": "new collection done",
  "kw_old": "new collection created"
 },
 {
  "doc": "NewModel",
  "fam": "outcome",
  "renamed": "NewModel created -> done (2026-08-02)",
  "q_new": "done output after making a new object",
  "q_old": "created output after making a new object",
  "kw_new": "new object done",
  "kw_old": "new object created"
 },
 {
  "doc": "AddDbModelRelation",
  "fam": "outcome",
  "renamed": "AddDbModelRelation relationAdded -> done (2026-08-02)",
  "q_new": "done output after adding a relation between two records",
  "q_old": "relation added output after adding a relation between two records",
  "kw_new": "add relation done",
  "kw_old": "add relation added"
 },
 {
  "doc": "DeleteDbModelProperties",
  "fam": "outcome",
  "renamed": "DeleteDbModelProperties deleted -> done (2026-08-02)",
  "q_new": "done signal after removing a record from cloud data",
  "q_old": "deleted signal after removing a record from cloud data",
  "kw_new": "delete record done",
  "kw_old": "delete record deleted"
 }
]
if __name__=='__main__':
    docs={d['id'] for d in json.load(open(HERE + '/corpus.json'))}
    missing=[e['doc'] for e in EVAL if e['doc'] not in docs]
    print(f'{len(EVAL)} eval items over {len({e["doc"] for e in EVAL})} distinct documents')
    print('families:', {f: sum(1 for e in EVAL if e['fam']==f) for f in {e['fam'] for e in EVAL}})
    print('MISSING FROM CORPUS (must be empty):', missing)
