"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

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

export default function ProgrammePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loadError, setLoadError] = useState("");

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

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-10 text-zinc-900 print:bg-white print:py-0">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 rounded-3xl border border-amber-200 bg-white p-8 shadow-sm md:p-14 print:max-w-none print:rounded-none print:border-none print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/programme/${id}`} className="text-sm font-semibold text-zinc-600 underline">
            ← Назад к редактору
          </Link>
          <div className="flex items-center gap-3">
            {programme.voice ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                Регистр: {programme.voice}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Печать / PDF
            </button>
          </div>
        </div>

        <header className="grid gap-3 border-b border-amber-200 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Программа поездки
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-balance">{programme.conceptTitle}</h1>
          {programme.conceptSummary ? (
            <p className="text-lg leading-relaxed text-zinc-700">{programme.conceptSummary}</p>
          ) : (
            <p className="text-sm italic text-zinc-400">Суть концепции пока не заполнена.</p>
          )}
        </header>

        <div className="flex flex-col gap-12">
          {programme.days.map((day) => (
            <section key={day.dayNumber} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 pb-2">
                <h2 className="text-2xl font-semibold">
                  День {day.dayNumber}
                  {day.title ? `. ${day.title}` : ""}
                </h2>
                {programme.startDate ? (
                  <span className="text-sm text-zinc-500">
                    {formatDisplayDate(addDaysToIsoDate(programme.startDate, day.dayNumber - 1))}
                  </span>
                ) : null}
              </div>

              {day.rhythm || day.highlight ? (
                <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                  {day.rhythm ? (
                    <p>
                      <span className="font-semibold text-zinc-700">Ритм: </span>
                      {day.rhythm}
                    </p>
                  ) : null}
                  {day.highlight ? (
                    <p>
                      <span className="font-semibold text-zinc-700">Соль дня: </span>
                      {day.highlight}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-6">
                {day.blocks.map((block, blockIndex) => (
                  <div key={blockIndex} className="flex flex-col gap-2 md:flex-row md:gap-6">
                    <p className="shrink-0 text-sm font-semibold uppercase tracking-wide text-amber-700 md:w-32">
                      {block.timeOrPeriod}
                    </p>
                    <div className="flex flex-1 flex-col gap-2">
                      <h3 className="text-lg font-semibold">{block.title}</h3>
                      <p className="leading-relaxed text-zinc-700">{block.description}</p>
                      {block.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={block.imageUrl}
                          alt=""
                          className="mt-1 h-48 w-full max-w-md rounded-xl border border-zinc-200 object-cover"
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
