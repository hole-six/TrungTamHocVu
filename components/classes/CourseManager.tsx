"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type BookOption = {
  id: string;
  name: string;
  category: string | null;
  quantityOnHand: number;
};

type Course = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
  isActive: boolean;
  bookRequirements?: Array<{
    id: string;
    quantity: number;
    book: BookOption;
  }>;
};

type RequirementInput = {
  bookId: string;
  quantity: string;
};

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function normalizeCategory(category: string | null | undefined) {
  const trimmed = category?.trim();
  return trimmed || "Sách khác";
}

function stockTone(quantityOnHand: number, requiredQuantity = 1) {
  if (quantityOnHand <= 0) return "text-rose-700";
  if (quantityOnHand <= requiredQuantity || quantityOnHand <= 2) return "text-amber-700";
  return "text-emerald-700";
}

function CourseBookSelector({
  books,
  requirements,
  onChange,
}: {
  books: BookOption[];
  requirements: RequirementInput[];
  onChange: (next: RequirementInput[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const groupedBooks = useMemo(() => {
    return books.reduce<Record<string, BookOption[]>>((acc, book) => {
      const key = normalizeCategory(book.category);
      if (!acc[key]) acc[key] = [];
      acc[key].push(book);
      return acc;
    }, {});
  }, [books]);

  const categoryNames = Object.keys(groupedBooks).sort((left, right) => left.localeCompare(right, "vi"));
  const normalizedSearch = search.trim().toLowerCase();

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const category = normalizeCategory(book.category);
      if (activeCategory !== "ALL" && category !== activeCategory) return false;
      if (!normalizedSearch) return true;
      return book.name.toLowerCase().includes(normalizedSearch) || category.toLowerCase().includes(normalizedSearch);
    });
  }, [activeCategory, books, normalizedSearch]);

  const selectedRequirementDetails = useMemo(() => {
    return requirements
      .map((item) => {
        const book = books.find((row) => row.id === item.bookId);
        if (!book) return null;
        return {
          ...item,
          book,
          category: normalizeCategory(book.category),
        };
      })
      .filter(Boolean) as Array<RequirementInput & { book: BookOption; category: string }>;
  }, [books, requirements]);

  const totalSelectedQuantity = useMemo(
    () => selectedRequirementDetails.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0),
    [selectedRequirementDetails],
  );

  function selectAllVisible() {
    const existingIds = new Set(requirements.map((item) => item.bookId));
    const next = [...requirements];
    filteredBooks.forEach((book) => {
      if (!existingIds.has(book.id)) next.push({ bookId: book.id, quantity: "1" });
    });
    onChange(next);
  }

  function clearCategory(category: string) {
    const ids = new Set((groupedBooks[category] ?? []).map((book) => book.id));
    onChange(requirements.filter((item) => !ids.has(item.bookId)));
  }

  function removeSelectedBook(bookId: string) {
    onChange(requirements.filter((item) => item.bookId !== bookId));
  }

  useEffect(() => {
    setPage(1);
  }, [activeCategory, normalizedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const pagedBooks = filteredBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Bộ sách chuẩn</p>
          <p className="mt-1 text-xs text-ink-muted48">Chọn đúng đầu sách cần bán kèm cho khóa học.</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-[#dbe7ff] bg-white px-3 py-1 text-[11px] font-semibold text-primary">
          Đã chọn {requirements.length} đầu sách
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_180px]">
            <select className="input" value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>
              <option value="ALL">Tất cả danh mục</option>
              {categoryNames.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <input
              className="input"
              placeholder="Tìm theo tên sách hoặc danh mục..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="flex items-center rounded-2xl border border-hairline bg-white px-3 py-2 text-xs text-ink-muted80">
              Hiển thị <strong className="ml-1 text-ink">{filteredBooks.length}</strong> đầu sách
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAllVisible} className="btn-ghost-sm">
              Chọn tất cả kết quả đang lọc
            </button>
            {activeCategory !== "ALL" ? (
              <button type="button" onClick={() => clearCategory(activeCategory)} className="btn-ghost-sm text-rose-600 hover:text-rose-700">
                Bỏ chọn cả danh mục
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {pagedBooks.map((book) => {
              const selected = requirements.find((item) => item.bookId === book.id);
              const category = normalizeCategory(book.category);
              return (
                <label
                  key={book.id}
                  className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3 transition hover:border-[#cfe0ff] hover:bg-[#fcfdff]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...requirements, { bookId: book.id, quantity: "1" }]
                          : requirements.filter((item) => item.bookId !== book.id),
                      )
                    }
                    className="h-4 w-4 rounded border-[#c9d8ee] text-primary"
                  />

                  <div className="flex min-w-0 items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{book.name}</p>
                      <p className="mt-1 text-xs text-ink-muted48">{category}</p>
                      <p className={`mt-2 text-xs ${stockTone(book.quantityOnHand)}`}>
                        Tồn kho {book.quantityOnHand}
                        {book.quantityOnHand <= 2 ? " · Nên bổ sung thêm" : ""}
                      </p>
                    </div>

                    {selected ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-ink-muted48">SL</span>
                        <input
                          type="number"
                          min={1}
                          className="input h-10 w-20"
                          value={selected.quantity}
                          onChange={(event) =>
                            onChange(
                              requirements.map((item) =>
                                item.bookId === book.id ? { ...item, quantity: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          {filteredBooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dbe7ff] bg-white px-4 py-8 text-center text-sm text-ink-muted48">
              Không có đầu sách phù hợp với bộ lọc hiện tại.
            </div>
          ) : null}

          {filteredBooks.length > 0 ? (
            <div className="flex items-center justify-between rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-xs text-ink-muted48">
                Trang <strong className="text-ink">{page}</strong>/<strong className="text-ink">{totalPages}</strong>
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn-ghost-sm disabled:opacity-40">
                  Trước
                </button>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn-ghost-sm disabled:opacity-40">
                  Sau
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky top-4 rounded-2xl border border-hairline bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Sách đã chọn</p>
              <p className="mt-1 text-xs text-ink-muted48">
                {selectedRequirementDetails.length} đầu sách · {totalSelectedQuantity} cuốn
              </p>
            </div>
            {selectedRequirementDetails.length > 0 ? (
              <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                Xóa hết
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {selectedRequirementDetails.length > 0 ? (
              selectedRequirementDetails.map((item) => (
                <div key={item.bookId} className="rounded-2xl border border-[#edf2fb] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{item.book.name}</p>
                      <p className="mt-1 text-xs text-ink-muted48">{item.category}</p>
                    </div>
                    <button type="button" onClick={() => removeSelectedBook(item.bookId)} className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                      Xóa
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={`text-xs ${stockTone(item.book.quantityOnHand, Number(item.quantity) || 1)}`}>
                      Tồn {item.book.quantityOnHand}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted48">SL</span>
                      <input
                        type="number"
                        min={1}
                        className="input h-10 w-20"
                        value={item.quantity}
                        onChange={(event) =>
                          onChange(
                            requirements.map((row) => (row.bookId === item.bookId ? { ...row, quantity: event.target.value } : row)),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#dbe7ff] px-4 py-8 text-center text-sm text-ink-muted48">
                Chưa chọn đầu sách nào.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseForm({
  mode,
  course,
  books,
  onClose,
}: {
  mode: "create" | "edit";
  course?: Course | null;
  books: BookOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: course?.code ?? "",
    name: course?.name ?? "",
    tuitionPerSession: course ? String(course.tuitionPerSession) : "",
    sessionsPerWeek: course ? String(course.sessionsPerWeek) : "",
    isActive: course?.isActive ?? true,
    bookRequirements: (course?.bookRequirements ?? []).map((item) => ({
      bookId: item.book.id,
      quantity: String(item.quantity),
    })),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(mode === "create" ? "/api/courses" : `/api/courses/${course?.id}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? (mode === "create" ? "Không thể tạo khóa học." : "Không thể cập nhật khóa học."));
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-group">
          <span className="label">Mã khóa học</span>
          <input required className="input" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
        </label>

        <label className="form-group">
          <span className="label">Tên khóa học</span>
          <input required className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>

        <label className="form-group">
          <span className="label">Học phí / buổi</span>
          <input type="number" required min={0} className="input" value={form.tuitionPerSession} onChange={(event) => setForm((current) => ({ ...current, tuitionPerSession: event.target.value }))} />
          <p className="form-hint">{form.tuitionPerSession ? formatVnd(Number(form.tuitionPerSession) || 0) : ""}</p>
        </label>

        <label className="form-group">
          <span className="label">Số buổi / tuần</span>
          <input type="number" required min={1} max={7} className="input" value={form.sessionsPerWeek} onChange={(event) => setForm((current) => ({ ...current, sessionsPerWeek: event.target.value }))} />
        </label>
      </div>

      <div className="rounded-[24px] border border-[#e7eef9] bg-[#fbfdff] p-4">
        <CourseBookSelector
          books={books}
          requirements={form.bookRequirements}
          onChange={(next) => setForm((current) => ({ ...current, bookRequirements: next }))}
        />
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-ink">
        <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
        Khóa học này đang được áp dụng để tạo lớp mới
      </label>

      {error ? <div className="alert-danger">{error}</div> : null}

      <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : mode === "create" ? "Lưu khóa học" : "Lưu thay đổi"}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          Hủy
        </button>
      </div>
    </form>
  );
}

export default function CourseManager({ courses, books }: { courses: Course[]; books: BookOption[] }) {
  const router = useRouter();
  const [openCreate, setOpenCreate] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return courses.filter((course) => {
      if (statusFilter === "ACTIVE" && !course.isActive) return false;
      if (statusFilter === "INACTIVE" && course.isActive) return false;
      if (!keyword) return true;
      return [course.code, course.name].some((item) => item.toLowerCase().includes(keyword));
    });
  }, [courses, search, statusFilter]);

  const stats = useMemo(() => {
    const active = courses.filter((course) => course.isActive).length;
    const inactive = courses.length - active;
    return { active, inactive };
  }, [courses]);

  async function removeCourse(course: Course) {
    setDeletingId(course.id);
    const response = await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setDeletingId(null);

    if (!response.ok) {
      window.alert(result.error ?? "Không thể xóa khóa học.");
      return;
    }

    router.refresh();
  }

  const statusChips: Array<{ key: "ALL" | "ACTIVE" | "INACTIVE"; label: string; count: number }> = [
    { key: "ALL", label: "Tất cả", count: courses.length },
    { key: "ACTIVE", label: "Đang áp dụng", count: stats.active },
    { key: "INACTIVE", label: "Ngừng áp dụng", count: stats.inactive },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Khóa học chuẩn</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setOpenCreate(true)} className="btn-primary">
              + Thêm khóa học
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-[#dce6f5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] px-5 py-3.5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)]">
            <div className="relative min-w-[260px] flex-1">
              <input className="input pl-4" placeholder="Tìm theo mã khóa, tên khóa học..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              {statusChips.map((chip) => {
                const active = statusFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setStatusFilter(chip.key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-[#1f6feb] bg-[linear-gradient(135deg,#1f6feb,#2f80ed)] text-white shadow-[0_10px_20px_-12px_rgba(31,111,235,0.8)]"
                        : "border-[#dbe7ff] bg-white text-ink hover:border-primary/40 hover:bg-[#f8fbff] hover:text-primary"
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-[#eef4ff] text-primary"}`}>
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#dce6f5] bg-white shadow-[0_30px_80px_-52px_rgba(15,23,42,0.45)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#e8edf5] bg-[linear-gradient(180deg,#fbfdff_0%,#f3f8ff_100%)]">
                  <tr>
                    <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink-muted48">Khóa học</th>
                    <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink-muted48">Học phí</th>
                    <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink-muted48">Bộ sách chuẩn</th>
                    <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink-muted48">Trạng thái</th>
                    <th className="px-5 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink-muted48">Tác vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8edf5]">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="align-top transition-colors hover:bg-[#fbfdff]">
                      <td className="px-5 py-5">
                        <div className="min-w-[240px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold text-primary">{course.code}</span>
                            <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-[11px] font-semibold text-ink-muted80">
                              {course.sessionsPerWeek} buổi/tuần
                            </span>
                          </div>
                          <p className="mt-2 text-[15px] font-extrabold leading-6 text-ink">{course.name}</p>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="grid min-w-[220px] gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7faff] px-3 py-2.5">
                            <span className="text-ink-muted48">Học phí / buổi</span>
                            <p className="font-semibold text-ink">{formatVnd(course.tuitionPerSession)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#edf5ff] px-3 py-2.5">
                            <span className="text-ink-muted48">Tạm tính tuần</span>
                            <p className="font-semibold text-primary">{formatVnd(course.tuitionPerSession * course.sessionsPerWeek)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        {course.bookRequirements?.length ? (
                          <div className="min-w-[260px] space-y-2">
                            {course.bookRequirements.map((item) => (
                              <div key={item.id} className="rounded-2xl bg-[#f8fbff] px-3 py-3">
                                <p className="text-sm font-semibold text-ink">{item.book.name}</p>
                                <p className={`mt-1 text-xs ${stockTone(item.book.quantityOnHand, item.quantity)}`}>
                                  {normalizeCategory(item.book.category)} · SL {item.quantity} · Tồn {item.book.quantityOnHand}
                                  {item.book.quantityOnHand <= item.quantity ? " · Cần nhập thêm" : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[#dbe7ff] px-4 py-8 text-center text-xs text-ink-muted48">
                            Chưa gắn bộ sách chuẩn
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
                            course.isActive
                              ? "border-[#cdeedb] bg-[#ebf8f1] text-[#159d65]"
                              : "border-[#d7e7ff] bg-[#eef5ff] text-[#1f6feb]"
                          }`}
                        >
                          {course.isActive ? "Đang áp dụng" : "Ngừng áp dụng"}
                        </span>
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCourse(course)}
                            className="inline-flex min-w-[86px] items-center justify-center rounded-[14px] border border-[#d9e3f7] bg-white px-3.5 py-2.5 text-[12px] font-bold text-ink-muted64 transition hover:bg-[#f8fbff]"
                          >
                            Sửa
                          </button>
                          <ConfirmActionButton
                            title="Xác nhận xóa khóa học?"
                            description={`Khóa học "${course.name}" sẽ bị xóa khỏi danh mục.`}
                            confirmLabel="Xóa khóa học"
                            tone="danger"
                            disabled={deletingId === course.id}
                            className="inline-flex min-w-[86px] items-center justify-center rounded-[14px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                            onConfirm={() => removeCourse(course)}
                          >
                            {deletingId === course.id ? "Đang xóa..." : "Xóa"}
                          </ConfirmActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted48">
                        Chưa có khóa học phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ResponsiveDrawer 
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm khóa học chuẩn"
        description="Khai báo học phí và bộ sách chuẩn đi kèm khóa học."
      >
        <CourseForm mode="create" books={books} onClose={() => setOpenCreate(false)} />
      </ResponsiveDrawer>

      <ResponsiveDrawer 
        open={Boolean(editingCourse)}
        onClose={() => setEditingCourse(null)}
        title="Sửa khóa học"
        description="Cập nhật học phí, lịch chuẩn và bộ sách chuẩn của khóa học."
      >
        {editingCourse ? <CourseForm mode="edit" course={editingCourse} books={books} onClose={() => setEditingCourse(null)} /> : null}
      </ResponsiveDrawer>
    </>
  );
}
