import base64
import io
import json
import os
import re
import sys
import textwrap
import zipfile
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 12 * mm
MARGIN_Y = 10 * mm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X


def register_fonts():
    font_candidates = [
        ("AppSans", "C:/Windows/Fonts/arial.ttf"),
        ("AppSansBold", "C:/Windows/Fonts/arialbd.ttf"),
    ]
    for name, font_path in font_candidates:
        if os.path.exists(font_path):
            pdfmetrics.registerFont(TTFont(name, font_path))
    return {
        "regular": "AppSans" if "AppSans" in pdfmetrics.getRegisteredFontNames() else "Helvetica",
        "bold": "AppSansBold" if "AppSansBold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold",
    }


FONTS = register_fonts()


def format_vnd(value):
    return f"{int(round(value or 0)):,}".replace(",", ".") + "đ"


def format_period_label(period_name):
    try:
        year, month = period_name.split("-")
        return f"Tháng {int(month)}/{year}"
    except Exception:
        return period_name or "—"


def format_date(value):
    if not value:
        return "—"
    raw = str(value)
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%d/%m/%Y")
        except Exception:
            continue
    return raw


def get_invoice_serial(invoice_no):
    if not invoice_no:
        return "—"
    match = re.search(r"(\d+)(?!.*\d)", str(invoice_no))
    return match.group(1) if match else str(invoice_no)[-6:].upper()


def get_branch_short_name(name):
    words = [word for word in str(name or "").strip().split() if word]
    if not words:
        return "TT"
    return "".join(word[0].upper() for word in words[:3])


def get_due_date_label(period_name):
    try:
        year, month = period_name.split("-")
        next_month = int(month) + 1
        next_year = int(year)
        if next_month > 12:
            next_month = 1
            next_year += 1
        return f"10/{str(next_month).zfill(2)}/{next_year}"
    except Exception:
        return period_name or "—"


def sanitize_file_name(text):
    text = re.sub(r"[\\/:*?\"<>|]+", "-", str(text))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:120] or "invoice"


def billing_mode_suffix(mode):
    return "thu-khoa" if mode == "COURSE" else "thu-thang"


def load_qr_image(data_uri):
    if not data_uri or "," not in str(data_uri):
        return None
    try:
        _, encoded = str(data_uri).split(",", 1)
        return ImageReader(io.BytesIO(base64.b64decode(encoded)))
    except Exception:
        return None


def set_font(c, size=10, bold=False):
    c.setFont(FONTS["bold"] if bold else FONTS["regular"], size)


def draw_text(c, text, x, y, size=10, bold=False, align="left"):
    set_font(c, size, bold)
    value = str(text or "")
    if align == "right":
        c.drawRightString(x, y, value)
    elif align == "center":
        c.drawCentredString(x, y, value)
    else:
        c.drawString(x, y, value)


def wrap_text(c, text, max_width, size=9, bold=False):
    set_font(c, size, bold)
    words = str(text or "").split()
    if not words:
        return [""]
    lines = []
    current = words[0]
    for word in words[1:]:
        tentative = current + " " + word
        if pdfmetrics.stringWidth(tentative, FONTS["bold"] if bold else FONTS["regular"], size) <= max_width:
            current = tentative
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_multiline_text(c, text, x, y_top, max_width, size=9, bold=False, leading=11):
    lines = wrap_text(c, text, max_width, size=size, bold=bold)
    y = y_top
    for line in lines:
        draw_text(c, line, x, y, size=size, bold=bold)
        y -= leading
    return y


def fit_text_to_box(c, text, width, height, base_size=10, bold=False):
    start_size = int(base_size)
    for size in range(start_size, 7, -1):
        leading = size + 1
        lines = wrap_text(c, text, max(10, width - 8), size=size, bold=bold)
        block_height = len(lines) * leading
        if block_height <= max(10, height - 6):
            return lines, size, leading
    size = 8
    leading = 9
    lines = wrap_text(c, text, max(10, width - 8), size=size, bold=bold)
    return lines[: max(1, int((height - 6) // leading))], size, leading


def draw_table(c, x, y_top, col_widths, row_heights, rows, bold_cells=None, alignments=None, font_size=10):
    bold_cells = bold_cells or set()
    alignments = alignments or {}
    total_width = sum(col_widths)
    total_height = sum(row_heights)
    bottom_y = y_top - total_height
    c.rect(x, bottom_y, total_width, total_height)

    cy = y_top
    for row_index, row_height in enumerate(row_heights):
        cy -= row_height
        cx = x
        for col_index, col_width in enumerate(col_widths):
            c.rect(cx, cy, col_width, row_height)
            value = ""
            if row_index < len(rows) and col_index < len(rows[row_index]):
                value = rows[row_index][col_index]
            align = alignments.get((row_index, col_index), "left")
            bold = (row_index, col_index) in bold_cells
            lines, fitted_size, leading = fit_text_to_box(c, value, col_width, row_height, base_size=font_size, bold=bold)
            block_height = len(lines) * leading
            text_y = cy + (row_height + block_height) / 2 - fitted_size
            for line in lines:
                text_x = cx + 4
                if align == "center":
                    text_x = cx + col_width / 2
                elif align == "right":
                    text_x = cx + col_width - 4
                draw_text(c, line, text_x, text_y, size=fitted_size, bold=bold, align=align)
                text_y -= leading
            cx += col_width
    return bottom_y


def draw_invoice_page(c, charge, payment_profile):
    student = charge["student"]
    class_info = charge["class"]
    period_name = charge["billingPeriod"]["periodName"]
    branch_name = class_info["branch"]["name"] or "Trung tâm"
    period_label = format_period_label(period_name)
    serial = get_invoice_serial(charge.get("invoice", {}).get("invoiceNo") if charge.get("invoice") else None)
    paid = sum(item.get("amount", 0) for item in charge.get("allocations", []))
    remaining = max((charge.get("totalAmount") or 0) - paid, 0)
    total_sessions = (charge.get("sessionCount") or 0) + (charge.get("absentCount") or 0) + (charge.get("deductedCount") or 0)
    month_number = period_name.split("-")[1] if "-" in period_name else ""
    is_course = charge.get("billingModel") == "COURSE"
    due_date = get_due_date_label(period_name)

    outer_x = MARGIN_X
    outer_y = MARGIN_Y
    outer_w = PAGE_WIDTH - 2 * MARGIN_X
    outer_h = PAGE_HEIGHT - 2 * MARGIN_Y

    c.setLineWidth(1)
    c.rect(outer_x, outer_y, outer_w, outer_h)

    y = PAGE_HEIGHT - MARGIN_Y - 12

    logo_size = 18 * mm
    logo_x = outer_x + 8
    logo_y = y - logo_size + 1
    c.rect(logo_x, logo_y, logo_size, logo_size)
    draw_text(c, get_branch_short_name(branch_name), logo_x + logo_size / 2, logo_y + logo_size / 2 - 4, size=10, bold=True, align="center")
    draw_text(c, branch_name, logo_x + logo_size + 8, y - 10, size=14, bold=True)

    draw_text(c, "PHIẾU THÔNG", outer_x + outer_w - 10, y - 2, size=15, bold=True, align="right")
    draw_text(c, "BÁO HỌC PHÍ", outer_x + outer_w - 10, y - 18, size=15, bold=True, align="right")
    draw_text(c, period_label, outer_x + outer_w - 10, y - 34, size=12.5, bold=True, align="right")
    draw_text(c, f"STT: {serial}", outer_x + 8, logo_y - 12, size=10.5, bold=True)

    table_top = y - 64
    info_col_widths = [32 * mm, 72 * mm, 22 * mm, outer_w - 16 - (32 + 72 + 22) * mm]
    info_row_heights = [18 * mm, 18 * mm]
    info_rows = [
        ["Mã học sinh", student.get("studentCode", "—"), "Cơ sở", branch_name],
        ["Họ tên", student.get("fullName", "—"), "Lớp", class_info.get("className", "—")],
    ]
    info_bold = {(r, cidx) for r in range(2) for cidx in range(4)}
    info_align = {(0, 0): "center", (0, 1): "center", (0, 2): "center", (0, 3): "center", (1, 0): "center", (1, 1): "center", (1, 2): "center", (1, 3): "center"}
    current_y = draw_table(c, outer_x + 8, table_top, info_col_widths, info_row_heights, info_rows, info_bold, info_align, font_size=9.5)

    current_y -= 14
    draw_text(c, "Học phí tháng trước:" if not is_course else "Công nợ trước khóa:", outer_x + 8, current_y, size=11, bold=True)
    current_y -= 6
    previous_rows = [[
        "Học phí nợ tính đến đầu kỳ (VND)" if not is_course else "Công nợ / tồn trước khi vào phiếu này (VND)",
        format_vnd(charge.get("openingBalance", 0)),
    ]]
    current_y = draw_table(
        c,
        outer_x + 8,
        current_y - 4,
        [outer_w - 16 - 60 * mm, 60 * mm],
        [14 * mm],
        previous_rows,
        {(0, 1)},
        {(0, 1): "center"},
        font_size=10,
    )

    current_y -= 16
    draw_text(c, "Học phí tháng:" if not is_course else "Thông tin khóa học:", outer_x + 8, current_y, size=11, bold=True)
    current_y -= 6

    if not is_course:
        month_rows = [
            [f"Số buổi nghỉ tháng {month_number}", str(charge.get("absentCount", 0))],
            [f"Tổng số buổi tháng {month_number}", str(total_sessions)],
            ["Số buổi tính phí", str(charge.get("sessionCount", 0))],
            ["Tiền giáo trình (VND)", format_vnd(charge.get("materialsAmount", 0))],
            [f"Học phí {period_name} (VND)", format_vnd(charge.get("tuitionAmount", 0))],
        ]
    else:
        month_rows = [
            ["Tổng số buổi toàn khóa", str(total_sessions)],
            ["Số buổi đã tính trong phiếu khóa", str(charge.get("sessionCount", 0))],
            ["Tiền giáo trình / phát sinh (VND)", format_vnd(charge.get("materialsAmount", 0))],
            ["Học phí trọn khóa (VND)", format_vnd(charge.get("tuitionAmount", 0))],
        ]

    month_row_heights = [10 * mm for _ in month_rows]
    month_bold = {(len(month_rows) - 1, 1)}
    month_align = {(idx, 1): "center" for idx in range(len(month_rows))}
    current_y = draw_table(
        c,
        outer_x + 8,
        current_y - 4,
        [outer_w - 16 - 60 * mm, 60 * mm],
        month_row_heights,
        month_rows,
        month_bold,
        month_align,
        font_size=10,
    )

    current_y -= 16
    draw_text(c, "Thanh toán:", outer_x + 8, current_y, size=11, bold=True)
    current_y -= 6
    current_y = draw_table(
        c,
        outer_x + 8,
        current_y - 4,
        [outer_w - 16 - 60 * mm, 60 * mm],
        [20 * mm],
        [["TỔNG PHẢI NỘP (VND)", format_vnd(charge.get("totalAmount", 0))]],
        {(0, 0), (0, 1)},
        {(0, 0): "center", (0, 1): "center"},
        font_size=13,
    )

    current_y -= 4
    payment_box_h = 60 * mm
    left_w = 108 * mm
    right_w = outer_w - 16 - left_w
    payment_top = current_y
    payment_bottom = payment_top - payment_box_h

    left_x = outer_x + 8
    right_x = left_x + left_w

    c.rect(left_x, payment_bottom, left_w, payment_box_h)
    c.rect(right_x, payment_bottom, right_w, payment_box_h)
    c.line(left_x, payment_top - 18, right_x + right_w, payment_top - 18)

    draw_text(c, "Thanh toán tiền mặt (PH mang kèm thông báo này để thu)", left_x + 4, payment_top - 12, size=8)
    draw_text(c, "Tại các cơ sở (có kèm theo liên hồng của TT)", right_x + 4, payment_top - 12, size=8)

    bank_name = payment_profile.get("bankName") if payment_profile else None
    account_number = payment_profile.get("accountNumber") if payment_profile else None
    account_holder = payment_profile.get("accountHolder") if payment_profile else None
    payment_instruction = payment_profile.get("paymentInstruction") if payment_profile else None
    qr_data = payment_profile.get("qrImageData") if payment_profile else None

    left_text_top = payment_top - 30
    draw_text(c, "Thanh toán chuyển khoản", left_x + 4, left_text_top, size=9)
    draw_text(c, f"NH: {bank_name or 'Chưa cấu hình'}", left_x + 4, left_text_top - 12, size=9, bold=True)
    draw_text(c, f"STK: {account_number or 'Chưa cấu hình'}", left_x + 4, left_text_top - 24, size=9, bold=True)
    draw_multiline_text(c, account_holder or "Chưa cấu hình chủ tài khoản", left_x + 4, left_text_top - 36, 52 * mm, size=9, leading=10)

    qr_size = 26 * mm
    qr_x = left_x + left_w - qr_size - 10
    qr_y = payment_bottom + 10
    qr = load_qr_image(qr_data)
    if qr:
        c.drawImage(qr, qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True, mask="auto")
    else:
        c.rect(qr_x, qr_y, qr_size, qr_size)
        draw_text(c, "Chưa có QR", qr_x + qr_size / 2, qr_y + qr_size / 2 - 4, size=8, align="center")

    transfer_content = f"{student.get('fullName', 'Học viên')} - {class_info.get('className', 'Lớp')}"
    right_text_top = payment_top - 30
    line_after_content = draw_multiline_text(c, f"Nội dung: {transfer_content}", right_x + 4, right_text_top, right_w - 8, size=8.5, bold=True, leading=10)

    instruction_block = payment_instruction or "PH chuyển khoản xong chụp xác nhận gửi cho giáo vụ hoặc nhóm phụ huynh."
    line_y = draw_multiline_text(c, instruction_block, right_x + 4, line_after_content - 2, right_w - 8, size=8.5, leading=9.5)
    draw_text(c, f"Đã thanh toán: {format_vnd(paid)}", right_x + 4, line_y - 2, size=8.5)
    draw_text(c, f"Còn cần nộp: {format_vnd(remaining)}", right_x + 4, line_y - 13, size=8.5)
    draw_text(c, f"Hạn thanh toán: trước ngày {due_date}", right_x + 4, line_y - 24, size=8.5)
    draw_text(c, f"Ngày xuất: {format_date(charge.get('invoice', {}).get('issuedAt') if charge.get('invoice') else None)}", right_x + 4, line_y - 35, size=8.5)

    footer_center_x = outer_x + outer_w / 2
    draw_text(c, "Mọi thắc mắc PH liên hệ trực tiếp với Trung tâm để được giải đáp.", footer_center_x, outer_y + 20, size=8.5, align="center")
    draw_text(c, f"{branch_name} - CHẤT LƯỢNG LÀ MỤC TIÊU HOẠT ĐỘNG", footer_center_x, outer_y + 10, size=10.5, bold=True, align="center")
    draw_text(c, "Chân thành cảm ơn sự tin tưởng của Quý phụ huynh!", footer_center_x, outer_y + 2, size=8.5, align="center")


def render_pdf_bytes(charges, payment_profile):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    for index, charge in enumerate(charges):
        if index > 0:
            c.showPage()
        draw_invoice_page(c, charge, payment_profile)
    c.save()
    return buffer.getvalue()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python render_invoices_pdf.py <input.json> <output>")

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    charges = payload.get("charges", [])
    payment_profile = payload.get("paymentProfile") or {}
    mode = payload.get("mode", "merged")

    if mode == "separate":
        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for charge in charges:
                pdf_bytes = render_pdf_bytes([charge], payment_profile)
                file_name = sanitize_file_name(
                    f"{charge['student']['fullName']}_{charge['billingPeriod']['periodName']}_{billing_mode_suffix(charge['billingModel'])}.pdf"
                )
                archive.writestr(file_name, pdf_bytes)
    else:
        pdf_bytes = render_pdf_bytes(charges, payment_profile)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)


if __name__ == "__main__":
    main()
