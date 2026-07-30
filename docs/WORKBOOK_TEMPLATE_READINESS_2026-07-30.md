# Workbook Template Readiness — 2026-07-30

## Giả định đúng theo trao đổi

Workbook `docs/File Quan ly tong 2026.xlsx` được xem là:

- bản mẫu cột nhập liệu
- bản mẫu công thức tính
- bản mẫu báo cáo đầu ra
- chưa có dữ liệu thực ở nhiều dòng bên dưới

Vì vậy tiêu chí đánh giá ở đây là:

1. **Schema DB có đủ để chứa dữ liệu hợp lý theo các cột chính hay không**
2. **Luồng nghiệp vụ có đủ để sinh ra các cột tính toán/báo cáo như Excel hay không**
3. **Có thiếu trường quan trọng nào của Excel mà DB/logic hiện tại không gánh nổi hay không**

## Kết luận ngắn

### Về cấu trúc

Repo hiện tại **đã khá sát bản mẫu Excel về mặt cấu trúc ERP**, và tốt hơn Excel ở chỗ đã chuẩn hóa dữ liệu thành model nghiệp vụ thay vì giữ mọi thứ trên một hàng rộng.

### Về dữ liệu

Workbook hiện tại **không phải nguồn raw để import đầy đủ**, nên chưa thể dùng nó để chứng minh parity dữ liệu 1-1.

### Về khả năng triển khai thật

Nếu sau này người dùng nhập dữ liệu hợp lý vào đúng các cột mẫu, thì hệ thống hiện tại **đủ nền để nhận phần lớn dữ liệu lõi** và tính ra phần lớn đầu ra mong muốn.

## Đánh giá theo module

### 1. CRM / Test đầu vào

Sheet nguồn:

- `DSTest`

DB hiện có model phù hợp:

- `Guardian`
- `Lead`
- `PlacementTest`
- `LeadInteraction`
- `Appointment`

Kết luận:

- **Đủ cấu trúc**
- các cột kiểu `MaSo`, `HoTenHV`, `HoTenPH`, `Sdt`, `NgayTest`, `Tinh trang test`, `TenLop`, `Ngay nhap hoc` đều có chỗ map hợp lý

### 2. Học viên

Sheet nguồn:

- `DSHV`

DB hiện có model phù hợp:

- `Student`
- `StudentGuardian`
- `Enrollment`
- `EnrollmentStatusHistory`
- `SchoolExamScore`

Kết luận:

- **Đủ cấu trúc**
- các cột `MaSo`, `MaHV`, `TenHV`, `Ngay nhap`, `Ngay nghi`, `Lí do nghỉ`, `DanhGia`, `HP tồn` có hướng lưu đúng
- các cột tháng / snapshot / tình trạng là **derived/report field**, không cần persist nguyên xi

### 3. Danh mục lớp và lớp vận hành

Sheet nguồn:

- `MucLuc`
- `DSLop`

DB hiện có model phù hợp:

- `Course`
- `Class`
- `ScheduleRule`
- `ClassTask`
- `ClassTaskLog`

Kết luận:

- **Đủ cấu trúc**
- đây là chỗ schema đang làm tốt hơn Excel vì đã tách `loại lớp`, `lớp thực tế`, `lịch`, `nhắc việc`

### 4. Buổi học / vận hành lớp / chấm công

Sheet nguồn:

- `ChiTietLopHoc`

DB hiện có model phù hợp:

- `ClassSession`
- `SessionAssignment`
- `StudentAttendance`
- `TimesheetEntry`
- `ClassSessionJournal`

Kết luận:

- **Đủ cấu trúc**
- các cột GV/TG/TG2, giờ công, cộng/trừ giờ, kết quả buổi học đều có hướng lưu hợp lý

### 5. Học phí / công nợ

Sheet nguồn:

- `TheoDoiHP`

DB hiện có model phù hợp:

- `BillingPeriod`
- `Charge`
- `Invoice`
- `Payment`
- `PaymentAllocation`
- `Scholarship`
- `Adjustment`
- `CreditBalance`
- `Refund`

Kết luận:

- **Đủ cấu trúc lõi**
- ledger Excel đã được chuẩn hóa tốt thành event tài chính
- nhiều cột như `TongHP`, `Con lai`, `Cong don`, `Tinh trang dong hoc phi` nên được tính từ transaction thay vì lưu thô

### 6. Kho giáo trình

Sheet nguồn:

- `XuatNhapSach`

DB hiện có model phù hợp:

- `Book`
- `StockTransaction`
- `BookIssue`

Kết luận:

- **Đủ cấu trúc**
- đặc biệt `BookIssue` hiện đã có `chargeId`, tức là đã có điểm nối sang học phí

### 7. Thu chi tiền mặt

Sheet nguồn:

- `Thu-Chi`

DB hiện có model phù hợp:

- `TransactionCategory`
- `CashTransaction`

Kết luận:

- **Đủ cấu trúc**
- phân loại thu chi, diễn giải, số tiền, người thu/chi đều có nơi lưu

### 8. Nhân sự / payroll

Sheet nguồn:

- `NhanSu`
- `Report_Cong_Luong`

DB hiện có model phù hợp:

- `Employee`
- `EmploymentContract`
- `PayPolicy`
- `PayrollRun`
- `PayrollLine`

Kết luận:

- **Đủ cấu trúc khá tốt**
- `Employee.shortName` là khóa lookup rất sát logic Excel
- `teachingHourlyRate`, `assistantHourlyRate`, `payMode` đã phản ánh kiểu tính lương

## Những chỗ schema hiện tại đã tốt hơn nhận định cũ

### Học phí nối quỹ tiền mặt

Schema hiện đã có:

- `PaymentCashPosting`
- `RefundCashPosting`

=> Nghĩa là phần nối `Payment <-> CashTransaction` **đã có cấu trúc DB**, không còn là gap schema thô nữa.

### Xuất giáo trình nối học phí

Schema hiện đã có:

- `BookIssue.chargeId`

=> Nghĩa là phần nối giáo trình sang charge **đã có cấu trúc DB**, không còn là gap schema thô nữa.

## Gap còn lại theo góc nhìn template mode

Các gap lớn còn lại không nằm ở “thiếu model”, mà nằm ở:

### 1. Importer chưa khép kín cho mọi module

Hiện importer mới chắc tay ở:

- `Course`
- `TransactionCategory`
- `Book`

Cần bổ sung importer cho:

- `Employee`
- `Lead`
- `Student`
- `Class`
- `ClassSession`
- `BillingPeriod/Charge/Payment`
- `CashTransaction`
- `BookIssue`

### 2. Chưa có bộ parity test report 1-1 với workbook

Cần thêm bộ test/report đối soát cho:

- tổng học viên
- công nợ theo tháng
- tiền thu
- tồn sách
- công lương

### 3. Một số cột Excel là report/helper field

Không nên cố lưu nguyên trạng vào DB cho mọi cột như:

- `T1..T24`
- `1..12`
- `Cong don`
- `Tinh trang dong hoc phi`
- các cột tổng hợp / subtotal / pivot

Những cột này nên:

- được tính từ dữ liệu normalized
- hoặc materialize ra report layer

## Kết luận cuối

Nếu đánh giá theo tiêu chí **“đủ cấu trúc để sau này nhập dữ liệu hợp lý vào và sinh ra output đầy đủ như Excel”** thì:

- **DB hiện tại đạt mức tốt**
- **không thấy thiếu khung model nghiêm trọng ở các phân hệ lõi**
- vấn đề lớn nhất hiện nay là **import workflow** và **report parity**, không phải thiếu schema nền

## Đánh giá thực dụng

### Có thể xem là đã sẵn sàng ở mức nào?

- **Schema readiness**: cao
- **API/UI readiness**: khá cao
- **Importer readiness**: trung bình
- **Excel parity by structure**: cao
- **Excel parity by actual data**: chưa đánh giá được vì workbook là template

### Nên hiểu ngắn gọn

Không phải “DB đã hoàn hảo tuyệt đối”, nhưng theo góc nhìn **bản mẫu cột + công thức**, thì hệ thống hiện tại **đã đi đúng gần như toàn bộ xương sống nghiệp vụ**.

