# Workbook Parity Audit — 2026-07-30

## Workbook nguồn

- File kiểm tra: `docs/File Quan ly tong 2026.xlsx`
- Ngày audit: `2026-07-30`

## Việc đã chạy

1. Apply toàn bộ Prisma migrations vào `prisma/dev.db`
2. Chạy pipeline:
   - `scripts/run_workbook_pipeline.ts --source "docs/File Quan ly tong 2026.xlsx" --output "docs/generated/workbook_2026_livecheck"`
   - `scripts/run_workbook_pipeline.ts --source "docs/File Quan ly tong 2026.xlsx" --output "docs/generated/workbook_2026_liveapply" --apply`
3. Audit số lượng dữ liệu thực nhập trong DB sau import

## Kết quả import thực tế

### Imported thành công

- `Course`: `12`
- `TransactionCategory`: `22`
- `Book`: `104`
- `StockLocation`: `1`

### Chưa import được

- `Lead`: `0`
- `Student`: `0`
- `Class`: `0`
- `Employee`: `0`
- `BillingPeriod`: `0`
- `Payment`: `0`
- `CashTransaction`: `0`
- `BookIssue`: `0`

## ImportJob sau khi apply

- `IMPORTED`: `3`
- `VALIDATING`: `2`
- `FAILED`: `10`

## Kết luận chính

Database hiện **chưa phản ánh đầy đủ** workbook nguồn. Hệ thống mới chỉ nhập được các bảng lookup / inventory sạch:

- `MucLuc.Table2` -> `Course`
- `Thu-Chi.T_PhanLoai` -> `TransactionCategory`
- `XuatNhapSach.T_SachTon` -> `Book`

## Phát hiện gốc

Các sheet lõi trong workbook hiện tại gần như là **template / vùng công thức / vùng tổng hợp**, chưa chứa đủ dữ liệu raw để import an toàn:

- `DSTest`: các cột lõi như `HoTenHV`, `Sdt`, `MaSo` trống
- `DSHV`: `MaLop`, `TenLop`, `TenHV`, `MaSo`, `MaHV` trống hoặc lỗi tra cứu
- `DSLop`: `MaLop`, `Lop` trống, `Ten lop` chủ yếu là `-`
- `NhanSu`: chỉ có header, chưa có mã NV / tên / tên ngắn thực tế
- `TheoDoiHP`: phần lớn là công thức, thiếu khóa `MaSo`, `Ten HV`, `HP Tháng`
- `ChiTietLopHoc`: thiếu `Ngay thang`, `MaLop`, `TenLop`, `Giáo viên`
- `Thu-Chi.T_Thu` và `Thu-Chi.T_Chi`: đang là vùng tổng hợp/pivot, không phải sổ cái raw
- `XuatNhapSach.T_SachNhap` / `T_SachXuat`: thiếu khóa raw để link chuẩn

## Hệ quả

Hiện chưa thể hoàn tất các luồng chính sau chỉ từ workbook này:

- `Lead -> Student`
- `Student -> Class -> Session`
- `Tuition -> Payment -> Cashbook`
- `Employee -> Timesheet -> Payroll`
- `BookIssue -> Student / Charge`

## Khuyến nghị tiếp theo

1. Xác nhận lại workbook nguồn có phải là file đã được làm sạch / template / pivot-only hay không
2. Nếu có file raw thật, chạy lại pipeline với file đó
3. Nếu phải dùng chính file này, cần điền remediation CSV trong:
   - `docs/generated/workbook_2026/remediation/`
4. Ưu tiên remediation theo thứ tự:
   - `NhanSu`
   - `DSTest`
   - `DSHV`
   - `DSLop`
   - `ChiTietLopHoc`
   - `TheoDoiHP`

