import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssetTotalValue, computeNextMaintenanceDue, computeMaintenanceStatus } from "@/lib/server/asset-rules";
import NewAssetForm from "@/components/assets/NewAssetForm";
import AssetsTable from "@/components/assets/AssetsTable";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { formatVnd } from "@/lib/export-utils";

const ASSETS_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="assets-new"]',
    title: "Thêm tài sản mới — 1 dòng = 1 nhóm tài sản cùng loại",
    description:
      "Bấm vào đây khi cơ sở vừa mua hoặc vừa tiếp nhận thiết bị. Quy tắc bắt buộc: mỗi dòng chỉ đại diện cho MỘT nhóm tài sản cùng loại, cùng đơn giá, cùng vị trí — ví dụ 5 cái quạt trần cùng phòng thì gộp 1 dòng số lượng 5, nhưng 3 cái máy lạnh ở 3 phòng khác nhau phải tách 3 dòng riêng. Lý do: khi bảo dưỡng hoặc thanh lý sau này, hệ thống ghi nhận theo TỪNG DÒNG, gộp sai loại vào chung 1 dòng sẽ không tách được cái nào đã sửa, cái nào chưa. Ngay khi lưu, hệ thống tự tạo 1 giao dịch \"Nhập mới\" với đúng số lượng ban đầu — số này chính là điểm khởi đầu để tính tồn kho về sau, không cần nhập tay lại ở đâu khác.",
    placement: "bottom",
  },
  {
    target: '[data-tour="assets-search"]',
    title: "Tìm theo tên, mã, phòng — lọc thật ở backend",
    description:
      "Gõ tên tài sản, mã tài sản hoặc tên phòng/vị trí rồi Enter. Toàn bộ việc lọc chạy ở server (Prisma query có điều kiện WHERE), trình duyệt không tải sẵn hết dữ liệu rồi lọc bằng JavaScript — nghĩa là dù cơ sở có vài nghìn tài sản, tìm kiếm vẫn nhanh và không làm nặng máy người dùng. Ô này không phân biệt hoa thường và khớp một phần chuỗi, nên gõ \"máy lạnh\" sẽ ra cả \"Máy lạnh Panasonic\" lẫn \"Điều hòa máy lạnh 2 chiều\" nếu tên có chứa đúng cụm đó.",
    placement: "bottom",
  },
  {
    target: '[data-tour="assets-summary"]',
    title: "5 badge đầu là tiền, 2 badge cuối là số lượng thiết bị cần xử lý",
    description:
      "3 số tiền đầu tuân đúng công thức kế toán của hệ thống: Tổng giá trị = Giá gốc (số lượng × đơn giá) + tổng tiền đã bảo dưỡng thật sự đã chi — không phải ước tính. \"Đang bảo trì\" và \"Hỏng\" đếm theo trạng thái tài sản đang gắn (xem cột Trạng thái). Hai badge màu đỏ/vàng cuối — Quá hạn bảo dưỡng và Sắp đến hạn (trong 14 ngày) — LUÔN tính trên toàn bộ danh sách đã lọc, không phải chỉ 20 dòng đang hiển thị trên trang này, nên nếu con số này khác 0 mà không thấy dòng nào trên trang 1, hãy chuyển sang các trang sau hoặc lọc theo tên để tìm đúng thiết bị cần xử lý.",
    placement: "bottom",
  },
  {
    target: '[data-tour="assets-table"]',
    title: "Bảo dưỡng ≠ Tổng giá trị — 2 cột dễ nhầm nhất",
    description:
      "Cột \"Bảo dưỡng\" CHỈ là tổng tiền sửa chữa/bảo trì đã ghi nhận cho riêng tài sản đó — không phải giá trị tài sản. Cột \"Tổng giá trị\" mới là con số đầy đủ: giá gốc cộng dồn với đúng số tiền bảo dưỡng ở cột bên cạnh. Nếu thấy \"Tổng giá trị\" ở đây không khớp với số liệu đối chiếu ở Sổ quỹ, khả năng cao nhất là có một giao dịch bảo dưỡng đã bị hủy (voided) — giao dịch hủy vẫn hiện trong lịch sử để giữ dấu vết nhưng không còn được cộng vào tổng giá trị hay tổng chi phí nữa, nên 2 nơi đối soát cùng lúc sẽ luôn khớp lại đúng con số thật.",
    placement: "top",
  },
  {
    target: '[data-tour="assets-maintenance-col"]',
    title: "Lịch bảo dưỡng tự tính từ lịch sử thật, không phải ngày cố định",
    description:
      "Hạn bảo dưỡng kế tiếp KHÔNG phải một ngày cố định nhập tay — công thức là: ngày bảo dưỡng gần nhất (lấy từ giao dịch bảo dưỡng thật, chưa bị hủy) cộng với chu kỳ đã đặt cho tài sản đó (đặt số tháng ở nút Sửa, ví dụ 3 tháng cho điều hòa, 6 tháng cho máy in). Nếu tài sản chưa từng bảo dưỡng lần nào, hạn được tính từ chính ngày tạo tài sản. \"Chưa đặt lịch\" nghĩa là tài sản đó chưa có chu kỳ — hệ thống sẽ không cảnh báo quá hạn cho tới khi anh đặt số tháng cụ thể. Bấm vào badge màu để mở lịch sử đầy đủ: từng lần bảo dưỡng, số tiền, ghi chú, và nút hủy nếu có lần nào bị nhập sai — hủy sẽ tự động hủy luôn phiếu chi tương ứng bên Sổ quỹ, không cần sửa 2 nơi.",
    placement: "top",
  },
  {
    target: '[data-tour="assets-status-col"]',
    title: "Trạng thái là cờ đang dùng, không thay thế lịch sử bảo dưỡng",
    description:
      "4 trạng thái: Đang sử dụng (bình thường), Đang bảo trì (đang sửa, tạm ngừng dùng), Hỏng (chưa sửa được nhưng chưa thanh lý), Đã thanh lý. Lưu ý quan trọng: đổi trạng thái sang \"Đang bảo trì\" chỉ là một cái NHÃN hiển thị, không tự động ghi nhận chi phí hay lịch sử gì cả — muốn ghi tiền sửa chữa thật thì vẫn phải dùng nút Bảo dưỡng riêng. Trạng thái \"Đã thanh lý\" thường tự động chuyển khi tổng số lượng còn lại về 0 sau khi thanh lý hết, không cần tự tay đổi.",
    placement: "top",
  },
  {
    target: '[data-tour="assets-actions-col"]',
    title: "3 thao tác nhanh: Bảo dưỡng, Sửa, Xóa — mỗi nút một luồng riêng",
    description:
      "\"Bảo dưỡng\" chỉ dùng khi ĐÃ thực chi tiền sửa chữa — nhập số tiền và ngày sửa thật, hệ thống tự cộng vào chi phí bảo dưỡng và tự sinh phiếu chi trong Sổ quỹ, không cần nhập tay 2 chỗ. \"Sửa\" dùng để đổi thông tin nền (tên, nhóm, phòng, đơn giá, trạng thái, chu kỳ bảo dưỡng) — không dùng để ghi chi phí sửa chữa. \"Xóa\" chỉ hoạt động khi tài sản gần như chưa có lịch sử giao dịch nào (nhiều nhất 1 dòng) — một khi đã bảo dưỡng hoặc điều chỉnh số lượng, hệ thống chặn xóa để giữ dấu vết; lúc đó chuyển trạng thái sang \"Đã thanh lý\" thay vì cố xóa.",
    placement: "top",
  },
];

const PAGE_SIZE = 20;

function normalizeUnit(unitName: string | null) {
  const trimmed = unitName?.trim();
  return trimmed || "cái";
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    page?: string;
    name?: string;
    category?: string;
    status?: string;
    room?: string;
    unit?: string;
    unitValueFrom?: string;
    unitValueTo?: string;
    qtyFrom?: string;
    qtyTo?: string;
    baseValueFrom?: string;
    baseValueTo?: string;
    maintenanceFrom?: string;
    maintenanceTo?: string;
    totalValueFrom?: string;
    totalValueTo?: string;
    maintenanceStatus?: string;
  };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = PAGE_SIZE;
  // Lọc theo từng cột (hàng cố định dưới header bảng) — độc lập với ô tìm chung `q`.
  const nameFilter = searchParams.name?.trim() ?? "";
  const categoryFilter = searchParams.category?.trim() ?? "";
  const statusFilter = searchParams.status?.trim() ?? "";
  const roomFilter = searchParams.room?.trim() ?? "";
  const unitFilter = searchParams.unit?.trim() ?? "";
  const unitValueFrom = searchParams.unitValueFrom?.trim() ?? "";
  const unitValueTo = searchParams.unitValueTo?.trim() ?? "";
  // Số lượng/Giá gốc/Bảo dưỡng/Tổng giá trị/Lịch bảo dưỡng là số TÍNH ĐỘNG từ lịch sử
  // giao dịch (không phải cột thô) — không lọc được trực tiếp bằng Prisma where, phải
  // tính đủ cho toàn bộ danh sách rồi lọc bằng JS trước khi cắt trang (xem allRows bên dưới).
  const qtyFrom = searchParams.qtyFrom?.trim() ?? "";
  const qtyTo = searchParams.qtyTo?.trim() ?? "";
  const baseValueFrom = searchParams.baseValueFrom?.trim() ?? "";
  const baseValueTo = searchParams.baseValueTo?.trim() ?? "";
  const maintenanceFrom = searchParams.maintenanceFrom?.trim() ?? "";
  const maintenanceTo = searchParams.maintenanceTo?.trim() ?? "";
  const totalValueFrom = searchParams.totalValueFrom?.trim() ?? "";
  const totalValueTo = searchParams.totalValueTo?.trim() ?? "";
  const maintenanceStatusFilter = searchParams.maintenanceStatus?.trim() ?? "";

  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};
  const andConditions: Prisma.AssetWhereInput[] = [];
  if (q) {
    andConditions.push({
      OR: [
        { name: { contains: q } },
        { assetCode: { contains: q } },
        { category: { contains: q } },
        { room: { contains: q } },
      ],
    });
  }
  if (nameFilter) {
    andConditions.push({ OR: [{ name: { contains: nameFilter } }, { assetCode: { contains: nameFilter } }] });
  }
  if (categoryFilter) andConditions.push({ category: categoryFilter });
  if (statusFilter) andConditions.push({ status: statusFilter });
  if (roomFilter) andConditions.push({ room: { contains: roomFilter } });
  // "cái" là đơn vị mặc định khi unitName rỗng/null (xem normalizeUnit) — lọc theo "cái"
  // phải khớp cả 2 trường hợp, giống cách issueCategoryFilter xử lý "Sách khác" ở Kho giáo trình.
  if (unitFilter) andConditions.push(unitFilter === "cái" ? { OR: [{ unitName: null }, { unitName: "cái" }] } : { unitName: unitFilter });
  if (unitValueFrom) andConditions.push({ unitValue: { gte: Number(unitValueFrom) } });
  if (unitValueTo) andConditions.push({ unitValue: { lte: Number(unitValueTo) } });
  const where: Prisma.AssetWhereInput = {
    ...branchWhere,
    ...(andConditions.length ? { AND: andConditions } : {}),
  };

  const [allMatchingAssets, categoryRows, unitRows] = await Promise.all([
    // Số lượng/Giá gốc/Bảo dưỡng/Tổng giá trị/Lịch bảo dưỡng chỉ tính được sau khi có
    // đủ transactions của TOÀN BỘ danh sách đã lọc (không phải chỉ trang hiện tại) — nên
    // phải fetch hết rồi mới lọc + cắt trang bằng JS, không dùng skip/take của Prisma ở đây.
    prisma.asset.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        transactions: {
          select: { id: true, type: true, quantity: true, amount: true, txnDate: true, notes: true, voidedAt: true, voidReason: true },
        },
      },
    }),
    // Danh sách tùy chọn cho bộ lọc "Danh mục" — lấy trên toàn bộ tài sản của cơ sở
    // (chỉ theo branchWhere, KHÔNG theo các filter cột khác), để dropdown luôn đủ lựa
    // chọn thay vì co lại theo bộ lọc đang áp dụng.
    prisma.asset.findMany({
      where: branchWhere,
      select: { category: true },
      distinct: ["category"],
    }),
    // Danh sách tùy chọn cho bộ lọc "ĐVT" — cùng nguyên tắc với categoryOptions ở trên:
    // lấy trên toàn bộ tài sản của cơ sở, không theo filter cột hiện tại.
    prisma.asset.findMany({
      where: branchWhere,
      select: { unitName: true },
      distinct: ["unitName"],
    }),
  ]);

  const categoryOptions = Array.from(
    new Set(categoryRows.map((row) => row.category?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right, "vi"));

  const unitOptions = Array.from(new Set(unitRows.map((row) => normalizeUnit(row.unitName)))).sort((left, right) => left.localeCompare(right, "vi"));

  const allRows = allMatchingAssets.map((asset) => {
    const quantity = asset.transactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
    const unitName = normalizeUnit(asset.unitName);
    const baseValue = quantity * (asset.unitValue ?? 0);
    const maintenanceTxns = asset.transactions.filter((transaction) => transaction.type === "MAINTENANCE");
    // Đã hủy (voided) thì không tính tiền/không dùng làm mốc tính hạn kế tiếp, nhưng vẫn
    // hiện trong lịch sử để giữ dấu vết — lọc riêng maintenanceValue/anchor, không lọc history.
    const maintenanceValue = maintenanceTxns.filter((t) => !t.voidedAt).reduce((sum, transaction) => sum + transaction.amount, 0);
    const maintenanceHistory = maintenanceTxns
      .slice()
      .sort((a, b) => b.txnDate.getTime() - a.txnDate.getTime())
      .map((t) => ({ id: t.id, txnDate: t.txnDate.toISOString(), amount: t.amount, notes: t.notes, voidedAt: t.voidedAt ? t.voidedAt.toISOString() : null, voidReason: t.voidReason }));
    const lastMaintenanceDate = maintenanceTxns.filter((t) => !t.voidedAt).reduce<Date | null>(
      (latest, t) => (!latest || t.txnDate.getTime() > latest.getTime() ? t.txnDate : latest),
      null,
    );
    const nextMaintenanceDue = computeNextMaintenanceDue(asset.maintenanceIntervalMonths, lastMaintenanceDate, asset.createdAt);
    const maintenanceStatus = computeMaintenanceStatus(nextMaintenanceDue);

    return {
      ...asset,
      quantity,
      unitName,
      baseValue,
      maintenanceValue,
      maintenanceHistory,
      nextMaintenanceDue: nextMaintenanceDue ? nextMaintenanceDue.toISOString() : null,
      maintenanceStatus,
      totalValue: computeAssetTotalValue(asset.unitValue, quantity, asset.transactions),
    };
  });

  // Lọc theo cột tính động (Số lượng/Giá gốc/Bảo dưỡng/Tổng giá trị/Lịch bảo dưỡng) trên
  // TOÀN BỘ danh sách đã tính (allRows) rồi mới cắt trang — cùng cách làm với cột "Tồn"
  // của Kho giáo trình, vì các cột này không phải field thô nên Prisma where không lọc được.
  const filteredRows = allRows.filter((row) => {
    if (qtyFrom && row.quantity < Number(qtyFrom)) return false;
    if (qtyTo && row.quantity > Number(qtyTo)) return false;
    if (baseValueFrom && row.baseValue < Number(baseValueFrom)) return false;
    if (baseValueTo && row.baseValue > Number(baseValueTo)) return false;
    if (maintenanceFrom && row.maintenanceValue < Number(maintenanceFrom)) return false;
    if (maintenanceTo && row.maintenanceValue > Number(maintenanceTo)) return false;
    if (totalValueFrom && row.totalValue < Number(totalValueFrom)) return false;
    if (totalValueTo && row.totalValue > Number(totalValueTo)) return false;
    if (maintenanceStatusFilter && row.maintenanceStatus !== maintenanceStatusFilter) return false;
    return true;
  });

  const total = filteredRows.length;
  const rows = filteredRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const totalQuantity = filteredRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalBaseValue = filteredRows.reduce((sum, row) => sum + row.baseValue, 0);
  const totalMaintenanceValue = filteredRows.reduce((sum, row) => sum + row.maintenanceValue, 0);
  const totalValue = filteredRows.reduce((sum, row) => sum + row.totalValue, 0);
  const maintenanceCount = filteredRows.filter((row) => row.status === "MAINTENANCE").length;
  const brokenCount = filteredRows.filter((row) => row.status === "BROKEN").length;
  const overdueMaintenanceCount = filteredRows.filter((row) => row.maintenanceStatus === "OVERDUE").length;
  const dueSoonMaintenanceCount = filteredRows.filter((row) => row.maintenanceStatus === "DUE_SOON").length;
  const canManageAssets = canUpdate("assets", role);
  const canRemoveAssets = canDelete("assets", role);
  const canCreateAsset = canCreate("assets", role);
  // Bỏ bước tương ứng với phần tử không hiện với vai trò hiện tại, để "Bước x/y" luôn
  // đúng số bước thật sự người dùng này sẽ thấy — engine cũng tự nhảy qua phần tử thiếu,
  // đây chỉ là để đếm bước cho chính xác ngay từ đầu.
  const assetsTourSteps = ASSETS_TOUR_STEPS.filter((step) => {
    if (step.target === '[data-tour="assets-new"]') return canCreateAsset;
    if (step.target === '[data-tour="assets-actions-col"]') return canManageAssets || canRemoveAssets;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Tài sản & thiết bị</h1>
          <p className="page-subtitle">Theo dõi giá trị gốc, chi phí bảo dưỡng và tổng giá trị sử dụng của từng tài sản.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SpotlightTour steps={assetsTourSteps} />
          <div data-tour="assets-new">{canCreateAsset ? <NewAssetForm /> : null}</div>
        </div>
      </div>

      <div className="card">
        <form className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Tìm tên, mã tài sản, phòng..."
            className="input min-w-[220px] flex-1"
            data-tour="assets-search"
          />
          <div data-tour="assets-summary" className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-ink">Tài sản {total}</span>
            <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-sky-700">Số lượng {totalQuantity}</span>
            <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-indigo-700">Giá gốc {formatVnd(totalBaseValue)}</span>
            <span className="rounded-full border border-[#fde7d8] bg-[#fff8f2] px-3 py-2 text-xs font-semibold text-amber-700">Bảo dưỡng {formatVnd(totalMaintenanceValue)}</span>
            <span className="rounded-full border border-[#e4ddff] bg-[#f7f5ff] px-3 py-2 text-xs font-semibold text-violet-700">Tổng giá trị {formatVnd(totalValue)}</span>
            <span className="rounded-full border border-[#fde7d8] bg-[#fff8f2] px-3 py-2 text-xs font-semibold text-amber-700">Đang bảo trì {maintenanceCount}</span>
            <span className="rounded-full border border-[#ffe0e0] bg-[#fff7f7] px-3 py-2 text-xs font-semibold text-rose-700">Hỏng {brokenCount}</span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Quá hạn bảo dưỡng {overdueMaintenanceCount}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Sắp đến hạn {dueSoonMaintenanceCount}</span>
          </div>
        </form>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách tài sản</h2>
            <p className="mt-1 text-sm text-ink-muted48">Đối chiếu nhanh giá gốc, bảo dưỡng và tổng giá trị ngay trên từng dòng.</p>
          </div>
        </div>

        <AssetsTable
          rows={rows}
          canManageAssets={canManageAssets}
          canRemoveAssets={canRemoveAssets}
          currentPage={page}
          totalCount={total}
          pageSize={pageSize}
          categoryOptions={categoryOptions}
          unitOptions={unitOptions}
        />
      </div>
    </div>
  );
}
