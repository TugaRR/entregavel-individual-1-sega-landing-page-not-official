import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server-only AI step: interprets a saved proposal request with Gemini and
 * writes `interpreted_request` onto the proposal document. GEMINI_API_KEY is
 * read inside the handler only, so it never reaches the browser bundle.
 * No pricing, proposal generation or email happens here.
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
  | { ok: true; interpreted: InterpretedRequest }
  | { ok: false; code: InterpretErrorCode; message: string };

export type InterpretErrorCode =
  | "missing_key"
  | "missing_firebase"
  | "services_unavailable"
  | "gemini_failed"
  | "invalid_json"
  | "not_interpretable"
  | "save_failed";

// gemini-2.5-flash was retired for new keys (404). Current model first,
// previous current model as fallback when the first is overloaded.
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash"] as const;
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
  else if (res.status === 503 || res.status === 500 || status === "UNAVAILABLE") kind = "overloaded";
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
    let services: Array<{ name: string; description: string | undefined }> = [];
    try {
      const res = await fetch(`${base}/services?pageSize=200&key=${fbKey}`);
      if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { documents?: FsDoc[] };
      services = (body.documents ?? [])
        .map((d) => ({
          name: d.fields?.["name"]?.stringValue?.trim() ?? "",
          description: d.fields?.["description"]?.stringValue?.trim(),
        }))
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
          const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
            body: requestBody,
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
      // Auth / key problems won't be fixed by another model.
      if (lastError && ["auth_failed", "key_restricted", "quota_exceeded"].includes(lastError.kind)) break;
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
        services: parsed.services
          .filter((s) => allowed.includes(s.name))
          .map((s) => ({ name: s.name, reason: s.reason.trim() })),
      };
    } catch (e) {
      console.error("gemini invalid json", raw, e);
      return fail("invalid_json", "The AI returned an invalid response.");
    }
    if (!interpreted.summary || interpreted.services.length === 0) {
      return fail("not_interpretable", "The request could not be matched to any of our services.");
    }

    // 4. Save onto the proposal document (only interpreted_request is touched).
    try {
      const res = await fetch(
        `${base}/proposals/${data.proposalId}?updateMask.fieldPaths=interpreted_request&key=${fbKey}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              interpreted_request: {
                mapValue: {
                  fields: {
                    summary: { stringValue: interpreted.summary },
                    services: {
                      arrayValue: {
                        values: interpreted.services.map((s) => ({
                          mapValue: {
                            fields: {
                              name: { stringValue: s.name },
                              reason: { stringValue: s.reason },
                            },
                          },
                        })),
                      },
                    },
                  },
                },
              },
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
    } catch (e) {
      console.error("proposal update failed", e);
      return fail("save_failed", "The interpretation could not be saved to the proposal.");
    }

    return { ok: true, interpreted };
  });
