import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { openaiChat } from "@/lib/openai";

type SavedBrief = {
  id: string;
  programmeId: string;
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
  imageUrl: string | null;
};

// Shape the AI actually returns — no imageUrl, that's added manually by the manager after generation.
type GeneratedBlock = {
  timeOrPeriod: string;
  title: string;
  description: string;
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

type GeneratedProgramme = {
  conceptTitle: string;
  conceptSummary: string;
  voice: string;
  days: {
    title: string;
    rhythm: string;
    highlight: string;
    blocks: GeneratedBlock[];
  }[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const BRIEFS_FILE = path.join(DATA_DIR, "briefs.json");
const PROGRAMMES_FILE = path.join(DATA_DIR, "programmes.json");
const SKILL_DIR = path.join(process.cwd(), "..", "..", ".claude", "skills", "mice-copywriter");
const SKILL_PATH = path.join(SKILL_DIR, "SKILL.md");
const REFERENCE_PATH = path.join(SKILL_DIR, "references", "tokyo-system-reboot.md");
const CONTENT_RULES_PATH = path.join(SKILL_DIR, "references", "content-rules.md");
const BAD_OUTPUT_PATH = path.join(SKILL_DIR, "references", "bad-output-prohibitions.md");
const JAPAN_GOLD_STANDARD_PATH = path.join(SKILL_DIR, "references", "venues", "japan", "gold-standard-10-programmes.md");
const JAPAN_FOOD_LOGIC_PATH = path.join(SKILL_DIR, "references", "venues", "japan", "food-logic.md");

function isJapanBrief(brief: SavedBrief): boolean {
  return brief.countries.some((country) => /япон|japan/i.test(country));
}

async function loadBriefs(): Promise<SavedBrief[]> {
  const raw = await fs.readFile(BRIEFS_FILE, "utf-8");
  return JSON.parse(raw) as SavedBrief[];
}

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

function isValidBlock(value: unknown): value is GeneratedBlock {
  if (!value || typeof value !== "object") return false;
  const b = value as Partial<GeneratedBlock>;
  return typeof b.timeOrPeriod === "string" && typeof b.title === "string" && typeof b.description === "string";
}

function isValidGenerated(value: unknown, expectedDays: number): value is GeneratedProgramme {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<GeneratedProgramme>;
  return (
    typeof v.conceptTitle === "string" &&
    v.conceptTitle.trim().length > 0 &&
    typeof v.conceptSummary === "string" &&
    v.conceptSummary.trim().length > 0 &&
    typeof v.voice === "string" &&
    v.voice.trim().length > 0 &&
    Array.isArray(v.days) &&
    v.days.length === expectedDays &&
    v.days.every(
      (day) =>
        day &&
        typeof day === "object" &&
        typeof (day as { title?: unknown }).title === "string" &&
        typeof (day as { rhythm?: unknown }).rhythm === "string" &&
        typeof (day as { highlight?: unknown }).highlight === "string" &&
        Array.isArray((day as { blocks?: unknown }).blocks) &&
        (day as { blocks: unknown[] }).blocks.length > 0 &&
        (day as { blocks: unknown[] }).blocks.every(isValidBlock),
    )
  );
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function buildSystemPrompt(brief: SavedBrief): Promise<string> {
  const [skill, reference, contentRules, prohibitions] = await Promise.all([
    fs.readFile(SKILL_PATH, "utf-8").catch(() => ""),
    fs.readFile(REFERENCE_PATH, "utf-8").catch(() => ""),
    fs.readFile(CONTENT_RULES_PATH, "utf-8").catch(() => ""),
    fs.readFile(BAD_OUTPUT_PATH, "utf-8").catch(() => ""),
  ]);

  const parts = [
    "Ты — копирайтер презентаций корпоративных поездок для агентства SEIVA. Следуй правилам ниже дословно.",
    skill,
    "Дополнительные обязательные правила глубины и структуры контента (применяются наравне со скиллом выше, ко всем странам):",
    contentRules,
    "Категорически запрещённые форматы и формулировки — если твой черновик похож на любой из этих примеров, это провал, переписывай:",
    prohibitions,
    "Референс качества ниже — ПРИМЕР УРОВНЯ И СТРУКТУРЫ, не источник контента. Это текст про другую поездку (другой бриф, другой Tokyo-специфичный набор мест). Копировать его концепцию, формулировки или конкретные места в свой ответ ЗАПРЕЩЕНО, даже если новый бриф тоже про Токио/Японию/IT-аудиторию — придумай свою governing concept и свой набор мест под конкретный бриф, который тебе дадут в следующем сообщении:",
    reference,
  ];

  if (isJapanBrief(brief)) {
    const [japanGoldStandard, japanFoodLogic] = await Promise.all([
      fs.readFile(JAPAN_GOLD_STANDARD_PATH, "utf-8").catch(() => ""),
      fs.readFile(JAPAN_FOOD_LOGIC_PATH, "utf-8").catch(() => ""),
    ]);
    parts.push(
      "Бриф про Японию — источник правды по уровню конкретики и реализму ниже. Это НЕ каталог маршрутов для копирования: адаптируй под аудиторию и цель именно этого брифа, но держи ту же плотность деталей, узнаваемость мест и драматургию дня, что в примерах:",
      japanGoldStandard,
      "Логика питания для Японии — использовать при выборе форматов и порядка ужинов/обедов по дням:",
      japanFoodLogic,
    );
  }

  parts.push("Верни ОДИН валидный JSON-объект и больше ничего: без markdown-обрамления, без комментариев до или после.");

  return parts.filter(Boolean).join("\n\n---\n\n");
}

function buildUserPrompt(brief: SavedBrief): string {
  const schema = `{
  "conceptTitle": string,
  "conceptSummary": string,
  "voice": "Возвышенный" | "Дерзкий" | "Вдохновляющий" | "Спокойный нейтральный",
  "days": [
    {
      "title": string,
      "rhythm": string,
      "highlight": string,
      "blocks": [{ "timeOrPeriod": string, "title": string, "description": string }]
    }
  ]
}`;

  return [
    `Бриф поездки (JSON):`,
    JSON.stringify(brief, null, 2),
    `Собери программу ровно на ${brief.durationDays} ${brief.durationDays === 1 ? "день" : "дня/дней"} — массив "days" должен содержать ровно ${brief.durationDays} элемент(ов), по порядку: заезд → ... → отъезд.`,
    `КРИТИЧНО: поле "restrictions" в брифе — это "${brief.restrictions}". Перед тем как ответить, проверь каждый день своей программы построчно на соответствие этому ограничению буквально (если там указан конкретный день для конкретного события — оно должно быть именно в этот день, не раньше и не позже). Если находишь несоответствие — исправь программу, а не оставляй как есть.`,
    `КРИТИЧНО: поле "goal" в брифе — это "${brief.goal}". Проверь, что структура программы реально работает на эту цель (см. правило 1 скилла), а не просто не противоречит ей — например, если цель про сплочение/командную работу, хотя бы часть блоков должна быть совместной активностью, а не последовательностью «посмотреть → поесть» рядом друг с другом.`,
    `КРИТИЧНО: перед тем как выбрать "voice", сверь аудиторию брифа (participants: ${brief.participants}, industry: ${brief.industry}, ageGroup: ${brief.ageGroup}, genderRatio: ${brief.genderRatio}, eventType: ${brief.eventType}, goal: ${brief.goal}) с таблицей эвристики выбора регистра из раздела "Голос: 4 регистра" скилла. Не выбирай "Возвышенный" по умолчанию для любой не-IT аудитории — эта эвристика специально указывает разные регистры для разных сочетаний возраста/индустрии/цели.`,
    `КРИТИЧНО: каждый значимый блок должен отвечать на пять вопросов из content-rules — что конкретно происходит, как это выглядит для участника, почему интересно именно здесь, почему подходит этой аудитории, какое место занимает в ритме дня — ориентир 100-180 слов на значимый блок. Если блок сводится к названию активности одним словосочетанием или к скелету вида «утром экскурсия, затем обед, затем ужин» — это провал, перепиши с конкретикой до того как ответить.`,
    `Ответ — строго JSON по этой форме (без пояснений вокруг):`,
    schema,
  ].join("\n\n");
}

async function selfCritique(
  systemPrompt: string,
  brief: SavedBrief,
  draft: GeneratedProgramme,
): Promise<GeneratedProgramme | null> {
  const critiquePoints = [
    `1. Чёрный список из правила 7 скилла — корень «уникальн-», слово «гармония» как несущая метафора дня, конструкция «где X встречается/переплетается с Y», зачин «Погрузитесь в мир…», «это не просто X, это Y», «место, где…», «идеальное сочетание…», «погружение в атмосферу» и другие клише оттуда — включая синонимическую перелицовку той же идеи другими словами (см. заметку под чёрным списком). Нет ли нарушений?`,
    `2. Заголовки дней (days[].title) — это имя-режим дня по смыслу, а не буквально «День 1: …», «Знакомство с X», «Введение в X» или другая родовая формула из bad-output-prohibitions?`,
    `3. Структура реально работает на goal брифа ("${brief.goal}"), а не просто не противоречит ему?`,
    `4. Глубина каждого значимого блока — конкретика по всем пяти вопросам из content-rules (что происходит / как выглядит / почему здесь / почему для этой аудитории / роль в ритме дня), не скелет «экскурсия → обед → ужин» и не название активности одним словом без раскрытия.`,
  ];

  if (isJapanBrief(brief)) {
    critiquePoints.push(
      `5. Если это Япония — нет ли yakatabune для стандартной группы (запрещено, см. bad-output-prohibitions), не искажена ли логика питания из food-logic (например, chanko nabe не после sumo), не выдаётся ли Фудзи или доступ к площадке за гарантию вместо честной оговорки о подтверждении.`,
    );
  }

  const critiquePrompt = [
    `Вот программа, которую ты только что написал(а) для этого брифа:`,
    JSON.stringify(draft, null, 2),
    `Перечитай её как придирчивый редактор и проверь:`,
    ...critiquePoints,
    `Если находишь нарушения — перепиши ТОЛЬКО те фразы, заголовки или блоки, которые их нарушают. Не трогай структуру, названия мест, число дней и всё остальное, что уже в порядке.`,
    `Верни финальную программу целиком строго тем же JSON (conceptTitle, conceptSummary, voice, days[].{title,rhythm,highlight,blocks[].{timeOrPeriod,title,description}}), без markdown и пояснений — даже если ничего не менял(а).`,
  ].join("\n\n");

  try {
    const raw = await openaiChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: critiquePrompt },
    ]);
    const parsed = extractJson(raw);
    if (isValidGenerated(parsed, brief.durationDays)) {
      return parsed;
    }
  } catch {
    // Polish pass is best-effort — never fail the whole request over it, the caller keeps the first-pass draft.
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { briefId } = (await request.json()) as { briefId?: string };

    if (!briefId) {
      return NextResponse.json({ error: "briefId is required" }, { status: 400 });
    }

    const briefs = await loadBriefs();
    const brief = briefs.find((item) => item.id === briefId);

    if (!brief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    const systemPrompt = await buildSystemPrompt(brief);
    const userPrompt = buildUserPrompt(brief);

    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let generated: GeneratedProgramme | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await openaiChat(messages);
        const parsed = extractJson(raw);

        if (isValidGenerated(parsed, brief.durationDays)) {
          generated = parsed;
          break;
        }

        lastError = "Ответ не соответствует ожидаемой схеме";
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Неизвестная ошибка";
      }

      messages.push({
        role: "user",
        content:
          "Предыдущий ответ невалиден. Верни СТРОГО валидный JSON-объект без markdown, без пояснений, ровно по указанной схеме.",
      });
    }

    if (!generated) {
      return NextResponse.json({ error: `AI generation failed: ${lastError}` }, { status: 502 });
    }

    const polished = await selfCritique(systemPrompt, brief, generated);
    if (polished) {
      generated = polished;
    }

    const programmes = await loadProgrammes();
    const index = programmes.findIndex((item) => item.id === brief.programmeId);

    const days: ProgrammeDay[] = generated.days.map((day, i) => ({
      dayNumber: i + 1,
      title: day.title,
      rhythm: day.rhythm,
      highlight: day.highlight,
      blocks: day.blocks.map((block) => ({ ...block, imageUrl: null })),
    }));

    const updated: SavedProgramme = {
      id: brief.programmeId,
      briefId: brief.id,
      conceptTitle: generated.conceptTitle,
      conceptSummary: generated.conceptSummary,
      voice: generated.voice,
      startDate: brief.startDate,
      days,
      updatedAt: new Date().toISOString(),
    };

    if (index === -1) {
      programmes.unshift(updated);
    } else {
      programmes[index] = updated;
    }

    await saveProgrammes(programmes);

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
