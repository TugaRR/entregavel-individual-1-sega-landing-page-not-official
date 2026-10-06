import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listProposals, type ProposalRow } from "@/lib/proposal-list.functions";

export const Route = createFileRoute("/admin/proposals")({
  loader: () => listProposals(),
  head: () => ({
    meta: [
      { title: "Proposals Dashboard | SEGA Concept" },
      { name: "description", content: "Internal prototype dashboard listing proposal requests and their status." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Proposals Dashboard | SEGA Concept" },
      { property: "og:description", content: "Internal prototype dashboard listing proposal requests and their status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: () => (
    <Shell>
      <div className="glass-surface flex items-center justify-center gap-3 rounded-md p-12 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading proposals…
      </div>
    </Shell>
  ),
  errorComponent: () => <Shell><Message title="COULDN'T LOAD" body="Something went wrong loading proposals. Please try again." /></Shell>,
  component: Dashboard,
});

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC" : "—";

const STATUS_STYLE: Record<string, string> = {
  received: "border-border text-muted-foreground",
  calculated: "border-accent/50 text-accent",
  proposal_ready: "border-primary/50 text-primary",
  sent: "border-primary bg-primary/15 text-primary",
  no_matching_services: "border-destructive/50 text-destructive",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="SEGA concept home">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-lg text-primary-foreground">S</span>
            <span className="font-display text-xl">SEGA</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft size={15} /> Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <p className="font-mono text-xs uppercase text-primary">Internal prototype</p>
        <h1 className="mt-3 mb-8 font-display text-4xl sm:text-5xl">PROPOSALS DASHBOARD</h1>
        {children}
      </main>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-surface rounded-md p-10 text-center">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-muted-foreground">{body}</p>
    </div>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS_STYLE[value] ?? "border-border text-muted-foreground"}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

const emailLabel = (v: boolean | null) => (v === true ? "Sent" : v === false ? "Not sent" : "—");

function ViewLink({ p }: { p: ProposalRow }) {
  if (!p.proposal_url) return <span className="text-xs text-muted-foreground">No link yet</span>;
  return (
    <Button asChild size="sm" variant="glass">
      <a href={p.proposal_url} target="_blank" rel="noopener noreferrer">View Proposal <ExternalLink /></a>
    </Button>
  );
}

function Dashboard() {
  const result = Route.useLoaderData();
  const router = useRouter();

  if (!result.ok) {
    return (
      <Shell>
        <Message
          title="CAN'T READ PROPOSALS"
          body={
            result.reason === "permission_denied"
              ? "Firebase refused to list proposals. The Firestore rules need to allow listing the proposals collection."
              : "The proposals list can't be loaded right now. Please try again later."
          }
        />
      </Shell>
    );
  }

  const rows = result.proposals;
  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{rows.length} proposal{rows.length === 1 ? "" : "s"} · newest first</p>
        <Button size="sm" variant="glass" onClick={() => router.invalidate()}><RefreshCw /> Refresh</Button>
      </div>

      {rows.length === 0 ? (
        <div className="glass-surface flex flex-col items-center gap-3 rounded-md p-12 text-center text-muted-foreground">
          <Inbox size={28} className="text-primary" /> No proposals have been received yet.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass-surface hidden overflow-x-auto rounded-md lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  {["Client", "Request", "Total", "Status", "Created", "Email", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-4"><p className="font-semibold">{p.name || "—"}</p><p className="text-xs text-muted-foreground break-all">{p.email}</p></td>
                    <td className="max-w-[32ch] px-4 py-4 text-muted-foreground"><p className="line-clamp-3">{p.request}</p></td>
                    <td className="px-4 py-4 font-mono whitespace-nowrap">{p.total_price === null ? "—" : eur.format(p.total_price)}</td>
                    <td className="px-4 py-4"><Status value={p.status} /></td>
                    <td className="px-4 py-4 text-xs whitespace-nowrap text-muted-foreground">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-4 text-xs">{emailLabel(p.email_sent)}</td>
                    <td className="px-4 py-4 text-right"><ViewLink p={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-3 lg:hidden">
            {rows.map((p) => (
              <li key={p.id} className="glass-surface rounded-md p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold">{p.name || "—"}</p><p className="text-xs break-all text-muted-foreground">{p.email}</p></div>
                  <Status value={p.status} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.request}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="font-mono text-[10px] uppercase text-muted-foreground">Total</dt><dd className="mt-1 font-mono">{p.total_price === null ? "—" : eur.format(p.total_price)}</dd></div>
                  <div><dt className="font-mono text-[10px] uppercase text-muted-foreground">Created</dt><dd className="mt-1">{fmtDate(p.created_at)}</dd></div>
                  <div><dt className="font-mono text-[10px] uppercase text-muted-foreground">Email</dt><dd className="mt-1">{emailLabel(p.email_sent)}</dd></div>
                </dl>
                <div className="mt-4"><ViewLink p={p} /></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}
