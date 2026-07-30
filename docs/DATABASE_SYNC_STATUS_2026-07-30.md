# Database Sync Status — 2026-07-30

## Mục tiêu

Đồng bộ lớp dữ liệu nghiệp vụ để database phản ánh ổn định hơn với logic mẫu từ workbook `docs/File Quan ly tong 2026.xlsx`, đặc biệt ở các trường suy ra theo công thức hoặc cache dễ lệch.

## Đã xử lý

- Thêm helper trung tâm tại `lib/server/database-sync.ts`
- Tự đồng bộ `Class.expectedEndDate`, `sessionsPerWeek`, `tuitionPerSession`
- Đồng bộ dây chuyền khi sửa `Course` sang các `Class` liên quan
- Đồng bộ `Student.studentDisplayId`, `Student.enrollDate`, `Student.status`
- Đồng bộ `Lead.actualEnrollDate`, `Lead.status` khi đã chuyển thành học viên
- Gắn `TimesheetEntry.periodId` tự động theo tháng và chi nhánh
- Đồng bộ cache `Book.quantityOnHand` sau nhập/xuất/điều chỉnh kho

## Route đã gắn sync

- `app/api/classes/route.ts`
- `app/api/classes/[id]/route.ts`
- `app/api/courses/[id]/route.ts`
- `app/api/classes/[id]/enrollments/route.ts`
- `app/api/enrollments/[id]/route.ts`
- `app/api/students/route.ts`
- `app/api/students/[id]/route.ts`
- `app/api/leads/[id]/convert/route.ts`
- `app/api/timesheet-entries/route.ts`
- `app/api/books/[id]/stock-transactions/route.ts`
- `app/api/books/[id]/issues/route.ts`

## Backfill đã chạy

Lúc `2026-07-30T04:38:22.030Z`, script `npm run sync:db` đã chạy xong với kết quả:

- `classes`: 1
- `students`: 1
- `leads`: 1
- `timesheetEntries`: 1
- `books`: 104

## Kiểm chứng

- `npm run build` ✅
- `npm run sync:db` ✅

## Ghi chú

- `studentDisplayId` mới được chuẩn hóa từ `classCode` + `studentCode` khi thiếu hoặc cần tự vá.
- `quantityOnHand` tiếp tục là cache, nhưng giờ được cập nhật lại ngay sau giao dịch và có script backfill để đối soát toàn bộ.
