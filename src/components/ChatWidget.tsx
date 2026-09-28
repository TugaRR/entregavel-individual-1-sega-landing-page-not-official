import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Flag, Minus, RotateCcw, SendHorizontal } from "lucide-react";
import { CHAT_SUGGESTIONS, CHAT_WELCOME } from "@/lib/chat-knowledge";

function getVisitorId() {
  const key = "signal-chat-visitor";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    const id = getVisitorId();
    setVisitorId(id);
    fetch(`/api/chat?visitor=${id}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setInitial(d.messages ?? []))
      .catch(() => setInitial([]));
  }, []);

  return (
    <>
      {open && visitorId && initial && (
        <ChatPanel visitorId={visitorId} initial={initial} onClose={() => setOpen(false)} onReset={() => setInitial([])} />
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the Sonic Racing: CrossWorlds assistant"
          className="fixed right-4 bottom-4 z-[60] flex items-center gap-2 rounded-full bg-primary py-3 pr-5 pl-4 font-display text-base tracking-wide text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
        >
          <Flag size={18} strokeWidth={2.2} /> ASK SIGNAL
        </button>
      )}
    </>
  );
}

function ChatPanel({ visitorId, initial, onClose, onReset }: { visitorId: string; initial: UIMessage[]; onClose: () => void; onReset: () => void }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: visitorId,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", body: { visitorId } }),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, status]);
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t.slice(0, 1000) });
    setInput("");
  };

  const reset = async () => {
    await fetch(`/api/chat?visitor=${visitorId}`, { method: "DELETE" });
    setMessages([]);
    onReset();
  };

  return (
    <section
      role="dialog"
      aria-label="Sonic Racing: CrossWorlds assistant"
      className="entrance fixed inset-x-2 bottom-2 z-[60] flex h-[min(620px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-md border border-border bg-glass-strong shadow-2xl backdrop-blur-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[390px]"
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Flag size={17} strokeWidth={2.2} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none">SIGNAL<span className="text-primary">.</span> ASSISTANT</p>
          <p className="mt-1 font-mono text-[9px] uppercase text-muted-foreground">Unofficial fan prototype · not SEGA support</p>
        </div>
        <button type="button" onClick={reset} aria-label="Start over" title="Start over" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-glass-hover hover:text-foreground"><RotateCcw size={16} /></button>
        <button type="button" onClick={onClose} aria-label="Minimize chat" title="Minimize" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-glass-hover hover:text-foreground"><Minus size={18} /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        <Bubble role="assistant" text={CHAT_WELCOME} />
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {CHAT_SUGGESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary/20">{q}</button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")} />
        ))}
        {status === "submitted" && (
          <div className="flex gap-1 py-2" aria-label="Assistant is typing">
            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 120}ms` }} />)}
          </div>
        )}
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">{error.message || "Something went wrong. Please try again."}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          maxLength={1000}
          placeholder="Ask about the game…"
          aria-label="Your message"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-md border border-input bg-glass px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity disabled:opacity-40"><SendHorizontal size={17} /></button>
      </form>
    </section>
  );
}

function Bubble({ role, text }: { role: string; text: string }) {
  if (!text) return null;
  if (role === "user") {
    return <div className="ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">{text}</div>;
  }
  return (
    <div className="max-w-[92%] text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p+p]:mt-2 [&_strong]:font-semibold [&_ul]:list-disc">
      <ReactMarkdown components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer" /> }}>{text}</ReactMarkdown>
    </div>
  );
}
