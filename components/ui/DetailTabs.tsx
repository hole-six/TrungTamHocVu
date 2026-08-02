"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type DetailTab = { key: string; label: string; content: ReactNode };

// Vỏ tab dùng chung cho các trang chi tiết (học sinh, lớp học...) — tái dùng class
// .tab-bar/.tab-item/.tab-item-active có sẵn (app/globals.css, đang dùng ở
// ScholarshipAdjustmentForm) thay vì tạo CSS mới. Đồng bộ tab đang chọn vào query
// "?tab=" để có thể deep-link (vd link "Mở học phí" từ nơi khác trỏ thẳng vào đúng
// tab), giữ nguyên các query khác đang có trên URL. Nội dung tab không active dùng
// "hidden" (không unmount) — tránh các form con bị mất state cục bộ khi chuyển qua
// chuyển lại giữa các tab.
export default function DetailTabs({ tabs, defaultTabKey }: { tabs: DetailTab[]; defaultTabKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = searchParams.get("tab");
  const initial = tabs.some((t) => t.key === fromUrl) ? fromUrl! : tabs.some((t) => t.key === defaultTabKey) ? defaultTabKey! : tabs[0]?.key;
  const [active, setActive] = useState(initial);

  function selectTab(key: string) {
    setActive(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => selectTab(tab.key)} className={active === tab.key ? "tab-item-active" : "tab-item"}>
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} className={active === tab.key ? "space-y-6" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
