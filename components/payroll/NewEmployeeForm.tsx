"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

const EMPTY = {
  fullName: "",
  shortName: "",
  position: "",
  phone: "",
  email: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  payMode: "HOURLY",
  teachingHourlyRate: "",
  assistantHourlyRate: "",
  staffDailyRate: "",
};

// Thêm nhân sự trong drawer thay vì form bung ra giữa trang danh sách — cùng lối với
// thêm học viên/lớp học, để bảng phía sau không bị đẩy đi khi đang nhập.
export default function NewEmployeeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Gắn cơ sở ngay lúc tạo: người mới thường đã biết sẽ chạy những cơ sở nào. Cơ sở
  // chính do hệ thống đặt theo cơ sở đang xem (POST /api/employees), ở đây chỉ chọn
  // THÊM. Gắn nhiều cơ sở không gộp số liệu — lương vẫn tính riêng từng nơi.
  const [branchOptions, setBranchOptions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [extraBranchIds, setExtraBranchIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || branchOptions.length > 0) return;
    let alive = true;
    fetch("/api/branches")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const items = Array.isArray(data) ? data : (data.items ?? data.branches ?? []);
        setBranchOptions(items.map((item: { id: string; code: string; name: string }) => ({ id: item.id, code: item.code, name: item.name })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, branchOptions.length]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo nhân viên.");
      return;
    }
    // Cơ sở chính đã được gắn ở API; ở đây chỉ bổ sung các cơ sở chọn thêm.
    if (data.item?.id && extraBranchIds.length > 0) {
      await fetch(`/api/employees/${data.item.id}/branches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: extraBranchIds }),
      }).catch(() => {});
    }
    setForm(EMPTY);
    setExtraBranchIds([]);
    setOpen(false);
    router.refresh();
  }

  const rateUnit = form.payMode === "SESSION" ? "ca" : "giờ";
  // Thực tế ở trung tâm (đối chiếu file quản lý 2026): 13 giáo viên / 8 trợ giảng,
  // chỉ 1 người làm cả hai vai và đơn giá 2 vai GIỐNG HỆT nhau. Nên mặc định hỏi
  // ĐÚNG 1 đơn giá cho việc đứng lớp, chỉ mở ra 2 ô khi thật sự trả khác nhau.
  const [splitRates, setSplitRates] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ACTION_CLASS}>
        + Thêm nhân viên
      </button>

      <ResponsiveDrawer open={open} onClose={() => setOpen(false)} title="Thêm nhân viên" widthClassName="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label-sm">Họ tên *</span>
              <input required className="input" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label-sm">Tên ngắn *</span>
              <input required className="input" value={form.shortName} onChange={(e) => set("shortName", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label-sm">Vị trí</span>
              <input className="input" value={form.position} onChange={(e) => set("position", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label-sm">SĐT</span>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label-sm">Email</span>
              <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-[#f1f5f9] pt-4 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="label-sm">Kiểu tính dạy/TG</span>
              <select className="input" value={form.payMode} onChange={(e) => set("payMode", e.target.value)}>
                <option value="HOURLY">Theo giờ</option>
                <option value="SESSION">Theo ca</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label-sm">Đơn giá đứng lớp / {rateUnit}</span>
              <input
                type="number"
                className="input"
                value={form.teachingHourlyRate}
                onChange={(e) => {
                  set("teachingHourlyRate", e.target.value);
                  // Mặc định trả cùng giá cho cả dạy lẫn trợ giảng — đúng thực tế đang dùng.
                  if (!splitRates) set("assistantHourlyRate", e.target.value);
                }}
              />
              <button
                type="button"
                onClick={() => setSplitRates((current) => !current)}
                className="text-[11px] font-semibold text-[#2563eb] hover:underline"
              >
                {splitRates ? "Dùng chung 1 đơn giá" : "Trả khác nhau khi trợ giảng?"}
              </button>
            </label>
            {splitRates ? (
              <label className="space-y-1">
                <span className="label-sm">Đơn giá trợ giảng / {rateUnit}</span>
                <input type="number" className="input" value={form.assistantHourlyRate} onChange={(e) => set("assistantHourlyRate", e.target.value)} />
              </label>
            ) : null}
            <label className="space-y-1">
              <span className="label-sm">Đơn giá 1 công HC</span>
              <input type="number" className="input" value={form.staffDailyRate} onChange={(e) => set("staffDailyRate", e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-[#f1f5f9] pt-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label-sm">Ngân hàng</span>
              <input className="input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label-sm">Số tài khoản</span>
              <input className="input" value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label-sm">Chủ tài khoản</span>
              <input className="input" value={form.bankAccountHolder} onChange={(e) => set("bankAccountHolder", e.target.value)} />
            </label>
          </div>

          {branchOptions.length > 1 ? (
            <div className="space-y-1">
              <span className="label-sm">Làm thêm ở cơ sở khác</span>
              <div className="flex flex-wrap gap-2">
                {branchOptions.map((branch) => {
                  const checked = extraBranchIds.includes(branch.id);
                  return (
                    <button
                      type="button"
                      key={branch.id}
                      onClick={() =>
                        setExtraBranchIds((current) =>
                          current.includes(branch.id) ? current.filter((item) => item !== branch.id) : [...current, branch.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        checked
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-indigo-200"
                      }`}
                    >
                      {branch.name}
                    </button>
                  );
                })}
              </div>
              <p className="form-hint">
                Hồ sơ vẫn thuộc cơ sở đang xem; chọn thêm ở đây chỉ để người này xuất hiện và được tính lương RIÊNG ở
                những cơ sở đó.
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className={ACTION_CLASS}>
              {loading ? "Đang lưu..." : "Lưu nhân viên"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost-sm">
              Hủy
            </button>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
