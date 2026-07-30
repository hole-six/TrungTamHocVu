# Workbook Sync Status (2026-07-30)

## Đã đồng bộ vào file chính

- File chính: `docs/File Quan ly tong 2026.xlsx`
- File backup an toàn: `docs/File Quan ly tong 2026.backup-2026-07-30.xlsx`

## 13 sheet đã ghi từ ERP

- `Report_HS`
  - Tổng số HS: `1`
  - Đang học: `1`
  - Nghỉ học: `0`
  - Nhập học: `1`
  - Đã đưa summary vào khung report backup
- `Report_HP`
  - Kỳ học phí: `2026-07`
  - Số buổi: `8`
  - Giáo trình: `150,000`
  - Tổng học phí: `1,360,000`
  - Phải thu: `1,510,000`
  - Đã thu: `1,510,000`
  - Còn lại: `0`
  - Đã đưa summary vào vùng tổng hợp của backup
- `Report_Cong_Luong`
  - Kỳ gần nhất: `2026-07`
  - Giáo viên: `Nguyễn Minh Anh`
  - Giờ: `24`
  - Thành tiền: `4,320,000`
  - Đã đưa summary vào khung report backup
- `SinhNhatHV`
  - Tháng báo cáo: `2026-07`
  - Không có học viên sinh nhật trong tháng
  - Đã đưa summary vào khung report backup
- `TheoDoiHP`
  - Kỳ: `2026-07`
  - Học viên: `STU-0001 - Nguyễn Bảo Ngọc`
  - Lớp: `FF-A1 - First Friends A1`
  - Phải thu: `1,510,000`
  - Đã thu: `1,510,000`
  - Còn lại: `0`
  - Trạng thái: `PAID`
  - Đã đưa dữ liệu về khung cột backup bắt đầu tại vùng `E`
- `Thu-Chi`
  - Dòng 1: `THU` học phí `1,510,000`
  - Dòng 2: `CHI` giáo trình `1,500,000`
  - Người xử lý: `Lê Thu Trang`
  - Trạng thái: `CONFIRMED`
  - Đã đưa dữ liệu về khung summary/list của backup
- `XuatNhapSach`
  - Có dữ liệu tồn kho từ ERP
  - Có phiếu nhập kho `RECEIPT`
  - Có dòng xuất sách gắn học viên
  - Đã đưa dữ liệu xuất sách về khung backup từ cột `E`
- `NhanSu`
  - Có `3` nhân sự demo từ ERP
  - Có mã NV, tên ngắn, vị trí, trạng thái
  - Có thông tin hợp đồng/chính sách lương nếu tồn tại
  - Đã đưa dữ liệu về khung backup bắt đầu tại cột `D`
- `DSHV`
  - Có học viên `STU-0001`
  - Có mã hiển thị, lớp, ngày nhập học, trạng thái
  - Đã đưa dữ liệu về khung backup bắt đầu tại cột `E`
- `DSLop`
  - Có lớp `FF-A1`
  - Có khóa `FF`, số buổi, học phí/buổi, số học viên, trạng thái
  - Đã đưa dữ liệu về khung backup từ hàng `3`
- `DSTest`
  - Có lead `LEAD-0001`
  - Có ngày gặp `2026-06-20`
  - Có ngày test `2026-06-25`
  - Có trạng thái test `PASSED`
  - Có trạng thái tuyển sinh `ENROLLED`
  - Đã đưa dữ liệu về khung backup bắt đầu tại vùng `E4`
- `MucLuc`
  - Có lookup khung giờ từ lịch học ERP
  - Có `12` mã khóa/lớp từ bảng `Course`
  - Có đủ `7` mã thứ chuẩn hóa
  - Đã sắp lại theo thứ tự gần mẫu gốc
  - Đã patch trên template sheet backup để giữ khung worksheet gốc
- `ChiTietLopHoc`
  - Có đủ `52` trường nghiệp vụ trong sheet
  - Có dòng lớp học từ `ClassSession + SessionAssignment + StudentAttendance`
  - Có dòng chấm công từ `TimesheetEntry`
  - Đã đưa layout về khung mẫu gốc bắt đầu từ `E5`
  - Đã giữ lại cấu trúc worksheet gốc từ backup khi ghi dữ liệu

## Trạng thái còn lại

- Không còn sheet nghiệp vụ chính nào nằm ngoài pipeline sync hiện tại.
- Workbook vẫn là bản đồng bộ dữ liệu nghiệp vụ; chưa khôi phục toàn bộ format/pivot/cache phức tạp của file mẫu gốc.

## Kết luận

- Workbook chính hiện đã có `13` sheet phản ánh dữ liệu ERP thật.
- `MucLuc` và `ChiTietLopHoc` đã được nối vào pipeline patch ngày `2026-07-30`.
- `ChiTietLopHoc` hiện đã bám sát khung hiển thị của workbook backup thay vì dạng bảng phẳng từ `A1`.
- `MucLuc` và `ChiTietLopHoc` hiện được ghi theo kiểu “replace sheetData trên template backup”, giúp giữ format/cấu trúc tốt hơn.
- Nhóm sheet raw `TheoDoiHP`, `Thu-Chi`, `XuatNhapSach`, `NhanSu`, `DSHV`, `DSLop`, `DSTest` cũng đã được kéo về khung hiển thị backup thay vì chỉ đổ bảng phẳng.
- Nhóm sheet report `Report_HS`, `Report_HP`, `Report_Cong_Luong`, `SinhNhatHV` cũng đã được kéo về khung hiển thị backup.
- `Print_Area` của các sheet chính đã được rút về vùng dữ liệu thực thay vì vùng `#REF!` hoặc vùng quá rộng của file gốc.
- Các sheet có `table` chính như `T_HP`, `T_HV`, `T_DSTest`, `T_DSLop`, `T_NS` đã được canh lại để header/data rơi gần đúng hàng bắt đầu của template gốc.
- `table ref` và `autoFilter ref` của các bảng chính đã được co lại theo số dòng dữ liệu ERP thực tế thay vì giữ hàng nghìn dòng rỗng của file mẫu.
- `FilterDatabase` và `Print_Titles` của các sheet chính đã được đồng bộ lại theo vùng dữ liệu/header hiện tại.
- Database hiện đã phản ánh tốt khung cột chính của file Excel mẫu; phần cần làm tiếp nếu muốn là nâng độ giống bố cục/format 1:1 với workbook gốc.
