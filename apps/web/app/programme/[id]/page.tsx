"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

type ProgrammeBlock = {
  timeOrPeriod: string;
  title: string;
  description: string;
};

type ProgrammeDay = {
  dayNumber: number;
  title: string;
  blocks: ProgrammeBlock[];
};

type Programme = {
  id: string;
  briefId: string;
  conceptTitle: string;
  days: ProgrammeDay[];
  updatedAt: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function renumberDays(days: ProgrammeDay[]): ProgrammeDay[] {
  return days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function ProgrammeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/programmes/${id}`);
        if (!response.ok) {
          throw new Error("not found");
        }
        const data: Programme = await response.json();
        if (!cancelled) {
          setProgramme(data);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Программа не найдена.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const persist = useCallback(
    async (next: Programme) => {
      setSaveStatus("saving");
      try {
        const response = await fetch(`/api/programmes/${next.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conceptTitle: next.conceptTitle, days: next.days }),
        });
        if (!response.ok) {
          throw new Error("save failed");
        }
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [],
  );

  useEffect(() => {
    if (!programme) {
      return;
    }
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      persist(programme);
    }, 800);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme]);

  function updateConceptTitle(value: string) {
    setProgramme((prev) => (prev ? { ...prev, conceptTitle: value } : prev));
  }

  function updateDayTitle(dayIndex: number, value: string) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, index) => (index === dayIndex ? { ...day, title: value } : day));
      return { ...prev, days };
    });
  }

  function updateBlock(dayIndex: number, blockIndex: number, field: keyof ProgrammeBlock, value: string) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, dIndex) => {
        if (dIndex !== dayIndex) return day;
        const blocks = day.blocks.map((block, bIndex) =>
          bIndex === blockIndex ? { ...block, [field]: value } : block,
        );
        return { ...day, blocks };
      });
      return { ...prev, days };
    });
  }

  function moveDay(dayIndex: number, direction: -1 | 1) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = renumberDays(move(prev.days, dayIndex, dayIndex + direction));
      return { ...prev, days };
    });
  }

  function moveBlock(dayIndex: number, blockIndex: number, direction: -1 | 1) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, dIndex) => {
        if (dIndex !== dayIndex) return day;
        return { ...day, blocks: move(day.blocks, blockIndex, blockIndex + direction) };
      });
      return { ...prev, days };
    });
  }

  function addBlock(dayIndex: number) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, dIndex) => {
        if (dIndex !== dayIndex) return day;
        return {
          ...day,
          blocks: [...day.blocks, { timeOrPeriod: "Время", title: "Новый блок", description: "" }],
        };
      });
      return { ...prev, days };
    });
  }

  function removeBlock(dayIndex: number, blockIndex: number) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, dIndex) => {
        if (dIndex !== dayIndex) return day;
        return { ...day, blocks: day.blocks.filter((_, bIndex) => bIndex !== blockIndex) };
      });
      return { ...prev, days };
    });
  }

  function addDay() {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = renumberDays([
        ...prev.days,
        { dayNumber: 0, title: "Новый день", blocks: [] },
      ]);
      return { ...prev, days };
    });
  }

  function removeDay(dayIndex: number) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = renumberDays(prev.days.filter((_, index) => index !== dayIndex));
      return { ...prev, days };
    });
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-amber-50 px-4 py-8 text-zinc-900">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-sm text-red-700">{loadError}</p>
          <Link href="/drafts" className="text-sm font-semibold underline">
            Вернуться к черновикам
          </Link>
        </main>
      </div>
    );
  }

  if (!programme) {
    return (
      <div className="min-h-screen bg-amber-50 px-4 py-8 text-zinc-900">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-sm text-zinc-600">Загрузка программы...</p>
        </main>
      </div>
    );
  }

  const statusLabel: Record<SaveStatus, string> = {
    idle: "",
    saving: "Сохранение...",
    saved: "Сохранено",
    error: "Ошибка сохранения",
  };

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-8 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">SEIVA MVP</p>
            <h1 className="mt-2 text-2xl font-semibold">Редактор программы</h1>
          </div>
          <div className="flex items-center gap-3">
            <p
              className={
                "text-xs font-medium " +
                (saveStatus === "error" ? "text-red-600" : "text-emerald-600")
              }
            >
              {statusLabel[saveStatus]}
            </p>
            <Link href="/drafts" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
              К черновикам
            </Link>
          </div>
        </div>

        <label className="grid gap-1 text-sm">
          Название концепции
          <input
            value={programme.conceptTitle}
            onChange={(e) => updateConceptTitle(e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-lg font-semibold"
          />
        </label>

        <div className="grid gap-4">
          {programme.days.map((day, dayIndex) => (
            <article key={dayIndex} className="grid gap-3 rounded-2xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    День {day.dayNumber}
                  </span>
                  <input
                    value={day.title}
                    onChange={(e) => updateDayTitle(dayIndex, e.target.value)}
                    className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveDay(dayIndex, -1)}
                    disabled={dayIndex === 0}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                  >
                    Вверх
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDay(dayIndex, 1)}
                    disabled={dayIndex === programme.days.length - 1}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                  >
                    Вниз
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDay(dayIndex)}
                    className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700"
                  >
                    Удалить день
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {day.blocks.map((block, blockIndex) => (
                  <div key={blockIndex} className="grid gap-2 rounded-xl bg-zinc-50 p-3 md:grid-cols-[140px_1fr_auto]">
                    <input
                      value={block.timeOrPeriod}
                      onChange={(e) => updateBlock(dayIndex, blockIndex, "timeOrPeriod", e.target.value)}
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      placeholder="Время"
                    />
                    <div className="grid gap-2">
                      <input
                        value={block.title}
                        onChange={(e) => updateBlock(dayIndex, blockIndex, "title", e.target.value)}
                        className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm font-medium"
                        placeholder="Заголовок блока"
                      />
                      <textarea
                        value={block.description}
                        onChange={(e) => updateBlock(dayIndex, blockIndex, "description", e.target.value)}
                        rows={2}
                        className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                        placeholder="Описание"
                      />
                    </div>
                    <div className="flex flex-row gap-1 md:flex-col">
                      <button
                        type="button"
                        onClick={() => moveBlock(dayIndex, blockIndex, -1)}
                        disabled={blockIndex === 0}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(dayIndex, blockIndex, 1)}
                        disabled={blockIndex === day.blocks.length - 1}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(dayIndex, blockIndex)}
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addBlock(dayIndex)}
                className="w-fit rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600"
              >
                + Добавить блок
              </button>
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={addDay}
          className="w-fit rounded-xl border border-dashed border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700"
        >
          + Добавить день
        </button>
      </main>
    </div>
  );
}
