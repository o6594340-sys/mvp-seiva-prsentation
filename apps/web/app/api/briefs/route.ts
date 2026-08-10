import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

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

type SavedBrief = BriefPayload & {
  id: string;
  createdAt: string;
  programmeId: string;
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

type SavedProgramme = {
  id: string;
  briefId: string;
  conceptTitle: string;
  startDate: string | null;
  days: ProgrammeDay[];
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const BRIEFS_FILE = path.join(DATA_DIR, "briefs.json");
const PROGRAMMES_FILE = path.join(DATA_DIR, "programmes.json");

async function ensureStorage(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(BRIEFS_FILE);
  } catch {
    await fs.writeFile(BRIEFS_FILE, "[]", "utf-8");
  }

  try {
    await fs.access(PROGRAMMES_FILE);
  } catch {
    await fs.writeFile(PROGRAMMES_FILE, "[]", "utf-8");
  }
}

async function loadBriefs(): Promise<SavedBrief[]> {
  await ensureStorage();
  const raw = await fs.readFile(BRIEFS_FILE, "utf-8");
  return JSON.parse(raw) as SavedBrief[];
}

async function saveBriefs(briefs: SavedBrief[]): Promise<void> {
  await fs.writeFile(BRIEFS_FILE, JSON.stringify(briefs, null, 2), "utf-8");
}

async function loadProgrammes(): Promise<SavedProgramme[]> {
  await ensureStorage();
  const raw = await fs.readFile(PROGRAMMES_FILE, "utf-8");
  return JSON.parse(raw) as SavedProgramme[];
}

async function saveProgrammes(programmes: SavedProgramme[]): Promise<void> {
  await fs.writeFile(PROGRAMMES_FILE, JSON.stringify(programmes, null, 2), "utf-8");
}

function isValidPayload(payload: Partial<BriefPayload>): payload is BriefPayload {
  return Boolean(
    payload &&
      typeof payload.participants === "number" &&
      payload.participants > 0 &&
      typeof payload.industry === "string" &&
      payload.industry.trim() &&
      typeof payload.eventType === "string" &&
      payload.eventType.trim() &&
      Array.isArray(payload.countries) &&
      payload.countries.length > 0 &&
      typeof payload.allowAlternativeCountry === "boolean" &&
      typeof payload.ageGroup === "string" &&
      payload.ageGroup.trim() &&
      typeof payload.genderRatio === "string" &&
      typeof payload.sportInterest === "string" &&
      payload.sportInterest.trim() &&
      typeof payload.goal === "string" &&
      payload.goal.trim() &&
      typeof payload.restrictions === "string" &&
      payload.restrictions.trim() &&
      typeof payload.durationDays === "number" &&
      Number.isInteger(payload.durationDays) &&
      payload.durationDays > 0 &&
      (payload.startDate === null || typeof payload.startDate === "string") &&
      typeof payload.intensity === "string" &&
      payload.intensity.trim(),
  );
}

function buildStubProgramme(brief: BriefPayload) {
  const countryText = brief.countries.join(", ");
  const isPacked = brief.intensity.startsWith("Насыщ");
  const isModerate = brief.intensity.startsWith("Умерен");

  function arrivalBlocks(): ProgrammeBlock[] {
    const blocks: ProgrammeBlock[] = [
      {
        timeOrPeriod: "Утро",
        title: "Прибытие и трансфер",
        description: `Группа ${brief.participants} чел. прибывает и размещается.`,
      },
      {
        timeOrPeriod: "День",
        title: "Ориентационная активность",
        description: isModerate
          ? `Короткая вводная программа под аудиторию ${brief.ageGroup} с учетом ограничений: ${brief.restrictions}. Оставлено свободное окно для отдыха после перелета.`
          : `Короткая вводная программа под аудиторию ${brief.ageGroup} с учетом ограничений: ${brief.restrictions}.`,
      },
      {
        timeOrPeriod: "Вечер",
        title: "Приветственный ужин",
        description: `Неформальное знакомство и контекст по цели поездки: ${brief.goal}.`,
      },
    ];

    if (isPacked) {
      blocks.push({
        timeOrPeriod: "Ночь",
        title: "Вечерняя активность",
        description: "Дополнительный неформальный блок для группы после ужина, без пауз в расписании.",
      });
    }

    return blocks;
  }

  function keyDayBlocks(): ProgrammeBlock[] {
    const blocks: ProgrammeBlock[] = [
      {
        timeOrPeriod: "Утро",
        title: "Тематическая сессия",
        description: `Контентный блок под сферу ${brief.industry} и формат ${brief.eventType}.`,
      },
      {
        timeOrPeriod: "День",
        title: "Практическая активность",
        description: isModerate
          ? "Командный формат с вариантом адаптации под разный уровень включенности участников. В расписании заложено свободное время."
          : "Командный формат с вариантом адаптации под разный уровень включенности участников.",
      },
      {
        timeOrPeriod: "Вечер",
        title: "Культурный или гастро-блок",
        description: `Варианты под выбранные страны: ${countryText}${brief.allowAlternativeCountry ? " (возможна альтернатива)" : ""}.`,
      },
    ];

    if (isPacked) {
      blocks.splice(2, 0, {
        timeOrPeriod: "Полдень",
        title: "Дополнительная активность",
        description: "Ещё один блок перед вечерней частью, день выстроен плотно от утра до вечера.",
      });
    }

    return blocks;
  }

  function departureBlocks(): ProgrammeBlock[] {
    return [
      {
        timeOrPeriod: "Утро",
        title: "Финальный блок",
        description: "Подведение итогов поездки и сбор обратной связи команды.",
      },
      {
        timeOrPeriod: "День",
        title: "Свободное окно или доп. активность",
        description: "Резерв под корректировки по запросу клиента.",
      },
      {
        timeOrPeriod: "Вечер",
        title: "Трансфер в аэропорт",
        description: "Организованный вылет и завершение программы.",
      },
    ];
  }

  const totalDays = brief.durationDays;
  const days: ProgrammeDay[] = [];

  if (totalDays <= 1) {
    days.push({
      dayNumber: 1,
      title: "Программа одного дня",
      blocks: [
        {
          timeOrPeriod: "Утро",
          title: "Прибытие и старт программы",
          description: `Группа ${brief.participants} чел. собирается, короткое приветствие под цель поездки: ${brief.goal}.`,
        },
        {
          timeOrPeriod: "День",
          title: "Основной блок",
          description: `Контентная и практическая часть под сферу ${brief.industry} и формат ${brief.eventType}.`,
        },
        {
          timeOrPeriod: "Вечер",
          title: "Завершение и отъезд",
          description: `Подведение итогов и организованный трансфер. Ограничения учтены: ${brief.restrictions}.`,
        },
      ],
    });
  } else {
    days.push({ dayNumber: 1, title: "Прилет и мягкое вовлечение команды", blocks: arrivalBlocks() });

    const middleCount = totalDays - 2;
    for (let i = 0; i < middleCount; i += 1) {
      days.push({
        dayNumber: i + 2,
        title: middleCount > 1 ? `Ключевой день программы (${i + 1}/${middleCount})` : "Ключевой день программы",
        blocks: keyDayBlocks(),
      });
    }

    days.push({ dayNumber: totalDays, title: "Завершение и вылет", blocks: departureBlocks() });
  }

  return {
    conceptTitle: `${brief.eventType} в ${countryText}`,
    days,
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<BriefPayload>;

    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const briefId = randomUUID();
    const programmeId = randomUUID();

    const brief: SavedBrief = {
      ...payload,
      id: briefId,
      createdAt: new Date().toISOString(),
      programmeId,
    };

    const programme: SavedProgramme = {
      id: programmeId,
      briefId,
      startDate: brief.startDate,
      ...buildStubProgramme(brief),
      updatedAt: new Date().toISOString(),
    };

    const briefs = await loadBriefs();
    briefs.unshift(brief);
    await saveBriefs(briefs);

    const programmes = await loadProgrammes();
    programmes.unshift(programme);
    await saveProgrammes(programmes);

    return NextResponse.json({
      briefId: brief.id,
      programmeId: programme.id,
      programme,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const briefs = await loadBriefs();
    return NextResponse.json({
      items: briefs,
      total: briefs.length,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}