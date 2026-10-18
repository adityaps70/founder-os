import type { Tone } from "@/components/ui/badge";

export function moodTone(mood: number | null | undefined): Tone {
  if (!mood) return "gray";
  if (mood >= 4) return "green";
  if (mood === 3) return "blue";
  return "amber";
}

export function moodLabel(mood: number | null | undefined) {
  return mood ? `Mood ${mood}/5` : "No mood";
}
