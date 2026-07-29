// Nhắc việc theo lớp — nguồn DSLop!N:S ("NHẮC VIỆC"). Quy tắc lặp lại (ClassTask) tách
// khỏi lịch sử từng lần thực hiện (ClassTaskLog) — trạng thái tính động từ so sánh
// dueDate/completedAt thay vì chuỗi IF lồng nhau như cột "Ket qua" gốc.

export const CLASS_TASK_RECURRENCES = ["MONTHLY_DAY", "WEEKDAY", "ONE_OFF"] as const;
export type ClassTaskRecurrence = (typeof CLASS_TASK_RECURRENCES)[number];

export const CLASS_TASK_RECURRENCE_LABEL: Record<string, string> = {
  MONTHLY_DAY: "Định kỳ theo ngày trong tháng",
  WEEKDAY: "Định kỳ theo thứ trong tuần",
  ONE_OFF: "Phát sinh một lần",
};

export const WEEKDAY_LABEL = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

type TaskRule = {
  recurrence: string;
  dayOfMonth: number | null;
  weekday: number | null;
  onceDate: Date | null;
};

// Kiểm tra một ClassTask có đến hạn vào ngày `date` hay không.
export function isTaskDueOn(task: TaskRule, date: Date): boolean {
  if (task.recurrence === "MONTHLY_DAY") return task.dayOfMonth === date.getDate();
  if (task.recurrence === "WEEKDAY") return task.weekday === date.getDay();
  if (task.recurrence === "ONE_OFF") {
    return !!task.onceDate && sameDay(task.onceDate, date);
  }
  return false;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type ClassTaskLogStatus = "PENDING" | "DONE_ON_TIME" | "DONE_LATE" | "OVERDUE";

export const CLASS_TASK_LOG_STATUS_LABEL: Record<ClassTaskLogStatus, string> = {
  PENDING: "Chưa tới hạn",
  DONE_ON_TIME: "Hoàn thành",
  DONE_LATE: "Hoàn thành muộn",
  OVERDUE: "Chưa hoàn thành (quá hạn)",
};

// Tương ứng cột "Ket qua" (FR-0007): so completedAt với dueDate, không cần so với "hôm nay"
// của từng hàng như Excel vì đây là 1 dòng cố định cho mỗi lần đến hạn.
export function computeTaskLogStatus(dueDate: Date, completedAt: Date | null, today: Date = new Date()): ClassTaskLogStatus {
  if (completedAt) {
    return sameDay(completedAt, dueDate) || completedAt <= dueDate ? "DONE_ON_TIME" : "DONE_LATE";
  }
  const dueEndOfDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 23, 59, 59);
  return today > dueEndOfDay ? "OVERDUE" : "PENDING";
}
