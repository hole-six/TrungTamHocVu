# Workbook Import Readiness

## Import được ngay

- `MucLuc.Table2`: 12/12 dòng có đủ khóa
- `MucLuc.Table3`: 7/7 dòng có đủ khóa
- `Thu-Chi.T_PhanLoai`: 22/22 dòng có đủ khóa
- `XuatNhapSach.T_SachTon`: 104/170 dòng có đủ khóa

## Cần bổ sung một phần

- `MucLuc.Table1`: 6/6 dòng có khóa một phần

## Đang bị chặn

- `ChiTietLopHoc.T_ChiTietLop`: thiếu khóa trên 4851 dòng
- `DSHV.T_HV`: thiếu khóa trên 423 dòng
- `DSLop.T_DSLop`: thiếu khóa trên 34 dòng
- `DSTest.T_DSTest`: thiếu khóa trên 502 dòng
- `NhanSu.T_NS`: thiếu khóa trên 53 dòng
- `TheoDoiHP.T_HP`: thiếu khóa trên 5967 dòng
- `Thu-Chi.T_Chi`: thiếu khóa trên 317 dòng
- `Thu-Chi.T_Thu`: thiếu khóa trên 148 dòng
- `XuatNhapSach.T_SachNhap`: thiếu khóa trên 163 dòng
- `XuatNhapSach.T_SachXuat`: thiếu khóa trên 2477 dòng

## Blocker lõi

- DSTest/DSHV/DSLop/NhanSu/TheoDoiHP thiếu khóa nghiệp vụ ở hầu hết dòng.
- Thu-Chi.T_Thu và Thu-Chi.T_Chi hiện là vùng pivot/tổng hợp, không phải ledger raw.
- XuatNhapSach.T_SachXuat và T_SachNhap thiếu TenSach/NgayThang đầu vào để link chuẩn.