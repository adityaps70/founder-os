import type { KeyResult } from "@/lib/types";

/** Progress of one key result, 0–100 (works for decreasing targets too). */
export function krProgress(kr: Pick<KeyResult, "start_value" | "target_value" | "current_value">) {
  const start = Number(kr.start_value);
  const target = Number(kr.target_value);
  const cur = Number(kr.current_value);
  if (target === start) return cur >= target ? 100 : 0;
  const p = ((cur - start) / (target - start)) * 100;
  return Math.max(0, Math.min(100, p));
}

/** Goal progress = average of its key results (0 when none). */
export function goalProgress(krs: Pick<KeyResult, "start_value" | "target_value" | "current_value">[]) {
  if (krs.length === 0) return 0;
  return krs.reduce((s, k) => s + krProgress(k), 0) / krs.length;
}

export function progressTone(p: number): "good" | "warn" | "bad" | "accent" {
  if (p >= 70) return "good";
  if (p >= 35) return "accent";
  if (p >= 15) return "warn";
  return "bad";
}

/** Shift a quarter string like 2026-Q4 by n quarters. */
export function shiftQuarter(q: string, n: number) {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m) return q;
  const idx = Number(m[1]) * 4 + (Number(m[2]) - 1) + n;
  return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
}
