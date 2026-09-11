import type { Prisma } from "@prisma/client";
import { LEAD_STATUS_LABEL, PLACEMENT_TEST_STATUS_LABEL, type LeadStatus } from "@/lib/server/lead-rules";

// ĐỒNG BỘ TRẠNG THÁI LEAD THEO KẾT QUẢ TEST.
//
// Trước đây hai chỗ này cố tình KHÔNG liên quan gì nhau: kết quả test lưu ở
// PlacementTest.status, còn trạng thái lead thì "để nhân sự tự bấm". Hệ quả thực tế:
// chọn kết quả "Đạt" ở ô test nhưng trạng thái ngoài danh sách lead vẫn là "Đã liên hệ",
// nhân sự phải nhớ đi bấm thêm một lần nữa ở chỗ khác — và hầu như không ai nhớ, nên
// danh sách lead không phản ánh đúng tình hình thật.
//
// Quy tắc đồng bộ (chỉ chạy khi kết quả test THỰC SỰ đổi trong chính lần lưu đó):
//   Test "Đạt"              → lead "Đạt" (chờ xếp lớp)
//   Test "Không có nhu cầu" → lead "Không có nhu cầu"
//   Rời khỏi 2 kết quả trên → trả lead về "Đã liên hệ"
//   "Không đạt"/"Đã hủy hẹn"/"Đã hẹn chưa test" → KHÔNG đụng vào trạng thái lead
//
// Vì sao "Không đạt" không tự đóng lead: không đạt bài test đầu vào không có nghĩa là
// phụ huynh hết nhu cầu — thường là xếp xuống lớp thấp hơn hoặc cấp buổi bổ trợ. Việc
// đóng lead vẫn là quyết định của người tư vấn.
//
// Hai chốt chặn an toàn:
//   - ENROLLED thì không bao giờ đụng tới: đã tạo Student thật, đổi ngược là mất dấu.
//   - Chỉ TRẢ VỀ "Đã liên hệ" khi chính lần lưu này rời khỏi kết quả đã đồng bộ trước
//     đó. Nhờ vậy lead được nhân sự chủ động đặt "Đạt" mà không cần test (miễn test)
//     sẽ không bị kéo ngược.

// Kết quả test nào kéo lead sang trạng thái nào.
const TEST_STATUS_TO_LEAD_STATUS: Record<string, LeadStatus> = {
  PASSED: "QUALIFIED",
  NO_NEED: "LOST",
};

export type LeadStatusSyncResult = {
  changed: boolean;
  leadStatus: string;
  message: string | null;
};

export async function applyPlacementTestToLeadStatus(
  tx: Prisma.TransactionClient,
  params: {
    leadId: string;
    previousTestStatus: string | null;
    nextTestStatus: string;
    employeeId?: string | null;
  },
): Promise<LeadStatusSyncResult> {
  const { leadId, previousTestStatus, nextTestStatus, employeeId } = params;

  const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { status: true } });
  if (!lead) return { changed: false, leadStatus: "", message: null };
  // Đã ghi danh thì trạng thái do module Học viên quyết định, không kéo ngược được nữa.
  if (lead.status === "ENROLLED") return { changed: false, leadStatus: lead.status, message: null };
  if (previousTestStatus === nextTestStatus) return { changed: false, leadStatus: lead.status, message: null };

  const targetFromNext = TEST_STATUS_TO_LEAD_STATUS[nextTestStatus] ?? null;
  const targetFromPrevious = previousTestStatus ? TEST_STATUS_TO_LEAD_STATUS[previousTestStatus] ?? null : null;

  let nextLeadStatus: LeadStatus | null = null;
  if (targetFromNext) {
    nextLeadStatus = targetFromNext;
  } else if (targetFromPrevious && lead.status === targetFromPrevious) {
    // Vừa rời khỏi kết quả đã kéo lead lên trước đó → trả về mốc đang xử lý.
    nextLeadStatus = "CONTACTING";
  }

  if (!nextLeadStatus || nextLeadStatus === lead.status) {
    return { changed: false, leadStatus: lead.status, message: null };
  }

  await tx.lead.update({ where: { id: leadId }, data: { status: nextLeadStatus } });

  const message =
    `Kết quả test chuyển thành "${PLACEMENT_TEST_STATUS_LABEL[nextTestStatus] ?? nextTestStatus}" — ` +
    `trạng thái lead tự chuyển từ "${LEAD_STATUS_LABEL[lead.status as LeadStatus] ?? lead.status}" ` +
    `sang "${LEAD_STATUS_LABEL[nextLeadStatus]}".`;

  // Ghi lại vào lịch sử tương tác để sau này tra ra được VÌ SAO trạng thái đổi, thay vì
  // thấy một thay đổi không rõ ai làm.
  await tx.leadInteraction.create({
    data: { leadId, employeeId: employeeId ?? null, type: "MESSAGE", content: message },
  });

  return { changed: true, leadStatus: nextLeadStatus, message };
}
