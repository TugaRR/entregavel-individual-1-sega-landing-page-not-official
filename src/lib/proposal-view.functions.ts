import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Read-only fetch of one proposal for the public proposal page. Uses the
 * public Firebase web config via Firestore REST (subject to Firestore rules);
 * returns only display fields. Nothing here writes or recalculates.
 */

export type ProposalView = {
  id: string;
  name: string;
  email: string;
  request: string;
  created_at: string | null;
  status: string;
  summary: string | null;
  selected_services: Array<{ name: string; price: number; reason: string }>;
  total_price: number;
};

export type ProposalViewResult =
  | { ok: true; proposal: ProposalView }
  | { ok: false; reason: "not_found" | "not_ready" | "unavailable" };

type V = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, V> };
  arrayValue?: { values?: V[] };
};

const s = (v?: V) => v?.stringValue ?? "";
const n = (v?: V) => {
  const x = Number(v?.integerValue ?? v?.doubleValue ?? v?.stringValue ?? NaN);
  return Number.isFinite(x) ? x : 0;
};

export const getProposal = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<ProposalViewResult> => {
    const projectId = process.env["VITE_FIREBASE_PROJECT_ID"] ?? import.meta.env["VITE_FIREBASE_PROJECT_ID"];
    const fbKey = process.env["VITE_FIREBASE_API_KEY"] ?? import.meta.env["VITE_FIREBASE_API_KEY"];
    if (!projectId || !fbKey) return { ok: false, reason: "unavailable" };
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/proposals/${data.id}?key=${fbKey}`,
      );
      if (res.status === 404) return { ok: false, reason: "not_found" };
      if (!res.ok) {
        console.error(`[proposal-view] Firestore ${res.status}: ${await res.text()}`);
        return { ok: false, reason: "unavailable" };
      }
      const f = ((await res.json()) as { fields?: Record<string, V> }).fields ?? {};
      const status = s(f["status"]);
      if (status !== "proposal_ready" && status !== "calculated") return { ok: false, reason: "not_ready" };
      const services = (f["selected_services"]?.arrayValue?.values ?? []).map((v) => {
        const m = v.mapValue?.fields ?? {};
        return { name: s(m["name"]), price: n(m["price"]), reason: s(m["reason"]) };
      });
      return {
        ok: true,
        proposal: {
          id: data.id,
          name: s(f["name"]),
          email: s(f["email"]),
          request: s(f["request"]),
          created_at: f["created_at"]?.timestampValue ?? null,
          status,
          summary: f["interpreted_request"]?.mapValue?.fields?.["summary"]?.stringValue ?? null,
          selected_services: services,
          total_price: n(f["total_price"]),
        },
      };
    } catch (e) {
      console.error("[proposal-view] fetch failed", e);
      return { ok: false, reason: "unavailable" };
    }
  });
