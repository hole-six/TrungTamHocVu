// GỢI Ý LỚP ĐANG HỌC Ở TRƯỜNG từ ngày sinh — dùng khi nhập lead mới.
//
// Theo quy định vào lớp 1 ở Việt Nam: trẻ vào lớp 1 trong năm TRÒN 6 TUỔI (tính theo năm
// sinh, không theo ngày sinh nhật), năm học bắt đầu từ tháng 9. Vì vậy:
//   lớp = năm bắt đầu năm học hiện tại − năm sinh − 5
// Ví dụ năm học 2026–2027 (từ 9/2026): sinh 2020 → lớp 1, sinh 2016 → lớp 5, sinh 2010 → lớp 11.
// Tháng 1–8 vẫn thuộc năm học bắt đầu từ năm trước. Tháng 6–8 là hè: đã học xong lớp đó,
// tháng 9 lên lớp tiếp theo — gợi ý kèm câu nhắc để tư vấn viên hỏi lại cho đúng.
// Chỉ là GỢI Ý: học sớm/muộn tuổi, lưu ban vẫn có — người nhập được sửa.

export type SchoolGradeSuggestion = {
  /** Giá trị điền vào ô "Lớp đang học ở trường", vd "Lớp 4", "Mầm non". */
  value: string;
  /** Cấp học, vd "Tiểu học". */
  level: string;
  /** Tuổi tính theo năm (năm hiện tại − năm sinh). */
  age: number;
  grade: number | null;
  /** Nhắc thêm (vd đang hè sắp lên lớp). */
  note: string | null;
};

export function suggestSchoolGrade(dobKey: string | null | undefined, today: Date = new Date()): SchoolGradeSuggestion | null {
  if (!dobKey || !/^\d{4}-\d{2}-\d{2}$/.test(dobKey)) return null;
  const birthYear = Number(dobKey.slice(0, 4));
  // Giờ Việt Nam: tránh đêm 31/8 giờ UTC còn tính nhầm sang năm học cũ.
  const vn = new Date(today.getTime() + 7 * 60 * 60 * 1000);
  const year = vn.getUTCFullYear();
  const month = vn.getUTCMonth() + 1;
  if (birthYear > year || year - birthYear > 60) return null;

  const schoolYearStart = month >= 9 ? year : year - 1;
  const grade = schoolYearStart - birthYear - 5;
  const age = year - birthYear;
  const summer = month >= 6 && month <= 8;

  if (grade >= 1 && grade <= 12) {
    const level = grade <= 5 ? "Tiểu học" : grade <= 9 ? "THCS" : "THPT";
    const note = summer
      ? grade < 12
        ? `Đang nghỉ hè: vừa học xong lớp ${grade}, tháng 9 lên lớp ${grade + 1}.`
        : "Đang nghỉ hè: vừa học xong lớp 12."
      : null;
    return { value: `Lớp ${grade}`, level, age, grade, note };
  }
  if (grade <= 0) {
    // Tuổi theo năm học: 3–5 tuổi học mẫu giáo, nhỏ hơn là nhà trẻ.
    const preschoolAge = schoolYearStart - birthYear;
    const note = summer && grade === 0 ? "Đang nghỉ hè: tháng 9 này vào lớp 1." : null;
    if (preschoolAge >= 3) return { value: "Mầm non", level: "Mẫu giáo", age, grade: null, note };
    return { value: "Nhà trẻ", level: "Nhà trẻ", age, grade: null, note: null };
  }
  return { value: "Đã học xong THPT", level: "Sau THPT", age, grade: null, note: null };
}
