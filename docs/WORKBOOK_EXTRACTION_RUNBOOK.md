# Workbook Extraction Runbook

## Mục tiêu

- Đọc trực tiếp `docs/File Quan ly tong 2026.xlsx`
- Chuẩn hóa workbook sang JSON canonical theo module ERP
- Tạo đầu ra ổn định để làm bước `dry-run import` và `DB import` sau đó

## Lệnh chạy

```bash
python -X utf8 scripts/extract_workbook_erp.py \
  --source "docs/File Quan ly tong 2026.xlsx" \
  --dictionary "docs/Data_Dictionary_Excel.csv" \
  --output "docs/generated/workbook_2026"
```

## Đầu ra

- `docs/generated/workbook_2026/raw_tables.json`
  - Dữ liệu thô theo từng `sheet.table`
- `docs/generated/workbook_2026/canonical.json`
  - Dữ liệu đã map theo module:
    - `lookups`
    - `employees`
    - `crm`
    - `academics`
    - `finance`
    - `inventory`
- `docs/generated/workbook_2026/manifest.json`
  - Tổng số record, cảnh báo unresolved và thống kê liên kết

## Logic liên kết chính

- `Lead -> Guardian`
  - dedupe theo `HoTenPH + Sdt`
- `Student -> Lead`
  - ưu tiên `MaSo`
- `Student -> Class`
  - ưu tiên `MaLop`, fallback `TenLop`
- `Charge`
  - grain: `student + class + billing period`
- `BookIssue -> Student`
  - ưu tiên `TenHV&MaHV`, fallback dò `studentDisplayId`

## Ghi chú

- Extractor dùng workbook thật, không dựa riêng vào file CSV phụ trợ.
- `Data_Dictionary_Excel.csv` chỉ đóng vai trò schema/range map để đọc đúng các table.
- Các cột calculated vẫn được giữ trong `raw_tables.json` để tra soát, nhưng canonical ưu tiên source-of-truth đúng theo ERP.
