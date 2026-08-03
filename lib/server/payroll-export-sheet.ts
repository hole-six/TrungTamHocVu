import ExcelJS from "exceljs";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";

export type PayrollWorkbookLine = {
  employeeCode: string;
  fullName: string;
  position: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  teachingHours: number;
  teachingAmount: number;
  assistantHours: number;
  assistantAmount: number;
  staffDays: number;
  baseSalaryAmount: number;
  bonus: number;
  penalty: number;
  totalAmount: number;
};

export async function buildPayrollWorkbook({
  periodName,
  status,
  lines,
}: {
  periodName: string;
  status: string;
  lines: PayrollWorkbookLine[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.company = "TrungTamHocVu";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sortedLines = [...lines].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

  const totals = sortedLines.reduce(
    (acc, line) => {
      acc.teachingHours += line.teachingHours;
      acc.teachingAmount += line.teachingAmount;
      acc.assistantHours += line.assistantHours;
      acc.assistantAmount += line.assistantAmount;
      acc.staffDays += line.staffDays;
      acc.baseSalaryAmount += line.baseSalaryAmount;
      acc.bonus += line.bonus;
      acc.penalty += line.penalty;
      acc.totalAmount += line.totalAmount;
      return acc;
    },
    {
      teachingHours: 0,
      teachingAmount: 0,
      assistantHours: 0,
      assistantAmount: 0,
      staffDays: 0,
      baseSalaryAmount: 0,
      bonus: 0,
      penalty: 0,
      totalAmount: 0,
    },
  );

  const overview = workbook.addWorksheet("Tong quan", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  overview.properties.defaultRowHeight = 22;
  overview.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  overview.columns = [
    { width: 18 },
    { width: 22 },
    { width: 18 },
    { width: 22 },
    { width: 18 },
    { width: 22 },
  ];
  overview.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];

  overview.mergeCells("A1:F1");
  overview.getCell("A1").value = `BẢNG LƯƠNG ${periodName}`;
  overview.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  overview.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEA580C" },
  };
  overview.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  overview.getRow(1).height = 30;

  overview.mergeCells("A2:F2");
  overview.getCell("A2").value =
    "File này được tối ưu để xem nhanh, lọc nhanh và in/đối chiếu nhanh cho kỳ lương.";
  overview.getCell("A2").font = { italic: true, color: { argb: "FF475569" } };
  overview.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEDD5" },
  };
  overview.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
  overview.getRow(2).height = 24;

  const summaryRows = [
    ["Kỳ lương", periodName, "Trạng thái", PAYROLL_RUN_STATUS_LABEL[status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? status],
    ["Số nhân sự", sortedLines.length, "Tạo lúc", new Date()],
    ["Tổng tiền dạy", totals.teachingAmount, "Tổng tiền trợ giảng", totals.assistantAmount],
    ["Tổng lương cứng", totals.baseSalaryAmount, "Tổng công hành chính", totals.staffDays],
    ["Tổng thưởng", totals.bonus, "Tổng phạt", totals.penalty],
    ["Tổng thực nhận", totals.totalAmount, "Bình quân / người", sortedLines.length > 0 ? totals.totalAmount / sortedLines.length : 0],
  ];

  summaryRows.forEach((row, index) => {
    const rowNumber = index + 4;
    const excelRow = overview.getRow(rowNumber);
    excelRow.values = row;
    excelRow.height = 24;
    excelRow.eachCell((cell, col) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { vertical: "middle" };
      if (col === 1 || col === 3) {
        cell.font = { bold: true, color: { argb: "FF334155" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        };
      }
    });
  });

  overview.getCell("B5").numFmt = "#,##0";
  overview.getCell("B6").numFmt = "\"₫\"#,##0";
  overview.getCell("D6").numFmt = "\"₫\"#,##0";
  overview.getCell("B7").numFmt = "\"₫\"#,##0";
  overview.getCell("D7").numFmt = "#,##0.0";
  overview.getCell("B8").numFmt = "\"₫\"#,##0";
  overview.getCell("D8").numFmt = "\"₫\"#,##0";
  overview.getCell("B9").numFmt = "\"₫\"#,##0";
  overview.getCell("D9").numFmt = "\"₫\"#,##0";
  overview.getCell("B10").numFmt = "\"₫\"#,##0";
  overview.getCell("D10").numFmt = "\"₫\"#,##0";
  overview.getCell("D5").numFmt = "dd/mm/yyyy hh:mm";

  overview.mergeCells("A12:F12");
  overview.getCell("A12").value = "Cách đọc file nhanh";
  overview.getCell("A12").font = { bold: true, size: 12, color: { argb: "FF111827" } };
  overview.getCell("A12").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };
  overview.getCell("A12").border = {
    top: { style: "thin", color: { argb: "FFFCD34D" } },
    left: { style: "thin", color: { argb: "FFFCD34D" } },
    bottom: { style: "thin", color: { argb: "FFFCD34D" } },
    right: { style: "thin", color: { argb: "FFFCD34D" } },
  };

  const guideRows = [
    "1. Xem sheet 'Tong quan' để nắm tổng lương, trạng thái và các khoản chính.",
    "2. Xem sheet 'Bang luong chi tiet' để lọc theo nhân sự hoặc vị trí.",
    "3. Các cột tiền đều là số Excel thật, có thể lọc, sắp xếp và cộng tiếp.",
    "4. Dòng cuối của bảng chi tiết là dòng tổng để kiểm tra nhanh trước khi chi lương.",
  ];
  guideRows.forEach((text, index) => {
    const cell = overview.getCell(`A${13 + index}`);
    overview.mergeCells(`A${13 + index}:F${13 + index}`);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: index % 2 === 0 ? "FFFFFBEB" : "FFFFFFFF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  const detail = workbook.addWorksheet("Bang luong chi tiet", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  detail.properties.defaultRowHeight = 22;
  detail.views = [{ state: "frozen", ySplit: 2 }];
  detail.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

  detail.columns = [
    { header: "Mã NV", key: "employeeCode", width: 14 },
    { header: "Họ tên", key: "fullName", width: 26 },
    { header: "Vị trí", key: "position", width: 18 },
    { header: "Giờ dạy", key: "teachingHours", width: 12 },
    { header: "Tiền dạy", key: "teachingAmount", width: 16 },
    { header: "Giờ trợ giảng", key: "assistantHours", width: 14 },
    { header: "Tiền trợ giảng", key: "assistantAmount", width: 18 },
    { header: "Công HC", key: "staffDays", width: 12 },
    { header: "Lương cứng", key: "baseSalaryAmount", width: 16 },
    { header: "Thưởng", key: "bonus", width: 14 },
    { header: "Phạt", key: "penalty", width: 14 },
    { header: "Thực nhận", key: "totalAmount", width: 16 },
  ];

  detail.mergeCells("A1:L1");
  detail.getCell("A1").value = `CHI TIẾT BẢNG LƯƠNG ${periodName}`;
  detail.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  detail.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111827" },
  };
  detail.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  detail.getRow(1).height = 26;

  const headerRow = detail.getRow(2);
  headerRow.values = [
    undefined,
    ...detail.columns.map((column) =>
      Array.isArray(column.header) ? column.header.join(" ") : (column.header ?? "").toString(),
    ),
  ];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEA580C" },
  };
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFFED7AA" } },
      left: { style: "thin", color: { argb: "FFFED7AA" } },
      bottom: { style: "thin", color: { argb: "FFFED7AA" } },
      right: { style: "thin", color: { argb: "FFFED7AA" } },
    };
  });

  sortedLines.forEach((line) => {
    detail.addRow({
      ...line,
      position: line.position || "",
    });
  });

  const firstDataRow = 3;
  const lastDataRow = Math.max(2, detail.rowCount);

  for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
    const row = detail.getRow(rowNumber);
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber >= 4 ? "right" : "left",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
      };
    });
  }

  if (detail.rowCount >= firstDataRow) {
    detail.autoFilter = {
      from: "A2",
      to: "L2",
    };
  }

  const totalRowNumber = detail.rowCount + 1;
  detail.getCell(`A${totalRowNumber}`).value = "TỔNG";
  detail.mergeCells(`A${totalRowNumber}:C${totalRowNumber}`);
  detail.getCell(`A${totalRowNumber}`).font = { bold: true, color: { argb: "FF111827" } };
  detail.getCell(`A${totalRowNumber}`).alignment = { horizontal: "center", vertical: "middle" };
  detail.getCell(`A${totalRowNumber}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEDD5" },
  };

  const totalColumns = ["D", "E", "F", "G", "H", "I", "J", "K", "L"];
  totalColumns.forEach((column) => {
    const cell = detail.getCell(`${column}${totalRowNumber}`);
    cell.value = { formula: `SUM(${column}${firstDataRow}:${column}${Math.max(firstDataRow, totalRowNumber - 1)})` };
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEDD5" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FFF59E0B" } },
      left: { style: "thin", color: { argb: "FFFCD34D" } },
      bottom: { style: "medium", color: { argb: "FFF59E0B" } },
      right: { style: "thin", color: { argb: "FFFCD34D" } },
    };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  ["D", "F", "H"].forEach((column) => {
    detail.getColumn(column).numFmt = "#,##0.0";
  });
  ["E", "G", "I", "J", "K", "L"].forEach((column) => {
    detail.getColumn(column).numFmt = "\"₫\"#,##0";
  });

  detail.getRow(totalRowNumber).height = 24;

  const formula = workbook.addWorksheet("Cach tinh", {
    views: [{ showGridLines: false }],
  });
  formula.columns = [{ width: 24 }, { width: 70 }];
  formula.addRow(["Thành phần", "Diễn giải"]);
  formula.addRow(["Tiền dạy", "Tổng tiền theo các buổi dạy chính trong kỳ."]);
  formula.addRow(["Tiền trợ giảng", "Tổng tiền theo các buổi trợ giảng trong kỳ."]);
  formula.addRow(["Công HC", "Số công hành chính đã chấm trong kỳ."]);
  formula.addRow(["Lương cứng", "Khoản lương cố định hoặc quy đổi theo công đã cấu hình."]);
  formula.addRow(["Thưởng", "Khoản cộng thêm thủ công hoặc theo chính sách kỳ đó."]);
  formula.addRow(["Phạt", "Khoản trừ thủ công hoặc theo chính sách kỳ đó."]);
  formula.addRow(["Thực nhận", "Tiền dạy + tiền trợ giảng + lương cứng + thưởng - phạt."]);

  formula.eachRow((row, index) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { wrapText: true, vertical: "top" };
      if (index === 1) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F766E" },
        };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: index % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
        };
      }
    });
  });

  const bankTransfer = workbook.addWorksheet("Chi luong chuyen khoan", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  bankTransfer.properties.defaultRowHeight = 22;
  bankTransfer.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mã NV", key: "employeeCode", width: 14 },
    { header: "Họ tên", key: "fullName", width: 26 },
    { header: "Ngân hàng", key: "bankName", width: 22 },
    { header: "Số tài khoản", key: "bankAccountNumber", width: 22 },
    { header: "Chủ tài khoản", key: "bankAccountHolder", width: 24 },
    { header: "Số tiền", key: "totalAmount", width: 16 },
    { header: "Nội dung CK", key: "transferNote", width: 26 },
    { header: "Ghi chú", key: "note", width: 26 },
  ];
  bankTransfer.mergeCells("A1:I1");
  bankTransfer.getCell("A1").value = `DANH SÁCH CHI LƯƠNG CHUYỂN KHOẢN ${periodName}`;
  bankTransfer.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  bankTransfer.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  };
  bankTransfer.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  bankTransfer.getRow(1).height = 26;

  const transferHeaderRow = bankTransfer.getRow(2);
  transferHeaderRow.values = [
    undefined,
    ...bankTransfer.columns.map((column) =>
      Array.isArray(column.header) ? column.header.join(" ") : (column.header ?? "").toString(),
    ),
  ];
  transferHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  transferHeaderRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  transferHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF059669" },
  };

  sortedLines.forEach((line, index) => {
    bankTransfer.addRow({
      stt: index + 1,
      employeeCode: line.employeeCode,
      fullName: line.fullName,
      bankName: line.bankName ?? "",
      bankAccountNumber: line.bankAccountNumber ?? "",
      bankAccountHolder: line.bankAccountHolder ?? line.fullName,
      totalAmount: line.totalAmount,
      transferNote: `Luong ${periodName} - ${line.fullName}`,
      note:
        line.bankAccountNumber && line.bankName
          ? ""
          : "Thiếu thông tin ngân hàng, cần bổ sung trong hồ sơ nhân sự",
    });
  });

  for (let rowNumber = 3; rowNumber <= bankTransfer.rowCount; rowNumber += 1) {
    const row = bankTransfer.getRow(rowNumber);
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 1 || colNumber === 7 ? "right" : "left",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
      };
    });
    const noteCell = bankTransfer.getCell(`I${rowNumber}`);
    if (noteCell.value) {
      noteCell.font = { color: { argb: "FFB91C1C" }, italic: true };
      noteCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF2F2" },
      };
    }
  }
  bankTransfer.autoFilter = { from: "A2", to: "I2" };
  bankTransfer.getColumn("G").numFmt = "\"₫\"#,##0";

  return workbook;
}
