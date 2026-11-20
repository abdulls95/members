# Deployment

## Frontend (GitHub Pages)
1. Merge `cornod/foundation` into `main`. **This does not publish anything.**
2. Make sure CI is green.
3. When the owner approves the launch, go to Actions → **Deploy CORNOD to Pages** → Run workflow, then type `DEPLOY`.
4. The site is served at `https://abdulls95.github.io/members/`. The app uses relative paths and hash routing, so the `/members/` sub-path works as is.

Note: until step 3 runs, the old contributions page that is already deployed stays live. To take it down without launching CORNOD, go to Settings → Pages and unpublish, or switch the source.

## Local
```bash
npm test                     # unit tests
npm run test:e2e             # browser smoke test (needs Playwright + Chromium)
npx http-server site -p 8080 # or any static server, then open http://localhost:8080
```

## Backend
Not deployable yet. See `backend/README.md`.
