# Verification evidence

Validated locally on Windows, 5 November 2026 (Asia/Kolkata). These are observed engineering checks, not external user testing or hosted production certification.

## Automated checks

- React/TypeScript production build: passed, Vite output in `frontend/dist`.
- Browser demo contract: **3 Vitest tests passed**, covering UTF-16 offsets after emoji, repeated terms, rejected-score behavior, and active-source filtering.
- Backend workflow suite: **17 tests passed**. Tests exercise complete creator-to-manager sign-off, rejected-risk handling, out-of-order replacements after emoji, duplicate/stale decisions, open-finding handoff prevention, policy-change invalidation, role checks, structured source ingestion, Markdown parsing, invalid PDF/image handling, origin checks, clean approved facts, secure session/ownership enforcement, no-active-source failure, final verification of rewrites, image-coverage gates, provider-failure behavior, and event revision numbers.
- Dependency audit: `npm audit` reports zero known vulnerabilities after updating diff/Vitest. This is a registry audit of installed JavaScript dependencies, not a full security audit.

Windows sandbox restriction: asyncio's loopback socket initialization was blocked. Backend tests and local Uvicorn were run with approved loopback access; the first blocked attempt is not counted as an application failure.

## Browser walkthrough

Using the in-app browser against the real local FastAPI server:

1. Sample campaign produced five findings and a score of **54**.
2. Clicking the inline tone highlight selected the corresponding suggestion.
3. Accepting the first rewrite updated the score to **61** and updated only that text span.
4. Accepting all five yielded **100**.
5. Creator supplied context and submitted revision 7.
6. Manager opened the approval queue, inspected the word diff and event trail, added a sign-off note, and approved revision 8.
7. Approval controls became disabled on the signed-off revision.
8. Guideline library displayed all four active sources, citations, approved palette, and disabled creator administration controls.
9. A 390-pixel mobile viewport stacked the editor and analysis panels and showed no horizontal content overflow. The measured document width was 375 pixels inside the 390-pixel viewport (scrollbar space).

Screenshots are saved in `screenshots/workspace.png`, `screenshots/manager-approved.png`, and `screenshots/mobile.png`. Browser QA revealed an event-version display discrepancy; this was corrected and covered by a regression test. The saved initial manager screenshot predates that correction; current event numbering uses the resulting revision.

## Not executed / not claimed

- No paid OpenAI requests, semantic quality benchmark, or provider-backed vision evaluation.
- No Pinecone integration (FAISS is used).
- No Docker/Compose execution or PostgreSQL test run.
- No public GitHub repository creation; no destination/account was provided.
- No external user testing, screen-reader certification, penetration test, load test, backup/restore drill, or legal compliance certification.
- Hosted browser-demo publication is distinct from hosting the FastAPI service. See the final delivery status for the verified demo link.


## Accounts and optional walkthrough update

Local-only update on 5 November 2026: the expanded backend suite passes **22 tests**, with **3 frontend tests**, formatting checks, and the production build also passing. Registration/login tests cover persisted hashes, duplicates and invalid inputs, creator-only role assignment, demo/real review isolation, secure production cookies, and closed-by-default production registration.

In the browser, a synthetic local account registered, signed out, signed back in, and restored its session after reload. No tour dialog appeared automatically in any of those transitions. Manual tour entry, Back/Next, step selection, Skip, replay, Finish, Escape, and focus restoration were checked. A 390-pixel viewport showed no horizontal overflow for the account form or workspace; draft text computed to 17px. The preview remains local and no publishing occurred. See ACCOUNTS_AND_TOUR.md for the feature details.
