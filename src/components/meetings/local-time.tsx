"use client";
import { useEffect, useState } from "react";

const FORMATS: Record<"datetime" | "date" | "time" | "weekday", Intl.DateTimeFormatOptions> = {
  datetime: { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  date: { day: "numeric", month: "short", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
  weekday: { weekday: "long", day: "numeric", month: "long" },
};

/**
 * Renders a timestamp in the viewer's own time zone. The first (server) render
 * uses UTC so server and client markup match, then switches to local time.
 */
export function LocalTime({ iso, format = "datetime", className }: { iso: string; format?: keyof typeof FORMATS; className?: string }) {
  const [text, setText] = useState(() =>
    new Intl.DateTimeFormat("en-IN", { ...FORMATS[format], timeZone: "UTC" }).format(new Date(iso)),
  );
  useEffect(() => {
    setText(new Intl.DateTimeFormat("en-IN", FORMATS[format]).format(new Date(iso)));
  }, [iso, format]);
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
