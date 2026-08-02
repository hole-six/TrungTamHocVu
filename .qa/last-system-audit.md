# Báo cáo audit hệ thống QA

- Thời gian: 2026-08-02T17:13:18.990Z
- Cơ sở: CS1 - Cơ sở 1
- Kết quả tổng: PASS (không còn P0)
- Checklist thủ công: QA_SYSTEM_AUDIT_CHECKLIST.md

## Tóm tắt coverage

- Kỳ học phí: 2026-07, 2026-08, 2026-09, 2026-10
- Học viên: 48
- Leads: 64
- Phụ huynh: 66
- User: 10
- Role: 11
- Sách: 110

## Severity

- PASS: 21
- P0: 0
- P1: 0
- P2: 0

## Findings

| Severity | Module | Check | Kết quả |
| --- | --- | --- | --- |
| PASS | dataset | Có đủ 4 kỳ học phí QA | Tìm thấy 4/4 kỳ cần cho audit. |
| PASS | tuition | Tổng phải thu khớp học phí + sách + nợ đầu kỳ | Có 0 charge sai cấu phần hoặc có số tiền không hợp lệ. |
| PASS | tuition | Không charge nào bị thu vượt số phải thu | Có 0 charge bị phân bổ vượt tổng phải thu. |
| PASS | tuition | Nhãn tài chính dùng đúng ngôn ngữ vận hành | Ba trạng thái chuẩn: Chưa thu / Đã thu một phần / Đã thu hết. |
| PASS | tuition | Dataset có đủ 3 kiểu thu | Theo tháng: 89, theo khóa: 11, trả góp: 12. |
| PASS | tuition | Dataset có đủ chưa thu / thu một phần / thu đủ | Đã thu hết: 18, thu một phần: 8, chưa thu: 86. |
| PASS | tuition | Có dữ liệu nợ đầu kỳ để test cộng dồn | Có 47 charge mang opening balance khác 0. |
| PASS | tuition | Tiền dư/ưu đãi áp dụng không làm tổng phải thu âm | Có 0 charge bị giảm xuống dưới 0đ. |
| PASS | students | Có dữ liệu học bổng và điều chỉnh | Học bổng: 3, điều chỉnh: 2. |
| PASS | inventory | Có case sách chuẩn xác nhận mua và từ chối mua | Đã xác nhận: 50, từ chối: 12. |
| PASS | classes | Có buổi bổ trợ còn khả dụng và đã dùng | Lớp bổ trợ: 2, credit còn: 6, credit đã dùng: 2. |
| PASS | tuition | Lớp bổ trợ không phát sinh học phí | Tìm thấy 0 charge ở lớp bổ trợ. |
| PASS | tuition | Có case khóa đã kết thúc nhưng vẫn còn nợ cuối khóa | Tìm thấy 1 charge nợ cuối khóa. |
| PASS | tuition | Batch invoice chỉ nên chứa người còn phải thu | Có 0 charge đã thu đủ vẫn đang hiện trong batch invoice. |
| PASS | tuition | Phiếu trong batch không bị lệch mode thu so với enrollment hiện tại | Có 0 charge đang lệch billingModel so với enrollment hiện tại. |
| PASS | tuition | Không còn exception queue khi sweep học phí | Có 0 exception từ preview charge generation. |
| PASS | cashbook | Tiền thực thu - hoàn tiền = allocation, đồng thời khớp sổ quỹ | Có 0 phiếu thu bị lệch giữa payment/allocation/quỹ. |
| PASS | inventory | Nhập kho = hạch toán kho = phiếu chi | Có 0 giao dịch kho lệch tiền. |
| PASS | assets | Bảo dưỡng tài sản có tiền bảo dưỡng và bút toán quỹ khớp | Có 0 giao dịch bảo dưỡng lệch tiền/hạch toán. |
| PASS | payroll | Payroll line khớp với session assignment và timesheet | Có 0 dòng lương lệch dữ liệu nguồn. |
| PASS | dataset | Dataset phủ đủ CRM / học viên / phụ huynh / user / sách | Leads: 64, students: 48, guardians: 66, users: 10, roles: 11, books: 110. |
