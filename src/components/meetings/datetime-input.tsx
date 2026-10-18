"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * datetime-local input that posts `starts_at_local` plus the browser's `tz_offset`,
 * so the server can convert to UTC correctly (see parseStart in actions/meetings.ts).
 * Defaults to `defaultIso`, or the next full hour.
 */
export function DateTimeInput({ defaultIso, required = true }: { defaultIso?: string | null; required?: boolean }) {
  const [value, setValue] = useState("");
  const [offset, setOffset] = useState("0");
  useEffect(() => {
    let d: Date;
    if (defaultIso) d = new Date(defaultIso);
    else {
      d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
    }
    setValue(toLocalInput(d));
    setOffset(String(new Date().getTimezoneOffset()));
  }, [defaultIso]);
  return (
    <>
      <Input type="datetime-local" name="starts_at_local" required={required} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)} />
      <input type="hidden" name="tz_offset" value={offset} />
    </>
  );
}
