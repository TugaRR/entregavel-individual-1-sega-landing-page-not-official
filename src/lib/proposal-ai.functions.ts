import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Server-only AI step: interprets a saved proposal request with Gemini and
 * writes `interpreted_request` onto the proposal document. GEMINI_API_KEY is
 * read inside the handler only, so it never reaches the browser bundle.
 * Also prices the selected services from Firestore `services.price` (never
 * from Gemini). No proposal generation or email happens here.
 */

const input = z.object({
  proposalId: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/),
  request: z.string().trim().min(1).max(2000),
});

export type InterpretedRequest = {
  summary: string;
  services: Array<{ name: string; reason: string }>;
};

export type InterpretResult =
  | {
      ok: true;
      interpreted: InterpretedRequest;
      selected: Array<{ name: string; price: number; reason: string }>;
      unmatched: Array<{ name: string; reason: string; issue: string }>;
      total_price: number;
      status: "calculated" | "no_matching_services" | "proposal_ready" | "sent";
      proposal_url: string | null;
      email_status: "sent" | "failed" | "not_applicable";
      email_error: string | null;
    }
  | { ok: false; code: InterpretErrorCode; message: string };

export type InterpretErrorCode =
  | "missing_key"
  | "missing_firebase"
  | "services_unavailable"
  | "gemini_failed"
  | "invalid_json"
  | "not_interpretable"
  | "save_failed";

// gemini-2.5-flash was retired for new keys (404). Quotas are per model, so
// a 429/quota error on one model moves on to the next.
const GEMINI_MODELS = ["gemini-3.7-flash", "gemini-3.8-flash"] as const;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiErrorKind =
  | "model_unavailable"
  | "auth_failed"
  | "key_restricted"
  | "quota_exceeded"
  | "rate_limited"
  | "overloaded"
  | "bad_request"
  | "network"
  | "empty_response"
  | "unknown";

type GeminiFailure = { model: string; status: number; kind: GeminiErrorKind; detail: string };

/** Classifies a Gemini error response. Never includes the API key. */
async function describeGeminiError(res: Response, model: string): Promise<GeminiFailure> {
  const text = await res.text();
  let message = text.slice(0, 500);
  let status = "";
  let reason = "";
  try {
    const j = JSON.parse(text) as {
      error?: { message?: string; status?: string; details?: Array<{ reason?: string }> };
    };
    message = j.error?.message ?? message;
    status = j.error?.status ?? "";
    reason = j.error?.details?.map((d) => d.reason).filter(Boolean).join(",") ?? "";
  } catch {
    /* non-JSON body */
  }
  const m = `${message} ${reason}`.toLowerCase();
  let kind: GeminiErrorKind = "unknown";
  if (res.status === 404 || m.includes("no longer available") || m.includes("not found for api version")) kind = "model_unavailable";
  else if (m.includes("api_key_invalid") || m.includes("api key not valid") || res.status === 401) kind = "auth_failed";
  else if (res.status === 403 && (m.includes("referer") || m.includes("restrict") || m.includes("blocked") || m.includes("ip address"))) kind = "key_restricted";
  else if (res.status === 403) kind = "auth_failed";
  else if (res.status === 429 && (m.includes("quota") || m.includes("billing"))) kind = "quota_exceeded";
  else if (res.status === 429) kind = "rate_limited";
  else if ([500, 502, 503, 504, 524].includes(res.status) || status === "UNAVAILABLE") kind = "overloaded";
  else if (res.status === 400) kind = "bad_request";
  return { model, status: res.status, kind, detail: `${status} ${message}${reason ? ` [${reason}]` : ""}`.trim() };
}

function geminiUserMessage(kind: GeminiErrorKind): string {
  switch (kind) {
    case "model_unavailable": return "The AI model is unavailable.";
    case "auth_failed": return "The AI service rejected the server's API key.";
    case "key_restricted": return "The AI API key is restricted and cannot be used from this server.";
    case "quota_exceeded": return "The AI quota has been exceeded.";
    case "rate_limited":
    case "overloaded": return "The AI service is busy right now. Please try again shortly.";
    default: return "The AI service could not be reached.";
  }
}

type FsValue = { stringValue?: string; [k: string]: unknown };
type FsDoc = { name: string; fields?: Record<string, FsValue> };

function fail(code: InterpretErrorCode, message: string): InterpretResult {
  return { ok: false, code, message };
}

/** Lovable AI Gateway fallback (Responses API, streamed). Key stays server-side. */
async function callLovableFallback(
  prompt: string,
  allowed: string[],
): Promise<{ ok: true; text: string } | { ok: false; detail: string }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false, detail: "LOVABLE_API_KEY missing" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "user", content: prompt }],
        text: {
          format: {
            type: "json_schema",
            name: "interpreted_request",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "services"],
              properties: {
                summary: { type: "string" },
                services: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "reason"],
                    properties: {
                      name: { type: "string", enum: allowed },
                      reason: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!res.ok || !res.body) {
      return { ok: false, detail: `status=${res.status} ${(await res.text()).slice(0, 300)}` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d) as { type?: string; delta?: string; response?: { error?: { message?: string } } };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
          if (ev.type === "response.failed" || ev.type === "error") {
            return { ok: false, detail: `stream error ${ev.response?.error?.message ?? d.slice(0, 200)}` };
          }
        } catch {
          /* partial/non-JSON frame */
        }
      }
    }
    return text ? { ok: true, text } : { ok: false, detail: "empty response" };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}

export const interpretProposalRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<InterpretResult> => {
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      console.error("[gemini] GEMINI_API_KEY missing at runtime");
      return fail("missing_key", "GEMINI_API_KEY is not configured on the server.");
    }
    const projectId = process.env["VITE_FIREBASE_PROJECT_ID"] ?? import.meta.env["VITE_FIREBASE_PROJECT_ID"];
    const fbKey = process.env["VITE_FIREBASE_API_KEY"] ?? import.meta.env["VITE_FIREBASE_API_KEY"];
    if (!projectId || !fbKey) {
      return fail("missing_firebase", "Firebase project configuration is missing.");
    }
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // 1. Load the allowed services from Firestore.
    let services: Array<{ name: string; description: string | undefined; price: number | null }> = [];
    try {
      const res = await fetch(`${base}/services?pageSize=200&key=${fbKey}`);
      if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { documents?: FsDoc[] };
      services = (body.documents ?? [])
        .map((d) => {
          const p = d.fields?.["price"] as { integerValue?: string; doubleValue?: number; stringValue?: string } | undefined;
          const n = Number(p?.integerValue ?? p?.doubleValue ?? p?.stringValue ?? NaN);
          return {
            name: d.fields?.["name"]?.stringValue?.trim() ?? "",
            description: d.fields?.["description"]?.stringValue?.trim(),
            price: Number.isFinite(n) && n >= 0 ? n : null,
          };
        })
        .filter((s) => s.name);
    } catch (e) {
      console.error("services load failed", e);
      return fail("services_unavailable", "Could not load the services list.");
    }
    if (services.length === 0) {
      return fail("services_unavailable", "The services collection is empty.");
    }
    const allowed = services.map((s) => s.name);

    // 2. Ask Gemini for structured JSON, constrained to the allowed names.
    const prompt = [
      "You interpret client requests for a digital services studio.",
      "Choose ONLY from the services listed below. Never invent services, never mention prices.",
      "If the request is unclear, unrelated, or matches no service, return an empty services array and explain briefly in summary.",
      "",
      "Available services:",
      ...services.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`),
      "",
      "Client request:",
      data.request,
    ].join("\n");

    const requestBody = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            services: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", enum: allowed },
                  reason: { type: "STRING" },
                },
                required: ["name", "reason"],
              },
            },
          },
          required: ["summary", "services"],
        },
      },
    });

    let raw = "";
    let lastError: GeminiFailure | null = null;
    outer: for (const model of GEMINI_MODELS) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // A hung request (seen in production as a 524 after ~2 min) is cut
          // off at 30s so the next attempt/model still has time to answer.
          const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
            body: requestBody,
            signal: AbortSignal.timeout(30000),
          });
          if (res.ok) {
            const body = (await res.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
            };
            raw =
              body.candidates?.[0]?.content?.parts
                ?.filter((p) => !p.thought)
                .map((p) => p.text ?? "")
                .join("") ?? "";
            console.info(`[gemini] ok model=${model} attempt=${attempt}`);
            lastError = null;
            break outer;
          }
          lastError = await describeGeminiError(res, model);
        } catch (e) {
          lastError = { model, status: 0, kind: "network", detail: String(e) };
        }
        console.error(
          `[gemini] failed model=${lastError.model} status=${lastError.status} kind=${lastError.kind} attempt=${attempt}: ${lastError.detail}`,
        );
        // Only busy/overloaded/network errors are worth retrying.
        if (!["overloaded", "rate_limited", "network"].includes(lastError.kind)) break;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
      }
      // Auth / key problems won't be fixed by another model; quota is per model, so continue.
      if (lastError && ["auth_failed", "key_restricted"].includes(lastError.kind)) break;
    }
    // Fallback: only for temporary availability failures (503/502/504/524,
    // timeout, busy, quota). Same prompt, same strict schema with the same
    // allowed-name enum. Never used for auth, config or invalid requests.
    const TEMPORARY: GeminiErrorKind[] = ["overloaded", "network", "rate_limited", "quota_exceeded"];
    if (lastError && TEMPORARY.includes(lastError.kind)) {
      console.warn(`[fallback] Gemini unavailable (${lastError.kind}); using Lovable AI`);
      const fb = await callLovableFallback(prompt, allowed);
      if (fb.ok) {
        raw = fb.text;
        lastError = null;
        console.info("[fallback] ok model=openai/gpt-6-astra");
      } else {
        console.error(`[fallback] failed: ${fb.detail}`);
      }
    }
    if (lastError || !raw) {
      return fail("gemini_failed", geminiUserMessage(lastError?.kind ?? "empty_response"));
    }

    // 3. Validate the JSON and drop anything not in the services list.
    let interpreted: InterpretedRequest;
    try {
      const parsed = z
        .object({
          summary: z.string(),
          services: z.array(z.object({ name: z.string(), reason: z.string() })),
        })
        .parse(JSON.parse(raw));
      interpreted = {
        summary: parsed.summary.trim(),
        services: parsed.services.map((s) => ({ name: s.name.trim(), reason: s.reason.trim() })),
      };
    } catch (e) {
      console.error("gemini invalid json", raw, e);
      return fail("invalid_json", "The AI returned an invalid response.");
    }
    if (!interpreted.summary) {
      return fail("not_interpretable", "The request could not be interpreted.");
    }

    // 4. Pricing — done here on the server, prices only from Firestore.
    const byName = new Map(services.map((s) => [s.name.toLowerCase(), s]));
    const selected: Array<{ name: string; price: number; reason: string }> = [];
    const unmatched: Array<{ name: string; reason: string; issue: string }> = [];
    const seen = new Set<string>();
    for (const s of interpreted.services) {
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const svc = byName.get(key);
      if (!svc) {
        unmatched.push({ ...s, issue: "not_in_services_collection" });
      } else if (svc.price === null) {
        console.error(`[pricing] service "${svc.name}" has a missing or invalid price`);
        unmatched.push({ name: svc.name, reason: s.reason, issue: "missing_or_invalid_price" });
      } else {
        selected.push({ name: svc.name, price: svc.price, reason: s.reason });
      }
    }
    const total = Math.round(selected.reduce((sum, s) => sum + s.price, 0) * 100) / 100;
    const status = selected.length > 0 ? "calculated" : "no_matching_services";

    // 5. Save — only these fields are touched; name/email/request/created_at stay as-is.
    const str = (v: string) => ({ stringValue: v });
    const map = (fields: Record<string, unknown>) => ({ mapValue: { fields } });
    const arr = (values: unknown[]) => ({ arrayValue: { values } });
    const fields = {
      interpreted_request: map({
        summary: str(interpreted.summary),
        services: arr(interpreted.services.map((s) => map({ name: str(s.name), reason: str(s.reason) }))),
      }),
      selected_services: arr(
        selected.map((s) => map({ name: str(s.name), price: { doubleValue: s.price }, reason: str(s.reason) })),
      ),
      unmatched_services: arr(
        unmatched.map((s) => map({ name: str(s.name), reason: str(s.reason), issue: str(s.issue) })),
      ),
      total_price: { doubleValue: total },
      status: str(status),
    };
    const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    try {
      const res = await fetch(`${base}/proposals/${data.proposalId}?${mask}&key=${fbKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
    } catch (e) {
      console.error("proposal update failed", e);
      return fail("save_failed", "The interpretation and price could not be saved to the proposal.");
    }
    console.info(`[pricing] proposal=${data.proposalId} status=${status} total=${total} selected=${selected.length} unmatched=${unmatched.length}`);

    // 6. Proposal page: for calculated proposals, record the public page URL.
    let finalStatus: "calculated" | "no_matching_services" | "proposal_ready" | "sent" = status;
    let proposalUrl: string | null = null;
    if (status === "calculated") {
      const req = getRequest();
      const origin = req.headers.get("origin") ?? new URL(req.url).origin;
      proposalUrl = `${origin}/proposal/${data.proposalId}`;
      try {
        const res = await fetch(
          `${base}/proposals/${data.proposalId}?updateMask.fieldPaths=proposal_url&updateMask.fieldPaths=status&key=${fbKey}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: { proposal_url: { stringValue: proposalUrl }, status: { stringValue: "proposal_ready" } },
            }),
          },
        );
        if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
        finalStatus = "proposal_ready";
        console.info(`[proposal] ready ${proposalUrl}`);
      } catch (e) {
        console.error("proposal_url save failed", e);
        proposalUrl = null;
      }
    }

    // 7. Email the client once the proposal is ready. Sent via the Resend
    // connector gateway; both keys stay server-side. A failure here never
    // fails the proposal itself — it is reported in email_status.
    let emailStatus: "sent" | "failed" | "not_applicable" = "not_applicable";
    let emailError: string | null = null;
    if (finalStatus === "proposal_ready" && proposalUrl) {
      const lovableKey = process.env["LOVABLE_API_KEY"];
      const resendKey = process.env["RESEND_API_KEY"];
      if (!lovableKey || !resendKey) {
        emailStatus = "failed";
        emailError = "Email service is not configured on the server.";
        console.error("[email] LOVABLE_API_KEY or RESEND_API_KEY missing");
      } else {
        // Read the client name/email from the proposal document.
        let clientEmail = "";
        let clientName = "";
        let alreadySent = false;
        try {
          const res = await fetch(`${base}/proposals/${data.proposalId}?key=${fbKey}`);
          if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
          const doc = (await res.json()) as FsDoc;
          clientEmail = doc.fields?.["email"]?.stringValue?.trim() ?? "";
          clientName = doc.fields?.["name"]?.stringValue?.trim() ?? "";
          alreadySent = doc.fields?.["email_sent"]?.["booleanValue"] === true;
        } catch (e) {
          console.error("[email] proposal read failed", e);
        }
        // Record the email outcome on the proposal without touching other fields.
        const markEmailResult = async (sent: boolean) => {
          const f: Record<string, unknown> = {
            email_sent: { booleanValue: sent },
            ...(sent
              ? { sent_at: { timestampValue: new Date().toISOString() }, status: { stringValue: "sent" } }
              : {}),
          };
          const m = Object.keys(f).map((k) => `updateMask.fieldPaths=${k}`).join("&");
          try {
            const res = await fetch(`${base}/proposals/${data.proposalId}?${m}&key=${fbKey}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fields: f }),
            });
            if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
          } catch (e) {
            console.error("[email] status save failed", e);
          }
        };
        if (alreadySent) {
          // Never send a duplicate: the proposal was already emailed.
          emailStatus = "sent";
          finalStatus = "sent";
          console.info(`[email] skipped duplicate send for ${data.proposalId}`);
        } else if (!clientEmail) {
          emailStatus = "failed";
          emailError = "Could not read the client email from the proposal.";
        } else {
          const totalFmt = total.toFixed(2);
          const html = [
            `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">`,
            `<h1 style="font-size:20px;margin:0 0 12px">Your proposal is ready</h1>`,
            `<p>Hi${clientName ? ` ${clientName}` : ""},</p>`,
            `<p>We reviewed your request and prepared a proposal for you.</p>`,
            `<p style="font-size:16px"><strong>Total: &euro;${totalFmt}</strong></p>`,
            `<p><a href="${proposalUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">View your proposal</a></p>`,
            `<p style="color:#666;font-size:12px">Or open this link: ${proposalUrl}</p>`,
            `</div>`,
          ].join("");
          try {
            const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lovableKey}`,
                "X-Connection-Api-Key": resendKey,
              },
              body: JSON.stringify({
                from: "SEGA Prototype <onboarding@resend.dev>",
                to: [clientEmail],
                subject: `Your proposal is ready — total €${totalFmt}`,
                html,
              }),
            });
            if (!res.ok) {
              const body = await res.text();
              console.error(`[email] gateway failed [${res.status}]: ${body}`);
              emailStatus = "failed";
              emailError = `Email provider rejected the send (${res.status}).`;
              await markEmailResult(false);
            } else {
              emailStatus = "sent";
              finalStatus = "sent";
              await markEmailResult(true);
              console.info(`[email] proposal email sent to ${clientEmail} for ${proposalUrl}`);
            }
          } catch (e) {
            console.error("[email] send failed", e);
            emailStatus = "failed";
            emailError = "The email could not be sent.";
            await markEmailResult(false);
          }
        }
      }
    }

    return {
      ok: true,
      interpreted,
      selected,
      unmatched,
      total_price: total,
      status: finalStatus,
      proposal_url: proposalUrl,
      email_status: emailStatus,
      email_error: emailError,
    };
  });
