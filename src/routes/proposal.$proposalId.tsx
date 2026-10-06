import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, FileText, Mail, User } from "lucide-react";
import { getProposal } from "@/lib/proposal-view.functions";

export const Route = createFileRoute("/proposal/$proposalId")({
  loader: ({ params }) => getProposal({ data: { id: params.proposalId } }),
  head: ({ loaderData }) => {
    const title =
      loaderData?.ok ? `Proposal for ${loaderData.proposal.name} | SEGA Concept` : "Proposal | SEGA Concept";
    const description = "A service proposal prepared from a request sent through the SEGA concept page.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ProposalPage,
});

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-4xl items-center justify-between gap-4 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="SEGA concept home">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-lg text-primary-foreground">S</span>
            <span className="font-display text-xl">SEGA</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft size={15} /> Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-16">{children}</main>
      <footer className="border-t border-border py-8 text-center font-mono text-[10px] uppercase text-muted-foreground">
        Fan-made student prototype · Not affiliated with or endorsed by SEGA
      </footer>
    </div>
  );
}

function ProposalPage() {
  const result = Route.useLoaderData();

  if (!result.ok) {
    const copy =
      result.reason === "not_found"
        ? "We couldn't find a proposal at this address."
        : result.reason === "not_ready"
          ? "This proposal is still being prepared."
          : "This proposal can't be loaded right now. Please try again later.";
    return (
      <Shell>
        <div className="glass-surface rounded-md p-8 text-center">
          <p className="font-mono text-xs uppercase text-primary">Proposal</p>
          <h1 className="mt-3 font-display text-4xl">UNAVAILABLE</h1>
          <p className="mt-4 text-muted-foreground">{copy}</p>
        </div>
      </Shell>
    );
  }

  const p = result.proposal;
  return (
    <Shell>
      <p className="font-mono text-xs uppercase text-primary">Reference {p.id.slice(0, 8)}</p>
      <h1 className="mt-3 font-display text-5xl sm:text-6xl">PROPOSAL</h1>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: User, label: "Client", value: p.name },
          { icon: Mail, label: "Email", value: p.email },
          { icon: CalendarDays, label: "Date", value: formatDate(p.created_at) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-surface rounded-md p-5">
            <dt className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
              <Icon size={13} /> {label}
            </dt>
            <dd className="mt-2 break-words text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="glass-surface mt-4 rounded-md p-6 md:p-8">
        <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase text-primary">
          <FileText size={13} /> Original request
        </h2>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed">{p.request}</p>
      </section>

      <section className="glass-surface mt-4 rounded-md p-6 md:p-8">
        <h2 className="font-mono text-[10px] uppercase text-primary">Selected services</h2>
        <ul className="mt-4 divide-y divide-border">
          {p.selected_services.map((s) => (
            <li key={s.name} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <p className="font-semibold">{s.name}</p>
                {s.reason && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.reason}</p>}
              </div>
              <p className="shrink-0 font-mono text-sm">{eur.format(s.price)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-primary/40 pt-5">
          <span className="font-display text-2xl">TOTAL</span>
          <span className="font-display text-3xl text-primary">{eur.format(p.total_price)}</span>
        </div>
      </section>

      <section className="mt-4 rounded-md border border-border p-6 text-sm leading-relaxed text-muted-foreground">
        <h2 className="mb-2 font-mono text-[10px] uppercase text-foreground">How this price was set</h2>
        The prices above are the standard prices of the services selected for your request. Each service's price
        comes from our service list, and the total is the sum of those prices. If your needs change, the selected
        services and the total can be reviewed with you.
      </section>
    </Shell>
  );
}
