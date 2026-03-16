// POST /api/ai/parse-file — Extract text from PDF, XLSX, CSV, or images for AI chat context

import { auth } from "@/auth";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
  "text/plain": "text",
  "text/markdown": "text",
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/webp": "image",
  "image/gif": "image",
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const fileType = SUPPORTED_TYPES[file.type]
      || (file.name.endsWith(".csv") ? "csv" : null)
      || (file.name.endsWith(".xlsx") ? "xlsx" : null)
      || (file.name.endsWith(".xls") ? "xls" : null)
      || (file.name.endsWith(".pdf") ? "pdf" : null)
      || (file.name.endsWith(".txt") || file.name.endsWith(".md") ? "text" : null);

    if (!fileType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || file.name}` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Handle images — return as base64 for Claude vision
    if (fileType === "image") {
      const base64 = buffer.toString("base64");
      return NextResponse.json({
        type: "image",
        name: file.name,
        mediaType: file.type,
        base64,
      });
    }

    // Handle text files
    if (fileType === "text") {
      const text = buffer.toString("utf-8");
      return NextResponse.json({
        type: "text",
        text,
        name: file.name,
        length: text.length,
      });
    }

    // Handle CSV
    if (fileType === "csv") {
      const text = buffer.toString("utf-8");
      return NextResponse.json({
        type: "text",
        text: `[CSV File: ${file.name}]\n\n${text}`,
        name: file.name,
        length: text.length,
      });
    }

    // Handle Excel (xlsx/xls)
    if (fileType === "xlsx" || fileType === "xls") {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        let allText = `[Spreadsheet: ${file.name}]\n\n`;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          allText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
        }

        return NextResponse.json({
          type: "text",
          text: allText,
          name: file.name,
          length: allText.length,
          sheets: workbook.SheetNames.length,
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to parse spreadsheet" },
          { status: 422 },
        );
      }
    }

    // Handle PDF
    if (fileType === "pdf") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
        const pdfData = await pdfParse(buffer);

        return NextResponse.json({
          type: "text",
          text: pdfData.text,
          name: file.name,
          length: pdfData.text.length,
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to extract text from PDF" },
          { status: 422 },
        );
      }
    }

    return NextResponse.json({ error: "Unhandled file type" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/ai/parse-file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
