import path from "node:path";

import { cleanText } from "@/lib/utils";

function extensionFor(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export async function extractTextFromFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extensionFor(file.name);
  const mimeType = file.type || "application/octet-stream";

  if (
    mimeType.startsWith("text/") ||
    [".txt", ".md", ".markdown", ".csv", ".json"].includes(ext)
  ) {
    return cleanText(bytes.toString("utf8"));
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: bytes });
    return cleanText(result.value);
  }

  if (mimeType === "application/pdf" || ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    return cleanText(result.text);
  }

  throw new Error(
    `Unsupported file type for text extraction: ${file.name}. Use PDF, DOCX, TXT, MD, CSV, or JSON.`,
  );
}
