# Puppy test 3

Exported from NodeGX.

## Run

```
npm install
npm run dev
```

## Backend

This app talks to the project's NodeGX backend through `src/api/client.ts`. Two environment
variables configure it, with the project's own values as defaults:

- `VITE_NODEGX_ENDPOINT` — the backend's base URL (default: `http://localhost:8581`)
- `VITE_NODEGX_APP_ID` — the backend's application id (default: `backend_msjck0y2ukxwv`)

Copy `.env.example` to `.env` to point at another deployment; no generated code needs editing.
