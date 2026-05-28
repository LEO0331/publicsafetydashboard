import { NextRequest } from "next/server";
import { writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { assertAdmin, runPythonScript } from "../../../../src/server/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  const uploadDir = path.join(process.cwd(), "data", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const extension = path.extname(file.name).toLowerCase() === ".pdf" ? ".pdf" : "";
  const target = path.join(uploadDir, `${Date.now()}-${randomUUID()}${extension}`);
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  const result = await runPythonScript(["scripts/import_pdf.py", "--file", target, "--title", String(form.get("title") ?? "Local PDF import")]);
  return Response.json(result);
}
