import { useEffect, useRef } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

const CAL_LINK = "https://cal.com/tugarr-lqwa5p/sega-meeting";
const CAL_PATH = "tugarr-lqwa5p/sega-meeting";
const SCRIPT_ID = "cal-embed-script";

declare global {
  interface Window {
    Cal?: ((...args: unknown[]) => void) & { q?: unknown[][]; ns?: Record<string, unknown> };
  }
}

/**
 * CTA that opens the Cal.com booking page (date + time picker) as an overlay.
 * Uses Cal.com's official element-click embed: a small bootstrap defines
 * window.Cal, then their embed.js script turns [data-cal-link] elements into
 * booking modals on desktop and mobile. If the embed script can't load, the
 * button falls back to opening the booking page in a new tab.
 */
export function CalMeetingButton({
  size = "lg",
  variant = "glass",
  className,
}: {
  size?: "sm" | "lg" | "default";
  variant?: "glass" | "default" | "secondary";
  className?: string;
}) {
  const failed = useRef(false);

  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    // Cal.com bootstrap — must run before embed.js loads.
    if (!window.Cal) {
      const cal: NonNullable<Window["Cal"]> = function (...args: unknown[]) {
        (cal.q = cal.q || []).push(args);
      };
      cal.q = [];
      cal.ns = {};
      window.Cal = cal;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://app.cal.com/embed/embed.js";
    script.async = true;
    script.onerror = () => {
      failed.current = true;
    };
    document.body.appendChild(script);
  }, []);

  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a
        href={CAL_LINK}
        target="_blank"
        rel="noopener noreferrer"
        data-cal-link={CAL_PATH}
        aria-label="Book a meeting via Cal.com"
        onClick={(e) => {
          // Cal's embed script opens the overlay; keep the anchor fallback
          // (new tab) only when the embed script failed to load.
          if (!failed.current) e.preventDefault();
        }}
      >
        <CalendarClock /> Book a meeting
      </a>
    </Button>
  );
}
