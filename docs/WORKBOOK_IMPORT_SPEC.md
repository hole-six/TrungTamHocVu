# Workbook Import Spec

## 1. Mục tiêu

- Biến `docs/File Quan ly tong 2026.xlsx` thành nguồn import chuẩn vào ERP.
- Đảm bảo import theo đúng dependency, không sinh dữ liệu mồ côi.
- Tách rõ:
  - import `master`
  - import `transaction`
  - rebuild `derived data`

## 2. Nguyên tắc import

- Không import các cột report/calculated của Excel như dữ liệu gốc nếu có thể tính lại từ DB.
- Dùng `MaSo`, `MaHV`, `MaLop`, `TenLop`, `Tên ngắn`, `TenSach` làm khóa business ban đầu.
- Sau khi resolve khóa business, luôn map sang `id` nội bộ trước khi insert transaction.
- Import theo `branch`.
- Mọi import phải tạo `ImportJob`.

## 3. Thứ tự import bắt buộc

### Phase A — seed & lookup

1. `Organization`
2. `Branch`
3. `Role`, `Permission`, `User`
4. `Course` từ `MucLuc/Table2`
5. `weekday/time-slot lookup` từ `MucLuc/Table1`, `MucLuc/Table3`
6. `TransactionCategory` từ `Thu-Chi/T_PhanLoai`
7. `StockLocation` mặc định cho từng branch

### Phase B — master data

8. `Employee` từ `NhanSu/T_NS`
9. `EmploymentContract` từ `NhanSu`
10. `PayPolicy` từ `NhanSu`
11. `Guardian` từ `DSTest`
12. `Lead` từ `DSTest`
13. `PlacementTest`, `Appointment`, `LeadInteraction` nếu có dữ liệu bổ sung
14. `Class` từ `DSLop/T_DSLop`
15. `ScheduleRule` từ `DSLop` + `MucLuc`
16. `ClassTask` từ `DSLop`
17. `Student` từ `DSHV/T_HV`
18. `StudentGuardian` từ `DSTest + Student`
19. `Enrollment` từ `Student + Class`

### Phase C — operations

20. `ClassSession` từ `ChiTietLopHoc/T_ChiTietLop`
21. `SessionAssignment` từ `ChiTietLopHoc`
22. `StudentAttendance` nếu có đủ nguồn chi tiết; nếu chưa có thì để trống
23. `TimesheetEntry` từ `ChiTietLopHoc`
24. `ClassTaskLog` nếu có cột hoàn thành tương ứng

### Phase D — finance & inventory

25. `BillingPeriod` từ `TheoDoiHP/HP Tháng`
26. `Book` từ `XuatNhapSach/T_SachTon`
27. `StockTransaction` nhập kho từ `T_SachNhap`
28. `BookIssue` từ `T_SachXuat`
29. `Charge` từ `TheoDoiHP/T_HP`
30. Link `BookIssue.chargeId` theo `student + billing_period`
31. `Invoice` nếu cần sinh
32. `Payment` từ `TheoDoiHP/TienNop`
33. `PaymentAllocation` rebuild theo FIFO hoặc import nếu có evidence chắc chắn
34. `CreditBalance` rebuild từ payment dư
35. `Refund` nếu workbook có trường hợp hoàn tiền

### Phase E — cashbook & payroll

36. `CashTransaction` từ `Thu-Chi/T_Thu`, `Thu-Chi/T_Chi`
37. `PaymentCashPosting` link `Payment -> CashTransaction`
38. `StockCashPosting` link `StockTransaction -> CashTransaction`
39. `PayrollRun`
40. `PayrollLine` rebuild từ `TimesheetEntry`, `SessionAssignment`

### Phase F — derived & reconcile

41. rebuild summary student status
42. rebuild tuition balances
43. rebuild stock on hand
44. rebuild payroll totals
45. đối soát report với workbook

## 4. Mapping import theo sheet

### 4.1 `MucLuc`

**Nguồn**
- `Table1`: khung giờ
- `Table2`: mã lớp, tên lớp, học phí/buổi, số buổi/tuần
- `Table3`: thứ

**Đích**
- `Course`
- dữ liệu phụ trợ để sinh `ScheduleRule`

**Rule**
- `MaLop` phải unique trong branch
- bỏ qua dòng trống

### 4.2 `NhanSu`

**Đích**
- `Employee`
- `EmploymentContract`
- `PayPolicy`

**Rule**
- `Mã NV` unique
- `Tên ngắn` unique trong branch
- `Ngày nghỉ` -> `workStatus = RESIGNED`
- `Column3/Column4` map vào `teachingHourlyRate`, `payMode` sau workshop nếu chưa chốt rõ

### 4.3 `DSTest`

**Đích**
- `Guardian`
- `Lead`
- `PlacementTest`

**Rule**
- `MaSo` là khóa lead chính
- dedupe guardian theo `HoTenPH + Sdt`
- `Ngày nhập học` nếu có mà chưa chuyển đổi thì vẫn chỉ lưu vào `Lead.actualEnrollDate`

### 4.4 `DSLop`

**Đích**
- `Class`
- `ScheduleRule`
- `ClassTask`

**Rule**
- resolve `courseId` bằng `MaLop`
- `Ten lop` là display name
- `Ngay CĐ`, `Thu`, `Cong viec` -> `ClassTask` kiểu lặp
- `Ngay phat sinh`, `Cong viec PS` -> `ClassTask` kiểu one-off

### 4.5 `DSHV`

**Đích**
- `Student`
- `StudentGuardian`
- `Enrollment`
- `SchoolExamScore`

**Rule**
- `Student.studentCode = MaSo`
- `Student.studentDisplayId = MaHV`
- `Ngay nghi` có giá trị -> `status = LEFT`
- không import `HP tồn`, `T1..T24`, `1..12` như persisted source of truth

### 4.6 `ChiTietLopHoc`

**Đích**
- `ClassSession`
- `SessionAssignment`
- `TimesheetEntry`

**Rule**
- natural key gợi ý: `TenLop + Ngay thang + ThoiGian + Buoi so`
- resolve `classId` từ `TenLop` hoặc `MaLop`
- resolve `employeeId` bằng `Tên ngắn`
- `TTHoc` map sang `status`
- các cột `So_gio_*`, `Tien_*`, `Cong NV` được import dưới dạng snapshot nghiệp vụ

### 4.7 `TheoDoiHP`

**Đích**
- `BillingPeriod`
- `Charge`
- `Payment`
- `PaymentAllocation`
- `CreditBalance`

**Rule**
- grain: `student + class + billing period`
- `TongHP` là tổng charge của dòng
- `TienNop` sinh `Payment`
- nếu không có chi tiết allocation trong workbook thì rebuild FIFO
- `HP dau ky` map vào `Charge.openingBalance`
- `TienGiaoTrinh` chỉ là aggregate; source chi tiết nằm ở `BookIssue`

### 4.8 `XuatNhapSach`

**Đích**
- `Book`
- `StockTransaction`
- `BookIssue`

**Rule**
- `T_SachTon` là master sách + tồn tham chiếu
- `T_SachNhap` sinh `StockTransaction` loại `RECEIPT`
- `T_SachXuat` sinh `BookIssue`
- sau khi sinh `Charge`, link `BookIssue.chargeId` bằng `student + billing period`

### 4.9 `Thu-Chi`

**Đích**
- `TransactionCategory`
- `CashTransaction`

**Rule**
- `T_Thu` -> `type = THU`
- `T_Chi` -> `type = CHI`
- `T_PhanLoai` -> category dictionary
- bước reconcile sau import sẽ cố link `CashTransaction` với `PaymentCashPosting` hoặc `StockCashPosting`

## 5. Quy tắc resolve khóa

### Student resolver

Ưu tiên:
1. `MaSo`
2. `MaHV`
3. `TenHV&MaSo`
4. fallback `fullName + enrollDate`

### Class resolver

Ưu tiên:
1. `TenLop`
2. `MaLop + Lop`
3. `MaLop`

### Employee resolver

Ưu tiên:
1. `Tên ngắn`
2. `Mã NV`
3. `Họ và tên`

### Book resolver

Ưu tiên:
1. `TenSach`
2. `bookCode + TenSach` nếu sau này bổ sung

## 6. Validation bắt buộc trước commit import

- `MaSo` không được trùng bất hợp lý giữa các student khác nhau
- `Tên ngắn` không được trùng trong một branch
- `TenLop` phải resolve được sang `Class`
- `TheoDoiHP` phải resolve được `Student` và `BillingPeriod`
- `T_SachXuat` phải resolve được `Book` và `Student`
- tổng `CashTransaction(type=THU)` và tổng `Payment` phải nằm trong ngưỡng reconcile cho phép

## 7. Reconcile sau import

### Reconcile 1 — student count

- so `DSTest` với `Lead`
- so `DSHV` với `Student`

### Reconcile 2 — tuition

- tổng `TongHP` workbook theo tháng == tổng `Charge.totalAmount`
- tổng `TienNop` workbook == tổng `Payment.amount`
- tổng `Con lai` workbook ~= computed outstanding

### Reconcile 3 — inventory

- tồn cuối workbook ~= `received - issued +/- adjusted`

### Reconcile 4 — cashbook

- tổng thu workbook == tổng `CashTransaction(type=THU, status!=VOIDED)`
- tổng chi workbook == tổng `CashTransaction(type=CHI, status!=VOIDED)`

### Reconcile 5 — payroll

- `Report_Cong_Luong` ~= rollup từ `SessionAssignment` + `TimesheetEntry`

## 8. Chính sách import lỗi

- `master data` lỗi khóa: chặn import batch đó
- `transaction` lỗi resolve: ghi `ImportJob.errorLog`, skip row, tiếp tục batch nếu user cho phép
- luôn hỗ trợ `dry-run`
- mọi import phải có:
  - `totalRows`
  - `successRows`
  - `errorRows`
  - `errorLog`

## 9. Kết quả mong muốn

- Sau import, ERP có thể chạy mà không cần phụ thuộc công thức Excel.
- Workbook trở thành nguồn đối soát lịch sử, không còn là runtime engine.

