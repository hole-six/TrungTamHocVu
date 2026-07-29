# ERP Workbook Blueprint

## 1. Phạm vi

- Nguồn phân tích chính là `docs/File Quan ly tong 2026.xlsx`.
- Nguồn hỗ trợ là `docs/Data_Dictionary_Excel.csv`, `docs/Formula_Catalog.csv`, `docs/Sheet_Dependencies.csv`, `docs/00_Master_Specification_V2.md`.
- Mục tiêu của tài liệu này là bóc workbook thành một mô hình ERP có thể triển khai web/app/database, đồng thời giữ đúng quan hệ dữ liệu hiện có trong Excel.

## 2. Kết luận nhanh

- Workbook này là một ERP mini cho trung tâm đào tạo, không phải chỉ là một file báo cáo.
- Trục dữ liệu lõi là:
  - `DSTest` -> tuyển sinh/lead.
  - `DSHV` -> master học viên.
  - `DSLop` + `ChiTietLopHoc` -> vận hành lớp, lịch dạy, chấm công.
  - `TheoDoiHP` -> công nợ học phí theo tháng.
  - `XuatNhapSach` -> kho giáo trình.
  - `Thu-Chi` -> sổ quỹ tiền mặt.
  - `NhanSu` -> master nhân sự, đơn giá lương.
- Các sheet `Report_*`, `SinhNhatHV`, `Home` chủ yếu là điều hướng/pivot/report, không phải nguồn dữ liệu gốc.

## 3. Phân loại sheet theo module ERP

| Module ERP | Sheet/Table nguồn | Vai trò trong workbook | Entity chuẩn hoá đề xuất |
| --- | --- | --- | --- |
| Điều hướng | `Home/Table19` | Mục lục sheet | `system_navigation` |
| Lookup/Master | `MucLuc/Table1-3` | Khung giờ, loại lớp, học phí/buổi, số buổi/tuần, thứ | `lookup_time_slot`, `lookup_program`, `lookup_weekday` |
| CRM/Tuyển sinh | `DSTest/T_DSTest` | Lead, học sinh test, phụ huynh, lịch test, trạng thái nhập học | `lead`, `guardian`, `placement_test` |
| Học viên | `DSHV/T_HV` | Master học viên sau khi nhập lớp | `student`, `student_enrollment`, `student_status_snapshot` |
| Quản lý lớp | `DSLop/T_DSLop` | Danh sách lớp đang mở, buổi học, tiến độ, nhắc việc | `class`, `class_task_rule` |
| Vận hành lớp | `ChiTietLopHoc/T_ChiTietLop` | Nhật ký từng buổi học, giáo viên, trợ giảng, giờ công | `class_session`, `teaching_assignment`, `timesheet_entry` |
| Học phí | `TheoDoiHP/T_HP` | Học phí theo tháng, carry-forward, giáo trình, trạng thái thanh toán | `tuition_ledger`, `tuition_charge`, `tuition_payment`, `student_balance` |
| Kho giáo trình | `XuatNhapSach/T_SachTon/T_SachNhap/T_SachXuat` | Nhập kho, xuất kho, tồn kho, tiền giáo trình | `inventory_item`, `inventory_receipt`, `inventory_issue`, `inventory_balance` |
| Thu chi | `Thu-Chi/T_Thu/T_Chi/T_PhanLoai` | Sổ quỹ tiền mặt, phân loại thu chi | `cash_receipt`, `cash_payment`, `cash_category` |
| Nhân sự | `NhanSu/T_NS` | Hồ sơ nhân sự, tên ngắn, lương giờ, hợp đồng | `employee`, `employee_contract`, `pay_rate` |
| Báo cáo | `Report_Cong_Luong`, `Report_HS`, `Report_HP`, `SinhNhatHV` | Pivot/report quản trị | `report_materialization` |

## 4. Thực thể chuẩn hoá và nguồn gốc

### 4.1 `lead`

- Nguồn: `DSTest/T_DSTest`.
- Bản chất: đầu mối tuyển sinh trước khi chính thức trở thành học viên.
- Trường lõi xác nhận từ Excel:
  - `NgayGap`, `HoTenHV`, `GioiTinh`, `DoB`, `HoTenPH`, `Sdt`, `DiaChiNha`
  - `NgayTest`, `Tình trạng test`, `TenLop`
  - `Ngày dự kiến đi học`, `Ngày nhập học`
  - `MaSo`, `GhiChu`, `GhiChu2`
- Trường tính toán:
  - `tuoi`, `LopHoc`, `Tình trạng cần liên hệ`, `TenHV&MaSo`, `TinhTrangHoc`, `Tình trạng nhập DSHV`, `Tuần ĐK`, `Tháng ĐK`, `Ten&Sdt`.
- Khóa nghiệp vụ ứng viên:
  - Ưu tiên `MaSo`.
  - Dự phòng `TenHV&MaSo`.
  - Không nên dùng riêng `HoTenHV`.

### 4.2 `guardian`

- Nguồn suy ra từ `DSTest`.
- Workbook chưa tách entity riêng, nhưng `HoTenPH`, `Sdt`, `DiaChiNha` cho thấy phụ huynh đã tồn tại ngầm trong nghiệp vụ.
- Nên chuẩn hoá thành bảng riêng để một phụ huynh có thể gắn nhiều học viên.

### 4.3 `student`

- Nguồn gốc chính: `DSHV/T_HV`.
- `DSHV` là master record của học viên sau khi chuyển từ lead sang đang học/nghỉ học.
- Trường lõi:
  - `MaLop`, `TenLop`, `TenHV`
  - `Ngay nhap`, `Ngay nghi`, `Lí do nghỉ`
  - `DanhGia`, `MaSo`, `MaHV`
  - `Tình trạng học`, `Sđt`, `Ho ten`
- Trường tài chính và học tập dẫn xuất:
  - `HP tồn`, `HocPhi/Buoi`
  - `Tháng sinh nhật`
  - Ma trận buổi học theo tháng `1..12`
  - Ma trận doanh thu theo tháng `T1..T24` trong công thức.
- `DSHV` tham chiếu mạnh tới:
  - `DSTest` để kéo `MaSo`, `Sđt`, thông tin nền.
  - `TheoDoiHP` để cộng `HP tồn`.
  - `DSLop` để lấy `HocPhi/Buoi`.
  - `ChiTietLopHoc` để đếm số buổi theo tháng.

### 4.4 `class`

- Nguồn: `DSLop/T_DSLop`.
- Đây là lớp đang vận hành, không chỉ là template.
- Trường lõi:
  - `MaLop`, `Lop`, `Ten lop`
  - `SLBuoiHoc`, `NgayBD`, `NgayKTDuKien`, `Buoi so`
  - `So buoi nghi`, `SL buổi học tới hiện tại`, `Con lai`
  - `GhiChu`
- Thuộc tính lịch và nhắc việc:
  - `Ngay CĐ`, `Thu`, `Cong viec`, `Ngay phat sinh`, `Cong viec PS`.
- Trường suy ra từ `MucLuc/Table2`:
  - `BuoiHoc/Tuan`
  - `HocPhi/Buoi`
- Trường suy ra từ dữ liệu vận hành:
  - `SLHVNow` từ `DSHV`
  - `So buoi nghi`, `Column4` từ `ChiTietLopHoc`.

### 4.5 `class_session`

- Nguồn: `ChiTietLopHoc/T_ChiTietLop`.
- Đây là bảng vận hành quan trọng nhất vì nó là “sự kiện nghiệp vụ” của từng buổi.
- Trường lõi:
  - `Ngay thang`, `TenThu`, `ThoiGian`
  - `MaLop`, `TenLop`
  - `Giáo viên`, `Trợ giảng`, `Trợ giảng 2`
  - `Buoi so`, `TTHoc`, `GhiChu`, `Ngay HT`
- Trường tác vụ:
  - `Nhac viec 1`, `Nhac viec 2`, `Phat sinh`, `Ket qua`.
- Trường chấm công/lương:
  - `So_Gio`, `So_gio_GV`, `Luongh_GV`, `Ca_Gio`, `Tien_GV`
  - `So_gio_TG`, `Luongh_TG`, `Tien_TG`
  - `Gio NV`, `Cong NV`
- Trường phân tích:
  - `Tháng`, `Tuần`, `HomNay`, `Time và buoi`, `Thu&Buoi&Lop`.

### 4.6 `employee`

- Nguồn: `NhanSu/T_NS`.
- Trường lõi:
  - `Mã NV`, `Họ và tên`, `Tên ngắn`, `Ngày sinh`, `Vị trí`
  - `SĐT`, `Mail`, `Quê quán`, `Địa chỉ thường trú`
  - `Số CMT`, `Ngày cấp`, `Nơi cấp`
  - `Ngày ký HĐ`, `Hạn HĐ`, `Ngày nghỉ`
- Trường suy ra:
  - `Tình trạng làm việc`
  - `Tháng năm nhận việc`
- `Tên ngắn` là khóa lookup đang dùng thực tế trong `ChiTietLopHoc`.

### 4.7 `tuition_ledger`

- Nguồn: `TheoDoiHP/T_HP`.
- Bản chất: sổ công nợ học phí theo học viên-tháng.
- Grain tốt nhất khi chuẩn hoá: `1 student + 1 billing_month + 1 class enrollment context`.
- Trường lõi:
  - `MaLop`, `TenLop`, `Ten HV`, `HP Tháng`
  - `Buoi tru`, `HP dau ky`, `HB dieu chinh`
  - `HP thang hien tai`, `TienGiaoTrinh`, `TongHP`
  - `TienNop`, `Con lai`, `HP ton thang truoc`
  - `NgayNopTien`, `HinhThucTT`, `Người nhận`, `GhiChu`
  - `Tình trạng đóng học phí`, `Ten&Sdt`, `MaSo`, `TT học`
- Trường suy ra nghiệp vụ:
  - `ĐG`, `So buoi`, `Buoi nghi`, `Hoc bong`
  - `Số buổi (1)/(2)`, `Học phí (1)/(2)`, `Cộng dồn`.

### 4.8 `inventory_item`, `inventory_receipt`, `inventory_issue`

- Nguồn: `XuatNhapSach`.
- `T_SachTon` -> số dư/tồn kho theo sách.
- `T_SachNhap` -> phiếu nhập kho.
- `T_SachXuat` -> phiếu xuất giáo trình cho học viên/lớp.
- Trường lõi nổi bật:
  - Tồn kho: `MaLop`, `TenSach`, `DonGia`, `Số Lượng`
  - Nhập kho: `Ngày tháng`, `Malop`, `TenSach`, `SL nhập`, `Người nhập`, `Người giao`, `Tổng tiền`
  - Xuất kho: gắn với `TenHV&MaHV`, `TenSach`, `SL`, `DonGia`, `TienGiaoTrinh`, `Tháng xuất`.
- Quan hệ tài chính:
  - `TheoDoiHP.TienGiaoTrinh = SUMIFS(T_SachXuat...)`.

### 4.9 `cash_receipt`, `cash_payment`, `cash_category`

- Nguồn: `Thu-Chi`.
- `T_Chi` là bút toán chi.
- `T_Thu` là bút toán thu.
- `T_PhanLoai` là danh mục phân loại.
- Trường lõi:
  - `Ngày tháng`, `Loại thu/chi`, `Chi tiết các loại`, `Diễn giải`, `Số tiền`
  - `Người thu/chi`, `Ghi chú`
  - `Tháng chi`, `Tuan chi`, `Tháng thu`, `Tuần thu`.
- Workbook chưa gắn công thức trực tiếp giữa `TheoDoiHP` và `Thu-Chi`, nhưng về ERP phải liên kết payment receipt vào cashbook.

## 5. Quan hệ dữ liệu chuẩn

### 5.1 Quan hệ xác nhận trực tiếp từ công thức

| Từ | Sang | Join/key đang dùng | Cardinality | Độ tin cậy | Mục đích |
| --- | --- | --- | --- | --- | --- |
| `DSTest` | `DSHV` | `TenHV&MaSo`, `MaSo`, `TenHV` | `1 -> 0..1` | Cao | Chuyển lead thành học viên |
| `DSHV` | `DSLop` | `TenLop`, `MaLop` | `n -> 1` | Cao | Gán học viên vào lớp |
| `ChiTietLopHoc` | `DSLop` | `TenLop`, `MaLop` | `n -> 1` | Cao | Gắn buổi học vào lớp |
| `ChiTietLopHoc` | `NhanSu` | `Giáo viên = Tên ngắn`, `Trợ giảng = Tên ngắn` | `n -> 1` | Cao | Tính lương giờ |
| `ChiTietLopHoc` | `DSHV` | `TenLop` | `n -> n` | Trung bình | Đếm sĩ số/tenlop3 |
| `TheoDoiHP` | `DSHV` | `MaSo`, `Ten HV`, `TenHV&MaHV` | `n -> 1` | Cao | Lấy thông tin học viên, đơn giá, tình trạng |
| `TheoDoiHP` | `ChiTietLopHoc` | `TenLop + Tháng + TTHoc` | `n -> n` | Cao | Tính buổi nghỉ, số buổi tính tiền |
| `TheoDoiHP` | `XuatNhapSach` | `TenHV&MaHV`/`Ten HV` + `HP Tháng` | `1 -> n` | Trung bình | Cộng tiền giáo trình |
| `XuatNhapSach/T_SachXuat` | `T_SachTon` | `TenSach` | `n -> 1` | Cao | Lấy đơn giá/tồn kho |
| `XuatNhapSach/T_SachTon` | `T_SachNhap` | `TenSach + Tháng nhập` | `1 -> n` | Cao | Tính tồn theo nhập |
| `XuatNhapSach/T_SachTon` | `T_SachXuat` | `TenSach + Tháng xuất` | `1 -> n` | Cao | Tính tồn theo xuất |
| `DSLop` | `MucLuc/Table2` | `MaLop` | `n -> 1` | Cao | Lấy học phí/buổi, số buổi/tuần |

### 5.2 Quan hệ ERP cần chuẩn hoá thêm

| Quan hệ đề xuất | Lý do |
| --- | --- |
| `guardian 1-n lead` | Một phụ huynh có thể có nhiều con |
| `guardian 1-n student` | Sau chuyển đổi cần giữ lịch sử phụ huynh |
| `student 1-n tuition_payment` | `TienNop` đang bị nhét vào ledger tháng, nên tách payment event |
| `tuition_payment 1-1 cash_receipt` | Đồng bộ học phí với sổ quỹ |
| `inventory_receipt/cash_payment` | Mỗi nhập giáo trình nên có phiếu chi tương ứng |
| `class_session 1-n attendance_student` | Workbook chưa có điểm danh học viên từng buổi, ERP nên thêm |
| `employee 1-n payroll_entry` | Tách bảng lương khỏi session để chốt theo kỳ |

## 6. Khóa dữ liệu chuẩn hoá

### 6.1 Khóa nên giữ nguyên vì đang dùng thực tế

- `MaSo`: khóa học viên/lead quan trọng nhất.
- `TenHV&MaSo`: khóa ghép đang được workbook dùng nhiều lần.
- `TenHV&MaHV`: khóa ghép dùng ở lớp/học phí/sách.
- `MaLop`: mã loại lớp/chương trình.
- `TenLop`: mã lớp đang vận hành theo workbook.
- `Tên ngắn`: khóa nhân sự dùng cho tính lương.
- `TenSach`: khóa sách đang được dùng xuyên bảng.

### 6.2 Khóa ERP nên bổ sung

- `branch_id`: workbook đang ngầm một cơ sở; web ERP cần hỗ trợ đa cơ sở.
- `lead_id`, `student_id`, `class_id`, `session_id`, `employee_id`, `payment_id`: surrogate key để bỏ phụ thuộc vào text key.
- `billing_period` chuẩn kiểu `YYYY-MM`.
- `inventory_item_id` thay cho chỉ dùng `TenSach`.

## 7. Luồng nghiệp vụ end-to-end

### 7.1 Tuyển sinh -> nhập học

1. Tạo lead trong `DSTest`.
2. Chốt test, gán lớp dự kiến, sinh `MaSo`.
3. Khi nhập học, đẩy lead sang `DSHV`.
4. `DSHV` kéo ngược một phần dữ liệu từ `DSTest` để đồng bộ.

### 7.2 Mở lớp -> vận hành lớp

1. Tạo lớp trong `DSLop`.
2. Lấy `HocPhi/Buoi`, `BuoiHoc/Tuan` từ `MucLuc`.
3. Sinh các dòng vận hành buổi học trong `ChiTietLopHoc`.
4. Buổi học được gắn giáo viên/trợ giảng và tính giờ, lương, nhắc việc.

### 7.3 Vận hành lớp -> học phí

1. `ChiTietLopHoc` xác nhận số buổi học, buổi nghỉ.
2. `DSHV` tổng hợp số buổi theo tháng.
3. `TheoDoiHP` lấy số buổi, đơn giá, học bổng, giáo trình để tính `TongHP`, `Con lai`.

### 7.4 Xuất giáo trình -> công nợ học phí

1. Xuất sách tại `T_SachXuat`.
2. `T_SachXuat` lookup `DonGia` từ `T_SachTon`.
3. `TheoDoiHP` cộng `TienGiaoTrinh` theo học viên và tháng.

### 7.5 Thu tiền -> quỹ tiền mặt

1. Workbook hiện ghi `TienNop` trực tiếp trong `TheoDoiHP`.
2. `Thu-Chi` đang là sổ quỹ độc lập.
3. Khi lên ERP, phải biến `TienNop` thành payment event và tạo `cash_receipt` đồng thời để không lệch quỹ.

### 7.6 Vận hành lớp -> lương

1. `ChiTietLopHoc` tính `So_gio_GV`, `So_gio_TG`, `Tien_GV`, `Tien_TG`, `Cong NV`.
2. Lookup đơn giá từ `NhanSu`.
3. `Report_Cong_Luong` chỉ nên là report, không phải nơi lưu dữ liệu gốc.

## 8. Mô hình dữ liệu ERP triển khai web

### 8.1 Nhóm master

- `branches`
- `programs` (từ `MucLuc/Table2`)
- `time_slots` (từ `MucLuc/Table1`)
- `weekdays` (từ `MucLuc/Table3`)
- `employees`
- `inventory_items`
- `cash_categories`

### 8.2 Nhóm CRM & student lifecycle

- `leads`
- `guardians`
- `lead_guardians`
- `placement_tests`
- `students`
- `student_guardians`
- `student_enrollments`

### 8.3 Nhóm class operations

- `classes`
- `class_task_rules`
- `class_sessions`
- `class_session_staff`
- `student_attendance`
- `timesheet_entries`

### 8.4 Nhóm finance

- `tuition_ledgers`
- `tuition_charges`
- `tuition_payments`
- `student_balances`
- `cash_receipts`
- `cash_payments`

### 8.5 Nhóm inventory

- `inventory_receipts`
- `inventory_issues`
- `inventory_balance_snapshots`

### 8.6 Nhóm reporting

- `monthly_student_stats`
- `monthly_tuition_stats`
- `monthly_payroll_stats`
- `birthday_alerts`

## 9. Mapping sheet -> API/UI module

| Sheet nguồn | Module web nên có | Vai trò |
| --- | --- | --- |
| `DSTest` | `/leads` | CRM, test placement, conversion |
| `DSHV` | `/students` | Hồ sơ học viên, tình trạng học, công nợ |
| `DSLop` | `/classes` | Tạo lớp, tiến độ, cấu hình lớp |
| `ChiTietLopHoc` | `/class-sessions`, `/timesheets` | Nhật ký buổi học, chấm công |
| `TheoDoiHP` | `/tuition`, `/payments` | Công nợ, phiếu thu, đối soát |
| `XuatNhapSach` | `/inventory` | Nhập xuất tồn giáo trình |
| `Thu-Chi` | `/cashbook` | Sổ quỹ |
| `NhanSu` | `/employees`, `/payroll` | Nhân sự, đơn giá lương |
| `Report_*` | `/reports` | Dashboard và export |

## 10. Vấn đề dữ liệu phải xử lý trước khi migrate

### 10.1 Lỗi công thức

- `TheoDoiHP` có rất nhiều lỗi `#N/A`, `#VALUE!`, `#REF!`.
- `DSHV` lỗi ở `Sđt`, `Column2`.
- `DSLop` lỗi ở `BuoiHoc/Tuan`, `HocPhi/Buoi`.

### 10.2 Rủi ro join bằng text

- Nhiều join đang dùng `Ten HV`, `TenLop`, `Tên ngắn`.
- Đây là join yếu, dễ vỡ khi đổi tên hoặc khác dấu/cách viết.

### 10.3 Cột placeholder

- Nhiều cột dạng `Column1`, `Column2`, `Column3`, `Column4`, `Column42`.
- Cần workshop để đổi thành tên nghiệp vụ chính thức trước khi tạo schema production.

### 10.4 Lẫn master và transaction

- `DSHV` đang kiêm cả master học viên, snapshot học tập theo tháng, snapshot tài chính.
- `TheoDoiHP` đang lẫn charge, payment, balance trong cùng một record.

## 11. Quy tắc migrate chuẩn

1. Chốt dictionary tên cột placeholder.
2. Đóng băng khóa nghiệp vụ: `MaSo`, `MaHV`, `MaLop`, `TenLop`, `Tên ngắn`, `TenSach`.
3. Import master trước:
   - `MucLuc`
   - `NhanSu`
   - `DSLop`
   - `DSTest`
4. Import `DSHV`.
5. Import `ChiTietLopHoc`.
6. Rebuild tuition ledger từ `DSHV + ChiTietLopHoc + XuatNhapSach`.
7. Import `Thu-Chi` như cashbook độc lập.
8. Đối soát report với workbook.

## 12. Thứ tự build ERP nên triển khai

### Phase 1

- Students
- Leads
- Classes
- Employees
- Lookups

### Phase 2

- Class sessions
- Timesheets
- Tuition ledger
- Payments

### Phase 3

- Inventory
- Cashbook
- Payroll

### Phase 4

- Reports
- Approval workflows
- Audit log
- Multi-branch

## 13. Tài liệu đi kèm

- Bản đồ machine-readable: `docs/ERP_CANONICAL_MAP.json`
- Bảng quan hệ chuẩn hoá: `docs/ERP_RELATIONSHIP_MAP.csv`
- Field catalog gốc: `docs/Data_Dictionary_Excel.csv`
- Formula catalog gốc: `docs/Formula_Catalog.csv`

