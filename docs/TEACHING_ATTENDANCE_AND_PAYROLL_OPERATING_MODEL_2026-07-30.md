# Mô hình vận hành chấm công giảng dạy & payroll

Ngày chốt: 2026-07-30

## 1. Kết luận chốt

Hệ thống chốt theo mô hình 2 lớp:

1. **Công dạy theo buổi**  
   Dùng cho `Giáo viên / Trợ giảng / Trợ giảng 2`, lấy từ:
   - `ClassSession`
   - `SessionAssignment`

2. **Công ngày hành chính**  
   Dùng cho `Nhân sự văn phòng`, hoặc trường hợp cần chấm theo sáng/chiều, lấy từ:
   - `TimesheetEntry`
   - `TimesheetPeriod`

Không dùng `TimesheetEntry` làm nguồn công dạy chính cho giáo viên đứng lớp.

---

## 2. Nguyên tắc nghiệp vụ

### 2.1. Giáo viên / trợ giảng

- Không chấm công dạy bằng form sáng/chiều thủ công mỗi ngày.
- Công dạy phát sinh từ **buổi học đã được phân công**.
- Mỗi buổi có thể có:
  - `TEACHER`
  - `ASSISTANT`
  - `ASSISTANT2`
- Giờ công và tiền công được snapshot ngay tại lúc phân công buổi.
- Nếu thực tế lệch giờ thì chỉnh bằng:
  - `deductedHours`
  - `addedHours`
  - `adjustmentNote`

### 2.2. Nhân sự hành chính / văn phòng

- Chấm công theo ngày:
  - đến sáng
  - về sáng
  - đến chiều
  - về chiều
- Hệ thống tự tính:
  - `hours`
  - `days`

### 2.3. Quản lý

- Quản lý chịu trách nhiệm:
  - tạo lịch lớp / buổi học
  - phân công giáo viên / trợ giảng
  - xử lý ngoại lệ
  - khóa kỳ công / kỳ lương
- Quản lý không phải nhập công thay toàn bộ giáo viên nếu không có ngoại lệ.

---

## 3. Luồng vận hành chuẩn

### Bước 1. Mở lớp và sinh buổi học

- Tạo `Class`
- Sinh các `ClassSession`
- Đây là nguồn gốc của toàn bộ công dạy

### Bước 2. Phân công người dạy cho từng buổi

- Quản lý vào trang buổi học
- Tạo `SessionAssignment`
- Chọn:
  - nhân sự
  - vai trò dạy
- Hệ thống snapshot:
  - `hours`
  - `hourlyRate`
  - `amount`

### Bước 3. Vận hành buổi học

Trong buổi học, giáo viên / trợ giảng thực hiện:

- điểm danh học viên
- ghi nhật ký lớp

Nếu có phát sinh thực tế:

- đi muộn
- về sớm
- dạy thêm
- dạy thay

thì quản lý hoặc người có quyền cập nhật `SessionAssignment` để điều chỉnh giờ công.

### Bước 4. Chấm công ngày hành chính

Nếu là nhân sự chấm công theo ngày:

- tạo `TimesheetEntry`
- nhập giờ sáng/chiều
- hệ thống tính `hours` và `days`

### Bước 5. Tính lương

Payroll lấy dữ liệu từ 2 nguồn:

1. `SessionAssignment`
   - giờ dạy giáo viên
   - giờ trợ giảng
   - tiền dạy / trợ giảng

2. `TimesheetEntry`
   - công ngày hành chính

---

## 4. Trách nhiệm theo vai trò

### Giáo viên / trợ giảng

- Xem buổi mình được phân công
- Dạy buổi đã được giao
- Điểm danh học viên
- Ghi nhật ký lớp
- Không dùng luồng chấm công ngày làm nguồn công dạy

### Quản lý đào tạo / giáo vụ / quản lý cơ sở

- Tạo lịch học
- Phân công GV/TG
- Điều chỉnh công dạy nếu có ngoại lệ
- Giữ tính đúng của dữ liệu buổi học

### HR / Payroll / Kế toán

- Theo dõi `TimesheetEntry`
- Chạy kỳ lương
- Rà soát chênh lệch công / tiền

---

## 5. Quy tắc chốt để không lệch hệ thống

### Quy tắc 1

`SessionAssignment` là **nguồn công dạy chính thức**.

### Quy tắc 2

`TimesheetEntry` là **nguồn công ngày hành chính**, không thay thế `SessionAssignment`.

### Quy tắc 3

Không bắt giáo viên đã được phân công buổi học phải nhập lại công dạy bằng check-in sáng/chiều, trừ khi trung tâm có quy trình kép đặc biệt.

### Quy tắc 4

Điều chỉnh thực tế của ca dạy phải nằm ở:

- `deductedHours`
- `addedHours`
- `adjustmentNote`

không sửa tay trực tiếp vào số tiền đã chốt nếu chưa có lý do rõ ràng.

### Quy tắc 5

Tính lương luôn tổng hợp từ:

- `SessionAssignment`
- `TimesheetEntry`

không lấy dữ liệu trực tiếp từ Excel nhập tay.

---

## 6. Cách làm “mượt” nhất cho vận hành

Để hệ thống chạy nhẹ cho cả giáo viên và quản lý:

### Với giáo viên

- Chỉ cần thấy danh sách buổi được phân công
- Vào buổi đó để:
  - điểm danh
  - ghi nhật ký
- Không nhập công dạy lặp lại nhiều lần

### Với quản lý

- Chỉ quản lý phân công và ngoại lệ
- Không phải nhập từng dòng công thay giáo viên

### Với payroll

- Dữ liệu công dạy và công ngày tách riêng
- Tính lương rõ, dễ kiểm tra

---

## 7. Mô hình chuẩn cuối cùng

```text
Class
→ ClassSession
→ SessionAssignment
   → TEACHER / ASSISTANT / ASSISTANT2
   → hours / hourlyRate / amount
   → deductedHours / addedHours / adjustmentNote
→ StudentAttendance
→ ClassSessionJournal

Employee
→ TimesheetEntry
→ TimesheetPeriod

PayrollRun
→ lấy SessionAssignment + TimesheetEntry
→ sinh PayrollLine
```

---

## 8. Quyết định triển khai

Từ ngày 2026-07-30, dự án chốt theo mô hình:

- **Giáo viên chấm công theo buổi dạy**
- **Nhân sự hành chính chấm công theo ngày**
- **Quản lý chỉ xử lý phân công và ngoại lệ**
- **Payroll lấy dữ liệu từ DB, không lấy lại từ bảng Excel thủ công**

Đây là mô hình chuẩn chính thức để tiếp tục:

- thiết kế UI
- viết API
- đồng bộ database
- tính lương
- đối chiếu workbook
