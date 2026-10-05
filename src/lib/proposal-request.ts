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

export type ProposalRequestRecord = ProposalRequestValues & { id: string };

/** Firestore collection name. */
export const PROPOSAL_COLLECTION = "proposals";

/**
 * Validates and saves a request to Firestore. No price calculation, AI,
 * email sending or proposal generation happens here.
 */
export async function submitProposalRequest(
  values: ProposalRequestValues,
): Promise<{ ok: true; record: ProposalRequestRecord }> {
  const parsed = proposalRequestSchema.parse(values);
  const { getDb } = await import("@/lib/firebase");
  const db = await getDb();
  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
  const ref = await addDoc(collection(db, PROPOSAL_COLLECTION), {
    name: parsed.name,
    email: parsed.email,
    request: parsed.request,
    status: "received",
    created_at: serverTimestamp(),
  });
  return { ok: true, record: { ...parsed, id: ref.id } };
}
