// DANH MỤC SÁCH CỦA TRUNG TÂM — chép đúng theo bảng "DANH SÁCH CÁC LOẠI SÁCH CỦA TRUNG TÂM"
// (2 trang, STT 1–27). Danh mục = MÃ LỚP trong bảng, tên sách và đơn giá giữ nguyên chữ.
//
// `total` là cột TỔNG (VNĐ) của bảng — dùng để ĐỐI CHIẾU: script seed sẽ cảnh báo khi tổng
// đơn giá trong nhóm không khớp con số này, thay vì âm thầm nhập sai tiền.
export type BookRow = {
  category: string;
  name: string;
  unitPrice: number;
  group?: string;
  /** Tên CŨ đang có trong hệ thống của cùng cuốn này — để cập nhật đúng cuốn đó thay vì
   *  tạo thêm một đầu sách gần giống, làm tách đôi tồn kho. */
  aliases?: string[];
};
export type BookGroup = { category: string; label?: string; total: number; items: BookRow[] };

const K = 1000;

export const BOOK_CATALOG: BookGroup[] = [
  // 1
  { category: "FF1", total: 110 * K, items: [
    { category: "FF1", name: "Bài tập tô màu FF1", unitPrice: 50 * K },
    { category: "FF1", name: "First Friends 1 - Classbook", unitPrice: 60 * K },
  ] },
  // 2
  { category: "FF2", total: 150 * K, items: [
    { category: "FF2", name: "First Friends 2 - Activity", unitPrice: 40 * K },
    { category: "FF2", name: "First Friends 2 - Classbook", unitPrice: 60 * K },
    { category: "FF2", name: "Bài tập tô màu FF2", unitPrice: 50 * K },
  ] },
  // 3
  { category: "PHONICS", total: 150 * K, items: [
    { category: "PHONICS", name: "Phonics World 2", unitPrice: 100 * K },
    { category: "PHONICS", name: "Phonics World 2 - Workbook", unitPrice: 50 * K },
  ] },
  // 4
  { category: "MY LITTLE ISLAND", total: 200 * K, items: [
    { category: "MY LITTLE ISLAND", name: "MY LITTLE ISLAND - STUDENT BOOK", unitPrice: 100 * K , aliases: ["My Little Island - Studentbook"] },
    { category: "MY LITTLE ISLAND", name: "MY LITTLE ISLAND - WORKBOOK", unitPrice: 100 * K , aliases: ["My Little Island - Workbook"] },
  ] },
  // 5
  { category: "LOOK", total: 200 * K, items: [{ category: "LOOK", name: "LOOK - STUDENT BOOK", unitPrice: 200 * K }] },
  // 6 — 2 học kỳ, mỗi kỳ 250.000
  { category: "VINS", label: "HK1", total: 250 * K, items: [
    { category: "VINS", name: "Cambridge Global English - HK1", unitPrice: 200 * K, group: "HK1" },
    { category: "VINS", name: "Cambridge Global English - Minitest - HK1", unitPrice: 50 * K, group: "HK1" },
  ] },
  { category: "VINS", label: "HK2", total: 250 * K, items: [
    { category: "VINS", name: "Cambridge Global English - HK2", unitPrice: 200 * K, group: "HK2" },
    { category: "VINS", name: "Cambridge Global English - Minitest - HK2", unitPrice: 50 * K, group: "HK2" },
  ] },
  // 7
  { category: "UP0", total: 350 * K, items: [
    { category: "UP0", name: "Everybody up 0 - Workbook", unitPrice: 50 * K },
    { category: "UP0", name: "Everybody up 0 - Writing", unitPrice: 50 * K },
    { category: "UP0", name: "Everybody up 0 - Student", unitPrice: 150 * K },
    { category: "UP0", name: "Everybody up 0 - Bộ Minitest", unitPrice: 50 * K },
    { category: "UP0", name: "Bài tập bổ trợ UP0 (BẢN CHUẨN)", unitPrice: 50 * K },
  ] },
  // 8
  { category: "UP1", total: 350 * K, items: [
    { category: "UP1", name: "Everybody up1 - Student", unitPrice: 150 * K },
    { category: "UP1", name: "Everybody up1 - Writing", unitPrice: 50 * K },
    { category: "UP1", name: "Everybody up1 - Workbook", unitPrice: 50 * K },
    { category: "UP1", name: "Everybody up1 - Bộ Minitest", unitPrice: 50 * K },
    { category: "UP1", name: "Bài tập bổ trợ UP1 (BẢN CHUẨN)", unitPrice: 50 * K },
  ] },
  // 9
  { category: "UP2", total: 350 * K, items: [
    { category: "UP2", name: "Everybody up2 - Student", unitPrice: 150 * K },
    { category: "UP2", name: "Everybody up2 - Writing", unitPrice: 50 * K },
    { category: "UP2", name: "Everybody up2 - Workbook", unitPrice: 50 * K },
    { category: "UP2", name: "Everybody up2 - Bộ Minitest", unitPrice: 50 * K },
    { category: "UP2", name: "Bài tập bổ trợ UP2 (BẢN CHUẨN)", unitPrice: 50 * K },
  ] },
  // 10
  { category: "UP3", total: 400 * K, items: [
    { category: "UP3", name: "Everybody up3 - Student", unitPrice: 150 * K },
    { category: "UP3", name: "Everybody up3 - Writing", unitPrice: 50 * K },
    { category: "UP3", name: "Everybody up3 - Workbook", unitPrice: 50 * K },
    { category: "UP3", name: "Everybody up3 - Bộ Minitest", unitPrice: 50 * K },
    { category: "UP3", name: "Everybody up3 - Tài liệu NP thêm (BT Bổ trợ Up)", unitPrice: 50 * K },
    { category: "UP3", name: "Bài tập bổ trợ UP3 (Global Success)", unitPrice: 50 * K },
  ] },
  // 11
  { category: "UP4", total: 400 * K, items: [
    { category: "UP4", name: "Everybody up4 - Student", unitPrice: 150 * K },
    { category: "UP4", name: "Everybody up4 - Writing", unitPrice: 50 * K },
    { category: "UP4", name: "Everybody up4 - Workbook", unitPrice: 50 * K },
    { category: "UP4", name: "Everybody up4 - Bộ Minitest", unitPrice: 50 * K },
    { category: "UP4", name: "Bài tập bổ trợ UP4 (Global Success)", unitPrice: 50 * K },
    { category: "UP4", name: "Everybody up4 - Tài liệu NP thêm (BT Bổ trợ Up)", unitPrice: 50 * K },
  ] },
  // 12
  { category: "UP5", total: 400 * K, items: [
    { category: "UP5", name: "Everybody up 5 - Student", unitPrice: 150 * K },
    { category: "UP5", name: "Everybody up 5 - Workbook", unitPrice: 50 * K },
    { category: "UP5", name: "Everybody up 5 - Writing", unitPrice: 50 * K },
    { category: "UP5", name: "Everybody up 5 - Bộ Minitest", unitPrice: 50 * K },
    { category: "UP5", name: "Bài tập bổ trợ UP5 (Global Success)", unitPrice: 50 * K },
    { category: "UP5", name: "Everybody up5 - Tài liệu NP thêm (BT Bổ trợ Up)", unitPrice: 50 * K },
  ] },
  // 13
  { category: "NP3", label: "Kỳ I", total: 230 * K, items: [
    { category: "NP3", name: "Ngữ Pháp 3 (SGK) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 3 - (SGK) - Kì 1"] },
    { category: "NP3", name: "Ngữ Pháp 3 (SBT) - Kì 1", unitPrice: 80 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 3 - Sách bài tập - Kì 1"] },
    { category: "NP3", name: "Ngữ Pháp 3 - Bộ Minitest + các tài liệu khác (Kỳ I)", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 3 - Bộ Minitest - Kì 1"] },
  ] },
  { category: "NP3", label: "Kỳ II", total: 230 * K, items: [
    { category: "NP3", name: "Ngữ Pháp 3 (SGK) - Kì 2", unitPrice: 100 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 3 - (SGK) - Kì 2"] },
    { category: "NP3", name: "Ngữ Pháp 3 (SBT) - Kì 2", unitPrice: 80 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 3 - Sách bài tập - Kì 2"] },
    { category: "NP3", name: "Ngữ Pháp 3 - Bộ Minitest + các tài liệu khác (Kỳ II)", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 3 - Bộ Minitest - Kì 2"] },
  ] },
  // 14
  { category: "NP4", label: "Kỳ I", total: 230 * K, items: [
    { category: "NP4", name: "Ngữ Pháp 4 (SGK) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 4 - (SGK) - Kì 1"] },
    { category: "NP4", name: "Ngữ Pháp 4 (SBT) - Kì 1", unitPrice: 80 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 4 - Sách bài tập - Kì 1"] },
    { category: "NP4", name: "Ngữ Pháp 4 - Bộ Minitest + các tài liệu khác (Kỳ I)", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 4 - Bộ Minitest - Kì 1"] },
  ] },
  { category: "NP4", label: "Kỳ II", total: 230 * K, items: [
    { category: "NP4", name: "Ngữ Pháp 4 (SGK) - Kì 2", unitPrice: 100 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 4 - (SGK) - Kì 2"] },
    { category: "NP4", name: "Ngữ Pháp 4 (SBT) - Kì 2", unitPrice: 80 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 4 - Sách bài tập - Kì 2"] },
    { category: "NP4", name: "Ngữ Pháp 4 - Bộ Minitest + các tài liệu khác (Kỳ II)", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 4 - Bộ Minitest - Kì 2"] },
  ] },
  // 15 — bảng in lệch dòng giá: tổng 2 kỳ đều ghi 230.000 nhưng cộng đơn giá ra 280.000 / 180.000.
  { category: "NP5", label: "Kỳ I", total: 230 * K, items: [
    { category: "NP5", name: "Ngữ Pháp 5 (SGK) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 5 - (SGK) - Kì 1"] },
    { category: "NP5", name: "Ngữ Pháp 5 (SBT) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 5 - Sách bài tập - Kì 1"] },
    { category: "NP5", name: "Ngữ Pháp 5 - Bộ Minitest + các tài liệu khác (Kỳ I)", unitPrice: 80 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 5 - Bộ Minitest - Kì 1"] },
  ] },
  { category: "NP5", label: "Kỳ II", total: 230 * K, items: [
    { category: "NP5", name: "Ngữ Pháp 5 (SGK) - Kì 2", unitPrice: 80 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 5 - (SGK) - Kì 2"] },
    { category: "NP5", name: "Ngữ Pháp 5 (SBT) - Kì 2", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 5 - Sách bài tập - Kì 2"] },
    { category: "NP5", name: "Ngữ Pháp 5 - Bộ Minitest + các tài liệu khác (Kỳ II)", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 5 - Bộ Minitest - Kì 2"] },
  ] },
  // 16
  { category: "NP6", label: "Kỳ I", total: 200 * K, items: [
    { category: "NP6", name: "Ngữ Pháp 6 (SGK) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 6 - (SGK) - Kì 1"] },
    { category: "NP6", name: "Ngữ Pháp 6 (SBT) - Kì 1", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 6 - (SBT) - Kì 1"] },
    { category: "NP6", name: "Ngữ Pháp 6 - Bộ Minitest + các tài liệu khác (Kỳ I)", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 6 - Bộ Minitest - Kì 1"] },
  ] },
  { category: "NP6", label: "Kỳ II", total: 200 * K, items: [
    { category: "NP6", name: "Ngữ Pháp 6 (SGK) - Kì 2", unitPrice: 100 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 6 - (SGK) - Kì 2"] },
    { category: "NP6", name: "Ngữ Pháp 6 (SBT) - Kì 2", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 6 - (SBT) - Kì 2"] },
    { category: "NP6", name: "Ngữ Pháp 6 - Bộ Minitest + các tài liệu khác (Kỳ II)", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 6 - Bộ Minitest - Kì 2"] },
  ] },
  // 17
  { category: "NP7", label: "Kỳ I", total: 200 * K, items: [
    { category: "NP7", name: "Ngữ Pháp 7 (SGK) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 7 - (SGK) - Kì 1"] },
    { category: "NP7", name: "Ngữ Pháp 7 (SBT) - Kì 1", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 7 - (SBT) - Kì 1"] },
    { category: "NP7", name: "Ngữ Pháp 7 - Bộ Minitest + các tài liệu khác (Kỳ I)", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 7 - Bộ Minitest - Kì 1"] },
  ] },
  { category: "NP7", label: "Kỳ II", total: 200 * K, items: [
    { category: "NP7", name: "Ngữ Pháp 7 (SGK) - Kì 2", unitPrice: 100 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 7 - (SGK) - Kì 2"] },
    { category: "NP7", name: "Ngữ Pháp 7 (SBT) - Kì 2", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 7 - (SBT) - Kì 2"] },
    { category: "NP7", name: "Ngữ Pháp 7 - Bộ Minitest + các tài liệu khác (Kỳ II)", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 7 - Bộ Minitest - Kì 2"] },
  ] },
  // 18
  { category: "NP8", label: "Kỳ I", total: 200 * K, items: [
    { category: "NP8", name: "Ngữ Pháp 8 (SGK) - Kì 1", unitPrice: 100 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 8 - (SGK) - Kì 1"] },
    { category: "NP8", name: "Ngữ Pháp 8 (SBT) - Kì 1", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 8 - (SBT) - Kì 1"] },
    { category: "NP8", name: "Ngữ Pháp 8 - Bộ Minitest + các tài liệu khác (Kỳ I)", unitPrice: 50 * K, group: "Kỳ I" , aliases: ["Ngữ Pháp 8 - Bộ Minitest - Kì 1"] },
  ] },
  { category: "NP8", label: "Kỳ II", total: 200 * K, items: [
    { category: "NP8", name: "Ngữ Pháp 8 (SGK) - Kì 2", unitPrice: 100 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 8 - (SGK) - Kì 2"] },
    { category: "NP8", name: "Ngữ Pháp 8 (SBT) - Kì 2", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 8 - (SBT) - Kì 2"] },
    { category: "NP8", name: "Ngữ Pháp 8 - Bộ Minitest + các tài liệu khác (Kỳ II)", unitPrice: 50 * K, group: "Kỳ II" , aliases: ["Ngữ Pháp 8 - Bộ Minitest - Kì 2"] },
  ] },
  // 19 — bảng ghi tổng 200.000 nhưng cộng đơn giá ra 300.000.
  { category: "SMART STARTER/ WONDERFUL", total: 200 * K, items: [
    { category: "SMART STARTER/ WONDERFUL", name: "Sách giáo khoa", unitPrice: 200 * K },
    { category: "SMART STARTER/ WONDERFUL", name: "Bộ Minitest", unitPrice: 50 * K },
    { category: "SMART STARTER/ WONDERFUL", name: "Những tài liệu khác", unitPrice: 50 * K },
  ] },
  // 20 — thu theo giai đoạn học của HS
  { category: "NP9", label: "Giai đoạn I", total: 200 * K, items: [
    { category: "NP9", name: "LTC3 - Các chuyên đề ngữ pháp luyện thi 10", unitPrice: 100 * K, group: "Giai đoạn I" },
    { category: "NP9", name: "LTC3 - Bộ Minitest", unitPrice: 50 * K, group: "Giai đoạn I" },
    { category: "NP9", name: "LTC3 - Các tài liệu khác", unitPrice: 50 * K, group: "Giai đoạn I" },
  ] },
  { category: "NP9", label: "Giai đoạn II", total: 250 * K, items: [
    { category: "NP9", name: "Ngữ Pháp 9 (SGK) - Kì 1 + Kỳ 2", unitPrice: 100 * K, group: "Giai đoạn II" },
    { category: "NP9", name: "Ngữ Pháp 9 - Bộ Minitest (Kỳ I + Kỳ II)", unitPrice: 100 * K, group: "Giai đoạn II" },
    { category: "NP9", name: "Ngữ Pháp 9 - Các tài liệu khác (Kỳ I + Kỳ II)", unitPrice: 50 * K, group: "Giai đoạn II" },
  ] },
  { category: "NP9", label: "Giai đoạn III", total: 200 * K, items: [
    { category: "NP9", name: "Ngữ pháp 9 - Luyện đề", unitPrice: 100 * K, group: "Giai đoạn III" },
    { category: "NP9", name: "Ngữ pháp 9 - Bộ minitest", unitPrice: 50 * K, group: "Giai đoạn III" },
    { category: "NP9", name: "Ngữ pháp 9 - Các tài liệu khác", unitPrice: 50 * K, group: "Giai đoạn III" },
  ] },
  // 21 — thu theo giai đoạn học của HS. Giai đoạn II: bảng ghi 250.000, cộng đơn giá ra 200.000.
  { category: "Luyện thi Đại học", label: "Giai đoạn I", total: 200 * K, items: [
    { category: "Luyện thi Đại học", name: "NPCB - Các chuyên đề ngữ pháp luyện thi 10", unitPrice: 100 * K, group: "Giai đoạn I" },
    { category: "Luyện thi Đại học", name: "NPCB - Bộ Minitest", unitPrice: 50 * K, group: "Giai đoạn I" },
    { category: "Luyện thi Đại học", name: "NPCB - Các tài liệu khác", unitPrice: 50 * K, group: "Giai đoạn I" },
  ] },
  { category: "Luyện thi Đại học", label: "Giai đoạn II", total: 250 * K, items: [
    { category: "Luyện thi Đại học", name: "NPNC - Các chuyên đề ngữ pháp luyện thi 10", unitPrice: 100 * K, group: "Giai đoạn II" },
    { category: "Luyện thi Đại học", name: "NPNC - Bộ Minitest", unitPrice: 50 * K, group: "Giai đoạn II" },
    { category: "Luyện thi Đại học", name: "NPNC - Các tài liệu khác", unitPrice: 50 * K, group: "Giai đoạn II" },
  ] },
  { category: "Luyện thi Đại học", label: "Giai đoạn III", total: 200 * K, items: [
    { category: "Luyện thi Đại học", name: "LTĐH - Luyện đề", unitPrice: 100 * K, group: "Giai đoạn III" },
    { category: "Luyện thi Đại học", name: "LTĐH - Bộ minitest", unitPrice: 50 * K, group: "Giai đoạn III" },
    { category: "Luyện thi Đại học", name: "LTĐH - Các tài liệu khác", unitPrice: 50 * K, group: "Giai đoạn III" },
  ] },
  // 22
  { category: "STARTERS", total: 600 * K, items: [
    { category: "STARTERS", name: "Tài liệu Cambridge Starters", unitPrice: 150 * K },
    { category: "STARTERS", name: "Fun For Starters", unitPrice: 100 * K },
    { category: "STARTERS", name: "Luyện nói Speaking Starters", unitPrice: 100 * K },
    { category: "STARTERS", name: "Tài liệu test Starters", unitPrice: 50 * K },
    { category: "STARTERS", name: "Skills Builder Starters", unitPrice: 200 * K },
  ] },
  // 23
  { category: "MOVERS", total: 700 * K, items: [
    { category: "MOVERS", name: "Tài liệu Cambridge Movers", unitPrice: 200 * K },
    { category: "MOVERS", name: "Fun For Movers", unitPrice: 150 * K },
    { category: "MOVERS", name: "Luyện nói Speaking Movers", unitPrice: 100 * K },
    { category: "MOVERS", name: "Tài liệu test Movers", unitPrice: 50 * K },
    { category: "MOVERS", name: "Skills Builder Movers", unitPrice: 200 * K },
  ] },
  // 24
  { category: "FLYERS", total: 700 * K, items: [
    { category: "FLYERS", name: "Fun For Flyers", unitPrice: 150 * K },
    { category: "FLYERS", name: "Luyện nói Speaking Flyers", unitPrice: 100 * K },
    { category: "FLYERS", name: "Tài liệu test Flyers", unitPrice: 50 * K },
    { category: "FLYERS", name: "Tài liệu Cambridge Flyers", unitPrice: 200 * K },
    { category: "FLYERS", name: "Skills Builder Flyers", unitPrice: 200 * K },
  ] },
  // 25 — thu theo giai đoạn học của HS
  { category: "SOLUTIONS 6", label: "Giai đoạn I", total: 200 * K, items: [
    { category: "SOLUTIONS 6", name: "Ngữ Pháp 6 (SGK) - Kì 1", unitPrice: 100 * K, group: "Giai đoạn I" },
    { category: "SOLUTIONS 6", name: "Ngữ Pháp 6 (SBT) - Kì 1", unitPrice: 50 * K, group: "Giai đoạn I" },
    { category: "SOLUTIONS 6", name: "Ngữ Pháp 6 - Bộ Minitest (Kỳ II)", unitPrice: 50 * K, group: "Giai đoạn I" },
  ] },
  { category: "SOLUTIONS 6", label: "Giai đoạn II", total: 450 * K, items: [
    { category: "SOLUTIONS 6", name: "Solutions 6 - Student book", unitPrice: 150 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 6", name: "Solutions 6 - Workbook", unitPrice: 100 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 6", name: "Solutions 6 - Tài liệu bổ trợ", unitPrice: 100 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 6", name: "Solutions 6 - Bộ Minitest", unitPrice: 50 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 6", name: "Solutions 6 - Các tài liệu khác", unitPrice: 50 * K, group: "Giai đoạn II" },
  ] },
  { category: "SOLUTIONS 6", label: "Giai đoạn III", total: 200 * K, items: [
    { category: "SOLUTIONS 6", name: "Ngữ Pháp 6 (SGK) - Kì 2", unitPrice: 100 * K, group: "Giai đoạn III" },
    { category: "SOLUTIONS 6", name: "Ngữ Pháp 6 (SBT) - Kì 2", unitPrice: 50 * K, group: "Giai đoạn III" },
    { category: "SOLUTIONS 6", name: "Ngữ Pháp 6 - Bộ Minitest (Kỳ 2)", unitPrice: 50 * K, group: "Giai đoạn III" },
  ] },
  // 26
  { category: "SOLUTIONS 7", label: "Giai đoạn I", total: 200 * K, items: [
    { category: "SOLUTIONS 7", name: "Các chuyên đề ngữ pháp cơ bản (L7)", unitPrice: 100 * K, group: "Giai đoạn I" },
    { category: "SOLUTIONS 7", name: "Bộ Minitest (L7 - Giai đoạn I)", unitPrice: 50 * K, group: "Giai đoạn I" },
    { category: "SOLUTIONS 7", name: "Các tài liệu khác (L7 - Giai đoạn I)", unitPrice: 50 * K, group: "Giai đoạn I" },
  ] },
  { category: "SOLUTIONS 7", label: "Giai đoạn II", total: 400 * K, items: [
    { category: "SOLUTIONS 7", name: "Solution Pre-Intermediate L7", unitPrice: 200 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 7", name: "Bài tập bổ trợ Pre-Intermediate L7", unitPrice: 150 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 7", name: "Bộ Minitest L7", unitPrice: 50 * K, group: "Giai đoạn II" },
  ] },
  // 27
  { category: "SOLUTIONS 8", label: "Giai đoạn I", total: 200 * K, items: [
    { category: "SOLUTIONS 8", name: "Các chuyên đề ngữ pháp cơ bản (L8)", unitPrice: 100 * K, group: "Giai đoạn I" },
    { category: "SOLUTIONS 8", name: "Bộ Minitest (L8 - Giai đoạn I)", unitPrice: 50 * K, group: "Giai đoạn I" },
    { category: "SOLUTIONS 8", name: "Các tài liệu khác (L8 - Giai đoạn I)", unitPrice: 50 * K, group: "Giai đoạn I" },
  ] },
  { category: "SOLUTIONS 8", label: "Giai đoạn II", total: 400 * K, items: [
    { category: "SOLUTIONS 8", name: "Solution Pre-Intermediate L8", unitPrice: 200 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 8", name: "Bài tập bổ trợ Pre-Intermediate L8", unitPrice: 150 * K, group: "Giai đoạn II" },
    { category: "SOLUTIONS 8", name: "Bộ Minitest L8", unitPrice: 50 * K, group: "Giai đoạn II" },
  ] },
];

export const ALL_BOOKS: BookRow[] = BOOK_CATALOG.flatMap((group) => group.items);
