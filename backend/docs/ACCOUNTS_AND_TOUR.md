# Accounts, readability, and optional walkthrough

This update remains local-only. No push or deployment was performed.

## Account access

The first screen offers **Sign in**, **Create account**, and, in demo environments, **Explore the demo**. Registration creates a persistent creator account in the server database. It does not let a visitor choose manager/admin privileges. New accounts use a display name, normalized email, and a password of 12–128 characters. The confirmation field is checked before submitting.

Passwords are salted with a fresh cryptographic salt and stored as PBKDF2-SHA256 hashes (600,000 iterations), never as plaintext. Signed HttpOnly, SameSite=Strict session cookies expire after eight hours; authenticated production uses Secure cookies and requires HTTPS. Display names and email are returned to their signed-in account, while hashes are never exposed through these endpoints. Sign out clears the cookie and the visible private workspace state.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | `{name,email,password}` → creator identity + session, 201 |
| POST | `/api/v1/auth/login` | `{email,password}` → identity + session, 200 |
| GET | `/api/v1/auth/me` | Restores a valid authenticated session |
| POST | `/api/v1/auth/logout` | Clears the session cookie |

Duplicate normalized emails return 409. Invalid fields/short passwords return 422. Invalid credentials return 401. Registration is available in local `DEMO_MODE=true`; in authenticated production it is closed by default, with explicit `ALLOW_REGISTRATION=true` required to open it. Bootstrap manager/admin accounts continue to come from `BRANDGUARD_USERS`.

Real signed-in accounts cannot elevate privileges by sending `X-Demo-Role`. Simulated demo reviewers cannot read registered-account reviews. Real creators can only read their own reviews; authorized real managers/admins review the shared organization's submissions. This remains a single-organization product, not a multi-tenant SaaS.

Browser-only fallback does not create fake accounts or store passwords in localStorage. It explains that the backend is needed for accounts and offers a separate sample-data demo. Demo persona switching is available only after explicitly choosing the demo.

Email verification, password reset, SSO, and account management are not implemented. Do not treat local demo mode as an internet-facing authentication boundary. Use the production configuration and checks in the main README for a sensitive deployment.

## Optional walkthrough

Select **Take a tour** in the top navigation (shown as **Tour** on narrow screens). It never starts after sign-in, registration, or reload. Five steps explain drafting, guidelines, auditing, suggestion decisions, and manager handoff. Controls include Back, Next, step selection, Skip, Finish, close, and Escape. The modal traps keyboard focus with a native dialog and restores focus when closed. Existing draft content is not modified; the previous workspace page is restored. The tour can be replayed anytime.

## Readability

The base font is 15px, the smallest pre-existing workspace labels were raised to 13px, prose/findings use 15–17px, and account fields use 16px. Primary controls use at least 14px text. Responsive wrapping was added to metadata, findings, and controls so larger text can fit phone-sized layouts in both themes.

## Verification

The automated account suite covers hashed persistent registration, normalized duplicate detection, validation, login, sign-out, cookie settings, registration configuration, demo-header privilege boundaries, creator ownership, and malformed cookies. UI checks exercise account creation, session restoration, optional-only tour entry, Back/Next, Skip, focus restoration, and completion. The existing review workflow suite remains part of `backend/scripts/check.ps1`.
