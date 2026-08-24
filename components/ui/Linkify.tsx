import type { ReactNode } from "react";

// Nhận diện URL bên trong 1 đoạn text tự do (staff dán link Drive/web vào ô "Tài liệu"
// dạng http://..., https://... hoặc chỉ gõ trơn kiểu "drive.google.com/abc") và render
// thành <a> bấm được — vẫn giữ nguyên phần chữ còn lại không phải link. Anchor thường,
// không cần "use client" — render được thẳng trong Server Component.
const URL_PATTERN = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;

function toHref(match: string) {
  return /^https?:\/\//i.test(match) ? match : `https://${match}`;
}

export default function Linkify({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(<span key={key++}>{text.slice(lastIndex, start)}</span>);
    nodes.push(
      <a
        key={key++}
        href={toHref(match[0])}
        target="_blank"
        rel="noreferrer"
        className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {match[0]}
      </a>,
    );
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(<span key={key++}>{text.slice(lastIndex)}</span>);

  return <span className={className}>{nodes}</span>;
}
