"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type BriefPayload = {
  participants: number;
  industry: string;
  eventType: string;
  countries: string[];
  allowAlternativeCountry: boolean;
  ageGroup: string;
  genderRatio: string;
  sportInterest: string;
  goal: string;
  restrictions: string;
  durationDays: number;
  startDate: string | null;
  intensity: string;
};

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

type ApiResponse = {
  briefId: string;
  programmeId: string;
  programme: {
    conceptTitle: string;
    days: ProgrammeDay[];
  };
};

const EVENT_TYPES = [
  "Инсентив",
  "Поощрительная поездка",
  "VIP",
  "Конференция",
  "Круглый стол",
  "Тимбилдинг",
];

const INTENSITY_LEVELS = [
  "Умеренная",
  "Активная",
  "Насыщенная (с утра до вечера)",
];

function formatGenderRatio(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function Home() {
  const router = useRouter();
  const [participants, setParticipants] = useState(50);
  const [industry, setIndustry] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [countries, setCountries] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState("");
  const [allowAlternativeCountry, setAllowAlternativeCountry] = useState(false);
  const [ageGroup, setAgeGroup] = useState("");
  const [genderRatio, setGenderRatio] = useState("");
  const [sportInterest, setSportInterest] = useState("Средний");
  const [goal, setGoal] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [durationDays, setDurationDays] = useState(3);
  const [startDate, setStartDate] = useState("");
  const [intensity, setIntensity] = useState(INTENSITY_LEVELS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const canAddCountry = useMemo(() => {
    const value = newCountry.trim();
    return Boolean(value) && !countries.includes(value);
  }, [newCountry, countries]);

  const addCountry = () => {
    const value = newCountry.trim();
    if (!value || countries.includes(value)) {
      return;
    }

    setCountries((prev) => [...prev, value]);
    setNewCountry("");
  };

  const removeCountry = (country: string) => {
    setCountries((prev) => prev.filter((item) => item !== country));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!industry.trim() || !goal.trim() || !restrictions.trim() || !ageGroup.trim()) {
      setError("Заполните все обязательные текстовые поля.");
      return;
    }

    if (countries.length === 0) {
      setError("Добавьте хотя бы одну страну.");
      return;
    }

    if (!durationDays || durationDays < 1) {
      setError("Укажите количество дней поездки.");
      return;
    }

    const payload: BriefPayload = {
      participants,
      industry: industry.trim(),
      eventType,
      countries,
      allowAlternativeCountry,
      ageGroup: ageGroup.trim(),
      genderRatio: genderRatio.trim(),
      sportInterest,
      goal: goal.trim(),
      restrictions: restrictions.trim(),
      durationDays,
      startDate: startDate || null,
      intensity,
    };

    try {
      setLoading(true);

      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Не удалось сохранить бриф.");
      }

      const data: ApiResponse = await response.json();
      setResult(data);
    } catch {
      setError("Ошибка сохранения. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-8 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm md:p-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">SEIVA MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Бриф корпоративной поездки</h1>
            <p className="mt-2 text-sm text-zinc-600">Заполните бриф. После отправки появится предварительная программа по дням.</p>
          </div>
          <Link href="/drafts" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            Черновики
          </Link>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Количество участников *
              <input
                type="number"
                min={1}
                value={participants}
                onChange={(e) => setParticipants(Number(e.target.value || 1))}
                className="rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Сфера компании *
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Например: IT, фарма, авто"
                className="rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Тип мероприятия *
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="rounded-xl border border-zinc-300 px-3 py-2"
              >
                {EVENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              Количество дней поездки *
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value || 1))}
                className="rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Дата заезда (если известна)
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-zinc-300 px-3 py-2"
              />
              <span className="text-xs text-zinc-500">Если дата ещё не известна — оставьте пустым, дни будут пронумерованы.</span>
            </label>

            <label className="grid gap-1 text-sm">
              Примерный возраст участников *
              <input
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="Например: 30-45"
                className="rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Соотношение мужчин/женщин
              <input
                value={genderRatio}
                onChange={(e) => setGenderRatio(formatGenderRatio(e.target.value))}
                placeholder="70/30"
                className="rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Интерес к спорту/экстриму *
              <select
                value={sportInterest}
                onChange={(e) => setSportInterest(e.target.value)}
                className="rounded-xl border border-zinc-300 px-3 py-2"
              >
                <option>Низкий</option>
                <option>Средний</option>
                <option>Высокий</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              Интенсивность программы *
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="rounded-xl border border-zinc-300 px-3 py-2"
              >
                {INTENSITY_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-2 rounded-2xl border border-zinc-200 p-4">
            <p className="text-sm font-medium">Страны *</p>
            <div className="flex flex-wrap gap-2">
              {countries.map((country) => (
                <button
                  type="button"
                  key={country}
                  onClick={() => removeCountry(country)}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                >
                  {country} x
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="Добавить страну"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={addCountry}
                disabled={!canAddCountry}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-40"
              >
                Добавить
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowAlternativeCountry}
                onChange={(e) => setAllowAlternativeCountry(e.target.checked)}
              />
              Разрешить предложить альтернативную страну
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            Цель поездки *
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Ограничения и важные условия *
            <textarea
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              rows={3}
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />
          </label>

          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? "Сохраняем..." : "Сохранить бриф и получить программу"}
          </button>
        </form>

        {result ? (
          <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Черновик создан</p>
                <h2 className="text-xl font-semibold">{result.programme.conceptTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/programme/${result.programmeId}`)}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Открыть редактор программы
              </button>
            </div>

            <div className="grid gap-3">
              {result.programme.days.map((day) => (
                <article key={day.dayNumber} className="rounded-xl border border-emerald-200 bg-white p-3">
                  <h3 className="font-semibold">
                    День {day.dayNumber}: {day.title}
                  </h3>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {day.blocks.map((block, index) => (
                      <li key={`${day.dayNumber}-${index}`} className="rounded-lg bg-emerald-50 p-2">
                        <p className="font-medium">
                          {block.timeOrPeriod} - {block.title}
                        </p>
                        <p className="text-zinc-700">{block.description}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
