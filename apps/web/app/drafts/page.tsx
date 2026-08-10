import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

type SavedBrief = {
  id: string;
  createdAt: string;
  programmeId?: string;
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
  durationDays?: number;
  startDate?: string | null;
  intensity?: string;
};

const BRIEFS_FILE = path.join(process.cwd(), "data", "briefs.json");

async function readBriefs(): Promise<SavedBrief[]> {
  try {
    const raw = await fs.readFile(BRIEFS_FILE, "utf-8");
    return JSON.parse(raw) as SavedBrief[];
  } catch {
    return [];
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function formatTripDates(brief: SavedBrief): string {
  if (!brief.durationDays) {
    return "не указано";
  }
  if (!brief.startDate) {
    return `${brief.durationDays} дн. (даты не заданы)`;
  }
  const endDate = addDaysToIsoDate(brief.startDate, brief.durationDays - 1);
  return `${formatShortDate(brief.startDate)} – ${formatShortDate(endDate)} (${brief.durationDays} дн.)`;
}

export default async function DraftsPage() {
  const items = await readBriefs();

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-8 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm md:p-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">SEIVA MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Черновики</h1>
            <p className="mt-2 text-sm text-zinc-600">Список сохраненных брифов для дальнейшей доработки.</p>
          </div>
          <Link href="/" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            Новый бриф
          </Link>
        </div>

        {items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600">
            Пока нет черновиков. Создайте первый бриф на главной странице.
          </section>
        ) : (
          <section className="grid gap-3">
            {items.map((brief) => (
              <article key={brief.id} className="grid gap-3 rounded-2xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{brief.eventType}</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-zinc-500">{formatDate(brief.createdAt)}</p>
                    {brief.programmeId ? (
                      <Link
                        href={`/programme/${brief.programmeId}`}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Открыть программу
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-1 text-sm text-zinc-700 md:grid-cols-2">
                  <p>
                    <span className="font-medium">Страны:</span> {brief.countries.join(", ")}
                  </p>
                  <p>
                    <span className="font-medium">Участники:</span> {brief.participants}
                  </p>
                  <p>
                    <span className="font-medium">Сфера:</span> {brief.industry}
                  </p>
                  <p>
                    <span className="font-medium">Даты поездки:</span> {formatTripDates(brief)}
                  </p>
                  <p>
                    <span className="font-medium">Возраст:</span> {brief.ageGroup}
                  </p>
                  <p>
                    <span className="font-medium">Соотношение:</span> {brief.genderRatio || "не указано"}
                  </p>
                  <p>
                    <span className="font-medium">Спорт/экстрим:</span> {brief.sportInterest}
                  </p>
                  <p>
                    <span className="font-medium">Интенсивность:</span> {brief.intensity}
                  </p>
                </div>

                <p className="text-sm text-zinc-700">
                  <span className="font-medium">Цель:</span> {brief.goal}
                </p>
                <p className="text-sm text-zinc-600">
                  <span className="font-medium">Ограничения:</span> {brief.restrictions}
                </p>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}