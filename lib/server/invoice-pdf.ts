import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { getBatchInvoiceViewData } from "@/lib/server/batch-invoice-view";

const execFileAsync = promisify(execFile);

export type InvoicePdfCharge = {
  id: string;
  sessionCount: number;
  absentCount: number;
  deductedCount: number;
  unitPrice: number;
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

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
    await execFileAsync("python", [scriptPath, inputPath, outputPath], {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return await fs.readFile(outputPath);
  } finally {
    await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
  }
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
