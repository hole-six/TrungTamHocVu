"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Dùng chung cho MỌI nút/link "Quay lại X" trong hệ thống — thay vì Link href cố định
// (luôn đưa về đúng 1 đích bất kể vào trang này từ đâu), bấm sẽ đi router.back() để về
// đúng trang vừa mở trước đó trong tab này. `href` vẫn giữ làm điểm đến fallback khi tab
// không có lịch sử điều hướng trong app (mở thẳng URL, mở tab mới, bookmark) — trường hợp
// đó window.history.length <= 1, router.back() sẽ không có gì để lùi về.
// Giữ Ctrl/Cmd/Shift/click giữa hoạt động bình thường (mở href trong tab/cửa sổ mới) vì
// chỉ chặn hành vi mặc định khi là click chuột trái thường.
export default function BackButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (canGoBack) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
