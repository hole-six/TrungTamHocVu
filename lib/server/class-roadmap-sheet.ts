import ExcelJS from "exceljs";

export type RoadmapSheetItem = {
  sessionNumber: number;
  title: string;
  objective: string;
  materials: string;
  teacherGuide: string;
  homeworkGuide: string;
};

const IMPORT_HEADERS = {
  sessionNumber: "Số buổi",
  title: "Tên bài / tên buổi",
  objective: "Mục tiêu buổi học",
  materials: "Tài liệu / học cụ",
  teacherGuide: "Ghi chú cho giáo viên",
  homeworkGuide: "Dặn dò / bài tập cuối buổi",
} as const;

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function normalizeCellValue(value: unknown) {
  return String(value ?? "").trim();
}

function mapHeaderIndexes(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const findIndex = (...needles: string[]) =>
    normalized.findIndex((header) => needles.some((needle) => header.includes(needle)));

  return {
    sessionNumber: findIndex("so buoi", "session number", "stt buoi"),
    title: findIndex("ten bai", "ten buoi", "title"),
    objective: findIndex("muc tieu", "objective"),
    materials: findIndex("tai lieu", "hoc cu", "materials"),
    teacherGuide: findIndex("ghi chu cho giao vien", "teacher", "giao vien"),
    homeworkGuide: findIndex("dan do", "bai tap", "homework"),
  };
}

function parseRoadmapCsv(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const headerIndexes = mapHeaderIndexes(headers);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      sessionNumber: Number(cells[headerIndexes.sessionNumber] ?? 0),
      title: cells[headerIndexes.title] ?? "",
      objective: cells[headerIndexes.objective] ?? "",
      materials: cells[headerIndexes.materials] ?? "",
      teacherGuide: cells[headerIndexes.teacherGuide] ?? "",
      homeworkGuide: cells[headerIndexes.homeworkGuide] ?? "",
    };
  });
}

export async function buildRoadmapTemplateWorkbook({
  totalSessions,
  classCode,
}: {
  totalSessions: number;
  classCode?: string | null;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Nhap lo trinh", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = `MẪU NHẬP CHƯƠNG TRÌNH ĐÀO TẠO${classCode ? ` - ${classCode}` : ""}`;
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value =
    "Điền nội dung cho từng buổi rồi lưu lại file .xlsx. Khi nhập lại vào hệ thống, dữ liệu sẽ được ghép theo cột 'Số buổi'.";
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF334155" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
  sheet.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(2).height = 34;

  sheet.getCell("A3").value = "Lưu ý";
  sheet.getCell("B3").value = "Không đổi tên cột A-F. Có thể sửa hoặc xóa cột G-H nếu không cần.";
  sheet.getCell("A3").font = { bold: true };
  sheet.getCell("B3").font = { color: { argb: "FF475569" } };

  const headerRow = sheet.getRow(5);
  headerRow.values = [
    IMPORT_HEADERS.sessionNumber,
    IMPORT_HEADERS.title,
    IMPORT_HEADERS.objective,
    IMPORT_HEADERS.materials,
    IMPORT_HEADERS.teacherGuide,
    IMPORT_HEADERS.homeworkGuide,
    "Hướng dẫn điền",
    "Ví dụ tham khảo",
  ];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 28;

  const headerColors = ["FF0F766E", "FF0F766E", "FF0F766E", "FF0F766E", "FF0284C7", "FF0284C7", "FFF59E0B", "FFF59E0B"];
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColors[colNumber - 1] } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  sheet.columns = [
    { key: "sessionNumber", width: 12 },
    { key: "title", width: 28 },
    { key: "objective", width: 34 },
    { key: "materials", width: 28 },
    { key: "teacherGuide", width: 34 },
    { key: "homeworkGuide", width: 34 },
    { key: "instruction", width: 34 },
    { key: "example", width: 32 },
  ];

  for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber += 1) {
    const row = sheet.getRow(5 + sessionNumber);
    row.values = [
      sessionNumber,
      `Buổi ${sessionNumber}`,
      "",
      "",
      "",
      "",
      "Điền ngắn gọn, rõ hành động; 1 buổi nên có mục tiêu, tài liệu và lưu ý dạy cụ thể.",
      `Ví dụ: Unit ${Math.ceil(sessionNumber / 2)} - Lesson ${sessionNumber}`,
    ];
    row.height = 24;

    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      if (colNumber <= 6) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sessionNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
        cell.font = { color: { argb: "FF92400E" }, italic: true };
      }
    });
  }

  const guide = workbook.addWorksheet("Huong dan");
  guide.columns = [{ width: 26 }, { width: 90 }];
  guide.addRow(["Mục", "Nội dung"]);
  guide.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  guide.addRow(["Số buổi", "Phải khớp đúng số buổi thực tế của lớp. Hệ thống dùng cột này để merge nội dung vào đúng buổi."]);
  guide.addRow(["Tên bài / tên buổi", "Ví dụ: Unit 1 - Lesson 1, Minitest 1, Speaking review, Ôn tập giữa khóa."]);
  guide.addRow(["Mục tiêu buổi học", "Ghi rõ học viên cần làm được gì sau buổi này."]);
  guide.addRow(["Tài liệu / học cụ", "Sách, workbook, flashcards, file nghe, mini test, slide hoặc trò chơi."]);
  guide.addRow(["Ghi chú cho giáo viên", "Cách vào bài, điểm cần nhấn mạnh, nhóm học viên cần chú ý, lưu ý đổi hoạt động."]);
  guide.addRow(["Dặn dò / bài tập cuối buổi", "Bài tập về nhà, yêu cầu phụ huynh phối hợp, phần cần ôn lại trước buổi sau."]);
  guide.eachRow((row, index) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      if (index > 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" } };
      }
    });
  });

  return workbook;
}

export async function parseRoadmapImportFile(fileName: string, fileBytes: Uint8Array) {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return parseRoadmapCsv(Buffer.from(fileBytes).toString("utf8"));
  }

  const workbook = new ExcelJS.Workbook();
  // exceljs đang nhận tốt Buffer runtime, nhưng type của thư viện cũ hơn bộ Node types hiện tại.
  // @ts-expect-error buffer type mismatch giữa exceljs và Node typings mới
  await workbook.xlsx.load(Buffer.from(fileBytes) as unknown as Buffer);
  const worksheet = workbook.getWorksheet("Nhap lo trinh") ?? workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(5);
  const rawHeaderValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = rawHeaderValues.map((value) => normalizeCellValue(value));
  const headerIndexes = mapHeaderIndexes(headers);

  const rows: RoadmapSheetItem[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 5) return;
    const rawRowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    const cells = rawRowValues.map((value) => normalizeCellValue(value));
    const sessionNumber = Number(cells[headerIndexes.sessionNumber] ?? 0);
    const title = cells[headerIndexes.title] ?? "";
    const objective = cells[headerIndexes.objective] ?? "";
    const materials = cells[headerIndexes.materials] ?? "";
    const teacherGuide = cells[headerIndexes.teacherGuide] ?? "";
    const homeworkGuide = cells[headerIndexes.homeworkGuide] ?? "";

    if (!sessionNumber || (!title && !objective && !materials && !teacherGuide && !homeworkGuide)) return;
    rows.push({
      sessionNumber,
      title,
      objective,
      materials,
      teacherGuide,
      homeworkGuide,
    });
  });

  return rows;
}
