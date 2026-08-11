import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

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

type SavedProgramme = {
  id: string;
  briefId: string;
  conceptTitle: string;
  conceptSummary: string | null;
  voice: string | null;
  startDate: string | null;
  days: ProgrammeDay[];
  updatedAt: string;
};

type ProgrammeUpdatePayload = {
  conceptTitle: string;
  conceptSummary: string | null;
  voice: string | null;
  startDate: string | null;
  days: ProgrammeDay[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const PROGRAMMES_FILE = path.join(DATA_DIR, "programmes.json");

async function loadProgrammes(): Promise<SavedProgramme[]> {
  try {
    const raw = await fs.readFile(PROGRAMMES_FILE, "utf-8");
    return JSON.parse(raw) as SavedProgramme[];
  } catch {
    return [];
  }
}

async function saveProgrammes(programmes: SavedProgramme[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROGRAMMES_FILE, JSON.stringify(programmes, null, 2), "utf-8");
}

function isValidBlock(value: unknown): value is ProgrammeBlock {
  if (!value || typeof value !== "object") {
    return false;
  }
  const block = value as Partial<ProgrammeBlock>;
  return (
    typeof block.timeOrPeriod === "string" &&
    typeof block.title === "string" &&
    typeof block.description === "string" &&
    (block.imageUrl === null || typeof block.imageUrl === "string")
  );
}

function isValidDay(value: unknown): value is ProgrammeDay {
  if (!value || typeof value !== "object") {
    return false;
  }
  const day = value as Partial<ProgrammeDay>;
  return (
    typeof day.dayNumber === "number" &&
    typeof day.title === "string" &&
    (day.rhythm === null || typeof day.rhythm === "string") &&
    (day.highlight === null || typeof day.highlight === "string") &&
    Array.isArray(day.blocks) &&
    day.blocks.every(isValidBlock)
  );
}

function isValidPayload(payload: Partial<ProgrammeUpdatePayload>): payload is ProgrammeUpdatePayload {
  return (
    typeof payload.conceptTitle === "string" &&
    payload.conceptTitle.trim().length > 0 &&
    (payload.conceptSummary === null || typeof payload.conceptSummary === "string") &&
    (payload.voice === null || typeof payload.voice === "string") &&
    (payload.startDate === null || typeof payload.startDate === "string") &&
    Array.isArray(payload.days) &&
    payload.days.length > 0 &&
    payload.days.every(isValidDay)
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const programmes = await loadProgrammes();
  const programme = programmes.find((item) => item.id === id);

  if (!programme) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(programme);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const payload = (await request.json()) as Partial<ProgrammeUpdatePayload>;

    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const programmes = await loadProgrammes();
    const index = programmes.findIndex((item) => item.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated: SavedProgramme = {
      ...programmes[index],
      conceptTitle: payload.conceptTitle.trim(),
      conceptSummary: payload.conceptSummary,
      voice: payload.voice,
      startDate: payload.startDate,
      days: payload.days,
      updatedAt: new Date().toISOString(),
    };

    programmes[index] = updated;
    await saveProgrammes(programmes);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
