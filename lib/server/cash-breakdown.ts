// BÓC TÁCH SỐ TIỀN CỦA MỘT PHIẾU THU — "850.000đ này gồm học phí bao nhiêu, sách bao nhiêu".
//
// Tiền phụ huynh đóng được gắn vào PHIẾU HỌC PHÍ (charge), không chỉ đích danh từng dòng
// trong phiếu. Mà mỗi phiếu học phí lại gồm 2 phần: học phí (tuitionAmount) và tiền giáo
// trình (materialsAmount). Nên muốn tách ra thì chia theo ĐÚNG TỈ LỆ cấu thành của phiếu
// đó; phần lẻ do làm tròn dồn vào học phí để tổng luôn khớp đúng số tiền đã thu, không
// bao giờ lệch 1đ so với con số trên sổ quỹ.
//
// Phần tiền đã thu nhưng chưa gắn vào phiếu nào là TIỀN ĐÓNG TRƯỚC (đóng dư, để dành trừ
// vào phiếu kỳ sau).

export type BreakdownAllocation = {
  amount: number;
  charge: { tuitionAmount: number; materialsAmount: number } | null;
};

export type CashAmountBreakdown = {
  tuition: number;
  materials: number;
  advance: number;
};

export function splitPaymentAmount(allocations: BreakdownAllocation[], paymentAmount: number): CashAmountBreakdown {
  let tuition = 0;
  let materials = 0;
  let allocated = 0;

  for (const allocation of allocations) {
    const charge = allocation.charge;
    if (!charge) continue;
    allocated += allocation.amount;
    const ownDue = charge.tuitionAmount + charge.materialsAmount;
    const materialsPart =
      ownDue > 0 ? Math.min(allocation.amount, Math.round((allocation.amount * charge.materialsAmount) / ownDue)) : 0;
    materials += materialsPart;
    tuition += allocation.amount - materialsPart;
  }

  return { tuition, materials, advance: Math.max(0, paymentAmount - allocated) };
}
