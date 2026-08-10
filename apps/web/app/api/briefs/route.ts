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
      payload.restrictions.trim(),
  );
}

function buildStubProgramme(brief: BriefPayload) {
  const countryText = brief.countries.join(", ");

  return {
    conceptTitle: `${brief.eventType} в ${countryText}`,
    days: [
      {
        dayNumber: 1,
        title: "Прилет и мягкое вовлечение команды",
        blocks: [
          {
            timeOrPeriod: "Утро",
            title: "Прибытие и трансфер",
            description: `Группа ${brief.participants} чел. прибывает и размещается. Темп задан как ${brief.sportInterest.toLowerCase()}.`,
          },
          {
            timeOrPeriod: "День",
            title: "Ориентационная активность",
            description: `Короткая вводная программа под аудиторию ${brief.ageGroup} с учетом ограничений: ${brief.restrictions}.`,
          },
          {
            timeOrPeriod: "Вечер",
            title: "Приветственный ужин",
            description: `Неформальное знакомство и контекст по цели поездки: ${brief.goal}.`,
          },
        ],
      },
      {
        dayNumber: 2,
        title: "Ключевой день программы",
        blocks: [
          {
            timeOrPeriod: "Утро",
            title: "Тематическая сессия",
            description: `Контентный блок под сферу ${brief.industry} и формат ${brief.eventType}.`,
          },
          {
            timeOrPeriod: "День",
            title: "Практическая активность",
            description: "Командный формат с вариантом адаптации под разный уровень включенности участников.",
          },
          {
            timeOrPeriod: "Вечер",
            title: "Культурный или гастро-блок",
            description: `Варианты под выбранные страны: ${countryText}${brief.allowAlternativeCountry ? " (возможна альтернатива)" : ""}.`,
          },
        ],
      },
      {
        dayNumber: 3,
        title: "Завершение и вылет",
        blocks: [
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
        ],
      },
    ],
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