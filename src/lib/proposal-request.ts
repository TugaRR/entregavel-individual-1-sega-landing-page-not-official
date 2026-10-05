import { z } from "zod";

/**
 * Single source of truth for the "Request a Proposal" form.
 *
 * The same schema is used by the client form (zodResolver) and by the submit
 * helper below, so the validation rules stay in one place once the form is
 * wired to Firestore.
 */
export const proposalRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Please enter your name." })
    .max(100, { message: "Name must be less than 100 characters." }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Please enter your email." })
    .email({ message: "Please enter a valid email address." })
    .max(255, { message: "Email must be less than 255 characters." }),
  request: z
    .string()
    .trim()
    .min(1, { message: "Please describe what you need." })
    .max(2000, { message: "Request must be less than 2000 characters." }),
});

export type ProposalRequestValues = z.infer<typeof proposalRequestSchema>;

/**
 * Shape of one stored request. Firestore field names are declared here so the
 * future `setDoc` call and this app can never drift apart.
 */
export type ProposalRequestRecord = ProposalRequestValues & {
  id: string;
  createdAt: string;
  source: "sega-landing-page";
  status: "new";
};

/** Firestore collection name for future integration. */
export const PROPOSAL_COLLECTION = "proposal_requests";

/**
 * Validates a request and returns the record that would be stored.
 *
 * NOT YET CONNECTED TO FIREBASE — no price calculation, no AI interpretation,
 * no email sending and no proposal generation happens here.
 *
 * When Firestore is added, this is the only function that needs to change:
 * create the Firebase app in a browser-safe module (dynamic import, never at
 * module scope of an SSR route) and replace the return with
 * `await setDoc(doc(db, PROPOSAL_COLLECTION, record.id), record)`.
 */
export async function submitProposalRequest(
  values: ProposalRequestValues,
): Promise<{ ok: true; record: ProposalRequestRecord }> {
  const parsed = proposalRequestSchema.parse(values);

  const record: ProposalRequestRecord = {
    ...parsed,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: "sega-landing-page",
    status: "new",
  };

  return { ok: true, record };
}
