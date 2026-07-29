# ERP Implementation Matrix

## 1. Mục tiêu

- Tài liệu này nối 4 lớp với nhau:
  - Workbook nguồn `docs/File Quan ly tong 2026.xlsx`
  - Blueprint ERP đã bóc tách
  - Schema triển khai thật trong `prisma/schema.prisma`
  - API/UI hiện có trong repo
- Mục tiêu là biết rõ:
  - cái gì trong Excel đã có model DB
  - cái gì đã có API
  - cái gì đã có màn hình
  - cái gì còn thiếu để khép kín thành ERP vận hành

## 2. Kết luận tổng quát

- `prisma/schema.prisma` hiện đã đi rất xa theo hướng ERP chuẩn, không còn là schema demo đơn giản.
- Hầu hết trục lõi của workbook đã có model tương ứng:
  - CRM/Tuyển sinh
  - Học viên
  - Lớp/Lịch/Buổi học
  - Học phí/Thu tiền
  - Kho giáo trình
  - Thu chi
  - Nhân sự/Lương
  - Tài sản
  - Nhắc việc lớp
- Ứng dụng đã có khá nhiều API và page cho phần lõi, nhưng vẫn còn một số mắt xích nghiệp vụ cần nối chặt hơn, nhất là:
  - nối `Payment` với `CashTransaction`
  - nối `BookIssue` với `Charge/Payment`
  - chuẩn hóa import từ workbook vào DB
  - hoàn thiện report reconciliation với Excel

## 3. Workbook -> Prisma -> API/UI

| Module | Sheet nguồn | Model Prisma chính | API hiện có | UI hiện có | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| CRM Leads | `DSTest` | `Guardian`, `Lead`, `LeadInteraction`, `Appointment`, `PlacementTest` | `app/api/leads/*`, `app/api/guardians/*`, `app/api/appointments/*` | `/leads`, `/leads/new`, `/leads/[id]`, `/guardians`, `/guardians/[id]` | Tốt |
| Chuyển lead -> học viên | `DSTest -> DSHV` | `Lead`, `Student`, `StudentGuardian` | `app/api/leads/[id]/convert/route.ts` | xuất phát từ `/leads/[id]` | Tốt |
| Học viên | `DSHV` | `Student`, `StudentGuardian`, `EnrollmentStatusHistory`, `SchoolExamScore` | `app/api/students/*`, `app/api/students/[id]/scholarships`, `.../adjustments`, `.../exam-scores` | `/students`, `/students/new`, `/students/[id]` | Tốt |
| Danh mục khóa/lớp | `MucLuc`, `DSLop` | `Course`, `Class`, `ScheduleRule`, `ClassTask`, `ClassTaskLog` | `app/api/courses/*`, `app/api/classes/*`, `app/api/schedule-rules/*`, `app/api/class-tasks/*` | `/classes`, `/classes/new`, `/classes/[id]` | Tốt |
| Buổi học / vận hành lớp | `ChiTietLopHoc` | `ClassSession`, `SessionAssignment`, `StudentAttendance`, `TimesheetEntry`, `TimesheetPeriod` | `app/api/sessions/*`, `app/api/session-assignments/*`, `app/api/timesheet-entries/*`, `app/api/classes/[id]/generate-sessions` | `/classes/[id]/sessions/[sessionId]`, `/timesheets`, `/calendar` | Tốt |
| Ghi danh lớp | `DSHV + DSLop` | `Enrollment` | `app/api/enrollments/[id]`, `app/api/classes/[id]/enrollments` | một phần trong `/classes/[id]` | Khá |
| Học phí/công nợ | `TheoDoiHP` | `BillingPeriod`, `FeePolicy`, `Charge`, `Invoice`, `Payment`, `PaymentAllocation`, `Scholarship`, `Adjustment`, `CreditBalance`, `Refund` | `app/api/billing-periods/*`, `app/api/charges/[id]`, `app/api/payments/*` | `/tuition`, `/tuition/[id]` | Tốt |
| Kho giáo trình | `XuatNhapSach` | `Book`, `StockLocation`, `StockTransaction`, `BookIssue` | `app/api/books/*`, `app/api/books/[id]/stock-transactions`, `app/api/books/[id]/issues` | `/inventory`, `/inventory/[id]` | Tốt |
| Thu chi tiền mặt | `Thu-Chi` | `TransactionCategory`, `CashTransaction` | `app/api/cash-categories/route.ts`, `app/api/cash-transactions/*` | `/cashbook` | Tốt |
| Nhân sự / đơn giá lương | `NhanSu` | `Employee`, `EmploymentContract`, `PayPolicy` | `app/api/employees/*` | gián tiếp qua `/payroll/employees/[id]` | Khá |
| Payroll | `ChiTietLopHoc + Report_Cong_Luong` | `PayrollRun`, `PayrollLine` | `app/api/payroll-runs/*`, `app/api/payroll-lines/[id]` | `/payroll`, `/payroll/[id]`, `/payroll/employees/[id]` | Tốt |
| Tài sản | yêu cầu bổ sung ngoài workbook lõi | `Asset`, `AssetTransaction` | `app/api/assets/*` | `/assets`, `/assets/[id]` | Tốt |
| Quản trị / phân quyền | spec phân quyền | `Organization`, `Branch`, `Role`, `Permission`, `RolePermission`, `User`, `AuditLog`, `ImportJob`, `IntegrationLog`, `Notification`, `Attachment`, `Task` | `app/api/users/*`, `app/api/branches/*`, `app/api/audit-logs/*`, `app/api/tasks/*` | `/admin`, `/admin/branches`, `/admin/roles` | Khá |

## 4. Mapping chi tiết theo sheet

### 4.1 `DSTest`

**Workbook role**
- lead đầu vào
- thông tin học sinh + phụ huynh
- lịch test, gợi ý lớp, trạng thái nhập học

**Prisma mapping**
- `Lead`
- `Guardian`
- `PlacementTest`
- `LeadInteraction`
- `Appointment`

**Chuẩn hóa**
- `MaSo` -> `Lead.leadCode`
- `HoTenHV` -> `Lead.fullName`
- `HoTenPH` -> `Guardian.fullName`
- `Sdt` -> `Lead.phone`
- `NgayTest` -> `PlacementTest.testDate`
- `Tình trạng test` -> `PlacementTest.status`

**Nhận xét**
- module này đã đủ tốt để đi production trước.

### 4.2 `DSHV`

**Workbook role**
- master học viên
- trạng thái học
- tồn học phí
- snapshot theo tháng

**Prisma mapping**
- `Student`
- `StudentGuardian`
- `Enrollment`
- `EnrollmentStatusHistory`
- `SchoolExamScore`

**Chuẩn hóa**
- `MaSo` -> `Student.studentCode`
- `MaHV` -> `Student.studentDisplayId`
- `TenHV` -> `Student.fullName`
- `Ngay nhap` -> `Student.enrollDate`
- `Ngay nghi` -> `Student.leaveDate`
- `Lí do nghỉ` -> `Student.leaveReason`
- `DanhGia` -> `Student.evaluation`

**Nhận xét**
- DB đã đúng hướng khi không lưu trùng các cột report tháng kiểu Excel.
- Các cột tính như `HP tồn`, `T1..T24`, `1..12` nên được query/report hóa, không hard persist.

### 4.3 `DSLop`

**Workbook role**
- danh sách lớp vận hành
- ngày khai giảng/kết thúc dự kiến
- nhắc việc cố định và phát sinh

**Prisma mapping**
- `Course`
- `Class`
- `ScheduleRule`
- `ClassTask`
- `ClassTaskLog`

**Nhận xét**
- đây là bước chuẩn hóa rất đúng vì đã tách:
  - danh mục loại lớp (`Course`)
  - lớp đang vận hành (`Class`)
  - quy tắc lịch (`ScheduleRule`)
  - nhắc việc (`ClassTask`)

### 4.4 `ChiTietLopHoc`

**Workbook role**
- log buổi học
- phân công GV/TG
- giờ công, tiền công
- nhắc việc theo ngày thực tế

**Prisma mapping**
- `ClassSession`
- `SessionAssignment`
- `StudentAttendance`
- `TimesheetEntry`

**Nhận xét**
- đây là tâm vận hành của ERP.
- DB đang đi đúng hơn Excel vì tách attendance, assignment, timesheet ra khỏi một hàng rất rộng.

### 4.5 `TheoDoiHP`

**Workbook role**
- ledger học phí theo học viên-tháng
- số buổi, đơn giá, học bổng, giáo trình, tiền nộp, công nợ

**Prisma mapping**
- `BillingPeriod`
- `FeePolicy`
- `Charge`
- `Invoice`
- `Payment`
- `PaymentAllocation`
- `Scholarship`
- `Adjustment`
- `CreditBalance`
- `Refund`

**Nhận xét**
- đây là chuẩn hóa tốt nhất so với workbook gốc.
- thay vì giữ một hàng ledger Excel lẫn charge + payment + carry-forward, DB đã tách event tài chính đúng bản chất.

### 4.6 `XuatNhapSach`

**Workbook role**
- nhập/xuất/tồn giáo trình
- charge giáo trình cho học viên

**Prisma mapping**
- `Book`
- `StockLocation`
- `StockTransaction`
- `BookIssue`

**Nhận xét**
- `StockTransaction` bao phủ phần nhập/tồn tốt.
- `BookIssue` là đúng chỗ để nối giáo trình với học viên.
- còn thiếu cầu nối kế toán chặt hơn sang `Charge` hoặc `Payment`.

### 4.7 `Thu-Chi`

**Workbook role**
- sổ thu chi tiền mặt
- danh mục loại thu chi

**Prisma mapping**
- `TransactionCategory`
- `CashTransaction`

**Nhận xét**
- data model đã đủ clean.
- vấn đề còn lại là đồng bộ phát sinh tự động từ học phí/kho/tài sản sang quỹ.

### 4.8 `NhanSu`

**Workbook role**
- hồ sơ nhân sự
- tên ngắn lookup
- đơn giá lương
- hợp đồng

**Prisma mapping**
- `Employee`
- `EmploymentContract`
- `PayPolicy`

**Nhận xét**
- model `shortName` là quyết định đúng vì khớp logic lookup của Excel.

## 5. Điểm mạnh của schema hiện tại

- Tách rất rõ `master data` với `transaction data`.
- Tách rõ CRM -> student lifecycle -> class operations -> finance.
- Không bê nguyên cột báo cáo Excel vào DB.
- Có sẵn `AuditLog`, `ImportJob`, `IntegrationLog`, `Task`, `Notification`, `Attachment`.
- Có sẵn `Role/Permission` và `Branch` để đi đa cơ sở.

## 6. Gap còn lại để “chu toàn mọi phía”

### 6.1 Học phí chưa nối thẳng quỹ tiền mặt

**Hiện có**
- `Payment`
- `CashTransaction`

**Thiếu**
- liên kết trực tiếp `payment_id -> cash_transaction_id`

**Khuyến nghị**
- thêm trường tham chiếu một-một hoặc bảng bridge `PaymentCashPosting`
- khi tạo `Payment`, tự động sinh `CashTransaction` loại `THU`

### 6.2 Xuất giáo trình chưa nối chặt vào charge

**Hiện có**
- `BookIssue`
- `Charge`

**Thiếu**
- quan hệ rõ giữa một dòng xuất giáo trình và dòng charge học phí/phụ phí

**Khuyến nghị**
- thêm `chargeId` trong `BookIssue`
- hoặc thêm `ChargeLine`/`StudentFeeLine` để tách tuition và material fee

### 6.3 Import workbook chưa đóng gói thành pipeline chuẩn

**Hiện có**
- `ImportJob`

**Thiếu**
- mapping importer cụ thể cho từng sheet
- rules reconcile sau import

**Khuyến nghị**
- build importer theo phase:
  - `MucLuc`
  - `NhanSu`
  - `DSTest`
  - `DSLop`
  - `DSHV`
  - `ChiTietLopHoc`
  - `TheoDoiHP`
  - `XuatNhapSach`
  - `Thu-Chi`

### 6.4 Report chưa xác minh 1-1 với workbook

**Hiện có**
- page `/reports`
- các model nguồn đầy đủ

**Thiếu**
- bộ test đối soát:
  - tổng số học viên
  - công nợ theo tháng
  - tổng tiền đã thu
  - tồn giáo trình
  - công lương

## 7. Thứ tự build/khóa để chạy thật

### P1: data foundation

- `Branch`, `Role`, `Permission`
- `Employee`
- `Course`, `Class`
- `Guardian`, `Lead`
- `Student`

### P2: operations

- `Enrollment`
- `ClassSession`
- `SessionAssignment`
- `StudentAttendance`
- `TimesheetEntry`

### P3: finance

- `BillingPeriod`
- `Charge`
- `Payment`
- `PaymentAllocation`
- `CashTransaction`

### P4: inventory + payroll

- `Book`, `StockTransaction`, `BookIssue`
- `PayrollRun`, `PayrollLine`

### P5: reconciliation + migration

- importer workbook
- report parity
- audit + rollback tools

## 8. Route inventory hiện tại

### API đã có

- Leads: `app/api/leads/route.ts:1`
- Students: `app/api/students/route.ts:1`
- Classes: `app/api/classes/route.ts:1`
- Sessions: `app/api/sessions/[id]/route.ts:1`
- Payments: `app/api/payments/route.ts:1`
- Billing periods: `app/api/billing-periods/route.ts:1`
- Books/inventory: `app/api/books/route.ts:1`
- Cashbook: `app/api/cash-transactions/route.ts:1`
- Employees: `app/api/employees/route.ts:1`
- Payroll: `app/api/payroll-runs/route.ts:1`
- Assets: `app/api/assets/route.ts:1`

### Page đã có

- Leads: `app/(app)/leads/page.tsx:1`
- Students: `app/(app)/students/page.tsx:1`
- Classes: `app/(app)/classes/page.tsx:1`
- Tuition: `app/(app)/tuition/page.tsx:1`
- Inventory: `app/(app)/inventory/page.tsx:1`
- Cashbook: `app/(app)/cashbook/page.tsx:1`
- Payroll: `app/(app)/payroll/page.tsx:1`
- Assets: `app/(app)/assets/page.tsx:1`
- Reports: `app/(app)/reports/page.tsx:1`

## 9. Kết luận triển khai

- Repo hiện tại đã có nền ERP thật, không còn ở mức mockup.
- Workbook đã được map sang schema khá chuẩn.
- Việc cần làm tiếp không phải “vẽ lại từ đầu”, mà là:
  - khóa importer
  - nối cashflow
  - nối material fee
  - viết report reconciliation
  - hoàn thiện các màn operational thiếu chiều sâu

## 10. Artefact liên quan

- Blueprint tổng thể: `docs/ERP_WORKBOOK_BLUEPRINT.md`
- Canonical machine map: `docs/ERP_CANONICAL_MAP.json`
- Quan hệ chuẩn hóa: `docs/ERP_RELATIONSHIP_MAP.csv`
- Bảng mapping triển khai: `docs/WORKBOOK_TO_PRISMA_MAP.csv`

