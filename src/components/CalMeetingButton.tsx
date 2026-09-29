import { useEffect } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

const CAL_LINK = "https://cal.com/tugarr-lqwa5p/sega-meeting";
const SCRIPT_ID = "cal-embed-script";

/**
 * CTA that opens the Cal.com booking page (date + time picker) as an overlay
 * when the embed script is available, and falls back to opening the booking
 * page in a new tab otherwise. Works on desktop and mobile.
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
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://app.cal.com/embed/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a
        href={CAL_LINK}
        target="_blank"
        rel="noopener noreferrer"
        data-cal-link="tugarr-lqwa5p/sega-meeting"
        aria-label="Book a meeting via Cal.com"
      >
        <CalendarClock /> Book a meeting
      </a>
    </Button>
  );
}
