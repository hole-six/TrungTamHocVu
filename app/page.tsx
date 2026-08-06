import { redirect } from "next/navigation";

// Không dùng dynamic API nào nên Next có thể coi route này là static và build
// sẵn 1 lần lúc build — khi đó redirect() không phát ra header Location thật
// mà chỉ nhúng lệnh điều hướng vào RSC payload để client tự chuyển trang bằng
// JS. Máy nào JS chạy chậm/bị chặn sẽ kẹt lại ở trang trắng. Ép route này luôn
// render động để mỗi request đều nhận được 1 redirect HTTP thật sự.
export const dynamic = "force-dynamic";

export default function HomePage() {
  redirect("/login");
}
