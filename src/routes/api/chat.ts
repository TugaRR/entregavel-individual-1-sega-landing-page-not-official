import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat-knowledge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function saveMessage(visitorId: string, m: UIMessage) {
  const db = await admin();
  const { error } = await db
    .from("chat_messages")
    .upsert(
      { visitor_id: visitorId, message_id: m.id, role: m.role, parts: m.parts as never },
      { onConflict: "visitor_id,message_id" },
    );
  if (error) console.error("chat save failed", error.message);
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const visitorId = new URL(request.url).searchParams.get("visitor") ?? "";
        if (!UUID.test(visitorId)) return json({ error: "Invalid visitor" }, 400);
        const db = await admin();
        const { data, error } = await db
          .from("chat_messages")
          .select("message_id, role, parts")
          .eq("visitor_id", visitorId)
          .order("created_at")
          .limit(200);
        if (error) return json({ error: "Could not load chat" }, 500);
        return json({
          messages: (data ?? []).map((r) => ({ id: r.message_id, role: r.role, parts: r.parts })),
        });
      },
      DELETE: async ({ request }) => {
        const visitorId = new URL(request.url).searchParams.get("visitor") ?? "";
        if (!UUID.test(visitorId)) return json({ error: "Invalid visitor" }, 400);
        const db = await admin();
        await db.from("chat_messages").delete().eq("visitor_id", visitorId);
        return json({ ok: true });
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[]; visitorId?: string };
        const visitorId = body.visitorId ?? "";
        const messages = (body.messages ?? []).slice(-30);
        if (!UUID.test(visitorId) || messages.length === 0) return json({ error: "Invalid request" }, 400);
        const last = messages[messages.length - 1]!;
        const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
        if (last.role !== "user" || text.length > 1000) return json({ error: "Message too long" }, 400);

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json({ error: "Chat is not configured" }, 500);
        await saveMessage(visitorId, last);

        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          system: CHAT_SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });
        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            await saveMessage(visitorId, responseMessage);
          },
          onError: (e) => {
            const msg = String((e as Error)?.message ?? e);
            if (msg.includes("429")) return "Too many requests right now — please try again shortly.";
            if (msg.includes("402")) return "The assistant is temporarily unavailable (AI credits exhausted).";
            return "Sorry, something went wrong. Please try again.";
          },
        });
      },
    },
  },
});
