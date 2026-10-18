"use client";
import { useEffect, useState, useTransition } from "react";
import { moveDeal } from "@/actions/pipeline";
import { cn, formatMoney } from "@/lib/utils";

export interface BoardCard {
  id: string;
  stage: string;
  value: number;
  /** Server-rendered draggable content (DealCardBody) */
  body: React.ReactNode;
  /** Server-rendered buttons (DealCardActions) — not draggable */
  actions: React.ReactNode;
}

/** Kanban board for one pipeline. Drag a card onto another column to change its stage. */
export function DealBoard({
  slug,
  stages,
  cards,
  currency,
}: {
  slug: string;
  stages: { value: string; label: string; probability: number }[];
  cards: BoardCard[];
  currency: string;
}) {
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Fresh data from the server supersedes local moves.
  useEffect(() => setMoved({}), [cards]);

  const stageOf = (c: BoardCard) => moved[c.id] ?? c.stage;
  const knownStages = new Set(stages.map((s) => s.value));

  function drop(stage: string, id: string) {
    setOver(null);
    const card = cards.find((c) => c.id === id);
    if (!card || stageOf(card) === stage) return;
    setMoved((m) => ({ ...m, [id]: stage }));
    startTransition(async () => {
      await moveDeal(slug, id, stage);
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3 lg:grid lg:min-w-0" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => {
          // Cards with an unknown stage are shown in the first column.
          const colCards = cards.filter((c) => stageOf(c) === s.value || (i === 0 && !knownStages.has(stageOf(c))));
          const total = colCards.reduce((sum, c) => sum + c.value, 0);
          return (
            <div
              key={s.value}
              onDragOver={(e: React.DragEvent) => {
                e.preventDefault();
                if (over !== s.value) setOver(s.value);
              }}
              onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/deal-id");
                if (id) drop(s.value, id);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border border-line bg-surface-2/60 lg:w-auto",
                over === s.value && "border-accent bg-accent-soft",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{s.label}</p>
                  <p className="text-[11px] text-faint">
                    {colCards.length} · {formatMoney(total, currency, true)} · {s.probability}%
                  </p>
                </div>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {colCards.map((c) => (
                  <div key={c.id} className="rounded-lg border border-line bg-surface shadow-sm">
                    <div
                      draggable
                      onDragStart={(e: React.DragEvent) => {
                        e.dataTransfer.setData("text/deal-id", c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      {c.body}
                    </div>
                    {c.actions}
                  </div>
                ))}
                {colCards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-faint">Drop deals here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
