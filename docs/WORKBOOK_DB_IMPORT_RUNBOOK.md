# Workbook DB Import Runbook

## Mục tiêu

- Nhập ngay phần dữ liệu `đủ khóa nghiệp vụ` từ workbook vào ERP
- Tạo `ImportJob` để theo dõi bảng nào đã nhập được và bảng nào còn bị chặn

## Script

```bash
npm run import:workbook:ready -- --input "docs/generated/workbook_2026"
```

## Pipeline end-to-end

```bash
npm run pipeline:workbook -- --output "docs/generated/workbook_2026"
```

- Chạy extractor workbook
- Merge override remediation nếu có
- Chạy import staged vào ERP

### Apply end-to-end

```bash
npm run pipeline:workbook -- --output "docs/generated/workbook_2026" --apply
```

## Chế độ

### Dry-run

```bash
npm run import:workbook:ready -- --input "docs/generated/workbook_2026"
```

- Không ghi DB
- Chỉ trả về summary những gì sẽ được import

### Apply

```bash
npm run import:workbook:ready -- --input "docs/generated/workbook_2026" --apply
```

- Upsert `Course`
- Upsert `TransactionCategory`
- Upsert `Book`
- Đảm bảo có `StockLocation = Kho mặc định`
- Ghi `ImportJob` cho:
  - bảng đã nhập được
  - bảng lookup chưa có model persist riêng
  - bảng đang bị chặn do thiếu khóa nghiệp vụ

## Ghi chú

- Script mặc định dùng branch active đầu tiên trong DB.
- Có thể chỉ định branch:

```bash
npm run import:workbook:ready -- --input "docs/generated/workbook_2026" --apply --branch-code CS1
```

- Nguồn import hiện tại là workbook canonical đã sinh ở:
  - `docs/generated/workbook_2026/canonical.json`
  - `docs/generated/workbook_2026/import_readiness.json`
