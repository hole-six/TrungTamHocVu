"use client";

import { exportSectionsToExcel, formatVnd } from "@/lib/export-utils";

type Transaction = {
  txnDate: string;
  type: "THU" | "CHI";
  categoryName: string | null;
  amount: number;
  description: string | null;
  status: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function CashbookExportButton({
  fromDate,
  toDate,
  type,
  totals,
  byCategory,
  transactions,
}: {
  fromDate: string;
  toDate: string;
  type: string;
  totals: { totalThu: number; totalChi: number; balance: number };
  byCategory: Array<{ name: string; thu: number; chi: number }>;
  transactions: Transaction[];
}) {
  function handleExport() {
    exportSectionsToExcel(
      [
        {
          title: "Tong quan thu chi",
          columns: [
            { key: "metric", label: "Chi so" },
            { key: "value", label: "Gia tri" },
          ],
          rows: [
            { metric: "Tu ngay", value: formatDate(fromDate) },
            { metric: "Den ngay", value: formatDate(toDate) },
            { metric: "Loai phieu loc", value: type || "Tat ca" },
            { metric: "Tong thu", value: formatVnd(totals.totalThu) },
            { metric: "Tong chi", value: formatVnd(totals.totalChi) },
            { metric: "So du quy", value: formatVnd(totals.balance) },
          ],
        },
        {
          title: "Tong hop theo danh muc",
          columns: [
            { key: "name", label: "Danh muc" },
            { key: "thu", label: "Thu" },
            { key: "chi", label: "Chi" },
            { key: "balance", label: "Chenh lech" },
          ],
          rows: byCategory.map((item) => ({
            name: item.name,
            thu: formatVnd(item.thu),
            chi: formatVnd(item.chi),
            balance: formatVnd(item.thu - item.chi),
          })),
        },
        {
          title: "So giao dich thu chi",
          columns: [
            { key: "txnDate", label: "Ngay" },
            { key: "type", label: "Loai" },
            { key: "categoryName", label: "Danh muc" },
            { key: "amountIn", label: "Thu vao" },
            { key: "amountOut", label: "Chi ra" },
            { key: "description", label: "Dien giai" },
            { key: "status", label: "Trang thai" },
          ],
          rows: transactions.map((item) => ({
            txnDate: formatDate(item.txnDate),
            type: item.type,
            categoryName: item.categoryName ?? "",
            amountIn: item.type === "THU" ? formatVnd(item.amount) : "",
            amountOut: item.type === "CHI" ? formatVnd(item.amount) : "",
            description: item.description ?? "",
            status: item.status,
          })),
        },
      ],
      `thu-chi_${fromDate}_${toDate}`,
      "ThuChi",
    );
  }

  return (
    <button onClick={handleExport} className="btn-secondary">
      Xuất Excel
    </button>
  );
}
