import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: "Поддерживаются только изображения: JPEG, PNG, WebP, GIF" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Файл больше 8 МБ" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });
  }
}
