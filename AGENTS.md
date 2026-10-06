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
- Proposal AI step: `interpretProposalRequest` server fn (src/lib/proposal-ai.functions.ts) reads GEMINI_API_KEY server-side, loads names from Firestore `services` via REST, constrains Gemini output to those names, and then prices matched services from Firestore `services.price` server-side and PATCHes only interpreted_request, selected_services, unmatched_services, total_price and status. Why: key must never reach the browser.
- Proposal page: /proposal/$proposalId reads one proposal via `getProposal` server fn (src/lib/proposal-view.functions.ts, Firestore REST, read-only) and shows saved selected_services/total_price without recalculating; interpretProposalRequest writes proposal_url + status "proposal_ready" after pricing. Why: page must only display stored data.
