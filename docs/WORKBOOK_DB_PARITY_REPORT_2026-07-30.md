# Workbook → DB Parity Report (2026-07-30)

## Kết luận nhanh

- Tổng mục đối chiếu: 20
- Đã implement ở schema/API/UI: 13/20
- Mức import-ready từ chính workbook template: ready 4, partial 1, blocked 10
- Trạng thái chung: schema và luồng ERP đã phủ gần đủ, nhưng nhiều sheet nghiệp vụ chính trong workbook vẫn là template/công thức nên chưa thể import raw 1:1.

## Bảng đối chiếu từng sheet/bảng

| Sheet | Table | Module | Status code | Import-ready | DB hiện có | Kết luận |
|---|---|---|---|---|---|---|
| DSTest | T_DSTest | CRM | implemented | blocked (0/502 đủ khóa) | Lead:1<br>Guardian:1<br>PlacementTest:1 | Schema có, import template chưa dùng được |
| DSHV | T_HV | Student Lifecycle | implemented | blocked (0/423 đủ khóa) | Student:1<br>Enrollment:1<br>StatusHistory:1<br>ExamScore:0 | Schema có, import template chưa dùng được |
| DSLop | T_DSLop | Class Management | implemented | blocked (0/34 đủ khóa) | Course:12<br>Class:1<br>ScheduleRule:1<br>ClassTask:0<br>TaskLog:0 | Schema có, import template chưa dùng được |
| ChiTietLopHoc | T_ChiTietLop | Class Operations | implemented | blocked (0/4851 đủ khóa) | Session:1<br>Assignment:2<br>Attendance:1<br>TimesheetEntry:1<br>TimesheetPeriod:1 | Schema có, import template chưa dùng được |
| TheoDoiHP | T_HP | Tuition | implemented_with_gap | blocked (0/5967 đủ khóa) | BillingPeriod:1<br>Charge:1<br>Invoice:1<br>Payment:1<br>Allocation:1<br>Scholarship:0<br>Adjustment:0<br>Credit:0<br>Refund:0 | Schema có, import template chưa dùng được |
| XuatNhapSach | T_SachTon | Inventory | implemented | ready (104/170 đủ khóa) | Book:104<br>StockLocation:1 | Có thể nhập từ template hiện tại |
| XuatNhapSach | T_SachNhap | Inventory | implemented | blocked (0/163 đủ khóa) | StockReceipt:1 | Schema có, import template chưa dùng được |
| XuatNhapSach | T_SachXuat | Inventory | partial | blocked (0/2477 đủ khóa) | BookIssue:1<br>StockReturn:0 | Schema có, import template chưa dùng được |
| Thu-Chi | T_Thu | Cashbook | implemented | blocked (0/148 đủ khóa) | CashReceipt:1 | Schema có, import template chưa dùng được |
| Thu-Chi | T_Chi | Cashbook | implemented | blocked (0/317 đủ khóa) | CashPayment:1 | Schema có, import template chưa dùng được |
| Thu-Chi | T_PhanLoai | Cashbook | implemented | ready (22/22 đủ khóa) | Category:22 | Có thể nhập từ template hiện tại |
| NhanSu | T_NS | HR/Payroll | implemented | blocked (0/53 đủ khóa) | Employee:3<br>Contract:1<br>PayPolicy:1 | Schema có, import template chưa dùng được |
| MucLuc | Table1 | Lookup | covered_in_schema | partial (0/6 đủ khóa) | ScheduleRule:1 | Schema có, cần bridge/lookup thêm |
| MucLuc | Table2 | Lookup | implemented | ready (12/12 đủ khóa) | Course:12 | Có thể nhập từ template hiện tại |
| MucLuc | Table3 | Lookup | implicit | ready (7/7 đủ khóa) | ScheduleRule:1 | Có thể nhập từ template hiện tại |
| Report_Cong_Luong | n/a | Reporting | implemented | derived/report | TimesheetEntry:1<br>Payroll-ready via SessionAssignment+Timesheet | Dữ liệu suy diễn từ module khác |
| Report_HS | n/a | Reporting | partial | derived/report | Student:1<br>Enrollment:1<br>Attendance:1 | Đã model hóa, còn thiếu parity report/UI |
| Report_HP | n/a | Reporting | partial | derived/report | Charge:1<br>Payment:1<br>BillingPeriod:1 | Đã model hóa, còn thiếu parity report/UI |
| SinhNhatHV | n/a | Reporting | partial | derived/report | Student:1 | Đã model hóa, còn thiếu parity report/UI |
| Home | Table19 | System | reference_only | derived/report | No DB table<br>Navigation/reference only | Dữ liệu suy diễn từ module khác |

## Các sheet/bảng đang khớp tốt nhất

- XuatNhapSach/T_SachTon: Tồn kho và nhập kho tốt
- Thu-Chi/T_PhanLoai: Danh mục loại thu chi
- MucLuc/Table2: Học phí/buổi và số buổi/tuần
- MucLuc/Table3: Lookup thứ trong tuần chưa tách bảng riêng

## Các điểm còn vướng chính

- DSTest/DSHV/DSLop/NhanSu/TheoDoiHP thiếu khóa nghiệp vụ ở hầu hết dòng.
- Thu-Chi.T_Thu và Thu-Chi.T_Chi hiện là vùng pivot/tổng hợp, không phải ledger raw.
- XuatNhapSach.T_SachXuat và T_SachNhap thiếu TenSach/NgayThang đầu vào để link chuẩn.
- `ChiTietLopHoc`, `DSTest`, `DSHV`, `DSLop`, `NhanSu`, `TheoDoiHP` có model đủ nhưng dữ liệu trong file mẫu chưa mang business key raw để import thẳng.
- `Thu-Chi.T_Thu` và `Thu-Chi.T_Chi` hiện giống vùng tổng hợp/pivot hơn là journal raw, nên parity cần đi qua `PaymentCashPosting` và `StockCashPosting` thay vì import trực tiếp từng dòng.
- `Report_HS`, `Report_HP`, `Report_Cong_Luong`, `SinhNhatHV` là báo cáo suy diễn; muốn khớp 100% cần viết query/report parity chứ không chỉ đối chiếu schema.

## Khuyến nghị thực thi tiếp

- Ưu tiên 1: dựng report API cho `Report_HS` và `Report_HP` để so số với workbook.
- Ưu tiên 2: thêm tầng `template adapters` cho các sheet công thức nếu bạn muốn nhập từ file mẫu thay vì dữ liệu vận hành raw.
- Ưu tiên 3: chuẩn hóa bridge giữa `Payment` ↔ `CashTransaction` và `BookIssue` ↔ `Charge` ở mọi luồng thật, không chỉ demo seed.
