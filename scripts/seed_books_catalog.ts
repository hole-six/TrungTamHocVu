// NHẬP DANH MỤC SÁCH CỦA TRUNG TÂM vào hệ thống (bảng books).
//
//   npx tsx scripts/seed_books_catalog.ts            → chỉ XEM TRƯỚC, không ghi gì
//   npx tsx scripts/seed_books_catalog.ts --apply    → ghi thật
//   npx tsx scripts/seed_books_catalog.ts --apply --branch <id>   → chỉ định cơ sở
//
// Quy tắc:
//   - Khớp sách đã có theo TÊN (không phân biệt hoa thường, bỏ khoảng trắng thừa) trong
//     cùng cơ sở → cập nhật danh mục + đơn giá theo bảng, GIỮ NGUYÊN tồn kho và mã sách.
//   - Chưa có → tạo mới với tồn kho 0 (nhập kho sau bằng phiếu nhập/điều chỉnh).
//   - KHÔNG xóa sách cũ. Sách đang có mà không nằm trong bảng thì chỉ liệt kê ra cuối
//     để người phụ trách tự quyết.
//   - In cảnh báo khi tổng đơn giá của một nhóm lệch với cột TỔNG trong bảng giấy.
import { PrismaClient } from "@prisma/client";
import { BOOK_CATALOG, ALL_BOOKS } from "./books_catalog";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const branchArgIndex = process.argv.indexOf("--branch");
const BRANCH_ARG = branchArgIndex >= 0 ? process.argv[branchArgIndex + 1] : null;

const vnd = (value: number) => value.toLocaleString("vi-VN") + "đ";
const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

function slugCode(category: string, index: number) {
  const base = category
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 8);
  return `${base || "SACH"}-${String(index).padStart(2, "0")}`;
}

async function main() {
  const branch = BRANCH_ARG
    ? await prisma.branch.findUniqueOrThrow({ where: { id: BRANCH_ARG } })
    : await prisma.branch.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  console.log(`Cơ sở: ${branch.name} (${branch.id})`);
  console.log(APPLY ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: XEM TRƯỚC (thêm --apply để ghi)\n");

  // 1. Đối chiếu cột TỔNG của bảng giấy.
  const mismatches: string[] = [];
  for (const group of BOOK_CATALOG) {
    const sum = group.items.reduce((total, item) => total + item.unitPrice, 0);
    if (sum !== group.total) {
      mismatches.push(
        `${group.category}${group.label ? ` · ${group.label}` : ""}: cộng đơn giá = ${vnd(sum)} nhưng bảng ghi TỔNG = ${vnd(group.total)}`,
      );
    }
  }

  const existing = await prisma.book.findMany({ where: { branchId: branch.id } });
  const byName = new Map(existing.map((book) => [norm(book.name), book]));

  const toCreate: { category: string; name: string; unitPrice: number }[] = [];
  const toUpdate: { id: string; name: string; from: string; to: string }[] = [];
  const unchanged: string[] = [];

  for (const row of ALL_BOOKS) {
    // Khớp theo tên mới, không thấy thì thử các tên CŨ (aliases) để cập nhật đúng cuốn
    // đang có tồn kho thay vì tạo thêm một đầu sách gần giống.
    const found =
      byName.get(norm(row.name)) ?? (row.aliases ?? []).map((alias) => byName.get(norm(alias))).find(Boolean);
    if (!found) {
      toCreate.push(row);
      continue;
    }
    const changes: string[] = [];
    if (norm(found.name) !== norm(row.name)) changes.push(`tên "${found.name}" → "${row.name}"`);
    if (found.category !== row.category) changes.push(`danh mục "${found.category ?? "—"}" → "${row.category}"`);
    if (found.unitPrice !== row.unitPrice) changes.push(`giá ${vnd(found.unitPrice)} → ${vnd(row.unitPrice)}`);
    if (changes.length === 0) {
      unchanged.push(row.name);
      continue;
    }
    toUpdate.push({ id: found.id, name: row.name, from: changes.join(", "), to: row.category });
  }

  const catalogNames = new Set(ALL_BOOKS.flatMap((row) => [norm(row.name), ...(row.aliases ?? []).map(norm)]));
  const leftovers = existing.filter((book) => !catalogNames.has(norm(book.name)));

  console.log(`Bảng giấy có ${ALL_BOOKS.length} dòng sách, ${new Set(ALL_BOOKS.map((r) => r.category)).size} mã lớp.`);
  console.log(`Hệ thống đang có ${existing.length} đầu sách ở cơ sở này.\n`);

  console.log(`TẠO MỚI: ${toCreate.length} đầu sách`);
  for (const row of toCreate) console.log(`   + [${row.category}] ${row.name} — ${vnd(row.unitPrice)}`);

  console.log(`\nCẬP NHẬT: ${toUpdate.length} đầu sách (giữ nguyên tồn kho)`);
  for (const row of toUpdate) console.log(`   ~ ${row.name} — ${row.from}`);

  console.log(`\nGIỮ NGUYÊN (đã khớp): ${unchanged.length} đầu sách`);

  console.log(`\nCÓ TRONG HỆ THỐNG NHƯNG KHÔNG CÓ TRONG BẢNG: ${leftovers.length} đầu sách`);
  for (const book of leftovers) console.log(`   ? [${book.category ?? "—"}] ${book.name} — ${vnd(book.unitPrice)} · tồn ${book.quantityOnHand}`);

  if (mismatches.length > 0) {
    console.log(`\n⚠ LỆCH GIỮA ĐƠN GIÁ VÀ CỘT TỔNG TRONG BẢNG GIẤY (${mismatches.length} nhóm) — cần xác nhận lại:`);
    for (const line of mismatches) console.log(`   ! ${line}`);
  }

  if (!APPLY) {
    console.log("\n(Chưa ghi gì. Chạy lại với --apply để nhập vào hệ thống.)");
    return;
  }

  let created = 0;
  let updated = 0;
  for (const [index, row] of toCreate.entries()) {
    await prisma.book.create({
      data: {
        branchId: branch.id,
        bookCode: slugCode(row.category, index + 1),
        category: row.category,
        name: row.name,
        unitPrice: row.unitPrice,
        purchasePrice: 0,
        quantityOnHand: 0,
      },
    });
    created += 1;
  }
  for (const row of toUpdate) {
    const source = ALL_BOOKS.find((item) => norm(item.name) === norm(row.name))!;
    await prisma.book.update({
      where: { id: row.id },
      data: { name: source.name, category: source.category, unitPrice: source.unitPrice },
    });
    updated += 1;
  }
  console.log(`\nXong: tạo mới ${created}, cập nhật ${updated}. Tồn kho không bị đụng tới.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
