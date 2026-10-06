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

const GEMINI_MODEL = "gemini-2.5-flash";

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
      return fail("missing_key", "GEMINI_API_KEY is not configured on the server.");
    }
    const projectId = process.env["VITE_FIREBASE_PROJECT_ID"] ?? import.meta.env["VITE_FIREBASE_PROJECT_ID"];
    const fbKey = process.env["VITE_FIREBASE_API_KEY"] ?? import.meta.env["VITE_FIREBASE_API_KEY"];
    if (!projectId || !fbKey) {
      return fail("missing_firebase", "Firebase project configuration is missing.");
    }
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // 1. Load the allowed services from Firestore.
    let services: Array<{ name: string; description?: string }> = [];
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

    let raw: string;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
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
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    } catch (e) {
      console.error("gemini call failed", e);
      return fail("gemini_failed", "The AI service could not be reached.");
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
