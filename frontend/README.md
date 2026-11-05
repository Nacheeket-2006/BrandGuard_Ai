# BrandGuard AI · Frontend

React 19 + TypeScript + Tailwind CSS 4 + Vite. An editorial bento workspace with creator, guideline admin, and manager flows. OLED black and warm-paper light themes use shared design tokens, crisp structural borders, and vintage serif accents. All application files live under the two top-level folders `frontend/` and `backend/`.

## Start the complete application

See [backend setup](../backend/README.md). The FastAPI server serves the built UI and API on the same origin.

From the repository root, for frontend development:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

Vite prints the local URL, normally `http://127.0.0.1:5173`. API calls proxy to FastAPI on port 8000.

```powershell
npm --prefix frontend run build
npm --prefix frontend test
```

## Offline browser demonstration

If the API is unavailable on initial load, the app visibly enters **Browser demo** mode. It uses deterministic shared sample rules and localStorage; there is no LLM or semantic vector retrieval in this mode. API failures after connection do not silently switch data stores. Refresh after starting the backend to connect it.

1. Choose **Explore the demo** from the account screen, then run Compliance Audit on the supplied sample.
2. Click a highlighted phrase to focus its finding.
3. Accept each rewrite and see the score increase to 100.
4. Send for manager approval and add context.
5. Switch to Manager view, open the queue, inspect the word diff and audit trail, and approve.
6. Switch back to Creator, open Review history, and inspect the locked approved revision.

Rejecting a suggestion preserves the wording and score penalty. It can be handed to a manager with context but cannot be approved until resolved. Reopen a rejected suggestion to reconsider it. Editing text or asset metadata marks findings stale and requires another audit. Re-audits create a new review; older reviews remain in history.

Browser demo persona switching is a simulation, not authentication. Production sessions and role checks are enforced by FastAPI. Browser storage is local to a browser profile and is not shared between people or devices. Avoid sensitive documents in shared browser profiles.

## Interface

- **Review workspace:** text editor/review toggle, inline severity highlights, cited suggestion cards, filtering, score ring, visual metadata and optional artwork.
- **Brand guidelines:** searchable source library; managers/admins upload PDF, Markdown, TXT, or JSON and activate/deactivate sources. Browser demo supports Markdown/TXT/JSON; PDF requires the backend.
- **Approvals:** manager queue, original/current word diff, creator notes, visual coverage, tracked decisions, request-changes and sign-off actions.
- **Review history:** persisted reviews and exportable JSON audit report.
- **Workspace settings:** engine disclosure and transparent scoring explanation.
- **Account access:** sign in or register a backend-persisted creator account, or explicitly explore the demo. Passwords are never stored by the browser fallback.
- **Optional walkthrough:** use Take a tour in the navigation. Back, Next, Skip, Finish, and Escape are supported. It never starts automatically after account access.

Keyboard: `Ctrl+Enter` / `Cmd+Enter` runs an audit for creators. Controls have labels, focus states, and responsive layouts; reduced-motion preferences are respected. No external fonts, analytics, or stock media are loaded.

## Source map

`main.tsx` holds the application views; `api.ts` is the typed API boundary; `offline.ts` supplies the browser-only fallback; `types.ts` defines contracts; `shared/` contains synthetic sample data consumed by both frontend and backend. `style.css` provides the design system and responsive rules with Tailwind imported through Vite.

## Services and attribution

React/React DOM, Tailwind CSS, Vite, TypeScript, Lucide icons (ISC), jsdiff (BSD-3-Clause), and Vitest. Version resolution is pinned in `package-lock.json`. No external datasets, pretrained local models, or third-party UI templates are used. Guideline facts and sample campaign copy are invented demo data, not actual corporate claims.

## Themes and local UI review

Use the Light/Dark buttons in the top navigation. The choice is stored under `brandguard-theme` in this browser. `public/theme-init.js` restores it before the page paints; `ThemeToggle.tsx` updates accessible pressed states and browser chrome. The theme applies to all views, form controls, highlights, badges, and feedback cards. Reduced-motion and keyboard focus styles are supported.

Edit semantic colors in the `:root` and `[data-theme="light"]` blocks of `style.css`. Bento proportions and responsive breakpoints are defined in the same stylesheet. No external font downloads are needed.

```powershell
npm --prefix frontend run format
npm --prefix frontend run format:check
```

The current UI update is local-only. See [GitHub handoff](../backend/docs/GITHUB_HANDOFF.md) for a clean two-folder source archive and repository preparation.
