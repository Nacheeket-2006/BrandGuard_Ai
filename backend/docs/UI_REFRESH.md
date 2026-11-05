# Local UI refresh · 5 November 2026

Status: local preview and source only. This revision has not been pushed or deployed. The previously published Site remains on its earlier UI.

## Visual system

- **OLED dark:** true `#000000` canvas, near-black panels, cream text, violet primary controls, and muted cyan/green bento tiles.
- **Vintage light:** warm paper canvas (`#F1EFE7`), ink text, restrained pastel tiles, serif document typography, monospace labels, structural borders, and offset button shadows.
- **Hybrid bento:** one larger workspace metric and two compact metrics above the asymmetric editor/analysis grid. Small screens stack the work panels; phones use a full-width hero metric above two smaller cards.
- Both themes apply to guidelines, findings, highlights, badges, forms, history, manager diffs, and sign-off views. The top-right theme control supports keyboard focus and accessible pressed states. The browser remembers the preference; restoration runs before first paint.

## Source locations

- `frontend/style.css`: semantic colors, bento proportions, component styling, responsive breakpoints, and reduced-motion rules.
- `frontend/ThemeToggle.tsx`: theme control and persisted preference.
- `frontend/public/theme-init.js`: pre-paint preference restoration.
- `frontend/main.tsx`: theme control placement in navigation and login.
- `frontend/vite.config.ts`: development API proxy is restricted to `/api/v1` so it cannot intercept the `api.ts` source module.
- `backend/main.py`: serves the external startup script in a built FastAPI installation.

## Verified locally

- Frontend formatting check passed.
- TypeScript/Vite production build passed.
- 3 frontend tests and 17 backend tests passed. One upstream Starlette/HTTPX deprecation warning remains.
- Light preference survived page reload; both palette states were inspected in the browser. The OLED canvas computed to `rgb(0, 0, 0)` and the paper canvas to `rgb(241, 239, 231)`.
- Real local FastAPI review returned the expected five sample findings and alignment 54. Accepting a rewrite produced four open findings and alignment 61 after the visual refresh.
- Desktop layout geometry at 1440 pixels retained the two-column review grid without horizontal overflow. A 390-pixel phone viewport had a 375-pixel document width and the compact bento arrangement.
- Light and dark guideline libraries were visually inspected. Screenshots: `screenshots/ui-light.png` and `screenshots/ui-dark.png`.

The local preview uses Vite at `http://127.0.0.1:5173` and FastAPI at `http://127.0.0.1:8000`. Keep those terminals running while reviewing. See `GITHUB_HANDOFF.md` for source preparation and `backend/scripts/check.ps1` for local validation.
