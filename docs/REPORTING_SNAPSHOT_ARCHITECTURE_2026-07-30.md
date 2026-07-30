# Mô hình nâng cấp báo cáo Excel → Web ERP (live + lịch sử)

Ngày chốt: 2026-07-30

## 1. Kết luận chốt

Để web thay được file Excel kiểu hiện tại, hệ thống phải chạy theo **2 lớp dữ liệu song song**:

1. **Dữ liệu live**
   - Phục vụ nhập mới mỗi ngày
   - Luôn phản ánh trạng thái hiện tại của trung tâm
   - Dùng cho vận hành

2. **Dữ liệu snapshot theo kỳ**
   - Phục vụ xem lại dữ liệu cũ theo tháng / tuần / ngày / kỳ lương
   - Là “ảnh chụp đã chốt sổ”, không bị thay đổi khi dữ liệu live đổi về sau
   - Dùng cho báo cáo, đối soát, export Excel

Nếu chỉ đọc dữ liệu live thì xem lại tháng cũ sẽ sai.  
Nếu chỉ lưu snapshot mà không có dữ liệu live thì vận hành hằng ngày sẽ chậm và cứng.

=> Mô hình đúng nhất là: **live để vận hành, snapshot để báo cáo lịch sử**.

---

## 2. Điều Excel đang làm mà web phải học theo

Qua 12 ảnh màn hình, workbook đang vận hành theo logic này:

- luôn có **bộ lọc thời gian**: tháng, tuần, ngày, kỳ
- luôn có **bộ lọc nghiệp vụ**: lớp, mã lớp, tên lớp, tình trạng học, tình trạng test, loại thu chi, vị trí nhân sự...
- cùng một dữ liệu gốc nhưng nhìn theo nhiều lát cắt khác nhau
- khi mở lại tháng cũ thì người dùng kỳ vọng thấy đúng số của thời điểm đó
- nhiều sheet là **bảng chi tiết**
- nhiều sheet là **bảng tổng hợp / pivot**
- cuối cùng phải **xuất Excel** ra đúng ngữ cảnh lọc đang xem

Web muốn thay Excel thì không chỉ cần “trang báo cáo”, mà cần:

- bộ lọc chuẩn hóa
- kỳ dữ liệu chuẩn hóa
- snapshot chuẩn hóa
- export chuẩn hóa

---

## 3. Phân loại 12 nhóm báo cáo theo bản chất dữ liệu

### 3.1. Nhóm cần chốt kỳ mạnh

Đây là các màn mà xem tháng cũ phải ra đúng số cũ:

1. **Report công lương**
2. **Report học phí**
3. **Theo dõi học phí**
4. **Thu chi**
5. **Xuất nhập sách**
6. **Nhân sự** (nếu cần xem trạng thái tại thời điểm cũ)

Nhóm này phải có snapshot hoặc bản ghi khóa sổ theo kỳ.

### 3.2. Nhóm thiên về lịch sử sự kiện, có thể query lại trực tiếp

1. **Chi tiết lớp học**
2. **DS test**
3. **Danh sách học viên**
4. **Danh sách lớp**
5. **Phụ lục / danh mục**
6. **Nhắc việc / theo dõi lớp**

Nhóm này có thể đọc từ transaction/event log nếu dữ liệu đã lưu đúng ngày phát sinh.
Tuy nhiên vẫn nên có snapshot tổng hợp nếu muốn mở nhanh như Excel.

---

## 4. Mô hình dữ liệu hợp lý nhất

## 4.1. Tầng 1 — transaction tables

Đây là dữ liệu gốc đang có và vẫn phải giữ:

- `Student`, `Lead`, `Class`, `Enrollment`
- `ClassSession`, `SessionAssignment`, `StudentAttendance`
- `TimesheetEntry`, `TimesheetPeriod`
- `BillingPeriod`, `Charge`, `Payment`, `PaymentAllocation`, `Refund`
- `Book`, `StockTransaction`, `BookIssue`
- `CashTransaction`, `TransactionCategory`
- `PayrollRun`, `PayrollLine`

Đây là lớp “sự thật nghiệp vụ”.

## 4.2. Tầng 2 — reporting period

Cần thêm **một khái niệm kỳ báo cáo chung** để các module nói cùng một ngôn ngữ thời gian:

- `ReportingPeriod`
  - `id`
  - `branchId`
  - `periodType` = `DAY | WEEK | MONTH | PAYROLL | CUSTOM`
  - `periodKey` = ví dụ `2026-07`, `2026-W31`, `2026-07-30`
  - `startDate`
  - `endDate`
  - `status` = `OPEN | SNAPSHOT_READY | LOCKED | REOPENED`
  - `closedAt`
  - `closedById`

Mục tiêu:

- tất cả màn báo cáo đều chọn được cùng một “kỳ”
- không để mỗi module tự hiểu tháng/tuần một kiểu

## 4.3. Tầng 3 — report snapshot

Cần thêm lớp snapshot để lưu kết quả đã chốt:

- `ReportSnapshot`
  - `id`
  - `branchId`
  - `reportCode`
  - `periodId`
  - `filterHash`
  - `filterJson`
  - `asOfAt`
  - `status`
  - `summaryJson`
  - `detailJson`
  - `rowCount`
  - `createdAt`
  - `createdById`

Trong đó:

- `reportCode` ví dụ:
  - `PAYROLL_SUMMARY`
  - `STUDENT_SUMMARY`
  - `TUITION_SUMMARY`
  - `CLASS_JOURNAL_DETAIL`
  - `LEAD_TEST_LIST`
  - `STUDENT_DIRECTORY`
  - `TUITION_TRACKING`
  - `BOOK_STOCK`
  - `CASHBOOK`
  - `CLASS_DIRECTORY`
  - `HR_DIRECTORY`
  - `APPENDIX`

- `filterHash` để phân biệt snapshot theo cùng report nhưng bộ lọc khác nhau
- `summaryJson` lưu số tổng hợp
- `detailJson` lưu bảng chi tiết đã render đúng thời điểm đó

=> Cách này rất hợp với Excel, vì Excel thực chất cũng là một “ảnh chụp dữ liệu sau tính toán”.

---

## 5. Khi nào dùng bảng chuẩn, khi nào dùng JSON snapshot

## 5.1. Dùng bảng chuẩn đã có

Nếu module đã có “kỳ khóa sổ” rõ ràng thì ưu tiên dùng luôn:

- công lương → `PayrollRun`, `PayrollLine`
- học phí tháng → `BillingPeriod`, `Charge`, `PaymentAllocation`
- chấm công hành chính → `TimesheetPeriod`, `TimesheetEntry`

Đây đã là snapshot nghiệp vụ cấp 1 rồi.

## 5.2. Dùng `ReportSnapshot`

Dùng cho các trường hợp:

- báo cáo tổng hợp nhiều module
- cần mở lại đúng giao diện cũ theo bộ lọc cũ
- cần export lại y hệt lần trước
- cần cache để mở nhanh
- cần “đóng băng” số liệu manager đã xem/chốt

Kết luận:

- **Payroll / Tuition / Timesheet**: lấy từ bảng chuẩn nghiệp vụ trước
- **Các report hiển thị/pivot/export**: lưu thêm `ReportSnapshot`

---

## 6. Luồng vận hành chuẩn

## 6.1. Luồng live hằng ngày

Người dùng nhập:

- học viên mới
- test đầu vào
- lớp học
- điểm danh
- học phí
- xuất nhập sách
- thu chi
- nhân sự

Web luôn ghi vào transaction tables.

## 6.2. Luồng đóng kỳ

Ví dụ cuối tháng 2026-07:

1. khóa/chốt:
   - `BillingPeriod`
   - `TimesheetPeriod`
   - `PayrollRun`
2. chạy job snapshot:
   - report học sinh tháng
   - report học phí tháng
   - report công lương tháng
   - report thu chi tháng
   - report sách tháng
3. lưu vào `ReportSnapshot`

Khi đó:

- xem “tháng 2026-07” thì ưu tiên đọc snapshot
- xem “hôm nay / hiện tại” thì đọc live

---

## 7. Cách web nên hiển thị để giống Excel nhưng mạnh hơn

Mỗi màn báo cáo nên có đúng 3 chế độ:

1. **Hiện tại**
   - đọc live
   - thay đổi theo dữ liệu mới nhất

2. **Theo kỳ đã chốt**
   - chọn tháng/tuần/kỳ
   - đọc snapshot hoặc dữ liệu khóa sổ

3. **Xuất Excel**
   - export đúng dữ liệu đang xem
   - nếu đang xem snapshot thì export snapshot
   - nếu đang xem live thì export live

UI chuẩn nên có:

- bộ lọc thời gian chung
- bộ lọc nghiệp vụ riêng từng màn
- nhãn rõ:
  - `Đang xem dữ liệu hiện tại`
  - `Đang xem dữ liệu chốt kỳ 2026-07`

---

## 8. Mapping cụ thể 12 ảnh Excel → web

## 8.1. Ảnh 1 — Report công lương

Nguồn đúng:

- `SessionAssignment`
- `TimesheetEntry`
- `PayrollRun`
- `PayrollLine`

Cách làm đúng:

- live: xem công tạm tính theo tháng chưa chốt
- locked: xem theo `PayrollRun`
- export: từ `PayrollLine` + `ReportSnapshot(PAYROLL_SUMMARY)`

## 8.2. Ảnh 2 — Report học sinh

Nguồn đúng:

- `Student`
- `Enrollment`
- `EnrollmentStatusHistory`
- `Class`

Cách làm đúng:

- live: thống kê hiện tại
- historical: snapshot theo tháng/tuần
- cần lưu được:
  - số đang học
  - số nghỉ
  - số nhập học
  - lý do nghỉ
  - theo lớp

## 8.3. Ảnh 3 — Report học phí

Nguồn đúng:

- `BillingPeriod`
- `Charge`
- `Payment`
- `PaymentAllocation`
- `BookIssue`

Cách làm đúng:

- tháng đã chốt: đọc `BillingPeriod`
- tổng hợp UI: có thể cache bằng `ReportSnapshot(TUITION_SUMMARY)`

## 8.4. Ảnh 4 — Chi tiết lớp học

Nguồn đúng:

- `ClassSession`
- `SessionAssignment`
- `StudentAttendance`
- `ClassSessionJournal`

Cách làm đúng:

- đọc transaction trực tiếp theo ngày/tháng/lớp
- nếu muốn mở rất nhanh theo tháng cũ thì tạo snapshot detail theo lớp

## 8.5. Ảnh 5 — DS test

Nguồn đúng:

- `Lead`
- `Guardian`
- `Appointment`
- `LeadInteraction`

Cách làm đúng:

- query trực tiếp được
- thêm snapshot nếu cần chốt pipeline tuyển sinh theo tháng

## 8.6. Ảnh 6 — Danh sách học viên

Nguồn đúng:

- `Student`
- `Enrollment`
- `Scholarship`
- `Adjustment`

Cách làm đúng:

- live list + filter mạnh
- snapshot tháng nếu muốn xem “danh sách học viên của tháng đó”

## 8.7. Ảnh 7 — Theo dõi học phí

Nguồn đúng:

- `Charge`
- `Payment`
- `PaymentAllocation`
- `Refund`
- `CreditBalance`

Đây là report rất quan trọng, phải xem được:

- tháng hiện tại
- tháng cũ
- dòng chi tiết từng học viên
- tồn đầu
- phát sinh
- đã nộp
- còn lại

=> nên có cả:

- dữ liệu chuẩn từ `BillingPeriod`
- snapshot `TUITION_TRACKING`

## 8.8. Ảnh 8 — Xuất nhập sách

Nguồn đúng:

- `StockTransaction`
- `BookIssue`
- `Book`

Cách làm đúng:

- live stock = tồn hiện tại
- historical stock = snapshot cuối kỳ hoặc tồn tính tới thời điểm

Khuyến nghị:

- cuối mỗi tháng lưu snapshot tồn sách theo mã sách

## 8.9. Ảnh 9 — Thu chi

Nguồn đúng:

- `CashTransaction`
- `TransactionCategory`
- `PaymentCashPosting`
- `RefundCashPosting`
- `StockCashPosting`

Cách làm đúng:

- live: sổ quỹ hiện tại
- historical: xem theo tháng/tuần
- nên snapshot tổng hợp thu/chi theo loại vào cuối kỳ

## 8.10. Ảnh 10 — Danh sách lớp

Nguồn đúng:

- `Class`
- `Course`
- `Enrollment`

Cách làm đúng:

- chủ yếu query live
- có thể snapshot monthly để xem sĩ số/lịch sử lớp theo kỳ

## 8.11. Ảnh 11 — Nhân sự

Nguồn đúng:

- `Employee`
- `EmploymentContract`
- `PayPolicy`

Cách làm đúng:

- live: nhân sự hiện tại
- historical: xem trạng thái nhân sự tại một tháng
- nếu cần chuẩn Excel thì snapshot nhân sự theo tháng

## 8.12. Ảnh 12 — Phụ lục

Nguồn đúng:

- bảng danh mục / master data:
  - `Course`
  - `Class`
  - `TransactionCategory`
  - khung giờ
  - loại thu chi
  - mapping weekday

Cách làm đúng:

- đa phần là master data
- nếu phụ lục có tác động báo cáo lịch sử thì lưu version của danh mục

---

## 9. Thiết kế API hợp lý nhất

Mỗi report nên có 1 API chuẩn:

- `GET /api/reports/{code}`

Query chung:

- `mode=live|snapshot`
- `periodKey=2026-07`
- `branchId=...`
- các filter riêng từng report

Response chuẩn:

- `meta`
  - `mode`
  - `periodKey`
  - `snapshotId`
  - `generatedAt`
  - `filters`
- `summary`
- `rows`

Export:

- `GET /api/reports/{code}/export?...`

Nếu `mode=snapshot` thì export từ snapshot.  
Nếu `mode=live` thì export từ dữ liệu live hiện tại.

---

## 10. Thiết kế UI hợp lý nhất

Mỗi màn báo cáo nên thống nhất:

- vùng filter trên cùng
- chọn:
  - `Hiện tại`
  - `Kỳ đã chốt`
- nếu chọn `Kỳ đã chốt` thì hiện:
  - tháng
  - tuần
  - ngày
  - kỳ lương
  - tùy report
- nút:
  - `Xem dữ liệu`
  - `Xuất Excel`
  - `Tạo snapshot`
  - `Chốt kỳ`

Điểm ăn tiền hơn Excel:

- xem nhanh
- lọc nhiều điều kiện
- không hỏng công thức
- không mất lịch sử
- ai cũng xem cùng một nguồn đúng

---

## 11. Thứ tự nâng cấp nên làm

Không nên làm cả 12 màn cùng lúc.  
Nên làm theo 3 đợt:

### Đợt 1 — nền snapshot chung

1. thêm `ReportingPeriod`
2. thêm `ReportSnapshot`
3. chuẩn hóa filter time range dùng chung
4. chuẩn hóa export service dùng chung

### Đợt 2 — 5 màn quan trọng nhất

1. công lương
2. học phí tổng hợp
3. theo dõi học phí
4. thu chi
5. report học sinh

### Đợt 3 — phần còn lại

1. chi tiết lớp học
2. ds test
3. danh sách học viên
4. xuất nhập sách
5. danh sách lớp
6. nhân sự
7. phụ lục

---

## 12. Chốt kỹ thuật

### Điều nên giữ

- các bảng nghiệp vụ hiện tại
- `BillingPeriod`
- `TimesheetPeriod`
- `PayrollRun`

### Điều cần bổ sung

- `ReportingPeriod`
- `ReportSnapshot`
- service dựng report theo `mode=live|snapshot`
- export service thống nhất

### Điều không nên làm

- không chỉ render report từ dữ liệu live
- không chỉ xuất Excel từ UI table hiện tại
- không để mỗi module tự nghĩ ra cách hiểu “tháng cũ”
- không sửa số report bằng tay ngoài luồng khóa sổ

---

## 13. Kết luận cuối

Mô hình hợp lý nhất cho web của trung tâm là:

**Nhập liệu live hằng ngày → chốt kỳ nghiệp vụ → sinh snapshot báo cáo → xem lại lịch sử và export đúng snapshot**

Đây là cách gần Excel nhất về trải nghiệm quản lý, nhưng mạnh hơn Excel ở 4 điểm:

1. không vỡ công thức
2. không mất lịch sử
3. xem lại tháng cũ đúng số cũ
4. xuất báo cáo nhất quán từ cùng một nguồn dữ liệu

## 14. Bước triển khai tiếp theo

Bước mạnh nhất tiếp theo là:

1. thêm schema `ReportingPeriod` + `ReportSnapshot`
2. làm trước report:
   - công lương
   - học phí
   - thu chi
   - học sinh
3. thêm UI chọn:
   - `Hiện tại`
   - `Kỳ đã chốt`

Sau bước đó, web sẽ bắt đầu có đúng năng lực mà file Excel của anh đang có:  
**vừa nhập dữ liệu mới, vừa mở lại dữ liệu cũ theo đúng từng vấn đề và từng thời điểm.**
