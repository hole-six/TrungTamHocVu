import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { getBatchInvoiceViewData } from "@/lib/server/batch-invoice-view";

const execFileAsync = promisify(execFile);
let reportlabAvailablePromise: Promise<boolean> | null = null;

export type InvoicePdfCharge = {
  id: string;
  sessionCount: number;
  absentCount: number;
  deductedCount: number;
  unitPrice: number;
  mainTuitionAmount: number;
  paidCatchupAmount: number;
  transferCreditAmount: number;
  transferRemainderAmount: number;
  tuitionAmount: number;
  materialsAmount: number;
  openingBalance: number;
  totalAmount: number;
  billingModel: string;
  student: { id?: string; fullName: string; studentCode: string };
  class: { className: string; branch: { name: string } };
  billingPeriod: { periodName: string };
  allocations: { amount: number }[];
  invoice: { invoiceNo: string; issuedAt: Date | string } | null;
};

export type PaymentProfileData = {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  qrImageData: string | null;
  paymentInstruction: string | null;
};

type InvoicePdfPayload = {
  mode: "merged" | "separate";
  charges: InvoicePdfCharge[];
  paymentProfile: PaymentProfileData | null;
};

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN_X = 42;

function stripForPdf(input: unknown) {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(input: unknown) {
  return stripForPdf(input).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatVnd(value: number | null | undefined) {
  return `${Math.round(value ?? 0).toLocaleString("vi-VN")} VND`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

function formatPeriodLabel(periodName: string) {
  const [year, month] = periodName.split("-");
  if (!year || !month) return periodName;
  return `Thang ${Number(month)}/${year}`;
}

function getDueDateLabel(periodName: string) {
  const [year, month] = periodName.split("-");
  if (!year || !month) return periodName;
  const nextMonth = Number(month) + 1;
  const nextYear = nextMonth > 12 ? Number(year) + 1 : Number(year);
  const normalizedMonth = nextMonth > 12 ? 1 : nextMonth;
  return `10/${String(normalizedMonth).padStart(2, "0")}/${nextYear}`;
}

function textCommand(x: number, y: number, text: unknown, size = 10, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`;
}

function wrapPlainText(text: unknown, maxChars: number) {
  const words = stripForPdf(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const tentative = current ? `${current} ${word}` : word;
    if (tentative.length <= maxChars) {
      current = tentative;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawWrapped(lines: string[], x: number, y: number, text: unknown, maxChars: number, size = 10, bold = false, lineHeight = 14) {
  let cursor = y;
  for (const line of wrapPlainText(text, maxChars)) {
    lines.push(textCommand(x, cursor, line, size, bold));
    cursor -= lineHeight;
  }
  return cursor;
}

function buildInvoicePageContent(charge: InvoicePdfCharge, paymentProfile: PaymentProfileData | null) {
  const lines: string[] = [];
  const student = charge.student;
  const classInfo = charge.class;
  const periodName = charge.billingPeriod.periodName;
  const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(charge.totalAmount - paid, 0);
  const totalSessions = charge.sessionCount + charge.absentCount + charge.deductedCount;
  const isCourse = charge.billingModel === "COURSE";
  const branchName = classInfo.branch.name || "Trung tam";

  lines.push("0.75 w");
  lines.push(`36 36 ${PDF_PAGE_WIDTH - 72} ${PDF_PAGE_HEIGHT - 72} re S`);
  lines.push(textCommand(PDF_MARGIN_X, 790, branchName, 14, true));
  lines.push(textCommand(360, 790, "PHIEU THONG BAO HOC PHI", 15, true));
  lines.push(textCommand(360, 770, formatPeriodLabel(periodName), 12, true));
  lines.push(textCommand(PDF_MARGIN_X, 752, `So phieu: ${charge.invoice?.invoiceNo ?? "-"}`, 10, true));

  let y = 724;
  lines.push(textCommand(PDF_MARGIN_X, y, "THONG TIN HOC VIEN", 11, true));
  y -= 20;
  lines.push(textCommand(PDF_MARGIN_X, y, `Ma hoc vien: ${student.studentCode}`, 10));
  lines.push(textCommand(300, y, `Co so: ${branchName}`, 10));
  y -= 16;
  lines.push(textCommand(PDF_MARGIN_X, y, `Ho ten: ${student.fullName}`, 10, true));
  lines.push(textCommand(300, y, `Lop: ${classInfo.className}`, 10, true));

  y -= 36;
  lines.push(textCommand(PDF_MARGIN_X, y, isCourse ? "THONG TIN KHOA HOC" : "HOC PHI THANG", 11, true));
  y -= 20;
  const rows = [
    [isCourse ? "Tong so buoi toan khoa" : "Tong so buoi trong ky", totalSessions],
    ["So buoi tinh phi", charge.sessionCount],
    ["Don gia / buoi", formatVnd(charge.unitPrice)],
    ["Hoc phi chinh", formatVnd(charge.mainTuitionAmount || charge.tuitionAmount)],
    ["Bo tro dau khoa co phi", formatVnd(charge.paidCatchupAmount)],
    ["Sach / tai lieu", formatVnd(charge.materialsAmount)],
    ["Bu tru / chuyen tien", formatVnd(charge.transferCreditAmount)],
    ["Tien le chuyen lop con theo doi", formatVnd(charge.transferRemainderAmount)],
    ["Cong no dau ky", formatVnd(charge.openingBalance)],
  ];
  for (const [label, value] of rows) {
    lines.push(textCommand(PDF_MARGIN_X, y, label, 10));
    lines.push(textCommand(390, y, value, 10, String(label).includes("Hoc phi") || String(label).includes("Tong")));
    y -= 16;
  }

  y -= 12;
  lines.push(textCommand(PDF_MARGIN_X, y, "THANH TOAN", 11, true));
  y -= 24;
  lines.push(textCommand(PDF_MARGIN_X, y, "TONG PHAI NOP", 13, true));
  lines.push(textCommand(390, y, formatVnd(charge.totalAmount), 13, true));
  y -= 20;
  lines.push(textCommand(PDF_MARGIN_X, y, `Da thu: ${formatVnd(paid)}`, 10));
  lines.push(textCommand(300, y, `Con can nop: ${formatVnd(remaining)}`, 10, true));
  y -= 16;
  lines.push(textCommand(PDF_MARGIN_X, y, `Han thanh toan: truoc ngay ${getDueDateLabel(periodName)}`, 10));
  lines.push(textCommand(300, y, `Ngay xuat: ${formatDate(charge.invoice?.issuedAt)}`, 10));

  y -= 36;
  lines.push(textCommand(PDF_MARGIN_X, y, "THONG TIN CHUYEN KHOAN", 11, true));
  y -= 20;
  lines.push(textCommand(PDF_MARGIN_X, y, `Ngan hang: ${paymentProfile?.bankName ?? "Chua cau hinh"}`, 10));
  y -= 16;
  lines.push(textCommand(PDF_MARGIN_X, y, `So tai khoan: ${paymentProfile?.accountNumber ?? "Chua cau hinh"}`, 10, true));
  y -= 16;
  lines.push(textCommand(PDF_MARGIN_X, y, `Chu tai khoan: ${paymentProfile?.accountHolder ?? "Chua cau hinh"}`, 10));
  y -= 16;
  lines.push(textCommand(PDF_MARGIN_X, y, `Noi dung CK: ${student.fullName} - ${classInfo.className}`, 10, true));

  y -= 24;
  y = drawWrapped(
    lines,
    PDF_MARGIN_X,
    y,
    paymentProfile?.paymentInstruction || "PH chuyen khoan xong chup xac nhan gui cho giao vu hoac nhom phu huynh.",
    92,
    9,
    false,
    12,
  );

  lines.push(textCommand(PDF_PAGE_WIDTH / 2 - 180, 66, "Moi thac mac PH lien he truc tiep voi Trung tam de duoc giai dap.", 8.5));
  lines.push(textCommand(PDF_PAGE_WIDTH / 2 - 145, 52, `${branchName} - CHAT LUONG LA MUC TIEU HOAT DONG`, 10, true));
  return lines.join("\n");
}

function buildPdf(charges: InvoicePdfCharge[], paymentProfile: PaymentProfileData | null) {
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageRefs: number[] = [];
  const pageContents = charges.map((charge) => buildInvoicePageContent(charge, paymentProfile));

  for (const content of pageContents) {
    const contentBuffer = Buffer.from(content, "latin1");
    const contentId = addObject(`<< /Length ${contentBuffer.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageRefs.push(pageId);
  }

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  for (const pageId of pageRefs) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "latin1"));
  }
  const xrefOffset = Buffer.concat(chunks).length;
  const xrefRows = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const offset of offsets.slice(1)) {
    xrefRows.push(`${String(offset).padStart(10, "0")} 00000 n `);
  }
  chunks.push(
    Buffer.from(
      `${xrefRows.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
      "latin1",
    ),
  );
  return Buffer.concat(chunks);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function buildZip(files: { name: string; data: Buffer }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(sanitizeFileName(file.name) || "invoice.pdf", "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local, file.data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function canUseReportlabRenderer() {
  reportlabAvailablePromise ??= execFileAsync("python", ["-c", "import reportlab"], {
    cwd: process.cwd(),
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  })
    .then(() => true)
    .catch(() => false);
  return reportlabAvailablePromise;
}

function sanitizeFileName(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function getBillingModeSlug(billingModel: string) {
  return billingModel === "COURSE" ? "thu-khoa" : "thu-thang";
}

function buildDisposition(fileName: string) {
  const safeName = sanitizeFileName(fileName) || "invoice";
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

async function ensureInvoiceForCharge(chargeId: string) {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: {
      student: true,
      class: { include: { branch: true } },
      billingPeriod: true,
      allocations: true,
      invoice: true,
    },
  });

  if (!charge) return null;

  let invoice = charge.invoice;
  if (!invoice) {
    const invoiceNo = `INV${charge.billingPeriod.periodName.replace("-", "")}${charge.id.slice(0, 6).toUpperCase()}`;
    invoice = await prisma.invoice.create({ data: { chargeId: charge.id, invoiceNo } });
  }

  return {
    id: charge.id,
    sessionCount: charge.sessionCount,
    absentCount: charge.absentCount,
    deductedCount: charge.deductedCount,
    unitPrice: charge.unitPrice,
    mainTuitionAmount: charge.mainTuitionAmount,
    paidCatchupAmount: charge.paidCatchupAmount,
    transferCreditAmount: charge.transferCreditAmount,
    transferRemainderAmount: charge.transferRemainderAmount,
    tuitionAmount: charge.tuitionAmount,
    materialsAmount: charge.materialsAmount,
    openingBalance: charge.openingBalance,
    totalAmount: charge.totalAmount,
    billingModel: charge.billingModel,
    student: { id: charge.student.id, fullName: charge.student.fullName, studentCode: charge.student.studentCode },
    class: { className: charge.class.className, branch: { name: charge.class.branch.name } },
    billingPeriod: { periodName: charge.billingPeriod.periodName },
    allocations: charge.allocations.map((item) => ({ amount: item.amount })),
    invoice: invoice ? { invoiceNo: invoice.invoiceNo, issuedAt: invoice.issuedAt } : null,
  } satisfies InvoicePdfCharge;
}

async function renderArtifact(payload: InvoicePdfPayload, extension: "pdf" | "zip") {
  const tempDir = path.join(process.cwd(), "tmp", "pdfs");
  await fs.mkdir(tempDir, { recursive: true });

  const jobId = randomUUID();
  const inputPath = path.join(tempDir, `${jobId}.json`);
  const outputPath = path.join(tempDir, `${jobId}.${extension}`);
  const scriptPath = path.join(process.cwd(), "scripts", "render_invoices_pdf.py");

  if (await canUseReportlabRenderer()) {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
    try {
      await execFileAsync("python", [scriptPath, inputPath, outputPath], {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return await fs.readFile(outputPath);
    } catch (error) {
      console.warn("Reportlab invoice renderer failed; using built-in fallback.", error instanceof Error ? error.message : error);
    } finally {
      await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
    }
  }

  const artifact =
    extension === "pdf"
      ? buildPdf(payload.charges, payload.paymentProfile)
      : buildZip(
          payload.charges.map((charge) => ({
            name: `${charge.student.fullName}_${charge.billingPeriod.periodName}_${getBillingModeSlug(charge.billingModel)}.pdf`,
            data: buildPdf([charge], payload.paymentProfile),
          })),
        );
  await fs.writeFile(outputPath, artifact);
  const savedArtifact = await fs.readFile(outputPath);
  await fs.unlink(outputPath).catch(() => undefined);
  return savedArtifact;
}

export async function buildSingleInvoicePdf(chargeId: string) {
  const charge = await ensureInvoiceForCharge(chargeId);
  if (!charge) return null;

  const paymentProfile = await prisma.branchPaymentProfile.findFirst({
    where: { branch: { classes: { some: { charges: { some: { id: chargeId } } } } } },
  });

  const pdf = await renderArtifact(
    {
      mode: "merged",
      charges: [charge],
      paymentProfile,
    },
    "pdf",
  );

  const fileName = `${charge.student.fullName}_${charge.billingPeriod.periodName}_${getBillingModeSlug(charge.billingModel)}.pdf`;
  return { pdf, fileName };
}

export async function buildBatchInvoiceArtifact(periodId: string, chargeIds: string[], mode: "merged" | "separate") {
  const batchView = await getBatchInvoiceViewData(periodId);
  if (!batchView) return null;

  const selectedIdSet = new Set(chargeIds);
  const charges = batchView.charges.filter((charge) => selectedIdSet.has(charge.id));
  if (charges.length === 0) return null;

  const extension = mode === "merged" ? "pdf" : "zip";
  const artifact = await renderArtifact(
    {
      mode,
      charges,
      paymentProfile: batchView.paymentProfile,
    },
    extension,
  );

  const fileName =
    mode === "merged"
      ? `phieu-hoc-phi_${batchView.periodName}_${charges.length}-phieu.pdf`
      : `phieu-hoc-phi_${batchView.periodName}_${charges.length}-phieu-rieng.zip`;

  return { artifact, fileName, contentType: mode === "merged" ? "application/pdf" : "application/zip" };
}

export function buildDownloadHeaders(fileName: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": buildDisposition(fileName),
    "Cache-Control": "no-store",
  };
}
