/**
 * Export Utilities
 * 
 * Functions để export data ra Excel, CSV, và PDF
 */

/**
 * Export data to CSV
 */
export function exportToCSV<T>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string
) {
  // Create CSV header
  const header = columns.map(col => col.label).join(",");
  
  // Create CSV rows
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Escape commas and quotes
      const stringValue = String(value ?? "");
      if (stringValue.includes(",") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(",")
  );

  // Combine header and rows
  const csv = [header, ...rows].join("\n");

  // Create blob and download
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to Excel (using HTML table method - works without external libs)
 */
export function exportToExcel<T>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (value: any) => string }[],
  filename: string,
  sheetName: string = "Sheet1"
) {
  // Create HTML table
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              ${columns.map(col => `<th>${col.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${columns.map(col => {
                  const value = row[col.key];
                  const formatted = col.format ? col.format(value) : String(value ?? "");
                  return `<td>${formatted}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  // Create blob and download
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.xls`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to JSON
 */
export function exportToJSON<T>(data: T[], filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.json`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format VND currency
 */
export function formatVnd(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}

/**
 * Format date to Vietnamese format
 */
export function formatDate(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN");
}

/**
 * Format datetime to Vietnamese format
 */
export function formatDateTime(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("vi-VN");
}

/**
 * Print current page
 */
export function printPage() {
  window.print();
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

/**
 * Download file from URL
 */
export function downloadFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate report title with timestamp
 */
export function generateReportTitle(prefix: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
  return `${prefix}_${timestamp}`;
}
