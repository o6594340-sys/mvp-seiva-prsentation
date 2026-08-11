"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

type ProgrammeBlock = {
  timeOrPeriod: string;
  title: string;
  description: string;
  imageUrl: string | null;
};

type ProgrammeDay = {
  dayNumber: number;
  title: string;
  rhythm: string | null;
  highlight: string | null;
  blocks: ProgrammeBlock[];
};

type Programme = {
  id: string;
  briefId: string;
  conceptTitle: string;
  conceptSummary: string | null;
  voice: string | null;
  startDate: string | null;
  days: ProgrammeDay[];
  updatedAt: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const VOICE_OPTIONS = ["Возвышенный", "Дерзкий", "Вдохновляющий", "Спокойный нейтральный"];

function renumberDays(days: ProgrammeDay[]): ProgrammeDay[] {
  return days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
}

function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
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
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
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
          body: JSON.stringify({
            conceptTitle: next.conceptTitle,
            conceptSummary: next.conceptSummary,
            voice: next.voice,
            startDate: next.startDate,
            days: next.days,
          }),
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

  async function generateViaAI() {
    if (!programme) return;

    const confirmed = window.confirm(
      "Сгенерировать программу через AI? Это заменит весь текущий текст — название, дни и блоки.",
    );
    if (!confirmed) return;

    setGenerating(true);
    setGenerateError("");

    try {
      const response = await fetch("/api/programmes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: programme.briefId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не удалось сгенерировать программу.");
      }

      isFirstLoad.current = true;
      setProgramme(data);
      setSaveStatus("saved");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Не удалось сгенерировать программу.");
    } finally {
      setGenerating(false);
    }
  }

  function updateConceptTitle(value: string) {
    setProgramme((prev) => (prev ? { ...prev, conceptTitle: value } : prev));
  }

  function updateStartDate(value: string) {
    setProgramme((prev) => (prev ? { ...prev, startDate: value || null } : prev));
  }

  function updateConceptSummary(value: string) {
    setProgramme((prev) => (prev ? { ...prev, conceptSummary: value || null } : prev));
  }

  function updateVoice(value: string) {
    setProgramme((prev) => (prev ? { ...prev, voice: value || null } : prev));
  }

  function updateDayRhythm(dayIndex: number, value: string) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, index) => (index === dayIndex ? { ...day, rhythm: value || null } : day));
      return { ...prev, days };
    });
  }

  function updateDayHighlight(dayIndex: number, value: string) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, index) => (index === dayIndex ? { ...day, highlight: value || null } : day));
      return { ...prev, days };
    });
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

  function updateBlockImage(dayIndex: number, blockIndex: number, imageUrl: string | null) {
    setProgramme((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, dIndex) => {
        if (dIndex !== dayIndex) return day;
        const blocks = day.blocks.map((block, bIndex) => (bIndex === blockIndex ? { ...block, imageUrl } : block));
        return { ...day, blocks };
      });
      return { ...prev, days };
    });
  }

  async function handleImageUpload(dayIndex: number, blockIndex: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const key = `${dayIndex}-${blockIndex}`;
    setUploadingKey(key);
    setUploadErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не удалось загрузить файл.");
      }

      updateBlockImage(dayIndex, blockIndex, data.url);
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Не удалось загрузить файл.",
      }));
    } finally {
      setUploadingKey(null);
    }
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
          blocks: [...day.blocks, { timeOrPeriod: "Время", title: "Новый блок", description: "", imageUrl: null }],
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
        { dayNumber: 0, title: "Новый день", rhythm: null, highlight: null, blocks: [] },
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
            <button
              type="button"
              onClick={generateViaAI}
              disabled={generating}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {generating ? "Генерируем..." : "Сгенерировать через AI"}
            </button>
            <Link href="/drafts" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
              К черновикам
            </Link>
          </div>
        </div>

        {generateError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{generateError}</p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="grid gap-1 text-sm">
            Название концепции
            <input
              value={programme.conceptTitle}
              onChange={(e) => updateConceptTitle(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-lg font-semibold"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Дата заезда (если известна)
            <input
              type="date"
              value={programme.startDate ?? ""}
              onChange={(e) => updateStartDate(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="grid gap-1 text-sm">
            Суть концепции (1 предложение)
            <textarea
              value={programme.conceptSummary ?? ""}
              onChange={(e) => updateConceptSummary(e.target.value)}
              rows={2}
              placeholder="Идея, которая держит всю поездку — не «лучшее из страны», а угол зрения под эту аудиторию."
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Регистр (голос текста)
            <select
              value={programme.voice ?? ""}
              onChange={(e) => updateVoice(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2"
            >
              <option value="">Не задан</option>
              {VOICE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4">
          {programme.days.map((day, dayIndex) => (
            <article key={dayIndex} className="grid gap-3 rounded-2xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    День {day.dayNumber}
                    {programme.startDate
                      ? ` · ${formatDisplayDate(addDaysToIsoDate(programme.startDate, day.dayNumber - 1))}`
                      : ""}
                  </span>
                  <input
                    value={day.title}
                    onChange={(e) => updateDayTitle(dayIndex, e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium"
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

                    <div className="flex items-center gap-3 md:col-span-3">
                      {block.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={block.imageUrl}
                          alt=""
                          className="h-16 w-24 rounded-lg border border-zinc-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-[10px] text-zinc-400">
                          Нет фото
                        </div>
                      )}
                      <div className="grid gap-1">
                        <label className="w-fit cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700">
                          {uploadingKey === `${dayIndex}-${blockIndex}`
                            ? "Загрузка..."
                            : block.imageUrl
                              ? "Заменить фото"
                              : "Добавить фото"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            disabled={uploadingKey === `${dayIndex}-${blockIndex}`}
                            onChange={(e) => handleImageUpload(dayIndex, blockIndex, e)}
                          />
                        </label>
                        {block.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => updateBlockImage(dayIndex, blockIndex, null)}
                            className="w-fit text-xs text-red-600 underline"
                          >
                            Удалить фото
                          </button>
                        ) : null}
                        {uploadErrors[`${dayIndex}-${blockIndex}`] ? (
                          <p className="text-xs text-red-600">{uploadErrors[`${dayIndex}-${blockIndex}`]}</p>
                        ) : null}
                      </div>
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

              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1 text-xs text-zinc-600">
                  Ритм дня (например: дорога → город → стол)
                  <input
                    value={day.rhythm ?? ""}
                    onChange={(e) => updateDayRhythm(dayIndex, e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-600">
                  Highlight дня (одна фраза, в чём соль)
                  <input
                    value={day.highlight ?? ""}
                    onChange={(e) => updateDayHighlight(dayIndex, e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
              </div>
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
