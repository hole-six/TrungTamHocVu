# Mô hình vận hành UI / form / dashboard / phân phối dữ liệu

Ngày chốt: 2026-07-30

## 1. Kết luận chốt

Anh đang cần 4 thứ cùng lúc:

1. **Snapshot lấy ra theo logic Excel**
2. **Form nhập / sửa / lọc theo một chuẩn duy nhất**
3. **Mỗi vai trò thấy đúng menu, đúng dashboard, đúng dữ liệu**
4. **Người dùng thao tác thật nhanh nhưng số liệu trả về vẫn đúng tuyệt đối**

Mô hình hợp lý nhất không phải là “đưa nguyên Excel lên web”, mà là:

**Excel giữ vai trò định nghĩa cột, chỉ số, công thức, bộ lọc, góc nhìn báo cáo**  
**Web giữ vai trò nhập liệu chuẩn hóa, phân quyền, truy xuất nhanh, khóa sổ và snapshot**

=> Excel là **nguồn thiết kế nghiệp vụ**, web là **nguồn vận hành chính thức**.

---

## 2. Snapshot phải lấy từ Excel theo cách nào

Không nên hiểu snapshot là copy file Excel.

Snapshot đúng phải là:

- lấy **tên cột**
- lấy **ý nghĩa cột**
- lấy **logic tính**
- lấy **logic lọc**
- lấy **cấu trúc tổng hợp**

rồi chuẩn hóa thành:

- schema DB
- service tính toán
- report snapshot
- export Excel lại đúng layout cần dùng

### Công thức đúng

`Excel mẫu` → `quy tắc nghiệp vụ` → `DB chuẩn` → `snapshot chuẩn` → `UI / export`

Không đi theo chiều ngược lại:

`người dùng sửa tay trên report` → sai dữ liệu gốc

### Ý nghĩa

- Excel là mẫu chuẩn phân tích
- DB là nguồn sự thật
- Snapshot là bản chốt lịch sử
- Export là bản mang ra ngoài

---

## 3. Quy tắc vàng để không sai phạm dữ liệu

## 3.1. Chỉ nhập ở form nghiệp vụ

Người dùng chỉ được nhập/sửa ở:

- form học viên
- form test đầu vào
- form lớp
- form phân công giáo viên
- form điểm danh
- form học phí
- form xuất nhập sách
- form thu chi
- form nhân sự

Không cho nhập tay trực tiếp trên report snapshot.

## 3.2. Report chỉ để xem / lọc / export / chốt

Report không phải nơi sửa dữ liệu gốc.

Report chỉ có 4 chức năng:

- xem
- lọc
- export
- chốt snapshot

## 3.3. Một chỉ tiêu chỉ có một nguồn sinh ra

Ví dụ:

- công dạy GV/TG chỉ từ `SessionAssignment`
- công hành chính chỉ từ `TimesheetEntry`
- công nợ học phí chỉ từ `Charge/Payment/Allocation`
- tồn sách chỉ từ `StockTransaction` + `BookIssue`
- thu chi quỹ chỉ từ `CashTransaction`

Không để một số liệu lấy từ 2-3 nơi khác nhau.

## 3.4. Người nào nhập thì chỉ nhập phần của mình

Không để một quản lý phải nhập thay toàn bộ trung tâm nếu không cần.

Nguyên tắc:

- ai tạo dữ liệu thì người đó nhập
- quản lý duyệt / phân phối / kiểm tra
- báo cáo tự tổng hợp

---

## 4. Form phải thiết kế theo một chuẩn duy nhất

## 4.1. Mọi form đều theo 3 lớp

Mỗi form nên có đúng 3 phần:

1. **Thông tin bắt buộc**
2. **Thông tin mở rộng**
3. **Thông tin hệ thống tính ra**

Ví dụ form học phí:

1. bắt buộc:
   - học viên
   - lớp
   - kỳ
   - số buổi
2. mở rộng:
   - ghi chú
   - ưu đãi
3. hệ thống tính:
   - học phí tháng
   - tồn đầu
   - phải thu
   - còn lại

Người dùng không nên tự gõ vào phần hệ thống tính.

## 4.2. Form edit phải cùng layout với form create

Không nên tạo hai logic khác nhau cho tạo mới và chỉnh sửa.

Chuẩn tốt nhất:

- cùng field
- cùng validation
- cùng công thức
- cùng quyền hiển thị

Khác nhau chỉ ở:

- dữ liệu mặc định
- quyền sửa từng field

## 4.3. Filter phải chuẩn hóa toàn hệ thống

Mọi màn có filter phải dùng cùng cấu trúc:

- thời gian
- cơ sở
- lớp
- người phụ trách
- trạng thái
- từ khóa

### Bộ lọc thời gian chuẩn

Phải có thống nhất:

- hôm nay
- tuần này
- tháng này
- kỳ đã chốt
- tùy chọn từ ngày / đến ngày

### Bộ lọc từ khóa chuẩn

Một ô tìm kiếm phải tìm được đồng thời:

- mã
- tên
- số điện thoại
- tên phụ huynh
- mã lớp
- tên lớp

tùy từng module.

## 4.4. Chế độ chuyển đổi view phải ít nhưng mạnh

Mỗi màn nên có tối đa 3 dạng xem:

1. `Danh sách`
2. `Chi tiết`
3. `Tổng hợp`

Không nên có quá nhiều tab nhỏ gây loạn.

---

## 5. Menu phải tổ chức theo công việc, không theo bảng DB

Đây là chỗ rất quan trọng.

Người dùng không nghĩ theo bảng dữ liệu.  
Người dùng nghĩ theo việc họ làm.

Vì vậy menu phải theo **tác vụ**.

## 5.1. Menu chuẩn cho desktop

### Khối tuyển sinh

- Leads / DS test
- Lịch hẹn test
- Chuyển đổi sang học viên

### Khối đào tạo

- Lớp học
- Lịch học
- Buổi học
- Điểm danh
- Nhật ký lớp

### Khối học viên

- Danh sách học viên
- Theo dõi học phí
- Hồ sơ phụ huynh

### Khối vận hành

- Thu chi
- Sách / giáo trình
- Tài sản
- Nhắc việc

### Khối nhân sự

- Nhân sự
- Chấm công ngày
- Công giảng dạy
- Lương

### Khối điều hành

- Dashboard
- Báo cáo
- Snapshot / chốt kỳ
- Phân quyền

## 5.2. Menu chuẩn cho mobile

Mobile không nên bê nguyên menu desktop.

Mobile chỉ nên có 5 nút chính:

1. `Trang chủ`
2. `Việc hôm nay`
3. `Tìm nhanh`
4. `Thông báo`
5. `Tài khoản`

Trong đó:

### `Việc hôm nay`

Hiện theo vai trò:

- giáo viên: lớp hôm nay, điểm danh, nhật ký
- trợ giảng: lớp hôm nay, điểm danh, việc được giao
- giáo vụ: lớp cần xử lý, học viên nghỉ, học phí cần theo dõi
- kế toán: phiếu thu chi, học phí, đối soát
- HR: chấm công, hợp đồng, lương

### `Tìm nhanh`

Phải search cực nhanh theo:

- tên học viên
- SĐT
- mã học viên
- mã lớp
- tên lớp
- tên giáo viên

---

## 6. Menu “Chấm công” phải tách đúng 2 luồng

Anh nói rất đúng: người ta tìm người ta chấm công phải cực nhanh.

Nhưng menu chấm công phải tách rõ:

## 6.1. Chấm công ngày

Dành cho:

- HR
- hành chính
- nhân viên văn phòng

Chức năng:

- chọn nhân sự
- check in/out sáng chiều
- xem công ngày

## 6.2. Công giảng dạy

Dành cho:

- quản lý đào tạo
- giáo vụ
- GV/TG xem phần của mình

Chức năng:

- xem buổi dạy
- xem phân công
- điều chỉnh giờ cộng/trừ
- khóa kỳ công dạy

Không trộn 2 luồng này vào một màn.

---

## 7. Giao diện điện thoại phải theo nhiệm vụ tức thời

Mobile không phải nơi làm full ERP.

Mobile phải tối ưu cho các việc cần làm ngay:

- điểm danh
- xem lớp hôm nay
- xem học viên
- tra học phí nhanh
- ghi chú nhanh
- xác nhận đã thu / đã nhận / đã xử lý

### Trên mobile không nên ưu tiên

- form quá dài
- pivot report phức tạp
- cấu hình hệ thống
- nhập dữ liệu hàng loạt

### Trên mobile nên ưu tiên

- nút lớn
- ít bước
- auto-fill
- chọn nhanh theo hôm nay / lớp của tôi / việc của tôi

---

## 8. Dashboard phải theo vai trò, không phải một dashboard chung

Đây là chỗ tạo “đỉnh cao” vận hành.

Một dashboard chung cho tất cả là sai.

## 8.1. Dashboard giám đốc / chủ trung tâm

Cần thấy:

- số học viên đang học
- số nhập học mới
- doanh thu học phí
- công nợ
- thu chi
- lương
- lớp hoạt động
- cảnh báo rủi ro

Mục tiêu:

- quyết định
- phát hiện vấn đề

## 8.2. Dashboard quản lý cơ sở / giáo vụ

Cần thấy:

- lớp hôm nay
- lớp thiếu GV/TG
- học viên nghỉ nhiều
- học phí chưa thu
- test cần theo dõi
- việc cần xử lý hôm nay

Mục tiêu:

- điều phối vận hành trong ngày

## 8.3. Dashboard kế toán

Cần thấy:

- phải thu hôm nay
- đã thu hôm nay
- công nợ quá hạn
- phiếu chi chờ duyệt
- đối soát tiền mặt
- báo cáo thu chi theo loại

Mục tiêu:

- kiểm tiền và dòng tiền

## 8.4. Dashboard HR / Payroll

Cần thấy:

- nhân sự đang làm
- hợp đồng sắp hết hạn
- chấm công thiếu
- kỳ lương đang mở
- nhân sự nghỉ việc / biến động

Mục tiêu:

- kiểm soát nhân sự và kỳ lương

## 8.5. Dashboard giáo viên

Cần thấy:

- lớp hôm nay
- lớp sắp dạy
- học viên cần lưu ý
- buổi cần điểm danh
- nhật ký cần hoàn tất
- công dạy của mình

Mục tiêu:

- dạy và hoàn thành đúng việc được giao

## 8.6. Dashboard trợ giảng

Cần thấy:

- lớp được phân công
- checklist cần làm
- đánh giá buổi học
- điểm trợ giảng / công trợ giảng

---

## 9. Phân phối dữ liệu phải theo nguyên tắc “đúng người - đúng lúc - đúng mức”

Đây là chiến lược quản lý dữ liệu tốt nhất.

## 9.1. Đúng người

Mỗi vai trò chỉ thấy dữ liệu họ cần:

- GV không cần thấy toàn bộ quỹ tiền
- kế toán không cần sửa nhật ký lớp
- HR không cần sửa điểm danh học viên

## 9.2. Đúng lúc

Dashboard và thông báo phải đẩy việc đúng thời điểm:

- đến giờ học → đẩy lớp cần điểm danh
- cuối ngày → đẩy nhật ký chưa hoàn tất
- gần cuối tháng → đẩy kỳ công/lương/học phí cần chốt

## 9.3. Đúng mức

Không phải ai nhìn thấy cũng được sửa.

Mỗi dữ liệu có 4 mức:

1. xem
2. tạo
3. sửa
4. duyệt / khóa sổ

Người vận hành nhập, quản lý duyệt, hệ thống khóa.

---

## 10. Tìm dữ liệu phải theo chiến lược nhanh nhất

Muốn thao tác nhanh thì search phải rất khỏe.

## 10.1. Ô tìm kiếm toàn cục

Nên có 1 global search trên header để tìm:

- học viên
- phụ huynh
- lead
- lớp
- giáo viên
- phiếu thu
- mã nhân sự

## 10.2. Ô tìm kiếm theo màn

Mỗi màn có search riêng, nhưng cùng nguyên tắc:

- tìm theo mã trước
- rồi tên
- rồi phone
- rồi trạng thái / tag

## 10.3. Bộ lọc saved views

Nên cho lưu bộ lọc hay dùng:

- học phí tháng này chưa đủ
- học viên nghỉ tháng này
- lớp hôm nay của tôi
- hợp đồng sắp hết hạn
- công nợ quá hạn

Đây là thứ giúp quản lý chạy rất nhanh.

---

## 11. Chiến lược đúng nhất để logic trả về chính xác

Muốn “không có sai phạm”, phải khóa ở 5 tầng:

## Tầng 1 — schema đúng

- cột nào sinh từ công thức thì không cho nhập tay
- cột nào là mã định danh phải unique
- cột nào là trạng thái phải enum rõ

## Tầng 2 — validation đúng

- kiểm tra bắt buộc
- kiểm tra format
- kiểm tra quan hệ dữ liệu
- kiểm tra trùng

## Tầng 3 — service đúng

Mọi công thức phải nằm ở service/backend, không nằm rải rác ở UI.

## Tầng 4 — permission đúng

- ai được xem
- ai được sửa
- ai được duyệt
- ai được khóa sổ

## Tầng 5 — audit đúng

Mọi sửa đổi quan trọng phải có:

- ai sửa
- sửa lúc nào
- trước là gì
- sau là gì

---

## 12. Mô hình tối ưu tiền nhất

Nếu nói thẳng về tối ưu tiền, thì đừng làm kiểu:

- một màn riêng cho từng biến thể nhỏ
- một workflow khác nhau cho từng người
- một report custom code cứng cho từng lần xem

Cách tiết kiệm nhất nhưng vẫn mạnh là:

### Một lõi dùng chung

1. form engine chung
2. filter bar chung
3. snapshot engine chung
4. export engine chung
5. permission engine chung
6. dashboard widget engine chung

### Tùy biến theo config

Khác nhau giữa vai trò chủ yếu nên là:

- menu
- quyền
- dashboard widget
- default filter
- action nhanh

Không nên khác nhau ở core logic.

---

## 13. Chốt mô hình anh nên đi

### Chốt dữ liệu

- Excel là mẫu nghiệp vụ
- DB là nguồn thật
- snapshot là lịch sử chốt

### Chốt UI

- form chuẩn hóa
- filter chuẩn hóa
- desktop theo nghiệp vụ
- mobile theo việc hôm nay

### Chốt menu

- chấm công ngày riêng
- công giảng dạy riêng
- báo cáo riêng
- snapshot / khóa kỳ riêng

### Chốt dashboard

- mỗi vai trò một dashboard riêng
- không dùng dashboard chung

### Chốt kiểm soát

- nhập ở form
- tính ở backend
- xem ở report
- duyệt ở quản lý
- khóa ở snapshot/kỳ

---

## 14. Bước mạnh nhất tiếp theo

Nếu làm tiếp ngay, bước mạnh nhất và đúng tiền nhất là:

1. chốt **bản đồ role → menu → dashboard → action nhanh**
2. chốt **chuẩn filter dùng chung toàn hệ thống**
3. thêm **schema snapshot/reporting period**
4. sau đó mới code 4 module nặng nhất:
   - công lương
   - học phí
   - thu chi
   - học viên

Làm theo thứ tự này thì:

- ít đập đi làm lại
- người dùng dễ quen
- dữ liệu chính xác
- quản lý phân phối việc rất nhanh
- và vẫn bám sát logic Excel gốc
