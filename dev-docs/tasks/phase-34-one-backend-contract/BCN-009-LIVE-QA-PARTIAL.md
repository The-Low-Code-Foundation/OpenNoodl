# BCN-009 — live QA, partial

**Run 2026-07-31 from the primary checkout at `35c6f3db`.** Steps 1–2 of the eleven in
[BCN-009-NOTES.md](./BCN-009-NOTES.md) §7. Steps 3–11 not run — see §3.

This is the **first time any of BCN-009's UI has been rendered**. Its §6.1 recorded "no
screenshot, no click, no confirmation that any of the new UI renders at all", and §6.5
recorded that no CSS had been seen. Both are now partly answered.

---

## 1. What passed

### Step 1 — the panel

| Expected (§7.1) | Observed |
|---|---|
| Exactly one section, titled **Backends**. Not three | ✅ One section, one `+` in its header |
| The disclosure on every card | ✅ On both the endpoint card and the local backend card |
| `LocalBackendCard` reads "Built-in • Port N", not "Local SQLite • Port N" | ✅ "Built-in • Port 8578" — deviation #6 confirmed live |
| The endpoint card carries its own disclosure and status | ✅ "Deployed built-in backend — supports realtime", `ACTIVE` badge |

### Step 2 — the add dialog

All six preset hooks are present and mounted:

`preset-nodegx` · `preset-parse` · `preset-directus` · `preset-supabase` · `preset-pocketbase` · `preset-custom`

as are `add-backend-security` (the disclosure), `add-managed-backend` ("Run one on this
computer") and `add-endpoint-backend` ("Connect to a deployed one") — i.e. **no REST form
while Built-in is selected**, which is deviation #3's hand-off behaving as designed.

## 2. Two of §6's open questions, answered

- **§6.5 — "whether the disclosure block reads as informational rather than as an error."**
  It reads as informational. The block is azure-tinted with a `?` glyph and a chevron, and
  carries no red or amber anywhere. The "why none of it is red" argument in §1 survives
  contact with the rendered result.
- **§6.5 — "whether the endpoint card's `ACTIVE` badge collides with a long app id."**
  It does not. `backend_mkgmvdcayltzq` and the badge coexist on one row at ~500px panel
  width.

### Still open from §6.5–6.6

- **Narrow width was not tested.** The panel was at its default width, not 240px.
- **§6.6 — `IconName.QuestionFree`.** It renders as a `?` in a circle. My reading is that it
  does say "help, click me" rather than "here is a fact", which is the risk the note names —
  but it is one line to change and it is Richard's call, not a defect.

## 3. Why steps 3–11 were not run

Another session was doing **BCN-003b live QA in the same checkout at the same time**. It had
a temporary scaffold in `packages/noodl-editor/src/editor/src/utils/schemahandler.ts`
(`// BCN-003b LIVE QA SCAFFOLD — REVERT BEFORE COMMITTING`) and relaunched the editor at
16:41:08, which is what bounced this script back to the launcher mid-step-2.

Two sessions cannot drive one Electron instance — it takes a single-instance lock — and any
edit under `packages/` rebuilds and reloads the other session's editor. Stopped rather than
corrupt their run.

**The observations above are still sound:** they were made at 16:33–16:36 on this same
commit, and the other session's scaffold is inside `SchemaHandler._fetch`, which the Backend
Services panel's rendering does not go through.

⚠️ **A transient worth not mis-filing.** During the reload every `data-test` hook briefly
appeared **twice**, at identical coordinates, both laid out. That is two React trees
coexisting across a reload, **not** a duplicated dialog. Recorded here because it looks
exactly like a real defect and the next person to see it should not spend time on it.

## 4. Still owed

Steps 3–11, which need exclusive editor access:

3. Supabase selected → disclosure changes to the Row Level Security one, REST form appears,
   Public API Key note reads "Published with your app…" with **no ⚠️ glyph**
4. Parse Server → form disappears, one hand-off button; the "deployed built-in backend"
   tickbox swaps the disclosure text
5–6. Create a local backend, start it, confirm the endpoint card auto-fills and **Data**
   still opens the record grid
7. Directus card → `⋯` menu has **Browse records** disabled with the reason on it
8–9. The switch dialog, including the case that proves the token-change line is not
   boilerplate (Directus → Supabase shows **no** note; → Custom **does**)
10–11. Confirm the switch, relaunch, and confirm the list, the active marker and the
    collapsed disclosure survive

Also still owed from the same batch, and unrelated to this task's UI:

- **BCN-006** — login → log out → sign up → reset password. The XHR branch every viewer runs
  is reached by no unit test.
- **BCN-007** — a real upload against a running backend. `contentType` and `size` are
  asserted from a literal fixture and **no 201 has ever been observed**.
