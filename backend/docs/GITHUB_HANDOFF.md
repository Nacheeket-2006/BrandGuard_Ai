# GitHub-ready source handoff

The project keeps application source, supporting docs, checks, and configuration within `frontend/` and `backend/`, with a GitHub landing-page `README.md` at the repository root. The current changes are local only: nothing has been committed, pushed, or deployed.

## What is ready

- React/TypeScript source with a shared OLED/paper design system and persistent accessible light/dark controls.
- Locked JavaScript and Python dependencies, example backend environment variables, Docker/Compose packaging, synthetic fixtures, and review workflow tests.
- Frontend formatting commands and a combined Windows validation script, `backend/scripts/check.ps1`.
- Per-folder ignore rules for environments, API credentials, local databases, dependencies, caches, build outputs, and generated archives.
- Architecture, API contracts, setup, limitations, demonstration steps, validation evidence, and a user feedback protocol in the READMEs and `backend/docs/`.

## Prepare the clean source

From the current project root:

```powershell
backend/.venv/Scripts/python backend/scripts/package_source.py
```

The result is `backend/output/brandguard-ai-source.zip`. It contains the root `README.md` plus `frontend/` and `backend/`; environments, runtime databases, `.env`, Git metadata, and the old Sites identity are excluded. Generated ZIPs do not recursively include themselves.

The working project uses one root Git repository; frontend files are tracked directly. Previous frontend Git metadata is preserved locally under ignored `backend/tmp/` and is excluded from the archive. Root `.gitignore` and `.gitattributes` are included in the archive for consistent exclusions and LF line endings.

From the extracted directory:

```powershell
git init
git add .
git diff --cached --stat
git status --short
```

Review the staged files, then commit and set a GitHub destination of your choice. Do not add real `.env` files, API keys, session secrets, customer documents, or runtime databases. No GitHub remote, account, license, repository visibility, or branch protections have been chosen on your behalf.

## Validate before publication

Follow `backend/README.md` to install dependencies, then run:

```powershell
backend/scripts/check.ps1
```

The script checks formatting, frontend tests, the production build, and backend workflow tests. Windows sandbox environments may need loopback permission for Python asyncio. These checks do not deploy the app or exercise paid AI APIs. Docker, PostgreSQL, external provider quality, and production security remain separate validation items.

## Preview the UI without deploying

```powershell
npm --prefix frontend run dev
```

Open the printed local URL, normally `http://127.0.0.1:5173`. Vite reloads saved code automatically. The light/dark control is at the top right; the chosen theme survives reloads. Start FastAPI separately for full ingestion/RAG, or use the clearly labeled browser demo for UI review.

## Suggested repository description

BrandGuard AI — a React 19 and FastAPI brand-governance MVP with guideline retrieval, cited compliance feedback, non-destructive revisions, and manager sign-off. Includes an offline demo and OLED/paper themes.

Choose an appropriate license and any public sharing policy before publishing. A GitHub Actions workflow has not been installed because that requires a third top-level `.github/` folder; the supplied check script provides the validation commands while preserving the requested two-folder structure.
