# Remediation UI cho workbook ERP

## Mục tiêu

Trang admin remediation cho phép đội vận hành bổ sung trực tiếp các khóa còn thiếu trong các file CSV remediation đã được extractor sinh ra, thay vì phải chỉnh tay ngoài ứng dụng.

## Đường dẫn

- Trang quản trị: `/admin/imports/remediation`
- API đọc/lưu: `/api/admin/import-remediation`

## Cách dùng

1. Mở trang remediation trong Admin.
2. Chọn bảng đang bị chặn như `DSTest.T_DSTest`, `DSHV.T_HV`, `TheoDoiHP.T_HP`.
3. Điền các cột khóa còn thiếu và bật `applyOverride`.
4. Lưu lại ngay trên giao diện.
5. Chạy lại pipeline:

```bash
npm run pipeline:workbook -- --apply --output "docs/generated/workbook_2026"
```

6. Quay lại `/admin/imports` để kiểm tra `ImportJob`, blocker và warning.

## Ghi chú

- Cột `sourceRow` là bắt buộc và không được xóa.
- UI chỉ chỉnh các file trong `docs/generated/workbook_2026/remediation/`.
- Hệ thống không tự bịa dữ liệu; remediation vẫn cần giá trị nghiệp vụ đúng từ file nguồn hoặc người vận hành.
