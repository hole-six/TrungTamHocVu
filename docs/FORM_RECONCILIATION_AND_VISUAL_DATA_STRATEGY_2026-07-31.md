# Ma tr?n d?i ch?t form + chi?n lu?c hi?n th? d? li?u tr?c quan

Ngày ch?t: 2026-07-31

## 1. M?c tiêu tài li?u

Tài li?u này ch?t 3 vi?c cùng lúc:

1. Xác d?nh các di?m giao ch?t gi?a form hi?n t?i, database và report workbook.
2. Ch? ra các di?m d? l?ch d? li?u n?u ti?p t?c v?n hành theo ki?u m?i màn t? x? lý m?t ph?n.
3. Ð? xu?t cách nâng c?p UI d? ngu?i dùng **v?a thao tác nhanh**, **v?a nhìn d? d? li?u d? d?i ch?t ngay trên màn hình**, thay vì ph?i m? nhi?u noi.

Nguyên t?c xuyên su?t:

- **DB là ngu?n s? th?t v?n hành**.
- **Workbook là m?u logic báo cáo và c?u trúc nhìn d? li?u**.
- **Form ch? du?c ghi d? li?u ngu?n**.
- **Report/snapshot ch? dùng d? xem, l?c, ch?t k?, export**.

---

## 2. K?t lu?n ch?t sau khi rà h? th?ng hi?n t?i

Hi?n t?i h? th?ng dã di dúng hu?ng v? schema và lu?ng lõi, nhung ph?n UI v?n còn 3 v?n d? l?n:

1. **Thi?u màn d?i ch?t t?p trung**
   - Ngu?i dùng ph?i di nhi?u màn d? ki?m tra m?t h?c viên/l?p/ph? huynh.
   - M?t s? màn ch? hi?n th? ít c?t nên không d? ng? c?nh d? quy?t d?nh.

2. **M?t s? nghi?p v? có nhi?u c?a vào**
   - Intake t?o enrollment theo lu?ng d?y d?.
   - Enroll nhanh t? l?p l?i di du?ng khác.
   - N?u không khóa rule chung thì d? l?ch d? li?u.

3. **Thi?u phân t?ng d? li?u hi?n th?**
   - Màn thao tác chua tách rõ:
     - d? li?u ngu?i dùng nh?p
     - d? li?u h? th?ng tính
     - d? li?u c?nh báo d?i ch?t

=> Hu?ng t?i uu nh?t không ph?i thêm th?t nhi?u form r?i, mà là:

- gi? s? màn chính v?a ph?i
- tang m?t d? d? li?u h?u ích trên t?ng màn
- thêm panel d?i ch?t ngay trong màn chi ti?t
- chu?n hóa action theo cùng m?t logic nghi?p v?

---

## 3. 6 c?m d?i ch?t b?t bu?c ph?i khóa ch?t

## 3.1. CRM / Test / Nh?p h?c

Chu?i nghi?p v?:

`Lead/Test` -> `Guardian` -> `Student` -> `Enrollment` -> `Portal account`

Ngu?n s? th?t:

- Lead / PlacementTest cho d?u vào tuy?n sinh
- Student / StudentGuardian cho h? so th?t
- Enrollment cho vi?c h?c th?t
- Guardian account cho portal và hóa don

Ði?m d?i ch?t b?t bu?c:

- M?t lead dã chuy?n d?i thì không du?c sinh h?c viên trùng logic.
- M?t h?c viên ph?i nhìn ra du?c lead g?c / mã lead n?u có.
- M?t ph? huynh có th? g?n nhi?u h?c viên, nhung hóa don ph?i rõ dang thu cho h?c viên nào.
- N?u dã nh?p h?c thì ph?i nhìn du?c:
  - l?p hi?n t?i
  - khóa h?c hi?n t?i
  - ngày b?t d?u
  - tr?ng thái h?c
  - tr?ng thái portal ph? huynh

R?i ro hi?n t?i:

- Intake dã g?p nhi?u bu?c trong m?t lu?ng, nhung h? th?ng v?n còn c?a enroll nhanh ngoài l?p.
- UI chi ti?t chua luôn hi?n th? d? quan h? lead -> guardian -> student -> enrollment.

### D? li?u t?i thi?u ph?i hi?n trên UI

**Danh sách CRM/Test**
- Mã lead
- H? tên h?c viên
- H? tên ph? huynh
- SÐT chính
- Ngu?n khách
- Ngày test / ngày d? ki?n nh?p h?c
- Tr?ng thái test
- Tr?ng thái chuy?n d?i
- C?nh báo liên h?
- Nhân viên ph? trách

**Chi ti?t h?c viên**
- Mã h?c viên
- Mã lead g?c
- Ph? huynh chính
- SÐT / email ph? huynh
- L?p dang h?c
- Khóa h?c dang h?c
- Tr?ng thái nh?p h?c
- Tình tr?ng h?c phí hi?n t?i
- Tình tr?ng portal ph? huynh
- L?n h?c g?n nh?t
- Ghi chú v?n hành quan tr?ng

---

## 3.2. L?p h?c / bu?i h?c / phân công / di?m danh / nh?t ký

Chu?i nghi?p v?:

`Class` -> `ClassSession` -> `SessionAssignment` -> `Attendance` -> `TeachingJournal`

Ngu?n s? th?t:

- Class: c?u hình l?p
- ClassSession: bu?i h?c th?c t?
- SessionAssignment: ai th?c s? d?ng l?p
- Attendance: h?c viên h?c/v?ng/bù
- TeachingJournal: n?i dung và ch?t lu?ng bu?i h?c

Ði?m d?i ch?t b?t bu?c:

- M?i bu?i h?c ph?i bi?t rõ:
  - thu?c l?p nào
  - theo l?ch nào
  - ai d?y th?c t?
  - ai tr? gi?ng th?c t?
  - h?c viên nào có m?t/v?ng
  - n?i dung nào dã d?y
- M?t bu?i chua d? assignment/journal thì không nên coi là hoàn t?t hoàn toàn.
- Công GV/TG ch? du?c l?y t? assignment th?c t? c?a bu?i, không l?y t? noi khác.

R?i ro hi?n t?i:

- Ði?m danh dang d?ng th?i dánh d?u hoàn thành bu?i, d? ch?t s?m tru?c khi nh?t ký l?p hoàn t?t.
- Assignment có di?u ch?nh gi?/ca b? tr?, nên n?u UI không hi?n rõ thì qu?n lý r?t khó d?i ch?t công luong.

### D? li?u t?i thi?u ph?i hi?n trên UI

**Danh sách bu?i h?c**
- Ngày h?c
- L?p
- Ca h?c / gi? h?c
- GV th?c t?
- TG th?c t?
- Si s? d? ki?n
- S? có m?t / v?ng / h?c bù
- Tr?ng thái journal
- Tr?ng thái hoàn t?t bu?i
- C?nh báo l?ch công

**Chi ti?t bu?i h?c**
- Header tóm t?t: l?p, mã l?p, khóa, ngày h?c, phòng, khung gi?
- Panel nhân s?: GV chính, TG1, TG2, ca b? tr?, di?u ch?nh gi?
- Panel di?m danh: s? lu?ng theo tr?ng thái + danh sách h?c viên b?t thu?ng
- Panel nh?t ký: bài d?y, homework, di?m, ghi chú ph? huynh th?y du?c
- Panel payroll preview: s? gi? tính công t?m tính cho t?ng ngu?i

---

## 3.3. H?c phí / công n? / thanh toán / s? qu?

Chu?i nghi?p v?:

`Enrollment` -> `Charge` -> `Payment` -> `Allocation` -> `CashTransaction`

Ngu?n s? th?t:

- Charge: nghia v? ph?i thu
- Payment: ti?n dã thu
- Allocation: ti?n dó gán vào kho?n nào
- CashTransaction: ghi nh?n vào s? qu?

Ði?m d?i ch?t b?t bu?c:

- M?t kho?n thu ph?i nhìn ra du?c dang thu cho:
  - ph? huynh nào
  - h?c viên nào
  - l?p nào
  - k? nào
  - charge nào
- T?ng ti?n charge, payment, allocation, cashbook ph?i di dúng m?t pipeline.
- Không du?c d? gi?m tr?/ph?t tr? ch? t?n t?i ? UI mà không ph?n ánh thành giao d?ch/di?u ch?nh chu?n.

R?i ro hi?n t?i:

- Form thanh toán dang có ph?n s? ti?n cu?i sau discount/late fee, nhung ph?i khóa r?t rõ d? li?u nào là input, d? li?u nào là k?t qu? chu?n d? luu.
- N?u v?a cho nh?p tay cashbook v?a t? d?ng post t? payment thì c?c d? ghi trùng.

### D? li?u t?i thi?u ph?i hi?n trên UI

**Danh sách theo dõi h?c phí**
- Mã h?c viên
- Tên h?c viên
- Ph? huynh chính
- L?p hi?n t?i
- K? h?c phí
- S? bu?i tính phí
- Ph?i thu k? này
- T?n d?u k?
- Ðã thu
- Còn l?i
- Tr?ng thái thu
- H?n nh?c thu

**Chi ti?t công n? h?c viên**
- Thông tin h?c viên + ph? huynh + l?p
- Dòng th?i gian charge/payment/allocation
- Công th?c ra ph?i thu k? này
- Ti?n giáo trình / ph? phí / gi?m tr? / h?c b?ng
- Hóa don dã phát hành
- L?ch s? reminder
- Liên k?t sang cash transaction dã post

---

## 3.4. Sách / giáo trình / công n? sách

Chu?i nghi?p v?:

`Book` -> `StockTransaction` -> `BookIssue` -> `Charge/Payment (n?u thu ti?n)`

Ngu?n s? th?t:

- Book + StockTransaction: t?n kho
- BookIssue: phát sách cho h?c viên
- Charge/Payment: n?u phát sinh nghia v? thu ti?n sách

Ði?m d?i ch?t b?t bu?c:

- Phát sách ph?i bi?t rõ:
  - phát cho h?c viên nào
  - thu?c l?p nào t?i th?i di?m phát
  - s? lu?ng bao nhiêu
  - có tính ti?n hay không
  - dã thu hay chua
- Không du?c d? t?n kho ch?y m?t noi, công n? sách ch?y m?t noi mà không n?i nhau.

### D? li?u t?i thi?u ph?i hi?n trên UI

**Danh sách phát sách**
- Ngày phát
- Tên sách
- H?c viên
- L?p
- S? lu?ng
- Ðon giá
- Thành ti?n
- Tình tr?ng thu ti?n
- Ngu?i giao
- Ghi chú

---

## 3.5. Nhân s? / ch?m công hành chính / công gi?ng d?y / thu?ng ph?t TG

Chu?i nghi?p v?:

`Employee` -> `TimesheetEntry` + `SessionAssignment` + `AssistantScoreEvent` -> `PayrollRun`

Ngu?n s? th?t:

- TimesheetEntry: công hành chính
- SessionAssignment: công d?ng l?p th?c t?
- AssistantScoreEvent: c?ng/tr?/bonus TG
- PayrollRun/PayrollLine: b?ng luong ch?t k?

Ði?m d?i ch?t b?t bu?c:

- Công hành chính và công gi?ng d?y là hai lu?ng khác nhau.
- TG/GV ph?i xem du?c:
  - s? ca dã d?ng l?p
  - s? gi? du?c tính công
  - s? di?u ch?nh c?ng/tr?
  - di?m thu?ng/ph?t tháng
- Report công luong ch? là báo cáo suy di?n, không ph?i noi s?a d? li?u g?c.

### D? li?u t?i thi?u ph?i hi?n trên UI

**Dashboard công gi?ng d?y**
- Nhân s?
- Vai trò
- S? ca th?c d?y
- S? ca b? tr?
- T?ng gi? chu?n
- Gi? b? tr?
- Gi? du?c c?ng
- Ði?m c?ng
- Ði?m tr?
- T? l? thu?ng/ph?t
- Công t?m tính

---

## 3.6. Snapshot / report / l?ch s? k?

Chu?i nghi?p v?:

`Transaction tables` -> `Period closing` -> `ReportSnapshot` -> `Excel export`

Ngu?n s? th?t:

- D? li?u giao d?ch là ngu?n th?t
- Snapshot là b?n dóng bang d? xem l?i dúng quá kh?

Ði?m d?i ch?t b?t bu?c:

- Khi xem tháng cu ph?i bi?t rõ dang xem live hay snapshot.
- Cùng m?t b? l?c ph?i có mã snapshot/hash d? m? l?i dúng d? li?u cu.
- Report workbook ph?i du?c sinh t? query/report layer, không s?a tay trên report.

---

## 4. Ma tr?n d?i ch?t form hi?n t?i

| Khu v?c | Form hi?n t?i | Giao v?i entity nào | C?n d?i ch?t v?i | Thi?u tr?c quan chính |
|---|---|---|---|---|
| Tuy?n sinh | Enrollment Intake Wizard | Lead, Guardian, Student, Enrollment, Portal | l?p, khóa, ph? huynh, h?c phí d?u vào | chua có panel quan h? 360 d? sau khi t?o |
| L?p h?c | Enroll Student Form | Student, Enrollment | intake, tr?ng thái h?c viên, xung d?t enrollment | quá ít ng? c?nh h?c viên tru?c khi enroll |
| Bu?i h?c | Session Assignment Form | SessionAssignment, Employee | công luong, bu?i d?y th?c t? | chua n?i b?t d? di?u ch?nh gi?/ca b? tr? |
| Bu?i h?c | Attendance Form | Attendance, Session | journal, completion, payroll | save dang quá g?p, thi?u c?nh báo ch?t s?m |
| Bu?i h?c | Class Journal Form | TeachingJournal, JournalScore | ph? huynh portal, completion, ch?t lu?ng d?y | thi?u panel tác d?ng xu?ng portal/report |
| H?c phí | Tuition Payment Form | Payment, Allocation | charge, discount, late fee, cashbook | thi?u timeline d?i ch?t ti?n tru?c/sau phân b? |
| Kho | Issue Book Form | BookIssue | t?n kho, l?p, charge sách | thi?u ng? c?nh l?p/công n? sách |
| Qu? | Cash Transaction Form | CashTransaction | payment, inventory, expense source | thi?u ngu?n g?c phát sinh và ch?ng ghi trùng |
| Nhân s? | Timesheet Form | TimesheetEntry | payroll hành chính, phân vai nhân s? | chua phân bi?t d? v?i công gi?ng d?y |

---

## 5. Chu?n hi?n th? d? li?u d? b?t r?i nhung nhi?u thông tin hon

Không nên tang d? li?u b?ng cách nh?i thêm c?t vô h?n. Cách dúng là chia màn thành 4 l?p hi?n th? c? d?nh.

## 5.1. L?p 1 — Header ng? c?nh

Dòng d?u m?i màn chi ti?t ph?i luôn có c?m tóm t?t ng?n:

- d?i tu?ng chính là ai/cái gì
- tr?ng thái hi?n t?i
- k?/th?i gian dang xem
- c?nh báo quan tr?ng nh?t
- action chính

Ví d? h?c viên:

- `HV-240901 - Nguy?n Van A`
- `Ðang h?c | L?p FF-1C | Công n? còn 1.200.000`
- `Ph? huynh: Tr?n Th? B | Portal: Ðã kích ho?t`

## 5.2. L?p 2 — KPI strip

Ngay du?i header là 4-6 ch? s? quy?t d?nh nhanh.

Ví d? màn h?c phí:

- T?n d?u k?
- Ph?i thu k? này
- Ðã thu
- Còn l?i
- H?n thu g?n nh?t
- Reminder chua x? lý

Ví d? màn bu?i h?c:

- Si s? l?p
- Có m?t
- V?ng
- H?c bù
- Journal status
- T?ng gi? tính công

## 5.3. L?p 3 — Tabs ít nhung m?nh

M?i màn chi ti?t ch? nên có 3 tab chính:

- `T?ng quan`
- `Chi ti?t giao d?ch`
- `L?ch s? / d?i ch?t`

Không nên chia quá nhi?u tab nh? khi?n ngu?i dùng m?t d?nh hu?ng.

## 5.4. L?p 4 — Side panel d?i ch?t

Ðây là ph?n hi?n t?i còn thi?u nh?t.

M?i màn quan tr?ng nên có c?t ph?i ho?c drawer bên ph?i ch?a:

- Quan h? liên quan
- C?nh báo l?ch d? li?u
- Dòng th?i gian thao tác g?n nh?t
- Liên k?t sang d?i tu?ng liên quan

Ví d? t?i màn h?c viên:

- Enrollment hi?n t?i
- 3 kho?n charge g?n nh?t
- 3 payment g?n nh?t
- 3 bu?i h?c g?n nh?t
- Ph? huynh chính
- Nút m? nhanh portal/reminder

---

## 6. B? l?c ph?i th?ng nh?t toàn h? th?ng

M?i danh sách nghi?p v? d?u nên dùng cùng m?t khung filter d? ngu?i dùng không ph?i h?c l?i.

## 6.1. B? l?c chu?n

- Th?i gian
- Co s?
- L?p / khóa
- Ngu?i ph? trách
- Tr?ng thái
- T? khóa t?ng h?p

## 6.2. T? khóa t?ng h?p ph?i tìm du?c d?ng th?i

Tùy module, m?t ô search nên tìm du?c nhi?u tru?ng m?t lúc:

- mã h?c viên / mã lead
- tên h?c viên
- tên ph? huynh
- s? di?n tho?i
- mã l?p
- tên l?p
- email portal

## 6.3. Quick filter uu tiên cho v?n hành

Các quick filter nên bám dúng logic ngu?i dùng c?n x? lý ngay:

**CRM**
- Hôm nay c?n g?i
- Quá h?n test
- Ðã test chua nh?p h?c
- Nh?p h?c trong 3 ngày t?i

**H?c phí**
- Còn n?
- Ð?n h?n nh?c
- Ðã TT d?
- Có di?u ch?nh

**Bu?i h?c**
- Chua di?m danh
- Chua journal
- Có l?ch công
- Có h?c viên v?ng

**Nhân s?**
- Chua d? h? so
- S?p h?t h?n HÐ
- Có ca b? tr?
- Có di?m ph?t tháng này

---

## 7. Màn hình nên nâng c?p m?nh nh?t

## 7.1. Student 360

Ðây nên là màn quan tr?ng nh?t c?a kh?i h?c viên.

Ph?i xem du?c trong m?t noi:

- h? so h?c viên
- lead g?c
- ph? huynh
- enrollment hi?n t?i
- l?ch s? l?p
- công n? hi?n t?i
- payment g?n nh?t
- journal g?n nh?t
- phát sách g?n nh?t
- c?nh báo v?n hành

## 7.2. Class Operating Board

M?t màn dành cho v?n hành l?p, thay vì tách quá nhi?u màn r?i.

Ph?i gom du?c:

- thông tin l?p
- l?ch/ca g?n nh?t
- danh sách h?c viên dang h?c
- attendance c?a bu?i g?n nh?t
- assignment c?a bu?i g?n nh?t
- journal status
- h?c phí b?t thu?ng trong l?p
- nh?c vi?c l?p

## 7.3. Tuition Control Board

M?t màn cho qu?n lý h?c phí, thay vì ch? danh sách thu ti?n don l?.

Ph?i có:

- KPI toàn c?c
- b?ng ledger theo h?c viên
- drill-down vào timeline charge/payment/allocation
- nh?c thu theo ph? huynh
- tr?ng thái post sang cashbook

## 7.4. Teaching Payroll Board

M?t màn d? qu?n lý d?i ch?t công luong v?i logic workbook.

Ph?i có:

- b?ng theo nhân s?
- s? ca / gi? / bonus / penalty
- drill-down xu?ng session assignment t?ng bu?i
- c?nh báo ca b? tr? / di?u ch?nh gi? / thi?u journal / thi?u attendance

---

## 8. Th? t? tri?n khai t?i uu nh?t

### P1 — Khóa logic d?i ch?t tru?c

1. Chu?n hóa pipeline enrollment t? intake và enroll nhanh.
2. Chu?n hóa pipeline payment -> allocation -> cash transaction.
3. Chu?n hóa completion c?a session theo assignment + attendance + journal.

### P2 — Tang d? tr?c quan trên màn chi ti?t

4. Làm `Student 360`.
5. Làm `Class Operating Board`.
6. Làm `Tuition Control Board`.
7. Làm `Teaching Payroll Board`.

### P3 — Snapshot/report parity

8. Thêm report API parity cho `Report_HS`, `Report_HP`, `Report_Cong_Luong`.
9. Thêm nhãn live/snapshot rõ trên report.
10. Thêm export dúng ng? c?nh filter dang xem.

---

## 9. K?t lu?n ch?t d? tri?n khai

N?u m?c tiêu là “v?n hành th?t su?ng nhu Excel nhung chu?n ERP hon Excel”, thì chi?n lu?c dúng nh?t là:

- không copy nguyên b? c?c Excel lên web
- không d? form nào t? tính theo cách riêng
- không d? manager ph?i m? 5 màn m?i hi?u 1 h?c viên hay 1 l?p

Ph?i làm theo mô hình:

- **transaction chu?n ? DB**
- **quy t?c d?i ch?t chung**
- **màn 360 / control board d? nhìn d? ng? c?nh**
- **report snapshot d? xem l?i quá kh?**

T?c là:

**ít màn hon, nhung m?i màn m?nh hon**  
**ít thao tác hon, nhung m?i thao tác ra d? li?u chu?n hon**  
**ít ph?i nh? hon, nhung nhìn vào là d?i ch?t du?c ngay**
