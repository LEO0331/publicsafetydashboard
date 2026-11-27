import { observe } from "../../../../src/server/observability";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { runPythonScript } from "../../../../src/server/admin";
import { ImportBodyTooLargeError, MAX_PDF_BYTES, readBoundedImportBody } from "../../../../src/server/announcement-import";
import { jsonNoStore } from "../../../../src/server/http";

export const runtime = "nodejs";

const MAX_MULTIPART_BYTES = MAX_PDF_BYTES + 128 * 1024;

export const POST = observe("import_file", async (request) => {
  let form: FormData;
  try {
    form = await (await readBoundedImportBody(request, MAX_MULTIPART_BYTES)).formData();
  } catch (error) {
    if (error instanceof ImportBodyTooLargeError) {
      return jsonNoStore({ error: "The PDF must be 20 MiB or smaller" }, { status: 413 });
    }
    return jsonNoStore({ error: "Invalid upload form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonNoStore({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return jsonNoStore({ error: "The PDF must be 20 MiB or smaller" }, { status: 413 });
  }
  if (!Buffer.from(await file.slice(0, 1024).arrayBuffer()).includes("%PDF-")) {
    return jsonNoStore({ error: "The uploaded file must be a PDF" }, { status: 400 });
  }

  const title = form.get("title");
  const uploadDir = path.join(process.cwd(), "data", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const target = path.join(uploadDir, `${randomUUID()}.pdf`);
  try {
    await writeFile(target, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
    const result = await runPythonScript([
      "scripts/import_pdf.py",
      "--file", target,
      `--title=${typeof title === "string" ? title : "Local PDF import"}`,
    ]);
    return jsonNoStore(result);
  } catch {
    return jsonNoStore({ error: "Unable to import the PDF" }, { status: 422 });
  } finally {
    await rm(target, { force: true });
  }
}, { admin: true, maintenance: true });
