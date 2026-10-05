import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Clock, Inbox, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  proposalRequestSchema,
  submitProposalRequest,
  type ProposalRequestRecord,
  type ProposalRequestValues,
} from "@/lib/proposal-request";

const REQUEST_MAX = 2000;

const nextSteps = [
  { icon: Inbox, title: "Your request is recorded", copy: "Name, email and description are captured exactly as you typed them." },
  { icon: Clock, title: "It is reviewed by hand", copy: "No prices, quotes or proposals are generated automatically." },
  { icon: ArrowRight, title: "You hear back by email", copy: "The address you enter is the only contact channel used." },
];

export function ProposalRequestSection() {
  const [saved, setSaved] = useState<ProposalRequestRecord | null>(null);
  const form = useForm<ProposalRequestValues>({
    resolver: zodResolver(proposalRequestSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", request: "" },
  });
  const requestLength = form.watch("request").length;

  async function onSubmit(values: ProposalRequestValues) {
    const { record } = await submitProposalRequest(values);
    setSaved(record);
  }

  return (
    <section id="proposal" className="scroll-mt-24 border-b border-border py-19 md:py-24">
      <div className="reveal-on-scroll mb-9">
        <p className="mb-3 font-mono text-xs uppercase text-primary">(d) REQUEST A PROPOSAL</p>
        <h2 className="max-w-[24ch] font-display text-4xl leading-tight sm:text-5xl">
          TELL US WHAT YOU NEED
        </h2>
        <p className="mt-5 max-w-[52ch] text-muted-foreground">
          Three fields, no account, no commitment. Describe the work and we’ll
          come back to you.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="glass-surface reveal-on-scroll rounded-md p-6 md:p-8">
          <p className="font-mono text-[10px] uppercase text-primary">What happens next</p>
          <ul className="mt-6 space-y-6">
            {nextSteps.map(({ icon: Icon, title, copy }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{copy}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-surface reveal-on-scroll rounded-md p-6 md:p-8">
          {saved ? (
            <div className="flex h-full flex-col justify-center text-center" role="status" aria-live="polite">
              <CheckCircle2 className="mx-auto mb-5 text-primary" size={30} strokeWidth={1.5} />
              <p className="font-mono text-[10px] uppercase text-primary">Request received</p>
              <h3 className="mt-3 font-display text-3xl sm:text-4xl">THANKS, {saved.name.toUpperCase()}.</h3>
              <p className="mx-auto mt-4 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                Your request is logged as reference {saved.id.slice(0, 8)} and we’ll reply to{" "}
                <span className="text-foreground">{saved.email}</span>.
              </p>
              <div className="mt-8">
                <Button
                  size="lg"
                  variant="glass"
                  onClick={() => {
                    form.reset({ name: "", email: "", request: "" });
                    setSaved(null);
                  }}
                >
                  Send another request
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate aria-labelledby="proposal-heading" className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="proposal-name">Name</FormLabel>
                        <FormControl>
                          <Input
                            id="proposal-name"
                            autoComplete="name"
                            placeholder="Your name"
                            aria-required="true"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="proposal-email">Email</FormLabel>
                        <FormControl>
                          <Input
                            id="proposal-email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            aria-required="true"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="request"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline justify-between gap-3">
                        <FormLabel htmlFor="proposal-request">Request</FormLabel>
                        <span
                          className={`font-mono text-[10px] ${requestLength > REQUEST_MAX ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {requestLength}/{REQUEST_MAX}
                        </span>
                      </div>
                      <FormControl>
                        <Textarea
                          id="proposal-request"
                          rows={6}
                          maxLength={REQUEST_MAX}
                          placeholder="Describe what you need, the timeline, and anything we should already know."
                          aria-required="true"
                          className="min-h-[140px] resize-y leading-relaxed"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-[10px] uppercase leading-relaxed text-muted-foreground">
                    Prototype form — nothing is charged or generated.
                  </p>
                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Sending…" : "Submit Proposal Request"}
                    {!form.formState.isSubmitting && <SendHorizontal />}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </section>
  );
}
