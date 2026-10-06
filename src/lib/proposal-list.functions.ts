import { createServerFn } from "@tanstack/react-start";

/**
 * Read-only list of all proposals for the internal dashboard, via Firestore
 * REST with the public web config (subject to Firestore rules). Only reads
 * saved fields; never recalculates or writes.
 */

export type ProposalRow = {
  id: string;
  name: string;
  email: string;
  request: string;
  total_price: number | null;
  status: string;
  created_at: string | null;
  email_sent: boolean | null;
  proposal_url: string | null;
};

export type ProposalListResult =
  | { ok: true; proposals: ProposalRow[] }
  | { ok: false; reason: "permission_denied" | "unavailable" };

type V = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
};
type Doc = { name: string; createTime?: string; fields?: Record<string, V> };

const num = (v?: V) => {
  if (!v) return null;
  const x = Number(v.integerValue ?? v.doubleValue ?? v.stringValue ?? NaN);
  return Number.isFinite(x) ? x : null;
};

export const listProposals = createServerFn({ method: "GET" }).handler(async (): Promise<ProposalListResult> => {
  const projectId = process.env["VITE_FIREBASE_PROJECT_ID"] ?? import.meta.env["VITE_FIREBASE_PROJECT_ID"];
  const fbKey = process.env["VITE_FIREBASE_API_KEY"] ?? import.meta.env["VITE_FIREBASE_API_KEY"];
  if (!projectId || !fbKey) return { ok: false, reason: "unavailable" };
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/proposals`;
  const rows: ProposalRow[] = [];
  try {
    let pageToken = "";
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${base}?pageSize=300&key=${fbKey}${pageToken ? `&pageToken=${pageToken}` : ""}`);
      if (res.status === 403) {
        console.error(`[dashboard] Firestore 403: ${await res.text()}`);
        return { ok: false, reason: "permission_denied" };
      }
      if (!res.ok) {
        console.error(`[dashboard] Firestore ${res.status}: ${await res.text()}`);
        return { ok: false, reason: "unavailable" };
      }
      const body = (await res.json()) as { documents?: Doc[]; nextPageToken?: string };
      for (const d of body.documents ?? []) {
        const f = d.fields ?? {};
        rows.push({
          id: d.name.split("/").pop() ?? "",
          name: f["name"]?.stringValue ?? "",
          email: f["email"]?.stringValue ?? "",
          request: f["request"]?.stringValue ?? "",
          total_price: num(f["total_price"]),
          status: f["status"]?.stringValue ?? "unknown",
          created_at: f["created_at"]?.timestampValue ?? d.createTime ?? null,
          email_sent: typeof f["email_sent"]?.booleanValue === "boolean" ? f["email_sent"].booleanValue : null,
          proposal_url: f["proposal_url"]?.stringValue || null,
        });
      }
      if (!body.nextPageToken) break;
      pageToken = encodeURIComponent(body.nextPageToken);
    }
  } catch (e) {
    console.error("[dashboard] fetch failed", e);
    return { ok: false, reason: "unavailable" };
  }
  rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return { ok: true, proposals: rows };
});
