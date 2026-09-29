import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bell, Compass, Film, Gamepad2, Layers3, Play, Radar, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroAsset from "@/assets/sonic-crossworlds-official.webp.asset.json";
import { ChatWidget } from "@/components/ChatWidget";
import { CalMeetingButton } from "@/components/CalMeetingButton";

const gameUrl = "https://asia.sega.com/SonicRacingCrossWorlds/en/";
const trailerUrl = "https://www.youtube.com/watch?v=EbyfGzVPb-8";

const personas = [
  { icon: Trophy, eyebrow: "The collector", title: "Never miss a release", frustration: "Frustration: announcements scattered across every channel.", outcome: "Outcome: a clearer path to the next game worth playing." },
  { icon: Compass, eyebrow: "The explorer", title: "Find your next world", frustration: "Frustration: too many titles, not enough context.", outcome: "Outcome: discover a franchise that feels made for you." },
  { icon: Film, eyebrow: "The trailer hunter", title: "See it before you play", frustration: "Frustration: deciding on a game from a title alone.", outcome: "Outcome: watch the action before you dive in." },
];

const features = [
  { icon: Radar, number: "/01", title: "Release radar", description: "Spend less time chasing announcements and more time anticipating what’s next." },
  { icon: Play, number: "/02", title: "Trailer spotlight", description: "Get a feel for the gameplay and atmosphere before choosing your next adventure." },
  { icon: Layers3, number: "/03", title: "Franchise worlds", description: "Go from a familiar favorite to a whole new universe without losing your way." },
];

const faqs = [
  ["What is this page?", "A concept landing page inspired by the SEGA.com discovery experience described in the supplied brief. It is not an official SEGA website."],
  ["Can I play games here?", "No. This page introduces the worlds and links to an official game site where you can find platform and purchase information."],
  ["Where can I watch the featured trailer?", "Use the Watch trailer button to open the official Sonic Racing: CrossWorlds video on YouTube."],
  ["Is Sonic Racing: CrossWorlds available now?", "The official Sonic Racing: CrossWorlds site currently labels it Available Now. Check that site for current platform availability."],
  ["Are all the games mentioned on sale here?", "No. This page does not sell games or process payments."],
  ["Can I pre-order a game here?", "No. For pre-order availability and dates, check the relevant official game page or platform store."],
  ["Do I need an account to browse?", "No account is needed to explore this page or follow its public links."],
  ["Can I sign up for news here?", "This concept page does not collect email addresses. Visit SEGA’s official website for any available news sign-up."],
  ["How do I know a release date is accurate?", "Always confirm dates with SEGA or an official store listing; schedules and availability can change."],
  ["Does this page offer rewards?", "No rewards are offered here. Refer to SEGA’s official channels for current promotions and eligibility."],
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Every World. One Signal. | SEGA Discovery Concept" },
      { name: "description", content: "Discover SEGA worlds, follow the latest releases, and watch Sonic Racing: CrossWorlds in this fan-made discovery concept." },
      { property: "og:title", content: "Every World. One Signal. | SEGA Discovery Concept" },
      { property: "og:description", content: "A cinematic fan-made landing page for exploring SEGA worlds, releases, and trailers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Signal home">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-lg text-primary-foreground">S</span>
            <span className="font-display text-xl">SEGA&nbsp;<span className="text-primary">(unnofficial)</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
            <a className="transition-colors hover:text-foreground" href="#players">Players</a>
            <a className="transition-colors hover:text-foreground" href="#discover">Discover</a>
            <a className="transition-colors hover:text-foreground" href="#faq">FAQ</a>
          </nav>
          <Button asChild size="sm" variant="glass"><a href={gameUrl} target="_blank" rel="noopener noreferrer">Explore the game <ArrowRight /></a></Button>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate min-h-[680px] overflow-hidden md:min-h-[690px]">
          <div className="hero-art absolute inset-0 -z-10" style={{ "--hero-image": `url(${heroAsset.url})` } as React.CSSProperties} aria-hidden="true" />
          <div className="mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-20 md:min-h-[690px] md:px-8">
            <div className="entrance max-w-2xl">
              <p className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase text-primary"><span className="size-1.5 rounded-full bg-primary" /> THE WORLDS YOU LOVE, ALL IN VIEW</p>
              <h1 className="max-w-[11ch] font-display text-6xl leading-[1.05] sm:text-7xl lg:text-8xl">EVERY WORLD.<br /><span className="text-primary">ONE SIGNAL.</span></h1>
              <p className="mt-7 max-w-[46ch] text-base leading-relaxed text-foreground/85 sm:text-lg">Stop piecing together what’s next. Discover the SEGA worlds you love, find your next game, and see the action for yourself.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><a href="#discover">Start discovering <ArrowRight /></a></Button>
                <Button asChild size="lg" variant="glass"><a href={trailerUrl} target="_blank" rel="noopener noreferrer"><Play /> Watch trailer</a></Button>
                <CalMeetingButton />
              </div>
              <div className="mt-11 flex flex-wrap items-center gap-3 border-t border-border pt-5 font-mono text-[10px] uppercase text-muted-foreground sm:gap-6">
                <span>FEATURED: SONIC RACING: CROSSWORLDS</span><span className="hidden size-1 rounded-full bg-primary sm:block" /><span>OFFICIAL ARTWORK</span>
              </div>
            </div>
          </div>
          <div className="absolute right-5 bottom-6 hidden border border-border bg-glass-strong px-4 py-3 backdrop-blur-xl md:block">
            <p className="font-mono text-[10px] uppercase text-primary">Featured world / 001</p>
            <p className="mt-1 font-display text-xl">SONIC RACING: CROSSWORLDS</p>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <section id="players" className="scroll-mt-24 border-b border-border py-19 md:py-24">
            <div className="reveal-on-scroll mb-9">
              <p className="mb-3 font-mono text-xs uppercase text-primary">(a) WHO THIS IS FOR</p>
              <h2 className="font-display text-4xl sm:text-5xl">THREE KINDS OF PLAYER</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {personas.map(({ icon: Icon, eyebrow, title, frustration, outcome }) => (
                <article key={eyebrow} className="glass-surface reveal-on-scroll rounded-md p-6 transition-colors hover:bg-glass-hover">
                  <span className="mb-6 grid size-11 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary"><Icon size={20} strokeWidth={1.8} /></span>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">{eyebrow}</p>
                  <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{frustration}</p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">{outcome}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="discover" className="scroll-mt-24 border-b border-border py-19 md:py-24">
            <div className="reveal-on-scroll mb-9">
              <p className="mb-3 font-mono text-xs uppercase text-primary">(b) WHAT YOU GET</p>
              <h2 className="max-w-[21ch] font-display text-4xl leading-tight sm:text-5xl">BUILT FOR THE SIGNAL, NOT THE NOISE</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {features.map(({ icon: Icon, number, title, description }) => (
                <article key={title} className="glass-surface reveal-on-scroll rounded-md p-6 transition-colors hover:bg-glass-hover">
                  <div className="mb-5 flex items-center justify-between"><span className="font-mono text-xs text-primary">{number}</span><Icon className="text-primary" size={21} strokeWidth={1.7} /></div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-b border-border py-19 md:py-24">
            <div className="glass-surface reveal-on-scroll rounded-md px-6 py-14 text-center md:px-14 md:py-18">
              <Sparkles className="mx-auto mb-5 text-primary" size={24} strokeWidth={1.5} />
              <p className="mb-4 font-mono text-xs uppercase text-primary">READY WHEN YOU ARE</p>
              <h2 className="mx-auto max-w-[17ch] font-display text-4xl leading-tight sm:text-5xl">YOUR NEXT WORLD IS ONE TAP AWAY</h2>
              <p className="mx-auto mt-5 max-w-[48ch] text-muted-foreground">Follow the official game page for current availability and step into Sonic Racing: CrossWorlds.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg"><a href={gameUrl} target="_blank" rel="noopener noreferrer">Explore the game <ArrowRight /></a></Button>
                <Button asChild size="lg" variant="glass"><a href="#players"><Gamepad2 /> Who it’s for</a></Button>
                <CalMeetingButton />
              </div>
            </div>
          </section>

          <section id="faq" className="scroll-mt-24 py-19 md:py-24">
            <div className="reveal-on-scroll mb-10">
              <p className="mb-3 font-mono text-xs uppercase text-primary">(c) QUESTIONS</p>
              <h2 className="font-display text-4xl sm:text-5xl">EVERYTHING YOU’RE WONDERING</h2>
            </div>
            <div className="grid gap-x-12 md:grid-cols-2">
              {[faqs.slice(0, 5), faqs.slice(5)].map((column, index) => (
                <div key={index}>{column.map(([question, answer]) => (
                  <div key={question} className="border-t border-border py-5 last:border-b">
                    <h3 className="text-base font-semibold">{question}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
                  </div>
                ))}</div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-5 py-8 sm:flex-row sm:items-center md:px-8">
          <div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-sm bg-primary font-display text-sm text-primary-foreground">S</span><span className="font-display text-lg">SEGA (unnofficial)</span></div>
          <p className="text-xs text-muted-foreground">A fan-made discovery concept. Not affiliated with or endorsed by SEGA.</p>
          <a className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground" href="https://www.sega.com/" target="_blank" rel="noopener noreferrer">Visit SEGA <ArrowRight size={13} /></a>
        </div>
      </footer>
      <ChatWidget />
    </div>
  );
}