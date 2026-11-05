# Round 2 demonstration

## Three-minute creator-to-manager walkthrough

1. Start FastAPI using the backend README and open `http://127.0.0.1:8000`.
2. Choose **Explore the demo** on the account screen. In Creator view, use the prefilled synthetic LinkedIn draft. Run Compliance Audit. Expected: five findings, alignment **54%**. The optional **Take a tour** control explains the workflow when selected; it does not open automatically.
3. Click `revolutionary` in the text. Its tone finding is selected. Open its citation to inspect the active source; return to Review workspace.
4. Accept the rewrite. Alignment rises to **61%**; the original remains stored. Accept the remaining four findings. Alignment reaches **100%**.
5. Send for manager approval; add launch context and submit. The revision is now locked.
6. Switch to Manager view, open the submitted item, and compare removed/added wording with the event trail. Add optional notes and approve for publication.
7. Verify the status is **approved**. Export audit JSON. No external publishing occurs.

## Negative-path demonstration

Create another review. Reject a suggestion; wording and penalty remain. Reopen the suggestion to reconsider. Open findings block handoff; rejected findings allow contextual handoff but prevent final approval. In Manager view add feedback and request changes. A guideline change invalidates old sign-offs and requires a fresh audit.

## Guideline administration

Switch to Admin. Upload `backend/example-guideline.json`. In Creator view audit `This is awesome.` and verify that the replacement and Section 8.1 citation come from the uploaded source. Deactivate the guideline, rerun, and observe that it is no longer enforced. PDF upload requires the backend and readable text.

## Visual demonstration

Open Add visual asset. Declare color `#FF0000` and logo position `center`. Run an audit and verify the visual identity findings. These cannot be fixed by accepting a text rewrite; change the artwork/metadata and run again. Offline mode does not inspect pixels. Image attachments require live Vision review before sign-off.

## Submission checklist

- Functional local application and source package are supplied.
- Architecture, APIs, provider configuration, dependencies, and limitations are in the two READMEs.
- Structured verification evidence is in VALIDATION.md.
- External user feedback is not yet collected; use FEEDBACK.md with actual participants.
- A public/judge-accessible GitHub repository still needs to be created/shared by the owner. No GitHub account connection or repository destination was provided. The source archive is suitable for initializing it.
- A hosted browser demo, when linked at delivery, demonstrates the UI/local rules workflow. It does not host the Python backend or claim live semantic/image review.
