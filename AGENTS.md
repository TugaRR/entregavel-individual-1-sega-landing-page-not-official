<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep this project as a single-page SEGA-inspired discovery concept with official outbound links; the source brief provides marketing structure, not a live catalog or sign-up service.
- The "Request a Proposal" form saves to Firestore collection `proposals` via `submitProposalRequest` (src/lib/proposal-request.ts), with Firebase config from `VITE_FIREBASE_*` env vars in src/lib/firebase.ts loaded by dynamic import; no price calculation, AI, email sending or proposal generation. Why: storage only for now, and Firebase must stay out of SSR.
