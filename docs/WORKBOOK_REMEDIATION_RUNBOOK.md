# Workbook Remediation Runbook

## Mục tiêu

- Cứu các bảng đang bị chặn vì thiếu khóa nghiệp vụ
- Điền bổ sung dữ liệu theo từng `sourceRow`
- Merge lại vào extractor để tái sinh `canonical.json` và tái-import vào ERP

## Cơ chế hiện có

- Extractor đã hỗ trợ đọc override CSV theo `sourceRow`
- Thư mục template remediation được sinh tự động tại:

```bash
docs/generated/workbook_2026/remediation/
```

- Mỗi file tương ứng một bảng đang bị chặn, ví dụ:
  - `DSTest_T_DSTest.csv`
  - `DSHV_T_HV.csv`
  - `TheoDoiHP_T_HP.csv`
  - `XuatNhapSach_T_SachXuat.csv`

## Cấu trúc file remediation

Ví dụ:

```csv
sourceRow,applyOverride,MaSo,HoTenHV,Sdt,notes
7,1,TEST-001,Nguyen Van A,0909000001,bo sung khoa nghiep vu
```

### Ý nghĩa cột

- `sourceRow`
  - dòng gốc trong workbook
- `applyOverride`
  - nhập `1`, `y`, `yes`, `true` hoặc `x` để bật override
- các cột khóa nghiệp vụ
  - điền giá trị cần bổ sung
- `notes`
  - ghi chú nội bộ

## Quy trình chuẩn

### Bước 1 — sinh template mới nhất

```bash
python -X utf8 scripts/extract_workbook_erp.py \
  --source "docs/File Quan ly tong 2026.xlsx" \
  --dictionary "docs/Data_Dictionary_Excel.csv" \
  --output "docs/generated/workbook_2026" \
  --refresh-remediation
```

### Bước 2 — điền remediation

- Mở CSV tương ứng trong `docs/generated/workbook_2026/remediation/`
- Điền các khóa còn thiếu
- Bật `applyOverride`

### Bước 3 — merge override và tái sinh canonical

```bash
python -X utf8 scripts/extract_workbook_erp.py \
  --source "docs/File Quan ly tong 2026.xlsx" \
  --dictionary "docs/Data_Dictionary_Excel.csv" \
  --output "docs/generated/workbook_2026"
```

### Bước 4 — kiểm tra override đã ăn chưa

Xem:

- `docs/generated/workbook_2026/override_summary.json`
- `docs/generated/workbook_2026/diagnostics.json`
- `docs/generated/workbook_2026/import_readiness.json`

## Bước 5 — dry-run import

```bash
npm run import:workbook:ready -- --input "docs/generated/workbook_2026"
```

## Bước 6 — apply vào ERP

```bash
npm run import:workbook:ready -- --input "docs/generated/workbook_2026" --apply
```

## Ghi chú vận hành

- `raw_tables_extracted.json`
  - dữ liệu gốc sau khi đọc workbook, chưa merge override
- `raw_tables.json`
  - dữ liệu sau khi merge override
- `override_summary.json`
  - thống kê số file override đã đọc và số dòng đã áp dụng

## Khuyến nghị cứu dữ liệu theo thứ tự

1. `DSTest`
2. `DSHV`
3. `DSLop`
4. `NhanSu`
5. `TheoDoiHP`
6. `XuatNhapSach.T_SachNhap`
7. `XuatNhapSach.T_SachXuat`
8. `Thu-Chi.T_Thu`
9. `Thu-Chi.T_Chi`

Lý do:

- phải có `lead/student/class/employee` trước
- rồi mới resolve được `charge/payment/book issue/cash transaction`
