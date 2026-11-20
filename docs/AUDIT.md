# Repository Audit — abdulls95/members

Date: 2026-11-20 · Auditor: Claude (lead engineer, CORNOD)

## State before CORNOD

| Item | Value |
|---|---|
| Default branch | `main` |
| HEAD | `76cfa9d40a59017c30c00fdcab17068ad8212437` ("Update index.html") — matches the last documented state |
| Files | `index.html` (83 KB, single-file app), `.github/workflows/main.yml`, `.github/workflows/static.yml` |
| Live site | https://abdulls95.github.io/members/ (GitHub Pages) |

## Findings

1. **Old app:** `index.html` was the Arabic "مجموعة آل عامر شجاع — نظام المساهمين" contributions app (roles UI v5, 2026-10-03), talking directly to Supabase project `ovzjhaykcrtvyoxneydc`.
2. **Supabase key:** the embedded key is a `sb_publishable_…` key (public by design, protected by RLS). Not a leaked secret. CORNOD does **not** reuse it and makes **no** calls to that project. The Supabase database was not touched.
3. **Duplicate deploy workflows:** `main.yml` and `static.yml` both deployed the whole repository root to Pages on every push to `main`, sharing one concurrency group. Any push to `main` was an immediate public release.
4. **Whole-repo upload:** both workflows published `path: "."`, so every file in the repo (docs, backend code) would be served publicly.

## Actions taken (branch `cornod/foundation`)

- Removed the old `index.html` and both workflows (the owner authorized replacing the site). They remain recoverable from git history at `76cfa9d`.
- New single workflow `.github/workflows/pages.yml`: deploys **only `site/`**, and is **manual-only** (`workflow_dispatch`). Merging to `main` will not publish anything until the owner runs it.
- New `ci.yml` runs the test suite on pushes and PRs. It does not deploy.

## Out of scope / untouched

- `abdulls95/shugaa-family-tree`: not cloned, not read, not modified.
- Supabase: no reads, writes or schema changes.

## Access

- Clone/read: ✅
- Push: ❌ The Claude GitHub App is not installed for this account. Delivery is a ZIP until access is granted.
