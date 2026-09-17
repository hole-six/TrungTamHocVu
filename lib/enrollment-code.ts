// MÃ HỌC VIÊN TRONG LỚP.
//
// Quy ước của trung tâm: mỗi học sinh có DUY NHẤT một mã học sinh (Student.studentCode,
// cố định vĩnh viễn). Một em học nhiều lớp thì ở từng lớp gọi theo mã ghép:
//     <mã lớp>-<mã học sinh>
// Mã ghép chỉ là cách GỌI TÊN trong phạm vi lớp, không lưu thành cột riêng — lưu thêm
// một mã nữa là chắc chắn sẽ có lúc hai mã lệch nhau khi đổi lớp hoặc đổi mã lớp.
export function formatEnrollmentCode(classCode: string | null | undefined, studentCode: string | null | undefined): string {
  const student = (studentCode ?? "").trim();
  const cls = (classCode ?? "").trim();
  if (!student) return cls;
  if (!cls) return student;
  return `${cls}-${student}`;
}
