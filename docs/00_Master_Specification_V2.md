# BỘ ĐẶC TẢ TRIỂN KHAI WEB ERP V2 - KIỂM TRA CHÉO TOÀN DIỆN

**Nguyên tắc:** Excel là nguồn vận hành cấp 1; PDF là nguồn yêu cầu cấp 2. Tài liệu không tự ý biến suy luận thành sự thật.

Ngày tạo: 29/07/2026 10:36 | SHA-256 Excel: `cec84ae238fd82b22dfadbdb063c5c2e7af3357fd9933b27905519e47c96d6f1`

## 0. Phân loại độ tin cậy

### Đã xác nhận trực tiếp từ nguồn

- Tên sheet, trạng thái, vùng dữ liệu

- Tên Excel Table và tên cột

- Công thức hiện hữu và phụ thuộc công thức

- Số ô công thức/giá trị cached

- Module nghiệp vụ hiển nhiên từ cấu trúc



### Chưa thể khẳng định nếu chưa workshop

- Ý nghĩa chính xác của các cột Column1...Column42

- Ý nghĩa mã trạng thái viết tắt

- Quy định nghiệp vụ không được thể hiện bằng công thức

- Ai nhập/ai duyệt/ai chịu trách nhiệm

- Ngoại lệ thực tế chưa xuất hiện trong dữ liệu

- Định nghĩa pháp lý/kế toán của số liệu



> **Cảnh báo:** Mọi mục đánh dấu `CẦN XÁC NHẬN` không được đưa thẳng vào code production.

# 1. Audit workbook

| Sheet | State | Dimension | Formula cells | Cached errors |

| --- | --- | --- | --- | --- |

| Home | hidden | A1:D20 | 16 | - |

| SinhNhatHV | hidden | A1:H642 | 0 | - |

| Report_Cong_Luong | visible | A1:AG695 | 0 | - |

| Report_HS | visible | A1:BG114 | 0 | - |

| Report_HP | visible | A1:AD2913 | 0 | - |

| ChiTietLopHoc | visible | A1:BG4876 | 130926 | - |

| DSTest | visible | A1:AK512 | 5021 | - |

| DSHV | visible | A1:CJ559 | 21999 | #N/A:846 |

| TheoDoiHP | visible | A1:BC5982 | 133367 | #N/A:49801; #VALUE!:17901; #REF!:3902 |

| XuatNhapSach | visible | A1:AT2484 | 13399 | - |

| Thu-Chi | visible | A1:AR322 | 935 | - |

| DSLop | visible | A1:Z730 | 341 | #N/A:102 |

| NhanSu | visible | A1:AA58 | 109 | #VALUE!:1 |

| MucLuc | visible | A1:AH1000 | 0 | - |



# 2. Audit toàn bộ Excel Table

| Sheet | Table | Range | Số cột |

| --- | --- | --- | --- |

| Home | Table19 | A4:D20 | 4 |

| ChiTietLopHoc | T_ChiTietLop | E5:BD4856 | 52 |

| DSTest | T_DSTest | E6:AH508 | 30 |

| DSHV | T_HV | E4:BU427 | 69 |

| TheoDoiHP | T_HP | E3:AV5971 | 44 |

| XuatNhapSach | T_SachTon | AI6:AR176 | 10 |

| XuatNhapSach | T_SachNhap | U6:AG169 | 13 |

| XuatNhapSach | T_SachXuat | E6:S2483 | 15 |

| Thu-Chi | T_Chi | O5:X322 | 10 |

| Thu-Chi | T_PhanLoai | AL4:AQ26 | 6 |

| Thu-Chi | T_Thu | Z5:AJ153 | 11 |

| DSLop | T_DSLop | A5:Z39 | 26 |

| NhanSu | T_NS | D5:AA58 | 24 |

| MucLuc | Table1 | A1:B10 | 2 |

| MucLuc | Table2 | D1:G13 | 4 |

| MucLuc | Table3 | I1:J8 | 2 |



# 3. Dependency graph cấp sheet

| Nguồn | Tham chiếu | Số lần |

| --- | --- | --- |

| TheoDoiHP | DSHV | 11706 |

| DSHV | DSHV | 10152 |

| ChiTietLopHoc | ChiTietLopHoc | 4851 |

| TheoDoiHP | REF | 3902 |



# 4. Data Dictionary toàn bộ cột

## Home / Table19 / A4:D20

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | A | STT | CALCULATED | number/Excel serial | 16 | 16 | 0 | Cao | 1 \| 2 \| 3 |

| 2 | B | Nội dung | INPUT/MASTER | text | 0 | 16 | 0 | Cao | Thời khóa biểu, lịch làm việc CS4 \| Báo cáo tình trạng học phí CS4 \| Theo dõi sinh nhật học viên theo tháng |

| 3 | C | Tên sheet | INPUT/MASTER | text | 0 | 16 | 0 | Cao | Schedule \| Report_HP!A1 \| SinhNhatHV!A1 |

| 4 | D | Ghi chú | INPUT/MASTER | text | 0 | 1 | 0 | Cao | Sheet này đã được hide. |



## ChiTietLopHoc / T_ChiTietLop / E5:BD4856

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | E | Ngay thang | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 2 | F | TenThu | CALCULATED | text | 4851 | 4851 | 0 | Cao | T7 |

| 3 | G | Ten NV | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | H | Đến S | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | I | Về S | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 6 | J | Đến C | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 7 | K | Về C | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 8 | L | Column4 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 9 | M | ThoiGian | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 10 | N | MaLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 11 | O | TenLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 12 | P | Giáo viên | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 13 | Q | Trợ giảng | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 14 | R | Trợ giảng 2 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 15 | S | Buoi so | CALCULATED | text | 4851 | 4851 | 0 | Cao | N |

| 16 | T | TTHoc | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 17 | U | Column42 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 18 | V | Them (h) | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 19 | W | Đi muộn TG | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 20 | X | Cộng giờ TG | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 21 | Y | DG TG | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 22 | Z | Column6 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 23 | AA | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 24 | AB | Column5 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 25 | AC | Nhac viec 1 | CALCULATED | text | 4838 | 0 | 0 | Cao |  |

| 26 | AD | Nhac viec 2 | CALCULATED | text | 4838 | 0 | 0 | Cao |  |

| 27 | AE | Phat sinh | CALCULATED | text | 4838 | 0 | 0 | Cao |  |

| 28 | AF | Ngay HT | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 29 | AG | Ket qua | CALCULATED | text | 4838 | 0 | 0 | Cao |  |

| 30 | AH | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 31 | AI | So_Gio | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 32 | AJ | So_gio_GV | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 1 |

| 33 | AK | Luongh_GV | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 34 | AL | Ca_Gio | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 35 | AM | Tien_GV | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 36 | AN | So_gio_TG | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 37 | AO | Luongh_TG | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 38 | AP | Tien_TG | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 39 | AQ | Gio NV | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 40 | AR | Cong NV | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 41 | AS | TenLop2 | CALCULATED | text | 4851 | 4851 | 0 | Cao |  (+) |

| 42 | AT | TenLop3 | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Cao | 0 |

| 43 | AU | am/pm | CALCULATED | text | 4851 | 4851 | 0 | Cao |  ( |

| 44 | AV | Column1 | CALCULATED | number/Excel serial | 4851 | 4851 | 0 | Thấp | 11900 |

| 45 | AW | Thu&Buoi&Lop | CALCULATED | text | 4851 | 4851 | 0 | Cao | 011900 ( |

| 46 | AX | Tháng | CALCULATED | date/datetime (xác minh) | 4851 | 4851 | 0 | Cao | 1 |

| 47 | AY | Time và buoi | CALCULATED | text | 4851 | 4851 | 0 | Cao |  (Room N) |

| 48 | AZ | So buoi hoc | CALCULATED | text | 4851 | 0 | 0 | Cao |  |

| 49 | BA | So buoi nghi | CALCULATED | text | 4851 | 0 | 0 | Cao |  |

| 50 | BB | Tuần | CALCULATED | text | 4851 | 0 | 0 | Cao |  |

| 51 | BC | HomNay | CALCULATED | text | 4851 | 0 | 0 | Cao |  |

| 52 | BD | Column3 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |



## DSTest / T_DSTest / E6:AH508

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | E | NgayGap | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 2 | F | HoTenHV | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | G | GioiTinh | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | H | DoB | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | I | tuoi | CALCULATED | text | 502 | 0 | 0 | Cao |  |

| 6 | J | LopHoc | CALCULATED | text | 502 | 0 | 0 | Cao |  |

| 7 | K | HoTenPH | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 8 | L | Sdt | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 9 | M | Column4 | INPUT/MASTER | text | 0 | 3 | 0 | Thấp | A.Phương \| A.Long  |

| 10 | N | DiaChiNha | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 11 | O | NgayTest | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 12 | P | Tình trạng test | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 13 | Q | TenLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 14 | R | Ngày dự kiến đi học | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 15 | S | Ngày nhập học | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 16 | T | MaSo | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 17 | U | Column3 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 18 | V | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 19 | W | Column32 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 20 | X | GhiChu2 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 21 | Y | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 22 | Z | Tình trạng cần liên hệ | CALCULATED | text | 502 | 502 | 0 | Cao | Liên hệ ngay |

| 23 | AA | TenHV&MaSo | CALCULATED | text | 502 | 0 | 0 | Cao |  |

| 24 | AB | TinhTrangHoc | CALCULATED | text | 502 | 502 | 0 | Cao | Chưa đi học |

| 25 | AC | Tháng nhập học | CALCULATED | date/datetime (xác minh) | 502 | 502 | 0 | Cao | 1900-1 |

| 26 | AD | Tình trạng nhập DSHV | CALCULATED | text | 502 | 502 | 0 | Cao | Đã nhập DSHV |

| 27 | AE | Tuần ĐK | CALCULATED | text | 502 | 0 | 0 | Cao |  |

| 28 | AF | Tháng ĐK | CALCULATED | date/datetime (xác minh) | 502 | 0 | 0 | Cao |  |

| 29 | AG | Ten&Sdt | CALCULATED | text | 502 | 502 | 0 | Cao |  -  |

| 30 | AH | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |



## DSHV / T_HV / E4:BU427

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | E | MaLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 2 | F | TenLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | G | TenHV | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | H | Ngay nhap | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | I | Ngay nghi | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 6 | J | Lí do nghỉ | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 7 | K | DanhGia | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 8 | L | HP tồn | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 9 | M | Column4 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 10 | N | Column5 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 11 | O | Column3 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 12 | P | MaSo | CALCULATED | text | 423 | 0 | 0 | Cao |  |

| 13 | Q | Tình trạng học | CALCULATED | text | 423 | 0 | 0 | Cao |  |

| 14 | R | Sđt | CALCULATED | text | 423 | 423 | 423 | Cao | #N/A |

| 15 | S | Column2 | CALCULATED | text | 423 | 423 | 423 | Thấp | #N/A |

| 16 | T | TenHV&MaSo | CALCULATED | text | 423 | 0 | 0 | Cao |  |

| 17 | U | Ho ten | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 18 | V | MaHV | CALCULATED | text | 423 | 423 | 0 | Cao | 3- |

| 19 | W | TenHV&MaHV | CALCULATED | text | 423 | 423 | 0 | Cao | .3- |

| 20 | X | Tháng sinh nhật | CALCULATED | date/datetime (xác minh) | 423 | 423 | 0 | Cao | 1 |

| 21 | Y | HocPhi/Buoi | CALCULATED | text | 423 | 0 | 0 | Cao |  |

| 22 | Z | Tinh trang HP | CALCULATED | text | 423 | 423 | 0 | Cao | Đóng đủ |

| 23 | AA | Tháng học | CALCULATED | date/datetime (xác minh) | 423 | 0 | 0 | Cao |  |

| 24 | AB | Tuần học | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 1 |

| 25 | AC | Tuần nghỉ | CALCULATED | text | 423 | 0 | 0 | Cao |  |

| 26 | AD | Tháng nghỉ học | CALCULATED | date/datetime (xác minh) | 423 | 0 | 0 | Cao |  |

| 27 | AE | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 28 | AF | 12 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 29 | AG | 11 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 30 | AH | 10 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 31 | AI | 9 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 32 | AJ | 8 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 33 | AK | 7 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 34 | AL | 6 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 35 | AM | 5 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 36 | AN | 4 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 37 | AO | 3 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 38 | AP | 2 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 39 | AQ | 1 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 40 | AR | 13 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 41 | AS | T1 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 42 | AT | T2 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 43 | AU | T3 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 44 | AV | T4 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 45 | AW | T5 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 46 | AX | T6 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 47 | AY | T7 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 48 | AZ | T8 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 49 | BA | T9 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 50 | BB | T10 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 51 | BC | T11 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 52 | BD | T12 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 53 | BE | T13 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 54 | BF | T14 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 55 | BG | T15 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 56 | BH | T16 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 57 | BI | T17 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 58 | BJ | T18 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 59 | BK | T19 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 60 | BL | T20 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 61 | BM | T21 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 62 | BN | T22 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 63 | BO | T23 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 64 | BP | T24 | CALCULATED | number/Excel serial | 423 | 423 | 0 | Cao | 0 |

| 65 | BQ | 14 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 66 | BR | 15 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 67 | BS | 16 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 68 | BT | 17 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 69 | BU | 18 | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |



## TheoDoiHP / T_HP / E3:AV5971

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | E | STT | MIXED | number/Excel serial | 3903 | 5967 | 0 | Cao | 0 |

| 2 | F | MaLop | MIXED | text | 3903 | 0 | 0 | Cao |  |

| 3 | G | TenLop | MIXED | text | 3903 | 0 | 0 | Cao |  |

| 4 | H | Ten HV | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | I | HP Tháng | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 6 | J | Buoi tru | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 7 | K | HP dau ky | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 8 | L | HB dieu chinh | INPUT/MASTER | number/Excel serial | 0 | 4 | 0 | Cao | 0.3 \| 0.05 |

| 9 | M | HP thang hien tai | MIXED | text | 3903 | 0 | 0 | Cao |  |

| 10 | N | TienGiaoTrinh | MIXED | number/Excel serial | 3903 | 5967 | 0 | Cao | 0 |

| 11 | O | TongHP | MIXED | text | 3903 | 0 | 0 | Cao |  |

| 12 | P | TienNop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 13 | Q | Con lai | MIXED | text | 3903 | 0 | 0 | Cao |  |

| 14 | R | HP ton thang truoc | MIXED | text | 3903 | 0 | 0 | Cao |  |

| 15 | S | NgayNopTien | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 16 | T | HinhThucTT | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 17 | U | Người nhận | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 18 | V | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 19 | W | Tình trạng đóng học phí | MIXED | decimal/currency | 3902 | 5967 | 0 | Cao | Đã TT đủ |

| 20 | X | Ten&Sdt | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 21 | Y | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 22 | Z | MaSo | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 23 | AA | TT học | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 24 | AB | Thang va ho ten | CALCULATED | text | 5967 | 0 | 0 | Cao |  |

| 25 | AC | Ho ten | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 26 | AD | Ngay NH | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 27 | AE | Ngay KT | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 28 | AF | ĐG | MIXED | text | 3902 | 0 | 0 | Cao |  |

| 29 | AG | So buoi | MIXED | text | 3902 | 0 | 0 | Cao |  |

| 30 | AH | Buoi nghi | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 31 | AI | Hoc bong | MIXED | text | 3902 | 5967 | 5967 | Cao | #N/A |

| 32 | AJ | Cong don | MIXED | number/Excel serial | 3902 | 5967 | 0 | Cao | 0 |

| 33 | AK | Tuan TT | MIXED | text | 3902 | 0 | 0 | Cao |  |

| 34 | AL | Thang thanh toan | MIXED | text | 3902 | 0 | 0 | Cao |  |

| 35 | AM | Column4 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 36 | AN | Thang (1) | CALCULATED | number/Excel serial | 5967 | 5967 | 0 | Cao | 1 |

| 37 | AO | Số buổi (1) | MIXED | text | 3902 | 0 | 0 | Cao |  |

| 38 | AP | Học phí (1) | CALCULATED | decimal/currency | 5967 | 5967 | 5967 | Cao | #VALUE! |

| 39 | AQ | Thang (2) | CALCULATED | number/Excel serial | 5967 | 5967 | 0 | Cao | 2 |

| 40 | AR | Số buổi (2) | MIXED | text | 3902 | 0 | 0 | Cao |  |

| 41 | AS | Học phí (2) | CALCULATED | decimal/currency | 5967 | 5967 | 5967 | Cao | #VALUE! |

| 42 | AT | Cộng dồn (2) | CALCULATED | text | 5967 | 5967 | 5967 | Cao | #VALUE! |

| 43 | AU | cghj | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 44 | AV | Column2 | MIXED | text | 3902 | 5967 | 5967 | Thấp | #REF! \| #N/A |



## XuatNhapSach / T_SachTon / AI6:AR176

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | AI | STT | CALCULATED | number/Excel serial | 170 | 170 | 0 | Cao | 1 \| 2 \| 3 |

| 2 | AJ | MaLop | INPUT/MASTER | text | 0 | 104 | 0 | Cao | FF \| UP \| VINS |

| 3 | AK | TenSach | INPUT/MASTER | text | 0 | 104 | 0 | Cao | First Friends 2 - Activity \| First Friends 2 - Classbook \| Bài tập tô màu FF2 |

| 4 | AL | Column4 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 5 | AM | DonGia | INPUT/MASTER | number/Excel serial | 0 | 104 | 0 | Cao | 40000 \| 60000 \| 50000 |

| 6 | AN | Column3 | CALCULATED | number/Excel serial | 170 | 170 | 0 | Thấp | 0 |

| 7 | AO | Column1 | CALCULATED | number/Excel serial | 170 | 170 | 0 | Thấp | 0 |

| 8 | AP | Column2 | CALCULATED | number/Excel serial | 170 | 170 | 0 | Thấp | 0 |

| 9 | AQ | Số Lượng | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 10 | AR | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |



## XuatNhapSach / T_SachNhap / U6:AG169

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | U | Ngày tháng | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 2 | V | Malop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | W | TenSach | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | X | SL nhập | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | Y | Người nhập | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 6 | Z | Người giao | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 7 | AA | Tổng tiền | CALCULATED | decimal/currency | 163 | 163 | 0 | Cao | 0 |

| 8 | AB | Ghi chú | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 9 | AC | Đơn giá | INPUT/MASTER | decimal/currency | 0 | 0 | 0 | Cao |  |

| 10 | AD | Tình trạng sử dụng | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 11 | AE | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 12 | AF | Tháng nhập | CALCULATED | date/datetime (xác minh) | 163 | 163 | 0 | Cao | 1 |

| 13 | AG | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |



## XuatNhapSach / T_SachXuat / E6:S2483

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | E | STT | CALCULATED | number/Excel serial | 2477 | 2477 | 0 | Cao | 0 |

| 2 | F | MaLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | G | TenLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | H | TenHV&MaHV | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | I | TenSach | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 6 | J | NgayThang | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 7 | K | Column3 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 8 | L | SL | INPUT/MASTER | number/Excel serial | 0 | 2472 | 0 | Cao | 1 |

| 9 | M | DonGia | CALCULATED | text | 2477 | 0 | 0 | Cao |  |

| 10 | N | TienGiaoTrinh | CALCULATED | text | 2477 | 0 | 0 | Cao |  |

| 11 | O | TTTien | CALCULATED | text | 2477 | 0 | 0 | Cao |  |

| 12 | P | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 13 | Q | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 14 | R | Tháng xuất | CALCULATED | date/datetime (xác minh) | 2477 | 2477 | 0 | Cao | 1 |

| 15 | S | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |



## Thu-Chi / T_Chi / O5:X322

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | O | Ngày tháng | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 2 | P | Loại chi | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | Q | Chi tiết các loại | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | R | Diễn giải | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | S | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 6 | T | Số tiền | INPUT/MASTER | decimal/currency | 0 | 0 | 0 | Cao |  |

| 7 | U | Người thu/chi | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 8 | V | Ghi chú | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 9 | W | Tháng chi | CALCULATED | date/datetime (xác minh) | 317 | 317 | 0 | Cao | 1900-1 |

| 10 | X | Tuan chi | CALCULATED | text | 317 | 0 | 0 | Cao |  |



## Thu-Chi / T_PhanLoai / AL4:AQ26

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | AL | LoaiHinh | INPUT/MASTER | text | 0 | 22 | 0 | Cao | Chi \| Thu |

| 2 | AM | TenThuChi | INPUT/MASTER | text | 0 | 22 | 0 | Cao | Văn phòng \| Giáo trình \| Điện, nước, internet |

| 3 | AN | ChiTietLoai | INPUT/MASTER | text | 0 | 20 | 0 | Cao | Văn phòng phẩm, dồ dùng \| Tiền mua giáo trình \| Tiền Internet, tiền điện, nước |

| 4 | AO | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | AP | nguoi chi | INPUT/MASTER | text | 0 | 4 | 0 | Cao | C.Hằng \| A.Đạo \| C.Trang |

| 6 | AQ | nguoi Thu | INPUT/MASTER | text | 0 | 1 | 0 | Cao | Tạm ứng |



## Thu-Chi / T_Thu / Z5:AJ153

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | Z | Ngày tháng | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 2 | AA | Loại thu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | AB | Chi tiết các loại | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | AC | Diễn giải | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | AD | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 6 | AE | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 7 | AF | Số tiền | INPUT/MASTER | decimal/currency | 0 | 0 | 0 | Cao |  |

| 8 | AG | Người thu/chi | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 9 | AH | Ghi chú | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 10 | AI | Tháng thu | CALCULATED | date/datetime (xác minh) | 148 | 148 | 0 | Cao | 1900-1 |

| 11 | AJ | Tuan thu | CALCULATED | text | 148 | 0 | 0 | Cao |  |



## DSLop / T_DSLop / A5:Z39

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | A | MaLop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 2 | B | Lop | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | C | Ten lop | CALCULATED | text | 34 | 34 | 0 | Cao | - |

| 4 | D | SLBuoiHoc | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | E | NgayBD | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 6 | F | NgayKTDuKien | CALCULATED | number/Excel serial | 34 | 34 | 0 | Cao | 0 |

| 7 | G | Column5 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 8 | H | Buoi so | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 9 | I | So buoi nghi | CALCULATED | number/Excel serial | 34 | 34 | 0 | Cao | 0 |

| 10 | J | Column4 | CALCULATED | number/Excel serial | 34 | 34 | 0 | Thấp | 0 |

| 11 | K | Con lai | CALCULATED | number/Excel serial | 34 | 34 | 0 | Cao | 0 |

| 12 | L | GhiChu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 13 | M | Column7 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 14 | N | Ngay CĐ | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 15 | O | Thu | INPUT/MASTER | text | 0 | 1 | 0 | Cao | T4 |

| 16 | P | Cong viec | INPUT/MASTER | text | 0 | 1 | 0 | Cao | Update file quản lí lên drive |

| 17 | Q | Ngay phat sinh | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 18 | R | Cong viec PS | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 19 | S | ghi chu | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 20 | T | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 21 | U | TenLop | CALCULATED | text | 34 | 34 | 0 | Cao | - |

| 22 | V | BuoiHoc/Tuan | CALCULATED | text | 34 | 34 | 34 | Cao | #N/A |

| 23 | W | HocPhi/Buoi | CALCULATED | text | 34 | 34 | 34 | Cao | #N/A |

| 24 | X | Column1 | CALCULATED | text | 34 | 34 | 34 | Thấp | #N/A |

| 25 | Y | SLHVNow | CALCULATED | number/Excel serial | 34 | 34 | 0 | Cao | 0 |

| 26 | Z | Column3 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |



## NhanSu / T_NS / D5:AA58

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | D | STT | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 2 | E | Mã NV | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 3 | F | Họ và tên | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 4 | G | Tên ngắn | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 5 | H | Ngày sinh | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 6 | I | Vị trí | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 7 | J | Column3 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 8 | K | Column4 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 9 | L | SĐT | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 10 | M | Mail | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 11 | N | Quê quán | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 12 | O | Địa chỉ thường trú | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 13 | P | Số CMT | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 14 | Q | Ngày cấp | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 15 | R | Nơi cấp | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 16 | S | Column6 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 17 | T | Column5 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 18 | U | Ngày ký HĐ | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 19 | V | Hạn HĐ | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 20 | W | Ngày nghỉ | INPUT/MASTER | date/datetime (xác minh) | 0 | 0 | 0 | Cao |  |

| 21 | X | Column1 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |

| 22 | Y | Tình trạng làm việc | CALCULATED | text | 53 | 53 | 0 | Cao | Chưa có info |

| 23 | Z | Tháng năm nhận việc | CALCULATED | date/datetime (xác minh) | 53 | 53 | 0 | Cao | 1/1900 |

| 24 | AA | Column2 | INPUT/MASTER | text | 0 | 0 | 0 | Thấp |  |



## MucLuc / Table1 / A1:B10

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | A | KhungTG | INPUT/MASTER | text | 0 | 0 | 0 | Cao |  |

| 2 | B | ThoiGian | INPUT/MASTER | text | 0 | 6 | 0 | Cao | 9:30 - 11:00 \| 16:00 - 17:30 \| 17:30 - 19:00 |



## MucLuc / Table2 / D1:G13

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | D | MaLop | INPUT/MASTER | text | 0 | 12 | 0 | Cao | BT \| FF \| LTĐH |

| 2 | E | TenLop | INPUT/MASTER | text | 0 | 12 | 0 | Cao | Bổ trợ \| First friend  \| Luyện thi đại học |

| 3 | F | HocPhi/Buoi | INPUT/MASTER | number/Excel serial | 0 | 12 | 0 | Cao | 0 \| 170000 \| 200000 |

| 4 | G | BuoiHoc/Tuan | INPUT/MASTER | number/Excel serial | 0 | 12 | 0 | Cao | 1 \| 2 \| 3 |



## MucLuc / Table3 / I1:J8

| # | Excel | Tên cột | Phân loại | Kiểu suy luận | Formula | Value | Error | Độ tin cậy | Sample |

| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 1 | I | MaThu | INPUT/MASTER | text | 0 | 7 | 0 | Cao | M \| T \| W |

| 2 | J | TenThu | INPUT/MASTER | text | 0 | 7 | 0 | Cao | Monday \| Tuesday \| Wenesday |



# 5. Formula Catalog - danh mục công thức duy nhất

Tổng số mẫu công thức chuẩn hóa: **149**. Mỗi mẫu phải được chuyển thành Business Rule, test case và mẫu đối soát trước khi go-live.

### FR-0001 - Home / Table19 / STT

- Số lần: 16
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(Table19[[#This Row],[Nội dung]]=0,0,SUBTOTAL(3,$B$5:Table19[[#This Row],[Nội dung]]))`
- Mẫu chuẩn hóa: `IF(Table19[[#This Row],[Nội dung]]={n},{n},SUBTOTAL({n},B{row}:Table19[[#This Row],[Nội dung]]))`

### FR-0002 - ChiTietLopHoc / T_ChiTietLop / TenThu

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `TEXT(WEEKDAY(T_ChiTietLop[[#This Row],[Ngay thang]],1),"ddd")`
- Mẫu chuẩn hóa: `TEXT(WEEKDAY(T_ChiTietLop[[#This Row],[Ngay thang]],{n}),"ddd")`

### FR-0003 - ChiTietLopHoc / T_ChiTietLop / Buoi so

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_ChiTietLop[[#This Row],[TTHoc]]="C",COUNTIFS($O$6:O6,T_ChiTietLop[[#This Row],[TenLop]],ChiTietLopHoc!$T$6:T6,"C")+VLOOKUP($O6,T_DSLop[[Ten lop]:[Buoi so]],6,0),"N"),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(T_ChiTietLop[[#This Row],[TTHoc]]="C",COUNTIFS(O{row}:O{row},T_ChiTietLop[[#This Row],[TenLop]],ChiTietLopHoc!T{row}:T{row},"C")+VLOOKUP(O{row},T_DSLop[[Ten lop]:[Buoi so]],{n},{n}),"N"),"")`

### FR-0004 - ChiTietLopHoc / T_ChiTietLop / Nhac viec 1

- Số lần: 4838
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(VLOOKUP(DAY(T_ChiTietLop[[#This Row],[Ngay thang]]),T_DSLop[[Ngay CĐ]:[Cong viec]],3,0),"")`
- Mẫu chuẩn hóa: `IFERROR(VLOOKUP(DAY(T_ChiTietLop[[#This Row],[Ngay thang]]),T_DSLop[[Ngay CĐ]:[Cong viec]],{n},{n}),"")`

### FR-0005 - ChiTietLopHoc / T_ChiTietLop / Nhac viec 2

- Số lần: 4838
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[TenThu]],T_DSLop[[Thu]:[Cong viec]],2,0),"")`
- Mẫu chuẩn hóa: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[TenThu]],T_DSLop[[Thu]:[Cong viec]],{n},{n}),"")`

### FR-0006 - ChiTietLopHoc / T_ChiTietLop / Phat sinh

- Số lần: 4838
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[Ngay thang]],T_DSLop[[Ngay phat sinh]:[Cong viec PS]],2,0),"")`
- Mẫu chuẩn hóa: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[Ngay thang]],T_DSLop[[Ngay phat sinh]:[Cong viec PS]],{n},{n}),"")`

### FR-0007 - ChiTietLopHoc / T_ChiTietLop / Ket qua

- Số lần: 4838
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(AND(T_ChiTietLop[[#This Row],[Nhac viec 1]]="",T_ChiTietLop[[#This Row],[Nhac viec 2]]="",T_ChiTietLop[[#This Row],[Phat sinh]]=""),"",IF(T_ChiTietLop[[#This Row],[Ngay HT]]=T_ChiTietLop[[#This Row],[Ngay thang]],"Hoàn Thành",IF(T_ChiTietLop[[#This Row],[Ngay HT]]>T_ChiTietLop[[#This Row],[Ngay thang]],"HT Muộn",IF(T_ChiTietLop[[#This Row],[Ngay HT]]="","Chưa hoàn thành","HT trước hạn"))))`
- Mẫu chuẩn hóa: `IF(AND(T_ChiTietLop[[#This Row],[Nhac viec {n}]]="",T_ChiTietLop[[#This Row],[Nhac viec {n}]]="",T_ChiTietLop[[#This Row],[Phat sinh]]=""),"",IF(T_ChiTietLop[[#This Row],[Ngay HT]]=T_ChiTietLop[[#This Row],[Ngay thang]],"Hoàn Thành",IF(T_ChiTietLop[[#This Row],[Ngay HT]]>T_ChiTietLop[[#This Row],[Ngay thang]],"HT Muộn",IF(T_ChiTietLop[[#This Row],[Ngay HT]]="","Chưa hoàn thành","HT trước hạn"))))`

### FR-0008 - ChiTietLopHoc / T_ChiTietLop / So_Gio

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(TRIM(T_ChiTietLop[[#This Row],[ThoiGian]])="",0,((RIGHT(T_ChiTietLop[[#This Row],[ThoiGian]],5)-LEFT(T_ChiTietLop[[#This Row],[ThoiGian]],5))*24)+IF(T_ChiTietLop[[#This Row],[Them (h)]]="",0,T_ChiTietLop[[#This Row],[Them (h)]])-IF(T_ChiTietLop[[#This Row],[Column42]]="",0,T_ChiTietLop[[#This Row],[Column42]]))`
- Mẫu chuẩn hóa: `IF(TRIM(T_ChiTietLop[[#This Row],[ThoiGian]])="",{n},((RIGHT(T_ChiTietLop[[#This Row],[ThoiGian]],{n})-LEFT(T_ChiTietLop[[#This Row],[ThoiGian]],{n}))*{n})+IF(T_ChiTietLop[[#This Row],[Them (h)]]="",{n},T_ChiTietLop[[#This Row],[Them (h)]])-IF(T_ChiTietLop[[#This Row],[Column42]]="",{n},T_ChiTietLop[[#This Row],[Column42]]))`

### FR-0009 - ChiTietLopHoc / T_ChiTietLop / So_gio_GV

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_ChiTietLop[[#This Row],[TTHoc]]="K","",IF(T_ChiTietLop[[#This Row],[Ca_Gio]]="Giờ",T_ChiTietLop[[#This Row],[So_Gio]],1)),0)`
- Mẫu chuẩn hóa: `IFERROR(IF(T_ChiTietLop[[#This Row],[TTHoc]]="K","",IF(T_ChiTietLop[[#This Row],[Ca_Gio]]="Giờ",T_ChiTietLop[[#This Row],[So_Gio]],{n})),{n})`

### FR-0010 - ChiTietLopHoc / T_ChiTietLop / Luongh_GV

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_NS[[Tên ngắn]:[Column3]],MATCH(T_ChiTietLop[[#This Row],[Giáo viên]],T_NS[Tên ngắn],0),4),0)`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_NS[[Tên ngắn]:[Column3]],MATCH(T_ChiTietLop[[#This Row],[Giáo viên]],T_NS[Tên ngắn],{n}),{n}),{n})`

### FR-0011 - ChiTietLopHoc / T_ChiTietLop / Ca_Gio

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[Giáo viên]],T_NS[[Tên ngắn]:[Column4]],5,0),0)`
- Mẫu chuẩn hóa: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[Giáo viên]],T_NS[[Tên ngắn]:[Column4]],{n},{n}),{n})`

### FR-0012 - ChiTietLopHoc / T_ChiTietLop / Tien_GV

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(T_ChiTietLop[[#This Row],[So_gio_GV]]*T_ChiTietLop[[#This Row],[Luongh_GV]],0)`
- Mẫu chuẩn hóa: `IFERROR(T_ChiTietLop[[#This Row],[So_gio_GV]]*T_ChiTietLop[[#This Row],[Luongh_GV]],{n})`

### FR-0013 - ChiTietLopHoc / T_ChiTietLop / So_gio_TG

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(TRIM(T_ChiTietLop[[#This Row],[ThoiGian]])="",0,((RIGHT(T_ChiTietLop[[#This Row],[ThoiGian]],5)-LEFT(T_ChiTietLop[[#This Row],[ThoiGian]],5))*24)+0.5+IF(T_ChiTietLop[[#This Row],[Cộng giờ TG]]="",0,T_ChiTietLop[[#This Row],[Cộng giờ TG]])-IF(T_ChiTietLop[[#This Row],[Đi muộn TG]]="",0,T_ChiTietLop[[#This Row],[Đi muộn TG]]))`
- Mẫu chuẩn hóa: `IF(TRIM(T_ChiTietLop[[#This Row],[ThoiGian]])="",{n},((RIGHT(T_ChiTietLop[[#This Row],[ThoiGian]],{n})-LEFT(T_ChiTietLop[[#This Row],[ThoiGian]],{n}))*{n})+{n}+IF(T_ChiTietLop[[#This Row],[Cộng giờ TG]]="",{n},T_ChiTietLop[[#This Row],[Cộng giờ TG]])-IF(T_ChiTietLop[[#This Row],[Đi muộn TG]]="",{n},T_ChiTietLop[[#This Row],[Đi muộn TG]]))`

### FR-0014 - ChiTietLopHoc / T_ChiTietLop / Luongh_TG

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[Trợ giảng]],T_NS[[Tên ngắn]:[Column3]],4,0),0)`
- Mẫu chuẩn hóa: `IFERROR(VLOOKUP(T_ChiTietLop[[#This Row],[Trợ giảng]],T_NS[[Tên ngắn]:[Column3]],{n},{n}),{n})`

### FR-0015 - ChiTietLopHoc / T_ChiTietLop / Tien_TG

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_ChiTietLop[[#This Row],[TTHoc]]="K","",T_ChiTietLop[[#This Row],[So_gio_TG]]*T_ChiTietLop[[#This Row],[Luongh_TG]])`
- Mẫu chuẩn hóa: `IF(T_ChiTietLop[[#This Row],[TTHoc]]="K","",T_ChiTietLop[[#This Row],[So_gio_TG]]*T_ChiTietLop[[#This Row],[Luongh_TG]])`

### FR-0016 - ChiTietLopHoc / T_ChiTietLop / Gio NV

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `(T_ChiTietLop[[#This Row],[Về S]]+T_ChiTietLop[[#This Row],[Về C]]-T_ChiTietLop[[#This Row],[Đến C]]-T_ChiTietLop[[#This Row],[Đến S]])*24`
- Mẫu chuẩn hóa: `(T_ChiTietLop[[#This Row],[Về S]]+T_ChiTietLop[[#This Row],[Về C]]-T_ChiTietLop[[#This Row],[Đến C]]-T_ChiTietLop[[#This Row],[Đến S]])*{n}`

### FR-0017 - ChiTietLopHoc / T_ChiTietLop / Cong NV

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_ChiTietLop[[#This Row],[Gio NV]]/8`
- Mẫu chuẩn hóa: `T_ChiTietLop[[#This Row],[Gio NV]]/{n}`

### FR-0018 - ChiTietLopHoc / T_ChiTietLop / TenLop2

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_ChiTietLop[[#This Row],[TenLop]]&" ("&T_ChiTietLop[[#This Row],[Giáo viên]]&"+"&T_ChiTietLop[[#This Row],[Trợ giảng]]&")"`
- Mẫu chuẩn hóa: `T_ChiTietLop[[#This Row],[TenLop]]&" ("&T_ChiTietLop[[#This Row],[Giáo viên]]&"+"&T_ChiTietLop[[#This Row],[Trợ giảng]]&")"`

### FR-0019 - ChiTietLopHoc / T_ChiTietLop / TenLop3

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIF(T_HV[TenLop],T_ChiTietLop[[#This Row],[TenLop]],T_HV[TenHV])`
- Mẫu chuẩn hóa: `SUMIF(T_HV[TenLop],T_ChiTietLop[[#This Row],[TenLop]],T_HV[TenHV])`

### FR-0020 - ChiTietLopHoc / T_ChiTietLop / am/pm

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `LEFT(T_ChiTietLop[[#This Row],[Time và buoi]],2)`
- Mẫu chuẩn hóa: `LEFT(T_ChiTietLop[[#This Row],[Time và buoi]],{n})`

### FR-0021 - ChiTietLopHoc / T_ChiTietLop / Column1

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `DAY(T_ChiTietLop[[#This Row],[Ngay thang]])&MONTH(T_ChiTietLop[[#This Row],[Ngay thang]])&YEAR(T_ChiTietLop[[#This Row],[Ngay thang]])`
- Mẫu chuẩn hóa: `DAY(T_ChiTietLop[[#This Row],[Ngay thang]])&MONTH(T_ChiTietLop[[#This Row],[Ngay thang]])&YEAR(T_ChiTietLop[[#This Row],[Ngay thang]])`

### FR-0022 - ChiTietLopHoc / T_ChiTietLop / Thu&Buoi&Lop

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_ChiTietLop[[#This Row],[Column1]]&T_ChiTietLop[[#This Row],[am/pm]]&T_ChiTietLop[[#This Row],[TenLop]]`
- Mẫu chuẩn hóa: `T_ChiTietLop[[#This Row],[Column1]]&T_ChiTietLop[[#This Row],[am/pm]]&T_ChiTietLop[[#This Row],[TenLop]]`

### FR-0023 - ChiTietLopHoc / T_ChiTietLop / Tháng

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `MONTH(T_ChiTietLop[[#This Row],[Ngay thang]])`
- Mẫu chuẩn hóa: `MONTH(T_ChiTietLop[[#This Row],[Ngay thang]])`

### FR-0024 - ChiTietLopHoc / T_ChiTietLop / Time và buoi

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_ChiTietLop[[#This Row],[ThoiGian]]&" (Room "&T_ChiTietLop[[#This Row],[Buoi so]]&")"`
- Mẫu chuẩn hóa: `T_ChiTietLop[[#This Row],[ThoiGian]]&" (Room "&T_ChiTietLop[[#This Row],[Buoi so]]&")"`

### FR-0025 - ChiTietLopHoc / T_ChiTietLop / So buoi hoc

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_ChiTietLop[[#This Row],[TTHoc]]="C",1,"")`
- Mẫu chuẩn hóa: `IF(T_ChiTietLop[[#This Row],[TTHoc]]="C",{n},"")`

### FR-0026 - ChiTietLopHoc / T_ChiTietLop / So buoi nghi

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_ChiTietLop[[#This Row],[TTHoc]]="K",1,"")`
- Mẫu chuẩn hóa: `IF(T_ChiTietLop[[#This Row],[TTHoc]]="K",{n},"")`

### FR-0027 - ChiTietLopHoc / T_ChiTietLop / Tuần

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_ChiTietLop[[#This Row],[Ngay thang]]="","",WEEKNUM(T_ChiTietLop[[#This Row],[Ngay thang]],2))`
- Mẫu chuẩn hóa: `IF(T_ChiTietLop[[#This Row],[Ngay thang]]="","",WEEKNUM(T_ChiTietLop[[#This Row],[Ngay thang]],{n}))`

### FR-0028 - ChiTietLopHoc / T_ChiTietLop / HomNay

- Số lần: 4851
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_ChiTietLop[[#This Row],[Ngay thang]]=TODAY(),"Hôm nay",IF(T_ChiTietLop[[#This Row],[Ngay thang]]=TODAY()+1,"Ngày mai",IF(T_ChiTietLop[[#This Row],[Ngay thang]]=TODAY()-1,"Hôm qua","")))`
- Mẫu chuẩn hóa: `IF(T_ChiTietLop[[#This Row],[Ngay thang]]=TODAY(),"Hôm nay",IF(T_ChiTietLop[[#This Row],[Ngay thang]]=TODAY()+{n},"Ngày mai",IF(T_ChiTietLop[[#This Row],[Ngay thang]]=TODAY()-{n},"Hôm qua","")))`

### FR-0029 - DSTest / T_DSTest / tuoi

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_DSTest[[#This Row],[DoB]]="","",YEAR(TODAY())-YEAR(T_DSTest[[#This Row],[DoB]]))`
- Mẫu chuẩn hóa: `IF(T_DSTest[[#This Row],[DoB]]="","",YEAR(TODAY())-YEAR(T_DSTest[[#This Row],[DoB]]))`

### FR-0030 - DSTest / T_DSTest / LopHoc

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_DSTest[[#This Row],[tuoi]]-5>0,T_DSTest[[#This Row],[tuoi]]-5,IF(T_DSTest[[#This Row],[tuoi]]-5<0,"MN","")),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(T_DSTest[[#This Row],[tuoi]]-{n}>{n},T_DSTest[[#This Row],[tuoi]]-{n},IF(T_DSTest[[#This Row],[tuoi]]-{n}<{n},"MN","")),"")`

### FR-0031 - DSTest / T_DSTest / Tình trạng cần liên hệ

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_DSTest[[#This Row],[Tình trạng test]]="Chưa test",IF(T_DSTest[[#This Row],[NgayTest]]-TODAY()<=1,"Liên hệ ngay",""),IF(T_DSTest[[#This Row],[MaSo]]="",IF(T_DSTest[[#This Row],[Ngày dự kiến đi học]]-TODAY()<=1,"Liên hệ ngay",""),"")),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(T_DSTest[[#This Row],[Tình trạng test]]="Chưa test",IF(T_DSTest[[#This Row],[NgayTest]]-TODAY()<={n},"Liên hệ ngay",""),IF(T_DSTest[[#This Row],[MaSo]]="",IF(T_DSTest[[#This Row],[Ngày dự kiến đi học]]-TODAY()<={n},"Liên hệ ngay",""),"")),"")`

### FR-0032 - DSTest / T_DSTest / TenHV&MaSo

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSTest[[#This Row],[HoTenHV]]&T_DSTest[[#This Row],[MaSo]]`
- Mẫu chuẩn hóa: `T_DSTest[[#This Row],[HoTenHV]]&T_DSTest[[#This Row],[MaSo]]`

### FR-0033 - DSTest / T_DSTest / TinhTrangHoc

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_DSTest[[#This Row],[Ngày nhập học]]<>0,"Đã đi học","Chưa đi học")`
- Mẫu chuẩn hóa: `IF(T_DSTest[[#This Row],[Ngày nhập học]]<>{n},"Đã đi học","Chưa đi học")`

### FR-0034 - DSTest / T_DSTest / Tháng nhập học

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(YEAR(T_DSTest[[#This Row],[Ngày nhập học]])&"-"&MONTH(T_DSTest[[#This Row],[Ngày nhập học]]),"")`
- Mẫu chuẩn hóa: `IFERROR(YEAR(T_DSTest[[#This Row],[Ngày nhập học]])&"-"&MONTH(T_DSTest[[#This Row],[Ngày nhập học]]),"")`

### FR-0035 - DSTest / T_DSTest / Tình trạng nhập DSHV

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(COUNTIF(T_HV[TenHV&MaSo],T_DSTest[[#This Row],[TenHV&MaSo]])>=1,"Đã nhập DSHV","Chưa nhập DSHV")`
- Mẫu chuẩn hóa: `IF(COUNTIF(T_HV[TenHV&MaSo],T_DSTest[[#This Row],[TenHV&MaSo]])>={n},"Đã nhập DSHV","Chưa nhập DSHV")`

### FR-0036 - DSTest / T_DSTest / Tuần ĐK

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_DSTest[[#This Row],[NgayGap]]="","",WEEKNUM(T_DSTest[[#This Row],[NgayGap]],2))`
- Mẫu chuẩn hóa: `IF(T_DSTest[[#This Row],[NgayGap]]="","",WEEKNUM(T_DSTest[[#This Row],[NgayGap]],{n}))`

### FR-0037 - DSTest / T_DSTest / Tháng ĐK

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_DSTest[[#This Row],[NgayGap]]="","",IFERROR(YEAR(T_DSTest[[#This Row],[NgayGap]])&"-"&MONTH(T_DSTest[[#This Row],[NgayGap]]),""))`
- Mẫu chuẩn hóa: `IF(T_DSTest[[#This Row],[NgayGap]]="","",IFERROR(YEAR(T_DSTest[[#This Row],[NgayGap]])&"-"&MONTH(T_DSTest[[#This Row],[NgayGap]]),""))`

### FR-0038 - DSTest / T_DSTest / Ten&Sdt

- Số lần: 502
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSTest[[#This Row],[HoTenPH]]&" - "&T_DSTest[[#This Row],[Sdt]]`
- Mẫu chuẩn hóa: `T_DSTest[[#This Row],[HoTenPH]]&" - "&T_DSTest[[#This Row],[Sdt]]`

### FR-0039 - DSHV / T_HV / HP tồn

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(SUMIF(T_HP[MaSo],T_HV[[#This Row],[MaSo]],T_HP[Con lai]),"")`
- Mẫu chuẩn hóa: `IFERROR(SUMIF(T_HP[MaSo],T_HV[[#This Row],[MaSo]],T_HP[Con lai]),"")`

### FR-0040 - DSHV / T_HV / MaSo

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_DSTest[],MATCH(T_HV[[#This Row],[TenHV]],T_DSTest[HoTenHV],0),MATCH(T_HV[[#Headers],[MaSo]],T_DSTest[#Headers],0)),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_DSTest[],MATCH(T_HV[[#This Row],[TenHV]],T_DSTest[HoTenHV],{n}),MATCH(T_HV[[#Headers],[MaSo]],T_DSTest[#Headers],{n})),"")`

### FR-0041 - DSHV / T_HV / Tình trạng học

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[TenHV]]="","",IF(T_HV[[#This Row],[Ngay nghi]]=0,"Đang học","Đã nghỉ"))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[TenHV]]="","",IF(T_HV[[#This Row],[Ngay nghi]]={n},"Đang học","Đã nghỉ"))`

### FR-0042 - DSHV / T_HV / Sđt

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(T_DSTest[[Sdt]:[MaSo]],MATCH(T_HV[[#This Row],[MaSo]],T_DSTest[MaSo],0),1)`
- Mẫu chuẩn hóa: `INDEX(T_DSTest[[Sdt]:[MaSo]],MATCH(T_HV[[#This Row],[MaSo]],T_DSTest[MaSo],{n}),{n})`

### FR-0043 - DSHV / T_HV / Column2

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `VLOOKUP(T_HV[[#This Row],[MaSo]],T_DSTest[[MaSo]:[GhiChu2]],5,0)`
- Mẫu chuẩn hóa: `VLOOKUP(T_HV[[#This Row],[MaSo]],T_DSTest[[MaSo]:[GhiChu2]],{n},{n})`

### FR-0044 - DSHV / T_HV / TenHV&MaSo

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(T_HV[[#This Row],[TenHV]]&T_HV[[#This Row],[MaSo]],"")`
- Mẫu chuẩn hóa: `IFERROR(T_HV[[#This Row],[TenHV]]&T_HV[[#This Row],[MaSo]],"")`

### FR-0045 - DSHV / T_HV / Ho ten

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HV[[#This Row],[TenHV]]`
- Mẫu chuẩn hóa: `T_HV[[#This Row],[TenHV]]`

### FR-0046 - DSHV / T_HV / MaHV

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `3&T_HV[[#This Row],[TenLop]]&"-"&T_HV[[#This Row],[MaSo]]`
- Mẫu chuẩn hóa: `{n}&T_HV[[#This Row],[TenLop]]&"-"&T_HV[[#This Row],[MaSo]]`

### FR-0047 - DSHV / T_HV / TenHV&MaHV

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HV[[#This Row],[TenHV]]&"."&T_HV[[#This Row],[MaHV]]`
- Mẫu chuẩn hóa: `T_HV[[#This Row],[TenHV]]&"."&T_HV[[#This Row],[MaHV]]`

### FR-0048 - DSHV / T_HV / Tháng sinh nhật

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `MONTH(INDEX(T_DSTest[],MATCH(T_HV[[#This Row],[TenHV&MaSo]],T_DSTest[TenHV&MaSo],0),MATCH("DoB",T_DSTest[#Headers],0)))`
- Mẫu chuẩn hóa: `MONTH(INDEX(T_DSTest[],MATCH(T_HV[[#This Row],[TenHV&MaSo]],T_DSTest[TenHV&MaSo],{n}),MATCH("DoB",T_DSTest[#Headers],{n})))`

### FR-0049 - DSHV / T_HV / HocPhi/Buoi

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_DSLop[],MATCH(T_HV[[#This Row],[TenLop]],T_DSLop[TenLop],0),MATCH(T_HV[[#Headers],[HocPhi/Buoi]],T_DSLop[#Headers],0)),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_DSLop[],MATCH(T_HV[[#This Row],[TenLop]],T_DSLop[TenLop],{n}),MATCH(T_HV[[#Headers],[HocPhi/Buoi]],T_DSLop[#Headers],{n})),"")`

### FR-0050 - DSHV / T_HV / Tinh trang HP

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[HP tồn]]<0,"Dư HP",IF(T_HV[[#This Row],[HP tồn]]>0,"Nợ HP","Đóng đủ"))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[HP tồn]]<{n},"Dư HP",IF(T_HV[[#This Row],[HP tồn]]>{n},"Nợ HP","Đóng đủ"))`

### FR-0051 - DSHV / T_HV / Tháng học

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nhap]]="","",YEAR(T_HV[[#This Row],[Ngay nhap]])&"-"&MONTH(T_HV[[#This Row],[Ngay nhap]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nhap]]="","",YEAR(T_HV[[#This Row],[Ngay nhap]])&"-"&MONTH(T_HV[[#This Row],[Ngay nhap]]))`

### FR-0052 - DSHV / T_HV / Tuần học

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `WEEKNUM(T_HV[[#This Row],[Ngay nhap]],2)`
- Mẫu chuẩn hóa: `WEEKNUM(T_HV[[#This Row],[Ngay nhap]],{n})`

### FR-0053 - DSHV / T_HV / Tuần nghỉ

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]="","",WEEKNUM(T_HV[[#This Row],[Ngay nghi]],2))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]="","",WEEKNUM(T_HV[[#This Row],[Ngay nghi]],{n}))`

### FR-0054 - DSHV / T_HV / Tháng nghỉ học

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]="","",YEAR(T_HV[[#This Row],[Ngay nghi]])&"-"&MONTH(T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]="","",YEAR(T_HV[[#This Row],[Ngay nghi]])&"-"&MONTH(T_HV[[#This Row],[Ngay nghi]]))`

### FR-0055 - DSHV / T_HV / 12

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AF$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AF$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AF{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AF{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0056 - DSHV / T_HV / 11

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AG$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AG$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AG{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AG{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0057 - DSHV / T_HV / 10

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AH$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AH$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AH{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AH{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0058 - DSHV / T_HV / 9

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AI$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AI$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AI{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AI{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0059 - DSHV / T_HV / 8

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AJ$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AJ$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AJ{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AJ{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0060 - DSHV / T_HV / 7

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AK$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AK$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AK{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AK{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0061 - DSHV / T_HV / 6

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AL$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AL$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AL{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AL{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0062 - DSHV / T_HV / 5

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AM$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AM$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AM{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AM{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0063 - DSHV / T_HV / 4

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AN$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AN$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AN{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AN{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0064 - DSHV / T_HV / 3

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AO$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AO$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AO{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AO{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0065 - DSHV / T_HV / 2

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AP$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AP$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AP{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AP{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0066 - DSHV / T_HV / 1

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HV[[#This Row],[Ngay nghi]]=0,COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AQ$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],$AQ$2,T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`
- Mẫu chuẩn hóa: `IF(T_HV[[#This Row],[Ngay nghi]]={n},COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AQ{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]]),COUNTIFS(T_ChiTietLop[TenLop],T_HV[[#This Row],[TenLop]],T_ChiTietLop[Tháng],AQ{row},T_ChiTietLop[Ngay thang],">="&T_HV[[#This Row],[Ngay nhap]],T_ChiTietLop[Ngay thang],"<"&T_HV[[#This Row],[Ngay nghi]]))`

### FR-0067 - DSHV / T_HV / T1

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AS$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AS{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0068 - DSHV / T_HV / T2

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AT$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AT{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0069 - DSHV / T_HV / T3

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AU$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AU{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0070 - DSHV / T_HV / T4

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AV$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AV{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0071 - DSHV / T_HV / T5

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AW$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AW{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0072 - DSHV / T_HV / T6

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AX$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AX{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0073 - DSHV / T_HV / T7

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AY$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AY{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0074 - DSHV / T_HV / T8

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$AZ$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!AZ{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0075 - DSHV / T_HV / T9

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$BA$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!BA{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0076 - DSHV / T_HV / T10

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$BB$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!BB{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0077 - DSHV / T_HV / T11

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$BC$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!BC{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0078 - DSHV / T_HV / T12

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!$BD$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[TongHP],T_HP[Thang va ho ten],DSHV!BD{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0079 - DSHV / T_HV / T13

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BE$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BE{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0080 - DSHV / T_HV / T14

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BF$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BF{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0081 - DSHV / T_HV / T15

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BG$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BG{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0082 - DSHV / T_HV / T16

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BH$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BH{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0083 - DSHV / T_HV / T17

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BI$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BI{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0084 - DSHV / T_HV / T18

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BJ$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BJ{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0085 - DSHV / T_HV / T19

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BK$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BK{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0086 - DSHV / T_HV / T20

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BL$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BL{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0087 - DSHV / T_HV / T21

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BM$33&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BM{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0088 - DSHV / T_HV / T22

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BN$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BN{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0089 - DSHV / T_HV / T23

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BO$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BO{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0090 - DSHV / T_HV / T24

- Số lần: 423
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!$BP$3&T_HV[[#This Row],[TenHV&MaHV]])`
- Mẫu chuẩn hóa: `SUMIFS(T_HP[Con lai],T_HP[Thang va ho ten],DSHV!BP{row}&T_HV[[#This Row],[TenHV&MaHV]])`

### FR-0091 - TheoDoiHP / T_HP / STT

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HP[[#This Row],[MaLop]]="",0,COUNTA($F$4:$F4))`
- Mẫu chuẩn hóa: `IF(T_HP[[#This Row],[MaLop]]="",{n},COUNTA(F{row}:F{row}))`

### FR-0092 - TheoDoiHP / T_HP / MaLop

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(INDEX(T_HV[[MaLop]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),1)="","",INDEX(T_HV[[MaLop]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),1)),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(INDEX(T_HV[[MaLop]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),{n})="","",INDEX(T_HV[[MaLop]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),{n})),"")`

### FR-0093 - TheoDoiHP / T_HP / TenLop

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_HV[[MaLop]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),2),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_HV[[MaLop]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),{n}),"")`

### FR-0094 - TheoDoiHP / T_HP / HP thang hien tai

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR((T_HP[[#This Row],[So buoi]]-T_HP[[#This Row],[Buoi nghi]]-T_HP[[#This Row],[Buoi tru]])*T_HP[[#This Row],[ĐG]],"")`
- Mẫu chuẩn hóa: `IFERROR((T_HP[[#This Row],[So buoi]]-T_HP[[#This Row],[Buoi nghi]]-T_HP[[#This Row],[Buoi tru]])*T_HP[[#This Row],[ĐG]],"")`

### FR-0095 - TheoDoiHP / T_HP / TienGiaoTrinh

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS(T_SachXuat[TienGiaoTrinh],T_SachXuat[TenHV&MaHV],T_HP[[#This Row],[Ten HV]],T_SachXuat[Tháng xuất],T_HP[[#This Row],[HP Tháng]])`
- Mẫu chuẩn hóa: `SUMIFS(T_SachXuat[TienGiaoTrinh],T_SachXuat[TenHV&MaHV],T_HP[[#This Row],[Ten HV]],T_SachXuat[Tháng xuất],T_HP[[#This Row],[HP Tháng]])`

### FR-0096 - TheoDoiHP / T_HP / TongHP

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(T_HP[[#This Row],[HP thang hien tai]]+T_HP[[#This Row],[TienGiaoTrinh]]+T_HP[[#This Row],[HP dau ky]],"")`
- Mẫu chuẩn hóa: `IFERROR(T_HP[[#This Row],[HP thang hien tai]]+T_HP[[#This Row],[TienGiaoTrinh]]+T_HP[[#This Row],[HP dau ky]],"")`

### FR-0097 - TheoDoiHP / T_HP / Con lai

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(T_HP[[#This Row],[TongHP]]-T_HP[[#This Row],[TienNop]],"")`
- Mẫu chuẩn hóa: `IFERROR(T_HP[[#This Row],[TongHP]]-T_HP[[#This Row],[TienNop]],"")`

### FR-0098 - TheoDoiHP / T_HP / HP ton thang truoc

- Số lần: 3903
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(T_HP[[#This Row],[Cong don]]-T_HP[[#This Row],[Con lai]],"")`
- Mẫu chuẩn hóa: `IFERROR(T_HP[[#This Row],[Cong don]]-T_HP[[#This Row],[Con lai]],"")`

### FR-0099 - TheoDoiHP / T_HP / Tình trạng đóng học phí

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HP[[#This Row],[Cong don]]>0,"Chưa TT",IF(T_HP[[#This Row],[Cong don]]=0,"Đã TT đủ","TT dư"))`
- Mẫu chuẩn hóa: `IF(T_HP[[#This Row],[Cong don]]>{n},"Chưa TT",IF(T_HP[[#This Row],[Cong don]]={n},"Đã TT đủ","TT dư"))`

### FR-0100 - TheoDoiHP / T_HP / Ten&Sdt

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(T_DSTest[Ten&Sdt],MATCH(T_HP[[#This Row],[MaSo]],T_DSTest[MaSo],0))`
- Mẫu chuẩn hóa: `INDEX(T_DSTest[Ten&Sdt],MATCH(T_HP[[#This Row],[MaSo]],T_DSTest[MaSo],{n}))`

### FR-0101 - TheoDoiHP / T_HP / MaSo

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(T_HV[],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),MATCH(T_HP[[#Headers],[MaSo]],T_HV[#Headers],0))`
- Mẫu chuẩn hóa: `INDEX(T_HV[],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),MATCH(T_HP[[#Headers],[MaSo]],T_HV[#Headers],{n}))`

### FR-0102 - TheoDoiHP / T_HP / TT học

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(T_HV[Tình trạng học],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0))`
- Mẫu chuẩn hóa: `INDEX(T_HV[Tình trạng học],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}))`

### FR-0103 - TheoDoiHP / T_HP / Thang va ho ten

- Số lần: 5967
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HP[[#This Row],[HP Tháng]]&T_HP[[#This Row],[Ten HV]]`
- Mẫu chuẩn hóa: `T_HP[[#This Row],[HP Tháng]]&T_HP[[#This Row],[Ten HV]]`

### FR-0104 - TheoDoiHP / T_HP / Ho ten

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `VLOOKUP(T_HP[[#This Row],[MaSo]],T_HV[[MaSo]:[Ho ten]],6,0)`
- Mẫu chuẩn hóa: `VLOOKUP(T_HP[[#This Row],[MaSo]],T_HV[[MaSo]:[Ho ten]],{n},{n})`

### FR-0105 - TheoDoiHP / T_HP / Ngay NH

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(T_HV[[Ngay nhap]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),1)`
- Mẫu chuẩn hóa: `INDEX(T_HV[[Ngay nhap]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),{n})`

### FR-0106 - TheoDoiHP / T_HP / Ngay KT

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(INDEX(T_HV[[Ngay nhap]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),2)="","",INDEX(T_HV[[Ngay nhap]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),2))`
- Mẫu chuẩn hóa: `IF(INDEX(T_HV[[Ngay nhap]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),{n})="","",INDEX(T_HV[[Ngay nhap]:[TenHV&MaHV]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),{n}))`

### FR-0107 - TheoDoiHP / T_HP / ĐG

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(VLOOKUP(T_HP[[#This Row],[Ten HV]],T_HV[[TenHV&MaHV]:[HocPhi/Buoi]],3,0)*(1-T_HP[[#This Row],[Hoc bong]]-T_HP[[#This Row],[HB dieu chinh]]),"")`
- Mẫu chuẩn hóa: `IFERROR(VLOOKUP(T_HP[[#This Row],[Ten HV]],T_HV[[TenHV&MaHV]:[HocPhi/Buoi]],{n},{n})*({n}-T_HP[[#This Row],[Hoc bong]]-T_HP[[#This Row],[HB dieu chinh]]),"")`

### FR-0108 - TheoDoiHP / T_HP / So buoi

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_HV[[TenHV&MaHV]:[1]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),MATCH(T_HP[[#This Row],[HP Tháng]],DSHV!$W$3:$AQ$3,0)),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_HV[[TenHV&MaHV]:[{n}]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),MATCH(T_HP[[#This Row],[HP Tháng]],DSHV!W{row}:AQ{row},{n})),"")`

### FR-0109 - TheoDoiHP / T_HP / Buoi nghi

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF((T_HP[[#This Row],[HP Tháng]]-1)=1,0,IF(T_HP[[#This Row],[Ngay KT]]="",COUNTIFS(T_ChiTietLop[TenLop],T_HP[[#This Row],[TenLop]],T_ChiTietLop[TTHoc],"K",T_ChiTietLop[Tháng],(T_HP[[#This Row],[HP Tháng]]-1),T_ChiTietLop[Ngay thang],">="&T_HP[[#This Row],[Ngay NH]]),COUNTIFS(T_ChiTietLop[TenLop],T_HP[[#This Row],[TenLop]],T_ChiTietLop[TTHoc],"K",T_ChiTietLop[Tháng],(T_HP[[#This Row],[HP Tháng]]-1),T_ChiTietLop[Ngay thang],">="&T_HP[[#This Row],[Ngay NH]],T_ChiTietLop[Ngay thang],"<"&T_HP[[#This Row],[Ngay KT]])))`
- Mẫu chuẩn hóa: `IF((T_HP[[#This Row],[HP Tháng]]-{n})={n},{n},IF(T_HP[[#This Row],[Ngay KT]]="",COUNTIFS(T_ChiTietLop[TenLop],T_HP[[#This Row],[TenLop]],T_ChiTietLop[TTHoc],"K",T_ChiTietLop[Tháng],(T_HP[[#This Row],[HP Tháng]]-{n}),T_ChiTietLop[Ngay thang],">="&T_HP[[#This Row],[Ngay NH]]),COUNTIFS(T_ChiTietLop[TenLop],T_HP[[#This Row],[TenLop]],T_ChiTietLop[TTHoc],"K",T_ChiTietLop[Tháng],(T_HP[[#This Row],[HP Tháng]]-{n}),T_ChiTietLop[Ngay thang],">="&T_HP[[#This Row],[Ngay NH]],T_ChiTietLop[Ngay thang],"<"&T_HP[[#This Row],[Ngay KT]])))`

### FR-0110 - TheoDoiHP / T_HP / Hoc bong

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(T_HV[Column4],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0))`
- Mẫu chuẩn hóa: `INDEX(T_HV[Column4],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}))`

### FR-0111 - TheoDoiHP / T_HP / Cong don

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `SUMIFS($Q$4:Q4,$H$4:H4,H4)`
- Mẫu chuẩn hóa: `SUMIFS(Q{row}:Q{row},H{row}:H{row},H{row})`

### FR-0112 - TheoDoiHP / T_HP / Tuan TT

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_HP[[#This Row],[NgayNopTien]]="","",WEEKNUM(T_HP[[#This Row],[NgayNopTien]],2))`
- Mẫu chuẩn hóa: `IF(T_HP[[#This Row],[NgayNopTien]]="","",WEEKNUM(T_HP[[#This Row],[NgayNopTien]],{n}))`

### FR-0113 - TheoDoiHP / T_HP / Thang thanh toan

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_HP[[#This Row],[NgayNopTien]]=0,"",YEAR(T_HP[[#This Row],[NgayNopTien]])&"-"&MONTH(T_HP[[#This Row],[NgayNopTien]])),YEAR(TODAY())&"-"&T_HP[[#This Row],[HP Tháng]])`
- Mẫu chuẩn hóa: `IFERROR(IF(T_HP[[#This Row],[NgayNopTien]]={n},"",YEAR(T_HP[[#This Row],[NgayNopTien]])&"-"&MONTH(T_HP[[#This Row],[NgayNopTien]])),YEAR(TODAY())&"-"&T_HP[[#This Row],[HP Tháng]])`

### FR-0114 - TheoDoiHP / T_HP / Thang (1)

- Số lần: 5967
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HP[[#This Row],[HP Tháng]]+1`
- Mẫu chuẩn hóa: `T_HP[[#This Row],[HP Tháng]]+{n}`

### FR-0115 - TheoDoiHP / T_HP / Số buổi (1)

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_HV[[TenHV&MaHV]:[1]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),MATCH(T_HP[[#This Row],[Thang (1)]],DSHV!$W$3:$AQ$3,0)),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_HV[[TenHV&MaHV]:[{n}]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),MATCH(T_HP[[#This Row],[Thang ({n})]],DSHV!W{row}:AQ{row},{n})),"")`

### FR-0116 - TheoDoiHP / T_HP / Học phí (1)

- Số lần: 5967
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HP[[#This Row],[Số buổi (1)]]*T_HP[[#This Row],[ĐG]]`
- Mẫu chuẩn hóa: `T_HP[[#This Row],[Số buổi ({n})]]*T_HP[[#This Row],[ĐG]]`

### FR-0117 - TheoDoiHP / T_HP / Thang (2)

- Số lần: 5967
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HP[[#This Row],[HP Tháng]]+2`
- Mẫu chuẩn hóa: `T_HP[[#This Row],[HP Tháng]]+{n}`

### FR-0118 - TheoDoiHP / T_HP / Số buổi (2)

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_HV[[TenHV&MaHV]:[1]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],0),MATCH(T_HP[[#This Row],[Thang (2)]],DSHV!$W$3:$AQ$3,0)),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_HV[[TenHV&MaHV]:[{n}]],MATCH(T_HP[[#This Row],[Ten HV]],T_HV[TenHV&MaHV],{n}),MATCH(T_HP[[#This Row],[Thang ({n})]],DSHV!W{row}:AQ{row},{n})),"")`

### FR-0119 - TheoDoiHP / T_HP / Học phí (2)

- Số lần: 5967
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HP[[#This Row],[Số buổi (2)]]*T_HP[[#This Row],[ĐG]]`
- Mẫu chuẩn hóa: `T_HP[[#This Row],[Số buổi ({n})]]*T_HP[[#This Row],[ĐG]]`

### FR-0120 - TheoDoiHP / T_HP / Cộng dồn (2)

- Số lần: 5967
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_HP[[#This Row],[Cong don]]+T_HP[[#This Row],[Học phí (1)]]+T_HP[[#This Row],[Học phí (2)]]`
- Mẫu chuẩn hóa: `T_HP[[#This Row],[Cong don]]+T_HP[[#This Row],[Học phí ({n})]]+T_HP[[#This Row],[Học phí ({n})]]`

### FR-0121 - TheoDoiHP / T_HP / Column2

- Số lần: 3902
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `VLOOKUP(T_HP[[#This Row],[Ten HV]],#REF!,36,0)`
- Mẫu chuẩn hóa: `VLOOKUP(T_HP[[#This Row],[Ten HV]],#REF!,{n},{n})`

### FR-0122 - XuatNhapSach / T_SachTon / STT

- Số lần: 170
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_SachTon[[#This Row],[MaLop]]=0,0,SUBTOTAL(3,$AJ$7:T_SachTon[[#This Row],[MaLop]]))`
- Mẫu chuẩn hóa: `IF(T_SachTon[[#This Row],[MaLop]]={n},{n},SUBTOTAL({n},AJ{row}:T_SachTon[[#This Row],[MaLop]]))`

### FR-0123 - XuatNhapSach / T_SachTon / Column3

- Số lần: 170
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(T_SachTon[[#This Row],[Column1]]-T_SachTon[[#This Row],[Column2]]+T_SachTon[[#This Row],[Số Lượng]],"")`
- Mẫu chuẩn hóa: `IFERROR(T_SachTon[[#This Row],[Column1]]-T_SachTon[[#This Row],[Column2]]+T_SachTon[[#This Row],[Số Lượng]],"")`

### FR-0124 - XuatNhapSach / T_SachTon / Column1

- Số lần: 170
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF($AO$5<>0,SUMIFS(T_SachNhap[SL nhập],T_SachNhap[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachNhap[Tháng nhập],$AO$5),SUMIF(T_SachNhap[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachNhap[SL nhập]))`
- Mẫu chuẩn hóa: `IF(AO{row}<>{n},SUMIFS(T_SachNhap[SL nhập],T_SachNhap[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachNhap[Tháng nhập],AO{row}),SUMIF(T_SachNhap[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachNhap[SL nhập]))`

### FR-0125 - XuatNhapSach / T_SachTon / Column2

- Số lần: 169
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF($AP$5<>0,SUMIFS(T_SachXuat[SL],T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[Tháng xuất],$AP$5),SUMIF(T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[SL]))`
- Mẫu chuẩn hóa: `IF(AP{row}<>{n},SUMIFS(T_SachXuat[SL],T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[Tháng xuất],AP{row}),SUMIF(T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[SL]))`

### FR-0126 - XuatNhapSach / T_SachTon / Column2

- Số lần: 1
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF($AP$5<>0,SUMIFS(T_SachXuat[SL],T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[Tháng xuất],$AP$5),SUMIF(T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[SL])),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(AP{row}<>{n},SUMIFS(T_SachXuat[SL],T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[Tháng xuất],AP{row}),SUMIF(T_SachXuat[TenSach],T_SachTon[[#This Row],[TenSach]],T_SachXuat[SL])),"")`

### FR-0127 - XuatNhapSach / T_SachNhap / Tổng tiền

- Số lần: 163
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_SachNhap[[#This Row],[SL nhập]]*T_SachNhap[[#This Row],[Đơn giá]]`
- Mẫu chuẩn hóa: `T_SachNhap[[#This Row],[SL nhập]]*T_SachNhap[[#This Row],[Đơn giá]]`

### FR-0128 - XuatNhapSach / T_SachNhap / Tháng nhập

- Số lần: 163
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `MONTH(T_SachNhap[[#This Row],[Ngày tháng]])`
- Mẫu chuẩn hóa: `MONTH(T_SachNhap[[#This Row],[Ngày tháng]])`

### FR-0129 - XuatNhapSach / T_SachXuat / STT

- Số lần: 2477
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_SachXuat[[#This Row],[MaLop]]=0,0,SUBTOTAL(3,$F$7:T_SachXuat[[#This Row],[MaLop]]))`
- Mẫu chuẩn hóa: `IF(T_SachXuat[[#This Row],[MaLop]]={n},{n},SUBTOTAL({n},F{row}:T_SachXuat[[#This Row],[MaLop]]))`

### FR-0130 - XuatNhapSach / T_SachXuat / DonGia

- Số lần: 2477
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(INDEX(T_SachTon[],MATCH(T_SachXuat[[#This Row],[TenSach]],T_SachTon[TenSach],0),MATCH(T_SachXuat[[#Headers],[DonGia]],T_SachTon[#Headers],0)),"")`
- Mẫu chuẩn hóa: `IFERROR(INDEX(T_SachTon[],MATCH(T_SachXuat[[#This Row],[TenSach]],T_SachTon[TenSach],{n}),MATCH(T_SachXuat[[#Headers],[DonGia]],T_SachTon[#Headers],{n})),"")`

### FR-0131 - XuatNhapSach / T_SachXuat / TienGiaoTrinh

- Số lần: 2477
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_SachXuat[[#This Row],[Column3]]="",T_SachXuat[[#This Row],[DonGia]]*T_SachXuat[[#This Row],[SL]],0),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(T_SachXuat[[#This Row],[Column3]]="",T_SachXuat[[#This Row],[DonGia]]*T_SachXuat[[#This Row],[SL]],{n}),"")`

### FR-0132 - XuatNhapSach / T_SachXuat / TTTien

- Số lần: 2477
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IFERROR(IF(T_SachXuat[[#This Row],[Column3]]="",IF(T_SachXuat[[#This Row],[TienGiaoTrinh]]<=INDEX(T_HP[Con lai],MATCH(T_SachXuat[[#This Row],[TenHV&MaHV]],T_HP[Ten HV],0)),"Chưa TT","Đã TT"),T_SachXuat[[#This Row],[Column3]]),"")`
- Mẫu chuẩn hóa: `IFERROR(IF(T_SachXuat[[#This Row],[Column3]]="",IF(T_SachXuat[[#This Row],[TienGiaoTrinh]]<=INDEX(T_HP[Con lai],MATCH(T_SachXuat[[#This Row],[TenHV&MaHV]],T_HP[Ten HV],{n})),"Chưa TT","Đã TT"),T_SachXuat[[#This Row],[Column3]]),"")`

### FR-0133 - XuatNhapSach / T_SachXuat / Tháng xuất

- Số lần: 2477
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `MONTH(T_SachXuat[[#This Row],[NgayThang]])`
- Mẫu chuẩn hóa: `MONTH(T_SachXuat[[#This Row],[NgayThang]])`

### FR-0134 - Thu-Chi / T_Chi / Tháng chi

- Số lần: 317
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `YEAR(T_Chi[[#This Row],[Ngày tháng]])&"-"&MONTH(T_Chi[[#This Row],[Ngày tháng]])`
- Mẫu chuẩn hóa: `YEAR(T_Chi[[#This Row],[Ngày tháng]])&"-"&MONTH(T_Chi[[#This Row],[Ngày tháng]])`

### FR-0135 - Thu-Chi / T_Chi / Tuan chi

- Số lần: 317
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_Chi[[#This Row],[Ngày tháng]]="","",WEEKNUM(T_Chi[[#This Row],[Ngày tháng]],2))`
- Mẫu chuẩn hóa: `IF(T_Chi[[#This Row],[Ngày tháng]]="","",WEEKNUM(T_Chi[[#This Row],[Ngày tháng]],{n}))`

### FR-0136 - Thu-Chi / T_Thu / Tháng thu

- Số lần: 148
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `YEAR(T_Thu[[#This Row],[Ngày tháng]])&"-"&MONTH(T_Thu[[#This Row],[Ngày tháng]])`
- Mẫu chuẩn hóa: `YEAR(T_Thu[[#This Row],[Ngày tháng]])&"-"&MONTH(T_Thu[[#This Row],[Ngày tháng]])`

### FR-0137 - Thu-Chi / T_Thu / Tuan thu

- Số lần: 148
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_Thu[[#This Row],[Ngày tháng]]="","",WEEKNUM(T_Thu[[#This Row],[Ngày tháng]],2))`
- Mẫu chuẩn hóa: `IF(T_Thu[[#This Row],[Ngày tháng]]="","",WEEKNUM(T_Thu[[#This Row],[Ngày tháng]],{n}))`

### FR-0138 - DSLop / T_DSLop / Ten lop

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSLop[[#This Row],[MaLop]]&"-"&T_DSLop[[#This Row],[Lop]]`
- Mẫu chuẩn hóa: `T_DSLop[[#This Row],[MaLop]]&"-"&T_DSLop[[#This Row],[Lop]]`

### FR-0139 - DSLop / T_DSLop / NgayKTDuKien

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSLop[[#This Row],[NgayBD]]+(T_DSLop[[#This Row],[SLBuoiHoc]]+T_DSLop[[#This Row],[So buoi nghi]])`
- Mẫu chuẩn hóa: `T_DSLop[[#This Row],[NgayBD]]+(T_DSLop[[#This Row],[SLBuoiHoc]]+T_DSLop[[#This Row],[So buoi nghi]])`

### FR-0140 - DSLop / T_DSLop / So buoi nghi

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `COUNTIFS(T_ChiTietLop[TenLop],T_DSLop[[#This Row],[Ten lop]],T_ChiTietLop[TTHoc],"K")`
- Mẫu chuẩn hóa: `COUNTIFS(T_ChiTietLop[TenLop],T_DSLop[[#This Row],[Ten lop]],T_ChiTietLop[TTHoc],"K")`

### FR-0141 - DSLop / T_DSLop / Column4

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `COUNTIFS(T_ChiTietLop[TenLop],T_DSLop[[#This Row],[TenLop]],T_ChiTietLop[TTHoc],"C")`
- Mẫu chuẩn hóa: `COUNTIFS(T_ChiTietLop[TenLop],T_DSLop[[#This Row],[TenLop]],T_ChiTietLop[TTHoc],"C")`

### FR-0142 - DSLop / T_DSLop / Con lai

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSLop[[#This Row],[SLBuoiHoc]]-T_DSLop[[#This Row],[Column4]]-T_DSLop[[#This Row],[Buoi so]]`
- Mẫu chuẩn hóa: `T_DSLop[[#This Row],[SLBuoiHoc]]-T_DSLop[[#This Row],[Column4]]-T_DSLop[[#This Row],[Buoi so]]`

### FR-0143 - DSLop / T_DSLop / TenLop

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSLop[[#This Row],[MaLop]]&"-"&T_DSLop[[#This Row],[Lop]]`
- Mẫu chuẩn hóa: `T_DSLop[[#This Row],[MaLop]]&"-"&T_DSLop[[#This Row],[Lop]]`

### FR-0144 - DSLop / T_DSLop / BuoiHoc/Tuan

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(Table2[],MATCH(T_DSLop[[#This Row],[MaLop]],Table2[MaLop],0),MATCH(T_DSLop[[#Headers],[BuoiHoc/Tuan]],Table2[#Headers],0))`
- Mẫu chuẩn hóa: `INDEX(Table2[],MATCH(T_DSLop[[#This Row],[MaLop]],Table2[MaLop],{n}),MATCH(T_DSLop[[#Headers],[BuoiHoc/Tuan]],Table2[#Headers],{n}))`

### FR-0145 - DSLop / T_DSLop / HocPhi/Buoi

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `INDEX(Table2[],MATCH(T_DSLop[[#This Row],[MaLop]],Table2[MaLop],0),MATCH(T_DSLop[[#Headers],[HocPhi/Buoi]],Table2[#Headers],0))`
- Mẫu chuẩn hóa: `INDEX(Table2[],MATCH(T_DSLop[[#This Row],[MaLop]],Table2[MaLop],{n}),MATCH(T_DSLop[[#Headers],[HocPhi/Buoi]],Table2[#Headers],{n}))`

### FR-0146 - DSLop / T_DSLop / Column1

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `T_DSLop[[#This Row],[BuoiHoc/Tuan]]*T_DSLop[[#This Row],[HocPhi/Buoi]]*4`
- Mẫu chuẩn hóa: `T_DSLop[[#This Row],[BuoiHoc/Tuan]]*T_DSLop[[#This Row],[HocPhi/Buoi]]*{n}`

### FR-0147 - DSLop / T_DSLop / SLHVNow

- Số lần: 34
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `COUNTIFS(T_HV[TenLop],T_DSLop[[#This Row],[TenLop]],T_HV[Tình trạng học],"Đang đi học")`
- Mẫu chuẩn hóa: `COUNTIFS(T_HV[TenLop],T_DSLop[[#This Row],[TenLop]],T_HV[Tình trạng học],"Đang đi học")`

### FR-0148 - NhanSu / T_NS / Tình trạng làm việc

- Số lần: 53
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `IF(T_NS[[#This Row],[Ngày nghỉ]]<>0,"Nghỉ ngang",IF(T_NS[[#This Row],[Hạn HĐ]]=0,"Chưa có info",IF(AND(T_NS[[#This Row],[Hạn HĐ]]-TODAY()>=0,T_NS[[#This Row],[Hạn HĐ]]-TODAY()<40),"Sắp hết hạn HĐ",IF(T_NS[[#This Row],[Hạn HĐ]]-TODAY()<0,"Đã hết hạn HĐ",""))))`
- Mẫu chuẩn hóa: `IF(T_NS[[#This Row],[Ngày nghỉ]]<>{n},"Nghỉ ngang",IF(T_NS[[#This Row],[Hạn HĐ]]={n},"Chưa có info",IF(AND(T_NS[[#This Row],[Hạn HĐ]]-TODAY()>={n},T_NS[[#This Row],[Hạn HĐ]]-TODAY()<{n}),"Sắp hết hạn HĐ",IF(T_NS[[#This Row],[Hạn HĐ]]-TODAY()<{n},"Đã hết hạn HĐ",""))))`

### FR-0149 - NhanSu / T_NS / Tháng năm nhận việc

- Số lần: 53
- Trạng thái: Cần chuyển thành Business Rule và UAT
- Công thức ví dụ: `MONTH(T_NS[[#This Row],[Ngày ký HĐ]])&"/"&YEAR(T_NS[[#This Row],[Ngày ký HĐ]])`
- Mẫu chuẩn hóa: `MONTH(T_NS[[#This Row],[Ngày ký HĐ]])&"/"&YEAR(T_NS[[#This Row],[Ngày ký HĐ]])`

# 6. Mô hình tự động hóa mục tiêu

| Trigger | Bước 1 | Bước 2 | Bước 3 | Bước 4 |

| --- | --- | --- | --- | --- |

| Lead tạo mới | Kiểm tra trùng phone/mã | Tạo task liên hệ | Gửi nhắc lịch test | Ghi audit |

| Lead hoàn tất test | Lưu kết quả | Duyệt xếp lớp | Tạo Student + Enrollment | Sinh dự kiến học phí |

| Tạo lịch lớp | Sinh ClassSession | Phân công GV/TG | Hiện lịch cá nhân | Sinh nhắc việc |

| Kết thúc buổi | Xác nhận trạng thái | Sinh Timesheet | Cập nhật số buổi | Đưa vào kỳ tính phí |

| Chốt công | Khóa Timesheet | Tính payroll | Sinh khoản chi lương | Cập nhật báo cáo |

| Phát sinh học phí | Sinh Charge | Áp học bổng/điều chỉnh | Cập nhật công nợ | Gửi nhắc nợ |

| Thu tiền | Tạo Payment | Phân bổ vào Charge | Đồng bộ sổ quỹ | Sinh phiếu thu + audit |

| Xuất giáo trình | Giảm tồn | Tạo charge giáo trình | Cập nhật công nợ | In phiếu xuất |



# 7. Module và route tối thiểu

## CRM Tuyển sinh

- `/leads`

- `/lead-detail`

- `/appointments`

- `/placement-tests`

- `/pipeline`

- `/conversion`

- `/interaction-history`



## Học viên

- `/students`

- `/student-detail`

- `/guardians`

- `/enrollments`

- `/status-history`

- `/student-debt`

- `/student-payments`

- `/student-materials`



## Lớp/Lịch

- `/courses`

- `/classes`

- `/class-detail`

- `/schedule-rules`

- `/sessions`

- `/calendar`

- `/assignments`

- `/substitutions`

- `/class-tasks`



## Chấm công

- `/timesheets`

- `/weekly-timesheet`

- `/monthly-timesheet`

- `/late-early-ot`

- `/approval`

- `/period-lock`

- `/adjustments`



## Học phí

- `/fee-policies`

- `/billing-periods`

- `/charges`

- `/invoices`

- `/payments`

- `/allocations`

- `/scholarships`

- `/credits`

- `/refunds`

- `/period-close`



## Kho

- `/books`

- `/stock-receipts`

- `/stock-issues`

- `/returns`

- `/stock-ledger`

- `/stock-balance`

- `/stocktake`

- `/adjustments`



## Thu chi

- `/cashbook`

- `/receipts`

- `/expenses`

- `/categories`

- `/approval`

- `/void-refund`

- `/attachments`



## HR/Lương

- `/employees`

- `/contracts`

- `/pay-policies`

- `/kpi-bonus-penalty`

- `/payroll-runs`

- `/payroll-lines`

- `/approval-lock`

- `/payslips`



## Báo cáo

- `/student-reports`

- `/lead-reports`

- `/revenue`

- `/debt-aging`

- `/tuition`

- `/materials`

- `/timesheet-payroll`

- `/cashflow`

- `/inventory`



## Quản trị

- `/branches`

- `/users`

- `/roles`

- `/permissions`

- `/master-data`

- `/audit`

- `/imports`

- `/exports`

- `/api-keys`

- `/integration-logs`

- `/backup-restore`



# 8. Entity model tối thiểu

- Organization

- Branch

- User

- Role

- Permission

- Employee

- EmploymentContract

- PayPolicy

- Lead

- Guardian

- LeadInteraction

- Appointment

- PlacementTest

- Student

- StudentGuardian

- Course

- Class

- ScheduleRule

- ClassSession

- SessionAssignment

- Enrollment

- EnrollmentStatusHistory

- TimesheetEntry

- TimesheetPeriod

- FeePolicy

- BillingPeriod

- Charge

- Invoice

- Payment

- PaymentAllocation

- Scholarship

- Adjustment

- CreditBalance

- Refund

- Book

- StockLocation

- StockTransaction

- BookIssue

- CashTransaction

- TransactionCategory

- PayrollRun

- PayrollLine

- Task

- Notification

- Attachment

- AuditLog

- ImportJob

- IntegrationLog



# 9. State machines bắt buộc

| Đối tượng | State machine |

| --- | --- |

| Lead | NEW → CONTACTING → APPOINTED → TESTED → QUALIFIED/UNQUALIFIED → ENROLLED/LOST |

| Enrollment | PENDING → ACTIVE → PAUSED → TRANSFERRED → COMPLETED/WITHDRAWN |

| ClassSession | PLANNED → CONFIRMED → COMPLETED/CANCELLED/RESCHEDULED |

| Timesheet period | DRAFT → SUBMITTED → APPROVED → LOCKED → REOPENED |

| Billing period | DRAFT → GENERATED → REVIEWED → POSTED → CLOSED → REOPENED |

| Payment | DRAFT → CONFIRMED → ALLOCATED → PARTIALLY_REFUNDED/REFUNDED/VOIDED |

| Stock document | DRAFT → APPROVED → POSTED → REVERSED |

| Payroll run | DRAFT → CALCULATED → REVIEWED → APPROVED → LOCKED → PAID |



# 10. Permission action model

- view

- create

- update

- delete

- import

- export

- submit

- approve

- reject

- post

- close

- reopen

- refund

- transfer

- void

- restore

- view_sensitive

- view_financial

- manage_scope



Permission key đề xuất: `resource.action.scope`, ví dụ `payment.refund.branch`, `payroll.view_sensitive.branch`.

# 11. Non-functional requirements

| Nhóm | Yêu cầu |

| --- | --- |

| Data integrity | ACID transaction; idempotency cho payment/import; foreign key; version/optimistic lock |

| Audit | Before/after, user, timestamp, reason, correlation ID cho mọi dữ liệu quan trọng |

| Security | RBAC + branch scope; field masking; MFA cho admin/kế toán; encryption at rest/in transit |

| Performance | Danh sách server-side; index; report async; materialized view/read model |

| Availability | Backup hằng ngày; PITR; restore drill; monitoring; alerting |

| Migration | Import có staging, validation theo dòng, dry-run, rollback, reconciliation |

| Observability | Application log, job log, integration log, audit log tách biệt |

| Close period | Công/học phí/lương/quỹ phải có khóa kỳ và workflow mở lại |



# 12. Migration và reconciliation

1. Chụp bản nguồn + checksum

2. Profile lỗi/duplicate/null

3. Tạo ID mapping

4. Import master data

5. Import lead/student/enrollment

6. Import session/timesheet

7. Import charge/payment/credit

8. Import stock ledger

9. Import cashbook/payroll

10. Tái tính trên web

11. Đối chiếu theo học viên/lớp/tháng

12. UAT ký duyệt

13. Cutover + delta import

14. Khóa Excel vận hành

# 13. Golden reconciliation checklist

- Số lead theo trạng thái

- Số học viên đang học/nghỉ

- Sĩ số từng lớp

- Số buổi từng lớp/tháng

- Công GV/TG/NV

- Tổng học phí phải thu

- Tổng tiền đã thu

- Công nợ từng học viên

- Giá trị giáo trình đã xuất

- Tồn từng mã sách

- Tổng thu/chi/quỹ

- Tổng payroll từng kỳ



# 14. Các điểm tuyệt đối không tự động hóa trước khi chốt

- Công thức học phí có ngoại lệ nghỉ/chuyển lớp

- Quy tắc dạy thay và công TG2

- Chuyển credit giữa kỳ/người

- Hoàn tiền/hủy payment

- Mở lại kỳ đã chốt

- Âm kho và điều chỉnh kho

- Tính lương theo giờ/ca/tháng

- Quyền xem dữ liệu nhạy cảm

- Hợp nhất hồ sơ học viên trùng



# 15. Gate trước khi dev

| Gate | Điều kiện |

| --- | --- |

| G1 | Data Dictionary đã owner ký |

| G2 | Formula Catalog chuyển thành Business Rule |

| G3 | State machine được chốt |

| G4 | Permission matrix chi tiết |

| G5 | ERD + API contract review |

| G6 | Golden dataset và expected result |

| G7 | Migration rehearsal thành công |

| G8 | UAT và cutover plan |



# 16. Kết luận audit V2

Bản V2 không tuyên bố các suy luận chưa được xác nhận là sự thật. Cấu trúc Excel, bảng, cột, công thức và dependency đã được rà soát lại bằng chương trình. Phần còn thiếu không thể suy ra an toàn từ file đã được tách thành danh sách workshop/gate, nhằm ngăn đội dev tự hiểu sai khi chuyển từ thủ công sang tự động.

Các file CSV đi kèm là nguồn machine-readable để tiếp tục mapping database, API và testcase.
