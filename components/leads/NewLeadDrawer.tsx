"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  classOptions: Array<{ id: string; className: string }>;
};

export default function NewLeadDrawer({ classOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSubmitError(null);

    const formData = new FormData(e.currentTarget);

    // Create lead
    const leadRes = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        gender: formData.get("gender") || null,
        dob: formData.get("dob") || null,
        currentSchoolGrade: formData.get("currentSchoolGrade") || null,
        guardianName: formData.get("guardianName") || null,
        phone: formData.get("phone") || null,
        secondaryPhone: formData.get("secondaryPhone") || null,
        address: formData.get("address") || null,
        facebookParentName: formData.get("facebookParentName") || null,
        facebookLink: formData.get("facebookLink") || null,
        zaloContact: formData.get("zaloContact") || null,
        status: "CONTACTING",
        meetDate: formData.get("meetDate") || null,
        source: formData.get("source") || null,
        initialAssessment: formData.get("initialAssessment") || null,
        pendingRemedialSessions: formData.get("pendingRemedialSessions") || null,
        expectedStartDate: formData.get("expectedStartDate") || null,
        interestedClassId: formData.get("interestedClassId") || null,
        notes: formData.get("notes") || null,
      }),
    });

    if (!leadRes.ok) {
      const errData = await leadRes.json().catch(() => ({}));
      setSubmitError(errData.error ?? "Lỗi khi tạo lead. Vui lòng thử lại.");
      setLoading(false);
      return;
    }

    const result = await leadRes.json();

    // Nếu có hẹn ngày test, tạo lịch test — lead ĐÃ tạo thành công ở bước trên rồi,
    // nên lỗi ở bước này không được nói như thể cả thao tác thất bại, và KHÔNG đóng
    // drawer để người dùng còn thấy cảnh báo (trước đây lỗi ở bước này bị nuốt hoàn
    // toàn — drawer vẫn tự đóng như đã thành công, không ai biết lịch test bị hụt).
    const scheduledTestDate = formData.get("scheduledTestDate");
    if (scheduledTestDate) {
      const testRes = await fetch(`/api/leads/${result.item.id}/placement-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: scheduledTestDate }),
      });
      if (!testRes.ok) {
        const testErrData = await testRes.json().catch(() => ({}));
        setSubmitError(
          `Đã tạo lead "${formData.get("fullName")}" thành công, nhưng không tạo được lịch hẹn test (${testErrData.error ?? "có lỗi xảy ra"}). Vào lại hồ sơ lead để đặt lịch test thủ công.`,
        );
        setLoading(false);
        router.refresh();
        return;
      }
    }

    setOpen(false);
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="hidden sm:inline">Thêm lead</span>
        <span className="sm:hidden">Thêm</span>
      </button>

      {/* Drawer Overlay */}
      {open && (
        <div className="slideover-root">
          {/* Backdrop */}
          <div 
            className="slideover-backdrop animate-fadeIn" 
            onClick={() => setOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="slideover-panel max-w-3xl">
            {/* Header */}
            <div className="slideover-header">
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#0f172a]">Thêm lead mới</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#64748b]">Tạo hồ sơ học viên tiềm năng vào CRM</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#f1f5f9] transition-colors"
                aria-label="Đóng"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="slideover-body space-y-5">
              {submitError ? <div className="alert-danger text-sm">{submitError}</div> : null}

              {/* Thông tin học viên tiềm năng */}
              <div className="card-sm">
                <h3 className="text-base sm:text-lg font-bold text-[#0f172a] mb-4">Thông tin học viên tiềm năng</h3>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label">Họ và tên <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      className="input"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Giới tính</label>
                      <select name="gender" className="input">
                        <option value="">Chọn giới tính</option>
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="label">Ngày sinh</label>
                      <input
                        type="date"
                        name="dob"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label">Lớp đang học ở trường</label>
                    <input
                      type="text"
                      name="currentSchoolGrade"
                      className="input"
                      placeholder="VD: Lớp 3"
                    />
                  </div>
                </div>
              </div>

              {/* Thông tin phụ huynh */}
              <div className="card-sm">
                <h3 className="text-base sm:text-lg font-bold text-[#0f172a] mb-4">Thông tin phụ huynh</h3>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label">Tên phụ huynh</label>
                    <input
                      type="text"
                      name="guardianName"
                      className="input"
                      placeholder="Họ tên bố/mẹ"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số điện thoại <span className="text-red-600">*</span></label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      className="input"
                      placeholder="0912345678"
                      pattern="[0-9]{10,11}"
                      title="Số điện thoại 10-11 chữ số"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Địa chỉ</label>
                    <textarea
                      name="address"
                      rows={2}
                      className="input"
                      placeholder="Số nhà, đường, phường/xã, quận/huyện"
                    />
                  </div>
                </div>
              </div>

              {/* Thông tin tuyển sinh */}
              <div className="card-sm">
                <h3 className="text-base sm:text-lg font-bold text-[#0f172a] mb-4">Thông tin tuyển sinh</h3>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label">Ngày dự kiến nhập học</label>
                    <input
                      type="date"
                      name="expectedStartDate"
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Lớp quan tâm</label>
                    <select name="interestedClassId" className="input">
                      <option value="">Chưa chọn</option>
                      {classOptions.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.className}
                        </option>
                      ))}
                    </select>
                    <p className="form-hint">Có thể để trống nếu mới là thông tin ban đầu</p>
                  </div>

                  <div className="form-group">
                    <label className="label">Đánh giá học lực ban đầu</label>
                    <textarea
                      name="initialAssessment"
                      rows={2}
                      className="input"
                      placeholder="VD: mất gốc toán, khá tiếng Anh, cần lớp tối..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số buổi bổ trợ dự kiến (nếu mất gốc)</label>
                    <input
                      type="number"
                      name="pendingRemedialSessions"
                      min={0}
                      max={60}
                      className="input"
                      placeholder="VD: 4"
                    />
                    <p className="form-hint">Sẽ tự cấp đúng số buổi bổ trợ này khi ghi danh lần đầu — không cần sang trang khác nhập.</p>
                  </div>

                  <div className="form-group">
                    <label className="label">Đặt lịch test ngay khi tạo lead (tùy chọn)</label>
                    <input
                      type="date"
                      name="scheduledTestDate"
                      className="input"
                    />
                    <p className="form-hint">Điền ngày để tạo lịch hẹn test luôn — trạng thái lead sẽ tự chuyển sang "Đã liên hệ".</p>
                  </div>
                </div>
              </div>

              {/* Thông tin bổ sung — tùy chọn, thu gọn mặc định để form gọn hơn */}
              <details className="card-sm">
                <summary className="cursor-pointer text-base sm:text-lg font-bold text-[#0f172a]">
                  Thông tin bổ sung (tùy chọn)
                </summary>
                <div className="space-y-4 mt-4">
                  <div className="form-group">
                    <label className="label">Nguồn lead</label>
                    <select name="source" className="input">
                      <option value="">Chọn nguồn</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Google">Google</option>
                      <option value="Giới thiệu">Giới thiệu</option>
                      <option value="Walk-in">Walk-in</option>
                      <option value="Website">Website</option>
                      <option value="Zalo">Zalo</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">SĐT thứ 2</label>
                      <input
                        type="tel"
                        name="secondaryPhone"
                        className="input"
                        placeholder="0987654321"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label">Ngày gặp/liên hệ</label>
                      <input
                        type="date"
                        name="meetDate"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Tên Facebook phụ huynh</label>
                      <input
                        type="text"
                        name="facebookParentName"
                        className="input"
                        placeholder="Tên hiển thị FB"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label">Zalo phụ huynh</label>
                      <input
                        type="text"
                        name="zaloContact"
                        className="input"
                        placeholder="SĐT Zalo hoặc tên Zalo"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label">Link Facebook</label>
                    <input
                      type="text"
                      name="facebookLink"
                      className="input"
                      placeholder="https://facebook.com/..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Ghi chú</label>
                    <textarea
                      name="notes"
                      rows={4}
                      className="input"
                      placeholder="Nhu cầu học, tính cách, điều kiện thời gian, lưu ý phụ huynh..."
                    />
                  </div>
                </div>
              </details>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-[#e6eefc] pt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost"
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M4 12a8 8 0 0 1 8-8" opacity="0.75" />
                      </svg>
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Tạo lead
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
